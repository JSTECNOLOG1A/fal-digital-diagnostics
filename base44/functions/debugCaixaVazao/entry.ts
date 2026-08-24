/**
 * debugCaixaVazao
 * Verifica se o resultado líquido da DRE está sendo somado ao Caixa
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
    // 1. Verifica o import config (pl_canonical_key configurado?)
    const upload = await base44.asServiceRole.entities.FinancialUpload.get(upload_id);
    let importConfig = {};
    try { importConfig = JSON.parse(upload.notes || '{}'); } catch {}

    // 2. Pega todas as linhas de statement para Caixa (todos os canonical_keys relacionados)
    const stmtLines = await base44.asServiceRole.entities.FinancialStatementLine.filter({
      financial_upload_id: upload_id,
    }, 'period', 1000);

    // Filtra por Caixa e DRE
    const caixaLines = stmtLines.filter(l => l.canonical_key === 'ativo_circulante_caixa');
    const dreResultado = stmtLines.filter(l => l.canonical_key === 'resultado_liquido');

    // 3. Pega o resultado líquido por período
    const resultadoByPeriod = {};
    for (const r of dreResultado) {
      resultadoByPeriod[r.period] = r.value;
    }

    // 4. Pega a composição de Caixa (que contas formam)
    const caixaComposition = {};
    for (const c of caixaLines) {
      if (!caixaComposition[c.period]) caixaComposition[c.period] = { value: 0, accounts: [] };
      caixaComposition[c.period].value = c.value;
      caixaComposition[c.period].accounts = c.composition_account_codes || [];
    }

    // 5. Pega o trial balance direto para comparar
    const trials = await base44.asServiceRole.entities.FinancialTrialBalanceLine.filter({
      financial_upload_id: upload_id,
    }, 'period', 10000);

    // Normaliza os account_codes do plano
    const mappings = await base44.asServiceRole.entities.FinancialMappingResolution.filter({
      financial_upload_id: upload_id,
    }, 'account_code', 10000);

    const caixaMappings = (Array.isArray(mappings) ? mappings : []).filter(m => m.managerial_rubric === 'ativo_circulante_caixa');
    const caixaAccountCodes = new Set(caixaMappings.map(m => m.account_code));

    // Soma trial balance para contas mapeadas como caixa
    const caixaTrialByPeriod = {};
    for (const t of trials) {
      if (caixaAccountCodes.has(t.account_code)) {
        if (!caixaTrialByPeriod[t.period]) caixaTrialByPeriod[t.period] = 0;
        caixaTrialByPeriod[t.period] += t.closing_balance;
      }
    }

    return Response.json({
      upload_id,
      import_config: importConfig,
      caixa_mappings_count: caixaMappings.length,
      result: {
        by_period: Object.entries(caixaTrialByPeriod).map(([period, trial_value]) => ({
          period,
          trial_balance_sum: trial_value,
          statement_caixa_value: caixaComposition[period]?.value || 0,
          resultado_liquido: resultadoByPeriod[period] || 0,
          expected_with_vazao: (trial_value || 0) + (resultadoByPeriod[period] || 0),
          difference: (caixaComposition[period]?.value || 0) - trial_value,
          includes_resultado: (caixaComposition[period]?.value || 0) > trial_value ? 'SIM' : 'NÃO',
        })),
      },
    });
  } catch (error) {
    console.error('[debugCaixaVazao]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});