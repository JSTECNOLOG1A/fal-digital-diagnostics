/**
 * seedFalValueLevers
 * Popula a entidade FalClusterValueLever com os vínculos iniciais entre clusters e alavancas de valor.
 * Idempotente: apaga todos os registros existentes antes de reinserir.
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

const SEED_DATA = [
  // Geração de Caixa
  { cluster_key: 'fluxo_caixa',               value_lever_key: 'geracao_caixa',          impact_weight: 5 },
  { cluster_key: 'fluxo_caixa',               value_lever_key: 'preservacao_margem',     impact_weight: 3 },
  { cluster_key: 'credito_cobranca',           value_lever_key: 'geracao_caixa',          impact_weight: 5 },
  { cluster_key: 'gestao_receita',             value_lever_key: 'geracao_caixa',          impact_weight: 4 },
  { cluster_key: 'sazonalidade',               value_lever_key: 'geracao_caixa',          impact_weight: 4 },
  { cluster_key: 'gestao_estoques',            value_lever_key: 'geracao_caixa',          impact_weight: 3 },
  { cluster_key: 'gestao_estoques',            value_lever_key: 'preservacao_margem',     impact_weight: 4 },
  // Preservação de Margem
  { cluster_key: 'controle_combustivel',       value_lever_key: 'preservacao_margem',     impact_weight: 5 },
  { cluster_key: 'controle_combustivel',       value_lever_key: 'eficiencia_operacional', impact_weight: 4 },
  { cluster_key: 'perdas_estoque',             value_lever_key: 'preservacao_margem',     impact_weight: 5 },
  { cluster_key: 'apropriacao_custos',         value_lever_key: 'preservacao_margem',     impact_weight: 4 },
  { cluster_key: 'custo_producao',             value_lever_key: 'preservacao_margem',     impact_weight: 4 },
  { cluster_key: 'contratos_fornecedores',     value_lever_key: 'preservacao_margem',     impact_weight: 3 },
  // Redução de Risco
  { cluster_key: 'segregacao_funcoes',         value_lever_key: 'reducao_risco',          impact_weight: 5 },
  { cluster_key: 'segregacao_funcoes',         value_lever_key: 'protecao_patrimonial',   impact_weight: 4 },
  { cluster_key: 'litigios_contingencias',     value_lever_key: 'reducao_risco',          impact_weight: 5 },
  { cluster_key: 'litigios_contingencias',     value_lever_key: 'protecao_patrimonial',   impact_weight: 4 },
  { cluster_key: 'compliance_fiscal',          value_lever_key: 'reducao_risco',          impact_weight: 4 },
  { cluster_key: 'auditoria_interna',          value_lever_key: 'reducao_risco',          impact_weight: 4 },
  { cluster_key: 'controles_acesso',           value_lever_key: 'reducao_risco',          impact_weight: 3 },
  { cluster_key: 'seguranca_dados',            value_lever_key: 'reducao_risco',          impact_weight: 4 },
  // Eficiência Operacional
  { cluster_key: 'integracao_erp',             value_lever_key: 'eficiencia_operacional', impact_weight: 4 },
  { cluster_key: 'integracao_erp',             value_lever_key: 'preservacao_margem',     impact_weight: 3 },
  { cluster_key: 'manutencao_preventiva',      value_lever_key: 'eficiencia_operacional', impact_weight: 5 },
  { cluster_key: 'manutencao_preventiva',      value_lever_key: 'preservacao_margem',     impact_weight: 3 },
  { cluster_key: 'logistica_distribuicao',     value_lever_key: 'eficiencia_operacional', impact_weight: 4 },
  { cluster_key: 'planejamento_producao',      value_lever_key: 'eficiencia_operacional', impact_weight: 4 },
  { cluster_key: 'gestao_pessoas',             value_lever_key: 'eficiencia_operacional', impact_weight: 3 },
  { cluster_key: 'bi_dashboards',              value_lever_key: 'eficiencia_operacional', impact_weight: 3 },
  // Proteção Patrimonial
  { cluster_key: 'sucessao_continuidade',      value_lever_key: 'protecao_patrimonial',   impact_weight: 5 },
  { cluster_key: 'estrutura_societaria',       value_lever_key: 'protecao_patrimonial',   impact_weight: 5 },
  { cluster_key: 'acordo_socios',              value_lever_key: 'protecao_patrimonial',   impact_weight: 4 },
  { cluster_key: 'holding_patrimonial',        value_lever_key: 'protecao_patrimonial',   impact_weight: 5 },
  { cluster_key: 'seguros',                    value_lever_key: 'protecao_patrimonial',   impact_weight: 4 },
  { cluster_key: 'planejamento_tributario',    value_lever_key: 'protecao_patrimonial',   impact_weight: 3 },
  { cluster_key: 'planejamento_tributario',    value_lever_key: 'reducao_risco',          impact_weight: 4 },
  { cluster_key: 'governanca_corporativa',     value_lever_key: 'protecao_patrimonial',   impact_weight: 4 },
  { cluster_key: 'governanca_corporativa',     value_lever_key: 'reducao_risco',          impact_weight: 3 },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: HQ admin only' }, { status: 403 });

    // Delete existing
    const existing = await base44.asServiceRole.entities.FalClusterValueLever.list();
    for (const rec of existing) {
      await base44.asServiceRole.entities.FalClusterValueLever.delete(rec.id);
    }

    // Insert seed
    const created = [];
    for (const row of SEED_DATA) {
      const rec = await base44.asServiceRole.entities.FalClusterValueLever.create(row);
      created.push(rec);
    }

    return Response.json({ success: true, seeded: created.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});