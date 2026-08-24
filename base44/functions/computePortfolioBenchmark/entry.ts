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

    // Get assessments + snapshots
    const assessments = await base44.asServiceRole.entities.Assessment.filter(filter, '-created_date', 500);
    const allSnaps = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(filter, '-computed_at', 500);

    // Get latest snapshot per assessment
    const latestSnap = {};
    allSnaps.forEach(s => {
      if (!latestSnap[s.assessment_id] || s.computed_at > latestSnap[s.assessment_id].computed_at) {
        latestSnap[s.assessment_id] = s;
      }
    });

    // Build client-level data (group by client)
    const clientMap = {};
    assessments.forEach(a => {
      const clientKey = a.group_id || a.company_id || a.id;
      const clientLabel = a.title;
      if (!clientMap[clientKey]) {
        clientMap[clientKey] = {
          client_id: clientKey,
          client_name: clientLabel,
          assessments: [],
        };
      }
      const snap = latestSnap[a.id];
      if (snap) {
        clientMap[clientKey].assessments.push({ assessment: a, snapshot: snap });
      }
    });

    // Compute ranking per client
    const clientRankings = Object.values(clientMap)
      .filter(c => c.assessments.length > 0)
      .map(client => {
        // Average overall score across assessments
        const scores = client.assessments.map(e => e.snapshot.overall_score ?? 0);
        const avg_overall = scores.reduce((a, b) => a + b, 0) / scores.length;

        // Latest snapshot dimension scores
        const latestEntry = client.assessments.sort(
          (a, b) => new Date(b.snapshot.computed_at) - new Date(a.snapshot.computed_at)
        )[0];
        const dim_scores = {};
        if (latestEntry.snapshot.dimension_scores) {
          Object.entries(latestEntry.snapshot.dimension_scores).forEach(([k, v]) => {
            dim_scores[k] = v.score ?? 0;
          });
        }

        // Count critical clusters
        let critical_count = 0;
        if (latestEntry.snapshot.dimension_scores) {
          Object.values(latestEntry.snapshot.dimension_scores).forEach(dimData => {
            if (dimData.cluster_scores) {
              Object.values(dimData.cluster_scores).forEach(c => {
                if ((c.score ?? 0) < 1.0) critical_count++;
              });
            }
          });
        }

        // maturity_index, total_evolution, execution rate, impact potential from latest snapshot
        const maturity_index = latestEntry.snapshot.maturity_index ?? Math.round((latestEntry.snapshot.overall_score ?? 0) / 3 * 100);
        const total_evolution = latestEntry.snapshot.total_evolution ?? null;
        const action_execution_rate = latestEntry.snapshot.action_execution_rate ?? null;
        const impact_potential = latestEntry.snapshot.impact_potential ?? null;

        // Top value lever from snapshot
        const LEVER_LABELS = {
          geracao_caixa: 'Geração de Caixa', preservacao_margem: 'Preservação de Margem',
          reducao_risco: 'Redução de Risco', eficiencia_operacional: 'Eficiência Operacional',
          protecao_patrimonial: 'Proteção Patrimonial',
        };
        let top_value_lever = null;
        let top_value_lever_cluster = null;
        const vls = latestEntry.snapshot.value_lever_summary;
        if (vls) {
          const ranked = Object.entries(vls).sort((a, b) => (b[1].total_potential || 0) - (a[1].total_potential || 0));
          if (ranked.length > 0) {
            top_value_lever = LEVER_LABELS[ranked[0][0]] || ranked[0][0];
            top_value_lever_cluster = ranked[0][1].top_clusters?.[0]?.cluster_key?.replace(/_/g, ' ') || null;
          }
        }

        return {
          client_id: client.client_id,
          client_name: client.client_name,
          avg_overall_score: avg_overall,
          overall_score: latestEntry.snapshot.overall_score ?? 0,
          overall_level: latestEntry.snapshot.overall_level,
          dimension_scores: dim_scores,
          critical_clusters: critical_count,
          assessment_count: client.assessments.length,
          maturity_index,
          total_evolution,
          action_execution_rate,
          impact_potential,
          top_value_lever,
          top_value_lever_cluster,
        };
      });

    // Sort by avg overall score desc (best first)
    clientRankings.sort((a, b) => b.avg_overall_score - a.avg_overall_score);

    // Add rank
    clientRankings.forEach((c, i) => { c.rank = i + 1; });

    // Compute portfolio averages per dimension
    const allDims = new Set();
    clientRankings.forEach(c => Object.keys(c.dimension_scores).forEach(k => allDims.add(k)));

    const portfolio_avg = {};
    allDims.forEach(dim => {
      const vals = clientRankings.map(c => c.dimension_scores[dim]).filter(v => v !== undefined);
      portfolio_avg[dim] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });

    return Response.json({
      rankings: clientRankings,
      portfolio_avg,
      total_clients: clientRankings.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});