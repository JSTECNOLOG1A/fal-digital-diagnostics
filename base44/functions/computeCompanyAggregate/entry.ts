/**
 * computeCompanyAggregate
 * Agrega snapshots das unidades + assessment próprio da empresa.
 * Payload: { company_id }
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

function scoreToLevel(s) {
  if (s === null || s === undefined || isNaN(s)) return 'N/A';
  if (s < 1.0) return 'Crítico';
  if (s < 1.8) return 'Básico';
  if (s < 2.5) return 'Estruturado';
  return 'Avançado';
}

async function getLatestSnapshot(base44, assessmentId) {
  const snaps = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter({ assessment_id: assessmentId }, '-computed_at', 1);
  return snaps[0] || null;
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

    const { company_id } = body;
    if (!company_id) return Response.json({ error: 'company_id required' }, { status: 400 });

    const company = await base44.entities.Company.get(company_id);
    if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });
    if (!isHQ && company.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all assessments for this company (unit-level and company-level)
    const [unitAssessments, companyAssessments, units] = await Promise.all([
      base44.asServiceRole.entities.Assessment.filter({ company_id, target_type: 'unit' }, '-created_date', 100),
      base44.asServiceRole.entities.Assessment.filter({ target_type: 'company', target_id: company_id }, '-created_date', 10),
      base44.asServiceRole.entities.OperationalUnit.filter({ company_id }, 'name', 100),
    ]);

    // Get latest snapshot per unit (one per unit)
    const unitMap = {};
    for (const u of units) unitMap[u.id] = u;

    const unitSnapshotMap = {};
    for (const a of unitAssessments) {
      if (!a.unit_id) continue;
      if (!unitSnapshotMap[a.unit_id]) {
        const snap = await getLatestSnapshot(base44, a.id);
        if (snap) unitSnapshotMap[a.unit_id] = { snapshot: snap, assessment: a };
      }
    }

    // Get company-level snapshot if exists
    let companySnap = null;
    if (companyAssessments.length > 0) {
      companySnap = await getLatestSnapshot(base44, companyAssessments[0].id);
    }

    const allSnapshots = [
      ...Object.values(unitSnapshotMap).map(v => ({ ...v, source: 'unit' })),
      ...(companySnap ? [{ snapshot: companySnap, assessment: companyAssessments[0], source: 'company' }] : []),
    ];

    if (allSnapshots.length === 0) {
      return Response.json({ aggregate: null, message: 'Nenhum snapshot disponível' });
    }

    // Aggregate: mean per dimension
    const dimAccum = {};
    for (const dim of ALL_DIMS) {
      dimAccum[dim] = { sum: 0, count: 0 };
    }

    for (const { snapshot } of allSnapshots) {
      const ds = snapshot.dimension_scores || {};
      for (const dim of ALL_DIMS) {
        const d = ds[dim];
        if (d && d.active !== false && d.score !== null && d.score !== undefined) {
          dimAccum[dim].sum += d.score;
          dimAccum[dim].count += 1;
        }
      }
    }

    const dimension_scores = {};
    const radarPoints = [];
    let scoreSum = 0, scoreCount = 0;

    for (const dim of ALL_DIMS) {
      const { sum, count } = dimAccum[dim];
      if (count > 0) {
        const score = Math.round((sum / count) * 100) / 100;
        const level = scoreToLevel(score);
        dimension_scores[dim] = { score, level, source_count: count, active: true };
        radarPoints.push({ axis: DIM_AXIS[dim], dimension: dim, score, level, active: true });
        scoreSum += score;
        scoreCount++;
      } else {
        dimension_scores[dim] = { score: null, level: 'N/A', source_count: 0, active: false };
        radarPoints.push({ axis: DIM_AXIS[dim], dimension: dim, score: 0, level: 'N/A', active: false });
      }
    }

    const overall_score = scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 100) / 100 : 0;
    const overall_level = scoreToLevel(overall_score);

    const source_assessments = allSnapshots.map(({ snapshot, assessment, source }) => ({
      assessment_id: assessment.id,
      title: assessment.title,
      target_type: assessment.target_type,
      target_id: assessment.target_id,
      unit_id: assessment.unit_id,
      overall_score: snapshot.overall_score,
      computed_at: snapshot.computed_at,
      source,
    }));

    const aggregate = {
      tenant_id: company.tenant_id,
      level_type: 'company',
      level_id: company_id,
      computed_at: new Date().toISOString(),
      computed_by: user.email,
      overall_score,
      overall_level,
      dimension_scores,
      radar_points: radarPoints,
      source_assessments,
      aggregation_rule: 'mean',
    };

    // Upsert: delete existing then create
    const existing = await base44.asServiceRole.entities.FalAggregateSnapshot.filter({ level_type: 'company', level_id: company_id });
    for (const e of existing) await base44.asServiceRole.entities.FalAggregateSnapshot.delete(e.id);
    const saved = await base44.asServiceRole.entities.FalAggregateSnapshot.create(aggregate);

    return Response.json({ ...aggregate, id: saved.id, units_count: units.length, snapshots_used: allSnapshots.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});