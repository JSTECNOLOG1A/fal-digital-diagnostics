/**
 * financialIndicatorUtils.js
 * Camada utilitária para normalização, deduplicação e formatação de snapshots
 * de FinancialIndicatorSnapshot.
 *
 * NÃO altera cálculo — apenas consome e organiza os snapshots já existentes.
 */

import {
  financialIndicatorRegistry,
  INDICATOR_GROUP_ORDER,
} from "./financialIndicatorRegistry";

// ── Helpers internos ──────────────────────────────────────────────────────

const isNil = (v) =>
  v === null ||
  v === undefined ||
  (typeof v === "number" && isNaN(v)) ||
  v === "";

// Column key bruto (sem série) — usado para ordenação e formatação
export function getSnapshotColumnKey(snapshot) {
  return snapshot?.column_key || snapshot?.period || snapshot?.reference_date || "";
}

// Rótulo da série para multi-entidade
export function getSnapshotSeriesLabel(snapshot) {
  const ds = snapshot?.dataset_scope || "individual";
  if (ds === "parent") return "Controladora";
  if (ds === "consolidated") return "Consolidado";
  if (ds === "combined") return "Combinado";
  return "";
}

// Chave de série series-aware: distingue parent|consolidated no mesmo período
export function getSnapshotPeriodKey(snapshot) {
  const col = getSnapshotColumnKey(snapshot);
  const ds = snapshot?.dataset_scope || "individual";
  const re = snapshot?.reporting_entity_id || "";
  return `${ds}|${re}|${col}`;
}

export function getSnapshotPeriodLabel(snapshot) {
  const base = snapshot?.column_label || fmtColLabel(getSnapshotColumnKey(snapshot));
  const sl = getSnapshotSeriesLabel(snapshot);
  return sl ? `${sl} ${base}` : base;
}

// Formata column_key em label legível
export function fmtColLabel(ck) {
  if (!ck) return "—";
  const a = ck.match(/^A-(\d{4})$/);
  if (a) return a[1];
  const m = ck.match(/^M-(\d{4})-(\d{2})$/);
  if (m) return `${m[2]}/${m[1]}`;
  const q = ck.match(/^Q-(\d{4})-(\d{2})$/);
  if (q) {
    const n = Math.ceil(parseInt(q[2], 10) / 3);
    return `${n}ºT/${q[1]}`;
  }
  const p = ck.match(/^(\d{4})-(\d{2})$/);
  return p ? `${p[2]}/${p[1]}` : ck;
}

// ── Formatação ───────────────────────────────────────────────────────────

/**
 * Formata um valor conforme o metadado do indicador.
 * percent: o backend armazena como decimal (0,32 = 32%) — multiplica por 100.
 */
export function formatIndicatorValue(value, indicator = {}) {
  if (isNil(value)) return "—";
  const n = Number(value);
  if (isNaN(n)) return "—";

  const decimals = indicator.decimals ?? 2;
  const fmtNum = (d) =>
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });

  switch (indicator.format) {
    case "percent":
      return `${(n * 100).toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}%`;
    case "currency":
      return `R$ ${fmtNum(decimals)}`;
    case "multiple":
      return `${fmtNum(decimals)}x`;
    case "days":
      return `${fmtNum(0)} dias`;
    case "number":
    default:
      return fmtNum(decimals);
  }
}

// ── Agrupamento do registry ──────────────────────────────────────────────

export function getGroupedIndicators(registry = financialIndicatorRegistry) {
  const map = {};
  for (const ind of registry) {
    if (ind.hiddenFromMainIndicators) continue;
    if (!map[ind.group]) map[ind.group] = [];
    map[ind.group].push(ind);
  }
  for (const g of Object.keys(map)) {
    map[g].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }
  return INDICATOR_GROUP_ORDER.filter((g) => map[g] && map[g].length > 0).map(
    (g) => ({ group: g, groupLabel: map[g][0].groupLabel, indicators: map[g] })
  );
}

// ── Normalização de snapshots ────────────────────────────────────────────

/**
 * Filtra, deduplica e ordena snapshots por indicador.
 * Retorna Map<indicator_code, snapshot[]> ordenado por período desc.
 */
export function normalizeSnapshotsByIndicator(
  snapshots = [],
  registry = financialIndicatorRegistry,
  options = {}
) {
  const allowedCodes = new Set(
    registry
      .filter((item) => !item.hiddenFromMainIndicators)
      .map((item) => item.key)
  );

  const { financialDiagnosisId, entityCode, periodMode } = options;

  const filtered = (snapshots || []).filter((snap) => {
    if (!snap || !snap.indicator_code) return false;
    if (!allowedCodes.has(snap.indicator_code)) return false;
    if (
      financialDiagnosisId &&
      snap.financial_diagnosis_id &&
      snap.financial_diagnosis_id !== financialDiagnosisId
    )
      return false;
    if (entityCode && snap.entity_code && snap.entity_code !== entityCode)
      return false;
    if (periodMode && snap.period_type && snap.period_type !== periodMode)
      return false;
    return true;
  });

  const byIndicator = new Map();
  for (const snap of filtered) {
    const code = snap.indicator_code;
    if (!byIndicator.has(code)) byIndicator.set(code, []);
    byIndicator.get(code).push(snap);
  }

  const deduped = new Map();
  for (const [code, list] of byIndicator.entries()) {
    const sorted = [...list].sort((a, b) => {
      const ka = getSnapshotPeriodKey(a) || "";
      const kb = getSnapshotPeriodKey(b) || "";
      const cmp = kb.localeCompare(ka);
      if (cmp !== 0) return cmp;
      const ua = a.updated_date || a.created_date || "";
      const ub = b.updated_date || b.created_date || "";
      return ub.localeCompare(ua);
    });

    const seen = new Set();
    const distinct = [];
    for (const s of sorted) {
      const k = getSnapshotPeriodKey(s) || s.id;
      if (seen.has(k)) continue;
      seen.add(k);
      distinct.push(s);
    }
    deduped.set(code, distinct);
  }

  return deduped;
}

/**
 * Extrai a lista de períodos distintos presentes nos snapshots normalizados,
 * ordenados por período desc.
 */
export function getHistoricalPeriods(snapshotsByIndicator) {
  const periodMap = new Map();
  snapshotsByIndicator.forEach((snapshots) => {
    (snapshots || []).forEach((snap) => {
      const key = getSnapshotPeriodKey(snap);
      if (!key) return;
      if (!periodMap.has(key)) {
        periodMap.set(key, {
          key,
          label: getSnapshotPeriodLabel(snap),
        });
      }
    });
  });
  return Array.from(periodMap.values()).sort((a, b) =>
    String(b.key).localeCompare(String(a.key))
  );
}

/**
 * Retorna os period_type disponíveis nos snapshots.
 */
export function getAvailablePeriodModes(snapshots = []) {
  const modes = new Set();
  (snapshots || []).forEach((snap) => {
    if (snap?.period_type) modes.add(snap.period_type);
  });
  return modes;
}

/**
 * Divide um array em chunks de tamanho fixo.
 */
export function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ── Avaliação por benchmark de mercado ────────────────────────────────────

const BENCHMARK_TIERS = {
  saudavel: { label: "Saudável", severity: "ok", bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
  medio: { label: "Médio", severity: "atencao", bg: "#fef3c7", text: "#B45309", border: "#FCD34D" },
  atencao: { label: "Atenção", severity: "critico", bg: "#feecec", text: "#B42318", border: "#FDA29B" },
};

/**
 * Avalia o valor do indicador contra as faixas de benchmark de mercado.
 * Retorna { label, severity, bg, text, border } ou null se não houver benchmark.
 *
 * @param {number|null|undefined} value
 * @param {Object} indicator - entrada do registry (com .benchmark)
 */
export function evaluateBenchmark(value, indicator = {}) {
  const bm = indicator?.benchmark;
  if (!bm || value == null) return null;
  const n = Number(value);
  if (isNaN(n)) return null;

  // Tipo "sinal": positivo = saudável, neutro = médio, negativo = atenção
  if (bm.tipo === "sinal") {
    if (n > 0) return BENCHMARK_TIERS.saudavel;
    if (n < 0) return BENCHMARK_TIERS.atencao;
    return BENCHMARK_TIERS.medio;
  }

  const { orientacao, saudavel, atencao } = bm;
  if (saudavel == null || atencao == null) return null;

  if (orientacao === "crescente") {
    // valor alto é bom
    if (n >= saudavel) return BENCHMARK_TIERS.saudavel;
    if (n >= atencao) return BENCHMARK_TIERS.medio;
    return BENCHMARK_TIERS.atencao;
  }

  // decrescente: valor baixo é bom
  if (n <= saudavel) return BENCHMARK_TIERS.saudavel;
  if (n <= atencao) return BENCHMARK_TIERS.medio;
  return BENCHMARK_TIERS.atencao;
}