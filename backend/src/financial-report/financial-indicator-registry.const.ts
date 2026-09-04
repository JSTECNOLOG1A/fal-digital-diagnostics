/**
 * Registro de indicadores para o Relatório da Análise — porta literal (label
 * curto, formato, decimais, ordem, agrupamento) de
 * src/components/financial/indicators/financialIndicatorRegistry.js, a
 * mesma fonte que alimenta a tabela real de Histórico de indicadores
 * (FinancialIndicatorsHistory.jsx) — não uma tabela nova com formatos
 * inventados. Um indicador sem FinancialIndicatorSnapshot correspondente é
 * omitido do relatório (nunca mostrado como card vazio), mesma regra já
 * aplicada na tela (getGroupedIndicators/normalizeSnapshotsByIndicator).
 */
export type IndicatorFormat = 'number' | 'percent' | 'currency' | 'multiple' | 'days';
export type IndicatorGroup = 'liquidez' | 'endividamento' | 'rentabilidade' | 'eficiencia';

export interface IndicatorMeta {
  code: string;
  label: string;
  /** Nome por extenso (ex.: "Liquidez seca") — usado em texto corrido (tags de achado), nunca em cabeçalho de tabela (esses usam `label`, abreviado, para caber na régua fixa). */
  fullLabel: string;
  group: IndicatorGroup;
  format: IndicatorFormat;
  decimals: number;
  order: number;
}

export const INDICATOR_GROUP_LABELS: Record<IndicatorGroup, string> = {
  liquidez: 'Indicadores de liquidez',
  endividamento: 'Indicadores de endividamento',
  rentabilidade: 'Indicadores de rentabilidade',
  eficiencia: 'Indicadores de eficiência',
};

export const INDICATOR_REGISTRY: IndicatorMeta[] = [
  // ── Liquidez ─────────────────────────────────────────────────────────
  // Índices (formato "number") agrupados primeiro; valor monetário (CCL) por
  // último — não deve interromper a sequência de índices comparáveis.
  { code: 'liquidez_corrente', label: 'LIQ. CORRENTE', fullLabel: 'Liquidez corrente', group: 'liquidez', format: 'number', decimals: 2, order: 10 },
  { code: 'liquidez_seca', label: 'LIQ. SECA', fullLabel: 'Liquidez seca', group: 'liquidez', format: 'number', decimals: 2, order: 20 },
  { code: 'liquidez_imediata', label: 'LIQ. IMEDIATA', fullLabel: 'Liquidez imediata', group: 'liquidez', format: 'number', decimals: 2, order: 30 },
  { code: 'liquidez_geral', label: 'LIQ. GERAL', fullLabel: 'Liquidez geral', group: 'liquidez', format: 'number', decimals: 2, order: 40 },
  { code: 'capital_circulante_liquido', label: 'CAP. CIRC. LÍQ.', fullLabel: 'Capital circulante líquido', group: 'liquidez', format: 'currency', decimals: 2, order: 50 },

  // ── Endividamento ─────────────────────────────────────────────────────
  { code: 'divida_liquida_sobre_ebitda', label: 'DÍV. LÍQ. / EBITDA', fullLabel: 'Dívida líquida / EBITDA', group: 'endividamento', format: 'multiple', decimals: 2, order: 10 },
  { code: 'passivo_sobre_ativo', label: 'PASSIVO / ATIVO', fullLabel: 'Passivo / ativo', group: 'endividamento', format: 'number', decimals: 2, order: 20 },
  { code: 'capital_terceiros_sobre_pl', label: 'CAP. TERCEIROS / PL', fullLabel: 'Capital de terceiros / patrimônio líquido', group: 'endividamento', format: 'multiple', decimals: 2, order: 30 },
  { code: 'composicao_endividamento', label: 'COMP. DÍVIDA', fullLabel: 'Composição da dívida', group: 'endividamento', format: 'percent', decimals: 2, order: 40 },
  { code: 'divida_liquida', label: 'DÍVIDA LÍQUIDA', fullLabel: 'Dívida líquida', group: 'endividamento', format: 'currency', decimals: 2, order: 50 },

  // ── Rentabilidade ─────────────────────────────────────────────────────
  { code: 'margem_bruta', label: 'M. BRUTA', fullLabel: 'Margem bruta', group: 'rentabilidade', format: 'percent', decimals: 2, order: 10 },
  { code: 'margem_ebitda', label: 'M. EBITDA', fullLabel: 'Margem EBITDA', group: 'rentabilidade', format: 'percent', decimals: 2, order: 20 },
  { code: 'margem_ebit', label: 'M. EBIT', fullLabel: 'Margem EBIT', group: 'rentabilidade', format: 'percent', decimals: 2, order: 25 },
  { code: 'margem_liquida', label: 'M. LÍQUIDA', fullLabel: 'Margem líquida', group: 'rentabilidade', format: 'percent', decimals: 2, order: 30 },
  { code: 'roe', label: 'ROE', fullLabel: 'Retorno sobre patrimônio líquido', group: 'rentabilidade', format: 'percent', decimals: 2, order: 40 },
  { code: 'roa', label: 'ROA', fullLabel: 'Retorno sobre ativos', group: 'rentabilidade', format: 'percent', decimals: 2, order: 45 },
  { code: 'roic', label: 'ROIC', fullLabel: 'Retorno sobre capital investido', group: 'rentabilidade', format: 'percent', decimals: 2, order: 50 },

  // ── Eficiência ───────────────────────────────────────────────────────
  // Prazos em dias agrupados primeiro; % e múltiplo (formatos diferentes)
  // por último, mesmo critério aplicado em Liquidez.
  { code: 'prazo_medio_recebimento', label: 'PMR', fullLabel: 'Prazo médio de recebimento', group: 'eficiencia', format: 'days', decimals: 0, order: 10 },
  { code: 'prazo_medio_pagamento', label: 'PMP', fullLabel: 'Prazo médio de pagamento', group: 'eficiencia', format: 'days', decimals: 0, order: 20 },
  { code: 'prazo_medio_estoque', label: 'PME', fullLabel: 'Prazo médio de estoque', group: 'eficiencia', format: 'days', decimals: 0, order: 30 },
  { code: 'ciclo_operacional', label: 'CICLO OP.', fullLabel: 'Ciclo operacional', group: 'eficiencia', format: 'days', decimals: 0, order: 40 },
  { code: 'ciclo_financeiro', label: 'CICLO FIN.', fullLabel: 'Ciclo financeiro', group: 'eficiencia', format: 'days', decimals: 0, order: 50 },
  { code: 'crescimento_receita', label: 'CRESC. RECEITA', fullLabel: 'Crescimento de receita', group: 'eficiencia', format: 'percent', decimals: 2, order: 60 },
  { code: 'giro_ativo', label: 'GIRO ATIVO', fullLabel: 'Giro do ativo', group: 'eficiencia', format: 'number', decimals: 2, order: 70 },
];

export const KANITZ_COMPONENT_WEIGHTS: Record<string, { label: string; weight: number; indicatorCode: string }> = {
  kanitz_componente_rentabilidade_pl: { label: 'Rentabilidade do patrimônio líquido (RPL)', weight: 0.05, indicatorCode: 'kanitz_componente_rentabilidade_pl' },
  kanitz_componente_liquidez_geral: { label: 'Liquidez geral (LG)', weight: 1.65, indicatorCode: 'kanitz_componente_liquidez_geral' },
  kanitz_componente_liquidez_seca: { label: 'Liquidez seca (LS)', weight: 3.55, indicatorCode: 'kanitz_componente_liquidez_seca' },
  kanitz_componente_liquidez_corrente: { label: 'Liquidez corrente (LC)', weight: -1.06, indicatorCode: 'kanitz_componente_liquidez_corrente' },
  kanitz_componente_capital_terceiros_pl: { label: 'Capital de terceiros / PL (CT)', weight: -0.33, indicatorCode: 'kanitz_componente_capital_terceiros_pl' },
};

export const KANITZ_ZONE_THRESHOLDS = { insolvencia: -3, penumbra: 0 };

export function kanitzZone(fi: number | null): 'insolvencia' | 'penumbra' | 'solvencia' | null {
  if (fi === null) return null;
  if (fi < KANITZ_ZONE_THRESHOLDS.insolvencia) return 'insolvencia';
  if (fi < KANITZ_ZONE_THRESHOLDS.penumbra) return 'penumbra';
  return 'solvencia';
}

export const KANITZ_ZONE_LABELS: Record<'insolvencia' | 'penumbra' | 'solvencia', string> = {
  insolvencia: 'Zona de insolvência',
  penumbra: 'Zona de penumbra',
  solvencia: 'Zona de solvência',
};
