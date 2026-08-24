import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

/**
 * Limpa recomendações duplicadas de um assessment/plano.
 * Mantém apenas UMA recomendação por cluster (a mais recente ou a já aprovada).
 * Remove todas as duplicatas de mesmo título ou mesmo cluster_key.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { assessment_id, action_plan_id, dry_run = false } = body;

    if (!assessment_id) {
      return Response.json({ error: 'assessment_id é obrigatório' }, { status: 400 });
    }

    // Guard: validar propriedade do tenant
    const assessment = await base44.asServiceRole.entities.Assessment.get(assessment_id);
    if (!assessment) return Response.json({ error: 'Assessment não encontrado' }, { status: 404 });
      // SEG-03: Role guard — deny client_viewer from triggering mutations
      const WRITE_ROLES = ['hq_admin', 'tenant_admin', 'consultant'];
      if (!WRITE_ROLES.includes(appRole)) {
        return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
      }

    if (appRole !== 'hq_admin' && assessment.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: assessment não pertence ao seu tenant' }, { status: 403 });
    }

    const filter = action_plan_id
      ? { assessment_id, action_plan_id }
      : { assessment_id };

    const allRecs = await base44.asServiceRole.entities.ActionRecommendation.filter(
      filter, 'created_date', 1000
    ).catch(() => []);

    if (allRecs.length === 0) {
      return Response.json({ success: true, message: 'Nenhuma recomendação encontrada.', deletedCount: 0 });
    }

    // Estratégia de deduplicação:
    // Agrupar por (dimension_key + cluster_key). Para cada grupo, manter:
    //   1. A que tem status diferente de 'suggested' (aprovada, convertida etc.)
    //   2. Ou, a mais recente (último created_date)
    // Deletar todas as outras do grupo.

    const groups = {};
    for (const rec of allRecs) {
      const key = `${rec.dimension_key || '_'}:${rec.cluster_key || '_no_cluster_'}:${rec.title?.trim().toLowerCase().slice(0, 60) || '_notitle_'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(rec);
    }

    // Também agrupar por título exato (para pegar duplicatas com mesmo texto mas chaves diferentes)
    const titleGroups = {};
    for (const rec of allRecs) {
      const key = `${rec.dimension_key || '_'}:${rec.cluster_key || '_'}:${(rec.title || '').trim().toLowerCase().slice(0, 80)}`;
      if (!titleGroups[key]) titleGroups[key] = [];
      titleGroups[key].push(rec);
    }

    const toDeleteIds = new Set();

    const processGroup = (group) => {
      if (group.length <= 1) return;
      // Ordenar: status diferente de suggested vem primeiro, depois mais recente
      const sorted = group.sort((a, b) => {
        const aImportant = a.status !== 'suggested' ? 1 : 0;
        const bImportant = b.status !== 'suggested' ? 1 : 0;
        if (bImportant !== aImportant) return bImportant - aImportant;
        return new Date(b.created_date) - new Date(a.created_date);
      });
      // Manter o primeiro, deletar o resto
      for (let i = 1; i < sorted.length; i++) {
        toDeleteIds.add(sorted[i].id);
      }
    };

    Object.values(groups).forEach(processGroup);
    Object.values(titleGroups).forEach(processGroup);

    const toDeleteList = [...toDeleteIds];

    if (dry_run) {
      return Response.json({
        success: true,
        dry_run: true,
        totalRecs: allRecs.length,
        duplicatesFound: toDeleteList.length,
        wouldDelete: toDeleteList,
      });
    }

    let deletedCount = 0;
    for (const id of toDeleteList) {
      await base44.asServiceRole.entities.ActionRecommendation.delete(id).catch(() => {});
      deletedCount++;
    }

    return Response.json({
      success: true,
      totalRecs: allRecs.length,
      deletedCount,
      remaining: allRecs.length - deletedCount,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});