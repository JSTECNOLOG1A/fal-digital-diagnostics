
/**
 * dimensionMatrix.js
 * =====================================================================
 * Re-exporta da fonte única oficial.
 * Este arquivo existe apenas para compatibilidade de imports existentes.
 *
 * FONTE ÚNICA: components/fal/falOfficialMatrix.js
 * =====================================================================
 */

export {
  FAL_DIMENSIONS,
  FAL_DIMENSION_KEYS,
  FAL_DIMENSION_LABELS,
  DIMENSION_APPLICABILITY,
  DIMENSION_MATRIX,
  getSuggestedDimensions,
  getOptionalDimensions,
  getAvailableDimensions,
  getDimensionLabel,
  getSubdimLabel,
  getClusterLabel,
  normalizeSubdimKey,
  normalizeClusterKey,
  validateQuestionMapping,
  getSubdimensionsForDimension,
  getClustersForSubdimension,
  FAL_SUBDIMENSIONS,
  FAL_CLUSTERS,
  SUBDIM_MIGRATION_MAP,
  CLUSTER_MIGRATION_MAP,
} from './falOfficialMatrix';

// Alias de compatibilidade para imports que usam DIMENSION_LABELS diretamente
export { FAL_DIMENSION_LABELS as DIMENSION_LABELS } from './falOfficialMatrix';
