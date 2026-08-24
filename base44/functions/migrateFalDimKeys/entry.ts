/**
 * migrateFalDimKeys
 *
 * Migra todas as FalQuestion com dimension_key em inglês para português.
 * Executa em lotes para evitar timeout.
 *
 * Mapeamento:
 *   governance        → governanca
 *   legal             → juridico
 *   internal_controls → controles_internos
 *   financial         → financeiro
 *   accounting        → contabil
 *   tax               → tributario
 *   operations        → operacional
 *   technology        → sistemas
 *
 * Admin-only. Payload: { dry_run?: boolean }
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

const DIM_EN_TO_PT = {
  'governance':        'governanca',
  'legal':             'juridico',
  'internal_controls': 'controles_internos',
  'financial':         'financeiro',
  'accounting':        'contabil',
  'tax':               'tributario',
  'operations':        'operacional',
  'technology':        'sistemas',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (appRole !== 'hq_admin') {
      return Response.json({ error: 'Forbidden: Admin apenas' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dry_run = body?.dry_run === true;

    console.log(`[migrateFalDimKeys] Iniciando${dry_run ? ' (DRY RUN)' : ''}...`);

    const allQuestions = await base44.asServiceRole.entities.FalQuestion.list();
    const toMigrate = allQuestions.filter(q => DIM_EN_TO_PT[q.dimension_key]);

    console.log(`[migrateFalDimKeys] Total no banco: ${allQuestions.length} | A migrar: ${toMigrate.length}`);

    if (toMigrate.length === 0) {
      // Contar distribuição atual
      const byDim = {};
      for (const q of allQuestions) {
        byDim[q.dimension_key] = (byDim[q.dimension_key] || 0) + 1;
      }
      return Response.json({
        status: 'ok',
        message: 'Nenhuma pergunta com dimension_key em inglês encontrada. Banco já está em PT.',
        total_questions: allQuestions.length,
        by_dimension: byDim,
        migrated: 0,
      });
    }

    // Preview das chaves que serão migradas
    const preview = {};
    for (const q of toMigrate) {
      const from = q.dimension_key;
      const to = DIM_EN_TO_PT[from];
      if (!preview[from]) preview[from] = { to, count: 0 };
      preview[from].count++;
    }

    if (dry_run) {
      return Response.json({
        dry_run: true,
        total_questions: allQuestions.length,
        to_migrate: toMigrate.length,
        migration_plan: preview,
      });
    }

    // Executar migração com delay para evitar rate limit
    let migrated = 0;
    let errors = 0;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (const q of toMigrate) {
      const newDimKey = DIM_EN_TO_PT[q.dimension_key];
      try {
        await base44.asServiceRole.entities.FalQuestion.update(q.id, { dimension_key: newDimKey });
        migrated++;
        if (migrated % 10 === 0) {
          console.log(`[migrateFalDimKeys] Progresso: ${migrated}/${toMigrate.length}`);
          await sleep(300); // pausa a cada 10 para evitar rate limit
        }
      } catch (e) {
        console.error(`[migrateFalDimKeys] Erro ao migrar ${q.id}: ${e.message}`);
        errors++;
        await sleep(1000); // pausa maior em caso de erro
      }
    }

    // Contagem final
    const allAfter = await base44.asServiceRole.entities.FalQuestion.list();
    const byDimAfter = {};
    for (const q of allAfter) {
      byDimAfter[q.dimension_key] = (byDimAfter[q.dimension_key] || 0) + 1;
    }

    console.log(`[migrateFalDimKeys] Concluído: migrated=${migrated} errors=${errors}`);

    return Response.json({
      status: errors === 0 ? 'ok' : 'partial',
      total_questions: allAfter.length,
      migrated,
      errors,
      migration_plan: preview,
      by_dimension_after: byDimAfter,
    });

  } catch (error) {
    console.error('[migrateFalDimKeys] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});