import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

// BEGIN GENERATED FAL FINANCIAL ENGINE
const GENERATED_ENGINE_CONTRACT = {
  registry_version: '3.0.0',
  formula_version: 'FAL-FIN-3.0.0',
  analysis_types: ['individual', 'combined', 'consolidated'],
  indicator_codes: ['liquidez_corrente','liquidez_seca','liquidez_imediata','liquidez_geral','capital_circulante_liquido','passivo_sobre_ativo','capital_terceiros_sobre_pl','divida_liquida','divida_liquida_sobre_ebitda','composicao_endividamento','margem_bruta','margem_ebit','margem_ebitda','margem_liquida','roa','roe','giro_ativo','prazo_medio_recebimento','prazo_medio_pagamento','prazo_medio_estoque','ciclo_operacional','ciclo_financeiro','kanitz_fator_insolvencia'],
  kanitz_formula: '0.05*RPL+1.65*LG+3.55*LS-1.06*LC-0.33*PCT',
  bp_tolerance: 0.01,
  elimination_classification: 'SOURCE_CANONICAL_RUBRIC'
};
const optionalNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
function calculateJournalPresentationEffect({ rubric, side, amount }) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('ELIMINATION_AMOUNT_INVALID');
  if (!['debit', 'credit'].includes(side)) throw new Error('ELIMINATION_SIDE_INVALID');
  const factor = side === 'debit' ? rubric?.debit_presentation_effect : rubric?.credit_presentation_effect;
  if (!Number.isFinite(factor)) throw new Error('ELIMINATION_JOURNAL_EFFECT_UNDEFINED');
  return numericAmount * factor;
}
const sumRequiredSources = (values, keys) => {
  const resolved = keys.map((key) => optionalNumber(values[key]));
  if (resolved.every((value) => value === null)) return null;
  return resolved.reduce((sum, value) => sum + (value ?? 0), 0);
};
const safeDivide = (numerator, denominator) => {
  const n = optionalNumber(numerator), d = optionalNumber(denominator);
  return n === null || d === null || d === 0 ? null : n / d;
};
const evaluate = (values, keys, coefficients) => {
  const resolved = keys.map((key, index) => {
    const value = optionalNumber(values[key]);
    return value === null ? null : value * (coefficients?.[index] ?? 1);
  });
  if (resolved.every((value) => value === null)) return null;
  return resolved.reduce((sum, value) => sum + (value ?? 0), 0);
};
const makeIndicator = (code, family, numerator, denominator, formula) => {
  const numeratorValue = optionalNumber(numerator);
  const hasDenominator = denominator !== undefined;
  const denominatorValue = hasDenominator ? optionalNumber(denominator) : undefined;
  const value = numeratorValue === null ? null : hasDenominator ? safeDivide(numeratorValue, denominatorValue) : numeratorValue;
  const validationCode = numeratorValue === null ? 'INDICATOR_SOURCE_UNAVAILABLE' : hasDenominator && (denominatorValue === null || denominatorValue === 0) ? 'INDICATOR_DENOMINATOR_UNAVAILABLE' : null;
  return { indicator_code: code, indicator_family: family, value, confidence_level: value === null ? 'low' : 'high', warning: validationCode, validation_code: validationCode, formula, formula_version: GENERATED_ENGINE_CONTRACT.formula_version };
};
function buildStatements(sourceValues, registry) {
  const values = {};
  for (const key of Object.keys(registry.rubrics)) values[key] = optionalNumber(sourceValues[key]);
  for (const [key, meta] of Object.entries(registry.calculated)) values[key] = evaluate(values, meta.operands, meta.coefficients);
  for (const [key, meta] of Object.entries(registry.totals)) values[key] = evaluate(values, meta.component_keys, meta.component_keys.map(() => 1));
  values.total_passivo_pl = values.total_passivo_patrimonio_liquido;
  values.resultado_operacional = values.ebit;
  values.resultado_financeiro_liquido = values.resultado_financeiro;
  values.resultado_antes_ir = values.resultado_antes_ir_csll;
  return values;
}
function calculateKanitz(v) {
  const pl = optionalNumber(v.total_patrimonio_liquido), passivo = optionalNumber(v.total_passivo);
  const realizavel = sumRequiredSources(v, ['total_ativo_circulante','ativo_nc_receber_lp','ativo_nc_impostos_lp','ativo_nc_outros_creditos']);
  const ac = optionalNumber(v.total_ativo_circulante), estoques = optionalNumber(v.ativo_circulante_estoques);
  const components = {
    rentabilidade_do_pl: safeDivide(v.resultado_liquido, pl),
    liquidez_geral: safeDivide(realizavel, passivo),
    liquidez_seca: safeDivide(ac === null || estoques === null ? null : ac - estoques, v.total_passivo_circulante),
    liquidez_corrente: safeDivide(ac, v.total_passivo_circulante),
    capital_de_terceiros_sobre_pl: safeDivide(passivo, pl)
  };
  const available = Object.values(components).every((value) => value !== null);
  const value = available ? 0.05*components.rentabilidade_do_pl + 1.65*components.liquidez_geral + 3.55*components.liquidez_seca - 1.06*components.liquidez_corrente - 0.33*components.capital_de_terceiros_sobre_pl : null;
  const sourceUnavailable = pl === null || passivo === null || optionalNumber(v.resultado_liquido) === null;
  return { value, components, confidence_level: pl === null || pl <= 0 || value === null ? 'low' : 'high', warning: sourceUnavailable ? 'INDICATOR_SOURCE_UNAVAILABLE' : pl <= 0 ? 'KANITZ_PL_NON_POSITIVE' : value === null ? 'INDICATOR_DENOMINATOR_UNAVAILABLE' : null };
}
function calculateIndicators(v) {
  const disponibilidade = sumRequiredSources(v, ['ativo_circulante_caixa','ativo_circulante_aplicacoes_liquidez_imediata']);
  const dividaBruta = sumRequiredSources(v, ['passivo_circulante_emprestimos','passivo_circulante_arrendamentos','passivo_nao_circulante','passivo_nc_arrendamentos_lp']);
  const dividaLiquida = dividaBruta === null || disponibilidade === null ? null : dividaBruta - disponibilidade;
  const realizavel = sumRequiredSources(v, ['total_ativo_circulante','ativo_nc_receber_lp','ativo_nc_impostos_lp','ativo_nc_outros_creditos']);
  const ac = optionalNumber(v.total_ativo_circulante), pc = optionalNumber(v.total_passivo_circulante), estoque = optionalNumber(v.ativo_circulante_estoques);
  const custo = optionalNumber(v.custos), custoAbs = custo === null ? null : Math.abs(custo);
  const clientes = optionalNumber(v.ativo_circulante_receber), fornecedores = optionalNumber(v.passivo_circulante_fornecedores);
  const pmr = clientes === null ? null : safeDivide(clientes * 360, v.receita_bruta);
  const pmp = fornecedores === null ? null : safeDivide(fornecedores * 360, custoAbs);
  const pme = estoque === null ? null : safeDivide(estoque * 360, custoAbs);
  const list = [
    makeIndicator('liquidez_corrente','liquidez',ac,pc,'AC / PC'), makeIndicator('liquidez_seca','liquidez',ac===null||estoque===null?null:ac-estoque,pc,'(AC - Estoques) / PC'),
    makeIndicator('liquidez_imediata','liquidez',disponibilidade,pc,'Disponibilidade imediata / PC'), makeIndicator('liquidez_geral','liquidez',realizavel,v.total_passivo,'Realizável / Passivo exigível'),
    makeIndicator('capital_circulante_liquido','capital_giro',ac===null||pc===null?null:ac-pc,undefined,'AC - PC'), makeIndicator('passivo_sobre_ativo','endividamento',v.total_passivo ?? null,v.total_ativo ?? null,'Passivo / Ativo'),
    makeIndicator('capital_terceiros_sobre_pl','estrutura_capital',v.total_passivo ?? null,v.total_patrimonio_liquido ?? null,'Passivo / PL'), makeIndicator('divida_liquida','endividamento',dividaLiquida,undefined,'Dívida bruta - disponibilidade'),
    makeIndicator('divida_liquida_sobre_ebitda','endividamento',dividaLiquida,v.ebitda ?? null,'Dívida líquida / EBITDA'), makeIndicator('composicao_endividamento','endividamento',pc,v.total_passivo ?? null,'PC / Passivo'),
    makeIndicator('margem_bruta','margens',v.lucro_bruto,v.receita_liquida ?? null,'Lucro bruto / Receita líquida'), makeIndicator('margem_ebit','margens',v.ebit,v.receita_liquida ?? null,'EBIT / Receita líquida'),
    makeIndicator('margem_ebitda','margens',v.ebitda,v.receita_liquida ?? null,'EBITDA / Receita líquida'), makeIndicator('margem_liquida','margens',v.resultado_liquido,v.receita_liquida ?? null,'Resultado líquido / Receita líquida'),
    makeIndicator('roa','rentabilidade',v.resultado_liquido,v.total_ativo ?? null,'Resultado líquido / Ativo'), makeIndicator('roe','rentabilidade',v.resultado_liquido,v.total_patrimonio_liquido ?? null,'Resultado líquido / PL'),
    makeIndicator('giro_ativo','atividade',v.receita_liquida,v.total_ativo ?? null,'Receita líquida / Ativo'), makeIndicator('prazo_medio_recebimento','atividade',pmr,undefined,'Clientes × 360 / Receita bruta'),
    makeIndicator('prazo_medio_pagamento','atividade',pmp,undefined,'Fornecedores × 360 / |Custos|'), makeIndicator('prazo_medio_estoque','atividade',pme,undefined,'Estoques × 360 / |Custos|'),
    makeIndicator('ciclo_operacional','atividade',pmr===null||pme===null?null:pmr+pme,undefined,'PMR + PME'), makeIndicator('ciclo_financeiro','atividade',pmr===null||pme===null||pmp===null?null:pmr+pme-pmp,undefined,'Ciclo operacional - PMP')
  ];
  const kanitz = calculateKanitz(v);
  list.push({ indicator_code:'kanitz_fator_insolvencia', indicator_family:'solvencia', value:kanitz.value, confidence_level:kanitz.confidence_level, warning:kanitz.warning, validation_code:kanitz.warning, formula:'0,05×RPL + 1,65×LG + 3,55×LS - 1,06×LC - 0,33×PCT', formula_version:GENERATED_ENGINE_CONTRACT.formula_version, components:kanitz.components });
  return list;
}
// END GENERATED FAL FINANCIAL ENGINE

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const registryResponse = await base44.functions.invoke('getFinancialCanonicalRegistry', { mode: 'full' });
    const registry = registryResponse?.data || registryResponse;
    if (!registry?.validation?.valid || registry.version !== GENERATED_ENGINE_CONTRACT.registry_version) return Response.json({ error: 'FINANCIAL_REGISTRY_UNAVAILABLE' }, { status: 503 });
    if (body.action === 'contract') return Response.json({ ...GENERATED_ENGINE_CONTRACT, registry_hash: registry.hash });
    if (body.action === 'validate_entry') {
      const entry = body.entry || {};
      const debit = registry.rubrics?.[entry.debit_canonical_key], credit = registry.rubrics?.[entry.credit_canonical_key];
      const errors = [];
      if (!debit?.elimination_eligible || !credit?.elimination_eligible) errors.push({ code: 'ELIMINATION_SOURCE_RUBRIC_REQUIRED' });
      if (debit && credit && debit.statement_code !== credit.statement_code && !body.allow_cross_statement) errors.push({ code: 'ELIMINATION_STATEMENT_MISMATCH' });
      if (!Number.isFinite(Number(entry.amount)) || Number(entry.amount) <= 0) errors.push({ code: 'ELIMINATION_AMOUNT_INVALID' });
      const justification = String(entry.justification ?? entry.rationale ?? '').trim();
      if (!justification) errors.push({ code: 'ELIMINATION_JUSTIFICATION_REQUIRED' });
      if (entry.justification != null && entry.rationale != null && String(entry.justification).trim() !== String(entry.rationale).trim()) errors.push({ code: 'ELIMINATION_JUSTIFICATION_CONFLICT' });
      if (!entry.origin_entity_id || !entry.destination_entity_id || entry.origin_entity_id === entry.destination_entity_id) errors.push({ code: 'ELIMINATION_SAME_ENTITY' });
      let journal_effects = null;
      try { journal_effects = { debit: calculateJournalPresentationEffect({ rubric: debit, side: 'debit', amount: entry.amount }), credit: calculateJournalPresentationEffect({ rubric: credit, side: 'credit', amount: entry.amount }) }; } catch (error) { errors.push({ code: error.message }); }
      return Response.json({ valid: errors.length === 0, errors, statement_code: debit?.statement_code || null, normalized_justification: justification, journal_effects });
    }
    const statements = buildStatements(body.source_values || {}, registry);
    const expected = optionalNumber(statements.total_ativo), actual = optionalNumber(statements.total_passivo_patrimonio_liquido);
    const difference = expected === null || actual === null ? null : Math.round(Math.abs(expected - actual) * 100) / 100;
    const balanced = difference !== null && difference <= GENERATED_ENGINE_CONTRACT.bp_tolerance;
    const code = expected === null || actual === null ? 'BP_SOURCE_UNAVAILABLE' : !Number.isFinite(expected) || !Number.isFinite(actual) ? 'BP_NON_FINITE_TOTAL' : balanced ? null : 'BP_ACCOUNTING_EQUATION_MISMATCH';
    const bp = { expected, actual, difference, balanced, validation: balanced ? null : { severity:'blocking', blocking:true, category:'balancete', code, expected, actual, difference } };
    const indicators = balanced ? calculateIndicators(statements) : [];
    return Response.json({ registry_version:registry.version, formula_version:GENERATED_ENGINE_CONTRACT.formula_version, statements, bp, indicators });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});