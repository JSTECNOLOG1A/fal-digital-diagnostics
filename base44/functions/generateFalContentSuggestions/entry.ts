/**
 * generateFalContentSuggestions
 *
 * Copiloto de IA do banco FAL — gera RASCUNHOS de novo conteúdo (perguntas
 * ou recomendações) para um cluster, considerando o que já existe (evita
 * redundância) e o padrão metodológico do FAL.
 *
 * IMPORTANTE: isso é um copiloto que PROPÕE, não um agente que publica
 * sozinho. Toda sugestão nasce com status="pending" em FalContentSuggestion
 * e só vira registro real (FalQuestion ou FalRecommendationLibrary) quando
 * um consultor aprova (reviewFalContentSuggestion) — mesma convenção de
 * "revisar antes de publicar" já usada em generateInsights/
 * generateActionRecommendations.
 *
 * Payload:
 *   content_type: 'question' | 'recommendation' (default 'question')
 *   cluster_key (obrigatório)
 *   count?: number (default 3, só para 'question')
 *   trigger_score?: 0|1|2|3 (obrigatório para 'recommendation' — faixa de
 *     maturidade: 0=crítico/estrutural, 1=corretiva, 2=melhoria, 3=monitoramento)
 *   requested_by?: string
 * Apenas HQ Admin / Consultant.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}
const WRITE_ROLES = new Set(['hq_admin', 'consultant']);

const VALID_STAGES = ['existence', 'request', 'analysis', 'approval', 'execution', 'record', 'control', 'monitoring', 'audit'];
const VALID_DEPTHS = ['rapid', 'standard', 'deep'];
const VALID_LEVELS = ['group', 'company', 'unit'];
const MAX_COUNT = 8;

const RATING_LABEL = {
  0: 'crítico — recomendação estrutural (redesenhar a base do processo)',
  1: 'parcial — recomendação corretiva (corrigir falhas relevantes)',
  2: 'razoável — recomendação de melhoria (elevar a maturidade)',
  3: 'satisfatório — sem ação corretiva, só monitoramento',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const appRole = resolveAppRole(user);
    if (!WRITE_ROLES.has(appRole)) {
      return Response.json({ error: 'Forbidden: apenas HQ admin ou consultor' }, { status: 403 });
    }

    const body = await req.json();
    const { cluster_key, requested_by } = body;
    const contentType = body.content_type === 'recommendation' ? 'recommendation' : 'question';
    const trigger = body.trigger === 'gap_detected' ? 'gap_detected' : 'manual';
    if (!cluster_key) return Response.json({ error: 'cluster_key é obrigatório' }, { status: 400 });

    const existingQuestions = await base44.asServiceRole.entities.FalQuestion.filter({ cluster_key }, 'sequence_order', 200);
    if (existingQuestions.length === 0) {
      return Response.json({ error: `Nenhuma pergunta existente encontrada para cluster_key="${cluster_key}" — não é possível inferir dimensão/subdimensão sem pelo menos 1 pergunta de referência no cluster.` }, { status: 404 });
    }
    const { dimension_key, subdimension_key } = existingQuestions[0];
    const existingTexts = existingQuestions.map((q) => q.question_text).filter(Boolean);

    if (contentType === 'question') {
      return await generateQuestions({ base44, user, cluster_key, dimension_key, subdimension_key, existingQuestions, existingTexts, count: Math.min(Number(body.count) || 3, MAX_COUNT), requested_by, trigger });
    }
    return await generateRecommendation({ base44, user, cluster_key, dimension_key, subdimension_key, existingTexts, triggerScore: body.trigger_score, requested_by, trigger });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});

async function generateQuestions({ base44, user, cluster_key, dimension_key, subdimension_key, existingQuestions, existingTexts, count, requested_by, trigger }) {
  const maxSeq = Math.max(0, ...existingQuestions.map((q) => q.sequence_order || 0));

  const prompt = `Você é um especialista em metodologia de diagnóstico empresarial (Método FAL), gerando novas perguntas de diagnóstico para complementar um banco existente.

Dimensão: ${dimension_key}
Subdimensão: ${subdimension_key}
Cluster: ${cluster_key}

Perguntas JÁ EXISTENTES neste cluster (NÃO repita o mesmo conteúdo, mesmo com palavras diferentes):
${existingTexts.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Gere ${count} NOVAS perguntas de diagnóstico para este cluster, que:
- Sejam formuladas como pergunta fechada (existe/há/a empresa possui...?), no estilo das perguntas existentes acima.
- Cubram um aspecto do processo ainda NÃO coberto pelas perguntas existentes (ex.: se todas já cobrem "existência", proponha perguntas de "controle", "monitoramento" ou "auditoria" do mesmo tema).
- Sejam objetivas, verificáveis por evidência documental, e específicas do tema do cluster — nunca genéricas.
- process_stage de cada pergunta deve ser um destes: ${VALID_STAGES.join(', ')}.
- diagnostic_depth: array com 1 ou mais de: ${VALID_DEPTHS.join(', ')} (rapid = pergunta essencial; deep = pergunta de aprofundamento).
- level_applicability: array com 1 ou mais de: ${VALID_LEVELS.join(', ')}.`;

  let generated;
  try {
    generated = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question_text: { type: 'string' },
                process_stage: { type: 'string', enum: VALID_STAGES },
                diagnostic_depth: { type: 'array', items: { type: 'string', enum: VALID_DEPTHS } },
                level_applicability: { type: 'array', items: { type: 'string', enum: VALID_LEVELS } },
                guidance: { type: 'string' },
                evidence_hint: { type: 'string' },
                rationale: { type: 'string', description: 'Por que essa pergunta complementa (não repete) o que já existe.' },
              },
            },
          },
        },
      },
    });
  } catch (llmErr) {
    return Response.json({ error: `Falha ao gerar sugestões via IA: ${llmErr.message}` }, { status: 502 });
  }

  const items = (generated?.questions || []).slice(0, count);
  if (items.length === 0) {
    return Response.json({ error: 'IA não retornou nenhuma sugestão válida.' }, { status: 502 });
  }

  const created = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const draft_payload = {
      question_id: `${cluster_key.replace(/_cluster$/, '')}_ia_${Date.now()}_${i}`,
      dimension_key,
      subdimension_key,
      cluster_key,
      process_stage: VALID_STAGES.includes(item.process_stage) ? item.process_stage : 'existence',
      sequence_order: maxSeq + i + 1,
      diagnostic_depth: (item.diagnostic_depth || []).filter((d) => VALID_DEPTHS.includes(d)),
      level_applicability: (item.level_applicability || []).filter((l) => VALID_LEVELS.includes(l)),
      question_weight: 1,
      question_text: item.question_text || '',
      guidance: item.guidance || '',
      evidence_hint: item.evidence_hint || '',
    };

    const suggestion = await base44.asServiceRole.entities.FalContentSuggestion.create({
      tenant_id: null,
      content_type: 'question',
      dimension_key,
      subdimension_key,
      cluster_key,
      trigger,
      requested_by: requested_by || user.email,
      model_used: 'base44-invoke-llm',
      prompt_context_summary: `${existingTexts.length} pergunta(s) existente(s) consideradas para evitar redundância.`,
      draft_payload,
      status: 'pending',
    });
    created.push({ ...suggestion, rationale: item.rationale || '' });
  }

  return Response.json({ success: true, created_count: created.length, suggestions: created });
}

async function generateRecommendation({ base44, user, cluster_key, dimension_key, subdimension_key, existingTexts, triggerScore, requested_by, trigger }) {
  const score = Number(triggerScore);
  if (![0, 1, 2, 3].includes(score)) {
    return Response.json({ error: 'trigger_score é obrigatório e deve ser 0, 1, 2 ou 3 para content_type="recommendation".' }, { status: 400 });
  }

  const currentList = await base44.asServiceRole.entities.FalRecommendationLibrary.filter({ cluster_key, trigger_score: score }, 'id', 5);
  const current = currentList[0] || null;

  const clusterLabel = cluster_key.replace(/_cluster$/, '').replace(/_/g, ' ');
  const prompt = `Você é um especialista em metodologia de diagnóstico e consultoria empresarial (Método FAL), redigindo a recomendação padrão para uma faixa de maturidade de um cluster.

Cluster: ${clusterLabel} (dimensão: ${dimension_key}, subdimensão: ${subdimension_key})
Faixa de maturidade (trigger_score = ${score}): ${RATING_LABEL[score]}

Perguntas de diagnóstico deste cluster (para você entender exatamente do que se trata o processo):
${existingTexts.map((t, i) => `${i + 1}. ${t}`).join('\n')}

${current ? `Existe uma recomendação atual para esta faixa (título: "${current.recommendation_title}") — proponha uma versão MELHOR/mais específica, não apenas reescreva com sinônimos.` : 'Ainda não existe recomendação para esta faixa neste cluster — proponha uma original.'}

Gere a recomendação para esta faixa de maturidade, específica do tema do cluster (nunca genérica — evite frases como "implantar rotina estruturada" sem detalhar o quê), contendo:
- recommendation_title: título curto e acionável.
- recommendation_description: 2-4 frases explicando o diagnóstico típico desta faixa e o que deve ser feito.
- implementation_steps: array de 4-6 passos concretos e sequenciais.
- evidence_required: que documentos/evidências o consultor deve pedir para validar a melhoria.
- success_indicators: como saber que a recomendação foi implementada com sucesso.
- routine_template: sugestão de rotina prática de acompanhamento (ex.: checklist mensal).
- typical_owner: cargo/área responsável típico.
- rationale: por que essa recomendação é mais específica/melhor que a genérica.`;

  let generated;
  try {
    generated = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          recommendation_title: { type: 'string' },
          recommendation_description: { type: 'string' },
          implementation_steps: { type: 'array', items: { type: 'string' } },
          evidence_required: { type: 'string' },
          success_indicators: { type: 'string' },
          routine_template: { type: 'string' },
          typical_owner: { type: 'string' },
          rationale: { type: 'string' },
        },
      },
    });
  } catch (llmErr) {
    return Response.json({ error: `Falha ao gerar sugestão via IA: ${llmErr.message}` }, { status: 502 });
  }

  if (!generated?.recommendation_title) {
    return Response.json({ error: 'IA não retornou uma sugestão válida.' }, { status: 502 });
  }

  const gapByScore = { 0: 0, 1: 1, 2: 2, 3: null };
  const typeByScore = { 0: 'structural', 1: 'corrective', 2: 'improvement', 3: 'monitoring' };
  const timeframeByScore = { 0: '180d', 1: '90d', 2: '60d', 3: '180d' };

  const draft_payload = {
    recommendation_key: current?.recommendation_key || `fal_rec_${cluster_key}_r${score}_ia`,
    source: 'global_library',
    source_type: 'cluster_rating',
    dimension_key,
    subdimension_key,
    cluster_key,
    question_id: null,
    trigger_score: score,
    gap_level: gapByScore[score],
    is_actionable: score !== 3,
    recommendation_type: typeByScore[score],
    recommendation_title: generated.recommendation_title,
    recommendation_description: generated.recommendation_description || '',
    implementation_steps: generated.implementation_steps || [],
    evidence_required: generated.evidence_required || '',
    success_indicators: generated.success_indicators || '',
    routine_template: generated.routine_template || '',
    effort_level: 3,
    impact_level: score === 0 ? 5 : score === 1 ? 4 : score === 2 ? 3 : 2,
    priority_weight: score === 0 ? 90 : score === 1 ? 75 : score === 2 ? 50 : 20,
    typical_owner: generated.typical_owner || '',
    estimated_timeframe: timeframeByScore[score],
    cluster_question_count: existingTexts.length,
    tenant_id: 'global',
    version: current ? `${(parseFloat(current.version) || 1) + 0.1}` : '1.0',
    notes: 'Gerado via copiloto de IA — revisar antes de publicar.',
    is_active: true,
  };

  const suggestion = await base44.asServiceRole.entities.FalContentSuggestion.create({
    tenant_id: null,
    content_type: 'recommendation',
    dimension_key,
    subdimension_key,
    cluster_key,
    trigger,
    requested_by: requested_by || user.email,
    model_used: 'base44-invoke-llm',
    prompt_context_summary: current ? `Substitui recomendação atual "${current.recommendation_title}" para trigger_score=${score}.` : `Nova recomendação para trigger_score=${score} (nenhuma existente).`,
    draft_payload,
    status: 'pending',
  });

  return Response.json({ success: true, created_count: 1, suggestions: [{ ...suggestion, rationale: generated.rationale || '' }] });
}
