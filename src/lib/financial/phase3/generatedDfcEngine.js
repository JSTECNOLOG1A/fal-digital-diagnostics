// GENERATED from base44/functions/buildFinancialStatements/entry.ts; do not edit manually.
let CANONICAL_DFC_BUCKET = {};
export function setCanonicalDfcBucket(value = {}) { CANONICAL_DFC_BUCKET = { ...value }; }

function norm(s) {
  return String(s ?? '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function inferDfcBucketFromRubric(meta) {
  const t = norm([meta?.rubric_label, meta?.rubric_label_excel, meta?.canonical_key].filter(Boolean).join(' '));
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

function resolveDfcBucket(canonical_key, meta, overrideMap) {
  const override = overrideMap?.get?.(canonical_key);
  if (override?.manual_bucket) return override.manual_bucket;
  if (CANONICAL_DFC_BUCKET[canonical_key]) return CANONICAL_DFC_BUCKET[canonical_key];
  return inferDfcBucketFromRubric(meta);
}

export function buildIndirectCashFlow({
  periods, bpValuesByPeriod, bpMetaByCanonicalKey, netIncomeByPeriod, nonCashAdjustmentByPeriod,
  nonCashAdjustmentDetailByPeriod, manualAdjustmentByPeriod = {},
  financialDiagnosisId, financialUploadId, tenantId, entityCode, colMetaMap, overrideMap,
}) {
  const baseValidation = (code, title, message) => ({
    financial_diagnosis_id: financialDiagnosisId,
    financial_upload_id:    financialUploadId,
    tenant_id:              tenantId,
    severity:               'warning',
    category:               'dfc_composicao',
    code, title, message,
  });

  if (!periods || periods.length < 2) {
    return { lines: [], compositionLines: [], validations: [baseValidation('DFC_PREVIOUS_PERIOD_REQUIRED', 'DFC indireta não gerada', 'DFC indireta exige pelo menos dois períodos comparáveis.')] };
  }
  const BUCKET_REASON = { cash: 'Identificado como caixa e equivalentes', operating_asset: 'Ativo operacional — aumento reduz caixa', operating_liability: 'Passivo operacional — aumento gera caixa', investing: 'Ativo de investimento — aumento reduz caixa', financing: 'Financiamento — aumento gera caixa', ignored: 'Rubrica não entra diretamente na DFC (PL/totais)', requires_review: 'Rubrica não classificada automaticamente — requer revisão manual' };
  const computeImpact = (bucket, delta) => bucket === 'operating_asset' ? -delta : bucket === 'operating_liability' ? delta : bucket === 'investing' ? -delta : bucket === 'financing' ? delta : 0;
  const sorted = [...periods].sort();
  const allLines = [], allCompositionLines = [], allValidations = [], allReconciliations = [];
  // Gera a DFC para CADA par consecutivo (prev → curr) — antes só o último par.
  // Com 3 anos (2023, 2024, 2025): gera DFC 2024 (2023→2024) e DFC 2025 (2024→2025).
  for (let pi = 1; pi < sorted.length; pi++) {
    const previousPeriod = sorted[pi - 1], currentPeriod = sorted[pi];
    const prevBp = bpValuesByPeriod[previousPeriod] || {}, currBp = bpValuesByPeriod[currentPeriod] || {}, cMeta = colMetaMap?.[currentPeriod];
    const allCanonicalKeys = new Set([...Object.keys(prevBp), ...Object.keys(currBp)]);
    let cashInitial = 0, cashFinal = 0, operatingAssetVariation = 0, operatingLiabilityVariation = 0, investingCashFlow = 0, financingCashFlow = 0;
    const compositionLines = [];
    for (const canonical_key of allCanonicalKeys) {
      const meta = bpMetaByCanonicalKey[canonical_key] || { canonical_key };
      const override = overrideMap?.get?.(canonical_key);
      let bucket, bucketSource;
      if (override?.manual_bucket) { bucket = override.manual_bucket; bucketSource = 'manual_override'; }
      else if (CANONICAL_DFC_BUCKET[canonical_key]) { bucket = CANONICAL_DFC_BUCKET[canonical_key]; bucketSource = 'canonical_map'; }
      else { bucket = inferDfcBucketFromRubric(meta); bucketSource = 'text_inference'; }
      const previousValue = prevBp[canonical_key] ?? 0, currentValue = currBp[canonical_key] ?? 0;
      const delta = currentValue - previousValue, impact = computeImpact(bucket, delta);
      if (bucket === 'cash') { cashInitial += previousValue; cashFinal += currentValue; }
      else if (bucket === 'operating_asset') operatingAssetVariation += -delta;
      else if (bucket === 'operating_liability') operatingLiabilityVariation += delta;
      else if (bucket === 'investing') investingCashFlow += -delta;
      else if (bucket === 'financing') financingCashFlow += delta;
      compositionLines.push({ financial_diagnosis_id: financialDiagnosisId, financial_upload_id: financialUploadId, tenant_id: tenantId, period: currentPeriod, comparison_period: previousPeriod, rubric_key: canonical_key, rubric_label: meta.rubric_label || canonical_key, canonical_key, group_label: meta.group_label || null, previous_value: previousValue, current_value: currentValue, delta, bucket, bucket_source: bucketSource, impact_on_dfc: impact, reason: BUCKET_REASON[bucket] || null, status: bucket === 'requires_review' ? 'requires_review' : 'active' });
    }
    const nonCashDetail = nonCashAdjustmentDetailByPeriod?.[currentPeriod];
    if (nonCashDetail?.accounts?.length) {
      for (const acc of nonCashDetail.accounts) {
        compositionLines.push({ financial_diagnosis_id: financialDiagnosisId, financial_upload_id: financialUploadId, tenant_id: tenantId, period: currentPeriod, comparison_period: previousPeriod, rubric_key: acc.account_code || acc.account_name || 'non_cash_adjustment', rubric_label: acc.account_name || acc.account_code || 'Ajuste sem efeito caixa', canonical_key: null, group_label: 'Ajustes sem efeito caixa', previous_value: 0, current_value: acc.value || 0, delta: acc.value || 0, bucket: 'non_cash_adjustment', bucket_source: 'dfc_classification', impact_on_dfc: acc.value || 0, reason: 'Ajuste sem efeito caixa (DRE via dfc_classification)', status: 'active' });
      }
    }
    const netIncome = netIncomeByPeriod[currentPeriod] ?? 0, nonCashAdjustments = nonCashAdjustmentByPeriod[currentPeriod] ?? 0;
    const cashKeys = [...allCanonicalKeys].filter((key) => resolveDfcBucket(key, bpMetaByCanonicalKey[key] || { canonical_key: key }, overrideMap) === 'cash');
    const hasFiniteSource = (record, key) => record[key] !== null && record[key] !== undefined && Number.isFinite(Number(record[key]));
    const cashIdentified = cashKeys.some((key) => hasFiniteSource(prevBp, key) || hasFiniteSource(currBp, key));
    if (!cashIdentified) { allValidations.push(baseValidation('DFC_MISSING_CASH_BASE', 'DFC não gerada — caixa não identificado', `DFC não gerada para o período ${currentPeriod}: caixa não identificado nas rubricas patrimoniais de ${previousPeriod} e ${currentPeriod}.`)); continue; }
    if (allCanonicalKeys.size < 2) { allValidations.push(baseValidation('DFC_INCOMPLETE_BALANCE_BASE', 'DFC não gerada — base patrimonial insuficiente', `DFC não gerada para o período ${currentPeriod}: base patrimonial insuficiente entre ${previousPeriod} e ${currentPeriod}.`)); continue; }
    const manual = manualAdjustmentByPeriod[currentPeriod] || {};
    operatingAssetVariation += Number(manual.operating) || 0;
    investingCashFlow += Number(manual.investing) || 0;
    financingCashFlow += Number(manual.financing) || 0;
    const cashVariationReal = cashFinal - cashInitial;
    const operatingCashFlow = netIncome + nonCashAdjustments + operatingAssetVariation + operatingLiabilityVariation;
    const cashVariationCalculated = operatingCashFlow + investingCashFlow + financingCashFlow;
    const validationDifference = cashVariationReal - cashVariationCalculated;
    const roundedValidationDifference = Math.round(validationDifference * 100) / 100;
    const toleranceValue = 0.01;
    const line = (canonical_key, label, value, displayOrder, lineType) => ({ financial_upload_id: financialUploadId, financial_diagnosis_id: financialDiagnosisId, tenant_id: tenantId, entity_code: entityCode, period: currentPeriod, statement_code: 'DFC', group_label: 'Fluxo de Caixa', rubric_label: label, line_type: lineType, display_order: displayOrder, canonical_key, statement_family: 'cash_flow', statement_section: 'Fluxo de Caixa', managerial_group: 'Fluxo de Caixa', managerial_rubric: canonical_key, value: Number(value) || 0, is_consolidated: false, composition_account_codes: [], ...(cMeta ? { column_key: cMeta.column_key, column_label: cMeta.column_label, period_type: cMeta.period_type } : {}) });
    const lines = [
      line('dfc_resultado_liquido_periodo', 'Resultado líquido do período', netIncome, 10, 'composed'),
      line('dfc_ajustes_sem_efeito_caixa', 'Ajustes sem efeito caixa', nonCashAdjustments, 20, 'composed'),
      line('dfc_variacao_ativos_operacionais', 'Variação de ativos operacionais', operatingAssetVariation, 30, 'composed'),
      line('dfc_variacao_passivos_operacionais', 'Variação de passivos operacionais', operatingLiabilityVariation, 40, 'composed'),
      line('dfc_caixa_liquido_atividades_operacionais', 'Caixa líquido das atividades operacionais', operatingCashFlow, 50, 'subtotal'),
      line('dfc_caixa_liquido_atividades_investimento', 'Caixa líquido das atividades de investimento', investingCashFlow, 60, 'subtotal'),
      line('dfc_caixa_liquido_atividades_financiamento', 'Caixa líquido das atividades de financiamento', financingCashFlow, 70, 'subtotal'),
      line('dfc_aumento_reducao_liquida_caixa', 'Aumento/redução líquida de caixa', cashVariationCalculated, 80, 'total'),
      line('dfc_caixa_inicial', 'Caixa e equivalentes no início do período', cashInitial, 90, 'total'),
      line('dfc_caixa_final', 'Caixa e equivalentes no fim do período', cashFinal, 100, 'total'),
      line('dfc_diferenca_validacao', 'Diferença de validação da DFC', roundedValidationDifference, 110, 'total'),
    ];
    const validations = [];
    if (Math.abs(roundedValidationDifference) > toleranceValue) {
      validations.push(baseValidation('DFC_CASH_VARIATION_MISMATCH', 'Divergência na variação de caixa da DFC', `Diferença entre variação real de caixa e DFC calculada: ${roundedValidationDifference.toFixed(2)}`));
    }
    const materialityBase = Math.max(Math.abs(cashFinal || 0), Math.abs(cashInitial || 0), Math.abs(netIncome || 0), 1);
    const absDiff = Math.abs(validationDifference);
    const isMaterialMismatch = absDiff > 1000 && (absDiff / materialityBase) > 0.05;
    const materialRubricImpact = (impact) => Math.abs(impact) > 1000 && (Math.abs(impact) / Math.max(Math.abs(netIncome || 0), 1)) > 0.05;
    let equityDeltaSum = 0;
    for (const canonical_key of allCanonicalKeys) {
      if (canonical_key === 'total_ativo' || canonical_key === 'total_passivo_pl') continue;
      const meta = bpMetaByCanonicalKey[canonical_key] || { canonical_key };
      if (resolveDfcBucket(canonical_key, meta, overrideMap) !== 'ignored') continue;
      if (!norm(meta.group_label || '').includes('patrimonio')) continue;
      const delta = (currBp[canonical_key] ?? 0) - (prevBp[canonical_key] ?? 0);
      if (delta === 0) continue;
      equityDeltaSum += delta;
    }
    const equityUnexplained = equityDeltaSum - netIncome;
    const equityMismatch = Math.abs(equityUnexplained) > 1000 && (Math.abs(equityUnexplained) / materialityBase) > 0.05;
    if (equityMismatch) {
      validations.push(baseValidation('DFC_EQUITY_MOVEMENT_NOT_EXPLAINED', 'Variação de PL não explicada pelo resultado líquido', `A variação em Lucros/Prejuízos acumulados não é explicada integralmente pelo resultado líquido do período. Pode haver ajuste direto no patrimônio líquido, reclassificação, diferença de abertura ou descasamento de mapeamento entre uploads. Variação PL: ${equityDeltaSum.toFixed(2)} | Resultado líquido: ${netIncome.toFixed(2)} | Diferença não explicada: ${equityUnexplained.toFixed(2)}`));
    }
    let rubricMismatchImpactSum = 0;
    const rubricsOnlyInOnePeriod = [];
    for (const canonical_key of allCanonicalKeys) {
      if (canonical_key === 'total_ativo' || canonical_key === 'total_passivo_pl') continue;
      const inPrev = Object.prototype.hasOwnProperty.call(prevBp, canonical_key);
      const inCurr = Object.prototype.hasOwnProperty.call(currBp, canonical_key);
      if (inPrev && inCurr) continue;
      const value = inPrev ? (prevBp[canonical_key] ?? 0) : (currBp[canonical_key] ?? 0);
      if (value === 0) continue;
      rubricMismatchImpactSum += Math.abs(value);
      const meta = bpMetaByCanonicalKey[canonical_key] || { canonical_key };
      rubricsOnlyInOnePeriod.push({ rubric_label: meta.rubric_label || canonical_key });
    }
    const rubricMismatchMaterial = rubricMismatchImpactSum > 1000 && (rubricMismatchImpactSum / materialityBase) > 0.05;
    if (rubricMismatchMaterial) {
      validations.push(baseValidation('DFC_PERIOD_RUBRIC_MISMATCH', 'Rubricas patrimoniais presentes em apenas um período', `Foram identificadas rubricas patrimoniais relevantes presentes em apenas um dos períodos comparados, indicando possível descasamento de plano, classificação ou mapeamento entre uploads. Rubricas: ${rubricsOnlyInOnePeriod.map(r => r.rubric_label).join(', ')}`));
    }
    const anyMaterialOperatingImpact = [operatingAssetVariation, operatingLiabilityVariation, investingCashFlow, financingCashFlow].some(materialRubricImpact);
    if (isMaterialMismatch && (anyMaterialOperatingImpact || equityMismatch || rubricMismatchMaterial)) {
      validations.push(baseValidation('DFC_CROSS_UPLOAD_MAPPING_MISMATCH', 'Alerta de comparabilidade cross-upload na DFC', 'A DFC foi gerada com alerta de comparabilidade, pois os períodos comparados pertencem a uploads independentes e apresentam variações ou rubricas que indicam possível descasamento de classificação/mapeamento entre os períodos.'));
    }
    allReconciliations.push({ previous_period: previousPeriod, current_period: currentPeriod, cash_initial: cashInitial, cash_final: cashFinal, cash_variation_real: cashVariationReal, cash_variation_calculated: cashVariationCalculated, difference: roundedValidationDifference, reconciled: Math.abs(roundedValidationDifference) <= toleranceValue });
    if (cMeta) for (const cl of compositionLines) { cl.column_key = cMeta.column_key; cl.column_label = cMeta.column_label; cl.period_type = cMeta.period_type; }
    allLines.push(...lines);
    allCompositionLines.push(...compositionLines);
    allValidations.push(...validations);
  }
  return { lines: allLines, validations: allValidations, compositionLines: allCompositionLines, reconciliation: allReconciliations, formula_version: 'FAL-FIN-3.0.0', registry_version: '3.0.0' };
}
