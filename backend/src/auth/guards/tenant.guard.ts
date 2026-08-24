import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { canAccessTenant, isHQ } from '../../shared';
import { AuthUser } from '../auth.types';

/**
 * Ensures non-HQ users only operate within their tenant.
 * Accepts tenant from: body.tenantId | query.tenantId | header X-Tenant-Id | route :tenantId
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: AuthUser;
      body?: { tenantId?: string };
      query?: { tenantId?: string };
      params?: { tenantId?: string };
      headers: Record<string, string | undefined>;
    }>();

    const user = req.user;
    if (!user) throw new ForbiddenException('Unauthenticated');
    if (isHQ(user.role)) return true;

    if (!user.tenantId) {
      throw new ForbiddenException('User has no tenant scope');
    }

    const target =
      req.params?.tenantId ||
      req.body?.tenantId ||
      req.query?.tenantId ||
      req.headers['x-tenant-id'];

    if (target && !canAccessTenant(user.role, user.tenantId, target)) {
      throw new ForbiddenException('Tenant scope violation');
    }

    return true;
  }
}
