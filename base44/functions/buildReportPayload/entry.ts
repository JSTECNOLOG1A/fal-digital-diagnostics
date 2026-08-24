/**
 * buildReportPayload(assessmentId)
 * 
 * Consolida TODOS os dados do diagnóstico FAL em um único payload canônico
 * que alimenta tanto Narrative Engine quanto componentes React.
 * 
 * Fontes:
 * - Assessment (meta + dates)
 * - Group/Company/Unit (entidade avaliada)
 * - FalDiagnosticSnapshot (scores dimensionais + radar)
 * - SystemicCrossingAnalysis (MFIS details)
 * - SystemicDimensionImpact (leverage dimension)
 * - ActionPlan + ActionTask (plano de ação)
 * - MethodVersion (metadata + configurações)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
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

    const { assessment_id } = await req.json();

    if (!assessment_id) {
      return Response.json({ error: 'assessment_id required' }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════════
    // SEÇÃO 1: ASSESSMENT + ENTIDADE
    // ═══════════════════════════════════════════════════════════════
    const assessment = await base44.asServiceRole.entities.Assessment.get(assessment_id);
    if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });

    // Validar tenant access
    if (!isHQ && user.tenant_id && assessment.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [methodVersion, tenant] = await Promise.all([
      base44.asServiceRole.entities.MethodVersion.get(assessment.method_version_id),
      assessment.tenant_id ? base44.asServiceRole.entities.Tenant.get(assessment.tenant_id) : Promise.resolve(null),
    ]);

    // ─ Recalcular diagnóstico FAL antes de montar payload ─
    // Garante que todos os dados estão atualizados para o relatório
    await base44.asServiceRole.functions.invoke('computeFalDiagnostic', { assessment_id });

    let entityName   = '';
    let groupName    = '';
    let companyName  = '';
    let unitName     = '';

    if (assessment.group_id) {
      const group = await base44.asServiceRole.entities.Group.get(assessment.group_id);
      groupName  = group?.name || '';
      entityName = groupName;
    }

    if (assessment.company_id) {
      const company = await base44.asServiceRole.entities.Company.get(assessment.company_id);
      companyName = company?.name || '';
      entityName  = companyName;
    }

    if (assessment.unit_id) {
      const unit = await base44.asServiceRole.entities.OperationalUnit.get(assessment.unit_id);
      unitName   = unit?.name || '';
    }

    // ═══════════════════════════════════════════════════════════════
    // SEÇÃO 2: SCORES DIMENSIONAIS (FalDiagnosticSnapshot)
    // ═══════════════════════════════════════════════════════════════
    const snapshots = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
      { assessment_id: assessment_id },
      '-computed_at',
      1
    );
    const snapshot = snapshots[0];

    const dimensionScores = snapshot?.dimension_scores || {};
    const overallScore = snapshot?.overall_score || 0;
    const overallLevel = snapshot?.overall_level || 'Crítico';
    const radarPoints = snapshot?.radar_points || [];
    const activeDimensions = snapshot?.active_dimensions || [];
    const maturityIndex = snapshot?.maturity_index || 0;

    // Construir array de dimensões com scores e classificação
    const dimensionsList = (methodVersion?.dimensions || []).map((dim) => {
      const dimData = dimensionScores[dim.key] || {};
      return {
        key: dim.key,
        name: dim.name,
        score: dimData.score || 0,
        level: dimData.level || 'Crítico',
        weight_sum: dimData.weight_sum || 0,
        response_count: dimData.response_count || 0,
        active: activeDimensions?.includes(dim.key) || false,
      };
    });

    // ═══════════════════════════════════════════════════════════════
    // SEÇÃO 3: FRAGILIDADES (SystemicCrossingAnalysis)
    // ═══════════════════════════════════════════════════════════════
    const crossings = await base44.asServiceRole.entities.SystemicCrossingAnalysis.filter(
      { assessment_id: assessment_id },
      'tension_rank',
      20
    );

    // Normalizar crossings para garantir que dim_a/dim_b existam sempre
    const normalizedCrossings = crossings.map((c) => ({
      ...c,
      dim_a: c.dimension_a_key || c.dim_a,
      dim_b: c.dimension_b_key || c.dim_b,
    }));

    const topCrossings = normalizedCrossings.slice(0, 5).map((c) => ({
      crossing_key: c.crossing_key,
      crossing_label: c.crossing_label,
      dim_a: c.dim_a,
      dim_b: c.dim_b,
      cross_score_final: c.cross_score_final || 0,
      has_mqe_data: c.has_mqe_data || false,
      tension_rank: c.tension_rank || 0,
    }));

    // ═══════════════════════════════════════════════════════════════
    // SEÇÃO 4: MFIS (SystemicDimensionImpact)
    // ═══════════════════════════════════════════════════════════════
    const dimImpacts = await base44.asServiceRole.entities.SystemicDimensionImpact.filter(
      { assessment_id: assessment_id },
      '-leverage_score',
      10
    );

    const leverageDimension = dimImpacts.find((d) => d.is_systemic_leverage_point);
    const leverageDimensionLabel = leverageDimension?.dimension_label || '';

    const systemicSummary = snapshot?.methodology_log?.details || '';

    // ═══════════════════════════════════════════════════════════════
    // SEÇÃO 5: PLANO DE AÇÃO (ActionPlan + ActionTask)
    // ═══════════════════════════════════════════════════════════════
    const actionPlans = await base44.asServiceRole.entities.ActionPlan.filter(
      { assessment_id: assessment_id },
      '-created_date',
      1
    );
    const actionPlan = actionPlans[0];

    let actionTasks = [];
    if (actionPlan?.id) {
      actionTasks = await base44.asServiceRole.entities.ActionTask.filter(
        { action_plan_id: actionPlan.id },
        'priority_rank',
        50
      );
    }

    const tasksByHorizon = {
      '30d':  actionTasks.filter((t) => t.horizon === '30d'  || t.horizon === '30_days'),
      '60d':  actionTasks.filter((t) => t.horizon === '60d'  || t.horizon === '60_days'),
      '90d':  actionTasks.filter((t) => t.horizon === '90d'  || t.horizon === '90_days'  || t.time_horizon === '90'),
      '180d': actionTasks.filter((t) => t.horizon === '180d' || t.horizon === '180_days' || t.time_horizon === '180'),
    };

    // ═══════════════════════════════════════════════════════════════
    // SEÇÃO 6: CONSTRUIR PAYLOAD CANÔNICO
    // ═══════════════════════════════════════════════════════════════

    const reportPayload = {
      // Metadados
      tenant_name: tenant?.name || '',
      tenant_logo_url: tenant?.logo_url || null,
      assessment_id: assessment_id,
      assessment_date: assessment.created_date || new Date().toISOString().split('T')[0],
      method_version: methodVersion?.version_code || 'FAL v1.0',
      cycle_number: assessment.cycle_number || 1,
      competence: assessment.competence || '',

      // Metadados do relatório — parametrizados, sem hardcode
      report_metadata: {
        advisory_firm_name: tenant?.name || '',
        advisory_logo_url:  tenant?.logo_url || null,
        group_name:         groupName    || '',
        company_name:       companyName  || '',
        unit_name:          unitName     || '',
        completion_date:    assessment.completed_at || assessment.last_saved_at || assessment.created_date || new Date().toISOString(),
        recipient_label:    assessment.assigned_to  || '',
      },

      // Escopo do relatório — usado para títulos adaptativos
      report_scope: {
        level:                       assessment.target_type || 'company',
        applicable_dimensions_count: activeDimensions.length,
        applicable_dimensions:       activeDimensions,
      },

      // Entidade avaliada (retrocompat)
      cover: {
        company_name:    companyName  || groupName || '—',
        group_name:      groupName    || '—',
        unit_name:       unitName     || '',
        assessment_date: assessment.completed_at || assessment.created_date || new Date().toISOString(),
        completion_date: assessment.completed_at || assessment.last_saved_at || assessment.created_date || new Date().toISOString(),
        method_version:  methodVersion?.version_code || 'FAL v1.0',
        cycle_number:    assessment.cycle_number || 1,
        competence:      assessment.competence || '',
        tenant_name:     tenant?.name || '',
        tenant_logo_url: tenant?.logo_url || null,
      },

      // Sumário executivo
      executive_summary: {
        overall_maturity_level: overallLevel,
        overall_maturity_score: overallScore,
        overall_maturity_index: maturityIndex,
        main_systemic_tension: topCrossings[0]?.crossing_label || 'N/A',
        systemic_leverage_dimension: leverageDimensionLabel || '—',
        top_risks: topCrossings.slice(0, 3).map((c) => c.crossing_label),
        strategic_focus: '', // será preenchido pelo Narrative Engine
      },

      // Perfil de maturidade
      maturity_profile: {
        dimensions: dimensionsList,
        radar_data: radarPoints,
        level_distribution: {
          critical: dimensionsList.filter((d) => d.level === 'Crítico').length,
          basic: dimensionsList.filter((d) => d.level === 'Básico').length,
          structured: dimensionsList.filter((d) => d.level === 'Estruturado').length,
          advanced: dimensionsList.filter((d) => d.level === 'Avançado').length,
        },
      },

      // Fragilidades
      fragilities: {
        top_crossings: topCrossings,
      },

      // Análise sistêmica (MFIS)
      mfis_analysis: {
        all_crossings: normalizedCrossings,
        top_tensions: topCrossings,
        systemic_leverage_dimension: leverageDimensionLabel,
        systemic_summary_text: systemicSummary,
        dimension_impacts: dimImpacts,
      },

      // Plano de ação
      action_plan: {
        total_tasks: actionTasks.length,
        tasks_by_priority: {
          critical: actionTasks.filter((t) => t.priority === 'crítica' || t.priority === 'critical').length,
          high: actionTasks.filter((t) => t.priority === 'alta' || t.priority === 'high').length,
          medium: actionTasks.filter((t) => t.priority === 'média' || t.priority === 'medium').length,
          low: actionTasks.filter((t) => t.priority === 'baixa' || t.priority === 'low').length,
        },
        tasks_by_horizon: tasksByHorizon,
        all_tasks: actionTasks,
      },

      // Diagnóstico inteligente (será preenchido pelo Narrative Engine)
      smart_diagnosis: {
        key_findings: [],
        systemic_insights: [],
        root_causes: [],
      },

      // Prioridades estratégicas (será preenchido pelo Narrative Engine)
      strategic_priorities: [],

      // Narrativas por dimensão (será preenchido pelo Narrative Engine)
      dimension_narratives: [],

      // Leitura executiva (será preenchido pelo Narrative Engine)
      executiveReading: '',

      // Metodologia
      methodology: {
        method_version_code: methodVersion?.version_code || 'FAL v1.0',
        ifme_explanation:
          'IFME™ (Índice FAL de Maturidade Empresarial) avalia 8 dimensões organizacionais em escala 0–3.',
        mfis_explanation:
          'MFIS™ (Matriz FAL de Interdependência Sistêmica) mapeia tensões estruturais entre dimensões.',
        mqe_explanation:
          'MQE™ (Método de Qualificação da Estrutura) qualifica a integração entre pares de dimensões.',
        scale_explanation: 'Escala: 0=Crítico, 1=Básico, 2=Estruturado, 3=Avançado.',
      },
    };

    // Retornar payload estruturado puro (enriquecimento será feito no frontend via narrativeEngine.js)
    return Response.json(reportPayload);
  } catch (error) {
    console.error('[buildReportPayload] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});