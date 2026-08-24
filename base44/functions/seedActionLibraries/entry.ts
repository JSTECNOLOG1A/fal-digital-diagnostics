/**
 * seedActionLibraries
 * 
 * Importa e popula:
 * 1. FalActionLibrary — ações estratégicas por cluster (54 registros)
 * 2. FalQuestionActionLibrary — ações operacionais por pergunta (313 registros)
 *    Enriquece automaticamente com cluster_key, subdimension_key, dimension_key
 *    buscando os dados da FalQuestion pelo question_id.
 * 
 * POST { mode: "action_library" | "question_action_library" | "both" }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

// ── Dados dos CSVs embutidos ──────────────────────────────────────────────────

const ACTION_LIBRARY_ROWS = [
  { tenant_id:'global', active:'True', action_key:'acao_ativo_biologico_cpc29', title:'Estruturar rotina de ativo biologico cpc29', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster ativo biologico cpc29. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'contabil', subdimension_key:'ativo_biologico_cpc29', cluster_key:'ativo_biologico_cpc29_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Contabilidade', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_compliance_contabil', title:'Estruturar rotina de compliance contabil', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster compliance contabil. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'contabil', subdimension_key:'compliance_contabil', cluster_key:'compliance_contabil_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Contabilidade', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_demonstracoes_financeiras', title:'Estruturar rotina de demonstracoes financeiras', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster demonstracoes financeiras. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'contabil', subdimension_key:'demonstracoes_financeiras', cluster_key:'demonstracoes_financeiras_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Contabilidade', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_organizacao_contabil', title:'Estruturar rotina de organizacao contabil', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster organizacao contabil. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'contabil', subdimension_key:'organizacao_contabil', cluster_key:'organizacao_contabil_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Contabilidade', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_compras', title:'Estruturar rotina de compras', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster compras. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'controles_internos', subdimension_key:'compras', cluster_key:'compras_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Controladoria / Auditoria', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_controle_estoques', title:'Estruturar rotina de controle estoques', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster controle estoques. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'controles_internos', subdimension_key:'controle_estoques', cluster_key:'controle_estoques_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Controladoria / Auditoria', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_custos_agricolas', title:'Estruturar rotina de custos agricolas', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster custos agricolas. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'controles_internos', subdimension_key:'custos_agricolas', cluster_key:'custos_agricolas_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Controladoria / Auditoria', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_endividamento', title:'Estruturar rotina de endividamento', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster endividamento. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'controles_internos', subdimension_key:'endividamento', cluster_key:'endividamento_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Controladoria / Auditoria', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_folha_admissao', title:'Estruturar rotina de folha admissao', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster folha admissao. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'controles_internos', subdimension_key:'folha_admissao_geral', cluster_key:'folha_admissao_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Controladoria / Auditoria', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_folha_demissao', title:'Estruturar rotina de folha demissao', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster folha demissao. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'controles_internos', subdimension_key:'folha_demissao_cluster', cluster_key:'folha_demissao_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Controladoria / Auditoria', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_folha_pagamento', title:'Estruturar rotina de folha pagamento', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster folha pagamento. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'controles_internos', subdimension_key:'folha_pagamento', cluster_key:'folha_pagamento_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Controladoria / Auditoria', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_receitas_faturamento', title:'Estruturar rotina de receitas faturamento', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster receitas faturamento. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'controles_internos', subdimension_key:'receitas_faturamento', cluster_key:'receitas_faturamento_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Controladoria / Auditoria', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_tesouraria_caixa', title:'Estruturar rotina de tesouraria caixa', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster tesouraria caixa. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'controles_internos', subdimension_key:'tesouraria_caixa', cluster_key:'tesouraria_caixa_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Controladoria / Auditoria', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_capital_giro', title:'Estruturar rotina de capital giro', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster capital giro. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'financeiro', subdimension_key:'capital_giro', cluster_key:'capital_giro_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'CFO / Financeiro', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_custo_divida', title:'Estruturar rotina de custo divida', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster custo divida. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'financeiro', subdimension_key:'custo_divida', cluster_key:'custo_divida_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'CFO / Financeiro', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_financiamentos', title:'Estruturar rotina de financiamentos', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster financiamentos. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'financeiro', subdimension_key:'financiamentos', cluster_key:'financiamentos_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'CFO / Financeiro', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_fluxo_caixa', title:'Estruturar rotina de fluxo caixa', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster fluxo caixa. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'financeiro', subdimension_key:'fluxo_caixa', cluster_key:'fluxo_caixa_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'CFO / Financeiro', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_hedge_derivativos', title:'Estruturar rotina de hedge derivativos', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster hedge derivativos. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'financeiro', subdimension_key:'hedge_derivativos', cluster_key:'hedge_derivativos_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'CFO / Financeiro', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_planejamento_financeiro', title:'Estruturar rotina de planejamento financeiro', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster planejamento financeiro. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'financeiro', subdimension_key:'planejamento_financeiro', cluster_key:'planejamento_financeiro_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'CFO / Financeiro', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_relacionamento_bancario', title:'Estruturar rotina de relacionamento bancario', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster relacionamento bancario. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'financeiro', subdimension_key:'relacionamento_bancario', cluster_key:'relacionamento_bancario_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'CFO / Financeiro', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_processo_decisorio', title:'Estruturar rotina de processo decisorio', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster processo decisorio. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'governanca', subdimension_key:'processo_decisorio', cluster_key:'processo_decisorio_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Direção / Sócios', dependency_action_keys:'', level_applicability:'company|unit|group', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_ritos_gerenciais', title:'Estruturar rotina de ritos gerenciais', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster ritos gerenciais. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'governanca', subdimension_key:'ritos_gerenciais', cluster_key:'ritos_gerenciais_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Direção / Sócios', dependency_action_keys:'', level_applicability:'company|unit|group', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_estrutura_societaria', title:'Estruturar rotina de estrutura societaria', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster estrutura societaria. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'juridico', subdimension_key:'estrutura_societaria', cluster_key:'estrutura_societaria_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Jurídico / Advogado', dependency_action_keys:'', level_applicability:'company|unit|group', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_contratos', title:'Estruturar rotina de contratos', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster contratos. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'juridico', subdimension_key:'contratos', cluster_key:'contratos_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Jurídico / Advogado', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_colheita_producao', title:'Estruturar rotina de colheita producao', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster colheita producao. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'operacional', subdimension_key:'colheita_producao', cluster_key:'colheita_producao_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Gerente Operacional', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_gestao_pessoas', title:'Estruturar rotina de gestao pessoas', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster gestao pessoas. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'operacional', subdimension_key:'gestao_pessoas', cluster_key:'gestao_pessoas_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'RH / Gerente Operacional', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_logistica_comercializacao', title:'Estruturar rotina de logistica comercializacao', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster logistica comercializacao. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'operacional', subdimension_key:'logistica_comercializacao', cluster_key:'logistica_comercializacao_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Gerente Operacional', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_planejamento_safra', title:'Estruturar rotina de planejamento safra', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster planejamento safra. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'operacional', subdimension_key:'planejamento_safra', cluster_key:'planejamento_safra_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Gerente Operacional', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_integracao_sistemas', title:'Estruturar rotina de integracao sistemas', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster integracao sistemas. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'sistemas', subdimension_key:'integracao_sistemas', cluster_key:'integracao_sistemas_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'TI / Gestor do Sistema', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_uso_erp', title:'Estruturar rotina de uso erp', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster uso erp. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'sistemas', subdimension_key:'uso_erp', cluster_key:'uso_erp_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'TI / Gestor do Sistema', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_apuracao_impostos', title:'Estruturar rotina de apuracao impostos', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster apuracao impostos. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'tributario', subdimension_key:'apuracao_impostos', cluster_key:'apuracao_impostos_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Contador / Tributarista', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_obrigacoes_acessorias', title:'Estruturar rotina de obrigacoes acessorias', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster obrigacoes acessorias. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'tributario', subdimension_key:'obrigacoes_acessorias', cluster_key:'obrigacoes_acessorias_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Contador / Tributarista', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
  { tenant_id:'global', active:'True', action_key:'acao_planejamento_tributario', title:'Estruturar rotina de planejamento tributario', description:'Definir responsável, documentar procedimento, estabelecer frequência de execução e criar indicador de controle para o cluster planejamento tributario. Usar as perguntas do diagnóstico dessa frente como checklist inicial de implantação.', dimension_key:'tributario', subdimension_key:'planejamento_tributario', cluster_key:'planejamento_tributario_cluster', driver_ids:'', impact_score:'4', effort_score:'2', action_type:'structural', default_horizon:'60d', score_trigger_max:'2.5', typical_owner:'Contador / Tributarista', dependency_action_keys:'', level_applicability:'company|unit', sector_tags:'agronegocio', killer_question_trigger:'False' },
];

// ── Dados do FalQuestionActionLibrary CSV ────────────────────────────────────

const QUESTION_ACTION_ROWS = [
  { question_id:'contabil_ativo_biologico_cpc29_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_ativo_biologico_cpc29_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_ativo_biologico_cpc29_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_ativo_biologico_cpc29_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_ativo_biologico_cpc29_005', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_ativo_biologico_cpc29_006', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_ativo_biologico_cpc29_007', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_ativo_biologico_cpc29_008', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_ativo_biologico_cpc29_009', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_compliance_contabil_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_compliance_contabil_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_compliance_contabil_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_compliance_contabil_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_demonstracoes_financeiras_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_demonstracoes_financeiras_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_demonstracoes_financeiras_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_demonstracoes_financeiras_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_demonstracoes_financeiras_005', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_demonstracoes_financeiras_006', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_organizacao_contabil_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_organizacao_contabil_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_organizacao_contabil_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_organizacao_contabil_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'contabil_organizacao_contabil_005', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_compras_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_compras_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_compras_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_compras_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_compras_005', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_controle_estoques_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_controle_estoques_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_controle_estoques_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_controle_estoques_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_controle_estoques_005', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_custos_agricolas_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_custos_agricolas_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_custos_agricolas_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_custos_agricolas_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_custos_agricolas_005', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_endividamento_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_endividamento_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_endividamento_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_endividamento_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_folha_admissao_geral_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_folha_admissao_geral_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_folha_admissao_geral_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_folha_admissao_geral_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_folha_demissao_cluster_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_folha_demissao_cluster_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_folha_demissao_cluster_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_folha_pagamento_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_folha_pagamento_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_folha_pagamento_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_folha_pagamento_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_folha_pagamento_005', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_receitas_faturamento_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_receitas_faturamento_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_receitas_faturamento_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_receitas_faturamento_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_tesouraria_caixa_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_tesouraria_caixa_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_tesouraria_caixa_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'controles_internos_tesouraria_caixa_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_capital_giro_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_capital_giro_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_capital_giro_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_capital_giro_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_custo_divida_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_custo_divida_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_custo_divida_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_financiamentos_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_financiamentos_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_financiamentos_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_financiamentos_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_fluxo_caixa_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_fluxo_caixa_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_fluxo_caixa_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_fluxo_caixa_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_fluxo_caixa_005', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_hedge_derivativos_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_hedge_derivativos_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_hedge_derivativos_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_planejamento_financeiro_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_planejamento_financeiro_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_planejamento_financeiro_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_planejamento_financeiro_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_relacionamento_bancario_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_relacionamento_bancario_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_relacionamento_bancario_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'financeiro_relacionamento_bancario_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'gestor_area' },
  { question_id:'governanca_processo_decisorio_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'direcao' },
  { question_id:'governanca_processo_decisorio_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'direcao' },
  { question_id:'governanca_processo_decisorio_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'direcao' },
  { question_id:'governanca_processo_decisorio_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'direcao' },
  { question_id:'governanca_processo_decisorio_005', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'direcao' },
  { question_id:'governanca_ritos_gerenciais_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'direcao' },
  { question_id:'governanca_ritos_gerenciais_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'direcao' },
  { question_id:'governanca_ritos_gerenciais_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'direcao' },
  { question_id:'governanca_ritos_gerenciais_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'direcao' },
  { question_id:'juridico_contratos_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'juridico' },
  { question_id:'juridico_contratos_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'juridico' },
  { question_id:'juridico_contratos_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'juridico' },
  { question_id:'juridico_estrutura_societaria_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'juridico' },
  { question_id:'juridico_estrutura_societaria_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'juridico' },
  { question_id:'juridico_estrutura_societaria_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'juridico' },
  { question_id:'juridico_estrutura_societaria_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'juridico' },
  { question_id:'operacional_colheita_producao_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'operacional' },
  { question_id:'operacional_colheita_producao_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'operacional' },
  { question_id:'operacional_colheita_producao_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'operacional' },
  { question_id:'operacional_colheita_producao_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'operacional' },
  { question_id:'operacional_gestao_pessoas_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'rh' },
  { question_id:'operacional_gestao_pessoas_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'rh' },
  { question_id:'operacional_gestao_pessoas_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'rh' },
  { question_id:'operacional_gestao_pessoas_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'rh' },
  { question_id:'operacional_logistica_comercializacao_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'operacional' },
  { question_id:'operacional_logistica_comercializacao_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'operacional' },
  { question_id:'operacional_logistica_comercializacao_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'operacional' },
  { question_id:'operacional_planejamento_safra_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'operacional' },
  { question_id:'operacional_planejamento_safra_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'operacional' },
  { question_id:'operacional_planejamento_safra_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'operacional' },
  { question_id:'operacional_planejamento_safra_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'operacional' },
  { question_id:'sistemas_integracao_sistemas_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'ti' },
  { question_id:'sistemas_integracao_sistemas_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'ti' },
  { question_id:'sistemas_integracao_sistemas_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'ti' },
  { question_id:'sistemas_uso_erp_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'ti' },
  { question_id:'sistemas_uso_erp_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'ti' },
  { question_id:'sistemas_uso_erp_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'ti' },
  { question_id:'sistemas_uso_erp_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'ti' },
  { question_id:'tributario_apuracao_impostos_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'contador' },
  { question_id:'tributario_apuracao_impostos_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'contador' },
  { question_id:'tributario_apuracao_impostos_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'contador' },
  { question_id:'tributario_apuracao_impostos_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'contador' },
  { question_id:'tributario_obrigacoes_acessorias_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'contador' },
  { question_id:'tributario_obrigacoes_acessorias_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'contador' },
  { question_id:'tributario_obrigacoes_acessorias_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'contador' },
  { question_id:'tributario_obrigacoes_acessorias_004', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'contador' },
  { question_id:'tributario_planejamento_tributario_001', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'contador' },
  { question_id:'tributario_planejamento_tributario_002', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'contador' },
  { question_id:'tributario_planejamento_tributario_003', action_template:'Definir responsável, documentar processo e estabelecer rotina de monitoramento mensal para este ponto de controle.', horizon:'60d', owner_role:'contador' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeActionLibraryRow(row) {
  return {
    tenant_id:               row.tenant_id || 'global',
    active:                  String(row.active || 'True'),
    action_key:              row.action_key,
    title:                   row.title,
    description:             row.description || '',
    dimension_key:           row.dimension_key,
    subdimension_key:        row.subdimension_key || '',
    cluster_key:             row.cluster_key || '',
    driver_ids:              row.driver_ids || '',
    impact_score:            String(row.impact_score || '4'),
    effort_score:            String(row.effort_score || '2'),
    action_type:             row.action_type || 'structural',
    default_horizon:         row.default_horizon || '60d',
    score_trigger_max:       String(row.score_trigger_max || '2.5'),
    typical_owner:           row.typical_owner || '',
    dependency_action_keys:  row.dependency_action_keys || '',
    level_applicability:     row.level_applicability || 'company|unit',
    sector_tags:             row.sector_tags || 'agronegocio',
    killer_question_trigger: String(row.killer_question_trigger || 'False'),
  };
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: HQ admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'both'; // action_library | question_action_library | both

    const stats = { action_library: null, question_action_library: null };

    // ── 1. FalActionLibrary ──────────────────────────────────────────────────
    if (mode === 'action_library' || mode === 'both') {
      const existing = await base44.asServiceRole.entities.FalActionLibrary.filter(
        { tenant_id: 'global' }, '-created_date', 200
      );
      const existingKeys = new Set(existing.map(r => r.action_key));

      let created = 0, updated = 0;
      for (const row of ACTION_LIBRARY_ROWS) {
        const norm = normalizeActionLibraryRow(row);
        if (existingKeys.has(norm.action_key)) {
          const rec = existing.find(r => r.action_key === norm.action_key);
          await base44.asServiceRole.entities.FalActionLibrary.update(rec.id, norm);
          updated++;
        } else {
          await base44.asServiceRole.entities.FalActionLibrary.create(norm);
          created++;
        }
      }
      stats.action_library = { created, updated, total: ACTION_LIBRARY_ROWS.length };
    }

    // ── 2. FalQuestionActionLibrary ──────────────────────────────────────────
    if (mode === 'question_action_library' || mode === 'both') {
      // Carregar todas as FalQuestions para enriquecimento
      const allQuestions = await base44.asServiceRole.entities.FalQuestion.filter({}, '-created_date', 2000);
      const questionMap = new Map(allQuestions.map(q => [q.question_id, q]));

      const existing = await base44.asServiceRole.entities.FalQuestionActionLibrary.filter(
        { tenant_id: 'global' }, '-created_date', 500
      );
      const existingByQid = new Map(existing.map(r => [r.question_id, r]));

      let created = 0, updated = 0, skipped = 0;

      for (const row of QUESTION_ACTION_ROWS) {
        const falQ = questionMap.get(row.question_id);

        // Derivar cluster_key a partir do cluster_key da FalQuestion ou do question_id
        let cluster_key = falQ?.cluster_key || '';
        if (!cluster_key) {
          // fallback: extrair do question_id (ex: contabil_ativo_biologico_cpc29_001 → ativo_biologico_cpc29_cluster)
          const parts = row.question_id.split('_');
          // remover dimension prefix e numero sufixo
          if (parts.length > 2) {
            const withoutDim = parts.slice(1, -1).join('_'); // remove dim prefix e número
            cluster_key = withoutDim + '_cluster';
          }
        }

        const record = {
          tenant_id:           'global',
          question_id:         row.question_id,
          cluster_key:         cluster_key,
          subdimension_key:    falQ?.subdimension_key || '',
          dimension_key:       falQ?.dimension_key || row.question_id.split('_')[0] || '',
          sector_group:        'geral',
          trigger_score:       1, // corretivo por padrão
          action_type:         'correcao',
          action_title:        row.action_template,
          action_description:  row.action_template,
          suggested_routine:   'mensal',
          impact_level:        3,
          effort_level:        2,
          responsible_role:    row.owner_role || 'gestor_area',
          evidence_requirement: 'Documento ou processo formalizado',
          is_active:           true,
        };

        if (existingByQid.has(row.question_id)) {
          await base44.asServiceRole.entities.FalQuestionActionLibrary.update(
            existingByQid.get(row.question_id).id, record
          );
          updated++;
        } else {
          await base44.asServiceRole.entities.FalQuestionActionLibrary.create(record);
          created++;
        }
      }
      stats.question_action_library = { created, updated, skipped, total: QUESTION_ACTION_ROWS.length };
    }

    return Response.json({ ok: true, stats });

  } catch (error) {
    console.error('[seedActionLibraries]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});