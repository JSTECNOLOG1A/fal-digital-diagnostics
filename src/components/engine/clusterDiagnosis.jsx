/**
 * clusterDiagnosis.js — Interpretação empresarial por cluster FAL
 * Gera leitura consultiva baseada no score observado e risco inerente.
 *
 * Entrada: { cluster_key, weighted_score, maturity_v2, inherent_risk, residual_risk }
 * Saída:   { maturity_level, main_gap, business_impact, diagnosis_summary, recommended_focus }
 */

import { formatKey } from './helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Base de conhecimento: interpretações específicas por cluster
// ─────────────────────────────────────────────────────────────────────────────

const CLUSTER_KNOWLEDGE = {
  tesouraria_cluster: {
    area: 'Tesouraria',
    gaps: {
      low:  'Ausência de conciliação bancária, fluxo de caixa e controle formal de pagamentos.',
      mid:  'Conciliação bancária existente mas sem fluxo de caixa projetado e sem segregação de pagamentos.',
      high: 'Controles de tesouraria instalados; atenção à projeção de longo prazo e automação.',
    },
    impacts: {
      low:  'Risco crítico de pagamentos indevidos, descasamento de caixa e ausência de previsibilidade financeira.',
      mid:  'Risco moderado de surpresas de caixa e dificuldade de negociação bancária por falta de projeção.',
      high: 'Risco residual baixo; foco em eficiência e automação do processo.',
    },
    focus: {
      low:  'Implantar conciliação bancária semanal, fluxo de caixa projetado de 90 dias e segregação de quem emite × quem aprova pagamentos.',
      mid:  'Estruturar projeção de caixa de 30/60/90 dias e formalizar alçadas de aprovação.',
      high: 'Automatizar conciliação e evoluir para forecast financeiro integrado.',
    },
  },

  segregacao_funcoes_cluster: {
    area: 'Segregação de Funções',
    gaps: {
      low:  'Ausência de segregação: mesma pessoa autoriza, executa e confere transações críticas.',
      mid:  'Segregação parcial; algumas funções incompatíveis ainda acumuladas em pessoas-chave.',
      high: 'Matriz de alçadas definida; monitorar acúmulos pontuais.',
    },
    impacts: {
      low:  'Risco elevado de fraude interna, erros não detectados e transações não autorizadas.',
      mid:  'Risco moderado de erros não detectados em processos críticos.',
      high: 'Risco residual baixo; monitoramento periódico da matriz.',
    },
    focus: {
      low:  'Mapear funções incompatíveis e implantar matriz de alçadas com aprovação documentada.',
      mid:  'Eliminar acúmulos de função remanescentes e formalizar alçadas por valor e tipo.',
      high: 'Revisar matriz semestralmente e auditar conformidade.',
    },
  },

  endividamento_cluster: {
    area: 'Gestão de Endividamento',
    gaps: {
      low:  'Sem controle centralizado de dívidas, covenants, vencimentos e serviço da dívida.',
      mid:  'Dívidas mapeadas mas sem controle de covenants e projeção de amortizações.',
      high: 'Controle de endividamento estruturado; atenção ao custo de capital.',
    },
    impacts: {
      low:  'Risco de inadimplência bancária, quebra de covenants e perda de acesso a crédito.',
      mid:  'Risco moderado de surpresas no serviço da dívida e desvio de covenants.',
      high: 'Risco residual baixo; foco em otimização do custo financeiro.',
    },
    focus: {
      low:  'Criar controle centralizado de dívidas com saldos, vencimentos, covenants e cronograma de amortizações.',
      mid:  'Monitorar covenants e projetar serviço da dívida vs fluxo de caixa disponível.',
      high: 'Otimizar estrutura de capital e custo médio ponderado.',
    },
  },

  receitas_faturamento_cluster: {
    area: 'Receitas e Faturamento',
    gaps: {
      low:  'Ausência de controle de faturamento, recebíveis e aging de inadimplência.',
      mid:  'Faturamento registrado mas sem aging estruturado e protocolo de cobrança.',
      high: 'Controle de receitas sólido; oportunidade de automação.',
    },
    impacts: {
      low:  'Risco de receitas não registradas, clientes inadimplentes sem cobrança e distorção do resultado.',
      mid:  'Risco moderado de perda de receita por falha no processo de cobrança.',
      high: 'Risco residual baixo; foco em automação e redução do ciclo de cobrança.',
    },
    focus: {
      low:  'Implantar controle de recebíveis com aging (30/60/90/120d) e protocolo formal de cobrança.',
      mid:  'Estruturar rotina de cobrança com responsável e formalizar conferência pedido × NF × recebimento.',
      high: 'Automatizar aging e integrar ao fluxo de caixa projetado.',
    },
  },

  controle_estoques_cluster: {
    area: 'Controle de Estoques',
    gaps: {
      low:  'Ausência de inventário físico e reconciliação física × contábil.',
      mid:  'Inventário realizado esporadicamente; sem reconciliação sistemática de divergências.',
      high: 'Controle de estoques estruturado; atenção à acurácia e perdas.',
    },
    impacts: {
      low:  'Perda de controle de ativos, distorção de custos e risco de subtração não detectada.',
      mid:  'Divergências entre estoque físico e contábil geram distorção de resultado.',
      high: 'Risco residual baixo; foco em acurácia e giro de estoque.',
    },
    focus: {
      low:  'Realizar inventário físico imediato e implantar reconciliação mensal física × contábil.',
      mid:  'Regularizar frequência do inventário e controlar formalmente perdas e quebras.',
      high: 'Automatizar controle e monitorar indicador de acurácia de estoque.',
    },
  },

  compras_cluster: {
    area: 'Gestão de Compras',
    gaps: {
      low:  'Ausência de processo formal de cotação, aprovação por alçada e conferência pedido × NF × recebimento.',
      mid:  'Cotação realizada informalmente; sem aprovação documentada e conferência sistemática.',
      high: 'Processo de compras formalizado; atenção à eficiência e poder de negociação.',
    },
    impacts: {
      low:  'Risco de sobrepreço, compras não autorizadas e pagamentos sem recebimento confirmado.',
      mid:  'Risco moderado de pagamentos divergentes e falta de rastreabilidade de compras.',
      high: 'Risco residual baixo; foco em eficiência e consolidação de fornecedores.',
    },
    focus: {
      low:  'Implantar fluxo de compras com cotação mínima (3 fornecedores), aprovação por alçada e conferência tripla.',
      mid:  'Formalizar aprovação e documentar conferência pedido × NF × recebimento.',
      high: 'Consolidar base de fornecedores e evoluir para procurement estruturado.',
    },
  },

  custos_agricolas_cluster: {
    area: 'Custos Agrícolas',
    gaps: {
      low:  'Ausência de apuração de custos por safra, cultura ou talhão.',
      mid:  'Custos apurados globalmente sem abertura por cultura e sem análise previsto × realizado.',
      high: 'Custos por cultura estruturados; oportunidade de análise por talhão.',
    },
    impacts: {
      low:  'Decisões de plantio sem base confiável, risco de atividades não rentáveis não identificadas.',
      mid:  'Risco de alocação ineficiente de recursos sem visibilidade por cultura.',
      high: 'Risco residual baixo; foco em precisão e análise por área.',
    },
    focus: {
      low:  'Estruturar apuração de custos por safra e cultura com comparativo previsto × realizado.',
      mid:  'Abrir custos por cultura e implantar análise de rentabilidade pós-safra.',
      high: 'Evoluir para custeio por talhão e integrar ao planejamento da próxima safra.',
    },
  },

  compliance_contabil_cluster: {
    area: 'Compliance Contábil',
    gaps: {
      low:  'Ausência de fechamento contábil mensal, conciliações e registro de provisões.',
      mid:  'Fechamento contábil realizado mas sem conciliação sistemática de contas.',
      high: 'Fechamento contábil regular; atenção à qualidade das provisões.',
    },
    impacts: {
      low:  'Demonstrações financeiras não confiáveis, risco de autuações e decisões baseadas em dados incorretos.',
      mid:  'Risco de ajustes tardios e balanço que não reflete posição real.',
      high: 'Risco residual baixo; foco em qualidade e tempestividade.',
    },
    focus: {
      low:  'Implantar calendário de fechamento contábil com checklist de lançamentos e conciliação de contas.',
      mid:  'Regularizar conciliação de contas do balanço e revisar provisões mensalmente.',
      high: 'Automatizar fechamento e reduzir prazo de entrega das demonstrações.',
    },
  },

  apuracao_tributos_cluster: {
    area: 'Apuração de Tributos',
    gaps: {
      low:  'Sem calendário fiscal, sem memórias de cálculo e sem controle de pagamento de guias.',
      mid:  'Apuração realizada mas sem revisão e sem controle documentado de guias.',
      high: 'Apuração tributária estruturada; atenção ao planejamento fiscal.',
    },
    impacts: {
      low:  'Risco crítico de autuações, multas e juros por atraso ou erro de apuração.',
      mid:  'Risco moderado de inconsistências tributárias e passivos não provisionados.',
      high: 'Risco residual baixo; foco em planejamento tributário e otimização.',
    },
    focus: {
      low:  'Criar calendário fiscal com todos os tributos e implantar memórias de cálculo por competência.',
      mid:  'Implantar revisão das apurações e controle de pagamentos com arquivamento por competência.',
      high: 'Evoluir para planejamento tributário proativo e revisão de enquadramento.',
    },
  },

  demonstracoes_financeiras_cluster: {
    area: 'Demonstrações Financeiras',
    gaps: {
      low:  'Ausência de produção regular de balanço, DRE e fluxo de caixa.',
      mid:  'Demonstrações produzidas mas sem revisão sistemática e entrega tempestiva.',
      high: 'Demonstrações financeiras regulares; atenção à qualidade e comparabilidade.',
    },
    impacts: {
      low:  'Risco crítico de decisões sem base, negação de crédito bancário e não conformidade legal.',
      mid:  'Risco de decisões com base em informação defasada ou não revisada.',
      high: 'Risco residual baixo; foco em análise e comunicação aos stakeholders.',
    },
    focus: {
      low:  'Implantar produção mensal de balanço, DRE e fluxo de caixa com responsável e protocolo de revisão.',
      mid:  'Estruturar calendário de entrega e revisão antes da disponibilização à administração.',
      high: 'Evoluir para análise comparativa e apresentação gerencial periódica.',
    },
  },

  contencioso_cluster: {
    area: 'Passivos Judiciais',
    gaps: {
      low:  'Sem inventário de processos judiciais, sem provisões e sem acompanhamento jurídico.',
      mid:  'Processos conhecidos mas sem classificação de risco e provisões adequadas.',
      high: 'Controle de contencioso estruturado; atenção à atualização e provisões.',
    },
    impacts: {
      low:  'Risco crítico de passivos ocultos, provisões insuficientes e surpresas financeiras em sentenças.',
      mid:  'Risco de provisões incorretas e impactos não previstos no resultado.',
      high: 'Risco residual baixo; foco em prevenção de novos passivos.',
    },
    focus: {
      low:  'Inventariar todos os processos, classificar por risco (CPC 25) e implantar provisões adequadas.',
      mid:  'Regularizar classificação de risco e revisar provisões trimestralmente com o jurídico.',
      high: 'Monitorar tendências de novos processos e implementar ações preventivas.',
    },
  },

  gestao_caixa_cluster: {
    area: 'Gestão de Caixa',
    gaps: {
      low:  'Ausência de controle de caixa, conciliação e posição diária.',
      mid:  'Controle de caixa existente mas sem conciliação diária e projeção de curto prazo.',
      high: 'Caixa controlado; evoluir para gestão ativa de liquidez.',
    },
    impacts: {
      low:  'Risco crítico de falta de liquidez inesperada, pagamentos não realizados e exposição operacional.',
      mid:  'Risco moderado de surpresas de liquidez por falta de projeção.',
      high: 'Risco residual baixo; foco em otimização de liquidez.',
    },
    focus: {
      low:  'Implantar controle de caixa diário com conciliação e posição atualizada.',
      mid:  'Estruturar projeção de curto prazo e alerta de posição mínima de caixa.',
      high: 'Otimizar aplicações e custo de capital de giro.',
    },
  },

  estrutura_societaria_cluster: {
    area: 'Estrutura Societária',
    gaps: {
      low:  'Contratos sociais desatualizados, sem acordo de sócios e titularidade não formalizada.',
      mid:  'Estrutura societária existente mas com documentação incompleta ou desatualizada.',
      high: 'Estrutura societária formalizada; atenção à governança e sucessão.',
    },
    impacts: {
      low:  'Risco jurídico de conflitos societários, insegurança contratual e dificuldade de acesso a crédito.',
      mid:  'Risco moderado de conflitos por ambiguidade em direitos e obrigações dos sócios.',
      high: 'Risco residual baixo; foco em planejamento sucessório.',
    },
    focus: {
      low:  'Atualizar contratos sociais, formalizar acordo de sócios e revisar titularidade junto à Junta Comercial.',
      mid:  'Completar documentação societária e formalizar direitos de tag-along e drag-along.',
      high: 'Estruturar planejamento sucessório e revisar holding se aplicável.',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Interpretações genéricas por faixa de score (fallback)
// ─────────────────────────────────────────────────────────────────────────────

function genericInterpretation(score, clusterLabel) {
  // Escala 0–3
  if (score < 1.8) {
    return {
      gap:    `Processo de ${clusterLabel} inexistente ou extremamente frágil, sem padronização e sem responsável definido.`,
      impact: `Risco elevado de falhas operacionais, perdas financeiras e não conformidade por ausência de controles em ${clusterLabel}.`,
      focus:  `Implantar processo mínimo de ${clusterLabel}: definir responsável, fluxo básico e periodicidade de execução.`,
    };
  }
  if (score < 2.5) {
    return {
      gap:    `Processo de ${clusterLabel} existente mas com execução inconsistente e dependência de pessoas-chave.`,
      impact: `Risco moderado de erros não detectados e resultados imprevisíveis em ${clusterLabel}.`,
      focus:  `Formalizar e padronizar ${clusterLabel}: documentar processo, treinar equipe e implantar controles periódicos.`,
    };
  }
  return {
    gap:    `${clusterLabel} com controles consolidados; oportunidade de evolução para gestão por indicadores.`,
    impact: `Risco residual baixo em ${clusterLabel}; foco em eficiência e melhoria contínua.`,
    focus:  `Evoluir ${clusterLabel} para KPIs com metas, alertas e revisão gerencial periódica.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera a interpretação empresarial para um cluster avaliado.
 *
 * @param {Object} clusterResult
 * @param {string}       clusterResult.cluster_key
 * @param {number|null}  clusterResult.weighted_score
 * @param {Object}       clusterResult.maturity_v2      - objeto maturity calculado pelo engine
 * @param {string}       clusterResult.inherent_risk    - 'critical'|'high'|'medium'|'low'
 * @param {string}       clusterResult.residual_risk    - 'critical'|'high'|'medium'|'low'
 * @param {string}       clusterResult.action_priority  - 'critical'|'high'|'medium'|'low'
 * @returns {Object} diagnosis
 */
export function generateClusterDiagnosis(clusterResult) {
  const {
    cluster_key,
    weighted_score: score,
    maturity_v2,
    inherent_risk  = 'medium',
    residual_risk  = 'medium',
    action_priority = 'medium',
  } = clusterResult;

  const knowledge     = CLUSTER_KNOWLEDGE[cluster_key];
  const clusterLabel  = knowledge?.area || formatKey(cluster_key);
  const maturityLabel = maturity_v2?.label || (score !== null ? (score < 1.0 ? 'Crítico' : score < 1.8 ? 'Básico' : score < 2.5 ? 'Estruturado' : 'Avançado') : 'Não avaliado');

  // Bands alinhados com escala 0–3: low=Crítico/Básico, mid=Estruturado, high=Avançado
  let band;
  if (score === null || score === undefined) {
    band = 'low';
  } else if (score < 1.8) {
    band = 'low';
  } else if (score < 2.5) {
    band = 'mid';
  } else {
    band = 'high';
  }

  let gap, impact, focus;

  if (knowledge) {
    gap    = knowledge.gaps[band];
    impact = knowledge.impacts[band];
    focus  = knowledge.focus[band];
  } else {
    const generic = genericInterpretation(score ?? 0, clusterLabel);
    gap    = generic.gap;
    impact = generic.impact;
    focus  = generic.focus;
  }

  const scoreDisplay   = score !== null && score !== undefined ? `${Number(score).toFixed(2)}/3.00` : 'N/R';
  const RISK_LABEL_MAP = { critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo' };

  return {
    maturity_level:     maturityLabel,
    main_gap:           gap,
    business_impact:    impact,
    recommended_focus:  focus,
    diagnosis_summary:  `${clusterLabel} — Maturidade: ${maturityLabel} (${scoreDisplay}) | Risco inerente: ${RISK_LABEL_MAP[inherent_risk] || inherent_risk} | Risco residual: ${RISK_LABEL_MAP[residual_risk] || residual_risk} | Prioridade: ${RISK_LABEL_MAP[action_priority] || action_priority}`,
  };
}

export default generateClusterDiagnosis;