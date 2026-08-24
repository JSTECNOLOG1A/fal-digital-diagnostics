/**
 * debugCaixaDetalhado
 * Mostra composição completa da conta Caixa e Equivalentes de Caixa
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
    // 1. Todas as linhas do trial balance
    const trialLines = await base44.asServiceRole.entities.FinancialTrialBalanceLine.filter({
      financial_upload_id: upload_id,
    }, 'account_code', 1000);

    // 2. Mapeamentos (qual conta → qual canonical_key)
    const mappings = await base44.asServiceRole.entities.FinancialMappingResolution.filter({
      financial_upload_id: upload_id,
    }, 'account_code', 1000);

    // 3. Linhas da DRE/BP processadas
    const stmtLines = await base44.asServiceRole.entities.FinancialStatementLine.filter({
      financial_upload_id: upload_id,
      canonical_key: 'ativo_circulante_caixa',
    }, 'period', 20);

    // 4. Agrupar trial lines por período
    const trialByPeriod = {};
    for (const t of trialLines) {
      if (!trialByPeriod[t.period]) trialByPeriod[t.period] = [];
      trialByPeriod[t.period].push(t);
    }

    // 5. Agrupar mappings por account_code (não varia por período)
    const mappingByCode = {};
    for (const m of mappings) {
      mappingByCode[m.account_code] = m;
    }

    // 6. Montar composição por período
    const periods = Object.keys(trialByPeriod).sort();
    const composition = periods.map(period => {
      const periodTrials = trialByPeriod[period] || [];

      // Contas que mapeiam para ativo_circulante_caixa
      const caixaAccounts = periodTrials.filter(t => {
        const mapping = mappingByCode[t.account_code];
        return mapping?.managerial_rubric === 'ativo_circulante_caixa';
      });

      const totalComposicao = caixaAccounts.reduce((sum, t) => sum + (t.closing_balance || 0), 0);

      // Linha do BP para essa rubrica
      const stmtLine = stmtLines.find(s => s.period === period);

      return {
        period,
        caixa_accounts: caixaAccounts.map(t => ({
          account_code: t.account_code,
          description: t.account_description,
          closing_balance: t.closing_balance,
        })),
        total_composed: totalComposicao,
        total_in_bp: stmtLine?.value || 0,
        difference: (stmtLine?.value || 0) - totalComposicao,
        account_count: caixaAccounts.length,
      };
    });

    return Response.json({
      canonical_key: 'ativo_circulante_caixa',
      rubric: 'Caixa e Equivalentes de Caixa',
      upload_id,
      periods_analyzed: periods.length,
      composition_by_period: composition,
    });
  } catch (error) {
    console.error('[debugCaixaDetalhado]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});