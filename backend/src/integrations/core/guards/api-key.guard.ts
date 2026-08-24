import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';

export type ApiKeyPrincipal = {
  type: 'api_key';
  apiKeyId: string;
  tenantId: string;
  scopes: string[];
  name: string;
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      apiKeyPrincipal?: ApiKeyPrincipal;
    }>();

    const raw =
      req.headers['x-api-key'] ||
      extractBearer(req.headers.authorization);

    if (!raw) {
      throw new UnauthorizedException('Missing X-Api-Key');
    }

    const keyHash = hashApiKey(raw);

    // Lookup por hash é cross-tenant (auth); precisa bypass RLS via isHq.
    const record = await this.prisma.withTenantContext(
      { tenantId: null, isHq: true },
      (tx) =>
        tx.integrationApiKey.findUnique({
          where: { keyHash },
        }),
    );

    if (!record || !record.isActive || record.revokedAt) {
      throw new UnauthorizedException('Invalid API key');
    }
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('API key expired');
    }

    await this.prisma.withTenantContext(
      { tenantId: record.tenantId, isHq: true },
      (tx) =>
        tx.integrationApiKey.update({
          where: { id: record.id },
          data: { lastUsedAt: new Date() },
        }),
    );

    req.apiKeyPrincipal = {
      type: 'api_key',
      apiKeyId: record.id,
      tenantId: record.tenantId,
      scopes: record.scopes,
      name: record.name,
    };
    return true;
  }
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function extractBearer(authorization?: string): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export function assertScope(principal: ApiKeyPrincipal, scope: string) {
  if (principal.scopes.includes('*')) return;
  if (!principal.scopes.includes(scope)) {
    throw new ForbiddenException(`Missing scope: ${scope}`);
  }
}
