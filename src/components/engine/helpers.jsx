/**
 * helpers.js — Funções auxiliares do FAL Diagnostic Engine (frontend)
 * Funções puras, sem side-effects, sem dependências externas.
 */

/** Converte valor para número seguro. */
export function safeNum(v, fallback = 0) {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

/** Arredonda para 2 casas decimais. */
export function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Média ponderada de um array de { value, weight }.
 * Retorna 0 se o array for vazio ou sem peso.
 */
export function weightedAverage(items) {
  if (!items || items.length === 0) return 0;
  let sumVW = 0;
  let sumW  = 0;
  for (const { value, weight } of items) {
    const w = (typeof weight === 'number' && weight > 0) ? weight : 1;
    sumVW += safeNum(value, 0) * w;
    sumW  += w;
  }
  if (sumW === 0) return 0;
  const result = sumVW / sumW;
  return isFinite(result) ? round2(result) : 0;
}

/**
 * Agrupa array por keyFn. Retorna Map<key, item[]>.
 */
export function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/** Normaliza score (0–4) para percentual 0–100. */
export function scoreToPercent(score, maxScore = 4) {
  if (score === null || score === undefined || isNaN(score)) return 0;
  return Math.round((Math.max(0, Math.min(maxScore, score)) / maxScore) * 100);
}

/** Formata label legível de chave snake_case. */
export function formatKey(key) {
  if (!key) return '';
  return key
    .replace(/_cluster$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}