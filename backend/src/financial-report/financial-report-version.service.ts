import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { FinancialReportDataService } from './financial-report-data.service';
import {
  CreateFinancialReportVersionDto,
  FinalizeFinancialReportVersionDto,
  UpdateFinancialReportTextDto,
} from './dto/financial-report.dto';

/**
 * Ciclo de vida do FinancialReportVersion — mesmo padrão de versionamento
 * imutável de AssessmentReportVersion (snapshot congelado, nunca
 * sobrescrito): "Gerar/Atualizar" reconstrói o payload num rascunho
 * reaproveitável; "Finalizar" congela essa versão em definitivo. Edições
 * manuais de texto (reviewedTextOverrides) sobrevivem a uma regeneração a
 * menos que o usuário confirme explicitamente a sobrescrita.
 */
@Injectable()
export class FinancialReportVersionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly data: FinancialReportDataService,
    private readonly audit: AuditService,
  ) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  private async loadDiagnosis(actor: AuthUser, diagnosisId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const diagnosis = await tx.financialDiagnosis.findFirst({ where: { id: diagnosisId, deletedAt: null } });
      if (!diagnosis) throw new NotFoundException('FinancialDiagnosis not found');
      if (!isHQ(actor.role) && actor.tenantId !== diagnosis.tenantId) throw new ForbiddenException('Tenant scope violation');
      return diagnosis;
    });
  }

  private async loadVersion(actor: AuthUser, versionId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const version = await tx.financialReportVersion.findFirst({ where: { id: versionId } });
      if (!version) throw new NotFoundException('FinancialReportVersion not found');
      if (!isHQ(actor.role) && actor.tenantId !== version.tenantId) throw new ForbiddenException('Tenant scope violation');
      return version;
    });
  }

  async listVersions(actor: AuthUser, diagnosisId: string) {
    await this.loadDiagnosis(actor, diagnosisId);
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialReportVersion.findMany({ where: { financialDiagnosisId: diagnosisId }, orderBy: { versionNumber: 'desc' } }),
    );
  }

  async getVersion(actor: AuthUser, versionId: string) {
    return this.loadVersion(actor, versionId);
  }

  /** "Gerar/Atualizar relatório" — reconstrói o payload num rascunho existente ou cria um novo. */
  async generateOrUpdate(actor: AuthUser, dto: CreateFinancialReportVersionDto) {
    const diagnosis = await this.loadDiagnosis(actor, dto.financialDiagnosisId);
    const payload = await this.data.buildPayload(actor, dto.financialDiagnosisId);
    const payloadChecksum = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const latest = await tx.financialReportVersion.findFirst({
        where: { financialDiagnosisId: dto.financialDiagnosisId },
        orderBy: { versionNumber: 'desc' },
      });

      // Uma versão "final" existente cujos dados subjacentes mudaram desde a
      // finalização passa a ficar marcada como desatualizada — sem alterar o
      // PDF/snapshot já emitido.
      if (latest?.status === 'final' && latest.payloadChecksum !== payloadChecksum) {
        await tx.financialReportVersion.update({ where: { id: latest.id }, data: { status: 'outdated' } });
      }

      const reusable = latest && latest.status !== 'final' ? latest : null;
      const reviewedTextOverrides = dto.overwriteReviewedText ? Prisma.JsonNull : (reusable?.reviewedTextOverrides ?? undefined);

      if (reusable) {
        return tx.financialReportVersion.update({
          where: { id: reusable.id },
          data: {
            status: 'generated',
            baseDatePeriod: payload.cover.baseDatePeriod,
            comparativePeriods: payload.cover.comparativePeriods,
            payloadSnapshot: payload as unknown as Prisma.InputJsonValue,
            payloadChecksum,
            ...(reviewedTextOverrides !== undefined ? { reviewedTextOverrides } : {}),
            generatedAt: new Date(),
            generatedBy: actor.email,
          },
        });
      }

      const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;
      return tx.financialReportVersion.create({
        data: {
          tenantId: diagnosis.tenantId,
          financialDiagnosisId: dto.financialDiagnosisId,
          versionNumber: nextVersionNumber,
          status: 'generated',
          baseDatePeriod: payload.cover.baseDatePeriod,
          comparativePeriods: payload.cover.comparativePeriods,
          payloadSnapshot: payload as unknown as Prisma.InputJsonValue,
          payloadChecksum,
          generatedAt: new Date(),
          generatedBy: actor.email,
        },
      });
    });
  }

  async updateReviewedText(actor: AuthUser, versionId: string, dto: UpdateFinancialReportTextDto) {
    const version = await this.loadVersion(actor, versionId);
    if (version.status === 'final') throw new BadRequestException('Versão finalizada não pode ser editada — gere uma nova versão.');
    const overrides = ((version.reviewedTextOverrides as Record<string, string> | null) ?? {}) as Record<string, string>;
    overrides[dto.sectionKey] = dto.text;
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialReportVersion.update({
        where: { id: versionId },
        data: { reviewedTextOverrides: overrides as unknown as Prisma.InputJsonValue, status: version.status === 'generated' ? 'in_review' : version.status },
      }),
    );
  }

  /** "Finalizar" — congela a versão em definitivo; não pode mais ser editada. */
  async finalize(actor: AuthUser, versionId: string, dto: FinalizeFinancialReportVersionDto) {
    const version = await this.loadVersion(actor, versionId);
    if (version.status === 'final') throw new BadRequestException('Versão já finalizada.');
    if (!version.payloadSnapshot) throw new BadRequestException('Gere o relatório antes de finalizar.');

    // Trava explícita pedida pelo usuário: a DFC não pode ter resíduo não
    // classificado ("Movimentações patrimoniais não identificadas") na
    // versão definitiva — só rascunho/revisão podem sair com a ressalva
    // visível. Ver DfcReconciliation em financial-report-data.service.ts.
    const reconciliation = (version.payloadSnapshot as any)?.dfcReconciliation;
    if (reconciliation?.status === 'nao_conciliada') {
      throw new BadRequestException(
        `A DFC não está reconciliada (períodos pendentes de classificação: ${(reconciliation.unclassifiedPeriods ?? []).join(', ')}). Classifique a composição de "Movimentações patrimoniais não identificadas" (ou registre um ajuste manual de DFC) antes de finalizar esta versão.`,
      );
    }

    const finalized = await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialReportVersion.update({
        where: { id: versionId },
        data: { status: 'final', finalizedAt: new Date(), finalizedBy: actor.email, watermarkDraft: false, notes: dto.notes },
      }),
    );

    await this.audit.log({
      actorId: actor.id,
      tenantId: version.tenantId,
      action: 'financial_report_version.finalize',
      entityType: 'financial_report_version',
      entityId: versionId,
      metadata: { financialDiagnosisId: version.financialDiagnosisId, versionNumber: version.versionNumber },
    });

    return finalized;
  }
}
