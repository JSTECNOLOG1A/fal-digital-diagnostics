-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "active_dimensions" TEXT[],
ADD COLUMN     "company_id" UUID,
ADD COLUMN     "cycle_label" TEXT,
ADD COLUMN     "diagnostic_depth" TEXT NOT NULL DEFAULT 'rapid',
ADD COLUMN     "group_id" UUID,
ADD COLUMN     "last_saved_at" TIMESTAMP(3),
ADD COLUMN     "last_subdimension_key" TEXT,
ADD COLUMN     "progress_percentage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "question_set" TEXT[],
ADD COLUMN     "target_type" TEXT,
ADD COLUMN     "unit_id" UUID;

-- CreateTable
CREATE TABLE "fal_questions" (
    "id" UUID NOT NULL,
    "question_id" TEXT NOT NULL,
    "dimension_key" TEXT NOT NULL,
    "subdimension_key" TEXT NOT NULL,
    "cluster_key" TEXT NOT NULL,
    "process_stage" TEXT NOT NULL,
    "sequence_order" INTEGER NOT NULL DEFAULT 0,
    "diagnostic_depth" TEXT[],
    "level_applicability" TEXT[],
    "question_weight" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "question_text" TEXT NOT NULL,
    "guidance" TEXT,
    "evidence_hint" TEXT,
    "is_killer_question" BOOLEAN NOT NULL DEFAULT false,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "dependency" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fal_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fal_responses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "fal_question_id" UUID NOT NULL,
    "dimension_key" TEXT NOT NULL,
    "subdimension_key" TEXT,
    "cluster_key" TEXT,
    "score" INTEGER NOT NULL,
    "justification" TEXT,
    "confidence_level" TEXT NOT NULL DEFAULT 'auto_declarada',
    "flag" TEXT,
    "evidence_notes" TEXT,
    "evidence_file_urls" TEXT[],
    "evaluated_entity_id" UUID,
    "evaluated_entity_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fal_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mqe_questions" (
    "id" UUID NOT NULL,
    "method_version_id" UUID NOT NULL,
    "crossing_key" TEXT NOT NULL,
    "code" TEXT,
    "text" TEXT NOT NULL,
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "guidance" TEXT,
    "sector_tags" TEXT[],
    "sector_type" TEXT,
    "evidence_hint" TEXT,
    "risk_tag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mqe_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mqe_responses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "mqe_question_id" UUID NOT NULL,
    "crossing_key" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "justification" TEXT,
    "divergence_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mqe_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fal_content_suggestions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "content_type" TEXT NOT NULL DEFAULT 'question',
    "dimension_key" TEXT,
    "subdimension_key" TEXT,
    "cluster_key" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "requested_by" TEXT,
    "model_used" TEXT,
    "prompt_context_summary" TEXT,
    "draft_payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_comment" TEXT,
    "published_entity_id" UUID,
    "assessment_id" UUID,
    "fal_question_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fal_content_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fal_questions_question_id_key" ON "fal_questions"("question_id");

-- CreateIndex
CREATE INDEX "fal_questions_cluster_key_idx" ON "fal_questions"("cluster_key");

-- CreateIndex
CREATE INDEX "fal_questions_dimension_key_idx" ON "fal_questions"("dimension_key");

-- CreateIndex
CREATE INDEX "fal_responses_tenant_id_idx" ON "fal_responses"("tenant_id");

-- CreateIndex
CREATE INDEX "fal_responses_assessment_id_idx" ON "fal_responses"("assessment_id");

-- CreateIndex
CREATE INDEX "fal_responses_assessment_id_dimension_key_idx" ON "fal_responses"("assessment_id", "dimension_key");

-- CreateIndex
CREATE INDEX "mqe_questions_crossing_key_idx" ON "mqe_questions"("crossing_key");

-- CreateIndex
CREATE INDEX "mqe_responses_tenant_id_idx" ON "mqe_responses"("tenant_id");

-- CreateIndex
CREATE INDEX "mqe_responses_assessment_id_idx" ON "mqe_responses"("assessment_id");

-- CreateIndex
CREATE INDEX "fal_content_suggestions_cluster_key_idx" ON "fal_content_suggestions"("cluster_key");

-- CreateIndex
CREATE INDEX "fal_content_suggestions_status_idx" ON "fal_content_suggestions"("status");

-- CreateIndex
CREATE INDEX "assessments_group_id_idx" ON "assessments"("group_id");

-- CreateIndex
CREATE INDEX "assessments_company_id_idx" ON "assessments"("company_id");

-- CreateIndex
CREATE INDEX "assessments_unit_id_idx" ON "assessments"("unit_id");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "operational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fal_responses" ADD CONSTRAINT "fal_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fal_responses" ADD CONSTRAINT "fal_responses_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fal_responses" ADD CONSTRAINT "fal_responses_fal_question_id_fkey" FOREIGN KEY ("fal_question_id") REFERENCES "fal_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mqe_questions" ADD CONSTRAINT "mqe_questions_method_version_id_fkey" FOREIGN KEY ("method_version_id") REFERENCES "method_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mqe_responses" ADD CONSTRAINT "mqe_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mqe_responses" ADD CONSTRAINT "mqe_responses_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mqe_responses" ADD CONSTRAINT "mqe_responses_mqe_question_id_fkey" FOREIGN KEY ("mqe_question_id") REFERENCES "mqe_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fal_content_suggestions" ADD CONSTRAINT "fal_content_suggestions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fal_content_suggestions" ADD CONSTRAINT "fal_content_suggestions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fal_content_suggestions" ADD CONSTRAINT "fal_content_suggestions_fal_question_id_fkey" FOREIGN KEY ("fal_question_id") REFERENCES "fal_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS (mesmo padrão de app_is_hq()/app_tenant_id() criado em fal_domain_security)
-- fal_questions e mqe_questions são bibliotecas globais (sem tenant_id) — sem RLS.
ALTER TABLE "fal_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mqe_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fal_content_suggestions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_fal_responses ON "fal_responses"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_mqe_responses ON "mqe_responses"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

-- fal_content_suggestions.tenant_id é opcional (sugestão para a biblioteca
-- global de perguntas quando null) — visível a todos os tenants nesse caso.
CREATE POLICY tenant_isolation_fal_content_suggestions ON "fal_content_suggestions"
  USING (app_is_hq() OR tenant_id IS NULL OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id IS NULL OR tenant_id::text = app_tenant_id());

ALTER TABLE "fal_responses" FORCE ROW LEVEL SECURITY;
ALTER TABLE "mqe_responses" FORCE ROW LEVEL SECURITY;
ALTER TABLE "fal_content_suggestions" FORCE ROW LEVEL SECURITY;

-- Grants ao role de aplicação (least privilege) — mesmo padrão de fal_domain_security
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'fal_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      "fal_questions",
      "fal_responses",
      "mqe_questions",
      "mqe_responses",
      "fal_content_suggestions"
    TO fal_app;
  END IF;
END
$$;
