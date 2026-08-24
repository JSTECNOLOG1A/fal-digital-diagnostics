import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { IntegrationsAdminController } from './integrations-admin.controller';
import { IntegrationsPartnerController } from './integrations-partner.controller';
import { IntegrationsService } from './integrations.service';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [IntegrationsAdminController, IntegrationsPartnerController],
  providers: [IntegrationsService, ApiKeyGuard],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
