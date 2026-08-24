/**
 * swapFalQuestion
 *
 * Substitui uma pergunta no question_set de um assessment FAL de forma
 * metodologicamente controlada, com auditoria completa.
 *
 * Payload:
 *   { assessment_id, original_question_id, swap_reason, swap_reason_label }
 *
 * Regra de seleção da substituta (prioridade decrescente):
 *   1. mesmo cluster
 *   2. mesma subdimensão (fallback)
 *   3. mesma dimensão (fallback final, com aviso)
 *   + mesma aplicabilidade ao alvo (level, setor, tipo de unidade)
 *   + não estar já no question_set
 *   + não ter sido já uma substituta (sem cascata)
 *
 * Limite de segurança:
 *   - Uma pergunta só pode ser substituída 1 vez (original_question_id único por assessment)
 *   - Substituta não pode ser original de outra troca no mesmo assessment
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

const DIMENSION_APPLICABILITY = {
  group:   { governanca: true, juridico: true, controles_internos: false, financeiro: false, contabil: false, tributario: false, operacional: false, sistemas: false },
  company: { governanca: true, juridico: true, controles_internos: true,  financeiro: true,  contabil: true,  tributario: true,  operacional: true,  sistemas: true  },
  unit:    { governanca: false, juridico: false, controles_internos: true,  financeiro: true,  contabil: true,  tributario: true,  operacional: true,  sistemas: true  },
};

function isQuestionApplicable(question, targetType, unitType, sectorSnapshot) {
  const dimKey = question.dimension_key;
  if (!DIMENSION_APPLICABILITY[targetType]?.[dimKey]) return false;

  const questionLevels = question.level_applicability || ['group', 'company', 'unit'];
  if (!questionLevels.includes(targetType)) return false;

  if (targetType === 'unit' && unitType && question.unit_type_applicability?.length > 0) {
    if (!question.unit_type_applicability.includes(unitType)) return false;
  }

  const raw = (question.sector_applicability || 'all').toLowerCase();
  if (raw && raw !== 'all' && raw !== 'todos' && raw !== 'geral') {
    const sectors = raw.split(/[;,]/).map(s => s.trim());
    if (!sectors.some(s => sectorSnapshot.includes(s))) return false;
  }

  return true;
}

function pickCandidate(pool, currentSet, swappedOutIds, replacementIds) {
  // Excluir: já no set, já substituídas, já usadas como substitutas (sem cascata)
  const excluded = new Set([...currentSet, ...swappedOutIds, ...replacementIds]);
  // Ordenar por peso desc
  const sorted = pool
    .filter(q => !excluded.has(q.id))
    .sort((a, b) => (b.question_weight || 1) - (a.question_weight || 1));
  return sorted[0] || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: HQ admin only' }, { status: 403 });

    const { assessment_id, original_question_id, swap_reason, swap_reason_label } = await req.json();

    if (!assessment_id || !original_question_id || !swap_reason) {
      return Response.json({ error: 'assessment_id, original_question_id e swap_reason são obrigatórios' }, { status: 400 });
    }

    // Carregar assessment
    const assessment = await base44.entities.Assessment.get(assessment_id);
    if (!assessment) return Response.json({ error: 'Assessment não encontrado' }, { status: 404 });

    const currentSet = assessment.question_set || [];

    // Verificar se a pergunta original está no set
    if (!currentSet.includes(original_question_id)) {
      return Response.json({ error: 'Pergunta não encontrada no question_set deste assessment' }, { status: 400 });
    }

    // Carregar histórico de trocas deste assessment
    const existingSwaps = await base44.asServiceRole.entities.FalQuestionSwap.filter({ assessment_id });

    // Verificar limite: pergunta já foi substituída?
    const alreadySwapped = existingSwaps.find(s => s.original_question_id === original_question_id);
    if (alreadySwapped) {
      return Response.json({
        error: 'Esta pergunta já foi substituída anteriormente. Não é permitido substituir uma pergunta mais de uma vez.',
        swap_record: alreadySwapped,
      }, { status: 409 });
    }

    // Ids das perguntas já substituídas (fora do set por swap) — não podem ser reintroduzidas
    const swappedOutIds = new Set(existingSwaps.map(s => s.original_question_id));
    // Ids que já são substitutas (não podem ser substitutas de novo para evitar cascata)
    const replacementIds = new Set(existingSwaps.map(s => s.replacement_question_id));

    // Carregar a pergunta original
    const originalQuestion = await base44.entities.FalQuestion.get(original_question_id);
    if (!originalQuestion) return Response.json({ error: 'Pergunta original não encontrada no banco' }, { status: 404 });

    // Resolver unit_type se aplicável
    let unitType = null;
    if (assessment.target_type === 'unit' && assessment.unit_id) {
      const unit = await base44.entities.OperationalUnit.get(assessment.unit_id);
      unitType = unit?.unit_type?.toLowerCase() || null;
    }

    const sectorSnapshot = assessment.sector_snapshot?.length ? assessment.sector_snapshot : ['general_business'];
    const targetType = assessment.target_type || 'company';

    // Carregar todas as perguntas do banco
    const allQuestions = await base44.entities.FalQuestion.list();

    // Pool de candidatas elegíveis (mesma dimensão, aplicável, ativas)
    const dimKey = originalQuestion.dimension_key;
    const subdimKey = originalQuestion.subdimension_key;
    const clusterKey = originalQuestion.cluster_key;

    const eligiblePool = allQuestions.filter(q =>
      q.id !== original_question_id &&
      q.dimension_key === dimKey &&
      isQuestionApplicable(q, targetType, unitType, sectorSnapshot)
    );

    // Tentativa 1: mesmo cluster
    let candidate = null;
    let fallbackLevel = null;

    if (clusterKey) {
      const clusterPool = eligiblePool.filter(q => q.cluster_key === clusterKey);
      candidate = pickCandidate(clusterPool, currentSet, swappedOutIds, replacementIds);
      if (candidate) fallbackLevel = 'cluster';
    }

    // Tentativa 2: mesma subdimensão
    if (!candidate && subdimKey) {
      const subdimPool = eligiblePool.filter(q =>
        q.subdimension_key === subdimKey &&
        q.id !== original_question_id
      );
      candidate = pickCandidate(subdimPool, currentSet, swappedOutIds, replacementIds);
      if (candidate) fallbackLevel = 'subdimension';
    }

    // Tentativa 3: mesma dimensão (fallback final)
    if (!candidate) {
      candidate = pickCandidate(eligiblePool, currentSet, swappedOutIds, replacementIds);
      if (candidate) fallbackLevel = 'dimension';
    }

    if (!candidate) {
      return Response.json({
        error: 'Não há pergunta substituta disponível para esta pergunta no momento. Todas as perguntas elegíveis da dimensão já estão no questionário ou foram utilizadas como substitutas.',
        original_question_id,
        dimension: dimKey,
        subdimension: subdimKey,
        cluster: clusterKey,
      }, { status: 422 });
    }

    // Montar novo question_set: substituir in-place
    const newQuestionSet = currentSet.map(id => id === original_question_id ? candidate.id : id);

    // Persistir: atualizar assessment + criar registro de auditoria
    await base44.entities.Assessment.update(assessment_id, {
      question_set: newQuestionSet,
    });

    const swapRecord = await base44.asServiceRole.entities.FalQuestionSwap.create({
      tenant_id: assessment.tenant_id,
      assessment_id,
      original_question_id,
      replacement_question_id: candidate.id,
      dimension_key: dimKey,
      subdimension_key: subdimKey || null,
      cluster_key: clusterKey || null,
      swap_reason,
      swap_reason_label: swap_reason_label || swap_reason,
      fallback_level: fallbackLevel,
      swapped_by: user.email,
      swapped_at: new Date().toISOString(),
    });

    console.log(`[swapFalQuestion] OK — assessment=${assessment_id} original=${original_question_id} replacement=${candidate.id} level=${fallbackLevel} reason=${swap_reason} user=${user.email}`);

    return Response.json({
      success: true,
      original_question_id,
      replacement_question_id: candidate.id,
      replacement_question: {
        id: candidate.id,
        code: candidate.code,
        question_text: candidate.question_text,
        dimension_key: candidate.dimension_key,
        subdimension_key: candidate.subdimension_key,
        cluster_key: candidate.cluster_key,
        question_weight: candidate.question_weight || 1,
        diagnostic_depth: candidate.diagnostic_depth || 'rapid',
      },
      fallback_level: fallbackLevel,
      swap_record: swapRecord,
    });

  } catch (error) {
    console.error('[swapFalQuestion] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});