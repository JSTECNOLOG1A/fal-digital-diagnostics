/**
 * seedFalClusterMeta
 * Popula FalClusterMeta com os pesos iniciais de priorização para todos os clusters.
 * Admin-only. Idempotente por cluster_key.
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

// Regras de peso por cluster
// impact_weight, legal_risk_weight, operational_risk_weight, financial_impact_weight, implementation_effort_weight
const CLUSTER_META = [
  // === GOVERNANÇA ===
  { cluster_key:'acordo_socios',          dimension_key:'governanca', subdimension_key:'governanca_societaria', priority_category:'juridico',     impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:4 },
  { cluster_key:'estatuto_contrato_social',dimension_key:'governanca',subdimension_key:'governanca_societaria', priority_category:'juridico',     impact_weight:4, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:3, implementation_effort_weight:3 },
  { cluster_key:'estrutura_controle',     dimension_key:'governanca', subdimension_key:'governanca_societaria', priority_category:'governanca',    impact_weight:4, legal_risk_weight:4, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:3 },
  { cluster_key:'plano_sucessao',         dimension_key:'governanca', subdimension_key:'sucessao_continuidade', priority_category:'governanca',    impact_weight:5, legal_risk_weight:3, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:4 },
  { cluster_key:'holding_familiar',       dimension_key:'governanca', subdimension_key:'sucessao_continuidade', priority_category:'juridico',     impact_weight:5, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:5, implementation_effort_weight:5 },
  { cluster_key:'continuidade_negocio',   dimension_key:'governanca', subdimension_key:'sucessao_continuidade', priority_category:'governanca',    impact_weight:5, legal_risk_weight:3, operational_risk_weight:5, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'alcadas_aprovacao',      dimension_key:'governanca', subdimension_key:'regras_decisao_conflitos', priority_category:'operacional', impact_weight:4, legal_risk_weight:3, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'resolucao_conflitos',    dimension_key:'governanca', subdimension_key:'regras_decisao_conflitos', priority_category:'juridico',   impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:3 },
  { cluster_key:'tag_drag_along',         dimension_key:'governanca', subdimension_key:'regras_decisao_conflitos', priority_category:'juridico',   impact_weight:4, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:4, implementation_effort_weight:4 },
  { cluster_key:'relatorio_socios',       dimension_key:'governanca', subdimension_key:'transparencia_prestacao_contas', priority_category:'governanca', impact_weight:4, legal_risk_weight:3, operational_risk_weight:2, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'auditoria_externa',      dimension_key:'governanca', subdimension_key:'transparencia_prestacao_contas', priority_category:'juridico', impact_weight:4, legal_risk_weight:4, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:3 },
  { cluster_key:'politica_dividendos',    dimension_key:'governanca', subdimension_key:'transparencia_prestacao_contas', priority_category:'financeiro', impact_weight:4, legal_risk_weight:4, operational_risk_weight:2, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'reuniao_conselho',       dimension_key:'governanca', subdimension_key:'ritos_gestao', priority_category:'governanca',             impact_weight:4, legal_risk_weight:2, operational_risk_weight:3, financial_impact_weight:2, implementation_effort_weight:1 },
  { cluster_key:'reuniao_diretoria',      dimension_key:'governanca', subdimension_key:'ritos_gestao', priority_category:'governanca',             impact_weight:4, legal_risk_weight:2, operational_risk_weight:4, financial_impact_weight:3, implementation_effort_weight:1 },
  { cluster_key:'ata_decisao',            dimension_key:'governanca', subdimension_key:'ritos_gestao', priority_category:'governanca',             impact_weight:3, legal_risk_weight:3, operational_risk_weight:3, financial_impact_weight:2, implementation_effort_weight:1 },
  { cluster_key:'kpis_estrategicos',      dimension_key:'governanca', subdimension_key:'metas_indicadores', priority_category:'governanca',         impact_weight:4, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'painel_gestao',          dimension_key:'governanca', subdimension_key:'metas_indicadores', priority_category:'tecnologia',          impact_weight:4, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:3, implementation_effort_weight:3 },
  { cluster_key:'metas_equipe',           dimension_key:'governanca', subdimension_key:'metas_indicadores', priority_category:'operacional',         impact_weight:4, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'orcamento_anual',        dimension_key:'governanca', subdimension_key:'planejamento_orcamento', priority_category:'financeiro',     impact_weight:5, legal_risk_weight:2, operational_risk_weight:4, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'plano_estrategico',      dimension_key:'governanca', subdimension_key:'planejamento_orcamento', priority_category:'governanca',     impact_weight:5, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:4 },
  { cluster_key:'revisao_orcamento',      dimension_key:'governanca', subdimension_key:'planejamento_orcamento', priority_category:'financeiro',     impact_weight:4, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'matriz_riscos',          dimension_key:'governanca', subdimension_key:'gestao_riscos', priority_category:'operacional',             impact_weight:4, legal_risk_weight:3, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'seguros_cobertura',      dimension_key:'governanca', subdimension_key:'gestao_riscos', priority_category:'juridico',               impact_weight:4, legal_risk_weight:4, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'plano_contingencia',     dimension_key:'governanca', subdimension_key:'gestao_riscos', priority_category:'operacional',             impact_weight:5, legal_risk_weight:3, operational_risk_weight:5, financial_impact_weight:4, implementation_effort_weight:3 },

  // === JURÍDICO ===
  { cluster_key:'holding_operacional',    dimension_key:'juridico', subdimension_key:'estrutura_societaria', priority_category:'juridico',           impact_weight:5, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:5, implementation_effort_weight:5 },
  { cluster_key:'capital_social',         dimension_key:'juridico', subdimension_key:'estrutura_societaria', priority_category:'juridico',           impact_weight:4, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'participacoes',          dimension_key:'juridico', subdimension_key:'estrutura_societaria', priority_category:'juridico',           impact_weight:4, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'arrendamento',           dimension_key:'juridico', subdimension_key:'contratos_rurais',     priority_category:'juridico',           impact_weight:4, legal_risk_weight:5, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'parceria_agricola',      dimension_key:'juridico', subdimension_key:'contratos_rurais',     priority_category:'juridico',           impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'barter_cpp',             dimension_key:'juridico', subdimension_key:'contratos_rurais',     priority_category:'juridico',           impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'contratos_fornecedores', dimension_key:'juridico', subdimension_key:'contratos_comerciais', priority_category:'juridico',          impact_weight:3, legal_risk_weight:4, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'contratos_clientes',     dimension_key:'juridico', subdimension_key:'contratos_comerciais', priority_category:'juridico',          impact_weight:4, legal_risk_weight:4, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'contratos_servicos',     dimension_key:'juridico', subdimension_key:'contratos_comerciais', priority_category:'juridico',          impact_weight:3, legal_risk_weight:3, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'garantias_reais',        dimension_key:'juridico', subdimension_key:'garantias_instrumentos', priority_category:'juridico',        impact_weight:5, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'cedula_rural',           dimension_key:'juridico', subdimension_key:'garantias_instrumentos', priority_category:'juridico',        impact_weight:5, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'alienacao_fiduciaria',   dimension_key:'juridico', subdimension_key:'garantias_instrumentos', priority_category:'juridico',        impact_weight:5, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'clt_registro',           dimension_key:'juridico', subdimension_key:'compliance_trabalhista', priority_category:'juridico',        impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'esocial',                dimension_key:'juridico', subdimension_key:'compliance_trabalhista', priority_category:'juridico',        impact_weight:3, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'saude_seguranca',        dimension_key:'juridico', subdimension_key:'compliance_trabalhista', priority_category:'juridico',        impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'car_itr',                dimension_key:'juridico', subdimension_key:'regularidade_fundiaria', priority_category:'juridico',        impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'matricula_imovel',       dimension_key:'juridico', subdimension_key:'regularidade_fundiaria', priority_category:'juridico',        impact_weight:5, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'geo_rural',              dimension_key:'juridico', subdimension_key:'regularidade_fundiaria', priority_category:'juridico',        impact_weight:3, legal_risk_weight:4, operational_risk_weight:2, financial_impact_weight:3, implementation_effort_weight:3 },
  { cluster_key:'licencas_ambientais',    dimension_key:'juridico', subdimension_key:'regularidade_ambiental', priority_category:'juridico',       impact_weight:4, legal_risk_weight:5, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'reserva_legal',          dimension_key:'juridico', subdimension_key:'regularidade_ambiental', priority_category:'juridico',       impact_weight:4, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:3, implementation_effort_weight:3 },
  { cluster_key:'conformidade_ambiental', dimension_key:'juridico', subdimension_key:'regularidade_ambiental', priority_category:'juridico',       impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'passivo_trabalhista',    dimension_key:'juridico', subdimension_key:'litigios_contingencias', priority_category:'juridico',        impact_weight:4, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'passivo_fiscal',         dimension_key:'juridico', subdimension_key:'litigios_contingencias', priority_category:'juridico',        impact_weight:4, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'passivo_ambiental',      dimension_key:'juridico', subdimension_key:'litigios_contingencias', priority_category:'juridico',        impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:4 },

  // === CONTROLES INTERNOS ===
  { cluster_key:'matriz_alcadas',         dimension_key:'controles_internos', subdimension_key:'segregacao_funcoes', priority_category:'operacional', impact_weight:4, legal_risk_weight:3, operational_risk_weight:5, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'segregacao_funcoes',     dimension_key:'controles_internos', subdimension_key:'segregacao_funcoes', priority_category:'operacional', impact_weight:5, legal_risk_weight:4, operational_risk_weight:5, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'controle_acessos',       dimension_key:'controles_internos', subdimension_key:'segregacao_funcoes', priority_category:'tecnologia',  impact_weight:4, legal_risk_weight:4, operational_risk_weight:5, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'trilha_auditoria',       dimension_key:'controles_internos', subdimension_key:'segregacao_funcoes', priority_category:'operacional', impact_weight:4, legal_risk_weight:4, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'procedimentos_operacionais',dimension_key:'controles_internos',subdimension_key:'segregacao_funcoes',priority_category:'operacional',impact_weight:3, legal_risk_weight:2, operational_risk_weight:4, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'manual_politicas',       dimension_key:'controles_internos', subdimension_key:'procedimentos_politicas', priority_category:'operacional', impact_weight:3, legal_risk_weight:3, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'politica_caixa',         dimension_key:'controles_internos', subdimension_key:'procedimentos_politicas', priority_category:'financeiro', impact_weight:4, legal_risk_weight:3, operational_risk_weight:4, financial_impact_weight:5, implementation_effort_weight:1 },
  { cluster_key:'politica_despesas',      dimension_key:'controles_internos', subdimension_key:'procedimentos_politicas', priority_category:'financeiro', impact_weight:4, legal_risk_weight:2, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'conciliacao_bancaria',   dimension_key:'controles_internos', subdimension_key:'controles_financeiros', priority_category:'financeiro', impact_weight:5, legal_risk_weight:3, operational_risk_weight:4, financial_impact_weight:5, implementation_effort_weight:1 },
  { cluster_key:'aprovacao_pagamento',    dimension_key:'controles_internos', subdimension_key:'controles_financeiros', priority_category:'financeiro', impact_weight:5, legal_risk_weight:4, operational_risk_weight:5, financial_impact_weight:5, implementation_effort_weight:1 },
  { cluster_key:'controle_caixa',         dimension_key:'controles_internos', subdimension_key:'controles_financeiros', priority_category:'financeiro', impact_weight:4, legal_risk_weight:3, operational_risk_weight:4, financial_impact_weight:5, implementation_effort_weight:1 },
  { cluster_key:'requisicao_compras',     dimension_key:'controles_internos', subdimension_key:'controles_compras', priority_category:'operacional',   impact_weight:4, legal_risk_weight:2, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'cotacao_fornecedores',   dimension_key:'controles_internos', subdimension_key:'controles_compras', priority_category:'financeiro',    impact_weight:4, legal_risk_weight:2, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'aprovacao_compras',      dimension_key:'controles_internos', subdimension_key:'controles_compras', priority_category:'operacional',   impact_weight:4, legal_risk_weight:3, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:1 },
  { cluster_key:'recebimento_materiais',  dimension_key:'controles_internos', subdimension_key:'controles_compras', priority_category:'operacional',   impact_weight:4, legal_risk_weight:2, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'inventario_fisico',      dimension_key:'controles_internos', subdimension_key:'controles_estoque', priority_category:'financeiro',    impact_weight:4, legal_risk_weight:2, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'controle_entradas',      dimension_key:'controles_internos', subdimension_key:'controles_estoque', priority_category:'operacional',   impact_weight:4, legal_risk_weight:2, operational_risk_weight:5, financial_impact_weight:4, implementation_effort_weight:1 },
  { cluster_key:'controle_saidas',        dimension_key:'controles_internos', subdimension_key:'controles_estoque', priority_category:'operacional',   impact_weight:4, legal_risk_weight:2, operational_risk_weight:5, financial_impact_weight:4, implementation_effort_weight:1 },
  { cluster_key:'perdas_quebras',         dimension_key:'controles_internos', subdimension_key:'controles_estoque', priority_category:'financeiro',    impact_weight:3, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'conciliacao_mensal',     dimension_key:'controles_internos', subdimension_key:'conciliacoes_auditoria', priority_category:'financeiro',impact_weight:4, legal_risk_weight:3, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:1 },
  { cluster_key:'auditoria_interna',      dimension_key:'controles_internos', subdimension_key:'conciliacoes_auditoria', priority_category:'operacional',impact_weight:4, legal_risk_weight:4, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'divergencias',           dimension_key:'controles_internos', subdimension_key:'conciliacoes_auditoria', priority_category:'financeiro',impact_weight:4, legal_risk_weight:3, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:1 },
  { cluster_key:'folha_pagamento',        dimension_key:'controles_internos', subdimension_key:'gestao_folha', priority_category:'juridico',           impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'beneficios',             dimension_key:'controles_internos', subdimension_key:'gestao_folha', priority_category:'juridico',           impact_weight:3, legal_risk_weight:4, operational_risk_weight:2, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'ponto_jornada',          dimension_key:'controles_internos', subdimension_key:'gestao_folha', priority_category:'juridico',           impact_weight:3, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'patrimonio_bens',        dimension_key:'controles_internos', subdimension_key:'controle_imobilizado', priority_category:'financeiro', impact_weight:4, legal_risk_weight:2, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'depreciacao',            dimension_key:'controles_internos', subdimension_key:'controle_imobilizado', priority_category:'contabil',   impact_weight:3, legal_risk_weight:2, operational_risk_weight:2, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'manutencao_ativo',       dimension_key:'controles_internos', subdimension_key:'controle_imobilizado', priority_category:'operacional', impact_weight:3, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'faturamento_nota',       dimension_key:'controles_internos', subdimension_key:'controles_receita', priority_category:'tributario',    impact_weight:5, legal_risk_weight:5, operational_risk_weight:4, financial_impact_weight:5, implementation_effort_weight:1 },
  { cluster_key:'cobranca_recebimento',   dimension_key:'controles_internos', subdimension_key:'controles_receita', priority_category:'financeiro',    impact_weight:5, legal_risk_weight:2, operational_risk_weight:4, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'inadimplencia',          dimension_key:'controles_internos', subdimension_key:'controles_receita', priority_category:'financeiro',    impact_weight:4, legal_risk_weight:2, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },

  // === FINANCEIRO ===
  { cluster_key:'previsibilidade_caixa',  dimension_key:'financeiro', subdimension_key:'fluxo_caixa', priority_category:'financeiro',                impact_weight:5, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'gestao_caixa_diario',    dimension_key:'financeiro', subdimension_key:'fluxo_caixa', priority_category:'financeiro',                impact_weight:5, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:5, implementation_effort_weight:1 },
  { cluster_key:'capital_giro',           dimension_key:'financeiro', subdimension_key:'fluxo_caixa', priority_category:'financeiro',                impact_weight:5, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'estrutura_divida',       dimension_key:'financeiro', subdimension_key:'endividamento_credito', priority_category:'financeiro',       impact_weight:5, legal_risk_weight:3, operational_risk_weight:4, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'politica_credito',       dimension_key:'financeiro', subdimension_key:'endividamento_credito', priority_category:'financeiro',       impact_weight:4, legal_risk_weight:2, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'relacionamento_banco',   dimension_key:'financeiro', subdimension_key:'endividamento_credito', priority_category:'financeiro',       impact_weight:4, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'garantias_operacoes',    dimension_key:'financeiro', subdimension_key:'endividamento_credito', priority_category:'financeiro',       impact_weight:5, legal_risk_weight:4, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'custo_producao',         dimension_key:'financeiro', subdimension_key:'rentabilidade_custos', priority_category:'financeiro',        impact_weight:5, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'margem_resultado',       dimension_key:'financeiro', subdimension_key:'rentabilidade_custos', priority_category:'financeiro',        impact_weight:5, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'break_even',             dimension_key:'financeiro', subdimension_key:'rentabilidade_custos', priority_category:'financeiro',        impact_weight:5, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'projecao_dre',           dimension_key:'financeiro', subdimension_key:'planejamento_financeiro', priority_category:'financeiro',     impact_weight:5, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'cenarios_financeiros',   dimension_key:'financeiro', subdimension_key:'planejamento_financeiro', priority_category:'financeiro',     impact_weight:4, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'investimento_retorno',   dimension_key:'financeiro', subdimension_key:'planejamento_financeiro', priority_category:'financeiro',     impact_weight:4, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:3 },

  // === CONTÁBIL ===
  { cluster_key:'balanco_mensal',         dimension_key:'contabil', subdimension_key:'fechamento_contabil', priority_category:'contabil',             impact_weight:4, legal_risk_weight:3, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'dre_mensal',             dimension_key:'contabil', subdimension_key:'fechamento_contabil', priority_category:'contabil',             impact_weight:5, legal_risk_weight:3, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'prazo_fechamento',       dimension_key:'contabil', subdimension_key:'fechamento_contabil', priority_category:'contabil',             impact_weight:3, legal_risk_weight:2, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'acuracia_lancamentos',   dimension_key:'contabil', subdimension_key:'qualidade_informacao', priority_category:'contabil',            impact_weight:4, legal_risk_weight:4, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'plano_contas',           dimension_key:'contabil', subdimension_key:'qualidade_informacao', priority_category:'contabil',            impact_weight:3, legal_risk_weight:3, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:3 },
  { cluster_key:'parametros_contabeis',   dimension_key:'contabil', subdimension_key:'qualidade_informacao', priority_category:'contabil',            impact_weight:3, legal_risk_weight:4, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:3 },
  { cluster_key:'centro_custo',           dimension_key:'contabil', subdimension_key:'contabilidade_gerencial', priority_category:'contabil',         impact_weight:4, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'relatorios_gerenciais',  dimension_key:'contabil', subdimension_key:'contabilidade_gerencial', priority_category:'contabil',         impact_weight:4, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'contabilidade_custos',   dimension_key:'contabil', subdimension_key:'contabilidade_gerencial', priority_category:'contabil',         impact_weight:4, legal_risk_weight:2, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'provisao_ferias',        dimension_key:'contabil', subdimension_key:'provisoes', priority_category:'juridico',                       impact_weight:3, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:4, implementation_effort_weight:1 },
  { cluster_key:'provisao_contingencias', dimension_key:'contabil', subdimension_key:'provisoes', priority_category:'juridico',                       impact_weight:4, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'provisao_tributos',      dimension_key:'contabil', subdimension_key:'provisoes', priority_category:'tributario',                     impact_weight:4, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:5, implementation_effort_weight:2 },

  // === TRIBUTÁRIO ===
  { cluster_key:'apuracao_impostos',      dimension_key:'tributario', subdimension_key:'rotinas_fiscais', priority_category:'tributario',             impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'regime_tributario',      dimension_key:'tributario', subdimension_key:'rotinas_fiscais', priority_category:'tributario',             impact_weight:5, legal_risk_weight:4, operational_risk_weight:2, financial_impact_weight:5, implementation_effort_weight:4 },
  { cluster_key:'icms_ipi',               dimension_key:'tributario', subdimension_key:'rotinas_fiscais', priority_category:'tributario',             impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'pis_cofins',             dimension_key:'tributario', subdimension_key:'rotinas_fiscais', priority_category:'tributario',             impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'creditos_icms',          dimension_key:'tributario', subdimension_key:'gestao_creditos', priority_category:'tributario',             impact_weight:4, legal_risk_weight:3, operational_risk_weight:2, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'creditos_pis_cofins',    dimension_key:'tributario', subdimension_key:'gestao_creditos', priority_category:'tributario',             impact_weight:4, legal_risk_weight:3, operational_risk_weight:2, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'aproveitamento_creditos',dimension_key:'tributario', subdimension_key:'gestao_creditos', priority_category:'tributario',             impact_weight:4, legal_risk_weight:4, operational_risk_weight:2, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'passivo_fiscal_est',     dimension_key:'tributario', subdimension_key:'riscos_fiscais', priority_category:'tributario',              impact_weight:5, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:5, implementation_effort_weight:4 },
  { cluster_key:'autuacoes_fiscais',      dimension_key:'tributario', subdimension_key:'riscos_fiscais', priority_category:'tributario',              impact_weight:4, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'planejamento_trib',      dimension_key:'tributario', subdimension_key:'riscos_fiscais', priority_category:'tributario',              impact_weight:5, legal_risk_weight:4, operational_risk_weight:2, financial_impact_weight:5, implementation_effort_weight:4 },
  { cluster_key:'sped_fiscal',            dimension_key:'tributario', subdimension_key:'obrigacoes_acessorias', priority_category:'tributario',        impact_weight:3, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'ecf_ecd',                dimension_key:'tributario', subdimension_key:'obrigacoes_acessorias', priority_category:'tributario',        impact_weight:3, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'declaracoes',            dimension_key:'tributario', subdimension_key:'obrigacoes_acessorias', priority_category:'tributario',        impact_weight:3, legal_risk_weight:5, operational_risk_weight:2, financial_impact_weight:3, implementation_effort_weight:1 },

  // === OPERACIONAL ===
  { cluster_key:'calendario_operacional', dimension_key:'operacional', subdimension_key:'planejamento_safra', priority_category:'operacional',        impact_weight:5, legal_risk_weight:1, operational_risk_weight:5, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'mapa_plantio',           dimension_key:'operacional', subdimension_key:'planejamento_safra', priority_category:'operacional',        impact_weight:4, legal_risk_weight:1, operational_risk_weight:5, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'gestao_talhao',          dimension_key:'operacional', subdimension_key:'planejamento_safra', priority_category:'operacional',        impact_weight:4, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'estoque_insumos',        dimension_key:'operacional', subdimension_key:'gestao_insumos', priority_category:'operacional',            impact_weight:4, legal_risk_weight:2, operational_risk_weight:5, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'abastecimento_combustivel',dimension_key:'operacional',subdimension_key:'gestao_insumos', priority_category:'operacional',           impact_weight:3, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:1 },
  { cluster_key:'controle_defensivos',    dimension_key:'operacional', subdimension_key:'gestao_insumos', priority_category:'juridico',               impact_weight:4, legal_risk_weight:5, operational_risk_weight:4, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'receita_agronomica',     dimension_key:'operacional', subdimension_key:'gestao_insumos', priority_category:'juridico',               impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:1 },
  { cluster_key:'plano_manutencao',       dimension_key:'operacional', subdimension_key:'manutencao_maquinas', priority_category:'operacional',       impact_weight:4, legal_risk_weight:1, operational_risk_weight:5, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'historico_maquinas',     dimension_key:'operacional', subdimension_key:'manutencao_maquinas', priority_category:'operacional',       impact_weight:3, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'custo_maquina_hora',     dimension_key:'operacional', subdimension_key:'manutencao_maquinas', priority_category:'financeiro',        impact_weight:4, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'producao_colheita',      dimension_key:'operacional', subdimension_key:'produtividade_perdas', priority_category:'operacional',      impact_weight:5, legal_risk_weight:1, operational_risk_weight:5, financial_impact_weight:5, implementation_effort_weight:3 },
  { cluster_key:'perdas_processo',        dimension_key:'operacional', subdimension_key:'produtividade_perdas', priority_category:'operacional',      impact_weight:5, legal_risk_weight:1, operational_risk_weight:5, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'linha_producao',         dimension_key:'operacional', subdimension_key:'produtividade_perdas', priority_category:'operacional',      impact_weight:4, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'venda_contrato',         dimension_key:'operacional', subdimension_key:'processos_comerciais', priority_category:'juridico',         impact_weight:4, legal_risk_weight:4, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'politica_preco',         dimension_key:'operacional', subdimension_key:'processos_comerciais', priority_category:'financeiro',       impact_weight:5, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'funil_clientes',         dimension_key:'operacional', subdimension_key:'processos_comerciais', priority_category:'financeiro',       impact_weight:4, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:5, implementation_effort_weight:2 },
  { cluster_key:'armazenagem',            dimension_key:'operacional', subdimension_key:'logistica_estoque', priority_category:'operacional',         impact_weight:4, legal_risk_weight:2, operational_risk_weight:5, financial_impact_weight:4, implementation_effort_weight:4 },
  { cluster_key:'transporte_frete',       dimension_key:'operacional', subdimension_key:'logistica_estoque', priority_category:'operacional',         impact_weight:4, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'gestao_estoque_pd',      dimension_key:'operacional', subdimension_key:'logistica_estoque', priority_category:'operacional',         impact_weight:4, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:2 },

  // === SISTEMAS ===
  { cluster_key:'configuracao_erp',       dimension_key:'sistemas', subdimension_key:'erp_integracoes', priority_category:'tecnologia',              impact_weight:4, legal_risk_weight:3, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:4 },
  { cluster_key:'integracao_modulos',     dimension_key:'sistemas', subdimension_key:'erp_integracoes', priority_category:'tecnologia',              impact_weight:4, legal_risk_weight:3, operational_risk_weight:4, financial_impact_weight:3, implementation_effort_weight:4 },
  { cluster_key:'adocao_usuarios',        dimension_key:'sistemas', subdimension_key:'erp_integracoes', priority_category:'tecnologia',              impact_weight:3, legal_risk_weight:1, operational_risk_weight:4, financial_impact_weight:3, implementation_effort_weight:3 },
  { cluster_key:'cadastro_maestro',       dimension_key:'sistemas', subdimension_key:'qualidade_dados', priority_category:'tecnologia',              impact_weight:4, legal_risk_weight:2, operational_risk_weight:4, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'duplicatas_gaps',        dimension_key:'sistemas', subdimension_key:'qualidade_dados', priority_category:'tecnologia',              impact_weight:3, legal_risk_weight:2, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:2 },
  { cluster_key:'padronizacao_dados',     dimension_key:'sistemas', subdimension_key:'qualidade_dados', priority_category:'tecnologia',              impact_weight:3, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:3 },
  { cluster_key:'workflow_aprovacao',     dimension_key:'sistemas', subdimension_key:'automacao_controles', priority_category:'tecnologia',           impact_weight:4, legal_risk_weight:3, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:3 },
  { cluster_key:'automatizacao_relat',    dimension_key:'sistemas', subdimension_key:'automacao_controles', priority_category:'tecnologia',           impact_weight:4, legal_risk_weight:1, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:3 },
  { cluster_key:'backup_dados',           dimension_key:'sistemas', subdimension_key:'automacao_controles', priority_category:'tecnologia',           impact_weight:4, legal_risk_weight:3, operational_risk_weight:5, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'politica_acesso',        dimension_key:'sistemas', subdimension_key:'seguranca_informacao', priority_category:'tecnologia',          impact_weight:4, legal_risk_weight:4, operational_risk_weight:4, financial_impact_weight:4, implementation_effort_weight:2 },
  { cluster_key:'protecao_dados',         dimension_key:'sistemas', subdimension_key:'seguranca_informacao', priority_category:'juridico',            impact_weight:4, legal_risk_weight:5, operational_risk_weight:3, financial_impact_weight:3, implementation_effort_weight:3 },
  { cluster_key:'monitoramento_logs',     dimension_key:'sistemas', subdimension_key:'seguranca_informacao', priority_category:'tecnologia',          impact_weight:3, legal_risk_weight:4, operational_risk_weight:4, financial_impact_weight:3, implementation_effort_weight:3 },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: hq_admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { tenant_id, dry_run = false } = body;

    if (dry_run) {
      return Response.json({ dry_run: true, total_clusters: CLUSTER_META.length });
    }

    const existing = await base44.asServiceRole.entities.FalClusterMeta.list();
    const existingByKey = {};
    for (const e of existing) {
      existingByKey[e.cluster_key] = e;
    }

    let created = 0, updated = 0;
    for (const meta of CLUSTER_META) {
      const payload = { ...meta, tenant_id: tenant_id || user.tenant_id || 'default' };
      if (existingByKey[meta.cluster_key]) {
        await base44.asServiceRole.entities.FalClusterMeta.update(existingByKey[meta.cluster_key].id, payload);
        updated++;
      } else {
        await base44.asServiceRole.entities.FalClusterMeta.create(payload);
        created++;
      }
    }

    return Response.json({ ok: true, created, updated, total: CLUSTER_META.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});