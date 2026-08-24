/**
 * auditTenantGuardProof — DEPRECATED (410 Gone)
 * =====================================================================
 * This function has been deprecated because it performed LOGICAL
 * verification of tenant guards, not a REAL cross-tenant access attempt.
 *
 * The previous implementation:
 *   1. Used an HQ session
 *   2. Loaded a cross-tenant resource via asServiceRole
 *   3. Calculated whether the guard "would block"
 *   4. Concluded the guard was effective
 *
 * This is NOT a runtime proof — it's a static analysis disguised as a
 * runtime test. The HQ session bypasses the very guard being tested,
 * making the "proof" circular.
 *
 * SEG-01 requires REAL multi-session proof with non-HQ users making
 * actual authenticated requests. This function cannot provide that.
 *
 * Consumers: None in the productive frontend. This was an admin-only
 * diagnostic tool. No UI components reference it.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    return Response.json({
      error: 'Gone',
      deprecated: true,
      message: 'This function has been deprecated. It performed logical verification of tenant guards using an HQ session, not a real cross-tenant access attempt by a non-HQ user. SEG-01 requires real multi-session proof.',
      replacement: 'Use real authenticated sessions with non-HQ users for SEG-01 proof.',
      timestamp: new Date().toISOString(),
    }, { status: 410 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});