/**
 * debugCaixaComposition
 * Lista as contas analíticas que foram mapeadas para "Caixa e Equivalentes de Caixa"
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: função de debug restrita a hq_admin' }, { status: 403 });

  const body = await req.json();
  const { upload_id, diagnosis_id } = body;
  if (!upload_id || !diagnosis_id) {
    return Response.json({ error: 'upload_id e diagnosis_id são obrigatórios' }, { status: 400 });
  }

  try {
    // 1. Buscar a linha de "Caixa e Equivalentes de Caixa"
    const stmtLines = await base44.asServiceRole.entities.FinancialStatementLine.filter({
      financial_upload_id: upload_id,
      canonical_key: 'ativo_circulante_caixa',
    }, 'period', 10);

    // 2. Buscar os mapeamentos (FinancialMappingResolution) para entender as contas-fonte
    const mappings = await base44.asServiceRole.entities.FinancialMappingResolution.filter({
      financial_upload_id: upload_id,
      managerial_rubric: 'ativo_circulante_caixa',
    }, 'account_code', 100);

    // 3. Buscar linhas de balancete (trial balance) com mesmo canonical_key
    const trialLines = await base44.asServiceRole.entities.FinancialTrialBalanceLine.filter({
      financial_upload_id: upload_id,
    }, 'account_code', 500);

    // Filtrar linhas do balancete que foram mapeadas para caixa
    const caixaTrialLines = trialLines.filter(t => 
      mappings.some(m => m.account_code === t.account_code)
    );

    return Response.json({
      canonical_key: 'ativo_circulante_caixa',
      statement_lines: stmtLines.map(s => ({
        period: s.period,
        value: s.value,
        composition_count: s.composition_account_codes?.length || 0,
      })),
      source_mappings: mappings.map(m => ({
        account_code: m.account_code,
        account_description: m.account_description,
        mapping_source: m.mapping_source,
        resolved_confidence: m.resolved_confidence,
        blocking_issue: m.blocking_issue,
      })),
      trial_balance_lines: caixaTrialLines.map(t => ({
        account_code: t.account_code,
        account_description: t.account_description,
        period: t.period,
        closing_balance: t.closing_balance,
        source_sheet: t.source_sheet,
        source_row: t.source_row,
      })),
      summary: {
        total_accounts: caixaTrialLines.length,
        total_value: caixaTrialLines.reduce((sum, t) => sum + (t.closing_balance || 0), 0),
      },
    });
  } catch (error) {
    console.error('[debugCaixaComposition]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});