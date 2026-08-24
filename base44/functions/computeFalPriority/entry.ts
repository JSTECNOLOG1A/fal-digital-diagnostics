/**
 * computeFalPriority
 * Motor de priorização automática FAL.
 * Lê o FalDiagnosticSnapshot mais recente, cruza com FalClusterMeta,
 * calcula priority_index por cluster e atualiza o snapshot.
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

const DEFAULT_META = {
  impact_weight: 3,
  legal_risk_weight: 2,
  operational_risk_weight: 3,
  financial_impact_weight: 3,
  implementation_effort_weight: 3,
};

function computePriorityIndex(clusterScore, meta) {
  const m = meta || DEFAULT_META;
  const maturityGap = 3 - Math.min(3, clusterScore);
  const riskScore = ((m.legal_risk_weight || 2) + (m.operational_risk_weight || 3) + (m.financial_impact_weight || 3)) / 3;
  const impactFactor = m.impact_weight || 3;
  const effort = Math.max(1, m.implementation_effort_weight || 3);
  return Math.round((maturityGap * riskScore * impactFactor / effort) * 100) / 100;
}

function indexToLevel(idx) {
  if (idx >= 12) return 'CRÍTICA';
  if (idx >= 8)  return 'ALTA';
  if (idx >= 4)  return 'MÉDIA';
  return 'BAIXA';
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
    if (!snapshots.length) return Response.json({ error: 'No FalDiagnosticSnapshot found' }, { status: 404 });
    const snap = snapshots[0];

    // Buscar metadados de cluster
    const clusterMetas = await base44.asServiceRole.entities.FalClusterMeta.list('-created_date', 300);
    const metaByKey = {};
    for (const m of clusterMetas) {
      metaByKey[m.cluster_key] = m;
    }

    // Calcular prioridade por cluster (otimizado para evitar loops longos)
    const allClusters = [];
    const dimScores = snap.dimension_scores || {};
    let clusterCount = 0;

    for (const [dimKey, dimData] of Object.entries(dimScores)) {
      if (!dimData.active || dimData.score === null) continue;
      const subdimScores = dimData.subdimension_scores || {};

      for (const [subKey, subData] of Object.entries(subdimScores)) {
        const clusterScores = subData.cluster_scores || {};

        for (const [clusterName, clusterInfo] of Object.entries(clusterScores)) {
          if (clusterCount++ > 500) break; // Limite seguro
          const clusterScore = typeof clusterInfo === 'object' ? (clusterInfo.score ?? 0) : (clusterInfo ?? 0);
          const meta = metaByKey[clusterName];
          const idx = computePriorityIndex(clusterScore, meta);
          const level = indexToLevel(idx);

          allClusters.push({
            cluster: clusterName,
            priority_index: idx,
            priority_level: level,
          });
        }
      }
    }

    // Ordenar e categorizar
    allClusters.sort((a, b) => b.priority_index - a.priority_index);
    const criticos         = allClusters.filter(c => c.priority_level === 'CRÍTICA').slice(0, 50);
    const alta_prioridade  = allClusters.filter(c => c.priority_level === 'ALTA').slice(0, 50);
    const media_prioridade = allClusters.filter(c => c.priority_level === 'MÉDIA').slice(0, 50);
    const baixa_prioridade = allClusters.filter(c => c.priority_level === 'BAIXA').slice(0, 50);

    // Salvar no snapshot — sem o cluster_priority map (muito pesado), só as listas rankeadas
    const priorityPayload = {
      clusters_criticos: criticos,
      clusters_alta_prioridade: alta_prioridade,
      clusters_media_prioridade: media_prioridade,
      clusters_baixa_prioridade: baixa_prioridade,
      priority_computed_at: new Date().toISOString(),
      priority_computed_by: user.email,
    };

    await base44.asServiceRole.entities.FalDiagnosticSnapshot.update(snap.id, priorityPayload);

    // ── Atualizar AssessmentFlowState ─────────────────────────────────────────
    try {
      const flowRecords = await base44.asServiceRole.entities.AssessmentFlowState.filter(
        { assessment_id }, '-created_date', 1
      );
      const flowPayload = {
        priorities_status: 'done',
        priorities_generated_at: priorityPayload.priority_computed_at,
        priorities_snapshot_id: snap.id,
        stale_from_step: null,
        updated_by: user.email,
      };
      if (flowRecords.length > 0) {
        await base44.asServiceRole.entities.AssessmentFlowState.update(flowRecords[0].id, flowPayload);
      } else {
        const assessment = await base44.asServiceRole.entities.Assessment.get(assessment_id);
        await base44.asServiceRole.entities.AssessmentFlowState.create({
          tenant_id: assessment.tenant_id,
          assessment_id,
          diagnostic_status: 'done',
          ...flowPayload,
        });
      }
    } catch (flowErr) {
      console.warn('[computeFalPriority] flow state update failed:', flowErr.message);
    }

    return Response.json({
      ok: true,
      snapshot_id: snap.id,
      total_clusters: allClusters.length,
      criticos: criticos.length,
      alta: alta_prioridade.length,
      media: media_prioridade.length,
      baixa: baixa_prioridade.length,
    });
  } catch (e) {
    console.error('[computeFalPriority]', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
});