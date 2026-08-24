/**
 * levelApplicabilityMap.js
 *
 * Re-exporta da fonte única oficial (falOfficialMatrix).
 * Mantido para compatibilidade de imports existentes.
 *
 * FONTE ÚNICA: components/fal/falOfficialMatrix.js
 */

export { DIMENSION_APPLICABILITY } from './falOfficialMatrix';

export { getAvailableDimensions as getApplicableDimensions } from './falOfficialMatrix';

import { DIMENSION_APPLICABILITY } from './falOfficialMatrix';

/**
 * Verifica se uma dimensão é aplicável a um nível
 */
export function isDimensionApplicable(dimension, targetType) {
  const dims = DIMENSION_APPLICABILITY[targetType];
  return dims ? dims[dimension] === true : false;
}

/**
 * Verifica se uma pergunta é aplicável a um assessment
 * baseado em: level_applicability, dimension_key (v3)
 */
export function isQuestionApplicable(question, targetType, unitType) {
  const dimKey = question.dimension_key;
  if (!isDimensionApplicable(dimKey, targetType)) return false;

  const questionLevels = Array.isArray(question.level_applicability)
    ? question.level_applicability
    : (question.level_applicability || '').split(/[,;]/).map(l => l.trim()).filter(Boolean);

  const levels = questionLevels.length > 0 ? questionLevels : ['group', 'company', 'unit'];
  if (!levels.includes(targetType)) return false;

  if (targetType === 'unit' && unitType && question.unit_type_applicability?.length > 0) {
    if (!question.unit_type_applicability.includes(unitType)) return false;
  }

  return true;
}

// Mantido apenas para compatibilidade — não usado no motor v3
export const GOVERNANCA_SUBDIMENSION_MAPPING = {};