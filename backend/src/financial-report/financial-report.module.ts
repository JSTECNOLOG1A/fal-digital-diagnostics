import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { FinancialModule } from '../financial/financial.module';
import { FalModule } from '../fal/fal.module';
import { FinancialInsightController } from './financial-insight.controller';
import { FinancialInsightService } from './financial-insight.service';
import { FinancialReportController } from './financial-report.controller';
import { FinancialReportDataService } from './financial-report-data.service';
import { FinancialReportVersionService } from './financial-report-version.service';
import { FinancialReportPdfService } from './financial-report-pdf.service';
import { FinancialReportHtmlService } from './financial-report-html.service';
import { FinancialNarrativeLlmService } from './financial-narrative-llm.service';

@Module({
  imports: [AuditModule, StorageModule, FinancialModule, FalModule],
  controllers: [FinancialInsightController, FinancialReportController],
  providers: [
    FinancialInsightService,
    FinancialReportDataService,
    FinancialReportVersionService,
    FinancialReportPdfService,
    FinancialReportHtmlService,
    FinancialNarrativeLlmService,
  ],
})
export class FinancialReportModule {}
