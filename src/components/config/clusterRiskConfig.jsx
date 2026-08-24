/**
 * clusterRiskConfig.js — Risco Inerente por Cluster FAL
 * Níveis: 'critical' | 'high' | 'medium' | 'low'
 */

export const CLUSTER_RISK_CONFIG = {
  // ── Controles Internos ──────────────────────────────────────────────────────
  tesouraria_cluster:                   'critical',
  segregacao_funcoes_cluster:           'critical',
  endividamento_cluster:                'critical',
  receitas_faturamento_cluster:         'high',
  compliance_contabil_cluster:          'high',
  controle_estoques_cluster:            'high',
  compras_cluster:                      'high',
  gestao_imobilizado_cluster:           'medium',
  custos_agricolas_cluster:             'high',
  folha_admissao_cluster:               'medium',
  folha_demissao_cluster:               'medium',
  folha_promocoes_cluster:              'low',

  // ── Financeiro ──────────────────────────────────────────────────────────────
  gestao_caixa_cluster:                 'critical',
  estrutura_capital_cluster:            'critical',
  planejamento_financeiro_cluster:      'high',
  relacionamento_bancario_cluster:      'high',
  indicadores_financeiros_cluster:      'high',
  financas_agro_cpr_barter_cluster:     'high',
  acompanhamento_resultados_cluster:    'high',
  carteira_clientes_cluster:            'medium',
  indicadores_comerciais_cluster:       'medium',
  indicadores_operacionais_cluster:     'medium',
  estrategia_comercial_cluster:         'medium',
  modelo_negocio_cluster:               'medium',
  planejamento_estrategico_cluster:     'medium',
  inteligencia_mercado_cluster:         'low',
  posicionamento_mercado_cluster:       'low',

  // ── Governança ──────────────────────────────────────────────────────────────
  estrutura_governanca_cluster:         'high',
  gestao_riscos_cluster:                'high',
  processo_decisorio_cluster:           'medium',
  transparencia_cluster:                'medium',

  // ── Jurídico ────────────────────────────────────────────────────────────────
  contencioso_cluster:                  'critical',
  riscos_trabalhistas_cluster:          'high',
  estrutura_societaria_cluster:         'high',
  contratos_comerciais_cluster:         'high',
  contratos_operacionais_cluster:       'medium',
  regularidade_ambiental_cluster:       'high',
  regularidade_fundiaria_cluster:       'high',

  // ── Contábil ────────────────────────────────────────────────────────────────
  demonstracoes_financeiras_cluster:    'critical',
  organizacao_contabil_cluster:         'high',
  ativo_biologico_cpc29_cluster:        'medium',

  // ── Tributário ──────────────────────────────────────────────────────────────
  apuracao_tributos_cluster:            'critical',
  riscos_fiscais_cluster:               'critical',
  obrigacoes_acessorias_cluster:        'high',
  enquadramento_tributario_cluster:     'high',
  tributario_agro_especifico_cluster:   'high',

  // ── Operacional ──────────────────────────────────────────────────────────────
  planejamento_produtivo_cluster:       'high',
  gestao_producao_cluster:              'high',
  gestao_safra_e_logistica_cluster:     'high',
  gestao_insumos_cluster:               'medium',
  gestao_pessoas_cluster:               'medium',

  // ── Sistemas ────────────────────────────────────────────────────────────────
  sistemas_gestao_cluster:              'high',
  infraestrutura_tecnologica_cluster:   'medium',
  seguranca_informacao_cluster:         'high',
};

export const RISK_LEVELS = {
  critical: { label: 'Crítico', color: '#dc2626', bg_class: 'bg-red-100', text_class: 'text-red-700', border_class: 'border-red-300', dot_class: 'bg-red-500', priority_multiplier: 4 },
  high:     { label: 'Alto',    color: '#ea580c', bg_class: 'bg-orange-100', text_class: 'text-orange-700', border_class: 'border-orange-300', dot_class: 'bg-orange-500', priority_multiplier: 3 },
  medium:   { label: 'Médio',   color: '#ca8a04', bg_class: 'bg-yellow-100', text_class: 'text-yellow-700', border_class: 'border-yellow-300', dot_class: 'bg-yellow-500', priority_multiplier: 2 },
  low:      { label: 'Baixo',   color: '#16a34a', bg_class: 'bg-green-100', text_class: 'text-green-700', border_class: 'border-green-300', dot_class: 'bg-green-500', priority_multiplier: 1 },
};

export function getInherentRisk(clusterKey) {
  return CLUSTER_RISK_CONFIG[clusterKey] || 'medium';
}

export function getClusterRiskInfo(clusterKey) {
  const level = getInherentRisk(clusterKey);
  return { level, ...RISK_LEVELS[level] };
}

export default CLUSTER_RISK_CONFIG;