-- CreateTable
CREATE TABLE "financial_findings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "group_id" UUID,
    "company_id" UUID,
    "unit_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "finding_type" TEXT NOT NULL,
    "financial_indicator" TEXT,
    "period" TEXT,
    "comparison_period" TEXT,
    "finding_scope" TEXT NOT NULL DEFAULT 'period_snapshot',
    "financial_upload_id" UUID,
    "finding_key" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_ref_id" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "confidence_level" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "evidence_numeric" JSONB,
    "classification" TEXT,
    "interpretation" TEXT,
    "potential_impact" TEXT,
    "investigation_question" TEXT,
    "report_inclusion_status" TEXT NOT NULL DEFAULT 'candidate',
    "report_inclusion_edited_text" TEXT,
    "last_report_version_id" UUID,
    "action_plan_status" TEXT NOT NULL DEFAULT 'not_sent',
    "action_recommendation_id" UUID,
    "action_task_id" UUID,
    "action_plan_id" UUID,
    "sent_to_action_plan_at" TIMESTAMP(3),
    "sent_to_action_plan_by" TEXT,
    "converted_to_task_at" TIMESTAMP(3),
    "converted_to_task_by" TEXT,
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_recommendations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "financial_finding_id" UUID,
    "title" TEXT NOT NULL,
    "diagnostic_thesis" TEXT,
    "probable_cause" TEXT,
    "suggested_action" TEXT,
    "expected_impact" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'media',
    "editable_text" TEXT,
    "consultant_comment" TEXT,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "related_indicator_codes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_action_proposals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "financial_recommendation_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'media',
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "exported_to_fal" BOOLEAN NOT NULL DEFAULT false,
    "fal_action_plan_id" UUID,
    "fal_action_task_id" UUID,
    "exported_at" TIMESTAMP(3),
    "consultant_adjustment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_action_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_report_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "financial_diagnosis_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "base_date_period" TEXT,
    "comparative_periods" TEXT[],
    "payload_snapshot" JSONB,
    "payload_checksum" TEXT,
    "reviewed_text_overrides" JSONB,
    "pdf_status" TEXT,
    "pdf_file_url" TEXT,
    "pdf_checksum" TEXT,
    "pdf_generated_at" TIMESTAMP(3),
    "pdf_page_count" INTEGER,
    "pdf_file_size" INTEGER,
    "pdf_storage_key" TEXT,
    "pdf_error" TEXT,
    "watermark_draft" BOOLEAN NOT NULL DEFAULT true,
    "generated_at" TIMESTAMP(3),
    "generated_by" TEXT,
    "finalized_at" TIMESTAMP(3),
    "finalized_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_findings_tenant_id_idx" ON "financial_findings"("tenant_id");

-- CreateIndex
CREATE INDEX "financial_findings_financial_diagnosis_id_origin_idx" ON "financial_findings"("financial_diagnosis_id", "origin");

-- CreateIndex
CREATE INDEX "financial_findings_financial_diagnosis_id_finding_key_idx" ON "financial_findings"("financial_diagnosis_id", "finding_key");

-- CreateIndex
CREATE INDEX "financial_recommendations_tenant_id_idx" ON "financial_recommendations"("tenant_id");

-- CreateIndex
CREATE INDEX "financial_recommendations_financial_diagnosis_id_idx" ON "financial_recommendations"("financial_diagnosis_id");

-- CreateIndex
CREATE INDEX "financial_action_proposals_tenant_id_idx" ON "financial_action_proposals"("tenant_id");

-- CreateIndex
CREATE INDEX "financial_action_proposals_financial_diagnosis_id_idx" ON "financial_action_proposals"("financial_diagnosis_id");

-- CreateIndex
CREATE INDEX "financial_action_proposals_financial_recommendation_id_idx" ON "financial_action_proposals"("financial_recommendation_id");

-- CreateIndex
CREATE INDEX "financial_report_versions_tenant_id_idx" ON "financial_report_versions"("tenant_id");

-- CreateIndex
CREATE INDEX "financial_report_versions_financial_diagnosis_id_status_idx" ON "financial_report_versions"("financial_diagnosis_id", "status");

-- AddForeignKey
ALTER TABLE "financial_findings" ADD CONSTRAINT "financial_findings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_findings" ADD CONSTRAINT "financial_findings_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_recommendations" ADD CONSTRAINT "financial_recommendations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_recommendations" ADD CONSTRAINT "financial_recommendations_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_recommendations" ADD CONSTRAINT "financial_recommendations_financial_finding_id_fkey" FOREIGN KEY ("financial_finding_id") REFERENCES "financial_findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_action_proposals" ADD CONSTRAINT "financial_action_proposals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_action_proposals" ADD CONSTRAINT "financial_action_proposals_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_action_proposals" ADD CONSTRAINT "financial_action_proposals_financial_recommendation_id_fkey" FOREIGN KEY ("financial_recommendation_id") REFERENCES "financial_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_report_versions" ADD CONSTRAINT "financial_report_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_report_versions" ADD CONSTRAINT "financial_report_versions_financial_diagnosis_id_fkey" FOREIGN KEY ("financial_diagnosis_id") REFERENCES "financial_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
