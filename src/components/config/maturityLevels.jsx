/**
 * maturityLevels.js — Configuração oficial de maturidade FAL
 * ESCALA: 0–3 — alinhada com questionário (0,1,2,3) e backend computeFalDiagnostic.
 *
 * Espelha os thresholds de maturityConfig.js e do DEFAULT_CONFIG backend:
 *   Crítico    : 0.00 – 0.99
 *   Básico     : 1.00 – 1.79
 *   Estruturado: 1.80 – 2.49
 *   Avançado   : 2.50 – 3.00
 */

export const MATURITY_LEVELS = [
  { min: 0.0,  max: 0.99, level: 0, label: 'Crítico',     short: 'Controles ausentes ou com falhas graves.',            color: '#dc2626', bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  { min: 1.0,  max: 1.79, level: 1, label: 'Básico',      short: 'Práticas existem mas dependem de pessoas-chave.',     color: '#ea580c', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  { min: 1.8,  max: 2.49, level: 2, label: 'Estruturado', short: 'Processos implementados com controles definidos.',    color: '#2563eb', bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  { min: 2.5,  max: 3.0,  level: 3, label: 'Avançado',    short: 'Gestão por indicadores e melhoria contínua.',         color: '#16a34a', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
];

/**
 * Retorna o objeto de maturidade para um score 0–3.
 * @param {number|null} score
 * @returns {{ level, label, short, color, bg, text, dot, score }}
 */
export function calculateMaturity(score) {
  if (score === null || score === undefined || isNaN(Number(score))) {
    return { ...MATURITY_LEVELS[0], score: null };
  }
  const s = Math.max(0, Math.min(3, Number(score)));
  const found = MATURITY_LEVELS.find(m => s >= m.min && s <= m.max);
  return { ...(found || MATURITY_LEVELS[MATURITY_LEVELS.length - 1]), score: s };
}

export default MATURITY_LEVELS;