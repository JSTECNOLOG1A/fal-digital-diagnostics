-- AlterTable
ALTER TABLE "action_plans" ALTER COLUMN "assessment_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "action_tasks" ADD COLUMN     "financial_diagnosis_id" TEXT,
ADD COLUMN     "financial_finding_id" TEXT,
ADD COLUMN     "source_type" TEXT NOT NULL DEFAULT 'fal_diagnostic',
ALTER COLUMN "assessment_id" DROP NOT NULL;

-- Invariante: um ActionPlan sempre precisa de um ancoramento hierárquico
-- (grupo/empresa/unidade) — assessment_id agora é só "a origem 8D, se houver",
-- não mais o ancoramento em si.
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_has_anchor_check"
  CHECK (
    assessment_id IS NOT NULL
    OR company_id IS NOT NULL
    OR group_id IS NOT NULL
    OR unit_id IS NOT NULL
  );
