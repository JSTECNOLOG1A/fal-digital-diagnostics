import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { canDelete, canWrite, isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { CreateFinancialDiagnosisDto, UpdateFinancialDiagnosisDto } from './dto/financial.dto';

/**
 * dataBaseAbertura/dataBaseFechamento chegam do DTO já validadas no
 * formato "MM/AAAA" (ver financial.dto.ts). Convertemos para o dia 1
 * daquele mês em UTC para gravar na coluna DateTime do Postgres.
 */
function parseMonthYear(value: string): Date {
  const [month, year] = value.split('/').map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

@Injectable()
export class FinancialDiagnosisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private resolveTenantId(actor: AuthUser, explicit?: string): string {
    if (isHQ(actor.role)) {
      const id = explicit ?? actor.tenantId;
      if (!id) throw new ForbiddenException('tenantId is required');
      return id;
    }
    if (!actor.tenantId) throw new ForbiddenException('No tenant scope');
    if (explicit && explicit !== actor.tenantId) {
      throw new ForbiddenException('Tenant scope violation');
    }
    return actor.tenantId;
  }

  private rlsOpts(actor: AuthUser, tenantId?: string | null) {
    return { tenantId: tenantId ?? actor.tenantId, isHq: isHQ(actor.role) };
  }

  async list(
    actor: AuthUser,
    filters: { groupId?: string; companyId?: string; unitId?: string; includeArchived?: boolean },
  ) {
    const deletedFilter = filters.includeArchived ? {} : { deletedAt: null };
    const scopeFilter = {
      ...(filters.groupId ? { groupId: filters.groupId } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.unitId ? { unitId: filters.unitId } : {}),
    };
    const where = isHQ(actor.role)
      ? { ...deletedFilter, ...scopeFilter }
      : { tenantId: actor.tenantId!, ...deletedFilter, ...scopeFilter };
    const diagnoses = await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialDiagnosis.findMany({ where, orderBy: { createdAt: 'desc' } }),
    );
    if (diagnoses.length === 0) return diagnoses;

    // hasFinalizedReport — usado pela Central de Análises Financeiras do
    // Grupo (GroupFinancialAnalysesTab.jsx) pra só marcar "Concluída"/4-4
    // quando, além do diagnóstico processado, o Relatório da Análise
    // também tiver sido finalizado. Uma query extra (IN, não N+1) em vez
    // de recalcular por diagnóstico.
    const finalizedVersions = await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialReportVersion.findMany({
        where: { financialDiagnosisId: { in: diagnoses.map((d) => d.id) }, status: 'final' },
        select: { financialDiagnosisId: true },
      }),
    );
    const finalizedSet = new Set(finalizedVersions.map((v) => v.financialDiagnosisId));
    return diagnoses.map((d) => ({ ...d, hasFinalizedReport: finalizedSet.has(d.id) }));
  }

  async get(actor: AuthUser, id: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const diagnosis = await tx.financialDiagnosis.findFirst({ where: { id, deletedAt: null } });
      if (!diagnosis) throw new NotFoundException('FinancialDiagnosis not found');
      return diagnosis;
    });
  }

  async create(actor: AuthUser, dto: CreateFinancialDiagnosisDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    if (dto.analysisType && dto.analysisType !== 'individual') {
      throw new ForbiddenException(
        `analysisType '${dto.analysisType}' ainda não é suportado (Fase 1 só cobre 'individual').`,
      );
    }
    if (!dto.groupId && !dto.companyId && !dto.unitId) {
      throw new ForbiddenException('Informe groupId, companyId ou unitId.');
    }

    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      // Resolve tenant a partir da entidade de escopo informada.
      let tenantId = dto.tenantId ?? actor.tenantId ?? undefined;
      if (dto.companyId) {
        const company = await tx.company.findFirst({ where: { id: dto.companyId, deletedAt: null } });
        if (!company) throw new NotFoundException('Company not found');
        tenantId = tenantId ?? company.tenantId;
      } else if (dto.unitId) {
        const unit = await tx.operationalUnit.findFirst({ where: { id: dto.unitId, deletedAt: null } });
        if (!unit) throw new NotFoundException('OperationalUnit not found');
        tenantId = tenantId ?? unit.tenantId;
      } else if (dto.groupId) {
        const group = await tx.group.findFirst({ where: { id: dto.groupId, deletedAt: null } });
        if (!group) throw new NotFoundException('Group not found');
        tenantId = tenantId ?? group.tenantId;
      }
      tenantId = this.resolveTenantId(actor, tenantId);
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId);

      const diagnosis = await tx.financialDiagnosis.create({
        data: {
          tenantId,
          groupId: dto.groupId,
          companyId: dto.companyId,
          unitId: dto.unitId,
          scopeLevel: dto.scopeLevel ?? (dto.unitId ? 'unit' : dto.companyId ? 'company' : 'group'),
          analysisType: 'individual',
          title: dto.title,
          firstPeriod: dto.firstPeriod,
          lastPeriod: dto.lastPeriod,
          periodicidade: dto.periodicidade,
          accountPlanId: dto.accountPlanId,
          notes: dto.notes,
          dataBaseAbertura: dto.dataBaseAbertura ? parseMonthYear(dto.dataBaseAbertura) : undefined,
          dataBaseFechamento: dto.dataBaseFechamento ? parseMonthYear(dto.dataBaseFechamento) : undefined,
          monthsCount: dto.monthsCount,
        },
      });
      await this.audit.log({
        actorId: actor.id,
        tenantId,
        action: 'financial_diagnosis.create',
        entityType: 'financial_diagnosis',
        entityId: diagnosis.id,
      });
      return diagnosis;
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateFinancialDiagnosisDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.financialDiagnosis.findFirst({
        where: dto.isArchived === false ? { id } : { id, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('FinancialDiagnosis not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const data: Record<string, unknown> = {};
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.firstPeriod !== undefined) data.firstPeriod = dto.firstPeriod;
      if (dto.lastPeriod !== undefined) data.lastPeriod = dto.lastPeriod;
      if (dto.periodicidade !== undefined) data.periodicidade = dto.periodicidade;
      if (dto.accountPlanId !== undefined) data.accountPlanId = dto.accountPlanId;
      if (dto.notes !== undefined) data.notes = dto.notes;
      if (dto.dataBaseAbertura !== undefined) data.dataBaseAbertura = parseMonthYear(dto.dataBaseAbertura);
      if (dto.dataBaseFechamento !== undefined) data.dataBaseFechamento = parseMonthYear(dto.dataBaseFechamento);
      if (dto.monthsCount !== undefined) data.monthsCount = dto.monthsCount;
      if (dto.currentUploadId !== undefined) data.currentUploadId = dto.currentUploadId;
      if (dto.isArchived === true) data.deletedAt = new Date();
      if (dto.isArchived === false) data.deletedAt = null;

      const diagnosis = await tx.financialDiagnosis.update({ where: { id }, data });
      await this.audit.log({
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: dto.isArchived ? 'financial_diagnosis.archive' : 'financial_diagnosis.update',
        entityType: 'financial_diagnosis',
        entityId: id,
      });
      return diagnosis;
    });
  }

  async delete(actor: AuthUser, id: string) {
    if (!canDelete(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.financialDiagnosis.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw new NotFoundException('FinancialDiagnosis not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const diagnosis = await tx.financialDiagnosis.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.audit.log({
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: 'financial_diagnosis.delete',
        entityType: 'financial_diagnosis',
        entityId: id,
      });
      return diagnosis;
    });
  }
}
