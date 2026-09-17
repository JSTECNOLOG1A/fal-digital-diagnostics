import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { AccessStatus, AppRole } from '@prisma/client';
import { canInvite, isHQ, ROLES } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { InviteUserDto, ResendInviteDto, RevokeUserDto, UpdateUserRoleDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser) {
    if (isHQ(actor.role)) {
      return this.prisma.user.findMany({
        where: { deletedAt: null },
        select: this.publicSelect(),
        orderBy: { email: 'asc' },
      });
    }
    return this.prisma.user.findMany({
      where: { tenantId: actor.tenantId!, deletedAt: null },
      select: this.publicSelect(),
      orderBy: { email: 'asc' },
    });
  }

  async invite(actor: AuthUser, dto: InviteUserDto) {
    if (!canInvite(actor.role)) {
      throw new ForbiddenException('Cannot invite users');
    }

    if (dto.role === ROLES.HQ_ADMIN && !isHQ(actor.role)) {
      throw new ForbiddenException('Only HQ can invite hq_admin');
    }

    const tenantId = isHQ(actor.role)
      ? (dto.tenantId ?? actor.tenantId)
      : actor.tenantId;

    if (dto.role !== ROLES.HQ_ADMIN && !tenantId) {
      throw new BadRequestException('tenantId is required for this role');
    }

    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.accessStatus !== AccessStatus.revoked) {
      throw new ConflictException('User already exists');
    }

    const tempPassword = dto.temporaryPassword ?? this.generateTempPassword();
    const passwordHash = await argon2.hash(tempPassword, {
      type: argon2.argon2id,
    });

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            name: dto.name,
            passwordHash,
            role: dto.role as AppRole,
            tenantId: dto.role === ROLES.HQ_ADMIN ? null : tenantId!,
            clientId: dto.clientId ?? null,
            accessStatus: AccessStatus.active,
            deletedAt: null,
          },
          select: this.publicSelect(),
        })
      : await this.prisma.user.create({
          data: {
            email,
            name: dto.name,
            passwordHash,
            role: dto.role as AppRole,
            tenantId: dto.role === ROLES.HQ_ADMIN ? null : tenantId!,
            clientId: dto.clientId ?? null,
            accessStatus: AccessStatus.active,
          },
          select: this.publicSelect(),
        });

    if (tenantId) {
      // user_invites tem FORCE ROW LEVEL SECURITY — precisa das session vars
      // (SET LOCAL app.tenant_id/app.is_hq) que só o wrapper abaixo aplica;
      // sem ele, o insert cai na policy default (sem contexto) e o Postgres
      // rejeita com "new row violates row-level security policy".
      await this.prisma.withTenantContext({ tenantId, isHq: isHQ(actor.role) }, (tx) =>
        tx.userInvite.create({
          data: {
            tenantId,
            email,
            name: dto.name,
            role: dto.role as AppRole,
            clientId: dto.clientId,
            invitedById: actor.id,
            status: AccessStatus.invited,
            temporaryPassword: tempPassword,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            acceptedAt: new Date(),
          },
        }),
      );
    }

    await this.audit.log({
      actorId: actor.id,
      tenantId: tenantId ?? null,
      action: 'user.invite',
      entityType: 'user',
      entityId: user.id,
      metadata: { email, role: dto.role },
    });

    return {
      user,
      temporaryPassword: tempPassword,
    };
  }

  async revoke(actor: AuthUser, dto: RevokeUserDto) {
    if (!canInvite(actor.role)) {
      throw new ForbiddenException('Cannot revoke users');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!target) throw new NotFoundException('User not found');

    if (!isHQ(actor.role) && target.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Tenant scope violation');
    }

    if (target.role === AppRole.hq_admin && !isHQ(actor.role)) {
      throw new ForbiddenException('Cannot revoke HQ admin');
    }

    if (target.id === actor.id) {
      throw new BadRequestException('Cannot revoke yourself');
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { accessStatus: AccessStatus.revoked },
      select: this.publicSelect(),
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      actorId: actor.id,
      tenantId: target.tenantId,
      action: 'user.revoke',
      entityType: 'user',
      entityId: target.id,
      metadata: { reason: dto.reason ?? null },
    });

    return updated;
  }

  /** Reatribui papel/tenant de um usuário já existente (Admin Panel — "Atribuir"). */
  async updateRole(actor: AuthUser, dto: UpdateUserRoleDto) {
    if (!canInvite(actor.role)) {
      throw new ForbiddenException('Cannot manage user roles');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!target) throw new NotFoundException('User not found');

    if (!isHQ(actor.role) && target.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Tenant scope violation');
    }
    if (
      (target.role === AppRole.hq_admin || dto.role === ROLES.HQ_ADMIN) &&
      !isHQ(actor.role)
    ) {
      throw new ForbiddenException('Only HQ can manage hq_admin');
    }
    if (target.id === actor.id && dto.role !== ROLES.HQ_ADMIN && isHQ(actor.role)) {
      throw new BadRequestException('Cannot remove your own HQ Admin role');
    }

    const tenantId = dto.role === ROLES.HQ_ADMIN ? null : (isHQ(actor.role) ? dto.tenantId : actor.tenantId);
    if (dto.role !== ROLES.HQ_ADMIN && !tenantId) {
      throw new BadRequestException('tenantId is required for this role');
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { role: dto.role as AppRole, tenantId },
      select: this.publicSelect(),
    });

    await this.audit.log({
      actorId: actor.id,
      tenantId: tenantId ?? null,
      action: 'user.update_role',
      entityType: 'user',
      entityId: target.id,
      metadata: { role: dto.role, tenantId },
    });

    return updated;
  }

  /** Gera e aplica uma nova senha temporária (sem envio de e-mail — mostrada na tela). */
  async resendInvite(actor: AuthUser, dto: ResendInviteDto) {
    if (!canInvite(actor.role)) {
      throw new ForbiddenException('Cannot resend invites');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!target) throw new NotFoundException('User not found');
    if (!isHQ(actor.role) && target.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Tenant scope violation');
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { passwordHash },
      select: this.publicSelect(),
    });

    if (target.tenantId) {
      await this.prisma.withTenantContext({ tenantId: target.tenantId, isHq: isHQ(actor.role) }, (tx) =>
        tx.userInvite.create({
          data: {
            tenantId: target.tenantId!,
            email: target.email,
            name: target.name,
            role: target.role,
            invitedById: actor.id,
            status: AccessStatus.invited,
            temporaryPassword: tempPassword,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            acceptedAt: new Date(),
          },
        }),
      );
    }

    await this.audit.log({
      actorId: actor.id,
      tenantId: target.tenantId,
      action: 'user.resend_invite',
      entityType: 'user',
      entityId: target.id,
    });

    return { user: updated, temporaryPassword: tempPassword };
  }

  /** Alimenta a tela de administração (usuários ativos + convites pendentes + histórico). */
  async administration(actor: AuthUser, tenantId?: string) {
    if (!isHQ(actor.role) && tenantId && tenantId !== actor.tenantId) {
      throw new ForbiddenException('Tenant scope violation');
    }
    const scopedTenantId = isHQ(actor.role) ? tenantId : actor.tenantId!;

    const usersWhere = scopedTenantId
      ? { tenantId: scopedTenantId, deletedAt: null }
      : isHQ(actor.role)
        ? { deletedAt: null }
        : { tenantId: actor.tenantId!, deletedAt: null };

    // audit_logs tem FORCE ROW LEVEL SECURITY — sem o wrapper abaixo, linhas
    // com tenant_id preenchido somem silenciosamente da consulta (RLS em
    // SELECT filtra, não dá erro, então o bug passa despercebido: só
    // sobravam os auth.login com tenant_id NULL).
    const [users, pending, history] = await this.prisma.withTenantContext(
      { tenantId: scopedTenantId ?? null, isHq: isHQ(actor.role) },
      (tx) =>
        Promise.all([
          tx.user.findMany({ where: usersWhere, select: this.publicSelect(), orderBy: { email: 'asc' } }),
          tx.user.findMany({
            where: { ...usersWhere, accessStatus: AccessStatus.invited },
            select: this.publicSelect(),
            orderBy: { email: 'asc' },
          }),
          tx.auditLog.findMany({
            where: {
              entityType: 'user',
              ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
        ]),
    );

    return {
      users,
      pending,
      history: history.map((h) => ({ id: h.id, action: h.action, timestamp: h.createdAt })),
    };
  }

  private generateTempPassword(): string {
    return randomBytes(9).toString('base64url') + 'Aa1!';
  }

  private publicSelect() {
    return {
      id: true,
      email: true,
      name: true,
      role: true,
      tenantId: true,
      clientId: true,
      accessStatus: true,
      lastLoginAt: true,
      createdAt: true,
    } as const;
  }
}
