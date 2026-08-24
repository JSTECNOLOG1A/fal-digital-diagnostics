/**
 * restructureFalMatrix
 *
 * EXECUTOR DA MATRIZ OFICIAL FAL
 * =====================================================================
 * Este é o único script autorizado a reestruturar a matriz no banco de dados.
 * A estrutura abaixo (DIMENSION_UPDATES, NEW_SUBDIMENSIONS, NEW_CLUSTERS,
 * QUESTION_MIGRATION_MAP) deve ser mantida em sincronia com:
 * → components/fal/falOfficialMatrix.js (fonte única da verdade para frontend)
 *
 * Fluxo:
 * 1. Backup das estruturas atuais
 * 2. Limpa subdimensões e clusters
 * 3. Atualiza dimensões
 * 4. Cria novas subdimensões (alinhadas com FAL_SUBDIMENSIONS)
 * 5. Cria novos clusters (alinhados com FAL_CLUSTERS)
 * 6. Remapeia perguntas existentes (usando SUBDIM_MIGRATION_MAP)
 * 7. Retorna relatório de validação
 *
 * Módulos LEGADOS descontinuados (NÃO usar):
 * - seedFalClusters → bloqueado, retorna 410 Gone
 * - migrateFalQuestionBank → bloqueado, retorna 410 Gone
 *
 * Admin-only. Payload: { dry_run?: boolean, tenant_id?: string }
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

function isAdmin(user) {
  return resolveAppRole(user) === 'hq_admin';
}

// -------------------------------------------------------
// MATRIZ METODOLÓGICA OFICIAL FAL
// -------------------------------------------------------

const DIMENSION_UPDATES = {
  governanca:        { name: 'Governança' },
  juridico:          { name: 'Jurídico / Societário' },
  controles_internos:{ name: 'Controles Internos' },
  financeiro:        { name: 'Financeiro' },
  contabil:          { name: 'Contábil' },
  tributario:        { name: 'Fiscal / Tributário' },
  operacional:       { name: 'Operacional' },
  sistemas:          { name: 'Tecnologia / Sistemas' },
};

// Subdimensões por dimensão
const NEW_SUBDIMENSIONS = [
  // Governança
  { dimension_key: 'governanca', key: 'governanca_societaria',        name: 'Governança Societária',          order: 1 },
  { dimension_key: 'governanca', key: 'sucessao_continuidade',         name: 'Sucessão e Continuidade',         order: 2 },
  { dimension_key: 'governanca', key: 'regras_decisao_conflitos',      name: 'Regras de Decisão e Conflitos',   order: 3 },
  { dimension_key: 'governanca', key: 'transparencia_prestacao_contas',name: 'Transparência e Prestação de Contas', order: 4 },
  { dimension_key: 'governanca', key: 'ritos_gestao',                  name: 'Ritos de Gestão',                 order: 5 },
  { dimension_key: 'governanca', key: 'metas_indicadores',             name: 'Metas e Indicadores',             order: 6 },
  { dimension_key: 'governanca', key: 'planejamento_orcamento',        name: 'Planejamento e Orçamento',        order: 7 },
  { dimension_key: 'governanca', key: 'gestao_riscos',                 name: 'Gestão de Riscos',                order: 8 },

  // Jurídico / Societário
  { dimension_key: 'juridico', key: 'estrutura_societaria',   name: 'Estrutura Societária',          order: 1 },
  { dimension_key: 'juridico', key: 'contratos_rurais',       name: 'Contratos Rurais',              order: 2 },
  { dimension_key: 'juridico', key: 'contratos_comerciais',   name: 'Contratos Comerciais',          order: 3 },
  { dimension_key: 'juridico', key: 'garantias_instrumentos', name: 'Garantias e Instrumentos',      order: 4 },
  { dimension_key: 'juridico', key: 'compliance_trabalhista', name: 'Compliance Trabalhista',        order: 5 },
  { dimension_key: 'juridico', key: 'regularidade_fundiaria', name: 'Regularidade Fundiária',        order: 6 },
  { dimension_key: 'juridico', key: 'regularidade_ambiental', name: 'Regularidade Ambiental',        order: 7 },
  { dimension_key: 'juridico', key: 'litigios_contingencias', name: 'Litígios e Contingências',      order: 8 },

  // Controles Internos
  { dimension_key: 'controles_internos', key: 'segregacao_funcoes',       name: 'Segregação de Funções',         order: 1 },
  { dimension_key: 'controles_internos', key: 'procedimentos_politicas',  name: 'Procedimentos e Políticas',     order: 2 },
  { dimension_key: 'controles_internos', key: 'controles_financeiros',    name: 'Controles Financeiros',         order: 3 },
  { dimension_key: 'controles_internos', key: 'controles_compras',        name: 'Controles de Compras',          order: 4 },
  { dimension_key: 'controles_internos', key: 'controles_estoque',        name: 'Controles de Estoque',          order: 5 },
  { dimension_key: 'controles_internos', key: 'conciliacoes_auditoria',   name: 'Conciliações e Auditoria',      order: 6 },
  { dimension_key: 'controles_internos', key: 'gestao_folha',             name: 'Gestão de Folha',               order: 7 },
  { dimension_key: 'controles_internos', key: 'controle_imobilizado',     name: 'Controle de Imobilizado',       order: 8 },
  { dimension_key: 'controles_internos', key: 'formacao_ativos',          name: 'Formação de Ativos',            order: 9 },
  { dimension_key: 'controles_internos', key: 'controles_receita',        name: 'Controles de Receita',          order: 10 },

  // Financeiro
  { dimension_key: 'financeiro', key: 'fluxo_caixa',             name: 'Fluxo de Caixa',               order: 1 },
  { dimension_key: 'financeiro', key: 'endividamento_credito',   name: 'Endividamento e Crédito',      order: 2 },
  { dimension_key: 'financeiro', key: 'rentabilidade_custos',    name: 'Rentabilidade e Custos',        order: 3 },
  { dimension_key: 'financeiro', key: 'planejamento_financeiro', name: 'Planejamento Financeiro',       order: 4 },

  // Contábil
  { dimension_key: 'contabil', key: 'fechamento_contabil',       name: 'Fechamento Contábil',          order: 1 },
  { dimension_key: 'contabil', key: 'qualidade_informacao',      name: 'Qualidade da Informação',      order: 2 },
  { dimension_key: 'contabil', key: 'contabilidade_gerencial',   name: 'Contabilidade Gerencial',      order: 3 },
  { dimension_key: 'contabil', key: 'conciliacoes_contabeis',    name: 'Conciliações Contábeis',       order: 4 },
  { dimension_key: 'contabil', key: 'provisoes',                 name: 'Provisões',                    order: 5 },
  { dimension_key: 'contabil', key: 'imobilizado',               name: 'Imobilizado',                  order: 6 },
  { dimension_key: 'contabil', key: 'estoques',                  name: 'Estoques',                     order: 7 },
  { dimension_key: 'contabil', key: 'integracao_erp',            name: 'Integração ERP',               order: 8 },
  { dimension_key: 'contabil', key: 'metodo_custo',              name: 'Método de Custo',              order: 9 },

  // Fiscal / Tributário
  { dimension_key: 'tributario', key: 'rotinas_fiscais',          name: 'Rotinas Fiscais',              order: 1 },
  { dimension_key: 'tributario', key: 'gestao_creditos',          name: 'Gestão de Créditos',           order: 2 },
  { dimension_key: 'tributario', key: 'riscos_fiscais',           name: 'Riscos Fiscais',               order: 3 },
  { dimension_key: 'tributario', key: 'obrigacoes_acessorias',    name: 'Obrigações Acessórias',        order: 4 },

  // Operacional
  { dimension_key: 'operacional', key: 'planejamento_safra',       name: 'Planejamento de Safra',        order: 1 },
  { dimension_key: 'operacional', key: 'gestao_insumos',           name: 'Gestão de Insumos',            order: 2 },
  { dimension_key: 'operacional', key: 'manutencao_maquinas',      name: 'Manutenção de Máquinas',       order: 3 },
  { dimension_key: 'operacional', key: 'produtividade_perdas',     name: 'Produtividade e Perdas',       order: 4 },
  { dimension_key: 'operacional', key: 'processos_comerciais',     name: 'Processos Comerciais',         order: 5 },
  { dimension_key: 'operacional', key: 'logistica_estoque',        name: 'Logística e Estoque',          order: 6 },
  { dimension_key: 'operacional', key: 'atendimento_posvenda',     name: 'Atendimento e Pós-venda',      order: 7 },
  { dimension_key: 'operacional', key: 'operacao_fiscal_entrega',  name: 'Operação Fiscal e Entrega',    order: 8 },

  // Tecnologia / Sistemas
  { dimension_key: 'sistemas', key: 'erp_integracoes',       name: 'ERP e Integrações',            order: 1 },
  { dimension_key: 'sistemas', key: 'qualidade_dados',       name: 'Qualidade de Dados',           order: 2 },
  { dimension_key: 'sistemas', key: 'automacao_controles',   name: 'Automação de Controles',       order: 3 },
  { dimension_key: 'sistemas', key: 'seguranca_informacao',  name: 'Segurança da Informação',      order: 4 },
];

// Clusters por subdimensão
const NEW_CLUSTERS = [
  // Governança > governanca_societaria
  { dimension_key: 'governanca', subdimension_key: 'governanca_societaria', key: 'acordo_socios',           name: 'Acordo de Sócios', order: 1 },
  { dimension_key: 'governanca', subdimension_key: 'governanca_societaria', key: 'estatuto_contrato_social',name: 'Estatuto / Contrato Social', order: 2 },
  { dimension_key: 'governanca', subdimension_key: 'governanca_societaria', key: 'estrutura_controle',      name: 'Estrutura de Controle', order: 3 },

  // Governança > sucessao_continuidade
  { dimension_key: 'governanca', subdimension_key: 'sucessao_continuidade', key: 'plano_sucessao',         name: 'Plano de Sucessão', order: 1 },
  { dimension_key: 'governanca', subdimension_key: 'sucessao_continuidade', key: 'holding_familiar',       name: 'Holding Familiar', order: 2 },
  { dimension_key: 'governanca', subdimension_key: 'sucessao_continuidade', key: 'continuidade_negocio',   name: 'Continuidade de Negócio', order: 3 },

  // Governança > regras_decisao_conflitos
  { dimension_key: 'governanca', subdimension_key: 'regras_decisao_conflitos', key: 'alcadas_aprovacao',      name: 'Alçadas de Aprovação', order: 1 },
  { dimension_key: 'governanca', subdimension_key: 'regras_decisao_conflitos', key: 'resolucao_conflitos',    name: 'Resolução de Conflitos', order: 2 },
  { dimension_key: 'governanca', subdimension_key: 'regras_decisao_conflitos', key: 'tag_drag_along',         name: 'Tag/Drag Along', order: 3 },

  // Governança > transparencia_prestacao_contas
  { dimension_key: 'governanca', subdimension_key: 'transparencia_prestacao_contas', key: 'relatorio_socios',  name: 'Relatório aos Sócios', order: 1 },
  { dimension_key: 'governanca', subdimension_key: 'transparencia_prestacao_contas', key: 'auditoria_externa', name: 'Auditoria Externa', order: 2 },
  { dimension_key: 'governanca', subdimension_key: 'transparencia_prestacao_contas', key: 'politica_dividendos',name: 'Política de Dividendos', order: 3 },

  // Governança > ritos_gestao
  { dimension_key: 'governanca', subdimension_key: 'ritos_gestao', key: 'reuniao_conselho',   name: 'Reunião de Conselho', order: 1 },
  { dimension_key: 'governanca', subdimension_key: 'ritos_gestao', key: 'reuniao_diretoria',  name: 'Reunião de Diretoria', order: 2 },
  { dimension_key: 'governanca', subdimension_key: 'ritos_gestao', key: 'ata_decisao',        name: 'Ata de Decisão', order: 3 },

  // Governança > metas_indicadores
  { dimension_key: 'governanca', subdimension_key: 'metas_indicadores', key: 'kpis_estrategicos', name: 'KPIs Estratégicos', order: 1 },
  { dimension_key: 'governanca', subdimension_key: 'metas_indicadores', key: 'painel_gestao',     name: 'Painel de Gestão', order: 2 },
  { dimension_key: 'governanca', subdimension_key: 'metas_indicadores', key: 'metas_equipe',      name: 'Metas por Equipe', order: 3 },

  // Governança > planejamento_orcamento
  { dimension_key: 'governanca', subdimension_key: 'planejamento_orcamento', key: 'orcamento_anual',    name: 'Orçamento Anual', order: 1 },
  { dimension_key: 'governanca', subdimension_key: 'planejamento_orcamento', key: 'plano_estrategico',  name: 'Plano Estratégico', order: 2 },
  { dimension_key: 'governanca', subdimension_key: 'planejamento_orcamento', key: 'revisao_orcamento',  name: 'Revisão Orçamentária', order: 3 },

  // Governança > gestao_riscos
  { dimension_key: 'governanca', subdimension_key: 'gestao_riscos', key: 'matriz_riscos',       name: 'Matriz de Riscos', order: 1 },
  { dimension_key: 'governanca', subdimension_key: 'gestao_riscos', key: 'seguros_cobertura',   name: 'Seguros e Cobertura', order: 2 },
  { dimension_key: 'governanca', subdimension_key: 'gestao_riscos', key: 'plano_contingencia',  name: 'Plano de Contingência', order: 3 },

  // Jurídico > estrutura_societaria
  { dimension_key: 'juridico', subdimension_key: 'estrutura_societaria', key: 'holding_operacional',  name: 'Holding Operacional', order: 1 },
  { dimension_key: 'juridico', subdimension_key: 'estrutura_societaria', key: 'capital_social',       name: 'Capital Social', order: 2 },
  { dimension_key: 'juridico', subdimension_key: 'estrutura_societaria', key: 'participacoes',        name: 'Participações Societárias', order: 3 },

  // Jurídico > contratos_rurais
  { dimension_key: 'juridico', subdimension_key: 'contratos_rurais', key: 'arrendamento',        name: 'Arrendamento', order: 1 },
  { dimension_key: 'juridico', subdimension_key: 'contratos_rurais', key: 'parceria_agricola',   name: 'Parceria Agrícola', order: 2 },
  { dimension_key: 'juridico', subdimension_key: 'contratos_rurais', key: 'barter_cpp',          name: 'Barter / CPR', order: 3 },

  // Jurídico > contratos_comerciais
  { dimension_key: 'juridico', subdimension_key: 'contratos_comerciais', key: 'contratos_fornecedores', name: 'Contratos com Fornecedores', order: 1 },
  { dimension_key: 'juridico', subdimension_key: 'contratos_comerciais', key: 'contratos_clientes',     name: 'Contratos com Clientes', order: 2 },
  { dimension_key: 'juridico', subdimension_key: 'contratos_comerciais', key: 'contratos_servicos',     name: 'Contratos de Serviço', order: 3 },

  // Jurídico > garantias_instrumentos
  { dimension_key: 'juridico', subdimension_key: 'garantias_instrumentos', key: 'garantias_reais',      name: 'Garantias Reais', order: 1 },
  { dimension_key: 'juridico', subdimension_key: 'garantias_instrumentos', key: 'cedula_rural',         name: 'Cédula Rural', order: 2 },
  { dimension_key: 'juridico', subdimension_key: 'garantias_instrumentos', key: 'alienacao_fiduciaria', name: 'Alienação Fiduciária', order: 3 },

  // Jurídico > compliance_trabalhista
  { dimension_key: 'juridico', subdimension_key: 'compliance_trabalhista', key: 'clt_registro',        name: 'CLT / Registro', order: 1 },
  { dimension_key: 'juridico', subdimension_key: 'compliance_trabalhista', key: 'esocial',             name: 'eSocial', order: 2 },
  { dimension_key: 'juridico', subdimension_key: 'compliance_trabalhista', key: 'saude_seguranca',     name: 'Saúde e Segurança', order: 3 },

  // Jurídico > regularidade_fundiaria
  { dimension_key: 'juridico', subdimension_key: 'regularidade_fundiaria', key: 'car_itr',          name: 'CAR / ITR', order: 1 },
  { dimension_key: 'juridico', subdimension_key: 'regularidade_fundiaria', key: 'matricula_imovel', name: 'Matrícula do Imóvel', order: 2 },
  { dimension_key: 'juridico', subdimension_key: 'regularidade_fundiaria', key: 'geo_rural',        name: 'Georreferenciamento', order: 3 },

  // Jurídico > regularidade_ambiental
  { dimension_key: 'juridico', subdimension_key: 'regularidade_ambiental', key: 'licencas_ambientais',  name: 'Licenças Ambientais', order: 1 },
  { dimension_key: 'juridico', subdimension_key: 'regularidade_ambiental', key: 'reserva_legal',        name: 'Reserva Legal', order: 2 },
  { dimension_key: 'juridico', subdimension_key: 'regularidade_ambiental', key: 'conformidade_ambiental',name: 'Conformidade Ambiental', order: 3 },

  // Jurídico > litigios_contingencias
  { dimension_key: 'juridico', subdimension_key: 'litigios_contingencias', key: 'passivo_trabalhista',  name: 'Passivo Trabalhista', order: 1 },
  { dimension_key: 'juridico', subdimension_key: 'litigios_contingencias', key: 'passivo_fiscal',       name: 'Passivo Fiscal', order: 2 },
  { dimension_key: 'juridico', subdimension_key: 'litigios_contingencias', key: 'passivo_ambiental',    name: 'Passivo Ambiental', order: 3 },

  // Controles Internos > segregacao_funcoes
  { dimension_key: 'controles_internos', subdimension_key: 'segregacao_funcoes', key: 'matriz_alcadas',             name: 'Matriz de Alçadas', order: 1 },
  { dimension_key: 'controles_internos', subdimension_key: 'segregacao_funcoes', key: 'segregacao_funcoes',         name: 'Segregação de Funções', order: 2 },
  { dimension_key: 'controles_internos', subdimension_key: 'segregacao_funcoes', key: 'controle_acessos',          name: 'Controle de Acessos', order: 3 },
  { dimension_key: 'controles_internos', subdimension_key: 'segregacao_funcoes', key: 'trilha_auditoria',          name: 'Trilha de Auditoria', order: 4 },
  { dimension_key: 'controles_internos', subdimension_key: 'segregacao_funcoes', key: 'procedimentos_operacionais',name: 'Procedimentos Operacionais', order: 5 },

  // Controles Internos > procedimentos_politicas
  { dimension_key: 'controles_internos', subdimension_key: 'procedimentos_politicas', key: 'manual_politicas',    name: 'Manual de Políticas', order: 1 },
  { dimension_key: 'controles_internos', subdimension_key: 'procedimentos_politicas', key: 'politica_caixa',     name: 'Política de Caixa', order: 2 },
  { dimension_key: 'controles_internos', subdimension_key: 'procedimentos_politicas', key: 'politica_despesas',  name: 'Política de Despesas', order: 3 },

  // Controles Internos > controles_financeiros
  { dimension_key: 'controles_internos', subdimension_key: 'controles_financeiros', key: 'conciliacao_bancaria', name: 'Conciliação Bancária', order: 1 },
  { dimension_key: 'controles_internos', subdimension_key: 'controles_financeiros', key: 'aprovacao_pagamento',  name: 'Aprovação de Pagamento', order: 2 },
  { dimension_key: 'controles_internos', subdimension_key: 'controles_financeiros', key: 'controle_caixa',      name: 'Controle de Caixa', order: 3 },

  // Controles Internos > controles_compras
  { dimension_key: 'controles_internos', subdimension_key: 'controles_compras', key: 'requisicao_compras',    name: 'Requisição de Compras', order: 1 },
  { dimension_key: 'controles_internos', subdimension_key: 'controles_compras', key: 'cotacao_fornecedores',  name: 'Cotação de Fornecedores', order: 2 },
  { dimension_key: 'controles_internos', subdimension_key: 'controles_compras', key: 'aprovacao_compras',     name: 'Aprovação de Compras', order: 3 },
  { dimension_key: 'controles_internos', subdimension_key: 'controles_compras', key: 'recebimento_materiais', name: 'Recebimento de Materiais', order: 4 },

  // Controles Internos > controles_estoque
  { dimension_key: 'controles_internos', subdimension_key: 'controles_estoque', key: 'inventario_fisico',   name: 'Inventário Físico', order: 1 },
  { dimension_key: 'controles_internos', subdimension_key: 'controles_estoque', key: 'controle_entradas',   name: 'Controle de Entradas', order: 2 },
  { dimension_key: 'controles_internos', subdimension_key: 'controles_estoque', key: 'controle_saidas',     name: 'Controle de Saídas', order: 3 },
  { dimension_key: 'controles_internos', subdimension_key: 'controles_estoque', key: 'perdas_quebras',      name: 'Perdas e Quebras', order: 4 },

  // Controles Internos > conciliacoes_auditoria
  { dimension_key: 'controles_internos', subdimension_key: 'conciliacoes_auditoria', key: 'conciliacao_mensal',  name: 'Conciliação Mensal', order: 1 },
  { dimension_key: 'controles_internos', subdimension_key: 'conciliacoes_auditoria', key: 'auditoria_interna',  name: 'Auditoria Interna', order: 2 },
  { dimension_key: 'controles_internos', subdimension_key: 'conciliacoes_auditoria', key: 'divergencias',       name: 'Divergências', order: 3 },

  // Controles Internos > gestao_folha
  { dimension_key: 'controles_internos', subdimension_key: 'gestao_folha', key: 'folha_pagamento',   name: 'Folha de Pagamento', order: 1 },
  { dimension_key: 'controles_internos', subdimension_key: 'gestao_folha', key: 'beneficios',        name: 'Benefícios', order: 2 },
  { dimension_key: 'controles_internos', subdimension_key: 'gestao_folha', key: 'ponto_jornada',     name: 'Ponto e Jornada', order: 3 },

  // Controles Internos > controle_imobilizado
  { dimension_key: 'controles_internos', subdimension_key: 'controle_imobilizado', key: 'patrimonio_bens',    name: 'Patrimônio e Bens', order: 1 },
  { dimension_key: 'controles_internos', subdimension_key: 'controle_imobilizado', key: 'depreciacao',        name: 'Depreciação', order: 2 },
  { dimension_key: 'controles_internos', subdimension_key: 'controle_imobilizado', key: 'manutencao_ativo',   name: 'Manutenção de Ativos', order: 3 },

  // Controles Internos > formacao_ativos
  { dimension_key: 'controles_internos', subdimension_key: 'formacao_ativos', key: 'terras_imoveis',       name: 'Terras e Imóveis', order: 1 },
  { dimension_key: 'controles_internos', subdimension_key: 'formacao_ativos', key: 'culturas_plantacoes',  name: 'Culturas e Plantações', order: 2 },
  { dimension_key: 'controles_internos', subdimension_key: 'formacao_ativos', key: 'rebanho',              name: 'Rebanho', order: 3 },

  // Controles Internos > controles_receita
  { dimension_key: 'controles_internos', subdimension_key: 'controles_receita', key: 'faturamento_nota',    name: 'Faturamento / Nota', order: 1 },
  { dimension_key: 'controles_internos', subdimension_key: 'controles_receita', key: 'cobranca_recebimento',name: 'Cobrança e Recebimento', order: 2 },
  { dimension_key: 'controles_internos', subdimension_key: 'controles_receita', key: 'inadimplencia',       name: 'Inadimplência', order: 3 },

  // Financeiro > fluxo_caixa
  { dimension_key: 'financeiro', subdimension_key: 'fluxo_caixa', key: 'previsibilidade_caixa',  name: 'Previsibilidade de Caixa', order: 1 },
  { dimension_key: 'financeiro', subdimension_key: 'fluxo_caixa', key: 'gestao_caixa_diario',   name: 'Gestão de Caixa Diário', order: 2 },
  { dimension_key: 'financeiro', subdimension_key: 'fluxo_caixa', key: 'capital_giro',           name: 'Capital de Giro', order: 3 },

  // Financeiro > endividamento_credito
  { dimension_key: 'financeiro', subdimension_key: 'endividamento_credito', key: 'estrutura_divida',    name: 'Estrutura da Dívida', order: 1 },
  { dimension_key: 'financeiro', subdimension_key: 'endividamento_credito', key: 'politica_credito',    name: 'Política de Crédito', order: 2 },
  { dimension_key: 'financeiro', subdimension_key: 'endividamento_credito', key: 'relacionamento_banco',name: 'Relacionamento Bancário', order: 3 },
  { dimension_key: 'financeiro', subdimension_key: 'endividamento_credito', key: 'garantias_operacoes', name: 'Garantias em Operações', order: 4 },

  // Financeiro > rentabilidade_custos
  { dimension_key: 'financeiro', subdimension_key: 'rentabilidade_custos', key: 'custo_producao',    name: 'Custo de Produção', order: 1 },
  { dimension_key: 'financeiro', subdimension_key: 'rentabilidade_custos', key: 'margem_resultado',  name: 'Margem e Resultado', order: 2 },
  { dimension_key: 'financeiro', subdimension_key: 'rentabilidade_custos', key: 'break_even',        name: 'Break Even', order: 3 },

  // Financeiro > planejamento_financeiro
  { dimension_key: 'financeiro', subdimension_key: 'planejamento_financeiro', key: 'projecao_dre',        name: 'Projeção DRE', order: 1 },
  { dimension_key: 'financeiro', subdimension_key: 'planejamento_financeiro', key: 'cenarios_financeiros', name: 'Cenários Financeiros', order: 2 },
  { dimension_key: 'financeiro', subdimension_key: 'planejamento_financeiro', key: 'investimento_retorno', name: 'Investimento e Retorno', order: 3 },

  // Contábil > fechamento_contabil
  { dimension_key: 'contabil', subdimension_key: 'fechamento_contabil', key: 'balanco_mensal',       name: 'Balanço Mensal', order: 1 },
  { dimension_key: 'contabil', subdimension_key: 'fechamento_contabil', key: 'dre_mensal',           name: 'DRE Mensal', order: 2 },
  { dimension_key: 'contabil', subdimension_key: 'fechamento_contabil', key: 'prazo_fechamento',     name: 'Prazo de Fechamento', order: 3 },

  // Contábil > qualidade_informacao
  { dimension_key: 'contabil', subdimension_key: 'qualidade_informacao', key: 'acuracia_lancamentos', name: 'Acurácia de Lançamentos', order: 1 },
  { dimension_key: 'contabil', subdimension_key: 'qualidade_informacao', key: 'plano_contas',         name: 'Plano de Contas', order: 2 },
  { dimension_key: 'contabil', subdimension_key: 'qualidade_informacao', key: 'parametros_contabeis', name: 'Parâmetros Contábeis', order: 3 },

  // Contábil > contabilidade_gerencial
  { dimension_key: 'contabil', subdimension_key: 'contabilidade_gerencial', key: 'centro_custo',       name: 'Centro de Custo', order: 1 },
  { dimension_key: 'contabil', subdimension_key: 'contabilidade_gerencial', key: 'relatorios_gerenciais',name: 'Relatórios Gerenciais', order: 2 },
  { dimension_key: 'contabil', subdimension_key: 'contabilidade_gerencial', key: 'contabilidade_custos',name: 'Contabilidade de Custos', order: 3 },

  // Contábil > conciliacoes_contabeis
  { dimension_key: 'contabil', subdimension_key: 'conciliacoes_contabeis', key: 'conciliacao_bancos',  name: 'Conciliação Bancos', order: 1 },
  { dimension_key: 'contabil', subdimension_key: 'conciliacoes_contabeis', key: 'conciliacao_estoques',name: 'Conciliação Estoques', order: 2 },
  { dimension_key: 'contabil', subdimension_key: 'conciliacoes_contabeis', key: 'conciliacao_ativo',   name: 'Conciliação Ativo', order: 3 },

  // Contábil > provisoes
  { dimension_key: 'contabil', subdimension_key: 'provisoes', key: 'provisao_ferias',      name: 'Provisão Férias', order: 1 },
  { dimension_key: 'contabil', subdimension_key: 'provisoes', key: 'provisao_contingencias',name: 'Provisão Contingências', order: 2 },
  { dimension_key: 'contabil', subdimension_key: 'provisoes', key: 'provisao_tributos',    name: 'Provisão Tributos', order: 3 },

  // Contábil > imobilizado
  { dimension_key: 'contabil', subdimension_key: 'imobilizado', key: 'controle_patrimonio',  name: 'Controle Patrimônio', order: 1 },
  { dimension_key: 'contabil', subdimension_key: 'imobilizado', key: 'depreciacao_contabil', name: 'Depreciação Contábil', order: 2 },
  { dimension_key: 'contabil', subdimension_key: 'imobilizado', key: 'baixa_bens',           name: 'Baixa de Bens', order: 3 },

  // Contábil > estoques
  { dimension_key: 'contabil', subdimension_key: 'estoques', key: 'valorizacao_estoque',  name: 'Valorização Estoque', order: 1 },
  { dimension_key: 'contabil', subdimension_key: 'estoques', key: 'peps_custo_medio',     name: 'PEPS / Custo Médio', order: 2 },
  { dimension_key: 'contabil', subdimension_key: 'estoques', key: 'perdas_contabeis',     name: 'Perdas Contábeis', order: 3 },

  // Contábil > integracao_erp
  { dimension_key: 'contabil', subdimension_key: 'integracao_erp', key: 'cadastro_maestro',    name: 'Cadastro Mestre', order: 1 },
  { dimension_key: 'contabil', subdimension_key: 'integracao_erp', key: 'interface_fiscal',    name: 'Interface Fiscal', order: 2 },
  { dimension_key: 'contabil', subdimension_key: 'integracao_erp', key: 'conciliacao_erp',     name: 'Conciliação ERP', order: 3 },

  // Contábil > metodo_custo
  { dimension_key: 'contabil', subdimension_key: 'metodo_custo', key: 'custeio_absorção',   name: 'Custeio por Absorção', order: 1 },
  { dimension_key: 'contabil', subdimension_key: 'metodo_custo', key: 'custeio_variavel',   name: 'Custeio Variável', order: 2 },
  { dimension_key: 'contabil', subdimension_key: 'metodo_custo', key: 'custeio_atividade',  name: 'Custeio por Atividade', order: 3 },

  // Fiscal > rotinas_fiscais
  { dimension_key: 'tributario', subdimension_key: 'rotinas_fiscais', key: 'apuracao_impostos',  name: 'Apuração de Impostos', order: 1 },
  { dimension_key: 'tributario', subdimension_key: 'rotinas_fiscais', key: 'regime_tributario',  name: 'Regime Tributário', order: 2 },
  { dimension_key: 'tributario', subdimension_key: 'rotinas_fiscais', key: 'icms_ipi',           name: 'ICMS / IPI', order: 3 },
  { dimension_key: 'tributario', subdimension_key: 'rotinas_fiscais', key: 'pis_cofins',         name: 'PIS / COFINS', order: 4 },

  // Fiscal > gestao_creditos
  { dimension_key: 'tributario', subdimension_key: 'gestao_creditos', key: 'creditos_icms',      name: 'Créditos ICMS', order: 1 },
  { dimension_key: 'tributario', subdimension_key: 'gestao_creditos', key: 'creditos_pis_cofins', name: 'Créditos PIS/COFINS', order: 2 },
  { dimension_key: 'tributario', subdimension_key: 'gestao_creditos', key: 'aproveitamento_creditos',name: 'Aproveitamento de Créditos', order: 3 },

  // Fiscal > riscos_fiscais
  { dimension_key: 'tributario', subdimension_key: 'riscos_fiscais', key: 'passivo_fiscal_est',  name: 'Passivo Fiscal Estimado', order: 1 },
  { dimension_key: 'tributario', subdimension_key: 'riscos_fiscais', key: 'autuacoes_fiscais',   name: 'Autuações Fiscais', order: 2 },
  { dimension_key: 'tributario', subdimension_key: 'riscos_fiscais', key: 'planejamento_trib',   name: 'Planejamento Tributário', order: 3 },

  // Fiscal > obrigacoes_acessorias
  { dimension_key: 'tributario', subdimension_key: 'obrigacoes_acessorias', key: 'sped_fiscal',   name: 'SPED Fiscal', order: 1 },
  { dimension_key: 'tributario', subdimension_key: 'obrigacoes_acessorias', key: 'ecf_ecd',       name: 'ECF / ECD', order: 2 },
  { dimension_key: 'tributario', subdimension_key: 'obrigacoes_acessorias', key: 'declaracoes',   name: 'Declarações', order: 3 },

  // Operacional > planejamento_safra
  { dimension_key: 'operacional', subdimension_key: 'planejamento_safra', key: 'calendario_operacional', name: 'Calendário Operacional', order: 1 },
  { dimension_key: 'operacional', subdimension_key: 'planejamento_safra', key: 'mapa_plantio',           name: 'Mapa de Plantio', order: 2 },
  { dimension_key: 'operacional', subdimension_key: 'planejamento_safra', key: 'gestao_talhao',          name: 'Gestão de Talhão', order: 3 },

  // Operacional > gestao_insumos
  { dimension_key: 'operacional', subdimension_key: 'gestao_insumos', key: 'estoque_insumos',       name: 'Estoque de Insumos', order: 1 },
  { dimension_key: 'operacional', subdimension_key: 'gestao_insumos', key: 'abastecimento_combustivel',name: 'Abastecimento / Combustível', order: 2 },
  { dimension_key: 'operacional', subdimension_key: 'gestao_insumos', key: 'controle_defensivos',   name: 'Controle de Defensivos', order: 3 },
  { dimension_key: 'operacional', subdimension_key: 'gestao_insumos', key: 'receita_agronomica',    name: 'Receita Agronômica', order: 4 },

  // Operacional > manutencao_maquinas
  { dimension_key: 'operacional', subdimension_key: 'manutencao_maquinas', key: 'plano_manutencao',  name: 'Plano de Manutenção', order: 1 },
  { dimension_key: 'operacional', subdimension_key: 'manutencao_maquinas', key: 'historico_maquinas', name: 'Histórico de Máquinas', order: 2 },
  { dimension_key: 'operacional', subdimension_key: 'manutencao_maquinas', key: 'custo_maquina_hora', name: 'Custo Máquina/Hora', order: 3 },

  // Operacional > produtividade_perdas
  { dimension_key: 'operacional', subdimension_key: 'produtividade_perdas', key: 'producao_colheita',  name: 'Produção e Colheita', order: 1 },
  { dimension_key: 'operacional', subdimension_key: 'produtividade_perdas', key: 'perdas_processo',    name: 'Perdas no Processo', order: 2 },
  { dimension_key: 'operacional', subdimension_key: 'produtividade_perdas', key: 'linha_producao',     name: 'Linha de Produção', order: 3 },

  // Operacional > processos_comerciais
  { dimension_key: 'operacional', subdimension_key: 'processos_comerciais', key: 'venda_contrato',     name: 'Venda / Contrato', order: 1 },
  { dimension_key: 'operacional', subdimension_key: 'processos_comerciais', key: 'politica_preco',     name: 'Política de Preço', order: 2 },
  { dimension_key: 'operacional', subdimension_key: 'processos_comerciais', key: 'funil_clientes',     name: 'Funil de Clientes', order: 3 },

  // Operacional > logistica_estoque
  { dimension_key: 'operacional', subdimension_key: 'logistica_estoque', key: 'armazenagem',         name: 'Armazenagem', order: 1 },
  { dimension_key: 'operacional', subdimension_key: 'logistica_estoque', key: 'transporte_frete',    name: 'Transporte / Frete', order: 2 },
  { dimension_key: 'operacional', subdimension_key: 'logistica_estoque', key: 'gestao_estoque_pd',   name: 'Gestão de Estoque P/D', order: 3 },

  // Operacional > atendimento_posvenda
  { dimension_key: 'operacional', subdimension_key: 'atendimento_posvenda', key: 'sat_reclamacoes',   name: 'SAT / Reclamações', order: 1 },
  { dimension_key: 'operacional', subdimension_key: 'atendimento_posvenda', key: 'garantia_tecnica',  name: 'Garantia Técnica', order: 2 },
  { dimension_key: 'operacional', subdimension_key: 'atendimento_posvenda', key: 'nps_cliente',       name: 'NPS / Cliente', order: 3 },

  // Operacional > operacao_fiscal_entrega
  { dimension_key: 'operacional', subdimension_key: 'operacao_fiscal_entrega', key: 'nfe_documentos',    name: 'NFe / Documentos', order: 1 },
  { dimension_key: 'operacional', subdimension_key: 'operacao_fiscal_entrega', key: 'conferencia_entrega',name: 'Conferência de Entrega', order: 2 },
  { dimension_key: 'operacional', subdimension_key: 'operacao_fiscal_entrega', key: 'rastreabilidade',   name: 'Rastreabilidade', order: 3 },

  // Sistemas > erp_integracoes
  { dimension_key: 'sistemas', subdimension_key: 'erp_integracoes', key: 'configuracao_erp',    name: 'Configuração ERP', order: 1 },
  { dimension_key: 'sistemas', subdimension_key: 'erp_integracoes', key: 'integracao_modulos',  name: 'Integração de Módulos', order: 2 },
  { dimension_key: 'sistemas', subdimension_key: 'erp_integracoes', key: 'adocao_usuarios',     name: 'Adoção por Usuários', order: 3 },

  // Sistemas > qualidade_dados
  { dimension_key: 'sistemas', subdimension_key: 'qualidade_dados', key: 'cadastro_maestro',   name: 'Cadastro Mestre', order: 1 },
  { dimension_key: 'sistemas', subdimension_key: 'qualidade_dados', key: 'duplicatas_gaps',    name: 'Duplicatas e Gaps', order: 2 },
  { dimension_key: 'sistemas', subdimension_key: 'qualidade_dados', key: 'padronizacao_dados', name: 'Padronização de Dados', order: 3 },

  // Sistemas > automacao_controles
  { dimension_key: 'sistemas', subdimension_key: 'automacao_controles', key: 'workflow_aprovacao',  name: 'Workflow de Aprovação', order: 1 },
  { dimension_key: 'sistemas', subdimension_key: 'automacao_controles', key: 'automatizacao_relat', name: 'Automatização de Relatórios', order: 2 },
  { dimension_key: 'sistemas', subdimension_key: 'automacao_controles', key: 'backup_dados',        name: 'Backup de Dados', order: 3 },

  // Sistemas > seguranca_informacao
  { dimension_key: 'sistemas', subdimension_key: 'seguranca_informacao', key: 'politica_acesso',    name: 'Política de Acesso', order: 1 },
  { dimension_key: 'sistemas', subdimension_key: 'seguranca_informacao', key: 'protecao_dados',     name: 'Proteção de Dados (LGPD)', order: 2 },
  { dimension_key: 'sistemas', subdimension_key: 'seguranca_informacao', key: 'monitoramento_logs', name: 'Monitoramento de Logs', order: 3 },
];

// Mapeamento de migração de perguntas: (old_dim:old_subdim) → new_subdim_key + new_cluster_key
const QUESTION_MIGRATION_MAP = {
  'governanca:governanca_societaria':   { subdimension_key: 'governanca_societaria',        cluster_key: 'acordo_socios' },
  'governanca:ritos_governanca':        { subdimension_key: 'ritos_gestao',                 cluster_key: 'reuniao_conselho' },
  'juridico:contratos_comerciais':      { subdimension_key: 'contratos_comerciais',          cluster_key: 'contratos_fornecedores' },
  'juridico:contratos_rurais':          { subdimension_key: 'contratos_rurais',              cluster_key: 'arrendamento' },
  'juridico:compliance_legal':          { subdimension_key: 'regularidade_ambiental',        cluster_key: 'conformidade_ambiental' },
  'juridico:compliance_trabalhista':    { subdimension_key: 'compliance_trabalhista',        cluster_key: 'clt_registro' },
  'controles_internos:controle_compras':    { subdimension_key: 'controles_compras',     cluster_key: 'requisicao_compras' },
  'controles_internos:controle_estoque':    { subdimension_key: 'controles_estoque',     cluster_key: 'inventario_fisico' },
  'controles_internos:controle_combustivel':{ subdimension_key: 'gestao_insumos',        cluster_key: 'abastecimento_combustivel' },
  'controles_internos:segregacao_funcoes':  { subdimension_key: 'segregacao_funcoes',    cluster_key: 'segregacao_funcoes' },
  'controles_internos:conciliacoes_auditoria':{ subdimension_key: 'conciliacoes_auditoria', cluster_key: 'conciliacao_mensal' },
  'financeiro:fluxo_caixa':            { subdimension_key: 'fluxo_caixa',              cluster_key: 'previsibilidade_caixa' },
  'financeiro:credito_cobranca':        { subdimension_key: 'endividamento_credito',    cluster_key: 'politica_credito' },
  'financeiro:investimentos':           { subdimension_key: 'planejamento_financeiro',  cluster_key: 'investimento_retorno' },
  'financeiro:rentabilidade':           { subdimension_key: 'rentabilidade_custos',     cluster_key: 'margem_resultado' },
  'financeiro:endividamento':           { subdimension_key: 'endividamento_credito',    cluster_key: 'estrutura_divida' },
  'contabil:registros_contabeis':       { subdimension_key: 'fechamento_contabil',      cluster_key: 'dre_mensal' },
  'contabil:relatorios_contabeis':      { subdimension_key: 'contabilidade_gerencial',  cluster_key: 'relatorios_gerenciais' },
  'contabil:apuracoes_contabeis':       { subdimension_key: 'fechamento_contabil',      cluster_key: 'balanco_mensal' },
  'tributario:obrigacoes_fiscais':      { subdimension_key: 'rotinas_fiscais',          cluster_key: 'icms_ipi' },
  'tributario:planejamento_tributario': { subdimension_key: 'riscos_fiscais',           cluster_key: 'planejamento_trib' },
  'tributario:obrigacoes_acessorias':   { subdimension_key: 'obrigacoes_acessorias',    cluster_key: 'sped_fiscal' },
  'operacional:planejamento_operacional':   { subdimension_key: 'planejamento_safra',   cluster_key: 'calendario_operacional' },
  'operacional:producao_qualidade':         { subdimension_key: 'produtividade_perdas', cluster_key: 'linha_producao' },
  'operacional:gestao_insumos':             { subdimension_key: 'gestao_insumos',       cluster_key: 'estoque_insumos' },
  'operacional:logistica_estoque':          { subdimension_key: 'logistica_estoque',    cluster_key: 'armazenagem' },
  'operacional:comercial':                  { subdimension_key: 'processos_comerciais', cluster_key: 'venda_contrato' },
  'sistemas:infraestrutura':            { subdimension_key: 'automacao_controles',  cluster_key: 'backup_dados' },
  'sistemas:sistemas_erp':              { subdimension_key: 'erp_integracoes',      cluster_key: 'configuracao_erp' },
  'sistemas:qualidade_dados':           { subdimension_key: 'qualidade_dados',      cluster_key: 'cadastro_maestro' },
  'sistemas:seguranca':                 { subdimension_key: 'seguranca_informacao', cluster_key: 'politica_acesso' },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: HQ admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { dry_run = false, tenant_id } = body;

    console.log(`[restructureFalMatrix] Starting... dry_run=${dry_run}`);

    // -------------------------------------------------------
    // ETAPA 1 — BACKUP
    // -------------------------------------------------------
    const [currentDimensions, currentSubdims, currentClusters] = await Promise.all([
      base44.asServiceRole.entities.FalDimension.list(),
      base44.asServiceRole.entities.FalSubdimension.list(),
      base44.asServiceRole.entities.FalCluster.list(),
    ]);

    console.log(`[BACKUP] ${currentDimensions.length} dims, ${currentSubdims.length} subdims, ${currentClusters.length} clusters`);

    const backup = {
      dimensions: currentDimensions,
      subdimensions: currentSubdims,
      clusters: currentClusters,
      backed_up_at: new Date().toISOString(),
    };

    if (dry_run) {
      return Response.json({ dry_run: true, backup_counts: { dimensions: currentDimensions.length, subdimensions: currentSubdims.length, clusters: currentClusters.length }, plan: { new_subdimensions: NEW_SUBDIMENSIONS.length, new_clusters: NEW_CLUSTERS.length } });
    }

    // -------------------------------------------------------
    // ETAPA 2 — LIMPAR SUBDIMENSÕES E CLUSTERS EXISTENTES
    // -------------------------------------------------------
    console.log(`[CLEAN] Deletando ${currentClusters.length} clusters e ${currentSubdims.length} subdimensões...`);

    for (const cluster of currentClusters) {
      await base44.asServiceRole.entities.FalCluster.delete(cluster.id);
    }
    for (const sub of currentSubdims) {
      await base44.asServiceRole.entities.FalSubdimension.delete(sub.id);
    }

    console.log('[CLEAN] Limpeza concluída');

    // -------------------------------------------------------
    // ETAPA 3 — ATUALIZAR DIMENSÕES
    // -------------------------------------------------------
    const dimensionIdMap = {}; // key → id
    for (const dim of currentDimensions) {
      const key = dim.key;
      const update = DIMENSION_UPDATES[key];
      if (update) {
        await base44.asServiceRole.entities.FalDimension.update(dim.id, update);
        console.log(`[DIM] Updated: ${key} → ${update.name}`);
      }
      dimensionIdMap[key] = dim.id;
    }

    // Criar dimensões faltantes
    for (const [key, dimDef] of Object.entries(DIMENSION_UPDATES)) {
      if (!dimensionIdMap[key]) {
        const tenantRef = tenant_id || currentDimensions[0]?.tenant_id || 'default';
        const created = await base44.asServiceRole.entities.FalDimension.create({
          tenant_id: tenantRef, key, name: dimDef.name, order: Object.keys(DIMENSION_UPDATES).indexOf(key),
        });
        dimensionIdMap[key] = created.id;
        console.log(`[DIM] Created missing: ${key}`);
      }
    }

    // -------------------------------------------------------
    // ETAPA 4 — CRIAR NOVAS SUBDIMENSÕES
    // -------------------------------------------------------
    const subdimIdMap = {}; // key → id
    const tenantId = tenant_id || currentDimensions[0]?.tenant_id || 'default';

    for (const sub of NEW_SUBDIMENSIONS) {
      const created = await base44.asServiceRole.entities.FalSubdimension.create({
        tenant_id: tenantId,
        dimension_key: sub.dimension_key,
        key: sub.key,
        name: sub.name,
        order: sub.order,
      });
      subdimIdMap[sub.key] = created.id;
    }

    console.log(`[SUBDIM] Created ${NEW_SUBDIMENSIONS.length} subdimensões`);

    // -------------------------------------------------------
    // ETAPA 5 — CRIAR CLUSTERS
    // -------------------------------------------------------
    const clusterIdMap = {}; // key → id

    for (const cluster of NEW_CLUSTERS) {
      const created = await base44.asServiceRole.entities.FalCluster.create({
        tenant_id: tenantId,
        dimension_key: cluster.dimension_key,
        subdimension_key: cluster.subdimension_key,
        key: cluster.key,
        name: cluster.name,
        order: cluster.order,
      });
      clusterIdMap[cluster.key] = created.id;
    }

    console.log(`[CLUSTER] Created ${NEW_CLUSTERS.length} clusters`);

    // -------------------------------------------------------
    // ETAPA 6 — MIGRAR PERGUNTAS
    // -------------------------------------------------------
    const allQuestions = await base44.asServiceRole.entities.FalQuestion.list();
    let migrated = 0;
    let already_ok = 0;
    let unmapped = 0;

    for (const q of allQuestions) {
      try {
        const dimKey = q.dimension_key || q.dimension;
        const subdimKey = q.subdimension_key || q.subdimension;

        // Check if already correctly mapped to new structure
        const isAlreadyValid = subdimKey && clusterIdMap[q.cluster_key];
        if (isAlreadyValid && NEW_SUBDIMENSIONS.find(s => s.key === subdimKey)) {
          already_ok++;
          continue;
        }

        // Try to find migration mapping
        const mapKey1 = `${dimKey}:${subdimKey}`;
        const mapKey2 = `${dimKey}:${q.cluster_key}`;
        const mapping = QUESTION_MIGRATION_MAP[mapKey1] || QUESTION_MIGRATION_MAP[mapKey2];

        if (mapping) {
          await base44.asServiceRole.entities.FalQuestion.update(q.id, {
            dimension_key: dimKey,
            subdimension_key: mapping.subdimension_key,
            cluster_key: mapping.cluster_key,
          });
          migrated++;
        } else {
          // Fallback: try to match by cluster key in new structure
          const clusterMatch = NEW_CLUSTERS.find(c => c.key === q.cluster_key);
          if (clusterMatch) {
            await base44.asServiceRole.entities.FalQuestion.update(q.id, {
              dimension_key: clusterMatch.dimension_key,
              subdimension_key: clusterMatch.subdimension_key,
              cluster_key: clusterMatch.key,
            });
            migrated++;
          } else {
            // Last resort: assign unmapped cluster
            await base44.asServiceRole.entities.FalQuestion.update(q.id, {
              cluster_key: 'cluster_nao_mapeado',
            });
            unmapped++;
            console.log(`[MIGRATE:UNMAPPED] ${q.code || q.id} — ${dimKey}:${subdimKey}`);
          }
        }
      } catch (e) {
        console.error(`[MIGRATE:ERROR] ${q.code || q.id}: ${e.message}`);
        unmapped++;
      }
    }

    console.log(`[MIGRATE] migrated=${migrated}, already_ok=${already_ok}, unmapped=${unmapped}`);

    // -------------------------------------------------------
    // ETAPA 7 — VALIDAÇÃO FINAL
    // -------------------------------------------------------
    const [finalDims, finalSubdims, finalClusters, finalQuestions] = await Promise.all([
      base44.asServiceRole.entities.FalDimension.list(),
      base44.asServiceRole.entities.FalSubdimension.list(),
      base44.asServiceRole.entities.FalCluster.list(),
      base44.asServiceRole.entities.FalQuestion.list(),
    ]);

    const questionsWithoutCluster = finalQuestions.filter(q => !q.cluster_key || q.cluster_key === 'cluster_nao_mapeado');
    const questionsWithoutSubdim = finalQuestions.filter(q => !q.subdimension_key);
    const orphanClusters = finalClusters.filter(c => !finalSubdims.find(s => s.key === c.subdimension_key));
    const orphanSubdims = finalSubdims.filter(s => !finalDims.find(d => d.key === s.dimension_key));

    const report = {
      ok: true,
      dry_run: false,
      backed_up: {
        dimensions: currentDimensions.length,
        subdimensions: currentSubdims.length,
        clusters: currentClusters.length,
      },
      final_state: {
        total_dimensions: finalDims.length,
        total_subdimensions: finalSubdims.length,
        total_clusters: finalClusters.length,
        total_questions: finalQuestions.length,
      },
      migration: {
        questions_migrated: migrated,
        questions_already_ok: already_ok,
        questions_unmapped: unmapped,
      },
      validation: {
        questions_without_cluster: questionsWithoutCluster.length,
        questions_without_subdim: questionsWithoutSubdim.length,
        orphan_clusters: orphanClusters.length,
        orphan_subdims: orphanSubdims.length,
        unmapped_list: questionsWithoutCluster.slice(0, 20).map(q => ({ id: q.id, code: q.code, dim: q.dimension_key, subdim: q.subdimension_key })),
      },
    };

    console.log('[restructureFalMatrix] DONE:', JSON.stringify(report.final_state));

    return Response.json(report);

  } catch (error) {
    console.error('[restructureFalMatrix] FATAL:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});