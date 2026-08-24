/**
 * fixFalGroupApplicability
 * Correção cirúrgica: adiciona 'group' ao level_applicability das perguntas
 * active=true, generation='official' nas dimensões que não têm 'group'.
 * Admin-only. Suporta dry_run e offset para continuar de onde parou.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const DIMS_TO_FIX = ['controles_internos','financeiro','contabil','tributario','operacional','sistemas'];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: hq_admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dry_run = body.dry_run === true;
    const start_offset = body.offset || 0; // allow resuming from offset

    const allQuestions = await base44.asServiceRole.entities.FalQuestion.list();

    const toFix = allQuestions.filter(q => {
      if (q.active === false) return false;
      if (q.generation === 'legacy') return false;
      if (!DIMS_TO_FIX.includes(q.dimension_key)) return false;
      return !(q.level_applicability || []).includes('group');
    });

    // Audit counts
    const byDim = {};
    for (const q of allQuestions.filter(q => q.active !== false && q.generation !== 'legacy')) {
      const dim = q.dimension_key;
      if (!byDim[dim]) byDim[dim] = { total: 0, missing_group: 0, has_group: 0 };
      byDim[dim].total++;
      if ((q.level_applicability || []).includes('group')) byDim[dim].has_group++;
      else byDim[dim].missing_group++;
    }

    if (dry_run) {
      return Response.json({ dry_run: true, total: allQuestions.length, to_fix: toFix.length, by_dimension: byDim });
    }

    const batch = toFix.slice(start_offset, start_offset + 100); // process 100 at a time
    let fixed = 0, errors = 0;
    const errorList = [];

    for (const q of batch) {
      const currentLevels = q.level_applicability || ['company','unit'];
      const newLevels = ['group', ...currentLevels.filter(l => l !== 'group')];
      try {
        await base44.asServiceRole.entities.FalQuestion.update(q.id, { level_applicability: newLevels });
        fixed++;
      } catch (e) {
        errors++;
        errorList.push(`${q.code}: ${e.message}`);
      }
      await sleep(200); // 200ms throttle = ~5 req/s, safe for rate limits
    }

    const next_offset = start_offset + 100;
    const remaining = Math.max(0, toFix.length - next_offset);

    console.log(`[fixFalGroupApplicability] batch done: fixed=${fixed}, errors=${errors}, remaining=${remaining}`);

    return Response.json({
      ok: true,
      batch_fixed: fixed,
      batch_errors: errors,
      processed_range: `${start_offset}-${start_offset + batch.length - 1}`,
      total_to_fix: toFix.length,
      remaining,
      next_offset: remaining > 0 ? next_offset : null,
      done: remaining === 0,
      error_details: errorList,
    });

  } catch (error) {
    console.error('[fixFalGroupApplicability] FATAL:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});