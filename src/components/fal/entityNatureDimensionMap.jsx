/**
 * entityNatureDimensionMap.js
 * Maps entity_nature to active_dimensions for automatic scope configuration.
 * FONTE DE VERDADE: apenas as 8 chaves oficiais do Motor FAL v3 (inglês).
 */

export const OFFICIAL_DIMENSIONS = [
  'governanca',
  'juridico',
  'controles_internos',
  'financeiro',
  'contabil',
  'tributario',
  'operacional',
  'sistemas',
];

const dimensionMap = {
  'Operacional': [
    'governanca',
    'juridico',
    'controles_internos',
    'financeiro',
    'contabil',
    'tributario',
    'operacional',
    'sistemas',
  ],
  'Não operacional': [
    'governanca',
    'juridico',
    'controles_internos',
    'financeiro',
    'contabil',
    'tributario',
    'sistemas',
  ],
  'Mista': [
    'governanca',
    'juridico',
    'controles_internos',
    'financeiro',
    'contabil',
    'tributario',
    'operacional',
    'sistemas',
  ],
};

export function getActiveDimensionsByNature(entityNature) {
  return dimensionMap[entityNature] || OFFICIAL_DIMENSIONS;
}

/**
 * Sanitiza uma lista de dimensões, removendo chaves inválidas, nulos e duplicatas.
 */
export function sanitizeDimensions(dims) {
  if (!dims || !Array.isArray(dims)) return [...OFFICIAL_DIMENSIONS];
  return [...new Set(dims.filter(d => d && OFFICIAL_DIMENSIONS.includes(d)))];
}

export function getEntityNatureLabel(nature) {
  const labels = {
    'Operacional': '✓ Operacional (8 dimensões)',
    'Não operacional': '✓ Não operacional (7 dimensões)',
    'Mista': '✓ Mista (8 dimensões)',
  };
  return labels[nature] || nature;
}