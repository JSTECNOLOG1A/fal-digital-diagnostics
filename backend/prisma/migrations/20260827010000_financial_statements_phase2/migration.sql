-- Diagnóstico Financeiro — Fase 2 (motor de montagem de BP/DRE/DFC)
--
-- Adiciona as tabelas de saída do motor de cálculo (executeFinancialEngine +
-- buildFinancialStatements portados do Base44), cobrindo apenas
-- analysisType = 'individual'. A máquina de estados de publicação em duas
-- fases (candidate → committing → active) e a tabela extra de "snapshot"
-- imutável do original foram simplificadas: usamos uma transação Postgres
-- real por build (já dá atomicidade) e o próprio financial_processing_runs
-- (criado na Fase 1) guarda o "build atual" — sem tabela de snapshot
-- separada. Ver comentário equivalente em schema.prisma.

CREATE TABLE "financial_statement_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "financial_upload_id" UUID,
    "processing_run_id" UUID NOT NULL,
    "entity_code" TEXT,
    "period" TEXT NOT NULL,
    "column_key" TEXT,
    "column_label" TEXT,
    "period_type" TEXT,
    "statement_code" TEXT NOT NULL,
    "statement_family" TEXT,
    "group_label" TEXT,
    "rubric_label" TEXT,
    "canonical_key" TEXT NOT NULL,
    "line_type" TEXT NOT NULL,
    "display_order" INTEGER,
    "note_reference" TEXT,
    "value" DECIMAL(20,4) NOT NULL,
    "dataset_scope" TEXT NOT NULL DEFAULT 'individual',
    "reporting_entity_id" UUID,
    "publication_status" TEXT NOT NULL DEFAULT 'candidate',
    "published_at" TIMESTAMP(3),
    "superseded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_statement_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_statement_lines_tenant_id_idx" ON "financial_statement_lines"("tenant_id");
CREATE INDEX "financial_statement_lines_diag_run_status_idx" ON "financial_statement_lines"("financial_diagnosis_id", "processing_run_id", "publication_status");
CREATE INDEX "financial_statement_lines_diag_period_key_idx" ON "financial_statement_lines"("financial_diagnosis_id", "period", "canonical_key");

CREATE TABLE "financial_indicator_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "processing_run_id" UUID NOT NULL,
    "entity_code" TEXT,
    "period" TEXT NOT NULL,
    "column_key" TEXT,
    "column_label" TEXT,
    "period_type" TEXT,
    "indicator_code" TEXT NOT NULL,
    "value" DECIMAL(20,6),
    "previous_value" DECIMAL(20,6),
    "variation_value" DECIMAL(20,6),
    "variation_percent" DECIMAL(20,6),
    "signal" TEXT,
    "severity" TEXT,
    "confidence_level" TEXT,
    "validation_code" TEXT,
    "formula" TEXT,
    "numerator" TEXT,
    "denominator" TEXT,
    "canonical_sources" JSONB,
    "dataset_scope" TEXT NOT NULL DEFAULT 'individual',
    "reporting_entity_id" UUID,
    "publication_status" TEXT NOT NULL DEFAULT 'candidate',
    "published_at" TIMESTAMP(3),
    "superseded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_indicator_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_indicator_snapshots_tenant_id_idx" ON "financial_indicator_snapshots"("tenant_id");
CREATE INDEX "financial_indicator_snapshots_diag_status_idx" ON "financial_indicator_snapshots"("financial_diagnosis_id", "publication_status");
CREATE INDEX "financial_indicator_snapshots_diag_code_idx" ON "financial_indicator_snapshots"("financial_diagnosis_id", "indicator_code");

CREATE TABLE "financial_trial_balance_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "financial_upload_id" UUID NOT NULL,
    "processing_run_id" UUID NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT,
    "period" TEXT NOT NULL,
    "value" DECIMAL(20,4) NOT NULL,
    "source_sheet" TEXT,
    "source_row" INTEGER,
    "publication_status" TEXT NOT NULL DEFAULT 'candidate',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_trial_balance_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_trial_balance_lines_tenant_id_idx" ON "financial_trial_balance_lines"("tenant_id");
CREATE INDEX "financial_trial_balance_lines_diag_status_idx" ON "financial_trial_balance_lines"("financial_diagnosis_id", "publication_status");

CREATE TABLE "financial_mapping_resolutions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "financial_upload_id" UUID NOT NULL,
    "processing_run_id" UUID NOT NULL,
    "account_code" TEXT NOT NULL,
    "canonical_key" TEXT,
    "mapping_source" TEXT NOT NULL,
    "blocking_issue" BOOLEAN NOT NULL DEFAULT false,
    "resolved_confidence" TEXT,
    "publication_status" TEXT NOT NULL DEFAULT 'candidate',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_mapping_resolutions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_mapping_resolutions_tenant_id_idx" ON "financial_mapping_resolutions"("tenant_id");
CREATE INDEX "financial_mapping_resolutions_diag_status_idx" ON "financial_mapping_resolutions"("financial_diagnosis_id", "publication_status");

CREATE TABLE "financial_dfc_composition_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "processing_run_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "column_key" TEXT,
    "rubric_key" TEXT NOT NULL,
    "rubric_label" TEXT,
    "canonical_key" TEXT,
    "bucket" TEXT NOT NULL,
    "bucket_source" TEXT,
    "previous_value" DECIMAL(20,4),
    "current_value" DECIMAL(20,4),
    "delta" DECIMAL(20,4),
    "impact_on_dfc" DECIMAL(20,4),
    "dataset_scope" TEXT NOT NULL DEFAULT 'individual',
    "reporting_entity_id" UUID,
    "publication_status" TEXT NOT NULL DEFAULT 'candidate',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_dfc_composition_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_dfc_composition_lines_tenant_id_idx" ON "financial_dfc_composition_lines"("tenant_id");
CREATE INDEX "financial_dfc_composition_lines_diag_status_idx" ON "financial_dfc_composition_lines"("financial_diagnosis_id", "publication_status");

CREATE TABLE "financial_dfc_manual_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "activity" TEXT NOT NULL,
    "value" DECIMAL(20,4) NOT NULL,
    "period" TEXT NOT NULL,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_dfc_manual_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_dfc_manual_adjustments_tenant_id_idx" ON "financial_dfc_manual_adjustments"("tenant_id");
CREATE INDEX "financial_dfc_manual_adjustments_financial_diagnosis_id_idx" ON "financial_dfc_manual_adjustments"("financial_diagnosis_id");

CREATE TABLE "financial_dfc_classification_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "canonical_key" TEXT NOT NULL,
    "manual_bucket" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_dfc_classification_overrides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_dfc_classification_overrides_tenant_id_idx" ON "financial_dfc_classification_overrides"("tenant_id");
CREATE INDEX "financial_dfc_classification_overrides_financial_diagnosis_id_idx" ON "financial_dfc_classification_overrides"("financial_diagnosis_id");

-- Foreign keys
ALTER TABLE "financial_statement_lines" ADD CONSTRAINT "financial_statement_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_statement_lines" ADD CONSTRAINT "financial_statement_lines_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_statement_lines" ADD CONSTRAINT "financial_statement_lines_financial_upload_id_fkey" FOREIGN KEY ("financial_upload_id") REFERENCES "financial_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_statement_lines" ADD CONSTRAINT "financial_statement_lines_processing_run_id_fkey" FOREIGN KEY ("processing_run_id") REFERENCES "financial_processing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_indicator_snapshots" ADD CONSTRAINT "financial_indicator_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_indicator_snapshots" ADD CONSTRAINT "financial_indicator_snapshots_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_indicator_snapshots" ADD CONSTRAINT "financial_indicator_snapshots_processing_run_id_fkey" FOREIGN KEY ("processing_run_id") REFERENCES "financial_processing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_trial_balance_lines" ADD CONSTRAINT "financial_trial_balance_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_trial_balance_lines" ADD CONSTRAINT "financial_trial_balance_lines_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_trial_balance_lines" ADD CONSTRAINT "financial_trial_balance_lines_financial_upload_id_fkey" FOREIGN KEY ("financial_upload_id") REFERENCES "financial_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_trial_balance_lines" ADD CONSTRAINT "financial_trial_balance_lines_processing_run_id_fkey" FOREIGN KEY ("processing_run_id") REFERENCES "financial_processing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_mapping_resolutions" ADD CONSTRAINT "financial_mapping_resolutions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_mapping_resolutions" ADD CONSTRAINT "financial_mapping_resolutions_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_mapping_resolutions" ADD CONSTRAINT "financial_mapping_resolutions_financial_upload_id_fkey" FOREIGN KEY ("financial_upload_id") REFERENCES "financial_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_mapping_resolutions" ADD CONSTRAINT "financial_mapping_resolutions_processing_run_id_fkey" FOREIGN KEY ("processing_run_id") REFERENCES "financial_processing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_dfc_composition_lines" ADD CONSTRAINT "financial_dfc_composition_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_dfc_composition_lines" ADD CONSTRAINT "financial_dfc_composition_lines_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_dfc_composition_lines" ADD CONSTRAINT "financial_dfc_composition_lines_processing_run_id_fkey" FOREIGN KEY ("processing_run_id") REFERENCES "financial_processing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_dfc_manual_adjustments" ADD CONSTRAINT "financial_dfc_manual_adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_dfc_manual_adjustments" ADD CONSTRAINT "financial_dfc_manual_adjustments_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_dfc_classification_overrides" ADD CONSTRAINT "financial_dfc_classification_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_dfc_classification_overrides" ADD CONSTRAINT "financial_dfc_classification_overrides_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (mesmo padrão de app_is_hq()/app_tenant_id() criado em fal_domain_security)
ALTER TABLE "financial_statement_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_indicator_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_trial_balance_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_mapping_resolutions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_dfc_composition_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_dfc_manual_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_dfc_classification_overrides" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_financial_statement_lines ON "financial_statement_lines"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_financial_indicator_snapshots ON "financial_indicator_snapshots"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_financial_trial_balance_lines ON "financial_trial_balance_lines"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_financial_mapping_resolutions ON "financial_mapping_resolutions"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_financial_dfc_composition_lines ON "financial_dfc_composition_lines"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_financial_dfc_manual_adjustments ON "financial_dfc_manual_adjustments"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_financial_dfc_classification_overrides ON "financial_dfc_classification_overrides"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

-- FORCE: table owner / fal_app não bypassam políticas (defense in depth)
ALTER TABLE "financial_statement_lines" FORCE ROW LEVEL SECURITY;
ALTER TABLE "financial_indicator_snapshots" FORCE ROW LEVEL SECURITY;
ALTER TABLE "financial_trial_balance_lines" FORCE ROW LEVEL SECURITY;
ALTER TABLE "financial_mapping_resolutions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "financial_dfc_composition_lines" FORCE ROW LEVEL SECURITY;
ALTER TABLE "financial_dfc_manual_adjustments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "financial_dfc_classification_overrides" FORCE ROW LEVEL SECURITY;

-- Grants ao role de aplicação (least privilege) — mesmo padrão de fal_domain_security
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'fal_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      "financial_statement_lines",
      "financial_indicator_snapshots",
      "financial_trial_balance_lines",
      "financial_mapping_resolutions",
      "financial_dfc_composition_lines",
      "financial_dfc_manual_adjustments",
      "financial_dfc_classification_overrides"
    TO fal_app;
  END IF;
END
$$;
