/**
 * Mapeia itens retornados do Protheus (CtbRestSaldos / CT1) para FinancialAccountPlanLine.
 *
 * Protheus CT1_CLASSE: 1 = Sintética, 2 = Analítica
 * Protheus CT1_BLOQ: 1 = Bloqueada, 2 = Ativa
 *
 * Hierarquia/ordem: regra canônica em @/lib/accountPlanHierarchy (qualquer sistema).
 */

export {
  compareAccountHierarchy,
  extractParentAccountCode,
  sortAccountPlanTree,
  inferAccountLevel,
  buildAccountLevelMap,
  sortPlanLinesLikeChartOfAccounts,
  withCanonicalChartOrder,
  normalizeAccountCode,
} from '@/lib/accountPlanHierarchy';

import {
  extractParentAccountCode,
  sortAccountPlanTree,
  withCanonicalChartOrder,
} from '@/lib/accountPlanHierarchy';

/**
 * Conta ativa no Protheus? (ignora bloqueadas / deletadas)
 * CT1_BLOQ: 1 = bloqueada, 2 = ativa
 * @param {Record<string, any>} row
 */
export function isProtheusAccountActive(row) {
  const raw = row?.raw && typeof row.raw === 'object' ? row.raw : row || {};
  if (row?.isActive === false || row?.blocked === true) return false;

  const bloq = String(
    row.blockedFlag ??
      row.CT1_BLOQ ??
      row.bloq ??
      row.ct1_bloq ??
      raw.CT1_BLOQ ??
      raw.ct1_bloq ??
      raw.BLOQ ??
      raw.bloq ??
      '',
  )
    .trim()
    .toUpperCase();
  const deleted = String(
    raw.D_E_L_E_T_ ?? raw.DELETED ?? row.deleted ?? '',
  ).trim();

  if (deleted === '*' || deleted === '1' || deleted === 'T') return false;
  if (
    bloq === '1' ||
    bloq === 'S' ||
    bloq === 'SIM' ||
    bloq === 'BLOQUEADA' ||
    bloq === 'BLOQ' ||
    bloq === 'TRUE'
  ) {
    return false;
  }
  // Com flag explícita: só aceita ativa (2)
  if (bloq === '2' || bloq === 'A' || bloq === 'ATIVA' || bloq === 'ACTIVE' || bloq === 'N') {
    return true;
  }
  // Sem CT1_BLOQ: se a API já disse isActive, respeita; senão mantém (legado)
  if (row?.isActive === true) return true;
  return true;
}

/**
 * @param {Record<string, any>} row
 */
export function mapProtheusAccountRow(row) {
  const raw = row?.raw && typeof row.raw === 'object' ? row.raw : row || {};

  const codeDisplay = String(
    row.code ||
      raw.CT1_CONTA ||
      raw.ct1_conta ||
      raw.CQ0_CONTA ||
      raw.CQ1_CONTA ||
      raw.CONTA ||
      raw.conta ||
      raw.account ||
      raw.codigo ||
      raw.code ||
      row.externalId ||
      '',
  ).trim();

  const name = String(
    row.name ||
      raw.CT1_DESC01 ||
      raw.ct1_desc01 ||
      raw.DESCRICAO ||
      raw.descricao ||
      raw.NOME ||
      raw.nome ||
      raw.description ||
      raw.name ||
      codeDisplay ||
      'Sem descrição',
  ).trim();

  const classRaw = String(
    row.classType ??
      raw.CT1_CLASSE ??
      raw.ct1_classe ??
      raw.CLASSE ??
      raw.classe ??
      raw.class ??
      '',
  )
    .trim()
    .toUpperCase();

  /** @type {'analitica'|'sintetica'|null} */
  let accountType = null;
  let classCode = '';

  if (classRaw === '1' || classRaw === 'S' || classRaw.startsWith('SINT')) {
    accountType = 'sintetica';
    classCode = '1';
  } else if (classRaw === '2' || classRaw === 'A' || classRaw.startsWith('ANAL')) {
    accountType = 'analitica';
    classCode = '2';
  } else if (classRaw) {
    classCode = classRaw;
  }

  const code = codeDisplay.replace(/\./g, '');
  const parentCode = extractParentAccountCode(row);

  return {
    codeDisplay,
    code,
    name,
    accountType,
    classCode,
    parentCode: parentCode && parentCode !== code ? parentCode : '',
  };
}

/**
 * @param {Array<{ code: string, accountType: 'analitica'|'sintetica'|null, classCode: string }>} rows
 */
function inferSyntheticFromChildren(rows) {
  const codes = rows.map((r) => r.code).filter(Boolean);
  const codeSet = new Set(codes);

  for (const row of rows) {
    if (row.accountType) continue;
    const code = row.code;
    if (!code) continue;
    const hasChild = codes.some((other) => other !== code && other.startsWith(code));
    if (hasChild) {
      row.accountType = 'sintetica';
      row.classCode = row.classCode || '1';
    } else {
      row.accountType = 'analitica';
      row.classCode = row.classCode || '2';
    }
  }
}

/**
 * @param {Array<Record<string, any>>} items
 * @param {{ planId: string, tenantId: string }} opts
 */
export function buildAccountPlanLinesFromProtheus(items, { planId, tenantId }) {
  const seen = new Set();
  /** @type {Array<ReturnType<typeof mapProtheusAccountRow>>} */
  const mappedRows = [];

  for (const row of items || []) {
    if (!isProtheusAccountActive(row)) continue;
    const mapped = mapProtheusAccountRow(row);
    if (!mapped.code) continue;
    if (seen.has(mapped.code)) continue;
    seen.add(mapped.code);
    mappedRows.push(mapped);
  }

  inferSyntheticFromChildren(mappedRows);

  const ordered = sortAccountPlanTree(
    mappedRows.map((m) => ({ ...m, parentCode: m.parentCode || '' })),
  );

  const lines = ordered.map((mapped) => ({
    account_plan_id: planId,
    tenant_id: tenantId,
    account_code: mapped.code,
    account_code_display: mapped.codeDisplay || mapped.code,
    account_name: mapped.name,
    account_type: mapped.accountType || 'analitica',
    classification: mapped.classCode || '',
    parent_account_code: mapped.parentCode || '',
    statement_code: 'NAO_CLASSIFICADO',
    ebitda_component: '',
    dfc_classification: '',
    is_active: true,
    notes: mapped.parentCode
      ? `Importado do Protheus · pai:${mapped.parentCode}`
      : 'Importado do Protheus',
  }));

  return withCanonicalChartOrder(lines);
}
