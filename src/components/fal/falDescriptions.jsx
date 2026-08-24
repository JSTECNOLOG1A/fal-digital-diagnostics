/**
 * falDescriptions.js
 * =====================================================================
 * Catálogo de descrições curtas para dimensões e subdimensões do FAL.
 * Usado em tooltips, painéis de ajuda e apêndice do PDF.
 * =====================================================================
 */

export const DIMENSION_DESCRIPTIONS = {
  governanca: {
    short: 'Avalia a estrutura de poder e decisão da empresa: papéis definidos, processo decisório formalizado, gestão de riscos e transparência com sócios.',
    report: 'A dimensão de Governança avalia o grau de maturidade das estruturas de controle e decisão da empresa. Inclui a separação entre propriedade e gestão, a existência de instâncias formais de deliberação (conselhos, comitês), a qualidade do processo decisório e os mecanismos de transparência e prestação de contas para sócios e partes interessadas.',
  },
  juridico: {
    short: 'Verifica a regularidade societária, contratos operacionais, conformidade ambiental e fundiária, riscos trabalhistas e contingências jurídicas.',
    report: 'A dimensão Jurídica / Societária avalia a integridade dos documentos constitutivos da empresa, a solidez dos contratos rurais, comerciais e de prestação de serviços, a regularidade fundiária e ambiental das propriedades, e o gerenciamento das contingências trabalhistas e fiscais. É crítica para a sustentabilidade legal do negócio.',
  },
  controles_internos: {
    short: 'Mede a existência e eficácia dos controles sobre compras, estoques, folha, tesouraria, receitas e ativos, com foco em segregação de funções.',
    report: 'Os Controles Internos abrangem os mecanismos de verificação e salvaguarda que protegem os ativos da empresa e garantem a confiabilidade das informações operacionais. Avaliamos a formalização de processos, segregação de funções, controle de estoques, tesouraria, folha de pagamento e gestão do imobilizado.',
  },
  financeiro: {
    short: 'Analisa o planejamento financeiro, gestão de caixa, estrutura de capital, nível de endividamento e relacionamento com instituições bancárias.',
    report: 'A dimensão Financeira avalia a capacidade da empresa de planejar, controlar e otimizar seus recursos financeiros. Inclui a qualidade do planejamento e orçamento, gestão de caixa e liquidez, estrutura de financiamento, gestão do endividamento bancário e qualidade do relacionamento com instituições de crédito.',
  },
  contabil: {
    short: 'Avalia a organização contábil, qualidade das demonstrações financeiras, aderência às normas contábeis (CPC/NBC TG) e tempestividade dos fechamentos.',
    report: 'A dimensão Contábil avalia a qualidade e confiabilidade das informações contábeis produzidas pela empresa. Abrange a organização do plano de contas, tempestividade dos fechamentos, qualidade das demonstrações financeiras (Balanço, DRE, DFC) e aderência às normas contábeis vigentes (CPCs / NBC TG).',
  },
  tributario: {
    short: 'Examina o enquadramento tributário, apuração de tributos, cumprimento de obrigações acessórias e exposição a riscos e contingências fiscais.',
    report: 'A dimensão Fiscal / Tributária avalia se a empresa está enquadrada adequadamente no regime tributário, apura corretamente seus tributos (ICMS, PIS/COFINS, IRPJ/CSLL), cumpre suas obrigações acessórias (SPED, ECF, ECD) dentro dos prazos e gerencia adequadamente suas contingências e riscos fiscais.',
  },
  operacional: {
    short: 'Analisa o planejamento produtivo, gestão de insumos, eficiência das operações e gestão de pessoas na ponta operacional.',
    report: 'A dimensão Operacional avalia a eficiência e organização das atividades produtivas da empresa. Inclui o planejamento de safra/produção, gestão e rastreabilidade de insumos, indicadores de produtividade, controle de operações e gestão de pessoas no nível operacional.',
  },
  sistemas: {
    short: 'Avalia a infraestrutura tecnológica, uso de sistemas de gestão (ERP), integração entre plataformas e segurança da informação.',
    report: 'A dimensão de Tecnologia / Sistemas avalia o nível de digitalização e maturidade tecnológica da empresa. Abrange a infraestrutura de conectividade e hardware, a adoção e qualidade de uso de sistemas de gestão (ERP, BI, CRM), a integração entre plataformas e os controles de segurança da informação (backup, controle de acesso, proteção de dados).',
  },
};

export const SUBDIMENSION_DESCRIPTIONS = {
  // GOVERNANÇA
  gov_estrutura_governanca:  'Clareza sobre quem decide o quê, separação entre sócios e gestores, e existência de instâncias formais (conselhos, comitês).',
  gov_processo_decisorio:    'Qualidade das reuniões de gestão, formalização das decisões, planejamento estratégico e acompanhamento de metas.',
  gov_gestao_riscos:         'Capacidade da empresa de identificar, avaliar e mitigar riscos relevantes ao negócio.',
  gov_transparencia:         'Regularidade e qualidade da comunicação com sócios, relatórios gerenciais e registros de decisões.',
  // JURÍDICO
  jur_estrutura_contratual:  'Atualização e solidez do contrato social, acordos societários, registros e poderes outorgados.',
  jur_contratos_rurais:      'Formalização de contratos de arrendamento, parceria agrícola, prestação de serviços rurais e CPR/Barter.',
  jur_contratos_comerciais:  'Solidez dos contratos com fornecedores e clientes, garantias contratuais e instrumentos de crédito.',
  jur_riscos_trabalhistas:   'Conformidade com legislação trabalhista, terceirização rural, controle de jornada e segurança do trabalho.',
  jur_regularidade_fundiaria:'Matrícula de imóveis, CAR, ITR, georreferenciamento e regularidade da posse da terra.',
  jur_regularidade_ambiental:'Licenças ambientais, CAR/APP, reserva legal e conformidade com legislação ambiental.',
  jur_contencioso:           'Mapeamento de processos judiciais em curso, provisões legais e estratégia de gestão de litígios.',
  // CONTROLES INTERNOS
  ci_formalizacao:           'Existência de procedimentos documentados, fluxos de aprovação e registros de execução das atividades.',
  ci_segregacao:             'Separação de funções nos processos críticos: compras, pagamentos, faturamento e contabilização.',
  ci_imobilizado:            'Registro, controle, depreciação e gestão do ciclo de vida de máquinas, equipamentos e imóveis.',
  ci_inventario_ativos:      'Inventário físico periódico, conciliação contábil vs. físico e rastreabilidade dos ativos.',
  ci_estoques:               'Controle de entradas/saídas de insumos e produtos, rastreabilidade e gestão de perdas.',
  ci_compras:                'Processo formal de compras: requisição, cotação, aprovação e conferência de notas fiscais.',
  ci_receitas:               'Registro de vendas, emissão fiscal, controle de recebíveis e gestão de inadimplência.',
  ci_folha:                  'Processos de admissão, controle de jornada, processamento da folha e desligamentos.',
  ci_custos_ativos:          'Apuração de custos por cultura/atividade, apropriação de custos indiretos e formação de ativos agrícolas.',
  ci_endividamento:          'Controle de financiamentos, cronograma de parcelas, garantias financeiras e covenants.',
  ci_tesouraria:             'Gestão de contas a pagar/receber, conciliação bancária e controle de fluxo de caixa.',
  // FINANCEIRO
  fin_planejamento:          'Elaboração e acompanhamento do orçamento anual, planejamento de caixa e análise de investimentos.',
  fin_gestao_caixa:          'Controle diário de caixa, previsibilidade financeira e gestão de liquidez.',
  fin_estrutura_capital:     'Nível de alavancagem, custo da dívida e estrutura de financiamento do negócio.',
  fin_relacionamento_bancario:'Relacionamento com bancos, qualidade da negociação de crédito e diversificação bancária.',
  financas_agro_cpr_barter:  'Uso de instrumentos de financiamento agrícola: CPR, Barter e correlatos.',
  // CONTÁBIL
  cnt_organizacao:           'Qualidade do plano de contas, tempestividade dos lançamentos e integração com sistemas.',
  cnt_demonstracoes:         'Regularidade e qualidade do Balanço Patrimonial, DRE e Demonstração de Fluxo de Caixa.',
  cnt_compliance:            'Aderência às normas contábeis (CPC/NBC TG), documentação suporte e revisões periódicas.',
  ativo_biologico_cpc29:     'Mensuração e evidenciação de ativos biológicos conforme CPC 29 / IAS 41.',
  // TRIBUTÁRIO
  trib_enquadramento:        'Adequação do regime fiscal adotado e qualidade do planejamento tributário.',
  trib_apuracao:             'Apuração correta de ICMS, PIS/COFINS, IRPJ/CSLL e demais tributos incidentes.',
  trib_obrigacoes:           'Cumprimento de obrigações acessórias: SPED, ECF, ECD, declarações e prazos.',
  trib_riscos:               'Mapeamento de contingências fiscais, autos de infração e provisões tributárias.',
  // OPERACIONAL
  op_planejamento:           'Planejamento de safra, área e insumos com antecedência adequada.',
  op_insumos:                'Compras, controle de estoque e armazenagem de insumos agrícolas.',
  op_producao:               'Indicadores de produtividade, eficiência operacional e controle das operações de campo.',
  op_pessoas:                'Estrutura da equipe operacional, treinamentos e segurança do trabalho.',
  // SISTEMAS
  sis_infraestrutura:        'Conectividade, hardware disponível e qualidade do suporte técnico.',
  sis_sistemas_gestao:       'Adoção e uso do ERP, integração entre sistemas e confiabilidade dos dados.',
  sis_seguranca:             'Política de backup, controle de acesso e proteção de dados sensíveis.',
};

/** Retorna descrição curta da dimensão */
export function getDimensionDescription(dimKey) {
  return DIMENSION_DESCRIPTIONS[dimKey]?.short || null;
}

/** Retorna descrição para o relatório da dimensão */
export function getDimensionReportDescription(dimKey) {
  return DIMENSION_DESCRIPTIONS[dimKey]?.report || null;
}

/** Retorna descrição curta da subdimensão */
export function getSubdimDescription(subdimKey) {
  return SUBDIMENSION_DESCRIPTIONS[subdimKey] || null;
}