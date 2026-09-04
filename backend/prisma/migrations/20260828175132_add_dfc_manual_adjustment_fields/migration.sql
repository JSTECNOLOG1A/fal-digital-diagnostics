-- AlterTable
ALTER TABLE "assessments" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "data_subject_requests" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_account_plan_lines" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_account_plans" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_dfc_classification_overrides" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_dfc_composition_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_dfc_manual_adjustments" ADD COLUMN     "adjustment_type" TEXT,
ADD COLUMN     "column_key" TEXT,
ADD COLUMN     "financial_upload_id" UUID,
ADD COLUMN     "justification" TEXT,
ADD COLUMN     "label" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_diagnoses" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_indicator_snapshots" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_journey_positions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_mapping_resolutions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_processing_runs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_statement_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_trial_balance_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_uploads" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_validation_results" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "groups" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "method_versions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "operational_units" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "protheus_connections" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "protheus_staging_rows" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "protheus_sync_jobs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenants" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_invites" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "financial_dfc_classification_overrides" RENAME CONSTRAINT "financial_dfc_classification_overrides_financial_diagnosis_id_f" TO "financial_dfc_classification_overrides_financial_diagnosis_fkey";

-- RenameIndex
ALTER INDEX "financial_dfc_classification_overrides_financial_diagnosis_id_i" RENAME TO "financial_dfc_classification_overrides_financial_diagnosis__idx";

-- RenameIndex
ALTER INDEX "financial_dfc_composition_lines_diag_status_idx" RENAME TO "financial_dfc_composition_lines_financial_diagnosis_id_publ_idx";

-- RenameIndex
ALTER INDEX "financial_indicator_snapshots_diag_code_idx" RENAME TO "financial_indicator_snapshots_financial_diagnosis_id_indica_idx";

-- RenameIndex
ALTER INDEX "financial_indicator_snapshots_diag_status_idx" RENAME TO "financial_indicator_snapshots_financial_diagnosis_id_public_idx";

-- RenameIndex
ALTER INDEX "financial_mapping_resolutions_diag_status_idx" RENAME TO "financial_mapping_resolutions_financial_diagnosis_id_public_idx";

-- RenameIndex
ALTER INDEX "financial_statement_lines_diag_period_key_idx" RENAME TO "financial_statement_lines_financial_diagnosis_id_period_can_idx";

-- RenameIndex
ALTER INDEX "financial_statement_lines_diag_run_status_idx" RENAME TO "financial_statement_lines_financial_diagnosis_id_processing_idx";

-- RenameIndex
ALTER INDEX "financial_trial_balance_lines_diag_status_idx" RENAME TO "financial_trial_balance_lines_financial_diagnosis_id_public_idx";
