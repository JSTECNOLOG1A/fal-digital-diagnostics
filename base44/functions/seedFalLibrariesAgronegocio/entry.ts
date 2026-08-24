/**
 * seedFalLibrariesAgronegocio
 * 
 * Popula as bibliotecas de recomendações e ações para o setor agronegócio.
 * Criar um conjunto inicial coeso de recomendações estratégicas + ações práticas.
 * 
 * Payload: { tenant_id }
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

// Biblioteca de recomendações por cluster
const RECOMMENDATIONS_AGRONEGOCIO = [
  // ══════════════════════════════════════════════════════════════════════════════
  // DIMENSÃO: FINANCEIRO
  // ══════════════════════════════════════════════════════════════════════════════
  {
    dimension_key: 'financeiro',
    subdimension_key: 'planejamento_financeiro',
    cluster_key: 'fluxo_caixa_semanal',
    gap_level: 0,
    sector_group: 'agronegocio',
    recommendation_title: 'Estruturar rotina formalizada de fluxo de caixa semanal',
    recommendation_description: 'O controle de caixa é inexistente ou muito fraco. Não há visibilidade de entrada/saída de recursos. Resultado: decisões financeiras sem base, inadimplência oculta e falta de planejamento.',
    implementation_steps: [
      'Designar responsável (gerente ou contador)',
      'Criar modelo padrão de fluxo de caixa (Excel ou sistema)',
      'Definir dia/hora semanal para atualização',
      'Revisar com gestor antes do fim de semana',
      'Fazer projeção de 4 semanas a frente'
    ],
    impact_level: 5,
    effort_level: 2,
    priority_weight: 1.5,
    typical_owner: 'Gerente Financeiro / Contador',
    estimated_timeframe: '30d',
    business_case: 'Visibilidade financeira reduz inadimplência, melhora planejamento de investimentos e reduz custos de capital.'
  },
  {
    dimension_key: 'financeiro',
    subdimension_key: 'planejamento_financeiro',
    cluster_key: 'fluxo_caixa_semanal',
    gap_level: 1,
    sector_group: 'agronegocio',
    recommendation_title: 'Padronizar e centralizar processo de fluxo de caixa',
    recommendation_description: 'Existe alguma forma de controle, mas é desorganizada, sem rotina ou responsável claro. Há informações em vários lugares e falta consolidação.',
    implementation_steps: [
      'Revisar o modelo atual e identificar gargalos',
      'Padronizar: um único modelo, uma única pessoa responsável',
      'Implementar checklist de atualização',
      'Integrar com sistema de contas a pagar/receber',
      'Treinar equipe'
    ],
    impact_level: 4,
    effort_level: 2,
    priority_weight: 1.3,
    typical_owner: 'Gerente Financeiro',
    estimated_timeframe: '60d',
    business_case: 'Reduz erros de consolidação, elimina trabalho duplicado e melhora confiabilidade dos dados.'
  },
  {
    dimension_key: 'financeiro',
    subdimension_key: 'planejamento_financeiro',
    cluster_key: 'fluxo_caixa_semanal',
    gap_level: 2,
    sector_group: 'agronegocio',
    recommendation_title: 'Aprimorar precisão e analisar aderência de fluxo de caixa',
    recommendation_description: 'Processo estruturado, mas faltam análises de aderência (real vs. previsto) e refinamentos na projeção.',
    implementation_steps: [
      'Implementar análise de variação mensal (real vs. previsto)',
      'Adicionar análise de sazonalidade agrícola',
      'Criar dashboard executivo de cash position',
      'Automatizar relatórios via sistema'
    ],
    impact_level: 3,
    effort_level: 3,
    priority_weight: 0.8,
    typical_owner: 'Gerente Financeiro / BI',
    estimated_timeframe: '90d',
    business_case: 'Melhora previsibilidade, reduz surpresas e otimiza aplicação de capital.'
  },

  // CONTROLE CUSTO POR HECTARE / SAFRA
  {
    dimension_key: 'financeiro',
    subdimension_key: 'analise_de_custos',
    cluster_key: 'custo_por_hectare',
    gap_level: 0,
    sector_group: 'agronegocio',
    recommendation_title: 'Estruturar sistema de custo por hectare/safra',
    recommendation_description: 'Não há controle de custos de produção por safra ou hectare. Impossível saber rentabilidade real de cada lavoura ou cultura.',
    implementation_steps: [
      'Definir estrutura de centros de custo (por cultura/fazenda)',
      'Criar modelo de alocação: insumos, mão-obra, máquinas',
      'Implementar rotina mensal de consolidação',
      'Calcular custo unitário por hectare',
      'Comparar com benchmarks setoriais'
    ],
    impact_level: 5,
    effort_level: 3,
    priority_weight: 1.4,
    typical_owner: 'Gerente Financeiro / Agrônomo',
    estimated_timeframe: '90d',
    business_case: 'Permite identificar culturas não lucrativas, reduz desperdícios e melhora mix de produção.'
  },
  {
    dimension_key: 'financeiro',
    subdimension_key: 'analise_de_custos',
    cluster_key: 'custo_por_hectare',
    gap_level: 1,
    sector_group: 'agronegocio',
    recommendation_title: 'Padronizar e automatizar coleta de dados de custo',
    recommendation_description: 'Existe controle, mas é manual, descentralizado e com inconsistências. Difícil de agregar dados.',
    implementation_steps: [
      'Centralizar coleta em responsável único',
      'Usar formulários padronizados (digital preferível)',
      'Automatizar cálculos de alocação',
      'Criar rotina mensal fixa de fechamento'
    ],
    impact_level: 4,
    effort_level: 2,
    priority_weight: 1.2,
    typical_owner: 'Contador / Gerente Financeiro',
    estimated_timeframe: '60d',
    business_case: 'Reduz tempo de consolidação, melhora acurácia e libera tempo para análise.'
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // DIMENSÃO: OPERACIONAL
  // ══════════════════════════════════════════════════════════════════════════════
  {
    dimension_key: 'operacional',
    subdimension_key: 'gestao_de_insumos',
    cluster_key: 'controle_estoque_insumos',
    gap_level: 0,
    sector_group: 'agronegocio',
    recommendation_title: 'Estruturar controle formal de estoque de insumos',
    recommendation_description: 'Não há controle de entrada/saída de insumos (fertilizantes, defensivos, sementes). Resulta em desperdício, compras duplicadas e perdas financeiras.',
    implementation_steps: [
      'Criar lista de insumos controlados por categoria',
      'Implementar sistema simples de entrada/saída (Excel ou app)',
      'Designar responsável por gestão de estoque',
      'Realizar inventário físico trimestral',
      'Definir níveis mínimo/máximo de reposição'
    ],
    impact_level: 4,
    effort_level: 2,
    priority_weight: 1.3,
    typical_owner: 'Gerente Operacional / Agrônomo',
    estimated_timeframe: '30d',
    business_case: 'Reduz desperdício de até 15%, elimina compras duplicadas e melhora planejamento de safra.'
  },
  {
    dimension_key: 'operacional',
    subdimension_key: 'gestao_de_insumos',
    cluster_key: 'controle_estoque_insumos',
    gap_level: 1,
    sector_group: 'agronegocio',
    recommendation_title: 'Padronizar rotinas de inventário e reposição',
    recommendation_description: 'Existe controle básico, mas sem rotinas formais. Inventários irregulares, falta de rastreabilidade.',
    implementation_steps: [
      'Formalizarinventário mensal (dia/responsável fixo)',
      'Criar rotina de reposição com disparo automático',
      'Rastrear validade de insumos',
      'Documentar transferências entre fazendas'
    ],
    impact_level: 3,
    effort_level: 2,
    priority_weight: 1.0,
    typical_owner: 'Gerente Operacional',
    estimated_timeframe: '60d',
    business_case: 'Reduz insumos vencidos, melhora confiabilidade de dados, facilita auditoria.'
  },

  // PLANEJAMENTO PRODUTIVO
  {
    dimension_key: 'operacional',
    subdimension_key: 'planejamento_producao',
    cluster_key: 'calendario_plantio_colheita',
    gap_level: 0,
    sector_group: 'agronegocio',
    recommendation_title: 'Estruturar calendário de plantio e colheita formalizado',
    recommendation_description: 'Não há planejamento de safra. Decisões de plantio/colheita são improvisadas, sem considerar sazonalidade, máquinas ou mão-obra.',
    implementation_steps: [
      'Criar calendário anual de culturas por fazenda',
      'Considerar: épocas de plantio, ciclo de colheita, clima',
      'Alinhar com disponibilidade de máquinas e pessoas',
      'Comunicar a operação com 2 meses de antecedência',
      'Revisar anualmente pós-colheita'
    ],
    impact_level: 5,
    effort_level: 2,
    priority_weight: 1.5,
    typical_owner: 'CEO / Diretor Operacional',
    estimated_timeframe: '30d',
    business_case: 'Maximiza utilização de máquinas, reduz custos de contratação e melhora produtividade.'
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // DIMENSÃO: CONTROLES INTERNOS
  // ══════════════════════════════════════════════════════════════════════════════
  {
    dimension_key: 'controles_internos',
    subdimension_key: 'segregacao_funcoes',
    cluster_key: 'aprovacao_despesas',
    gap_level: 0,
    sector_group: 'agronegocio',
    recommendation_title: 'Estruturar processo formal de aprovação de despesas',
    recommendation_description: 'Não há controle de quem pode gastar o quê. Resultado: despesas não autorizadas, fraudes possíveis, falta de rastreabilidade.',
    implementation_steps: [
      'Definir matriz de aprovação: quem autoriza cada tipo de gasto',
      'Implementar limite por responsável (assinatura, cheque, transferência)',
      'Criar formulário padrão de requisição',
      'Separar: solicitante ≠ aprovador ≠ pagador',
      'Documentar todas as aprovações'
    ],
    impact_level: 4,
    effort_level: 1,
    priority_weight: 1.2,
    typical_owner: 'CFO / Gerente Financeiro',
    estimated_timeframe: '30d',
    business_case: 'Reduz fraudes, melhora compliance, facilita auditoria interna/externa.'
  }
];

// Ações por pergunta (exemplos iniciais)
const QUESTION_ACTIONS_AGRONEGOCIO = [
  {
    question_id: 'gov_fluxo_caixa_semanal_existe',
    cluster_key: 'fluxo_caixa_semanal',
    dimension_key: 'financeiro',
    subdimension_key: 'planejamento_financeiro',
    trigger_score: 0,
    sector_group: 'agronegocio',
    action_type: 'implantacao',
    action_title: 'Criar modelo padrão de fluxo de caixa semanal',
    action_description: 'Desenvolver planilha ou solicitar ao sistema (se houver) um modelo que consolidé entradas e saídas de caixa para cada semana.',
    suggested_routine: 'semanal',
    impact_level: 5,
    effort_level: 2,
    responsible_role: 'Gerente Financeiro',
    evidence_requirement: 'Modelo de fluxo de caixa com dados de 4 semanas'
  },
  {
    question_id: 'gov_fluxo_caixa_semanal_existe',
    cluster_key: 'fluxo_caixa_semanal',
    dimension_key: 'financeiro',
    subdimension_key: 'planejamento_financeiro',
    trigger_score: 1,
    sector_group: 'agronegocio',
    action_type: 'correcao',
    action_title: 'Revisar e padronizar modelo de fluxo de caixa existente',
    action_description: 'Verificar se o modelo atual é claro, se inclui todas as contas e se é atualizado regularmente. Padronizar para que sempre use o mesmo modelo.',
    suggested_routine: 'semanal',
    impact_level: 4,
    effort_level: 2,
    responsible_role: 'Gerente Financeiro',
    evidence_requirement: 'Modelo revisado com histórico de 8 semanas'
  },
  {
    question_id: 'fin_custo_por_hectare_calculado',
    cluster_key: 'custo_por_hectare',
    dimension_key: 'financeiro',
    subdimension_key: 'analise_de_custos',
    trigger_score: 0,
    sector_group: 'agronegocio',
    action_type: 'implantacao',
    action_title: 'Estruturar sistema de custo por hectare',
    action_description: 'Definir como alocar insumos, mão-obra e máquinas por safra/cultura. Criar planilha ou solicitar ao sistema que calcule automaticamente o custo unitário.',
    suggested_routine: 'mensal após colheita',
    impact_level: 5,
    effort_level: 3,
    responsible_role: 'Contador / Gerente Financeiro',
    evidence_requirement: 'Relatório de custo por hectare com memória de cálculo'
  },
  {
    question_id: 'op_estoque_insumos_controlado',
    cluster_key: 'controle_estoque_insumos',
    dimension_key: 'operacional',
    subdimension_key: 'gestao_de_insumos',
    trigger_score: 0,
    sector_group: 'agronegocio',
    action_type: 'implantacao',
    action_title: 'Criar registro de entrada/saída de insumos',
    action_description: 'Implementar controle simples (Excel ou app) onde todas as entradas e saídas de insumos sejam registradas com data, quantidade e responsável.',
    suggested_routine: 'diária',
    impact_level: 4,
    effort_level: 2,
    responsible_role: 'Responsável de Armazém',
    evidence_requirement: 'Registro de movimentação de insumos com lacunas < 2 dias'
  }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // ── SEG-02: HQ-only — seed functions operate on global methodology data ──
    if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: HQ admin only' }, { status: 403 });

    const body = await req.json();
    const { tenant_id } = body;
    if (!tenant_id) return Response.json({ error: 'tenant_id required' }, { status: 400 });

    console.log(`[seedFalLibrariesAgronegocio] Starting for tenant ${tenant_id}...`);

    // Preparar dados com tenant_id
    const recsWithTenant = RECOMMENDATIONS_AGRONEGOCIO.map(r => ({ ...r, tenant_id }));
    const actionsWithTenant = QUESTION_ACTIONS_AGRONEGOCIO.map(a => ({ ...a, tenant_id }));

    // Criar recomendações
    let recCount = 0;
    for (const rec of recsWithTenant) {
      try {
        await base44.asServiceRole.entities.FalRecommendationLibrary.create(rec);
        recCount++;
      } catch (e) {
        console.warn(`[seedFalLibrariesAgronegocio] Failed to create rec: ${rec.cluster_key} lvl ${rec.gap_level}`, e.message);
      }
    }

    // Criar ações
    let actionCount = 0;
    for (const action of actionsWithTenant) {
      try {
        await base44.asServiceRole.entities.FalQuestionActionLibrary.create(action);
        actionCount++;
      } catch (e) {
        console.warn(`[seedFalLibrariesAgronegocio] Failed to create action: ${action.action_title}`, e.message);
      }
    }

    console.log(`[seedFalLibrariesAgronegocio] Done: ${recCount} recommendations, ${actionCount} actions`);

    return Response.json({
      success: true,
      recommendations_created: recCount,
      actions_created: actionCount,
      total: recCount + actionCount,
    });
  } catch (error) {
    console.error('[seedFalLibrariesAgronegocio] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});