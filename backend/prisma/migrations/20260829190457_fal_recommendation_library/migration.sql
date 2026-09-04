-- CreateTable
CREATE TABLE "fal_recommendation_library" (
    "id" UUID NOT NULL,
    "recommendation_key" TEXT NOT NULL,
    "source" TEXT,
    "source_type" TEXT,
    "dimension_key" TEXT NOT NULL,
    "subdimension_key" TEXT,
    "cluster_key" TEXT NOT NULL,
    "question_id" TEXT,
    "trigger_score" INTEGER,
    "gap_level" INTEGER,
    "is_actionable" BOOLEAN NOT NULL DEFAULT true,
    "recommendation_type" TEXT,
    "recommendation_title" TEXT NOT NULL,
    "recommendation_description" TEXT,
    "implementation_steps" TEXT[],
    "evidence_required" TEXT,
    "success_indicators" TEXT,
    "routine_template" TEXT,
    "effort_level" INTEGER,
    "impact_level" INTEGER,
    "priority_weight" INTEGER,
    "typical_owner" TEXT,
    "estimated_timeframe" TEXT,
    "cluster_question_count" INTEGER,
    "tenant_id" TEXT NOT NULL DEFAULT 'global',
    "version" TEXT NOT NULL DEFAULT '1.0',
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fal_recommendation_library_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fal_recommendation_library_recommendation_key_key" ON "fal_recommendation_library"("recommendation_key");

-- CreateIndex
CREATE INDEX "fal_recommendation_library_cluster_key_idx" ON "fal_recommendation_library"("cluster_key");

-- CreateIndex
CREATE INDEX "fal_recommendation_library_cluster_key_trigger_score_idx" ON "fal_recommendation_library"("cluster_key", "trigger_score");
