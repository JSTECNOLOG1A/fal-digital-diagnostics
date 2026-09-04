-- CreateTable
CREATE TABLE "assessment_report_versions" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "action_plan_id" UUID,
    "review_id" UUID,
    "report_type" TEXT NOT NULL,
    "report_title" TEXT NOT NULL,
    "report_version_number" INTEGER NOT NULL DEFAULT 1,
    "report_code" TEXT NOT NULL,
    "previous_report_version_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "action_plan_review_id" UUID,
    "assessment_revision_number" INTEGER,
    "preset_id" TEXT,
    "report_parameters" JSONB,
    "payload_snapshot" JSONB,
    "payload_checksum" TEXT,
    "source_manifest" JSONB,
    "diagnostic_snapshot_id" UUID,
    "priority_snapshot_id" UUID,
    "action_plan_snapshot_id" UUID,
    "pdf_status" TEXT,
    "pdf_file_url" TEXT,
    "pdf_upload_identifier" TEXT,
    "pdf_checksum" TEXT,
    "pdf_generated_at" TIMESTAMP(3),
    "pdf_started_at" TIMESTAMP(3),
    "pdf_started_by" TEXT,
    "pdf_operation_id" TEXT,
    "pdf_generator_version" TEXT,
    "pdf_page_count" INTEGER,
    "pdf_file_size" INTEGER,
    "pdf_storage_provider" TEXT,
    "pdf_storage_key" TEXT,
    "pdf_error" TEXT,
    "html_snapshot_url" TEXT,
    "generated_at" TIMESTAMP(3),
    "generated_by" TEXT,
    "notes" TEXT,
    "error_message" TEXT,
    "mark_as_official" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "archived_by" TEXT,
    "archive_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_report_versions_tenant_id_idx" ON "assessment_report_versions"("tenant_id");

-- CreateIndex
CREATE INDEX "assessment_report_versions_assessment_id_report_type_idx" ON "assessment_report_versions"("assessment_id", "report_type");

-- AddForeignKey
ALTER TABLE "assessment_report_versions" ADD CONSTRAINT "assessment_report_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_report_versions" ADD CONSTRAINT "assessment_report_versions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (aplicado manualmente via psql após a migração — documentação/histórico).
ALTER TABLE "assessment_report_versions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_assessment_report_versions ON "assessment_report_versions"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());
ALTER TABLE "assessment_report_versions" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'fal_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON assessment_report_versions TO fal_app;
  END IF;
END $$;
