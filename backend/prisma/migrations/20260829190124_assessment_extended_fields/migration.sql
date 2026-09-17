-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "assessment_mode" TEXT NOT NULL DEFAULT 'single_entity',
ADD COLUMN     "assessment_type" TEXT,
ADD COLUMN     "assigned_to" TEXT,
ADD COLUMN     "competence" TEXT,
ADD COLUMN     "context_note" TEXT,
ADD COLUMN     "cycle_id" TEXT,
ADD COLUMN     "cycle_number" INTEGER,
ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "penalty_profile_key" TEXT,
ADD COLUMN     "recipient_name" TEXT,
ADD COLUMN     "scope_mode" TEXT,
ADD COLUMN     "target_id" UUID;
