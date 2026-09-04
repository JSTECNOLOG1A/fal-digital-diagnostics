/**
 * buildFalQuestionSet
 *
 * Monta o question_set do Motor FAL para um assessment.
 * Todas as dimension_keys são em PORTUGUÊS (padrão do sistema).
 *
 * Payload: { assessment_id }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const ALL_DIMENSIONS = [
  'governanca', 'juridico', 'controles_internos', 'financeiro',
  'contabil', 'tributario', 'operacional', 'sistemas'
];

// Mapa de migração EN → PT (para assessments antigos que possam ter chaves em inglês)
// redeploy: 2026-03-17
const DIM_EN_TO_PT = {
  'governance':        'governanca',
  'legal':             'juridico',
  'internal_controls': 'controles_internos',
  'financial':         'financeiro',
  'accounting':        'contabil',
  'tax':               'tributario',
  'operations':        'operacional',
  'technology':        'sistemas',
};

function normalizeDimKey(key) {
  return DIM_EN_TO_PT[key] || key;
}

// Sugestão padrão de dimensões por tipo de alvo (usada apenas quando active_dimensions não está definido).
// Para grupos, o padrão são TODAS as dimensões — o consultor pode restringir via escopo.
// NUNCA limitar automaticamente baseado em target_type; isso era a raiz do bug.
const DEFAULT_DIMENSIONS_BY_TARGET = {
  group:   ALL_DIMENSIONS, // grupo pode ser Operacional, logo todas as dimensões são válidas
  company: ALL_DIMENSIONS,
  unit:    ['controles_internos', 'financeiro', 'contabil', 'tributario', 'operacional', 'sistemas'],
  holding: ['governanca', 'juridico', 'controles_internos', 'financeiro'],
};

function getSuggestedDimensions(targetType) {
  return DEFAULT_DIMENSIONS_BY_TARGET[targetType] || ALL_DIMENSIONS;
}

function depthMatch(questionDepth, selectedDepth) {
  if (!questionDepth) return true;
  const depths = typeof questionDepth === 'string'
    ? questionDepth.split(',').map(d => d.trim())
    : questionDepth;
  if (selectedDepth === 'rapid')    return depths.includes('rapid');
  if (selectedDepth === 'standard') return depths.includes('rapid') || depths.includes('standard');
  if (selectedDepth === 'deep')     return true;
  return true;
}

function isQuestionApplicable(question, targetType) {
  const questionLevels = typeof question.level_applicability === 'string'
    ? question.level_applicability.split(',').map(l => l.trim())
    : (question.level_applicability || ['group', 'company', 'unit']);

  // Para 'group': aceita perguntas marcadas como 'group' OU 'company'
  // (grupos consolidam empresas, então perguntas de company também são válidas)
  if (targetType === 'group') {
    return questionLevels.includes('group') || questionLevels.includes('company');
  }

  return questionLevels.includes(targetType);
}

function sectorMatch(question, sectorSnapshot) {
  const raw = (question.sector_applicability || 'all').toLowerCase();
  if (!raw || raw === 'all' || raw === 'todos' || raw === 'geral') return true;
  const sectors = raw.split(/[;,]/).map(s => s.trim());
  return sectors.some(s => sectorSnapshot.includes(s));
}

function isHQAdmin(user) {
  return ['hq_admin', 'admin', 'method_admin', 'superadmin'].includes(user.role);
}

function isAuthorized(user) {
  return ['hq_admin', 'admin', 'method_admin', 'superadmin', 'tenant_admin', 'consultant', 'user'].includes(user.role);
}

const BOOSTED_DIMS = ['operacional', 'tributario', 'financeiro'];

const DEPTH_CONFIG = {
  rapid:    { TARGET_MIN: 20,  TARGET_MAX: 90,  CORE_PER_SUBDIM: 2, MAX_PER_SUBDIM: 3 },
  standard: { TARGET_MIN: 80,  TARGET_MAX: 160, CORE_PER_SUBDIM: 3, MAX_PER_SUBDIM: 5 },
  deep:     { TARGET_MIN: 150, TARGET_MAX: 320, CORE_PER_SUBDIM: 5, MAX_PER_SUBDIM: 8 },
};

const STAGE_ORDER = ['existence','request','analysis','approval','execution','record','control','monitoring','audit'];

// Máximo de clusters por rodada de montagem que podem disparar geração
// automática — limita custo/latência mesmo se muitos clusters estiverem rasos.
const GAP_MAX_CLUSTERS_PER_RUN = 3;

/**
 * Varre os clusters das dimensões ativas com menos perguntas elegíveis do
 * que o alvo de cobertura (CORE_PER_SUBDIM) e dispara o copiloto de IA
 * (generateFalContentSuggestions) com trigger="gap_detected" para os mais
 * rasos, evitando duplicar se já existir sugestão pendente para o mesmo
 * cluster.
 */
async function triggerGapDetectedSuggestions(base44, { eligible, activeDimensions, corePerSubdim, requestedBy }) {
  const byCluster = {};
  for (const q of eligible) {
    if (!activeDimensions.includes(q.dimension_key) || !q.cluster_key) continue;
    (byCluster[q.cluster_key] ||= []).push(q);
  }

  const gaps = Object.entries(byCluster)
    .filter(([, qs]) => qs.length < corePerSubdim)
    .sort((a, b) => a[1].length - b[1].length)
    .slice(0, GAP_MAX_CLUSTERS_PER_RUN);

  for (const [clusterKey, qs] of gaps) {
    const alreadyPending = await base44.asServiceRole.entities.FalContentSuggestion.filter({
      cluster_key: clusterKey, content_type: 'question', trigger: 'gap_detected', status: 'pending',
    }, 'id', 1);
    if (alreadyPending.length > 0) continue;

    const needed = Math.min(Math.max(corePerSubdim - qs.length, 1), 5);
    await base44.asServiceRole.functions.invoke('generateFalContentSuggestions', {
      cluster_key: clusterKey,
      content_type: 'question',
      count: needed,
      trigger: 'gap_detected',
      requested_by: requestedBy,
    });
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // SEG-03: Write guard — blocks client_viewer from mutations (WRITE_OPERATION)
    const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
    if (!WRITE_ROLES.has(appRole)) {
      return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });
    }

    const { assessment_id } = await req.json();
    if (!assessment_id) return Response.json({ error: 'assessment_id required' }, { status: 400 });

    const assessment = await base44.asServiceRole.entities.Assessment.get(assessment_id);
    if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });

    if (!isAuthorized(user)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Verificação de tenant: apenas bloqueia se o usuário tiver tenant_id E o assessment tiver
    // tenant_id diferente. Nunca bloqueia se o assessment não tiver tenant_id definido.
    if (!isHQAdmin(user) && user.tenant_id && assessment.tenant_id && assessment.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load manual dimension overrides for this entity
    const entityId = assessment.group_id || assessment.company_id || assessment.unit_id || assessment.target_id;
    const entityType = assessment.target_type;
    let dimensionOverrides = [];
    if (entityId) {
      try {
        dimensionOverrides = await base44.asServiceRole.entities.FalEntityDimensionOverride.filter({
          entity_id: entityId, entity_type: entityType,
        });
      } catch (e) {
        console.warn('[buildFalQuestionSet] Could not load dimension overrides:', e.message);
      }
    }
    const overrideMap = {};
    dimensionOverrides.forEach(o => { overrideMap[o.dimension_key] = o; });

    // Determine active dimensions
    let rawDimensions = assessment.active_dimensions?.length
      ? assessment.active_dimensions
      : null;

    if (!rawDimensions) {
      rawDimensions = getSuggestedDimensions(assessment.target_type);
      await base44.asServiceRole.entities.Assessment.update(assessment_id, {
        active_dimensions: rawDimensions,
        scope_mode: 'suggested',
      });
    }

    // Apply manual overrides: manually_disabled removes, manually_enabled adds
    const allDims = ALL_DIMENSIONS;
    const baseDims = new Set(rawDimensions.map(normalizeDimKey).filter(d => allDims.includes(d)));
    for (const [dimKey, override] of Object.entries(overrideMap)) {
      if (override.manually_disabled) {
        baseDims.delete(dimKey);
        console.log(`[buildFalQuestionSet] Override: dimensão "${dimKey}" desativada manualmente por ${override.changed_by}`);
      } else if (override.manually_enabled) {
        baseDims.add(dimKey);
        console.log(`[buildFalQuestionSet] Override: dimensão "${dimKey}" ativada manualmente por ${override.changed_by}`);
      }
    }
    rawDimensions = [...baseDims];

    // Normalizar EN → PT (assessments antigos)
    const normalizedDims = rawDimensions.map(normalizeDimKey);
    const legacyFound = rawDimensions.filter(d => DIM_EN_TO_PT[d]);
    if (legacyFound.length > 0) {
      console.warn('[buildFalQuestionSet] Dimensões EN→PT migradas:', legacyFound, '→', legacyFound.map(normalizeDimKey));
      await base44.asServiceRole.entities.Assessment.update(assessment_id, { active_dimensions: normalizedDims });
    }

    // Log de diagnóstico
    console.log('[buildFalQuestionSet] selected_dimensions_raw:', rawDimensions);
    console.log('[buildFalQuestionSet] selected_dimensions_normalized:', normalizedDims);

    // Sanitize: apenas chaves PT válidas
    const validActiveDimensions = [...new Set(normalizedDims.filter(d => ALL_DIMENSIONS.includes(d)))];

    if (validActiveDimensions.length === 0) {
      return Response.json({
        error: 'Nenhuma dimensão válida encontrada. Verifique active_dimensions.',
        active_dimensions_received: rawDimensions,
        active_dimensions_normalized: normalizedDims,
        valid_dimensions: ALL_DIMENSIONS,
      }, { status: 400 });
    }

    const invalidDims = normalizedDims.filter(d => !ALL_DIMENSIONS.includes(d));
    if (invalidDims.length > 0) {
      console.warn('[buildFalQuestionSet] Chaves inválidas removidas:', invalidDims);
    }

    const activeDimensions = validActiveDimensions;
    console.log('[buildFalQuestionSet] active_dimensions_final:', activeDimensions);

    const sectorSnapshot = assessment.sector_snapshot?.length
      ? assessment.sector_snapshot
      : ['general_business'];

    let unitType = null;
    if (assessment.target_type === 'unit' && assessment.unit_id) {
      const unit = await base44.asServiceRole.entities.OperationalUnit.get(assessment.unit_id);
      unitType = unit?.unit_type?.toLowerCase() || null;
    }

    const depth = assessment.diagnostic_depth || 'rapid';
    const { TARGET_MIN, TARGET_MAX, CORE_PER_SUBDIM, MAX_PER_SUBDIM } = DEPTH_CONFIG[depth] || DEPTH_CONFIG.rapid;

    // Busca perguntas em paralelo por dimensão ativa (evita carregar banco inteiro)
    const questionBatches = await Promise.all(
      activeDimensions.map(dim =>
        base44.asServiceRole.entities.FalQuestion.filter({ dimension_key: dim }, 'sequence_order', 500)
      )
    );
    const allQuestions = questionBatches.flat();

    allQuestions.sort((a, b) =>
      (a.dimension_key || '').localeCompare(b.dimension_key || '') ||
      (a.subdimension_key || '').localeCompare(b.subdimension_key || '') ||
      (a.cluster_key || '').localeCompare(b.cluster_key || '') ||
      (STAGE_ORDER.indexOf(a.process_stage) + 1 || 99) - (STAGE_ORDER.indexOf(b.process_stage) + 1 || 99) ||
      (a.sequence_order || 0) - (b.sequence_order || 0)
    );

    const eligible = allQuestions.filter(q =>
      sectorMatch(q, sectorSnapshot) &&
      isQuestionApplicable(q, assessment.target_type) &&
      depthMatch(q.diagnostic_depth, depth)
    );

    // Group by active dimension
    const byDim = {};
    for (const dim of activeDimensions) {
      byDim[dim] = eligible
        .filter(q => q.dimension_key === dim)
        .sort((a, b) => (b.question_weight || 1) - (a.question_weight || 1));
    }

    const existingResponses = await base44.asServiceRole.entities.FalResponse.filter({ assessment_id });
    const hasResponses = existingResponses.length > 0;

    let selectedIds = new Set();
    const byDimSelected = {};

    // Pass 1: select by subdimension (balanced coverage)
    for (const dim of activeDimensions) {
      const pool = byDim[dim] || [];
      const isBoost = BOOSTED_DIMS.includes(dim);
      const bySubdim = {};
      for (const q of pool) {
        const sub = q.subdimension_key || '_none';
        if (!bySubdim[sub]) bySubdim[sub] = [];
        bySubdim[sub].push(q);
      }
      const dimSelected = [];
      const quota = isBoost ? MAX_PER_SUBDIM : CORE_PER_SUBDIM;
      for (const subPool of Object.values(bySubdim)) {
        const pick = subPool.slice(0, quota);
        pick.forEach(q => { selectedIds.add(q.id); dimSelected.push(q.id); });
      }
      byDimSelected[dim] = dimSelected;
    }

    // Pass 2 adaptive: boost weakest dims if responses exist
    // NOTE: usa exclusivamente r.dimension_key — sem fallback legado r.dimension
    if (hasResponses && selectedIds.size < TARGET_MAX) {
      const dimScores = {};
      for (const dim of activeDimensions) {
        const dimResps = existingResponses.filter(r => r.dimension_key === dim);
        dimScores[dim] = dimResps.length === 0 ? 0 : dimResps.reduce((s, r) => s + (r.score || 0), 0) / dimResps.length;
      }
      const weakest = [...activeDimensions].sort((a, b) => (dimScores[a] || 0) - (dimScores[b] || 0)).slice(0, 3);
      const remaining = TARGET_MAX - selectedIds.size;
      const extraPerWeak = Math.min(Math.floor(remaining / 3), 15);
      for (const dim of weakest) {
        const pool = byDim[dim] || [];
        const alreadySelected = new Set(byDimSelected[dim] || []);
        const extras = pool.filter(q => !alreadySelected.has(q.id)).slice(0, extraPerWeak);
        extras.forEach(q => selectedIds.add(q.id));
        byDimSelected[dim] = [...(byDimSelected[dim] || []), ...extras.map(q => q.id)];
      }
    }

    // Garantir cobertura mínima por dimensão (ao menos 1 pergunta por dim ativa com elegíveis)
    // ANTES de aplicar o cap TARGET_MAX, para evitar que dimensões no final da lista fiquem com 0.
    for (const dim of activeDimensions) {
      const pool = byDim[dim] || [];
      if (pool.length === 0) continue;
      const alreadyHas = pool.some(q => selectedIds.has(q.id));
      if (!alreadyHas) {
        // Pega ao menos CORE_PER_SUBDIM perguntas desta dimensão substituindo as de menor peso de outra
        const toAdd = pool.slice(0, CORE_PER_SUBDIM);
        toAdd.forEach(q => selectedIds.add(q.id));
      }
    }

    // Para assessments multi-entidade (fal_scoped / multi_entity_master), não aplicar cap
    // pois cada dimensão é avaliada por entidade distinta — todas as perguntas são necessárias.
    const isMultiEntity = ['fal_scoped', 'multi_entity_master'].includes(assessment.assessment_mode);
    const effectiveCap = isMultiEntity ? Infinity : TARGET_MAX + 40;
    const finalSet = isMultiEntity ? [...selectedIds] : [...selectedIds].slice(0, effectiveCap);

    // Fill to minimum if short (apenas para assessments não-multi-entidade)
    if (!isMultiEntity && finalSet.length < TARGET_MIN) {
      const selectedSet = new Set(finalSet);
      const remaining = eligible
        .filter(q => activeDimensions.includes(q.dimension_key) && !selectedSet.has(q.id))
        .sort((a, b) => (b.question_weight || 1) - (a.question_weight || 1));
      for (const q of remaining) {
        if (finalSet.length >= TARGET_MIN) break;
        finalSet.push(q.id);
      }
    }

    const finalSetIds = new Set(finalSet);
    const summary = {};
    const emptyDimensions = [];
    const warnings = [];

    for (const dim of activeDimensions) {
      const eligibleInDim = eligible.filter(q => q.dimension_key === dim).length;
      const selectedInDim = (byDimSelected[dim] || []).filter(id => finalSetIds.has(id)).length;
      summary[dim] = { eligible: eligibleInDim, selected: selectedInDim };
      if (selectedInDim === 0) {
        emptyDimensions.push(dim);
        const msg = `[buildFalQuestionSet] WARN: Dimensão "${dim}" ativa mas com 0 perguntas (elegíveis: ${eligibleInDim}, target_type: ${assessment.target_type}, depth: ${depth})`;
        console.warn(msg);
        warnings.push(msg);
      }
    }

    if (emptyDimensions.length === activeDimensions.length) {
      return Response.json({
        error: 'Banco de perguntas FAL vazio ou incompatível com o perfil deste assessment.',
        active_dimensions_used: activeDimensions,
        total_questions: 0,
        questions_by_dimension: summary,
        empty_dimensions: emptyDimensions,
        warnings,
      }, { status: 422 });
    }

    await base44.asServiceRole.entities.Assessment.update(assessment_id, { question_set: finalSet });

    // ── Detecção de lacunas → dispara o copiloto de IA automaticamente ──
    // Não bloqueia nem falha a montagem do questionário se der erro — só
    // fica sem sugestão automática dessa vez (consultor ainda pode gerar
    // manualmente depois pelo Motor FAL).
    try {
      await triggerGapDetectedSuggestions(base44, { eligible, activeDimensions, corePerSubdim: CORE_PER_SUBDIM, requestedBy: user.email });
    } catch (gapErr) {
      console.warn('[buildFalQuestionSet] gap detection falhou (não bloqueante):', gapErr.message);
    }

    console.log(`[buildFalQuestionSet] OK — assessment=${assessment_id} total=${finalSet.length} dims=${activeDimensions.length} empty=${emptyDimensions.length} depth=${depth}`);

    return Response.json({
      success: true,
      question_set: finalSet,
      total: finalSet.length,
      total_questions: finalSet.length,
      active_dimensions_used: activeDimensions,
      questions_by_dimension: summary,
      by_dimension: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, v.selected])),
      empty_dimensions: emptyDimensions,
      warnings,
      adaptive_pass: hasResponses,
    });
  } catch (error) {
    console.error('[buildFalQuestionSet] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});