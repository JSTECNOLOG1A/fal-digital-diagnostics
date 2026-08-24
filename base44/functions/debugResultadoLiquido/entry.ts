/**
 * debugResultadoLiquido
 * Rastreia para onde está indo o resultado líquido da DRE
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
    const stmtLines = await base44.asServiceRole.entities.FinancialStatementLine.filter({
      financial_upload_id: upload_id,
    }, 'period', 10000);

    const trials = await base44.asServiceRole.entities.FinancialTrialBalanceLine.filter({
      financial_upload_id: upload_id,
    }, 'period', 10000);

    const mappings = await base44.asServiceRole.entities.FinancialMappingResolution.filter({
      financial_upload_id: upload_id,
    }, 'account_code', 10000);

    // Resultado líquido por período
    const rlByPeriod = {};
    for (const l of stmtLines.filter(s => s.canonical_key === 'resultado_liquido')) {
      rlByPeriod[l.period] = l.value;
    }

    // Todas as contas de PL (Patrimônio Líquido) no statement
    const plLines = stmtLines.filter(s => 
      s.statement_family === 'balance_sheet' && 
      s.group_label === 'Patrimônio líquido'
    );

    // Trial balance por conta e período
    const trialByCodePeriod = {};
    for (const t of trials) {
      const key = `${t.account_code}|${t.period}`;
      trialByCodePeriod[key] = t.closing_balance;
    }

    // Mapeamentos de PL
    const plMappings = (Array.isArray(mappings) ? mappings : [])
      .filter(m => m.statement_family === 'balance_sheet');

    // Monta resultado por período
    const periods = [...new Set(stmtLines.map(l => l.period))].sort();

    const analysis = periods.map(period => {
      const rl = rlByPeriod[period] || 0;
      const plInThisPeriod = plLines.filter(l => l.period === period);

      // Soma as contas de PL no BP neste período
      const plSumBp = plInThisPeriod.reduce((sum, l) => sum + (l.value || 0), 0);

      // Soma as contas de PL no trial balance neste período
      const plAccountCodes = new Set();
      for (const m of plMappings.filter(m => m.managerial_rubric?.startsWith('patrimonio'))) {
        plAccountCodes.add(m.account_code);
      }

      let plSumTrial = 0;
      for (const code of plAccountCodes) {
        const key = `${code}|${period}`;
        plSumTrial += trialByCodePeriod[key] || 0;
      }

      return {
        period,
        resultado_liquido: rl,
        pl_sum_in_trial_balance: plSumTrial,
        pl_sum_in_bp_statement: plSumBp,
        difference: plSumBp - plSumTrial,
        rl_appears_in_pl: plSumBp > plSumTrial ? 'SIM' : 'NÃO',
        expected_pl_with_rl: plSumTrial + rl,
      };
    });

    // Detalhe de cada conta de PL
    const plDetail = plLines.map(l => ({
      period: l.period,
      canonical_key: l.canonical_key,
      rubric_label: l.rubric_label,
      value_in_bp: l.value,
      composition_accounts: l.composition_account_codes || [],
    }));

    return Response.json({
      upload_id,
      periods: periods.length,
      result_by_period: analysis,
      pl_accounts_detail: plDetail,
    });
  } catch (error) {
    console.error('[debugResultadoLiquido]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});