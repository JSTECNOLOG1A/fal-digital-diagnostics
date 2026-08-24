/**
 * computeGroupAggregate — Backend function
 * Calcula agregado do grupo: weighted average + dispersion penalty
 * 
 * Implementação de Fase 2 (segunda prioridade)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function resolveAppRole(user) {
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

// Copiar funções do serviço (como não é possível importar, replicamos aqui)
function calculateStdDev(scores) {
  if (scores.length === 0) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  return Math.sqrt(variance);
}

function calculateWeightedAverage(companies, snapByCompanyId) {
  let totalWeight = 0;
  let weightedSum = 0;

  companies.forEach(company => {
    const score = snapByCompanyId[company.id]?.overall_score || 0;
    const weight = company.group_weight || (company.annual_revenue ? company.annual_revenue / 1_000_000 : null) || (company.employees ? company.employees / 10 : 1);
    const normalizedWeight = Math.max(weight || 1, 0.5);

    weightedSum += score * normalizedWeight;
    totalWeight += normalizedWeight;
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function calculateDispersionPenalty(scores, penaltyFactor = 0.3) {
  const stdDev = calculateStdDev(scores);
  return stdDev * penaltyFactor;
}

function normalizeScore(rawScore) {
  return (rawScore / 3) * 100;
}

function classifyLevel(score) {
  if (score < 40) return 'Crítico';
  if (score < 70) return 'Básico';
  if (score < 85) return 'Estruturado';
  return 'Avançado';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!WRITE_ROLES.has(appRole)) return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });

    const body = await req.json();
    const { group_id, cycle_id } = body;

    if (!group_id) {
      return Response.json({ error: 'group_id obrigatório' }, { status: 400 });
    }

    if (!cycle_id) {
      return Response.json({ error: 'cycle_id obrigatório (Prioridade 1!)' }, { status: 400 });
    }

    // Carregar grupo
    const group = await base44.entities.Group.get(group_id);
    if (!group) {
      return Response.json({ error: 'Grupo não encontrado' }, { status: 404 });
    }

    // Carregar empresas ativas do grupo
    const companies = await base44.entities.Company.filter({
      group_id,
      is_archived: { $ne: true },
    }, 'name', 100);

    if (companies.length === 0) {
      return Response.json({
        error: 'Nenhuma empresa ativa neste grupo',
      }, { status: 400 });
    }

    // Carregar snapshots de cada empresa DENTRO DO CICLO (PRIORIDADE 1)
    const companySnapshots = await base44.entities.FalDiagnosticSnapshot.filter({
      level_type: 'company',
      cycle_id, // ← OBRIGATÓRIO: isolamento de ciclo
    }, '-computed_at', 100);

    // Filtrar apenas snapshots das empresas deste grupo
    const relevantSnapshots = companySnapshots.filter(snap =>
      companies.some(c => c.id === snap.company_id)
    );

    if (relevantSnapshots.length === 0) {
      return Response.json({
        warning: 'Nenhuma empresa do grupo tem avaliação neste ciclo',
        group_score: null,
        coverage: { assessed: 0, total: companies.length },
      }, { status: 200 });
    }

    // Map snapshots
    const snapByCompanyId = {};
    const companyScores = [];
    const companyDetails = [];

    relevantSnapshots.forEach(snap => {
      if (snap.company_id) {
        snapByCompanyId[snap.company_id] = snap;
      }
    });

    companies.forEach(company => {
      const snap = snapByCompanyId[company.id];
      const score = snap?.overall_score ?? 0;
      companyScores.push(score);

      companyDetails.push({
        company_id: company.id,
        company_name: company.name,
        score,
        level: snap?.overall_level || 'N/A',
        has_assessment: !!snap,
      });
    });

    // Cálculos: weighted average + dispersion penalty
    const weightedAvg = calculateWeightedAverage(companies, snapByCompanyId);
    const dispersionPenalty = calculateDispersionPenalty(companyScores);
    const groupScoreRaw = Math.max(weightedAvg - dispersionPenalty, 0);
    const groupScoreNormalized = normalizeScore(groupScoreRaw);
    const groupLevel = classifyLevel(groupScoreNormalized);

    // Melhor e pior
    const bestCompany = companyDetails.reduce((best, curr) => 
      curr.score > best.score ? curr : best
    );

    const worstCompany = companyDetails.reduce((worst, curr) => 
      curr.score < worst.score ? curr : worst
    );

    // Delta vs ciclo anterior
    let deltaScore = null;
    let previousScore = null;

    // AQUI TAMBÉM APLICAMOS PRIORIDADE 1: buscar snapshot ANTERIOR do grupo NO CICLO ANTERIOR
    // (não atual)
    const cycle = await base44.entities.FalAssessmentCycle.get(cycle_id);
    if (cycle?.parent_cycle_id) {
      const prevGroupSnapshots = await base44.entities.FalDiagnosticSnapshot.filter({
        level_type: 'group',
        level_id: group_id,
        cycle_id: cycle.parent_cycle_id,
      }, '-computed_at', 1);

      if (prevGroupSnapshots.length > 0) {
        previousScore = prevGroupSnapshots[0].overall_score;
        deltaScore = groupScoreRaw - previousScore;
      }
    }

    // Persistir resultado
    const result = await base44.entities.FalAggregateSnapshot.create({
      tenant_id: user.tenant_id,
      level_type: 'group',
      level_id: group_id,
      cycle_id, // ← OBRIGATÓRIO
      computed_at: new Date().toISOString(),
      computed_by: user.email,

      overall_score: groupScoreNormalized,
      overall_level: groupLevel,

      dimension_scores: {},
      radar_points: [],
      gaps_top: [],

      source_assessments: companyDetails,
      metadata: {
        weighted_avg: weightedAvg,
        dispersion_penalty: dispersionPenalty,
        dispersion_index: calculateStdDev(companyScores),
        internal_gap: Math.max(...companyScores) - Math.min(...companyScores),
        best_company: bestCompany,
        worst_company: worstCompany,
        previous_score: previousScore,
        delta_score: deltaScore,
      },
    });

    return Response.json({
      success: true,
      result: {
        group_id,
        cycle_id,
        overall_score: groupScoreNormalized,
        overall_level: groupLevel,
        dispersion_penalty: dispersionPenalty,
        dispersion_index: calculateStdDev(companyScores),
        internal_gap: Math.max(...companyScores) - Math.min(...companyScores),
        best_company: bestCompany,
        worst_company: worstCompany,
        coverage: {
          assessed: relevantSnapshots.length,
          total: companies.length,
        },
        delta: deltaScore,
      },
    });
  } catch (error) {
    console.error('[computeGroupAggregate] Error:', error);
    return Response.json({
      error: error.message,
    }, { status: 500 });
  }
});