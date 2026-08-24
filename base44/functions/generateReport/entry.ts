/**
 * generateReport — Backend function para gerar relatórios por escopo e modo
 * Usa arquitetura canônica: contexto → payload → narrativa → renderização
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

/**
 * Importações locais (serviços)
 * NOTA: Não é possível fazer import de arquivos locais no Deno.
 * Portanto, as funções são definidas inline neste arquivo.
 */

// Copiar funções de reportTypes.js, reportContext.js, buildReportPayload.js inline
// Para simplificar nesta etapa, vou incluir o mínimo viável

const VALID_COMBINATIONS = [
  { scope: 'group', mode: 'executive' },
  { scope: 'group', mode: 'full_scope' },
  { scope: 'company', mode: 'tactical' },
  { scope: 'unit', mode: 'operational' },
];

function isValidCombination(scope, mode) {
  return VALID_COMBINATIONS.some(c => c.scope === scope && c.mode === mode);
}

async function resolveContext(base44, { reportScope, reportMode, cycleId, groupId, companyId, unitId }) {
  // Validar ciclo
  let cycle;
  try {
    cycle = await base44.entities.FalAssessmentCycle.get(cycleId);
  } catch (e) {
    throw new Error(`Ciclo ${cycleId} não encontrado`);
  }

  const context = { cycle };

  if (reportScope === 'group' && !groupId) {
    throw new Error('group_id obrigatório');
  }
  if (reportScope === 'company' && !companyId) {
    throw new Error('company_id obrigatório');
  }
  if (reportScope === 'unit' && !unitId) {
    throw new Error('unit_id obrigatório');
  }

  // Resolver entidades
  if (groupId) context.group = await base44.entities.Group.get(groupId);
  if (companyId) context.company = await base44.entities.Company.get(companyId);
  if (unitId) context.unit = await base44.entities.OperationalUnit.get(unitId);

  return context;
}

async function buildPayload(base44, { reportScope, reportMode, cycleId, groupId, companyId, unitId, context }) {
  const payload = {
    meta: {
      reportScope,
      reportMode,
      cycleId,
      generatedAt: new Date().toISOString(),
      templateVersion: '1.0',
    },
    context,
    headline: {
      title: `Relatório ${reportScope === 'group' ? 'do Grupo' : reportScope === 'company' ? 'da Empresa' : 'da Unidade'}`,
      overallScore: null,
      overallLevel: null,
    },
    dimensions: [],
    clusters: [],
    actionPlan: [],
  };

  // Puxar snapshots conforme escopo
  if (reportScope === 'group') {
    // Aggregate snapshot (preferred) ou diagnostic snapshot
    const [aggSnaps, diagSnaps] = await Promise.all([
      base44.entities.FalAggregateSnapshot.filter({ level_type: 'group', level_id: groupId, cycle_id: cycleId }, '-computed_at', 1),
      base44.entities.FalDiagnosticSnapshot.filter({ level_type: 'group', level_id: groupId, cycle_id: cycleId }, '-computed_at', 1),
    ]);
    const snap = aggSnaps[0] || diagSnaps[0] || null;

    if (snap) {
      payload.headline.overallScore = snap.overall_score;
      payload.headline.overallLevel = snap.overall_level;
      const dimSource = snap.dimension_scores;
      if (dimSource) {
        payload.dimensions = Object.entries(dimSource).map(([key, data]) => ({
          key,
          name: data.name || key,
          score: data.score,
          level: data.level,
        }));
      }

      // Delta ciclo anterior
      if (context.cycle?.parent_cycle_id) {
        const prevAgg = await base44.entities.FalAggregateSnapshot.filter({ level_type: 'group', level_id: groupId, cycle_id: context.cycle.parent_cycle_id }, '-computed_at', 1);
        const prevSnap = prevAgg[0];
        if (prevSnap && snap.overall_score != null && prevSnap.overall_score != null) {
          payload.headline.previousScore = prevSnap.overall_score;
          payload.headline.deltaScore = snap.overall_score - prevSnap.overall_score;
        }
      }
    }

    // Companies + coverage + dispersion
    const companies = await base44.entities.Company.filter({ group_id: groupId });
    const activeCompanies = companies.filter(c => !c.is_archived);
    const assessments = await base44.entities.Assessment.filter({ group_id: groupId, cycle_id: cycleId });
    const uniqueCompanies = new Set(assessments.map(a => a.company_id).filter(Boolean));

    payload.coverage = {
      total_companies: activeCompanies.length,
      assessed_companies: uniqueCompanies.size,
      coverage_ratio: activeCompanies.length ? uniqueCompanies.size / activeCompanies.length : 0,
    };
    payload.isPartialCoverage = payload.coverage.coverage_ratio < 0.8;

    // Dispersão: scores por empresa
    const companyAggSnaps = await base44.entities.FalAggregateSnapshot.filter({ level_type: 'company', cycle_id: cycleId }, '-computed_at', 200);
    const snapByCompany = {};
    companyAggSnaps.forEach(s => { const cid = s.company_id || s.level_id; if (cid && !snapByCompany[cid]) snapByCompany[cid] = s; });

    const assessedCompanies = activeCompanies
      .map(c => ({ id: c.id, name: c.name, score: snapByCompany[c.id]?.overall_score ?? null, level: snapByCompany[c.id]?.overall_level ?? null }))
      .filter(c => c.score != null)
      .sort((a, b) => b.score - a.score);

    if (assessedCompanies.length >= 2) {
      const scores = assessedCompanies.map(c => c.score);
      const min = Math.min(...scores), max = Math.max(...scores);
      const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
      const std = Math.sqrt(scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length);
      const gap = max - min;
      const dispersion_risk = gap >= 1.5 || std >= 0.6 ? 'crítico' : gap >= 0.8 || std >= 0.35 ? 'alto' : gap >= 0.4 || std >= 0.2 ? 'moderado' : 'baixo';

      payload.dispersion = {
        assessed_count: assessedCompanies.length,
        total_count: activeCompanies.length,
        companies: assessedCompanies,
        min: parseFloat(min.toFixed(2)), max: parseFloat(max.toFixed(2)),
        mean: parseFloat(mean.toFixed(2)), std: parseFloat(std.toFixed(2)),
        gap: parseFloat(gap.toFixed(2)),
        dispersion_risk,
        best_company: assessedCompanies[0],
        worst_company: assessedCompanies[assessedCompanies.length - 1],
        not_assessed: activeCompanies.filter(c => !snapByCompany[c.id]).map(c => ({ id: c.id, name: c.name })),
      };
    }
  }

  if (reportScope === 'company') {
    const snaps = await base44.entities.FalDiagnosticSnapshot.filter({
      level_type: 'company',
      level_id: companyId,
      cycle_id: cycleId,
    }, '-computed_at', 1);

    if (snaps.length > 0) {
      const snap = snaps[0];
      payload.headline.overallScore = snap.overall_score;
      payload.headline.overallLevel = snap.overall_level;
      if (snap.dimension_scores) {
        payload.dimensions = Object.entries(snap.dimension_scores).map(([key, data]) => ({
          key,
          name: data.name || key,
          score: data.score,
          level: data.level,
        }));
      }
    }
  }

  if (reportScope === 'unit') {
    const snaps = await base44.entities.FalDiagnosticSnapshot.filter({
      level_type: 'unit',
      level_id: unitId,
      cycle_id: cycleId,
    }, '-computed_at', 1);

    if (snaps.length > 0) {
      const snap = snaps[0];
      payload.headline.overallScore = snap.overall_score;
      payload.headline.overallLevel = snap.overall_level;
      if (snap.dimension_scores) {
        payload.dimensions = Object.entries(snap.dimension_scores).map(([key, data]) => ({
          key,
          name: data.name || key,
          score: data.score,
          level: data.level,
        }));
      }
    }
  }

  return payload;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { reportScope, reportMode, cycleId, groupId, companyId, unitId, tenantId } = body;

    // Guard: validar propriedade do tenant
    if (tenantId && appRole !== 'hq_admin' && tenantId !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: tenant não corresponde ao usuário autenticado' }, { status: 403 });
    }

    // Validar combinação
    if (!isValidCombination(reportScope, reportMode)) {
      return Response.json(
        { error: `Combinação inválida: escopo='${reportScope}', modo='${reportMode}'` },
        { status: 400 }
      );
    }

    // Resolver contexto
    const context = await resolveContext(base44, {
      reportScope,
      reportMode,
      cycleId,
      groupId,
      companyId,
      unitId,
    });

    // Montar payload
    const payload = await buildPayload(base44, {
      reportScope,
      reportMode,
      cycleId,
      groupId,
      companyId,
      unitId,
      context,
    });

    return Response.json({
      success: true,
      payload,
      message: `Relatório ${reportScope}/${reportMode} gerado com sucesso`,
    });
  } catch (error) {
    console.error('[generateReport] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});