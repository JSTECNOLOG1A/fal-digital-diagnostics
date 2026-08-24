/**
 * falAssessmentScopeUtils.js
 * Helpers puros para o sistema Multi-Entidade FAL.
 * Sem efeitos colaterais, sem chamadas de API.
 */

import DIMENSION_SCOPE_POLICY, { DIMENSION_KEYS_ORDERED, getDimensionPolicy } from './falDimensionScopePolicy.js';

export { DIMENSION_KEYS_ORDERED };

// ─── getDimensionScopePolicy ──────────────────────────────────────────────────
/** Alias público — nunca quebra com key desconhecida. */
export function getDimensionScopePolicy(dimensionKey) {
  return getDimensionPolicy(dimensionKey);
}

// ─── normalizeAssessmentMode ──────────────────────────────────────────────────
/** Ausência de campo = 'single_entity' (compatibilidade legada). */
export function normalizeAssessmentMode(assessment) {
  return assessment?.assessment_mode || 'single_entity';
}

// ─── isMultiEntityAssessment ──────────────────────────────────────────────────
export function isMultiEntityAssessment(assessment) {
  return normalizeAssessmentMode(assessment) === 'multi_entity_master';
}

// ─── normalizeSamplingMode ────────────────────────────────────────────────────
export function normalizeSamplingMode(value) {
  if (['full', 'sample', 'not_applicable'].includes(value)) return value;
  return 'full';
}

// ─── normalizeWeight ──────────────────────────────────────────────────────────
export function normalizeWeight(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// ─── getScopeUniqueKey ────────────────────────────────────────────────────────
export function getScopeUniqueKey(scope) {
  return `${scope.assessment_id}::${scope.dimension_key}::${scope.evaluated_entity_type}::${scope.evaluated_entity_id}`;
}

// ─── validateDimensionTargetMapping ──────────────────────────────────────────
/**
 * Valida o dimension_target_mapping completo.
 * Retorna { valid, errors: [{dimension_key, message}], warnings: [{dimension_key, message}] }
 */
export function validateDimensionTargetMapping(mapping) {
  const errors = [];
  const warnings = [];

  if (!mapping || typeof mapping !== 'object') {
    return { valid: false, errors: [{ dimension_key: null, message: 'Mapping ausente ou inválido.' }], warnings };
  }

  for (const [dimKey, targets] of Object.entries(mapping)) {
    const policy = getDimensionPolicy(dimKey);

    if (!Array.isArray(targets) || targets.length === 0) {
      errors.push({ dimension_key: dimKey, message: `Dimensão ${policy.label} sem entidades configuradas.` });
      continue;
    }

    const seenEntities = new Set();
    for (const target of targets) {
      if (!target.entity_id) {
        errors.push({ dimension_key: dimKey, message: `Entidade sem ID em ${policy.label}.` });
        continue;
      }
      if (!target.entity_name) {
        errors.push({ dimension_key: dimKey, message: `Entidade sem nome em ${policy.label}.` });
      }
      if (target.level && !policy.allowed_levels.includes(target.level)) {
        errors.push({ dimension_key: dimKey, message: `Nível "${target.level}" não permitido para ${policy.label}. Permitidos: ${policy.allowed_levels.join(', ')}.` });
      }
      if (target.weight != null && (isNaN(target.weight) || target.weight <= 0)) {
        errors.push({ dimension_key: dimKey, message: `Peso inválido para ${target.entity_name || target.entity_id} em ${policy.label}.` });
      }
      if (target.sampling_mode && !['full', 'sample', 'not_applicable'].includes(target.sampling_mode)) {
        errors.push({ dimension_key: dimKey, message: `sampling_mode inválido: "${target.sampling_mode}" em ${policy.label}.` });
      }
      if (seenEntities.has(target.entity_id)) {
        errors.push({ dimension_key: dimKey, message: `Entidade duplicada "${target.entity_name || target.entity_id}" em ${policy.label}.` });
      }
      seenEntities.add(target.entity_id);
    }

    // Warnings
    const hasSample = targets.some(t => t.sampling_mode === 'sample');
    if (hasSample) {
      warnings.push({ dimension_key: dimKey, message: `${policy.label} será avaliada por amostragem.` });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── buildScopeHash ───────────────────────────────────────────────────────────
/**
 * Hash estável e determinístico do mapping.
 * Ordena chaves e entity_ids para evitar diferenças por ordem de inserção.
 */
export function buildScopeHash(mapping) {
  if (!mapping) return '';
  const sorted = {};
  for (const key of Object.keys(mapping).sort()) {
    sorted[key] = [...(mapping[key] || [])].sort((a, b) =>
      (a.entity_id || '').localeCompare(b.entity_id || '')
    ).map(t => ({
      entity_id: t.entity_id,
      level: t.level,
      sampling_mode: normalizeSamplingMode(t.sampling_mode),
      include_in_consolidated_score: t.include_in_consolidated_score !== false,
    }));
  }
  const str = JSON.stringify(sorted);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ─── computeCoverageMode ──────────────────────────────────────────────────────
export function computeCoverageMode(mapping) {
  if (!mapping) return 'full';
  const allTargets = Object.values(mapping).flat();
  const hasSample = allTargets.some(t => t.sampling_mode === 'sample');
  const hasFull = allTargets.some(t => t.sampling_mode !== 'sample');
  if (hasSample && hasFull) return 'mixed';
  if (hasSample) return 'sample';
  return 'full';
}

// ─── generateScopesFromMapping ────────────────────────────────────────────────
/**
 * Expande o dimension_target_mapping em lista flat de AssessmentScope payloads.
 * Não salva no banco — apenas retorna os objetos normalizados.
 */
export function generateScopesFromMapping({ mapping, assessmentId, tenantId }) {
  if (!mapping || !assessmentId || !tenantId) return [];
  const scopes = [];
  for (const [dimKey, targets] of Object.entries(mapping)) {
    for (const target of (targets || [])) {
      scopes.push({
        tenant_id: tenantId,
        assessment_id: assessmentId,
        dimension_key: dimKey,
        evaluated_entity_type: target.level,
        evaluated_entity_id: target.entity_id,
        evaluated_entity_name: target.entity_name,
        weight: normalizeWeight(target.weight),
        sampling_mode: normalizeSamplingMode(target.sampling_mode),
        include_in_consolidated_score: target.include_in_consolidated_score !== false,
        status: 'not_started',
        question_count: 0,
        answered_count: 0,
        required_count: 0,
        completion_ratio: 0,
      });
    }
  }
  return scopes;
}

// ─── getApplicableDimensionsForEntity ────────────────────────────────────────
/**
 * Retorna as dimensões aplicáveis para uma entidade específica dentro de um assessment.
 *
 * Prioridade:
 * 1. Se assessment.dimension_target_mapping existe, usa as dimensões onde esta entidade é target.
 * 2. Fallback: usa a política allowed_levels de cada dimensão para o entity_type.
 *
 * Retorna array de { key, label, icon, description }
 */
export function getApplicableDimensionsForEntity(assessment, entity) {
  if (!entity) return [];

  const entityId = entity.entity_id;
  const entityType = entity.entity_type;
  const mapping = assessment?.dimension_target_mapping;

  if (mapping && Object.keys(mapping).length > 0) {
    // Usa o dimension_target_mapping: retorna dimensões onde esta entidade aparece como target
    const applicable = [];
    for (const dimKey of DIMENSION_KEYS_ORDERED) {
      const targets = mapping[dimKey];
      if (!targets || !Array.isArray(targets)) continue;
      const isTarget = targets.some(t => t.entity_id === entityId);
      if (isTarget) {
        const policy = getDimensionPolicy(dimKey);
        applicable.push({ key: dimKey, label: policy.label, icon: policy.icon || '', description: policy.description || '' });
      }
    }
    // Se encontrou dimensões pelo mapping, retorna
    if (applicable.length > 0) return applicable;
  }

  // Fallback: usa allowed_levels da política por entity_type
  return DIMENSION_KEYS_ORDERED
    .map(dimKey => {
      const policy = getDimensionPolicy(dimKey);
      return { key: dimKey, label: policy.label, icon: policy.icon || '', description: policy.description || '', _allowed: policy.allowed_levels };
    })
    .filter(dim => dim._allowed.includes(entityType))
    .map(({ _allowed, ...rest }) => rest);
}

// ─── buildRecommendedMapping ──────────────────────────────────────────────────
/**
 * Gera o dimension_target_mapping recomendado pelo Método FAL
 * com base nas chaves REAIS do sistema (falOfficialMatrix.js).
 *
 * Política recomendada:
 * - governanca    → Grupo
 * - juridico      → Grupo
 * - controles_internos → Unidades (sample se > 5), fallback Empresas
 * - financeiro    → Empresas
 * - contabil      → Empresas
 * - tributario    → Empresas
 * - operacional   → Unidades (sample se > 5), fallback Empresas
 * - sistemas      → Grupo
 */
export function buildRecommendedMapping({ groupId, groupName, companies, units }) {
  const mapping = {};
  const groupTarget = [{
    level: 'group',
    entity_id: groupId,
    entity_name: groupName || 'Grupo',
    weight: 1,
    sampling_mode: 'full',
    include_in_consolidated_score: true,
  }];
  const companyTargets = companies.map(c => ({
    level: 'company',
    entity_id: c.id,
    entity_name: c.name,
    weight: 1,
    sampling_mode: 'full',
    include_in_consolidated_score: true,
  }));
  const useSampleForUnits = units.length > 5;
  const unitTargets = units.map(u => ({
    level: 'unit',
    entity_id: u.id,
    entity_name: u.name,
    weight: 1,
    sampling_mode: useSampleForUnits ? 'sample' : 'full',
    include_in_consolidated_score: true,
  }));

  // governanca → Grupo
  if (groupId) mapping['governanca'] = groupTarget;

  // juridico → Grupo
  if (groupId) mapping['juridico'] = groupTarget;

  // controles_internos → Unidades ou Empresas
  if (unitTargets.length > 0) {
    mapping['controles_internos'] = unitTargets;
  } else if (companyTargets.length > 0) {
    mapping['controles_internos'] = companyTargets;
  }

  // financeiro → Empresas (contabil só pode ser company)
  if (companyTargets.length > 0) {
    mapping['financeiro'] = companyTargets;
    mapping['contabil'] = companyTargets;
    mapping['tributario'] = companyTargets;
  }

  // operacional → Unidades ou Empresas
  if (unitTargets.length > 0) {
    mapping['operacional'] = unitTargets;
  } else if (companyTargets.length > 0) {
    mapping['operacional'] = companyTargets;
  }

  // sistemas → Grupo
  if (groupId) mapping['sistemas'] = groupTarget;

  return mapping;
}