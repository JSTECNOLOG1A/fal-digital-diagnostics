import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

/**
 * Mapa de migração: (dimension_key, subdimension_key) → cluster_key padrão
 * Para perguntas sem mapeamento explícito
 */
const DEFAULT_CLUSTERS = {
  'governanca:governanca_societaria': 'acordo_socios',
  'governanca:ritos_governanca': 'reuniao_conselho',
  'juridico:contratos_comerciais': 'contratos_fornecedores',
  'juridico:compliance_legal': 'conformidade_ambiental',
  'controles_internos:controle_compras': 'requisicao_compras',
  'controles_internos:controle_estoque': 'recebimento_materiais',
  'controles_internos:controle_combustivel': 'abastecimento_combustivel',
  'financeiro:fluxo_caixa': 'previsibilidade_caixa',
  'financeiro:credito_cobranca': 'politica_credito',
  'financeiro:investimentos': 'aplicacoes_financeiras',
  'contabil:registros_contabeis': 'apropriacao_custos',
  'contabil:relatorios_contabeis': 'dre_mensal',
  'tributario:obrigacoes_fiscais': 'icms_ipi',
  'tributario:planejamento_tributario': 'regime_tributario',
  'operacional:planejamento_operacional': 'calendario_operacional',
  'operacional:producao_qualidade': 'linha_producao',
  'sistemas:infraestrutura': 'backup_dados',
  'sistemas:sistemas_erp': 'configuracao_erp',
  'sistemas:qualidade_dados': 'cadastro_maestro'
};

function isHQ(user) { return appRole === 'hq_admin'; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
    if (!WRITE_ROLES.has(appRole)) return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isHQ(user)) {
      return Response.json({ error: 'Forbidden: HQ admin only' }, { status: 403 });
    }

    const allQuestions = await base44.asServiceRole.entities.FalQuestion.list();
    console.log(`[migrateQuestionsToClusters] Processing ${allQuestions.length} questions`);

    const stats = { migrated: 0, already_mapped: 0, errors: 0 };

    for (const q of allQuestions) {
      try {
        // Se já tem cluster_key e subdimension_key, skip
        if (q.cluster_key && q.subdimension_key) {
          stats.already_mapped++;
          console.log(`  [SKIP] ${q.code} já tem cluster_key: ${q.cluster_key}`);
          continue;
        }

        // Tentar usar subdimensão existente
        let subdimKey = q.subdimension_key;
        if (!subdimKey && q.subdimension) {
          // Normalizar nome da subdimensão para chave (ex: "Fluxo de Caixa" → "fluxo_caixa")
          subdimKey = q.subdimension.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
        }

        const dimKey = q.dimension_key || q.dimension;
        if (!dimKey) {
          console.log(`  [ERROR] ${q.code} não tem dimension_key`);
          stats.errors++;
          continue;
        }

        // Achar cluster padrão
        const mapKey = `${dimKey}:${subdimKey}`;
        let clusterKey = DEFAULT_CLUSTERS[mapKey];

        if (!clusterKey) {
          console.log(`  [WARN] ${q.code} não tem mapeamento para ${mapKey}, pulando`);
          stats.errors++;
          continue;
        }

        // Atualizar pergunta
        await base44.asServiceRole.entities.FalQuestion.update(q.id, {
          dimension_key: dimKey,
          subdimension_key: subdimKey,
          cluster_key: clusterKey
        });

        stats.migrated++;
        console.log(`  [MIGRATE] ${q.code} → ${dimKey}/${subdimKey}/${clusterKey}`);
      } catch (e) {
        console.error(`  [ERROR] ${q.code}:`, e.message);
        stats.errors++;
      }
    }

    return Response.json({
      ok: true,
      message: 'Migração concluída',
      stats
    });
  } catch (error) {
    console.error('[migrateQuestionsToClusters] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});