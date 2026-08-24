/**
 * Constantes compartilhadas para Central de Relatórios.
 * 
 * REGRAS CANÔNICAS DE COMPATIBILIDADE (registradas aqui como fonte única da verdade):
 * 
 * 1. ActionTask.plan_id é o campo canônico — equivalente lógico a action_plan_id.
 *    Usar getTaskPlanId(task) para resolver em qualquer payload de relatório.
 * 
 * 2. Status "done" e "completed" são equivalentes de CONCLUÍDO.
 *    Usar COMPLETED_STATUSES em qualquer filtragem de tarefas concluídas.
 *    A UI deve exibir ambos como "Concluída".
 * 
 * 3. Relatório NUNCA sobrescreve versão anterior.
 *    Regenerar = criar novo AssessmentReportVersion com report_version_number incremental.
 * 
 * 4. Todo relatório gerado deve persistir payload_snapshot e report_parameters.
 *    O PDF deve ser reprodutível no futuro a partir destes dois campos.
 */

// ── Compatibilidade de status ─────────────────────────────────
/** Statuses que representam tarefa CONCLUÍDA (compatibilidade done/completed) */
export const COMPLETED_STATUSES = ['done', 'completed'];

/** Statuses ativos (não cancelados) */
export const ACTIVE_STATUSES = ['todo', 'in_progress', 'blocked', 'done', 'completed'];

/** Retorna true se a tarefa está concluída */
export const isTaskCompleted = (task) => COMPLETED_STATUSES.includes(task?.status);

/** Retorna true se a tarefa está ativa (não cancelada) */
export const isTaskActive = (task) => task?.status !== 'cancelled';

// ── Compatibilidade de campo plan_id ─────────────────────────
/**
 * Retorna o ID do ActionPlan a partir de um ActionTask.
 * Campo canônico é plan_id; action_plan_id é alias lógico futuro.
 */
export const getTaskPlanId = (task) => task?.plan_id || task?.action_plan_id;

// ── Tipos de relatório ─────────────────────────────────────────
export const REPORT_TYPES = {
  initial_diagnostic:      { label: 'Diagnóstico Inicial',           icon: 'BarChart3',   color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  approved_action_plan:    { label: 'Plano de Ação Aprovado',        icon: 'Zap',         color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  review_cycle:            { label: 'Revisão Intermediária',          icon: 'GitBranch',   color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  consolidated_evolution:  { label: 'Consolidado de Evolução',       icon: 'TrendingUp',  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  executive_summary:       { label: 'Sumário Executivo',             icon: 'FileText',    color: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200' },
  action_scope:            { label: 'Base para Proposta Comercial',   icon: 'Briefcase',   color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  financial_diagnostic:    { label: 'Diagnóstico Financeiro',        icon: 'DollarSign',  color: 'text-green-700',   bg: 'bg-green-50',   border: 'border-green-200' },
  synthetic_integrated:    { label: 'Síntese Integrada FAL+Fin',     icon: 'Network',     color: 'text-cyan-700',    bg: 'bg-cyan-50',    border: 'border-cyan-200' },
  custom:                  { label: 'Personalizado',                  icon: 'Settings2',   color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200' },
};

export const REPORT_STATUS = {
  draft:     { label: 'Rascunho',   cls: 'bg-slate-100 text-slate-500' },
  generated: { label: 'Gerado',     cls: 'bg-emerald-100 text-emerald-700' },
  archived:  { label: 'Arquivado',  cls: 'bg-slate-100 text-slate-400' },
  failed:    { label: 'Falhou',     cls: 'bg-red-100 text-red-700' },
};

// ── Presets de relatório ───────────────────────────────────────
export const REPORT_PRESETS = [
  {
    id: 'initial_diagnostic_executive',
    report_type: 'initial_diagnostic',
    label: 'Diagnóstico Inicial Executivo',
    description: 'Resumo executivo com scores, radar, principais fragilidades e prioridades.',
    audience: 'administration',
    parameters: {
      include_executive_summary: true,
      include_dimension_scores: true,
      include_radar_chart: true,
      include_main_fragilities: true,
      include_priorities: true,
      include_full_questionnaire_appendix: false,
      narrative_depth: 'standard',
      report_template: 'executive_short',
    },
  },
  {
    id: 'initial_diagnostic_technical',
    report_type: 'initial_diagnostic',
    label: 'Diagnóstico Técnico Completo',
    description: 'Relatório técnico detalhado com subdimensões, clusters, perguntas e evidências.',
    audience: 'internal_consulting_team',
    parameters: {
      include_dimension_scores: true,
      show_subdimensions: true,
      show_clusters: true,
      show_questions_evidence: true,
      include_questionnaire_responses: true,
      include_appendices: true,
      narrative_depth: 'technical',
      report_template: 'technical_full',
    },
  },
  {
    id: 'approved_action_plan',
    report_type: 'approved_action_plan',
    label: 'Plano de Ação Aprovado',
    description: 'Plano de ação completo com tarefas, responsáveis, prazos e dependências.',
    audience: 'administration',
    parameters: {
      include_action_plan: true,
      include_only_active_tasks: true,
      show_task_origin: true,
      show_task_owner: true,
      show_task_deadline: true,
      show_task_status: true,
      show_task_effort: true,
      show_task_impact: true,
      show_task_dependencies: true,
      include_postponed_dimensions: true,
      include_out_of_scope_dimensions: true,
      report_template: 'standard_fal',
    },
  },
  {
    id: 'review_cycle',
    report_type: 'review_cycle',
    label: 'Revisão Intermediária',
    description: 'Relatório da visita de acompanhamento com alterações de tarefas e progresso.',
    audience: 'administration',
    parameters: {
      include_reviews: true,
      include_current_review_only: true,
      show_status_changes: true,
      show_completed_actions: true,
      show_overdue_actions: true,
      show_reprogrammed_actions: true,
      show_new_actions_added: true,
      compare_current_vs_previous: true,
      compare_current_vs_approved_plan: true,
      show_timeline: true,
      report_template: 'standard_fal',
    },
  },
  {
    id: 'consolidated_evolution',
    report_type: 'consolidated_evolution',
    label: 'Consolidado de Evolução',
    description: 'Histórico completo de todas as revisões com evolução por dimensão.',
    audience: 'board',
    parameters: {
      include_all_review_cycles: true,
      compare_current_vs_initial: true,
      compare_current_vs_approved_plan: true,
      show_evolution_by_dimension: true,
      show_evolution_charts: true,
      show_timeline: true,
      report_template: 'technical_full',
    },
  },
  {
    id: 'executive_summary_admin',
    report_type: 'executive_summary',
    label: 'Sumário Executivo para Administração',
    description: 'Síntese executiva concisa para apresentar à diretoria.',
    audience: 'administration',
    parameters: {
      include_executive_summary: true,
      include_diagnostic_narrative: true,
      include_action_plan_narrative: true,
      include_review_narrative: true,
      include_next_steps: true,
      include_appendices: false,
      narrative_depth: 'concise',
      narrative_tone: 'executive',
      report_template: 'executive_short',
    },
  },
  {
    id: 'action_scope_commercial',
    report_type: 'action_scope',
    label: 'Base para Proposta Comercial',
    description: 'Escopo de ação sem evidências sensíveis, para uso em proposta comercial.',
    audience: 'internal_consulting_team',
    parameters: {
      include_action_plan: true,
      include_commercial_effort_estimate: true,
      include_client_effort_estimate: true,
      include_team_sizing_estimate: true,
      include_fee_basis_notes: true,
      include_postponed_dimensions: true,
      include_out_of_scope_dimensions: true,
      include_sensitive_evidence: false,
      report_template: 'commercial_scope',
    },
  },
  {
    id: 'synthetic_integrated_fal_fin',
    report_type: 'synthetic_integrated',
    label: 'Síntese Integrada FAL + Financeiro',
    description: 'Leitura interpretativa combinando maturidade operacional e situação financeira.',
    audience: 'administration',
    parameters: {
      include_fal_summary: true,
      include_financial_summary: true,
      include_correlations: true,
      include_contradictions: true,
      include_recommendations: true,
      include_synthetic_risk: true,
      report_template: 'synthetic_integrated',
    },
  },
];