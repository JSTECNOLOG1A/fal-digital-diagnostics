/** buildFinancialStatements — V2.1: engine canônico dual (individual Excel + prepared dataset). */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import * as XLSX from 'npm:xlsx@0.18.5';
import { unzipSync, zipSync } from 'npm:fflate@0.8.2';

const LIFECYCLE_ENGINE_VERSION = 'FAL-FIN-LIFECYCLE-1.0.0';
const LIFECYCLE_ENGINE_HASH = '8eb5018d13d3ebaab59985b504e7bda63bbbc9f5f9e75c5453d5c7a61dfc29e9';
function lifecycleCanonicalize(value) { if (value === null || value === undefined || typeof value !== 'object') return value ?? null; if (Array.isArray(value)) return value.map(lifecycleCanonicalize); return Object.fromEntries(Object.keys(value).sort().map((key) => [key, lifecycleCanonicalize(value[key])])); }
async function invokeFinancialLifecycleDeterminismEngine(base44, operation, input) { const response = await base44.functions.invoke('financialLifecycleDeterminismEngine', { contract_version: LIFECYCLE_ENGINE_VERSION, operation, input }); const result = response?.data || response; const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input))); const fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); if (!result?.success || result.engine_version !== LIFECYCLE_ENGINE_VERSION || result.contract_hash !== LIFECYCLE_ENGINE_HASH || result.operation !== operation || result.input_fingerprint !== fingerprint) throw new Error('FINANCIAL_LIFECYCLE_ENGINE_CONTRACT_MISMATCH'); return result.decision; }

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const MINIMAL_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;

function stripStylesFromXlsx(uint8Array) {
  try {
    const files = unzipSync(uint8Array);
    const enc = new TextEncoder();
    const patched = { ...files, 'xl/styles.xml': enc.encode(MINIMAL_STYLES) };
    return zipSync(patched);
  } catch {
    return uint8Array;
  }
}

function readXlsxSafely(uint8Array) {
  try {
    return XLSX.read(uint8Array, {
      type: 'array', cellStyles: false, cellNF: false,
      cellFormula: false, cellHTML: false, defval: '', dense: false, raw: true,
    });
  } catch (e1) {
    try {
      return XLSX.read(uint8Array, {
        type: 'array', cellStyles: false, cellNF: false,
        cellFormula: false, cellHTML: false, defval: '',
      });
    } catch (e2) {
      throw new Error(`Não foi possível ler o arquivo Excel. Detalhes: ${e2.message}`);
    }
  }
}

const BP_GROUPS = {
  'Ativo circulante':       { statement_code: 'BP', side: 'ativo',   display_order: 10 },
  'Ativo não circulante':   { statement_code: 'BP', side: 'ativo',   display_order: 20 },
  'Passivo circulante':     { statement_code: 'BP', side: 'passivo', display_order: 30 },
  'Passivo não circulante': { statement_code: 'BP', side: 'passivo', display_order: 40 },
  'Patrimônio líquido':     { statement_code: 'BP', side: 'passivo', display_order: 50 },
};

const DRE_GROUPS = {
  'Receita':               { statement_code: 'DRE', display_order: 10 },
  'Custo':                 { statement_code: 'DRE', display_order: 20 },
  'Despesas operacionais': { statement_code: 'DRE', display_order: 30 },
  'Resultado financeiro':  { statement_code: 'DRE', display_order: 40 },
  'Impostos':              { statement_code: 'DRE', display_order: 50 },
};

// Metadados são carregados obrigatoriamente do Registry canônico v3.
let CANONICAL_RUBRIC_LABEL = {};
let ALIAS_TO_CANONICAL = {};
let CANONICAL_META = {};
let CALCULATED_KEYS = new Set();
const CALCULATED_KEY_REMAP = {};
let DRE_CALCULATED = [];
let DRE_ALIASES = {};

function norm(s) {
  return String(s ?? '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function resolveClassification(classRaw) {
  const rubric_label = String(classRaw).trim();
  const n = norm(classRaw);
  if (ALIAS_TO_CANONICAL[n]) return { canonical_key: ALIAS_TO_CANONICAL[n], rubric_label };
  for (const [alias, canonical_key] of Object.entries(ALIAS_TO_CANONICAL)) {
    if (n.includes(alias)) return { canonical_key, rubric_label };
  }
  return { canonical_key: n.replace(/\s+/g, '_'), rubric_label };
}

function resolveStatementCode(stmtCodeRaw) {
  const raw = norm(stmtCodeRaw || '');
  if (raw === 'bp' || raw.includes('balan') || raw.includes('balance')) return 'BP';
  if (raw === 'dre' || raw.includes('resultado') || raw.includes('income')) return 'DRE';
  return null;
}

function inferStatementCode(canonical_key) {
  const meta = CANONICAL_META[canonical_key];
  if (meta) return meta.code;
  if (canonical_key.includes('ativo') || canonical_key.includes('passivo') || canonical_key.includes('patrimonio')) return 'BP';
  return 'DRE';
}

function statementCodeToFamily(code) {
  if (code === 'BP') return 'balance_sheet';
  if (code === 'DRE') return 'dre';
  if (code === 'DFC') return 'cash_flow';
  return 'dre';
}

// Normaliza o statement_group do Excel para bater com os grupos canônicos do BP_GROUPS/DRE_GROUPS
const STMT_GROUP_ALIAS = {
  'ativo circulante':       'Ativo circulante',
  'ativo nao circulante':   'Ativo não circulante',
  'ativo nao-circulante':   'Ativo não circulante',
  'passivo circulante':     'Passivo circulante',
  'passivo nao circulante': 'Passivo não circulante',
  'passivo nao-circulante': 'Passivo não circulante',
  'patrimonio liquido':     'Patrimônio líquido',
  'pl':                     'Patrimônio líquido',
  'receita':                'Receita',
  'receitas':               'Receita',
  'custo':                  'Custo',
  'custos':                 'Custo',
  'despesas':               'Despesas operacionais',
  'despesas operacionais':  'Despesas operacionais',
  'resultado financeiro':   'Resultado financeiro',
  'impostos':               'Impostos',
};

function resolveGroupLabel(canonical_key, stmtGroupRaw) {
  // 1. CANONICAL_META é autoridade máxima
  const meta = CANONICAL_META[canonical_key];
  if (meta?.group) return meta.group;
  // 2. Normaliza o valor do Excel
  if (stmtGroupRaw) {
    const normalized = STMT_GROUP_ALIAS[norm(stmtGroupRaw)];
    if (normalized) return normalized;
    return stmtGroupRaw; // mantém o original se não bater alias
  }
  return null;
}

// Fallback: se o canonical_key gerado não está no CANONICAL_META mas temos statement_code + group,
// registramos o canonical_key no CANONICAL_META em runtime para que ele apareça no demonstrativo
function registerDynamicCanonical(canonical_key, code, group) {
  if (!CANONICAL_META[canonical_key]) {
    CANONICAL_META[canonical_key] = {
      family: statementCodeToFamily(code),
      code,
      group,
    };
  }
}

// Determina se o canonical_key pertence ao lado do Ativo no BP.
// Usa CANONICAL_META (autoridade) e fallback por prefixo do canonical_key.
function isAtivoKey(canonicalKey) {
  if (!canonicalKey) return false;
  const meta = CANONICAL_META[canonicalKey];
  if (meta?.group) {
    const g = norm(meta.group);
    return g.startsWith('ativo');
  }
  const k = norm(canonicalKey);
  return k.startsWith('ativo');
}

function applySign(value, signRuleRaw, statementCode, canonicalKey) {
  // Padrão Auditoria: devedoras positivas, credoras negativas no Excel.
  // Regra de sinal (fonte de verdade):
  //   - Ativo: mantém o sinal original do balancete (devedor=+, credor=-).
  //   - Passivo/PL: inverte o sinal (credor vira positivo no sistema).
  //   - DRE: inverte o sinal (receitas +, custos/despesas -).
  if (statementCode === 'DRE') return -value;
  if (statementCode === 'BP' && isAtivoKey(canonicalKey)) return value;
  // Passivo/PL: inverte
  return -value;
}
// ── Verificação automática: PL sempre inverte sinal conforme regra de balancetes ──
const PL_KEYS = new Set(['patrimonio_capital','patrimonio_reservas','patrimonio_reservas_fiscais','patrimonio_liquido','patrimonio_prejuizos','prejuizo_do_exercicio','resultado_do_exercicio','lucro_do_exercicio','lucros_(prejuizos)_acumulados']);
function isPLKey(ck) { if (!ck) return false; if (PL_KEYS.has(ck)) return true; const k = norm(ck); return k.startsWith('patrimonio')||k.includes('lucros')||k.includes('prejuizos')||k.includes('lucro_do')||k.includes('resultado_do_exercicio'); }
function verifyPLSign(raw, applied, ck) { const p = ck==='patrimonio_prejuizos'||ck==='prejuizo_do_exercicio'; return p ? applied<=0 : applied>=0; }

// Deriva metadados de coluna a partir do rótulo e do período contábil.
// column_key é o identificador ÚNICO da coluna na tela (não colapsa mensal com anual).
// column_label é o texto exibido ao usuário.
function deriveColumnMeta(columnLabel, period) {
  const parts = String(period || '').split('-');
  const year = parts[0] || '';
  const mm   = parts[1] || '';
  if (columnLabel) {
    const lower = String(columnLabel).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Anual
    if (lower.startsWith('anual')) {
      return { column_key: `A-${year}`, column_label: year, period_type: 'annual' };
    }
    // Trimestral
    if (/^\d[°º°]?\s*trim/.test(lower)) {
      return { column_key: `Q-${period}`, column_label: columnLabel, period_type: 'quarterly' };
    }
    // YTD / acumulado
    if (lower.startsWith('acum') || lower.startsWith('ytd')) {
      return { column_key: `Y-${period}`, column_label: columnLabel, period_type: 'ytd' };
    }
  }
  // Padrão: mensal  →  MM/YYYY
  const label = mm && year ? `${mm}/${year}` : (columnLabel || period);
  return { column_key: `M-${period}`, column_label: label, period_type: 'monthly' };
}

function normalizePeriod(raw) {
  const m = String(raw).match(/^(\d{2})[/](\d{4})$/);
  if (m) return `${m[2]}-${m[1]}`;
  return raw;
}

function extractPeriodBlocks(headers) {
  const periodPattern = /(20\d{2}[-/]\d{2}|\d{2}[-/]20\d{2})/;
  const blocks = [];
  const seen = new Set();
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (!h.includes('saldo final') && !h.includes('saldofinal') && !h.includes('closing_balance') && !h.includes('closing')) continue;
    const m = String(headers[i]).match(periodPattern);
    if (m && !seen.has(m[1])) {
      seen.add(m[1]);
      blocks.push({ period: normalizePeriod(m[1]), saldoFinalIdx: i });
    }
  }
  if (blocks.length === 0) {
    for (let i = 0; i < headers.length; i++) {
      const raw = String(headers[i] ?? '').trim();
      const m = raw.match(/^(20\d{2}[-/]\d{2}|\d{2}[-/]20\d{2})$/);
      if (m && !seen.has(m[1])) {
        seen.add(m[1]);
        blocks.push({ period: normalizePeriod(m[1]), saldoFinalIdx: i });
      }
    }
  }
  if (blocks.length === 0) {
    for (let i = 0; i < headers.length; i++) {
      const h = norm(headers[i]);
      if (h === 'closing_balance' || h === 'saldo final' || h === 'closing') {
        blocks.push({ period: 'SEM_DATA', saldoFinalIdx: i });
        break;
      }
    }
  }
  return blocks;
}

function classifyNonCashAdjustment(raw) {
  if (!raw) return null;
  const n = norm(raw);
  if (n.includes('depreciacao') || n.includes('depreciation') ||
      n.includes('amortizacao') || n.includes('amortization') ||
      n.includes('provisao') || n.includes('provision') ||
      n.includes('equivalencia_patrimonial') || n.includes('equivalencia patrimonial') ||
      n.includes('ajuste_valor_justo') || n.includes('ajuste valor justo') ||
      n.includes('impairment') ||
      n.includes('resultado_baixa_imobilizado') || n.includes('baixa de imobilizado') ||
      n.includes('outros_ajustes_sem_caixa') || n.includes('ajuste sem efeito caixa') || n.includes('sem efeito caixa')) {
    return 'non_cash_adjustment';
  }
  return null;
}

let CANONICAL_DFC_BUCKET = {};

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

function getDfcBalance(periodBalances, buckets) {
  if (!periodBalances) return 0;
  return buckets.reduce((sum, b) => sum + (periodBalances[b]?.value ?? 0), 0);
}

function buildIndirectCashFlow({
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

async function resolveCurrentSourceHeadsForRun({ base44, diagnosisId, sourceEntityId, uploadId, processingRunId, periods }) {
  const heads = await base44.asServiceRole.entities.FinancialSourceOutputHead.filter(
    { financial_diagnosis_id: diagnosisId, source_entity_id: sourceEntityId, financial_upload_id: uploadId, status: 'active' },
    'source_period',
    500,
  );
  const periodSet = new Set(periods);
  const matched = heads.filter((head) => periodSet.has(head.source_period) && head.current_processing_run_id === processingRunId);
  if (matched.length !== periodSet.size) throw new Error('DFC_SOURCE_HEAD_MATRIX_INCOMPLETE');
  const duplicatePeriods = matched.map((head) => head.source_period).filter((period, index, all) => all.indexOf(period) !== index);
  if (duplicatePeriods.length) throw new Error('SOURCE_OUTPUT_HEAD_AMBIGUOUS');
  const snapshotIds = new Set(matched.map((head) => head.current_processing_snapshot_id));
  const checksums = new Set(matched.map((head) => head.current_output_checksum));
  if (snapshotIds.size !== 1 || checksums.size !== 1) throw new Error('DFC_SOURCE_HEAD_BASE_DIVERGENCE');
  return matched;
}

// ─── Handler principal ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

  // ── Carregar Registry canônico (autoridade única via invoke) ──
  // Override das constantes inline pelos dados do Registry centralizado.
  // Se o fetch falhar, as constantes inline (agora let) permanecem como fallback.
  let registryVersion = 'inline-fallback';
  let registryHash = null;
  try {
    const regResp = await base44.functions.invoke('getFinancialCanonicalRegistry', { mode: 'full' });
    const reg = regResp.data;
    if (reg && reg.rubrics) {
      registryVersion = reg.version;
      registryHash = reg.hash;
      CANONICAL_RUBRIC_LABEL = {};
      for (const [k, v] of Object.entries(reg.rubrics)) CANONICAL_RUBRIC_LABEL[k] = v.display_label;
      for (const [k, v] of Object.entries(reg.calculated)) CANONICAL_RUBRIC_LABEL[k] = v.display_label;
      for (const [k, v] of Object.entries(reg.totals)) CANONICAL_RUBRIC_LABEL[k] = v.display_label;
      ALIAS_TO_CANONICAL = {};
      for (const a of reg.aliases) ALIAS_TO_CANONICAL[a.alias_normalized] = a.canonical_key;
      CANONICAL_META = {};
      for (const [k, v] of Object.entries(reg.rubrics)) CANONICAL_META[k] = { family: v.family, code: v.statement_code, group: v.presentation_group };
      CALCULATED_KEYS = new Set([...Object.keys(reg.calculated), ...Object.keys(reg.totals), ...Object.keys(reg.derived_aliases)]);
      // Fórmulas: todas são soma de operands — evaluator genérico produz resultado idêntico
      DRE_CALCULATED = Object.values(reg.calculated)
        .sort((a, b) => a.presentation_order - b.presentation_order)
        .map(calc => ({
          canonical_key: calc.canonical_key, rubric_label: calc.display_label,
          group_label: calc.presentation_group, line_type: calc.line_type,
          display_order: calc.presentation_order,
          formula: (g) => calc.operands.reduce((sum, op, index) => sum + g(op) * (calc.coefficients?.[index] ?? 1), 0),
        }));
      DRE_ALIASES = {};
      for (const [alias, target] of Object.entries(reg.derived_aliases)) DRE_ALIASES[alias] = (g) => g(target);
      CANONICAL_DFC_BUCKET = {};
      for (const [k, v] of Object.entries(reg.rubrics)) CANONICAL_DFC_BUCKET[k] = v.dfc_treatment;
      console.log(`[bsV2] Registry carregado: version=${reg.version} hash=${reg.hash} rubrics=${Object.keys(reg.rubrics).length} aliases=${reg.aliases.length}`);
    }
  } catch (regErr) {
    return Response.json({ error: 'FINANCIAL_REGISTRY_UNAVAILABLE', details: regErr.message }, { status: 503 });
  }

  const timer = { start: () => {}, end: () => {}, getMetrics: () => ({}), log: () => '' };

  const body = await req.json();
  let { upload_id, diagnosis_id, period_override, dfc_only, prepared_run_id, manual_adjustment_delta } = body;
  if (!diagnosis_id) return Response.json({ error: 'diagnosis_id é obrigatório' }, { status: 400 });
  if (!upload_id && !prepared_run_id) return Response.json({ error: 'upload_id ou prepared_run_id é obrigatório' }, { status: 400 });

  const [upload, diagnosis] = await Promise.all([
    upload_id ? base44.entities.FinancialUpload.get(upload_id) : Promise.resolve(null),
    base44.entities.FinancialDiagnosis.get(diagnosis_id),
  ]);
  if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
  const previousDiagnosisState = { status: diagnosis.status, current_processing_snapshot_id: diagnosis.current_processing_snapshot_id || null, current_preparation_run_id: diagnosis.current_preparation_run_id || null };
  let candidateSnapshotId = null;
  let committedSourceHeads = [];
  // ── Tenant Guard ──
    // SEG-03: Role guard — deny client_viewer from triggering mutations
    const WRITE_ROLES = ['hq_admin', 'tenant_admin', 'consultant'];
    if (!WRITE_ROLES.includes(appRole)) {
      return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
    }

  if ((appRole !== 'hq_admin') && diagnosis.tenant_id !== user.tenant_id) {
    return Response.json({ error: 'Acesso negado: tenant não autorizado' }, { status: 403 });
  }
  if (upload_id && !upload) return Response.json({ error: 'Upload não encontrado' }, { status: 404 });
  const manualAdjustmentByPeriod = {};
  const persistedManualAdjustments = await base44.asServiceRole.entities.FinancialDfcManualAdjustment.filter({ financial_diagnosis_id: diagnosis_id }, 'id', 1000);
  const manualAdjustments = persistedManualAdjustments
    .filter((adjustment) => adjustment.id !== manual_adjustment_delta?.remove_id)
    .filter((adjustment) => adjustment.id !== manual_adjustment_delta?.upsert?.id);
  if (manual_adjustment_delta?.upsert) manualAdjustments.push(manual_adjustment_delta.upsert);
  for (const adjustment of manualAdjustments) {
    const period = String(adjustment.period || adjustment.column_key || '').replace(/^[AMQ]-/, '');
    if (!manualAdjustmentByPeriod[period]) manualAdjustmentByPeriod[period] = {};
    manualAdjustmentByPeriod[period][adjustment.activity] = (manualAdjustmentByPeriod[period][adjustment.activity] || 0) + Number(adjustment.value || 0);
  }

  // ── R3: fingerprint material completo e modos de build não colidentes ──
  const [fingerprintOverrides, fingerprintPlanLines, fingerprintPreparedRun] = await Promise.all([
    base44.asServiceRole.entities.FinancialDfcClassificationOverride.filter({ financial_diagnosis_id: diagnosis_id, tenant_id: diagnosis.tenant_id, status: 'active' }, 'id', 1000),
    diagnosis.account_plan_id ? base44.asServiceRole.entities.FinancialAccountPlanLine.filter({ account_plan_id: diagnosis.account_plan_id }, 'account_code', 10000) : Promise.resolve([]),
    prepared_run_id ? base44.asServiceRole.entities.FinancialPreparationRun.get(prepared_run_id) : Promise.resolve(null),
  ]);
  const canonicalize = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('CANONICAL_NON_FINITE_NUMBER'); return Object.is(value,-0)?0:Number(value.toPrecision(15)); }
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(canonicalize).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const excluded=new Set(['created_date','created_at','created_by_id','published_at','superseded_at','invalidated_at']);
    return Object.fromEntries(Object.keys(value).filter(k=>!excluded.has(k)).sort().map(k=>[k,canonicalize(value[k])]));
  };
  const sha256Canonical = async (value) => { const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonicalize(value)))); return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join(''); };
  const buildOperation = dfc_only ? 'build_dfc' : 'build_full';
  const buildInput = {
    operation:buildOperation, diagnosis_id, analysis_type:diagnosis.analysis_type || 'individual', dataset_scope:fingerprintPreparedRun?.dataset_scope || 'individual', reporting_entity_id:fingerprintPreparedRun?.reporting_entity_id || upload?.source_entity_id || null,
    upload:{ id:upload?.id || null, input_checksum:upload?.input_checksum || null, source_period:upload?.source_period || null, notes:upload?.notes || null },
    prepared_run:{ id:fingerprintPreparedRun?.id || null, checksum:fingerprintPreparedRun?.checksum || null, status:fingerprintPreparedRun?.status || null },
    mappings:fingerprintPlanLines.map(l=>({account_code:l.account_code,canonical_key:l.canonical_key,classification:l.classification,statement_code:l.statement_code,sign_rule:l.sign_rule,dfc_classification:l.dfc_classification,version:l.updated_date || null})),
    manual_dfc_adjustments:manualAdjustments.map(a=>({id:a.id,period:a.period,column_key:a.column_key,activity:a.activity,value:a.value,version:a.updated_at || a.updated_date || null})),
    manual_dfc_adjustment_delta: manual_adjustment_delta || null,
    classification_overrides:fingerprintOverrides.map(o=>({id:o.id,rubric_key:o.rubric_key,manual_bucket:o.manual_bucket,status:o.status,version:o.updated_date || null})),
    registry_version:registryVersion, registry_hash:registryHash, formula_version:'FAL-FIN-3.0.0', period_override:period_override || null, dfc_only:dfc_only === true,
  };
  const buildInputFingerprint = await sha256Canonical(buildInput);
  const buildOpKey = `${buildOperation}|${diagnosis.tenant_id}|${diagnosis_id}|sha256:${buildInputFingerprint}`;
  const analysisType = diagnosis.analysis_type || 'individual';
  const isPreparedSeries = Boolean(prepared_run_id);
  const isIndividualSourceBuild = !isPreparedSeries && Boolean(upload_id) && Boolean(upload?.source_entity_id);
  const usesSourceHead = isIndividualSourceBuild;
  const usesDiagnosisPointer = analysisType === 'individual' || isPreparedSeries;
  let buildRunId = null;
  const existingBuildRuns = await base44.asServiceRole.entities.FinancialProcessingRun.filter(
    { operation_key: buildOpKey, status: { $in: ['running', 'committing', 'succeeded'] } }, 'id', 10
  );
  if (existingBuildRuns.length > 0) {
    const exRun = existingBuildRuns[0];
    if (exRun.status === 'succeeded') {
      const snapshotId = exRun.result_summary?.snapshot_id;
      const snapshot = snapshotId ? await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(snapshotId) : null;
      const [activeStatements, activeIndicators] = await Promise.all([
        base44.asServiceRole.entities.FinancialStatementLine.filter({ financial_diagnosis_id:diagnosis_id, processing_run_id:exRun.id, publication_status:'active' }, 'id', 50000),
        base44.asServiceRole.entities.FinancialIndicatorSnapshot.filter({ financial_diagnosis_id:diagnosis_id, processing_run_id:exRun.id, publication_status:'active' }, 'id', 50000),
      ]);
      const expectedStatements = Number(snapshot?.integrity_summary?.statement_lines || 0), expectedIndicators = Number(snapshot?.integrity_summary?.indicator_snapshots || 0);
      const expectedCounts = exRun.result_summary?.expected_output_counts;
      if (!expectedCounts) console.warn(`[buildFinancialStatements] Rebuilding legacy output without expected counts for run ${exRun.id}`);
      const globalPointerValid = !usesDiagnosisPointer || diagnosis.current_processing_snapshot_id === snapshot.id;
      let sourceHeadsValid = true;
      if (usesSourceHead) {
        const expectedHeads = exRun.result_summary?.source_heads || [];
        if (!expectedHeads.length) sourceHeadsValid = false;
        for (const expectedHead of expectedHeads) {
          const heads = await base44.asServiceRole.entities.FinancialSourceOutputHead.filter({ financial_diagnosis_id: diagnosis_id, source_key: expectedHead.source_key, status: 'active' }, 'updated_at', 2);
          const head = heads.length === 1 ? heads[0] : null;
          if (!head || head.current_processing_run_id !== exRun.id || head.current_processing_snapshot_id !== snapshot?.id || head.current_output_checksum !== snapshot?.output_checksum) sourceHeadsValid = false;
        }
      }
      if (!snapshot || snapshot.financial_processing_run_id !== exRun.id || snapshot.status !== 'active' || !globalPointerValid || !sourceHeadsValid || activeStatements.length !== expectedStatements || activeIndicators.length !== expectedIndicators) {
        console.warn(`[buildFinancialStatements] Rebuilding incomplete output for run ${exRun.id}`);
      } else {
        return Response.json({ success: true, reused: true, run_id: exRun.id, operation_key:buildOpKey, input_checksum:buildInputFingerprint, snapshot_id: snapshot.id, output_checksum:snapshot.output_checksum, status: 'succeeded' });
      }
    }
    if (exRun.status !== 'succeeded') {
      return Response.json({ success: false, in_progress: true, reused: true, run_id: exRun.id, status: exRun.status }, { status: 202 });
    }
  }
  const buildRun = await base44.asServiceRole.entities.FinancialProcessingRun.create({
    tenant_id: diagnosis.tenant_id,
    financial_diagnosis_id: diagnosis_id,
    financial_upload_id: upload_id || null,
    operation_type: dfc_only ? 'build_dfc' : 'build_statements',
    operation_key: buildOpKey,
    input_checksum: buildInputFingerprint,
    registry_version: registryVersion,
    formula_version: 'FAL-FIN-3.0.0',
    status: 'running',
    started_at: new Date().toISOString(),
    triggered_by: user.email,
  });
  buildRunId = buildRun.id;
  const outputEntityNames = ['FinancialStatementLine','FinancialIndicatorSnapshot','FinancialValidationResult','FinancialMappingResolution','FinancialTrialBalanceLine','FinancialDfcCompositionLine'];
  const stampCandidates = (...collections) => { for (const items of collections) for (const item of items || []) { item.processing_run_id = buildRunId; item.publication_status = 'candidate'; } };
  const publishCandidates = async () => {
    const publishedAt = new Date().toISOString();
    for (const name of outputEntityNames) await base44.asServiceRole.entities[name].updateMany({ financial_diagnosis_id: diagnosis_id, processing_run_id: buildRunId, publication_status: 'candidate' }, { $set: { publication_status:'active', published_at:publishedAt } });
    return publishedAt;
  };
  const supersedePrevious = async (publishedAt) => {
    if (usesSourceHead) return;
    const deactivate = (entity, query) => base44.asServiceRole.entities[entity].updateMany(
      { financial_diagnosis_id: diagnosis_id, processing_run_id: { $ne: buildRunId }, publication_status: 'active', ...query },
      { $set: { publication_status: 'superseded', superseded_at: publishedAt } },
    );
    if (dfc_only) {
      await Promise.all([
        deactivate('FinancialStatementLine', { statement_code: 'DFC' }),
        deactivate('FinancialValidationResult', { category: 'dfc_composicao' }),
        deactivate('FinancialDfcCompositionLine', {}),
      ]);
      return;
    }
    if (!isPreparedSeries && upload_id) {
      await Promise.all([
        deactivate('FinancialStatementLine', { financial_upload_id: upload_id, statement_code: { $ne: 'DFC' } }),
        deactivate('FinancialIndicatorSnapshot', { financial_upload_id: upload_id }),
        deactivate('FinancialValidationResult', { financial_upload_id: upload_id, category: { $ne: 'dfc_composicao' } }),
        deactivate('FinancialMappingResolution', { financial_upload_id: upload_id }),
        deactivate('FinancialTrialBalanceLine', { financial_upload_id: upload_id }),
        deactivate('FinancialStatementLine', { statement_code: 'DFC' }),
        deactivate('FinancialValidationResult', { category: 'dfc_composicao' }),
        deactivate('FinancialDfcCompositionLine', {}),
      ]);
      return;
    }
    for (const name of outputEntityNames) await deactivate(name, {});
  };
  const invalidateNewRunOutputs = async (reason) => { const invalidatedAt = new Date().toISOString(); for (const name of outputEntityNames) await base44.asServiceRole.entities[name].updateMany({ financial_diagnosis_id: diagnosis_id, processing_run_id: buildRunId, publication_status: { $in: ['candidate', 'active'] } }, { $set: { publication_status:'invalid', invalidated_at:invalidatedAt, invalidation_reason:reason } }); };
  const invalidateCandidates = async () => invalidateNewRunOutputs('BUILD_COMMIT_FAILED');

  // ── Identidade da série já definida antes da verificação de reuso. ──
  let datasetScope = 'individual';
  let reportingEntityId = '';
  let preparationRunId = prepared_run_id || null;
  if (prepared_run_id) {
    const run = await base44.asServiceRole.entities.FinancialPreparationRun.get(prepared_run_id);
    if (!run) { await base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId,{status:'failed',completed_at:new Date().toISOString(),error_details:{error:'Preparation run não encontrado'}}); return Response.json({ error: 'Preparation run não encontrado' }, { status: 404 }); }
    datasetScope = run.dataset_scope || (analysisType === 'consolidated' ? 'consolidated' : 'combined');
    reportingEntityId = run.reporting_entity_id || '';
  } else if (upload) {
    reportingEntityId = upload.source_entity_id || diagnosis.unit_id || diagnosis.company_id || diagnosis.group_id || 'MAIN';
  }

  // Lê configuração de importação salva no campo notes do upload
  let importConfig = {};
  try { importConfig = JSON.parse(upload?.notes || '{}'); } catch { importConfig = {}; }
  const columnLabel    = importConfig.column_label    || null; // "Janeiro/2024", "2º trim/2024"
  const plAccountCode  = importConfig.pl_account_code || null; // code da conta do PL para vazão
  const plCanonicalKey = importConfig.pl_canonical_key|| null; // canonical_key da conta do PL
  // FALLBACK: se period_override não ve no body, usa o salvo no notes do upload
  if (!period_override && importConfig.period_override) {
    period_override = importConfig.period_override;
    console.log(`[buildFinancialStatements V2] period_override recuperado do upload.notes: ${period_override}`);
  }
  console.log(`[buildFinancialStatements V2] importConfig:`, importConfig);

  // Carregar plano de contas se associado
  let accountPlanLines = [];
  if (diagnosis.account_plan_id) {
  try {
    accountPlanLines = await base44.asServiceRole.entities.FinancialAccountPlanLine.filter(
      { account_plan_id: diagnosis.account_plan_id }, 'account_code', 5000
    );
    console.log(`[buildFinancialStatements V2] Plano de contas carregado: ${accountPlanLines.length} linhas`);
  } catch (e) {
    console.warn(`[buildFinancialStatements V2] Falha ao carregar plano: ${e.message}`);
  }
  }

  // Índice de ebitda_component por account_code normalizado — para acumulação gerencial
  const ebitdaComponentByCode = {};
  for (const line of accountPlanLines) {
  if (line.ebitda_component) {
    const normalized = String(line.account_code || '').replace(/\./g, '').trim();
    ebitdaComponentByCode[normalized] = line.ebitda_component;
  }
  }

  // Índice de dfc_classification por account_code normalizado — para composição da DFC indireta
  const dfcClassificationByCode = {};
  for (const line of accountPlanLines) {
    if (line.dfc_classification) {
      const normalized = String(line.account_code || '').replace(/\./g, '').trim();
      dfcClassificationByCode[normalized] = line.dfc_classification;
    }
  }

  if (prepared_run_id) {
    try {
      await base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosis_id, { status: 'processing' });
      const preparedLines = await base44.asServiceRole.entities.PreparedFinancialDatasetLine.filter({ preparation_run_id: prepared_run_id }, 'display_order', 50000);
      const agg = {}, rMeta = {}, cMeta = {};
      for (const pl of preparedLines) {
        const p = pl.period;
        if (!agg[p]) agg[p] = {};
        agg[p][pl.canonical_key] = (agg[p][pl.canonical_key] ?? 0) + (Number(pl.final_value) || 0);
        if (!rMeta[pl.canonical_key]) { rMeta[pl.canonical_key] = { canonical_key: pl.canonical_key, rubric_label: pl.rubric_label || pl.canonical_key, group_label: pl.group_label, statement_code: pl.statement_code, sign_rule: pl.sign_rule || 'normal', display_order: pl.display_order || 0, family: statementCodeToFamily(pl.statement_code) }; if (pl.statement_code && pl.group_label) registerDynamicCanonical(pl.canonical_key, pl.statement_code, pl.group_label); }
        if (!cMeta[p] && pl.column_key) cMeta[p] = { column_key: pl.column_key, column_label: pl.column_label, period_type: pl.period_type };
      }
      const allP = Object.keys(agg);
      const calcR = { indicators: [], validations: [] };
      const bpBalanceValidations = [];
      for (const p of allP) {
        const engineResponse = await base44.functions.invoke('executeFinancialEngine', {
          action: 'compute', source_values: agg[p],
          context: { period: p, dataset_scope: datasetScope, entity_code: reportingEntityId, reporting_entity_id: reportingEntityId },
        });
        const engine = engineResponse?.data || engineResponse;
        if (engine?.error) throw new Error(engine.error);
        agg[p] = engine.statements;
        calcR.indicators.push(...(engine.indicators || []).map((indicator) => ({ ...indicator, period: p })));
        if (engine.bp?.balanced !== true) bpBalanceValidations.push({
          financial_upload_id: null, financial_diagnosis_id: diagnosis_id, tenant_id: diagnosis.tenant_id,
          dataset_scope: datasetScope, reporting_entity_id: reportingEntityId, preparation_run_id: preparationRunId,
          severity: 'blocking', blocking: true, category: 'balancete', code: engine.bp?.validation?.code || 'BP_ACCOUNTING_EQUATION_MISMATCH',
          title: 'Equação contábil do BP inválida',
          message: `Ativo ${engine.bp?.expected} difere de Passivo + PL ${engine.bp?.actual} em ${engine.bp?.difference}.`,
          expected: engine.bp?.expected, actual: engine.bp?.actual, difference: engine.bp?.difference,
        });
      }
      if (bpBalanceValidations.length > 0) {
        const failedBpValidations = bpBalanceValidations.map((item) => ({ ...item, processing_run_id: buildRunId, publication_status: 'invalid', invalidated_at: new Date().toISOString(), invalidation_reason: 'BP_ACCOUNTING_EQUATION_MISMATCH' }));
        await base44.asServiceRole.entities.FinancialValidationResult.bulkCreate(failedBpValidations);
        await Promise.all([
          base44.asServiceRole.entities.FinancialPreparationRun.update(prepared_run_id, { status: 'validation_failed', completed_at: new Date().toISOString() }),
          base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId, { status: 'failed', completed_at: new Date().toISOString(), error_details: { code: 'BP_ACCOUNTING_EQUATION_MISMATCH', validations: bpBalanceValidations } }),
          base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosis_id, { status: 'validation_failed' }),
        ]);
        return Response.json({ error: 'BP_ACCOUNTING_EQUATION_MISMATCH', validations: bpBalanceValidations }, { status: 422 });
      }
      const mkSl = (p, ck, label, code, group, lt, order, val) => ({ financial_upload_id: null, financial_diagnosis_id: diagnosis_id, tenant_id: diagnosis.tenant_id, entity_code: reportingEntityId, entity_level: diagnosis.scope_level, period: p, statement_code: code, group_label: group, rubric_label: label, line_type: lt, display_order: order, canonical_key: ck, statement_family: statementCodeToFamily(code), value: Number(val) || 0, is_consolidated: datasetScope === 'consolidated', dataset_scope: datasetScope, reporting_entity_id: reportingEntityId, preparation_run_id: preparationRunId, ...(cMeta[p] ? { column_key: cMeta[p].column_key, column_label: cMeta[p].column_label, period_type: cMeta[p].period_type } : {}) });
      const stmtLines = [];
      for (const p of allP) {
        for (const [ck, m] of Object.entries(rMeta)) stmtLines.push(mkSl(p, ck, m.rubric_label, m.statement_code, m.group_label, 'composed', m.display_order || 0, agg[p]?.[ck] ?? 0));
        for (const c of DRE_CALCULATED) stmtLines.push(mkSl(p, c.canonical_key, c.rubric_label, 'DRE', c.group_label, c.line_type, c.display_order, agg[p]?.[c.canonical_key] ?? 0));
        const bpTotals = [['total_ativo_circulante','Total do Ativo Circulante'],['total_ativo_nao_circulante','Total do Ativo Não Circulante'],['total_ativo','Total do Ativo'],['total_passivo_circulante','Total do Passivo Circulante'],['total_passivo_nao_circulante','Total do Passivo Não Circulante'],['total_passivo','Total do Passivo'],['total_patrimonio_liquido','Total do Patrimônio Líquido'],['total_passivo_patrimonio_liquido','Total Passivo e Patrimônio Líquido']];
        for (const [key, label] of bpTotals) stmtLines.push(mkSl(p, key, label, 'BP', 'total', 'total', 999, agg[p]?.[key] ?? 0));
      }
      const sanitizeNum = (v, def = 0) => { if (v == null) return def; const n = Number(v); return isNaN(n) ? def : n; };
      const indLines = calcR.indicators.map(i => ({ ...i, value: sanitizeNum(i.value, null), formula_version: 'FAL-FIN-3.0.0', validation_code: i.validation_code || i.warning || null, previous_value: i.previous_value != null ? sanitizeNum(i.previous_value, null) : null, variation_value: i.variation_value != null ? sanitizeNum(i.variation_value, null) : null, variation_percent: i.variation_percent != null ? sanitizeNum(i.variation_percent, null) : null, financial_diagnosis_id: diagnosis_id, tenant_id: diagnosis.tenant_id, entity_code: reportingEntityId, entity_level: diagnosis.scope_level, dataset_scope: datasetScope, reporting_entity_id: reportingEntityId, preparation_run_id: preparationRunId, ...(cMeta[i.period] ? { column_key: cMeta[i.period].column_key, column_label: cMeta[i.period].column_label, period_type: cMeta[i.period].period_type } : {}) }));
      const bpV = {}, bpM = {}, netInc = {};
      for (const p of allP) { bpV[p] = {}; for (const [ck, m] of Object.entries(rMeta)) { if (m.statement_code !== 'BP') continue; bpV[p][ck] = agg[p]?.[ck] ?? 0; if (!bpM[ck]) bpM[ck] = m; } netInc[p] = agg[p]?.['resultado_liquido'] ?? 0; }
      // ── Non-cash adjustments from DRE prepared lines via account plan dfc_classification ──
      const ncAdjByPeriod = {}, ncDetByPeriod = {};
      for (const pl of preparedLines) {
        if (pl.statement_code !== 'DRE' || !pl.account_code) continue;
        const normalizedCode = String(pl.account_code).replace(/\./g, '').trim();
        const dfcClass = dfcClassificationByCode[normalizedCode];
        if (!classifyNonCashAdjustment(dfcClass)) continue;
        const p = pl.period;
        const val = Math.abs(Number(pl.final_value) || 0);
        if (val === 0) continue;
        ncAdjByPeriod[p] = (ncAdjByPeriod[p] ?? 0) + val;
        if (!ncDetByPeriod[p]) ncDetByPeriod[p] = { value: 0, accounts: [] };
        ncDetByPeriod[p].value += val;
        ncDetByPeriod[p].accounts.push({ account_code: pl.account_code, account_name: pl.account_description || pl.rubric_label, value: val });
      }
      // ── Load DFC overrides (active, scoped to diagnosis) ──
      let dfcOverrideMap = new Map();
      try {
        const ovs = await base44.asServiceRole.entities.FinancialDfcClassificationOverride.filter({ financial_diagnosis_id: diagnosis_id, tenant_id: diagnosis.tenant_id, status: 'active' }, 'id', 500);
        for (const ov of ovs || []) { if (ov.rubric_key && ov.manual_bucket) dfcOverrideMap.set(ov.rubric_key, ov); }
      } catch (e) { console.warn('[bsV2 prepared] overrides:', e.message); }
      const dfcR = buildIndirectCashFlow({ periods: allP, bpValuesByPeriod: bpV, bpMetaByCanonicalKey: bpM, netIncomeByPeriod: netInc, nonCashAdjustmentByPeriod: ncAdjByPeriod, nonCashAdjustmentDetailByPeriod: ncDetByPeriod, financialDiagnosisId: diagnosis_id, financialUploadId: null, tenantId: diagnosis.tenant_id, entityCode: reportingEntityId, colMetaMap: cMeta, overrideMap: dfcOverrideMap, manualAdjustmentByPeriod });
      [...dfcR.lines, ...(dfcR.compositionLines || [])].forEach(x => { x.dataset_scope = datasetScope; x.reporting_entity_id = reportingEntityId; x.preparation_run_id = preparationRunId; });
      stmtLines.push(...dfcR.lines);
      const valR = [...(dfcR.validations || []), ...(calcR.validations || [])].map(v => ({ financial_upload_id: null, financial_diagnosis_id: diagnosis_id, tenant_id: diagnosis.tenant_id, dataset_scope: datasetScope, reporting_entity_id: reportingEntityId, preparation_run_id: preparationRunId, ...v }));
      stampCandidates(stmtLines, indLines, valR, dfcR.compositionLines || []);
      const bi = async (e, items) => { if (!items.length) return; for (let i = 0; i < items.length; i += 250) await e.bulkCreate(items.slice(i, i + 250)); };
      await Promise.all([ bi(base44.asServiceRole.entities.FinancialStatementLine, stmtLines), bi(base44.asServiceRole.entities.FinancialIndicatorSnapshot, indLines), bi(base44.asServiceRole.entities.FinancialValidationResult, valR), bi(base44.asServiceRole.entities.FinancialDfcCompositionLine, dfcR.compositionLines || []) ]);
      const sp = [...allP].sort();
      await base44.asServiceRole.entities.FinancialPreparationRun.update(prepared_run_id, { status: 'prepared', completed_at: new Date().toISOString(), prepared_line_count: preparedLines.length });
      await base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId, { status: 'committing', result_summary: { success: false, snapshot_pending: true, preparation_run_ids: [preparationRunId], statement_lines: stmtLines.length, indicator_snapshots: indLines.length } });
      const snapshotResponse = await base44.functions.invoke('createFinancialProcessingSnapshot', { financial_diagnosis_id: diagnosis_id, processing_run_id: buildRunId, publish_pointer: false });
      const snapshot = snapshotResponse?.data || snapshotResponse;
      if (!snapshot?.snapshot_id) throw new Error('Build preparado sem snapshot obrigatório');
      candidateSnapshotId = snapshot.snapshot_id;
      const persistedSnapshot = await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(snapshot.snapshot_id);
      if (!persistedSnapshot || persistedSnapshot.financial_processing_run_id !== buildRunId || persistedSnapshot.status !== 'candidate' || !persistedSnapshot.output_checksum) throw new Error('SNAPSHOT_POSTCONDITION_FAILED');
      const publishedAt = await publishCandidates();
      await base44.asServiceRole.entities.FinancialProcessingSnapshot.update(snapshot.snapshot_id, { status:'active' });
      await base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosis_id, { status:'processed', current_preparation_run_id:preparationRunId, first_period:sp[0] || null, last_period:sp.slice(-1)[0] || null, months_count:allP.length, current_processing_snapshot_id: snapshot.snapshot_id });
      await supersedePrevious(publishedAt);
      await base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId, { status: 'succeeded', completed_at: new Date().toISOString(), output_checksum: snapshot.output_checksum, result_summary: { success: true, snapshot_pending: false, snapshot_id: snapshot.snapshot_id, preparation_run_ids: [preparationRunId], statement_lines: stmtLines.length, indicator_snapshots: indLines.length } });
      return Response.json({ success: true, run_id: buildRunId, snapshot_id: snapshot.snapshot_id, output_checksum: snapshot.output_checksum, status: 'prepared', periods: sp, statement_lines: stmtLines.length, indicators: indLines.length, dfc_lines: dfcR.lines.length, dfc_composition_lines: (dfcR.compositionLines || []).length, validation_results: valR.length, dataset_scope: datasetScope, reporting_entity_id: reportingEntityId, preparation_run_id: preparationRunId });
    } catch (err) {
      try { await invalidateCandidates(); if (candidateSnapshotId) await base44.asServiceRole.entities.FinancialProcessingSnapshot.update(candidateSnapshotId, { status:'invalid', invalid_reason:err.message, invalidated_at:new Date().toISOString(), invalidated_by_run_id:buildRunId }); await base44.asServiceRole.entities.FinancialPreparationRun.update(prepared_run_id, { status: 'validation_failed' }); await base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosis_id, previousDiagnosisState); await base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId,{status:candidateSnapshotId?'partial_failed':'failed',completed_at:new Date().toISOString(),error_details:{error:err.message}}); } catch {}
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
  if (!dfc_only && upload_id) {
    await Promise.all([
      base44.entities.FinancialUpload.update(upload_id, { upload_status: 'processing' }),
      base44.entities.FinancialDiagnosis.update(diagnosis_id, { status: 'processing' }),
    ]);
  }

  // ── DFC-only: reconstrói a DFC a partir de dados PERSISTIDOS (sem re-ler Excel) ──
  if (dfc_only) {
    const dfcPreviousDiagnosisState = { current_processing_snapshot_id: diagnosis.current_processing_snapshot_id || null };
    const dfcCommittedHeads = [];
    let dfcCommitPointReached = false;
    try {
      const ec = diagnosis.unit_id || diagnosis.company_id || diagnosis.group_id || 'MAIN';
      const sourceHeads = usesSourceHead ? await base44.asServiceRole.entities.FinancialSourceOutputHead.filter(
        { financial_diagnosis_id: diagnosis_id, source_entity_id: upload?.source_entity_id, status: 'active' },
        'source_period', 500,
      ) : [];
      if (usesSourceHead && !sourceHeads.length) throw new Error('DFC_SOURCE_HEAD_MATRIX_INCOMPLETE');
      const uniquePeriods = [...new Set(sourceHeads.map((head) => head.source_period).filter(Boolean))];
      if (usesSourceHead && uniquePeriods.length !== sourceHeads.length) throw new Error('SOURCE_OUTPUT_HEAD_AMBIGUOUS');
      const currentRunIds = [...new Set(sourceHeads.map((head) => head.current_processing_run_id).filter(Boolean))];
      const newestHead = [...sourceHeads].sort((a, b) => String(a.source_period).localeCompare(String(b.source_period))).at(-1);
      const baseSnapshotId = usesSourceHead ? newestHead?.current_processing_snapshot_id : diagnosis.current_processing_snapshot_id;
      const baseSnapshot = baseSnapshotId ? await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(baseSnapshotId) : null;
      if (!baseSnapshot || baseSnapshot.status !== 'active' || (usesSourceHead && !currentRunIds.length)) throw new Error('DFC_BASE_CURRENT_SCOPE_REQUIRED');
      const baseCurrentRunId = usesSourceHead ? newestHead.current_processing_run_id : baseSnapshot.financial_processing_run_id;
      if (!baseCurrentRunId) throw new Error('DFC_BASE_CURRENT_SCOPE_REQUIRED');
      const currentOutputQuery = usesSourceHead
        ? { financial_diagnosis_id: diagnosis_id, processing_run_id: { $in: currentRunIds }, publication_status: 'active' }
        : { financial_diagnosis_id: diagnosis_id, publication_status: 'active' };
      const currentRunByPeriod = new Map(sourceHeads.map((head) => [head.source_period, head.current_processing_run_id]));
      const scoped = (rows, hasPeriod = true) => rows.filter((row) => hasPeriod ? currentRunByPeriod.get(row.period) === row.processing_run_id : row.processing_run_id === baseCurrentRunId);
      const [rawStatements, rawIndicators, rawValidations, rawMappings, rawTrialLines, rawComposition] = await Promise.all([
        base44.asServiceRole.entities.FinancialStatementLine.filter(currentOutputQuery, 'id', 50000),
        base44.asServiceRole.entities.FinancialIndicatorSnapshot.filter(currentOutputQuery, 'id', 50000),
        base44.asServiceRole.entities.FinancialValidationResult.filter(currentOutputQuery, 'id', 50000),
        base44.asServiceRole.entities.FinancialMappingResolution.filter(currentOutputQuery, 'id', 50000),
        base44.asServiceRole.entities.FinancialTrialBalanceLine.filter(currentOutputQuery, 'id', 50000),
        base44.asServiceRole.entities.FinancialDfcCompositionLine.filter(currentOutputQuery, 'id', 50000),
      ]);
      const allStatements = usesSourceHead ? scoped(rawStatements) : rawStatements;
      const allIndicators = usesSourceHead ? scoped(rawIndicators) : rawIndicators;
      const allTrialLines = usesSourceHead ? scoped(rawTrialLines) : rawTrialLines;
      const baseComposition = usesSourceHead ? scoped(rawComposition) : rawComposition;
      const allMappings = usesSourceHead ? rawMappings.filter((row) => row.processing_run_id === baseCurrentRunId) : rawMappings;
      const allValidations = usesSourceHead ? rawValidations.filter((row) => row.processing_run_id === baseCurrentRunId) : rawValidations;
      const sourceRuns = usesSourceHead ? await base44.asServiceRole.entities.FinancialProcessingRun.filter({ id: { $in: currentRunIds } }, 'id', 500) : [];
      const sourceMetadata = new Set(sourceRuns.map((run) => [run.registry_version || null, run.formula_version || null].join('|')));
      if (sourceMetadata.size > 1) throw new Error('DFC_CURRENT_SOURCE_METADATA_DIVERGENCE');
      if (!allStatements.length) throw new Error('DFC_BASE_OUTPUTS_REQUIRED');
      const withoutLifecycle = (row) => { const { id, created_date, updated_date, created_by_id, processing_run_id, publication_status, published_at, superseded_at, invalidated_at, invalidation_reason, ...copy } = row; return copy; };
      const allBp = allStatements.filter((line) => line.statement_code === 'BP');
      const allRl = allStatements.filter((line) => line.canonical_key === 'resultado_liquido');
      const bpVal = {}, bpMeta = {}, netInc = {}, colMeta = {}, p2u = {};
      for (const sl of allBp) {
        if (!sl.period || sl.period === 'SEM_DATA') continue;
        if (!bpVal[sl.period]) bpVal[sl.period] = {};
        bpVal[sl.period][sl.canonical_key] = sl.value;
        if (!bpMeta[sl.canonical_key]) bpMeta[sl.canonical_key] = { canonical_key: sl.canonical_key, rubric_label: sl.rubric_label, group_label: sl.group_label, statement_code: sl.statement_code };
        if (!colMeta[sl.period] && sl.column_key) colMeta[sl.period] = { column_key: sl.column_key, column_label: sl.column_label, period_type: sl.period_type };
        if (!p2u[sl.period]) p2u[sl.period] = sl.financial_upload_id;
      }
      for (const sl of allRl) if (sl.period && sl.period !== 'SEM_DATA') netInc[sl.period] = sl.value;
      const exNc = baseComposition.filter((line) => line.bucket === 'non_cash_adjustment');
      const ncAdj = {}, ncDet = {};
      for (const cl of exNc) {
        if (!cl.period || cl.period === 'SEM_DATA') continue;
        ncAdj[cl.period] = (ncAdj[cl.period] ?? 0) + (cl.current_value ?? 0);
        if (!ncDet[cl.period]) ncDet[cl.period] = { value: 0, accounts: [] };
        ncDet[cl.period].value += cl.current_value ?? 0;
        ncDet[cl.period].accounts.push({ account_code: cl.rubric_key, account_name: cl.rubric_label, value: cl.current_value ?? 0 });
      }
      let ovMap = new Map();
      const ovs = await base44.asServiceRole.entities.FinancialDfcClassificationOverride.filter({ financial_diagnosis_id: diagnosis_id, tenant_id: diagnosis.tenant_id, status: 'active' }, 'id', 500);
      for (const ov of ovs) if (ov.rubric_key && ov.manual_bucket) ovMap.set(ov.rubric_key, ov);
      const vp = Object.keys(bpVal).filter((period) => period && period !== 'SEM_DATA');
      if (vp.length < 2) throw new Error(`DFC requer 2+ períodos válidos. Encontrados: ${vp.length}`);
      const sp = [...vp].sort();
      const cp = sp[sp.length - 1];
      const duid = p2u[cp] || upload_id;
      const reporting = allBp.find((line) => line.reporting_entity_id)?.reporting_entity_id || ec;
      const scope = allBp.find((line) => line.dataset_scope)?.dataset_scope || 'individual';
      const dr = buildIndirectCashFlow({ periods: vp, bpValuesByPeriod: bpVal, bpMetaByCanonicalKey: bpMeta, netIncomeByPeriod: netInc, nonCashAdjustmentByPeriod: ncAdj, nonCashAdjustmentDetailByPeriod: ncDet, financialDiagnosisId: diagnosis_id, financialUploadId: duid, tenantId: diagnosis.tenant_id, entityCode: ec, colMetaMap: colMeta, overrideMap: ovMap, manualAdjustmentByPeriod });
      for (const row of [...(dr.lines || []), ...(dr.compositionLines || [])]) { row.dataset_scope = scope; row.reporting_entity_id = reporting; }
      const regeneratedValidations = (dr.validations || []).map((row) => ({ financial_upload_id: duid, financial_diagnosis_id: diagnosis_id, tenant_id: diagnosis.tenant_id, dataset_scope: scope, reporting_entity_id: reporting, ...row }));
      const completeStatementLines = [...allStatements.filter((line) => line.statement_code !== 'DFC').map(withoutLifecycle), ...(dr.lines || [])];
      const completeIndicators = allIndicators.map(withoutLifecycle);
      const completeValidations = [...allValidations.filter((line) => line.category !== 'dfc_composicao').map(withoutLifecycle), ...regeneratedValidations];
      const completeMappings = allMappings.map(withoutLifecycle);
      const completeTrialLines = allTrialLines.map(withoutLifecycle);
      const completeDfcComposition = (dr.compositionLines || []);
      stampCandidates(completeStatementLines, completeIndicators, completeValidations, completeMappings, completeTrialLines, completeDfcComposition);
      const insert = async (entity, rows) => { for (let i = 0; i < rows.length; i += 250) await entity.bulkCreate(rows.slice(i, i + 250)); };
      await Promise.all([
        insert(base44.asServiceRole.entities.FinancialStatementLine, completeStatementLines),
        insert(base44.asServiceRole.entities.FinancialIndicatorSnapshot, completeIndicators),
        insert(base44.asServiceRole.entities.FinancialValidationResult, completeValidations),
        insert(base44.asServiceRole.entities.FinancialMappingResolution, completeMappings),
        insert(base44.asServiceRole.entities.FinancialTrialBalanceLine, completeTrialLines),
        insert(base44.asServiceRole.entities.FinancialDfcCompositionLine, completeDfcComposition),
      ]);
      const expectedOutputCounts = { statement_lines: completeStatementLines.length, indicator_snapshots: completeIndicators.length, validation_results: completeValidations.length, mapping_resolutions: completeMappings.length, trial_balance_lines: completeTrialLines.length, dfc_composition_lines: completeDfcComposition.length };
      const snapshotSourceOutputs = {};
      for (const head of sourceHeads) {
        const headSnapshot = await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(head.current_processing_snapshot_id);
        if (!headSnapshot || headSnapshot.status !== 'active' || headSnapshot.financial_diagnosis_id !== diagnosis_id || headSnapshot.financial_processing_run_id !== head.current_processing_run_id || headSnapshot.output_checksum !== head.current_output_checksum) throw new Error('DFC_SOURCE_HEAD_LINEAGE_INVALID');
        snapshotSourceOutputs[head.current_processing_snapshot_id] = headSnapshot.source_manifest?.source_outputs || [];
      }
      const lineage = await invokeFinancialLifecycleDeterminismEngine(base44, 'build_dfc_lineage_manifest', { analysis_type: scope, source_heads: sourceHeads, snapshot_source_outputs: snapshotSourceOutputs, diagnosis_previous_snapshot_id: diagnosis.current_processing_snapshot_id || null });
      const headSummary = lineage.source_heads_manifest;
      const sourceOutputs = lineage.source_outputs;
      if (headSummary.length !== sourceHeads.length || sourceOutputs.length < sourceHeads.length) throw new Error('DFC_SOURCE_OUTPUT_COVERAGE_FAILED');
      const previousSnapshotId = usesSourceHead ? lineage.previous_snapshot_id : diagnosis.current_processing_snapshot_id;
      await base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId, { status: 'committing', result_summary: { success: false, snapshot_pending: true, upload_ids: [duid], source_heads: headSummary, source_outputs: sourceOutputs, expected_output_counts: expectedOutputCounts, base_processing_run_id: baseCurrentRunId, operation: 'build_dfc' } });
      const sr = await base44.functions.invoke('createFinancialProcessingSnapshot', { financial_diagnosis_id: diagnosis_id, processing_run_id: buildRunId, previous_snapshot_id: previousSnapshotId, commit_scope: usesSourceHead ? 'source_head' : 'diagnosis', publish_pointer: false });
      const ss = sr?.data || sr;
      if (!ss?.snapshot_id) throw new Error(ss?.error || 'Build DFC sem snapshot obrigatório');
      candidateSnapshotId = ss.snapshot_id;
      const persistedSnapshot = await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(ss.snapshot_id);
      if (!persistedSnapshot || persistedSnapshot.financial_processing_run_id !== buildRunId || persistedSnapshot.status !== 'candidate' || !persistedSnapshot.output_checksum) throw new Error('SNAPSHOT_POSTCONDITION_FAILED');
      const publishedAt = await publishCandidates();
      await base44.asServiceRole.entities.FinancialProcessingSnapshot.update(ss.snapshot_id, { status: 'active' });
      if (usesSourceHead) {
        for (const head of sourceHeads) {
          dfcCommittedHeads.push({ head_id: head.id, previous: { ...head } });
          await base44.asServiceRole.entities.FinancialSourceOutputHead.update(head.id, { current_processing_run_id: buildRunId, current_processing_snapshot_id: ss.snapshot_id, current_output_checksum: ss.output_checksum, updated_at: publishedAt, updated_by: user.email });
        }
        for (const head of sourceHeads) {
          const confirmed = await base44.asServiceRole.entities.FinancialSourceOutputHead.get(head.id);
          if (!confirmed || confirmed.current_processing_run_id !== buildRunId || confirmed.current_processing_snapshot_id !== ss.snapshot_id || confirmed.current_output_checksum !== ss.output_checksum) throw new Error('SOURCE_OUTPUT_HEAD_POSTCONDITION_FAILED');
        }
      }
      if (usesDiagnosisPointer) {
        await base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosis_id, { current_processing_snapshot_id: ss.snapshot_id });
        const confirmedDiagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(diagnosis_id);
        if (confirmedDiagnosis?.current_processing_snapshot_id !== ss.snapshot_id) throw new Error('DIAGNOSIS_POINTER_POSTCONDITION_FAILED');
      }
      const cleanupTargets = lineage.cleanup_targets.filter((target) => target.previous_processing_run_id && target.previous_processing_run_id !== buildRunId);
      await base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId, { status: 'succeeded', completed_at: new Date().toISOString(), output_checksum: ss.output_checksum, cleanup_pending: cleanupTargets.length > 0, result_summary: { success: true, snapshot_pending: false, snapshot_id: ss.snapshot_id, output_checksum: ss.output_checksum, upload_ids: [duid], source_heads: headSummary, source_outputs: sourceOutputs, expected_output_counts: expectedOutputCounts, base_processing_run_id: baseCurrentRunId, operation: 'build_dfc', cleanup_targets: cleanupTargets } });
      const confirmedRun = await base44.asServiceRole.entities.FinancialProcessingRun.get(buildRunId);
      if (confirmedRun?.status !== 'succeeded') throw new Error('DFC_RUN_SUCCEEDED_POSTCONDITION_FAILED');
      dfcCommitPointReached = true;
      let cleanupPending = false;
      let deferredRunIds = [];
      if (cleanupTargets.length) {
        const cleanupResponse = await base44.functions.invoke('retryFinancialOutputCleanup', { processing_run_id: buildRunId });
        const cleanupResult = cleanupResponse?.data || cleanupResponse;
        const cleanupDecision = await invokeFinancialLifecycleDeterminismEngine(base44, 'evaluate_cleanup_state', { previous_run_id: cleanupTargets[0]?.previous_processing_run_id || null, active_source_head_references: [], diagnosis_pointer_reference: null, cleanup_attempt_result: cleanupResult || {} });
        cleanupPending = cleanupDecision.cleanup_pending;
        deferredRunIds = cleanupResult?.deferred_run_ids || [];
        if (cleanupPending) await base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId, { cleanup_pending: true, error_details: { cleanup_error: cleanupResult?.error || cleanupResult?.reason || 'CLEANUP_PENDING' }, result_summary: { ...(confirmedRun.result_summary || {}), cleanup_targets: cleanupTargets, deferred_run_ids: deferredRunIds } });
      }
      return Response.json({ success: true, run_id: buildRunId, operation_key: buildOpKey, input_checksum: buildInputFingerprint, snapshot_id: ss.snapshot_id, output_checksum: ss.output_checksum, status: 'dfc_rebuilt', expected_output_counts: expectedOutputCounts, dfc_lines: (dr.lines || []).length, composition_lines: completeDfcComposition.length, validations: completeValidations.length, overrides_applied: ovMap.size, periods: sp, current_period: cp, cleanup_pending: cleanupPending, deferred_run_ids: deferredRunIds });
    } catch (err) {
      console.error('[bsV2] dfc_only ERROR:', err.message, err.stack);
      if (!dfcCommitPointReached) {
        for (const committed of [...dfcCommittedHeads].reverse()) {
          await base44.asServiceRole.entities.FinancialSourceOutputHead.update(committed.head_id, committed.previous);
          const restored = await base44.asServiceRole.entities.FinancialSourceOutputHead.get(committed.head_id);
          if (restored?.current_processing_run_id !== committed.previous.current_processing_run_id || restored?.current_processing_snapshot_id !== committed.previous.current_processing_snapshot_id) throw new Error('DFC_HEAD_ROLLBACK_POSTCONDITION_FAILED');
        }
        if (usesDiagnosisPointer) {
          await base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosis_id, dfcPreviousDiagnosisState);
          const restoredDiagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(diagnosis_id);
          if (restoredDiagnosis?.current_processing_snapshot_id !== dfcPreviousDiagnosisState.current_processing_snapshot_id) throw new Error('DFC_DIAGNOSIS_ROLLBACK_POSTCONDITION_FAILED');
        }
        await invalidateCandidates();
        if (candidateSnapshotId) await base44.asServiceRole.entities.FinancialProcessingSnapshot.update(candidateSnapshotId,{status:'invalid',invalid_reason:err.message,invalidated_at:new Date().toISOString(),invalidated_by_run_id:buildRunId});
        await base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId,{status:candidateSnapshotId?'partial_failed':'failed',completed_at:new Date().toISOString(),error_details:{error:err.message}});
        return Response.json({ error: err.message }, { status: 500 });
      }
      return Response.json({ success: true, run_id: buildRunId, cleanup_pending: true, warning: err.message }, { status: 202 });
    }
  }

  try {
    // 1. Baixar e ler Excel
    timer.start('download');
    console.log(`[buildFinancialStatements V2] Iniciando: upload_id=${upload_id}`);
    const fileResp = await fetch(upload.file_url);
    if (!fileResp.ok) throw new Error(`Falha ao baixar arquivo: HTTP ${fileResp.status}`);
    const raw = new Uint8Array(await fileResp.arrayBuffer());
    timer.end('download');
    
    timer.start('parse_excel');
    const cleaned = stripStylesFromXlsx(raw);
    const workbook = readXlsxSafely(cleaned);
    timer.end('parse_excel');
    console.log(`[buildFinancialStatements V2] Excel lido: ${workbook.SheetNames.length} abas`);

    // 2. Localizar aba Balancete
    timer.start('extract_periods');
    const sheetNames = workbook.SheetNames.map(n => n.toLowerCase());
    const balanceteIdx = sheetNames.findIndex(n => n === 'balancete' || n === 'trial balance' || n === 'trialbalance');
    if (balanceteIdx < 0) throw new Error('Aba Balancete não encontrada.');

    const sheet = workbook.Sheets[workbook.SheetNames[balanceteIdx]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (rawRows.length < 2) throw new Error('Aba Balancete está vazia.');
    timer.end('extract_periods');

    const headers = (rawRows[0] || []).map(h => String(h ?? '').trim());
    const dataRows = rawRows.slice(1).filter(row => row?.some(c => c != null && c !== ''));

    // Índice rápido do plano de contas por account_code (normalizado) — declarado aqui para ser acessível nos blocos seguintes
    const accountPlanByCode = {};
    for (const line of accountPlanLines) {
      const normalized = String(line.account_code || '').replace(/\./g, '').trim();
      accountPlanByCode[normalized] = line;
    }

    // 2b. Verificar se há aba "Contas" ou "contas" com classificação embutida no Excel
    //     Ela tem prioridade sobre o plano de contas externo se existir
    const contasIdx = sheetNames.findIndex(n => n === 'contas' || n === 'conta' || n === 'mapping' || n === 'plano');
    if (contasIdx >= 0 && Object.keys(accountPlanByCode).length === 0) {
      const contasSheet = workbook.Sheets[workbook.SheetNames[contasIdx]];
      const contasRows = XLSX.utils.sheet_to_json(contasSheet, { header: 1, defval: null });
      const contasHeaders = (contasRows[0] || []).map(h => String(h ?? '').trim());
      const codeIdx    = contasHeaders.findIndex(h => norm(h).includes('account_code') || norm(h).includes('conta') || norm(h).includes('codigo'));
      const classIdx2  = contasHeaders.findIndex(h => norm(h).includes('classification') || norm(h).includes('classificacao') || norm(h).includes('rubrica'));
      const stmtIdx    = contasHeaders.findIndex(h => norm(h).includes('statement_code') || norm(h).includes('demonstracao'));
      const grpIdx     = contasHeaders.findIndex(h => norm(h).includes('statement_group') || norm(h).includes('grupo'));
      const signIdx2   = contasHeaders.findIndex(h => norm(h).includes('sign_rule') || norm(h).includes('sinal'));
      const canonIdx   = contasHeaders.findIndex(h => norm(h).includes('canonical_key') || norm(h).includes('canonical'));

      if (codeIdx >= 0 && classIdx2 >= 0) {
        let inlineCount = 0;
        for (const row of contasRows.slice(1)) {
          const code = String(row[codeIdx] ?? '').replace(/\./g, '').trim();
          const cls  = String(row[classIdx2] ?? '').trim();
          if (!code || !cls) continue;
          accountPlanByCode[code] = {
            account_code:    code,
            account_name:    cls,
            canonical_key:   canonIdx >= 0 ? String(row[canonIdx] ?? '').trim() || null : null,
            statement_code:  stmtIdx  >= 0 ? String(row[stmtIdx]  ?? '').trim() || null : null,
            statement_group: grpIdx   >= 0 ? String(row[grpIdx]   ?? '').trim() || null : null,
            sign_rule:       signIdx2 >= 0 ? String(row[signIdx2] ?? '').trim() || 'normal' : 'normal',
          };
          inlineCount++;
        }
        console.log(`[buildFinancialStatements V2] Aba "Contas" carregada inline: ${inlineCount} entradas`);
      }
    } else if (contasIdx >= 0) {
      // Plano externo já carregado, mas também lê aba Contas para complementar entradas faltantes
      const contasSheet = workbook.Sheets[workbook.SheetNames[contasIdx]];
      const contasRows = XLSX.utils.sheet_to_json(contasSheet, { header: 1, defval: null });
      const contasHeaders = (contasRows[0] || []).map(h => String(h ?? '').trim());
      const codeIdx    = contasHeaders.findIndex(h => norm(h).includes('account_code') || norm(h).includes('conta') || norm(h).includes('codigo'));
      const classIdx2  = contasHeaders.findIndex(h => norm(h).includes('classification') || norm(h).includes('classificacao') || norm(h).includes('rubrica'));
      const stmtIdx    = contasHeaders.findIndex(h => norm(h).includes('statement_code') || norm(h).includes('demonstracao'));
      const grpIdx     = contasHeaders.findIndex(h => norm(h).includes('statement_group') || norm(h).includes('grupo'));
      const signIdx2   = contasHeaders.findIndex(h => norm(h).includes('sign_rule') || norm(h).includes('sinal'));
      const canonIdx   = contasHeaders.findIndex(h => norm(h).includes('canonical_key') || norm(h).includes('canonical'));

      if (codeIdx >= 0 && classIdx2 >= 0) {
        let inlineCount = 0;
        let skipped = 0;
        for (const row of contasRows.slice(1)) {
          const code = String(row[codeIdx] ?? '').replace(/\./g, '').trim();
          const cls  = String(row[classIdx2] ?? '').trim();
          if (!code || !cls) continue;
          // PLANO DE CONTAS EXTERNO É A ÂNCORA — nunca sobrescrever.
          // A aba "Contas" do Excel só preenche lacunas (contas que NÃO estão no plano vinculado).
          if (accountPlanByCode[code]) { skipped++; continue; }
          accountPlanByCode[code] = {
            account_code:    code,
            account_name:    cls,
            canonical_key:   canonIdx >= 0 ? String(row[canonIdx] ?? '').trim() || null : null,
            statement_code:  stmtIdx  >= 0 ? String(row[stmtIdx]  ?? '').trim() || null : null,
            statement_group: grpIdx   >= 0 ? String(row[grpIdx]   ?? '').trim() || null : null,
            sign_rule:       signIdx2 >= 0 ? String(row[signIdx2] ?? '').trim() || 'normal' : 'normal',
          };
          inlineCount++;
        }
        console.log(`[buildFinancialStatements V2] Aba "Contas" como fallback (plano externo preservado): ${inlineCount} novas, ${skipped} preservadas do plano`);
      }
    }

    // 3. Mapear índices de colunas
    timer.start('classify_map');
    const colIdx = (patterns) => {
      const hNorm = headers.map(norm);
      for (const p of patterns) {
        const idx = hNorm.findIndex(h => h.includes(p));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const contaIdx        = colIdx(['account_code','cod_conta','conta','codigo','cod','code']);
    const descIdx         = colIdx(['account_description','descricao','description','nome','name']);
    const acctTypeIdx     = colIdx(['account_type','tipo_conta','account type','tipo']); // A=analítica, S=sintética
    const classIdx        = colIdx(['classification','classificacao','rubrica','categoria']);
    const stmtCodeIdx     = colIdx(['statement_code','demonstracao','demonstração','statement']);
    const stmtGroupIdx    = colIdx(['statement_group','grupo_demonstracao','grupo gerencial','grupo','section']);
    const signIdx         = colIdx(['sign_rule','regra_sinal','regrasinal','sinal','sign']);
    const displayOrderIdx = colIdx(['display_order','ordem','order']);
    const noteRefIdx      = colIdx(['note_reference','nota_explicativa_ref','nota_ref','note_ref','nota']);
    const classSrcIdx     = colIdx(['classification_source','fonte_classificacao']);

    // 4. Extrair blocos de período
    let periodBlocks = extractPeriodBlocks(headers);
    if (period_override) {
      const m = String(period_override).match(/^(\d{2})[/](\d{4})$/);
      const normalizedPeriod = m ? `${m[2]}-${m[1]}` : period_override;
      // Substitui SEM_DATA OU sobrescreve todos os blocos se só tem 1 período (sem data no header)
      if (periodBlocks.length === 1 && periodBlocks[0].period === 'SEM_DATA') {
        periodBlocks = periodBlocks.map(b => ({ ...b, period: normalizedPeriod }));
      } else if (periodBlocks.length === 0) {
        // Fallback: tenta encontrar qualquer coluna numérica como saldo final
        const closingIdx = headers.findIndex(h => {
          const hn = norm(h);
          return hn.includes('closing') || hn.includes('saldo final') || hn.includes('saldofinal') || hn.includes('closing_balance');
        });
        if (closingIdx >= 0) {
          periodBlocks = [{ period: normalizedPeriod, saldoFinalIdx: closingIdx }];
          console.log(`[buildFinancialStatements V2] Period override aplicado via fallback: ${normalizedPeriod}, coluna idx=${closingIdx}`);
        }
      } else {
        periodBlocks = periodBlocks.map(b => ({
          ...b,
          period: b.period === 'SEM_DATA' ? normalizedPeriod : b.period,
        }));
      }
    } else if (periodBlocks.length === 0) {
      // Sem period_override: tenta encontrar coluna closing_balance como fallback
      const closingIdx = headers.findIndex(h => {
        const hn = norm(h);
        return hn.includes('closing_balance') || hn.includes('saldo final') || hn.includes('closing');
      });
      if (closingIdx >= 0) {
        periodBlocks = [{ period: 'SEM_DATA', saldoFinalIdx: closingIdx }];
        console.log(`[buildFinancialStatements V2] Fallback period: SEM_DATA, coluna idx=${closingIdx}`);
      }
    }

    if (periodBlocks.length === 0) {
      throw new Error('Nenhum período encontrado. Use o campo "Período de referência" para informar a data do balancete (ex: 12/2025).');
    }
    // TRAVA: se caiu no fallback SEM_DATA sem period_override, bloquear — evita coluna fantasma
    if (!period_override && periodBlocks.every(b => b.period === 'SEM_DATA')) {
      throw new Error('Período não identificado no cabeçalho do Excel e nenhum período de referência foi informado. Reimporte o arquivo informando a data-base (ex: 12/2025).');
    }
    timer.end('classify_map');

    // Mapa period → { column_key, column_label, period_type } — garante coluna única por natureza
    const colMetaMap = {};
    for (const { period } of periodBlocks) {
      colMetaMap[period] = deriveColumnMeta(columnLabel, period);
    }
    console.log('[buildFinancialStatements V2] colMetaMap:', JSON.stringify(colMetaMap));

    // 5. Processar linhas analíticas
    timer.start('build_statements');
    // aggregated[period][canonical_key] = soma de valores
    // rubricMeta[canonical_key] = { rubric_label, group_label, statement_code, sign_rule, display_order, note_reference, family }
    // sourceMap[period][canonical_key] = { accounts: [], rows: [] }
    // ebitdaAgg[period][ebitda_component] = soma de valores das contas marcadas
    const aggregated = {};
    const rubricMeta = {};
    const sourceMap  = {};
    const ebitdaAgg  = {}; // acumulação EBITDA gerencial por componente
    const trialLines = [];
    const mappingResolutions = [];
    const entityCode = upload?.source_entity_id || diagnosis.unit_id || diagnosis.company_id || diagnosis.group_id || 'MAIN';

    // dfcBalancesByPeriod[period][bucket] = { value, accounts: [], rows: [], entity_code }
    const dfcBalancesByPeriod = {};
    function addDfcBalance({ periodKey, dfcClassification, value, accountCode, accountName, rowNumber, entityCode: ec }) {
      if (!periodKey || !dfcClassification) return;
      if (!dfcBalancesByPeriod[periodKey]) dfcBalancesByPeriod[periodKey] = {};
      if (!dfcBalancesByPeriod[periodKey][dfcClassification]) {
        dfcBalancesByPeriod[periodKey][dfcClassification] = { value: 0, accounts: [], rows: [], entity_code: ec || null };
      }
      const numericValue = Number(value || 0);
      dfcBalancesByPeriod[periodKey][dfcClassification].value += numericValue;
      dfcBalancesByPeriod[periodKey][dfcClassification].accounts.push({ account_code: accountCode || null, account_name: accountName || null, value: numericValue });
      if (rowNumber) dfcBalancesByPeriod[periodKey][dfcClassification].rows.push(rowNumber);
    }

    console.log(`[buildFinancialStatements V2] Processando ${dataRows.length} linhas, ${periodBlocks.length} períodos`);

    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      const accountCode = contaIdx >= 0 ? String(row[contaIdx] ?? '').trim() : '';
      const accountDesc = descIdx  >= 0 ? String(row[descIdx]  ?? '').trim() : '';
      if (!accountCode && !accountDesc) continue;

      // Verificar account_type: S = sintética (agrupadora, sem saldo direto — só lookup no plano)
      // A = analítica (tem saldo, entra nos demonstrativos). Sem coluna = trata como analítica.
      const acctTypeRaw = acctTypeIdx >= 0 ? String(row[acctTypeIdx] ?? '').trim().toUpperCase() : 'A';
      const isSynthetic = acctTypeRaw === 'S' || acctTypeRaw === 'SINTETICA' || acctTypeRaw === 'SINTÉTICA';
      if (isSynthetic) continue; // Contas sintéticas não acumulam saldo — servem só para estrutura

      const classRaw     = classIdx       >= 0 ? String(row[classIdx]       ?? '').trim() : '';
      const stmtCodeRaw  = stmtCodeIdx    >= 0 ? String(row[stmtCodeIdx]    ?? '').trim() : '';
      const stmtGroupRaw = stmtGroupIdx   >= 0 ? String(row[stmtGroupIdx]   ?? '').trim() : '';
      const signRaw      = signIdx        >= 0 ? String(row[signIdx]        ?? '').trim() : 'normal';
      const displayOrder = displayOrderIdx >= 0 ? Number(row[displayOrderIdx] ?? 0) : 0;
      const noteRef      = noteRefIdx     >= 0 ? String(row[noteRefIdx]     ?? '').trim() : '';
      const classSrc     = classSrcIdx    >= 0 ? String(row[classSrcIdx]    ?? '').trim() : 'excel';

      const hasClass = !!classRaw;
      let canonical_key = null;
      let rubric_label  = classRaw;
      let statement_code = null;
      let family = null;
      let dfcClassification = null;

      // Verificar se há correspondência no plano de contas
      // Match direto primeiro (código normalizado sem pontos)
      const accountCode_normalized = String(accountCode || '').replace(/\./g, '').trim();
      let planLine = accountPlanByCode[accountCode_normalized];
      // Se não bateu diretamente, tenta match por sufixo (ex: "10101" bate em "10101010001")
      if (!planLine && accountCode_normalized) {
        for (const [k, v] of Object.entries(accountPlanByCode)) {
          if (k.endsWith(accountCode_normalized) || accountCode_normalized.endsWith(k)) {
            planLine = v;
            break;
          }
        }
      }

      // ── PLANO DE CONTAS É A ÂNCORA DE QUALIDADE (fonte primária) ──
      // Quando o plano está vinculado e tem a conta, a classificação do plano VENCE.
      // A coluna "classification" do Excel é apenas FALLBACK para contas fora do plano.
      if (planLine) {
        // Prioridade: canonical_key > classification > account_name (alias)
        // PLANO É A ÂNCORA: a classification do plano é a fonte de verdade para
        // o rótulo da rubrica — contas com a mesma classification se agregam
        // sob UM único rótulo (ex: "Caixa e equivalentes de caixa").
        if (planLine.canonical_key) {
          canonical_key = planLine.canonical_key;
          rubric_label  = planLine.classification || CANONICAL_RUBRIC_LABEL[planLine.canonical_key] || planLine.account_name || classRaw || accountDesc;
        } else if (planLine.classification) {
          const resolved = resolveClassification(planLine.classification);
          canonical_key  = resolved.canonical_key;
          rubric_label   = planLine.classification;
        } else if (planLine.account_name) {
          const resolved = resolveClassification(planLine.account_name);
          canonical_key  = resolved.canonical_key;
          rubric_label   = planLine.account_name;
        }
        if (canonical_key) {
          statement_code = resolveStatementCode(planLine.statement_code || '') || inferStatementCode(canonical_key);
          family = statementCodeToFamily(statement_code);
          dfcClassification = planLine.dfc_classification || null;
          // bp_group define o bloco visual no BP (substitui o antigo statement_group)
          if (planLine.bp_group && !CANONICAL_META[canonical_key]) {
            const BP_GROUP_MAP = {
              'ativo_circulante':       'Ativo circulante',
              'ativo_nao_circulante':   'Ativo não circulante',
              'passivo_circulante':     'Passivo circulante',
              'passivo_nao_circulante': 'Passivo não circulante',
              'patrimonio_liquido':     'Patrimônio líquido',
            };
            const groupLabel = BP_GROUP_MAP[planLine.bp_group] || null;
            if (groupLabel) {
              registerDynamicCanonical(canonical_key, statement_code, groupLabel);
            }
          }
        }
      } else if (hasClass) {
        // FALLBACK: conta não está no plano — usa a classification do Excel
        const resolved = resolveClassification(classRaw);
        canonical_key = resolved.canonical_key;
        rubric_label  = resolved.rubric_label;
        statement_code = resolveStatementCode(stmtCodeRaw) || inferStatementCode(canonical_key);
        family = statementCodeToFamily(statement_code);
      }

      if (!dfcClassification && accountCode_normalized) {
        dfcClassification = dfcClassificationByCode[accountCode_normalized] || null;
      }

      // Proteção: se o plano/Excel mapeou para uma chave calculada (ex: receita_liquida),
      // reclassificar automaticamente para o canonical composed correto — ANTES de registrar rubricMeta.
      if (canonical_key && CALCULATED_KEYS.has(canonical_key)) {
        const originalKey = canonical_key;
        const remapped = CALCULATED_KEY_REMAP[originalKey] || null;
        console.warn(`[buildFinancialStatements V2] "${originalKey}" é chave calculada — remapeando para "${remapped}" (conta: ${accountCode || accountDesc})`);
        canonical_key = remapped;
      }

      if (canonical_key && !rubricMeta[canonical_key]) {
        // Resolve grupo: CANONICAL_META tem prioridade, depois normaliza o Excel, depois mantém raw
        const resolvedGroup = resolveGroupLabel(canonical_key, stmtGroupRaw);
        const resolvedCode  = CANONICAL_META[canonical_key]?.code || statement_code;
        const resolvedFamily= statementCodeToFamily(resolvedCode);

        // Se o canonical_key não existe no CANONICAL_META mas temos grupo e código,
        // registramos dinamicamente — garante que QUALQUER rubrica do Excel apareça no demonstrativo
        if (resolvedGroup && resolvedCode) {
          registerDynamicCanonical(canonical_key, resolvedCode, resolvedGroup);
        }

        rubricMeta[canonical_key] = {
          canonical_key,
          // O texto do usuário sempre vence — o canônico é apenas fallback para rubricas não digitadas
          rubric_label: rubric_label || CANONICAL_RUBRIC_LABEL[canonical_key],
          rubric_label_excel: rubric_label,
          group_label: resolvedGroup,
          statement_code: resolvedCode,
          sign_rule: norm(signRaw).includes('invert') ? 'invert' : 'normal',
          display_order: displayOrder || 0,
          note_reference: noteRef || null,
          classification_source: classSrc || 'excel',
          family: resolvedFamily,
        };
      }

      // Ignorar linhas com canonical_key inválido (string "null", vazio, etc.)
      if (!canonical_key || canonical_key === 'null' || canonical_key === 'undefined') {
        canonical_key = null;
      }

      for (const { period, saldoFinalIdx } of periodBlocks) {
        const rawVal = row[saldoFinalIdx];
        const rawNum = rawVal != null && rawVal !== '' ? Number(rawVal) : null;
        if (rawNum == null || isNaN(rawNum)) continue;

        const value = applySign(rawNum, signRaw, statement_code, canonical_key);
        if (canonical_key && isPLKey(canonical_key) && !verifyPLSign(rawNum, value, canonical_key))
          console.warn(`[buildFinancialStatements V2] PL SIGN FAIL: conta=${accountCode} ck=${canonical_key} raw=${rawNum} applied=${value}`);

        trialLines.push({
          financial_upload_id:    upload_id,
          financial_diagnosis_id: diagnosis_id,
          tenant_id:              diagnosis.tenant_id,
          entity_code:            entityCode,
          entity_level:           diagnosis.scope_level,
          period,
          account_code:           accountCode,
          account_description:    accountDesc,
          closing_balance:        value,
          source_sheet:           workbook.SheetNames[balanceteIdx],
          source_row:             rowIdx + 2,
        });

        if (canonical_key) {
          if (!aggregated[period]) aggregated[period] = {};
          if (!sourceMap[period]) sourceMap[period] = {};
          if (!sourceMap[period][canonical_key]) sourceMap[period][canonical_key] = { accounts: [], rows: [] };
          aggregated[period][canonical_key] = (aggregated[period][canonical_key] ?? 0) + value;
          sourceMap[period][canonical_key].accounts.push(accountCode || accountDesc);
          sourceMap[period][canonical_key].rows.push(rowIdx + 2);
        }

        // Acumulação EBITDA gerencial — busca ebitda_component pelo código da conta
        const accountCode_norm2 = accountCode_normalized || String(accountCode || '').replace(/\./g, '').trim();
        let ebitdaComp = ebitdaComponentByCode[accountCode_norm2];
        // Fallback: busca por sufixo
        if (!ebitdaComp && accountCode_norm2) {
          for (const [k, v] of Object.entries(ebitdaComponentByCode)) {
            if (k.endsWith(accountCode_norm2) || accountCode_norm2.endsWith(k)) {
              ebitdaComp = v; break;
            }
          }
        }
        if (ebitdaComp && ebitdaComp !== 'excluir') {
          if (!ebitdaAgg[period]) ebitdaAgg[period] = {};
          ebitdaAgg[period][ebitdaComp] = (ebitdaAgg[period][ebitdaComp] ?? 0) + value;
        }

        // Acumulação de ajustes sem efeito caixa (DRE) — única finalidade de dfc_classification agora.
        // O restante da DFC (cash/operating/investing/financing) é inferido pela rubrica do BP, não por aqui.
        if (classifyNonCashAdjustment(dfcClassification)) {
          addDfcBalance({
            periodKey: period,
            dfcClassification: 'non_cash_adjustment',
            value: Math.abs(value),
            accountCode,
            accountName: accountDesc,
            rowNumber: rowIdx + 2,
            entityCode,
          });
        }
      }

      const isMapped = !!canonical_key;
      const mapping = {
        financial_upload_id:    upload_id,
        financial_diagnosis_id: diagnosis_id,
        tenant_id:              diagnosis.tenant_id,
        account_code:           accountCode,
        account_description:    accountDesc,
        mapping_source:         hasClass ? 'excel_mapping' : (isMapped ? 'account_plan' : 'unmapped'),
        managerial_rubric:      canonical_key || null,
        statement_family:       family        || null,
        sign_rule:              (hasClass || isMapped) ? (norm(signRaw).includes('invert') ? 'inverted' : 'normal') : 'normal',
        resolved_confidence:    isMapped ? 'high' : 'unresolved',
        blocking_issue:         !isMapped,
        blocking_reason:        !isMapped ? 'Conta sem classificação' : null,
      };
      mappingResolutions.push(mapping);
    }

    // 6. Computar linhas derivadas
    timer.end('build_statements');
    const allPeriods = Object.keys(aggregated);
    
    timer.start('build_indicators');
    for (const period of allPeriods) {
      const engineResponse = await base44.functions.invoke('executeFinancialEngine', {
        action: 'compute', source_values: aggregated[period],
        context: { period, dataset_scope: datasetScope, reporting_entity_id: reportingEntityId },
      });
      const engine = engineResponse?.data || engineResponse;
      if (engine?.error || !engine?.statements) throw new Error(engine?.error || 'FINANCIAL_ENGINE_UNAVAILABLE');
      aggregated[period] = engine.statements;
    }
    timer.end('build_indicators');

    // 6b. Vazão do resultado líquido da DRE para conta do PL (sem encerramento)
    // Se o usuário indicou a conta do PL que acumula o resultado, somamos o resultado_liquido
    // ao saldo já existente dessa conta no BP.
    // plCanonicalKey pode ser null se a conta no plano não tiver canonical_key preenchido —
    // nesse caso resolvemos o canonical_key da conta pelo accountPlanByCode ou pelo aggregated.
    const resolvedPlCanonicalKey = (() => {
      if (plCanonicalKey) return plCanonicalKey;
      if (!plAccountCode) return null;
      const normalizedPl = String(plAccountCode).replace(/\./g, '').trim();

      // 1. Plano de contas: canonical_key direto
      const planEntry = accountPlanByCode[normalizedPl];
      if (planEntry?.canonical_key) return planEntry.canonical_key;

      // 2. Plano de contas: via classification do plano
      if (planEntry?.classification) {
        const resolved = resolveClassification(planEntry.classification);
        if (resolved?.canonical_key) return resolved.canonical_key;
      }

      // 3. Plano de contas: via account_name (alias)
      if (planEntry?.account_name) {
        const resolved = resolveClassification(planEntry.account_name);
        if (resolved?.canonical_key) return resolved.canonical_key;
      }

      // 4. sourceMap: a conta já foi processada — encontrar o canonical_key pelo account_code
      for (const period of Object.keys(aggregated)) {
        for (const [ck, src] of Object.entries(sourceMap[period] || {})) {
          if (src.accounts.includes(plAccountCode) || src.accounts.includes(normalizedPl)) {
            return ck;
          }
        }
      }

      return null;
    })();

    console.log(`[buildFinancialStatements V2] Vazão DRE→PL: plAccountCode="${plAccountCode}" resolvido para canonical_key="${resolvedPlCanonicalKey}"`);

    if (resolvedPlCanonicalKey) {
      for (const period of allPeriods) {
        const rl = aggregated[period]?.['resultado_liquido'] ?? 0;
        console.log(`[buildFinancialStatements V2] Vazão DRE→PL check: resolvedPlCanonicalKey="${resolvedPlCanonicalKey}", resultado_liquido=${rl}, period=${period}`);
        
        let targetKey = resolvedPlCanonicalKey;
        
        if (rl !== 0) {
          aggregated[period][targetKey] = (aggregated[period][targetKey] ?? 0) + rl;
          console.log(`[buildFinancialStatements V2] Vazão DRE→PL: resultado_liquido=${rl} somado a "${targetKey}" → novo valor=${aggregated[period][targetKey]} em ${period}`);

          // Garantir que rubricMeta inclui a chave do PL para aparecer no BP
          // (caso a conta exista no balancete com saldo zero ou não apareça)
          if (!rubricMeta[targetKey]) {
            rubricMeta[targetKey] = {
              canonical_key:   targetKey,
              rubric_label:    importConfig.pl_account_name || targetKey.replace(/_/g, ' '),
              group_label:     'Patrimônio líquido',
              statement_code:  'BP',
              sign_rule:       'normal',
              display_order:   0,
              note_reference:  null,
              family:          'balance_sheet',
            };
            // Registrar no CANONICAL_META para que o BalanceSheetView posicione corretamente
            registerDynamicCanonical(targetKey, 'BP', 'Patrimônio líquido');
          }

          // Recalcular total_passivo_pl somando todos os canonical_keys mapeados como BP passivo/PL
          // Inclui chaves fixas + qualquer chave customizada do targetKey
          const passivoPlKeys = Object.keys(rubricMeta).filter(k => {
            const meta = rubricMeta[k];
            return meta.statement_code === 'BP' && (
              k.startsWith('passivo') || k.startsWith('patrimonio') || k === targetKey
            );
          });
          aggregated[period]['total_passivo_pl'] = passivoPlKeys.reduce(
            (sum, k) => sum + (aggregated[period][k] ?? 0), 0
          );
        }
      }
    }

    // 6c. Verificação sumária de inversão de sinal do PL
    const plIssues = [];
    for (const period of allPeriods) for (const [ck, val] of Object.entries(aggregated[period] || {}))
      if (isPLKey(ck) && ((ck==='patrimonio_prejuizos'||ck==='prejuizo_do_exercicio') ? val>0 : val<0)) plIssues.push({period, ck, val});
    console.log(plIssues.length ? `[buildFinancialStatements V2] PL SIGN ISSUES: ${JSON.stringify(plIssues)}` : `[buildFinancialStatements V2] PL SIGN OK: todas contas PL corretas (${allPeriods.length} período(s))`);

    // Motor produtivo único: fórmulas, totais, indicadores e Kanitz vêm do adapter canônico.
    const productionIndicatorsByPeriod = {};
    const productionBpByPeriod = {};
    for (const period of allPeriods) {
      const engineResponse = await base44.functions.invoke('executeFinancialEngine', {
        action: 'compute', source_values: aggregated[period],
        context: { period, dataset_scope: datasetScope, entity_code: entityCode, reporting_entity_id: reportingEntityId },
      });
      const engine = engineResponse?.data || engineResponse;
      if (engine?.error) throw new Error(engine.error);
      aggregated[period] = engine.statements;
      productionIndicatorsByPeriod[period] = engine.indicators || [];
      productionBpByPeriod[period] = engine.bp;
    }

    // 7. Validar fechamento do BP — resultado exclusivo do motor canônico.
    const bpBalance = Object.fromEntries(allPeriods.map((period) => {
      const bp = productionBpByPeriod[period];
      return [period, { ativo: bp?.expected, passivo_pl: bp?.actual, diff: bp?.difference, balanced: bp?.balanced === true }];
    }));

    // 7b. Validação de integridade — BP deve zerar (Ativo = Passivo + PL)
    const bpBalanceValidations = [];
    for (const period of allPeriods) {
      const bal = bpBalance[period];
      if (bal?.balanced !== true) {
        const sourceUnavailable = bal?.ativo == null || bal?.passivo_pl == null;
        const nonFinite = !sourceUnavailable && (!Number.isFinite(bal.ativo) || !Number.isFinite(bal.passivo_pl));
        const code = sourceUnavailable ? 'BP_SOURCE_UNAVAILABLE' : nonFinite ? 'BP_NON_FINITE_TOTAL' : 'BP_ACCOUNTING_EQUATION_MISMATCH';
        const money = (value) => Number.isFinite(value) ? value.toFixed(2) : 'indisponível';
        bpBalanceValidations.push({
          period, severity: 'blocking', category: 'balancete', code,
          title: 'Balanço Patrimonial inválido',
          message: `O BP do período ${period} foi bloqueado. Ativo: ${money(bal?.ativo)} | Passivo + PL: ${money(bal?.passivo_pl)} | Diferença: ${money(bal?.diff)}.`,
          blocking: true,
        });
      }
    }
    if (bpBalanceValidations.length > 0) {
      const validations = bpBalanceValidations.map((validation) => ({
        financial_upload_id: upload_id, financial_diagnosis_id: diagnosis_id, tenant_id: diagnosis.tenant_id,
        dataset_scope: datasetScope, reporting_entity_id: reportingEntityId,
        expected: bpBalance[validation.message.match(/período ([^ ]+)/)?.[1]]?.ativo ?? null,
        actual: bpBalance[validation.message.match(/período ([^ ]+)/)?.[1]]?.passivo_pl ?? null,
        difference: bpBalance[validation.message.match(/período ([^ ]+)/)?.[1]]?.diff ?? null,
        ...validation,
      }));
      const oldBpVals = await base44.asServiceRole.entities.FinancialValidationResult.filter({ financial_diagnosis_id: diagnosis_id, code: 'BP_ACCOUNTING_EQUATION_MISMATCH' }, 'id', 100);
      if (oldBpVals.length) await base44.asServiceRole.entities.FinancialValidationResult.deleteMany({ id: { $in: oldBpVals.map((item) => item.id) } });
      await base44.asServiceRole.entities.FinancialValidationResult.bulkCreate(validations.map((item) => ({ ...item, processing_run_id: buildRunId, publication_status: 'invalid', invalidated_at: new Date().toISOString(), invalidation_reason: 'BP_ACCOUNTING_EQUATION_MISMATCH' })));
      await Promise.all([
        base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId, { status: 'failed', completed_at: new Date().toISOString(), error_details: { code: 'BP_ACCOUNTING_EQUATION_MISMATCH', validations } }),
        base44.asServiceRole.entities.FinancialUpload.update(upload_id, { upload_status: 'validation_failed' }),
        base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosis_id, { status: 'validation_failed' }),
      ]);
      return Response.json({ error: 'BP_ACCOUNTING_EQUATION_MISMATCH', validations }, { status: 422 });
    }

    // 8. Compor FinancialStatementLine com camada visual completa
    const statementLines = [];
    const sanitizeNumber = (v, def = null) => {
      if (v == null) return def;
      const n = Number(v);
      return isNaN(n) ? def : n;
    };

    for (const period of allPeriods) {
      // 8a. Linhas compostas (classification → rubrica sintética)
      for (const [canonical_key, meta] of Object.entries(rubricMeta)) {
        const value = aggregated[period]?.[canonical_key] ?? 0;
        const src   = sourceMap[period]?.[canonical_key]  ?? { accounts: [], rows: [] };

        statementLines.push({
          financial_upload_id:        upload_id,
          financial_diagnosis_id:     diagnosis_id,
          tenant_id:                  diagnosis.tenant_id,
          entity_code:                entityCode,
          entity_level:               diagnosis.scope_level,
          period,
          // ─── Camada visual/contábil ───
          statement_code:             meta.statement_code,
          group_label:                meta.group_label,
          rubric_label:               meta.rubric_label,
          line_type:                  'composed',
          display_order:              meta.display_order || 0,
          note_reference:             meta.note_reference || null,
          // ─── Camada analítica ───
          canonical_key,
          // ─── Legado (compatibilidade) ───
          statement_family:           meta.family,
          statement_section:          meta.group_label,
          managerial_group:           meta.group_label || meta.rubric_label,
          managerial_rubric:          canonical_key,
          // ─── Dados ───
          value:                      sanitizeNumber(value, 0),
          is_consolidated:            false,
          composition_account_codes:  src.accounts,
        });
      }

      // 8b. Linhas calculadas DRE (subtotais e total)
      for (const calc of DRE_CALCULATED) {
        const value = aggregated[period]?.[calc.canonical_key] ?? 0;
        statementLines.push({
          financial_upload_id:    upload_id,
          financial_diagnosis_id: diagnosis_id,
          tenant_id:              diagnosis.tenant_id,
          entity_code:            entityCode,
          entity_level:           diagnosis.scope_level,
          period,
          // ─── Camada visual/contábil ───
          statement_code:         'DRE',
          group_label:            calc.group_label,
          rubric_label:           calc.rubric_label,
          line_type:              calc.line_type,
          display_order:          calc.display_order,
          note_reference:         null,
          // ─── Camada analítica ───
          canonical_key:          calc.canonical_key,
          // ─── Legado ───
          statement_family:       'dre',
          statement_section:      calc.group_label,
          managerial_group:       calc.rubric_label,
          managerial_rubric:      calc.canonical_key,
          // ─── Dados ───
          value:                  sanitizeNumber(value, 0),
          is_consolidated:        false,
          composition_account_codes: [],
        });
      }

      // 8c. Totais BP (Total do Ativo e Total Passivo + PL)
      for (const [canonical_key, label] of [
        ['total_ativo_circulante', 'Total do Ativo Circulante'],
        ['total_ativo_nao_circulante', 'Total do Ativo Não Circulante'],
        ['total_ativo', 'Total do Ativo'],
        ['total_passivo_circulante', 'Total do Passivo Circulante'],
        ['total_passivo_nao_circulante', 'Total do Passivo Não Circulante'],
        ['total_passivo', 'Total do Passivo'],
        ['total_patrimonio_liquido', 'Total do Patrimônio Líquido'],
        ['total_passivo_patrimonio_liquido', 'Total Passivo e Patrimônio Líquido'],
      ]) {
        const value = aggregated[period]?.[canonical_key] ?? 0;
        statementLines.push({
          financial_upload_id:    upload_id,
          financial_diagnosis_id: diagnosis_id,
          tenant_id:              diagnosis.tenant_id,
          entity_code:            entityCode,
          entity_level:           diagnosis.scope_level,
          period,
          // ─── Camada visual/contábil ───
          statement_code:         'BP',
          group_label:            'total',
          rubric_label:           label,
          line_type:              'total',
          display_order:          999,
          note_reference:         null,
          // ─── Camada analítica ───
          canonical_key,
          // ─── Legado ───
          statement_family:       'balance_sheet',
          statement_section:      'total',
          managerial_group:       label,
          managerial_rubric:      canonical_key,
          // ─── Dados ───
          value:                  sanitizeNumber(value, 0),
          is_consolidated:        false,
          composition_account_codes: [],
        });
      }
    }

    // 9. KPIs + validações DRE
    timer.start('validate');
    const dreValidations = [];
    const dreValid = true;
    timer.end('validate');

    const calcResult = {
      indicators: allPeriods.flatMap((period) => (productionIndicatorsByPeriod[period] || []).map((indicator) => ({ ...indicator, period }))),
      validations: allPeriods.flatMap((period) => (productionIndicatorsByPeriod[period] || [])
        .filter((indicator) => indicator.validation_code)
        .map((indicator) => ({ severity: 'warning', category: 'balanco_composicao', code: indicator.validation_code, title: `Indicador ${indicator.indicator_code} indisponível`, message: `Fonte ou denominador indisponível no período ${period}.` }))),
    };
    const indicatorLines = calcResult.indicators.map(ind => ({
      financial_diagnosis_id: diagnosis_id,
      financial_upload_id:    upload_id,
      tenant_id:              diagnosis.tenant_id,
      entity_code:            entityCode,
      entity_level:           diagnosis.scope_level,
      ...ind,
    }));

    // 9b. EBITDA Gerencial — indicadores derivados dos ebitda_component do plano
    // Calcula EBITDA = receita_bruta + deducoes_receita + custos + despesas_operacionais + outras_receitas_despesas
    // (sinais já vêm do balancete: receita positiva, custos/despesas negativos)
    const EBITDA_SIGN = {
      receita_bruta:             +1,
      deducoes_receita:          +1, // já vêm negativos do balancete
      custos:                    +1,
      despesas_operacionais:     +1,
      outras_receitas_despesas:  +1,
    };
    const EBITDA_COMP_LABEL = {
      receita_bruta:            'Receita Bruta (EBITDA)',
      deducoes_receita:         'Deduções de Receita (EBITDA)',
      custos:                   'Custos (EBITDA)',
      despesas_operacionais:    'Despesas Operacionais (EBITDA)',
      outras_receitas_despesas: 'Outras Receitas/Despesas (EBITDA)',
    };

    const sortedPeriodsForEbitda = [...allPeriods].sort();
    for (let i = 0; i < sortedPeriodsForEbitda.length; i++) {
      const period = sortedPeriodsForEbitda[i];
      const prev   = i > 0 ? sortedPeriodsForEbitda[i - 1] : null;
      const ea     = ebitdaAgg[period] || {};
      const eaPrev = prev ? (ebitdaAgg[prev] || {}) : {};

      // Soma total EBITDA gerencial
      const ebitdaGerencial = Object.values(ea).reduce((s, v) => s + (v ?? 0), 0);
      const ebitdaGerPrev   = prev ? Object.values(eaPrev).reduce((s, v) => s + (v ?? 0), 0) : null;

      // Receita bruta gerencial (para margem EBITDA gerencial)
      const rbGerencial = ea['receita_bruta'] ?? 0;
      const rbGerPrev   = prev ? (eaPrev['receita_bruta'] ?? 0) : null;

      const safe = (n, d) => (d === 0 || d == null) ? null : n / d;

      // Indicadores de componente EBITDA gerencial
      for (const [comp, label] of Object.entries(EBITDA_COMP_LABEL)) {
        const val  = ea[comp] ?? null;
        const valP = prev ? (eaPrev[comp] ?? null) : null;
        if (val == null && valP == null) continue;
        indicatorLines.push({
          financial_diagnosis_id: diagnosis_id,
          financial_upload_id:    upload_id,
          tenant_id:              diagnosis.tenant_id,
          entity_code:            entityCode,
          entity_level:           diagnosis.scope_level,
          period,
          indicator_code:         `ebitda_comp_${comp}`,
          indicator_name:         label,
          indicator_family:       'ebitda_gerencial',
          value:                  val,
          previous_value:         valP,
          signal:                 'neutral',
          severity:               'ok',
          confidence_level:       'high',
        });
      }

      // Total EBITDA gerencial
      indicatorLines.push({
        financial_diagnosis_id: diagnosis_id,
        financial_upload_id:    upload_id,
        tenant_id:              diagnosis.tenant_id,
        entity_code:            entityCode,
        entity_level:           diagnosis.scope_level,
        period,
        indicator_code:         'ebitda_gerencial_r',
        indicator_name:         'EBITDA Gerencial',
        indicator_family:       'ebitda_gerencial',
        value:                  ebitdaGerencial || 0,
        previous_value:         ebitdaGerPrev,
        signal:                 ebitdaGerencial > 0 ? 'positive' : ebitdaGerencial < 0 ? 'negative' : 'neutral',
        severity:               'ok',
        confidence_level:       'high',
      });

      // Margem EBITDA gerencial
      indicatorLines.push({
        financial_diagnosis_id: diagnosis_id,
        financial_upload_id:    upload_id,
        tenant_id:              diagnosis.tenant_id,
        entity_code:            entityCode,
        entity_level:           diagnosis.scope_level,
        period,
        indicator_code:         'margem_ebitda_gerencial',
        indicator_name:         'Margem EBITDA Gerencial',
        indicator_family:       'ebitda_gerencial',
        value:                  rbGerencial !== 0 ? safe(ebitdaGerencial, rbGerencial) : null,
        previous_value:         (prev && rbGerPrev !== 0) ? safe(ebitdaGerPrev, rbGerPrev) : null,
        signal:                 'neutral',
        severity:               'ok',
        confidence_level:       rbGerencial !== 0 ? 'high' : 'low',
      });

      console.log(`[buildFinancialStatements V2] EBITDA gerencial ${period}: total=${ebitdaGerencial.toFixed(0)} componentes=${JSON.stringify(ea)}`);
    }

    // 9c. DFC indireta V3 — rubrica-based, gerada em nível de financial_diagnosis_id.
    // bpValuesByPeriod[period][canonical_key] = saldo BP; bpMetaByCanonicalKey = {rubric_label, group_label, statement_code}.
    // Diagnósticos com múltiplos uploads (um por ano) precisam combinar o BP de OUTROS uploads já
    // processados do mesmo diagnóstico para comparar, ex., BP 2024 (outro upload) x BP 2025 (este upload).
    const bpValuesByPeriod = {};
    const bpMetaByCanonicalKey = {};
    const netIncomeByPeriod = {};
    for (const period of allPeriods) {
      bpValuesByPeriod[period] = {};
      for (const [canonical_key, meta] of Object.entries(rubricMeta)) {
        if (meta.statement_code !== 'BP') continue;
        bpValuesByPeriod[period][canonical_key] = aggregated[period]?.[canonical_key] ?? 0;
        if (!bpMetaByCanonicalKey[canonical_key]) bpMetaByCanonicalKey[canonical_key] = meta;
      }
      netIncomeByPeriod[period] = aggregated[period]?.['resultado_liquido'] ?? 0;
    }
    // non_cash_adjustment vem exclusivamente de dfc_classification em contas de DRE deste upload
    const nonCashAdjustmentByPeriod = {};
    const nonCashAdjustmentDetailByPeriod = {};
    for (const period of allPeriods) {
      const nca = dfcBalancesByPeriod[period]?.['non_cash_adjustment'];
      nonCashAdjustmentByPeriod[period] = nca?.value ?? 0;
      nonCashAdjustmentDetailByPeriod[period] = nca ?? { value: 0, accounts: [] };
    }

    let crossUploadPeriods = [...allPeriods];
    // Mapa período → upload_id (para stampar a DFC com o upload dono do período corrente)
    const periodToUpload = {};
    for (const p of allPeriods) periodToUpload[p] = upload_id;

    if (diagnosis.account_plan_id) {
      try {
        const otherBpLines = await base44.asServiceRole.entities.FinancialStatementLine.filter(
          { financial_diagnosis_id: diagnosis_id, statement_code: 'BP' }, 'id', 20000
        );
        for (const sl of otherBpLines) {
          if (sl.financial_upload_id === upload_id) continue; // já representado em memória
          if (!crossUploadPeriods.includes(sl.period)) crossUploadPeriods.push(sl.period);
          if (!bpValuesByPeriod[sl.period]) bpValuesByPeriod[sl.period] = {};
          bpValuesByPeriod[sl.period][sl.canonical_key] = sl.value;
          if (!bpMetaByCanonicalKey[sl.canonical_key]) {
            bpMetaByCanonicalKey[sl.canonical_key] = { canonical_key: sl.canonical_key, rubric_label: sl.rubric_label, group_label: sl.group_label, statement_code: sl.statement_code };
          }
          // Popula colMetaMap cross-upload — essencial para a DFC ter column_key do período corrente
          // quando o período corrente pertence a outro upload (ex: reprocessa 2024, DFC gera para 2025).
          if (!colMetaMap[sl.period] && sl.column_key) {
            colMetaMap[sl.period] = { column_key: sl.column_key, column_label: sl.column_label, period_type: sl.period_type };
          }
          if (sl.financial_upload_id) periodToUpload[sl.period] = sl.financial_upload_id;
        }
        const otherResultLines = await base44.asServiceRole.entities.FinancialStatementLine.filter(
          { financial_diagnosis_id: diagnosis_id, canonical_key: 'resultado_liquido' }, 'id', 500
        );
        for (const sl of otherResultLines) {
          if (sl.financial_upload_id === upload_id) continue;
          netIncomeByPeriod[sl.period] = sl.value;
        }
        console.log(`[buildFinancialStatements V2] DFC cross-upload: ${crossUploadPeriods.length} período(s) combinados (${crossUploadPeriods.join(', ')})`);
      } catch (e) {
        console.warn('[buildFinancialStatements V2] Falha ao montar DFC cross-upload, usando apenas período(s) deste upload:', e.message);
      }
    }

    // Determina o upload_id dono do período corrente da DFC (último período ordenado).
    // A DFC pertence ao upload do período mais recente — não ao upload que disparou o reprocessamento.
    const _dfcSortedPeriods = [...crossUploadPeriods].filter(p => p && p !== 'SEM_DATA').sort();
    const _dfcCurrentPeriod = _dfcSortedPeriods[_dfcSortedPeriods.length - 1] || null;
    const dfcUploadId = (_dfcCurrentPeriod && periodToUpload[_dfcCurrentPeriod]) || upload_id;

    // ── Carregar overrides manuais ativos (FinancialDfcClassificationOverride) ──
    // Override é por financial_diagnosis_id + rubric_key (canonical_key para BP).
    // Hierarquia: override manual → dfc_classification (ajustes) → canonical_map → inferência textual.
    let dfcOverrideMap = new Map();
    try {
      const overrides = await base44.asServiceRole.entities.FinancialDfcClassificationOverride.filter(
        { financial_diagnosis_id: diagnosis_id, tenant_id: diagnosis.tenant_id, status: 'active' }, 'id', 500
      );
      for (const ov of overrides || []) {
        if (ov.rubric_key && ov.manual_bucket) {
          dfcOverrideMap.set(ov.rubric_key, ov);
        }
      }
      if (dfcOverrideMap.size > 0) {
        console.log(`[buildFinancialStatements V2] DFC overrides ativos: ${dfcOverrideMap.size} rubrica(s) reclassificada(s)`);
      }
    } catch (e) {
      console.warn('[buildFinancialStatements V2] Falha ao carregar overrides DFC:', e.message);
    }

    const dfcResult = buildIndirectCashFlow({
      periods: crossUploadPeriods,
      bpValuesByPeriod,
      bpMetaByCanonicalKey,
      netIncomeByPeriod,
      nonCashAdjustmentByPeriod,
      nonCashAdjustmentDetailByPeriod,
      financialDiagnosisId: diagnosis_id,
      financialUploadId:    dfcUploadId,
      tenantId:             diagnosis.tenant_id,
      entityCode,
      colMetaMap,
      overrideMap: dfcOverrideMap,
      manualAdjustmentByPeriod,
    });
    statementLines.push(...dfcResult.lines);
    const dfcCompositionLines = dfcResult.compositionLines || [];
    [...dfcResult.lines, ...dfcCompositionLines].forEach(x => { x.dataset_scope = datasetScope; x.reporting_entity_id = reportingEntityId; if (preparationRunId) x.preparation_run_id = preparationRunId; });
    const validationResults = [...(dfcResult.validations || []), ...(calcResult.validations || []), ...bpBalanceValidations].map(v => ({
      financial_upload_id:    upload_id,
      financial_diagnosis_id: diagnosis_id,
      tenant_id:              diagnosis.tenant_id,
      ...v,
    }));
    console.log(`[buildFinancialStatements V2] DFC indireta: ${dfcResult.lines.length} linhas | Kanitz validações: ${(calcResult.validations || []).length}`);

    // R3: outputs ativos anteriores permanecem intocados; os novos são persistidos como candidatos.

    // 9b. Enriquecer linhas com série (dataset_scope ponta a ponta) + metadados de coluna
    for (const sl of statementLines) {
      sl.dataset_scope = datasetScope; sl.reporting_entity_id = reportingEntityId;
      if (preparationRunId) sl.preparation_run_id = preparationRunId;
      const cMeta = colMetaMap[sl.period];
      if (cMeta) {
        sl.column_key   = cMeta.column_key;
        sl.column_label = cMeta.column_label;
        sl.period_type  = cMeta.period_type;
      }
    }

    // 10. Persistir — entidades independentes em paralelo, batchSize 250 (Fase 2)
    timer.start('persist');
    const batchInsert = async (entity, items, name) => {
      if (items.length === 0) return;
      const t0 = performance.now();
      const batchSize = 250;
      for (let i = 0; i < items.length; i += batchSize) {
        await entity.bulkCreate(items.slice(i, i + batchSize));
      }
      console.log(`[buildFinancialStatements V2] ${name}: ${items.length} registros em ${Math.round(performance.now()-t0)}ms`);
    };

    // Deduplicação defensiva — impede que o mesmo upload/período/indicator_code
    // seja gravado duas vezes (trava de segurança contra regressão futura).
    const seenIndicators = new Set();
    const dedupedIndicatorLines = [];
    for (const indicator of indicatorLines) {
      const code = indicator.indicator_code;
      const key = [indicator.financial_diagnosis_id, indicator.financial_upload_id || indicator.preparation_run_id || upload_id, indicator.dataset_scope || datasetScope, indicator.entity_code, indicator.reporting_entity_id || reportingEntityId, indicator.period, code, indicator.formula_version || 'FAL-FIN-3.0.0'].join('|');
      if (seenIndicators.has(key)) {
        console.warn('[buildFinancialStatements V2] duplicate indicator skipped', key);
        continue;
      }
      seenIndicators.add(key);
      dedupedIndicatorLines.push(indicator);
    }

    // Indicadores: sanitizar strict
    const cleanInd = dedupedIndicatorLines.map(i => {
      const cleaned = {
        financial_diagnosis_id: i.financial_diagnosis_id,
        financial_upload_id:    i.financial_upload_id,
        tenant_id:              i.tenant_id,
        entity_code:            i.entity_code,
        entity_level:           i.entity_level,
        period:                 i.period,
        indicator_code:         i.indicator_code,
        value:                  sanitizeNumber(i.value, null),
        formula_version:        i.formula_version || 'FAL-FIN-3.0.0',
        validation_code:        i.validation_code || i.warning || null,
        dataset_scope:          datasetScope,
        reporting_entity_id:    reportingEntityId,
        ...(preparationRunId ? { preparation_run_id: preparationRunId } : {}),
      };
      if (i.indicator_name)    cleaned.indicator_name    = i.indicator_name;
      if (i.indicator_family)  cleaned.indicator_family  = i.indicator_family;
      if (i.previous_value != null) cleaned.previous_value  = sanitizeNumber(i.previous_value, null);
      if (i.variation_value != null) cleaned.variation_value = sanitizeNumber(i.variation_value, null);
      if (i.variation_percent != null) cleaned.variation_percent = sanitizeNumber(i.variation_percent, null);
      if (i.signal)            cleaned.signal            = i.signal;
      if (i.severity)          cleaned.severity          = i.severity;
      if (i.confidence_level)  cleaned.confidence_level  = i.confidence_level;
      const cMeta = colMetaMap[i.period];
      if (cMeta) {
        cleaned.column_key   = cMeta.column_key;
        cleaned.column_label = cMeta.column_label;
        cleaned.period_type  = cMeta.period_type;
      }
      return cleaned;
    });

    stampCandidates(statementLines, mappingResolutions, cleanInd, validationResults, trialLines, dfcCompositionLines);
    await Promise.all([
      batchInsert(base44.asServiceRole.entities.FinancialStatementLine,    statementLines,    'StatementLine'),
      batchInsert(base44.asServiceRole.entities.FinancialMappingResolution, mappingResolutions, 'Mappings'),
      batchInsert(base44.asServiceRole.entities.FinancialIndicatorSnapshot, cleanInd,          'Indicators'),
      batchInsert(base44.asServiceRole.entities.FinancialValidationResult, validationResults,  'DfcValidations'),
      batchInsert(base44.asServiceRole.entities.FinancialTrialBalanceLine, trialLines,         'TrialBalanceLines'),
      batchInsert(base44.asServiceRole.entities.FinancialDfcCompositionLine, dfcCompositionLines, 'DfcCompositionLines'),
    ]);
    timer.end('persist');

    // 11. Finalizar
    const sortedPeriods = allPeriods.sort();
    // Salva metadados no processing_log do upload para uso no frontend
    // period_label_map: mapa YYYY-MM → label visual para exibição nos demonstrativos
    const periodLabelMap = {};
    if (columnLabel && sortedPeriods.length > 0) {
      for (const p of sortedPeriods) {
        periodLabelMap[p] = columnLabel;
      }
    }
    // column_key_map: mapa column_key → { period, column_label, period_type } para o frontend
    const columnKeyMap = {};
    for (const [period, cMeta] of Object.entries(colMetaMap)) {
      columnKeyMap[cMeta.column_key] = { period, column_label: cMeta.column_label, period_type: cMeta.period_type };
    }

    const processingMeta = JSON.stringify({
      column_label:     columnLabel,
      pl_account_code:  plAccountCode,
      pl_canonical_key: plCanonicalKey,
      periods:          sortedPeriods,
      period_label_map: periodLabelMap,
      column_key_map:   columnKeyMap,
    });
    // Upload e diagnóstico só serão publicados depois da confirmação do snapshot candidato.

    // ── F2-UPL-01: Completar run ──
    if (buildRunId) {
      try {
        await base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId, {
          status: 'committing',
          result_summary: {
            success: false,
            snapshot_pending: true,
            upload_ids: [upload_id],
            status: 'processed',
            periods: sortedPeriods.length,
            dre_valid: dreValid,
            bp_balance: bpBalance,
            registry_version: registryVersion,
          },
        });
      } catch (e) { console.error('[buildFinancialStatements] erro ao completar run:', e.message); }
    }

    const sourceHeadPlan = [];
    if (usesSourceHead) {
      for (const period of sortedPeriods) {
        const sourceKey = [diagnosis_id, upload.source_entity_id, period].join('|');
        const heads = await base44.asServiceRole.entities.FinancialSourceOutputHead.filter({ financial_diagnosis_id: diagnosis_id, source_key: sourceKey }, 'updated_at', 2);
        if (heads.length > 1) throw new Error('SOURCE_OUTPUT_HEAD_AMBIGUOUS');
        sourceHeadPlan.push({ period, source_key: sourceKey, previous: heads[0] || null });
      }
    }
    const committingSummary = { success: false, snapshot_pending: true, upload_ids: [upload_id], source_heads: sourceHeadPlan.map((item) => ({ source_entity_id: upload.source_entity_id, source_period: item.period, source_key: item.source_key, financial_upload_id: upload_id, previous_processing_run_id: item.previous?.current_processing_run_id || null, previous_snapshot_id: item.previous?.current_processing_snapshot_id || null })), expected_output_counts: { statement_lines: statementLines.length, indicator_snapshots: cleanInd.length, validation_results: validationResults.length, mapping_resolutions: mappingResolutions.length, trial_balance_lines: trialLines.length, dfc_composition_lines: dfcCompositionLines.length } };
    await base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId, { status: 'committing', result_summary: committingSummary });
    const previousSourceSnapshotIds = [...new Set(sourceHeadPlan.map((item) => item.previous?.current_processing_snapshot_id).filter(Boolean))];
    if (usesSourceHead && previousSourceSnapshotIds.length > 1) throw new Error('SOURCE_HEAD_PREDECESSOR_AMBIGUOUS');
    const snapshotResponse = await base44.functions.invoke('createFinancialProcessingSnapshot', {
      financial_diagnosis_id: diagnosis_id,
      processing_run_id: buildRunId,
      previous_snapshot_id: usesSourceHead ? (previousSourceSnapshotIds[0] || null) : previousDiagnosisState.current_processing_snapshot_id,
      commit_scope: usesSourceHead ? 'source_head' : 'diagnosis',
      publish_pointer: false,
    });
    const snapshot = snapshotResponse?.data || snapshotResponse;
    if (!snapshot?.snapshot_id) throw new Error('Build sem snapshot obrigatório');
    candidateSnapshotId = snapshot.snapshot_id;
    const persistedSnapshot = await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(snapshot.snapshot_id);
    if (!persistedSnapshot || persistedSnapshot.financial_processing_run_id !== buildRunId || persistedSnapshot.status !== 'candidate' || !persistedSnapshot.output_checksum) throw new Error('SNAPSHOT_POSTCONDITION_FAILED');
    const publishedAt = await publishCandidates();
    await base44.asServiceRole.entities.FinancialProcessingSnapshot.update(snapshot.snapshot_id, { status:'active' });
    if (usesSourceHead) {
      for (const plan of sourceHeadPlan) {
        const headData = { tenant_id: diagnosis.tenant_id, financial_diagnosis_id: diagnosis_id, source_entity_id: upload.source_entity_id, source_period: plan.period, source_key: plan.source_key, financial_upload_id: upload_id, current_processing_run_id: buildRunId, current_processing_snapshot_id: snapshot.snapshot_id, current_input_checksum: upload.input_checksum || null, current_output_checksum: snapshot.output_checksum, mapping_checksum: persistedSnapshot.mapping_checksum, registry_hash: persistedSnapshot.registry_hash, formula_version: persistedSnapshot.formula_version, status: 'active', updated_at: publishedAt, updated_by: user.email };
        const head = plan.previous ? await base44.asServiceRole.entities.FinancialSourceOutputHead.update(plan.previous.id, headData) : await base44.asServiceRole.entities.FinancialSourceOutputHead.create(headData);
        committedSourceHeads.push({ plan, head_id: head.id, created: !plan.previous });
      }
      for (const item of committedSourceHeads) {
        const confirmed = await base44.asServiceRole.entities.FinancialSourceOutputHead.get(item.head_id);
        if (!confirmed || confirmed.current_processing_run_id !== buildRunId || confirmed.current_processing_snapshot_id !== snapshot.snapshot_id || confirmed.current_output_checksum !== snapshot.output_checksum) throw new Error('SOURCE_OUTPUT_HEAD_POSTCONDITION_FAILED');
      }
    }
    await Promise.all([
      base44.asServiceRole.entities.FinancialUpload.update(upload_id, { upload_status:'processed', processing_log:processingMeta }),
      ...(usesDiagnosisPointer ? [base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosis_id, { status:'processed', current_upload_id:upload_id, first_period:sortedPeriods[0] || null, last_period:sortedPeriods.slice(-1)[0] || null, months_count:allPeriods.length, current_processing_snapshot_id:snapshot.snapshot_id })] : [base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosis_id, { status:'processed', current_upload_id:upload_id })]),
    ]);
    const cleanupTargets = committedSourceHeads
      .filter((item) => item.plan.previous?.current_processing_run_id && item.plan.previous.current_processing_run_id !== buildRunId)
      .map((item) => ({ previous_processing_run_id: item.plan.previous.current_processing_run_id, source_key: item.plan.source_key, source_entity_id: upload.source_entity_id, source_period: item.plan.period, financial_upload_id: upload_id, dataset_scope: 'individual' }));
    await base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId, {
      status: 'succeeded', completed_at: new Date().toISOString(), output_checksum: snapshot.output_checksum,
      result_summary: { ...committingSummary, success: true, snapshot_pending: false, snapshot_id: snapshot.snapshot_id, output_checksum: snapshot.output_checksum, upload_ids: [upload_id], status: 'processed', periods: sortedPeriods.length, dre_valid: dreValid, bp_balance: bpBalance, registry_version: registryVersion, cleanup_targets: cleanupTargets },
    });
    let cleanupPending = false;
    let deferredRunIds = [];
    let cleanupError = null;
    try {
      if (cleanupTargets.length) {
        const cleanupResponse = await base44.functions.invoke('retryFinancialOutputCleanup', { processing_run_id: buildRunId, cleanup_targets: cleanupTargets });
        const cleanupResult = cleanupResponse?.data || cleanupResponse;
        const cleanupDecision = await invokeFinancialLifecycleDeterminismEngine(base44, 'evaluate_cleanup_state', { previous_run_id: cleanupTargets[0]?.previous_processing_run_id || null, active_source_head_references: [], diagnosis_pointer_reference: null, cleanup_attempt_result: cleanupResult || {} });
        cleanupPending = cleanupDecision.cleanup_pending;
        deferredRunIds = cleanupResult?.deferred_run_ids || [];
        cleanupError = cleanupResult?.error || cleanupResult?.reason || null;
      }
    } catch (error) {
      cleanupPending = true;
      cleanupError = error.message;
    }
    if (cleanupPending) await base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId, { cleanup_pending: true, error_details: { cleanup_error: cleanupError || 'CLEANUP_PENDING' }, result_summary: { ...committingSummary, success: true, snapshot_pending: false, snapshot_id: snapshot.snapshot_id, output_checksum: snapshot.output_checksum, cleanup_targets: cleanupTargets, deferred_run_ids: deferredRunIds } });

    return Response.json({
      success: true,
      run_id: buildRunId,
      operation_key: buildOpKey,
      input_checksum: buildInputFingerprint,
      snapshot_id: snapshot.snapshot_id,
      output_checksum: snapshot.output_checksum,
      status: 'processed',
      periods: sortedPeriods,
      dre_valid: dreValid,
      bp_balance: bpBalance,
      registry_version: registryVersion,
      cleanup_pending: cleanupPending,
      deferred_run_ids: deferredRunIds,
    });

  } catch (err) {
    timer.start('error');
    console.error('[buildFinancialStatements V2] ERROR:', err.message, err.stack);
    console.error('[PHASE0_ERROR_METRICS]', JSON.stringify({
      diagnosis_id,
      upload_id,
      error: err.message,
      stage_timings_ms: timer.getMetrics(),
      timestamp: new Date().toISOString(),
    }));
    timer.end('error');
    const errorLog = `${err.message}\n${err.stack}`;
    try {
      for (const committed of committedSourceHeads.reverse()) {
        if (committed.created) await base44.asServiceRole.entities.FinancialSourceOutputHead.delete(committed.head_id);
        else await base44.asServiceRole.entities.FinancialSourceOutputHead.update(committed.head_id, committed.plan.previous);
      }
      await invalidateCandidates();
      if (candidateSnapshotId) await base44.asServiceRole.entities.FinancialProcessingSnapshot.update(candidateSnapshotId, { status:'invalid', invalid_reason:err.message, invalidated_at:new Date().toISOString(), invalidated_by_run_id:buildRunId });
      await Promise.all([
        base44.asServiceRole.entities.FinancialUpload.update(upload_id, { upload_status: 'error', processing_log: errorLog }),
        base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosis_id, previousDiagnosisState),
      ]);
    } catch (updateErr) {
      console.error('[buildFinancialStatements V2] Erro ao atualizar status:', updateErr.message);
    }
    // ── F2-UPL-01: Marcar run como failed ──
    if (buildRunId) {
      try {
        await base44.asServiceRole.entities.FinancialProcessingRun.update(buildRunId, {
          status: candidateSnapshotId ? 'partial_failed' : 'failed',
          completed_at: new Date().toISOString(),
          error_details: { error: err.message },
          result_summary: { success: false, error: err.message },
        });
      } catch (e) { console.error('[buildFinancialStatements] erro ao falhar run:', e.message); }
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
});