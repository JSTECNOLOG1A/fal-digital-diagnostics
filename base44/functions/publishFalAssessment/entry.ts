/**
 * publishFalAssessment
 *
 * Publica um assessment FAL de forma segura:
 * 1. Valida cobertura de respostas (>= 70%)
 * 2. Garante/cria cycle_id
 * 3. Faz upsert de FalDiagnosticSnapshot com status='published'
 * 4. Atualiza Report e Assessment
 * 5. Cria AuditLog
 *
 * Input: { assessmentId, cycleId? }
 * Output: { ok, snapshot_published, plan, coverage } | { error, pendencias, coverage }
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

const COVERAGE_THRESHOLD = 0.7;

// ─── Tenant Guard ──────────────────────────────────────────────────────────────
function isHQ(user) {
  return appRole === 'hq_admin';
}

function assertTenantAccess(user, entityTenantId) {
  if (isHQ(user)) return; // HQ bypasses all tenant checks
  if (!user.tenant_id) throw Object.assign(new Error('Forbidden: user has no tenant_id'), { status: 403 });
  if (user.tenant_id !== entityTenantId) throw Object.assign(new Error('Forbidden: tenant mismatch'), { status: 403 });
}

// SEG-03: Write guard — blocks client_viewer from mutations
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function assertCanWrite(appRole) {
  if (!WRITE_ROLES.has(appRole)) {
    throw Object.assign(new Error('Forbidden: write permission required'), { status: 403 });
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // SEG-03: Write guard
    try { assertCanWrite(appRole); } catch (wErr) {
      return Response.json({ error: wErr.message }, { status: wErr.status || 403 });
    }

    const body = await req.json();
    const { assessmentId, cycleId: incomingCycleId } = body;
    if (!assessmentId) return Response.json({ error: 'assessmentId required' }, { status: 400 });

    // ── 1. Carregar assessment
    const assessment = await base44.asServiceRole.entities.Assessment.get(assessmentId);
    if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });

    const tenantId = assessment.tenant_id;

    // ── Tenant access guard
    try { assertTenantAccess(user, tenantId); } catch (e) {
      return Response.json({ error: e.message }, { status: 403 });
    }
    const targetType = assessment.target_type || null;
    const targetId = assessment.target_id || null;

    // ── 2. Garantir cycle_id
    let cycleId = incomingCycleId || assessment.cycle_id || null;

    if (!cycleId) {
      // Buscar ciclo 'open' existente para este target/tenant
      const openCycles = await base44.asServiceRole.entities.Cycle?.filter?.(
        { tenant_id: tenantId, status: 'open' }, '-created_date', 1
      ).catch(() => []);

      if (openCycles?.length > 0) {
        cycleId = openCycles[0].id;
      } else {
        // Criar ciclo default se a entidade Cycle existir
        const today = new Date();
        const start = new Date(today);
        start.setDate(start.getDate() - 90);
        const end = new Date(today);
        end.setDate(end.getDate() + 90);

        const newCycle = await base44.asServiceRole.entities.Cycle?.create?.({
          tenant_id: tenantId,
          name: 'Ciclo Atual',
          status: 'open',
          period_start: start.toISOString().split('T')[0],
          period_end: end.toISOString().split('T')[0]
        }).catch(() => null);

        cycleId = newCycle?.id || `default_${assessmentId}`;
      }
    }

    // ── 3. Calcular cobertura de respostas
    const questionSet = assessment.question_set || [];
    if (questionSet.length === 0) {
      return Response.json({ error: 'question_set vazio — execute buildFalQuestionSet antes de publicar' }, { status: 400 });
    }

    const allResponses = await base44.asServiceRole.entities.FalResponse.filter(
      { tenant_id: tenantId, assessment_id: assessmentId }, '-created_date', 500
    );

    const answeredIds = new Set(allResponses.map(r => r.fal_question_id));
    const answeredCount = questionSet.filter(id => answeredIds.has(id)).length;
    const coverage = answeredCount / questionSet.length;

    if (coverage < COVERAGE_THRESHOLD) {
      const unansweredIds = questionSet.filter(id => !answeredIds.has(id));
      return Response.json({
        error: `Cobertura insuficiente: ${Math.round(coverage * 100)}% (mínimo 70%). Há ${unansweredIds.length} pergunta(s) sem resposta.`,
        pendencias: unansweredIds,
        coverage: Math.round(coverage * 100)
      }, { status: 422 });
    }

    // ── 4. Buscar ou computar o FalDiagnosticSnapshot source (draft mais recente)
    let sourceSnapshot = null;
    const draftSnaps = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
      { tenant_id: tenantId, assessment_id: assessmentId }, '-computed_at', 1
    );

    if (draftSnaps.length > 0) {
      sourceSnapshot = draftSnaps[0];
    } else {
      // Nenhum snapshot: computar agora
      const computeRes = await base44.asServiceRole.functions.invoke(
        'computeFalDiagnostic', { assessment_id: assessmentId }
      );
      if (computeRes?.error) {
        return Response.json({ error: `Falha ao computar diagnóstico: ${computeRes.error}` }, { status: 500 });
      }
      // Buscar o snapshot recém criado
      const freshSnaps = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
        { assessment_id: assessmentId }, '-computed_at', 1
      );
      sourceSnapshot = freshSnaps[0] || null;
    }

    if (!sourceSnapshot) {
      return Response.json({ error: 'Não foi possível obter FalDiagnosticSnapshot' }, { status: 500 });
    }

    // ── 5. Montar payload do snapshot publicado
    const now = new Date().toISOString();
    const publishedPayload = {
      tenant_id: tenantId,
      assessment_id: assessmentId,
      cycle_id: cycleId,
      target_type: targetType,
      target_id: targetId,
      answers_coverage: Math.round(coverage * 100) / 100,
      dimension_scores: sourceSnapshot.dimension_scores,
      overall_score: sourceSnapshot.overall_score,
      overall_level: sourceSnapshot.overall_level,
      radar_points: sourceSnapshot.radar_points,
      gaps_top: sourceSnapshot.gaps_top,
      sector_snapshot: sourceSnapshot.sector_snapshot,
      active_dimensions: sourceSnapshot.active_dimensions,
      question_set: sourceSnapshot.question_set,
      status: 'published',
      computed_at: sourceSnapshot.computed_at,
      published_at: now,
      published_by: user.email,
      source_snapshot_id: sourceSnapshot.id
    };

    // ── 6. UPSERT por chave (tenant_id, assessment_id, cycle_id, status='published')
    const existingPublished = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
      { tenant_id: tenantId, assessment_id: assessmentId, cycle_id: cycleId, status: 'published' },
      '-published_at', 1
    );

    let snapshotPublished;
    if (existingPublished.length > 0) {
      snapshotPublished = await base44.asServiceRole.entities.FalDiagnosticSnapshot.update(
        existingPublished[0].id, publishedPayload
      );
    } else {
      snapshotPublished = await base44.asServiceRole.entities.FalDiagnosticSnapshot.create(publishedPayload);
    }

    // ── 7. Publicar Report (se existir)
    const reports = await base44.asServiceRole.entities.Report.filter(
      { tenant_id: tenantId, assessment_id: assessmentId }, '-created_date', 1
    );
    if (reports.length > 0) {
      await base44.asServiceRole.entities.Report.update(reports[0].id, {
        status: 'published',
        published_at: now,
        published_by: user.email
      });
    }

    // ── 8. Publicar Assessment
    await base44.asServiceRole.entities.Assessment.update(assessmentId, {
      status: 'published',
      completed_at: now.split('T')[0],
      cycle_id: cycleId
    });

    // ── 9. AuditLog
    await base44.asServiceRole.entities.AuditLog.create({
      tenant_id: tenantId,
      user_email: user.email,
      action: 'assessment_published',
      entity_type: 'FalDiagnosticSnapshot',
      entity_id: snapshotPublished.id,
      details: {
        cycle_id: cycleId,
        coverage: Math.round(coverage * 100),
        overall_score: sourceSnapshot.overall_score,
        overall_level: sourceSnapshot.overall_level,
        source_snapshot_id: sourceSnapshot.id
      }
    });

    return Response.json({
      ok: true,
      snapshot_published: snapshotPublished,
      coverage: Math.round(coverage * 100),
      cycle_id: cycleId
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});