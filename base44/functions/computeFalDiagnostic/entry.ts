/**
 * computeFalDiagnostic — FAL Score Engine 3.0
 *
 * Motor metodologicamente parametrizável:
 * - Lê configurações de FalMethodologyConfig (tenant-specific ou global)
 * - Suporte a versionamento de metodologia com log auditável
 * - Hierarquia: Pergunta → Cluster → Subdimensão → Dimensão → Score Geral
 * - Score geral ponderado por peso de dimensão (por tipo de entidade)
 * - Killer questions, dominância de risco e penalidade por concentração configuráveis
 * - Log metodológico completo no snapshot (versão, regras, penalidades)
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

const ENGINE_VERSION = '3.0.0';

// ── Dimensões canônicas (fallback quando não carregado do banco) ──────────────
const CANONICAL_DIMENSIONS = [
  { key: 'governanca',         axis: 'Governança' },
  { key: 'juridico',           axis: 'Jurídico / Societário' },
  { key: 'controles_internos', axis: 'Controles Internos' },
  { key: 'financeiro',         axis: 'Financeiro' },
  { key: 'contabil',           axis: 'Contábil' },
  { key: 'tributario',         axis: 'Fiscal' },
  { key: 'operacional',        axis: 'Operacional' },
  { key: 'sistemas',           axis: 'Tecnologia / Sistemas' },
];

// Configuração metodológica padrão (usada quando não há FalMethodologyConfig ativa)
const DEFAULT_CONFIG = {
  methodology_version: '3.0.0-default',
  config_id: 'builtin',
  score_range_max: 3,
  score_range_min: 0,

  killer_question_enabled: true,
  killer_question_threshold: 2,
  killer_question_cap: 2.0,

  risk_dominance_enabled: true,
  risk_dominance_cluster_threshold: 2.0,
  risk_dominance_dimension_cap: 2.5,

  concentration_penalty_enabled: true,
  concentration_penalty_cluster_threshold: 2.5,
  concentration_penalty_min_clusters: 3,
  concentration_penalty_value: 0.3,

  cluster_min_questions_for_scoring: 1,

  overall_score_method: 'weighted_by_dimension',

  dimension_weights: {},

  level_thresholds: { critico: 1.0, basico: 1.8, estruturado: 2.5 },

  critical_cluster_threshold: 1.0,
};

// ── Helpers matemáticos ───────────────────────────────────────────────────────

function isHQAdmin(user) {
  return ['hq_admin', 'admin', 'method_admin', 'superadmin'].includes(user.role);
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

function weightedAvg(items) {
  if (!items || items.length === 0) return 0;
  let sumVW = 0;
  let sumW  = 0;
  for (const { value, weight } of items) {
    const w = (typeof weight === 'number' && weight > 0) ? weight : 1;
    sumVW += (value || 0) * w;
    sumW  += w;
  }
  if (sumW === 0) return 0;
  const result = sumVW / sumW;
  return isFinite(result) ? Math.round(result * 100) / 100 : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── Classificação de nível baseada em thresholds configuráveis ────────────────
function scoreToLevel(score, thresholds) {
  if (score === null || score === undefined || isNaN(score)) return 'N/A';
  const t = thresholds || DEFAULT_CONFIG.level_thresholds;
  if (score < t.critico)    return 'Crítico';
  if (score < t.basico)     return 'Básico';
  if (score < t.estruturado) return 'Estruturado';
  return 'Avançado';
}

// ── Carregamento de configuração metodológica ─────────────────────────────────
async function loadMethodologyConfig(base44, tenantId) {
  // 1. Busca config ativa específica do tenant
  const tenantConfigs = await base44.asServiceRole.entities.FalMethodologyConfig.filter(
    { tenant_id: tenantId, status: 'active' }, '-activated_at', 1
  );
  if (tenantConfigs.length > 0) {
    const c = tenantConfigs[0];
    return { ...DEFAULT_CONFIG, ...c, config_id: c.id, source: 'tenant' };
  }

  // 2. Fallback: config global ativa
  const globalConfigs = await base44.asServiceRole.entities.FalMethodologyConfig.filter(
    { tenant_id: 'global', status: 'active' }, '-activated_at', 1
  );
  if (globalConfigs.length > 0) {
    const c = globalConfigs[0];
    return { ...DEFAULT_CONFIG, ...c, config_id: c.id, source: 'global' };
  }

  // 3. Fallback final: configuração embutida
  return { ...DEFAULT_CONFIG, source: 'builtin' };
}

// ── Resolução de pesos de dimensão por tipo de alvo ───────────────────────────
function resolveDimensionWeight(cfg, dimKey, targetType) {
  // cfg.dimension_weights: { 'company': { 'governanca': 2 }, 'group': { 'governanca': 3 } }
  if (!cfg.dimension_weights) return 1;
  const byTarget = cfg.dimension_weights[targetType] || {};
  return safeNum(byTarget[dimKey], 1);
}

// ── Motor principal ───────────────────────────────────────────────────────────
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

    const body = await req.json();
    const assessment_id = body?.assessment_id;
    if (!assessment_id) return Response.json({ error: 'assessment_id required' }, { status: 400 });

    const assessment = await base44.asServiceRole.entities.Assessment.get(assessment_id);
    if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });

    if (!isHQAdmin(user)) {
      // Permitir acesso se o tenant bate OU se o usuário não tem tenant_id definido (consultores sem tenant)
      if (user.tenant_id && assessment.tenant_id !== user.tenant_id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // ── Carregar configuração metodológica ────────────────────────────────────
    const cfg = await loadMethodologyConfig(base44, assessment.tenant_id);
    const thresholds = cfg.level_thresholds || DEFAULT_CONFIG.level_thresholds;
    const targetType = assessment.target_type || 'company';

    console.log(`[computeFalDiagnostic] Engine ${ENGINE_VERSION} | Config: ${cfg.methodology_version} (${cfg.source}) | Target: ${targetType}`);

    // ── Dimensões ativas ──────────────────────────────────────────────────────
    // IMPORTANTE: respeitar EXCLUSIVAMENTE o active_dimensions salvo no assessment.
    // O filtro por applicability foi removido pois sobrescrevia o escopo definido
    // pelo consultor (ex: grupo Operacional com 8 dimensões).
    const ALL_DIM_KEYS = CANONICAL_DIMENSIONS.map(d => d.key);
    let activeDimSet = new Set(
      assessment.active_dimensions?.length
        ? assessment.active_dimensions.filter(d => ALL_DIM_KEYS.includes(d))
        : CANONICAL_DIMENSIONS.map(d => d.key)
    );

    // ── Question set ──────────────────────────────────────────────────────────
    let questionSet = assessment.question_set || [];
    if (questionSet.length === 0) {
      const buildRes = await base44.functions.invoke('buildFalQuestionSet', { assessment_id });
      questionSet = buildRes?.data?.question_set || [];
      if (questionSet.length === 0) {
        const updated = await base44.asServiceRole.entities.Assessment.get(assessment_id);
        questionSet = updated.question_set || [];
      }
      if (questionSet.length === 0) {
        return Response.json({ error: 'question_set vazio — nenhuma pergunta aplicável encontrada' }, { status: 400 });
      }
    }

    // ── Carregamento de dados ─────────────────────────────────────────────────
    // Busca perguntas apenas das dimensões ativas (evita CPU timeout)
    const activeDimsList = [...activeDimSet];
    const [questionBatches, allResponses] = await Promise.all([
      Promise.all(activeDimsList.map(dim =>
        base44.asServiceRole.entities.FalQuestion.filter({ dimension_key: dim }, 'sequence_order', 500)
      )),
      base44.asServiceRole.entities.FalResponse.filter({ assessment_id }),
    ]);
    const allQuestions = questionBatches.flat();

    // Indexação O(n)
    const questionMap = new Map();
    for (const q of allQuestions) questionMap.set(q.id, q);

    const responseByQuestionId = new Map();
    for (const r of allResponses) responseByQuestionId.set(r.fal_question_id, r);

    const setQuestions = questionSet.map(id => questionMap.get(id)).filter(Boolean);

    // Completude
    const answeredIds  = new Set(allResponses.map(r => r.fal_question_id));
    const unanswered   = questionSet.filter(id => !answeredIds.has(id));
    const completeness = questionSet.length > 0
      ? Math.round(((questionSet.length - unanswered.length) / questionSet.length) * 100)
      : 0;

    // ── Construção da árvore: dimensão → subdimensão → cluster → [perguntas] ──
    const dimTree = new Map();
    for (const q of setQuestions) {
      const dimKey = q.dimension_key || '_none';
      const subKey = q.subdimension_key || '_none';
      const cluKey = q.cluster_key || '_none';

      if (!dimTree.has(dimKey)) dimTree.set(dimKey, new Map());
      const subMap = dimTree.get(dimKey);
      if (!subMap.has(subKey)) subMap.set(subKey, new Map());
      const cluMap = subMap.get(subKey);
      if (!cluMap.has(cluKey)) cluMap.set(cluKey, []);
      cluMap.get(cluKey).push(q);
    }

    // ── Cálculo por dimensão ──────────────────────────────────────────────────
    const dimensionScores  = {};
    const penalties_applied = [];
    const rules_applied     = new Set();

    for (const dim of CANONICAL_DIMENSIONS) {
      if (!activeDimSet.has(dim.key)) {
        dimensionScores[dim.key] = {
          score: null, level: 'N/A', weight_sum: 0, response_count: 0,
          active: false, subdimension_scores: {}, cluster_scores: {},
        };
        continue;
      }

      const subMap = dimTree.get(dim.key);
      if (!subMap || subMap.size === 0) {
        dimensionScores[dim.key] = {
          score: 0, level: 'Crítico', weight_sum: 0, response_count: 0,
          active: true, subdimension_scores: {}, cluster_scores: {},
        };
        continue;
      }

      const subdimension_scores = {};
      const cluster_scores      = {}; // flat map: "subKey:cluKey" → score
      const dimSubItems         = []; // para média ponderada da dimensão
      let   dimResponseCount    = 0;

      // ── Nível: Subdimensão ────────────────────────────────────────────────
      for (const [subKey, cluMap] of subMap.entries()) {
        const subClusterItems = [];
        const subClusters     = {};
        let   subRespCount    = 0;

        // ── Nível: Cluster ────────────────────────────────────────────────
        for (const [cluKey, clusterQs] of cluMap.entries()) {
          const clusterItems = [];
          let   hasKillerFail = false;
          let   cluRespCount  = 0;

          for (const q of clusterQs) {
            const resp = responseByQuestionId.get(q.id);
            const w    = safeNum(q.question_weight, 1);

            if (resp !== undefined) {
              const s = safeNum(resp.score, 0);
              clusterItems.push({ value: s, weight: w });
              cluRespCount++;

              // Killer question
              if (
                cfg.killer_question_enabled &&
                q.is_killer_question === true &&
                s <= safeNum(cfg.killer_question_threshold, 2)
              ) {
                hasKillerFail = true;
              }
            }
          }

          // Cluster precisa do mínimo de perguntas respondidas
          const minQs = safeNum(cfg.cluster_min_questions_for_scoring, 1);
          if (cluRespCount < minQs) {
            // Cluster sem dados suficientes — não entra no cálculo
            continue;
          }

          let clusterScore = weightedAvg(clusterItems);

          // Aplicar killer question cap
          if (hasKillerFail) {
            const cap = safeNum(cfg.killer_question_cap, 2.0);
            if (clusterScore > cap) {
              rules_applied.add('killer_question_cap');
              penalties_applied.push({
                type: 'killer_question_cap',
                dimension_key: dim.key,
                cluster_key: cluKey,
                value: round2(clusterScore - cap),
                detail: `Cluster ${cluKey}: score ${round2(clusterScore)} → cap ${cap}`,
              });
              clusterScore = cap;
            }
          }

          clusterScore = round2(clusterScore);
          subRespCount    += cluRespCount;
          dimResponseCount += cluRespCount;

          subClusters[cluKey] = {
            score: clusterScore,
            level: scoreToLevel(clusterScore, thresholds),
            response_count: cluRespCount,
            total_questions: clusterQs.length,
            killer_capped: hasKillerFail,
          };

          cluster_scores[`${subKey}:${cluKey}`] = clusterScore;

          const totalClusterWeight = clusterQs.reduce((s, q) => s + safeNum(q.question_weight, 1), 0);
          subClusterItems.push({ value: clusterScore, weight: Math.max(totalClusterWeight, 1) });
        }

        if (subClusterItems.length === 0) continue;

        const subScore       = weightedAvg(subClusterItems);
        const subTotalWeight = subClusterItems.reduce((s, i) => s + i.weight, 0);

        subdimension_scores[subKey] = {
          score: subScore,
          level: scoreToLevel(subScore, thresholds),
          response_count: subRespCount,
          total_questions: setQuestions.filter(q => q.subdimension_key === subKey && q.dimension_key === dim.key).length,
          cluster_scores: subClusters,
        };

        dimSubItems.push({ value: subScore, weight: Math.max(subTotalWeight, 1) });
      }

      if (dimSubItems.length === 0) {
        dimensionScores[dim.key] = {
          score: 0, level: 'Crítico', weight_sum: 0, response_count: 0,
          active: true, subdimension_scores, cluster_scores,
        };
        continue;
      }

      let dimScore       = weightedAvg(dimSubItems);
      const dimTotalWeight = dimSubItems.reduce((s, i) => s + i.weight, 0);

      // ── Regra: Dominância de risco ────────────────────────────────────────
      const clusterScoreValues = Object.values(cluster_scores);
      if (cfg.risk_dominance_enabled && clusterScoreValues.length > 0) {
        const clusterMin = Math.min(...clusterScoreValues);
        const riskThreshold = safeNum(cfg.risk_dominance_cluster_threshold, 2.0);
        const dimCap        = safeNum(cfg.risk_dominance_dimension_cap, 2.5);

        if (clusterMin < riskThreshold && dimScore > dimCap) {
          rules_applied.add('risk_dominance_cap');
          penalties_applied.push({
            type: 'risk_dominance_cap',
            dimension_key: dim.key,
            cluster_key: null,
            value: round2(dimScore - dimCap),
            detail: `Dimensão ${dim.key}: cluster_min=${round2(clusterMin)} < ${riskThreshold} → cap ${dimCap} (score era ${round2(dimScore)})`,
          });
          dimScore = dimCap;
        }
      }

      // ── Regra: Penalidade por concentração de risco ───────────────────────
      if (cfg.concentration_penalty_enabled && clusterScoreValues.length > 0) {
        const penaltyThreshold = safeNum(cfg.concentration_penalty_cluster_threshold, 2.5);
        const minClusters      = safeNum(cfg.concentration_penalty_min_clusters, 3);
        const penaltyValue     = safeNum(cfg.concentration_penalty_value, 0.3);
        const clustersBelow    = clusterScoreValues.filter(s => s < penaltyThreshold).length;

        if (clustersBelow >= minClusters) {
          rules_applied.add('concentration_penalty');
          const actual = round2(Math.max(0, dimScore - penaltyValue));
          penalties_applied.push({
            type: 'concentration_penalty',
            dimension_key: dim.key,
            cluster_key: null,
            value: penaltyValue,
            detail: `Dimensão ${dim.key}: ${clustersBelow} clusters < ${penaltyThreshold} → -${penaltyValue} (${round2(dimScore)} → ${actual})`,
          });
          dimScore = actual;
        }
      }

      dimScore = round2(dimScore);

      dimensionScores[dim.key] = {
        score: dimScore,
        level: scoreToLevel(dimScore, thresholds),
        weight_sum: dimTotalWeight,
        response_count: dimResponseCount,
        active: true,
        subdimension_scores,
        cluster_scores,
      };
    }

    // ── Score geral ───────────────────────────────────────────────────────────
    const activeDims = CANONICAL_DIMENSIONS.filter(d => activeDimSet.has(d.key));

    let overallScore = 0;
    const dimensionWeightsUsed = {};

    if (cfg.overall_score_method === 'weighted_by_dimension') {
      // Ponderado pelos pesos de dimensão configurados por tipo de entidade
      rules_applied.add('weighted_by_dimension_score');
      const overallItems = activeDims.map(d => {
        const w = resolveDimensionWeight(cfg, d.key, targetType);
        dimensionWeightsUsed[d.key] = w;
        return { value: safeNum(dimensionScores[d.key]?.score, 0), weight: w };
      });
      overallScore = weightedAvg(overallItems);

    } else if (cfg.overall_score_method === 'weighted_by_questions') {
      // Ponderado pela quantidade de perguntas respondidas em cada dimensão
      rules_applied.add('weighted_by_questions_score');
      const overallItems = activeDims.map(d => {
        const w = safeNum(dimensionScores[d.key]?.response_count, 1);
        dimensionWeightsUsed[d.key] = w;
        return { value: safeNum(dimensionScores[d.key]?.score, 0), weight: w };
      });
      overallScore = weightedAvg(overallItems);

    } else {
      // simple_average (compatibilidade com engine 2.0)
      rules_applied.add('simple_average_score');
      const vals = activeDims.map(d => safeNum(dimensionScores[d.key]?.score, 0));
      overallScore = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      activeDims.forEach(d => { dimensionWeightsUsed[d.key] = 1; });
    }

    overallScore = round2(overallScore);
    const overallLevel   = scoreToLevel(overallScore, thresholds);
    const scoreMax       = safeNum(cfg.score_range_max, 3);
    const maturityIndex  = Math.round((overallScore / scoreMax) * 100);

    // ── Radar points ──────────────────────────────────────────────────────────
    const radarPoints = CANONICAL_DIMENSIONS.map(dim => ({
      axis: dim.axis,
      dimension: dim.key,
      score: activeDimSet.has(dim.key) ? safeNum(dimensionScores[dim.key]?.score, 0) : 0,
      level: dimensionScores[dim.key]?.level || 'N/A',
      active: activeDimSet.has(dim.key),
    }));

    // ── Resumo de risco por dimensão ──────────────────────────────────────────
    const dimensionRiskSummary = {};
    for (const dim of CANONICAL_DIMENSIONS) {
      const dimData = dimensionScores[dim.key];
      if (!dimData?.active || !dimData.cluster_scores) continue;

      let criticalKey   = null;
      let criticalScore = Infinity;
      for (const [compositeKey, score] of Object.entries(dimData.cluster_scores)) {
        if (typeof score === 'number' && score < criticalScore) {
          criticalScore = score;
          criticalKey   = compositeKey;
        }
      }

      const clusterKeyOnly = criticalKey ? criticalKey.split(':').pop() : null;
      dimensionRiskSummary[dim.key] = {
        dimension_score:              safeNum(dimData.score, 0),
        critical_cluster_key:         clusterKeyOnly,
        critical_cluster_composite:   criticalKey,
        critical_cluster_score:       criticalScore === Infinity ? null : round2(criticalScore),
      };
    }

    // ── Top 3 gaps ────────────────────────────────────────────────────────────
    const gapsTop = radarPoints
      .filter(p => p.active)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(p => ({ dimension: p.dimension, axis: p.axis, score: p.score, level: p.level }));

    // ── KPIs executivos ───────────────────────────────────────────────────────
    const criticalThreshold = safeNum(cfg.critical_cluster_threshold, 1.0);
    let criticalClustersCount = 0;
    let totalClustersCount    = 0;
    for (const dim of CANONICAL_DIMENSIONS) {
      const dimData = dimensionScores[dim.key];
      if (!dimData?.active || !dimData.cluster_scores) continue;
      for (const score of Object.values(dimData.cluster_scores)) {
        totalClustersCount++;
        if (typeof score === 'number' && score < criticalThreshold) criticalClustersCount++;
      }
    }

    // ── Evolução histórica ────────────────────────────────────────────────────
    let totalEvolution = null;
    if (assessment.target_type && assessment.target_id) {
      const allTargetAssessments = await base44.asServiceRole.entities.Assessment.filter({
        tenant_id: assessment.tenant_id,
        target_type: assessment.target_type,
        target_id: assessment.target_id,
      }, 'created_date', 100);

      if (allTargetAssessments.length > 1) {
        const firstAssessment = allTargetAssessments[0];
        if (firstAssessment.id !== assessment_id) {
          const firstSnaps = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
            { assessment_id: firstAssessment.id }, '-computed_at', 1
          );
          const firstSnap = firstSnaps[0];
          if (firstSnap && firstSnap.overall_score != null) {
            totalEvolution = round2(overallScore - safeNum(firstSnap.overall_score));
          }
        }
      }
    }

    // ── Taxa de execução do plano de ação ─────────────────────────────────────
    let actionExecutionRate = null;
    const actionPlans = await base44.asServiceRole.entities.ActionPlan.filter({ assessment_id }, '-created_date', 1);
    if (actionPlans.length > 0) {
      const tasks = await base44.asServiceRole.entities.ActionTask.filter({ assessment_id });
      if (tasks.length > 0) {
        const done = tasks.filter(t => t.status === 'done').length;
        actionExecutionRate = Math.round((done / tasks.length) * 100);
      }
    }

    // ── Potencial de impacto ──────────────────────────────────────────────────
    let impactPotential = null;
    const simulations = await base44.asServiceRole.entities.FalImpactSimulation.filter({ assessment_id }, '-created_at', 1);
    if (simulations.length > 0 && simulations[0].delta_score != null) {
      impactPotential = round2(simulations[0].delta_score);
    }

    // ── Value Lever Map ───────────────────────────────────────────────────────
    const VALUE_LEVERS = ['geracao_caixa', 'preservacao_margem', 'reducao_risco', 'eficiencia_operacional', 'protecao_patrimonial'];
    let valueLeverSummary = null;
    try {
      const leverLinks = await base44.asServiceRole.entities.FalClusterValueLever.list();
      if (leverLinks && leverLinks.length > 0) {
        const leverByCluster = new Map();
        for (const link of leverLinks) {
          if (!leverByCluster.has(link.cluster_key)) leverByCluster.set(link.cluster_key, []);
          leverByCluster.get(link.cluster_key).push({ lever: link.value_lever_key, weight: link.impact_weight || 1 });
        }

        const leverAccum = {};
        for (const lev of VALUE_LEVERS) leverAccum[lev] = { total_potential: 0, cluster_contributions: [] };

        for (const dim of CANONICAL_DIMENSIONS) {
          const dimData = dimensionScores[dim.key];
          if (!dimData?.active || !dimData.subdimension_scores) continue;

          for (const [subKey, subData] of Object.entries(dimData.subdimension_scores)) {
            if (!subData.cluster_scores) continue;
            for (const [cluKey, cluData] of Object.entries(subData.cluster_scores)) {
              const score = safeNum(cluData.score, 0);
              const level = cluData.level || 'Básico';
              const priorityFactor = level === 'Crítico' ? 1.5 : level === 'Básico' ? 1.3 : level === 'Estruturado' ? 1.1 : 1.0;
              const maturityGap = Math.max(0, scoreMax - score);

              const links = leverByCluster.get(cluKey) || [];
              for (const { lever, weight } of links) {
                if (!leverAccum[lever]) continue;
                const potential = maturityGap * weight * priorityFactor;
                leverAccum[lever].total_potential += potential;
                leverAccum[lever].cluster_contributions.push({
                  cluster_key: cluKey, subdimension_key: subKey, dimension_key: dim.key,
                  score, level, impact_weight: weight, potential,
                });
              }
            }
          }
        }

        valueLeverSummary = {};
        for (const lev of VALUE_LEVERS) {
          const acc = leverAccum[lev];
          valueLeverSummary[lev] = {
            total_potential: round2(acc.total_potential),
            top_clusters: [...acc.cluster_contributions]
              .sort((a, b) => b.potential - a.potential)
              .slice(0, 5)
              .map(c => ({ cluster_key: c.cluster_key, dimension_key: c.dimension_key, score: c.score, potential: round2(c.potential) })),
          };
        }
      }
    } catch (_e) {
      console.warn('[computeFalDiagnostic] value lever calc failed:', _e.message);
    }

    // ── Log metodológico ──────────────────────────────────────────────────────
    const methodology_log = {
      methodology_version:   cfg.methodology_version,
      config_id:             cfg.config_id || 'builtin',
      config_source:         cfg.source || 'builtin',
      engine_version:        ENGINE_VERSION,
      overall_score_method:  cfg.overall_score_method,
      rules_applied:         [...rules_applied],
      penalties_applied,
      dimension_weights_used: dimensionWeightsUsed,
      thresholds_used:        thresholds,
    };

    // ── Salvar snapshot ───────────────────────────────────────────────────────
    const snapshot = {
      tenant_id:               assessment.tenant_id,
      assessment_id,
      cycle_id:                assessment.cycle_id    || null,
      target_type:             assessment.target_type || null,
      target_id:               assessment.target_id   || null,
      computed_at:             new Date().toISOString(),
      computed_by:             user.email,
      question_set:            questionSet,
      dimension_scores:        dimensionScores,
      overall_score:           overallScore,
      overall_level:           overallLevel,
      radar_points:            radarPoints,
      gaps_top:                gapsTop,
      sector_snapshot:         assessment.sector_snapshot || [],
      active_dimensions:       [...activeDimSet],
      dimension_risk_summary:  dimensionRiskSummary,
      maturity_index:          maturityIndex,
      total_evolution:         totalEvolution,
      critical_clusters_count: criticalClustersCount,
      total_clusters_count:    totalClustersCount,
      action_execution_rate:   actionExecutionRate,
      impact_potential:        impactPotential,
      value_lever_summary:     valueLeverSummary,
      methodology_log,
    };

    const saved = await base44.asServiceRole.entities.FalDiagnosticSnapshot.create(snapshot);

    // ── Atualizar AssessmentFlowState ─────────────────────────────────────────
    try {
      const flowRecords = await base44.asServiceRole.entities.AssessmentFlowState.filter(
        { assessment_id }, '-created_date', 1
      );
      const flowPayload = {
        diagnostic_status: 'done',
        diagnostic_generated_at: snapshot.computed_at,
        snapshot_id: saved.id,
        source_response_version: assessment.current_response_version || 0,
        stale_from_step: null,
        updated_by: user.email,
      };
      if (flowRecords.length > 0) {
        await base44.asServiceRole.entities.AssessmentFlowState.update(flowRecords[0].id, flowPayload);
      } else {
        await base44.asServiceRole.entities.AssessmentFlowState.create({
          tenant_id: assessment.tenant_id,
          assessment_id,
          ...flowPayload,
        });
      }
    } catch (flowErr) {
      console.warn('[computeFalDiagnostic] flow state update failed:', flowErr.message);
    }

    await base44.asServiceRole.entities.AuditLog.create({
      tenant_id:         assessment.tenant_id,
      user_email:        user.email,
      action:            'fal_diagnostic_computed',
      entity_type:       'FalDiagnosticSnapshot',
      entity_id:         saved.id,
      details: {
        overall_score:         overallScore,
        overall_level:         overallLevel,
        completeness,
        gaps:                  gapsTop.map(g => g.dimension),
        engine_version:        ENGINE_VERSION,
        methodology_version:   cfg.methodology_version,
        penalties_count:       penalties_applied.length,
        rules_applied:         [...rules_applied],
      },
    });

    console.log(`[computeFalDiagnostic] Done — score=${overallScore} level=${overallLevel} completeness=${completeness}% penalties=${penalties_applied.length}`);

    return Response.json({
      ...snapshot,
      id:                 saved.id,
      completeness_pct:   completeness,
      unanswered_count:   unanswered.length,
    });

  } catch (error) {
    console.error('[computeFalDiagnostic] Error:', error);
    return Response.json({
      success:      false,
      error_code:   'PROCESSING_ERROR',
      message:      'Erro ao processar diagnóstico',
      suggestion:   'Tente novamente em alguns segundos',
      detail:       error.message,
    }, { status: 500 });
  }
});