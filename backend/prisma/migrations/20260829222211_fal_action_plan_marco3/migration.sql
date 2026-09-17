-- CreateTable
CREATE TABLE "fal_question_action_library" (
    "id" UUID NOT NULL,
    "question_id" TEXT NOT NULL,
    "dimension_key" TEXT,
    "subdimension_key" TEXT,
    "cluster_key" TEXT,
    "sector_group" TEXT NOT NULL DEFAULT 'geral',
    "trigger_score_max" DECIMAL(4,2) NOT NULL DEFAULT 2,
    "action_type" TEXT NOT NULL DEFAULT 'implantacao',
    "action_title" TEXT NOT NULL,
    "action_description" TEXT,
    "how_to_execute" TEXT,
    "expected_evidence" TEXT,
    "frequency" TEXT DEFAULT 'once',
    "reason_template" TEXT,
    "impact_level" INTEGER NOT NULL DEFAULT 3,
    "effort_level" INTEGER NOT NULL DEFAULT 3,
    "priority_weight" DECIMAL(4,2),
    "responsible_role" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fal_question_action_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "group_id" UUID,
    "company_id" UUID,
    "unit_id" UUID,
    "cycle_id" TEXT,
    "target_type" TEXT,
    "target_id" UUID,
    "plan_key" TEXT NOT NULL,
    "diagnostic_snapshot_id" UUID,
    "generation_fingerprint" TEXT,
    "current_revision_id" UUID,
    "last_review_number" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "overall_progress_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total_tasks" INTEGER NOT NULL DEFAULT 0,
    "done_tasks" INTEGER NOT NULL DEFAULT 0,
    "blocked_tasks" INTEGER NOT NULL DEFAULT 0,
    "overdue_tasks" INTEGER NOT NULL DEFAULT 0,
    "critical_open_tasks" INTEGER NOT NULL DEFAULT 0,
    "next_due_date" DATE,
    "generation_diff_summary" JSONB,
    "engine_version" TEXT,
    "generation_config" JSONB,
    "generation_summary" JSONB,
    "roadmap" JSONB,
    "generated_at" TIMESTAMP(3),
    "generated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_tasks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "target_type" TEXT,
    "target_id" UUID,
    "dimension_key" TEXT,
    "subdimension_key" TEXT,
    "cluster_key" TEXT,
    "task_key" TEXT NOT NULL,
    "operation_id" TEXT,
    "operation_status" TEXT NOT NULL DEFAULT 'active',
    "operation_invalidated_at" TIMESTAMP(3),
    "operation_invalidation_reason" TEXT,
    "action_library_key" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "horizon" TEXT,
    "priority" TEXT,
    "action_type" TEXT,
    "task_layer" TEXT NOT NULL DEFAULT 'strategic',
    "typical_owner" TEXT,
    "impact_score" INTEGER,
    "effort_score" INTEGER,
    "evidence_severity" INTEGER,
    "evidence_missing" BOOLEAN NOT NULL DEFAULT false,
    "priority_score" DECIMAL(8,2),
    "origin_score" DECIMAL(6,2),
    "origin_type" TEXT,
    "origin_key" TEXT,
    "origin_detail" TEXT,
    "question_action_id" UUID,
    "how_to_execute" TEXT,
    "execution_guidance" TEXT,
    "expected_evidence" TEXT,
    "completion_evidence" TEXT,
    "blocked_reason" TEXT,
    "last_checkin_at" TIMESTAMP(3),
    "last_checkin_comment" TEXT,
    "last_updated_by" TEXT,
    "frequency" TEXT DEFAULT 'once',
    "reason" TEXT,
    "dependency_task_keys" TEXT[],
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "progress_percentage" INTEGER NOT NULL DEFAULT 0,
    "assigned_to" TEXT,
    "owner_name" TEXT,
    "start_date" DATE,
    "due_date" DATE,
    "completed_at" TIMESTAMP(3),
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "is_system_generated" BOOLEAN NOT NULL DEFAULT true,
    "consultant_notes" TEXT,
    "evidence_questions" TEXT[],
    "playbook_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_task_activities" (
    "id" UUID NOT NULL,
    "action_task_id" UUID NOT NULL,
    "action_plan_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "operation_id" TEXT NOT NULL,
    "commit_status" TEXT NOT NULL DEFAULT 'active',
    "type" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "changed_fields" TEXT[],
    "review_id" UUID,
    "comment" TEXT,
    "note" TEXT,
    "actor" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "action_task_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_task_reviews" (
    "id" UUID NOT NULL,
    "action_plan_review_id" UUID NOT NULL,
    "action_plan_id" UUID NOT NULL,
    "action_task_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "operation_id" TEXT NOT NULL,
    "commit_status" TEXT NOT NULL DEFAULT 'active',
    "previous_status" TEXT,
    "new_status" TEXT,
    "previous_progress_percentage" INTEGER,
    "new_progress_percentage" INTEGER,
    "consultant_comment" TEXT,
    "client_comment" TEXT,
    "evidence_urls" TEXT[],
    "change_type" TEXT NOT NULL,
    "changes" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_task_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_recommendations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assessment_id" UUID,
    "action_plan_id" UUID,
    "financial_diagnosis_id" TEXT,
    "financial_finding_id" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'manual',
    "source_ref_id" TEXT,
    "dimension_key" TEXT,
    "subdimension_key" TEXT,
    "cluster_key" TEXT,
    "question_id" TEXT,
    "title" TEXT NOT NULL,
    "recommendation_text" TEXT NOT NULL,
    "rationale" TEXT,
    "practical_steps" TEXT,
    "evidence_required" TEXT,
    "expected_deliverable" TEXT,
    "expected_result" TEXT,
    "suggested_owner_area" TEXT,
    "suggested_deadline_days" INTEGER,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "impact_score" INTEGER,
    "effort_score" INTEGER,
    "complexity_level" TEXT,
    "consultant_origin_context" TEXT,
    "status" TEXT NOT NULL DEFAULT 'needs_classification',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "converted_task_ids" TEXT[],
    "converted_at" TIMESTAMP(3),
    "converted_by" TEXT,
    "suggest_to_library" BOOLEAN NOT NULL DEFAULT false,
    "library_entry_id" UUID,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_recommendation_library" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "method_version_id" UUID,
    "dimension_key" TEXT NOT NULL,
    "subdimension_key" TEXT,
    "cluster_key" TEXT,
    "question_id" TEXT,
    "maturity_trigger" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "recommendation_title" TEXT NOT NULL,
    "recommendation_text" TEXT NOT NULL,
    "rationale" TEXT,
    "practical_steps" TEXT,
    "evidence_required" TEXT,
    "expected_deliverable" TEXT,
    "expected_result" TEXT,
    "suggested_owner_area" TEXT,
    "suggested_deadline_days" INTEGER,
    "impact_score" INTEGER,
    "effort_score" INTEGER,
    "complexity_level" TEXT,
    "action_type" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "suggested_by" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_recommendation_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_plan_reviews" (
    "id" UUID NOT NULL,
    "action_plan_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "review_key" TEXT NOT NULL,
    "commit_status" TEXT NOT NULL DEFAULT 'active',
    "review_number" INTEGER NOT NULL,
    "review_date" DATE NOT NULL,
    "visit_type" TEXT NOT NULL DEFAULT 'intermediate',
    "consultant_id" UUID,
    "consultant_name" TEXT,
    "executive_summary" TEXT,
    "overall_progress_before" DECIMAL(5,2),
    "overall_progress_after" DECIMAL(5,2),
    "fal_dimension_scores_snapshot" JSONB,
    "opening_snapshot" JSONB,
    "closing_snapshot" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "opened_at" TIMESTAMP(3),
    "opened_by" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "cancellation_reason" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_plan_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_plan_generation_operations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "action_plan_id" UUID,
    "operation_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "input_fingerprint" TEXT,
    "generation_summary" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_by" TEXT,
    "completed_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,

    CONSTRAINT "action_plan_generation_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fal_question_action_library_question_id_idx" ON "fal_question_action_library"("question_id");

-- CreateIndex
CREATE INDEX "fal_question_action_library_cluster_key_idx" ON "fal_question_action_library"("cluster_key");

-- CreateIndex
CREATE INDEX "action_plans_tenant_id_status_idx" ON "action_plans"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "action_plans_assessment_id_idx" ON "action_plans"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "action_plans_tenant_id_plan_key_key" ON "action_plans"("tenant_id", "plan_key");

-- CreateIndex
CREATE INDEX "action_tasks_tenant_id_status_idx" ON "action_tasks"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "action_tasks_plan_id_idx" ON "action_tasks"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "action_tasks_plan_id_task_key_key" ON "action_tasks"("plan_id", "task_key");

-- CreateIndex
CREATE INDEX "action_task_activities_tenant_id_idx" ON "action_task_activities"("tenant_id");

-- CreateIndex
CREATE INDEX "action_task_activities_action_task_id_idx" ON "action_task_activities"("action_task_id");

-- CreateIndex
CREATE INDEX "action_task_reviews_tenant_id_idx" ON "action_task_reviews"("tenant_id");

-- CreateIndex
CREATE INDEX "action_task_reviews_action_plan_review_id_idx" ON "action_task_reviews"("action_plan_review_id");

-- CreateIndex
CREATE INDEX "action_recommendations_tenant_id_status_idx" ON "action_recommendations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "action_recommendations_action_plan_id_idx" ON "action_recommendations"("action_plan_id");

-- CreateIndex
CREATE INDEX "action_recommendations_assessment_id_idx" ON "action_recommendations"("assessment_id");

-- CreateIndex
CREATE INDEX "action_recommendation_library_dimension_key_idx" ON "action_recommendation_library"("dimension_key");

-- CreateIndex
CREATE INDEX "action_recommendation_library_cluster_key_idx" ON "action_recommendation_library"("cluster_key");

-- CreateIndex
CREATE INDEX "action_plan_reviews_tenant_id_idx" ON "action_plan_reviews"("tenant_id");

-- CreateIndex
CREATE INDEX "action_plan_reviews_action_plan_id_idx" ON "action_plan_reviews"("action_plan_id");

-- CreateIndex
CREATE INDEX "action_plan_generation_operations_tenant_id_idx" ON "action_plan_generation_operations"("tenant_id");

-- CreateIndex
CREATE INDEX "action_plan_generation_operations_assessment_id_idx" ON "action_plan_generation_operations"("assessment_id");

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_tasks" ADD CONSTRAINT "action_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_tasks" ADD CONSTRAINT "action_tasks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "action_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_task_activities" ADD CONSTRAINT "action_task_activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_task_activities" ADD CONSTRAINT "action_task_activities_action_task_id_fkey" FOREIGN KEY ("action_task_id") REFERENCES "action_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_task_reviews" ADD CONSTRAINT "action_task_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_task_reviews" ADD CONSTRAINT "action_task_reviews_action_plan_review_id_fkey" FOREIGN KEY ("action_plan_review_id") REFERENCES "action_plan_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_task_reviews" ADD CONSTRAINT "action_task_reviews_action_task_id_fkey" FOREIGN KEY ("action_task_id") REFERENCES "action_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_recommendations" ADD CONSTRAINT "action_recommendations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_recommendations" ADD CONSTRAINT "action_recommendations_action_plan_id_fkey" FOREIGN KEY ("action_plan_id") REFERENCES "action_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_recommendation_library" ADD CONSTRAINT "action_recommendation_library_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plan_reviews" ADD CONSTRAINT "action_plan_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plan_reviews" ADD CONSTRAINT "action_plan_reviews_action_plan_id_fkey" FOREIGN KEY ("action_plan_id") REFERENCES "action_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plan_generation_operations" ADD CONSTRAINT "action_plan_generation_operations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plan_generation_operations" ADD CONSTRAINT "action_plan_generation_operations_action_plan_id_fkey" FOREIGN KEY ("action_plan_id") REFERENCES "action_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS (aplicado manualmente via psql após a migração — mesma ressalva de
-- processo das migrations anteriores: isso aqui é documentação/histórico,
-- não é reaplicado automaticamente por "prisma migrate").
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['action_plans','action_tasks','action_task_activities','action_task_reviews','action_recommendations','action_plan_reviews','action_plan_generation_operations']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_%s ON %I USING (app_is_hq() OR tenant_id::text = app_tenant_id()) WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id())',
      t, t
    );
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

ALTER TABLE "action_recommendation_library" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_action_recommendation_library ON "action_recommendation_library"
  USING (app_is_hq() OR tenant_id IS NULL OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id IS NULL OR tenant_id::text = app_tenant_id());
ALTER TABLE "action_recommendation_library" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'fal_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON action_plans, action_tasks, action_task_activities, action_task_reviews, action_recommendations, action_recommendation_library, action_plan_reviews, action_plan_generation_operations, fal_question_action_library TO fal_app;
  END IF;
END $$;
