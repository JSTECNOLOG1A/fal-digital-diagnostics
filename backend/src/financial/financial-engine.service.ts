import { Injectable } from '@nestjs/common';
import {
  CALCULATED_RUBRICS,
  STATEMENT_TOTALS,
} from './financial-canonical-registry.constants';

/**
 * Porta local de executeFinancialEngine (função serverless Base44, 143
 * linhas). É uma calculadora pura e sem estado — recebe um mapa
 * {canonical_key: valor} agregado de um período e devolve os valores
 * calculados/totais (BP+DRE) e os indicadores, exatamente como o original.
 * Nenhuma chamada de rede/banco aqui — é por isso que dá pra manter como
 * serviço síncrono em vez de repetir o invoke() do Base44 a cada período.
 *
 * IMPORTANTE (bug corrigido): a semântica de "operando ausente" aqui é a
 * mesma do evaluate()/sumRequiredSources() do original — um valor
 * calculado/total só vira null quando TODOS os seus operandos/componentes
 * estão ausentes; se ao menos um estiver presente, os ausentes contam como
 * zero na soma. Isso é o comportamento correto e esperado: um balancete
 * real raramente popula todas as ~8-16 chaves canônicas de cada grupo do
 * BP, e isso é normal — não deve nulificar o total inteiro.
 */

export type RubricValues = Record<string, number | null | undefined>;

export interface EngineStatementResult {
  values: Record<string, number | null>; // fontes + calculadas + totais, já com null propagado
  bp: {
    balanced: boolean;
    difference: number | null;
    totalAtivo: number | null;
    totalPassivoPl: number | null;
    code?: 'BP_SOURCE_UNAVAILABLE' | 'BP_NON_FINITE_TOTAL' | 'BP_ACCOUNTING_EQUATION_MISMATCH';
  };
}

export interface IndicatorResult {
  indicatorCode: string;
  value: number | null;
  confidenceLevel: 'high' | 'low';
  validationCode?: 'INDICATOR_SOURCE_UNAVAILABLE' | 'INDICATOR_DENOMINATOR_UNAVAILABLE';
}

const BP_TOLERANCE = 0.01;

function optionalNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Porta fiel de sumRequiredSources() do original: null somente se TODOS os
 * operandos estiverem ausentes; caso contrário soma os presentes tratando
 * os ausentes como zero.
 */
function sumRequiredSources(keys: string[], values: Record<string, number | null>): number | null {
  const resolved = keys.map((k) => optionalNumber(values[k]));
  if (resolved.every((v) => v === null)) return null;
  return resolved.reduce((sum: number, v) => sum + (v ?? 0), 0);
}

/**
 * Porta fiel de evaluate() do original: igual a sumRequiredSources, mas com
 * um coeficiente por operando (usado nas fórmulas de DRE, onde alguns
 * operandos entram subtraídos).
 */
function evaluate(keys: string[], coefficients: number[], values: Record<string, number | null>): number | null {
  const resolved = keys.map((k, i) => {
    const v = optionalNumber(values[k]);
    return v === null ? null : v * (coefficients[i] ?? 1);
  });
  if (resolved.every((v) => v === null)) return null;
  return resolved.reduce((sum: number, v) => sum + (v ?? 0), 0);
}

/** null se o denominador for null/ausente OU exatamente 0 (sem tolerância de epsilon — igual ao original). */
function safeDivide(numerator: number | null, denominator: number | null | undefined): number | null {
  const d = denominator === undefined ? null : denominator;
  if (numerator === null || d === null || d === 0) return null;
  return numerator / d;
}

@Injectable()
export class FinancialEngineService {
  /**
   * buildStatements(): calcula todas as chaves derivadas (fórmulas DRE +
   * totais de BP) a partir das rubricas-fonte já agregadas do balancete, e
   * roda a checagem de equação contábil (Ativo = Passivo + PL).
   */
  buildStatements(sourceValues: RubricValues): EngineStatementResult {
    const values: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(sourceValues)) {
      values[k] = optionalNumber(v);
    }

    // Fórmulas DRE — a ordem de CALCULATED_RUBRICS já respeita as
    // dependências (cada fórmula só referencia chaves-fonte ou chaves
    // calculadas que aparecem antes dela no objeto).
    for (const calc of Object.values(CALCULATED_RUBRICS)) {
      values[calc.canonicalKey] = evaluate(calc.operands, calc.coefficients, values);
    }
    // Aliases legados de nome (resultado_operacional etc.) — mantidos por
    // compatibilidade com quem já lê esses nomes.
    values.total_passivo_pl = values.total_passivo_patrimonio_liquido ?? null;
    values.resultado_operacional = values.ebit ?? null;
    values.resultado_financeiro_liquido = values.resultado_financeiro ?? null;
    values.resultado_antes_ir = values.resultado_antes_ir_csll ?? null;

    // Totais de BP — soma tolerante: null só se TODOS os componentes do
    // grupo estiverem ausentes; do contrário soma os presentes tratando os
    // ausentes como zero.
    for (const total of Object.values(STATEMENT_TOTALS)) {
      values[total.canonicalKey] = sumRequiredSources(total.componentKeys, values);
    }

    const totalAtivo = values.total_ativo ?? null;
    const totalPassivoPl = values.total_passivo_patrimonio_liquido ?? null;

    let bp: EngineStatementResult['bp'];
    if (totalAtivo === null || totalPassivoPl === null) {
      bp = { balanced: false, difference: null, totalAtivo, totalPassivoPl, code: 'BP_SOURCE_UNAVAILABLE' };
    } else if (!Number.isFinite(totalAtivo) || !Number.isFinite(totalPassivoPl)) {
      bp = { balanced: false, difference: null, totalAtivo, totalPassivoPl, code: 'BP_NON_FINITE_TOTAL' };
    } else {
      const difference = Math.round(Math.abs(totalAtivo - totalPassivoPl) * 100) / 100;
      const balanced = difference <= BP_TOLERANCE;
      bp = {
        balanced,
        difference,
        totalAtivo,
        totalPassivoPl,
        ...(balanced ? {} : { code: 'BP_ACCOUNTING_EQUATION_MISMATCH' as const }),
      };
    }

    return { values, bp };
  }

  /**
   * calculateIndicators(): só é chamado quando o BP fechou (balanced=true)
   * — igual ao original, que não calcula nenhum indicador se o BP não
   * bater (indicators = balanced ? calculateIndicators(...) : []).
   */
  calculateIndicators(values: Record<string, number | null>): IndicatorResult[] {
    const v = (k: string): number | null => (values[k] === undefined ? null : values[k]);

    const makeIndicator = (
      code: string,
      numerator: number | null,
      denominator?: number | null,
    ): IndicatorResult => {
      const hasDenominator = denominator !== undefined;
      const value = numerator === null ? null : hasDenominator ? safeDivide(numerator, denominator ?? null) : numerator;
      const validationCode: IndicatorResult['validationCode'] =
        numerator === null
          ? 'INDICATOR_SOURCE_UNAVAILABLE'
          : hasDenominator && (denominator === null || denominator === 0)
            ? 'INDICATOR_DENOMINATOR_UNAVAILABLE'
            : undefined;
      return { indicatorCode: code, value, confidenceLevel: value === null ? 'low' : 'high', validationCode };
    };

    const disponibilidade = sumRequiredSources(
      ['ativo_circulante_caixa', 'ativo_circulante_aplicacoes_liquidez_imediata'],
      values,
    );
    // dividaBruta: 4 chaves (empréstimos CP, arrendamentos CP, passivo não
    // circulante, arrendamentos LP) — não apenas 2 como numa versão
    // anterior incorreta deste porte.
    const dividaBruta = sumRequiredSources(
      [
        'passivo_circulante_emprestimos',
        'passivo_circulante_arrendamentos',
        'passivo_nao_circulante',
        'passivo_nc_arrendamentos_lp',
      ],
      values,
    );
    const dividaLiquida = dividaBruta === null || disponibilidade === null ? null : dividaBruta - disponibilidade;
    const realizavel = sumRequiredSources(
      ['total_ativo_circulante', 'ativo_nc_receber_lp', 'ativo_nc_impostos_lp', 'ativo_nc_outros_creditos'],
      values,
    );
    const ac = v('total_ativo_circulante');
    const pc = v('total_passivo_circulante');
    const estoque = v('ativo_circulante_estoques');
    const custo = v('custos');
    const custoAbs = custo === null ? null : Math.abs(custo);
    const clientes = v('ativo_circulante_receber');
    const fornecedores = v('passivo_circulante_fornecedores');
    // PMR/PMP/PME usam ano de 360 dias (convenção do original, não 365).
    const pmr = clientes === null ? null : safeDivide(clientes * 360, v('receita_bruta'));
    const pmp = fornecedores === null ? null : safeDivide(fornecedores * 360, custoAbs);
    const pme = estoque === null ? null : safeDivide(estoque * 360, custoAbs);

    const results: IndicatorResult[] = [
      makeIndicator('liquidez_corrente', ac, pc),
      makeIndicator('liquidez_seca', ac === null || estoque === null ? null : ac - estoque, pc),
      makeIndicator('liquidez_imediata', disponibilidade, pc),
      makeIndicator('liquidez_geral', realizavel, v('total_passivo')),
      makeIndicator('capital_circulante_liquido', ac === null || pc === null ? null : ac - pc, undefined),
      makeIndicator('passivo_sobre_ativo', v('total_passivo'), v('total_ativo')),
      makeIndicator('capital_terceiros_sobre_pl', v('total_passivo'), v('total_patrimonio_liquido')),
      makeIndicator('divida_liquida', dividaLiquida, undefined),
      makeIndicator('divida_liquida_sobre_ebitda', dividaLiquida, v('ebitda')),
      makeIndicator('composicao_endividamento', pc, v('total_passivo')),
      makeIndicator('margem_bruta', v('lucro_bruto'), v('receita_liquida')),
      makeIndicator('margem_ebit', v('ebit'), v('receita_liquida')),
      makeIndicator('margem_ebitda', v('ebitda'), v('receita_liquida')),
      makeIndicator('margem_liquida', v('resultado_liquido'), v('receita_liquida')),
      makeIndicator('roa', v('resultado_liquido'), v('total_ativo')),
      makeIndicator('roe', v('resultado_liquido'), v('total_patrimonio_liquido')),
      makeIndicator('giro_ativo', v('receita_liquida'), v('total_ativo')),
      makeIndicator('prazo_medio_recebimento', pmr, undefined),
      makeIndicator('prazo_medio_pagamento', pmp, undefined),
      makeIndicator('prazo_medio_estoque', pme, undefined),
      makeIndicator('ciclo_operacional', pmr === null || pme === null ? null : pmr + pme, undefined),
      makeIndicator('ciclo_financeiro', pmr === null || pme === null || pmp === null ? null : pmr + pme - pmp, undefined),
    ];

    // Kanitz — recalculado com as mesmas fórmulas de componentes do
    // original (calculateKanitz), e não reaproveitado dos indicadores
    // acima, para não arriscar divergência sutil entre as duas lógicas.
    // 0.05*RPL + 1.65*LG + 3.55*LS − 1.06*LC − 0.33*PCT
    const pl = v('total_patrimonio_liquido');
    const passivo = v('total_passivo');
    const resultadoLiquido = v('resultado_liquido');
    const rentabilidadeDoPl = safeDivide(resultadoLiquido, pl);
    const liquidezGeralK = safeDivide(realizavel, passivo);
    const liquidezSecaK = safeDivide(ac === null || estoque === null ? null : ac - estoque, pc);
    const liquidezCorrenteK = safeDivide(ac, pc);
    const capitalTerceirosSobrePlK = safeDivide(passivo, pl);
    const kanitzComponents = [rentabilidadeDoPl, liquidezGeralK, liquidezSecaK, liquidezCorrenteK, capitalTerceirosSobrePlK];
    const kanitzAvailable = kanitzComponents.every((c) => c !== null);
    const kanitzValue = kanitzAvailable
      ? Math.round(
          (0.05 * (rentabilidadeDoPl as number) +
            1.65 * (liquidezGeralK as number) +
            3.55 * (liquidezSecaK as number) -
            1.06 * (liquidezCorrenteK as number) -
            0.33 * (capitalTerceirosSobrePlK as number)) *
            100,
        ) / 100
      : null;
    const kanitzSourceUnavailable = pl === null || passivo === null || resultadoLiquido === null;
    results.push({
      indicatorCode: 'kanitz_fator_insolvencia',
      value: kanitzValue,
      confidenceLevel: pl === null || pl <= 0 || kanitzValue === null ? 'low' : 'high',
      validationCode: kanitzSourceUnavailable
        ? 'INDICATOR_SOURCE_UNAVAILABLE'
        : kanitzValue === null
          ? 'INDICATOR_DENOMINATOR_UNAVAILABLE'
          : undefined,
    });

    // Componentes individuais do Kanitz — gravados como indicadores-satélite
    // (mesma tabela FinancialIndicatorSnapshot, códigos próprios) só para
    // alimentar a tabela de "composição do Fator de Insolvência" do
    // Relatório da Análise (seção 2.5.2). Os pesos/coeficientes de cada
    // componente (0.05/1.65/3.55/-1.06/-0.33) são constantes fixas da
    // fórmula, não precisam ser persistidos — ver KANITZ_COMPONENT_WEIGHTS
    // em financial-report-data.service.ts.
    const kanitzComponentConfidence = kanitzSourceUnavailable ? 'low' : 'high';
    results.push(
      {
        indicatorCode: 'kanitz_componente_rentabilidade_pl',
        value: rentabilidadeDoPl,
        confidenceLevel: kanitzComponentConfidence,
        validationCode: rentabilidadeDoPl === null ? 'INDICATOR_DENOMINATOR_UNAVAILABLE' : undefined,
      },
      {
        indicatorCode: 'kanitz_componente_liquidez_geral',
        value: liquidezGeralK,
        confidenceLevel: kanitzComponentConfidence,
        validationCode: liquidezGeralK === null ? 'INDICATOR_DENOMINATOR_UNAVAILABLE' : undefined,
      },
      {
        indicatorCode: 'kanitz_componente_liquidez_seca',
        value: liquidezSecaK,
        confidenceLevel: kanitzComponentConfidence,
        validationCode: liquidezSecaK === null ? 'INDICATOR_DENOMINATOR_UNAVAILABLE' : undefined,
      },
      {
        indicatorCode: 'kanitz_componente_liquidez_corrente',
        value: liquidezCorrenteK,
        confidenceLevel: kanitzComponentConfidence,
        validationCode: liquidezCorrenteK === null ? 'INDICATOR_DENOMINATOR_UNAVAILABLE' : undefined,
      },
      {
        indicatorCode: 'kanitz_componente_capital_terceiros_pl',
        value: capitalTerceirosSobrePlK,
        confidenceLevel: kanitzComponentConfidence,
        validationCode: capitalTerceirosSobrePlK === null ? 'INDICATOR_DENOMINATOR_UNAVAILABLE' : undefined,
      },
    );

    return results;
  }
}
