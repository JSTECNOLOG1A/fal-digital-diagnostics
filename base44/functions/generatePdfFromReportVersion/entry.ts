/**
 * generatePdfFromReportVersion
 * Gera o PDF real a partir do payload_snapshot de um AssessmentReportVersion.
 * 
 * REGRA CRÍTICA: o PDF é gerado a partir do payload_snapshot (imutável),
 * nunca diretamente do estado atual mutável do assessment.
 * 
 * Fluxo:
 * 1. Carrega AssessmentReportVersion pelo ID
 * 2. Valida tenant e status
 * 3. Usa payload_snapshot para montar o payload do ReportPreview
 * 4. Retorna a URL de preview — o PDF é gerado no frontend via html2canvas/jsPDF
 *    OU retorna o payload pronto para o ReportRenderer fazer o PDF
 * 
 * Nota: a geração de PDF binário no Deno é complexa.
 * Esta função retorna o payload canônico + preview_url para que o frontend
 * renderize e faça download. Esta é a arquitetura existente do sistema (ReportPreview/ReportRenderer).
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

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { report_version_id } = body;
    if (!report_version_id) return Response.json({ error: 'report_version_id obrigatório' }, { status: 400 });

    // Carregar a versão do relatório
    const version = await base44.asServiceRole.entities.AssessmentReportVersion.get(report_version_id);
    if (!version) return Response.json({ error: 'Versão de relatório não encontrada' }, { status: 404 });

    // Guard: tenant
    if (!isHQ && version.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: relatório pertence a outro tenant' }, { status: 403 });
    }

    // Guard: payload_snapshot obrigatório
    if (!version.payload_snapshot) {
      return Response.json({ error: 'payload_snapshot ausente. Este relatório não pode ser reproduzido — regenere-o pela Central de Relatórios.' }, { status: 422 });
    }

    const snap = version.payload_snapshot;

    // Montar payload canônico compatível com buildReportPayload / ReportPreview
    // O payload é extraído do snapshot imutável — nunca do estado atual do assessment
    const assessmentId = version.assessment_id;
    const assessment = snap.assessment || {};

    // Tentar carregar dados extras que o ReportPreview precisa (tenant, methodVersion)
    let tenantData = null;
    let methodVersion = null;
    try {
      if (assessment.tenant_id) {
        tenantData = await base44.asServiceRole.entities.Tenant.get(assessment.tenant_id);
      }
      const assessmentFull = await base44.asServiceRole.entities.Assessment.get(assessmentId);
      if (assessmentFull?.method_version_id) {
        methodVersion = await base44.asServiceRole.entities.MethodVersion.get(assessmentFull.method_version_id);
      }
    } catch (_) { /* best-effort */ }

    // Montar payload canônico para o ReportRenderer/ReportPreview
    const diagSnap = snap.diagnostic_snapshot || {};
    const tasks = snap.tasks || [];
    const planKpis = snap.plan_kpis || {};
    const reviews = snap.reviews || [];
    const priorities = snap.priority_snapshot || {};

    const dimensionScores = diagSnap.dimension_scores || {};
    const dimensionsList = Object.entries(dimensionScores).map(([key, data]) => ({
      key,
      name: DIM_LABELS[key] || key,
      score: data.score || 0,
      level: data.level || 'Crítico',
      active: data.active !== false,
    }));

    const tasksByHorizon = {
      '30d':  tasks.filter(t => t.horizon === '30d'),
      '60d':  tasks.filter(t => t.horizon === '60d'),
      '90d':  tasks.filter(t => t.horizon === '90d'),
      '180d': tasks.filter(t => t.horizon === '180d'),
    };

    const reportPayload = {
      // Metadados
      assessment_id: assessmentId,
      report_code: version.report_code,
      report_type: version.report_type,
      report_title: version.report_title,
      report_version_number: version.report_version_number,
      generated_at: version.generated_at,
      generated_by: version.generated_by,
      mark_as_official: version.mark_as_official,
      is_from_snapshot: true, // Flag para o renderer saber que vem do snapshot
      
      tenant_name: tenantData?.name || '',
      tenant_logo_url: tenantData?.logo_url || null,
      method_version: methodVersion?.version_code || 'FAL v1.0',
      competence: assessment.competence || '',
      cycle_number: assessment.cycle_number || 1,

      report_metadata: {
        advisory_firm_name: tenantData?.name || '',
        advisory_logo_url: tenantData?.logo_url || null,
        completion_date: version.generated_at,
      },

      cover: {
        company_name: '—',
        group_name: '—',
        assessment_date: assessment.competence || version.generated_at,
        completion_date: version.generated_at,
        method_version: methodVersion?.version_code || 'FAL v1.0',
        cycle_number: assessment.cycle_number || 1,
        tenant_name: tenantData?.name || '',
        tenant_logo_url: tenantData?.logo_url || null,
      },

      executive_summary: {
        overall_maturity_level: diagSnap.overall_level || 'N/A',
        overall_maturity_score: diagSnap.overall_score || 0,
        overall_maturity_index: diagSnap.ifme_final || diagSnap.overall_score || 0,
      },

      maturity_profile: {
        dimensions: dimensionsList,
        radar_data: diagSnap.radar_points || [],
        level_distribution: {
          critical: dimensionsList.filter(d => d.level === 'Crítico').length,
          basic: dimensionsList.filter(d => d.level === 'Básico').length,
          structured: dimensionsList.filter(d => d.level === 'Estruturado').length,
          advanced: dimensionsList.filter(d => d.level === 'Avançado').length,
        },
      },

      action_plan: {
        total_tasks: tasks.length,
        tasks_by_priority: {
          critical: tasks.filter(t => t.priority === 'critical').length,
          high: tasks.filter(t => t.priority === 'high').length,
          medium: tasks.filter(t => t.priority === 'medium').length,
          low: tasks.filter(t => t.priority === 'low').length,
        },
        tasks_by_horizon: tasksByHorizon,
        all_tasks: tasks,
        kpis: planKpis,
      },

      reviews,
      report_parameters: version.report_parameters || {},

      methodology: {
        method_version_code: methodVersion?.version_code || 'FAL v1.0',
        ifme_explanation: 'IFME™ (Índice FAL de Maturidade Empresarial) avalia 8 dimensões organizacionais em escala 0–3.',
        scale_explanation: 'Escala: 0=Crítico, 1=Básico, 2=Estruturado, 3=Avançado.',
      },
    };

    // Construir preview_url para o ReportPreview renderizar este payload
    const previewUrl = `/ReportPreview?report_version_id=${report_version_id}&from_snapshot=true`;

    return Response.json({
      report_version_id,
      report_code: version.report_code,
      payload: reportPayload,
      preview_url: previewUrl,
      assessment_id: assessmentId,
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});

const DIM_LABELS = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal/Tributário',
  operacional: 'Operacional', sistemas: 'Tecnologia',
};