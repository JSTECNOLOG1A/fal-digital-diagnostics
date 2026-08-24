import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { AccessStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser, JwtPayload } from './auth.types';
import { LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(
    dto: LoginDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.accessStatus !== AccessStatus.active) {
      throw new ForbiddenException('Account is not active');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      clientId: user.clientId,
    };

    const tokens = await this.issueTokens(authUser, meta);

    await this.audit.log({
      actorId: user.id,
      tenantId: user.tenantId,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      ipAddress: meta?.ip,
    });

    return {
      user: authUser,
      ...tokens,
    };
  }

  async refresh(
    refreshToken: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (
      stored.user.deletedAt ||
      stored.user.accessStatus !== AccessStatus.active
    ) {
      throw new UnauthorizedException('User inactive');
    }

    // Rotate: revoke old
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const authUser: AuthUser = {
      id: stored.user.id,
      email: stored.user.email,
      name: stored.user.name,
      role: stored.user.role,
      tenantId: stored.user.tenantId,
      clientId: stored.user.clientId,
    };

    return this.issueTokens(authUser, meta);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.log({
      actorId: userId,
      action: 'auth.logout',
      entityType: 'user',
      entityId: userId,
    });

    return { ok: true };
  }

  async me(user: AuthUser) {
    const full = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        clientId: true,
        accessStatus: true,
        lastLoginAt: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });
    return full;
  }

  private async issueTokens(
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      clientId: user.clientId,
      typ: 'access',
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
    } as Parameters<JwtService['signAsync']>[1]);

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '7d');
    const expiresAt = this.parseTtlDate(refreshTtl);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });

    return { accessToken, refreshToken, expiresAt };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseTtlDate(ttl: string): Date {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    const now = Date.now();
    if (!match) return new Date(now + 7 * 24 * 60 * 60 * 1000);
    const n = Number(match[1]);
    const unit = match[2];
    const mult =
      unit === 's'
        ? 1000
        : unit === 'm'
          ? 60_000
          : unit === 'h'
            ? 3_600_000
            : 86_400_000;
    return new Date(now + n * mult);
  }
}
