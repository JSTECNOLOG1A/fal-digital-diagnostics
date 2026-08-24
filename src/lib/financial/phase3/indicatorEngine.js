import { FORMULA_VERSION } from './canonicalRegistry.js';
import { optionalNumber, sumRequiredSources } from './statementEngine.js';

const num = (v) => optionalNumber(v) ?? 0;
export function safeDivide(numerator, denominator) {
  if (numerator == null || denominator == null) return null;
  const n = Number(numerator), d = Number(denominator);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

export function calculateKanitz(values) {
  const pl = optionalNumber(values.total_patrimonio_liquido);
  const passivo = optionalNumber(values.total_passivo);
  const realizavel = sumRequiredSources(values, ['total_ativo_circulante', 'ativo_nc_receber_lp', 'ativo_nc_impostos_lp', 'ativo_nc_outros_creditos']);
  const acSemEstoques = optionalNumber(values.total_ativo_circulante) == null || optionalNumber(values.ativo_circulante_estoques) == null
    ? null : Number(values.total_ativo_circulante) - Number(values.ativo_circulante_estoques);
  const rpl = safeDivide(values.resultado_liquido, pl);
  const lg = safeDivide(realizavel, passivo);
  const ls = safeDivide(acSemEstoques, values.total_passivo_circulante);
  const lc = safeDivide(values.total_ativo_circulante, values.total_passivo_circulante);
  const pct = safeDivide(passivo, pl);
  const components = { rentabilidade_do_pl: rpl, liquidez_geral: lg, liquidez_seca: ls, liquidez_corrente: lc, capital_de_terceiros_sobre_pl: pct };
  const available = Object.values(components).every((value) => value != null);
  const value = available ? 0.05 * rpl + 1.65 * lg + 3.55 * ls - 1.06 * lc - 0.33 * pct : null;
  let classification = value == null ? 'indisponivel' : value > 0 ? 'solvente' : value >= -3 ? 'penumbra' : 'insolvencia';
  if (pl != null && pl <= 0 && classification === 'solvente') classification = 'penumbra';
  const sourceUnavailable = pl == null || passivo == null || optionalNumber(values.resultado_liquido) == null;
  return {
    value, components, classification,
    confidence_level: pl == null || pl <= 0 || value == null ? 'low' : 'high',
    warning: sourceUnavailable ? 'INDICATOR_SOURCE_UNAVAILABLE' : pl <= 0 ? 'KANITZ_PL_NON_POSITIVE' : value == null ? 'INDICATOR_DENOMINATOR_UNAVAILABLE' : null,
  };
}

const make = (code, family, numerator, denominator, formula, previous = null) => {
  const numeratorValue = optionalNumber(numerator);
  const hasDenominator = denominator !== undefined;
  const denominatorValue = hasDenominator ? optionalNumber(denominator) : undefined;
  const value = numeratorValue == null ? null : hasDenominator ? safeDivide(numeratorValue, denominatorValue) : numeratorValue;
  const validationCode = numeratorValue == null
    ? 'INDICATOR_SOURCE_UNAVAILABLE'
    : hasDenominator && (denominatorValue == null || denominatorValue === 0)
      ? 'INDICATOR_DENOMINATOR_UNAVAILABLE'
      : null;
  return {
    indicator_code: code, indicator_family: family, value, previous_value: previous,
    confidence_level: value == null ? 'low' : 'high', formula_version: FORMULA_VERSION,
    warning: validationCode, validation_code: validationCode, formula,
  };
};

export function calculateIndicators(v, previous = null) {
  const disponibilidade = sumRequiredSources(v, ['ativo_circulante_caixa', 'ativo_circulante_aplicacoes_liquidez_imediata']);
  const dividaBruta = sumRequiredSources(v, ['passivo_circulante_emprestimos', 'passivo_circulante_arrendamentos', 'passivo_nao_circulante', 'passivo_nc_arrendamentos_lp']);
  const dividaLiquida = dividaBruta == null || disponibilidade == null ? null : dividaBruta - disponibilidade;
  const realizavel = sumRequiredSources(v, ['total_ativo_circulante', 'ativo_nc_receber_lp', 'ativo_nc_impostos_lp', 'ativo_nc_outros_creditos']);
  const custo = optionalNumber(v.custos);
  const custoAbs = custo == null ? null : Math.abs(custo);
  const clientes = optionalNumber(v.ativo_circulante_receber);
  const fornecedores = optionalNumber(v.passivo_circulante_fornecedores);
  const estoques = optionalNumber(v.ativo_circulante_estoques);
  const pmr = clientes == null ? null : safeDivide(clientes * 360, v.receita_bruta);
  const pmp = fornecedores == null ? null : safeDivide(fornecedores * 360, custoAbs);
  const pme = estoques == null ? null : safeDivide(estoques * 360, custoAbs);
  const ac = optionalNumber(v.total_ativo_circulante);
  const pc = optionalNumber(v.total_passivo_circulante);
  const list = [
    make('liquidez_corrente','liquidez',ac,pc,'AC / PC'),
    make('liquidez_seca','liquidez',ac == null || estoques == null ? null : ac-estoques,pc,'(AC - Estoques) / PC'),
    make('liquidez_imediata','liquidez',disponibilidade,pc,'Disponibilidade imediata / PC'),
    make('liquidez_geral','liquidez',realizavel,v.total_passivo,'Realizável / Passivo exigível'),
    make('capital_circulante_liquido','capital_giro',ac == null || pc == null ? null : ac-pc,undefined,'AC - PC'),
    make('passivo_sobre_ativo','endividamento',v.total_passivo ?? null,v.total_ativo ?? null,'Passivo / Ativo'),
    make('capital_terceiros_sobre_pl','estrutura_capital',v.total_passivo ?? null,v.total_patrimonio_liquido ?? null,'Passivo / PL'),
    make('divida_liquida','endividamento',dividaLiquida,undefined,'Dívida bruta - disponibilidade'),
    make('divida_liquida_sobre_ebitda','endividamento',dividaLiquida,v.ebitda ?? null,'Dívida líquida / EBITDA'),
    make('composicao_endividamento','endividamento',pc,v.total_passivo ?? null,'PC / Passivo'),
    make('margem_bruta','margens',v.lucro_bruto,v.receita_liquida ?? null,'Lucro bruto / Receita líquida'),
    make('margem_ebit','margens',v.ebit,v.receita_liquida ?? null,'EBIT / Receita líquida'),
    make('margem_ebitda','margens',v.ebitda,v.receita_liquida ?? null,'EBITDA / Receita líquida'),
    make('margem_liquida','margens',v.resultado_liquido,v.receita_liquida ?? null,'Resultado líquido / Receita líquida'),
    make('roa','rentabilidade',v.resultado_liquido,v.total_ativo ?? null,'Resultado líquido / Ativo'),
    make('roe','rentabilidade',v.resultado_liquido,v.total_patrimonio_liquido ?? null,'Resultado líquido / PL'),
    make('giro_ativo','atividade',v.receita_liquida,v.total_ativo ?? null,'Receita líquida / Ativo'),
    make('prazo_medio_recebimento','atividade',pmr,undefined,'Clientes × 360 / Receita bruta'),
    make('prazo_medio_pagamento','atividade',pmp,undefined,'Fornecedores × 360 / |Custos|'),
    make('prazo_medio_estoque','atividade',pme,undefined,'Estoques × 360 / |Custos|'),
    make('ciclo_operacional','atividade',pmr == null || pme == null ? null : pmr+pme,undefined,'PMR + PME'),
    make('ciclo_financeiro','atividade',pmr == null || pme == null || pmp == null ? null : pmr+pme-pmp,undefined,'Ciclo operacional - PMP'),
  ];
  const kanitz = calculateKanitz(v);
  list.push({
    indicator_code:'kanitz_fator_insolvencia', indicator_family:'solvencia', value:kanitz.value,
    previous_value:null, confidence_level:kanitz.confidence_level, formula_version:FORMULA_VERSION,
    warning:kanitz.warning, validation_code:kanitz.warning,
    formula:'0,05×RPL + 1,65×LG + 3,55×LS - 1,06×LC - 0,33×PCT',
    components:kanitz.components, classification:kanitz.classification,
  });
  return list.map((item) => ({
    ...item,
    variation_value: item.previous_value == null || item.value == null ? null : item.value-item.previous_value,
    variation_percent: item.previous_value == null || item.previous_value === 0 || item.value == null ? null : (item.value-item.previous_value)/Math.abs(item.previous_value),
  }));
}