/**
 * getBankTemplate — Retorna o banco oficial de perguntas FAL v1.0
 * Pronto para importar via importMethodQuestions ou importMethodBank.
 * Apenas HQ Admin pode acessar.
 *
 * Estrutura de resposta: { bank, version_code, notes }
 * O campo "bank" pode ser passado diretamente a importMethodQuestions.
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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (appRole !== 'hq_admin') {
    return Response.json({ error: 'Forbidden: HQ Admin only' }, { status: 403 });
  }

  const bank = {
    dimensions: [

      // ─────────────────────────────────────────────
      // 1. GOVERNANÇA
      // ─────────────────────────────────────────────
      {
        key: 'governanca',
        name: 'Governança (TCWG)',
        questions: [
          // CORE
          { code: 'GOV-01', text: 'Existe instância formal de tomada de decisão estratégica (reunião de sócios, conselho ou comitê)?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'ata de reunião ou regimento interno', risk_tag: 'governance_structure' },
          { code: 'GOV-02', text: 'As decisões estratégicas são documentadas e comunicadas à equipe de gestão?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'atas assinadas, e-mails formais', risk_tag: 'governance_documentation' },
          { code: 'GOV-03', text: 'A empresa possui missão, visão e valores formalmente definidos e comunicados?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'documento de identidade organizacional', risk_tag: 'governance_mission' },
          { code: 'GOV-04', text: 'Existe planejamento estratégico com metas formais e revisão periódica (anual ou semestral)?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'planejamento estratégico documentado', risk_tag: 'governance_planning' },
          { code: 'GOV-05', text: 'Os proprietários/sócios têm papéis claramente separados da gestão operacional?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'organograma, contrato social com cargos', risk_tag: 'governance_separation' },
          { code: 'GOV-06', text: 'Existe política de dividendos ou pro-labore definida formalmente?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'deliberação societária, acordo de sócios', risk_tag: 'governance_dividends' },
          { code: 'GOV-07', text: 'A empresa realiza avaliação formal de desempenho dos gestores?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de avaliação de desempenho', risk_tag: 'governance_performance' },
          { code: 'GOV-08', text: 'Existe código de ética ou política de conduta formalmente aprovado?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'código de ética assinado', risk_tag: 'governance_ethics' },
          // SETORIAL
          { code: 'GOV-S01', text: 'Existe governança formal sobre decisões do ciclo produtivo (safra, rebanho ou produção)?', weight: 2, sector_tags: ['agriculture', 'livestock', 'agro_livestock', 'agro_industry'], sector_type: 'sector', evidence_hint: 'atas de reunião de planejamento rural', risk_tag: 'agro_governance_cycle' },
          { code: 'GOV-S02', text: 'Há estrutura de governança para gestão do portfólio de produtos e fornecedores?', weight: 2, sector_tags: ['input_retail'], sector_type: 'sector', evidence_hint: 'política de compras aprovada', risk_tag: 'retail_governance_portfolio' },
          { code: 'GOV-S03', text: 'O processo de aquisição de terras, máquinas ou rebanho possui aprovação formal?', weight: 2, sector_tags: ['agriculture', 'livestock', 'agro_livestock'], sector_type: 'sector', evidence_hint: 'deliberação societária de investimentos rurais', risk_tag: 'agro_capex_governance' },
        ],
        checklist: [
          { item_id: 'gov_chk_1', label: 'Ata de reunião societária ou de conselho (últimos 12 meses)', required: true, order: 1 },
          { item_id: 'gov_chk_2', label: 'Planejamento estratégico com metas documentadas', required: true, order: 2 },
          { item_id: 'gov_chk_3', label: 'Organograma atualizado', required: false, order: 3 },
        ]
      },

      // ─────────────────────────────────────────────
      // 2. CONTROLES INTERNOS
      // ─────────────────────────────────────────────
      {
        key: 'controles_internos',
        name: 'Controles Internos',
        questions: [
          { code: 'CI-01', text: 'Existem políticas e procedimentos formais de controle interno documentados?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'manual de controles internos', risk_tag: 'ci_policies' },
          { code: 'CI-02', text: 'Há segregação de funções entre quem aprova, executa e registra transações?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'matriz de alçadas e segregação', risk_tag: 'ci_segregation' },
          { code: 'CI-03', text: 'Existe controle de alçadas e limites de aprovação por nível hierárquico?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'política de alçadas', risk_tag: 'ci_approval_limits' },
          { code: 'CI-04', text: 'São realizadas reconciliações periódicas entre sistemas, bancos e registros contábeis?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'conciliação bancária, relatórios de fechamento', risk_tag: 'ci_reconciliation' },
          { code: 'CI-05', text: 'Há controle de acesso aos sistemas e dados sensíveis da empresa?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'política de acesso a sistemas', risk_tag: 'ci_access_control' },
          { code: 'CI-06', text: 'Existe processo formal de revisão de relatórios financeiros antes de sua utilização?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'evidências de revisão/aprovação de relatórios', risk_tag: 'ci_review_process' },
          { code: 'CI-07', text: 'A empresa realiza auditorias internas ou revisões periódicas dos controles?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de auditoria interna', risk_tag: 'ci_internal_audit' },
          { code: 'CI-08', text: 'Existem controles preventivos sobre riscos de fraude e erros operacionais?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'matriz de riscos e controles', risk_tag: 'ci_fraud_prevention' },
          // SETORIAL
          { code: 'CI-S01', text: 'Existe controle formal de entrada e saída de insumos e produtos do estoque rural?', weight: 2, sector_tags: ['agriculture', 'agro_livestock', 'input_retail'], sector_type: 'sector', evidence_hint: 'relatório de movimentação de estoque', risk_tag: 'agro_stock_control' },
          { code: 'CI-S02', text: 'Há controle de pesagem, qualidade e rastreabilidade na recepção de mercadorias?', weight: 2, sector_tags: ['agro_industry', 'input_retail'], sector_type: 'sector', evidence_hint: 'laudos de pesagem e qualidade', risk_tag: 'retail_quality_control' },
        ],
        checklist: [
          { item_id: 'ci_chk_1', label: 'Matriz de alçadas e segregação de funções', required: true, order: 1 },
          { item_id: 'ci_chk_2', label: 'Conciliação bancária dos últimos 3 meses', required: true, order: 2 },
        ]
      },

      // ─────────────────────────────────────────────
      // 3. FINANCEIRO
      // ─────────────────────────────────────────────
      {
        key: 'financeiro',
        name: 'Financeiro',
        questions: [
          { code: 'FIN-01', text: 'A empresa possui fluxo de caixa projetado (mínimo 3 meses à frente)?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'planilha ou relatório de projeção de caixa', risk_tag: 'fin_cashflow_projection' },
          { code: 'FIN-02', text: 'Existe controle formal do fluxo de caixa realizado (diário ou semanal)?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de fluxo de caixa realizado', risk_tag: 'fin_cashflow_actual' },
          { code: 'FIN-03', text: 'As contas pessoais dos sócios são completamente separadas das contas da empresa?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'extrato bancário da empresa sem movimentações pessoais', risk_tag: 'fin_pf_pj_separation' },
          { code: 'FIN-04', text: 'Existe orçamento anual formal com acompanhamento mensal (real x orçado)?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório orçamentário mensal', risk_tag: 'fin_budget' },
          { code: 'FIN-05', text: 'A empresa monitora indicadores financeiros chave (liquidez, rentabilidade, endividamento)?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'dashboard de indicadores financeiros', risk_tag: 'fin_kpis' },
          { code: 'FIN-06', text: 'As dívidas e financiamentos são registrados e monitorados com cronograma de vencimentos?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'controle de passivos e cronograma de amortização', risk_tag: 'fin_debt_management' },
          { code: 'FIN-07', text: 'Existe controle formal de contas a pagar e a receber com projeção de vencimentos?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'aging de contas a pagar/receber', risk_tag: 'fin_ap_ar' },
          { code: 'FIN-08', text: 'A empresa tem política de crédito definida para clientes?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'política de crédito e cobrança', risk_tag: 'fin_credit_policy' },
          // SETORIAL
          { code: 'FIN-S01', text: 'O custo de produção por safra ou por cabeça é calculado e monitorado formalmente?', weight: 3, sector_tags: ['agriculture', 'livestock', 'agro_livestock'], sector_type: 'sector', evidence_hint: 'planilha de custo de produção', risk_tag: 'agro_production_cost' },
          { code: 'FIN-S02', text: 'Existe controle financeiro separado por cultura, talhão ou lote de rebanho?', weight: 2, sector_tags: ['agriculture', 'agro_livestock'], sector_type: 'sector', evidence_hint: 'relatório de resultado por talhão/cultura', risk_tag: 'agro_cost_by_unit' },
          { code: 'FIN-S03', text: 'Há gestão de hedge ou proteção financeira contra variação de preço de commodities?', weight: 2, sector_tags: ['agriculture', 'livestock', 'agro_livestock', 'agro_industry'], sector_type: 'sector', evidence_hint: 'contratos de hedge, NDF ou travas de preço', risk_tag: 'agro_hedge' },
          { code: 'FIN-S04', text: 'Os limites de crédito por cliente são monitorados com base em histórico e capacidade de pagamento?', weight: 2, sector_tags: ['input_retail'], sector_type: 'sector', evidence_hint: 'política de crédito rural com limite por produtor', risk_tag: 'retail_credit_limit' },
        ],
        checklist: [
          { item_id: 'fin_chk_1', label: 'Fluxo de caixa projetado (últimos 3 meses)', required: true, order: 1 },
          { item_id: 'fin_chk_2', label: 'Balanço patrimonial e DRE últimos 12 meses', required: true, order: 2 },
          { item_id: 'fin_chk_3', label: 'Relatório de endividamento e cronograma de amortização', required: false, order: 3 },
        ]
      },

      // ─────────────────────────────────────────────
      // 4. CONTÁBIL
      // ─────────────────────────────────────────────
      {
        key: 'contabil',
        name: 'Contábil',
        questions: [
          { code: 'CTB-01', text: 'A empresa possui contabilidade regularmente escriturada (mensal ou bimestral)?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'balancetes mensais', risk_tag: 'ctb_bookkeeping' },
          { code: 'CTB-02', text: 'As demonstrações contábeis (balanço, DRE, DMPL) são produzidas ao menos anualmente?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'demonstrações contábeis assinadas', risk_tag: 'ctb_financial_statements' },
          { code: 'CTB-03', text: 'As demonstrações contábeis são utilizadas pela gestão para tomada de decisão?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'evidência de uso gerencial dos balanços', risk_tag: 'ctb_management_use' },
          { code: 'CTB-04', text: 'O plano de contas é adequado e segmentado para análise gerencial?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'plano de contas estruturado', risk_tag: 'ctb_chart_of_accounts' },
          { code: 'CTB-05', text: 'Existe conciliação entre a contabilidade societária e os registros fiscais (ECF, ECD)?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'SPED Contábil e ECF enviados', risk_tag: 'ctb_sped_reconciliation' },
          { code: 'CTB-06', text: 'Os ativos imobilizados são registrados e depreciados corretamente?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'controle de ativo imobilizado e depreciação', risk_tag: 'ctb_fixed_assets' },
          { code: 'CTB-07', text: 'A empresa realiza inventário físico periódico conciliado com os registros contábeis?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de inventário físico', risk_tag: 'ctb_inventory' },
          // SETORIAL
          { code: 'CTB-S01', text: 'A produção rural é contabilizada por atividade (agrícola, pecuária, industrial)?', weight: 2, sector_tags: ['agriculture', 'livestock', 'agro_livestock', 'agro_industry'], sector_type: 'sector', evidence_hint: 'DRE por atividade', risk_tag: 'agro_activity_accounting' },
          { code: 'CTB-S02', text: 'Os estoques de insumos, animais e produtos agrícolas são contabilizados corretamente?', weight: 2, sector_tags: ['agriculture', 'livestock', 'agro_livestock'], sector_type: 'sector', evidence_hint: 'balancete com estoques detalhados', risk_tag: 'agro_stock_accounting' },
        ],
        checklist: [
          { item_id: 'ctb_chk_1', label: 'Balanço patrimonial assinado (último exercício)', required: true, order: 1 },
          { item_id: 'ctb_chk_2', label: 'SPED Contábil (ECD) do último exercício', required: true, order: 2 },
        ]
      },

      // ─────────────────────────────────────────────
      // 5. TRIBUTÁRIO
      // ─────────────────────────────────────────────
      {
        key: 'tributario',
        name: 'Tributário',
        questions: [
          { code: 'TRB-01', text: 'A empresa possui diagnóstico tributário atualizado com análise do regime mais vantajoso?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'estudo de enquadramento tributário', risk_tag: 'tax_regime_analysis' },
          { code: 'TRB-02', text: 'As obrigações acessórias fiscais (SPED, EFD, ECF, DCTF, PGDAS) são entregues no prazo?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'comprovantes de entrega de obrigações acessórias', risk_tag: 'tax_compliance' },
          { code: 'TRB-03', text: 'Existe controle e acompanhamento dos créditos tributários (PIS, COFINS, ICMS, IPI)?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de créditos tributários', risk_tag: 'tax_credits' },
          { code: 'TRB-04', text: 'A empresa possui passivo tributário mapeado e provisionado?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'mapa de contingências fiscais', risk_tag: 'tax_liabilities' },
          { code: 'TRB-05', text: 'Existe planejamento tributário com estratégias de elisão fiscal legais?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de planejamento tributário', risk_tag: 'tax_planning' },
          { code: 'TRB-06', text: 'As notas fiscais de entrada e saída são conferidas e conciliadas sistematicamente?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de conciliação de notas fiscais', risk_tag: 'tax_invoice_reconciliation' },
          { code: 'TRB-07', text: 'A empresa possui certidão negativa de débitos (CND) federal, estadual e municipal válida?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'CNDs válidas emitidas recentemente', risk_tag: 'tax_cnd' },
          // SETORIAL
          { code: 'TRB-S01', text: 'A empresa utiliza os benefícios fiscais rurais disponíveis (ITR, funrural, ICMS agro)?', weight: 2, sector_tags: ['agriculture', 'livestock', 'agro_livestock'], sector_type: 'sector', evidence_hint: 'aproveitamento de benefícios fiscais rurais', risk_tag: 'agro_tax_benefits' },
          { code: 'TRB-S02', text: 'Existe controle e aproveitamento do crédito de ICMS nas aquisições de insumos agrícolas?', weight: 2, sector_tags: ['agro_industry', 'input_retail'], sector_type: 'sector', evidence_hint: 'controle de crédito de ICMS de insumos', risk_tag: 'agro_icms_credit' },
        ],
        checklist: [
          { item_id: 'trb_chk_1', label: 'Certidão Negativa de Débitos federal (CND)', required: true, order: 1 },
          { item_id: 'trb_chk_2', label: 'Comprovantes de entrega do SPED Fiscal e ECF', required: true, order: 2 },
        ]
      },

      // ─────────────────────────────────────────────
      // 6. JURÍDICO
      // ─────────────────────────────────────────────
      {
        key: 'juridico',
        name: 'Jurídico',
        questions: [
          { code: 'JUR-01', text: 'O contrato social ou estatuto está atualizado e registrado adequadamente?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'contrato social atualizado na JUCEG/JUCESP', risk_tag: 'legal_contract' },
          { code: 'JUR-02', text: 'A empresa possui passivo trabalhista mapeado e provisionado?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de contingências trabalhistas', risk_tag: 'legal_labor_liabilities' },
          { code: 'JUR-03', text: 'Os contratos comerciais relevantes são formalizados por escrito e revisados juridicamente?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'contratos assinados com clientes e fornecedores', risk_tag: 'legal_contracts_commercial' },
          { code: 'JUR-04', text: 'A empresa possui licenças e alvarás de funcionamento válidos?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'alvará de funcionamento municipal válido', risk_tag: 'legal_licenses' },
          { code: 'JUR-05', text: 'Existe acordo de sócios ou shareholders agreement formalizando direitos e obrigações?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'acordo de sócios assinado', risk_tag: 'legal_shareholders_agreement' },
          { code: 'JUR-06', text: 'As obrigações trabalhistas (CLT, eSocial, FGTS) são cumpridas regularmente?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'GFIP, eSocial e folha de pagamento regularizados', risk_tag: 'legal_labor_compliance' },
          { code: 'JUR-07', text: 'A propriedade intelectual (marcas, patentes) está registrada e protegida?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'certificado de registro de marca no INPI', risk_tag: 'legal_ip' },
          // SETORIAL
          { code: 'JUR-S01', text: 'A escritura ou arrendamento das propriedades rurais está regularizado (CAR, ITR)?', weight: 3, sector_tags: ['agriculture', 'livestock', 'agro_livestock'], sector_type: 'sector', evidence_hint: 'CAR e escritura ou contrato de arrendamento', risk_tag: 'agro_land_legal' },
          { code: 'JUR-S02', text: 'Existem contratos formais de arrendamento de terras com cláusulas de atualização?', weight: 2, sector_tags: ['agriculture', 'agro_livestock'], sector_type: 'sector', evidence_hint: 'contratos de arrendamento assinados', risk_tag: 'agro_lease_contracts' },
          { code: 'JUR-S03', text: 'Os contratos de fornecimento de insumos e defensivos são formalizados com garantias?', weight: 2, sector_tags: ['input_retail'], sector_type: 'sector', evidence_hint: 'contratos de fornecimento assinados', risk_tag: 'retail_supply_contracts' },
        ],
        checklist: [
          { item_id: 'jur_chk_1', label: 'Contrato social atualizado (últimos 2 anos)', required: true, order: 1 },
          { item_id: 'jur_chk_2', label: 'Alvará de funcionamento válido', required: true, order: 2 },
          { item_id: 'jur_chk_3', label: 'Relatório de contingências jurídicas', required: false, order: 3 },
        ]
      },

      // ─────────────────────────────────────────────
      // 7. OPERACIONAL
      // ─────────────────────────────────────────────
      {
        key: 'operacional',
        name: 'Operacional',
        questions: [
          { code: 'OPR-01', text: 'Os processos operacionais críticos estão documentados em procedimentos (SOPs)?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'manual de procedimentos operacionais', risk_tag: 'ops_sop' },
          { code: 'OPR-02', text: 'Existe indicadores operacionais (KPIs) monitorados com periodicidade definida?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'dashboard de KPIs operacionais', risk_tag: 'ops_kpis' },
          { code: 'OPR-03', text: 'A empresa possui gestão de fornecedores com critérios de qualificação e avaliação?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'cadastro e avaliação de fornecedores', risk_tag: 'ops_suppliers' },
          { code: 'OPR-04', text: 'Existe planejamento formal de capacidade produtiva e gestão de gargalos?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de capacidade produtiva', risk_tag: 'ops_capacity' },
          { code: 'OPR-05', text: 'Há gestão formal de estoque com inventário periódico e controle de giro?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de giro de estoque', risk_tag: 'ops_inventory' },
          { code: 'OPR-06', text: 'Existe plano de continuidade de negócios ou contingência operacional?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'plano de contingência documentado', risk_tag: 'ops_continuity' },
          // SETORIAL
          { code: 'OPR-S01', text: 'Existe planejamento formal de safra com definição de culturas, metas e insumos necessários?', weight: 3, sector_tags: ['agriculture', 'agro_livestock'], sector_type: 'sector', evidence_hint: 'plano de safra aprovado', risk_tag: 'agro_harvest_plan' },
          { code: 'OPR-S02', text: 'O ciclo produtivo do rebanho (reprodução, engorda, abate) é planejado e monitorado?', weight: 3, sector_tags: ['livestock', 'agro_livestock'], sector_type: 'sector', evidence_hint: 'controle zootécnico do rebanho', risk_tag: 'livestock_cycle_management' },
          { code: 'OPR-S03', text: 'Existe controle formal do processo industrial e rastreabilidade de insumos e produtos?', weight: 3, sector_tags: ['agro_industry'], sector_type: 'sector', evidence_hint: 'sistema de rastreabilidade industrial', risk_tag: 'agro_industry_traceability' },
          { code: 'OPR-S04', text: 'Há controle de estoque de insumos agrícolas por categoria e validade?', weight: 2, sector_tags: ['input_retail'], sector_type: 'sector', evidence_hint: 'relatório de estoque por validade', risk_tag: 'retail_stock_expiry' },
          { code: 'OPR-S05', text: 'O manejo de aplicação de defensivos e fertilizantes é registrado formalmente por talhão?', weight: 2, sector_tags: ['agriculture', 'agro_livestock'], sector_type: 'sector', evidence_hint: 'caderno de campo ou registro de aplicação', risk_tag: 'agro_field_records' },
        ],
        checklist: [
          { item_id: 'opr_chk_1', label: 'Manual de procedimentos operacionais (SOPs)', required: false, order: 1 },
          { item_id: 'opr_chk_2', label: 'Relatório de KPIs operacionais (últimos 3 meses)', required: true, order: 2 },
        ]
      },

      // ─────────────────────────────────────────────
      // 8. SISTEMAS
      // ─────────────────────────────────────────────
      {
        key: 'sistemas',
        name: 'Sistemas',
        questions: [
          { code: 'SIS-01', text: 'A empresa possui sistema de gestão (ERP, CRM ou similar) implantado e em uso?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'contrato ou licença do sistema de gestão', risk_tag: 'sys_erp' },
          { code: 'SIS-02', text: 'Os sistemas utilizados são integrados entre si (financeiro, contábil, comercial, estoque)?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'diagrama de integração de sistemas', risk_tag: 'sys_integration' },
          { code: 'SIS-03', text: 'Existe política formal de segurança da informação e proteção de dados (LGPD)?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'política de segurança da informação', risk_tag: 'sys_security' },
          { code: 'SIS-04', text: 'Os backups de dados são realizados com frequência definida e testados periodicamente?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'política de backup e log de execução', risk_tag: 'sys_backup' },
          { code: 'SIS-05', text: 'Existe controle de acesso por perfil de usuário nos sistemas críticos?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'matriz de perfis de acesso', risk_tag: 'sys_access_profiles' },
          { code: 'SIS-06', text: 'As licenças de software são regularizadas e mantidas atualizadas?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'inventário de licenças de software', risk_tag: 'sys_licenses' },
          { code: 'SIS-07', text: 'A empresa possui suporte técnico contratado para os sistemas críticos?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'contrato de suporte técnico', risk_tag: 'sys_support' },
          // SETORIAL
          { code: 'SIS-S01', text: 'Existe sistema de gestão agrícola (ERP rural, gestão de safra) integrado à operação?', weight: 2, sector_tags: ['agriculture', 'agro_livestock'], sector_type: 'sector', evidence_hint: 'sistema de gestão agrícola em uso', risk_tag: 'agro_erp' },
          { code: 'SIS-S02', text: 'Há uso de tecnologia de precisão (drones, sensores, telemétrica) integrado ao planejamento?', weight: 2, sector_tags: ['agriculture', 'agro_livestock', 'agro_industry'], sector_type: 'sector', evidence_hint: 'relatório de agricultura de precisão', risk_tag: 'agro_precision_tech' },
          { code: 'SIS-S03', text: 'O sistema de gestão de estoque de insumos é integrado ao financeiro e ao fiscal?', weight: 2, sector_tags: ['input_retail'], sector_type: 'sector', evidence_hint: 'integração ERP estoque-financeiro-fiscal', risk_tag: 'retail_erp_integration' },
        ],
        checklist: [
          { item_id: 'sis_chk_1', label: 'Contrato ou licença do ERP/sistema de gestão', required: true, order: 1 },
          { item_id: 'sis_chk_2', label: 'Política de segurança da informação e LGPD', required: false, order: 2 },
        ]
      },
    ],

    // ─────────────────────────────────────────────
    // CRUZAMENTOS MQE
    // ─────────────────────────────────────────────
    crossings: [
      {
        key: 'GxF', name: 'Governança × Financeiro', dim_a: 'governanca', dim_b: 'financeiro',
        mqe_questions: [
          { code: 'GxF-01', text: 'As decisões de investimento e desinvestimento passam por aprovação formal da governança?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'ata de aprovação de investimentos', risk_tag: 'gxf_investment_governance' },
          { code: 'GxF-02', text: 'Os relatórios financeiros são apreciados formalmente pela instância de governança?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'atas de reunião com análise financeira', risk_tag: 'gxf_financial_review' },
          { code: 'GxF-03', text: 'O orçamento anual é aprovado pela instância de governança?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'ata de aprovação do orçamento', risk_tag: 'gxf_budget_approval' },
          { code: 'GxF-04', text: 'A separação PF/PJ é supervisionada e monitorada pela governança?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'política de pro-labore e retiradas aprovada', risk_tag: 'gxf_pf_pj_oversight' },
          { code: 'GxF-05', text: 'Os limites de endividamento são definidos pela governança e respeitados pela gestão financeira?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'política de endividamento aprovada', risk_tag: 'gxf_debt_limits' },
        ]
      },
      {
        key: 'GxC', name: 'Governança × Controles', dim_a: 'governanca', dim_b: 'controles_internos',
        mqe_questions: [
          { code: 'GxC-01', text: 'A instância de governança supervisiona a efetividade dos controles internos?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'ata com análise de relatório de controles', risk_tag: 'gxc_ci_oversight' },
          { code: 'GxC-02', text: 'A política de alçadas é aprovada pela governança e atualizada periodicamente?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'política de alçadas com aprovação societária', risk_tag: 'gxc_approval_policy' },
          { code: 'GxC-03', text: 'Relatórios de auditoria interna são encaminhados e discutidos na instância de governança?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'ata com apreciação de relatório de auditoria', risk_tag: 'gxc_audit_reporting' },
          { code: 'GxC-04', text: 'A segregação de funções entre sócios e gestores operacionais é formalizada e monitorada?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'organograma com segregação clara de funções', risk_tag: 'gxc_segregation' },
          { code: 'GxC-05', text: 'A matriz de riscos da empresa é revisada e aprovada pela governança anualmente?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'matriz de riscos aprovada na reunião de governança', risk_tag: 'gxc_risk_matrix' },
        ]
      },
      {
        key: 'FxO', name: 'Financeiro × Operacional', dim_a: 'financeiro', dim_b: 'operacional',
        mqe_questions: [
          { code: 'FxO-01', text: 'O custo operacional é apurado e integrado ao fluxo de caixa com frequência mensal?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'DRE gerencial mensal com custo operacional', risk_tag: 'fxo_operational_cost' },
          { code: 'FxO-02', text: 'O planejamento operacional (produção, safra, rebanho) é compatível com a capacidade financeira?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'plano operacional validado financeiramente', risk_tag: 'fxo_financial_capacity' },
          { code: 'FxO-03', text: 'Os investimentos operacionais (máquinas, equipamentos, infraestrutura) são planejados no orçamento?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'orçamento de capex aprovado', risk_tag: 'fxo_capex_planning' },
          { code: 'FxO-04', text: 'O giro de estoque operacional é monitorado em relação ao impacto no fluxo de caixa?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de giro de estoque x caixa', risk_tag: 'fxo_stock_cashflow' },
          { code: 'FxO-05', text: 'A rentabilidade por linha de negócio ou atividade é calculada e utilizada para decisão?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'DRE por centro de custo ou atividade', risk_tag: 'fxo_profitability_by_unit' },
        ]
      },
      {
        key: 'TxJ', name: 'Tributário × Jurídico', dim_a: 'tributario', dim_b: 'juridico',
        mqe_questions: [
          { code: 'TxJ-01', text: 'As estratégias de planejamento tributário são revisadas juridicamente antes da implementação?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'parecer jurídico sobre planejamento tributário', risk_tag: 'txj_tax_legal_review' },
          { code: 'TxJ-02', text: 'As contingências tributárias e jurídicas são provisionadas de forma integrada?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de contingências fiscal e jurídica consolidado', risk_tag: 'txj_contingency' },
          { code: 'TxJ-03', text: 'A estrutura societária é revisada periodicamente do ponto de vista tributário e jurídico?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'análise de holding ou estrutura societária', risk_tag: 'txj_corporate_structure' },
          { code: 'TxJ-04', text: 'Os contratos comerciais são avaliados do ponto de vista dos reflexos tributários?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'contratos com cláusula de análise tributária', risk_tag: 'txj_contract_tax' },
          { code: 'TxJ-05', text: 'A empresa monitora mudanças na legislação tributária e adapta contratos e processos?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'boletim ou alerta de atualização legal', risk_tag: 'txj_legislative_monitoring' },
        ]
      },
      {
        key: 'CtbxF', name: 'Contábil × Financeiro', dim_a: 'contabil', dim_b: 'financeiro',
        mqe_questions: [
          { code: 'CtbxF-01', text: 'A conciliação entre o fluxo de caixa gerencial e as demonstrações contábeis é realizada mensalmente?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de conciliação caixa x contabilidade', risk_tag: 'ctbxf_reconciliation' },
          { code: 'CtbxF-02', text: 'A contabilidade fornece informações tempestivas para a gestão financeira?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'balancetes mensais entregues até o dia 15', risk_tag: 'ctbxf_timeliness' },
          { code: 'CtbxF-03', text: 'Os resultados contábeis e financeiros gerenciais são comparados e as divergências explicadas?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de divergências contábil x financeiro', risk_tag: 'ctbxf_divergences' },
          { code: 'CtbxF-04', text: 'Os critérios de reconhecimento de receitas e despesas são consistentes entre contabilidade e gestão financeira?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'política de reconhecimento de receitas', risk_tag: 'ctbxf_revenue_recognition' },
          { code: 'CtbxF-05', text: 'As provisões contábeis (devedores duvidosos, férias, 13º) impactam o planejamento financeiro?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'provisões contábeis refletidas no orçamento financeiro', risk_tag: 'ctbxf_provisions' },
        ]
      },
      {
        key: 'SxC', name: 'Sistemas × Controles', dim_a: 'sistemas', dim_b: 'controles_internos',
        mqe_questions: [
          { code: 'SxC-01', text: 'Os sistemas de informação suportam os controles internos (logs, aprovações eletrônicas, trilha de auditoria)?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'log de auditoria do sistema de gestão', risk_tag: 'sxc_it_controls' },
          { code: 'SxC-02', text: 'Os perfis de acesso nos sistemas refletem a segregação de funções definida pelos controles internos?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'matriz de perfis x funções', risk_tag: 'sxc_access_segregation' },
          { code: 'SxC-03', text: 'Existe controle de mudanças nos sistemas que preserve a integridade dos controles internos?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'política de gestão de mudanças de sistemas', risk_tag: 'sxc_change_control' },
          { code: 'SxC-04', text: 'Os relatórios gerados pelos sistemas são conciliados com os registros manuais periodicamente?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'conciliação sistema x registros manuais', risk_tag: 'sxc_system_reconciliation' },
          { code: 'SxC-05', text: 'A empresa realiza testes periódicos de segurança e vulnerabilidade dos sistemas?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de pentest ou avaliação de segurança', risk_tag: 'sxc_security_testing' },
        ]
      },
      {
        key: 'GxO', name: 'Governança × Operacional', dim_a: 'governanca', dim_b: 'operacional',
        mqe_questions: [
          { code: 'GxO-01', text: 'As metas operacionais são definidas com base nas diretrizes estratégicas aprovadas pela governança?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'cascateamento de metas estratégicas para operacional', risk_tag: 'gxo_strategic_alignment' },
          { code: 'GxO-02', text: 'Os resultados operacionais são reportados regularmente à instância de governança?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório operacional apresentado na reunião de governança', risk_tag: 'gxo_ops_reporting' },
          { code: 'GxO-03', text: 'As decisões de expansão ou mudança de mix de produtos passam pela aprovação da governança?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'ata de aprovação de novos projetos operacionais', risk_tag: 'gxo_expansion_approval' },
          { code: 'GxO-04', text: 'Existe alinhamento entre o planejamento operacional e os objetivos estratégicos da empresa?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'BSC ou plano de ação alinhado ao estratégico', risk_tag: 'gxo_ops_strategy_alignment' },
          { code: 'GxO-05', text: 'A gestão de riscos operacionais é reportada à governança com ações corretivas definidas?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de riscos operacionais para governança', risk_tag: 'gxo_operational_risk_reporting' },
        ]
      },
      {
        key: 'GxJ', name: 'Governança × Jurídico', dim_a: 'governanca', dim_b: 'juridico',
        mqe_questions: [
          { code: 'GxJ-01', text: 'O contrato social reflete adequadamente a estrutura de governança definida pelos sócios?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'contrato social alinhado à estrutura de governança', risk_tag: 'gxj_contract_governance' },
          { code: 'GxJ-02', text: 'Alterações societárias (entrada/saída de sócios, mudança de objeto) passam por processo formal de governança?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'ata de aprovação de alterações societárias', risk_tag: 'gxj_corporate_changes' },
          { code: 'GxJ-03', text: 'As obrigações legais (renovação de licenças, certidões) são monitoradas pela governança?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'calendário de obrigações legais monitorado', risk_tag: 'gxj_legal_obligations' },
          { code: 'GxJ-04', text: 'O acordo de sócios é revisado e atualizado periodicamente pela governança?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'ata de revisão do acordo de sócios', risk_tag: 'gxj_shareholders_review' },
          { code: 'GxJ-05', text: 'As contingências jurídicas são comunicadas tempestivamente à instância de governança?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatório de contingências jurídicas para governança', risk_tag: 'gxj_legal_contingency_reporting' },
        ]
      },
      {
        key: 'FxT', name: 'Financeiro × Tributário', dim_a: 'financeiro', dim_b: 'tributario',
        mqe_questions: [
          { code: 'FxT-01', text: 'O impacto tributário é considerado no planejamento financeiro e no fluxo de caixa?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'fluxo de caixa com projeção de tributos', risk_tag: 'fxt_tax_cashflow' },
          { code: 'FxT-02', text: 'As antecipações de tributos (IRPJ, CSLL estimativa) são planejadas no fluxo de caixa?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'projeção de DARF mensais no fluxo de caixa', risk_tag: 'fxt_tax_anticipation' },
          { code: 'FxT-03', text: 'Os créditos tributários são controlados e utilizados para redução do desembolso financeiro?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'controle de aproveitamento de créditos tributários', risk_tag: 'fxt_tax_credits_use' },
          { code: 'FxT-04', text: 'Os parcelamentos tributários (REFIS, PERT) são monitorados e refletidos no passivo financeiro?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'controle de parcelamentos tributários no passivo', risk_tag: 'fxt_tax_installments' },
          { code: 'FxT-05', text: 'A escolha do regime tributário considera o impacto sobre o resultado financeiro líquido?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'simulação regime tributário x resultado financeiro', risk_tag: 'fxt_tax_regime_financial' },
        ]
      },
      {
        key: 'SxO', name: 'Sistemas × Operacional', dim_a: 'sistemas', dim_b: 'operacional',
        mqe_questions: [
          { code: 'SxO-01', text: 'Os sistemas de gestão suportam e automatizam os processos operacionais críticos?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'módulos do ERP cobrindo processos operacionais chave', risk_tag: 'sxo_ops_automation' },
          { code: 'SxO-02', text: 'Os dados operacionais capturados nos sistemas são confiáveis e utilizados para gestão?', weight: 3, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'relatórios operacionais extraídos do sistema', risk_tag: 'sxo_data_reliability' },
          { code: 'SxO-03', text: 'Existem alertas e dashboards sistêmicos para monitoramento operacional em tempo real?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'dashboard operacional com KPIs em tempo real', risk_tag: 'sxo_realtime_dashboard' },
          { code: 'SxO-04', text: 'O módulo de estoque do sistema está integrado ao processo operacional de compras e vendas?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'integração compras-estoque-vendas no ERP', risk_tag: 'sxo_stock_integration' },
          { code: 'SxO-05', text: 'Os sistemas utilizados na operação recebem suporte e atualizações regulares?', weight: 2, sector_tags: ['all'], sector_type: 'core', evidence_hint: 'contrato de suporte e histórico de atualizações', risk_tag: 'sxo_system_maintenance' },
        ]
      },
    ]
  };

  return Response.json({
    bank,
    version_code: 'FAL v1.0',
    notes: 'Banco oficial FAL® — 8 dimensões IFME + 10 cruzamentos MQE. Pronto para importar via importMethodQuestions.',
    summary: {
      dimensions: bank.dimensions.length,
      total_ifme_questions: bank.dimensions.reduce((s, d) => s + d.questions.length, 0),
      core_questions: bank.dimensions.reduce((s, d) => s + d.questions.filter(q => q.sector_type === 'core').length, 0),
      sector_questions: bank.dimensions.reduce((s, d) => s + d.questions.filter(q => q.sector_type === 'sector').length, 0),
      total_mqe_questions: bank.crossings.reduce((s, c) => s + c.mqe_questions.length, 0),
      crossings: bank.crossings.length,
    }
  });
});