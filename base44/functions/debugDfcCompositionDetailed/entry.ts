/**
 * debugDfcCompositionDetailed — READ-ONLY diagnostic.
 * Reconstrói, rubrica por rubrica, a composição da DFC indireta gerada pelo
 * buildFinancialStatements, para localizar a origem de divergências materiais
 * na variação de caixa. NÃO grava nada, NÃO altera buildFinancialStatements.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

function norm(s) {
  return String(s ?? '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Réplica exata do mapa determinístico usado em buildFinancialStatements/entry.ts
const CANONICAL_DFC_BUCKET = {
  ativo_circulante_caixa:      'cash',
  ativo_circulante_receber:    'operating_asset',
  ativo_circulante_estoques:   'operating_asset',
  ativo_circulante_impostos:   'operating_asset',
  ativo_circulante_biologicos: 'operating_asset',
  ativo_circulante_outros:     'operating_asset',
  ativo_biologico:             'operating_asset',
  ativo_nc_aplicacoes:         'requires_review',
  ativo_nc_receber_lp:         'requires_review',
  ativo_nc_impostos_lp:        'requires_review',
  ativo_nc_impostos_diferidos: 'requires_review',
  ativo_nc_outros_creditos:    'requires_review',
  ativo_nc_investimentos:      'investing',
  ativo_nc_direitos_uso:       'investing',
  ativo_nao_circulante:        'investing',
  ativo_nc_intangivel:         'investing',
  passivo_circulante_trabalhistas:  'operating_liability',
  passivo_circulante_fiscais:       'operating_liability',
  obrigacoes_tributarias:           'operating_liability',
  passivo_circulante_fornecedores:  'operating_liability',
  fornecedores:                     'operating_liability',
  passivo_circulante_emprestimos:   'financing',
  passivo_circulante_imoveis:       'requires_review',
  passivo_circulante_arrendamentos: 'financing',
  passivo_circulante_adiantamentos: 'operating_liability',
  passivo_circulante_outros:        'operating_liability',
  outras_obrigacoes:                'operating_liability',
  passivo_nao_circulante:      'financing',
  passivo_nc_imoveis_lp:       'requires_review',
  passivo_nc_arrendamentos_lp: 'financing',
  patrimonio_capital:              'financing',
  patrimonio_reservas:             'requires_review',
  patrimonio_reservas_fiscais:     'requires_review',
  patrimonio_liquido:              'ignored',
  patrimonio_prejuizos:            'ignored',
  'lucros_(prejuizos)_acumulados': 'ignored',
  resultado_do_exercicio:          'ignored',
  lucro_do_exercicio:              'ignored',
  prejuizo_do_exercicio:           'ignored',
  total_ativo:      'ignored',
  total_passivo_pl: 'ignored',
};

function inferDfcBucketFromRubric(meta) {
  const t = norm([meta?.rubric_label, meta?.canonical_key].filter(Boolean).join(' '));
  const group = norm(meta?.group_label || '');
  if (t.includes('caixa') || t.includes('banco') || t.includes('equivalente') || t.includes('disponibilidade')) return 'cash';
  if (t.includes('emprestimo') || t.includes('financiamento') || t.includes('debenture') || t.includes('arrendamento')) return 'financing';
  if (t.includes('capital social') || t.includes('integralizacao') || t.includes('dividendo') ||
      t.includes('distribuicao de lucro') || t.includes('reserva de capital')) return 'financing';
  if (t.includes('imobilizado') || t.includes('intangivel') || t.includes('investimento') ||
      t.includes('obras em andamento') || t.includes('propriedade para investimento')) return 'investing';
  if (t.includes('total do ativo') || t.includes('total passivo') || t.includes('lucros acumulados') ||
      t.includes('prejuizos acumulados') || t.includes('resultado do exercicio')) return 'ignored';
  if (group.includes('ativo circulante')) return 'operating_asset';
  if (group.includes('passivo circulante')) return 'operating_liability';
  return 'requires_review';
}

function resolveBucketWithSource(canonical_key, meta) {
  if (CANONICAL_DFC_BUCKET[canonical_key]) {
    return { bucket: CANONICAL_DFC_BUCKET[canonical_key], source: 'canonical_map' };
  }
  return { bucket: inferDfcBucketFromRubric(meta), source: 'textual_inference' };
}

function reasonFor(canonical_key, meta, bucket, source) {
  if (canonical_key === 'total_ativo' || canonical_key === 'total_passivo_pl') {
    return 'Linha totalizadora do BP — sempre ignorada na DFC (evita dupla contagem).';
  }
  if (['patrimonio_liquido', 'patrimonio_prejuizos', 'lucros_(prejuizos)_acumulados', 'resultado_do_exercicio', 'lucro_do_exercicio', 'prejuizo_do_exercicio'].includes(canonical_key)) {
    return 'Lucros/prejuízos acumulados ou resultado no PL — ignorado pois o resultado já entra pela DRE (resultado_liquido).';
  }
  if (bucket === 'cash') return 'Identificado como caixa/equivalentes — usado para caixa inicial/final, não gera impacto operacional direto.';
  if (bucket === 'requires_review' && source === 'canonical_map') return 'Rubrica de longo prazo ambígua (mapa canônico marca requires_review) — não classificável automaticamente com segurança.';
  if (bucket === 'requires_review') return 'Rubrica não reconhecida por nenhuma regra — nem canonical_map nem inferência textual. Requer classificação manual.';
  if (bucket === 'operating_asset') return `Classificado como ativo operacional via ${source === 'canonical_map' ? 'mapa canônico' : 'inferência textual (grupo ' + (meta.group_label || '?') + ')'}.`;
  if (bucket === 'operating_liability') return `Classificado como passivo operacional via ${source === 'canonical_map' ? 'mapa canônico' : 'inferência textual (grupo ' + (meta.group_label || '?') + ')'}.`;
  if (bucket === 'investing') return `Classificado como investimento via ${source === 'canonical_map' ? 'mapa canônico' : 'inferência textual (imobilizado/intangível/investimentos)'}.`;
  if (bucket === 'financing') return `Classificado como financiamento via ${source === 'canonical_map' ? 'mapa canônico' : 'inferência textual (empréstimo/capital/dividendo)'}.`;
  return 'Ignorado.';
}

function impactFor(bucket, delta) {
  switch (bucket) {
    case 'operating_asset':     return -delta;
    case 'operating_liability': return delta;
    case 'investing':           return -delta;
    case 'financing':           return delta;
    default:                    return 0; // cash, ignored, requires_review não entram no cálculo
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: função de debug restrita a hq_admin' }, { status: 403 });

  const body = await req.json();
  const { financial_diagnosis_id } = body;
  if (!financial_diagnosis_id) return Response.json({ error: 'financial_diagnosis_id é obrigatório' }, { status: 400 });

  try {
    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });

    // 1. BP lines (todas as origens/uploads do diagnóstico)
    const bpLines = await base44.asServiceRole.entities.FinancialStatementLine.filter(
      { financial_diagnosis_id, statement_code: 'BP' }, 'period', 5000
    );
    // 2. resultado_liquido (DRE) por período
    const resultLines = await base44.asServiceRole.entities.FinancialStatementLine.filter(
      { financial_diagnosis_id, canonical_key: 'resultado_liquido' }, 'period', 500
    );
    // 3. DFC já persistida (para comparar com o que reportamos aqui)
    const dfcLines = await base44.asServiceRole.entities.FinancialStatementLine.filter(
      { financial_diagnosis_id, statement_code: 'DFC' }, 'display_order', 500
    );
    // 4. Plano de contas — para checar dfc_classification (ajustes sem efeito caixa)
    let accountPlanLines = [];
    if (diagnosis.account_plan_id) {
      accountPlanLines = await base44.asServiceRole.entities.FinancialAccountPlanLine.filter(
        { account_plan_id: diagnosis.account_plan_id }, 'account_code', 5000
      );
    }

    // ── Monta bpValuesByPeriod e bpMetaByCanonicalKey (igual buildFinancialStatements) ──
    const bpValuesByPeriod = {};
    const bpMetaByCanonicalKey = {};
    for (const sl of bpLines) {
      if (!bpValuesByPeriod[sl.period]) bpValuesByPeriod[sl.period] = {};
      bpValuesByPeriod[sl.period][sl.canonical_key] = sl.value;
      if (!bpMetaByCanonicalKey[sl.canonical_key]) {
        bpMetaByCanonicalKey[sl.canonical_key] = {
          canonical_key: sl.canonical_key,
          rubric_label:  sl.rubric_label,
          group_label:   sl.group_label,
          statement_code: sl.statement_code,
        };
      }
    }
    const netIncomeByPeriod = {};
    for (const sl of resultLines) netIncomeByPeriod[sl.period] = sl.value;

    const periods = Object.keys(bpValuesByPeriod).sort();
    if (periods.length < 2) {
      return Response.json({ error: `Apenas ${periods.length} período(s) BP encontrado(s) — impossível comparar.`, periods });
    }
    const previousPeriod = periods[periods.length - 2];
    const currentPeriod  = periods[periods.length - 1];
    const prevBp = bpValuesByPeriod[previousPeriod] || {};
    const currBp = bpValuesByPeriod[currentPeriod]  || {};
    const allCanonicalKeys = [...new Set([...Object.keys(prevBp), ...Object.keys(currBp)])];

    // ── Composição rubrica por rubrica ──
    const composition = [];
    for (const canonical_key of allCanonicalKeys) {
      const meta = bpMetaByCanonicalKey[canonical_key] || { canonical_key };
      const { bucket, source } = resolveBucketWithSource(canonical_key, meta);
      const previousValue = prevBp[canonical_key] ?? 0;
      const currentValue  = currBp[canonical_key] ?? 0;
      const delta = currentValue - previousValue;
      const impact = impactFor(bucket, delta);
      composition.push({
        rubric_key: canonical_key,
        rubric_label: meta.rubric_label || canonical_key,
        canonical_key,
        group_label: meta.group_label || null,
        previousPeriod,
        currentPeriod,
        previousValue,
        currentValue,
        delta,
        resolved_bucket: bucket,
        bucket_source: source,
        impact_on_dfc: impact,
        reason: reasonFor(canonical_key, meta, bucket, source),
      });
    }

    // ── Agrupamento por bucket ──
    const bucketOrder = ['cash', 'operating_asset', 'operating_liability', 'investing', 'financing', 'ignored', 'requires_review'];
    const buckets = {};
    for (const b of bucketOrder) buckets[b] = { bucket: b, count: 0, sum_delta: 0, sum_impact: 0, items: [] };
    for (const row of composition) {
      const b = buckets[row.resolved_bucket] || (buckets[row.resolved_bucket] = { bucket: row.resolved_bucket, count: 0, sum_delta: 0, sum_impact: 0, items: [] });
      b.count += 1;
      b.sum_delta += row.delta;
      b.sum_impact += row.impact_on_dfc;
      b.items.push(row.rubric_key);
    }

    const cashRows = composition.filter(r => r.resolved_bucket === 'cash');
    const cashInitial = cashRows.reduce((s, r) => s + r.previousValue, 0);
    const cashFinal   = cashRows.reduce((s, r) => s + r.currentValue, 0);
    const cashVariationReal = cashFinal - cashInitial;

    const operatingAssetVariation    = buckets['operating_asset'].sum_impact;
    const operatingLiabilityVariation = buckets['operating_liability'].sum_impact;
    const investingCashFlow  = buckets['investing'].sum_impact;
    const financingCashFlow  = buckets['financing'].sum_impact;
    const netIncome = netIncomeByPeriod[currentPeriod] ?? 0;
    const nonCashAdjustmentLine = dfcLines.find(l => l.canonical_key === 'dfc_ajustes_sem_efeito_caixa');
    const nonCashAdjustments = nonCashAdjustmentLine?.value ?? 0;
    const operatingCashFlow = netIncome + nonCashAdjustments + operatingAssetVariation + operatingLiabilityVariation;
    const cashVariationCalculated = operatingCashFlow + investingCashFlow + financingCashFlow;
    const validationDifference = cashVariationReal - cashVariationCalculated;

    // ── Validações específicas ──
    const totalizerKeys = ['total_ativo', 'total_passivo_pl'];
    const totalizersEnteredDfc = composition.filter(r => totalizerKeys.includes(r.canonical_key) && r.resolved_bucket !== 'ignored');

    const plTotalRow = composition.find(r => r.canonical_key === 'patrimonio_liquido');
    const prejuizosRow = composition.find(r => r.canonical_key === 'patrimonio_prejuizos' || r.canonical_key === 'lucros_(prejuizos)_acumulados');
    const resultadoNoPlRow = composition.find(r => ['resultado_do_exercicio', 'lucro_do_exercicio', 'prejuizo_do_exercicio'].includes(r.canonical_key));

    const emprestimosRows = composition.filter(r => /emprestimo|financiamento|arrendamento|debenture/.test(norm(r.rubric_label)));
    const emprestimosAllFinancing = emprestimosRows.length > 0 && emprestimosRows.every(r => r.resolved_bucket === 'financing');

    const investingCandidateRows = composition.filter(r => /imobilizad|intangivel|investiment|direito de uso/.test(norm(r.rubric_label)));
    const investingAllCorrect = investingCandidateRows.length > 0 && investingCandidateRows.every(r => r.resolved_bucket === 'investing');

    const activoCirculanteOperacional = composition.filter(r => norm(r.group_label || '').includes('ativo circulante') && r.canonical_key !== 'ativo_circulante_caixa');
    const ativoCirculanteAllOperating = activoCirculanteOperacional.length > 0 && activoCirculanteOperacional.every(r => r.resolved_bucket === 'operating_asset');

    const passivoCirculanteOperacional = composition.filter(r => norm(r.group_label || '').includes('passivo circulante') && r.resolved_bucket !== 'financing');
    const passivoCirculanteAllOperating = passivoCirculanteOperacional.length > 0 && passivoCirculanteOperacional.every(r => r.resolved_bucket === 'operating_liability');

    // ── Ajustes sem efeito caixa: contas do plano com dfc_classification, DRE ──
    const dfcClassifiedAccounts = accountPlanLines.filter(l => l.dfc_classification);
    const depreciationLike = dfcClassifiedAccounts.filter(l => /deprecia|amortiz|provis|impairment/.test(norm(l.dfc_classification)));

    const top20ByImpact = [...composition]
      .sort((a, b) => Math.abs(b.impact_on_dfc || 0) - Math.abs(a.impact_on_dfc || 0))
      .slice(0, 20);

    const requiresReviewList = composition.filter(r => r.resolved_bucket === 'requires_review');
    const ignoredList = composition.filter(r => r.resolved_bucket === 'ignored');

    return Response.json({
      diagnosis_id: financial_diagnosis_id,
      previousPeriod,
      currentPeriod,
      composition,
      buckets: bucketOrder.map(b => ({
        bucket: b,
        count: buckets[b].count,
        sum_delta: buckets[b].sum_delta,
        sum_impact: buckets[b].sum_impact,
      })),
      totals: {
        total_bp_lines_considered: allCanonicalKeys.length,
        total_ignored: ignoredList.length,
        total_requires_review: requiresReviewList.length,
        total_cash_rubrics: cashRows.length,
        cash_initial: cashInitial,
        cash_final: cashFinal,
        cash_variation_real: cashVariationReal,
        operating_asset_variation: operatingAssetVariation,
        operating_liability_variation: operatingLiabilityVariation,
        investing_cash_flow: investingCashFlow,
        financing_cash_flow: financingCashFlow,
        net_income: netIncome,
        non_cash_adjustments: nonCashAdjustments,
        operating_cash_flow: operatingCashFlow,
        cash_variation_calculated: cashVariationCalculated,
        validation_difference: validationDifference,
      },
      validations: {
        totalizers_entered_dfc: totalizersEnteredDfc.length > 0 ? totalizersEnteredDfc : 'nenhum — OK',
        patrimonio_liquido_total: plTotalRow ? { canonical_key: plTotalRow.canonical_key, bucket: plTotalRow.resolved_bucket, value: plTotalRow.currentValue } : 'não encontrado no BP',
        lucros_prejuizos_acumulados: prejuizosRow ? { canonical_key: prejuizosRow.canonical_key, bucket: prejuizosRow.resolved_bucket, value: prejuizosRow.currentValue } : 'não encontrado no BP',
        resultado_periodo_no_pl: resultadoNoPlRow ? { canonical_key: resultadoNoPlRow.canonical_key, bucket: resultadoNoPlRow.resolved_bucket, value: resultadoNoPlRow.currentValue } : 'não encontrado separadamente no BP (pode estar somado em patrimonio_liquido via vazão DRE→PL)',
        emprestimos_financiamentos_all_financing: emprestimosRows.length === 0 ? 'nenhuma rubrica de dívida encontrada' : emprestimosAllFinancing,
        emprestimos_rows: emprestimosRows,
        imobilizado_intangivel_investimentos_all_investing: investingCandidateRows.length === 0 ? 'nenhuma rubrica candidata encontrada' : investingAllCorrect,
        investing_candidate_rows: investingCandidateRows,
        ativo_circulante_operacional_all_operating_asset: activoCirculanteOperacional.length === 0 ? 'nenhuma rubrica encontrada' : ativoCirculanteAllOperating,
        passivo_circulante_operacional_all_operating_liability: passivoCirculanteOperacional.length === 0 ? 'nenhuma rubrica encontrada' : passivoCirculanteAllOperating,
        dfc_classified_accounts_in_plan: dfcClassifiedAccounts.length,
        depreciation_amortization_provision_accounts_found: depreciationLike.length,
        depreciation_accounts_sample: depreciationLike.slice(0, 10).map(l => ({ account_code: l.account_code, account_name: l.account_name, dfc_classification: l.dfc_classification })),
        non_cash_adjustments_is_zero_reason: nonCashAdjustments === 0
          ? (depreciationLike.length === 0 ? 'Zero por ausência de contas marcadas com dfc_classification de depreciação/amortização/provisão no plano — não é erro, é ausência de marcação.' : 'Zero mesmo havendo contas marcadas — investigar mapeamento de account_code no upload.')
          : 'non_cash_adjustments != 0, sem problema a reportar aqui.',
      },
      top_20_by_absolute_impact: top20ByImpact,
      requires_review_list: requiresReviewList,
      ignored_list: ignoredList,
      persisted_dfc_lines: dfcLines,
      probable_diagnosis: 'Ver campo "totals" e "validations" acima — comparar sum_impact por bucket com persisted_dfc_lines para localizar rubricas que mais contribuem para a diferença de validação.',
    });
  } catch (err) {
    return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
});