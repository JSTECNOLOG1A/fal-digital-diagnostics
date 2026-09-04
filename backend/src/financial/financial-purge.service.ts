import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { canDelete, isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

/**
 * Porta local de purgeFinancialUploadData / purgeFinancialDerivedData /
 * deleteFinancialUploadSafe (funções serverless Base44). Os três originais
 * existem para simular atomicidade num backend sem transação real: cada um
 * cria um FinancialProcessingRun "de purge", grava um manifesto
 * before/deleted/after por entidade, faz o delete em lotes com
 * Promise.allSettled, checa pós-condição (nada sobrou) e só então atualiza o
 * diagnóstico — e deleteFinancialUploadSafe ainda soma tombstone +
 * snapshot + manifesto de recuperação com rollback manual em caso de falha
 * parcial.
 *
 * Aqui isso é substituído pelo mesmo padrão já usado no resto da Fase 2:
 * uma única transação Postgres (withTenantContext). Se qualquer delete
 * falhar, a transação inteira reverte sozinha — não precisa de manifesto,
 * checagem de pós-condição nem rollback escrito à mão. O preço dessa
 * simplificação: não existe o "recovery manifest" que permitiria restaurar
 * uma exclusão já confirmada (aqui, uma vez commitada, é definitivo — mas
 * como cada delete só roda dentro de uma transação atômica, nunca fica pela
 * metade).
 *
 * Igual ao original, os três exigem canDelete() (hq_admin/tenant_admin —
 * consultant NÃO pode).
 */
@Injectable()
export class FinancialPurgeService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser, tenantId?: string | null) {
    return { tenantId: tenantId ?? actor.tenantId, isHq: isHQ(actor.role) };
  }

  private assertTenantAccess(actor: AuthUser, tenantId: string) {
    if (isHQ(actor.role)) return;
    if (actor.tenantId !== tenantId) throw new ForbiddenException('Tenant scope violation');
  }

  /** Deleta tudo que deriva de um ou mais uploads (linhas de BP/DRE/DFC,
   * indicadores, balancete bruto, mapeamentos, validações) — usado tanto
   * pela limpeza de um período quanto pela limpeza nuclear do diagnóstico
   * inteiro. Retorna os IDs dos FinancialProcessingRun que ficaram "órfãos"
   * (sem outputs), pra quem chamar decidir se limpa o ponteiro do
   * diagnóstico. */
  private async deleteDerivativesForUploads(tx: any, diagnosisId: string, uploadIds: string[]) {
    if (uploadIds.length === 0) return { runIds: [] as string[] };
    const runs = await tx.financialProcessingRun.findMany({
      where: { financialDiagnosisId: diagnosisId, financialUploadId: { in: uploadIds } },
      select: { id: true },
    });
    const runIds = runs.map((r: { id: string }) => r.id);

    await tx.financialStatementLine.deleteMany({
      where: {
        financialDiagnosisId: diagnosisId,
        OR: [{ financialUploadId: { in: uploadIds } }, ...(runIds.length ? [{ processingRunId: { in: runIds } }] : [])],
      },
    });
    if (runIds.length) {
      await tx.financialIndicatorSnapshot.deleteMany({
        where: { financialDiagnosisId: diagnosisId, processingRunId: { in: runIds } },
      });
      await tx.financialDfcCompositionLine.deleteMany({
        where: { financialDiagnosisId: diagnosisId, processingRunId: { in: runIds } },
      });
    }
    await tx.financialTrialBalanceLine.deleteMany({
      where: { financialDiagnosisId: diagnosisId, financialUploadId: { in: uploadIds } },
    });
    await tx.financialMappingResolution.deleteMany({
      where: { financialDiagnosisId: diagnosisId, financialUploadId: { in: uploadIds } },
    });
    await tx.financialValidationResult.deleteMany({
      where: { financialDiagnosisId: diagnosisId, financialUploadId: { in: uploadIds } },
    });
    return { runIds };
  }

  /** purgeFinancialDerivedData: limpa os dados derivados de UM upload,
   * mantém o arquivo (o upload continua existindo, só sem BP/DRE/DFC/
   * indicadores/validação) — o usuário pode reprocessar sem reenviar. */
  async purgeUploadDerived(actor: AuthUser, diagnosisId: string, uploadId: string) {
    if (!canDelete(actor.role)) throw new ForbiddenException('Permissão insuficiente para operação destrutiva.');
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const diagnosis = await tx.financialDiagnosis.findFirst({ where: { id: diagnosisId, deletedAt: null } });
      if (!diagnosis) throw new NotFoundException('FinancialDiagnosis not found');
      this.assertTenantAccess(actor, diagnosis.tenantId);
      const upload = await tx.financialUpload.findFirst({ where: { id: uploadId, deletedAt: null } });
      if (!upload || upload.financialDiagnosisId !== diagnosisId) {
        throw new BadRequestException('Upload não pertence a esse diagnóstico.');
      }
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, diagnosis.tenantId);

      const { runIds } = await this.deleteDerivativesForUploads(tx, diagnosisId, [uploadId]);

      const data: Record<string, unknown> = {
        integrityStatus: 'unknown',
        integrityCheckedAt: new Date(),
      };
      if (diagnosis.currentProcessingSnapshotId && runIds.includes(diagnosis.currentProcessingSnapshotId)) {
        data.currentProcessingSnapshotId = null;
        data.status = 'validated';
      }
      await tx.financialDiagnosis.update({ where: { id: diagnosisId }, data });

      return { success: true, upload_id: uploadId };
    });
  }

  /** deleteFinancialUploadSafe: purga os derivados + soft-delete do próprio
   * upload (mesmo padrão de FinancialUploadService.delete — deletedAt +
   * isCurrent:false). Reaponta current_upload_id/current_processing_snapshot_id
   * do diagnóstico pro upload válido mais recente que sobrar, ou null. */
  async deleteUploadSafe(actor: AuthUser, diagnosisId: string, uploadId: string) {
    if (!canDelete(actor.role)) throw new ForbiddenException('Permissão insuficiente para operação destrutiva.');
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const diagnosis = await tx.financialDiagnosis.findFirst({ where: { id: diagnosisId, deletedAt: null } });
      if (!diagnosis) throw new NotFoundException('FinancialDiagnosis not found');
      this.assertTenantAccess(actor, diagnosis.tenantId);
      const upload = await tx.financialUpload.findFirst({ where: { id: uploadId, deletedAt: null } });
      if (!upload || upload.financialDiagnosisId !== diagnosisId) {
        throw new BadRequestException('Upload não pertence a esse diagnóstico.');
      }
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, diagnosis.tenantId);

      const { runIds } = await this.deleteDerivativesForUploads(tx, diagnosisId, [uploadId]);
      await tx.financialUpload.update({
        where: { id: uploadId },
        data: { deletedAt: new Date(), isCurrent: false },
      });

      const remaining = await tx.financialUpload.findMany({
        where: { financialDiagnosisId: diagnosisId, deletedAt: null, id: { not: uploadId } },
        orderBy: { createdAt: 'desc' },
      });
      const valid = remaining.filter((u: { uploadStatus: string }) => ['validated', 'processed'].includes(u.uploadStatus));
      const newCurrent = valid[0] ?? remaining[0] ?? null;

      const data: Record<string, unknown> = { integrityStatus: 'unknown', integrityCheckedAt: new Date() };
      const wasCurrent = diagnosis.currentUploadId === uploadId;
      const pointedAtDeletedRun = diagnosis.currentProcessingSnapshotId && runIds.includes(diagnosis.currentProcessingSnapshotId);
      if (wasCurrent || pointedAtDeletedRun) {
        data.currentUploadId = newCurrent?.id ?? null;
        data.currentProcessingSnapshotId = null;
        data.status = newCurrent ? (newCurrent.uploadStatus === 'processed' ? 'validated' : newCurrent.uploadStatus) : 'draft';
      }
      await tx.financialDiagnosis.update({ where: { id: diagnosisId }, data });

      return { success: true, status: 'succeeded', upload_id: uploadId };
    });
  }

  /** purgeFinancialUploadData: reset nuclear — apaga TODOS os uploads do
   * diagnóstico (soft-delete) e todos os seus derivados, devolve o
   * diagnóstico ao estado 'draft'. */
  async purgeDiagnosis(actor: AuthUser, diagnosisId: string) {
    if (!canDelete(actor.role)) throw new ForbiddenException('Permissão insuficiente para operação destrutiva.');
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const diagnosis = await tx.financialDiagnosis.findFirst({ where: { id: diagnosisId, deletedAt: null } });
      if (!diagnosis) throw new NotFoundException('FinancialDiagnosis not found');
      this.assertTenantAccess(actor, diagnosis.tenantId);
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, diagnosis.tenantId);

      const uploads = await tx.financialUpload.findMany({ where: { financialDiagnosisId: diagnosisId, deletedAt: null } });
      const uploadIds = uploads.map((u: { id: string }) => u.id);

      await this.deleteDerivativesForUploads(tx, diagnosisId, uploadIds);
      if (uploadIds.length > 0) {
        await tx.financialUpload.updateMany({
          where: { id: { in: uploadIds } },
          data: { deletedAt: new Date(), isCurrent: false },
        });
      }

      await tx.financialDiagnosis.update({
        where: { id: diagnosisId },
        data: {
          status: 'draft',
          currentUploadId: null,
          currentProcessingSnapshotId: null,
          integrityStatus: 'unknown',
          integrityBlockingCount: 0,
          integrityWarningCount: 0,
          integrityCheckedAt: new Date(),
        },
      });

      return { success: true, status: 'succeeded' };
    });
  }
}
