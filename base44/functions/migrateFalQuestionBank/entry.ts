/**
 * migrateFalQuestionBank — DEPRECATED / LEGACY — NÃO EXECUTAR
 * =====================================================================
 * ⚠️  AVISO CRÍTICO: Este script está DESATIVADO e NÃO deve ser executado.
 *
 * MOTIVO DA DESCONTINUAÇÃO:
 * Este arquivo contém mapeamentos de subdimensões e clusters da versão
 * LEGADA da Matriz FAL (V1), incluindo chaves como:
 * - 'estrutura_governanca', 'planejamento_estrategico' (V1 Governança)
 * - 'escrituracao_contabil', 'demonstracoes_financeiras' (V1 Contábil)
 * - 'endividamento_bancario', 'indicadores_financeiros' (V1 Financeiro)
 * - Clusters como 'bi_dashboards', 'automacao_processos', 'seguranca_dados'
 *
 * Esses slugs NÃO EXISTEM na Matriz Oficial atual (V2).
 * Executar este script causaria:
 * - Perguntas mapeadas para subdimensões inválidas (órfãs)
 * - Clusters inválidos sendo atribuídos a perguntas ativas
 * - Quebra do score por subdimensão/cluster em computeFalDiagnostic
 *
 * SUBSTITUTO:
 * O mapeamento de migração está centralizado em:
 * - components/fal/falOfficialMatrix.js (SUBDIM_MIGRATION_MAP + CLUSTER_MIGRATION_MAP)
 * - functions/restructureFalMatrix (executa migração com a matriz V2)
 * - functions/rebuildFalQuestionBank (reconstrói o banco com a matriz V2)
 *
 * DATA DE DESCONTINUAÇÃO: 2026-03-08
 * RAZÃO: Mapeamentos V1 incompatíveis com falOfficialMatrix.js
 * =====================================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // BLOQUEIO PERMANENTE — este script não pode mais ser executado
  return Response.json({
    error: 'DEPRECATED: migrateFalQuestionBank foi descontinuado.',
    reason: 'Este script contém mapeamentos da Matriz FAL V1, incompatíveis com a matriz oficial atual (V2). Executá-lo corromperia as perguntas existentes.',
    action: 'Use functions/restructureFalMatrix (que aplica QUESTION_MIGRATION_MAP da V2) ou functions/rebuildFalQuestionBank para reconstruir o banco.',
    deprecated_at: '2026-03-08',
    replacement: 'restructureFalMatrix ou rebuildFalQuestionBank',
    legacy_subdim_keys: [
      'estrutura_governanca', 'planejamento_estrategico', 'escrituracao_contabil',
      'demonstracoes_financeiras', 'endividamento_bancario', 'sistemas_gestao',
      'dados_bi', 'automacao', 'gestao_producao', 'logistica', 'gestao_pessoas'
    ],
  }, { status: 410 }); // 410 Gone
});