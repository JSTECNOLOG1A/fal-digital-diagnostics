/**
 * buildReportPayload — Montagem de payload canônico
 * Scope-first, cycle-first, com filtros de profundidade conforme mode
 */
import { base44 } from '@/api/base44Client';
import { getDepthConfig, getReportTitle } from './reportTypes';
import { resolveReportContext, validateReportGenerationPermission } from './reportContext';

export async function buildReportPayload({
  reportScope,
  reportMode,
  cycleId,
  groupId,
  companyId,
  unitId,
  tenantId,
}) {
  // Etapa 1: Resolver contexto
  const context = await resolveReportContext({
    reportScope,
    reportMode,
    cycleId,
    groupId,
    companyId,
    unitId,
  });

  // Etapa 2: Validar permissão
  validateReportGenerationPermission(context, reportScope, reportMode);

  // Etapa 3: Puxar configuração de profundidade
  const depthConfig = getDepthConfig(reportScope, reportMode);

  // Etapa 4: Montar payload base
  const payload = {
    meta: {
      reportScope,
      reportMode,
      cycleId,
      generatedAt: new Date().toISOString(),
      templateVersion: '1.0',
    },

    context,

    coverage: context.coverage || null,
    isPartialCoverage: context.is_partial || false,

    headline: {
      title: getReportTitle(reportScope, reportMode, context.group?.name || context.company?.name || context.unit?.name),
      subtitle: null,
      overallScore: null,
      overallLevel: null,
      previousScore: null,
      deltaScore: null,
      executiveSummary: null,
    },

    dimensions: [],
    clusters: [],
    priorities: [],
    actionPlan: [],
    comparison: null,
    appendices: null,
  };

  // Etapa 5: Carregar dados conforme escopo
  if (reportScope === 'group') {
    await loadGroupData(payload, context, depthConfig, reportMode);
  } else if (reportScope === 'company') {
    await loadCompanyData(payload, context, depthConfig);
  } else if (reportScope === 'unit') {
    await loadUnitData(payload, context, depthConfig);
  }

  return payload;
}

/**
 * Carrega dados para relatório de GRUPO
 */
async function loadGroupData(payload, context, depthConfig, reportMode) {
  const { group, cycle } = context;

  // Puxar snapshot consolidado do grupo para este ciclo
  const groupSnapshots = await base44.entities.FalDiagnosticSnapshot.filter({
    assessment_id: null,
    level_type: 'group',
    level_id: group.id,
    cycle_id: cycle.id,
  }, '-computed_at', 1);

  // Fallback: FalAggregateSnapshot (fonte principal para relatório de grupo)
  const aggSnapshots = await base44.entities.FalAggregateSnapshot.filter({
    level_type: 'group',
    level_id: group.id,
    cycle_id: cycle.id,
  }, '-computed_at', 1);

  const groupSnap = groupSnapshots[0] || null;
  const aggSnap = aggSnapshots[0] || null;
  const snap = aggSnap || groupSnap; // preferir aggregate

  if (snap) {
    payload.headline.overallScore = snap.overall_score;
    payload.headline.overallLevel = snap.overall_level;

    // Delta com ciclo anterior
    if (cycle.parent_cycle_id) {
      const prevAgg = await base44.entities.FalAggregateSnapshot.filter({
        level_type: 'group',
        level_id: group.id,
        cycle_id: cycle.parent_cycle_id,
      }, '-computed_at', 1);
      const prevSnap = prevAgg[0] || null;
      if (prevSnap && snap.overall_score != null && prevSnap.overall_score != null) {
        payload.headline.previousScore = prevSnap.overall_score;
        payload.headline.deltaScore = snap.overall_score - prevSnap.overall_score;
      }
    }

    // Dimensões do snapshot
    const dimSource = snap.dimension_scores || groupSnap?.dimension_scores;
    if (dimSource && typeof dimSource === 'object') {
      payload.dimensions = Object.entries(dimSource).map(([key, data]) => ({
        key,
        name: data.name || key.replace(/_/g, ' '),
        score: data.score,
        level: data.level,
        active: data.active,
      }));
    }

    // Clusters críticos
    if (reportMode === 'executive' && groupSnap?.clusters_criticos) {
      payload.clusters = (groupSnap.clusters_criticos || []).slice(0, depthConfig.maxEntitiesDetailPerCategory);
    } else if (reportMode === 'full_scope' && groupSnap?.cluster_analysis) {
      payload.clusters = Object.values(groupSnap.cluster_analysis || {}).slice(0, depthConfig.maxEntitiesDetailPerCategory);
    }
  }

  // ── DISPERSÃO: scores por empresa ──────────────────────────────────────────
  const companies = await base44.entities.Company.filter({ group_id: group.id });
  const activeCompanies = companies.filter(c => !c.is_archived);

  const companyAggSnaps = await base44.entities.FalAggregateSnapshot.filter({
    level_type: 'company',
    cycle_id: cycle.id,
  }, '-computed_at', 200);

  // Indexar por company_id (campo level_id no snapshot)
  const snapByCompany = {};
  companyAggSnaps.forEach(s => {
    const cid = s.company_id || s.level_id;
    if (cid && !snapByCompany[cid]) snapByCompany[cid] = s;
  });

  const assessedCompanies = activeCompanies
    .map(c => ({
      id: c.id,
      name: c.name,
      sector: c.sector || null,
      score: snapByCompany[c.id]?.overall_score ?? null,
      level: snapByCompany[c.id]?.overall_level ?? null,
    }))
    .filter(c => c.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const notAssessed = activeCompanies.filter(c => !snapByCompany[c.id]).map(c => ({ id: c.id, name: c.name }));

  // Calcular métricas de dispersão
  let dispersion = null;
  if (assessedCompanies.length >= 2) {
    const scores = assessedCompanies.map(c => c.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
    const std = Math.sqrt(variance);
    const gap = max - min;

    // Classificação do risco de dispersão
    let dispersion_risk = 'baixo';
    if (gap >= 1.5 || std >= 0.6) dispersion_risk = 'crítico';
    else if (gap >= 0.8 || std >= 0.35) dispersion_risk = 'alto';
    else if (gap >= 0.4 || std >= 0.2) dispersion_risk = 'moderado';

    const best = assessedCompanies[0];
    const worst = assessedCompanies[assessedCompanies.length - 1];

    dispersion = {
      assessed_count: assessedCompanies.length,
      total_count: activeCompanies.length,
      not_assessed: notAssessed,
      companies: assessedCompanies,
      min: parseFloat(min.toFixed(2)),
      max: parseFloat(max.toFixed(2)),
      mean: parseFloat(mean.toFixed(2)),
      std: parseFloat(std.toFixed(2)),
      gap: parseFloat(gap.toFixed(2)),
      dispersion_risk,
      best_company: { id: best.id, name: best.name, score: best.score, level: best.level },
      worst_company: { id: worst.id, name: worst.name, score: worst.score, level: worst.level },
    };
  }

  payload.dispersion = dispersion;

  // Carregar plano de ação do grupo
  const actionPlans = await base44.entities.ActionPlan.filter({
    group_id: group.id,
    cycle_id: cycle.id,
  }, '-created_date', 1);

  if (actionPlans.length > 0) {
    const plan = actionPlans[0];
    const tasks = await base44.entities.ActionTask.filter({
      plan_id: plan.id,
    }, '-priority_score', reportMode === 'executive' ? 10 : 999);

    payload.actionPlan = {
      planId: plan.id,
      totalTasks: tasks.length,
      strategicTasks: tasks.filter(t => t.task_layer !== 'operational').length,
      operationalTasks: tasks.filter(t => t.task_layer === 'operational').length,
      tasks: tasks,
    };
  }

  // Carregar MFIS se full_scope
  if (reportMode === 'full_scope') {
    const crossingAnalysis = await base44.entities.SystemicCrossingAnalysis.filter({
      assessment_id: null,
      cycle_id: cycle.id,
    }, '-tension_rank', 10);

    payload.mfis = {
      crossings: crossingAnalysis,
      totalCrossings: crossingAnalysis.length,
    };
  }
}

/**
 * Carrega dados para relatório de EMPRESA
 */
async function loadCompanyData(payload, context, depthConfig) {
  const { company, group, cycle } = context;

  // Snapshot da empresa
  const companySnapshots = await base44.entities.FalDiagnosticSnapshot.filter({
    level_type: 'company',
    level_id: company.id,
    cycle_id: cycle.id,
  }, '-computed_at', 1);

  const companySnap = companySnapshots[0] || null;

  if (companySnap) {
    payload.headline.overallScore = companySnap.overall_score;
    payload.headline.overallLevel = companySnap.overall_level;

    if (companySnap.dimension_scores) {
      payload.dimensions = Object.entries(companySnap.dimension_scores).map(([key, data]) => ({
        key,
        name: data.name || key,
        score: data.score,
        level: data.level,
      }));
    }

    if (companySnap.cluster_analysis) {
      payload.clusters = Object.values(companySnap.cluster_analysis || {}).slice(0, depthConfig.maxEntitiesDetailPerCategory);
    }
  }

  // Comparação com grupo
  if (group) {
    const groupSnapshots = await base44.entities.FalDiagnosticSnapshot.filter({
      level_type: 'group',
      level_id: group.id,
      cycle_id: cycle.id,
    }, '-computed_at', 1);

    const groupSnap = groupSnapshots[0];
    if (groupSnap) {
      payload.comparison = {
        groupScore: groupSnap.overall_score,
        companyScore: companySnap?.overall_score,
        groupLevel: groupSnap.overall_level,
        companyLevel: companySnap?.overall_level,
        delta: companySnap?.overall_score != null && groupSnap.overall_score != null
          ? companySnap.overall_score - groupSnap.overall_score
          : null,
      };
    }
  }

  // Plano da empresa
  const actionPlans = await base44.entities.ActionPlan.filter({
    company_id: company.id,
    cycle_id: cycle.id,
  }, '-created_date', 1);

  if (actionPlans.length > 0) {
    const plan = actionPlans[0];
    const tasks = await base44.entities.ActionTask.filter({
      plan_id: plan.id,
    }, '-priority_score', 999);

    payload.actionPlan = {
      planId: plan.id,
      totalTasks: tasks.length,
      tasks: tasks.slice(0, depthConfig.maxEntitiesDetailPerCategory),
    };
  }
}

/**
 * Carrega dados para relatório de UNIDADE
 */
async function loadUnitData(payload, context, depthConfig) {
  const { unit, company, cycle } = context;

  // Snapshot da unidade
  const unitSnapshots = await base44.entities.FalDiagnosticSnapshot.filter({
    level_type: 'unit',
    level_id: unit.id,
    cycle_id: cycle.id,
  }, '-computed_at', 1);

  const unitSnap = unitSnapshots[0] || null;

  if (unitSnap) {
    payload.headline.overallScore = unitSnap.overall_score;
    payload.headline.overallLevel = unitSnap.overall_level;

    if (unitSnap.dimension_scores) {
      payload.dimensions = Object.entries(unitSnap.dimension_scores).map(([key, data]) => ({
        key,
        name: data.name || key,
        score: data.score,
        level: data.level,
      }));
    }

    // Críticos/fragilidades
    if (unitSnap.gaps_top) {
      payload.clusters = unitSnap.gaps_top.slice(0, depthConfig.maxEntitiesDetailPerCategory);
    }
  }

  // Comparação com empresa pai
  if (company) {
    const companySnapshots = await base44.entities.FalDiagnosticSnapshot.filter({
      level_type: 'company',
      level_id: company.id,
      cycle_id: cycle.id,
    }, '-computed_at', 1);

    const companySnap = companySnapshots[0];
    if (companySnap) {
      payload.comparison = {
        companyScore: companySnap.overall_score,
        unitScore: unitSnap?.overall_score,
        companyLevel: companySnap.overall_level,
        unitLevel: unitSnap?.overall_level,
        delta: unitSnap?.overall_score != null && companySnap.overall_score != null
          ? unitSnap.overall_score - companySnap.overall_score
          : null,
      };
    }
  }

  // Ações operacionais
  const actionPlans = await base44.entities.ActionPlan.filter({
    unit_id: unit.id,
    cycle_id: cycle.id,
  }, '-created_date', 1);

  if (actionPlans.length > 0) {
    const plan = actionPlans[0];
    const tasks = await base44.entities.ActionTask.filter({
      plan_id: plan.id,
      task_layer: 'operational',
    }, '-priority_score', 999);

    payload.actionPlan = {
      planId: plan.id,
      totalTasks: tasks.length,
      tasks: tasks.slice(0, depthConfig.maxEntitiesDetailPerCategory),
    };
  }
}