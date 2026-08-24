/**
 * seedFalClusters — DEPRECATED / LEGACY — NÃO EXECUTAR
 * =====================================================================
 * ⚠️  AVISO CRÍTICO: Este script está DESATIVADO e NÃO deve ser executado.
 *
 * MOTIVO DA DESCONTINUAÇÃO:
 * Este arquivo pertence à versão 1 da matriz FAL (anterior a 2024).
 * Ele define uma taxonomia de subdimensões e clusters INCOMPATÍVEL com
 * a Matriz Oficial atual. Se executado, irá REVERTER o banco de dados
 * para a versão legada, corrompendo subdimensões, clusters e perguntas.
 *
 * SUBSTITUTO:
 * A estrutura de clusters é gerenciada pelo par:
 * - functions/restructureFalMatrix  → cria subdimensões e clusters
 * - components/fal/falOfficialMatrix.js → fonte única da matriz oficial
 *
 * DATA DE DESCONTINUAÇÃO: 2026-03-08
 * RAZÃO: Matriz FAL V1 → V2 consolidada em falOfficialMatrix.js
 * =====================================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // BLOQUEIO PERMANENTE — este script não pode mais ser executado
  return Response.json({
    error: 'DEPRECATED: seedFalClusters foi descontinuado.',
    reason: 'Este script pertence à Matriz FAL V1 e é incompatível com a matriz oficial atual (V2).',
    action: 'Use functions/restructureFalMatrix para recriar a estrutura de clusters a partir da matriz oficial.',
    deprecated_at: '2026-03-08',
    replacement: 'restructureFalMatrix',
  }, { status: 410 }); // 410 Gone
});