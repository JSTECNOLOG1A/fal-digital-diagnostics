import React from 'react';

// Mapa semântico FAL: usa tokens de status, sem blue/indigo genérico
const colorMap = {
  'Crítica':                    'fal-badge-danger',
  'Vulnerável':                 'fal-badge-warning',
  'Instável':                   'fal-badge-warning',
  'Estruturada':                'fal-badge-current',
  'Madura':                     'fal-badge-success',
  'Conflito Estrutural':        'fal-badge-danger',
  'Dependência Vulnerável':     'fal-badge-warning',
  'Interdependência Instável':  'fal-badge-warning',
  'Interdependência Funcional': 'fal-badge-current',
  'Interdependência Integrada': 'fal-badge-success',
  'Fragmentada':                'fal-badge-danger',
  'Vulneráveis':                'fal-badge-warning',
  'Tensão Latente':             'fal-badge-warning',
  'Coesa':                      'fal-badge-current',
  'Integração Sistêmica':       'fal-badge-success',
};

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.score
 * @param {any=} props.className
 */
export default function ScoreBadge({ label, score, className = '' }) {
  const cls = colorMap[label] || 'fal-badge-neutral';
  return (
    <span className={`fal-badge ${cls} ${className}`}>
      {score !== undefined && (
        <span className="font-bold">{typeof score === 'number' ? score.toFixed(1) : score}</span>
      )}
      {label}
    </span>
  );
}