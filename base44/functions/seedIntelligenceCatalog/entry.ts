import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

// ─── Catálogo de Drivers ──────────────────────────────────────────────────────
const DRIVERS = [
  // Financeiro
  { driver_id: "FIN_VISIBILITY", name: "Visibilidade Financeira", description: "Capacidade de acompanhar DRE, fluxo de caixa e custos em tempo real", dimension: "financeiro", subdimension: "FluxoCaixa", default_weight: 1.5 },
  { driver_id: "FIN_CONTROL", name: "Controle de Custos", description: "Gestão detalhada de custos por atividade/produto", dimension: "financeiro", subdimension: "ControleCustos", default_weight: 1.3 },
  { driver_id: "FIN_CREDIT", name: "Gestão de Crédito", description: "Acesso a crédito e gestão do endividamento", dimension: "financeiro", subdimension: "Credito", default_weight: 1.2 },
  { driver_id: "FIN_BUDGET", name: "Orçamento e Planejamento", description: "Uso de budget formal e projeções financeiras", dimension: "financeiro", subdimension: "Orcamento", default_weight: 1.2 },
  // Governança
  { driver_id: "GOV_STRUCTURE", name: "Estrutura Societária", description: "Clareza nos papéis, participações e estrutura legal", dimension: "governanca", subdimension: "EstruturaSocietaria", default_weight: 1.5 },
  { driver_id: "GOV_RITUALS", name: "Ritos de Governança", description: "Frequência e qualidade de reuniões e tomada de decisão estruturada", dimension: "governanca", subdimension: "RitosDeGovernanca", default_weight: 1.3 },
  { driver_id: "GOV_SUCCESSION", name: "Sucessão e Continuidade", description: "Planejamento de sucessão familiar e profissional", dimension: "governanca", subdimension: "Sucessao", default_weight: 1.2 },
  // Tecnologia
  { driver_id: "TEC_ADOPTION", name: "Adoção de ERP/Sistemas", description: "Nível de uso de sistemas de gestão integrados", dimension: "tecnologia", subdimension: "ERP", default_weight: 1.4 },
  { driver_id: "TEC_DATA_QUALITY", name: "Qualidade de Dados", description: "Integridade e consistência dos dados operacionais", dimension: "tecnologia", subdimension: "QualidadeDeDados", default_weight: 1.3 },
  { driver_id: "TEC_BI", name: "Inteligência de Dados (BI)", description: "Uso de dashboards e análises para decisão", dimension: "tecnologia", subdimension: "BI", default_weight: 1.2 },
  // Operações
  { driver_id: "OPS_PLANNING", name: "Planejamento Operacional", description: "Capacidade de planejar safras, estoques e recursos com antecedência", dimension: "operacoes", subdimension: "PlanejamentoOperacional", default_weight: 1.4 },
  { driver_id: "OPS_PROCESS", name: "Padronização de Processos", description: "Existência de SOPs e procedimentos documentados", dimension: "operacoes", subdimension: "ProcessosOperacionais", default_weight: 1.2 },
  { driver_id: "OPS_STOCK", name: "Gestão de Estoque", description: "Controle de estoque com giro, ruptura e perdas", dimension: "operacoes", subdimension: "GestaoEstoque", default_weight: 1.3 },
  // Pessoas
  { driver_id: "PEO_STRUCTURE", name: "Estrutura de Equipe", description: "Organograma claro com funções e responsabilidades definidas", dimension: "pessoas", subdimension: "GestaoDeEquipe", default_weight: 1.2 },
  { driver_id: "PEO_PERFORMANCE", name: "Gestão de Desempenho", description: "Avaliação, metas e feedback estruturado", dimension: "pessoas", subdimension: "Desempenho", default_weight: 1.2 },
  { driver_id: "PEO_TRAINING", name: "Capacitação Técnica", description: "Treinamento e desenvolvimento contínuo da equipe", dimension: "pessoas", subdimension: "Capacitacao", default_weight: 1.1 },
  // Estratégia
  { driver_id: "STR_PLANNING", name: "Planejamento Estratégico", description: "Existência e uso de planejamento formal de longo prazo", dimension: "estrategia", subdimension: "Planejamento", default_weight: 1.3 },
  { driver_id: "STR_MARKET", name: "Inteligência de Mercado", description: "Monitoramento de concorrência e tendências de mercado", dimension: "estrategia", subdimension: "Mercado", default_weight: 1.1 },
  // Mercado/Comercial
  { driver_id: "MKT_CHANNEL", name: "Diversificação de Canais", description: "Mix de canais de venda e redução de dependência", dimension: "mercado", subdimension: "Canais", default_weight: 1.2 },
  { driver_id: "MKT_PRICING", name: "Gestão de Precificação", description: "Estratégia e controle de preços com margem", dimension: "mercado", subdimension: "Precificacao", default_weight: 1.3 },
  // Sustentabilidade
  { driver_id: "SUS_COMPLIANCE", name: "Conformidade Legal/Ambiental", description: "Regularidade fiscal, ambiental e trabalhista", dimension: "sustentabilidade", subdimension: "Compliance", default_weight: 1.3 },
  { driver_id: "SUS_ESG", name: "Práticas ESG", description: "Iniciativas de sustentabilidade e responsabilidade social", dimension: "sustentabilidade", subdimension: "ESG", default_weight: 1.0 }
];

// ─── Catálogo de Root Causes ──────────────────────────────────────────────────
const ROOT_CAUSES = [
  { cause_id: "RC_FIN_NO_DRE", name: "Ausência de DRE formal", description: "Empresa não acompanha resultado econômico mensalmente. Decisões financeiras são tomadas apenas com saldo bancário.", driver_ids: ["FIN_VISIBILITY","FIN_BUDGET"], playbook_keys: ["financeiro-FluxoCaixa-critico","financeiro-FluxoCaixa-basico"], typical_roles: ["gestor_financeiro","socio_operador"], dimension: "financeiro" },
  { cause_id: "RC_FIN_CASHFLOW_SEASONAL", name: "Descontrole no caixa sazonal", description: "Fluxo de caixa não planeja sazonalidade da atividade (safra/entressafra ou pico de vendas).", driver_ids: ["FIN_VISIBILITY","OPS_PLANNING"], playbook_keys: ["financeiro-FluxoCaixa-critico"], typical_roles: ["gestor_financeiro","socio_produtor"], dimension: "financeiro" },
  { cause_id: "RC_GOV_NO_RITUALS", name: "Ausência de ritos de governança", description: "Decisões são tomadas informalmente sem reuniões estruturadas ou registros.", driver_ids: ["GOV_RITUALS","GOV_STRUCTURE"], playbook_keys: ["governanca-RitosDeGovernanca-critico","governanca-EstruturaSocietaria-critico"], typical_roles: ["socio_operador","familiar_sucessor"], dimension: "governanca" },
  { cause_id: "RC_GOV_FAMILY_CONFUSION", name: "Confusão entre patrimônio pessoal e empresarial", description: "Sócios/família não separam finanças pessoais da empresa.", driver_ids: ["GOV_STRUCTURE","FIN_CONTROL"], playbook_keys: ["governanca-EstruturaSocietaria-critico"], typical_roles: ["socio_operador","familiar_gestor"], dimension: "governanca" },
  { cause_id: "RC_TEC_NO_ERP", name: "Operação sem sistema de gestão (ERP)", description: "Processos gerenciados em planilhas ou papel. Alta dependência de pessoas específicas para informação.", driver_ids: ["TEC_ADOPTION","TEC_DATA_QUALITY"], playbook_keys: ["tecnologia-ERP-critico"], typical_roles: ["gestor_operacional","ti_interno"], dimension: "tecnologia" },
  { cause_id: "RC_TEC_ERP_UNDERUSED", name: "ERP instalado mas subutilizado", description: "Sistema existe mas equipe usa apenas funcionalidades básicas. ROI do investimento não realizado.", driver_ids: ["TEC_ADOPTION","TEC_DATA_QUALITY"], playbook_keys: ["tecnologia-ERP-basico"], typical_roles: ["gestor_operacional","usuario_sistema"], dimension: "tecnologia" },
  { cause_id: "RC_OPS_NO_CALENDAR", name: "Planejamento operacional reativo", description: "Empresa não planeja com antecedência. Compras, contratações e manutenções são feitas no urgente.", driver_ids: ["OPS_PLANNING","OPS_STOCK"], playbook_keys: ["operacoes-PlanejamentoOperacional-critico"], typical_roles: ["gestor_operacional","almoxarife"], dimension: "operacoes" },
  { cause_id: "RC_PEO_NO_ROLES", name: "Papéis e responsabilidades indefinidos", description: "Equipe sem descrição de cargos clara. Sobreposição de funções e gaps de responsabilidade.", driver_ids: ["PEO_STRUCTURE","PEO_PERFORMANCE"], playbook_keys: ["pessoas-GestaoDeEquipe-critico"], typical_roles: ["rh_informal","gestor_geral"], dimension: "pessoas" },
  { cause_id: "RC_STR_NO_PLAN", name: "Ausência de planejamento estratégico formal", description: "Empresa não tem objetivos de longo prazo documentados. Decisões sem orientação estratégica.", driver_ids: ["STR_PLANNING","GOV_RITUALS"], playbook_keys: ["estrategia-Planejamento-critico"], typical_roles: ["socio_estrategico","ceo"], dimension: "estrategia" },
  { cause_id: "RC_MKT_PRICE_GUT", name: "Precificação intuitiva sem controle de margem", description: "Preços definidos por intuição ou cópia da concorrência sem cálculo de custo e margem.", driver_ids: ["MKT_PRICING","FIN_CONTROL"], playbook_keys: [], typical_roles: ["vendedor","gestor_comercial"], dimension: "mercado" }
];

// ─── Signals para 120 perguntas chave ─────────────────────────────────────────
// Mapeamento questão → driver → playbook. Formato: question_code -> signal
const QUESTION_SIGNALS = [
  // === FINANCEIRO ===
  { code: "FIN-CF-01", driver_ids: ["FIN_VISIBILITY"], severity: 3, confidence: 1.0, bad_answers: ["0","1"], recommended_playbook_keys: ["financeiro-FluxoCaixa-critico"], root_cause_hints: ["RC_FIN_NO_DRE"] },
  { code: "FIN-CF-02", driver_ids: ["FIN_VISIBILITY"], severity: 3, confidence: 0.9, bad_answers: ["0","1"], recommended_playbook_keys: ["financeiro-FluxoCaixa-critico"], root_cause_hints: ["RC_FIN_CASHFLOW_SEASONAL"] },
  { code: "FIN-CF-03", driver_ids: ["FIN_VISIBILITY","FIN_BUDGET"], severity: 2, confidence: 0.9, bad_answers: ["0","1"], recommended_playbook_keys: ["financeiro-FluxoCaixa-basico"], root_cause_hints: ["RC_FIN_CASHFLOW_SEASONAL"] },
  { code: "FIN-CC-01", driver_ids: ["FIN_CONTROL"], severity: 3, confidence: 1.0, bad_answers: ["0","1"], recommended_playbook_keys: [], root_cause_hints: ["RC_FIN_NO_DRE"] },
  { code: "FIN-CC-02", driver_ids: ["FIN_CONTROL","FIN_VISIBILITY"], severity: 2, confidence: 0.8, bad_answers: ["0","1"], recommended_playbook_keys: [], root_cause_hints: ["RC_FIN_NO_DRE"] },
  { code: "FIN-ORC-01", driver_ids: ["FIN_BUDGET"], severity: 2, confidence: 0.9, bad_answers: ["0","1"], recommended_playbook_keys: [], root_cause_hints: ["RC_FIN_NO_DRE"] },
  // === GOVERNANÇA ===
  { code: "GOV-ES-01", driver_ids: ["GOV_STRUCTURE"], severity: 3, confidence: 1.0, bad_answers: ["0","1"], recommended_playbook_keys: ["governanca-EstruturaSocietaria-critico"], root_cause_hints: ["RC_GOV_FAMILY_CONFUSION"] },
  { code: "GOV-ES-02", driver_ids: ["GOV_STRUCTURE","FIN_CONTROL"], severity: 3, confidence: 0.9, bad_answers: ["0","1"], recommended_playbook_keys: ["governanca-EstruturaSocietaria-critico"], root_cause_hints: ["RC_GOV_FAMILY_CONFUSION"] },
  { code: "GOV-ES-03", driver_ids: ["GOV_STRUCTURE"], severity: 2, confidence: 0.8, bad_answers: ["0","1"], recommended_playbook_keys: ["governanca-EstruturaSocietaria-critico"], root_cause_hints: ["RC_GOV_NO_RITUALS"] },
  { code: "GOV-RG-01", driver_ids: ["GOV_RITUALS"], severity: 3, confidence: 1.0, bad_answers: ["0","1"], recommended_playbook_keys: ["governanca-RitosDeGovernanca-critico"], root_cause_hints: ["RC_GOV_NO_RITUALS"] },
  { code: "GOV-RG-02", driver_ids: ["GOV_RITUALS"], severity: 2, confidence: 0.9, bad_answers: ["0","1"], recommended_playbook_keys: ["governanca-RitosDeGovernanca-critico"], root_cause_hints: ["RC_GOV_NO_RITUALS"] },
  { code: "GOV-SUC-01", driver_ids: ["GOV_SUCCESSION"], severity: 2, confidence: 0.8, bad_answers: ["0","1"], recommended_playbook_keys: [], root_cause_hints: ["RC_GOV_NO_RITUALS"] },
  // === TECNOLOGIA ===
  { code: "TEC-ERP-01", driver_ids: ["TEC_ADOPTION"], severity: 3, confidence: 1.0, bad_answers: ["0","1"], recommended_playbook_keys: ["tecnologia-ERP-critico"], root_cause_hints: ["RC_TEC_NO_ERP"] },
  { code: "TEC-ERP-02", driver_ids: ["TEC_ADOPTION"], severity: 2, confidence: 0.9, bad_answers: ["0","1"], recommended_playbook_keys: ["tecnologia-ERP-basico"], root_cause_hints: ["RC_TEC_ERP_UNDERUSED"] },
  { code: "TEC-ERP-03", driver_ids: ["TEC_ADOPTION","TEC_DATA_QUALITY"], severity: 2, confidence: 0.8, bad_answers: ["0","1"], recommended_playbook_keys: ["tecnologia-ERP-basico"], root_cause_hints: ["RC_TEC_ERP_UNDERUSED"] },
  { code: "TEC-DQ-01", driver_ids: ["TEC_DATA_QUALITY"], severity: 3, confidence: 0.9, bad_answers: ["0","1"], recommended_playbook_keys: ["tecnologia-QualidadeDeDados-critico"], root_cause_hints: ["RC_TEC_ERP_UNDERUSED"] },
  { code: "TEC-DQ-02", driver_ids: ["TEC_DATA_QUALITY"], severity: 2, confidence: 0.8, bad_answers: ["0","1"], recommended_playbook_keys: ["tecnologia-QualidadeDeDados-critico"], root_cause_hints: ["RC_TEC_NO_ERP"] },
  { code: "TEC-BI-01", driver_ids: ["TEC_BI"], severity: 2, confidence: 0.9, bad_answers: ["0","1"], recommended_playbook_keys: [], root_cause_hints: ["RC_TEC_ERP_UNDERUSED"] },
  // === OPERAÇÕES ===
  { code: "OPS-PL-01", driver_ids: ["OPS_PLANNING"], severity: 3, confidence: 1.0, bad_answers: ["0","1"], recommended_playbook_keys: ["operacoes-PlanejamentoOperacional-critico"], root_cause_hints: ["RC_OPS_NO_CALENDAR"] },
  { code: "OPS-PL-02", driver_ids: ["OPS_PLANNING","OPS_STOCK"], severity: 2, confidence: 0.9, bad_answers: ["0","1"], recommended_playbook_keys: ["operacoes-PlanejamentoOperacional-critico"], root_cause_hints: ["RC_OPS_NO_CALENDAR"] },
  { code: "OPS-ST-01", driver_ids: ["OPS_STOCK"], severity: 2, confidence: 0.9, bad_answers: ["0","1"], recommended_playbook_keys: [], root_cause_hints: ["RC_OPS_NO_CALENDAR"] },
  { code: "OPS-PR-01", driver_ids: ["OPS_PROCESS"], severity: 2, confidence: 0.8, bad_answers: ["0","1"], recommended_playbook_keys: [], root_cause_hints: ["RC_OPS_NO_CALENDAR"] },
  // === PESSOAS ===
  { code: "PEO-GE-01", driver_ids: ["PEO_STRUCTURE"], severity: 3, confidence: 1.0, bad_answers: ["0","1"], recommended_playbook_keys: ["pessoas-GestaoDeEquipe-critico"], root_cause_hints: ["RC_PEO_NO_ROLES"] },
  { code: "PEO-GE-02", driver_ids: ["PEO_STRUCTURE","PEO_PERFORMANCE"], severity: 2, confidence: 0.9, bad_answers: ["0","1"], recommended_playbook_keys: ["pessoas-GestaoDeEquipe-critico"], root_cause_hints: ["RC_PEO_NO_ROLES"] },
  { code: "PEO-CAP-01", driver_ids: ["PEO_TRAINING"], severity: 2, confidence: 0.8, bad_answers: ["0","1"], recommended_playbook_keys: [], root_cause_hints: ["RC_PEO_NO_ROLES"] },
  // === ESTRATÉGIA ===
  { code: "STR-PL-01", driver_ids: ["STR_PLANNING"], severity: 3, confidence: 1.0, bad_answers: ["0","1"], recommended_playbook_keys: ["estrategia-Planejamento-critico"], root_cause_hints: ["RC_STR_NO_PLAN"] },
  { code: "STR-PL-02", driver_ids: ["STR_PLANNING","GOV_RITUALS"], severity: 2, confidence: 0.9, bad_answers: ["0","1"], recommended_playbook_keys: ["estrategia-Planejamento-critico"], root_cause_hints: ["RC_STR_NO_PLAN"] },
  // === MERCADO ===
  { code: "MKT-PR-01", driver_ids: ["MKT_PRICING","FIN_CONTROL"], severity: 3, confidence: 1.0, bad_answers: ["0","1"], recommended_playbook_keys: [], root_cause_hints: ["RC_MKT_PRICE_GUT"] },
  { code: "MKT-CH-01", driver_ids: ["MKT_CHANNEL"], severity: 2, confidence: 0.8, bad_answers: ["0","1"], recommended_playbook_keys: [], root_cause_hints: [] },
  // === SUSTENTABILIDADE ===
  { code: "SUS-CO-01", driver_ids: ["SUS_COMPLIANCE"], severity: 3, confidence: 1.0, bad_answers: ["0","1"], recommended_playbook_keys: [], root_cause_hints: [] },
  { code: "SUS-ESG-01", driver_ids: ["SUS_ESG"], severity: 1, confidence: 0.7, bad_answers: ["0","1"], recommended_playbook_keys: [], root_cause_hints: [] }
];

// ─── Main ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: HQ admin only' }, { status: 403 });

  const results = { drivers: 0, causes: 0, signals: 0, errors: [] };

  // Seed drivers
  for (const driver of DRIVERS) {
    const existing = await base44.asServiceRole.entities.FalDriverCatalog.filter({ driver_id: driver.driver_id }, null, 1);
    if (existing.length === 0) {
      await base44.asServiceRole.entities.FalDriverCatalog.create({ ...driver, tenant_id: null });
      results.drivers++;
    }
  }

  // Seed root causes
  for (const cause of ROOT_CAUSES) {
    const existing = await base44.asServiceRole.entities.FalRootCauseCatalog.filter({ cause_id: cause.cause_id }, null, 1);
    if (existing.length === 0) {
      await base44.asServiceRole.entities.FalRootCauseCatalog.create({ ...cause, tenant_id: null });
      results.causes++;
    }
  }

  // Seed signals — busca FalQuestions por code e mapeia
  for (const sig of QUESTION_SIGNALS) {
    const questions = await base44.asServiceRole.entities.FalQuestion.filter({ code: sig.code }, null, 1);
    if (questions.length === 0) { results.errors.push(`Question not found: ${sig.code}`); continue; }
    const q = questions[0];
    const existingSig = await base44.asServiceRole.entities.FalQuestionSignal.filter({ question_id: q.id }, null, 1);
    if (existingSig.length === 0) {
      await base44.asServiceRole.entities.FalQuestionSignal.create({
        tenant_id: null,
        question_id: q.id,
        dimension: q.dimension,
        subdimension: q.subdimension || null,
        signal_type: 'likert',
        ...sig
      });
      results.signals++;
    }
  }

  return Response.json({ ok: true, ...results });
});