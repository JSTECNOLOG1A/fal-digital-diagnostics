/**
 * computeGroupAggregate
 * Agrega FalAggregateSnapshots de empresas + snapshot do próprio grupo.
 * Dimensões governança/jurídico/controles_internos recebem peso maior do snapshot do grupo.
 * Payload: { group_id }
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

const ALL_DIMS = ['governanca','juridico','controles_internos','financeiro','contabil','tributario','operacional','sistemas'];
const DIM_AXIS = {
  governanca: 'Governança', juridico: 'Jurídico / Societário',
  controles_internos: 'Controles Internos', financeiro: 'Financeiro',
  contabil: 'Contábil', tributario: 'Fiscal',
  operacional: 'Operacional', sistemas: 'Tecnologia / Sistemas',
};
// Dimensions where group-level assessment has priority (weight 2x)
const GROUP_PRIORITY_DIMS = new Set(['governanca', 'juridico', 'controles_internos']);

function scoreToLevel(s) {
  if (s === null || s === undefined || isNaN(s)) return 'N/A';
  if (s < 1.0) return 'Crítico';
  if (s < 1.8) return 'Básico';
  if (s < 2.5) return 'Estruturado';
  return 'Avançado';
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
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

    const { group_id } = body;
    if (!group_id) return Response.json({ error: 'group_id required' }, { status: 400 });

    const group = await base44.entities.Group.get(group_id);
    if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });
    if (!isHQ && group.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all companies in group
    const companies = await base44.asServiceRole.entities.Company.filter({ group_id }, 'name', 100);

    // Ensure company aggregates exist (or re-compute them)
    const companyAggregates = [];
    for (const company of companies) {
      let agg = (await base44.asServiceRole.entities.FalAggregateSnapshot.filter({ level_type: 'company', level_id: company.id }, '-computed_at', 1))[0];
      if (!agg) {
        // Trigger compute
        const res = await base44.asServiceRole.functions.invoke('computeCompanyAggregate', { company_id: company.id });
        agg = res;
      }
      if (agg && agg.overall_score !== null && agg.overall_score !== undefined) {
        companyAggregates.push({ company, agg });
      }
    }

    // Get group-level assessment snapshot if exists
    const groupAssessments = await base44.asServiceRole.entities.Assessment.filter({ target_type: 'group', target_id: group_id }, '-created_date', 5);
    let groupSnap = null;
    if (groupAssessments.length > 0) {
      const snaps = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter({ assessment_id: groupAssessments[0].id }, '-computed_at', 1);
      groupSnap = snaps[0] || null;
    }

    if (companyAggregates.length === 0 && !groupSnap) {
      return Response.json({ aggregate: null, message: 'Nenhum dado disponível para agregação' });
    }

    // Aggregate per dimension
    const dimAccum = {};
    for (const dim of ALL_DIMS) dimAccum[dim] = { wsum: 0, wtotal: 0 };

    // Company aggregates (weight 1 each company)
    for (const { agg } of companyAggregates) {
      const ds = agg.dimension_scores || {};
      for (const dim of ALL_DIMS) {
        const d = ds[dim];
        if (d && d.active !== false && d.score !== null && d.score !== undefined) {
          dimAccum[dim].wsum += d.score;
          dimAccum[dim].wtotal += 1;
        }
      }
    }

    // Group snapshot: weight=2 for priority dims, weight=1 for others
    if (groupSnap) {
      const ds = groupSnap.dimension_scores || {};
      for (const dim of ALL_DIMS) {
        const d = ds[dim];
        if (d && d.active !== false && d.score !== null && d.score !== undefined) {
          const w = GROUP_PRIORITY_DIMS.has(dim) ? 2 : 1;
          dimAccum[dim].wsum += d.score * w;
          dimAccum[dim].wtotal += w;
        }
      }
    }

    const dimension_scores = {};
    const radarPoints = [];
    let scoreSum = 0, scoreCount = 0;

    for (const dim of ALL_DIMS) {
      const { wsum, wtotal } = dimAccum[dim];
      if (wtotal > 0) {
        const score = Math.round((wsum / wtotal) * 100) / 100;
        const level = scoreToLevel(score);
        dimension_scores[dim] = { score, level, active: true };
        radarPoints.push({ axis: DIM_AXIS[dim], dimension: dim, score, level, active: true });
        scoreSum += score;
        scoreCount++;
      } else {
        dimension_scores[dim] = { score: null, level: 'N/A', active: false };
        radarPoints.push({ axis: DIM_AXIS[dim], dimension: dim, score: 0, level: 'N/A', active: false });
      }
    }

    const overall_score = scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 100) / 100 : 0;
    const overall_level = scoreToLevel(overall_score);

    const source_assessments = [
      ...companyAggregates.map(({ company, agg }) => ({
        level: 'company', company_id: company.id, company_name: company.name,
        overall_score: agg.overall_score, computed_at: agg.computed_at,
      })),
      ...(groupSnap ? [{ level: 'group', assessment_id: groupAssessments[0].id, overall_score: groupSnap.overall_score }] : []),
    ];

    const aggregate = {
      tenant_id: group.tenant_id,
      level_type: 'group',
      level_id: group_id,
      computed_at: new Date().toISOString(),
      computed_by: user.email,
      overall_score,
      overall_level,
      dimension_scores,
      radar_points: radarPoints,
      source_assessments,
      aggregation_rule: 'weighted_mean',
    };

    const existing = await base44.asServiceRole.entities.FalAggregateSnapshot.filter({ level_type: 'group', level_id: group_id });
    for (const e of existing) await base44.asServiceRole.entities.FalAggregateSnapshot.delete(e.id);
    const saved = await base44.asServiceRole.entities.FalAggregateSnapshot.create(aggregate);

    return Response.json({ ...aggregate, id: saved.id, companies_count: companies.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});