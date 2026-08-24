import React from 'react';

const statusConfig = {
  draft:       { label: 'Rascunho',   cls: 'fal-badge-neutral' },
  in_progress: { label: 'Em Andamento', cls: 'fal-badge-current' },
  scoring:     { label: 'Pontuação',  cls: 'fal-badge-current' },
  review:      { label: 'Revisão',    cls: 'fal-badge-warning' },
  published:   { label: 'Publicado',  cls: 'fal-badge-success' },
  archived:    { label: 'Arquivado',  cls: 'fal-badge-neutral' },
};

/**
 * @param {Object} props
 * @param {any=} props.status
 */
export default function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, cls: 'fal-badge-neutral' };
  return (
    <span className={`fal-badge ${config.cls}`}>
      {config.label}
    </span>
  );
}