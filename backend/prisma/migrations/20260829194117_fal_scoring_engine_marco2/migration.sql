-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "current_response_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "assessment_flow_states" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "flow_version" INTEGER NOT NULL DEFAULT 1,
    "source_response_version" INTEGER NOT NULL DEFAULT 0,
    "diagnostic_status" TEXT NOT NULL DEFAULT 'not_started',
    "priorities_status" TEXT NOT NULL DEFAULT 'not_started',
    "intelligence_status" TEXT NOT NULL DEFAULT 'not_started',
    "action_plan_status" TEXT NOT NULL DEFAULT 'not_started',
    "simulation_status" TEXT NOT NULL DEFAULT 'not_started',
    "report_status" TEXT NOT NULL DEFAULT 'not_started',
    "diagnostic_generated_at" TIMESTAMP(3),
    "priorities_generated_at" TIMESTAMP(3),
    "intelligence_generated_at" TIMESTAMP(3),
    "action_plan_generated_at" TIMESTAMP(3),
    "simulation_generated_at" TIMESTAMP(3),
    "report_generated_at" TIMESTAMP(3),
    "snapshot_id" UUID,
    "priorities_snapshot_id" UUID,
    "intelligence_snapshot_id" UUID,
    "action_plan_id" UUID,
    "simulation_id" UUID,
    "report_id" UUID,
    "stale_from_step" TEXT,
    "last_error_step" TEXT,
    "last_error_message" TEXT,
    "last_run_mode" TEXT,
    "next_best_step" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_flow_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fal_diagnostic_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "cycle_id" TEXT,
    "target_type" TEXT,
    "target_id" UUID,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computed_by" TEXT,
    "question_set" TEXT[],
    "dimension_scores" JSONB NOT NULL,
    "overall_score" DECIMAL(6,2) NOT NULL,
    "overall_level" TEXT NOT NULL,
    "radar_points" JSONB NOT NULL,
    "gaps_top" JSONB NOT NULL,
    "sector_snapshot" TEXT[],
    "active_dimensions" TEXT[],
    "dimension_risk_summary" JSONB NOT NULL,
    "maturity_index" INTEGER NOT NULL,
    "total_evolution" DECIMAL(6,2),
    "critical_clusters_count" INTEGER NOT NULL DEFAULT 0,
    "total_clusters_count" INTEGER NOT NULL DEFAULT 0,
    "action_execution_rate" INTEGER,
    "impact_potential" DECIMAL(6,2),
    "value_lever_summary" JSONB,
    "methodology_log" JSONB NOT NULL,
    "clusters_criticos" JSONB,
    "clusters_alta_prioridade" JSONB,
    "clusters_media_prioridade" JSONB,
    "clusters_baixa_prioridade" JSONB,
    "priority_computed_at" TIMESTAMP(3),
    "priority_computed_by" TEXT,
    "cluster_analysis" JSONB,
    "intelligence_computed_at" TIMESTAMP(3),
    "intelligence_benchmark_group" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fal_diagnostic_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "systemic_crossing_analyses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computed_by" TEXT,
    "crossing_key" TEXT NOT NULL,
    "crossing_label" TEXT NOT NULL,
    "crossing_type" TEXT NOT NULL,
    "dimension_a_key" TEXT NOT NULL,
    "dimension_a_label" TEXT NOT NULL,
    "dimension_b_key" TEXT NOT NULL,
    "dimension_b_label" TEXT NOT NULL,
    "dimension_a_score_raw" DECIMAL(6,2) NOT NULL,
    "dimension_b_score_raw" DECIMAL(6,2) NOT NULL,
    "mqe_score_raw" DECIMAL(6,2),
    "has_mqe_data" BOOLEAN NOT NULL DEFAULT false,
    "cross_score_base_raw" DECIMAL(6,2) NOT NULL,
    "cross_weight" DECIMAL(6,2) NOT NULL,
    "cross_score_final" DECIMAL(6,2) NOT NULL,
    "tension_level" TEXT NOT NULL,
    "tension_rank" INTEGER,
    "is_fragile" BOOLEAN NOT NULL DEFAULT false,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "interpretation_text" TEXT,
    "risk_summary" TEXT,
    "recommended_focus" TEXT,
    "systemic_weight" DECIMAL(6,2),

    CONSTRAINT "systemic_crossing_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "systemic_dimension_impacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dimension_key" TEXT NOT NULL,
    "dimension_label" TEXT NOT NULL,
    "related_crossings_count" INTEGER NOT NULL,
    "fragile_crossings_count" INTEGER NOT NULL,
    "critical_crossings_count" INTEGER NOT NULL,
    "average_cross_score" DECIMAL(6,2) NOT NULL,
    "leverage_score" DECIMAL(6,2) NOT NULL,
    "is_systemic_leverage_point" BOOLEAN NOT NULL DEFAULT false,
    "systemic_summary" TEXT,

    CONSTRAINT "systemic_dimension_impacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fal_aggregate_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "level_type" TEXT NOT NULL,
    "level_id" UUID NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computed_by" TEXT,
    "overall_score" DECIMAL(6,2) NOT NULL,
    "overall_level" TEXT NOT NULL,
    "dimension_scores" JSONB NOT NULL,
    "radar_points" JSONB NOT NULL,
    "source_assessments" JSONB NOT NULL,
    "aggregation_rule" TEXT NOT NULL DEFAULT 'mean',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fal_aggregate_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fal_cluster_causes" (
    "id" UUID NOT NULL,
    "cluster_key" TEXT NOT NULL,
    "dimension_key" TEXT,
    "cause_key" TEXT NOT NULL,
    "cause_description" TEXT NOT NULL,
    "probability_weight" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "trigger_score_below" DECIMAL(4,2) NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fal_cluster_causes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fal_cluster_recommendations" (
    "id" UUID NOT NULL,
    "cluster_key" TEXT NOT NULL,
    "dimension_key" TEXT,
    "recommendation_key" TEXT NOT NULL,
    "recommendation_text" TEXT NOT NULL,
    "impact_level" INTEGER NOT NULL DEFAULT 3,
    "implementation_complexity" INTEGER NOT NULL DEFAULT 3,
    "estimated_time" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fal_cluster_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fal_benchmarks" (
    "id" UUID NOT NULL,
    "dimension_key" TEXT,
    "subdimension_key" TEXT,
    "cluster_key" TEXT NOT NULL,
    "benchmark_group" TEXT NOT NULL,
    "avg_score" DECIMAL(6,2) NOT NULL,
    "median_score" DECIMAL(6,2),
    "p75_score" DECIMAL(6,2),
    "p90_score" DECIMAL(6,2),
    "sample_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fal_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessment_flow_states_assessment_id_key" ON "assessment_flow_states"("assessment_id");

-- CreateIndex
CREATE INDEX "assessment_flow_states_tenant_id_idx" ON "assessment_flow_states"("tenant_id");

-- CreateIndex
CREATE INDEX "fal_diagnostic_snapshots_tenant_id_idx" ON "fal_diagnostic_snapshots"("tenant_id");

-- CreateIndex
CREATE INDEX "fal_diagnostic_snapshots_assessment_id_computed_at_idx" ON "fal_diagnostic_snapshots"("assessment_id", "computed_at");

-- CreateIndex
CREATE INDEX "systemic_crossing_analyses_tenant_id_idx" ON "systemic_crossing_analyses"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "systemic_crossing_analyses_assessment_id_crossing_key_key" ON "systemic_crossing_analyses"("assessment_id", "crossing_key");

-- CreateIndex
CREATE INDEX "systemic_dimension_impacts_tenant_id_idx" ON "systemic_dimension_impacts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "systemic_dimension_impacts_assessment_id_dimension_key_key" ON "systemic_dimension_impacts"("assessment_id", "dimension_key");

-- CreateIndex
CREATE INDEX "fal_aggregate_snapshots_tenant_id_idx" ON "fal_aggregate_snapshots"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "fal_aggregate_snapshots_level_type_level_id_key" ON "fal_aggregate_snapshots"("level_type", "level_id");

-- CreateIndex
CREATE INDEX "fal_cluster_causes_cluster_key_idx" ON "fal_cluster_causes"("cluster_key");

-- CreateIndex
CREATE INDEX "fal_cluster_recommendations_cluster_key_idx" ON "fal_cluster_recommendations"("cluster_key");

-- CreateIndex
CREATE INDEX "fal_benchmarks_cluster_key_benchmark_group_idx" ON "fal_benchmarks"("cluster_key", "benchmark_group");

-- AddForeignKey
ALTER TABLE "assessment_flow_states" ADD CONSTRAINT "assessment_flow_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_flow_states" ADD CONSTRAINT "assessment_flow_states_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fal_diagnostic_snapshots" ADD CONSTRAINT "fal_diagnostic_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fal_diagnostic_snapshots" ADD CONSTRAINT "fal_diagnostic_snapshots_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "systemic_crossing_analyses" ADD CONSTRAINT "systemic_crossing_analyses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "systemic_crossing_analyses" ADD CONSTRAINT "systemic_crossing_analyses_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "systemic_dimension_impacts" ADD CONSTRAINT "systemic_dimension_impacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "systemic_dimension_impacts" ADD CONSTRAINT "systemic_dimension_impacts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fal_aggregate_snapshots" ADD CONSTRAINT "fal_aggregate_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (aplicado manualmente via psql após a migração — ver nota de processo
-- em migrations anteriores: editar este arquivo depois de "migrate dev" já
-- ter rodado não reaplica no banco, isso aqui é só documentação/histórico)
ALTER TABLE "assessment_flow_states" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_assessment_flow_states ON "assessment_flow_states"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());
ALTER TABLE "assessment_flow_states" FORCE ROW LEVEL SECURITY;

ALTER TABLE "fal_diagnostic_snapshots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fal_diagnostic_snapshots ON "fal_diagnostic_snapshots"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());
ALTER TABLE "fal_diagnostic_snapshots" FORCE ROW LEVEL SECURITY;

ALTER TABLE "systemic_crossing_analyses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_systemic_crossing_analyses ON "systemic_crossing_analyses"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());
ALTER TABLE "systemic_crossing_analyses" FORCE ROW LEVEL SECURITY;

ALTER TABLE "systemic_dimension_impacts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_systemic_dimension_impacts ON "systemic_dimension_impacts"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());
ALTER TABLE "systemic_dimension_impacts" FORCE ROW LEVEL SECURITY;

ALTER TABLE "fal_aggregate_snapshots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fal_aggregate_snapshots ON "fal_aggregate_snapshots"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());
ALTER TABLE "fal_aggregate_snapshots" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'fal_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON assessment_flow_states, fal_diagnostic_snapshots, systemic_crossing_analyses, systemic_dimension_impacts, fal_aggregate_snapshots TO fal_app;
  END IF;
END $$;
