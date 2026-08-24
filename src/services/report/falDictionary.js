/**
 * falDictionary.js — Dicionário editorial único do Método FAL™
 *
 * Centraliza TODAS as strings institucionais, títulos de seção,
 * nomes de dimensões e terminologia oficial.
 * Nunca use strings hardcoded dispersas nos componentes — importe daqui.
 */

// ─── Nomes oficiais das dimensões ────────────────────────────────────────────
export const DIMENSION_NAMES = {
  governanca:         'Governança',
  juridico:           'Jurídico / Societário',
  controles_internos: 'Controles Internos',
  financeiro:         'Financeiro',
  contabil:           'Contábil',
  tributario:         'Fiscal / Tributário',
  operacional:        'Operacional',
  sistemas:           'Tecnologia',
};

// ─── Títulos oficiais das seções do PDF ──────────────────────────────────────
export const SECTION_TITLES = {
  cover:                'Diagnóstico organizacional · Método FAL™',
  executive_summary:    'Sumário executivo',
  mfis_insights:        'Diagnóstico sistêmico — MFIS™',
  coverage:             'Cobertura do diagnóstico',
  dimension_profile:    (count, isAll8) =>
    isAll8
      ? `Análise detalhada das 8 dimensões`
      : `Análise detalhada das dimensões aplicáveis`,
  fragilities:          'Fragilidades estruturais',
  strategic_priorities: 'Prioridades estratégicas',
  action_plan_90:       'Plano de ação — 90 dias',
  final_synthesis:      'Síntese final',
  methodology:          'Metodologia',
};

// ─── Subtítulos e rótulos recorrentes ────────────────────────────────────────
export const LABELS = {
  maturity_level:      'Nível de maturidade',
  maturity_score:      'Score geral',
  maturity_index:      'Índice de maturidade',
  main_tension:        'Principal tensão sistêmica',
  leverage_point:      'Ponto de alavanca sistêmica',
  dimensions_by_level: 'Dimensões por classificação',
  radar_title:         'Radar de maturidade',
  dim_summary:         'Resumo por dimensão',
  executive_reading:   'Leitura executiva do diagnóstico',
  top_tensions:        'Principais tensões sistêmicas',
  leverage_dims:       'Dimensões por alavancagem',
  consultive_interp:   'Interpretação consultiva',
  strategic_rec:       'Recomendações estratégicas',
  methodology_label:   'Apêndice metodológico',
  disclaimer:          'Documento confidencial — uso exclusivo do destinatário',
  scale_label:         'Escala de avaliação (0 a 3)',
};

// ─── Nomenclatura oficial dos frameworks ────────────────────────────────────
export const FRAMEWORK_NAMES = {
  fal:  'Método FAL™',
  ifme: 'IFME™',
  mqe:  'MQE™',
  mfis: 'MFIS™',
  full: {
    ifme: 'IFME™ — Índice FAL de Maturidade Empresarial',
    mqe:  'MQE™ — Módulo de Qualidade dos Cruzamentos',
    mfis: 'MFIS™ — Matriz FAL de Interdependência Sistêmica',
  },
};

// ─── Níveis de maturidade ────────────────────────────────────────────────────
export const MATURITY_LEVELS = {
  Crítico:     { label: 'Crítico',     color: '#ef4444', bg: '#fef2f2', text: '#b91c1c' },
  Básico:      { label: 'Básico',      color: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
  Estruturado: { label: 'Estruturado', color: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' },
  Avançado:    { label: 'Avançado',    color: '#22c55e', bg: '#f0fdf4', text: '#15803d' },
};

// ─── Abreviações seguras para o radar (máx. 10 chars) ───────────────────────
export const DIMENSION_RADAR_LABELS = {
  governanca:         'Governança',
  juridico:           'Jurídico',
  controles_internos: 'Controles',
  financeiro:         'Financeiro',
  contabil:           'Contábil',
  tributario:         'Fiscal',
  operacional:        'Operação',
  sistemas:           'Tecnologia',
};

// ─── Textos de padronização global ──────────────────────────────────────────────
export const GLOBAL_TEXTS = {
  section_cover:       'Capa',
  section_executive:   'Sumário executivo',
  section_mfis:        'Diagnóstico sistêmico',
  section_coverage:    'Cobertura do diagnóstico',
  section_dims:        'Análise de dimensões',
  section_fragilities: 'Fragilidades estruturais',
  section_priorities:  'Prioridades estratégicas',
  section_action:      'Plano de ação',
  section_synthesis:   'Síntese final',
  section_method:      'Metodologia',
  no_narrative:        'Narrativa não disponível',
  no_data:             'Dados não disponíveis',
};