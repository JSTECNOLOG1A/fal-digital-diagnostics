-- Diagnóstico Financeiro — Fase 1 (estrutura / fontes / validação)
--
-- Porta para tabelas Postgres reais a parte da jornada financeira que hoje
-- só existe como funções serverless Base44 sem implementação local (o
-- frontend fala com um mock em memória, perdido a cada F5). Cobre apenas
-- analysisType = 'individual'; 'combined'/'consolidated' (conciliação,
-- cédula, combinação/preparação) ficam para uma fase futura.

CREATE TABLE "financial_account_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "financial_account_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_account_plans_tenant_id_idx" ON "financial_account_plans"("tenant_id");
CREATE INDEX "financial_account_plans_group_id_idx" ON "financial_account_plans"("group_id");

CREATE TABLE "financial_account_plan_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "account_plan_id" UUID NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_code_display" TEXT,
    "account_name" TEXT NOT NULL,
    "account_type" TEXT,
    "parent_account_code" TEXT,
    "classification" TEXT,
    "statement_code" TEXT,
    "bp_group" TEXT,
    "ebitda_component" TEXT,
    "canonical_key" TEXT,
    "dfc_classification" TEXT,
    "sign_rule" TEXT NOT NULL DEFAULT 'normal',
    "statement_group" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_account_plan_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_account_plan_lines_tenant_id_idx" ON "financial_account_plan_lines"("tenant_id");
CREATE INDEX "financial_account_plan_lines_account_plan_id_idx" ON "financial_account_plan_lines"("account_plan_id");
CREATE INDEX "financial_account_plan_lines_account_plan_id_account_code_idx" ON "financial_account_plan_lines"("account_plan_id", "account_code");

CREATE TABLE "financial_diagnoses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "group_id" UUID,
    "company_id" UUID,
    "unit_id" UUID,
    "scope_level" TEXT,
    "analysis_type" TEXT NOT NULL DEFAULT 'individual',
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "first_period" TEXT,
    "last_period" TEXT,
    "periodicidade" TEXT,
    "account_plan_id" UUID,
    "notes" TEXT,
    "data_base_abertura" TIMESTAMP(3),
    "data_base_fechamento" TIMESTAMP(3),
    "months_count" INTEGER,
    "presenting_entity_id" UUID,
    "parent_entity_id" UUID,
    "current_upload_id" UUID,
    "current_processing_snapshot_id" UUID,
    "integrity_status" TEXT,
    "integrity_blocking_count" INTEGER,
    "integrity_warning_count" INTEGER,
    "integrity_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "financial_diagnoses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_diagnoses_tenant_id_idx" ON "financial_diagnoses"("tenant_id");
CREATE INDEX "financial_diagnoses_group_id_idx" ON "financial_diagnoses"("group_id");
CREATE INDEX "financial_diagnoses_company_id_idx" ON "financial_diagnoses"("company_id");
CREATE INDEX "financial_diagnoses_unit_id_idx" ON "financial_diagnoses"("unit_id");

CREATE TABLE "financial_uploads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "version_number" INTEGER,
    "upload_status" TEXT NOT NULL DEFAULT 'pending',
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "source_entity_id" UUID,
    "source_entity_type" TEXT,
    "source_entity_name" TEXT,
    "source_period" TEXT,
    "source_key" TEXT,
    "input_checksum" TEXT,
    "replacement_status" TEXT,
    "notes" TEXT,
    "validation_summary" JSONB,
    "current_validation_run_id" UUID,
    "current_validation_checksum" TEXT,
    "validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "financial_uploads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_uploads_tenant_id_idx" ON "financial_uploads"("tenant_id");
CREATE INDEX "financial_uploads_financial_diagnosis_id_idx" ON "financial_uploads"("financial_diagnosis_id");

CREATE TABLE "financial_journey_positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_email" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_journey_positions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_journey_positions_financial_diagnosis_id_user_id_key" ON "financial_journey_positions"("financial_diagnosis_id", "user_id");
CREATE INDEX "financial_journey_positions_tenant_id_idx" ON "financial_journey_positions"("tenant_id");

CREATE TABLE "financial_processing_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "financial_upload_id" UUID,
    "operation_type" TEXT NOT NULL,
    "operation_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "triggered_by" TEXT,
    "source_entity_id" UUID,
    "source_period" TEXT,
    "input_checksum" TEXT,
    "result_summary" JSONB,
    "cleanup_pending" BOOLEAN NOT NULL DEFAULT false,
    "error_details" JSONB,
    CONSTRAINT "financial_processing_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_processing_runs_tenant_id_idx" ON "financial_processing_runs"("tenant_id");
CREATE INDEX "financial_processing_runs_financial_diagnosis_id_idx" ON "financial_processing_runs"("financial_diagnosis_id");
CREATE INDEX "financial_processing_runs_operation_key_idx" ON "financial_processing_runs"("operation_key");

CREATE TABLE "financial_validation_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "financial_upload_id" UUID NOT NULL,
    "processing_run_id" UUID NOT NULL,
    "publication_status" TEXT NOT NULL DEFAULT 'candidate',
    "severity" TEXT NOT NULL,
    "category" TEXT,
    "code" TEXT,
    "title" TEXT,
    "message" TEXT,
    "sheet_name" TEXT,
    "row_ref" TEXT,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "superseded_at" TIMESTAMP(3),
    "invalidated_at" TIMESTAMP(3),
    "invalidation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_validation_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_validation_results_tenant_id_idx" ON "financial_validation_results"("tenant_id");
CREATE INDEX "financial_validation_results_financial_diagnosis_id_idx" ON "financial_validation_results"("financial_diagnosis_id");
CREATE INDEX "financial_validation_results_financial_upload_id_idx" ON "financial_validation_results"("financial_upload_id");
CREATE INDEX "financial_validation_results_processing_run_id_idx" ON "financial_validation_results"("processing_run_id");
CREATE INDEX "financial_validation_results_publication_status_idx" ON "financial_validation_results"("publication_status");

-- Foreign keys
ALTER TABLE "financial_account_plans" ADD CONSTRAINT "financial_account_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_account_plans" ADD CONSTRAINT "financial_account_plans_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_account_plan_lines" ADD CONSTRAINT "financial_account_plan_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_account_plan_lines" ADD CONSTRAINT "financial_account_plan_lines_account_plan_id_fkey" FOREIGN KEY ("account_plan_id") REFERENCES "financial_account_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_diagnoses" ADD CONSTRAINT "financial_diagnoses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_diagnoses" ADD CONSTRAINT "financial_diagnoses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_diagnoses" ADD CONSTRAINT "financial_diagnoses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_diagnoses" ADD CONSTRAINT "financial_diagnoses_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "operational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_diagnoses" ADD CONSTRAINT "financial_diagnoses_account_plan_id_fkey" FOREIGN KEY ("account_plan_id") REFERENCES "financial_account_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "financial_uploads" ADD CONSTRAINT "financial_uploads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_uploads" ADD CONSTRAINT "financial_uploads_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_journey_positions" ADD CONSTRAINT "financial_journey_positions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_journey_positions" ADD CONSTRAINT "financial_journey_positions_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_journey_positions" ADD CONSTRAINT "financial_journey_positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_processing_runs" ADD CONSTRAINT "financial_processing_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_processing_runs" ADD CONSTRAINT "financial_processing_runs_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_processing_runs" ADD CONSTRAINT "financial_processing_runs_financial_upload_id_fkey" FOREIGN KEY ("financial_upload_id") REFERENCES "financial_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "financial_validation_results" ADD CONSTRAINT "financial_validation_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_validation_results" ADD CONSTRAINT "financial_validation_results_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_validation_results" ADD CONSTRAINT "financial_validation_results_financial_upload_id_fkey" FOREIGN KEY ("financial_upload_id") REFERENCES "financial_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_validation_results" ADD CONSTRAINT "financial_validation_results_processing_run_id_fkey" FOREIGN KEY ("processing_run_id") REFERENCES "financial_processing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (mesmo padrão de app_is_hq()/app_tenant_id() criado em fal_domain_security)
ALTER TABLE "financial_account_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_account_plan_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_diagnoses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_journey_positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_processing_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_validation_results" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_financial_account_plans ON "financial_account_plans"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_financial_account_plan_lines ON "financial_account_plan_lines"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_financial_diagnoses ON "financial_diagnoses"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_financial_uploads ON "financial_uploads"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_financial_journey_positions ON "financial_journey_positions"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_financial_processing_runs ON "financial_processing_runs"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_financial_validation_results ON "financial_validation_results"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

-- FORCE: table owner / fal_app não bypassam políticas (defense in depth)
ALTER TABLE "financial_account_plans" FORCE ROW LEVEL SECURITY;
ALTER TABLE "financial_account_plan_lines" FORCE ROW LEVEL SECURITY;
ALTER TABLE "financial_diagnoses" FORCE ROW LEVEL SECURITY;
ALTER TABLE "financial_uploads" FORCE ROW LEVEL SECURITY;
ALTER TABLE "financial_journey_positions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "financial_processing_runs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "financial_validation_results" FORCE ROW LEVEL SECURITY;

-- Grants ao role de aplicação (least privilege) — mesmo padrão de fal_domain_security
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'fal_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      "financial_account_plans",
      "financial_account_plan_lines",
      "financial_diagnoses",
      "financial_uploads",
      "financial_journey_positions",
      "financial_processing_runs",
      "financial_validation_results"
    TO fal_app;
  END IF;
END
$$;
