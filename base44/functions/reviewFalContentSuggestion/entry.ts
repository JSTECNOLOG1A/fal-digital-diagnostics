/**
 * reviewFalContentSuggestion
 *
 * Aprova, edita-e-aprova ou rejeita uma FalContentSuggestion pendente.
 * Só aqui uma sugestão de IA vira registro real (FalQuestion) — nunca no
 * momento da geração.
 *
 * Payload: { suggestion_id, action: 'approve' | 'reject', edited_payload?, comment? }
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const appRole = resolveAppRole(user);
    if (!WRITE_ROLES.has(appRole)) {
      return Response.json({ error: 'Forbidden: apenas HQ admin ou consultor' }, { status: 403 });
    }

    const { suggestion_id, action, edited_payload, comment } = await req.json();
    if (!suggestion_id || !['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'suggestion_id e action ("approve"|"reject") são obrigatórios' }, { status: 400 });
    }

    const suggestion = await base44.asServiceRole.entities.FalContentSuggestion.get(suggestion_id);
    if (!suggestion) return Response.json({ error: 'Sugestão não encontrada' }, { status: 404 });
    if (suggestion.status !== 'pending') {
      return Response.json({ error: `Sugestão já revisada (status atual: ${suggestion.status})` }, { status: 409 });
    }

    if (action === 'reject') {
      await base44.asServiceRole.entities.FalContentSuggestion.update(suggestion_id, {
        status: 'rejected',
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
        review_comment: comment || '',
      });
      return Response.json({ success: true, status: 'rejected' });
    }

    // action === 'approve'
    const finalPayload = { ...suggestion.draft_payload, ...(edited_payload || {}) };
    const wasEdited = !!edited_payload && Object.keys(edited_payload).length > 0;

    let publishedId = null;
    if (suggestion.content_type === 'question') {
      const created = await base44.asServiceRole.entities.FalQuestion.create(finalPayload);
      publishedId = created.id;
    } else if (suggestion.content_type === 'recommendation') {
      // Upsert por recommendation_key — se já existir uma recomendação para
      // esse cluster/trigger_score, a aprovação SUBSTITUI o conteúdo dela
      // em vez de criar uma duplicata concorrente.
      const existingRecs = await base44.asServiceRole.entities.FalRecommendationLibrary.filter({
        recommendation_key: finalPayload.recommendation_key,
      });
      if (existingRecs.length > 0) {
        await base44.asServiceRole.entities.FalRecommendationLibrary.update(existingRecs[0].id, finalPayload);
        publishedId = existingRecs[0].id;
      } else {
        const created = await base44.asServiceRole.entities.FalRecommendationLibrary.create(finalPayload);
        publishedId = created.id;
      }
    } else {
      return Response.json({ error: `Publicação para content_type="${suggestion.content_type}" ainda não implementada` }, { status: 501 });
    }

    await base44.asServiceRole.entities.FalContentSuggestion.update(suggestion_id, {
      status: wasEdited ? 'edited_approved' : 'approved',
      reviewed_by: user.email,
      reviewed_at: new Date().toISOString(),
      review_comment: comment || '',
      published_entity_id: publishedId,
    });

    return Response.json({ success: true, status: wasEdited ? 'edited_approved' : 'approved', published_entity_id: publishedId });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
