/*
  Warnings:

  - The `status` column on the `assessments` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';

-- DropEnum
DROP TYPE "AssessmentStatus";

-- CreateIndex
CREATE INDEX "assessments_tenant_id_status_idx" ON "assessments"("tenant_id", "status");
