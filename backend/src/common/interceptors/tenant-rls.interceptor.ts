import { AsyncLocalStorage } from 'async_hooks';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { isHQ } from '../../shared';
import { AuthUser } from '../../auth/auth.types';

export type RlsStore = {
  tenantId: string;
  isHq: boolean;
};

export const rlsStorage = new AsyncLocalStorage<RlsStore>();

/**
 * Propaga tenant do JWT via AsyncLocalStorage.
 * O PrismaService.withTenantContext / runWithRls aplica set_config LOCAL na transação.
 */
@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | undefined>;
    }>();
    const user = req.user;
    if (!user) {
      return next.handle();
    }

    const headerTenant = req.headers['x-tenant-id'];
    const tenantId =
      (isHQ(user.role) && typeof headerTenant === 'string'
        ? headerTenant
        : null) ??
      user.tenantId ??
      '';

    const store: RlsStore = {
      tenantId,
      isHq: isHQ(user.role),
    };

    return new Observable((subscriber) => {
      return rlsStorage.run(store, () => next.handle().subscribe(subscriber));
    });
  }
}
