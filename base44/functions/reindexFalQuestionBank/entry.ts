/**
 * reindexFalQuestionBank
 *
 * Valida a consistência do banco FAL.
 * Dimensões válidas são em PORTUGUÊS (padrão do sistema).
 * NÃO cria, altera ou deleta perguntas.
 *
 * Admin-only. Payload: {}
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

const VALID_DIMS   = ['governanca','juridico','controles_internos','financeiro','contabil','tributario','operacional','sistemas'];
const VALID_STAGES = ['existence','request','analysis','approval','execution','record','control','monitoring','audit'];
const VALID_DEPTHS = ['rapid','standard','deep'];

// Dimensões em inglês — não devem existir no banco PT
const LEGACY_DIMS_EN = ['governance','legal','internal_controls','financial','accounting','tax','operations','technology'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!appRole === 'hq_admin') {
      return Response.json({ error: 'Forbidden: Admin apenas' }, { status: 403 });
    }

    console.log('[reindexFalQuestionBank] Iniciando validação...');

    const allQuestions = await base44.asServiceRole.entities.FalQuestion.list();
    const total = allQuestions.length;

    if (total === 0) {
      return Response.json({
        status: 'error',
        message: 'Banco FAL está vazio.',
        total: 0,
      }, { status: 422 });
    }

    // Contagens por depth
    const byDepth = { rapid: 0, standard: 0, deep: 0 };
    for (const q of allQuestions) {
      const depths = Array.isArray(q.diagnostic_depth)
        ? q.diagnostic_depth
        : (q.diagnostic_depth || '').split(/[,;]/).map(d => d.trim());
      for (const d of depths) {
        if (VALID_DEPTHS.includes(d)) byDepth[d]++;
      }
    }

    // Contagens por dimension_key
    const byDim = {};
    for (const q of allQuestions) {
      const d = q.dimension_key || '(sem dimension_key)';
      byDim[d] = (byDim[d] || 0) + 1;
    }

    // Detectar dimensões em inglês (devem ser migradas)
    const legacyEnQuestions = allQuestions.filter(q => LEGACY_DIMS_EN.includes(q.dimension_key));

    // Detectar campos obrigatórios ausentes
    const missingFields = allQuestions.filter(q =>
      !q.question_id || !q.dimension_key || !q.subdimension_key ||
      !q.cluster_key || !q.process_stage || !q.question_text ||
      !q.diagnostic_depth || !q.level_applicability
    ).map(q => ({ id: q.id, question_id: q.question_id, dimension_key: q.dimension_key, issues: [
      !q.question_id && 'question_id ausente',
      !q.dimension_key && 'dimension_key ausente',
      !q.subdimension_key && 'subdimension_key ausente',
      !q.cluster_key && 'cluster_key ausente',
      !q.process_stage && 'process_stage ausente',
      !q.question_text && 'question_text ausente',
      !q.diagnostic_depth && 'diagnostic_depth ausente',
      !q.level_applicability && 'level_applicability ausente',
    ].filter(Boolean) }));

    // Detectar process_stage inválido
    const invalidStage = allQuestions
      .filter(q => q.process_stage && !VALID_STAGES.includes(q.process_stage))
      .map(q => ({ question_id: q.question_id, process_stage: q.process_stage }));

    // Detectar question_id duplicado
    const idCount = {};
    for (const q of allQuestions) {
      if (q.question_id) idCount[q.question_id] = (idCount[q.question_id] || 0) + 1;
    }
    const duplicateIds = Object.entries(idCount).filter(([, c]) => c > 1).map(([id]) => id);

    const hasErrors = legacyEnQuestions.length > 0 || missingFields.length > 0 || duplicateIds.length > 0;
    const hasWarnings = invalidStage.length > 0;
    const status = hasErrors ? 'errors' : hasWarnings ? 'warnings' : 'ok';

    console.log(`[reindexFalQuestionBank] total=${total} status=${status} legacy_en=${legacyEnQuestions.length} missing=${missingFields.length} duplicates=${duplicateIds.length}`);

    return Response.json({
      status,
      total_questions: total,
      by_depth: byDepth,
      by_dimension: byDim,
      valid_dimensions: VALID_DIMS,
      issues: {
        legacy_en_dimension_count: legacyEnQuestions.length,
        legacy_en_samples: legacyEnQuestions.slice(0,5).map(q => ({ id: q.id, dimension_key: q.dimension_key, question_id: q.question_id })),
        missing_required_fields_count: missingFields.length,
        missing_required_fields_samples: missingFields.slice(0,5),
        invalid_process_stage_count: invalidStage.length,
        invalid_process_stage_samples: invalidStage.slice(0,5),
        duplicate_question_ids_count: duplicateIds.length,
        duplicate_question_ids: duplicateIds.slice(0,10),
      },
      message: status === 'ok'
        ? 'Banco FAL íntegro. Nenhuma inconsistência encontrada.'
        : legacyEnQuestions.length > 0
          ? `${legacyEnQuestions.length} perguntas com dimension_key em inglês — use migrateFalDimKeys para corrigir.`
          : `Banco com ${hasErrors ? 'erros' : 'avisos'}. Verifique "issues".`,
    });

  } catch (error) {
    console.error('[reindexFalQuestionBank] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});