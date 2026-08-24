/**
 * clusterRelations.js — Relações entre clusters para detecção de fragilidades sistêmicas FAL
 * Define ciclos de negócio onde a fraqueza combinada indica risco estrutural.
 */

export const CLUSTER_RELATIONS = {

  // ── Ciclo Operacional de Suprimentos ──────────────────────────────────────
  operational_cycle: {
    label: 'Ciclo de Suprimentos e Formação de Custos',
    clusters: ['compras_cluster', 'controle_estoques_cluster', 'custos_agricolas_cluster'],
    alert: 'Fragilidade sistêmica no ciclo de suprimentos: ausência de controle integrado de compras, estoques e custos gera distorção de resultado e risco de perdas não detectadas.',
    business_impact: 'Decisões de precificação e rentabilidade comprometidas; risco de sobrepreço em compras e custo real desconhecido por safra ou produto.',
  },

  // ── Ciclo Financeiro ──────────────────────────────────────────────────────
  financial_cycle: {
    label: 'Ciclo Financeiro e de Liquidez',
    clusters: ['receitas_faturamento_cluster', 'tesouraria_cluster', 'endividamento_cluster'],
    alert: 'Fragilidade sistêmica no ciclo financeiro: falhas em receitas, caixa e dívida criam risco crítico de insolvência técnica e perda de acesso a crédito.',
    business_impact: 'Risco elevado de descasamento de caixa, inadimplência bancária e impossibilidade de planejamento financeiro confiável.',
  },

  // ── Ciclo de Compliance Fiscal-Contábil ───────────────────────────────────
  compliance_cycle: {
    label: 'Ciclo de Compliance Fiscal e Contábil',
    clusters: ['compliance_contabil_cluster', 'apuracao_tributos_cluster', 'obrigacoes_acessorias_cluster'],
    alert: 'Fragilidade sistêmica de compliance: ausência simultânea de conformidade contábil e tributária expõe a empresa a autuações fiscais e demonstrações financeiras não confiáveis.',
    business_impact: 'Risco de multas, glosas fiscais, retrabalho de escrituração e decisões baseadas em dados contábeis incorretos.',
  },

  // ── Ciclo de Governança e Controles ──────────────────────────────────────
  governance_cycle: {
    label: 'Ciclo de Governança e Controles Internos',
    clusters: ['estrutura_governanca_cluster', 'segregacao_funcoes_cluster', 'gestao_riscos_cluster'],
    alert: 'Fragilidade sistêmica de governança: sem estrutura decisória, segregação de funções e gestão de riscos, a empresa opera com baixa resiliência e alto risco de fraude ou erro não detectado.',
    business_impact: 'Decisões concentradas sem documentação, ausência de controles preventivos e exposição não monitorada a riscos críticos do negócio.',
  },

  // ── Ciclo Jurídico-Societário ─────────────────────────────────────────────
  legal_cycle: {
    label: 'Ciclo Jurídico e Societário',
    clusters: ['estrutura_societaria_cluster', 'contencioso_cluster', 'riscos_trabalhistas_cluster'],
    alert: 'Fragilidade sistêmica jurídica: estrutura societária desatualizada combinada com passivos judiciais não provisionados e riscos trabalhistas eleva o risco patrimonial da empresa.',
    business_impact: 'Passivos ocultos que podem comprometer o patrimônio, dificuldade de acesso a crédito e risco em processos de fusão, aquisição ou sucessão.',
  },

  // ── Ciclo de Resultado e Informação Gerencial ─────────────────────────────
  management_info_cycle: {
    label: 'Ciclo de Resultado e Informação Gerencial',
    clusters: ['demonstracoes_financeiras_cluster', 'indicadores_financeiros_cluster', 'acompanhamento_resultados_cluster'],
    alert: 'Fragilidade sistêmica de informação gerencial: sem demonstrações confiáveis, indicadores e acompanhamento de resultados, a gestão opera sem visibilidade real do negócio.',
    business_impact: 'Decisões estratégicas e financeiras tomadas sem base confiável, impossibilitando correção de rota tempestiva.',
  },

  // ── Ciclo de Caixa Agrícola ───────────────────────────────────────────────
  agro_cash_cycle: {
    label: 'Ciclo de Caixa e Financiamento Agrícola',
    clusters: ['gestao_caixa_cluster', 'financas_agro_cpr_barter_cluster', 'endividamento_cluster'],
    alert: 'Fragilidade sistêmica no ciclo de caixa agrícola: ausência de controle de caixa, gestão de CPR/Barter e endividamento cria risco severo de iliquidez na entressafra.',
    business_impact: 'Risco de descasamento entre compromissos financeiros e safra, com potencial de inadimplência bancária e bloqueio de crédito para a próxima temporada.',
  },

  // ── Ciclo de Custos e Tributação Rural ───────────────────────────────────
  rural_tax_cycle: {
    label: 'Ciclo de Custos e Conformidade Fiscal Rural',
    clusters: ['custos_agricolas_cluster', 'tributario_agro_especifico_cluster', 'apuracao_tributos_cluster'],
    alert: 'Fragilidade sistêmica fiscal-rural: custos não apurados por safra combinados com conformidade tributária frágil geram risco de glosa e resultado incorreto.',
    business_impact: 'Risco de autuação pela Receita Federal, perda de benefícios fiscais rurais e decisão de plantio sem base de custo confiável.',
  },

};

export default CLUSTER_RELATIONS;