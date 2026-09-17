import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import {
  FINANCIAL_FORMULA_VERSION,
  FINANCIAL_REGISTRY_VERSION,
} from './financial-canonical-registry.constants';

/**
 * Leitura dos outputs já persistidos por FinancialStatementsService.build()
 * (linhas de demonstração, indicadores, composição de DFC, mapeamentos) +
 * resolveCurrentFinancialOutputScope — o "ponteiro" que o frontend exige
 * antes de disparar qualquer uma dessas queries (useCurrentFinancialOutputScope).
 *
 * Filtragem: o backend só reduz pelo que é barato de indexar (diagnosisId +
 * uploadId/processingRunId/publicationStatus opcionais); o resto (dataset_scope,
 * period, entity_code etc.) o frontend já filtra em JS, igual ao padrão
 * existente em createClarityFinancialEntity() (ex: FinancialUpload.filter
 * que devolve tudo do diagnóstico e deixa is_current ser filtrado no cliente).
 */
@Injectable()
export class FinancialOutputService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser, tenantId?: string | null) {
    return { tenantId: tenantId ?? actor.tenantId, isHq: isHQ(actor.role) };
  }

  private async loadDiagnosis(actor: AuthUser, diagnosisId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const diagnosis = await tx.financialDiagnosis.findFirst({
        where: { id: diagnosisId, deletedAt: null },
      });
      if (!diagnosis) throw new NotFoundException('FinancialDiagnosis not found');
      if (!isHQ(actor.role) && actor.tenantId !== diagnosis.tenantId) {
        throw new ForbiddenException('Tenant scope violation');
      }
      return diagnosis;
    });
  }

  async listStatementLines(
    actor: AuthUser,
    diagnosisId: string,
    opts: { uploadId?: string; processingRunId?: string; publicationStatus?: string },
  ) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialStatementLine.findMany({
        where: {
          financialDiagnosisId: diagnosisId,
          ...(opts.uploadId ? { financialUploadId: opts.uploadId } : {}),
          ...(opts.processingRunId ? { processingRunId: opts.processingRunId } : {}),
          ...(opts.publicationStatus ? { publicationStatus: opts.publicationStatus } : {}),
        },
        orderBy: [{ period: 'asc' }, { displayOrder: 'asc' }],
        take: 50000,
      }),
    );
  }

  async listIndicatorSnapshots(
    actor: AuthUser,
    diagnosisId: string,
    opts: { processingRunId?: string; publicationStatus?: string; indicatorCode?: string },
  ) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialIndicatorSnapshot.findMany({
        where: {
          financialDiagnosisId: diagnosisId,
          ...(opts.processingRunId ? { processingRunId: opts.processingRunId } : {}),
          ...(opts.publicationStatus ? { publicationStatus: opts.publicationStatus } : {}),
          ...(opts.indicatorCode ? { indicatorCode: opts.indicatorCode } : {}),
        },
        orderBy: { period: 'desc' },
        take: 10000,
      }),
    );
  }

  async listDfcCompositionLines(
    actor: AuthUser,
    diagnosisId: string,
    opts: { processingRunId?: string; publicationStatus?: string },
  ) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialDfcCompositionLine.findMany({
        where: {
          financialDiagnosisId: diagnosisId,
          ...(opts.processingRunId ? { processingRunId: opts.processingRunId } : {}),
          ...(opts.publicationStatus ? { publicationStatus: opts.publicationStatus } : {}),
        },
        orderBy: { bucket: 'asc' },
        take: 5000,
      }),
    );
  }

  async listMappingResolutions(
    actor: AuthUser,
    diagnosisId: string,
    opts: { uploadId?: string; processingRunId?: string; publicationStatus?: string },
  ) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialMappingResolution.findMany({
        where: {
          financialDiagnosisId: diagnosisId,
          ...(opts.uploadId ? { financialUploadId: opts.uploadId } : {}),
          ...(opts.processingRunId ? { processingRunId: opts.processingRunId } : {}),
          ...(opts.publicationStatus ? { publicationStatus: opts.publicationStatus } : {}),
        },
        orderBy: { accountCode: 'asc' },
        take: 20000,
      }),
    );
  }

  async listDfcClassificationOverrides(actor: AuthUser, diagnosisId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialDfcClassificationOverride.findMany({
        where: { financialDiagnosisId: diagnosisId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async listProcessingRuns(actor: AuthUser, diagnosisId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialProcessingRun.findMany({
        where: { financialDiagnosisId: diagnosisId },
        orderBy: { startedAt: 'desc' },
        take: 50,
      }),
    );
  }

  async listDfcManualAdjustments(actor: AuthUser, diagnosisId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialDfcManualAdjustment.findMany({
        where: { financialDiagnosisId: diagnosisId },
        orderBy: { period: 'asc' },
      }),
    );
  }

  /**
   * Porta simplificada de checkFinancialDiagnosisIntegrity: só as contagens
   * reais + bloqueantes/avisos vindos de FinancialValidationResult. O
   * original também cruza achados de preparação multi-entidade
   * (FinancialPreparationRun/findings) e detecta órfãos/duplicidades entre
   * uploads — isso fica para quando a preparação multi-entidade (Fase 4)
   * for portada. Aqui preparation_runs/findings ficam sempre 0 e
   * orphans/linked_to_missing_upload/multi_entity ficam vazios — não é
   * "tudo íntegro", é "não verificado nesta versão", mas ao menos os
   * números de uploads/statement_lines/indicator_snapshots/validation_results
   * já são reais, não mais zero-fixo.
   */
  async checkIntegrity(actor: AuthUser, diagnosisId: string) {
    await this.loadDiagnosis(actor, diagnosisId);
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const [uploads, statementLines, indicatorSnapshots, validationResults] = await Promise.all([
        tx.financialUpload.count({ where: { financialDiagnosisId: diagnosisId, deletedAt: null } }),
        tx.financialStatementLine.count({ where: { financialDiagnosisId: diagnosisId, publicationStatus: 'active' } }),
        tx.financialIndicatorSnapshot.count({ where: { financialDiagnosisId: diagnosisId, publicationStatus: 'active' } }),
        tx.financialValidationResult.findMany({ where: { financialDiagnosisId: diagnosisId, publicationStatus: 'active' } }),
      ]);
      type ValidationRow = { blocking: boolean; severity: string; message: string | null; title: string | null; code: string | null };
      const blockingIssues = (validationResults as ValidationRow[])
        .filter((r) => r.blocking || r.severity === 'blocking')
        .map((r) => r.message || r.title || r.code || 'Pendência bloqueante não descrita.');
      const warnings = (validationResults as ValidationRow[])
        .filter((r) => !r.blocking && r.severity !== 'blocking')
        .map((r) => r.message || r.title || r.code || 'Aviso não descrito.');
      return {
        blocking_issues: blockingIssues,
        warnings,
        counts: {
          uploads,
          statement_lines: statementLines,
          indicator_snapshots: indicatorSnapshots,
          validation_results: validationResults.length,
          preparation_runs: 0,
          findings: 0,
        },
        orphans_no_upload_id: {},
        linked_to_missing_upload: {},
        multi_entity: {},
        fresh: true,
      };
    });
  }

  /**
   * Porta local de resolveCurrentFinancialOutputScope. O "snapshot atual"
   * aqui é sempre o FinancialProcessingRun succeeded mais recente apontado
   * por FinancialDiagnosis.currentProcessingSnapshotId (ver comentário de
   * arquitetura em financial-statements.service.ts — não existe uma tabela
   * de snapshot separada nesta porta).
   */
  async resolveOutputScope(actor: AuthUser, diagnosisId: string) {
    const diagnosis = await this.loadDiagnosis(actor, diagnosisId);
    if (!diagnosis.currentProcessingSnapshotId) {
      return { error: 'CURRENT_FINANCIAL_SNAPSHOT_MISSING' };
    }
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const run = await tx.financialProcessingRun.findFirst({
        where: { id: diagnosis.currentProcessingSnapshotId!, status: 'succeeded' },
      });
      if (!run) return { error: 'CURRENT_FINANCIAL_SNAPSHOT_MISSING' };
      const summary = (run.resultSummary as Record<string, unknown> | null) ?? {};
      const outputChecksum = (summary.output_checksum as string | undefined) ?? run.inputChecksum ?? undefined;
      if (!outputChecksum) return { error: 'CURRENT_FINANCIAL_SNAPSHOT_INVALID' };
      return {
        snapshot_id: run.id,
        processing_run_id: run.id,
        snapshot_status: 'active',
        output_checksum: outputChecksum,
        registry_version: (summary.registry_version as string | undefined) ?? FINANCIAL_REGISTRY_VERSION,
        formula_version: (summary.formula_version as string | undefined) ?? FINANCIAL_FORMULA_VERSION,
        mapping_checksum: outputChecksum,
      };
    });
  }
}
