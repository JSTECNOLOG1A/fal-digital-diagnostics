/**
 * Formatação numérica padrão pt-BR para o Relatório da Análise (spec seção
 * 8 "Formatação dos valores") — usada tanto pelo motor de achados
 * (financial-insight.service.ts, citação numérica obrigatória) quanto pela
 * montagem de narrativa do relatório (financial-report-data.service.ts).
 */
import { INDICATOR_REGISTRY, KANITZ_COMPONENT_WEIGHTS } from './financial-indicator-registry.const';

/** R$ 1.250.000,00 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'não disponível';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(value);
}

/** R$ 12,5 milhões — escala resumida para valores grandes, usada na narrativa. */
export function formatCurrencyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'não disponível';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bilhões`;
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} milhões`;
  return formatCurrency(value);
}

/** 15,4% */
export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'não disponível';
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}%`;
}

/** 1,32x */
export function formatMultiple(value: number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'não disponível';
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}x`;
}

/** 48 dias */
export function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'não disponível';
  const rounded = Math.round(value);
  return `${rounded} dia${Math.abs(rounded) === 1 ? '' : 's'}`;
}

/** 2,6% */
export function formatPercentagePoints(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'não disponível';
  const abs = Math.abs(value);
  return `${abs.toLocaleString('pt-BR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}%`;
}

/**
 * "2,60" / "+2,60" / "-0,33" — Fator de Insolvência de Kanitz em formato
 * pt-BR (vírgula decimal). `.toFixed(2)` puro (JS) produz "2.60" com ponto —
 * bug real visto em produção; withSign replica o "+..." que o cartão de
 * zona (kanitzZoneInfo) já usava para valores positivos.
 */
export function formatKanitzFi(value: number | null | undefined, withSign = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const formatted = Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value < 0) return `-${formatted}`;
  return withSign ? `+${formatted}` : formatted;
}

/** Variação relativa entre dois valores, em % (null se base for 0/indisponível). */
export function relativeVariation(previous: number | null, current: number | null): number | null {
  if (previous === null || current === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type IndicatorFormatKind = 'number' | 'percent' | 'currency' | 'multiple' | 'days';

/**
 * Formatação por tipo — mesma lógica de formatIndicatorValue em
 * src/components/financial/indicators/financialIndicatorUtils.js (fonte
 * única de verdade: format/decimals vêm do registro real, não de um mapa
 * separado inventado aqui).
 */
export function formatValueByKind(kind: IndicatorFormatKind, value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'não disponível';
  switch (kind) {
    case 'percent': return formatPercent(value * 100, decimals);
    case 'currency': return formatCurrency(value);
    case 'multiple': return formatMultiple(value, decimals);
    case 'days': return formatDays(value);
    default: return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
}

/**
 * Formata um indicador pelo seu código, consultando o registro real
 * (financial-indicator-registry.const.ts — a mesma fonte que
 * financialIndicatorRegistry.js no frontend) em vez de um mapa duplicado.
 * kanitz_fator_insolvencia não está no registro de indicadores "normais"
 * (tem seção própria no relatório) — cai no default "number,2", que é
 * exatamente a formatação que ele já usava.
 */
export function formatIndicatorValue(indicatorCode: string, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'não disponível';
  const meta = INDICATOR_REGISTRY.find((m) => m.code === indicatorCode);
  if (!meta) return formatValueByKind('number', value, 2);
  return formatValueByKind(meta.format, value, meta.decimals);
}

/**
 * Nome por extenso de um indicador a partir do código técnico (ex.:
 * "liquidez_seca" → "Liquidez seca") — para uso em texto corrido/tags de
 * achado, nunca o código cru (bug real corrigido: financial-report-html.
 * service.ts imprimia `f.financialIndicator` direto, tipo "liquidez_seca",
 * numa tag de achado no PDF do cliente).
 */
export function indicatorFullLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === 'kanitz_fator_insolvencia') return 'Fator de Insolvência de Kanitz';
  const meta = INDICATOR_REGISTRY.find((m) => m.code === code);
  if (meta) return meta.fullLabel;
  const kanitzComponent = KANITZ_COMPONENT_WEIGHTS[code];
  if (kanitzComponent) return kanitzComponent.label;
  return code;
}

const MONTH_NAMES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * "31 de dezembro de 2025" a partir de um período anual (ano puro, ex: "2025")
 * e do mês de fechamento fiscal (1-12, default dezembro/calendário civil).
 * Só aplica quando o período é reconhecível como ano puro — qualquer outro
 * formato (ex: já vier com mês) é devolvido sem alteração pelo chamador.
 */
export function formatAnnualPeriodLabel(yearStr: string, fiscalCloseMonth = 12): string {
  const year = parseInt(yearStr, 10);
  if (!Number.isFinite(year) || !/^\d{4}$/.test(yearStr)) return yearStr;
  const month = fiscalCloseMonth >= 1 && fiscalCloseMonth <= 12 ? fiscalCloseMonth : 12;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${lastDay} de ${MONTH_NAMES_PT[month - 1]} de ${year}`;
}

/** Terminologia de data-base por demonstração/periodicidade (spec seção 1). */
export function statementDateLabel(
  statementCode: 'BP' | 'DRE' | 'DFC',
  periodEndLabel: string,
  periodicidade?: string | null,
): string {
  if (statementCode === 'BP') return `Posição patrimonial em ${periodEndLabel}`;
  const isAnnual = !periodicidade || periodicidade === 'annual' || periodicidade === 'anual';
  if (isAnnual) return `Exercício findo em ${periodEndLabel}`;
  const monthsLabel = periodicidade === 'quarterly' || periodicidade === 'trimestral' ? 'três meses' : periodicidade === 'monthly' || periodicidade === 'mensal' ? 'um mês' : 'período';
  return `Período de ${monthsLabel} findo em ${periodEndLabel}`;
}
