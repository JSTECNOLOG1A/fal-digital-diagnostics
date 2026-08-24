/**
 * GroupExecutiveBanner — Faixa de resumo executivo persistente entre todas as abas.
 * Exibe: ícone, nome do grupo, resumo contextual e badge de nível.
 */
import { formatIFME } from '@/lib/hooks/useGroupAssessment';

const LEVEL_STYLE = {
  Crítico: { bg: 'var(--fal-danger-bg)', text: 'var(--fal-danger-text)', border: 'var(--fal-danger-border)' },
  Básico: { bg: 'var(--fal-warning-bg)', text: 'var(--fal-warning-text)', border: 'var(--fal-warning-border)' },
  Estruturado: { bg: 'var(--fal-current-bg)', text: 'var(--fal-current-text)', border: 'var(--fal-current-border)' },
  Avançado: { bg: 'var(--fal-success-bg)', text: 'var(--fal-success-text)', border: 'var(--fal-success-border)' }
};

// Recebe dados já buscados pelo pai — sem queries próprias
/**
 * @param {Object} props
 * @param {any=} props.aggSnap
 * @param {any=} props.group
 */
export default function GroupExecutiveBanner({ aggSnap, group }) {
  const score = aggSnap?.overall_score ?? null;
  const level = aggSnap?.overall_level ?? null;
  const levelStyle = level ? LEVEL_STYLE[level] : null;

  const execSummary = (() => {
    const parts = [];
    if (level) parts.push(`Maturidade ${level}`);
    if (score != null) parts.push(`IFME™ ${formatIFME(score)}`);
    return parts.join(' · ');
  })();

  return null;




















}