/**
 * financialConstants.js
 * Vocabulário canônico do módulo Diagnóstico Financeiro Inteligente V1.
 * FONTE DA VERDADE para todos os enums, labels, transições de estado
 * e severidades usados no frontend e backend.
 *
 * REGRA: qualquer adição de enum deve ser feita AQUI primeiro.
 */

// ─── STATUS DO DIAGNÓSTICO ────────────────────────────────────────────────────
export const DIAGNOSIS_STATUS = {
  DRAFT:              'draft',
  UPLOADED:           'uploaded',
  VALIDATING:         'validating',
  VALIDATION_FAILED:  'validation_failed',
  VALIDATED:          'validated',
  PREPARING:          'preparing',
  PREPARED:           'prepared',
  PROCESSING:         'processing',
  PROCESSED:          'processed',
  REVIEWED:           'reviewed',
  APPROVED:           'approved',
  ARCHIVED:           'archived',
};

export const DIAGNOSIS_STATUS_LABEL = {
  draft:              'Rascunho',
  uploaded:           'Arquivo Enviado',
  validating:         'Validando...',
  validation_failed:  'Validação com Erros',
  validated:          'Validado',
  preparing:          'Preparando Dataset...',
  prepared:           'Dataset Preparado',
  processing:         'Processando...',
  processed:          'Processado',
  reviewed:           'Revisado',
  approved:           'Aprovado',
  archived:           'Arquivado',
};

export const DIAGNOSIS_STATUS_CONFIG = {
  draft:              { label: 'Rascunho',              cls: 'bg-slate-100 text-slate-600' },
  uploaded:           { label: 'Arquivo Enviado',        cls: 'bg-blue-100 text-blue-700' },
  validating:         { label: 'Validando...',           cls: 'bg-amber-100 text-amber-700' },
  validation_failed:  { label: 'Validação com Erros',    cls: 'bg-red-100 text-red-700' },
  validated:          { label: 'Validado',               cls: 'bg-teal-100 text-teal-700' },
  preparing:          { label: 'Preparando Dataset...',    cls: 'bg-cyan-100 text-cyan-700' },
  prepared:           { label: 'Dataset Preparado',        cls: 'bg-sky-100 text-sky-700' },
  processing:         { label: 'Processando...',           cls: 'bg-purple-100 text-purple-700' },
  processed:          { label: 'Processado',             cls: 'bg-emerald-100 text-emerald-700' },
  reviewed:           { label: 'Revisado',               cls: 'bg-indigo-100 text-indigo-700' },
  approved:           { label: 'Aprovado',               cls: 'bg-green-100 text-green-700' },
  archived:           { label: 'Arquivado',              cls: 'bg-slate-100 text-slate-400' },
};

// Ordem canônica para cálculo de "status reached"
export const DIAGNOSIS_STATUS_ORDER = [
  'draft', 'uploaded', 'validating', 'validation_failed',
  'validated', 'preparing', 'prepared', 'processing', 'processed', 'reviewed', 'approved', 'archived',
];

// ─── TIPO DE ANÁLISE ─────────────────────────────────────────────────────────
// Fonte única de verdade para nomenclatura de analysis_type (Individual/Combinada/Consolidada).
// Nunca renderizar o enum cru na interface — usar sempre ANALYSIS_TYPE_CONFIG.
export const ANALYSIS_TYPE_CONFIG = {
  individual:   { label: 'Individual',  badge: 'INDIVIDUAL',  cls: 'bg-slate-700/60 border border-slate-500 text-slate-200' },
  combined:     { label: 'Combinada',   badge: 'COMBINADA',   cls: 'bg-teal-800/60 border border-teal-500 text-teal-200' },
  consolidated: { label: 'Consolidada', badge: 'CONSOLIDADA', cls: 'bg-purple-800/60 border border-purple-500 text-purple-200' },
};

export function diagnosisStatusReached(current, required) {
  if (!required) return true;
  // validation_failed deve permitir acesso à aba de validação (minStatus: 'uploaded')
  // mas não às abas que requerem 'processed'
  const order = DIAGNOSIS_STATUS_ORDER;
  const ci = order.indexOf(current);
  const ri = order.indexOf(required);
  if (ci < 0 || ri < 0) return false;
  // validation_failed (idx 3) é considerado >= uploaded (idx 1) e >= validating (idx 2)
  // mas não >= validated (idx 4) nem processed (idx 6)
  return ci >= ri;
}

// ─── STATUS DO UPLOAD ─────────────────────────────────────────────────────────
export const UPLOAD_STATUS = {
  PENDING:           'pending',
  READING:           'reading',
  VALIDATION_FAILED: 'validation_failed',
  VALIDATED:         'validated',
  PROCESSING:        'processing',
  PROCESSED:         'processed',
  ERROR:             'error',
};

export const UPLOAD_STATUS_LABEL = {
  pending:           'Aguardando',
  reading:           'Lendo arquivo...',
  validation_failed: 'Falha na validação',
  validated:         'Validado',
  processing:        'Processando...',
  processed:         'Processado',
  error:             'Erro',
};

export const UPLOAD_STATUS_CONFIG = {
  pending:           { label: 'Aguardando',          cls: 'bg-slate-100 text-slate-500' },
  reading:           { label: 'Lendo arquivo...',     cls: 'bg-blue-100 text-blue-600' },
  validation_failed: { label: 'Falha na validação',   cls: 'bg-red-100 text-red-700' },
  validated:         { label: 'Validado',             cls: 'bg-teal-100 text-teal-700' },
  processing:        { label: 'Processando...',       cls: 'bg-purple-100 text-purple-700' },
  processed:         { label: 'Processado',           cls: 'bg-emerald-100 text-emerald-700' },
  error:             { label: 'Erro',                 cls: 'bg-red-100 text-red-700' },
};

// ─── SEVERIDADE DA VALIDAÇÃO ──────────────────────────────────────────────────
export const VALIDATION_SEVERITY = {
  BLOQUEANTE:  'blocking',
  RESSALVA:    'warning',
  INFORMATIVA: 'info',
};

export const VALIDATION_SEVERITY_LABEL = {
  blocking: 'Bloqueante',
  warning:  'Ressalva',
  info:     'Informativa',
};

export const VALIDATION_SEVERITY_CONFIG = {
  blocking:  {
    label: 'Bloqueante',
    cls: 'bg-red-50 border-red-200 text-red-800',
    iconColor: 'text-red-600',
    badgeCls: 'bg-red-100 text-red-700',
  },
  warning: {
    label: 'Ressalva',
    cls: 'bg-amber-50 border-amber-200 text-amber-800',
    iconColor: 'text-amber-600',
    badgeCls: 'bg-amber-100 text-amber-700',
  },
  info: {
    label: 'Informativa',
    cls: 'bg-blue-50 border-blue-200 text-blue-800',
    iconColor: 'text-blue-600',
    badgeCls: 'bg-blue-100 text-blue-700',
  },
};

// ─── SEVERIDADE DO ALERTA ─────────────────────────────────────────────────────
export const ALERT_SEVERITY = {
  INFORMATIVO: 'informativo',
  ATENCAO:     'atencao',
  RELEVANTE:   'relevante',
  CRITICO:     'critico',
};

export const ALERT_SEVERITY_CONFIG = {
  informativo: { label: 'Informativo', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  atencao:     { label: 'Atenção',     cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  relevante:   { label: 'Relevante',   cls: 'bg-orange-50 border-orange-200 text-orange-700' },
  critico:     { label: 'Crítico',     cls: 'bg-red-50 border-red-200 text-red-700' },
};

// ─── NATUREZA DO ALERTA ───────────────────────────────────────────────────────
export const ALERT_NATURE = {
  PERFORMANCE:        'performance',
  LIQUIDEZ:           'liquidez',
  ENDIVIDAMENTO:      'endividamento',
  EFICIENCIA:         'eficiencia',
  CONSISTENCIA_DADOS: 'consistencia_dados',
};

export const ALERT_NATURE_LABEL = {
  performance:        'Performance',
  liquidez:           'Liquidez',
  endividamento:      'Endividamento',
  eficiencia:         'Eficiência',
  consistencia_dados: 'Consistência de Dados',
};

// ─── ABAS DO COCKPIT ──────────────────────────────────────────────────────────
export const COCKPIT_TABS = [
  { key: 'overview',    label: 'Visão Geral',   minStatus: null },
  { key: 'upload',      label: 'Upload',         minStatus: null },
  { key: 'validation',  label: 'Validação',      minStatus: 'uploaded' },
  { key: 'statements',  label: 'Demonstrativos',  minStatus: 'processed' },
  { key: 'indicators',  label: 'Indicadores',    minStatus: 'processed' },
  { key: 'alerts',      label: 'Alertas',        minStatus: 'processed' },
];

// ─── PERFIS DE CLIENTE ────────────────────────────────────────────────────────
export const CLIENT_PROFILES = [
  { value: 'holding',       label: 'Holding' },
  { value: 'fazenda',       label: 'Fazenda / Agropecuária' },
  { value: 'agroindustria', label: 'Agroindústria' },
  { value: 'revenda',       label: 'Revenda de Insumos' },
  { value: 'industria',     label: 'Indústria' },
  { value: 'servicos',      label: 'Serviços' },
  { value: 'outros',        label: 'Outros' },
];

export const CLIENT_PROFILE_LABEL = Object.fromEntries(
  CLIENT_PROFILES.map(p => [p.value, p.label])
);

// ─── SETORES ──────────────────────────────────────────────────────────────────
export const SECTORS = [
  'Agricultura', 'Pecuária', 'Agropecuária', 'Agroindústria',
  'Revenda de insumos', 'Indústria', 'Comércio', 'Serviços', 'Outro',
];

// ─── FAMÍLIAS DE DEMONSTRAÇÕES ────────────────────────────────────────────────
export const STATEMENT_FAMILY = {
  DRE:                'dre',
  BALANCE_SHEET:      'balance_sheet',
  CASH_FLOW:          'cash_flow',
  OPERATIONAL_SUPPORT:'operational_support',
};

export const STATEMENT_FAMILY_LABEL = {
  dre:                'DRE',
  balance_sheet:      'Balanço Patrimonial',
  cash_flow:          'Fluxo de Caixa',
  operational_support:'Suporte Operacional',
};

// ─── INDICADORES FINANCEIROS ──────────────────────────────────────────────────
export const INDICATOR_CODES = {
  MARGEM_OPERACIONAL:          'margem_ebitda',
  MARGEM_LIQUIDA:              'margem_liquida',
  LIQUIDEZ_CORRENTE:           'liquidez_corrente',
  LIQUIDEZ_SECA:               'liquidez_seca',
  LIQUIDEZ_IMEDIATA:           'liquidez_imediata',
  LIQUIDEZ_GERAL:              'liquidez_geral',
  DIVIDA_LIQUIDA_RO:           'divida_liquida_ebitda',
  CAPITAL_GIRO_LIQUIDO:        'capital_giro_liquido',
  GERACAO_CAIXA_OPERACIONAL:   'geracao_caixa_operacional',
  CRESCIMENTO_RECEITA:         'crescimento_receita',
};

// NOTA TÉCNICA: canonical_keys 'margem_ebitda' e 'divida_liquida_ebitda' mantidos por
// compatibilidade com dados já processados. O cálculo usa Resultado Operacional, não EBITDA real.
export const INDICATOR_LABEL = {
  // ── EBITDA Gerencial (via plano de contas) ────────────────────────────────────
  ebitda_comp_receita_bruta:            'Receita Bruta',
  ebitda_comp_deducoes_receita:         '(-) Deduções de Receita',
  ebitda_comp_custos:                   '(-) Custos',
  ebitda_comp_despesas_operacionais:    '(-) Despesas Operacionais',
  ebitda_comp_outras_receitas_despesas: '(+/-) Outras Receitas/Despesas',
  ebitda_gerencial_r:                   'EBITDA Gerencial',
  margem_ebitda_gerencial:              'Margem EBITDA Gerencial',
  // ── EBITDA build-up ──────────────────────────────────────────────────────────
  resultado_liquido_r:            'Lucro ou Prejuízo do Período',
  ir_csll_r:                      'IRPJ e CSLL',
  resultado_financeiro_r:         'Resultado Financeiro Líquido',
  depreciacao_r:                  'Depreciação e Amortização',
  ebitda_r:                       'EBITDA',
  margem_ebitda:                  'Margem EBITDA',
  // ── Eficiência ────────────────────────────────────────────────────────────────
  pmr:                            'Prazo Médio de Recebimento (dias)',
  pmp:                            'Prazo Médio de Pagamento (dias)',
  // ── Rentabilidade ─────────────────────────────────────────────────────────────
  margem_operacional:             'Margem Operacional',
  roic:                           'Retorno sobre Capital Investido (ROIC)',
  roa:                            'ROA (Retorno sobre Ativos)',
  roe:                            'ROE (Retorno sobre Patrimônio)',
  margem_bruta:                   'Margem Bruta',
  margem_liquida:                 'Margem Líquida',
  // ── Liquidez ──────────────────────────────────────────────────────────────────
  liquidez_corrente:              'Liquidez Corrente',
  liquidez_seca:                  'Liquidez Seca',
  liquidez_imediata:              'Liquidez Imediata',
  liquidez_geral:                 'Liquidez Geral',
  // ── Solvência ─────────────────────────────────────────────────────────────────
  imobilizacao_pl:                'Imobilização do Patrimônio Líquido',
  divida_liquida_ebitda:          'Razão da Dívida / EBITDA',
  participacao_capital_terceiros: 'Participação de Capital de Terceiros',
  cobertura_juros:                'Índice de Cobertura de Juros',
  endividamento_geral:            'Endividamento Geral',
  composicao_endividamento:       'Composição do Endividamento',
  rentabilidade_patrimonio_liquido: 'Rentabilidade do Patrimônio Líquido',
  kanitz_fator_insolvencia:       'Fator de Insolvência de Kanitz',
  // ── Outros (compat) ───────────────────────────────────────────────────────────
  capital_giro_liquido:           'Capital de Giro Líquido',
  geracao_caixa_operacional:      'Resultado Operacional (Geração)',
  crescimento_receita:            'Crescimento de Receita',
};

// Família de cada indicador — para agrupamento visual na tabela
export const INDICATOR_FAMILY_LABEL = {
  ebitda_gerencial:     'EBITDA Gerencial (Plano de Contas)',
  eficiencia:           'Índices de Eficiência',
  rentabilidade:        'Índices de Rentabilidade (com EBITDA build-up)',
  liquidez:             'Índices de Liquidez',
  endividamento_indices:'Índices de Endividamento',
  solvencia:            'Índices de Solvência',
  // compat
  endividamento:        'Endividamento',
  capital_giro:         'Capital de Giro',
  geracao_caixa:        'Geração de Caixa',
  crescimento:          'Crescimento',
};

// Mapa canônico: indicator_code → family (fonte da verdade para o frontend)
export const INDICATOR_FAMILY_MAP = {
  // EBITDA Gerencial
  ebitda_comp_receita_bruta:            'ebitda_gerencial',
  ebitda_comp_deducoes_receita:         'ebitda_gerencial',
  ebitda_comp_custos:                   'ebitda_gerencial',
  ebitda_comp_despesas_operacionais:    'ebitda_gerencial',
  ebitda_comp_outras_receitas_despesas: 'ebitda_gerencial',
  ebitda_gerencial_r:                   'ebitda_gerencial',
  margem_ebitda_gerencial:              'ebitda_gerencial',
  // EBITDA build-up
  ebitda_r:                       'rentabilidade',
  margem_ebitda:                  'rentabilidade',

  // Eficiência
  pmr:                            'eficiencia',
  pmp:                            'eficiencia',
  crescimento_receita:            'eficiencia',
  // Rentabilidade
  margem_operacional:             'rentabilidade',
  roic:                           'rentabilidade',
  roa:                            'rentabilidade',
  roe:                            'rentabilidade',
  margem_bruta:                   'rentabilidade',
  margem_liquida:                 'rentabilidade',
  // Liquidez
  liquidez_corrente:              'liquidez',
  liquidez_seca:                  'liquidez',
  liquidez_imediata:              'liquidez',
  liquidez_geral:                 'liquidez',
  // Endividamento
  endividamento_geral:            'endividamento_indices',
  composicao_endividamento:       'endividamento_indices',
  imobilizacao_pl:                'endividamento_indices',
  cobertura_juros:                'endividamento_indices',
  divida_liquida_ebitda:          'endividamento_indices',
  capital_giro_liquido:           'endividamento_indices',
  participacao_capital_terceiros: 'endividamento_indices',
  rentabilidade_patrimonio_liquido: 'solvencia',
  kanitz_fator_insolvencia:       'solvencia',
  // Outros
  geracao_caixa_operacional:      'outros',
  resultado_liquido_r:            'rentabilidade',
  ir_csll_r:                      'rentabilidade',
  resultado_financeiro_r:         'rentabilidade',
  depreciacao_r:                  'rentabilidade',
};

// Ordem de exibição canônica — espelha a estrutura do Excel
export const INDICATOR_DISPLAY_ORDER = [
  // EBITDA Gerencial (via plano de contas)
  'ebitda_comp_receita_bruta', 'ebitda_comp_deducoes_receita', 'ebitda_comp_custos',
  'ebitda_comp_despesas_operacionais', 'ebitda_comp_outras_receitas_despesas',
  'ebitda_gerencial_r', 'margem_ebitda_gerencial',
  // Eficiência
  'pmr', 'pmp', 'crescimento_receita',
  // Rentabilidade + EBITDA
  'margem_operacional', 'roic', 'roa', 'roe', 'margem_bruta', 'margem_liquida',
  'resultado_liquido_r', 'ir_csll_r', 'resultado_financeiro_r', 'depreciacao_r', 'ebitda_r', 'margem_ebitda',
  // Liquidez
  'liquidez_corrente', 'liquidez_seca', 'liquidez_imediata', 'liquidez_geral',
  // Endividamento
  'endividamento_geral', 'composicao_endividamento', 'imobilizacao_pl', 'cobertura_juros', 'divida_liquida_ebitda', 'capital_giro_liquido', 'participacao_capital_terceiros',
  // Solvência (Kanitz)
  'rentabilidade_patrimonio_liquido', 'kanitz_fator_insolvencia',
  // Outros
];

// ─── ESCOPO ───────────────────────────────────────────────────────────────────
export const SCOPE_LEVEL_LABEL = {
  group:   'Grupo',
  company: 'Empresa',
  unit:    'Unidade',
};

// ─── ESTRUTURA CANÔNICA DO BALANÇO PATRIMONIAL ────────────────────────────────

export const BP_GROUPS = [
  { key: 'Ativo circulante',       side: 'ativo',   label: 'Ativo circulante',       display_order: 10 },
  { key: 'Ativo não circulante',   side: 'ativo',   label: 'Ativo não circulante',   display_order: 20 },
  { key: 'Passivo circulante',     side: 'passivo', label: 'Passivo circulante',      display_order: 30 },
  { key: 'Passivo não circulante', side: 'passivo', label: 'Passivo não circulante',  display_order: 40 },
  { key: 'Patrimônio líquido',     side: 'passivo', label: 'Patrimônio líquido',      display_order: 50 },
];

// BP_RUBRICS — espelha exatamente CANONICAL_RUBRIC_LABEL e CANONICAL_META do backend.
// REGRA: qualquer novo canonical_key do BP deve entrar aqui E no backend simultaneamente.
export const BP_RUBRICS = {
  'Ativo circulante': [
    { canonical_key: 'ativo_circulante_caixa',         rubric_label: 'Caixa e equivalentes de caixa', display_order: 10 },
    { canonical_key: 'ativo_circulante_receber',        rubric_label: 'Contas a receber',              display_order: 20 },
    { canonical_key: 'ativo_circulante_estoques',       rubric_label: 'Estoques',                      display_order: 30 },
    { canonical_key: 'ativo_circulante_impostos',       rubric_label: 'Impostos a recuperar',          display_order: 40 },
    { canonical_key: 'ativo_circulante_biologicos',     rubric_label: 'Ativos biológicos',             display_order: 50 },
    // aliases que o backend pode gerar para biológicos (variação de nomenclatura do Excel)
    { canonical_key: 'ativo_biologico',                 rubric_label: 'Ativos biológicos',             display_order: 50 },
    { canonical_key: 'ativo_circulante_outros',         rubric_label: 'Outros créditos',               display_order: 60 },
  ],
  'Ativo não circulante': [
    { canonical_key: 'ativo_nc_aplicacoes',             rubric_label: 'Aplicações financeiras',        display_order: 10 },
    { canonical_key: 'ativo_nc_receber_lp',             rubric_label: 'Contas a receber LP',           display_order: 20 },
    { canonical_key: 'ativo_nc_impostos_lp',            rubric_label: 'Impostos a recuperar LP',       display_order: 30 },
    { canonical_key: 'ativo_nc_impostos_diferidos',     rubric_label: 'Impostos diferidos',            display_order: 40 },
    { canonical_key: 'ativo_nc_outros_creditos',        rubric_label: 'Outros créditos LP',            display_order: 50 },
    { canonical_key: 'ativo_nc_investimentos',          rubric_label: 'Investimentos',                 display_order: 60 },
    { canonical_key: 'ativo_nc_direitos_uso',           rubric_label: 'Direitos de uso',               display_order: 70 },
    { canonical_key: 'ativo_nao_circulante',            rubric_label: 'Imobilizado',                   display_order: 80 },
    { canonical_key: 'ativo_nc_intangivel',             rubric_label: 'Intangível',                    display_order: 90 },
  ],
  'Passivo circulante': [
    { canonical_key: 'passivo_circulante_trabalhistas',  rubric_label: 'Obrigações trabalhistas',      display_order: 10 },
    { canonical_key: 'passivo_circulante_fiscais',       rubric_label: 'Obrigações fiscais',           display_order: 20 },
    // aliases gerados pelo backend para obrigações fiscais/tributárias
    { canonical_key: 'obrigacoes_tributarias',           rubric_label: 'Obrigações tributárias',       display_order: 22 },
    { canonical_key: 'passivo_circulante_fornecedores',  rubric_label: 'Fornecedores',                 display_order: 30 },
    // alias direto gerado quando classification = "Fornecedores" sem alias match
    { canonical_key: 'fornecedores',                     rubric_label: 'Fornecedores',                 display_order: 32 },
    { canonical_key: 'passivo_circulante_emprestimos',   rubric_label: 'Empréstimos e financiamentos', display_order: 40 },
    { canonical_key: 'passivo_circulante_imoveis',       rubric_label: 'Obrig. por aquisição de imóveis', display_order: 50 },
    { canonical_key: 'passivo_circulante_arrendamentos', rubric_label: 'Arrendamentos a pagar',        display_order: 60 },
    { canonical_key: 'passivo_circulante_adiantamentos', rubric_label: 'Adiantamentos de clientes',    display_order: 70 },
    { canonical_key: 'passivo_circulante_outros',        rubric_label: 'Outras contas a pagar',        display_order: 80 },
  ],
  'Passivo não circulante': [
    { canonical_key: 'passivo_nao_circulante',           rubric_label: 'Empréstimos e financiamentos LP',   display_order: 10 },
    { canonical_key: 'passivo_nc_imoveis_lp',            rubric_label: 'Obrig. por aquisição de imóveis LP', display_order: 20 },
    { canonical_key: 'passivo_nc_arrendamentos_lp',      rubric_label: 'Arrendamentos a pagar LP',           display_order: 30 },
  ],
  'Patrimônio líquido': [
    { canonical_key: 'patrimonio_capital',               rubric_label: 'Capital social',               display_order: 10 },
    { canonical_key: 'patrimonio_reservas',              rubric_label: 'Reservas',                     display_order: 20 },
    { canonical_key: 'patrimonio_reservas_fiscais',      rubric_label: 'Reserva de incentivos fiscais', display_order: 30 },
    { canonical_key: 'patrimonio_liquido',               rubric_label: 'Lucros acumulados',            display_order: 40 },
    { canonical_key: 'patrimonio_prejuizos',             rubric_label: 'Prejuízos acumulados',         display_order: 50 },
    // aliases gerados pelo backend para variações de nomenclatura de lucros/prejuízos
    { canonical_key: 'lucros_(prejuizos)_acumulados',    rubric_label: 'Lucros (prejuízos) acumulados', display_order: 55 },
    { canonical_key: 'resultado_do_exercicio',           rubric_label: 'Resultado do exercício',        display_order: 45 },
    { canonical_key: 'lucro_do_exercicio',               rubric_label: 'Lucro do exercício',            display_order: 45 },
    { canonical_key: 'prejuizo_do_exercicio',            rubric_label: 'Prejuízo do exercício',         display_order: 55 },
    // alias genérico de custo no PL (erro de classificação — aparece aqui para não sumir)
    { canonical_key: 'custo',                            rubric_label: '(-) Custo (reclassificar)',     display_order: 99 },
  ],
};

export const BP_TOTALS = [
  { canonical_key: 'total_ativo',      rubric_label: 'Total do ativo',                      side: 'ativo'   },
  { canonical_key: 'total_passivo_pl', rubric_label: 'Total passivo e patrimônio líquido',  side: 'passivo' },
];

// Mapa flat canonical_key → { group, rubric_label, display_order } para lookup rápido
export const BP_DISPLAY_ORDER = Object.entries(BP_RUBRICS).flatMap(([group, rubrics]) =>
  rubrics.map(r => ({ ...r, group }))
);

// ─── ESTRUTURA CANÔNICA DA DRE ────────────────────────────────────────────────
// Estrutura: Receita → Custo → Despesas Operacionais → Resultado Financeiro → Impostos
// Totalizadores: Receita Líquida | Lucro Bruto | Resultado Operacional |
//                Resultado Financeiro Líquido | Resultado Antes do IR | Resultado Líquido

export const DRE_GROUPS = [
  { key: 'Receita',               label: 'Receita líquida',       display_order: 10 },
  { key: 'Custo',                 label: 'Custo',                 display_order: 20 },
  { key: 'Despesas operacionais', label: 'Despesas operacionais', display_order: 30 },
  { key: 'Resultado financeiro',  label: 'Resultado financeiro',  display_order: 40 },
  { key: 'Impostos',              label: 'Impostos sobre o lucro',display_order: 50 },
];

export const DRE_RUBRICS = [
  // ── Receita ──────────────────────────────────────────────────────────────────
  { canonical_key: 'receita_bruta',           rubric_label: 'Receita bruta',                        group: 'Receita',               display_order: 10 },
  { canonical_key: 'deducoes_tributarias',    rubric_label: '(-) Deduções tributárias',             group: 'Receita',               display_order: 20 },
  { canonical_key: 'devolucoes_abatimentos',  rubric_label: '(-) Devoluções e abatimentos',         group: 'Receita',               display_order: 30 },
  // ── Custo ────────────────────────────────────────────────────────────────────
  { canonical_key: 'custo_produtos',          rubric_label: '(-) Custo',                            group: 'Custo',                 display_order: 10 },
  // ── Despesas Operacionais ────────────────────────────────────────────────────
  { canonical_key: 'despesas_gerais_admin',   rubric_label: '(-) Gerais e administrativas',         group: 'Despesas operacionais', display_order: 10 },
  { canonical_key: 'despesas_comerciais',     rubric_label: '(-) Comerciais',                       group: 'Despesas operacionais', display_order: 20 },
  { canonical_key: 'outras_receitas_despesas',rubric_label: '(+/-) Outras receitas e despesas',     group: 'Despesas operacionais', display_order: 30 },
  // ── Resultado Financeiro ─────────────────────────────────────────────────────
  { canonical_key: 'receitas_financeiras',    rubric_label: '(+) Receitas financeiras',             group: 'Resultado financeiro',  display_order: 10 },
  { canonical_key: 'despesas_financeiras',    rubric_label: '(-) Despesas financeiras',             group: 'Resultado financeiro',  display_order: 20 },
  // ── Impostos ─────────────────────────────────────────────────────────────────
  { canonical_key: 'ir_csll',                 rubric_label: '(-) Imposto de renda e CSLL — correntes', group: 'Impostos',          display_order: 10 },
  { canonical_key: 'ir_diferido',             rubric_label: '(-) Imposto de renda e CSLL — diferidos', group: 'Impostos',          display_order: 20 },
];

// Totalizadores calculados — aparecem APÓS cada grupo
export const DRE_FORMULAS = [
  {
    canonical_key:  'receita_liquida',
    rubric_label:   'Receita líquida',
    group:          'Receita',
    line_type:      'calculated',
    display_order:  200,
    formula_desc:   'Receita Bruta - Deduções Tributárias - Devoluções e Abatimentos',
  },
  {
    canonical_key:  'lucro_bruto',
    rubric_label:   'Lucro bruto',
    group:          'Custo',
    line_type:      'calculated',
    display_order:  200,
    formula_desc:   'Receita Líquida - Custo',
  },
  {
    canonical_key:  'resultado_operacional',
    rubric_label:   'Resultado operacional',
    group:          'Despesas operacionais',
    line_type:      'calculated',
    display_order:  200,
    formula_desc:   'Lucro Bruto - Gerais e Admin. - Comerciais +/- Outras Receitas/Despesas',
  },
  {
    canonical_key:  'resultado_financeiro_liquido',
    rubric_label:   'Resultado financeiro líquido',
    group:          'Resultado financeiro',
    line_type:      'calculated',
    display_order:  200,
    formula_desc:   'Receitas Financeiras - Despesas Financeiras',
  },
  {
    canonical_key:  'resultado_antes_ir',
    rubric_label:   'Resultado antes dos impostos sobre o lucro',
    group:          'Resultado financeiro',
    line_type:      'calculated',
    display_order:  300,
    formula_desc:   'Resultado Operacional + Resultado Financeiro Líquido',
  },
  {
    canonical_key:  'resultado_liquido',
    rubric_label:   'Resultado líquido do exercício',
    group:          'Impostos',
    line_type:      'total',
    display_order:  999,
    formula_desc:   'Resultado Antes dos Impostos - IR/CSLL Correntes - IR/CSLL Diferidos',
  },
];

// Mapa: group → canonical_keys dos totalizadores calculados que aparecem após o grupo
// (múltiplos por grupo possível — ex: Resultado financeiro tem 2 totalizadores)
export const DRE_CALCULATED_AFTER_GROUP = {
  'Receita':               ['receita_liquida'],
  'Custo':                 ['lucro_bruto'],
  'Despesas operacionais': ['resultado_operacional'],
  'Resultado financeiro':  ['resultado_financeiro_liquido', 'resultado_antes_ir'],
  'Impostos':              ['resultado_liquido'],
};

export const DRE_DISPLAY_ORDER = DRE_RUBRICS.map(r => ({ ...r }));

// ─── MENSAGENS PADRÃO ─────────────────────────────────────────────────────────
export const MESSAGES = {
  uploadSuccess:       'Arquivo enviado. Iniciando validação automática...',
  validationPending:   'Aguardando resultado da validação...',
  validationOk:        'Arquivo validado com sucesso. Pronto para processamento.',
  validationFailed:    'O arquivo apresentou erros de validação. Corrija e reenvie.',
  processingStarted:   'Processamento iniciado. Isso pode levar alguns minutos.',
  processingDone:      'Processamento concluído. Resultados disponíveis.',
  noDataYet:           'Dados ainda não disponíveis para este estágio.',
  lockedSection:       'Disponível após o processamento do balancete.',
};