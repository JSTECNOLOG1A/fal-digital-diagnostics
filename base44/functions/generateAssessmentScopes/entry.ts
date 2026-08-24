/**
 * generateAssessmentScopes
 * Função idempotente que gera ou atualiza AssessmentScopes a partir do
 * dimension_target_mapping de um Assessment (multi_entity_master).
 *
 * Idempotência: se já existe um scope para (assessment_id, dimension_key, entity_id),
 * ele é atualizado (não duplicado).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function resolveAppRole(user) {
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!WRITE_ROLES.has(appRole)) return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });

    const body = await req.json();
    const { assessment_id } = body;

    if (!assessment_id) {
      return Response.json({ error: 'assessment_id é obrigatório.' }, { status: 400 });
    }

    // Busca o Assessment
    const assessment = await base44.entities.Assessment.get(assessment_id);
    if (!assessment) {
      return Response.json({ error: 'Assessment não encontrado.' }, { status: 404 });
    }

    if (assessment.assessment_mode !== 'multi_entity_master') {
      return Response.json({
        error: 'Este Assessment não é do tipo multi_entity_master.',
        mode: assessment.assessment_mode,
      }, { status: 400 });
    }

    const mapping = assessment.dimension_target_mapping;
    if (!mapping || typeof mapping !== 'object') {
      return Response.json({ error: 'dimension_target_mapping ausente ou inválido.' }, { status: 400 });
    }

    // Busca scopes existentes para idempotência
    const existingScopes = await base44.entities.AssessmentScope.filter(
      { assessment_id }, 'created_date', 500
    );

    // Index: `${dimension_key}::${evaluated_entity_id}` → scope
    const scopeIndex = {};
    for (const s of existingScopes) {
      const key = `${s.dimension_key}::${s.evaluated_entity_id}`;
      scopeIndex[key] = s;
    }

    let created_count = 0;
    let updated_count = 0;
    let skipped_count = 0;

    for (const [dimKey, targets] of Object.entries(mapping)) {
      if (!Array.isArray(targets)) continue;

      for (const target of targets) {
        const entityId = target.entity_id;
        if (!entityId) continue;

        const scopeKey = `${dimKey}::${entityId}`;
        const existing = scopeIndex[scopeKey];

        const payload = {
          tenant_id: assessment.tenant_id,
          assessment_id,
          dimension_key: dimKey,
          evaluated_entity_type: target.level,
          evaluated_entity_id: entityId,
          evaluated_entity_name: target.entity_name || '',
          weight: target.weight ?? 1,
          sampling_mode: target.sampling_mode || 'full',
          include_in_consolidated_score: target.include_in_consolidated_score !== false,
        };

        if (!existing) {
          // Cria novo scope
          await base44.entities.AssessmentScope.create({
            ...payload,
            status: 'not_started',
            question_count: 0,
            answered_count: 0,
            required_count: 0,
            completion_ratio: 0,
          });
          created_count++;
        } else {
          // Verifica se houve mudança nos campos-chave
          const hasChange =
            existing.evaluated_entity_type !== payload.evaluated_entity_type ||
            existing.evaluated_entity_name !== payload.evaluated_entity_name ||
            existing.weight !== payload.weight ||
            existing.sampling_mode !== payload.sampling_mode ||
            existing.include_in_consolidated_score !== payload.include_in_consolidated_score;

          if (hasChange) {
            await base44.entities.AssessmentScope.update(existing.id, {
              evaluated_entity_type: payload.evaluated_entity_type,
              evaluated_entity_name: payload.evaluated_entity_name,
              weight: payload.weight,
              sampling_mode: payload.sampling_mode,
              include_in_consolidated_score: payload.include_in_consolidated_score,
            });
            updated_count++;
          } else {
            skipped_count++;
          }
        }
      }
    }

    // Atualiza o scope_hash e configuration_status no Assessment
    const scopeHash = buildScopeHash(mapping);
    await base44.entities.Assessment.update(assessment_id, {
      scope_hash: scopeHash,
      configuration_status: 'configured',
    });

    return Response.json({
      success: true,
      created_count,
      updated_count,
      skipped_count,
      total: created_count + updated_count + skipped_count,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Inline scope hash (sem import de lib, pois NO LOCAL IMPORTS) ─────────────
function buildScopeHash(mapping) {
  if (!mapping) return '';
  const sorted = {};
  for (const key of Object.keys(mapping).sort()) {
    sorted[key] = [...(mapping[key] || [])].sort((a, b) =>
      (a.entity_id || '').localeCompare(b.entity_id || '')
    ).map(t => ({
      entity_id: t.entity_id,
      level: t.level,
      sampling_mode: t.sampling_mode,
      include_in_consolidated_score: t.include_in_consolidated_score,
    }));
  }
  const str = JSON.stringify(sorted);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}