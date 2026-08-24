/**
 * deleteAccountPlan
 * Deleta um plano de contas INTEIRO (linhas + plano) com validação de dependência.
 *
 * CROSS-001 FIX: Canonical tenant resolution — loads the plan FIRST, derives
 * canonicalTenantId from plan.tenant_id, and validates against that (not payload tenant_id).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user: any): string | null {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

  const appRole = resolveAppRole(user);
  const isHQ = appRole === 'hq_admin';

  // ── Role Guard: destructive operations require admin-level role ──
  const DELETE_ROLES = new Set(['hq_admin', 'tenant_admin']);
  if (!DELETE_ROLES.has(appRole)) {
    return Response.json({ error: 'Permissão insuficiente para operação destrutiva' }, { status: 403 });
  }

  const { account_plan_id, tenant_id } = await req.json();
  if (!account_plan_id) {
    return Response.json({ error: 'account_plan_id é obrigatório' }, { status: 400 });
  }

  // ── CROSS-001: Load plan FIRST to get canonical tenant ──
  const plan = await base44.asServiceRole.entities.FinancialAccountPlan.get(account_plan_id);
  if (!plan) {
    return Response.json({ error: 'Plano de contas não encontrado' }, { status: 404 });
  }

  const canonicalTenantId = plan.tenant_id;

  // Validate user tenant against canonical tenant
  if (!isHQ && canonicalTenantId !== user.tenant_id) {
    return Response.json({ error: 'Forbidden: tenant mismatch' }, { status: 403 });
  }

  // Reject if payload tenant_id diverges from canonical
  if (tenant_id && tenant_id !== canonicalTenantId) {
    return Response.json({ error: 'Tenant informado diverge do recurso' }, { status: 403 });
  }

  try {
    // 1. Verificar dependências — diagnósticos vinculados a este plano
    const linkedDiagnoses = await base44.asServiceRole.entities.FinancialDiagnosis.filter(
      { account_plan_id, tenant_id: canonicalTenantId },
      'created_date',
      100
    );
    const linkedDiagCount = Array.isArray(linkedDiagnoses) ? linkedDiagnoses.length : 0;

    if (linkedDiagCount > 0) {
      return Response.json(
        {
          error: `Este plano está vinculado a ${linkedDiagCount} diagnóstico(s) e não pode ser excluído.`,
          blocked: true,
          linked_diagnoses_count: linkedDiagCount
        },
        { status: 422 }
      );
    }

    // 2. Deletar linhas do plano (using canonicalTenantId)
    const lines = await base44.asServiceRole.entities.FinancialAccountPlanLine.filter(
      { account_plan_id, tenant_id: canonicalTenantId },
      'account_code',
      10000
    );
    const linesList = Array.isArray(lines) ? lines : [];
    let deletedLines = 0;

    if (linesList.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < linesList.length; i += BATCH_SIZE) {
        const batch = Array.from(linesList.slice(i, i + BATCH_SIZE));
        const results = await Promise.allSettled(
          batch.map(l => base44.asServiceRole.entities.FinancialAccountPlanLine.delete(l.id))
        );
        results.forEach(r => {
          if (r.status === 'fulfilled') deletedLines++;
        });
      }
    }

    // 3. Deletar o plano de contas
    await base44.asServiceRole.entities.FinancialAccountPlan.delete(plan.id);

    return Response.json({
      success: true,
      deleted_lines: deletedLines,
      deleted_plan: true,
      message: `Plano excluído com sucesso (${deletedLines} linhas removidas)`
    });
  } catch (err) {
    console.error('[deleteAccountPlan] ERROR:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});