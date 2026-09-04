export const PRIORITY_STYLE = {
  critical: { bg: 'bg-red-50 border-red-200',    badge: 'bg-red-100 text-red-700',     dot: 'bg-red-500',   label: 'Crítica' },
  high:     { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'Alta' },
  medium:   { bg: 'bg-blue-50 border-blue-200',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400',  label: 'Média' },
  low:      { bg: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', label: 'Baixa' },
};

export const STATUS_STYLE = {
  todo:        { label: 'A Estruturar',  cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'Em Andamento', cls: 'bg-blue-100 text-blue-700' },
  blocked:     { label: 'Bloqueada',    cls: 'bg-amber-100 text-amber-700' },
  done:        { label: 'Concluída',    cls: 'bg-emerald-100 text-emerald-700' },
  cancelled:   { label: 'Cancelada',   cls: 'bg-slate-100 text-slate-400' },
};

export const REC_STATUS_STYLE = {
  suggested:          { label: 'Sugerida',           cls: 'bg-blue-100 text-blue-700' },
  approved:           { label: 'Aprovada',            cls: 'bg-emerald-100 text-emerald-700' },
  rejected:           { label: 'Rejeitada',           cls: 'bg-red-100 text-red-600' },
  needs_classification:{ label: 'Pendente',          cls: 'bg-amber-100 text-amber-700' },
  converted_to_tasks: { label: 'Convertida em Tarefas', cls: 'bg-purple-100 text-purple-700' },
  cancelled:          { label: 'Cancelada',           cls: 'bg-slate-100 text-slate-400' },
};

export const SOURCE_CFG = {
  fal_diagnostic:       { label: 'Diagnóstico FAL',              cls: 'bg-blue-100 text-blue-700' },
  financial_diagnostic: { label: 'Diagnóstico Financeiro',        cls: 'bg-emerald-100 text-emerald-700' },
  tax_reform_diagnostic:{ label: 'Diagnóstico Reforma Tributária',cls: 'bg-orange-100 text-orange-700' },
  library:              { label: 'Biblioteca FAL',                cls: 'bg-violet-100 text-violet-700' },
  ai:                   { label: 'IA',                            cls: 'bg-amber-100 text-amber-700' },
  manual:               { label: 'Consultor',                     cls: 'bg-slate-100 text-slate-600' },
};

export const DIM_LABELS = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal',
  operacional: 'Operacional', sistemas: 'Tecnologia',
  analise_financeira: 'Análise Financeira',
};

export const HORIZON_LABEL = { '30d': '30 dias', '60d': '60 dias', '90d': '90 dias', '180d': '180 dias' };

export const ORIGIN_CONTEXT_LABELS = {
  feeling_tecnico: 'Feeling técnico',
  reuniao: 'Reunião',
  visita: 'Visita',
  evidencia_observada: 'Evidência observada',
  solicitacao_administracao: 'Solicitação da administração',
  outro: 'Outro',
};