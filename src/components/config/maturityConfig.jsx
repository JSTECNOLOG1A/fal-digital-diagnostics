/**
 * maturityConfig.js — Mapeamento de Maturidade FAL
 *
 * ESCALA OFICIAL: 0–3 — alinhada com:
 *   - QuestionCard: botões 0, 1, 2, 3
 *   - computeFalDiagnostic backend: score_range_max=3, thresholds critico<1.0, basico<1.8, estruturado<2.5
 *   - falDiagnosticEngine frontend: SCORE_MAX=3
 *
 * MAPEAMENTO (espelha level_thresholds do backend):
 *   0.00 – 0.99  → Crítico
 *   1.00 – 1.79  → Básico
 *   1.80 – 2.49  → Estruturado
 *   2.50 – 3.00  → Avançado
 */

export const MATURITY_LEVELS = [
  {
    level: 0, label: 'Crítico',
    short_description: 'Controles ausentes ou com falhas graves que comprometem a operação.',
    color: '#dc2626', bg_class: 'bg-red-100', text_class: 'text-red-700',
    border_class: 'border-red-300', dot_class: 'bg-red-500', min: 0.00, max: 0.99,
  },
  {
    level: 1, label: 'Básico',
    short_description: 'Práticas existem mas dependem de pessoas-chave, sem padronização.',
    color: '#ea580c', bg_class: 'bg-amber-100', text_class: 'text-amber-700',
    border_class: 'border-amber-300', dot_class: 'bg-amber-500', min: 1.00, max: 1.79,
  },
  {
    level: 2, label: 'Estruturado',
    short_description: 'Processos implementados com controles e responsáveis definidos.',
    color: '#2563eb', bg_class: 'bg-blue-100', text_class: 'text-blue-700',
    border_class: 'border-blue-300', dot_class: 'bg-blue-500', min: 1.80, max: 2.49,
  },
  {
    level: 3, label: 'Avançado',
    short_description: 'Gestão por indicadores, melhoria contínua e benchmarks instalados.',
    color: '#16a34a', bg_class: 'bg-emerald-100', text_class: 'text-emerald-700',
    border_class: 'border-emerald-300', dot_class: 'bg-emerald-500', min: 2.50, max: 3.00,
  },
];

/**
 * Retorna o nível de maturidade para um score na escala 0–3.
 * Alinhado com scoreToLevel() do computeFalDiagnostic backend.
 */
export function getMaturityLevel(score) {
  if (score === null || score === undefined || isNaN(Number(score))) {
    return { ...MATURITY_LEVELS[0], score: null };
  }
  const s = Math.max(0, Math.min(3, Number(score)));
  const found = MATURITY_LEVELS.find(m => s >= m.min && s <= m.max);
  return found ? { ...found, score: s } : { ...MATURITY_LEVELS[MATURITY_LEVELS.length - 1], score: s };
}

/**
 * Converte score 0–3 para índice percentual de maturidade (0–100%).
 */
export function scoreToMaturityIndex(score) {
  if (score === null || score === undefined || isNaN(Number(score))) return 0;
  return Math.round((Math.max(0, Math.min(3, Number(score))) / 3) * 100);
}

export default MATURITY_LEVELS;