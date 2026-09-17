import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { FinancialController } from './financial.controller';
import { FinancialUploadController } from './financial-upload.controller';
import { FinancialJourneyController } from './financial-journey.controller';
import { FinancialOutputController } from './financial-output.controller';
import { FinancialPurgeController } from './financial-purge.controller';
import { FinancialDiagnosisService } from './financial-diagnosis.service';
import { FinancialAccountPlanService } from './financial-account-plan.service';
import { FinancialUploadService } from './financial-upload.service';
import { FinancialJourneyService } from './financial-journey.service';
import { FinancialValidationService } from './financial-validation.service';
import { FinancialEngineService } from './financial-engine.service';
import { FinancialStatementsService } from './financial-statements.service';
import { FinancialOutputService } from './financial-output.service';
import { FinancialPurgeService } from './financial-purge.service';

@Module({
  imports: [AuditModule, StorageModule],
  controllers: [
    FinancialController,
    FinancialUploadController,
    FinancialJourneyController,
    FinancialOutputController,
    FinancialPurgeController,
  ],
  providers: [
    FinancialDiagnosisService,
    FinancialAccountPlanService,
    FinancialUploadService,
    FinancialJourneyService,
    FinancialValidationService,
    FinancialEngineService,
    FinancialStatementsService,
    FinancialOutputService,
    FinancialPurgeService,
  ],
  exports: [FinancialDiagnosisService, FinancialAccountPlanService, FinancialOutputService],
})
export class FinancialModule {}
