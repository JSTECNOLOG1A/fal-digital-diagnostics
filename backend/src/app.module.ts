import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { HierarchyModule } from './hierarchy/hierarchy.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { ProtheusModule } from './integrations/protheus/protheus.module';
import { IntegrationsModule } from './integrations/core/integrations.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { TenantRlsInterceptor } from './common/interceptors/tenant-rls.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    TenantsModule,
    HierarchyModule,
    UsersModule,
    AuditModule,
    ProtheusModule,
    IntegrationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantRlsInterceptor },
  ],
})
export class AppModule {}
