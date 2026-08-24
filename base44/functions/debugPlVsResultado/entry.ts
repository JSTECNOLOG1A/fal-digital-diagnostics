/**
 * debugPlVsResultado
 * Compara o saldo original da conta 2.03.02.02.00001 vs o saldo final no BP
 * e verifica se resultado_liquido foi somado
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
    // 1. Saldo ORIGINAL da conta 2.03.02.02.00001 no trial balance
    const trialLines = await base44.asServiceRole.entities.FinancialTrialBalanceLine.filter({
      financial_upload_id: upload_id,
      account_code: '203020200001',
    }, 'period', 20);

    // 2. Resultado líquido da DRE
    const resultLines = await base44.asServiceRole.entities.FinancialStatementLine.filter({
      financial_upload_id: upload_id,
      canonical_key: 'resultado_liquido',
    }, 'period', 20);

    // 3. Todas as linhas do BP para procurar onde essa conta pode estar
    const bpLines = await base44.asServiceRole.entities.FinancialStatementLine.filter({
      financial_upload_id: upload_id,
      statement_code: 'BP',
    }, 'period', 100);

    // 4. Montar comparação por período
    const periods = [...new Set([
      ...trialLines.map(t => t.period),
      ...resultLines.map(r => r.period),
    ])].sort();

    const comparison = periods.map(period => {
      const trial = trialLines.find(t => t.period === period);
      const result = resultLines.find(r => r.period === period);
      
      // Procura linhas do BP que contenham essa conta ou que sejam de patrimônio
      const plBpLines = bpLines.filter(l => 
        l.period === period && 
        (l.composition_account_codes?.includes('203020200001') || 
         l.canonical_key?.includes('patrimonio') ||
         l.canonical_key?.includes('lucros'))
      );

      return {
        period,
        trial_balance_saldo: trial?.closing_balance ?? null,
        resultado_liquido_dre: result?.value ?? 0,
        expected_pl_saldo: (trial?.closing_balance ?? 0) + (result?.value ?? 0),
        bp_lines_found: plBpLines.map(l => ({
          canonical_key: l.canonical_key,
          rubric_label: l.rubric_label,
          value: l.value,
          has_this_account: l.composition_account_codes?.includes('203020200001') || false,
        })),
      };
    });

    return Response.json({
      account: '2.03.02.02.00001',
      trial_balance_lines: trialLines.length,
      resultado_liquido_periods: resultLines.length,
      comparison_by_period: comparison,
      summary: {
        periods_analyzed: periods.length,
        account_in_trial: trialLines.length > 0,
        resultado_has_values: resultLines.some(r => r.value !== 0),
      },
    });
  } catch (error) {
    console.error('[debugPlVsResultado]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});