/**
 * updateFinancialJourneyPosition — F2-JRN-01 (RESIDUAL 3).
 *
 * Persiste a posição de navegação da jornada POR USUÁRIO em FinancialJourneyPosition.
 * NÃO modifica FinancialDiagnosis — a posição é uma preferência pessoal, não
 * um estado produtivo do diagnóstico.
 *
 * Regras:
 *   - Upsert em FinancialJourneyPosition pela chave (financial_diagnosis_id + user_id).
 *   - client_viewer pode atualizar sua própria preferência (read-only navigation).
 *   - Não executar mutation em FinancialDiagnosis.
 *
 * Payload: { financial_diagnosis_id, step }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const VALID_STEPS = new Set([
  'estrutura', 'fontes', 'combinacao', 'conciliacao', 'cedula',
  'preparacao', 'validacao', 'analise', 'consolidacao',
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (!WRITE_ROLES.has(appRole)) return Response.json({ error: 'Forbidden: navigation persistence requires write permission' }, { status: 403 });

    const { financial_diagnosis_id, step } = await req.json();
    if (!financial_diagnosis_id || !step) {
      return Response.json({ error: 'financial_diagnosis_id e step são obrigatórios' }, { status: 400 });
    }
    if (!VALID_STEPS.has(step)) {
      return Response.json({ error: `Step inválido: ${step}` }, { status: 400 });
    }

    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    if (appRole !== 'hq_admin' && diagnosis.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: diagnóstico não pertence ao seu tenant' }, { status: 403 });
    }

    // Validar que o step é acessível segundo o estado canônico
    const journeyResult = await base44.functions.invoke('getFinancialJourneyState', {
      financial_diagnosis_id,
    });
    const journey = journeyResult?.data || journeyResult;
    if (!journey) {
      return Response.json({ error: 'Falha ao obter estado da jornada' }, { status: 500 });
    }

    const stepObj = (journey.steps || []).find((s) => s.key === step);
    if (!stepObj) {
      return Response.json({ error: `Step ${step} não existe na jornada deste tipo de análise` }, { status: 400 });
    }
    if (!stepObj.accessible) {
      return Response.json({
        error: `Step ${step} não é acessível — complete as etapas anteriores`,
        blocking_reasons: stepObj.blocking_reasons || [],
      }, { status: 403 });
    }

    // ── F2-JRN-01: Upsert em FinancialJourneyPosition (NÃO em FinancialDiagnosis) ──
    const now = new Date().toISOString();
    const existing = await base44.asServiceRole.entities.FinancialJourneyPosition.filter(
      { financial_diagnosis_id, user_id: user.id },
      '-updated_at',
      10
    );

    const payload = {
      tenant_id: diagnosis.tenant_id,
      financial_diagnosis_id,
      user_id: user.id,
      user_email: user.email,
      step,
      updated_at: now,
    };

    let position;
    if (existing.length > 0) {
      position = await base44.asServiceRole.entities.FinancialJourneyPosition.update(
        existing[0].id,
        payload
      );
    } else {
      position = await base44.asServiceRole.entities.FinancialJourneyPosition.create(payload);
    }

    return Response.json({
      success: true,
      financial_diagnosis_id,
      step,
      accessible: true,
      updated_at: now,
      position_id: position?.id || null,
      // Confirmação de que FinancialDiagnosis NÃO foi modificado
      diagnosis_unchanged: true,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});