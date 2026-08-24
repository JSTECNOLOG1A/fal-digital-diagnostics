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
import { InviteUserDto, RevokeUserDto } from './dto/users.dto';

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

    const tempPassword =
      dto.temporaryPassword ?? randomBytes(9).toString('base64url') + 'Aa1!';
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
      await this.prisma.userInvite.create({
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
      });
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
