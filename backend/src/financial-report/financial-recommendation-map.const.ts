/**
 * Mapeamento finding_type → recomendação mínima — porta de
 * RECOMMENDATION_MAP em base44/functions/generateFinancialRecommendations,
 * ajustado à lista de finding_type que o detector local
 * (financial-finding-detector.util.ts) efetivamente produz.
 */
export interface RecommendationMapping {
  types: string[];
  title: string;
  description: string;
  priority: 'critica' | 'alta' | 'media' | 'baixa';
  horizon: '30d' | '60d' | '90d';
  area: string;
}

export const RECOMMENDATION_MAP: RecommendationMapping[] = [
  {
    types: ['liquidez_corrente_baixa'],
    title: 'Revisar capital de giro e obrigações de curto prazo',
    description: 'Recomenda-se revisar a composição do ativo circulante e do passivo circulante, priorizando renegociação de obrigações de curto prazo, aceleração de recebíveis e controle de desembolsos recorrentes.',
    priority: 'alta', horizon: '30d', area: 'Financeiro / Tesouraria',
  },
  {
    types: ['liquidez_seca_critica'],
    title: 'Reduzir dependência de estoques para cobertura de curto prazo',
    description: 'Avaliar giro de estoques, aging, liquidez real dos ativos circulantes e necessidade de conversão mais rápida em caixa.',
    priority: 'media', horizon: '60d', area: 'Financeiro / Operações',
  },
  {
    types: ['endividamento_elevado'],
    title: 'Reavaliar estrutura de capital e dependência de terceiros',
    description: 'Analisar composição da dívida, custo financeiro, vencimentos, garantias e alternativas de alongamento ou recomposição de capital próprio.',
    priority: 'alta', horizon: '60d', area: 'Controladoria / Diretoria Financeira',
  },
  {
    types: ['pl_negativo', 'kanitz_pl_negativo_cautela'],
    title: 'Diagnosticar recomposição patrimonial e solvência',
    description: 'Realizar análise específica do patrimônio líquido negativo, prejuízos acumulados, estrutura do passivo e capacidade de geração de caixa para recomposição de solvência. Não afirmar insolvência conclusiva — usar linguagem de cautela.',
    priority: 'critica', horizon: '30d', area: 'Diretoria / Controladoria',
  },
  {
    types: ['dfc_ausente_periodos'],
    title: 'Importar períodos comparáveis para geração da DFC',
    description: 'Providenciar balancete comparativo com pelo menos dois períodos para permitir a geração da DFC indireta e a leitura de geração/consumo de caixa.',
    priority: 'media', horizon: '30d', area: 'Contabilidade / Controladoria',
  },
  {
    types: ['resultado_liquido_negativo'],
    title: 'Analisar causas do prejuízo e plano de reversão',
    description: 'Abrir composição do resultado, margens, despesas financeiras, despesas operacionais e eventos não recorrentes para definir plano de reversão de resultado.',
    priority: 'alta', horizon: '60d', area: 'Controladoria / Diretoria',
  },
  {
    types: ['kanitz_critico'],
    title: 'Aprofundar diagnóstico de solvência e capacidade de continuidade',
    description: 'Executar análise integrada de solvência, endividamento, fluxo de caixa projetado, capacidade de pagamento e plano de recomposição de capital.',
    priority: 'critica', horizon: '30d', area: 'Diretoria / Controladoria',
  },
  {
    types: ['comparison_liquidez_corrente'],
    title: 'Revisar deterioração da liquidez corrente',
    description: 'Elaborar plano de recomposição de capital de giro, revisar vencimentos de curto prazo, aging de recebíveis, estoques e fluxo de caixa projetado.',
    priority: 'alta', horizon: '30d', area: 'Financeiro / Tesouraria',
  },
  {
    types: ['comparison_liquidez_seca'],
    title: 'Revisar deterioração da liquidez seca',
    description: 'Avaliar giro e qualidade dos estoques, aging de recebíveis e plano de conversão de ativos circulantes em caixa.',
    priority: 'media', horizon: '60d', area: 'Financeiro / Operações',
  },
  {
    types: ['comparison_capital_terceiros_sobre_pl'],
    title: 'Reavaliar evolução da dependência de capital de terceiros',
    description: 'Mapear composição do endividamento, custo financeiro, vencimentos, garantias e alternativas de alongamento ou recomposição patrimonial.',
    priority: 'alta', horizon: '60d', area: 'Controladoria / Diretoria Financeira',
  },
  {
    types: ['comparison_patrimonio_liquido'],
    title: 'Definir plano de recomposição patrimonial',
    description: 'Analisar composição do patrimônio líquido, prejuízos acumulados, necessidade de aporte, retenção de resultados, renegociação de passivos e plano de reversão operacional.',
    priority: 'critica', horizon: '30d', area: 'Diretoria / Controladoria',
  },
  {
    types: ['comparison_resultado_liquido'],
    title: 'Analisar deterioração do resultado líquido entre períodos',
    description: 'Abrir composição do resultado entre os períodos (receitas, custos, despesas operacionais e financeiras) para identificar causas da piora e definir plano de reversão de resultado.',
    priority: 'alta', horizon: '60d', area: 'Controladoria / Diretoria',
  },
  {
    types: ['comparison_kanitz_fator_insolvencia'],
    title: 'Aprofundar diagnóstico de solvência e capacidade de continuidade',
    description: 'Executar análise integrada de solvência, endividamento, fluxo de caixa projetado, capacidade de pagamento e plano de recomposição de capital.',
    priority: 'critica', horizon: '30d', area: 'Diretoria / Controladoria',
  },
];

export function findRecommendationMapping(findingType: string): RecommendationMapping | null {
  return RECOMMENDATION_MAP.find((m) => m.types.includes(findingType)) ?? null;
}
