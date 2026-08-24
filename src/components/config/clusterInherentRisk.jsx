/**
 * clusterInherentRisk.js — Risco inerente por cluster FAL
 * Independente do score observado; combina com o score para calcular risco residual.
 * Níveis: 'critical' | 'high' | 'medium' | 'low'
 */

export const CLUSTER_INHERENT_RISK = {
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

/** Peso numérico por nível de risco inerente */
export const RISK_WEIGHTS = {
  critical: 3,
  high:     2,
  medium:   1,
  low:      0.5,
};

/** Labels visuais */
export const RISK_LABELS = {
  critical: { label: 'Crítico', bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  high:     { label: 'Alto',    bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  medium:   { label: 'Médio',   bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  low:      { label: 'Baixo',   bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
};

/**
 * Retorna o risco inerente de um cluster.
 * Fallback: 'medium' se não mapeado.
 */
export function getInherentRisk(clusterKey) {
  return CLUSTER_INHERENT_RISK[clusterKey] || 'medium';
}

/**
 * Calcula o risco residual combinando score observado com risco inerente.
 * ESCALA 0–3 (alinhada com questionário e backend).
 *
 * score >= 2.5  → risco residual = 'low'     (controles suficientes = "Avançado")
 * score 1.8–2.49 → risco residual = 'medium'  (controles parciais = "Estruturado")
 * score < 1.8  → risco residual = 'high'/'critical' (controles insuficientes)
 *
 * @param {number|null} clusterScore - Score observado 0–3
 * @param {string}      inherentRisk - Nível inerente: 'critical'|'high'|'medium'|'low'
 * @returns {{ inherent_risk, residual_risk, risk_score }}
 */
export function calculateResidualRisk(clusterScore, inherentRisk) {
  const score = (clusterScore !== null && clusterScore !== undefined && !isNaN(clusterScore))
    ? Math.max(0, Math.min(3, Number(clusterScore)))
    : 0;

  const weight = RISK_WEIGHTS[inherentRisk] || RISK_WEIGHTS.medium;

  // Gap = quanto falta para atingir maturidade mínima aceitável (2.5 em escala 0–3)
  const gap = Math.max(0, 2.5 - score);

  // risk_score: combinação de gap e peso inerente (normalizado 0–10)
  const risk_score = Math.round(Math.min(10, (gap / 2.5) * weight * 10) * 10) / 10;

  let residual_risk;
  if (score >= 2.5) {
    residual_risk = 'low';
  } else if (score >= 1.8) {
    residual_risk = inherentRisk === 'critical' ? 'high' : 'medium';
  } else {
    residual_risk = (inherentRisk === 'critical' || inherentRisk === 'high') ? 'critical' : 'high';
  }

  return { inherent_risk: inherentRisk, residual_risk, risk_score };
}

/**
 * Calcula a prioridade de ação de um cluster.
 * priority_score = (3 - score) × risk_weight  (escala 0–3)
 *
 * @param {number|null} clusterScore
 * @param {string}      riskLevel  - risco inerente ou residual
 * @returns {{ priority_level, priority_score }}
 */
export function calculateActionPriority(clusterScore, riskLevel) {
  const score = (clusterScore !== null && clusterScore !== undefined && !isNaN(clusterScore))
    ? Math.max(0, Math.min(3, Number(clusterScore)))
    : 0;

  const weight = RISK_WEIGHTS[riskLevel] || RISK_WEIGHTS.medium;
  const priority_score = Math.round(((3 - score) * weight) * 100) / 100;

  let priority_level;
  if (priority_score >= 7)       priority_level = 'critical';
  else if (priority_score >= 4)  priority_level = 'high';
  else if (priority_score >= 1.5) priority_level = 'medium';
  else                           priority_level = 'low';

  return { priority_level, priority_score };
}

export default CLUSTER_INHERENT_RISK;