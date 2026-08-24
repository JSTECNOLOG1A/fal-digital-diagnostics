import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const consultant_id = body.consultant_id || user.email;
    let tenant_id = body.tenant_id;

    // ── SEG-02: Tenant guard — enforce user's tenant unless HQ ──
    if (appRole !== 'hq_admin') {
      if (tenant_id && tenant_id !== user.tenant_id) {
        return Response.json({ error: 'Forbidden — cross-tenant access denied' }, { status: 403 });
      }
      tenant_id = user.tenant_id;
    }

    // Get all assessments for this tenant
    const filter = tenant_id ? { tenant_id } : {};
    const assessments = await base44.asServiceRole.entities.Assessment.filter(filter, '-created_date', 500);

    // Filter by consultant if not HQ
    const myAssessments = consultant_id && appRole !== 'hq_admin'
      ? assessments.filter(a => a.assigned_to === consultant_id || !a.assigned_to)
      : assessments;

    // Get snapshots for published assessments
    const publishedIds = myAssessments.filter(a => a.status === 'published').map(a => a.id);
    
    let snapshots = [];
    if (publishedIds.length > 0) {
      snapshots = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(filter, '-computed_at', 500);
      // Keep only latest per assessment
      const latestSnap = {};
      snapshots.forEach(s => {
        if (!latestSnap[s.assessment_id] || s.computed_at > latestSnap[s.assessment_id].computed_at) {
          latestSnap[s.assessment_id] = s;
        }
      });
      snapshots = Object.values(latestSnap);
    }

    // Get action tasks
    const tasks = await base44.asServiceRole.entities.ActionTask.filter(filter, '-created_date', 1000);

    // Compute metrics
    const total_assessments = myAssessments.length;
    const assessments_in_progress = myAssessments.filter(a => ['draft','in_progress','scoring','review'].includes(a.status)).length;
    const assessments_completed = myAssessments.filter(a => a.status === 'published').length;

    // Unique clients
    const clientIds = new Set();
    myAssessments.forEach(a => {
      if (a.group_id) clientIds.add('g_' + a.group_id);
      else if (a.company_id) clientIds.add('c_' + a.company_id);
      else clientIds.add('a_' + a.id);
    });
    const total_clients = clientIds.size;

    // Critical and high priority clusters from snapshots
    let clusters_criticos = 0;
    let clusters_alta_prioridade = 0;
    const criticalClusters = [];

    snapshots.forEach(snap => {
      if (!snap.dimension_scores) return;
      Object.entries(snap.dimension_scores).forEach(([dimKey, dimData]) => {
        if (!dimData.cluster_scores) return;
        Object.entries(dimData.cluster_scores).forEach(([clusterKey, clusterData]) => {
          const score = clusterData.score ?? 0;
          if (score < 1.0) {
            clusters_criticos++;
            criticalClusters.push({
              cluster_key: clusterKey,
              dimension_key: dimKey,
              score,
              assessment_id: snap.assessment_id,
              level: 'Crítico'
            });
          } else if (score < 1.5) {
            clusters_alta_prioridade++;
            criticalClusters.push({
              cluster_key: clusterKey,
              dimension_key: dimKey,
              score,
              assessment_id: snap.assessment_id,
              level: 'Alto'
            });
          }
        });
      });
    });

    // Sort critical clusters by score asc
    criticalClusters.sort((a, b) => a.score - b.score);

    // Action task metrics
    const actions_pending = tasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length;
    const actions_completed = tasks.filter(t => t.status === 'done').length;

    // Dimension scores across all clients (for benchmark)
    const dimScoresMap = {};
    snapshots.forEach(snap => {
      if (!snap.dimension_scores) return;
      Object.entries(snap.dimension_scores).forEach(([dimKey, dimData]) => {
        if (!dimScoresMap[dimKey]) dimScoresMap[dimKey] = [];
        if (dimData.score !== undefined) dimScoresMap[dimKey].push(dimData.score);
      });
    });

    const avg_dimension_scores = {};
    Object.entries(dimScoresMap).forEach(([key, arr]) => {
      avg_dimension_scores[key] = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    });

    // Recent assessments with snapshot data
    const recentAssessments = myAssessments.slice(0, 10).map(a => {
      const snap = snapshots.find(s => s.assessment_id === a.id);
      return {
        id: a.id,
        title: a.title,
        competence: a.competence,
        status: a.status,
        overall_score: snap?.overall_score ?? null,
        overall_level: snap?.overall_level ?? null,
        gaps_count: snap?.gaps_top?.length ?? 0,
        created_date: a.created_date,
      };
    });

    return Response.json({
      total_clients,
      total_assessments,
      assessments_in_progress,
      assessments_completed,
      clusters_criticos,
      clusters_alta_prioridade,
      actions_pending,
      actions_completed,
      avg_dimension_scores,
      top_critical_clusters: criticalClusters.slice(0, 10),
      recent_assessments: recentAssessments,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});