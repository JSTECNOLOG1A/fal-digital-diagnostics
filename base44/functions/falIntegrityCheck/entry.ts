/**
 * falIntegrityCheck — FAL Data Integrity Validator
 *
 * Valida integridade estrutural dos dados FAL:
 * - Perguntas sem cluster/subdimensão
 * - Action library com duplicatas
 * - Respostas órfãs (sem assessment válido)
 * - Snapshots sem tenant_id
 * - Isolamento multi-tenant
 *
 * Payload: { assessment_id? } — se fornecido, valida especificamente o assessment
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const VALID_DIMENSIONS = [
  'governanca', 'juridico', 'controles_internos', 'financeiro',
  'contabil', 'tributario', 'operacional', 'sistemas'
];

const VALID_PROCESS_STAGES = [
  'existence', 'request', 'analysis', 'approval',
  'execution', 'record', 'control', 'monitoring', 'audit'
];

function issue(severity, category, message, data = {}) {
  return { severity, category, message, ...data };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user   = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['hq_admin', 'admin', 'method_admin', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const body         = await req.json().catch(() => ({}));
    const assessmentId = body.assessment_id || null;

    // ── SEG-02: When assessment_id is provided, validate tenant for non-HQ ──────
    const isHQ = appRole === 'hq_admin';
    if (assessmentId && !isHQ) {
      const assessment = await base44.asServiceRole.entities.Assessment.get(assessmentId);
      if (assessment && assessment.tenant_id !== user.tenant_id) {
        return Response.json({ error: 'Forbidden: assessment belongs to another tenant' }, { status: 403 });
      }
    }

    const issues   = [];
    const warnings = [];
    const info     = [];
    const start    = Date.now();

    // ── 1. Validar banco de perguntas ────────────────────────────────────────
    console.log('[falIntegrityCheck] Validando banco de perguntas...');
    const allQuestions = await base44.asServiceRole.entities.FalQuestion.list('-created_date', 1000);
    info.push(`Total de perguntas no banco: ${allQuestions.length}`);

    for (const q of allQuestions) {
      const qRef = q.question_id || q.id;

      if (!q.dimension_key || q.dimension_key.trim() === '') {
        issues.push(issue('error', 'question_integrity',
          `Pergunta ${qRef} sem dimension_key`, { question_id: q.id }));
      } else if (!VALID_DIMENSIONS.includes(q.dimension_key)) {
        issues.push(issue('warning', 'question_integrity',
          `Pergunta ${qRef} com dimension_key inválido: "${q.dimension_key}"`,
          { question_id: q.id, dimension_key: q.dimension_key }));
      }

      if (!q.subdimension_key || q.subdimension_key.trim() === '') {
        issues.push(issue('error', 'question_integrity',
          `Pergunta ${qRef} sem subdimension_key`, { question_id: q.id }));
      }

      if (!q.cluster_key || q.cluster_key.trim() === '') {
        issues.push(issue('error', 'question_integrity',
          `Pergunta ${qRef} sem cluster_key`, { question_id: q.id }));
      }

      if (!q.question_text || q.question_text.trim() === '') {
        issues.push(issue('error', 'question_integrity',
          `Pergunta ${q.id} sem question_text`, { question_id: q.id }));
      }

      if (!q.diagnostic_depth || (Array.isArray(q.diagnostic_depth) && q.diagnostic_depth.length === 0)) {
        warnings.push(issue('warning', 'question_integrity',
          `Pergunta ${qRef} sem diagnostic_depth — não será selecionada`,
          { question_id: q.id }));
      }

      if (!q.level_applicability || (Array.isArray(q.level_applicability) && q.level_applicability.length === 0)) {
        warnings.push(issue('warning', 'question_integrity',
          `Pergunta ${qRef} sem level_applicability`,
          { question_id: q.id }));
      }
    }

    // ── 2. Validar FalActionLibrary ─────────────────────────────────────────
    console.log('[falIntegrityCheck] Validando catálogo de ações...');
    const globalActions = await base44.asServiceRole.entities.FalActionLibrary
      .filter({ tenant_id: 'global', active: true }, '-created_date', 500).catch(() => []);

    const actionKeysSeen = new Map();
    for (const a of globalActions) {
      if (!a.action_key) {
        issues.push(issue('error', 'action_library',
          `Ação ${a.id} sem action_key`));
        continue;
      }
      if (actionKeysSeen.has(a.action_key)) {
        issues.push(issue('error', 'action_library',
          `action_key duplicado: "${a.action_key}" (ids: ${actionKeysSeen.get(a.action_key)}, ${a.id})`,
          { action_key: a.action_key }));
      } else {
        actionKeysSeen.set(a.action_key, a.id);
      }

      if (!a.dimension_key || !VALID_DIMENSIONS.includes(a.dimension_key)) {
        warnings.push(issue('warning', 'action_library',
          `Ação "${a.action_key}" com dimension_key inválido: "${a.dimension_key}"`,
          { action_key: a.action_key }));
      }
    }
    info.push(`Total de ações globais no catálogo: ${globalActions.length}`);

    // ── 3. Validar FalMethodologyConfig ─────────────────────────────────────
    console.log('[falIntegrityCheck] Validando configurações metodológicas...');
    const activeConfigs = await base44.asServiceRole.entities.FalMethodologyConfig
      .filter({ status: 'active' }, '-activated_at', 20).catch(() => []);

    const globalActiveCount = activeConfigs.filter(c => c.tenant_id === 'global').length;
    if (globalActiveCount === 0) {
      warnings.push(issue('warning', 'methodology_config',
        'Nenhuma FalMethodologyConfig global ativa — motor usará configuração embutida (builtin)'));
    } else if (globalActiveCount > 1) {
      issues.push(issue('error', 'methodology_config',
        `Múltiplas configs globais ativas (${globalActiveCount}) — apenas 1 deve estar ativa`));
    }

    // Duplicatas ativas por tenant
    const activeByTenant = {};
    for (const c of activeConfigs) {
      if (!activeByTenant[c.tenant_id]) activeByTenant[c.tenant_id] = 0;
      activeByTenant[c.tenant_id]++;
    }
    for (const [tenantId, count] of Object.entries(activeByTenant)) {
      if (count > 1) {
        issues.push(issue('error', 'methodology_config',
          `Tenant ${tenantId} com ${count} configs ativas — risco de comportamento inconsistente`));
      }
    }

    // ── 4. Validar assessment específico (se fornecido) ──────────────────────
    if (assessmentId) {
      console.log(`[falIntegrityCheck] Validando assessment ${assessmentId}...`);

      const assessment = await base44.asServiceRole.entities.Assessment.get(assessmentId);
      if (!assessment) {
        issues.push(issue('error', 'assessment', `Assessment ${assessmentId} não encontrado`));
      } else {
        // Tenant isolation
        if (!assessment.tenant_id) {
          issues.push(issue('error', 'tenant_isolation',
            `Assessment ${assessmentId} sem tenant_id — violação de isolamento`));
        }

        // question_set — verificar existência de cada pergunta
        const qSet = assessment.question_set || [];
        if (qSet.length === 0) {
          warnings.push(issue('warning', 'assessment',
            `Assessment ${assessmentId} sem question_set`));
        } else {
          const qMap = new Map(allQuestions.map(q => [q.id, q]));
          const orphanIds = qSet.filter(id => !qMap.has(id));
          if (orphanIds.length > 0) {
            issues.push(issue('error', 'assessment',
              `${orphanIds.length} pergunta(s) no question_set não encontrada(s) no banco`,
              { assessment_id: assessmentId, orphan_ids: orphanIds.slice(0, 10) }));
          }

          // Verificar perguntas sem cluster dentro do set
          const setQs = qSet.map(id => qMap.get(id)).filter(Boolean);
          const noCluster = setQs.filter(q => !q.cluster_key);
          if (noCluster.length > 0) {
            issues.push(issue('error', 'assessment',
              `${noCluster.length} pergunta(s) no question_set sem cluster_key`,
              { question_ids: noCluster.map(q => q.id).slice(0, 5) }));
          }
        }

        // Respostas — verificar tenant_id e score range
        const responses = await base44.asServiceRole.entities.FalResponse
          .filter({ assessment_id: assessmentId }, '-created_date', 1000);

        const badTenant  = responses.filter(r => r.tenant_id !== assessment.tenant_id);
        const badScore   = responses.filter(r => typeof r.score !== 'number' || r.score < 0 || r.score > 3);
        const noQuestion = responses.filter(r => !r.fal_question_id);

        if (badTenant.length > 0) {
          issues.push(issue('critical', 'tenant_isolation',
            `${badTenant.length} resposta(s) com tenant_id diferente do assessment — VIOLAÇÃO CRÍTICA`,
            { assessment_id: assessmentId }));
        }
        if (badScore.length > 0) {
          issues.push(issue('error', 'data_integrity',
            `${badScore.length} resposta(s) com score fora do range [0-3]`,
            { assessment_id: assessmentId }));
        }
        if (noQuestion.length > 0) {
          issues.push(issue('error', 'data_integrity',
            `${noQuestion.length} resposta(s) sem fal_question_id`,
            { assessment_id: assessmentId }));
        }

        info.push(`Respostas validadas para assessment ${assessmentId}: ${responses.length}`);
      }
    }

    // ── 5. Checar isolamento multi-tenant (amostral) ─────────────────────────
    console.log('[falIntegrityCheck] Verificando isolamento multi-tenant...');
    const recentSnapshots = await base44.asServiceRole.entities.FalDiagnosticSnapshot
      .list('-computed_at', 20).catch(() => []);

    const noTenant = recentSnapshots.filter(s => !s.tenant_id);
    if (noTenant.length > 0) {
      issues.push(issue('critical', 'tenant_isolation',
        `${noTenant.length} FalDiagnosticSnapshot(s) sem tenant_id — VIOLAÇÃO CRÍTICA`));
    }

    const recentTasks = await base44.asServiceRole.entities.ActionTask
      .list('-created_date', 20).catch(() => []);
    const taskNoTenant = recentTasks.filter(t => !t.tenant_id);
    if (taskNoTenant.length > 0) {
      issues.push(issue('critical', 'tenant_isolation',
        `${taskNoTenant.length} ActionTask(s) recentes sem tenant_id — VIOLAÇÃO CRÍTICA`));
    }

    const elapsed = Date.now() - start;
    const criticals = issues.filter(i => i.severity === 'critical').length;
    const errors    = issues.filter(i => i.severity === 'error').length;
    const warningCount = [...issues, ...warnings].filter(i => i.severity === 'warning').length;

    const healthy = criticals === 0 && errors === 0;

    console.log(`[falIntegrityCheck] Done — healthy=${healthy} criticals=${criticals} errors=${errors} warnings=${warningCount} in ${elapsed}ms`);

    return Response.json({
      healthy,
      summary: {
        criticals,
        errors,
        warnings: warningCount,
        info_count: info.length,
        elapsed_ms: elapsed,
        questions_checked: allQuestions.length,
        actions_checked: globalActions.length,
      },
      issues: [...issues, ...warnings],
      info,
    }, { status: healthy ? 200 : 422 });

  } catch (error) {
    console.error('[falIntegrityCheck] Fatal:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});