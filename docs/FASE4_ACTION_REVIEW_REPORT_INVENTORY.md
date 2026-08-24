# FASE 4 — Inventário produtivo: ação, revisão, relatório e PDF

## Escopo avaliado

| Item | Papel | Guard/RBAC | Lifecycle e identidade | Snapshot/imutabilidade | Paginação/consumer | Defeito identificado |
|---|---|---|---|---|---|---|
| ActionPlan | writer/reader | tenant + write roles | plano por assessment/target | baseline existente | ActionPlanManagementPage | faltavam `plan_key`, fingerprint e estado calculado |
| ActionTask | writer/reader | tenant + write roles | `task_key`, status operacional | histórico parcial | drawers e kanban | validação de transição incompleta |
| ActionTaskActivity | append-only writer | tenant derivado da tarefa | por tarefa/plano | antes/depois ausentes | TaskFullDrawer | falha não bloqueava update |
| ActionTaskReview | append-only writer | tenant/review | por revisão/tarefa | revisão draft | QuickReviewDrawer | usado somente em modo revisão |
| ActionPlanReview | writer/reader | tenant + write roles | número sequencial por plano | opening/closing snapshot | comparação/timeline | current revision não era atualizado |
| ActionRecommendation / ActionRecommendationReview | writer/reader | tenant | recomendação e conversão | origem no plano | RecommendationsTab | não reavaliado nesta alteração |
| AssessmentReportVersion | writer/reader | tenant + write roles/viewer leitura | versão por tipo | payload snapshot | ReportsCenter/Preview | checksum e manifest ausentes |
| Report | reader | tenant | legado | N/A | centros de relatório | fora do caminho versionado |
| FalDiagnosticSnapshot / FalInsightSnapshot | reader | tenant por assessment | baseline | imutáveis por origem | geração de plano/relatório | não alterados |

## Functions inventariadas

`generateActionPlan`, `updateActionTaskWithHistory`, `generateActionRecommendations`, `manageActionRecommendation`, `sendFindingToActionPlan`, `convertFinancialRecommendation`, `createActionPlanReview`, `createActionPlanReviewWithSnapshot`, `completeActionPlanReview`, `cancelActionPlanReview`, `deduplicateActionPlanReviews`, `generateAssessmentReportVersion`, `buildReportPayload`, `generatePdfFromReportVersion`, `getReportVersionSnapshot`, `archiveReportVersion`.

Todas são consumidoras do tenant derivado do recurso. O caminho F4 prioriza `generateActionPlan`, `updateActionTaskWithHistory`, `createActionPlanReviewWithSnapshot`, `completeActionPlanReview` e `generateAssessmentReportVersion`. O motor financeiro e seus snapshots permaneceram fora de alteração.