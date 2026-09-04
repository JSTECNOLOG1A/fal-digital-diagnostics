-- AlterTable
ALTER TABLE "fal_questions" ADD COLUMN     "method_version_id" UUID;

-- CreateIndex
CREATE INDEX "fal_questions_method_version_id_idx" ON "fal_questions"("method_version_id");

-- AddForeignKey
ALTER TABLE "fal_questions" ADD CONSTRAINT "fal_questions_method_version_id_fkey" FOREIGN KEY ("method_version_id") REFERENCES "method_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
