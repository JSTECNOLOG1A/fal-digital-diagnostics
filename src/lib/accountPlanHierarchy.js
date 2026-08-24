/**
 * Hierarquia de Plano de Contas — regra única para qualquer origem
 * (Protheus, Excel, SAP, ContaAzul, Totvs, etc.).
 *
 * Ordem canônica:
 * 1. Pai antes dos filhos (árvore por parent_account_code, ou prefixo do código)
 * 2. Entre irmãos / sem pai: ordem lexicográfica do código
 *    Ex.: 1 → 101 → 10101 → 11 → 12 → 2 → 21
 *
 * Nível:
 * - Com pai informado: profundidade na árvore
 * - Sem pai: segmentos com ponto, ou prefixos existentes no plano
 */

/**
 * @param {string} a
 * @param {string} b
 */
export function compareAccountHierarchy(a, b) {
  const ca = String(a || '').trim();
  const cb = String(b || '').trim();
  if (ca === cb) return 0;

  if (ca.includes('.') || cb.includes('.')) {
    const as = ca.split('.');
    const bs = cb.split('.');
    const len = Math.max(as.length, bs.length);
    for (let i = 0; i < len; i++) {
      const ai = as[i];
      const bi = bs[i];
      if (ai == null) return -1;
      if (bi == null) return 1;
      if (ai === bi) continue;
      const an = Number(ai);
      const bn = Number(bi);
      if (
        !Number.isNaN(an) &&
        !Number.isNaN(bn) &&
        String(an) === ai &&
        String(bn) === bi
      ) {
        return an - bn;
      }
      return ai < bi ? -1 : 1;
    }
    return 0;
  }

  if (ca.length > 0 && cb.startsWith(ca) && ca.length < cb.length) return -1;
  if (cb.length > 0 && ca.startsWith(cb) && cb.length < ca.length) return 1;

  return ca < cb ? -1 : 1;
}

/**
 * Normaliza código (remove máscara de pontos).
 * @param {unknown} code
 */
export function normalizeAccountCode(code) {
  return String(code ?? '')
    .trim()
    .replace(/\./g, '');
}

/**
 * Extrai código do pai de payloads genéricos / ERP.
 * @param {Record<string, any>} row
 */
export function extractParentAccountCode(row) {
  const raw = row?.raw && typeof row.raw === 'object' ? row.raw : row || {};
  return normalizeAccountCode(
    row.parentCode ??
      row.parent_account_code ??
      row.conta_pai ??
      row.account_parent ??
      raw.CT1_CTASUP ??
      raw.ct1_ctasup ??
      raw.superior ??
      raw.SUPERIOR ??
      raw.CTA_SUP ??
      raw.parent ??
      raw.conta_pai ??
      '',
  );
}

/**
 * DFS da árvore (pai → filhos), filhos ordenados pelo código.
 * @param {Array<{ code: string, parentCode?: string }>} rows
 */
export function sortAccountPlanTree(rows) {
  const byCode = new Map();
  for (const row of rows) {
    if (!row?.code) continue;
    byCode.set(row.code, {
      ...row,
      parentCode: normalizeAccountCode(row.parentCode || ''),
    });
  }

  /** @type {Map<string, string[]>} */
  const children = new Map();
  const roots = [];

  for (const row of byCode.values()) {
    const parent = row.parentCode;
    if (parent && parent !== row.code && byCode.has(parent)) {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(row.code);
    } else {
      roots.push(row.code);
    }
  }

  const sortCodes = (arr) => arr.sort(compareAccountHierarchy);
  for (const [, kids] of children) sortCodes(kids);
  sortCodes(roots);

  const ordered = [];
  const visit = (code, level) => {
    const row = byCode.get(code);
    if (!row) return;
    ordered.push({ ...row, treeLevel: level });
    for (const child of children.get(code) || []) {
      visit(child, level + 1);
    }
  };
  for (const root of roots) visit(root, 1);

  if (ordered.length < byCode.size) {
    const seen = new Set(ordered.map((r) => r.code));
    const missing = [...byCode.keys()]
      .filter((c) => !seen.has(c))
      .sort(compareAccountHierarchy);
    for (const code of missing) {
      const row = byCode.get(code);
      ordered.push({ ...row, treeLevel: row.parentCode ? 2 : 1 });
    }
  }

  return ordered;
}

/**
 * @param {string} code
 * @param {Iterable<string>} allCodes
 * @param {Map<string, string>|Record<string, string>|null} parentByCode
 */
export function inferAccountLevel(code, allCodes = [], parentByCode = null) {
  const c = normalizeAccountCode(code);
  if (!c) return 1;

  if (parentByCode) {
    const getParent = (k) =>
      parentByCode instanceof Map ? parentByCode.get(k) : parentByCode[k];
    let depth = 1;
    let cur = getParent(c);
    const guard = new Set([c]);
    while (cur && !guard.has(cur)) {
      depth += 1;
      guard.add(cur);
      cur = getParent(cur);
      if (depth > 40) break;
    }
    if (depth > 1 || (getParent(c) != null && String(getParent(c)) !== '')) {
      return depth;
    }
  }

  const display = String(code || '').trim();
  if (display.includes('.')) {
    return Math.max(1, display.split('.').filter(Boolean).length);
  }

  let depth = 1;
  for (const raw of allCodes) {
    const other = normalizeAccountCode(raw);
    if (!other || other === c) continue;
    if (c.startsWith(other) && other.length < c.length) depth += 1;
  }
  return depth;
}

/**
 * @param {Array<string|Record<string, any>>} linesOrCodes
 * @returns {Map<string, number>}
 */
export function buildAccountLevelMap(linesOrCodes = []) {
  /** @type {Map<string, string>} */
  const parentByCode = new Map();
  const codes = [];

  for (const item of linesOrCodes) {
    if (typeof item === 'string') {
      const c = item.trim();
      if (c) codes.push(normalizeAccountCode(c) || c);
      continue;
    }
    const code = normalizeAccountCode(
      item?.account_code_display || item?.account_code || '',
    );
    if (!code) continue;
    codes.push(code);
    const parent = normalizeAccountCode(item?.parent_account_code || '');
    if (parent) parentByCode.set(code, parent);
  }

  const unique = [...new Set(codes)];
  const map = new Map();
  for (const code of unique) {
    map.set(
      code,
      inferAccountLevel(code, unique, parentByCode.size ? parentByCode : null),
    );
  }
  return map;
}

/**
 * Ordena linhas de qualquer plano de contas pela regra canônica.
 * @param {Array<Record<string, any>>} lines
 */
export function sortPlanLinesLikeChartOfAccounts(lines = []) {
  const enriched = lines.map((l) => {
    if (l.parent_account_code) return l;
    const m = String(l.notes || '').match(/pai:([^\s·]+)/i);
    return m
      ? { ...l, parent_account_code: normalizeAccountCode(m[1]) }
      : l;
  });

  const hasParents = enriched.some((l) => l.parent_account_code);
  if (hasParents) {
    const mapped = enriched.map((l) => ({
      ...l,
      code: normalizeAccountCode(l.account_code || l.account_code_display),
      parentCode: normalizeAccountCode(l.parent_account_code || ''),
    }));
    const ordered = sortAccountPlanTree(mapped);
    const byCode = new Map(ordered.map((r, i) => [r.code, i]));
    return [...enriched].sort((a, b) => {
      const ia =
        byCode.get(normalizeAccountCode(a.account_code)) ?? 999999;
      const ib =
        byCode.get(normalizeAccountCode(b.account_code)) ?? 999999;
      if (ia !== ib) return ia - ib;
      return compareAccountHierarchy(
        a.account_code_display || a.account_code,
        b.account_code_display || b.account_code,
      );
    });
  }

  return [...enriched].sort((a, b) => {
    const byCode = compareAccountHierarchy(
      a.account_code_display || a.account_code,
      b.account_code_display || b.account_code,
    );
    if (byCode !== 0) return byCode;
    return Number(a.display_order || 0) - Number(b.display_order || 0);
  });
}

/**
 * Aplica ordem e display_order canônicos antes de gravar (Excel / qualquer import).
 * @param {Array<Record<string, any>>} lines
 */
export function withCanonicalChartOrder(lines = []) {
  return sortPlanLinesLikeChartOfAccounts(lines).map((line, index) => ({
    ...line,
    display_order: index + 1,
  }));
}

/**
 * Mapa código → filhos diretos (para árvore expandir/recolher).
 * @param {Array<Record<string, any>>} lines
 * @returns {Map<string, string[]>}
 */
export function buildAccountChildrenMap(lines = []) {
  /** @type {Map<string, Record<string, any>>} */
  const byCode = new Map();
  for (const l of lines) {
    const code = normalizeAccountCode(l?.account_code || l?.account_code_display);
    if (!code) continue;
    byCode.set(code, l);
  }

  /** @type {Map<string, string>} */
  const parentOf = new Map();
  for (const [code, l] of byCode) {
    let parent = normalizeAccountCode(l?.parent_account_code || '');
    if (!parent || !byCode.has(parent) || parent === code) {
      parent = '';
      for (const other of byCode.keys()) {
        if (other === code) continue;
        if (code.startsWith(other) && other.length < code.length) {
          if (!parent || other.length > parent.length) parent = other;
        }
      }
    }
    if (parent && byCode.has(parent) && parent !== code) {
      parentOf.set(code, parent);
    }
  }

  /** @type {Map<string, string[]>} */
  const children = new Map();
  for (const [code, parent] of parentOf) {
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(code);
  }
  for (const [, kids] of children) {
    kids.sort(compareAccountHierarchy);
  }
  return children;
}

/**
 * Códigos de todas as contas que têm filhos (candidatas a expandido).
 * @param {Map<string, string[]>} childrenMap
 */
export function allExpandableAccountCodes(childrenMap) {
  return new Set([...childrenMap.keys()]);
}

/**
 * Filtra linhas ocultas por nós recolhidos.
 * @param {Array<Record<string, any>>} orderedLines
 * @param {Map<string, string[]>} childrenMap
 * @param {Set<string>} expandedCodes — códigos com filhos que estão expandidos
 */
export function filterCollapsedTreeLines(
  orderedLines = [],
  childrenMap,
  expandedCodes,
) {
  /** @type {Map<string, string>} */
  const parentOf = new Map();
  for (const [parent, kids] of childrenMap || []) {
    for (const kid of kids) parentOf.set(kid, parent);
  }

  const visible = [];
  for (const line of orderedLines) {
    const code = normalizeAccountCode(
      line?.account_code || line?.account_code_display,
    );
    if (!code) {
      visible.push(line);
      continue;
    }
    let ancestor = parentOf.get(code);
    let hidden = false;
    const guard = new Set();
    while (ancestor && !guard.has(ancestor)) {
      guard.add(ancestor);
      if (!expandedCodes?.has(ancestor)) {
        hidden = true;
        break;
      }
      ancestor = parentOf.get(ancestor);
    }
    if (!hidden) visible.push(line);
  }
  return visible;
}
