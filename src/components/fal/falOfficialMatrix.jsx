/**
 * falOfficialMatrix.js
 * =====================================================================
 * FONTE ÚNICA DA VERDADE — Matriz Oficial do Método FAL
 *
 * Chaves internas (dimension_key) em PORTUGUÊS — padrão do sistema.
 * Labels de UI também em português.
 * =====================================================================
 */

// ─── DIMENSÕES OFICIAIS ────────────────────────────────────────────────────────
export const FAL_DIMENSIONS = [
  { key: 'governanca',         label: 'Governança',              order: 1 },
  { key: 'juridico',           label: 'Jurídico / Societário',   order: 2 },
  { key: 'controles_internos', label: 'Controles Internos',      order: 3 },
  { key: 'financeiro',         label: 'Financeiro',              order: 4 },
  { key: 'contabil',           label: 'Contábil',                order: 5 },
  { key: 'tributario',         label: 'Fiscal / Tributário',     order: 6 },
  { key: 'operacional',        label: 'Operacional',             order: 7 },
  { key: 'sistemas',           label: 'Tecnologia / Sistemas',   order: 8 },
];

export const FAL_DIMENSION_KEYS = FAL_DIMENSIONS.map(d => d.key);

export const FAL_DIMENSION_LABELS = Object.fromEntries(
  FAL_DIMENSIONS.map(d => [d.key, d.label])
);

// ─── MATRIZ DE APLICABILIDADE POR NÍVEL ───────────────────────────────────────
export const DIMENSION_APPLICABILITY = {
  group: {
    governanca: true, juridico: true, controles_internos: false, financeiro: false,
    contabil: false, tributario: false, operacional: false, sistemas: false
  },
  company: {
    governanca: true, juridico: true, controles_internos: true, financeiro: true,
    contabil: true, tributario: true, operacional: true, sistemas: true
  },
  unit: {
    governanca: false, juridico: false, controles_internos: true, financeiro: true,
    contabil: true, tributario: true, operacional: true, sistemas: true
  },
};

export const DIMENSION_MATRIX = {
  group:   { required: ['governanca', 'juridico'], optional: ['controles_internos', 'financeiro', 'contabil', 'tributario', 'operacional', 'sistemas'] },
  company: { required: ['governanca', 'juridico', 'controles_internos', 'financeiro', 'contabil', 'tributario', 'operacional', 'sistemas'], optional: [] },
  unit:    { required: ['controles_internos', 'financeiro', 'contabil', 'tributario', 'operacional', 'sistemas'], optional: ['governanca', 'juridico'] },
};

// ─── SUBDIMENSÕES OFICIAIS ─────────────────────────────────────────────────────
export const FAL_SUBDIMENSIONS = [
  // ── GOVERNANÇA ──
  { dimension_key: 'governanca',         key: 'gov_estrutura_governanca',      label: 'Estrutura de Governança',              order: 1 },
  { dimension_key: 'governanca',         key: 'gov_processo_decisorio',        label: 'Processo Decisório',                   order: 2 },
  { dimension_key: 'governanca',         key: 'gov_gestao_riscos',             label: 'Gestão de Riscos',                     order: 3 },
  { dimension_key: 'governanca',         key: 'gov_transparencia',             label: 'Transparência e Prestação de Contas',  order: 4 },

  // ── JURÍDICO ──
  { dimension_key: 'juridico',           key: 'jur_estrutura_contratual',      label: 'Estrutura Contratual e Documentos Societários', order: 1 },
  { dimension_key: 'juridico',           key: 'jur_contratos_rurais',          label: 'Contratos Operacionais Rurais',        order: 2 },
  { dimension_key: 'juridico',           key: 'jur_contratos_comerciais',      label: 'Contratos Comerciais e Garantias',     order: 3 },
  { dimension_key: 'juridico',           key: 'jur_riscos_trabalhistas',       label: 'Riscos Trabalhistas e Terceirização',  order: 4 },
  { dimension_key: 'juridico',           key: 'jur_regularidade_fundiaria',    label: 'Regularidade Fundiária',               order: 5 },
  { dimension_key: 'juridico',           key: 'jur_regularidade_ambiental',    label: 'Regularidade Ambiental',               order: 6 },
  { dimension_key: 'juridico',           key: 'jur_contencioso',               label: 'Contencioso e Contingências',          order: 7 },

  // ── CONTROLES INTERNOS ──
  { dimension_key: 'controles_internos', key: 'ci_formalizacao',               label: 'Formalização de Processos',           order: 1 },
  { dimension_key: 'controles_internos', key: 'ci_segregacao',                 label: 'Segregação de Funções',               order: 2 },
  { dimension_key: 'controles_internos', key: 'ci_imobilizado',                label: 'Gestão de Imobilizado',               order: 3 },
  { dimension_key: 'controles_internos', key: 'ci_inventario_ativos',          label: 'Inventário de Ativos',                order: 4 },
  { dimension_key: 'controles_internos', key: 'ci_estoques',                   label: 'Controle de Estoques',                order: 5 },
  { dimension_key: 'controles_internos', key: 'ci_compras',                    label: 'Compras',                             order: 6 },
  { dimension_key: 'controles_internos', key: 'ci_receitas',                   label: 'Receitas / Faturamento',              order: 7 },
  { dimension_key: 'controles_internos', key: 'ci_folha',                      label: 'Folha (Admissão / Demissão)',          order: 8 },
  { dimension_key: 'controles_internos', key: 'ci_custos_ativos',              label: 'Custos e Formação de Ativos Agrícolas', order: 9 },
  { dimension_key: 'controles_internos', key: 'ci_endividamento',              label: 'Endividamento Bancário e com Terceiros', order: 10 },
  { dimension_key: 'controles_internos', key: 'ci_tesouraria',                 label: 'Tesouraria (Pagamentos e Recebimentos)', order: 11 },

  // ── FINANCEIRO ──
   { dimension_key: 'financeiro',         key: 'fin_planejamento',              label: 'Planejamento Financeiro',              order: 1 },
   { dimension_key: 'financeiro',         key: 'fin_gestao_caixa',              label: 'Gestão de Caixa',                      order: 2 },
   { dimension_key: 'financeiro',         key: 'fin_estrutura_capital',         label: 'Estrutura de Capital',                 order: 3 },
   { dimension_key: 'financeiro',         key: 'fin_relacionamento_bancario',   label: 'Relacionamento Bancário',              order: 4 },
   { dimension_key: 'financeiro',         key: 'financas_agro_cpr_barter',      label: 'Finanças Agrícolas - CPR/Barter',      order: 5 },

  // ── CONTÁBIL ──
   { dimension_key: 'contabil',           key: 'cnt_organizacao',               label: 'Organização Contábil',                 order: 1 },
   { dimension_key: 'contabil',           key: 'cnt_demonstracoes',             label: 'Demonstrações Financeiras',            order: 2 },
   { dimension_key: 'contabil',           key: 'cnt_compliance',                label: 'Compliance Contábil',                  order: 3 },
   { dimension_key: 'contabil',           key: 'ativo_biologico_cpc29',         label: 'Ativo Biológico - CPC 29',             order: 4 },
   { dimension_key: 'contabil',           key: 'organizacao_contabil',          label: 'Organização Contábil (Alt)',           order: 5 },
   { dimension_key: 'contabil',           key: 'compliance_contabil',           label: 'Compliance Contábil (Alt)',            order: 6 },
   { dimension_key: 'contabil',           key: 'demonstracoes_financeiras',     label: 'Demonstrações Financeiras (Alt)',      order: 7 },

  // ── TRIBUTÁRIO ──
  { dimension_key: 'tributario',         key: 'trib_enquadramento',            label: 'Enquadramento Tributário',             order: 1 },
  { dimension_key: 'tributario',         key: 'trib_apuracao',                 label: 'Apuração de Tributos',                 order: 2 },
  { dimension_key: 'tributario',         key: 'trib_obrigacoes',               label: 'Obrigações Acessórias',                order: 3 },
  { dimension_key: 'tributario',         key: 'trib_riscos',                   label: 'Riscos Fiscais',                       order: 4 },

  // ── OPERACIONAL ──
  { dimension_key: 'operacional',        key: 'op_planejamento',               label: 'Planejamento Produtivo',               order: 1 },
  { dimension_key: 'operacional',        key: 'op_insumos',                    label: 'Gestão de Insumos',                    order: 2 },
  { dimension_key: 'operacional',        key: 'op_producao',                   label: 'Gestão da Produção',                   order: 3 },
  { dimension_key: 'operacional',        key: 'op_pessoas',                    label: 'Gestão de Pessoas Operacionais',       order: 4 },

  // ── SISTEMAS ──
  { dimension_key: 'sistemas',           key: 'sis_infraestrutura',            label: 'Infraestrutura Tecnológica',           order: 1 },
  { dimension_key: 'sistemas',           key: 'sis_sistemas_gestao',           label: 'Sistemas de Gestão',                   order: 2 },
  { dimension_key: 'sistemas',           key: 'sis_seguranca',                 label: 'Segurança da Informação',              order: 3 },
];

// ─── CLUSTERS OFICIAIS ─────────────────────────────────────────────────────────
export const FAL_CLUSTERS = [
  // ── GOVERNANÇA > Estrutura de Governança ──
  { subdimension_key: 'gov_estrutura_governanca', key: 'definicao_papeis',        label: 'Definição de Papéis e Responsabilidades', order: 1 },
  { subdimension_key: 'gov_estrutura_governanca', key: 'separacao_propriedade',   label: 'Separação Propriedade × Gestão',          order: 2 },
  { subdimension_key: 'gov_estrutura_governanca', key: 'conselho_comite',         label: 'Conselho ou Comitê Gestor',                order: 3 },
  { subdimension_key: 'gov_estrutura_governanca', key: 'governanca_societaria',   label: 'Governança Familiar / Societária',         order: 4 },
  { subdimension_key: 'gov_processo_decisorio',   key: 'formalizacao_decisoes',   label: 'Formalização de Decisões',                order: 1 },
  { subdimension_key: 'gov_processo_decisorio',   key: 'reunioes_gestao',         label: 'Reuniões de Gestão',                      order: 2 },
  { subdimension_key: 'gov_processo_decisorio',   key: 'planejamento_estrategico',label: 'Planejamento Estratégico',                order: 3 },
  { subdimension_key: 'gov_processo_decisorio',   key: 'acompanhamento_metas',    label: 'Acompanhamento de Metas',                 order: 4 },
  { subdimension_key: 'gov_gestao_riscos',        key: 'identificacao_riscos',    label: 'Identificação de Riscos',                 order: 1 },
  { subdimension_key: 'gov_gestao_riscos',        key: 'avaliacao_impacto',       label: 'Avaliação de Impacto',                    order: 2 },
  { subdimension_key: 'gov_gestao_riscos',        key: 'mitigacao_riscos',        label: 'Estratégias de Mitigação',                order: 3 },
  { subdimension_key: 'gov_gestao_riscos',        key: 'monitoramento_riscos',    label: 'Monitoramento de Riscos',                 order: 4 },
  { subdimension_key: 'gov_transparencia',        key: 'relatorios_gerenciais',   label: 'Relatórios Gerenciais',                   order: 1 },
  { subdimension_key: 'gov_transparencia',        key: 'comunicacao_socios',      label: 'Comunicação com Sócios',                  order: 2 },
  { subdimension_key: 'gov_transparencia',        key: 'registros_decisoes',      label: 'Registros de Decisões',                   order: 3 },
  { subdimension_key: 'gov_transparencia',        key: 'governanca_informacao',   label: 'Governança da Informação',                order: 4 },
  // ── JURÍDICO ──
  { subdimension_key: 'jur_estrutura_contratual', key: 'contrato_social',         label: 'Contrato Social ou Estatuto',             order: 1 },
  { subdimension_key: 'jur_estrutura_contratual', key: 'acordos_societarios',     label: 'Acordos Societários',                     order: 2 },
  { subdimension_key: 'jur_estrutura_contratual', key: 'registros_societarios',   label: 'Registros Societários',                   order: 3 },
  { subdimension_key: 'jur_estrutura_contratual', key: 'procuracoes_poderes',     label: 'Procurações e Poderes',                   order: 4 },
  { subdimension_key: 'jur_contratos_rurais',     key: 'arrendamento',            label: 'Contratos de Arrendamento',               order: 1 },
  { subdimension_key: 'jur_contratos_rurais',     key: 'parceria_agricola',       label: 'Contratos de Parceria Agrícola',          order: 2 },
  { subdimension_key: 'jur_contratos_rurais',     key: 'prestacao_servicos_rural',label: 'Contratos de Prestação de Serviços',      order: 3 },
  { subdimension_key: 'jur_contratos_rurais',     key: 'barter_cpp',              label: 'CPR / Barter',                            order: 4 },
  { subdimension_key: 'jur_contratos_comerciais', key: 'contratos_fornecedores',  label: 'Contratos com Fornecedores',              order: 1 },
  { subdimension_key: 'jur_contratos_comerciais', key: 'contratos_venda',         label: 'Contratos de Venda',                      order: 2 },
  { subdimension_key: 'jur_contratos_comerciais', key: 'garantias_contratuais',   label: 'Garantias Contratuais',                   order: 3 },
  { subdimension_key: 'jur_contratos_comerciais', key: 'avais_fianças',           label: 'Avais e Fianças',                         order: 4 },
  { subdimension_key: 'jur_riscos_trabalhistas',  key: 'compliance_trabalhista',  label: 'Compliance Trabalhista',                  order: 1 },
  { subdimension_key: 'jur_riscos_trabalhistas',  key: 'terceirizacao_rural',     label: 'Terceirização Rural',                     order: 2 },
  { subdimension_key: 'jur_riscos_trabalhistas',  key: 'controle_jornada',        label: 'Controle de Jornada',                     order: 3 },
  { subdimension_key: 'jur_riscos_trabalhistas',  key: 'epis_seguranca',          label: 'EPIs e Segurança',                        order: 4 },
  { subdimension_key: 'jur_regularidade_fundiaria', key: 'matricula_imovel',      label: 'Matrícula de Imóveis',                    order: 1 },
  { subdimension_key: 'jur_regularidade_fundiaria', key: 'posse_uso_terra',       label: 'Posse e Uso da Terra',                    order: 2 },
  { subdimension_key: 'jur_regularidade_fundiaria', key: 'car_itr',               label: 'CAR / ITR',                               order: 3 },
  { subdimension_key: 'jur_regularidade_fundiaria', key: 'geo_rural',             label: 'Georreferenciamento',                     order: 4 },
  { subdimension_key: 'jur_regularidade_ambiental', key: 'licencas_ambientais',   label: 'Licenças Ambientais',                     order: 1 },
  { subdimension_key: 'jur_regularidade_ambiental', key: 'car_app',               label: 'CAR / APP',                               order: 2 },
  { subdimension_key: 'jur_regularidade_ambiental', key: 'reserva_legal',         label: 'Reserva Legal',                           order: 3 },
  { subdimension_key: 'jur_regularidade_ambiental', key: 'conformidade_ambiental',label: 'Conformidade Ambiental',                  order: 4 },
  { subdimension_key: 'jur_contencioso',          key: 'processos_judiciais',     label: 'Processos Judiciais',                     order: 1 },
  { subdimension_key: 'jur_contencioso',          key: 'contingencias_juridicas', label: 'Contingências Jurídicas',                 order: 2 },
  { subdimension_key: 'jur_contencioso',          key: 'provisoes_legais',        label: 'Provisões Legais',                        order: 3 },
  { subdimension_key: 'jur_contencioso',          key: 'gestao_litigios',         label: 'Gestão de Litígios',                      order: 4 },
  // ── CONTROLES INTERNOS ──
  { subdimension_key: 'ci_formalizacao',          key: 'procedimentos_documentados',label: 'Procedimentos Documentados',            order: 1 },
  { subdimension_key: 'ci_formalizacao',          key: 'fluxos_aprovacao',        label: 'Fluxos de Aprovação',                     order: 2 },
  { subdimension_key: 'ci_formalizacao',          key: 'padronizacao_operacional',label: 'Padronização Operacional',                order: 3 },
  { subdimension_key: 'ci_formalizacao',          key: 'registros_execucao',      label: 'Registros de Execução',                   order: 4 },
  { subdimension_key: 'ci_segregacao',            key: 'segregacao_compras',      label: 'Segregação Compras / Aprovação',          order: 1 },
  { subdimension_key: 'ci_segregacao',            key: 'segregacao_pagamentos',   label: 'Segregação Pagamentos / Autorização',     order: 2 },
  { subdimension_key: 'ci_segregacao',            key: 'segregacao_faturamento',  label: 'Segregação Faturamento / Recebimento',    order: 3 },
  { subdimension_key: 'ci_segregacao',            key: 'segregacao_contabil',     label: 'Segregação Contábil / Financeiro',        order: 4 },
  { subdimension_key: 'ci_imobilizado',           key: 'registro_ativos',         label: 'Registro de Ativos',                      order: 1 },
  { subdimension_key: 'ci_imobilizado',           key: 'controle_maquinas',       label: 'Controle de Máquinas e Equipamentos',     order: 2 },
  { subdimension_key: 'ci_imobilizado',           key: 'depreciacao_ativos',      label: 'Depreciação de Ativos',                   order: 3 },
  { subdimension_key: 'ci_imobilizado',           key: 'alienacao_baixa',         label: 'Alienação ou Baixa de Ativos',            order: 4 },
  { subdimension_key: 'ci_inventario_ativos',     key: 'inventario_periodico',    label: 'Inventário Físico Periódico',             order: 1 },
  { subdimension_key: 'ci_inventario_ativos',     key: 'conciliacao_fisico',      label: 'Conciliação Contábil × Físico',           order: 2 },
  { subdimension_key: 'ci_inventario_ativos',     key: 'rastreabilidade_ativos',  label: 'Rastreabilidade de Ativos',               order: 3 },
  { subdimension_key: 'ci_inventario_ativos',     key: 'inventario_equipamentos', label: 'Inventário de Equipamentos',              order: 4 },
  { subdimension_key: 'ci_estoques',              key: 'controle_insumos',        label: 'Controle de Insumos',                     order: 1 },
  { subdimension_key: 'ci_estoques',              key: 'controle_produtos',       label: 'Controle de Produtos',                    order: 2 },
  { subdimension_key: 'ci_estoques',              key: 'perdas_ajustes',          label: 'Perdas e Ajustes',                        order: 3 },
  { subdimension_key: 'ci_estoques',              key: 'rastreabilidade_estoque', label: 'Rastreabilidade de Estoque',              order: 4 },
  { subdimension_key: 'ci_compras',               key: 'processo_formal_compras', label: 'Processo Formal de Compras',              order: 1 },
  { subdimension_key: 'ci_compras',               key: 'cotacao_fornecedores',    label: 'Cotação de Fornecedores',                 order: 2 },
  { subdimension_key: 'ci_compras',               key: 'aprovacao_compras',       label: 'Aprovação de Compras',                    order: 3 },
  { subdimension_key: 'ci_compras',               key: 'conferencia_nf',          label: 'Conferência Pedido × Nota × Entrega',     order: 4 },
  { subdimension_key: 'ci_receitas',              key: 'registro_vendas',         label: 'Registro de Vendas',                      order: 1 },
  { subdimension_key: 'ci_receitas',              key: 'contratos_venda_ci',      label: 'Contratos de Venda',                      order: 2 },
  { subdimension_key: 'ci_receitas',              key: 'emissao_fiscal',          label: 'Emissão Fiscal',                          order: 3 },
  { subdimension_key: 'ci_receitas',              key: 'controle_recebiveis',     label: 'Controle de Recebíveis',                  order: 4 },
  { subdimension_key: 'ci_folha',                 key: 'processo_admissao',       label: 'Processo de Admissão',                    order: 1 },
  { subdimension_key: 'ci_folha',                 key: 'controle_jornada_ci',     label: 'Controle de Jornada',                     order: 2 },
  { subdimension_key: 'ci_folha',                 key: 'processamento_folha',     label: 'Processamento da Folha',                  order: 3 },
  { subdimension_key: 'ci_folha',                 key: 'desligamentos',           label: 'Desligamentos',                           order: 4 },
  { subdimension_key: 'ci_custos_ativos',         key: 'custo_por_cultura',       label: 'Controle de Custos por Cultura',          order: 1 },
  { subdimension_key: 'ci_custos_ativos',         key: 'custos_indiretos',        label: 'Apropriação de Custos Indiretos',         order: 2 },
  { subdimension_key: 'ci_custos_ativos',         key: 'formacao_ativos_agric',   label: 'Formação de Ativos Agrícolas',            order: 3 },
  { subdimension_key: 'ci_custos_ativos',         key: 'rastreabilidade_custos',  label: 'Rastreabilidade de Custos',               order: 4 },
  { subdimension_key: 'ci_endividamento',         key: 'controle_financiamentos', label: 'Controle de Financiamentos',              order: 1 },
  { subdimension_key: 'ci_endividamento',         key: 'cronograma_pagamentos',   label: 'Cronograma de Pagamentos',                order: 2 },
  { subdimension_key: 'ci_endividamento',         key: 'garantias_financeiras',   label: 'Garantias Financeiras',                   order: 3 },
  { subdimension_key: 'ci_endividamento',         key: 'monitoramento_covenants', label: 'Monitoramento de Covenants',              order: 4 },
  { subdimension_key: 'ci_tesouraria',            key: 'contas_a_pagar',          label: 'Contas a Pagar',                          order: 1 },
  { subdimension_key: 'ci_tesouraria',            key: 'contas_a_receber',        label: 'Contas a Receber',                        order: 2 },
  { subdimension_key: 'ci_tesouraria',            key: 'conciliacao_bancaria',    label: 'Conciliação Bancária',                    order: 3 },
  { subdimension_key: 'ci_tesouraria',            key: 'controle_fluxo_caixa',    label: 'Controle de Fluxo de Caixa',              order: 4 },
  // ── FINANCEIRO ──
  { subdimension_key: 'fin_planejamento',         key: 'orcamento_anual',         label: 'Orçamento Anual',                         order: 1 },
  { subdimension_key: 'fin_planejamento',         key: 'planejamento_caixa',      label: 'Planejamento de Caixa',                   order: 2 },
  { subdimension_key: 'fin_planejamento',         key: 'analise_investimentos',   label: 'Análise de Investimentos',                order: 3 },
  { subdimension_key: 'fin_gestao_caixa',         key: 'controle_caixa_diario',   label: 'Controle Diário de Caixa',                order: 1 },
  { subdimension_key: 'fin_gestao_caixa',         key: 'previsibilidade_caixa',   label: 'Previsibilidade Financeira',              order: 2 },
  { subdimension_key: 'fin_gestao_caixa',         key: 'liquidez',                label: 'Liquidez',                                order: 3 },
  { subdimension_key: 'fin_estrutura_capital',    key: 'alavancagem',             label: 'Alavancagem Financeira',                  order: 1 },
  { subdimension_key: 'fin_estrutura_capital',    key: 'custo_divida',            label: 'Custo da Dívida',                         order: 2 },
  { subdimension_key: 'fin_estrutura_capital',    key: 'estrutura_financiamento', label: 'Estrutura de Financiamento',              order: 3 },
  { subdimension_key: 'fin_relacionamento_bancario', key: 'rel_institucional',    label: 'Relacionamento Institucional',            order: 1 },
  { subdimension_key: 'fin_relacionamento_bancario', key: 'negociacao_credito',   label: 'Negociação de Crédito',                   order: 2 },
  { subdimension_key: 'fin_relacionamento_bancario', key: 'diversificacao_bancaria', label: 'Diversificação Bancária',              order: 3 },
  // ── CONTÁBIL ──
  { subdimension_key: 'cnt_organizacao',          key: 'plano_contas',            label: 'Plano de Contas',                         order: 1 },
  { subdimension_key: 'cnt_organizacao',          key: 'tempestividade_contabil', label: 'Tempestividade Contábil',                 order: 2 },
  { subdimension_key: 'cnt_organizacao',          key: 'integracao_sistemas_cnt', label: 'Integração de Sistemas',                  order: 3 },
  { subdimension_key: 'cnt_demonstracoes',        key: 'balanco_patrimonial',     label: 'Balanço Patrimonial',                     order: 1 },
  { subdimension_key: 'cnt_demonstracoes',        key: 'dre',                     label: 'DRE',                                     order: 2 },
  { subdimension_key: 'cnt_demonstracoes',        key: 'fluxo_caixa_cnt',         label: 'Fluxo de Caixa (Demonstração)',           order: 3 },
  { subdimension_key: 'cnt_compliance',           key: 'aderencia_cpc',           label: 'Aderência a CPC',                         order: 1 },
  { subdimension_key: 'cnt_compliance',           key: 'documentacao_suporte',    label: 'Documentação Suporte',                    order: 2 },
  { subdimension_key: 'cnt_compliance',           key: 'revisoes_contabeis',      label: 'Revisões Contábeis',                      order: 3 },
  // ── TRIBUTÁRIO ──
  { subdimension_key: 'trib_enquadramento',       key: 'regime_fiscal',           label: 'Regime Fiscal',                           order: 1 },
  { subdimension_key: 'trib_enquadramento',       key: 'planejamento_tributario', label: 'Planejamento Tributário',                 order: 2 },
  { subdimension_key: 'trib_enquadramento',       key: 'enquadramento_rural',     label: 'Enquadramento Rural',                     order: 3 },
  { subdimension_key: 'trib_apuracao',            key: 'icms',                    label: 'ICMS',                                    order: 1 },
  { subdimension_key: 'trib_apuracao',            key: 'pis_cofins',              label: 'PIS / COFINS',                            order: 2 },
  { subdimension_key: 'trib_apuracao',            key: 'irpj_csll',               label: 'IRPJ / CSLL',                             order: 3 },
  { subdimension_key: 'trib_obrigacoes',          key: 'sped',                    label: 'SPED',                                    order: 1 },
  { subdimension_key: 'trib_obrigacoes',          key: 'declaracoes_fiscais',     label: 'Declarações Fiscais',                     order: 2 },
  { subdimension_key: 'trib_obrigacoes',          key: 'controle_entregas',       label: 'Controle de Entregas',                    order: 3 },
  { subdimension_key: 'trib_riscos',              key: 'contingencias_fiscais',   label: 'Contingências Fiscais',                   order: 1 },
  { subdimension_key: 'trib_riscos',              key: 'autos_infracao',          label: 'Autos de Infração',                       order: 2 },
  { subdimension_key: 'trib_riscos',              key: 'provisoes_tributarias',   label: 'Provisões Tributárias',                   order: 3 },
  // ── OPERACIONAL ──
  { subdimension_key: 'op_planejamento',          key: 'planejamento_safra',      label: 'Planejamento de Safra',                   order: 1 },
  { subdimension_key: 'op_planejamento',          key: 'planejamento_area',       label: 'Planejamento de Área',                    order: 2 },
  { subdimension_key: 'op_planejamento',          key: 'planejamento_insumos',    label: 'Planejamento de Insumos',                 order: 3 },
  { subdimension_key: 'op_insumos',               key: 'compras_insumos',         label: 'Compras de Insumos',                      order: 1 },
  { subdimension_key: 'op_insumos',               key: 'controle_estoque_insumos',label: 'Controle de Estoque',                     order: 2 },
  { subdimension_key: 'op_insumos',               key: 'armazenagem_insumos',     label: 'Armazenagem',                             order: 3 },
  { subdimension_key: 'op_producao',              key: 'produtividade',           label: 'Produtividade',                           order: 1 },
  { subdimension_key: 'op_producao',              key: 'eficiencia_operacional',  label: 'Eficiência Operacional',                  order: 2 },
  { subdimension_key: 'op_producao',              key: 'controle_operacoes',      label: 'Controle de Operações',                   order: 3 },
  { subdimension_key: 'op_pessoas',               key: 'estrutura_equipe',        label: 'Estrutura de Equipe',                     order: 1 },
  { subdimension_key: 'op_pessoas',               key: 'treinamento',             label: 'Treinamento',                             order: 2 },
  { subdimension_key: 'op_pessoas',               key: 'seguranca_trabalho',      label: 'Segurança do Trabalho',                   order: 3 },
  // ── SISTEMAS ──
  { subdimension_key: 'sis_infraestrutura',       key: 'conectividade',           label: 'Conectividade',                           order: 1 },
  { subdimension_key: 'sis_infraestrutura',       key: 'hardware',                label: 'Hardware',                                order: 2 },
  { subdimension_key: 'sis_infraestrutura',       key: 'suporte_tecnico',         label: 'Suporte Técnico',                         order: 3 },
  { subdimension_key: 'sis_sistemas_gestao',      key: 'erp',                     label: 'ERP',                                     order: 1 },
  { subdimension_key: 'sis_sistemas_gestao',      key: 'integracao_sistemas',     label: 'Integração entre Sistemas',               order: 2 },
  { subdimension_key: 'sis_sistemas_gestao',      key: 'confiabilidade_dados',    label: 'Confiabilidade de Dados',                 order: 3 },
  { subdimension_key: 'sis_seguranca',            key: 'backup',                  label: 'Backup',                                  order: 1 },
  { subdimension_key: 'sis_seguranca',            key: 'controle_acesso',         label: 'Controle de Acesso',                      order: 2 },
  { subdimension_key: 'sis_seguranca',            key: 'protecao_dados',          label: 'Proteção de Dados',                       order: 3 },
];

// ─── MAPA DE MIGRAÇÃO EN → PT (para normalizar assessments antigos) ───────────
export const DIM_EN_TO_PT = {
  'governance':        'governanca',
  'legal':             'juridico',
  'internal_controls': 'controles_internos',
  'financial':         'financeiro',
  'accounting':        'contabil',
  'tax':               'tributario',
  'operations':        'operacional',
  'technology':        'sistemas',
};

/** Normaliza dimension_key EN → PT se necessário */
export function normalizeDimKey(key) {
  return DIM_EN_TO_PT[key] || key;
}

// ─── MAPA DE COMPATIBILIDADE: SUBDIMENSÃO LEGADA → OFICIAL ───────────────────
export const SUBDIM_MIGRATION_MAP = {
  // ── Chaves geradas pelo banco de perguntas (formato: dimension_subdim) ──────
  // controles_internos
  'receitas_faturamento':            'ci_receitas',
  'tesouraria':                      'ci_tesouraria',
  'compras':                         'ci_compras',
  'folha':                           'ci_folha',
  'endividamento':                   'ci_endividamento',
  'formalizacao':                    'ci_formalizacao',
  'inventario_ativos':               'ci_inventario_ativos',
  'custos_ativos':                   'ci_custos_ativos',
  // financeiro
   'planejamento_financeiro_fin':     'fin_planejamento',
   'gestao_caixa':                    'fin_gestao_caixa',
   'estrutura_capital':               'fin_estrutura_capital',
   'relacionamento_bancario':         'fin_relacionamento_bancario',
   'financas_agro_cpr_barter':        'financas_agro_cpr_barter',
  // contabil
   'organizacao_contabil':            'organizacao_contabil',
   'demonstracoes_financeiras':       'demonstracoes_financeiras',
   'compliance_contabil':             'compliance_contabil',
   'ativo_biologico_cpc29':           'ativo_biologico_cpc29',
  // tributario
  'enquadramento_tributario':        'trib_enquadramento',
  'apuracao_tributos':               'trib_apuracao',
  'riscos_fiscais_trib':             'trib_riscos',
  // operacional
  'planejamento_produtivo':          'op_planejamento',
  'gestao_insumos_op':               'op_insumos',
  'gestao_producao':                 'op_producao',
  'gestao_pessoas':                  'op_pessoas',
  // sistemas
  'infraestrutura':                  'sis_infraestrutura',
  'sistemas_gestao':                 'sis_sistemas_gestao',
  'seguranca_informacao_sis':        'sis_seguranca',
  // governanca
  'estrutura_governanca':            'gov_estrutura_governanca',
  'processo_decisorio':              'gov_processo_decisorio',
  'gestao_riscos_gov':               'gov_gestao_riscos',
  'transparencia':                   'gov_transparencia',
  // juridico
  'estrutura_contratual':            'jur_estrutura_contratual',
  'contratos_comerciais_jur':        'jur_contratos_comerciais',
  'riscos_trabalhistas':             'jur_riscos_trabalhistas',
  'contencioso':                     'jur_contencioso',

  // ── Chaves legadas originais (mantidas) ────────────────────────────────────
  'governanca_societaria':           'gov_estrutura_governanca',
  'sucessao_continuidade':           'gov_estrutura_governanca',
  'regras_decisao_conflitos':        'gov_processo_decisorio',
  'transparencia_prestacao_contas':  'gov_transparencia',
  'ritos_gestao':                    'gov_processo_decisorio',
  'metas_indicadores':               'gov_processo_decisorio',
  'planejamento_orcamento':          'gov_processo_decisorio',
  'gestao_riscos':                   'gov_gestao_riscos',
  'estrutura_societaria':            'jur_estrutura_contratual',
  'contratos_rurais':                'jur_contratos_rurais',
  'contratos_comerciais':            'jur_contratos_comerciais',
  'garantias_instrumentos':          'jur_contratos_comerciais',
  'compliance_trabalhista':          'jur_riscos_trabalhistas',
  'regularidade_fundiaria':          'jur_regularidade_fundiaria',
  'regularidade_ambiental':          'jur_regularidade_ambiental',
  'litigios_contingencias':          'jur_contencioso',
  'procedimentos_politicas':         'ci_formalizacao',
  'controles_financeiros':           'ci_tesouraria',
  'controles_compras':               'ci_compras',
  'controles_estoque':               'ci_estoques',
  'conciliacoes_auditoria':          'ci_formalizacao',
  'gestao_folha':                    'ci_folha',
  'controle_imobilizado':            'ci_imobilizado',
  'formacao_ativos':                 'ci_custos_ativos',
  'controles_receita':               'ci_receitas',
  'fluxo_caixa':                     'fin_gestao_caixa',
  'endividamento_credito':           'fin_estrutura_capital',
  'rentabilidade_custos':            'fin_planejamento',
  'planejamento_financeiro':         'fin_planejamento',
  'fechamento_contabil':             'cnt_organizacao',
  'qualidade_informacao':            'cnt_organizacao',
  'contabilidade_gerencial':         'cnt_organizacao',
  'conciliacoes_contabeis':          'cnt_demonstracoes',
  'provisoes':                       'cnt_compliance',
  'imobilizado':                     'ci_imobilizado',
  'estoques':                        'cnt_demonstracoes',
  'integracao_erp':                  'cnt_organizacao',
  'metodo_custo':                    'cnt_compliance',
  'rotinas_fiscais':                 'trib_apuracao',
  'gestao_creditos':                 'trib_enquadramento',
  'riscos_fiscais':                  'trib_riscos',
  'obrigacoes_acessorias':           'trib_obrigacoes',
  'planejamento_safra':              'op_planejamento',
  'gestao_insumos':                  'op_insumos',
  'manutencao_maquinas':             'op_producao',
  'produtividade_perdas':            'op_producao',
  'processos_comerciais':            'op_producao',
  'logistica_estoque':               'op_insumos',
  'atendimento_posvenda':            'op_producao',
  'operacao_fiscal_entrega':         'op_producao',
  'erp_integracoes':                 'sis_sistemas_gestao',
  'qualidade_dados':                 'sis_sistemas_gestao',
  'automacao_controles':             'sis_sistemas_gestao',
  'seguranca_informacao':            'sis_seguranca',
};

export const CLUSTER_MIGRATION_MAP = {
  'acordo_socios':                   'acordos_societarios',
  'estatuto_contrato_social':        'contrato_social',
  'estrutura_controle':              'governanca_societaria',
  'plano_sucessao':                  'governanca_societaria',
  'holding_familiar':                'governanca_societaria',
  'continuidade_negocio':            'monitoramento_riscos',
  'alcadas_aprovacao':               'formalizacao_decisoes',
  'resolucao_conflitos':             'formalizacao_decisoes',
  'tag_drag_along':                  'acordos_societarios',
  'relatorio_socios':                'relatorios_gerenciais',
  'auditoria_externa':               'revisoes_contabeis',
  'politica_dividendos':             'comunicacao_socios',
  'reuniao_conselho':                'reunioes_gestao',
  'reuniao_diretoria':               'reunioes_gestao',
  'ata_decisao':                     'registros_decisoes',
  'kpis_estrategicos':               'acompanhamento_metas',
  'painel_gestao':                   'acompanhamento_metas',
  'metas_equipe':                    'acompanhamento_metas',
  'orcamento_anual':                 'orcamento_anual',
  'plano_estrategico':               'planejamento_estrategico',
  'revisao_orcamento':               'orcamento_anual',
  'matriz_riscos':                   'identificacao_riscos',
  'seguros_cobertura':               'mitigacao_riscos',
  'plano_contingencia':              'mitigacao_riscos',
  'holding_operacional':             'contrato_social',
  'capital_social':                  'contrato_social',
  'participacoes':                   'registros_societarios',
  'arrendamento':                    'arrendamento',
  'parceria_agricola':               'parceria_agricola',
  'barter_cpp':                      'barter_cpp',
  'contratos_fornecedores':          'contratos_fornecedores',
  'contratos_clientes':              'contratos_venda',
  'contratos_servicos':              'prestacao_servicos_rural',
  'garantias_reais':                 'garantias_contratuais',
  'cedula_rural':                    'barter_cpp',
  'alienacao_fiduciaria':            'avais_fianças',
  'clt_registro':                    'compliance_trabalhista',
  'esocial':                         'compliance_trabalhista',
  'saude_seguranca':                 'epis_seguranca',
  'car_itr':                         'car_itr',
  'matricula_imovel':                'matricula_imovel',
  'geo_rural':                       'geo_rural',
  'licencas_ambientais':             'licencas_ambientais',
  'reserva_legal':                   'reserva_legal',
  'conformidade_ambiental':          'conformidade_ambiental',
  'passivo_trabalhista':             'contingencias_juridicas',
  'passivo_fiscal':                  'contingencias_juridicas',
  'passivo_ambiental':               'provisoes_legais',
  'matriz_alcadas':                  'fluxos_aprovacao',
  'segregacao_funcoes':              'segregacao_compras',
  'controle_acessos':                'segregacao_faturamento',
  'trilha_auditoria':                'registros_execucao',
  'procedimentos_operacionais':      'procedimentos_documentados',
  'manual_politicas':                'procedimentos_documentados',
  'politica_caixa':                  'controle_fluxo_caixa',
  'politica_despesas':               'contas_a_pagar',
  'conciliacao_bancaria':            'conciliacao_bancaria',
  'aprovacao_pagamento':             'segregacao_pagamentos',
  'controle_caixa':                  'controle_fluxo_caixa',
  'requisicao_compras':              'processo_formal_compras',
  'cotacao_fornecedores':            'cotacao_fornecedores',
  'aprovacao_compras':               'aprovacao_compras',
  'recebimento_materiais':           'conferencia_nf',
  'inventario_fisico':               'inventario_periodico',
  'controle_entradas':               'controle_insumos',
  'controle_saidas':                 'controle_produtos',
  'perdas_quebras':                  'perdas_ajustes',
  'conciliacao_mensal':              'conciliacao_bancaria',
  'auditoria_interna':               'registros_execucao',
  'divergencias':                    'registros_execucao',
  'folha_pagamento':                 'processamento_folha',
  'beneficios':                      'processo_admissao',
  'ponto_jornada':                   'controle_jornada_ci',
  'patrimonio_bens':                 'registro_ativos',
  'depreciacao':                     'depreciacao_ativos',
  'manutencao_ativo':                'controle_maquinas',
  'terras_imoveis':                  'formacao_ativos_agric',
  'culturas_plantacoes':             'formacao_ativos_agric',
  'rebanho':                         'formacao_ativos_agric',
  'faturamento_nota':                'emissao_fiscal',
  'cobranca_recebimento':            'controle_recebiveis',
  'inadimplencia':                   'controle_recebiveis',
  'previsibilidade_caixa':           'previsibilidade_caixa',
  'gestao_caixa_diario':             'controle_caixa_diario',
  'capital_giro':                    'liquidez',
  'estrutura_divida':                'estrutura_financiamento',
  'politica_credito':                'negociacao_credito',
  'relacionamento_banco':            'rel_institucional',
  'garantias_operacoes':             'garantias_financeiras',
  'custo_producao':                  'planejamento_caixa',
  'margem_resultado':                'analise_investimentos',
  'break_even':                      'analise_investimentos',
  'projecao_dre':                    'orcamento_anual',
  'cenarios_financeiros':            'analise_investimentos',
  'investimento_retorno':            'analise_investimentos',
  'balanco_mensal':                  'balanco_patrimonial',
  'dre_mensal':                      'dre',
  'prazo_fechamento':                'tempestividade_contabil',
  'acuracia_lancamentos':            'plano_contas',
  'plano_contas':                    'plano_contas',
  'parametros_contabeis':            'integracao_sistemas_cnt',
  'centro_custo':                    'plano_contas',
  'relatorios_gerenciais':           'dre',
  'contabilidade_custos':            'plano_contas',
  'conciliacao_bancos':              'documentacao_suporte',
  'conciliacao_estoques':            'documentacao_suporte',
  'conciliacao_ativo':               'documentacao_suporte',
  'provisao_ferias':                 'aderencia_cpc',
  'provisao_contingencias':          'aderencia_cpc',
  'provisao_tributos':               'aderencia_cpc',
  'controle_patrimonio':             'balanco_patrimonial',
  'depreciacao_contabil':            'aderencia_cpc',
  'baixa_bens':                      'documentacao_suporte',
  'valorizacao_estoque':             'balanco_patrimonial',
  'peps_custo_medio':                'aderencia_cpc',
  'perdas_contabeis':                'documentacao_suporte',
  'cadastro_maestro':                'integracao_sistemas_cnt',
  'interface_fiscal':                'integracao_sistemas_cnt',
  'conciliacao_erp':                 'integracao_sistemas_cnt',
  'custeio_absorção':                'aderencia_cpc',
  'custeio_variavel':                'aderencia_cpc',
  'custeio_atividade':               'aderencia_cpc',
  'apuracao_impostos':               'irpj_csll',
  'regime_tributario':               'regime_fiscal',
  'icms_ipi':                        'icms',
  'pis_cofins':                      'pis_cofins',
  'creditos_icms':                   'regime_fiscal',
  'creditos_pis_cofins':             'pis_cofins',
  'aproveitamento_creditos':         'planejamento_tributario',
  'passivo_fiscal_est':              'contingencias_fiscais',
  'autuacoes_fiscais':               'autos_infracao',
  'planejamento_trib':               'planejamento_tributario',
  'sped_fiscal':                     'sped',
  'ecf_ecd':                         'declaracoes_fiscais',
  'declaracoes':                     'declaracoes_fiscais',
  'calendario_operacional':          'planejamento_safra',
  'mapa_plantio':                    'planejamento_area',
  'gestao_talhao':                   'planejamento_area',
  'estoque_insumos':                 'controle_estoque_insumos',
  'abastecimento_combustivel':       'armazenagem_insumos',
  'controle_defensivos':             'controle_estoque_insumos',
  'receita_agronomica':              'compras_insumos',
  'plano_manutencao':                'eficiencia_operacional',
  'historico_maquinas':              'controle_operacoes',
  'custo_maquina_hora':              'eficiencia_operacional',
  'producao_colheita':               'produtividade',
  'perdas_processo':                 'eficiencia_operacional',
  'linha_producao':                  'controle_operacoes',
  'venda_contrato':                  'controle_operacoes',
  'politica_preco':                  'controle_operacoes',
  'funil_clientes':                  'controle_operacoes',
  'armazenagem':                     'armazenagem_insumos',
  'transporte_frete':                'armazenagem_insumos',
  'gestao_estoque_pd':               'controle_estoque_insumos',
  'sat_reclamacoes':                 'eficiencia_operacional',
  'garantia_tecnica':                'eficiencia_operacional',
  'nps_cliente':                     'eficiencia_operacional',
  'nfe_documentos':                  'controle_operacoes',
  'conferencia_entrega':             'controle_operacoes',
  'rastreabilidade':                 'controle_operacoes',
  'configuracao_erp':                'erp',
  'integracao_modulos':              'integracao_sistemas',
  'adocao_usuarios':                 'confiabilidade_dados',
  'duplicatas_gaps':                 'confiabilidade_dados',
  'padronizacao_dados':              'confiabilidade_dados',
  'workflow_aprovacao':              'integracao_sistemas',
  'automatizacao_relat':             'confiabilidade_dados',
  'backup_dados':                    'backup',
  'politica_acesso':                 'controle_acesso',
  'protecao_dados':                  'protecao_dados',
  'monitoramento_logs':              'controle_acesso',
};

// ─── LOOKUP HELPERS ───────────────────────────────────────────────────────────

export function getDimensionLabel(dimKey) {
  return FAL_DIMENSION_LABELS[dimKey] || dimKey;
}

export function getSuggestedDimensions(targetType) {
  const matrix = DIMENSION_MATRIX[targetType];
  return matrix ? matrix.required : FAL_DIMENSION_KEYS;
}

export function getAvailableDimensions(targetType) {
  const matrix = DIMENSION_MATRIX[targetType];
  return matrix ? [...matrix.required, ...(matrix.optional || [])] : FAL_DIMENSION_KEYS;
}

export function getOptionalDimensions(targetType) {
  const matrix = DIMENSION_MATRIX[targetType];
  return matrix?.optional || [];
}

export function getSubdimensionsForDimension(dimKey) {
  return FAL_SUBDIMENSIONS
    .filter(s => s.dimension_key === dimKey)
    .sort((a, b) => a.order - b.order);
}

export function getClustersForSubdimension(subdimKey) {
  return FAL_CLUSTERS
    .filter(c => c.subdimension_key === subdimKey)
    .sort((a, b) => a.order - b.order);
}

export function normalizeSubdimKey(subdimKey) {
  if (!subdimKey) return null;
  if (FAL_SUBDIMENSIONS.find(s => s.key === subdimKey)) return subdimKey;
  return SUBDIM_MIGRATION_MAP[subdimKey] || subdimKey;
}

export function normalizeClusterKey(clusterKey) {
  if (!clusterKey) return null;
  if (FAL_CLUSTERS.find(c => c.key === clusterKey)) return clusterKey;
  return CLUSTER_MIGRATION_MAP[clusterKey] || clusterKey;
}

export function getSubdimLabel(subdimKey) {
  const found = FAL_SUBDIMENSIONS.find(s => s.key === subdimKey);
  if (found) return found.label;
  const mapped = SUBDIM_MIGRATION_MAP[subdimKey];
  if (mapped) {
    const mappedFound = FAL_SUBDIMENSIONS.find(s => s.key === mapped);
    if (mappedFound?.label) return mappedFound.label;
  }
  // Fallback pra chaves fora da matriz oficial do FAL 8D (ex.: subdimensões
  // de outro diagnóstico, como a Reforma Tributária 8D) — humaniza em vez de
  // mostrar o slug cru.
  if (!subdimKey) return subdimKey;
  return subdimKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getClusterLabel(clusterKey) {
  const found = FAL_CLUSTERS.find(c => c.key === clusterKey);
  if (found) return found.label;
  const mapped = CLUSTER_MIGRATION_MAP[clusterKey];
  if (mapped) {
    const mappedFound = FAL_CLUSTERS.find(c => c.key === mapped);
    return mappedFound?.label || clusterKey;
  }
  return clusterKey;
}

export function validateQuestionMapping(q) {
  const warnings = [];
  if (!q.dimension_key || !FAL_DIMENSION_KEYS.includes(q.dimension_key)) {
    warnings.push(`dimension_key inválida: ${q.dimension_key}`);
  }
  const normalizedSub = normalizeSubdimKey(q.subdimension_key);
  if (!normalizedSub || !FAL_SUBDIMENSIONS.find(s => s.key === normalizedSub)) {
    warnings.push(`subdimension_key sem mapeamento oficial: ${q.subdimension_key}`);
  }
  const normalizedCluster = normalizeClusterKey(q.cluster_key);
  if (!normalizedCluster || !FAL_CLUSTERS.find(c => c.key === normalizedCluster)) {
    warnings.push(`cluster_key sem mapeamento oficial: ${q.cluster_key}`);
  }
  return { valid: warnings.length === 0, warnings };
}