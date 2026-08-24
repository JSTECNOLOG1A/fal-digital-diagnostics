/**
 * debugPlMapping
 * Verifica se a conta do PL selecionada (2.03.02.02.00001) está sendo mapeada e se o resultado_liquido é somado
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

  // Se não passou IDs, busca os últimos
  if (!upload_id || !diagnosis_id) {
    const uploads = await base44.asServiceRole.entities.FinancialUpload.filter({}, '-created_date', 1);
    if (uploads.length === 0) {
      return Response.json({ error: 'Nenhum upload encontrado' }, { status: 404 });
    }
    upload_id = uploads[0].id;
    diagnosis_id = uploads[0].financial_diagnosis_id;
  }

  try {
    // 1. Buscar o upload para ver o que foi salvo no processing_log
    const upload = await base44.asServiceRole.entities.FinancialUpload.get(upload_id);
    let processingMeta = {};
    try {
      processingMeta = JSON.parse(upload.processing_log || '{}');
    } catch (e) {
      console.log('Erro ao parse processing_log:', e.message);
    }

    // 2. Buscar a conta 2.03.02.02.00001 no trial balance
    const trialLines = await base44.asServiceRole.entities.FinancialTrialBalanceLine.filter({
      financial_upload_id: upload_id,
      account_code: '2030202000001', // normalizado (sem pontos)
    }, 'period', 10);

    // 3. Buscar mapeamentos para essa conta
    const mappings = await base44.asServiceRole.entities.FinancialMappingResolution.filter({
      financial_upload_id: upload_id,
      account_code: '2030202000001',
    }, 'period', 10);

    // 4. Buscar resultado_liquido na DRE para cada período
    const resultLines = await base44.asServiceRole.entities.FinancialStatementLine.filter({
      financial_upload_id: upload_id,
      canonical_key: 'resultado_liquido',
    }, 'period', 20);

    // 5. Buscar a linha do PL (patrimonio_liquido ou a canonical_key da conta mapeada)
    const plLines = await base44.asServiceRole.entities.FinancialStatementLine.filter({
      financial_upload_id: upload_id,
      statement_code: 'BP',
    }, 'period', 100);

    const plLinesForAccount = plLines.filter(l => 
      l.canonical_key && (
        l.canonical_key.includes('patrimonio') || 
        l.canonical_key.includes('lucros') ||
        l.composition_account_codes?.includes('2030202000001')
      )
    );

    return Response.json({
      processing_meta: processingMeta,
      selected_account: '2.03.02.02.00001 (normalizado: 2030202000001)',
      trial_balance_lines: trialLines.map(t => ({
        period: t.period,
        closing_balance: t.closing_balance,
        account_description: t.account_description,
      })),
      account_mappings: mappings.map(m => ({
        period: m.period,
        canonical_key: m.canonical_key,
        classification: m.classification,
        confidence: m.resolved_confidence,
      })),
      dre_resultado_liquido: resultLines.map(r => ({
        period: r.period,
        value: r.value,
        canonical_key: r.canonical_key,
      })),
      pl_statement_lines_containing_account: plLinesForAccount.map(l => ({
        period: l.period,
        canonical_key: l.canonical_key,
        rubric_label: l.rubric_label,
        value: l.value,
        composition_accounts: l.composition_account_codes?.length || 0,
      })),
      summary: {
        pl_canonical_key_from_config: processingMeta.pl_canonical_key,
        account_found_in_trial: trialLines.length > 0,
        account_mapped: mappings.length > 0,
        mapped_to_canonical_key: mappings[0]?.canonical_key || 'NÃO MAPEADO',
        resultado_liquido_periods: resultLines.length,
        pl_lines_found: plLinesForAccount.length,
      },
    });
  } catch (error) {
    console.error('[debugPlMapping]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});