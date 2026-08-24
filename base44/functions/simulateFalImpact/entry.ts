/**
 * simulateFalImpact
 *
 * Gera 3 cenários de simulação de melhoria para um assessment FAL.
 * Usa o FalDiagnosticSnapshot mais recente como base.
 * Salva cada cenário em FalImpactSimulation.
 *
 * Payload: { assessment_id, benchmark_group? }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function improvementDelta(priorityLevel) {
  const map = { 'CRÍTICA': 2.0, 'ALTA': 1.5, 'MÉDIA': 1.0, 'BAIXA': 0.5 };
  return map[priorityLevel] ?? 0.5;
}

function classifyImpactIndex(idx) {
  if (idx >= 4)   return 'ALTO';
  if (idx >= 2.5) return 'MÉDIO';
  return 'BAIXO';
}

function impactIndexFromWeights(fw, ow, rw) {
  return fw * 0.5 + ow * 0.3 + rw * 0.2;
}

function weightedAvg(items) {
  if (!items.length) return 0;
  const sum = items.reduce((a, b) => a + b, 0);
  return sum / items.length;
}

/**
 * Recalcula scores de dimension/subdimension/overall a partir das mudanças de cluster.
 * clusterOverrides: { 'subdim:cluster': newScore }
 */
function recomputeScores(dimScores, clusterOverrides) {
  const result = {};
  let overallScores = [];

  for (const [dimKey, dimData] of Object.entries(dimScores)) {
    if (!dimData.active) {
      result[dimKey] = { current: dimData.score, simulated: dimData.score, delta: 0 };
      continue;
    }

    const subdims = dimData.subdimension_scores || {};
    let dimClusterScores = [];

    for (const [subKey, subData] of Object.entries(subdims)) {
      const clusters = subData.cluster_scores || {};
      for (const [cKey, cInfo] of Object.entries(clusters)) {
        const overrideKey = `${subKey}:${cKey}`;
        const currentScore = typeof cInfo === 'object' ? cInfo.score : cInfo;
        const simulatedScore = clusterOverrides[overrideKey] !== undefined
          ? clusterOverrides[overrideKey]
          : currentScore;
        if (simulatedScore !== null && simulatedScore !== undefined) {
          dimClusterScores.push(simulatedScore);
        }
      }
    }

    const currentDimScore = dimData.score ?? 0;
    const simulatedDimScore = dimClusterScores.length > 0
      ? Math.min(3, weightedAvg(dimClusterScores))
      : currentDimScore;

    result[dimKey] = {
      current: Math.round(currentDimScore * 100) / 100,
      simulated: Math.round(simulatedDimScore * 100) / 100,
      delta: Math.round((simulatedDimScore - currentDimScore) * 100) / 100,
    };

    if (dimData.active) overallScores.push(simulatedDimScore);
  }

  return result;
}

// ── main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // SEG-03: Role guard — deny client_viewer from triggering simulation mutations
    const WRITE_ROLES = ['hq_admin', 'tenant_admin', 'consultant'];
    if (!WRITE_ROLES.includes(appRole)) {
      return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
    }

    const { assessment_id } = await req.json();
    if (!assessment_id) return Response.json({ error: 'assessment_id required' }, { status: 400 });

    // Buscar assessment e snapshot
    const snapshots = await base44.entities.FalDiagnosticSnapshot.filter(
      { assessment_id }, '-computed_at', 1
    );
    if (!snapshots.length) return Response.json({ error: 'No snapshot found' }, { status: 404 });
    const snap = snapshots[0];

    const assessment = await base44.entities.Assessment.filter({ id: assessment_id });
    const tenantId = assessment[0]?.tenant_id || snap.tenant_id;

    // ── SEG-02 Tenant Guard: deny-by-default ──────────────────────────────────
    if (!isHQ) {
      if (!user.tenant_id || tenantId !== user.tenant_id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const dimScores = snap.dimension_scores || {};
    const clusterPriorityMap = snap.cluster_priority || {};
    const clusterAnalysis = snap.cluster_analysis || {};

    // Carregar impactos de cluster
    const allImpacts = await base44.asServiceRole.entities.FalClusterImpact.list();
    const impactByCluster = {};
    for (const imp of allImpacts) impactByCluster[imp.cluster_key] = imp;

    // Construir lista de todos os clusters com score e prioridade
    const allClusters = [];
    for (const [dimKey, dimData] of Object.entries(dimScores)) {
      if (!dimData.active) continue;
      for (const [subKey, subData] of Object.entries(dimData.subdimension_scores || {})) {
        for (const [cKey, cInfo] of Object.entries(subData.cluster_scores || {})) {
          const score = typeof cInfo === 'object' ? cInfo.score : cInfo;
          if (score === null || score === undefined) continue;

          const priorityKey = `${subKey}:${cKey}`;
          const pData = clusterPriorityMap[priorityKey] || {};
          const intel = clusterAnalysis[priorityKey] || {};
          const impact = impactByCluster[cKey];

          const fw = impact?.impact_financial_weight ?? 3;
          const ow = impact?.impact_operational_weight ?? 3;
          const rw = impact?.impact_risk_weight ?? 3;
          const impactIdx = impactIndexFromWeights(fw, ow, rw);
          const priorityLevel = pData.priority_level || intel.priority_level || 'BAIXA';

          allClusters.push({
            cluster_key: cKey,
            subdimension_key: subKey,
            dimension_key: dimKey,
            priority_key: priorityKey,
            score,
            priority_level: priorityLevel,
            priority_index: pData.priority_index || intel.priority_index || 0,
            impact_index: impactIdx,
            fw, ow, rw,
          });
        }
      }
    }

    // Ordenar por priority_index desc
    allClusters.sort((a, b) => b.priority_index - a.priority_index);

    const currentOverall = snap.overall_score ?? 0;

    // ── Gerar cenários ─────────────────────────────────────────────────────────
    const SCENARIOS = [
      { label: 'Cenário 1 — Top 3 clusters críticos', key: 'cenario_1', count: 3 },
      { label: 'Cenário 2 — Top 5 clusters críticos', key: 'cenario_2', count: 5 },
      { label: 'Cenário 3 — Top 10 clusters prioritários', key: 'cenario_3', count: 10 },
    ];

    // Apagar simulações antigas para este assessment
    const oldSims = await base44.entities.FalImpactSimulation.filter({ assessment_id });
    for (const old of oldSims) {
      await base44.entities.FalImpactSimulation.delete(old.id);
    }

    const simResults = [];

    for (const scenario of SCENARIOS) {
      const selected = allClusters.slice(0, scenario.count);
      const clusterOverrides = {};
      const clusterDetails = {};
      let totalFw = 0, totalOw = 0, totalRw = 0;

      for (const c of selected) {
        const delta = improvementDelta(c.priority_level);
        const simulatedScore = Math.min(3, c.score + delta);
        clusterOverrides[c.priority_key] = simulatedScore;
        clusterDetails[c.cluster_key] = {
          dimension: c.dimension_key,
          subdimension: c.subdimension_key,
          priority_level: c.priority_level,
          current_score: Math.round(c.score * 100) / 100,
          simulated_score: Math.round(simulatedScore * 100) / 100,
          delta: Math.round((simulatedScore - c.score) * 100) / 100,
          impact_index: Math.round(c.impact_index * 100) / 100,
        };
        totalFw += c.fw;
        totalOw += c.ow;
        totalRw += c.rw;
      }

      // Recalcular scores por dimensão
      const dimResults = recomputeScores(dimScores, clusterOverrides);

      // Score geral simulado = média das dimensões ativas simuladas
      const activeDimScores = Object.values(dimResults)
        .filter((_, i) => {
          const dimKey = Object.keys(dimResults)[i];
          return dimScores[dimKey]?.active;
        })
        .map(d => d.simulated);
      const simulatedOverall = activeDimScores.length
        ? Math.min(3, weightedAvg(activeDimScores))
        : currentOverall;

      // Impacto agregado
      const n = selected.length || 1;
      const avgFw = totalFw / n;
      const avgOw = totalOw / n;
      const avgRw = totalRw / n;
      const aggImpactIdx = impactIndexFromWeights(avgFw, avgOw, avgRw);

      const simDoc = {
        tenant_id: tenantId,
        assessment_id,
        snapshot_id: snap.id,
        simulation_label: scenario.label,
        scenario: scenario.key,
        clusters_simulated: selected.map(c => c.cluster_key),
        current_overall_score: Math.round(currentOverall * 100) / 100,
        simulated_overall_score: Math.round(simulatedOverall * 100) / 100,
        delta_score: Math.round((simulatedOverall - currentOverall) * 100) / 100,
        expected_dimension_scores: dimResults,
        estimated_financial_impact: classifyImpactIndex(avgFw * 0.7 + avgRw * 0.3),
        estimated_risk_reduction: classifyImpactIndex(avgRw),
        estimated_operational_gain: classifyImpactIndex(avgOw),
        impact_index: Math.round(aggImpactIdx * 100) / 100,
        cluster_details: clusterDetails,
        created_at: new Date().toISOString(),
      };

      const saved = await base44.entities.FalImpactSimulation.create(simDoc);
      simResults.push({ ...simDoc, id: saved.id });
    }

    // Salvar referência no snapshot
    await base44.entities.FalDiagnosticSnapshot.update(snap.id, {
      simulation_computed_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, scenarios: simResults });
  } catch (e) {
    console.error('[simulateFalImpact]', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
});