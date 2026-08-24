/**
 * seedFalIntelligence
 * Popula FalClusterCause, FalClusterRecommendation e FalBenchmark com dados iniciais.
 * Admin-only. Idempotente por chave.
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

// ─── CAUSAS PROVÁVEIS ──────────────────────────────────────────────────────────
const CAUSES = [
  // GOVERNANÇA
  { cluster_key:'acordo_socios',          dimension_key:'governanca', cause_key:'sem_acordo_formal',         cause_description:'Ausência de acordo de sócios formalizado entre os sócios', probability_weight:5 },
  { cluster_key:'acordo_socios',          dimension_key:'governanca', cause_key:'conflito_interesses',       cause_description:'Conflitos de interesse não resolvidos entre sócios', probability_weight:4 },
  { cluster_key:'acordo_socios',          dimension_key:'governanca', cause_key:'empresa_familiar_informal', cause_description:'Empresa familiar operando sem estrutura societária formal', probability_weight:4 },
  { cluster_key:'plano_sucessao',         dimension_key:'governanca', cause_key:'sem_planejamento_sucessao', cause_description:'Ausência de planejamento sucessório estruturado', probability_weight:5 },
  { cluster_key:'plano_sucessao',         dimension_key:'governanca', cause_key:'resistencia_fundador',      cause_description:'Resistência do fundador em delegar e planejar sucessão', probability_weight:4 },
  { cluster_key:'plano_sucessao',         dimension_key:'governanca', cause_key:'sem_identificacao_herdeiros',cause_description:'Herdeiros/sucessores não identificados ou preparados', probability_weight:4 },
  { cluster_key:'alcadas_aprovacao',      dimension_key:'governanca', cause_key:'sem_politica_alcadas',      cause_description:'Ausência de política formal de alçadas de aprovação', probability_weight:5 },
  { cluster_key:'alcadas_aprovacao',      dimension_key:'governanca', cause_key:'centralizacao_excessiva',   cause_description:'Decisões centralizadas no fundador sem delegação estruturada', probability_weight:4 },
  { cluster_key:'kpis_estrategicos',      dimension_key:'governanca', cause_key:'sem_kpis_definidos',        cause_description:'Empresa sem indicadores de desempenho formalmente definidos', probability_weight:5 },
  { cluster_key:'kpis_estrategicos',      dimension_key:'governanca', cause_key:'dados_nao_confiaveis',      cause_description:'Dados operacionais não confiáveis ou não estruturados', probability_weight:4 },
  { cluster_key:'orcamento_anual',        dimension_key:'governanca', cause_key:'sem_orcamento',             cause_description:'Empresa não realiza orçamento anual formal', probability_weight:5 },
  { cluster_key:'orcamento_anual',        dimension_key:'governanca', cause_key:'orcamento_nao_monitorado',  cause_description:'Orçamento elaborado mas não acompanhado ao longo do ano', probability_weight:4 },
  { cluster_key:'matriz_riscos',          dimension_key:'governanca', cause_key:'sem_gestao_riscos',         cause_description:'Ausência de cultura de gestão de riscos na empresa', probability_weight:5 },
  { cluster_key:'seguros_cobertura',      dimension_key:'governanca', cause_key:'seguros_desatualizados',    cause_description:'Apólices de seguro desatualizadas ou com coberturas inadequadas', probability_weight:4 },

  // JURÍDICO
  { cluster_key:'arrendamento',           dimension_key:'juridico', cause_key:'contratos_verbais',           cause_description:'Contratos de arrendamento realizados verbalmente ou sem registro', probability_weight:5 },
  { cluster_key:'arrendamento',           dimension_key:'juridico', cause_key:'clausulas_faltantes',         cause_description:'Contratos sem cláusulas essenciais de reajuste e rescisão', probability_weight:4 },
  { cluster_key:'clt_registro',           dimension_key:'juridico', cause_key:'trabalhadores_informais',     cause_description:'Colaboradores sem registro formal em carteira', probability_weight:5 },
  { cluster_key:'clt_registro',           dimension_key:'juridico', cause_key:'pj_simulando_vinculo',        cause_description:'PJ simulando vínculo empregatício sem reconhecimento', probability_weight:4 },
  { cluster_key:'licencas_ambientais',    dimension_key:'juridico', cause_key:'licencas_vencidas',           cause_description:'Licenças ambientais vencidas ou não renovadas', probability_weight:5 },
  { cluster_key:'licencas_ambientais',    dimension_key:'juridico', cause_key:'desconhecimento_legal',       cause_description:'Desconhecimento das obrigações legais ambientais aplicáveis', probability_weight:4 },
  { cluster_key:'car_itr',                dimension_key:'juridico', cause_key:'car_irregular',               cause_description:'CAR não inscrito ou com pendências de regularização', probability_weight:5 },
  { cluster_key:'passivo_trabalhista',    dimension_key:'juridico', cause_key:'processos_sem_controle',      cause_description:'Processos trabalhistas sem controle ou provisionamento adequado', probability_weight:5 },
  { cluster_key:'garantias_reais',        dimension_key:'juridico', cause_key:'garantias_sem_registro',      cause_description:'Garantias reais sem registro cartorial adequado', probability_weight:5 },

  // CONTROLES INTERNOS
  { cluster_key:'segregacao_funcoes',     dimension_key:'controles_internos', cause_key:'sem_estrutura_org',          cause_description:'Ausência de estrutura organizacional clara com funções definidas', probability_weight:5 },
  { cluster_key:'segregacao_funcoes',     dimension_key:'controles_internos', cause_key:'sem_politica_alcadas_ci',    cause_description:'Falta de política de alçadas formalmente documentada', probability_weight:5 },
  { cluster_key:'segregacao_funcoes',     dimension_key:'controles_internos', cause_key:'sistema_sem_permissoes',     cause_description:'Sistema sem controle de permissões por perfil de usuário', probability_weight:4 },
  { cluster_key:'segregacao_funcoes',     dimension_key:'controles_internos', cause_key:'empresa_centralizada',       cause_description:'Empresa excessivamente centralizada no proprietário', probability_weight:4 },
  { cluster_key:'conciliacao_bancaria',   dimension_key:'controles_internos', cause_key:'sem_rotina_conciliacao',     cause_description:'Ausência de rotina formal de conciliação bancária mensal', probability_weight:5 },
  { cluster_key:'conciliacao_bancaria',   dimension_key:'controles_internos', cause_key:'lancamentos_errados',        cause_description:'Lançamentos contábeis incorretos gerando diferenças recorrentes', probability_weight:4 },
  { cluster_key:'aprovacao_pagamento',    dimension_key:'controles_internos', cause_key:'pagamento_sem_aprovacao',    cause_description:'Pagamentos realizados sem processo formal de aprovação prévia', probability_weight:5 },
  { cluster_key:'aprovacao_pagamento',    dimension_key:'controles_internos', cause_key:'acesso_irrestrito_banco',    cause_description:'Acesso irrestrito ao internet banking sem segregação de funções', probability_weight:5 },
  { cluster_key:'inventario_fisico',      dimension_key:'controles_internos', cause_key:'sem_contagem_periodica',     cause_description:'Ausência de rotina de contagem física periódica de estoque', probability_weight:5 },
  { cluster_key:'requisicao_compras',     dimension_key:'controles_internos', cause_key:'compras_sem_processo',       cause_description:'Compras realizadas sem processo formal de requisição e aprovação', probability_weight:5 },
  { cluster_key:'cotacao_fornecedores',   dimension_key:'controles_internos', cause_key:'sem_cotacao_minima',         cause_description:'Compras sem exigência de cotação com múltiplos fornecedores', probability_weight:5 },
  { cluster_key:'faturamento_nota',       dimension_key:'controles_internos', cause_key:'venda_sem_nf',               cause_description:'Vendas realizadas sem emissão de nota fiscal eletrônica', probability_weight:5 },
  { cluster_key:'folha_pagamento',        dimension_key:'controles_internos', cause_key:'folha_sem_revisao',          cause_description:'Folha processada sem revisão independente antes do pagamento', probability_weight:4 },

  // FINANCEIRO
  { cluster_key:'previsibilidade_caixa',  dimension_key:'financeiro', cause_key:'sem_projecao_caixa',          cause_description:'Empresa não elabora projeção de fluxo de caixa', probability_weight:5 },
  { cluster_key:'previsibilidade_caixa',  dimension_key:'financeiro', cause_key:'sazonalidade_nao_prevista',   cause_description:'Sazonalidade do negócio não mapeada nas projeções de caixa', probability_weight:4 },
  { cluster_key:'gestao_caixa_diario',    dimension_key:'financeiro', cause_key:'sem_acompanhamento_diario',   cause_description:'Saldo de caixa não acompanhado diariamente pelo gestor', probability_weight:5 },
  { cluster_key:'capital_giro',           dimension_key:'financeiro', cause_key:'ncg_nao_calculada',           cause_description:'Necessidade de capital de giro não calculada ou monitorada', probability_weight:5 },
  { cluster_key:'estrutura_divida',       dimension_key:'financeiro', cause_key:'divida_sem_visibilidade',     cause_description:'Ausência de visão consolidada de todas as dívidas', probability_weight:5 },
  { cluster_key:'estrutura_divida',       dimension_key:'financeiro', cause_key:'custo_divida_alto',           cause_description:'Custo médio da dívida elevado sem análise de refinanciamento', probability_weight:4 },
  { cluster_key:'custo_producao',         dimension_key:'financeiro', cause_key:'custo_nao_apurado',           cause_description:'Custo de produção não calculado por atividade ou talhão', probability_weight:5 },
  { cluster_key:'custo_producao',         dimension_key:'financeiro', cause_key:'custos_indiretos_omitidos',   cause_description:'Custos indiretos e depreciação não incluídos no cálculo de custo', probability_weight:4 },
  { cluster_key:'margem_resultado',       dimension_key:'financeiro', cause_key:'sem_apuracao_margem',         cause_description:'Margem de contribuição por produto não apurada formalmente', probability_weight:5 },
  { cluster_key:'projecao_dre',           dimension_key:'financeiro', cause_key:'sem_orcamento_dre',           cause_description:'Empresa não elabora projeção de DRE anual', probability_weight:5 },

  // CONTÁBIL
  { cluster_key:'dre_mensal',             dimension_key:'contabil', cause_key:'fechamento_atrasado',            cause_description:'DRE mensal não disponível dentro do prazo necessário', probability_weight:5 },
  { cluster_key:'dre_mensal',             dimension_key:'contabil', cause_key:'contador_externo_lento',         cause_description:'Escritório contábil externo com entrega de informações defasada', probability_weight:4 },
  { cluster_key:'acuracia_lancamentos',   dimension_key:'contabil', cause_key:'lancamentos_genericos',          cause_description:'Uso excessivo de contas genéricas (diversas) nos lançamentos', probability_weight:5 },
  { cluster_key:'acuracia_lancamentos',   dimension_key:'contabil', cause_key:'sem_revisao_lancamentos',        cause_description:'Lançamentos contábeis não revisados antes do fechamento', probability_weight:4 },
  { cluster_key:'centro_custo',           dimension_key:'contabil', cause_key:'sem_centros_custo',              cause_description:'Empresa sem centros de custo configurados no sistema', probability_weight:5 },
  { cluster_key:'provisao_ferias',        dimension_key:'contabil', cause_key:'provisao_nao_constituida',       cause_description:'Provisão de férias e 13º não constituída mensalmente', probability_weight:5 },
  { cluster_key:'provisao_contingencias', dimension_key:'contabil', cause_key:'sem_analise_juridica_provisao',  cause_description:'Contingências sem análise jurídica para fins de provisionamento', probability_weight:4 },

  // TRIBUTÁRIO
  { cluster_key:'regime_tributario',      dimension_key:'tributario', cause_key:'regime_nao_revisado',          cause_description:'Regime tributário nunca revisado desde a constituição da empresa', probability_weight:5 },
  { cluster_key:'regime_tributario',      dimension_key:'tributario', cause_key:'sem_simulacao_alternativas',   cause_description:'Ausência de simulação de alternativas de regime fiscal', probability_weight:4 },
  { cluster_key:'creditos_icms',          dimension_key:'tributario', cause_key:'creditos_nao_aproveitados',    cause_description:'Créditos de ICMS não aproveitados por desconhecimento ou erro', probability_weight:5 },
  { cluster_key:'passivo_fiscal_est',     dimension_key:'tributario', cause_key:'risco_fiscal_nao_mapeado',     cause_description:'Riscos fiscais não mapeados nem classificados por probabilidade', probability_weight:5 },
  { cluster_key:'sped_fiscal',            dimension_key:'tributario', cause_key:'sped_com_erros',               cause_description:'Arquivo SPED com erros não detectados antes da transmissão', probability_weight:4 },
  { cluster_key:'apuracao_impostos',      dimension_key:'tributario', cause_key:'apuracao_manual_erros',        cause_description:'Apuração manual de tributos com alta probabilidade de erros', probability_weight:4 },

  // OPERACIONAL
  { cluster_key:'calendario_operacional', dimension_key:'operacional', cause_key:'sem_planejamento_safra',      cause_description:'Safra planejada informalmente sem calendário estruturado', probability_weight:5 },
  { cluster_key:'custo_maquina_hora',     dimension_key:'operacional', cause_key:'sem_calculo_hora_maquina',    cause_description:'Custo por hora de máquina não calculado', probability_weight:5 },
  { cluster_key:'producao_colheita',      dimension_key:'operacional', cause_key:'sem_registro_produtividade',  cause_description:'Produtividade por área/talhão não registrada sistematicamente', probability_weight:5 },
  { cluster_key:'perdas_processo',        dimension_key:'operacional', cause_key:'perdas_nao_medidas',          cause_description:'Perdas na colheita e armazenagem não medidas nem monitoradas', probability_weight:5 },
  { cluster_key:'venda_contrato',         dimension_key:'operacional', cause_key:'venda_sem_contrato',          cause_description:'Vendas realizadas sem contrato formal com o comprador', probability_weight:5 },
  { cluster_key:'estoque_insumos',        dimension_key:'operacional', cause_key:'estoque_sem_controle',        cause_description:'Estoque de insumos sem controle de entradas e saídas', probability_weight:5 },
  { cluster_key:'plano_manutencao',       dimension_key:'operacional', cause_key:'manutencao_so_corretiva',     cause_description:'Manutenção apenas corretiva, sem plano preventivo', probability_weight:5 },

  // SISTEMAS
  { cluster_key:'configuracao_erp',       dimension_key:'sistemas', cause_key:'erp_mal_configurado',            cause_description:'ERP não configurado adequadamente para o negócio', probability_weight:5 },
  { cluster_key:'configuracao_erp',       dimension_key:'sistemas', cause_key:'modulos_nao_utilizados',         cause_description:'Módulos críticos do ERP não implantados ou subutilizados', probability_weight:4 },
  { cluster_key:'cadastro_maestro',       dimension_key:'sistemas', cause_key:'cadastro_desatualizado',         cause_description:'Cadastro mestre com dados desatualizados ou inconsistentes', probability_weight:5 },
  { cluster_key:'workflow_aprovacao',     dimension_key:'sistemas', cause_key:'aprovacao_fora_sistema',         cause_description:'Aprovações realizadas fora do sistema, sem trilha de auditoria', probability_weight:5 },
  { cluster_key:'politica_acesso',        dimension_key:'sistemas', cause_key:'acesso_compartilhado',           cause_description:'Usuários compartilhando senhas ou com acesso irrestrito', probability_weight:5 },
  { cluster_key:'backup_dados',           dimension_key:'sistemas', cause_key:'sem_backup_automatico',          cause_description:'Backup de dados não automatizado ou não testado', probability_weight:5 },
  { cluster_key:'protecao_dados',         dimension_key:'sistemas', cause_key:'lgpd_nao_implementada',          cause_description:'LGPD não implementada: dados pessoais não mapeados', probability_weight:4 },
];

// ─── RECOMENDAÇÕES ─────────────────────────────────────────────────────────────
const RECOMMENDATIONS = [
  // GOVERNANÇA
  { cluster_key:'acordo_socios',        dimension_key:'governanca', recommendation_key:'elaborar_acordo_socios',   recommendation_text:'Contratar advogado especializado e elaborar acordo de sócios com cláusulas de governança, sucessão, alçadas e resolução de conflitos.', impact_level:5, implementation_complexity:4, estimated_time:'90d' },
  { cluster_key:'acordo_socios',        dimension_key:'governanca', recommendation_key:'workshop_governanca',       recommendation_text:'Realizar workshop de governança com todos os sócios para alinhar expectativas e definir regras de convivência.', impact_level:4, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'plano_sucessao',       dimension_key:'governanca', recommendation_key:'mapeamento_sucessores',     recommendation_text:'Mapear potenciais sucessores para cargos críticos e definir plano de desenvolvimento individualizado.', impact_level:5, implementation_complexity:3, estimated_time:'60d' },
  { cluster_key:'plano_sucessao',       dimension_key:'governanca', recommendation_key:'holding_patrimonial',       recommendation_text:'Avaliar constituição de holding patrimonial para organização do patrimônio familiar e facilitar sucessão.', impact_level:5, implementation_complexity:5, estimated_time:'180d' },
  { cluster_key:'alcadas_aprovacao',    dimension_key:'governanca', recommendation_key:'criar_matriz_alcadas',      recommendation_text:'Criar e formalizar matriz de alçadas por valor e tipo de decisão, com aprovação e comunicação a todos os gestores.', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'kpis_estrategicos',    dimension_key:'governanca', recommendation_key:'definir_kpis',              recommendation_text:'Definir 5 a 8 KPIs estratégicos alinhados aos objetivos do negócio e criar rotina mensal de acompanhamento.', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'orcamento_anual',      dimension_key:'governanca', recommendation_key:'implantar_orcamento',       recommendation_text:'Implantar processo orçamentário anual com participação das áreas, aprovação da diretoria e acompanhamento mensal de desvios.', impact_level:5, implementation_complexity:3, estimated_time:'60d' },
  { cluster_key:'matriz_riscos',        dimension_key:'governanca', recommendation_key:'mapear_riscos',             recommendation_text:'Realizar workshop de mapeamento de riscos, classificar por probabilidade e impacto, e definir planos de mitigação para os críticos.', impact_level:4, implementation_complexity:3, estimated_time:'60d' },
  { cluster_key:'seguros_cobertura',    dimension_key:'governanca', recommendation_key:'revisar_seguros',           recommendation_text:'Contratar corretora para revisar todas as apólices e garantir cobertura adequada ao valor de mercado dos ativos.', impact_level:4, implementation_complexity:2, estimated_time:'30d' },

  // JURÍDICO
  { cluster_key:'arrendamento',         dimension_key:'juridico', recommendation_key:'formalizar_arrendamentos',  recommendation_text:'Formalizar todos os contratos de arrendamento com registro, cláusulas de reajuste e renovação, com assessoria jurídica.', impact_level:5, implementation_complexity:3, estimated_time:'60d' },
  { cluster_key:'clt_registro',         dimension_key:'juridico', recommendation_key:'regularizar_trabalhadores', recommendation_text:'Regularizar todos os trabalhadores com registro em carteira e documentação completa, iniciando pelo setor de maior risco.', impact_level:5, implementation_complexity:3, estimated_time:'60d' },
  { cluster_key:'licencas_ambientais',  dimension_key:'juridico', recommendation_key:'renovar_licencas',          recommendation_text:'Iniciar imediatamente o processo de renovação de licenças vencidas e mapear todas as obrigações ambientais futuras.', impact_level:5, implementation_complexity:3, estimated_time:'60d' },
  { cluster_key:'car_itr',              dimension_key:'juridico', recommendation_key:'regularizar_car',           recommendation_text:'Contratar técnico habilitado para regularizar CAR e verificar conformidade do ITR de todas as propriedades.', impact_level:4, implementation_complexity:3, estimated_time:'60d' },
  { cluster_key:'passivo_trabalhista',  dimension_key:'juridico', recommendation_key:'mapear_passivo',            recommendation_text:'Levantar todos os processos trabalhistas, provisionar corretamente e definir estratégia jurídica com advogado.', impact_level:5, implementation_complexity:3, estimated_time:'30d' },
  { cluster_key:'garantias_reais',      dimension_key:'juridico', recommendation_key:'registrar_garantias',       recommendation_text:'Inventariar todas as garantias oferecidas e regularizar registros cartoriais pendentes.', impact_level:5, implementation_complexity:3, estimated_time:'60d' },

  // CONTROLES INTERNOS
  { cluster_key:'segregacao_funcoes',   dimension_key:'controles_internos', recommendation_key:'criar_matriz_raci',        recommendation_text:'Criar matriz RACI para processos críticos e implementar segregação de funções entre solicitação, aprovação e pagamento.', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'segregacao_funcoes',   dimension_key:'controles_internos', recommendation_key:'configurar_perfis_acesso',  recommendation_text:'Configurar perfis de acesso no sistema conforme função de cada colaborador e revogar acessos indevidos.', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'conciliacao_bancaria', dimension_key:'controles_internos', recommendation_key:'implantar_conciliacao',     recommendation_text:'Implantar rotina formal de conciliação bancária mensal com responsável designado e checklist de validação.', impact_level:5, implementation_complexity:1, estimated_time:'30d' },
  { cluster_key:'aprovacao_pagamento',  dimension_key:'controles_internos', recommendation_key:'dupla_aprovacao',           recommendation_text:'Implantar aprovação dupla para pagamentos acima de valor definido e eliminar acesso irrestrito ao banco.', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'inventario_fisico',    dimension_key:'controles_internos', recommendation_key:'rotina_inventario',         recommendation_text:'Implementar contagem física de estoque mensal com conciliação contra o sistema e investigação de divergências.', impact_level:4, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'requisicao_compras',   dimension_key:'controles_internos', recommendation_key:'processo_compras',          recommendation_text:'Implantar processo formal de requisição de compras com aprovação prévia e registro em sistema.', impact_level:4, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'cotacao_fornecedores', dimension_key:'controles_internos', recommendation_key:'politica_cotacao',          recommendation_text:'Implementar política de mínimo 3 cotações para compras acima de valor definido, com registro e justificativa de escolha.', impact_level:4, implementation_complexity:1, estimated_time:'30d' },
  { cluster_key:'faturamento_nota',     dimension_key:'controles_internos', recommendation_key:'emissao_nfe_automatica',    recommendation_text:'Automatizar emissão de NF-e integrada ao pedido de venda, impedindo faturamento sem nota fiscal.', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'folha_pagamento',      dimension_key:'controles_internos', recommendation_key:'revisao_folha_independente',recommendation_text:'Implementar revisão independente da folha de pagamento antes do processamento, com checklist de validação.', impact_level:4, implementation_complexity:1, estimated_time:'30d' },

  // FINANCEIRO
  { cluster_key:'previsibilidade_caixa',dimension_key:'financeiro', recommendation_key:'implantar_fluxo_caixa',    recommendation_text:'Implementar projeção semanal de fluxo de caixa com horizonte de 90 dias, atualizada automaticamente via ERP.', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'previsibilidade_caixa',dimension_key:'financeiro', recommendation_key:'mapa_sazonalidade',        recommendation_text:'Mapear sazonalidade do fluxo de caixa dos últimos 3 anos e incorporar na projeção como buffer de segurança.', impact_level:4, implementation_complexity:2, estimated_time:'60d' },
  { cluster_key:'capital_giro',         dimension_key:'financeiro', recommendation_key:'calcular_ncg',             recommendation_text:'Calcular Necessidade de Capital de Giro (NCG) e monitorar mensalmente o ciclo financeiro (PMR, PMP, PME).', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'estrutura_divida',     dimension_key:'financeiro', recommendation_key:'consolidar_divida',        recommendation_text:'Consolidar todas as dívidas em planilha única com CET, vencimentos e garantias, e avaliar refinanciamento das mais caras.', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'custo_producao',       dimension_key:'financeiro', recommendation_key:'implantar_custo_talhao',   recommendation_text:'Implantar controle de custo de produção por talhão/safra incluindo depreciação, mão de obra e custos indiretos.', impact_level:5, implementation_complexity:3, estimated_time:'60d' },
  { cluster_key:'margem_resultado',     dimension_key:'financeiro', recommendation_key:'apurar_margem_produto',    recommendation_text:'Apurar margem de contribuição por produto/atividade e eliminar ou repriorizar atividades não rentáveis.', impact_level:5, implementation_complexity:2, estimated_time:'60d' },
  { cluster_key:'projecao_dre',         dimension_key:'financeiro', recommendation_key:'elaborar_projecao_dre',   recommendation_text:'Elaborar projeção de DRE anual com desdobramento mensal e revisão trimestral com análise de desvios.', impact_level:5, implementation_complexity:3, estimated_time:'60d' },

  // CONTÁBIL
  { cluster_key:'dre_mensal',           dimension_key:'contabil', recommendation_key:'prazo_dre',               recommendation_text:'Definir prazo máximo de entrega da DRE (até 10º dia útil do mês) e estabelecer checklist de fechamento.', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'acuracia_lancamentos', dimension_key:'contabil', recommendation_key:'revisao_lancamentos',     recommendation_text:'Implementar revisão pré-fechamento dos lançamentos com eliminação de contas genéricas e justificativa obrigatória.', impact_level:4, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'centro_custo',         dimension_key:'contabil', recommendation_key:'implantar_centros_custo', recommendation_text:'Configurar centros de custo no ERP por área/atividade e treinar equipe para lançamento correto.', impact_level:4, implementation_complexity:3, estimated_time:'60d' },
  { cluster_key:'provisao_ferias',      dimension_key:'contabil', recommendation_key:'constituir_provisoes',   recommendation_text:'Constituir provisão mensal de férias e 13º com cálculo automatizado e conciliação com o RH.', impact_level:4, implementation_complexity:1, estimated_time:'30d' },

  // TRIBUTÁRIO
  { cluster_key:'regime_tributario',    dimension_key:'tributario', recommendation_key:'simular_regimes',         recommendation_text:'Contratar consultor tributário para simular Lucro Real x Presumido x Simples e identificar o regime mais eficiente.', impact_level:5, implementation_complexity:3, estimated_time:'60d' },
  { cluster_key:'creditos_icms',        dimension_key:'tributario', recommendation_key:'recuperar_creditos',      recommendation_text:'Revisar os últimos 5 anos e identificar créditos tributários não aproveitados para recuperação fiscal.', impact_level:5, implementation_complexity:3, estimated_time:'90d' },
  { cluster_key:'passivo_fiscal_est',   dimension_key:'tributario', recommendation_key:'classificar_riscos',      recommendation_text:'Mapear e classificar todos os riscos fiscais (provável/possível/remoto) com o consultor tributário.', impact_level:5, implementation_complexity:3, estimated_time:'60d' },
  { cluster_key:'apuracao_impostos',    dimension_key:'tributario', recommendation_key:'automatizar_apuracao',    recommendation_text:'Automatizar apuração de tributos via ERP, eliminando planilhas manuais e reduzindo risco de erro.', impact_level:4, implementation_complexity:4, estimated_time:'90d' },

  // OPERACIONAL
  { cluster_key:'calendario_operacional',dimension_key:'operacional', recommendation_key:'criar_calendario_safra', recommendation_text:'Criar calendário agrícola anual com datas de plantio, aplicação, colheita e manutenções preventivas.', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'custo_maquina_hora',   dimension_key:'operacional', recommendation_key:'calcular_cmh',           recommendation_text:'Calcular custo máquina/hora para os principais equipamentos e usar como referência nas decisões operacionais.', impact_level:4, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'producao_colheita',    dimension_key:'operacional', recommendation_key:'registrar_produtividade',recommendation_text:'Implementar registro de produtividade por talhão a cada safra para análise histórica e tomada de decisão.', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'perdas_processo',      dimension_key:'operacional', recommendation_key:'medir_perdas',           recommendation_text:'Implantar medição sistemática de perdas na colheita e armazenagem com metas de redução e análise de causa.', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'venda_contrato',       dimension_key:'operacional', recommendation_key:'contratos_venda',        recommendation_text:'Padronizar contratos de venda com cláusulas de preço, prazo, qualidade e entrega, com revisão jurídica.', impact_level:4, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'estoque_insumos',      dimension_key:'operacional', recommendation_key:'controle_estoque_insumos',recommendation_text:'Implementar sistema de controle de estoque de insumos com registro de entradas, saídas e inventário periódico.', impact_level:4, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'plano_manutencao',     dimension_key:'operacional', recommendation_key:'manutencao_preventiva',  recommendation_text:'Elaborar plano de manutenção preventiva para máquinas críticas com calendário, responsáveis e registro.', impact_level:4, implementation_complexity:2, estimated_time:'30d' },

  // SISTEMAS
  { cluster_key:'configuracao_erp',     dimension_key:'sistemas', recommendation_key:'diagnostico_erp',        recommendation_text:'Realizar diagnóstico completo de aderência do ERP ao negócio e criar plano de parametrização dos módulos críticos.', impact_level:5, implementation_complexity:3, estimated_time:'60d' },
  { cluster_key:'cadastro_maestro',     dimension_key:'sistemas', recommendation_key:'higiene_cadastro',       recommendation_text:'Realizar limpeza e padronização do cadastro mestre, eliminando duplicidades e completando campos obrigatórios.', impact_level:4, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'workflow_aprovacao',   dimension_key:'sistemas', recommendation_key:'implantar_workflow',     recommendation_text:'Configurar workflows de aprovação no sistema para compras e pagamentos, criando trilha de auditoria automática.', impact_level:5, implementation_complexity:3, estimated_time:'60d' },
  { cluster_key:'politica_acesso',      dimension_key:'sistemas', recommendation_key:'gestao_acessos',         recommendation_text:'Revisar e restringir acessos aos sistemas por perfil de função, eliminar usuários inativos e implementar senha individual.', impact_level:5, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'backup_dados',         dimension_key:'sistemas', recommendation_key:'backup_automatico',      recommendation_text:'Implementar backup automático diário em nuvem com teste mensal de restauração e plano de recuperação documentado.', impact_level:4, implementation_complexity:2, estimated_time:'30d' },
  { cluster_key:'protecao_dados',       dimension_key:'sistemas', recommendation_key:'lgpd_adequacao',         recommendation_text:'Mapear dados pessoais tratados, elaborar aviso de privacidade e designar responsável pela proteção de dados (DPO).', impact_level:3, implementation_complexity:3, estimated_time:'90d' },
];

// ─── BENCHMARKS ────────────────────────────────────────────────────────────────
// Valores de referência do mercado (escala 0-3, pois scores FAL são 0-3)
const BENCHMARKS = [
  // Dimensão Governança — grupo: agronegocio
  { dimension_key:'governanca', cluster_key:'acordo_socios',        benchmark_group:'agronegocio',   avg_score:0.8,  median_score:0.6,  p75_score:1.5,  p90_score:2.2, sample_size:120 },
  { dimension_key:'governanca', cluster_key:'kpis_estrategicos',    benchmark_group:'agronegocio',   avg_score:1.0,  median_score:0.8,  p75_score:1.8,  p90_score:2.5, sample_size:120 },
  { dimension_key:'governanca', cluster_key:'orcamento_anual',      benchmark_group:'agronegocio',   avg_score:1.2,  median_score:1.0,  p75_score:2.0,  p90_score:2.7, sample_size:120 },
  { dimension_key:'governanca', cluster_key:'plano_sucessao',       benchmark_group:'agronegocio',   avg_score:0.7,  median_score:0.5,  p75_score:1.3,  p90_score:2.0, sample_size:120 },
  { dimension_key:'governanca', cluster_key:'alcadas_aprovacao',    benchmark_group:'agronegocio',   avg_score:1.2,  median_score:1.0,  p75_score:2.0,  p90_score:2.7, sample_size:120 },
  { dimension_key:'governanca', cluster_key:'matriz_riscos',        benchmark_group:'agronegocio',   avg_score:0.9,  median_score:0.7,  p75_score:1.6,  p90_score:2.3, sample_size:120 },
  // Financeiro
  { dimension_key:'financeiro', cluster_key:'previsibilidade_caixa',benchmark_group:'agronegocio',   avg_score:1.1,  median_score:0.9,  p75_score:1.9,  p90_score:2.5, sample_size:120 },
  { dimension_key:'financeiro', cluster_key:'custo_producao',       benchmark_group:'agronegocio',   avg_score:1.3,  median_score:1.1,  p75_score:2.1,  p90_score:2.7, sample_size:120 },
  { dimension_key:'financeiro', cluster_key:'estrutura_divida',     benchmark_group:'agronegocio',   avg_score:1.0,  median_score:0.8,  p75_score:1.7,  p90_score:2.4, sample_size:120 },
  { dimension_key:'financeiro', cluster_key:'margem_resultado',     benchmark_group:'agronegocio',   avg_score:1.0,  median_score:0.9,  p75_score:1.8,  p90_score:2.5, sample_size:120 },
  // Controles Internos
  { dimension_key:'controles_internos', cluster_key:'segregacao_funcoes',   benchmark_group:'agronegocio', avg_score:0.9, median_score:0.7, p75_score:1.6, p90_score:2.2, sample_size:120 },
  { dimension_key:'controles_internos', cluster_key:'conciliacao_bancaria', benchmark_group:'agronegocio', avg_score:1.3, median_score:1.1, p75_score:2.0, p90_score:2.6, sample_size:120 },
  { dimension_key:'controles_internos', cluster_key:'aprovacao_pagamento',  benchmark_group:'agronegocio', avg_score:1.1, median_score:0.9, p75_score:1.8, p90_score:2.5, sample_size:120 },
  { dimension_key:'controles_internos', cluster_key:'inventario_fisico',    benchmark_group:'agronegocio', avg_score:1.0, median_score:0.8, p75_score:1.7, p90_score:2.4, sample_size:120 },
  { dimension_key:'controles_internos', cluster_key:'faturamento_nota',     benchmark_group:'agronegocio', avg_score:1.8, median_score:1.6, p75_score:2.4, p90_score:2.9, sample_size:120 },
  // Tributário
  { dimension_key:'tributario', cluster_key:'regime_tributario',    benchmark_group:'agronegocio',   avg_score:1.2,  median_score:1.0,  p75_score:2.0,  p90_score:2.7, sample_size:120 },
  { dimension_key:'tributario', cluster_key:'creditos_icms',        benchmark_group:'agronegocio',   avg_score:1.0,  median_score:0.8,  p75_score:1.8,  p90_score:2.5, sample_size:120 },
  { dimension_key:'tributario', cluster_key:'passivo_fiscal_est',   benchmark_group:'agronegocio',   avg_score:0.8,  median_score:0.6,  p75_score:1.5,  p90_score:2.2, sample_size:120 },
  // Operacional
  { dimension_key:'operacional', cluster_key:'calendario_operacional', benchmark_group:'agronegocio', avg_score:1.5, median_score:1.3, p75_score:2.2, p90_score:2.8, sample_size:120 },
  { dimension_key:'operacional', cluster_key:'producao_colheita',    benchmark_group:'agronegocio',   avg_score:1.4, median_score:1.2, p75_score:2.1, p90_score:2.7, sample_size:120 },
  { dimension_key:'operacional', cluster_key:'custo_maquina_hora',   benchmark_group:'agronegocio',   avg_score:1.1, median_score:0.9, p75_score:1.8, p90_score:2.5, sample_size:120 },
  // Sistemas
  { dimension_key:'sistemas', cluster_key:'configuracao_erp',        benchmark_group:'agronegocio',   avg_score:1.0, median_score:0.8, p75_score:1.8, p90_score:2.5, sample_size:120 },
  { dimension_key:'sistemas', cluster_key:'cadastro_maestro',        benchmark_group:'agronegocio',   avg_score:1.1, median_score:0.9, p75_score:1.8, p90_score:2.5, sample_size:120 },
  { dimension_key:'sistemas', cluster_key:'politica_acesso',         benchmark_group:'agronegocio',   avg_score:1.2, median_score:1.0, p75_score:1.9, p90_score:2.6, sample_size:120 },
  // Jurídico
  { dimension_key:'juridico', cluster_key:'arrendamento',            benchmark_group:'agronegocio',   avg_score:1.0, median_score:0.8, p75_score:1.7, p90_score:2.4, sample_size:120 },
  { dimension_key:'juridico', cluster_key:'clt_registro',            benchmark_group:'agronegocio',   avg_score:1.5, median_score:1.3, p75_score:2.2, p90_score:2.8, sample_size:120 },
  { dimension_key:'juridico', cluster_key:'licencas_ambientais',     benchmark_group:'agronegocio',   avg_score:1.3, median_score:1.1, p75_score:2.0, p90_score:2.7, sample_size:120 },
  { dimension_key:'juridico', cluster_key:'car_itr',                 benchmark_group:'agronegocio',   avg_score:1.2, median_score:1.0, p75_score:1.9, p90_score:2.6, sample_size:120 },
  // Geral (fallback para todos)
  { dimension_key:'governanca', cluster_key:'acordo_socios',         benchmark_group:'geral',         avg_score:0.9, median_score:0.7, p75_score:1.6, p90_score:2.3, sample_size:500 },
  { dimension_key:'financeiro', cluster_key:'previsibilidade_caixa', benchmark_group:'geral',         avg_score:1.0, median_score:0.8, p75_score:1.8, p90_score:2.5, sample_size:500 },
  { dimension_key:'financeiro', cluster_key:'custo_producao',        benchmark_group:'geral',         avg_score:1.2, median_score:1.0, p75_score:2.0, p90_score:2.6, sample_size:500 },
  { dimension_key:'controles_internos', cluster_key:'segregacao_funcoes', benchmark_group:'geral',    avg_score:1.0, median_score:0.8, p75_score:1.7, p90_score:2.4, sample_size:500 },
];

function isAdmin(user) {
  return resolveAppRole(user) === 'hq_admin';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: HQ admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { dry_run = false } = body;

    if (dry_run) {
      return Response.json({ causes: CAUSES.length, recommendations: RECOMMENDATIONS.length, benchmarks: BENCHMARKS.length });
    }

    // Seed Causes
    const existingCauses = await base44.asServiceRole.entities.FalClusterCause.list();
    const causesByKey = {};
    for (const c of existingCauses) causesByKey[`${c.cluster_key}:${c.cause_key}`] = c;
    let causesCreated = 0, causesUpdated = 0;
    for (const cause of CAUSES) {
      const k = `${cause.cluster_key}:${cause.cause_key}`;
      if (causesByKey[k]) {
        await base44.asServiceRole.entities.FalClusterCause.update(causesByKey[k].id, cause);
        causesUpdated++;
      } else {
        await base44.asServiceRole.entities.FalClusterCause.create(cause);
        causesCreated++;
      }
    }

    // Seed Recommendations
    const existingRecs = await base44.asServiceRole.entities.FalClusterRecommendation.list();
    const recsByKey = {};
    for (const r of existingRecs) recsByKey[`${r.cluster_key}:${r.recommendation_key}`] = r;
    let recsCreated = 0, recsUpdated = 0;
    for (const rec of RECOMMENDATIONS) {
      const k = `${rec.cluster_key}:${rec.recommendation_key}`;
      if (recsByKey[k]) {
        await base44.asServiceRole.entities.FalClusterRecommendation.update(recsByKey[k].id, rec);
        recsUpdated++;
      } else {
        await base44.asServiceRole.entities.FalClusterRecommendation.create(rec);
        recsCreated++;
      }
    }

    // Seed Benchmarks
    const existingBenches = await base44.asServiceRole.entities.FalBenchmark.list();
    const benchesByKey = {};
    for (const b of existingBenches) benchesByKey[`${b.cluster_key}:${b.benchmark_group}`] = b;
    let benchCreated = 0, benchUpdated = 0;
    for (const bench of BENCHMARKS) {
      const k = `${bench.cluster_key}:${bench.benchmark_group}`;
      if (benchesByKey[k]) {
        await base44.asServiceRole.entities.FalBenchmark.update(benchesByKey[k].id, bench);
        benchUpdated++;
      } else {
        await base44.asServiceRole.entities.FalBenchmark.create(bench);
        benchCreated++;
      }
    }

    return Response.json({
      ok: true,
      causes: { created: causesCreated, updated: causesUpdated },
      recommendations: { created: recsCreated, updated: recsUpdated },
      benchmarks: { created: benchCreated, updated: benchUpdated },
    });
  } catch (e) {
    console.error('[seedFalIntelligence]', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
});