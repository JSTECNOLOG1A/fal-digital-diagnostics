/**
 * Motor de detecção de achados financeiros — porta de
 * base44/functions/generateFinancialInterpretations/entry.ts (limiares,
 * regras de deterioração e óticas de achado idênticos ao original), com um
 * enriquecimento: o texto de cada achado agora cita os valores numéricos
 * reais (atual/comparativo/variação), exigência da spec do Relatório da
 * Análise (seção 5, "regra obrigatória de fundamentação numérica") que o
 * original não cumpria — lá o título de um achado comparativo citava só os
 * PERÍODOS ("de 2024 para 2025"), nunca os valores.
 *
 * PL negativo e ausência de DFC são detectados diretamente dos dados (valor
 * de patrimônio líquido / presença de linhas DFC), em vez de depender de
 * códigos de FinancialValidationResult (KANITZ_PL_NON_POSITIVE,
 * DFC_REQUIRES_TWO_PERIODS) que não existem na porta local do motor de
 * validação — checagem mais robusta e autocontida.
 */
import { formatCurrencyCompact, formatIndicatorValue, formatPercentagePoints } from './financial-report-formatting.util';

export interface IndicatorRow {
  indicatorCode: string;
  period: string;
  value: number | null;
}

export interface StatementRow {
  canonicalKey: string;
  statementCode: string;
  period: string;
  value: number;
}

export interface DetectedFinding {
  findingType: string;
  period: string | null;
  comparisonPeriod?: string | null;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  financialIndicator?: string | null;
  sourceRefId?: string | null;
  confidenceLevelOverride?: 'low' | 'medium' | 'high';
  findingScope: 'period_snapshot' | 'period_comparison' | 'structural_validation';
  sourceType: 'financial_indicator' | 'financial_validation' | 'financial_statement' | 'dfc' | 'kanitz' | 'cross_statement';
  evidenceNumeric: Array<{ label: string; value: string; period?: string }>;
}

function getIndicatorValue(indicators: IndicatorRow[], code: string, period: string): number | null {
  return indicators.find((i) => i.indicatorCode === code && i.period === period)?.value ?? null;
}

function getStatementValue(lines: StatementRow[], canonicalKey: string, period: string): number | null {
  return lines.find((l) => l.canonicalKey === canonicalKey && l.period === period)?.value ?? null;
}

const HIGHER_IS_BETTER = new Set([
  'liquidez_corrente', 'liquidez_seca', 'liquidez_geral', 'divida_liquida_sobre_ebitda_inverso',
  'margem_liquida', 'roe', 'resultado_liquido', 'patrimonio_liquido',
]);
const LOWER_IS_BETTER = new Set(['capital_terceiros_sobre_pl', 'passivo_sobre_ativo']);

function isDeterioration(code: string, previousValue: number, currentValue: number): boolean {
  if (HIGHER_IS_BETTER.has(code)) return currentValue < previousValue;
  if (LOWER_IS_BETTER.has(code)) return currentValue > previousValue;
  return false;
}

function crossedCriticalBand(code: string, previousValue: number, currentValue: number): boolean {
  switch (code) {
    case 'liquidez_corrente': return previousValue >= 1 && currentValue < 1;
    case 'liquidez_seca': return previousValue >= 0.8 && currentValue < 0.8;
    case 'resultado_liquido': return previousValue >= 0 && currentValue < 0;
    case 'patrimonio_liquido': return previousValue >= 0 && currentValue < 0;
    default: return false;
  }
}

interface ComparisonMetric {
  code: string;
  source: 'indicator' | 'statement';
  canonicalKey?: string;
  sourceType: DetectedFinding['sourceType'];
  label: string;
  buildTitle: (previousLabel: string, currentLabel: string, deltaPercent: string) => string;
  buildDescription: (previousLabel: string, currentLabel: string, deltaPercent: string) => string;
}

const COMPARISON_METRICS: ComparisonMetric[] = [
  {
    code: 'liquidez_corrente', source: 'indicator', sourceType: 'financial_indicator', label: 'Liquidez corrente',
    buildTitle: (p, c) => `Liquidez corrente deteriorou de ${p} para ${c}`,
    buildDescription: (p, c, d) => `A liquidez corrente recuou de ${p} para ${c} (variação de ${d}), indicando redução da capacidade relativa de cobertura das obrigações de curto prazo.`,
  },
  {
    code: 'liquidez_seca', source: 'indicator', sourceType: 'financial_indicator', label: 'Liquidez seca',
    buildTitle: (p, c) => `Liquidez seca deteriorou de ${p} para ${c}`,
    buildDescription: (p, c, d) => `A liquidez seca recuou de ${p} para ${c} (variação de ${d}), indicando maior pressão sobre a capacidade de pagamento de curto prazo sem depender da realização de estoques.`,
  },
  {
    code: 'capital_terceiros_sobre_pl', source: 'indicator', sourceType: 'financial_indicator', label: 'Capital de terceiros / PL',
    buildTitle: (p, c) => `Dependência de capital de terceiros aumentou de ${p} para ${c}`,
    buildDescription: (p, c, d) => `A relação capital de terceiros/patrimônio líquido subiu de ${p} para ${c} (variação de ${d}), indicando maior pressão da estrutura de passivos sobre o patrimônio líquido.`,
  },
  {
    code: 'patrimonio_liquido', source: 'statement', canonicalKey: 'total_patrimonio_liquido', sourceType: 'financial_statement', label: 'Patrimônio líquido',
    buildTitle: (p, c) => `Patrimônio líquido deteriorou de ${p} para ${c}`,
    buildDescription: (p, c) => `O patrimônio líquido variou de ${p} para ${c} entre os períodos, reforçando fragilidade patrimonial e a necessidade de análise de recomposição de capital.`,
  },
  {
    code: 'resultado_liquido', source: 'statement', canonicalKey: 'resultado_liquido', sourceType: 'financial_statement', label: 'Resultado líquido',
    buildTitle: (p, c) => `Resultado líquido deteriorou de ${p} para ${c}`,
    buildDescription: (p, c) => `O resultado líquido variou de ${p} para ${c} entre os períodos, pressionando patrimônio líquido, capacidade de autofinanciamento e indicadores de solvência.`,
  },
];

/** Achados dependentes de um único período (period_snapshot / structural_validation). */
export function detectSnapshotFindings(
  indicators: IndicatorRow[],
  statementLines: StatementRow[],
  periods: string[],
): DetectedFinding[] {
  const findings: DetectedFinding[] = [];

  for (const period of periods) {
    const pl = getStatementValue(statementLines, 'total_patrimonio_liquido', period);
    const plNonPositive = pl !== null && pl <= 0;

    const liquidezCorrente = getIndicatorValue(indicators, 'liquidez_corrente', period);
    if (liquidezCorrente !== null && liquidezCorrente < 1) {
      findings.push({
        findingType: 'liquidez_corrente_baixa', period, findingScope: 'period_snapshot', sourceType: 'financial_indicator',
        financialIndicator: 'liquidez_corrente', severity: 'medium',
        title: `Liquidez corrente abaixo de 1,0x em ${period}`,
        description: `Em ${period}, a liquidez corrente foi de ${formatIndicatorValue('liquidez_corrente', liquidezCorrente)}, abaixo do referencial de 1,0x — a empresa não apresenta ativos circulantes suficientes para cobrir integralmente as obrigações de curto prazo no período analisado.`,
        evidenceNumeric: [{ label: 'Liquidez corrente', value: formatIndicatorValue('liquidez_corrente', liquidezCorrente), period }],
      });
    }

    const liquidezSeca = getIndicatorValue(indicators, 'liquidez_seca', period);
    if (liquidezSeca !== null && liquidezSeca < 0.8) {
      findings.push({
        findingType: 'liquidez_seca_critica', period, findingScope: 'period_snapshot', sourceType: 'financial_indicator',
        financialIndicator: 'liquidez_seca', severity: 'medium',
        title: `Liquidez seca pressionada em ${period}`,
        description: `Em ${period}, a liquidez seca foi de ${formatIndicatorValue('liquidez_seca', liquidezSeca)}, indicando dependência de realização de estoques ou renegociação de passivos para cobertura de curto prazo.`,
        evidenceNumeric: [{ label: 'Liquidez seca', value: formatIndicatorValue('liquidez_seca', liquidezSeca), period }],
      });
    }

    const ctpl = getIndicatorValue(indicators, 'capital_terceiros_sobre_pl', period);
    if (ctpl !== null && ctpl > 2) {
      const lowConfidenceNote = plNonPositive ? ' Atenção: o patrimônio líquido negativo neste período reduz a confiabilidade desta leitura.' : '';
      findings.push({
        findingType: 'endividamento_elevado', period, findingScope: 'period_snapshot', sourceType: 'financial_indicator',
        financialIndicator: 'capital_terceiros_sobre_pl', severity: 'high', confidenceLevelOverride: plNonPositive ? 'low' : 'medium',
        title: `Alta participação de capital de terceiros em ${period}`,
        description: `Em ${period}, a relação capital de terceiros/patrimônio líquido foi de ${formatIndicatorValue('capital_terceiros_sobre_pl', ctpl)}, evidenciando elevada dependência de capital de terceiros em relação ao patrimônio líquido.${lowConfidenceNote}`,
        evidenceNumeric: [{ label: 'Capital de terceiros / PL', value: formatIndicatorValue('capital_terceiros_sobre_pl', ctpl), period }],
      });
    }

    if (plNonPositive) {
      findings.push({
        findingType: 'pl_negativo', period, findingScope: 'structural_validation', sourceType: 'financial_validation',
        severity: 'high', confidenceLevelOverride: 'high',
        title: `Patrimônio líquido negativo em ${period} prejudica leitura de solvência`,
        description: `Em ${period}, o patrimônio líquido foi de ${formatCurrencyCompact(pl)}. O patrimônio líquido negativo reduz a confiabilidade da leitura convencional dos indicadores de solvência e exige análise específica da composição do passivo, prejuízos acumulados e capacidade de geração de caixa.`,
        evidenceNumeric: [{ label: 'Patrimônio líquido', value: formatCurrencyCompact(pl), period }],
      });
    }

    const kanitzFI = getIndicatorValue(indicators, 'kanitz_fator_insolvencia', period);
    if (kanitzFI !== null) {
      if (plNonPositive) {
        findings.push({
          findingType: 'kanitz_pl_negativo_cautela', period, findingScope: 'structural_validation', sourceType: 'kanitz',
          financialIndicator: 'kanitz_fator_insolvencia', severity: 'medium', confidenceLevelOverride: 'low',
          title: `Leitura do Fator de Kanitz prejudicada por PL negativo em ${period}`,
          description: `O Fator de Insolvência de Kanitz em ${period} foi calculado com baixa confiabilidade (FI = ${formatIndicatorValue('kanitz_fator_insolvencia', kanitzFI)}) devido ao patrimônio líquido negativo. O resultado não deve ser interpretado como afirmação conclusiva de insolvência.`,
          evidenceNumeric: [{ label: 'Fator de Insolvência de Kanitz', value: formatIndicatorValue('kanitz_fator_insolvencia', kanitzFI), period }],
        });
      } else if (kanitzFI < -3) {
        findings.push({
          findingType: 'kanitz_critico', period, findingScope: 'period_snapshot', sourceType: 'kanitz',
          financialIndicator: 'kanitz_fator_insolvencia', severity: 'high',
          title: `Fator de Insolvência de Kanitz em zona crítica em ${period}`,
          description: `Em ${period}, o Fator de Insolvência de Kanitz foi de ${formatIndicatorValue('kanitz_fator_insolvencia', kanitzFI)}, abaixo do limite de -3 que caracteriza a zona de insolvência conforme o modelo Kanitz.`,
          evidenceNumeric: [{ label: 'Fator de Insolvência de Kanitz', value: formatIndicatorValue('kanitz_fator_insolvencia', kanitzFI), period }],
        });
      }
    }

    const resultadoLiquido = getStatementValue(statementLines, 'resultado_liquido', period);
    if (resultadoLiquido !== null && resultadoLiquido < 0) {
      findings.push({
        findingType: 'resultado_liquido_negativo', period, findingScope: 'period_snapshot', sourceType: 'financial_statement',
        financialIndicator: 'resultado_liquido', severity: 'medium',
        title: `Resultado líquido negativo em ${period}`,
        description: `Em ${period}, o resultado líquido foi de ${formatCurrencyCompact(resultadoLiquido)}, caracterizando prejuízo contábil no período — pressiona patrimônio líquido, indicadores de solvência e capacidade de autofinanciamento.`,
        evidenceNumeric: [{ label: 'Resultado líquido', value: formatCurrencyCompact(resultadoLiquido), period }],
      });
    }
  }

  // ── Estrutural: DFC não gerável por falta de períodos comparáveis ──
  const dfcLines = statementLines.filter((l) => l.statementCode === 'DFC');
  if (periods.length < 2 && dfcLines.length === 0) {
    findings.push({
      findingType: 'dfc_ausente_periodos', period: null, findingScope: 'structural_validation', sourceType: 'dfc',
      severity: 'low',
      title: 'DFC não gerada por ausência de períodos comparáveis',
      description: 'A demonstração de fluxo de caixa indireta exige pelo menos dois períodos comparáveis. O escopo atual possui apenas um período, impedindo a leitura de geração e consumo de caixa.',
      evidenceNumeric: [],
    });
  }

  return findings;
}

/** Achados de deterioração entre dois períodos consecutivos (period_comparison). */
export function detectComparisonFindings(
  indicators: IndicatorRow[],
  statementLines: StatementRow[],
  periods: string[],
): DetectedFinding[] {
  const findings: DetectedFinding[] = [];

  for (let i = 1; i < periods.length; i++) {
    const previousPeriod = periods[i - 1];
    const currentPeriod = periods[i];

    for (const metric of COMPARISON_METRICS) {
      const previousValue = metric.source === 'statement'
        ? getStatementValue(statementLines, metric.canonicalKey!, previousPeriod)
        : getIndicatorValue(indicators, metric.code, previousPeriod);
      const currentValue = metric.source === 'statement'
        ? getStatementValue(statementLines, metric.canonicalKey!, currentPeriod)
        : getIndicatorValue(indicators, metric.code, currentPeriod);

      if (previousValue === null || currentValue === null) continue;
      if (!isDeterioration(metric.code, previousValue, currentValue)) continue;

      const relativeDelta = previousValue !== 0 ? Math.abs((currentValue - previousValue) / previousValue) * 100 : null;
      const relevant = relativeDelta === null ? true : relativeDelta >= 10;
      const critical = crossedCriticalBand(metric.code, previousValue, currentValue);
      if (!relevant && !critical) continue;

      const previousLabel = metric.source === 'statement'
        ? formatCurrencyCompact(previousValue)
        : formatIndicatorValue(metric.code, previousValue);
      const currentLabel = metric.source === 'statement'
        ? formatCurrencyCompact(currentValue)
        : formatIndicatorValue(metric.code, currentValue);
      const deltaLabel = relativeDelta === null ? 'não mensurável' : formatPercentagePoints(relativeDelta);

      findings.push({
        findingType: `comparison_${metric.code}`, period: currentPeriod, comparisonPeriod: previousPeriod,
        findingScope: 'period_comparison', sourceType: metric.sourceType, financialIndicator: metric.code,
        severity: critical ? 'high' : 'medium',
        title: metric.buildTitle(previousLabel, currentLabel, deltaLabel),
        description: metric.buildDescription(previousLabel, currentLabel, deltaLabel),
        evidenceNumeric: [
          { label: `${metric.label} (${previousPeriod})`, value: previousLabel, period: previousPeriod },
          { label: `${metric.label} (${currentPeriod})`, value: currentLabel, period: currentPeriod },
        ],
      });
    }

    // ── Kanitz — tratamento especial quando há limitação de PL negativo ──
    const kanitzPrevious = getIndicatorValue(indicators, 'kanitz_fator_insolvencia', previousPeriod);
    const kanitzCurrent = getIndicatorValue(indicators, 'kanitz_fator_insolvencia', currentPeriod);
    if (kanitzPrevious !== null && kanitzCurrent !== null) {
      const plPrevious = getStatementValue(statementLines, 'total_patrimonio_liquido', previousPeriod);
      const plCurrent = getStatementValue(statementLines, 'total_patrimonio_liquido', currentPeriod);
      const plIssue = (plPrevious !== null && plPrevious <= 0) || (plCurrent !== null && plCurrent <= 0);
      if (plIssue) {
        findings.push({
          findingType: 'comparison_kanitz_fator_insolvencia', period: currentPeriod, comparisonPeriod: previousPeriod,
          findingScope: 'period_comparison', sourceType: 'kanitz', financialIndicator: 'kanitz_fator_insolvencia',
          severity: 'medium', confidenceLevelOverride: 'low',
          title: `Solvência permaneceu pressionada entre ${previousPeriod} e ${currentPeriod}`,
          description: `O Fator de Kanitz (${formatIndicatorValue('kanitz_fator_insolvencia', kanitzPrevious)} em ${previousPeriod} e ${formatIndicatorValue('kanitz_fator_insolvencia', kanitzCurrent)} em ${currentPeriod}) e a ocorrência de patrimônio líquido negativo indicam manutenção de fragilidade patrimonial relevante, exigindo cautela na leitura convencional do modelo.`,
          evidenceNumeric: [
            { label: 'Fator de Kanitz', value: formatIndicatorValue('kanitz_fator_insolvencia', kanitzPrevious), period: previousPeriod },
            { label: 'Fator de Kanitz', value: formatIndicatorValue('kanitz_fator_insolvencia', kanitzCurrent), period: currentPeriod },
          ],
        });
      } else if (kanitzCurrent < kanitzPrevious) {
        const relativeDelta = kanitzPrevious !== 0 ? Math.abs((kanitzCurrent - kanitzPrevious) / kanitzPrevious) * 100 : null;
        const relevant = relativeDelta === null ? true : relativeDelta >= 10;
        const critical = crossedCriticalBand('kanitz_fator_insolvencia', kanitzPrevious, kanitzCurrent);
        if (relevant || critical) {
          findings.push({
            findingType: 'comparison_kanitz_fator_insolvencia', period: currentPeriod, comparisonPeriod: previousPeriod,
            findingScope: 'period_comparison', sourceType: 'kanitz', financialIndicator: 'kanitz_fator_insolvencia',
            severity: critical ? 'high' : 'medium',
            title: `Fator de Insolvência de Kanitz deteriorou de ${previousPeriod} para ${currentPeriod}`,
            description: `O Fator de Insolvência de Kanitz piorou de ${formatIndicatorValue('kanitz_fator_insolvencia', kanitzPrevious)} para ${formatIndicatorValue('kanitz_fator_insolvencia', kanitzCurrent)} entre os períodos, indicando aumento do risco de insolvência conforme o modelo Kanitz.`,
            evidenceNumeric: [
              { label: 'Fator de Kanitz', value: formatIndicatorValue('kanitz_fator_insolvencia', kanitzPrevious), period: previousPeriod },
              { label: 'Fator de Kanitz', value: formatIndicatorValue('kanitz_fator_insolvencia', kanitzCurrent), period: currentPeriod },
            ],
          });
        }
      }
    }
  }

  return findings;
}

/**
 * Achados de "cruzamento automático" — cada regra combina rubricas de DUAS
 * demonstrações diferentes (ex.: resultado do DRE vs. caixa operacional da
 * DFC), o que nenhuma leitura isolada de BP, DRE ou DFC revela sozinha.
 * Alimentam exclusivamente a seção "Achados integrados para decisão" do
 * relatório (sourceType 'cross_statement' — ver findingBuckets em
 * financial-report-data.service.ts).
 */
export function detectCrossStatementFindings(
  indicators: IndicatorRow[],
  statementLines: StatementRow[],
  periods: string[],
): DetectedFinding[] {
  const findings: DetectedFinding[] = [];

  // ── A) Qualidade do resultado: lucro contábil vs. caixa operacional ──
  // Resultado positivo sem geração de caixa operacional (ou com conversão
  // muito baixa) é um sinal clássico de resultado "de papel" — reconhecimento
  // de receita descolado do recebimento, ou consumo de capital de giro
  // escondido atrás de um DRE saudável.
  for (const period of periods) {
    const netIncome = getStatementValue(statementLines, 'resultado_liquido', period);
    const ocf = getStatementValue(statementLines, 'dfc_caixa_liquido_atividades_operacionais', period);
    if (netIncome === null || ocf === null || netIncome <= 0) continue;

    if (ocf < 0) {
      findings.push({
        findingType: 'lucro_sem_geracao_caixa', period, findingScope: 'period_snapshot', sourceType: 'cross_statement',
        severity: 'high',
        title: `Resultado positivo sem geração de caixa operacional em ${period}`,
        description: `Em ${period}, o resultado líquido foi de ${formatCurrencyCompact(netIncome)}, mas as atividades operacionais consumiram ${formatCurrencyCompact(Math.abs(ocf))} de caixa no mesmo período — um sinal de baixa qualidade do resultado (reconhecimento contábil descolado da geração de caixa) que não aparece na leitura isolada do DRE.`,
        evidenceNumeric: [
          { label: 'Resultado líquido', value: formatCurrencyCompact(netIncome), period },
          { label: 'Caixa líquido das atividades operacionais', value: formatCurrencyCompact(ocf), period },
        ],
      });
    } else if (ocf < netIncome * 0.5) {
      findings.push({
        findingType: 'baixa_conversao_caixa', period, findingScope: 'period_snapshot', sourceType: 'cross_statement',
        severity: 'medium',
        title: `Baixa conversão do resultado em caixa operacional em ${period}`,
        description: `Em ${period}, o resultado líquido foi de ${formatCurrencyCompact(netIncome)}, mas apenas ${formatCurrencyCompact(ocf)} converteram-se em caixa das atividades operacionais (${formatPercentagePoints((ocf / netIncome) * 100)} do resultado) — capital de giro ou itens não recorrentes podem estar retendo caixa que o DRE isoladamente não evidencia.`,
        evidenceNumeric: [
          { label: 'Resultado líquido', value: formatCurrencyCompact(netIncome), period },
          { label: 'Caixa líquido das atividades operacionais', value: formatCurrencyCompact(ocf), period },
        ],
      });
    }
  }

  // ── B) Investimento (capex) vs. depreciação/amortização ──
  // Capex consistentemente abaixo da depreciação do período sinaliza
  // desinvestimento — o ativo imobilizado está sendo consumido mais rápido
  // do que reposto, risco que só aparece cruzando DFC (investimento) com
  // DRE (depreciação).
  for (const period of periods) {
    const investingCf = getStatementValue(statementLines, 'dfc_caixa_liquido_atividades_investimento', period);
    const depreciacao = getStatementValue(statementLines, 'depreciacao_amortizacao', period);
    if (investingCf === null || depreciacao === null || depreciacao === 0) continue;

    const capexEstimate = investingCf < 0 ? Math.abs(investingCf) : 0;
    const depreciacaoAbs = Math.abs(depreciacao);
    if (capexEstimate < depreciacaoAbs * 0.5) {
      findings.push({
        findingType: 'capex_abaixo_depreciacao', period, findingScope: 'period_snapshot', sourceType: 'cross_statement',
        severity: 'medium',
        title: `Investimento abaixo da depreciação do período em ${period}`,
        description: `Em ${period}, o investimento em atividades de investimento foi de ${formatCurrencyCompact(capexEstimate)}, frente a uma depreciação/amortização de ${formatCurrencyCompact(depreciacaoAbs)} no DRE — o ritmo de reposição do imobilizado está abaixo do seu consumo contábil, risco de desinvestimento que a leitura isolada da DFC ou do DRE não evidencia sozinha.`,
        evidenceNumeric: [
          { label: 'Caixa líquido das atividades de investimento', value: formatCurrencyCompact(investingCf), period },
          { label: 'Depreciação e amortização', value: formatCurrencyCompact(-depreciacaoAbs), period },
        ],
      });
    }
  }

  // ── E) Carga financeira sobre a geração operacional (EBITDA) ──
  // Resultado financeiro negativo consumindo uma fatia relevante do EBITDA
  // indica que a estrutura de dívida está pressionando a geração
  // operacional — cruzamento dentro do próprio DRE, mas entre duas leituras
  // (resultado financeiro vs. EBITDA) que a demonstração não conecta
  // explicitamente linha a linha.
  for (const period of periods) {
    const resultadoFinanceiro = getStatementValue(statementLines, 'resultado_financeiro', period);
    const ebitda = getStatementValue(statementLines, 'ebitda', period);
    if (resultadoFinanceiro === null || ebitda === null || resultadoFinanceiro >= 0 || ebitda <= 0) continue;

    const burden = (Math.abs(resultadoFinanceiro) / ebitda) * 100;
    if (burden >= 40) {
      // EBITDA baixo o suficiente pra tornar a razão pouco representativa
      // (ex.: 2.304%) — reportar o fato em vez de uma % explosiva tratada
      // como indicador normal.
      const immaterialEbitda = burden >= 300;
      findings.push({
        findingType: 'alta_carga_financeira_sobre_ebitda', period, findingScope: 'period_snapshot', sourceType: 'cross_statement',
        severity: burden >= 70 ? 'high' : 'medium',
        title: `Resultado financeiro consome parcela relevante do EBITDA em ${period}`,
        description: immaterialEbitda
          ? `Em ${period}, o EBITDA foi de apenas ${formatCurrencyCompact(ebitda)}, enquanto o resultado financeiro foi negativo em ${formatCurrencyCompact(resultadoFinanceiro)}. Nesse contexto, a relação percentual entre os dois perde representatividade, mas evidencia que a geração operacional foi insuficiente para absorver o resultado financeiro do período.`
          : `Em ${period}, o resultado financeiro negativo de ${formatCurrencyCompact(resultadoFinanceiro)} equivale a ${formatPercentagePoints(burden)} do EBITDA (${formatCurrencyCompact(ebitda)}) — a estrutura de dívida está absorvendo parcela relevante da geração operacional de caixa, leitura que cruza duas linhas do DRE não conectadas na demonstração.`,
        evidenceNumeric: [
          { label: 'Resultado financeiro', value: formatCurrencyCompact(resultadoFinanceiro), period },
          { label: 'EBITDA', value: formatCurrencyCompact(ebitda), period },
        ],
      });
    }
  }

  // ── F) Custo implícito da dívida ──
  // Despesas financeiras / saldo de dívida no fim do período aproxima o
  // custo médio da dívida — não é uma taxa de juros contratual exata (usa
  // saldo final, não médio), mas um patamar muito alto sinaliza dívida cara
  // (curto prazo, sem garantias, ou renegociação recente) que vale
  // investigar, cruzamento entre BP (saldo) e DRE (despesa) que nenhuma das
  // duas evidencia isoladamente.
  for (const period of periods) {
    const debtBalance = (getStatementValue(statementLines, 'passivo_circulante_emprestimos', period) ?? 0)
      + (getStatementValue(statementLines, 'passivo_nao_circulante', period) ?? 0);
    const despesasFinanceiras = getStatementValue(statementLines, 'despesas_financeiras', period);
    if (debtBalance <= 0 || despesasFinanceiras === null || despesasFinanceiras >= 0) continue;

    const impliedRate = (Math.abs(despesasFinanceiras) / debtBalance) * 100;
    if (impliedRate >= 25) {
      findings.push({
        findingType: 'custo_implicito_divida_elevado', period, findingScope: 'period_snapshot', sourceType: 'cross_statement',
        severity: 'medium', confidenceLevelOverride: 'low',
        title: `Relação entre despesas financeiras e saldo da dívida elevada em ${period}`,
        description: `Em ${period}, as despesas financeiras (${formatCurrencyCompact(despesasFinanceiras)}) representam ${formatPercentagePoints(impliedRate)} do saldo de empréstimos e financiamentos ao final do período (${formatCurrencyCompact(debtBalance)}). O cálculo usa o saldo final da dívida, não o saldo médio, e as despesas financeiras podem incluir tarifas, variações cambiais e multas além de juros — o resultado é um sinal para investigação com a área financeira, não a taxa efetiva da dívida.`,
        evidenceNumeric: [
          { label: 'Despesas financeiras', value: formatCurrencyCompact(despesasFinanceiras), period },
          { label: 'Saldo de empréstimos e financiamentos', value: formatCurrencyCompact(debtBalance), period },
        ],
      });
    }
  }

  for (let i = 1; i < periods.length; i++) {
    const previousPeriod = periods[i - 1];
    const currentPeriod = periods[i];

    // ── C) Contas a receber crescendo bem acima da receita ──
    // Recebíveis que crescem muito mais rápido que a receita entre dois
    // períodos indicam possível deterioração na cobrança, prazos mais
    // longos concedidos a clientes ou reconhecimento de receita antecipado
    // — um cruzamento BP × DRE que nenhuma das duas demonstrações isolada
    // torna óbvio.
    const prevReceber = getStatementValue(statementLines, 'ativo_circulante_receber', previousPeriod);
    const currReceber = getStatementValue(statementLines, 'ativo_circulante_receber', currentPeriod);
    const prevReceita = getStatementValue(statementLines, 'receita_liquida', previousPeriod);
    const currReceita = getStatementValue(statementLines, 'receita_liquida', currentPeriod);
    if (prevReceber !== null && currReceber !== null && prevReceita !== null && currReceita !== null && prevReceber > 0 && prevReceita > 0) {
      const receberGrowth = ((currReceber - prevReceber) / prevReceber) * 100;
      const receitaGrowth = ((currReceita - prevReceita) / prevReceita) * 100;
      const gap = receberGrowth - receitaGrowth;
      if (receberGrowth > 15 && gap >= 20) {
        findings.push({
          findingType: 'recebiveis_acima_receita', period: currentPeriod, comparisonPeriod: previousPeriod,
          findingScope: 'period_comparison', sourceType: 'cross_statement', severity: 'medium',
          title: `Contas a receber cresceram bem acima da receita entre ${previousPeriod} e ${currentPeriod}`,
          description: `Entre ${previousPeriod} e ${currentPeriod}, contas a receber cresceram ${formatPercentagePoints(receberGrowth)}, frente a um crescimento de receita líquida de ${formatPercentagePoints(receitaGrowth)} — um descolamento de ${formatPercentagePoints(gap)} entre BP e DRE que sugere possível deterioração de prazo/qualidade de recebimento, não visível ao analisar as demonstrações isoladamente.`,
          evidenceNumeric: [
            { label: `Contas a receber (${previousPeriod})`, value: formatCurrencyCompact(prevReceber), period: previousPeriod },
            { label: `Contas a receber (${currentPeriod})`, value: formatCurrencyCompact(currReceber), period: currentPeriod },
            { label: `Receita líquida (${previousPeriod})`, value: formatCurrencyCompact(prevReceita), period: previousPeriod },
            { label: `Receita líquida (${currentPeriod})`, value: formatCurrencyCompact(currReceita), period: currentPeriod },
          ],
        });
      }
    }

    // ── D) Dívida cresceu no BP sem entrada líquida correspondente na DFC ──
    // Consistência estrutural: se o saldo de dívida (BP) sobe de forma
    // relevante mas o fluxo de financiamento (DFC) do mesmo período não
    // mostra entrada líquida de caixa, a causa pode ser legítima
    // (reclassificação contábil, variação cambial, capitalização de juros)
    // ou um gap de mapeamento na composição da DFC — em qualquer caso, é
    // uma inconsistência entre BP e DFC que merece investigação explícita.
    const prevDebt = (getStatementValue(statementLines, 'passivo_circulante_emprestimos', previousPeriod) ?? 0)
      + (getStatementValue(statementLines, 'passivo_nao_circulante', previousPeriod) ?? 0);
    const currDebt = (getStatementValue(statementLines, 'passivo_circulante_emprestimos', currentPeriod) ?? 0)
      + (getStatementValue(statementLines, 'passivo_nao_circulante', currentPeriod) ?? 0);
    const financingCf = getStatementValue(statementLines, 'dfc_caixa_liquido_atividades_financiamento', currentPeriod);
    if (prevDebt > 0 && financingCf !== null) {
      const debtGrowthPct = ((currDebt - prevDebt) / prevDebt) * 100;
      if (debtGrowthPct >= 15 && financingCf <= 0) {
        findings.push({
          findingType: 'divida_cresceu_sem_financiamento_caixa', period: currentPeriod, comparisonPeriod: previousPeriod,
          findingScope: 'period_comparison', sourceType: 'cross_statement', severity: 'medium', confidenceLevelOverride: 'medium',
          title: `Saldo de dívida cresceu sem entrada líquida de caixa em atividades de financiamento entre ${previousPeriod} e ${currentPeriod}`,
          description: `Entre ${previousPeriod} e ${currentPeriod}, o saldo de empréstimos e financiamentos no balanço cresceu ${formatPercentagePoints(debtGrowthPct)} (de ${formatCurrencyCompact(prevDebt)} para ${formatCurrencyCompact(currDebt)}), mas a DFC de ${currentPeriod} não mostra entrada líquida de caixa em atividades de financiamento (${formatCurrencyCompact(financingCf)}) — investigar se há reclassificação contábil, variação cambial/capitalização de juros ou uma lacuna na composição da DFC.`,
          evidenceNumeric: [
            { label: `Dívida total (${previousPeriod})`, value: formatCurrencyCompact(prevDebt), period: previousPeriod },
            { label: `Dívida total (${currentPeriod})`, value: formatCurrencyCompact(currDebt), period: currentPeriod },
            { label: 'Caixa líquido das atividades de financiamento', value: formatCurrencyCompact(financingCf), period: currentPeriod },
          ],
        });
      }
    }

    // ── G) Crescimento do imobilizado financiado por redução de caixa ──
    // Se o imobilizado cresce mas a dívida (já calculada acima) não
    // acompanha, a fonte mais provável é caixa próprio — legítimo, mas
    // reduz a reserva de liquidez sem aparecer como risco na leitura
    // isolada do BP (o crescimento do ativo parece só positivo) nem da DFC
    // (a saída de investimento é óbvia, mas não o que a financiou).
    const prevImobilizado = getStatementValue(statementLines, 'ativo_nao_circulante', previousPeriod);
    const currImobilizado = getStatementValue(statementLines, 'ativo_nao_circulante', currentPeriod);
    const prevCaixa = getStatementValue(statementLines, 'ativo_circulante_caixa', previousPeriod);
    const currCaixa = getStatementValue(statementLines, 'ativo_circulante_caixa', currentPeriod);
    if (prevImobilizado !== null && currImobilizado !== null && prevCaixa !== null && currCaixa !== null) {
      const deltaImobilizado = currImobilizado - prevImobilizado;
      const deltaCaixa = currCaixa - prevCaixa;
      const deltaDebt = currDebt - prevDebt;
      if (deltaImobilizado > 0 && deltaCaixa < -0.5 * deltaImobilizado && deltaDebt < 0.15 * deltaImobilizado) {
        findings.push({
          findingType: 'imobilizado_financiado_por_caixa', period: currentPeriod, comparisonPeriod: previousPeriod,
          findingScope: 'period_comparison', sourceType: 'cross_statement', severity: 'medium', confidenceLevelOverride: 'medium',
          title: `Crescimento do imobilizado coincide com redução de caixa entre ${previousPeriod} e ${currentPeriod}`,
          description: `Entre ${previousPeriod} e ${currentPeriod}, o imobilizado cresceu ${formatCurrencyCompact(deltaImobilizado)} enquanto o saldo de caixa reduziu ${formatCurrencyCompact(Math.abs(deltaCaixa))} e o saldo de dívida praticamente não se moveu (${formatCurrencyCompact(deltaDebt)}). Os dados disponíveis não são suficientes para atribuir diretamente uma movimentação à outra — a coincidência de período vale investigar com a área financeira, especialmente se a DFC do período ainda não estiver conciliada.`,
          evidenceNumeric: [
            { label: `Imobilizado (${previousPeriod})`, value: formatCurrencyCompact(prevImobilizado), period: previousPeriod },
            { label: `Imobilizado (${currentPeriod})`, value: formatCurrencyCompact(currImobilizado), period: currentPeriod },
            { label: `Caixa (${previousPeriod})`, value: formatCurrencyCompact(prevCaixa), period: previousPeriod },
            { label: `Caixa (${currentPeriod})`, value: formatCurrencyCompact(currCaixa), period: currentPeriod },
          ],
        });
      }
    }
  }

  return findings;
}
