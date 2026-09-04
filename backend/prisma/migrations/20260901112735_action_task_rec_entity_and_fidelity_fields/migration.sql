-- AlterTable
ALTER TABLE "action_recommendations" ADD COLUMN     "action_library_key" TEXT,
ADD COLUMN     "dependency_task_keys" TEXT[],
ADD COLUMN     "evaluated_entity_id" UUID,
ADD COLUMN     "evaluated_entity_name" TEXT,
ADD COLUMN     "evaluated_entity_type" TEXT,
ADD COLUMN     "evidence_missing" BOOLEAN,
ADD COLUMN     "evidence_questions" TEXT[],
ADD COLUMN     "evidence_severity" INTEGER,
ADD COLUMN     "expected_evidence" TEXT,
ADD COLUMN     "frequency" TEXT,
ADD COLUMN     "horizon" TEXT,
ADD COLUMN     "how_to_execute" TEXT,
ADD COLUMN     "origin_detail" TEXT,
ADD COLUMN     "origin_key" TEXT,
ADD COLUMN     "origin_score" DECIMAL(6,2),
ADD COLUMN     "origin_type" TEXT,
ADD COLUMN     "playbook_key" TEXT,
ADD COLUMN     "question_action_id" UUID,
ADD COLUMN     "task_layer" TEXT;

-- AlterTable
ALTER TABLE "action_tasks" ADD COLUMN     "evaluated_entity_id" UUID,
ADD COLUMN     "evaluated_entity_name" TEXT,
ADD COLUMN     "evaluated_entity_type" TEXT;
