-- CreateTable
CREATE TABLE "fal_action_library" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "action_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dimension_key" TEXT NOT NULL,
    "subdimension_key" TEXT,
    "cluster_key" TEXT,
    "driver_ids" TEXT[],
    "score_trigger_max" DECIMAL(4,2) NOT NULL DEFAULT 2.5,
    "killer_question_trigger" BOOLEAN NOT NULL DEFAULT false,
    "impact_score" INTEGER,
    "effort_score" INTEGER,
    "action_type" TEXT,
    "default_horizon" TEXT,
    "typical_owner" TEXT,
    "dependency_action_keys" TEXT[],
    "level_applicability" TEXT[],
    "sector_tags" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fal_action_library_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fal_action_library_cluster_key_idx" ON "fal_action_library"("cluster_key");

-- CreateIndex
CREATE INDEX "fal_action_library_dimension_key_idx" ON "fal_action_library"("dimension_key");

-- CreateIndex
CREATE UNIQUE INDEX "fal_action_library_tenant_id_action_key_key" ON "fal_action_library"("tenant_id", "action_key");
