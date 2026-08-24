import { Module } from '@nestjs/common';
import { HierarchyController } from './hierarchy.controller';
import { HierarchyService } from './hierarchy.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [HierarchyController],
  providers: [HierarchyService],
  exports: [HierarchyService],
})
export class HierarchyModule {}
