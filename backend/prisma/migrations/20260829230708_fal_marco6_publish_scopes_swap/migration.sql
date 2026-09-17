-- AlterTable
ALTER TABLE "fal_diagnostic_snapshots" ADD COLUMN     "answers_coverage" DECIMAL(4,2),
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "published_by" TEXT,
ADD COLUMN     "source_snapshot_id" UUID,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';

-- CreateTable
CREATE TABLE "assessment_scopes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "dimension_key" TEXT NOT NULL,
    "evaluated_entity_type" TEXT NOT NULL,
    "evaluated_entity_id" UUID NOT NULL,
    "evaluated_entity_name" TEXT,
    "weight" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "sampling_mode" TEXT NOT NULL DEFAULT 'full',
    "include_in_consolidated_score" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "question_count" INTEGER NOT NULL DEFAULT 0,
    "answered_count" INTEGER NOT NULL DEFAULT 0,
    "required_count" INTEGER NOT NULL DEFAULT 0,
    "completion_ratio" DECIMAL(4,3) NOT NULL DEFAULT 0,
    "score" DECIMAL(6,2),
    "maturity_level" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fal_question_swaps" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "original_question_id" UUID NOT NULL,
    "replacement_question_id" UUID NOT NULL,
    "dimension_key" TEXT,
    "subdimension_key" TEXT,
    "cluster_key" TEXT,
    "swap_reason" TEXT NOT NULL,
    "swap_reason_label" TEXT,
    "fallback_level" TEXT,
    "swapped_by" TEXT NOT NULL,
    "swapped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fal_question_swaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_scopes_tenant_id_idx" ON "assessment_scopes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_scopes_assessment_id_dimension_key_evaluated_ent_key" ON "assessment_scopes"("assessment_id", "dimension_key", "evaluated_entity_id");

-- CreateIndex
CREATE INDEX "fal_question_swaps_tenant_id_idx" ON "fal_question_swaps"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "fal_question_swaps_assessment_id_original_question_id_key" ON "fal_question_swaps"("assessment_id", "original_question_id");

-- AddForeignKey
ALTER TABLE "assessment_scopes" ADD CONSTRAINT "assessment_scopes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_scopes" ADD CONSTRAINT "assessment_scopes_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fal_question_swaps" ADD CONSTRAINT "fal_question_swaps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fal_question_swaps" ADD CONSTRAINT "fal_question_swaps_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (aplicado manualmente via psql após a migração — documentação/histórico).
ALTER TABLE "assessment_scopes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_assessment_scopes ON "assessment_scopes"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());
ALTER TABLE "assessment_scopes" FORCE ROW LEVEL SECURITY;

ALTER TABLE "fal_question_swaps" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fal_question_swaps ON "fal_question_swaps"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());
ALTER TABLE "fal_question_swaps" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'fal_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON assessment_scopes, fal_question_swaps TO fal_app;
  END IF;
END $$;
