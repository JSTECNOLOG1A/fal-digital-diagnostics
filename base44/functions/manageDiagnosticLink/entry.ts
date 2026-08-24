/**
 * manageDiagnosticLink
 * Gerencia criação, desvinculação e substituição de vínculos FAL + Financeiro.
 * 
 * Ações:
 * - create: cria vínculo (desativa active anterior automaticamente)
 * - unlink: desativa vínculo ativo
 * - replace: desativa ativo e cria novo (equivale a create)
 * 
 * Guards:
 * - assessment.tenant_id === user.tenant_id (salvo HQ)
 * - financial_diagnosis.tenant_id === assessment.tenant_id
 * - financial_diagnosis.group_id === assessment.group_id (quando group_id existir)
 * - não cria duplicado ativo sem usar replace
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

// SEG-03: Write guard — blocks client_viewer from mutations
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function assertCanWrite(appRole) {
  if (!WRITE_ROLES.has(appRole)) {
    throw Object.assign(new Error('Forbidden: write permission required'), { status: 403 });
  }
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // SEG-03: Write guard
    try { assertCanWrite(appRole); } catch (wErr) {
      return Response.json({ error: wErr.message }, { status: wErr.status || 403 });
    }

    const { action, fal_assessment_id, financial_diagnosis_id, link_type = 'synthetic_analysis', rationale } = body;

    if (!action) return Response.json({ error: 'action é obrigatório (create, unlink, replace)' }, { status: 400 });

    // ── UNLINK ──────────────────────────────────────────────────────────────────
    if (action === 'unlink') {
      if (!fal_assessment_id) return Response.json({ error: 'fal_assessment_id é obrigatório' }, { status: 400 });

      // Buscar vínculo ativo
      const links = await base44.asServiceRole.entities.DiagnosticLink.filter(
        { fal_assessment_id, status: 'active' }, '-created_date', 1
      );
      const activeLink = links[0];
      if (!activeLink) return Response.json({ error: 'Nenhum vínculo ativo encontrado para desvincular' }, { status: 404 });

      // Guard de tenant
      if (!isHQ && activeLink.tenant_id !== user.tenant_id) {
        return Response.json({ error: 'Forbidden: vínculo pertence a outro tenant' }, { status: 403 });
      }

      const updated = await base44.asServiceRole.entities.DiagnosticLink.update(activeLink.id, {
        status: 'inactive',
        unlinked_by: user.email,
        unlinked_at: new Date().toISOString(),
      });

      return Response.json({ link: updated });
    }

    // ── CREATE / REPLACE ─────────────────────────────────────────────────────────
    if (action === 'create' || action === 'replace') {
      if (!fal_assessment_id) return Response.json({ error: 'fal_assessment_id é obrigatório' }, { status: 400 });
      if (!financial_diagnosis_id) return Response.json({ error: 'financial_diagnosis_id é obrigatório' }, { status: 400 });

      // Carregar assessment
      const assessment = await base44.asServiceRole.entities.Assessment.get(fal_assessment_id);
      if (!assessment) return Response.json({ error: 'Assessment FAL não encontrado' }, { status: 404 });

      // Guard: tenant do assessment
      if (!isHQ && assessment.tenant_id !== user.tenant_id) {
        return Response.json({ error: 'Forbidden: assessment pertence a outro tenant' }, { status: 403 });
      }

      // Carregar diagnóstico financeiro
      const finDiag = await base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id);
      if (!finDiag) return Response.json({ error: 'Diagnóstico financeiro não encontrado' }, { status: 404 });

      // Guard: tenant do financeiro deve ser igual ao do assessment
      if (finDiag.tenant_id !== assessment.tenant_id) {
        return Response.json({
          error: 'O diagnóstico financeiro pertence a um tenant diferente do assessment FAL'
        }, { status: 422 });
      }

      // Guard: grupo do financeiro deve ser igual ao do assessment (quando ambos têm group_id)
      if (assessment.group_id && finDiag.group_id && finDiag.group_id !== assessment.group_id) {
        return Response.json({
          error: 'O diagnóstico financeiro pertence a um grupo diferente do assessment FAL'
        }, { status: 422 });
      }

      // Guard: não criar duplicado ativo sem usar replace
      const existingLinks = await base44.asServiceRole.entities.DiagnosticLink.filter(
        { fal_assessment_id, status: 'active', tenant_id: assessment.tenant_id }, '-created_date', 5
      );

      if (existingLinks.length > 0 && action === 'create') {
        return Response.json({
          error: 'Já existe um vínculo ativo para este assessment. Use action="replace" para substituir.'
        }, { status: 409 });
      }

      // Desativar vínculos ativos existentes (para replace)
      for (const existingLink of existingLinks) {
        await base44.asServiceRole.entities.DiagnosticLink.update(existingLink.id, {
          status: 'inactive',
          unlinked_by: user.email,
          unlinked_at: new Date().toISOString(),
          unlink_reason: 'Substituído por novo vínculo',
        });
      }

      // Criar novo vínculo
      const newLink = await base44.asServiceRole.entities.DiagnosticLink.create({
        tenant_id: assessment.tenant_id,
        group_id: assessment.group_id || finDiag.group_id || null,
        company_id: assessment.company_id || finDiag.company_id || null,
        fal_assessment_id,
        financial_diagnosis_id,
        link_type: link_type || 'synthetic_analysis',
        status: 'active',
        rationale: rationale || null,
        linked_by: user.email,
        linked_at: new Date().toISOString(),
      });

      return Response.json({ link: newLink });
    }

    return Response.json({ error: `action inválida: ${action}. Use: create, unlink, replace` }, { status: 400 });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});