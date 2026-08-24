/**
 * mfisDefinitions.js
 * Definições fixas dos 11 cruzamentos do MFIS/MQE — Método FAL
 *
 * Estes cruzamentos são canônicos e imutáveis nesta fase.
 * Qualquer extensão futura deve ser adicionada aqui antes de ser
 * calculada ou exibida.
 */

// Mapa de labels por chave de dimensão
export const DIM_LABEL = {
  governanca:         'Governança',
  juridico:           'Jurídico',
  controles_internos: 'Controles Internos',
  financeiro:         'Financeiro',
  contabil:           'Contábil',
  tributario:         'Fiscal / Tributário',
  operacional:        'Operações',
  sistemas:           'Sistemas & Controles',
  // alias estratégia (pode não estar no FAL base — fallback para governança se ausente)
  estrategia:         'Estratégia',
};

// Peso por tipo de cruzamento
export const CROSSING_TYPE_WEIGHT = {
  institutional: 1.15,
  strategic:     1.10,
  financial:     1.10,
  operational:   1.05,
  integrity:     1.00,
};

/**
 * 11 cruzamentos canônicos do MFIS
 * Cada cruzamento define:
 *   key          — identificador estável
 *   label        — label exibido na UI
 *   dim_a        — chave da dimensão A (deve existir em FalDiagnosticSnapshot.dimension_scores)
 *   dim_b        — chave da dimensão B
 *   crossing_type — tipo metodológico (determina o peso)
 *   mqe_key      — chave usada no MQE/crossings do MethodVersion (pode ser null se não mapeado)
 *   interpretation_template — guia para o texto automático
 */
export const MFIS_CROSSINGS = [
  // ── Núcleo estratégico ─────────────────────────────────────────────────────
  {
    key:   'estrategia_x_governanca',
    label: 'Estratégia × Governança',
    dim_a: 'estrategia',
    dim_b: 'governanca',
    crossing_type: 'strategic',
    mqe_key: null,
    interpretation_template: {
      fragile: 'A ausência de alinhamento entre planejamento estratégico e governança institucional fragiliza a tomada de decisão e a execução das diretrizes organizacionais.',
      risk: 'Risco de desconexão entre a visão de longo prazo e a estrutura decisória, gerando iniciativas sem ancoragem ou controle formal.',
      focus: 'Fortalecer processos de governança que traduzam objetivos estratégicos em estruturas de accountability e monitoramento.',
    },
  },
  {
    key:   'estrategia_x_financeiro',
    label: 'Estratégia × Financeiro',
    dim_a: 'estrategia',
    dim_b: 'financeiro',
    crossing_type: 'strategic',
    mqe_key: null,
    interpretation_template: {
      fragile: 'A fragilidade entre planejamento estratégico e gestão financeira compromete a capacidade de sustentar iniciativas de longo prazo.',
      risk: 'Risco de decisões estratégicas sem respaldo financeiro ou orçamentário, gerando descontinuidade e pressão de caixa.',
      focus: 'Integrar o ciclo de planejamento estratégico ao orçamento e projeções financeiras de médio prazo.',
    },
  },

  // ── Núcleo institucional ───────────────────────────────────────────────────
  {
    key:   'governanca_x_juridico',
    label: 'Governança × Jurídico',
    dim_a: 'governanca',
    dim_b: 'juridico',
    crossing_type: 'institutional',
    mqe_key: 'gov_jur',
    interpretation_template: {
      fragile: 'A interdependência entre governança e estrutura jurídica/societária está comprometida, aumentando exposição a riscos legais e societários.',
      risk: 'Risco de decisões societárias mal suportadas juridicamente e contratos ou acordos sem supervisão adequada.',
      focus: 'Alinhar a estrutura societária e os instrumentos jurídicos com os mecanismos de governança corporativa.',
    },
  },
  {
    key:   'governanca_x_sistemas',
    label: 'Governança × Sistemas & Controles',
    dim_a: 'governanca',
    dim_b: 'sistemas',
    crossing_type: 'institutional',
    mqe_key: 'gov_sis',
    interpretation_template: {
      fragile: 'A governança institucional não está sendo plenamente suportada por sistemas e controles formais, reduzindo rastreabilidade e supervisão.',
      risk: 'Risco de decisões sem registro adequado e ausência de trilha de auditoria nos processos críticos.',
      focus: 'Implementar sistemas de informação e controle que suportem e registrem as decisões de governança.',
    },
  },

  // ── Núcleo financeiro ──────────────────────────────────────────────────────
  {
    key:   'financeiro_x_contabil',
    label: 'Financeiro × Contábil',
    dim_a: 'financeiro',
    dim_b: 'contabil',
    crossing_type: 'financial',
    mqe_key: 'fin_cont',
    interpretation_template: {
      fragile: 'Há fragilidade entre disciplina financeira e confiabilidade contábil, sugerindo risco de inconsistência entre execução financeira e registros gerenciais.',
      risk: 'Risco de divergência entre resultado real e resultado contábil, comprometendo decisões baseadas em dados.',
      focus: 'Estabelecer rotinas de conciliação entre gestão financeira e registros contábeis com periodicidade definida.',
    },
  },
  {
    key:   'financeiro_x_tributario',
    label: 'Financeiro × Fiscal / Tributário',
    dim_a: 'financeiro',
    dim_b: 'tributario',
    crossing_type: 'financial',
    mqe_key: 'fin_trib',
    interpretation_template: {
      fragile: 'A integração entre fluxo financeiro e obrigações fiscais está comprometida, gerando risco de passivo tributário não provisionado.',
      risk: 'Risco de planejamento de caixa sem incorporar obrigações fiscais, resultando em pressão de liquidez em períodos de apuração.',
      focus: 'Integrar o calendário fiscal ao planejamento financeiro e garantir provisões mensais adequadas.',
    },
  },

  // ── Núcleo operacional ─────────────────────────────────────────────────────
  {
    key:   'operacional_x_financeiro',
    label: 'Operações × Financeiro',
    dim_a: 'operacional',
    dim_b: 'financeiro',
    crossing_type: 'operational',
    mqe_key: 'op_fin',
    interpretation_template: {
      fragile: 'A operação não está sendo devidamente traduzida em gestão financeira, criando desconexão entre resultado operacional e capacidade financeira.',
      risk: 'Risco de crescimento operacional sem suporte financeiro ou decisões de investimento sem análise de viabilidade.',
      focus: 'Estruturar indicadores financeiros que reflitam a performance operacional e suportem decisões de curto prazo.',
    },
  },
  {
    key:   'operacional_x_sistemas',
    label: 'Operações × Sistemas & Controles',
    dim_a: 'operacional',
    dim_b: 'sistemas',
    crossing_type: 'operational',
    mqe_key: 'op_sis',
    interpretation_template: {
      fragile: 'O cruzamento revela baixa tradução da rotina operacional em controles formais, aumentando risco de falhas de execução e rastreabilidade.',
      risk: 'Risco de processos operacionais críticos sem suporte de sistema, controle ou padronização mínima.',
      focus: 'Mapear e sistematizar os processos operacionais críticos com apoio de ferramentas e controles formais.',
    },
  },

  // ── Núcleo de integridade ──────────────────────────────────────────────────
  {
    key:   'sistemas_x_contabil',
    label: 'Sistemas & Controles × Contábil',
    dim_a: 'sistemas',
    dim_b: 'contabil',
    crossing_type: 'integrity',
    mqe_key: 'sis_cont',
    interpretation_template: {
      fragile: 'A falta de integração entre sistemas de controle e contabilidade compromete a confiabilidade e tempestividade das informações contábeis.',
      risk: 'Risco de relatórios contábeis desatualizados ou inconsistentes com a realidade operacional e financeira.',
      focus: 'Garantir que os sistemas operacionais alimentem automaticamente ou com mínimo retrabalho os registros contábeis.',
    },
  },
  {
    key:   'contabil_x_tributario',
    label: 'Contábil × Fiscal / Tributário',
    dim_a: 'contabil',
    dim_b: 'tributario',
    crossing_type: 'integrity',
    mqe_key: 'cont_trib',
    interpretation_template: {
      fragile: 'A qualidade contábil não está sustentando adequadamente a conformidade fiscal, gerando risco de inconsistências tributárias.',
      risk: 'Risco de escrituração contábil inconsistente com as obrigações acessórias e apurações fiscais.',
      focus: 'Elevar a qualidade dos lançamentos contábeis como base para obrigações fiscais tempestivas e corretas.',
    },
  },

  // ── Reforço institucional de controle ─────────────────────────────────────
  {
    key:   'governanca_x_controles_internos',
    label: 'Governança × Controles Internos',
    dim_a: 'governanca',
    dim_b: 'controles_internos',
    crossing_type: 'institutional',
    mqe_key: null,
    interpretation_template: {
      fragile: 'A governança institucional não está sendo convertida em mecanismos efetivos de controle interno, reduzindo supervisão e disciplina decisória.',
      risk: 'Risco de decisões sem rastreabilidade, ausência de alçadas definidas e ambiente de controle frágil.',
      focus: 'Traduzir as diretrizes de governança em políticas e controles internos formalizados e monitorados.',
    },
  },
];

/**
 * Retorna o cruzamento pelo key
 */
export function getCrossing(key) {
  return MFIS_CROSSINGS.find(c => c.key === key) || null;
}

/**
 * Retorna o peso de um tipo de cruzamento
 */
export function getCrossingWeight(crossing_type) {
  return CROSSING_TYPE_WEIGHT[crossing_type] ?? 1.0;
}

/**
 * Classifica o score final (0–100) em nível de tensão
 */
export function classifyTension(score) {
  if (score >= 80) return 'madura';
  if (score >= 60) return 'funcional';
  if (score >= 40) return 'alerta';
  if (score >= 20) return 'fragilidade';
  return 'ruptura';
}

export const TENSION_LABEL = {
  madura:      'Integração madura',
  funcional:   'Integração funcional',
  alerta:      'Alerta sistêmico',
  fragilidade: 'Fragilidade estrutural',
  ruptura:     'Ruptura sistêmica',
};

export const TENSION_COLOR = {
  madura:      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  funcional:   { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  alerta:      { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  fragilidade: { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700',  dot: 'bg-orange-500' },
  ruptura:     { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700',     dot: 'bg-red-500' },
};