/**
 * generateActionPlan — FAL Action Plan Engine 2.0
 *
 * Gera plano de ação baseado em:
 * - Clusters críticos e subdimensões fracas do FalDiagnosticSnapshot
 * - FalActionLibrary (catálogo dinâmico substituindo playbooks fixos)
 * - Killer questions que falharam
 * - Insights de drivers e root causes do FalInsightSnapshot
 *
 * Funcionalidades:
 * - Ordenação por impacto × urgência, com dependências respeitadas
 * - Roadmap por fase (curto/médio/longo prazo)
 * - Classificação quick_win vs structural
 * - Limite de tarefas configurável
 * - Rastreabilidade completa (origin_score, origin_type, origin_detail)
 * - Upsert idempotente: reexecutável sem duplicar tarefas
 *
 * Payload: { assessmentId, cycleId?, maxTasks?, scoreThreshold? }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// BEGIN GENERATED ACTION PLAN TASK STATE
export function isActiveActionTask(task) {
  return task?.status !== 'cancelled'
    && (
      !task?.operation_status
      || task.operation_status === 'active'
    );
}
// END GENERATED ACTION PLAN TASK STATE

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const ENGINE_VERSION = '2.0.1';
const DEFAULT_MAX_TASKS = 20;
const DEFAULT_SCORE_THRESHOLD = 2.5; // clusters/subdims acima disso são ignorados

// ── Catálogo padrão embutido (fallback quando FalActionLibrary está vazio) ────
// Mantém compatibilidade com planos existentes e garante que o motor funciona
// mesmo sem dados no banco. Formato espelha FalActionLibrary.
const BUILTIN_ACTION_LIBRARY = [
  // FINANCEIRO
  { action_key: 'fin_dre_implantar', title: 'Implantar DRE mensal simplificado', description: 'Criar planilha de receitas x despesas por atividade. Separar por centro de custo.', dimension_key: 'financeiro', subdimension_key: 'previsibilidade_caixa', cluster_key: null, driver_ids: ['FIN_VISIBILITY'], impact_score: 5, effort_score: 2, action_type: 'foundational', default_horizon: '30d', score_trigger_max: 1.8, typical_owner: 'CFO / Controladoria', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'fin_cashflow_projecao', title: 'Mapear sazonalidade e projeção de caixa 6 meses', description: 'Identificar meses críticos. Projetar entradas e saídas para os próximos 6 meses.', dimension_key: 'financeiro', subdimension_key: 'previsibilidade_caixa', cluster_key: null, driver_ids: ['FIN_VISIBILITY'], impact_score: 4, effort_score: 2, action_type: 'structural', default_horizon: '60d', score_trigger_max: 2.0, typical_owner: 'CFO', dependency_action_keys: ['fin_dre_implantar'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'fin_dre_erp', title: 'Integrar DRE ao sistema ERP', description: 'Automatizar extração mensal sem planilhas manuais.', dimension_key: 'financeiro', subdimension_key: 'previsibilidade_caixa', cluster_key: null, driver_ids: ['FIN_VISIBILITY'], impact_score: 4, effort_score: 3, action_type: 'structural', default_horizon: '60d', score_trigger_max: 2.5, typical_owner: 'TI / Controladoria', dependency_action_keys: ['fin_dre_implantar'], level_applicability: ['company', 'group', 'holding'] },
  { action_key: 'fin_reserva_caixa', title: 'Definir limite mínimo de reserva de caixa', description: 'Calcular capital de giro mínimo e criar alerta quando atingir threshold.', dimension_key: 'financeiro', subdimension_key: 'previsibilidade_caixa', cluster_key: null, driver_ids: ['FIN_VISIBILITY'], impact_score: 4, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'CFO', dependency_action_keys: ['fin_cashflow_projecao'], level_applicability: ['company', 'group', 'unit', 'holding'] },

  // GOVERNANÇA
  { action_key: 'gov_organograma', title: 'Elaborar organograma formal da família/sócios', description: 'Documentar participações e papéis de cada sócio/familiar na operação.', dimension_key: 'governanca', subdimension_key: 'governanca_societaria', cluster_key: null, driver_ids: ['GOV_STRUCTURE'], impact_score: 5, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'Direção', dependency_action_keys: [], level_applicability: ['company', 'group', 'holding'] },
  { action_key: 'gov_acordo_socios', title: 'Iniciar processo de acordo de sócios', description: 'Reunião com advogado para estruturar documento de governança familiar/societária.', dimension_key: 'governanca', subdimension_key: 'governanca_societaria', cluster_key: null, driver_ids: ['GOV_STRUCTURE'], impact_score: 5, effort_score: 3, action_type: 'structural', default_horizon: '90d', score_trigger_max: 1.8, typical_owner: 'Sócios / Jurídico', dependency_action_keys: ['gov_organograma'], level_applicability: ['company', 'group', 'holding'] },
  { action_key: 'gov_raci', title: 'Definir processo decisório formal (RACI)', description: 'Criar matriz RACI para decisões operacionais e estratégicas.', dimension_key: 'governanca', subdimension_key: 'ritos_governanca', cluster_key: null, driver_ids: ['GOV_RITUALS'], impact_score: 4, effort_score: 2, action_type: 'structural', default_horizon: '60d', score_trigger_max: 2.0, typical_owner: 'Direção', dependency_action_keys: [], level_applicability: ['company', 'group', 'holding'] },
  { action_key: 'gov_reuniao_mensal', title: 'Implantar reunião mensal de resultados', description: 'Agenda fixa: DRE, metas, próximos passos. Máximo 2h.', dimension_key: 'governanca', subdimension_key: 'ritos_governanca', cluster_key: null, driver_ids: ['GOV_RITUALS'], impact_score: 5, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.5, typical_owner: 'Direção', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'gov_ata', title: 'Criar ata estruturada de decisões', description: 'Template simples: decisão, responsável, prazo.', dimension_key: 'governanca', subdimension_key: 'ritos_governanca', cluster_key: null, driver_ids: ['GOV_RITUALS'], impact_score: 3, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.5, typical_owner: 'Secretaria / Direção', dependency_action_keys: ['gov_reuniao_mensal'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'gov_planejamento_estrategico', title: 'Realizar workshop de planejamento estratégico', description: 'Facilitado pelo consultor. Outputs: missão, visão, 3 objetivos para 2 anos.', dimension_key: 'governanca', subdimension_key: 'ritos_governanca', cluster_key: null, driver_ids: ['STR_PLANNING'], impact_score: 5, effort_score: 3, action_type: 'structural', default_horizon: '60d', score_trigger_max: 2.0, typical_owner: 'Direção', dependency_action_keys: ['gov_reuniao_mensal'], level_applicability: ['company', 'group', 'holding'] },
  { action_key: 'gov_kpis', title: 'Criar painel de indicadores estratégicos (KPIs)', description: 'Máximo 5 KPIs. Revisar mensalmente na reunião de resultados.', dimension_key: 'governanca', subdimension_key: 'ritos_governanca', cluster_key: null, driver_ids: ['STR_PLANNING'], impact_score: 4, effort_score: 2, action_type: 'structural', default_horizon: '90d', score_trigger_max: 2.5, typical_owner: 'Direção / Controladoria', dependency_action_keys: ['gov_planejamento_estrategico'], level_applicability: ['company', 'group', 'unit', 'holding'] },

  // SISTEMAS
  { action_key: 'tec_diagnostico_maturidade', title: 'Diagnóstico de maturidade tecnológica', description: 'Mapear quais operações são manuais x digitalizadas. Priorizar por volume e risco.', dimension_key: 'sistemas', subdimension_key: 'sistemas_erp', cluster_key: null, driver_ids: ['TEC_ADOPTION'], impact_score: 5, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'TI / Direção', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'tec_selecionar_erp', title: 'Selecionar sistema de gestão (ERP)', description: 'Avaliar 3 opções adequadas ao porte: Omie, TOTVS, Senior ou específico do setor.', dimension_key: 'sistemas', subdimension_key: 'sistemas_erp', cluster_key: null, driver_ids: ['TEC_ADOPTION'], impact_score: 5, effort_score: 3, action_type: 'structural', default_horizon: '60d', score_trigger_max: 1.5, typical_owner: 'TI / Direção', dependency_action_keys: ['tec_diagnostico_maturidade'], level_applicability: ['company', 'group', 'holding'] },
  { action_key: 'tec_modulos_erp', title: 'Avaliar módulos do ERP não utilizados', description: 'Fazer diagnóstico de uso atual vs funcionalidades disponíveis no sistema vigente.', dimension_key: 'sistemas', subdimension_key: 'sistemas_erp', cluster_key: null, driver_ids: ['TEC_ADOPTION'], impact_score: 4, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.5, typical_owner: 'TI', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'tec_qualidade_dados', title: 'Auditar cadastros mestres', description: 'Identificar duplicados, campos vazios e inconsistências críticas.', dimension_key: 'sistemas', subdimension_key: 'qualidade_dados', cluster_key: null, driver_ids: ['TEC_DATA_QUALITY'], impact_score: 4, effort_score: 2, action_type: 'structural', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'TI / Data Owner', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'tec_data_owner', title: 'Definir responsável pela qualidade de dados', description: 'Nomear Data Owner e criar checklist mensal de higiene de dados.', dimension_key: 'sistemas', subdimension_key: 'qualidade_dados', cluster_key: null, driver_ids: ['TEC_DATA_QUALITY'], impact_score: 3, effort_score: 1, action_type: 'quick_win', default_horizon: '30d', score_trigger_max: 2.5, typical_owner: 'TI / Direção', dependency_action_keys: ['tec_qualidade_dados'], level_applicability: ['company', 'group', 'unit', 'holding'] },

  // OPERACIONAL
  { action_key: 'ops_calendario_operacional', title: 'Criar calendário operacional anual', description: 'Mapear safras, picos de demanda, manutenções preventivas e temporadas.', dimension_key: 'operacional', subdimension_key: 'planejamento_operacional', cluster_key: null, driver_ids: ['OPS_PLANNING'], impact_score: 5, effort_score: 2, action_type: 'foundational', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'COO / Gerência Operacional', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'ops_planejamento_compras', title: 'Implementar planejamento de compras antecipado', description: 'Definir lead times e pontos de ressuprimento por item crítico.', dimension_key: 'operacional', subdimension_key: 'planejamento_operacional', cluster_key: null, driver_ids: ['OPS_PLANNING'], impact_score: 4, effort_score: 2, action_type: 'structural', default_horizon: '60d', score_trigger_max: 2.0, typical_owner: 'Compras / COO', dependency_action_keys: ['ops_calendario_operacional'], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'ops_organograma', title: 'Criar organograma e descrição de cargos', description: 'Documentar hierarquia, responsabilidades e expectativas de cada função.', dimension_key: 'operacional', subdimension_key: 'producao_qualidade', cluster_key: null, driver_ids: ['PEO_STRUCTURE'], impact_score: 4, effort_score: 2, action_type: 'foundational', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'RH / Direção', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'ops_avaliacao_desempenho', title: 'Implantar avaliação de desempenho semestral', description: 'Criar formulário simples com metas e feedback estruturado.', dimension_key: 'operacional', subdimension_key: 'producao_qualidade', cluster_key: null, driver_ids: ['PEO_STRUCTURE'], impact_score: 4, effort_score: 3, action_type: 'structural', default_horizon: '90d', score_trigger_max: 2.5, typical_owner: 'RH', dependency_action_keys: ['ops_organograma'], level_applicability: ['company', 'group', 'unit', 'holding'] },

  // CONTROLES INTERNOS
  { action_key: 'ctrl_mapeamento_processos', title: 'Mapear processos críticos', description: 'Documentar fluxos de compras, vendas, financeiro e RH. Identificar controles ausentes.', dimension_key: 'controles_internos', subdimension_key: 'processos_controle', cluster_key: null, driver_ids: ['CTRL_PROCESS'], impact_score: 5, effort_score: 3, action_type: 'foundational', default_horizon: '60d', score_trigger_max: 2.0, typical_owner: 'Controladoria / COO', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
  { action_key: 'ctrl_segregacao_funcoes', title: 'Implementar segregação de funções', description: 'Separar quem autoriza, executa e registra transações críticas.', dimension_key: 'controles_internos', subdimension_key: 'processos_controle', cluster_key: null, driver_ids: ['CTRL_PROCESS'], impact_score: 5, effort_score: 2, action_type: 'structural', default_horizon: '60d', score_trigger_max: 1.8, typical_owner: 'Controladoria / Auditoria', dependency_action_keys: ['ctrl_mapeamento_processos'], level_applicability: ['company', 'group', 'holding'] },

  // JURÍDICO
  { action_key: 'jur_contratos_revisao', title: 'Revisar contratos críticos vigentes', description: 'Mapear contratos de fornecedores, clientes e parceiros. Identificar riscos e vencimentos.', dimension_key: 'juridico', subdimension_key: 'contratos_societario', cluster_key: null, driver_ids: ['LEG_CONTRACTS'], impact_score: 4, effort_score: 2, action_type: 'compliance', default_horizon: '60d', score_trigger_max: 2.0, typical_owner: 'Jurídico', dependency_action_keys: [], level_applicability: ['company', 'group', 'holding'] },
  { action_key: 'jur_compliance_basico', title: 'Implantar checklist de compliance básico', description: 'Criar rotina de verificação de obrigações legais, trabalhistas e regulatórias.', dimension_key: 'juridico', subdimension_key: 'compliance_regulatorio', cluster_key: null, driver_ids: ['LEG_COMPLIANCE'], impact_score: 4, effort_score: 2, action_type: 'compliance', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'Jurídico / Direção', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },

  // CONTÁBIL
  { action_key: 'cont_balancete_mensal', title: 'Implementar balancete mensal tempestivo', description: 'Garantir fechamento contábil até o 10º dia útil do mês seguinte.', dimension_key: 'contabil', subdimension_key: 'escrituracao_contabil', cluster_key: null, driver_ids: ['ACC_TIMELINESS'], impact_score: 4, effort_score: 2, action_type: 'structural', default_horizon: '30d', score_trigger_max: 2.0, typical_owner: 'Contabilidade', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },

  // TRIBUTÁRIO
  { action_key: 'trib_planejamento_tributario', title: 'Realizar planejamento tributário anual', description: 'Avaliar regime tributário ideal e oportunidades de elisão fiscal lícita.', dimension_key: 'tributario', subdimension_key: 'gestao_tributaria', cluster_key: null, driver_ids: ['TAX_PLANNING'], impact_score: 5, effort_score: 3, action_type: 'structural', default_horizon: '90d', score_trigger_max: 2.0, typical_owner: 'Tributário / CFO', dependency_action_keys: [], level_applicability: ['company', 'group', 'holding'] },
  { action_key: 'trib_obrigacoes_acessorias', title: 'Auditar obrigações acessórias', description: 'Mapear todas as declarações e obrigações fiscais. Criar calendário fiscal.', dimension_key: 'tributario', subdimension_key: 'gestao_tributaria', cluster_key: null, driver_ids: ['TAX_COMPLIANCE'], impact_score: 4, effort_score: 2, action_type: 'compliance', default_horizon: '30d', score_trigger_max: 2.5, typical_owner: 'Tributário / Contabilidade', dependency_action_keys: [], level_applicability: ['company', 'group', 'unit', 'holding'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function assertTenantAccess({ user, effectiveRole, entityTenantId }) {
  if (effectiveRole === 'hq_admin') return;
  if (!user?.tenant_id) throw Object.assign(new Error('Forbidden: user has no tenant_id'), { status: 403 });
  if (user.tenant_id !== entityTenantId) throw Object.assign(new Error('Forbidden: tenant mismatch'), { status: 403 });
}

// SEG-03: Write guard — blocks client_viewer from mutations
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function assertCanWrite(appRole) {
  if (!WRITE_ROLES.has(appRole)) {
    throw Object.assign(new Error('Forbidden: write permission required'), { status: 403 });
  }
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

function round2(n) { return Math.round(n * 100) / 100; }
async function sha256(value) {
  const canonicalize = (input) => Array.isArray(input) ? input.map(canonicalize) : input && typeof input === 'object' ? Object.fromEntries(Object.keys(input).sort().map((key) => [key, canonicalize(input[key])])) : input;
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join('');
}
async function fetchAll(entity, query, sort = 'id') {
  const rows = [];
  let cursor = null;
  while (true) {
    const page = await entity.filter(cursor ? { ...query, id: { $gt: cursor } } : query, sort, 500);
    rows.push(...page);
    if (page.length < 500) return rows;
    cursor = page[page.length - 1].id;
  }
}

function snapshotWithoutSystemFields(snapshot) {
  const { id, created_date, updated_date, ...payload } = snapshot || {};
  return payload;
}
function buildRecommendationRollbackPayload(snapshot) {
  return { ...snapshotWithoutSystemFields(snapshot), status: snapshot?.status || 'approved', action_plan_id: snapshot?.action_plan_id ?? null, converted_task_ids: snapshot?.converted_task_ids ?? [], converted_at: snapshot?.converted_at ?? null, converted_by: snapshot?.converted_by ?? null };
}
function buildFlowRollbackPayload(snapshot) {
  return { ...snapshotWithoutSystemFields(snapshot), action_plan_status: snapshot?.action_plan_status || 'pending', action_plan_id: snapshot?.action_plan_id ?? null, action_plan_generated_at: snapshot?.action_plan_generated_at ?? null, stale_from_step: snapshot?.stale_from_step ?? null, updated_by: snapshot?.updated_by ?? null, action_plan_operation_id: snapshot?.action_plan_operation_id ?? null, action_plan_operation_status: snapshot?.action_plan_operation_status ?? null, action_plan_operation_invalidated_at: snapshot?.action_plan_operation_invalidated_at ?? null, action_plan_operation_invalidation_reason: snapshot?.action_plan_operation_invalidation_reason ?? null };
}
function buildPlanRollbackPayload(snapshot) {
  return { ...snapshotWithoutSystemFields(snapshot), generation_fingerprint: snapshot?.generation_fingerprint ?? null, generation_diff_summary: snapshot?.generation_diff_summary ?? null, generated_at: snapshot?.generated_at ?? null, generated_by: snapshot?.generated_by ?? null, source_diagnostic_snapshot_id: snapshot?.source_diagnostic_snapshot_id ?? null, source_insight_snapshot_id: snapshot?.source_insight_snapshot_id ?? null, source_financial_snapshot_ids: snapshot?.source_financial_snapshot_ids ?? [], generation_summary: snapshot?.generation_summary ?? null, generation_config: snapshot?.generation_config ?? null, roadmap: snapshot?.roadmap ?? null, engine_version: snapshot?.engine_version ?? null, total_tasks: snapshot?.total_tasks ?? 0, done_tasks: snapshot?.done_tasks ?? 0, blocked_tasks: snapshot?.blocked_tasks ?? 0, overdue_tasks: snapshot?.overdue_tasks ?? 0, critical_open_tasks: snapshot?.critical_open_tasks ?? 0, overall_progress_percentage: snapshot?.overall_progress_percentage ?? 0, next_due_date: snapshot?.next_due_date ?? null };
}
async function rollbackGeneration({ base44, operation, previousState, createdPlanId, createdFlowStateId, error }) {
  const rollbackErrors = []; const message = error?.message || 'ACTION_PLAN_GENERATION_FAILED';
  const attempt = async (label, work) => { try { await work(); } catch (rollbackError) { rollbackErrors.push({ label, message: rollbackError?.message || String(rollbackError) }); } };
  await base44.asServiceRole.entities.ActionPlanGenerationOperation.update(operation.id, { rollback_status: 'running' });
  const operationTasks = await fetchAll(base44.asServiceRole.entities.ActionTask, { tenant_id: operation.tenant_id, assessment_id: operation.assessment_id, operation_id: operation.operation_id }, 'id');
  const operationFlows = await fetchAll(base44.asServiceRole.entities.AssessmentFlowState, { tenant_id: operation.tenant_id, assessment_id: operation.assessment_id, action_plan_operation_id: operation.operation_id }, 'id');
  const previousTaskIds = new Set((previousState.tasks || []).map((task) => task.id));
  const newOperationTasks = operationTasks.filter((task) => !previousTaskIds.has(task.id));
  await attempt('plan', async () => previousState.plan ? await base44.asServiceRole.entities.ActionPlan.update(previousState.plan.id, buildPlanRollbackPayload(previousState.plan)) : createdPlanId && await base44.asServiceRole.entities.ActionPlan.update(createdPlanId, { ...buildPlanRollbackPayload(null), status: 'archived' }));
  for (const task of previousState.tasks || []) await attempt(`task:${task.id}`, () => base44.asServiceRole.entities.ActionTask.update(task.id, snapshotWithoutSystemFields(task)));
  for (const task of newOperationTasks) await attempt(`invalidate:${task.id}`, () => base44.asServiceRole.entities.ActionTask.update(task.id, { operation_status: 'invalid', status: 'cancelled', operation_invalidated_at: new Date().toISOString(), operation_invalidation_reason: message }));
  for (const recommendation of previousState.recommendations || []) await attempt(`recommendation:${recommendation.id}`, () => base44.asServiceRole.entities.ActionRecommendation.update(recommendation.id, buildRecommendationRollbackPayload(recommendation)));
  if (previousState.flowState) await attempt('flow', () => base44.asServiceRole.entities.AssessmentFlowState.update(previousState.flowState.id, buildFlowRollbackPayload(previousState.flowState)));
  if (!previousState.flowState) for (const flow of operationFlows) await attempt(`flow_invalidate:${flow.id}`, () => base44.asServiceRole.entities.AssessmentFlowState.update(flow.id, { action_plan_status: 'pending', action_plan_id: null, action_plan_generated_at: null, stale_from_step: null, action_plan_operation_status: 'invalid', action_plan_operation_invalidated_at: new Date().toISOString(), action_plan_operation_invalidation_reason: message }));
  const operationPayload = { status: 'invalid', invalidated_at: new Date().toISOString(), error_code: error?.code || 'ACTION_PLAN_GENERATION_FAILED', error_message: message, rollback_status: rollbackErrors.length ? 'failed' : 'completed', rollback_completed_at: new Date().toISOString(), rollback_errors: rollbackErrors };
  await base44.asServiceRole.entities.ActionPlanGenerationOperation.update(operation.id, operationPayload);
  if (rollbackErrors.length) throw Object.assign(new Error('ACTION_PLAN_GENERATION_ROLLBACK_FAILED'), { rollbackErrors });
}

async function resolveCommittedGeneration({ base44, tenantId, assessmentId, plan, generationFingerprint }) {
  if (!plan || plan.generation_fingerprint !== generationFingerprint) return { reusable: false, reason: 'FINGERPRINT_CHANGED' };
  const operations = await fetchAll(base44.asServiceRole.entities.ActionPlanGenerationOperation, { tenant_id: tenantId, assessment_id: assessmentId, action_plan_id: plan.id, input_fingerprint: generationFingerprint }, 'id');
  const open = operations.filter((item) => item.status === 'candidate' || item.status === 'committing');
  if (open.length) return { reusable: false, conflict: true, reason: 'ACTION_PLAN_GENERATION_INCOMPLETE', open_operation_ids: open.map((item) => item.operation_id) };
  const active = operations.filter((item) => item.status === 'active');
  if (active.length !== 1) return { reusable: false, conflict: true, reason: 'ACTION_PLAN_GENERATION_COMMIT_AMBIGUOUS' };
  return { reusable: true, operation: active[0] };
}

function validateGeneratedTaskSet({ expectedDefinitions, confirmedTasks, operationId }) {
  const expectedKeys = new Set(expectedDefinitions.map((item) => item.task_key));
  const byKey = new Map();
  for (const task of confirmedTasks.filter((item) => expectedKeys.has(item.task_key))) byKey.set(task.task_key, [...(byKey.get(task.task_key) || []), task]);
  const missing = [], duplicates = [], invalid = [], candidates = [];
  for (const key of expectedKeys) {
    const rows = byKey.get(key) || [];
    if (!rows.length) { missing.push(key); continue; }
    if (rows.length > 1) duplicates.push(key);
    for (const row of rows) {
      if (row.operation_status === 'invalid') invalid.push(row.id);
      if (row.operation_id === operationId && row.operation_status !== 'active') candidates.push(row.id);
    }
  }
  return { ok: !missing.length && !duplicates.length && !invalid.length && !candidates.length, missing, duplicates, invalid, candidates };
}
function canonicalRecommendation(item) {
  return {
    id: item.id, source_type: item.source_type || null, source_ref_id: item.source_ref_id || null,
    dimension_key: item.dimension_key || null, subdimension_key: item.subdimension_key || null,
    cluster_key: item.cluster_key || null, question_id: item.question_id || null, title: item.title || null,
    recommendation_text: item.recommendation_text || null, rationale: item.rationale || null,
    practical_steps: item.practical_steps || null, evidence_required: item.evidence_required || null,
    expected_deliverable: item.expected_deliverable || null, expected_result: item.expected_result || null,
    suggested_owner_area: item.suggested_owner_area || null, suggested_deadline_days: item.suggested_deadline_days || null,
    priority: item.priority || null, impact_score: item.impact_score || null, effort_score: item.effort_score || null,
    approved_at: item.approved_at || null,
  };
}
async function resolveFinancialLineage(base44, assessment, tenantId) {
  const links = await fetchAll(base44.asServiceRole.entities.DiagnosticLink, { tenant_id: tenantId, fal_assessment_id: assessment.id, status: 'active' });
  if (!links.length) return { financial_snapshots: [], financial_status: 'not_applicable', reason: 'No active financial diagnosis link for this assessment' };
  const rows = [];
  for (const link of links) {
    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(link.financial_diagnosis_id);
    if (!diagnosis || diagnosis.tenant_id !== tenantId) throw Object.assign(new Error('FINANCIAL_LINEAGE_TENANT_MISMATCH'), { status: 409 });
    let snapshot = diagnosis.current_processing_snapshot_id ? await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(diagnosis.current_processing_snapshot_id) : null;
    if (!snapshot) {
      const heads = await fetchAll(base44.asServiceRole.entities.FinancialSourceOutputHead, { tenant_id: tenantId, financial_diagnosis_id: diagnosis.id, status: 'active' });
      for (const head of heads) {
        const headSnapshot = head.current_processing_snapshot_id ? await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(head.current_processing_snapshot_id) : null;
        if (!headSnapshot || headSnapshot.tenant_id !== tenantId || headSnapshot.status !== 'active' || headSnapshot.financial_processing_run_id !== head.current_processing_run_id || headSnapshot.output_checksum !== head.current_output_checksum) {
          throw Object.assign(new Error('FINANCIAL_LINEAGE_HEAD_SNAPSHOT_MISMATCH'), { status: 409 });
        }
        rows.push({ snapshot_id: headSnapshot.id, processing_run_id: head.current_processing_run_id, output_checksum: head.current_output_checksum, source_key: head.source_key, period: head.source_period, analysis_type: diagnosis.analysis_type });
      }
    } else {
      if (snapshot.tenant_id !== tenantId || snapshot.status !== 'active') throw Object.assign(new Error('FINANCIAL_LINEAGE_INVALID_SNAPSHOT'), { status: 409 });
      rows.push({ snapshot_id: snapshot.id, processing_run_id: snapshot.financial_processing_run_id, output_checksum: snapshot.output_checksum, source_key: diagnosis.id, period: snapshot.period || null, analysis_type: diagnosis.analysis_type });
    }
  }
  const financial_snapshots = [...new Map(rows.filter((row) => row.snapshot_id).map((row) => [row.snapshot_id, row])).values()].sort((a, b) => `${a.source_key}|${a.period}|${a.snapshot_id}`.localeCompare(`${b.source_key}|${b.period}|${b.snapshot_id}`));
  if (!financial_snapshots.length) throw Object.assign(new Error('FINANCIAL_LINEAGE_REQUIRED_BUT_MISSING'), { status: 409 });
  return { financial_snapshots, financial_status: 'linked_active', reason: null };
}

function getHorizonDate(horizon) {
  const days = { '30d': 30, '60d': 60, '90d': 90, '180d': 180 };
  const d = new Date();
  d.setDate(d.getDate() + (days[horizon] || 90));
  return d.toISOString().split('T')[0];
}

function horizonToPhase(horizon) {
  if (horizon === '30d') return 'curto_prazo';
  if (horizon === '60d' || horizon === '90d') return 'medio_prazo';
  return 'longo_prazo';
}

/**
 * Calcula priority_score: prioriza impacto alto, esforço baixo, severidade de evidência
 */
function calcPriorityScore(impact, effort, evidenceSeverity = 1) {
  return (safeNum(impact, 3) * Math.max(1, safeNum(evidenceSeverity, 1))) * (6 - safeNum(effort, 3));
}

function scoreToPriority(pScore) {
  if (pScore >= 30) return 'critical';
  if (pScore >= 15) return 'high';
  if (pScore >= 6)  return 'medium';
  return 'low';
}

function buildTaskKey(actionKey, targetId, cycleId) {
  return `${actionKey}::${targetId || 'notarget'}::${cycleId || 'default'}`;
}

function pickRootCause(rootCauses, driverIds) {
  if (!rootCauses?.length || !driverIds?.length) return null;
  for (const dId of driverIds) {
    const match = rootCauses.find(c => (c.driver_ids || []).includes(dId));
    if (match) return match.cause_id;
  }
  return rootCauses[0]?.cause_id || null;
}

/**
 * Topological sort das tasks respeitando dependências.
 * Retorna a lista ordenada: dependências primeiro, depois as que as usam.
 */
function topoSort(tasks) {
  const byKey = new Map(tasks.map(t => [t.task_key, t]));
  const visited = new Set();
  const result = [];

  function visit(t) {
    if (visited.has(t.task_key)) return;
    visited.add(t.task_key);
    for (const depKey of (t.dependency_task_keys || [])) {
      if (byKey.has(depKey)) visit(byKey.get(depKey));
    }
    result.push(t);
  }

  for (const t of tasks) visit(t);
  return result;
}

// ── Normaliza campos que podem vir como strings do CSV ───────────────────────
function normalizeAction(a) {
  // active: aceita true, 'true', 'True', 1
  const activeRaw = a.active;
  const isActive = activeRaw === undefined || activeRaw === null ||
    activeRaw === true || activeRaw === 1 ||
    String(activeRaw).toLowerCase() === 'true';

  // level_applicability: string 'company|unit' → array
  let levels = a.level_applicability;
  if (typeof levels === 'string') {
    levels = levels.split('|').map(s => s.trim()).filter(Boolean);
  } else if (!Array.isArray(levels)) {
    levels = ['group', 'company', 'unit', 'holding'];
  }

  // sector_tags: string 'agronegocio,fazenda' → array
  let sectors = a.sector_tags;
  if (typeof sectors === 'string' && sectors.trim()) {
    sectors = sectors.split(/[,|]/).map(s => s.trim()).filter(Boolean);
  } else if (!Array.isArray(sectors)) {
    sectors = [];
  }

  // dependency_action_keys: string 'key1|key2' → array
  let deps = a.dependency_action_keys;
  if (typeof deps === 'string' && deps.trim()) {
    deps = deps.split(/[,|]/).map(s => s.trim()).filter(Boolean);
  } else if (!Array.isArray(deps)) {
    deps = [];
  }

  // driver_ids: string → array
  let drivers = a.driver_ids;
  if (typeof drivers === 'string' && drivers.trim()) {
    drivers = drivers.split(/[,|]/).map(s => s.trim()).filter(Boolean);
  } else if (!Array.isArray(drivers)) {
    drivers = [];
  }

  // killer_question_trigger: string 'True'/'False' → boolean
  const killerTrigger = String(a.killer_question_trigger || 'false').toLowerCase() === 'true';

  return { ...a, active: isActive, level_applicability: levels, sector_tags: sectors, dependency_action_keys: deps, driver_ids: drivers, killer_question_trigger: killerTrigger };
}

// ── Carregamento do catálogo de ações ─────────────────────────────────────────
async function loadActionLibrary(base44, tenantId) {
  // Busca sem filtrar active no banco — normaliza depois (active pode ser string "True")
  const [globalActions, tenantActions] = await Promise.all([
        fetchAll(base44.asServiceRole.entities.FalActionLibrary, { tenant_id: 'global' }, 'id').catch(() => []),
        tenantId !== 'global' ? fetchAll(base44.asServiceRole.entities.FalActionLibrary, { tenant_id: tenantId }, 'id').catch(() => []) : Promise.resolve([]),
      ]);

  // Merge: tenant sobrescreve global por action_key; builtin é fallback base
  const merged = new Map();
  for (const a of BUILTIN_ACTION_LIBRARY) merged.set(a.action_key, normalizeAction(a));
  for (const a of globalActions)          merged.set(a.action_key, normalizeAction(a));
  for (const a of tenantActions)          merged.set(a.action_key, normalizeAction(a));

  // Retorna apenas ações ativas
  return [...merged.values()].filter(a => a.active);
}

// ── Motor principal ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  let transactionContext = null;
  try {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // SEG-03: Write guard
  try { assertCanWrite(appRole); } catch (wErr) {
    return Response.json({ error: wErr.message }, { status: wErr.status || 403 });
  }

  const body = await req.json();
  const { assessmentId, cycleId, maxTasks, scoreThreshold } = body;
  if (!assessmentId) return Response.json({ error: 'assessmentId required' }, { status: 400 });

  const MAX_TASKS      = safeNum(maxTasks, DEFAULT_MAX_TASKS);
  const SCORE_THRESHOLD = safeNum(scoreThreshold, DEFAULT_SCORE_THRESHOLD);

  // ── 1. Carregar assessment ──────────────────────────────────────────────────
  const assessment = await base44.asServiceRole.entities.Assessment.get(assessmentId);
  if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });
  const tenantId = assessment.tenant_id;

  try { assertTenantAccess({ user, effectiveRole: appRole, entityTenantId: tenantId }); } catch (e) {
    return Response.json({ error: e.message }, { status: 403 });
  }

  const targetId       = assessment.target_id || null;
  const targetType     = assessment.target_type || 'company';
  const effectiveCycleId = cycleId || null;
  const sectorSnapshot = assessment.sector_snapshot || [];

  // ── 2. Carregar FalDiagnosticSnapshot ──────────────────────────────────────
  let falSnap = null;
  if (effectiveCycleId) {
    const withCycle = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
      { tenant_id: tenantId, assessment_id: assessmentId, cycle_id: effectiveCycleId }, '-computed_at', 1
    );
    falSnap = withCycle[0] || null;
  }
  if (!falSnap) {
    const latest = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
      { tenant_id: tenantId, assessment_id: assessmentId }, '-computed_at', 1
    );
    falSnap = latest[0] || null;
  }
  if (!falSnap) return Response.json({ error: 'No FalDiagnosticSnapshot found' }, { status: 404 });

  // ── 3. Carregar FalInsightSnapshot (opcional — enriquece prioridade) ────────
  let insightSnap = null;
  try {
    const insightFilter = { tenant_id: tenantId, assessment_id: assessmentId };
    if (effectiveCycleId) insightFilter.cycle_id = effectiveCycleId;
    const insightResults = await base44.asServiceRole.entities.FalInsightSnapshot.filter(
      insightFilter, '-computed_at', 1
    );
    insightSnap = insightResults[0] || null;

    if (!insightSnap) {
      const res = await base44.asServiceRole.functions.invoke('computeInsights', { assessmentId, cycleId: effectiveCycleId });
      insightSnap = res?.data?.insight || null;
    }
  } catch (e) {
    console.warn('[generateActionPlan] insightSnap not available:', e.message);
  }

  // ── 4. Carregar respostas e identificar perguntas críticas com score baixo ──
  const killerFailedClusters = new Set();
  let allQuestions = [];
  let respMap = new Map();

  try {
    const questionSet  = falSnap.question_set || assessment.question_set || [];
    const responses    = await fetchAll(base44.asServiceRole.entities.FalResponse, { assessment_id: assessmentId });
    respMap            = new Map(responses.map(r => [r.fal_question_id, r]));
    // Carregar apenas questões das dimensões ativas (evita timeout com banco inteiro)
    const activeDimsList = Object.keys(falSnap.dimension_scores || {}).filter(k => falSnap.dimension_scores[k]?.active);
    const qBatches = await Promise.all(
      (activeDimsList.length > 0 ? activeDimsList : ['governanca']).map(dim =>
        fetchAll(base44.asServiceRole.entities.FalQuestion, { dimension_key: dim }, 'id').catch(() => [])
      )
    );
    allQuestions = qBatches.flat();

    for (const q of allQuestions) {
      if (!questionSet.includes(q.id)) continue;
      if (q.is_killer_question !== true) continue;
      const resp = respMap.get(q.id);
      if (resp && safeNum(resp.score) <= 2) {
        killerFailedClusters.add(q.cluster_key);
      }
    }
  } catch (e) {
    console.warn('[generateActionPlan] killer question check failed:', e.message);
  }

  // ── 5. Carregar catálogo de ações ───────────────────────────────────────────
  const actionLibrary = await loadActionLibrary(base44, tenantId);

  // ── 5b. Carregar FalRecommendationLibrary (global + tenant) ─────────────────
  // Filtra recomendações cujos cluster_key têm score abaixo do SCORE_THRESHOLD
  // Ordena por priority_weight desc para enriquecer o plano com recomendações priorizadas
  let recommendationsByCluster = new Map(); // cluster_key → recomendação com maior priority_weight
  try {
    const [globalRecs, tenantRecs] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.FalRecommendationLibrary, { tenant_id: 'global' }, 'id').catch(() => []),
      tenantId !== 'global'
        ? fetchAll(base44.asServiceRole.entities.FalRecommendationLibrary, { tenant_id: tenantId }, 'id').catch(() => [])
        : Promise.resolve([]),
    ]);

    // Merge: tenant sobrescreve global por cluster_key+gap_level
    const recMap = new Map();
    for (const r of [...globalRecs, ...tenantRecs]) {
      if (r.is_active === false) continue;
      const key = `${r.cluster_key}::${r.gap_level ?? 0}`;
      const existing = recMap.get(key);
      // Tenant-specific sobrescreve; dentro do mesmo tenant, maior priority_weight vence
      if (!existing || r.tenant_id === tenantId || (r.priority_weight ?? 1) > (existing.priority_weight ?? 1)) {
        recMap.set(key, r);
      }
    }

    // Indexar por cluster_key → lista de recomendações relevantes (ordenadas por priority_weight)
    for (const rec of recMap.values()) {
      if (!rec.cluster_key) continue;
      // Só inclui se cluster tem score baixo (será verificado no step 8)
      if (!recommendationsByCluster.has(rec.cluster_key)) {
        recommendationsByCluster.set(rec.cluster_key, []);
      }
      recommendationsByCluster.get(rec.cluster_key).push(rec);
    }

    // Ordenar cada lista por priority_weight desc
    for (const [k, list] of recommendationsByCluster.entries()) {
      recommendationsByCluster.set(k, list.sort((a, b) => (b.priority_weight ?? 1) - (a.priority_weight ?? 1)));
    }

    console.log(`[generateActionPlan] FalRecommendationLibrary loaded: ${recMap.size} recs across ${recommendationsByCluster.size} clusters`);
  } catch (e) {
    console.warn('[generateActionPlan] FalRecommendationLibrary load failed:', e.message);
  }

  // ── 6. Carregar catálogo de root causes ────────────────────────────────────
  let rootCauses = insightSnap?.root_causes_ranked || [];
  if (rootCauses.length === 0) {
    try {
      const [gcauses, tcauses] = await Promise.all([
        fetchAll(base44.asServiceRole.entities.FalRootCauseCatalog, { tenant_id: 'global' }, 'id'),
        fetchAll(base44.asServiceRole.entities.FalRootCauseCatalog, { tenant_id: tenantId }, 'id'),
      ]);
      const causeMap = new Map();
      for (const c of gcauses) causeMap.set(c.cause_id, c);
      for (const c of tcauses) causeMap.set(c.cause_id, c);
      rootCauses = [...causeMap.values()];
    } catch (e) {
      console.warn('[generateActionPlan] root cause catalog load failed:', e.message);
    }
  }

  // ── 7. Construir mapa de scores por nível ──────────────────────────────────
  // scoreMap: { [dimension_key]: { score, subdimensions: { [subKey]: { score, clusters: { [cluKey]: score } } } } }
  const dimScores = falSnap.dimension_scores || {};

  // Build flat index: cluster_key → score (lowest score wins when cluster appears in multiple subdims)
  const clusterScoreIndex = new Map();
  for (const [dimKey, dimData] of Object.entries(dimScores)) {
    if (!dimData.active || dimData.score === null) continue;
    for (const [subKey, subData] of Object.entries(dimData.subdimension_scores || {})) {
      for (const [cluKey, cluData] of Object.entries(subData.cluster_scores || {})) {
        const s = safeNum(typeof cluData === 'number' ? cluData : cluData?.score, 0);
        if (!clusterScoreIndex.has(cluKey) || s < clusterScoreIndex.get(cluKey)) {
          clusterScoreIndex.set(cluKey, s);
        }
      }
    }
  }

  // Build subdimension score index
  const subdimScoreIndex = new Map();
  for (const [dimKey, dimData] of Object.entries(dimScores)) {
    if (!dimData.active || dimData.score === null) continue;
    for (const [subKey, subData] of Object.entries(dimData.subdimension_scores || {})) {
      subdimScoreIndex.set(`${dimKey}:${subKey}`, safeNum(subData.score, 0));
    }
  }

  // ── 7b. Converter ActionRecommendation aprovadas em candidatos (fonte PRIMÁRIA) ─
     const planKey = [tenantId, assessmentId, targetType, targetId || 'no-target'].join('|');
     const identityPlans = await fetchAll(base44.asServiceRole.entities.ActionPlan, { tenant_id: tenantId, plan_key: planKey });
     const activePlans = identityPlans.filter((item) => item.status === 'active');
     if (activePlans.length > 1) return Response.json({ error: 'ACTION_PLAN_IDENTITY_AMBIGUOUS' }, { status: 409 });
     const previousPlan = activePlans[0] || null;
     const recommendationRows = await fetchAll(base44.asServiceRole.entities.ActionRecommendation, { assessment_id: assessmentId, tenant_id: tenantId });
     const approvedRecs = recommendationRows.filter((item) => item.status === 'approved' || (item.status === 'converted_to_tasks' && item.action_plan_id === previousPlan?.id));

  const recCandidates = [];
  const generationTriggers = { cluster: 0, subdimension: 0, dimension: 0, killer_question: 0 };

  for (const rec of approvedRecs) {
    const clusterScore = rec.cluster_key ? (clusterScoreIndex.get(rec.cluster_key) ?? 0) : 0;
    const triggerScore = clusterScore;
    const pScore = calcPriorityScore(rec.impact_score || 4, rec.effort_score || 3, clusterScore <= 1 ? 3 : 1);
    const priority = scoreToPriority(pScore);
    const horizon = rec.suggested_deadline_days
      ? (rec.suggested_deadline_days <= 30 ? '30d' : rec.suggested_deadline_days <= 60 ? '60d' : rec.suggested_deadline_days <= 90 ? '90d' : '180d')
      : (clusterScore < 1 ? '30d' : clusterScore < 2 ? '60d' : '90d');
    const taskKey = `rec::${rec.id}::${targetId || 'notarget'}::${effectiveCycleId || 'default'}`;

    recCandidates.push({
      title:              rec.title,
      description:        rec.recommendation_text || '',
      how_to_execute:     rec.practical_steps || null,
      expected_evidence:  rec.evidence_required || null,
      reason:             rec.rationale || null,
      dimension_key:      rec.dimension_key,
      subdimension_key:   rec.subdimension_key || null,
      cluster_key:        rec.cluster_key || null,
      action_type:        'structural',
      typical_owner:      rec.suggested_owner_area || null,
      impact_score:       rec.impact_score || 4,
      effort_score:       rec.effort_score || 3,
      priority,
      priority_score:     round2(pScore),
      evidence_severity:  clusterScore <= 1 ? 3 : 2,
      evidence_missing:   false,
      evidence_questions: [],
      origin_score:       round2(triggerScore),
      origin_type:        'cluster',
      origin_detail:      `Recomendação aprovada: ${rec.title}`,
      horizon,
      due_date:           getHorizonDate(horizon),
      task_key:           taskKey,
      action_library_key: rec.id,
      dependency_task_keys: [],
      is_blocked:         false,
      task_layer:         'strategic',
      playbook_key:       null,
      source_recommendation_id: rec.id,
    });
    generationTriggers.cluster++;
  }

  console.log(`[generateActionPlan] Approved recommendations → ${recCandidates.length} candidates`);

  // ── 8. Avaliar elegibilidade e construir candidatos ─────────────────────────
  const candidateTasks = [];

  for (const action of actionLibrary) {
    // active já foi normalizado pelo normalizeAction — apenas ativas chegam aqui

    // Verificar aplicabilidade por tipo de entidade
    const applicableLevels = action.level_applicability; // já é array após normalizeAction
    if (!applicableLevels.includes(targetType)) continue;

    // Verificar aplicabilidade por setor — só filtra se assessment tem sector_snapshot definido
    if (action.sector_tags?.length > 0 && sectorSnapshot.length > 0) {
      const hasMatch = action.sector_tags.some(s => sectorSnapshot.includes(s));
      if (!hasMatch) continue;
    }

    const dimData = dimScores[action.dimension_key];
    if (!dimData?.active || dimData.score === null) continue;

    let triggerScore = null;
    let originType   = null;
    let originDetail = null;
    let horizon      = action.default_horizon || '90d';

    // Determinar score de trigger (cluster > subdim > dim)
    if (action.cluster_key) {
      // Ação específica de cluster
      const cluScore = clusterScoreIndex.get(action.cluster_key);
      if (cluScore === undefined) continue; // cluster não existe neste assessment
      if (cluScore > safeNum(action.score_trigger_max, SCORE_THRESHOLD)) continue;

      triggerScore = cluScore;
      originType   = 'cluster';
      originDetail = `Cluster ${action.cluster_key}: score ${round2(cluScore)}`;
      generationTriggers.cluster++;

    } else if (action.subdimension_key) {
      // Ação de subdimensão
      const subScore = subdimScoreIndex.get(`${action.dimension_key}:${action.subdimension_key}`);
      if (subScore === undefined) continue;
      if (subScore > safeNum(action.score_trigger_max, SCORE_THRESHOLD)) continue;

      triggerScore = subScore;
      originType   = 'subdimension';
      originDetail = `Subdimensão ${action.subdimension_key}: score ${round2(subScore)}`;
      generationTriggers.subdimension++;

    } else {
      // Ação de dimensão
      const dimScore = safeNum(dimData.score, 0);
      if (dimScore > safeNum(action.score_trigger_max, SCORE_THRESHOLD)) continue;

      triggerScore = dimScore;
      originType   = 'dimension';
      originDetail = `Dimensão ${action.dimension_key}: score ${round2(dimScore)}`;
      generationTriggers.dimension++;
    }

    // Killer question trigger override
    if (action.killer_question_trigger) {
      const relevantCluster = action.cluster_key || null;
      if (!relevantCluster || !killerFailedClusters.has(relevantCluster)) continue;
      originType   = 'killer_question';
      originDetail = `Killer question falhou no cluster ${relevantCluster}`;
      generationTriggers.killer_question++;
    }

    // Ajustar horizon baseado na urgência do trigger score
    if (triggerScore < 1.0)      horizon = '30d';
    else if (triggerScore < 1.8) horizon = action.default_horizon === '180d' ? '90d' : action.default_horizon;
    // acima de 1.8: manter default_horizon

    // Evidência via insights
    const driverIds = action.driver_ids || [];
    let evidenceSeverity = 1;
    let evidenceMissing  = true;
    const evidenceQuestions = [];

    for (const dId of driverIds) {
      const driverData = insightSnap?.driver_scores?.[dId];
      if (driverData) {
        evidenceSeverity = Math.max(evidenceSeverity, safeNum(driverData.severity_sum, 1));
        evidenceMissing  = false;
        (driverData.evidence_question_ids || []).forEach(q => {
          if (!evidenceQuestions.includes(q)) evidenceQuestions.push(q);
        });
      }
    }

    const pScore   = calcPriorityScore(action.impact_score, action.effort_score, evidenceSeverity);
    const priority = scoreToPriority(pScore);
    const rootCauseId = pickRootCause(rootCauses, driverIds);
    const taskKey  = buildTaskKey(action.action_key, targetId, effectiveCycleId);

    // Resolver dependency_task_keys (action_keys → task_keys do plano atual)
    const dependencyTaskKeys = (action.dependency_action_keys || []).map(
      ak => buildTaskKey(ak, targetId, effectiveCycleId)
    );

    // Enriquecer com recomendação da FalRecommendationLibrary se disponível para este cluster
    let recEnrichment = {};
    if (action.cluster_key && recommendationsByCluster.has(action.cluster_key)) {
      // Determina gap_level baseado no trigger score: 0=estrutural (<1), 1=corretivo (<2), 2=melhoria (>=2)
      const gapLevel = triggerScore < 1 ? 0 : triggerScore < 2 ? 1 : 2;
      const recs = recommendationsByCluster.get(action.cluster_key);
      // Primeiro tenta achar a recomendação com gap_level exato; fallback para a de maior priority_weight
      const bestRec = recs.find(r => (r.gap_level ?? 0) === gapLevel) || recs[0];
      if (bestRec) {
        recEnrichment = {
          recommendation_title:       bestRec.recommendation_title || null,
          recommendation_description: bestRec.recommendation_description || null,
          business_case:              bestRec.business_case || null,
          // Usa description da recomendação se a ação não tiver uma própria
          description: action.description || bestRec.recommendation_description || '',
          // Mescla implementation_steps como how_to_execute
          how_to_execute: Array.isArray(bestRec.implementation_steps) && bestRec.implementation_steps.length > 0
            ? bestRec.implementation_steps.join('\n')
            : null,
          // Usa horizon da recomendação se disponível
          horizon: bestRec.estimated_timeframe || horizon,
          // Usa typical_owner da recomendação se a ação não tiver
          typical_owner: action.typical_owner || bestRec.typical_owner || null,
        };
      }
    }

    candidateTasks.push({
      action_key:            action.action_key,
      title:                 action.title,
      description:           recEnrichment.description || action.description || '',
      how_to_execute:        recEnrichment.how_to_execute || null,
      reason:                recEnrichment.business_case || null,
      dimension_key:         action.dimension_key,
      subdimension_key:      action.subdimension_key || null,
      cluster_key:           action.cluster_key || null,
      driver_id:             driverIds[0] || null,
      root_cause_id:         rootCauseId,
      action_type:           action.action_type || 'structural',
      typical_owner:         recEnrichment.typical_owner || action.typical_owner || null,
      impact_score:          safeNum(action.impact_score, 3),
      effort_score:          safeNum(action.effort_score, 3),
      priority,
      priority_score:        round2(pScore),
      evidence_severity:     evidenceSeverity,
      evidence_missing:      evidenceMissing,
      evidence_questions:    evidenceQuestions,
      origin_score:          round2(triggerScore),
      origin_type:           originType,
      origin_detail:         originDetail,
      horizon:               recEnrichment.horizon || horizon,
      due_date:              getHorizonDate(recEnrichment.horizon || horizon),
      task_key:              taskKey,
      action_library_key:    action.action_key,
      dependency_task_keys:  dependencyTaskKeys,
      // compat
      playbook_key:          action.action_key,
    });
  }

  // ── 9. Gerar tarefas OPERACIONAIS via FalQuestionActionLibrary ─────────────
  const operationalCandidates = [];
  try {
    const questionSet = falSnap.question_set || assessment.question_set || [];

    // Carregar biblioteca de ações por pergunta (global + tenant)
    const [globalQActions, tenantQActions] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.FalQuestionActionLibrary, { tenant_id: 'global' }, 'id').catch(() => []),
      fetchAll(base44.asServiceRole.entities.FalQuestionActionLibrary, { tenant_id: tenantId }, 'id').catch(() => []),
    ]);
    const questionActionsMap = new Map();
    for (const qa of globalQActions) {
      if (!questionActionsMap.has(qa.question_id)) questionActionsMap.set(qa.question_id, []);
      questionActionsMap.get(qa.question_id).push(qa);
    }
    for (const qa of tenantQActions) {
      if (!questionActionsMap.has(qa.question_id)) questionActionsMap.set(qa.question_id, []);
      questionActionsMap.get(qa.question_id).push(qa);
    }

    // Para cada pergunta do assessment com score baixo, gerar tarefa operacional
    for (const q of allQuestions) {
      if (!questionSet.includes(q.id)) continue;
      const resp = respMap.get(q.id);
      if (!resp) continue;
      const score = safeNum(resp.score, 3);

      const qActions = questionActionsMap.get(q.id) || [];
      for (const qa of qActions) {
        if (!qa.is_active) continue;
        const triggerMax = safeNum(qa.trigger_score_max, 2);
        if (score > triggerMax) continue;

        // Verificar setor
        if (qa.sector_group && qa.sector_group !== 'geral' && sectorSnapshot.length > 0) {
          if (!sectorSnapshot.includes(qa.sector_group)) continue;
        }

        const pScore   = calcPriorityScore(safeNum(qa.impact_level, 3), safeNum(qa.effort_level, 3), score <= 1 ? 3 : 1);
        const priority = scoreToPriority(pScore);
        const horizon  = score <= 1 ? '30d' : score <= 2 ? '60d' : '90d';
        const taskKey  = `op::${qa.id}::${q.id}::${targetId || 'notarget'}::${effectiveCycleId || 'default'}`;

        const reason = qa.reason_template
          ? qa.reason_template.replace('{score}', score).replace('{risco}', score <= 1 ? 'ruptura' : 'fragilidade')
          : `Pergunta com score ${score} (≤ ${triggerMax}) indicando fragilidade operacional.`;

        operationalCandidates.push({
          title:              qa.action_title,
          description:        qa.action_description || '',
          how_to_execute:     qa.how_to_execute || null,
          expected_evidence:  qa.expected_evidence || null,
          frequency:          qa.frequency || 'once',
          reason,
          dimension_key:      qa.dimension_key,
          subdimension_key:   qa.subdimension_key || null,
          cluster_key:        qa.cluster_key || null,
          action_type:        ['quick_win','structural','foundational','compliance','operational'].includes(qa.action_type) ? qa.action_type : 'operational',
          typical_owner:      qa.responsible_role || null,
          impact_score:       safeNum(qa.impact_level, 3),
          effort_score:       safeNum(qa.effort_level, 3),
          priority,
          priority_score:     round2(pScore),
          evidence_severity:  score <= 1 ? 3 : 2,
          evidence_missing:   false,
          evidence_questions: [q.id],
          origin_score:       score,
          origin_type:        'question',
          origin_key:         q.id,
          origin_detail:      `Pergunta "${q.code || q.id}" score ${score} — ${q.text?.slice(0, 80) || ''}`,
          question_action_id: qa.id,
          task_layer:         'operational',
          horizon,
          due_date:           getHorizonDate(horizon),
          task_key:           taskKey,
          action_library_key: qa.id,
          dependency_task_keys: [],
          is_blocked:         false,
          playbook_key:       null,
        });
        generationTriggers.question = (generationTriggers.question || 0) + 1;
      }
    }
  } catch (e) {
    console.warn('[generateActionPlan] operational question actions failed:', e.message);
  }

  // Marcar tarefas estratégicas com task_layer
  for (const t of candidateTasks) {
    t.task_layer = 'strategic';
  }

  // ── 10. Ordenação e seleção ─────────────────────────────────────────────────
  // Recomendações aprovadas têm prioridade absoluta; biblioteca complementa
  const allStrategicCandidates = [...recCandidates, ...candidateTasks];
  allStrategicCandidates.sort((a, b) => {
    // rec aprovadas primeiro (têm source_recommendation_id)
    const aIsRec = !!a.source_recommendation_id;
    const bIsRec = !!b.source_recommendation_id;
    if (aIsRec !== bIsRec) return aIsRec ? -1 : 1;
    if (a.origin_score !== b.origin_score) return a.origin_score - b.origin_score;
    return (b.priority_score || 0) - (a.priority_score || 0);
  });
  const selectedStrategic = allStrategicCandidates.slice(0, MAX_TASKS);

  // Operacionais: limitar separadamente (max 30) e ordenar por urgência
  operationalCandidates.sort((a, b) => {
    if (a.origin_score !== b.origin_score) return a.origin_score - b.origin_score;
    return (b.priority_score || 0) - (a.priority_score || 0);
  });
  const selectedOperational = operationalCandidates.slice(0, 30);

  // Combinar: estratégicas primeiro, operacionais depois
  const allSelected = [...selectedStrategic, ...selectedOperational];

  // Fase 3: topological sort (dependências primeiro)
  const sortedTasks = topoSort(allSelected);

  // Fase 4: marcar is_blocked (dependência não presente no plano selecionado)
  const selectedTaskKeys = new Set(sortedTasks.map(t => t.task_key));
  for (const t of sortedTasks) {
    t.is_blocked = (t.dependency_task_keys || []).some(dep => !selectedTaskKeys.has(dep));
  }

  const finalTaskKeys = new Set(sortedTasks.map(t => t.task_key));

  // ── 11. Construir roadmap por fase ─────────────────────────────────────────
  const roadmap = { curto_prazo: [], medio_prazo: [], longo_prazo: [] };
  for (const t of sortedTasks) {
    roadmap[horizonToPhase(t.horizon)].push(t.task_key);
  }

  const quickWins        = sortedTasks.filter(t => t.action_type === 'quick_win').length;
  const structural       = sortedTasks.filter(t => t.action_type === 'structural').length;
  const foundational     = sortedTasks.filter(t => t.action_type === 'foundational').length;
  const operationalCount = sortedTasks.filter(t => t.task_layer === 'operational').length;
  const strategicCount   = sortedTasks.filter(t => t.task_layer !== 'operational').length;
  const dimensionsCovered = [...new Set(sortedTasks.map(t => t.dimension_key))];

  const generationConfig = {
    max_tasks:        MAX_TASKS,
    score_threshold:  SCORE_THRESHOLD,
    engine_version:   ENGINE_VERSION,
    killer_questions_checked: killerFailedClusters.size > 0,
    library_source:   'FalActionLibrary + FalRecommendationLibrary + FalQuestionActionLibrary + builtin',
    recommendation_clusters_enriched: recommendationsByCluster.size,
  };

  const generationSummary = {
    candidates_total:      candidateTasks.length + operationalCandidates.length,
    tasks_selected:        sortedTasks.length,
    strategic_tasks:       strategicCount,
    operational_tasks:     operationalCount,
    quick_wins:            quickWins,
    structural_actions:    structural,
    foundational_actions:  foundational,
    dimensions_covered:    dimensionsCovered,
    triggers:              generationTriggers,
    killer_failed_clusters: [...killerFailedClusters],
  };

  // ── 12. Identidade e reuso determinístico do plano ─────────────────────────
  const financialLineage = await resolveFinancialLineage(base44, assessment, tenantId);
     const sourceFinancialSnapshotIds = financialLineage.financial_snapshots.map((item) => item.snapshot_id);
     const generationFingerprint = await sha256({
       diagnostic_snapshot: { id: falSnap.id, checksum: falSnap.checksum || falSnap.updated_date || null },
       insight_snapshot: { id: insightSnap?.id || null, checksum: insightSnap?.checksum || insightSnap?.updated_date || null },
       financial_snapshots: financialLineage.financial_snapshots,
       financial_status: financialLineage.financial_status,
       financial_reason: financialLineage.reason,
       recommendations: approvedRecs.map(canonicalRecommendation),
    action_library_hash: await sha256(actionLibrary.map((item) => ({ id: item.id || item.action_key, updated_at: item.updated_date || null, action_key: item.action_key }))),
    target: { type: targetType, id: targetId || null }, cycle: effectiveCycleId, max_tasks: MAX_TASKS,
    score_threshold: SCORE_THRESHOLD, engine_version: ENGINE_VERSION, generation_config: generationConfig,
  });
  const committedGeneration = await resolveCommittedGeneration({ base44, tenantId, assessmentId, plan: previousPlan, generationFingerprint });
  if (committedGeneration.conflict) return Response.json({ error: committedGeneration.reason, open_operation_ids: committedGeneration.open_operation_ids || [] }, { status: 409 });
  if (committedGeneration.reusable) {
     let confirmedPlan = previousPlan;
     let reusedTasks = (await fetchAll(base44.asServiceRole.entities.ActionTask, { tenant_id: tenantId, plan_id: previousPlan.id })).filter(isActiveActionTask);
     if (confirmedPlan.total_tasks !== reusedTasks.length) {
       const recalcResponse = await base44.asServiceRole.functions.invoke('recalculateActionPlanState', { action_plan_id: previousPlan.id });
       if (!recalcResponse || recalcResponse.status >= 400 || !recalcResponse.data?.plan) return Response.json({ error: 'ACTION_PLAN_REUSE_STATE_INCONSISTENT' }, { status: 409 });
       confirmedPlan = recalcResponse.data.plan;
       reusedTasks = (await fetchAll(base44.asServiceRole.entities.ActionTask, { tenant_id: tenantId, plan_id: previousPlan.id })).filter(isActiveActionTask);
       if (confirmedPlan.total_tasks !== reusedTasks.length) return Response.json({ error: 'ACTION_PLAN_REUSE_STATE_INCONSISTENT' }, { status: 409 });
     }
     return Response.json({ ok: true, reused: true, plan: confirmedPlan, tasks: reusedTasks, generation_operation: committedGeneration.operation, roadmap: confirmedPlan.roadmap, generation_summary: confirmedPlan.generation_summary });
   }

   const existingTasksBeforeMutation = previousPlan ? await fetchAll(base44.asServiceRole.entities.ActionTask, { tenant_id: tenantId, plan_id: previousPlan.id }) : [];
   const flowRows = await fetchAll(base44.asServiceRole.entities.AssessmentFlowState, { assessment_id: assessmentId });
   const previousState = {
     plan: previousPlan ? structuredClone(previousPlan) : null,
     tasks: structuredClone(existingTasksBeforeMutation),
     recommendations: structuredClone(approvedRecs),
     flowState: structuredClone(flowRows[0] || null),
   };
   const generationOperationId = crypto.randomUUID();
   const operation = await base44.asServiceRole.entities.ActionPlanGenerationOperation.create({
     tenant_id: tenantId, assessment_id: assessmentId, action_plan_id: previousPlan?.id || null,
     operation_id: generationOperationId, status: 'candidate', input_fingerprint: generationFingerprint,
     previous_plan_snapshot: previousState.plan, previous_task_snapshot: previousState.tasks,
     previous_recommendation_snapshot: previousState.recommendations, previous_flow_state_snapshot: previousState.flowState,
     candidate_task_ids: [], started_at: new Date().toISOString(), started_by: user.email,
   });

   const candidatePlanData = {
     tenant_id: tenantId, assessment_id: assessmentId, cycle_id: effectiveCycleId, target_type: targetType, target_id: targetId, plan_key: planKey,
     generation_fingerprint: previousPlan?.generation_fingerprint || null,
     generation_diff_summary: previousPlan?.generation_diff_summary || null,
     status: previousPlan?.status || 'draft',
   };
   const finalPlanData = {
     ...candidatePlanData, insight_snapshot_id: insightSnap?.id || null, diagnostic_snapshot_id: falSnap.id,
     generation_fingerprint: generationFingerprint, source_diagnostic_snapshot_id: falSnap.id,
     source_insight_snapshot_id: insightSnap?.id || null, source_financial_snapshot_ids: sourceFinancialSnapshotIds,
     generated_at: new Date().toISOString(), generated_by: user.email, status: 'active',
     engine_version: ENGINE_VERSION, generation_config: generationConfig, generation_summary: generationSummary,
     roadmap, generation_diff_summary: null, updated_at: new Date().toISOString(), updated_by: user.email,
   };

  transactionContext = { base44, operation, previousState, createdPlanId: null, candidateTaskIds: [], generationOperationId, planId: previousPlan?.id || null, committed: false };
  let plan = previousPlan;
  if (!plan) {
    plan = await base44.asServiceRole.entities.ActionPlan.create(candidatePlanData);
    transactionContext.createdPlanId = plan.id;
  }
  transactionContext.planId = plan.id;
  await base44.asServiceRole.entities.ActionPlanGenerationOperation.update(operation.id, { action_plan_id: plan.id });

    // ── 13. Upsert ActionTasks ─────────────────────────────────────────────────
  const existingTasks = existingTasksBeforeMutation;

  const existingByKey = new Map(
    existingTasks.filter(t => t.task_key).map(t => [t.task_key, t])
  );

  const dedupStats = { created: 0, updated: 0, preserved: 0, cancelled: 0 };
  const resultTasks = [];

  for (const taskDef of sortedTasks) {
    const existing = existingByKey.get(taskDef.task_key);
    const payload = {
      ...taskDef,
      tenant_id:   tenantId,
      plan_id:     plan.id,
      assessment_id: assessmentId,
      target_type: targetType,
      target_id:   targetId,
    };
    delete payload.action_key; // não é campo da entidade

    if (existing) {
      if (existing.status === 'in_progress' || existing.status === 'done' || existing.status === 'blocked') {
        // Preserva status/progresso mas atualiza campos informativos (how_to_execute, expected_evidence, etc.)
        const updated = await base44.asServiceRole.entities.ActionTask.update(existing.id, {
          title:             payload.title,
          description:       payload.description,
          how_to_execute:    payload.how_to_execute,
          expected_evidence: payload.expected_evidence,
          frequency:         payload.frequency,
          reason:            payload.reason,
          impact_score:      payload.impact_score,
          effort_score:      payload.effort_score,
          priority_score:    payload.priority_score,
          dependency_task_keys: payload.dependency_task_keys,
          is_blocked:        payload.is_blocked,
        });
        resultTasks.push({ ...existing, ...updated });
        dedupStats.preserved++;
      } else {
        const updated = await base44.asServiceRole.entities.ActionTask.update(existing.id, {
          ...payload, status: 'todo',
        });
        resultTasks.push(updated);
        dedupStats.updated++;
      }
    } else {
      const created = await base44.asServiceRole.entities.ActionTask.create({
        ...payload, status: 'todo', operation_id: generationOperationId, operation_status: 'candidate',
      });
      transactionContext.candidateTaskIds.push(created.id);
      resultTasks.push(created);
      dedupStats.created++;
    }
  }

  // Cancelar tasks antigas não presentes no novo plano (só se status=todo e NÃO manuais)
  for (const old of existingTasks) {
    const isManual = old.origin_type === 'manual' || (old.task_key && old.task_key.startsWith('manual::'));
    if (old.task_key && !finalTaskKeys.has(old.task_key) && old.status === 'todo' && !isManual) {
      await base44.asServiceRole.entities.ActionTask.update(old.id, { status: 'cancelled' });
      dedupStats.cancelled++;
    }
  }

  // Recommendation conversion is part of the transaction: failure must abort the generation.
  for (const rec of approvedRecs) {
    const convertedTaskIds = resultTasks.filter((task) => task.task_key?.startsWith(`rec::${rec.id}::`)).map((task) => task.id);
    await base44.asServiceRole.entities.ActionRecommendation.update(rec.id, {
      status: 'converted_to_tasks', action_plan_id: plan.id, converted_task_ids: convertedTaskIds,
      converted_at: new Date().toISOString(), converted_by: user.email,
    });
  }

  await base44.asServiceRole.entities.ActionPlanGenerationOperation.update(operation.id, { candidate_task_ids: transactionContext.candidateTaskIds, status: 'committing' });
  for (const taskId of transactionContext.candidateTaskIds) await base44.asServiceRole.entities.ActionTask.update(taskId, { operation_status: 'active' });
  plan = await base44.asServiceRole.entities.ActionPlan.update(plan.id, { ...finalPlanData, generation_diff_summary: dedupStats });
  const recalcResponse = await base44.asServiceRole.functions.invoke('recalculateActionPlanState', { action_plan_id: plan.id });
  if (!recalcResponse || recalcResponse.status >= 400 || !recalcResponse.data?.plan) throw Object.assign(new Error('ACTION_PLAN_RECALCULATION_FAILED'), { status: 500, code: 'ACTION_PLAN_RECALCULATION_FAILED' });
  const flowPayload = { action_plan_status: 'done', action_plan_generated_at: finalPlanData.generated_at, action_plan_id: plan.id, stale_from_step: null, updated_by: user.email, action_plan_operation_id: generationOperationId, action_plan_operation_status: 'candidate', action_plan_operation_invalidated_at: null, action_plan_operation_invalidation_reason: null };
  let flowId = flowRows[0]?.id || null;
  if (flowId) await base44.asServiceRole.entities.AssessmentFlowState.update(flowId, flowPayload);
  else { const createdFlow = await base44.asServiceRole.entities.AssessmentFlowState.create({ tenant_id: tenantId, assessment_id: assessmentId, ...flowPayload }); flowId = createdFlow.id; transactionContext.createdFlowStateId = flowId; }
  const confirmedTasks = await fetchAll(base44.asServiceRole.entities.ActionTask, { tenant_id: tenantId, plan_id: plan.id });
  const activeResponseTasks = confirmedTasks.filter(isActiveActionTask);
  const confirmedRecommendations = await fetchAll(base44.asServiceRole.entities.ActionRecommendation, { assessment_id: assessmentId, tenant_id: tenantId });
  const confirmedFlow = flowId ? await base44.asServiceRole.entities.AssessmentFlowState.get(flowId) : null;
  const confirmedPlan = await base44.asServiceRole.entities.ActionPlan.get(plan.id);
  const generatedValidation = validateGeneratedTaskSet({ expectedDefinitions: sortedTasks, confirmedTasks, operationId: generationOperationId });
  if (!generatedValidation.ok || !confirmedPlan || confirmedPlan.total_tasks !== activeResponseTasks.length || approvedRecs.some((rec) => !confirmedRecommendations.find((item) => item.id === rec.id && item.action_plan_id === plan.id)) || !confirmedFlow || confirmedFlow.action_plan_status !== 'done') throw Object.assign(new Error('ACTION_PLAN_CONFIRMATION_FAILED'), { status: 500, code: 'ACTION_PLAN_CONFIRMATION_FAILED', details: generatedValidation });
  await base44.asServiceRole.entities.AssessmentFlowState.update(flowId, { action_plan_operation_status: 'active' });
  const activeOperation = await base44.asServiceRole.entities.ActionPlanGenerationOperation.update(operation.id, { status: 'active', committed_at: new Date().toISOString(), rollback_status: 'not_required' });
  if (activeOperation.status !== 'active') throw Object.assign(new Error('ACTION_PLAN_OPERATION_CONFIRMATION_FAILED'), { status: 500 });
  transactionContext.committed = true;
  return Response.json({ ok: true, plan: confirmedPlan, tasks: activeResponseTasks, generation_operation: activeOperation, roadmap, generation_summary: generationSummary, dedup_stats: dedupStats });
  } catch (error) {
    if (transactionContext?.operation && !transactionContext.committed) {
      try {
        await rollbackGeneration({ ...transactionContext, error });
      } catch (rollbackError) {
        console.error('[generateActionPlan] rollback failed', rollbackError);
        return Response.json({ error: 'ACTION_PLAN_GENERATION_ROLLBACK_FAILED', original_error: error?.message || null, rollback_error: rollbackError?.message || null, rollback_errors: rollbackError?.rollbackErrors || [], operation_id: transactionContext.generationOperationId || null }, { status: 500 });
      }
    }
    console.error('[generateActionPlan] Fatal error:', error);
    return Response.json({ error: error?.message || 'ACTION_PLAN_GENERATION_FAILED', operation_id: transactionContext?.generationOperationId || null }, { status: error?.status || 500 });
  }
  });