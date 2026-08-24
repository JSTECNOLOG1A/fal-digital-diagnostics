import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { canDelete, canWrite, isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import {
  CreateCompanyDto,
  CreateGroupDto,
  CreateOperationalUnitDto,
  UpdateCompanyDto,
  UpdateGroupDto,
  UpdateOperationalUnitDto,
} from './dto/hierarchy.dto';

@Injectable()
export class HierarchyService {
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
    return {
      tenantId: tenantId ?? actor.tenantId,
      isHq: isHQ(actor.role),
    };
  }

  async listGroups(actor: AuthUser) {
    const where = isHQ(actor.role)
      ? { deletedAt: null }
      : { tenantId: actor.tenantId!, deletedAt: null };
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.group.findMany({
        where,
        include: { companies: { where: { deletedAt: null } } },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async createGroup(actor: AuthUser, dto: CreateGroupDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    const tenantId = this.resolveTenantId(actor, dto.tenantId);
    const group = await this.prisma.withTenantContext(
      this.rlsOpts(actor, tenantId),
      (tx) => tx.group.create({ data: { name: dto.name, tenantId } }),
    );
    await this.audit.log({
      actorId: actor.id,
      tenantId,
      action: 'group.create',
      entityType: 'group',
      entityId: group.id,
    });
    return group;
  }

  async listCompanies(
    actor: AuthUser,
    groupId?: string,
    includeArchived = false,
  ) {
    const deletedFilter = includeArchived ? {} : { deletedAt: null };
    const where = isHQ(actor.role)
      ? { ...deletedFilter, ...(groupId ? { groupId } : {}) }
      : {
          tenantId: actor.tenantId!,
          ...deletedFilter,
          ...(groupId ? { groupId } : {}),
        };
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.company.findMany({
        where,
        include: { units: { where: { deletedAt: null } } },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async createCompany(actor: AuthUser, dto: CreateCompanyDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();

    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const group = await tx.group.findFirst({
        where: { id: dto.groupId, deletedAt: null },
      });
      if (!group) throw new NotFoundException('Group not found');

      const tenantId = this.resolveTenantId(actor, dto.tenantId ?? group.tenantId);
      if (group.tenantId !== tenantId) {
        throw new ForbiddenException('Group belongs to another tenant');
      }

      // Reaplicar RLS com tenant alvo (HQ pode operar outro tenant)
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        tenantId,
      );

      const company = await tx.company.create({
        data: {
          tenantId,
          groupId: dto.groupId,
          name: dto.name,
          cnpj: this.normalizeCnpj(dto.cnpj),
          sector: dto.sector,
          erpSystem: dto.erpSystem,
        },
      });

      await this.audit.log({
        actorId: actor.id,
        tenantId,
        action: 'company.create',
        entityType: 'company',
        entityId: company.id,
      });
      return company;
    });
  }

  async listUnits(actor: AuthUser, companyId?: string) {
    const where = isHQ(actor.role)
      ? { deletedAt: null, ...(companyId ? { companyId } : {}) }
      : {
          tenantId: actor.tenantId!,
          deletedAt: null,
          ...(companyId ? { companyId } : {}),
        };
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.operationalUnit.findMany({
        where,
        orderBy: { name: 'asc' },
      }),
    );
  }

  async createUnit(actor: AuthUser, dto: CreateOperationalUnitDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();

    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const company = await tx.company.findFirst({
        where: { id: dto.companyId, deletedAt: null },
      });
      if (!company) throw new NotFoundException('Company not found');

      const tenantId = this.resolveTenantId(
        actor,
        dto.tenantId ?? company.tenantId,
      );
      if (company.tenantId !== tenantId) {
        throw new ForbiddenException('Company belongs to another tenant');
      }

      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        tenantId,
      );

      const unit = await tx.operationalUnit.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          name: dto.name,
          code: dto.code,
        },
      });

      await this.audit.log({
        actorId: actor.id,
        tenantId,
        action: 'unit.create',
        entityType: 'operational_unit',
        entityId: unit.id,
      });
      return unit;
    });
  }


  private normalizeCnpj(cnpj?: string | null): string | undefined {
    if (!cnpj) return undefined;
    const digits = cnpj.replace(/\D/g, '');
    return digits || undefined;
  }

  async updateGroup(actor: AuthUser, id: string, dto: UpdateGroupDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.group.findFirst({
        where: dto.isArchived === false ? { id } : { id, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('Group not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const data: Record<string, unknown> = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.isArchived === true) data.deletedAt = new Date();
      if (dto.isArchived === false) data.deletedAt = null;
      const group = await tx.group.update({ where: { id }, data });
      await this.audit.log({
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: dto.isArchived ? 'group.archive' : 'group.update',
        entityType: 'group',
        entityId: id,
      });
      return group;
    });
  }

  async deleteGroup(actor: AuthUser, id: string) {
    if (!canDelete(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.group.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw new NotFoundException('Group not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const group = await tx.group.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.audit.log({
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: 'group.delete',
        entityType: 'group',
        entityId: id,
      });
      return group;
    });
  }

  async updateCompany(actor: AuthUser, id: string, dto: UpdateCompanyDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.company.findFirst({
        where: dto.isArchived === false ? { id } : { id, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('Company not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const data: Record<string, unknown> = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.cnpj !== undefined) data.cnpj = this.normalizeCnpj(dto.cnpj) ?? null;
      if (dto.sector !== undefined) data.sector = dto.sector;
      if (dto.erpSystem !== undefined) data.erpSystem = dto.erpSystem;
      if (dto.isArchived === true) data.deletedAt = new Date();
      if (dto.isArchived === false) data.deletedAt = null;
      const company = await tx.company.update({ where: { id }, data });
      await this.audit.log({
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: dto.isArchived ? 'company.archive' : 'company.update',
        entityType: 'company',
        entityId: id,
      });
      return company;
    });
  }

  async deleteCompany(actor: AuthUser, id: string) {
    if (!canDelete(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.company.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw new NotFoundException('Company not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const company = await tx.company.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.audit.log({
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: 'company.delete',
        entityType: 'company',
        entityId: id,
      });
      return company;
    });
  }

  async updateUnit(actor: AuthUser, id: string, dto: UpdateOperationalUnitDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const restoring = dto.isArchived === false || dto.isActive === true;
      const existing = await tx.operationalUnit.findFirst({
        where: restoring ? { id } : { id, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('Unit not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const data: Record<string, unknown> = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.code !== undefined) data.code = dto.code;
      if (dto.isArchived === true || dto.isActive === false) data.deletedAt = new Date();
      if (dto.isArchived === false || dto.isActive === true) data.deletedAt = null;
      const unit = await tx.operationalUnit.update({ where: { id }, data });
      await this.audit.log({
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: 'unit.update',
        entityType: 'operational_unit',
        entityId: id,
      });
      return unit;
    });
  }

  async deleteUnit(actor: AuthUser, id: string) {
    if (!canDelete(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.operationalUnit.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('Unit not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const unit = await tx.operationalUnit.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.audit.log({
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: 'unit.delete',
        entityType: 'operational_unit',
        entityId: id,
      });
      return unit;
    });
  }
}
