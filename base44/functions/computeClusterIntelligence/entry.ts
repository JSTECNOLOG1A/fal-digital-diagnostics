/**
 * computeClusterIntelligence
 *
 * Motor de Diagnóstico Inteligente FAL.
 * Para cada cluster do snapshot, calcula:
 *  - root_causes (top 3)
 *  - benchmark_position (vs avg, p75, p90)
 *  - recommendations (ordenadas por impacto/complexidade)
 *
 * Salva cluster_analysis no FalDiagnosticSnapshot.
 *
 * Payload: { assessment_id, benchmark_group? }
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

function benchmarkPosition(score, bm) {
  if (!bm) return { position: 'sem_benchmark', label: 'Sem dados de benchmark' };
  if (score >= bm.p90_score) return { position: 'top10',    label: 'Top 10% do mercado',       icon: '🏆' };
  if (score >= bm.p75_score) return { position: 'acima',    label: 'Acima da média do mercado', icon: '✅' };
  if (score >= bm.avg_score) return { position: 'medio',    label: 'Na média do mercado',       icon: '⚠️' };
  return                            { position: 'abaixo',   label: 'Abaixo da média do mercado',icon: '🔴' };
}

function selectRecommendations(recs, priorityLevel) {
  const count = priorityLevel === 'CRÍTICA' ? 3 : priorityLevel === 'ALTA' ? 2 : 1;
  return recs
    .sort((a, b) => (b.impact_level - a.impact_level) || (a.implementation_complexity - b.implementation_complexity))
    .slice(0, count);
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

    const { assessment_id, benchmark_group = 'agronegocio' } = await req.json();
    if (!assessment_id) return Response.json({ error: 'assessment_id required' }, { status: 400 });

    // Validar tenant access via assessment
    const assessment = await base44.asServiceRole.entities.Assessment.get(assessment_id);
    if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });

    if (!isHQ && user.tenant_id && assessment.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar snapshot mais recente
    const snapshots = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
      { assessment_id }, '-computed_at', 1
    );
    if (!snapshots.length) return Response.json({ error: 'No FalDiagnosticSnapshot' }, { status: 404 });
    const snap = snapshots[0];

    // Carregar dados de inteligência em paralelo
    const [allCauses, allRecs, allBenches] = await Promise.all([
      base44.asServiceRole.entities.FalClusterCause.list(),
      base44.asServiceRole.entities.FalClusterRecommendation.list(),
      base44.asServiceRole.entities.FalBenchmark.list(),
    ]);

    // Indexar por cluster_key
    const causesByCluster = {};
    for (const c of allCauses) {
      if (!causesByCluster[c.cluster_key]) causesByCluster[c.cluster_key] = [];
      causesByCluster[c.cluster_key].push(c);
    }
    const recsByCluster = {};
    for (const r of allRecs) {
      if (!recsByCluster[r.cluster_key]) recsByCluster[r.cluster_key] = [];
      recsByCluster[r.cluster_key].push(r);
    }
    const benchByCluster = {};
    for (const b of allBenches) {
      const key = `${b.cluster_key}:${b.benchmark_group}`;
      benchByCluster[key] = b;
    }

    // Obter priority map (se já computado)
    const clusterPriorityMap = snap.cluster_priority || {};

    // ── Processar cada cluster do snapshot ──
    const clusterAnalysis = {};
    const dimScores = snap.dimension_scores || {};

    for (const [dimKey, dimData] of Object.entries(dimScores)) {
      if (!dimData.active || dimData.score === null) continue;
      const subdimScores = dimData.subdimension_scores || {};

      for (const [subKey, subData] of Object.entries(subdimScores)) {
        const clusterScores = subData.cluster_scores || {};

        for (const [clusterName, clusterInfo] of Object.entries(clusterScores)) {
          const clusterScore = typeof clusterInfo === 'object' ? clusterInfo.score : clusterInfo;
          if (clusterScore === null || clusterScore === undefined) continue;

          const priorityKey = `${subKey}:${clusterName}`;
          const priorityData = clusterPriorityMap[priorityKey] || {};
          const priorityLevel = priorityData.priority_level || 'BAIXA';

          // ROOT CAUSES (score < 2.0)
          let rootCauses = [];
          if (clusterScore < 2.0) {
            const causes = (causesByCluster[clusterName] || [])
              .filter(c => clusterScore < (c.trigger_score_below ?? 2.0))
              .sort((a, b) => (b.probability_weight || 1) - (a.probability_weight || 1))
              .slice(0, 3)
              .map(c => ({
                cause_key: c.cause_key,
                cause_description: c.cause_description,
                probability: c.probability_weight >= 5 ? 'Alta' : c.probability_weight >= 3 ? 'Média' : 'Baixa',
                probability_weight: c.probability_weight,
              }));
            rootCauses = causes;
          }

          // BENCHMARK
          const bmKey = `${clusterName}:${benchmark_group}`;
          const bmKeyFallback = `${clusterName}:geral`;
          const bm = benchByCluster[bmKey] || benchByCluster[bmKeyFallback] || null;
          const bmPosition = benchmarkPosition(clusterScore, bm);
          const benchmarkInfo = bm ? {
            ...bmPosition,
            avg_score: bm.avg_score,
            p75_score: bm.p75_score,
            p90_score: bm.p90_score,
            gap_to_avg: Math.round((bm.avg_score - clusterScore) * 100) / 100,
            gap_to_p75: Math.round((bm.p75_score - clusterScore) * 100) / 100,
            benchmark_group,
            sample_size: bm.sample_size,
          } : { position: 'sem_benchmark', label: 'Sem dados de benchmark' };

          // RECOMMENDATIONS
          const recs = recsByCluster[clusterName] || [];
          const selectedRecs = selectRecommendations(recs, priorityLevel).map(r => ({
            recommendation_key: r.recommendation_key,
            recommendation_text: r.recommendation_text,
            impact_level: r.impact_level,
            implementation_complexity: r.implementation_complexity,
            estimated_time: r.estimated_time,
          }));

          clusterAnalysis[priorityKey] = {
            dimension: dimKey,
            subdimension: subKey,
            cluster: clusterName,
            score: clusterScore,
            priority_level: priorityLevel,
            priority_index: priorityData.priority_index || 0,
            benchmark: benchmarkInfo,
            root_causes: rootCauses,
            recommendations: selectedRecs,
          };
        }
      }
    }

    // Salvar no snapshot
    const intelligenceComputedAt = new Date().toISOString();
    await base44.asServiceRole.entities.FalDiagnosticSnapshot.update(snap.id, {
      cluster_analysis: clusterAnalysis,
      intelligence_computed_at: intelligenceComputedAt,
      intelligence_benchmark_group: benchmark_group,
    });

    // ── Atualizar AssessmentFlowState ─────────────────────────────────────────
    try {
      const flowRecords = await base44.asServiceRole.entities.AssessmentFlowState.filter(
        { assessment_id }, '-created_date', 1
      );
      const flowPayload = {
        intelligence_status: 'done',
        intelligence_generated_at: intelligenceComputedAt,
        intelligence_snapshot_id: snap.id,
        stale_from_step: null,
        updated_by: user.email,
      };
      if (flowRecords.length > 0) {
        await base44.asServiceRole.entities.AssessmentFlowState.update(flowRecords[0].id, flowPayload);
      }
    } catch (flowErr) {
      console.warn('[computeClusterIntelligence] flow state update failed:', flowErr.message);
    }

    // Top 10 mais críticos por priority_index
    const all = Object.values(clusterAnalysis).sort((a, b) => b.priority_index - a.priority_index);
    const top10 = all.slice(0, 10);

    return Response.json({
      ok: true,
      snapshot_id: snap.id,
      clusters_analyzed: all.length,
      clusters_with_causes: all.filter(c => c.root_causes?.length > 0).length,
      clusters_below_benchmark: all.filter(c => c.benchmark?.position === 'abaixo').length,
      top10,
    });
  } catch (e) {
    console.error('[computeClusterIntelligence]', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
});