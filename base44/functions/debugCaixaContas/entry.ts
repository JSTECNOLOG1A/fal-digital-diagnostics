/**
 * debugCaixaContas
 * Lista todas as contas que formam o Caixa e seus saldos
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

  const body = await req.json().catch(() => ({}));
  let { upload_id, diagnosis_id } = body;

  if (!upload_id || !diagnosis_id) {
    const uploads = await base44.asServiceRole.entities.FinancialUpload.filter({}, '-created_date', 1);
    if (uploads.length === 0) {
      return Response.json({ error: 'Nenhum upload encontrado' }, { status: 404 });
    }
    upload_id = uploads[0].id;
    diagnosis_id = uploads[0].financial_diagnosis_id;
  }

  try {
    // Pega o statement de Caixa
    const caixaStmt = await base44.asServiceRole.entities.FinancialStatementLine.filter({
      financial_upload_id: upload_id,
      canonical_key: 'ativo_circulante_caixa',
    }, 'period', 100);

    // Pega o trial balance
    const trials = await base44.asServiceRole.entities.FinancialTrialBalanceLine.filter({
      financial_upload_id: upload_id,
    }, 'account_code', 10000);

    // Pega os mapeamentos
    const mappings = await base44.asServiceRole.entities.FinancialMappingResolution.filter({
      financial_upload_id: upload_id,
    }, 'account_code', 10000);

    // Contas que deveriam mapear para caixa
    const caixaMappings = (Array.isArray(mappings) ? mappings : [])
      .filter(m => m.managerial_rubric === 'ativo_circulante_caixa');

    const caixaAccountCodes = new Set(caixaMappings.map(m => m.account_code));

    // Contas de caixa no trial
    const caixaTrials = trials.filter(t => caixaAccountCodes.has(t.account_code));

    // Composição por período
    const byPeriod = {};
    for (const stmt of caixaStmt) {
      byPeriod[stmt.period] = {
        stmt_value: stmt.value,
        stmt_accounts: stmt.composition_account_codes || [],
      };
    }

    for (const trial of caixaTrials) {
      if (!byPeriod[trial.period]) byPeriod[trial.period] = { stmt_value: null, stmt_accounts: [] };
      if (!byPeriod[trial.period].trial_detail) byPeriod[trial.period].trial_detail = [];
      byPeriod[trial.period].trial_detail.push({
        account_code: trial.account_code,
        description: trial.account_description,
        balance: trial.closing_balance,
      });
    }

    return Response.json({
      upload_id,
      caixa_mappings_count: caixaMappings.length,
      caixa_accounts: caixaMappings.map(m => ({
        account_code: m.account_code,
        account_description: m.account_description,
        mapping_source: m.mapping_source,
      })),
      by_period: Object.entries(byPeriod).map(([period, data]) => {
        const trialSum = data.trial_detail?.reduce((sum, t) => sum + (t.balance || 0), 0) || 0;
        return {
          period,
          stmt_value: data.stmt_value,
          trial_sum: trialSum,
          difference: (data.stmt_value || 0) - trialSum,
          trial_detail: data.trial_detail || [],
        };
      }),
    });
  } catch (error) {
    console.error('[debugCaixaContas]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});