/**
 * runtimeSecurityProof — HQ-Only Administrative Security Testing Tool
 * =====================================================================
 * 
 * ⚠️  CLASSIFICATION: HQ_GLOBAL (administrative tool, NOT SEG-01 proof)
 * 
 * This function is an HQ-only administrative tool that invokes real
 * protected backend functions and reports real HTTP status codes.
 *
 * IMPORTANT — NOT SEG-01 PROOF FOR NON-HQ USERS:
 *   The HQ-only guard at the entry point rejects non-HQ users (consultant,
 *   tenant_admin, client_viewer) with 403 BEFORE any test scenario executes.
 *   Therefore, branches like `if (appRole === 'client_viewer')` never
 *   execute in runtime for non-HQ users — they are dead code paths.
 *
 *   SEG-01 requires REAL multi-session proof with non-HQ users making
 *   actual authenticated requests. This function CANNOT provide that
 *   because it rejects non-HQ users at the door.
 *
 * ACTUAL UTILITY:
 *   - HQ admin can test whether protected functions correctly deny
 *     cross-tenant access when invoked with the HQ session
 *   - HQ admin can verify that same-tenant access works
 *   - HQ admin can test role-guarded functions (expecting ALLOW for HQ)
 *
 * PAYLOAD: {
 *   scenario: 'cross_tenant' | 'same_tenant' | 'role_check' | 'hq_global',
 *   target_assessment_id?,
 *   target_diagnosis_id?,
 *   target_plan_id?,
 * }
 *
 * Returns: {
 *   user_email, user_role, user_tenant_id,
 *   scenario,
 *   tests: [{
 *     function_name, payload, http_status, allowed, error,
 *     expected: 'DENY' | 'ALLOW', actual: 'DENY' | 'ALLOW', passed: boolean
 *   }],
 *   summary: { total, passed, failed }
 * }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { scenario = 'cross_tenant', target_assessment_id, target_diagnosis_id, target_plan_id } = body;

    const userTenantId = user.tenant_id || null;

    // ── SEG-02: HQ-only guard — this function discovers cross-tenant IDs
    //    via asServiceRole, creating its own exposure surface. It must NOT
    //    be available to any authenticated user. Non-HQ → 403 immediately.
    if (!isHQ) {
      return Response.json(
        { error: 'Forbidden: runtimeSecurityProof is HQ-only', proof_passed: false },
        { status: 403 }
      );
    }

    const tests = [];

    // ── Helper: invoke a function and capture REAL HTTP status ────────────
    async function invokeReal(fnName, payload, expected) {
      try {
        const res = await base44.functions.invoke(fnName, payload);
        // base44.functions.invoke returns an Axios-like response
        const status = res?.status || 200;
        const hasError = res?.data?.error || (status >= 400);
        return {
          function_name: fnName,
          payload,
          http_status: status,
          allowed: !hasError,
          error: hasError ? (res?.data?.error || `HTTP ${status}`) : null,
          expected,
          actual: hasError ? 'DENY' : 'ALLOW',
          passed: (expected === 'DENY' && hasError) || (expected === 'ALLOW' && !hasError),
        };
      } catch (e) {
        // Axios throws on 4xx/5xx — extract the real status
        const status = e?.response?.status || e?.status || 500;
        const errorMsg = e?.response?.data?.error || e?.message || 'Request failed';
        return {
          function_name: fnName,
          payload,
          http_status: status,
          allowed: false,
          error: errorMsg,
          expected,
          actual: 'DENY',
          passed: expected === 'DENY',
        };
      }
    }

    // ── Discover cross-tenant IDs if not provided ────────────────────────
    let crossTenantAssessmentId = target_assessment_id;
    let crossTenantDiagnosisId = target_diagnosis_id;

    if (scenario === 'cross_tenant' && !crossTenantAssessmentId) {
      // Find an assessment from a DIFFERENT tenant
      const allAssessments = await base44.asServiceRole.entities.Assessment.filter({}, '-created_date', 50);
      const otherTenantAssessment = allAssessments.find(a => a.tenant_id !== userTenantId);
      if (otherTenantAssessment) {
        crossTenantAssessmentId = otherTenantAssessment.id;
      }
    }

    if (scenario === 'cross_tenant' && !crossTenantDiagnosisId) {
      // Find a financial diagnosis from a DIFFERENT tenant
      const allDiagnoses = await base44.asServiceRole.entities.FinancialDiagnosis.filter({}, '-created_date', 50);
      const otherTenantDiagnosis = allDiagnoses.find(d => d.tenant_id !== userTenantId);
      if (otherTenantDiagnosis) {
        crossTenantDiagnosisId = otherTenantDiagnosis.id;
      }
    }

    // ── SCENARIO: cross_tenant — expect ALL calls to DENY (non-HQ) ───────
    if (scenario === 'cross_tenant') {
      if (crossTenantAssessmentId) {
        tests.push(await invokeReal('getAssessmentFlow', {
          assessment_id: crossTenantAssessmentId,
        }, isHQ ? 'ALLOW' : 'DENY'));
      }

      if (crossTenantDiagnosisId) {
        // checkFinancialDiagnosisIntegrity expects financial_diagnosis_id
        // (buildFinancialStatements removed: requires upload_id/prepared_run_id
        //  which the proof function doesn't have, causing 400 regardless of tenant)
        tests.push(await invokeReal('checkFinancialDiagnosisIntegrity', {
          financial_diagnosis_id: crossTenantDiagnosisId,
        }, isHQ ? 'ALLOW' : 'DENY'));
      }

      if (target_plan_id) {
        tests.push(await invokeReal('deduplicateActionPlanReviews', {
          plan_id: target_plan_id,
        }, isHQ ? 'ALLOW' : 'DENY'));
      }
    }

    // ── SCENARIO: same_tenant — expect ALL calls to ALLOW ────────────────
    if (scenario === 'same_tenant') {
      // Find an assessment from the user's OWN tenant
      let ownAssessmentId = target_assessment_id;
      if (!ownAssessmentId && userTenantId) {
        const ownAssessments = await base44.asServiceRole.entities.Assessment.filter(
          { tenant_id: userTenantId }, '-created_date', 5
        );
        if (ownAssessments.length > 0) ownAssessmentId = ownAssessments[0].id;
      }

      if (ownAssessmentId) {
        tests.push(await invokeReal('getAssessmentFlow', {
          assessment_id: ownAssessmentId,
        }, 'ALLOW'));
      }

      let ownDiagnosisId = target_diagnosis_id;
      if (!ownDiagnosisId && userTenantId) {
        const ownDiagnoses = await base44.asServiceRole.entities.FinancialDiagnosis.filter(
          { tenant_id: userTenantId }, '-created_date', 5
        );
        if (ownDiagnoses.length > 0) ownDiagnosisId = ownDiagnoses[0].id;
      }

      if (ownDiagnosisId) {
        tests.push(await invokeReal('checkFinancialDiagnosisIntegrity', {
          financial_diagnosis_id: ownDiagnosisId,
        }, 'ALLOW'));
      }
    }

    // ── SCENARIO: role_check — test write operations for read-only roles ─
    if (scenario === 'role_check') {
      // Test admin-only functions — HQ-only function: expect ALLOW for HQ, DENY otherwise
      tests.push(await invokeReal('seedFalLibrariesAgronegocio', {}, isHQ ? 'ALLOW' : 'DENY'));

      // Test debug function (HQ-only)
      tests.push(await invokeReal('debugCaixaComposition', {
        financial_diagnosis_id: target_diagnosis_id || 'test',
      }, isHQ ? 'ALLOW' : 'DENY'));

      // For client_viewer, test write operations
      if (appRole === 'client_viewer') {
        let ownAssessmentId = target_assessment_id;
        if (!ownAssessmentId && userTenantId) {
          const ownAssessments = await base44.asServiceRole.entities.Assessment.filter(
            { tenant_id: userTenantId }, '-created_date', 5
          );
          if (ownAssessments.length > 0) ownAssessmentId = ownAssessments[0].id;
        }
        if (ownAssessmentId) {
          tests.push(await invokeReal('generateActionPlan', {
            assessmentId: ownAssessmentId,
          }, 'DENY')); // client_viewer should be denied
        }
      }
    }

    // ── SCENARIO: hq_global — HQ can access any tenant ───────────────────
    if (scenario === 'hq_global' && isHQ) {
      if (crossTenantAssessmentId) {
        tests.push(await invokeReal('getAssessmentFlow', {
          assessment_id: crossTenantAssessmentId,
        }, 'ALLOW'));
      }
    }

    // ── Summary ──────────────────────────────────────────────────────────
    const summary = {
      total: tests.length,
      passed: tests.filter(t => t.passed).length,
      failed: tests.filter(t => !t.passed).length,
    };

    return Response.json({
      ok: true,
      user_email: user.email,
      user_role: user.role,
      user_tenant_id: userTenantId,
      is_hq: isHQ,
      scenario,
      // SEG-02: Do NOT expose cross-tenant IDs — this would create an
      // information disclosure surface. Only report whether IDs were found.
      cross_tenant_ids_found: !!(crossTenantAssessmentId || crossTenantDiagnosisId),
      tests,
      summary,
      all_passed: summary.failed === 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});