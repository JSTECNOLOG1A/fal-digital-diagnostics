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
    let tenant_id = body.tenant_id;

    // ── SEG-02: Tenant guard — enforce user's tenant unless HQ ──
    if (appRole !== 'hq_admin') {
      if (tenant_id && tenant_id !== user.tenant_id) {
        return Response.json({ error: 'Forbidden — cross-tenant access denied' }, { status: 403 });
      }
      tenant_id = user.tenant_id;
    }

    const filter = tenant_id ? { tenant_id } : {};

    const now = new Date();
    const alerts = [];

    // Get all assessments + snapshots + tasks
    const [assessments, tasks] = await Promise.all([
      base44.asServiceRole.entities.Assessment.filter(filter, '-created_date', 500),
      base44.asServiceRole.entities.ActionTask.filter(filter, '-created_date', 1000),
    ]);

    // Get latest snapshot per assessment
    const allSnaps = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(filter, '-computed_at', 500);
    const latestSnap = {};
    allSnaps.forEach(s => {
      if (!latestSnap[s.assessment_id] || s.computed_at > latestSnap[s.assessment_id].computed_at) {
        latestSnap[s.assessment_id] = s;
      }
    });

    // Rule 1: Critical cluster without any action started
    Object.values(latestSnap).forEach(snap => {
      if (!snap.dimension_scores) return;
      const assessment = assessments.find(a => a.id === snap.assessment_id);
      Object.entries(snap.dimension_scores).forEach(([dimKey, dimData]) => {
        if (!dimData.cluster_scores) return;
        Object.entries(dimData.cluster_scores).forEach(([clusterKey, clusterData]) => {
          const score = clusterData.score ?? 0;
          if (score < 1.0) {
            // Check if there's any action for this cluster
            const hasAction = tasks.some(t =>
              t.assessment_id === snap.assessment_id &&
              t.status !== 'cancelled'
            );
            if (!hasAction) {
              alerts.push({
                type: 'critical_cluster_no_action',
                severity: 'critical',
                title: 'Cluster crítico sem ação iniciada',
                description: `Cluster "${clusterKey}" (dim: ${dimKey}) com score ${score.toFixed(2)} não possui ação iniciada.`,
                assessment_id: snap.assessment_id,
                assessment_title: assessment?.title || snap.assessment_id,
                cluster_key: clusterKey,
                dimension_key: dimKey,
                score,
              });
            }
          }
        });
      });
    });

    // Rule 2: High priority cluster without progress after 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    Object.values(latestSnap).forEach(snap => {
      if (!snap.dimension_scores) return;
      const assessment = assessments.find(a => a.id === snap.assessment_id);
      if (!assessment) return;
      const assessmentDate = new Date(assessment.created_date || now);
      if (assessmentDate > thirtyDaysAgo) return; // assessment too recent

      Object.entries(snap.dimension_scores).forEach(([dimKey, dimData]) => {
        if (!dimData.cluster_scores) return;
        Object.entries(dimData.cluster_scores).forEach(([clusterKey, clusterData]) => {
          const score = clusterData.score ?? 0;
          if (score >= 1.0 && score < 1.5) {
            const relevantTasks = tasks.filter(t =>
              t.assessment_id === snap.assessment_id &&
              t.status === 'todo'
            );
            if (relevantTasks.length > 0) {
              alerts.push({
                type: 'high_priority_no_progress',
                severity: 'high',
                title: 'Alta prioridade sem progresso há 30+ dias',
                description: `Cluster "${clusterKey}" (dim: ${dimKey}) com score ${score.toFixed(2)} sem progresso após 30 dias.`,
                assessment_id: snap.assessment_id,
                assessment_title: assessment?.title || snap.assessment_id,
                cluster_key: clusterKey,
                dimension_key: dimKey,
                score,
              });
            }
          }
        });
      });
    });

    // Rule 3: Action plan stopped for more than 60 days
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const assessmentTaskMap = {};
    tasks.forEach(t => {
      if (!assessmentTaskMap[t.assessment_id]) assessmentTaskMap[t.assessment_id] = [];
      assessmentTaskMap[t.assessment_id].push(t);
    });

    Object.entries(assessmentTaskMap).forEach(([assessmentId, planTasks]) => {
      const assessment = assessments.find(a => a.id === assessmentId);
      if (!assessment) return;
      const pendingTasks = planTasks.filter(t => t.status === 'todo' || t.status === 'in_progress');
      const completedTasks = planTasks.filter(t => t.status === 'done');
      if (pendingTasks.length > 0 && completedTasks.length === 0) {
        const oldestTask = pendingTasks.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
        if (oldestTask && new Date(oldestTask.created_date) < sixtyDaysAgo) {
          alerts.push({
            type: 'plan_stalled',
            severity: 'medium',
            title: 'Plano de ação parado há 60+ dias',
            description: `O plano de ação do assessment "${assessment.title}" está parado há mais de 60 dias sem nenhuma conclusão.`,
            assessment_id: assessmentId,
            assessment_title: assessment.title,
          });
        }
      }
    });

    // Rule 4: Score drop between diagnostics
    // Group snapshots by assessment target
    const snapsByTarget = {};
    allSnaps.forEach(s => {
      const key = s.target_id || s.assessment_id;
      if (!snapsByTarget[key]) snapsByTarget[key] = [];
      snapsByTarget[key].push(s);
    });

    Object.values(snapsByTarget).forEach(snapsForTarget => {
      if (snapsForTarget.length < 2) return;
      const sorted = snapsForTarget.sort((a, b) => new Date(b.computed_at) - new Date(a.computed_at));
      const latest = sorted[0];
      const previous = sorted[1];
      const delta = (latest.overall_score ?? 0) - (previous.overall_score ?? 0);
      if (delta < -0.2) {
        const assessment = assessments.find(a => a.id === latest.assessment_id);
        alerts.push({
          type: 'score_drop',
          severity: 'high',
          title: 'Queda de score detectada',
          description: `Score caiu de ${previous.overall_score?.toFixed(2)} para ${latest.overall_score?.toFixed(2)} (Δ ${delta.toFixed(2)}).`,
          assessment_id: latest.assessment_id,
          assessment_title: assessment?.title || latest.assessment_id,
          delta,
        });
      }
    });

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

    return Response.json({ alerts, total: alerts.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});