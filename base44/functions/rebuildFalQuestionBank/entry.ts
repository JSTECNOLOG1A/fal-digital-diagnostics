/**
 * rebuildFalQuestionBank — DESATIVADO
 *
 * ⚠️  ESTE ENDPOINT FOI DESATIVADO.
 *
 * O banco hardcoded legado (perguntas em português com dimensões antigas)
 * não deve mais ser repopulado. O sistema opera exclusivamente com o
 * banco FAL v3 importado via CSV pelo endpoint `importFalQuestions`.
 *
 * Para gerenciar o banco de perguntas:
 *   - Importar novo CSV v3: use `importFalQuestions` com purge_first=true
 *   - Validar banco atual: use `buildFalQuestionSet` com dry_run
 *
 * Dimensões ativas: governance, legal, internal_controls, financial,
 *                   accounting, tax, operations, technology
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    return Response.json({
      error: 'rebuildFalQuestionBank está DESATIVADO.',
      reason: 'O banco hardcoded legado foi substituído pelo banco FAL v3 (CSV importado).',
      action: 'Para reimportar o banco, use o endpoint "importFalQuestions" com purge_first=true.',
      valid_dimensions: ['governance','legal','internal_controls','financial','accounting','tax','operations','technology'],
    }, { status: 410 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});