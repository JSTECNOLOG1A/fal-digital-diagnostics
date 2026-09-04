import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { canDelete, canWrite, isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import {
  BulkCreateFinancialAccountPlanLinesDto,
  CreateFinancialAccountPlanDto,
  CreateFinancialAccountPlanLineDto,
  UpdateFinancialAccountPlanDto,
  UpdateFinancialAccountPlanLineDto,
} from './dto/financial.dto';

@Injectable()
export class FinancialAccountPlanService {
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

  // ── Planos ──────────────────────────────────────────────────────────

  async listPlans(actor: AuthUser, groupId?: string, includeArchived = false) {
    const deletedFilter = includeArchived ? {} : { deletedAt: null };
    const where = isHQ(actor.role)
      ? { ...deletedFilter, ...(groupId ? { groupId } : {}) }
      : { tenantId: actor.tenantId!, ...deletedFilter, ...(groupId ? { groupId } : {}) };
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialAccountPlan.findMany({ where, orderBy: { name: 'asc' } }),
    );
  }

  async getPlan(actor: AuthUser, id: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const plan = await tx.financialAccountPlan.findFirst({ where: { id, deletedAt: null } });
      if (!plan) throw new NotFoundException('FinancialAccountPlan not found');
      return plan;
    });
  }

  async createPlan(actor: AuthUser, dto: CreateFinancialAccountPlanDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const group = await tx.group.findFirst({ where: { id: dto.groupId, deletedAt: null } });
      if (!group) throw new NotFoundException('Group not found');

      const tenantId = this.resolveTenantId(actor, dto.tenantId ?? group.tenantId);
      if (group.tenantId !== tenantId) {
        throw new ForbiddenException('Group belongs to another tenant');
      }
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId);

      const plan = await tx.financialAccountPlan.create({
        data: {
          tenantId,
          groupId: dto.groupId,
          name: dto.name,
          description: dto.description,
          version: dto.version,
          isDefault: dto.isDefault ?? false,
        },
      });
      await this.audit.log({
        actorId: actor.id,
        tenantId,
        action: 'financial_account_plan.create',
        entityType: 'financial_account_plan',
        entityId: plan.id,
      });
      return plan;
    });
  }

  async updatePlan(actor: AuthUser, id: string, dto: UpdateFinancialAccountPlanDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.financialAccountPlan.findFirst({
        where: dto.isArchived === false ? { id } : { id, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('FinancialAccountPlan not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const data: Record<string, unknown> = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.version !== undefined) data.version = dto.version;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;
      if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
      if (dto.isArchived === true) data.deletedAt = new Date();
      if (dto.isArchived === false) data.deletedAt = null;
      const plan = await tx.financialAccountPlan.update({ where: { id }, data });
      await this.audit.log({
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: dto.isArchived ? 'financial_account_plan.archive' : 'financial_account_plan.update',
        entityType: 'financial_account_plan',
        entityId: id,
      });
      return plan;
    });
  }

  async deletePlan(actor: AuthUser, id: string) {
    if (!canDelete(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.financialAccountPlan.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw new NotFoundException('FinancialAccountPlan not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const plan = await tx.financialAccountPlan.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.audit.log({
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: 'financial_account_plan.delete',
        entityType: 'financial_account_plan',
        entityId: id,
      });
      return plan;
    });
  }

  // ── Linhas ──────────────────────────────────────────────────────────

  private async loadPlanForWrite(tx: any, actor: AuthUser, accountPlanId: string) {
    const plan = await tx.financialAccountPlan.findFirst({
      where: { id: accountPlanId, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('FinancialAccountPlan not found');
    this.resolveTenantId(actor, plan.tenantId);
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, plan.tenantId);
    return plan;
  }

  async listLines(actor: AuthUser, accountPlanId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialAccountPlanLine.findMany({
        where: { accountPlanId },
        orderBy: { accountCode: 'asc' },
      }),
    );
  }

  async createLine(actor: AuthUser, dto: CreateFinancialAccountPlanLineDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const plan = await this.loadPlanForWrite(tx, actor, dto.accountPlanId);
      const { accountPlanId, ...fields } = dto;
      const line = await tx.financialAccountPlanLine.create({
        data: { ...fields, accountPlanId, tenantId: plan.tenantId, signRule: 'normal' },
      });
      return line;
    });
  }

  async bulkCreateLines(actor: AuthUser, dto: BulkCreateFinancialAccountPlanLinesDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const plan = await this.loadPlanForWrite(tx, actor, dto.accountPlanId);
      if (dto.replace) {
        await tx.financialAccountPlanLine.deleteMany({ where: { accountPlanId: dto.accountPlanId } });
      }
      if (!dto.lines?.length) return { created: 0 };
      await tx.financialAccountPlanLine.createMany({
        data: dto.lines.map((line) => ({
          ...line,
          accountPlanId: dto.accountPlanId,
          tenantId: plan.tenantId,
          // sign_rule é sempre 'normal' — o sinal é calculado pela engine,
          // nunca importado/editado pelo usuário.
          signRule: 'normal',
        })),
      });
      await this.audit.log({
        actorId: actor.id,
        tenantId: plan.tenantId,
        action: 'financial_account_plan_line.bulk_create',
        entityType: 'financial_account_plan',
        entityId: dto.accountPlanId,
        metadata: { count: dto.lines.length, replace: !!dto.replace },
      });
      return { created: dto.lines.length };
    });
  }

  async updateLine(actor: AuthUser, id: string, dto: UpdateFinancialAccountPlanLineDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.financialAccountPlanLine.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('FinancialAccountPlanLine not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      // sign_rule nunca é aceito via update — sempre calculado pela engine.
      return tx.financialAccountPlanLine.update({ where: { id }, data: dto });
    });
  }

  async deleteLine(actor: AuthUser, id: string) {
    if (!canDelete(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.financialAccountPlanLine.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('FinancialAccountPlanLine not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      await tx.financialAccountPlanLine.delete({ where: { id } });
      return { id };
    });
  }

  async deleteAllLines(actor: AuthUser, accountPlanId: string) {
    if (!canDelete(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      await this.loadPlanForWrite(tx, actor, accountPlanId);
      const result = await tx.financialAccountPlanLine.deleteMany({ where: { accountPlanId } });
      return { deleted: result.count };
    });
  }
}
