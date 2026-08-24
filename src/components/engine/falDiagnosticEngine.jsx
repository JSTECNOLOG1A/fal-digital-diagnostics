/**
 * falDiagnosticEngine.js — Motor Analítico Central do FAL (Frontend)
 *
 * ESCALA OFICIAL: 0–3 (FalResponse.score — alinhado com backend computeFalDiagnostic)
 * HIERARQUIA: Pergunta → Cluster → Subdimensão → Dimensão → Score Geral
 *
 * CAMPOS OFICIAIS DO BANCO:
 *   question.dimension_key
 *   question.subdimension_key
 *   question.cluster_key
 *   question.question_weight
 *
 * Aceita fallback defensivo: question.dimension_key ?? question.dimension
 * para compatibilidade com respostas legadas.
 */

import { safeNum, round2, weightedAverage, groupBy, formatKey } from './helpers';
import { getMaturityLevel, scoreToMaturityIndex } from '../config/maturityConfig';
import { getInherentRisk, RISK_LEVELS, getClusterRiskInfo } from '../config/clusterRiskConfig';
import { calculateMaturity } from '../config/maturityLevels';
import { calculateResidualRisk, calculateActionPriority, getInherentRisk as getInherentRiskV2 } from '../config/clusterInherentRisk';
import { generateClusterDiagnosis } from './clusterDiagnosis';
import { detectSystemicWeaknesses, generateFindings } from './systemicAnalysis';

// ESCALA OFICIAL: 0–3 — alinhada com questionário (QuestionCard: 0,1,2,3)
// e com computeFalDiagnostic backend (score_range_max: 3).
export const SCORE_MAX = 3;

const CANONICAL_DIMENSIONS = [
  { key: 'governanca',         label: 'Governança' },
  { key: 'juridico',           label: 'Jurídico / Societário' },
  { key: 'controles_internos', label: 'Controles Internos' },
  { key: 'financeiro',         label: 'Financeiro' },
  { key: 'contabil',           label: 'Contábil' },
  { key: 'tributario',         label: 'Fiscal / Tributário' },
  { key: 'operacional',        label: 'Operacional' },
  { key: 'sistemas',           label: 'Tecnologia / Sistemas' },
];

function qDimension(q) {
  return q.dimension ?? q.dimension_key ?? null;
}

function qSubdimension(q) {
  return q.subdimension ?? q.subdimension_key ?? null;
}

function countAnswered(questions, responseMap) {
  return questions.filter(q => {
    const r = responseMap?.get(q.id);
    return r !== undefined && r !== null && r.score !== undefined && r.score !== null;
  }).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. calculateClusterScore
// ─────────────────────────────────────────────────────────────────────────────
export function calculateClusterScore(questions, responseMap) {
  const emptyResult = {
    raw_score: null, weighted_score: null,
    answered_questions: 0, total_questions: questions?.length ?? 0,
    completion_rate: 0, has_killer_fail: false, items: [],
  };

  if (!questions || questions.length === 0) return emptyResult;

  const items = [];
  let answeredCount = 0;
  let hasKillerFail = false;

  for (const q of questions) {
    const resp = responseMap ? responseMap.get(q.id) : undefined;
    if (resp !== undefined && resp !== null && resp.score !== undefined && resp.score !== null) {
      const score  = Math.min(SCORE_MAX, Math.max(0, safeNum(resp.score, 0)));
      const weight = safeNum(q.question_weight, 1);
      items.push({ value: score, weight, question_id: q.id });
      answeredCount++;
      if (q.is_killer_question === true && score <= 1) hasKillerFail = true;
    }
  }

  if (answeredCount === 0) return { ...emptyResult, total_questions: questions.length };

  let weightedScore = weightedAverage(items);
  const rawScore = weightedAverage(items.map(i => ({ value: i.value, weight: 1 })));

  // Killer question cap: em escala 0–3, o cap equivale a 2.0 (mesmo que backend: killer_question_cap=2.0)
  if (hasKillerFail && weightedScore > 2.0) weightedScore = 2.0;

  return {
    raw_score: round2(rawScore),
    weighted_score: round2(weightedScore),
    answered_questions: answeredCount,
    total_questions: questions.length,
    completion_rate: round2(answeredCount / questions.length),
    has_killer_fail: hasKillerFail,
    items,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. calculateSubdimensionScore
// ─────────────────────────────────────────────────────────────────────────────
export function calculateSubdimensionScore(questions, responseMap) {
  if (!questions || questions.length === 0) return _emptySubdimResult();

  const byCluster = groupBy(questions, q => q.cluster_key || '_none');
  const clusterResults = {};
  const clusterItems   = [];

  for (const [clusterKey, clusterQs] of byCluster.entries()) {
    const result = calculateClusterScore(clusterQs, responseMap);
    clusterResults[clusterKey] = { ...result, cluster_key: clusterKey };

    if (result.weighted_score !== null) {
      const clusterWeight = clusterQs.reduce((s, q) => s + safeNum(q.question_weight, 1), 0);
      clusterItems.push({ value: result.weighted_score, weight: Math.max(clusterWeight, 1) });
    }
  }

  if (clusterItems.length === 0) return _emptySubdimResult(clusterResults, questions.length);

  const score    = round2(weightedAverage(clusterItems));
  const maturity = getMaturityLevel(score);
  const answered = countAnswered(questions, responseMap);

  return {
    score, maturity,
    answered_questions: answered,
    total_questions: questions.length,
    completion_rate: questions.length > 0 ? round2(answered / questions.length) : 0,
    cluster_results: clusterResults,
  };
}

function _emptySubdimResult(clusterResults = {}, totalQs = 0) {
  return { score: null, maturity: null, answered_questions: 0, total_questions: totalQs, completion_rate: 0, cluster_results: clusterResults };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. calculateDimensionScore
// ─────────────────────────────────────────────────────────────────────────────
export function calculateDimensionScore(questions, responseMap, dimensionKey) {
  if (!questions || questions.length === 0) return _emptyDimResult(dimensionKey);

  const bySubdim = groupBy(questions, q => qSubdimension(q) || '_none');
  const subdimResults = {};
  const subdimItems   = [];

  for (const [subdimKey, subdimQs] of bySubdim.entries()) {
    const result = calculateSubdimensionScore(subdimQs, responseMap);
    subdimResults[subdimKey] = { ...result, subdimension_key: subdimKey };

    if (result.score !== null) {
      const subdimWeight = subdimQs.reduce((s, q) => s + safeNum(q.question_weight, 1), 0);
      subdimItems.push({ value: result.score, weight: Math.max(subdimWeight, 1) });
    }
  }

  if (subdimItems.length === 0) return _emptyDimResult(dimensionKey, subdimResults, questions.length);

  let score = weightedAverage(subdimItems);

  // Dominância de risco (escala 0–3): cluster crítico (≤0.5) limita teto da dimensão a 2.5
  // Alinhado com backend: risk_dominance_cluster_threshold=2.0, risk_dominance_dimension_cap=2.5
  const allClusterScores = Object.values(subdimResults)
    .flatMap(s => Object.values(s.cluster_results || {}))
    .map(c => c.weighted_score)
    .filter(s => s !== null && s !== undefined);

  if (allClusterScores.length > 0) {
    const clusterMin = Math.min(...allClusterScores);
    if (clusterMin < 2.0 && score > 2.5) score = 2.5;
  }

  score = round2(score);
  const maturity = getMaturityLevel(score);
  const dimInfo  = CANONICAL_DIMENSIONS.find(d => d.key === dimensionKey);
  const answered = countAnswered(questions, responseMap);

  return {
    dimension_key: dimensionKey,
    dimension_label: dimInfo?.label || formatKey(dimensionKey),
    score, maturity,
    answered_questions: answered,
    total_questions: questions.length,
    completion_rate: questions.length > 0 ? round2(answered / questions.length) : 0,
    subdimension_results: subdimResults,
    active: true,
  };
}

function _emptyDimResult(dimensionKey, subdimResults = {}, totalQs = 0) {
  const dimInfo = CANONICAL_DIMENSIONS.find(d => d.key === dimensionKey);
  return {
    dimension_key: dimensionKey,
    dimension_label: dimInfo?.label || formatKey(dimensionKey),
    score: null, maturity: null,
    answered_questions: 0, total_questions: totalQs, completion_rate: 0,
    subdimension_results: subdimResults, active: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. calculateOverallAssessmentScore
// ─────────────────────────────────────────────────────────────────────────────
export function calculateOverallAssessmentScore(dimensionResults) {
  if (!dimensionResults || dimensionResults.length === 0) {
    return { score: null, maturity: null, completion_rate: 0, maturity_index: 0 };
  }

  const activeDims = dimensionResults.filter(d => d.active && d.score !== null);
  if (activeDims.length === 0) {
    return { score: null, maturity: null, completion_rate: 0, maturity_index: 0 };
  }

  const items = activeDims.map(d => ({
    value:  d.score,
    weight: Math.max(safeNum(d.answered_questions, 0), 1),
  }));

  const score          = round2(weightedAverage(items));
  const maturity       = getMaturityLevel(score);
  const maturity_index = scoreToMaturityIndex(score);

  const totalQs    = dimensionResults.reduce((s, d) => s + safeNum(d.total_questions, 0), 0);
  const answeredQs = dimensionResults.reduce((s, d) => s + safeNum(d.answered_questions, 0), 0);
  const completion_rate = totalQs > 0 ? round2(answeredQs / totalQs) : 0;

  return { score, maturity, completion_rate, maturity_index };
}

export function calculateMaturityLevel(score) {
  return getMaturityLevel(score);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. calculateClusterRiskPriority
// ─────────────────────────────────────────────────────────────────────────────
export function calculateClusterRiskPriority(clusterKey, score) {
  const inherentRiskLevel = getInherentRisk(clusterKey);
  const riskInfo          = RISK_LEVELS[inherentRiskLevel] || RISK_LEVELS.medium;
  const multiplier        = riskInfo.priority_multiplier;

  // Normaliza 0–3 para 0–1 para cálculo de prioridade
  const normalizedScore = (score !== null && score !== undefined && !isNaN(score))
    ? Math.max(0, Math.min(1, score / SCORE_MAX))
    : 0;

  const priority_score = round2(multiplier * (1 - normalizedScore));

  let priority;
  if (priority_score >= 3.5)      priority = 'critical';
  else if (priority_score >= 2.5) priority = 'high';
  else if (priority_score >= 1.5) priority = 'medium';
  else                            priority = 'low';

  const scoreLabel = (score !== null && score !== undefined) ? score.toFixed(2) : 'N/R';
  const rationale  = `Risco inerente ${riskInfo.label} + score ${scoreLabel}/3.00 → prioridade ${RISK_LEVELS[priority]?.label || priority}`;

  return {
    cluster_key: clusterKey, inherent_risk: inherentRiskLevel,
    risk_label: riskInfo.label, priority,
    priority_label: RISK_LEVELS[priority]?.label || priority,
    priority_score, rationale,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. generateActionPlan
// ─────────────────────────────────────────────────────────────────────────────
export function generateActionPlan(assessmentResults) {
  if (!assessmentResults?.clusters) return [];

  const actions = [];

  for (const cluster of assessmentResults.clusters) {
    const { cluster_key, dimension_key, subdimension_key, weighted_score: score } = cluster;

    if (score !== null && score !== undefined && score >= 3.0) continue;

    const riskPriority = calculateClusterRiskPriority(cluster_key, score);
    const maturity     = getMaturityLevel(score);
    const clusterLabel = formatKey(cluster_key);
    const dimLabel     = CANONICAL_DIMENSIONS.find(d => d.key === dimension_key)?.label || formatKey(dimension_key);
    const template     = _getActionTemplate(cluster_key, maturity?.level ?? 0, clusterLabel, dimLabel);

    const horizonMap = { critical: '30d', high: '60d', medium: '90d', low: '180d' };
    const suggested_deadline = horizonMap[riskPriority.priority] || '90d';
    const complexity = (maturity?.level ?? 0) <= 1 ? 'alta' : (maturity?.level ?? 0) <= 2 ? 'média' : 'baixa';

    actions.push({
      cluster_key, cluster_label: clusterLabel,
      dimension: dimension_key, dimension_label: dimLabel,
      subdimension: subdimension_key,
      current_score: score, current_maturity: maturity?.label || 'N/A',
      priority: riskPriority.priority, priority_label: riskPriority.priority_label,
      priority_score: riskPriority.priority_score,
      action_title: template.title, action_description: template.description,
      expected_impact: template.expected_impact,
      suggested_deadline, implementation_complexity: complexity,
      rationale: riskPriority.rationale,
    });
  }

  return actions.sort((a, b) => b.priority_score - a.priority_score);
}

function _getActionTemplate(clusterKey, maturityLevel, clusterLabel, dimLabel) {
  const SPECIFIC_TEMPLATES = {
    tesouraria_cluster: {
      title: 'Estruturar controles de tesouraria: conciliação bancária, segregação de pagamentos e fluxo de caixa projetado',
      description: 'Implantar rotina semanal de conciliação bancária (extrato vs registros internos), segregar as funções de quem emite o pagamento de quem aprova, e criar projeção de fluxo de caixa de curto prazo (30/60/90 dias) com responsável definido, revisão periódica e alerta de posição mínima.',
      expected_impact: 'Eliminação de risco de pagamentos indevidos, redução de desvios de caixa não detectados e base confiável para tomada de decisão financeira.',
    },
    compras_cluster: {
      title: 'Formalizar o ciclo completo de compras: requisição formal, cotação comparativa (mín. 3), aprovação por alçada e conferência pedido × NF × recebimento',
      description: 'Implantar fluxo formal de compras com: (1) requisição interna documentada com justificativa e centro de custo; (2) cotação mínima de 3 fornecedores com comparativo; (3) aprovação por alçada definida em matriz; (4) conferência tripla: pedido × nota fiscal × recebimento físico. Definir responsáveis em cada etapa.',
      expected_impact: 'Redução de compras não autorizadas, pagamentos sem entrega confirmada, e melhora no poder de negociação com fornecedores.',
    },
    controle_estoques_cluster: {
      title: 'Implantar controle de estoques com inventário físico periódico, reconciliação física × contábil e controle formal de perdas',
      description: 'Estabelecer: (1) inventário físico periódico (mínimo trimestral, idealmente mensal para itens críticos); (2) reconciliação entre estoque físico e sistema/planilha; (3) categorização e registro formal de perdas, quebras e divergências; (4) indicador de acurácia de estoque com plano de ação para desvios acima de 2%.',
      expected_impact: 'Aumento da acurácia do estoque, redução de perdas não identificadas e base confiável para reposição e custeio.',
    },
    custos_agricolas_cluster: {
      title: 'Estruturar apuração de custos agrícolas por safra, cultura e talhão com análise previsto × realizado',
      description: 'Criar estrutura de apuração de custo por: (1) safra (ciclo produtivo); (2) cultura (soja, milho, etc.); (3) talhão ou área (quando aplicável). Incluir rateio de insumos, mão de obra, depreciação de máquinas e serviços de terceiros. Implantar comparativo previsto vs realizado ao final de cada safra para suporte à decisão de plantio da próxima.',
      expected_impact: 'Visibilidade real da rentabilidade por atividade e área, suporte à decisão de alocação de recursos e identificação de desvios operacionais por safra.',
    },
    receitas_faturamento_cluster: {
      title: 'Formalizar controle de receitas, faturamento e conciliação de recebíveis com aging e protocolo de cobrança',
      description: 'Implantar: (1) rotina de conferência entre pedidos emitidos, NFs emitidas e valores recebidos; (2) controle de inadimplência com aging de recebíveis (30/60/90/120+d); (3) protocolo formal de cobrança com responsável e prazo de acionamento; (4) garantia de que toda receita seja registrada no período de competência correto.',
      expected_impact: 'Redução de receitas não registradas, controle real do fluxo de recebimentos e melhoria na previsibilidade de caixa.',
    },
    endividamento_cluster: {
      title: 'Criar controle centralizado de dívidas: saldos, covenants, vencimentos e cronograma de amortizações',
      description: 'Mapear todas as operações de crédito ativas e consolidar em planilha ou sistema com: saldos atualizados, taxas, vencimentos, covenants contratuais e garantias oferecidas. Criar alerta antecipado de vencimentos (30/60d) e rotina mensal de projeção do serviço da dívida vs fluxo de caixa disponível.',
      expected_impact: 'Prevenção de inadimplência bancária, controle do custo financeiro real e visibilidade do comprometimento do fluxo de caixa com dívidas.',
    },
    segregacao_funcoes_cluster: {
      title: 'Implementar matriz de segregação de funções e alçadas: quem autoriza não executa, quem executa não confere',
      description: 'Mapear funções incompatíveis nos processos críticos (compras, pagamentos, faturamento, estoque, folha). Formalizar matriz de alçadas por valor e tipo de transação. Garantir que aprovação seja documentada e rastreável. Identificar e tratar acúmulos de função em pessoas-chave que representem risco de fraude ou erro não detectado.',
      expected_impact: 'Redução significativa do risco de fraude interna, erros não detectados e decisões não autorizadas nos processos críticos.',
    },
    gestao_imobilizado_cluster: {
      title: 'Implantar controle do imobilizado com inventário físico, depreciação mensal e formalização de aquisições, transferências e baixas',
      description: 'Realizar inventário físico dos ativos imobilizados e reconciliar com registros contábeis. Apurar e registrar depreciação mensal conforme CPC 27 / legislação fiscal. Formalizar os processos de aquisição (aprovação e capitalização), transferência entre unidades e baixa de bens (documentação e NF de alienação/sucata).',
      expected_impact: 'Base patrimonial confiável, compliance contábil e fiscal, e suporte à decisão de renovação e alienação de ativos.',
    },
    compliance_contabil_cluster: {
      title: 'Regularizar conformidade contábil: calendário de fechamento, lançamentos obrigatórios, conciliações e revisão de provisões',
      description: 'Implantar calendário mensal de fechamento contábil com checklist de lançamentos obrigatórios, conciliação das contas do balanço (contas a pagar, receber, caixa, estoques) e revisão de provisões. Garantir que o balancete reflita a posição real da empresa antes da entrega às partes interessadas.',
      expected_impact: 'Demonstrações financeiras confiáveis, redução de ajustes tardios e base sólida para análise gerencial e fiscal.',
    },
    apuracao_tributos_cluster: {
      title: 'Estruturar processo formal de apuração tributária: calendário fiscal, memórias de cálculo e conferência de guias',
      description: 'Criar calendário fiscal com todos os tributos e datas de vencimento (ICMS, PIS/COFINS, IR, CSLL, INSS, FGTS). Definir responsável pela apuração e revisão. Documentar memórias de cálculo por tributo. Implantar controle de pagamentos com conferência de guias vs apuração e arquivamento organizado por competência.',
      expected_impact: 'Eliminação do risco de autuações por atraso ou erro de apuração, redução de multas e juros, e base para planejamento tributário.',
    },
    tributario_agro_especifico_cluster: {
      title: 'Estruturar tributação da atividade rural: LCDPR completo, lastro documental e segregação atividade rural × pessoa física',
      description: 'Organizar o Livro Caixa Digital do Produtor Rural (LCDPR) com lançamentos completos e tempestivos. Garantir lastro documental para todas as operações (NFs de insumos, vendas e serviços). Segregar contabilmente a atividade rural da pessoa física/holding. Verificar enquadramento correto (Lucro Real, Presumido ou imunidade constitucional rural) e revisar benefícios fiscais aplicáveis.',
      expected_impact: 'Conformidade fiscal da atividade rural, redução do risco de glosa pela Receita Federal e aproveitamento correto de benefícios tributários agrícolas.',
    },
    contencioso_cluster: {
      title: 'Criar controle centralizado de passivos judiciais com classificação por risco, provisões e rotina de atualização',
      description: 'Mapear todos os processos em andamento (trabalhistas, cíveis, fiscais, ambientais). Classificar por valor, instância e probabilidade de perda (CPC 25: provável, possível, remota). Incluir provisões adequadas nas demonstrações financeiras. Implantar rotina trimestral de atualização com o jurídico e comunicação à administração.',
      expected_impact: 'Visibilidade real da exposição jurídica, provisões corretas no balanço e prevenção de surpresas financeiras em decisões desfavoráveis.',
    },
    estrutura_societaria_cluster: {
      title: 'Revisar e documentar a estrutura societária: contratos sociais, acordos de sócios e titularidade atualizada',
      description: 'Atualizar contratos e estatutos sociais. Documentar acordos de sócios formalmente (direitos, obrigações, tag-along, drag-along). Revisar quadro societário nos cartórios/Junta Comercial. Garantir que a estrutura reflete a realidade operacional e atende às exigências de governança, proteção patrimonial e planejamento sucessório.',
      expected_impact: 'Segurança jurídica na operação, prevenção de conflitos societários e base para estruturação de holding ou planejamento sucessório.',
    },
    demonstracoes_financeiras_cluster: {
      title: 'Regularizar produção periódica das demonstrações financeiras: balanço, DRE e fluxo de caixa',
      description: 'Definir calendário de fechamento contábil mensal/trimestral. Nomear responsável pela produção das demonstrações (balanço patrimonial, DRE e fluxo de caixa). Implantar protocolo de revisão antes da entrega à administração e arquivamento organizado por exercício.',
      expected_impact: 'Base confiável para decisões estratégicas, acesso a crédito bancário, suporte à governança e conformidade com exigências legais e de auditoria.',
    },
    estrutura_governanca_cluster: {
      title: 'Implementar estrutura mínima de governança: reuniões periódicas, matriz de alçadas e documentação de decisões',
      description: 'Formalizar calendário de reuniões gerenciais (mínimo mensal) com pauta, ata e registro de decisões. Definir e documentar a matriz de alçadas por valor e tipo de decisão (operacional, financeira, estratégica). Garantir que sócios/diretores recebam informações gerenciais periodicamente e de forma padronizada.',
      expected_impact: 'Decisões mais rápidas e documentadas, redução de conflitos por indefinição de papéis e base para evolução da governança corporativa.',
    },
    gestao_riscos_cluster: {
      title: 'Criar mapeamento de riscos operacionais, financeiros e estratégicos com controles mitigadores e responsáveis',
      description: 'Identificar os principais riscos do negócio por categoria (operacionais, financeiros, jurídicos, de mercado, climáticos). Classificar por probabilidade e impacto. Definir controles mitigadores e responsáveis para os riscos críticos. Revisar semestralmente e comunicar à administração.',
      expected_impact: 'Antecipação de eventos adversos, redução de perdas não previstas e melhoria na resiliência operacional da empresa.',
    },
  };

  if (SPECIFIC_TEMPLATES[clusterKey]) return SPECIFIC_TEMPLATES[clusterKey];

  const GENERIC_BY_LEVEL = {
    0: {
      title: `Implantar o processo de ${clusterLabel} do zero`,
      description: `Definir responsável, fluxo básico documentado, periodicidade mínima de execução e checklist inicial para o processo de ${clusterLabel} em ${dimLabel}. Começar pelo mínimo necessário para eliminar o vazio de controle.`,
      expected_impact: `Eliminação do vazio de controle em ${clusterLabel}, reduzindo exposição operacional, financeira e de conformidade da empresa.`,
    },
    1: {
      title: `Formalizar e padronizar o processo de ${clusterLabel}`,
      description: `Documentar o processo atual de ${clusterLabel} com procedimento escrito, responsáveis nomeados e treinamento da equipe envolvida. Reduzir dependência de pessoas-chave com registro das etapas e critérios de execução.`,
      expected_impact: `Redução de dependência de pessoas-chave e maior consistência e previsibilidade na execução de ${clusterLabel}.`,
    },
    2: {
      title: `Fortalecer rastreabilidade e controles periódicos em ${clusterLabel}`,
      description: `Implementar controles periódicos com evidências documentais em ${clusterLabel}, revisão sistemática de desvios e rotina de conferência. Garantir que erros sejam detectados no mesmo ciclo em que ocorrem.`,
      expected_impact: `Maior confiabilidade das informações geradas em ${clusterLabel}, redução de erros não detectados e maior eficiência operacional.`,
    },
    3: {
      title: `Evoluir ${clusterLabel} para gestão por indicadores`,
      description: `Definir KPIs para ${clusterLabel}, implementar dashboard de acompanhamento gerencial e rotina de análise de desvios com ação corretiva documentada.`,
      expected_impact: `Gestão proativa e mensurável de ${clusterLabel} com melhoria contínua baseada em dados.`,
    },
  };

  return GENERIC_BY_LEVEL[Math.min(maturityLevel, 3)] || GENERIC_BY_LEVEL[1];
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. generateExecutiveSummary
// ─────────────────────────────────────────────────────────────────────────────
export function generateExecutiveSummary(assessmentResults) {
  const { overall, dimensions, clusters, action_plan, system_findings } = assessmentResults;

  if (!overall || overall.score === null) {
    return {
      overall_score: null, maturity: null,
      top_strengths: [], top_gaps: [], critical_risks: [], top_priorities: [],
      executive_narrative: 'Diagnóstico incompleto — responda as perguntas do questionário para gerar o resumo executivo.',
    };
  }

  const activeDims = (dimensions || []).filter(d => d.active && d.score !== null);

  const top_strengths = [...activeDims].sort((a, b) => b.score - a.score).slice(0, 3)
    .map(d => ({ dimension: d.dimension_key, label: d.dimension_label, score: d.score, maturity: d.maturity?.label }));

  const top_gaps = [...activeDims].sort((a, b) => a.score - b.score).slice(0, 3)
    .map(d => ({ dimension: d.dimension_key, label: d.dimension_label, score: d.score, maturity: d.maturity?.label }));

  const critical_risks = (clusters || [])
    .filter(c => c.weighted_score !== null && c.weighted_score !== undefined && c.weighted_score <= 1.8)
    .map(c => {
      const riskInfo = getClusterRiskInfo(c.cluster_key);
      return { cluster_key: c.cluster_key, cluster_label: formatKey(c.cluster_key), dimension_key: c.dimension_key, score: c.weighted_score, inherent_risk: riskInfo.level, risk_label: riskInfo.label };
    })
    .filter(c => ['critical', 'high'].includes(c.inherent_risk))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  const top_priorities = (action_plan || []).slice(0, 5).map(a => ({
    cluster_key: a.cluster_key, cluster_label: a.cluster_label,
    priority: a.priority, priority_label: a.priority_label,
    action_title: a.action_title, suggested_deadline: a.suggested_deadline,
  }));

  const score         = overall.score;
  const maturityLabel = overall.maturity?.label || 'N/A';
  const completionPct = Math.round((overall.completion_rate || 0) * 100);
  const critCount     = critical_risks.length;
  const scoreDisplay  = `${score.toFixed(2)}/3.00`;

  const paragraph1 = `A empresa apresenta maturidade de gestão no nível ${maturityLabel} (score ${scoreDisplay}), com ${completionPct}% do diagnóstico respondido. ${
    score < 1.0 ? 'O nível atual indica fragilidades estruturais críticas que comprometem a confiabilidade dos controles e a previsibilidade operacional.'
    : score < 1.8 ? 'O nível atual indica controles básicos existentes, porém frágeis e com alta dependência de pessoas-chave.'
    : score < 2.5 ? 'O nível atual indica controles implementados, porém com inconsistências e oportunidades de padronização.'
    : 'O nível atual demonstra maturidade avançada, com foco em otimização e disseminação de boas práticas.'
  }`;

  let paragraph2 = '';
  if (top_gaps.length > 0) {
    const gapLabels = top_gaps.map(g => `${g.label} (${g.score?.toFixed(2) ?? 'N/R'})`).join(', ');
    paragraph2 = `As dimensões com maior gap de maturidade são ${gapLabels}. Estas áreas representam os pontos de maior exposição a risco gerencial, financeiro ou operacional e devem ser priorizadas no plano de ação.`;
  }

  let paragraph3 = '';
  if (critCount > 0) {
    const riskLabels = critical_risks.slice(0, 3).map(c => c.cluster_label).join(', ');
    paragraph3 = `Foram identificados ${critCount} cluster${critCount > 1 ? 's' : ''} com risco crítico ou alto e score abaixo do limite de aceitabilidade: ${riskLabels}. Estes pontos demandam ação imediata para reduzir a exposição da empresa.`;
  }

  let paragraph4 = '';
  if (top_strengths.length > 0 && top_strengths[0].score >= 2.5) {
    const strengthLabels = top_strengths.filter(s => s.score >= 2.5).map(s => s.label).join(', ');
    if (strengthLabels) paragraph4 = `Como pontos de força relativa, destacam-se ${strengthLabels}, onde os controles estão mais consolidados e podem servir de referência para as demais áreas.`;
  }

  let paragraph5 = '';
  const criticalActions = top_priorities.filter(p => p.priority === 'critical' || p.priority === 'high');
  if (criticalActions.length > 0) {
    const actionLabels = criticalActions.slice(0, 2).map(p => p.cluster_label).join(' e ');
    paragraph5 = `As primeiras iniciativas recomendadas concentram-se em ${actionLabels}, com ações estruturantes nos próximos 30 a 60 dias para eliminar as exposições mais críticas identificadas no diagnóstico.`;
  }

  let paragraph6 = '';
  const criticalFindings = (system_findings || []).filter(f => f.severity === 'critical');
  if (criticalFindings.length > 0) {
    const findingLabels = criticalFindings.slice(0, 2).map(f => f.cycle_label).join(' e ');
    paragraph6 = `A análise sistêmica identificou fragilidades estruturais em ${findingLabels}, onde múltiplos processos interdependentes apresentam controles insuficientes simultaneamente — indicando risco de colapso de ciclo e não apenas falhas pontuais.`;
  }

  const executive_narrative = [paragraph1, paragraph2, paragraph3, paragraph4, paragraph5, paragraph6].filter(Boolean).join(' ');

  return {
    overall_score: score, maturity: overall.maturity,
    completion_rate: overall.completion_rate,
    top_strengths, top_gaps, critical_risks, top_priorities,
    system_findings: system_findings || [],
    executive_narrative,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. runFullDiagnostic — Orquestrador principal
// ─────────────────────────────────────────────────────────────────────────────
export function runFullDiagnostic({ questions = [], responses = [], activeDimensions = null }) {
  if (!questions || questions.length === 0) {
    return {
      overall: { score: null, maturity: null, completion_rate: 0, maturity_index: 0 },
      dimensions: [], subdimensions: [], clusters: [], priorities: [], action_plan: [],
      executive_summary: {
        overall_score: null, maturity: null, top_strengths: [], top_gaps: [],
        critical_risks: [], top_priorities: [],
        executive_narrative: 'Nenhuma pergunta disponível para análise.',
      },
    };
  }

  const responseMap = new Map();
  for (const r of (responses || [])) {
    if (r && r.fal_question_id) responseMap.set(r.fal_question_id, r);
  }

  const dimsToProcess = activeDimensions
    ? CANONICAL_DIMENSIONS.filter(d => activeDimensions.includes(d.key))
    : CANONICAL_DIMENSIONS;

  const dimensionResults  = [];
  const allSubdimResults  = [];
  const allClusterResults = [];

  for (const dim of dimsToProcess) {
    const dimQs = questions.filter(q => qDimension(q) === dim.key);
    const dimResult = calculateDimensionScore(dimQs, responseMap, dim.key);
    dimensionResults.push(dimResult);

    for (const [subdimKey, subdimData] of Object.entries(dimResult.subdimension_results || {})) {
      allSubdimResults.push({ ...subdimData, subdimension_key: subdimKey, dimension_key: dim.key, dimension_label: dimResult.dimension_label });

      for (const [clusterKey, clusterData] of Object.entries(subdimData.cluster_results || {})) {
        const cScore        = clusterData.weighted_score;
        const inherentRisk  = getInherentRiskV2(clusterKey);
        const residualRisk  = calculateResidualRisk(cScore, inherentRisk);
        const actionPriority = calculateActionPriority(cScore, inherentRisk);
        const maturityV2    = calculateMaturity(cScore);

        const enrichedCluster = {
          ...clusterData,
          cluster_key:      clusterKey,
          subdimension_key: subdimKey,
          dimension_key:    dim.key,
          dimension_label:  dimResult.dimension_label,
          // ── Campos metodológicos adicionais ──
          maturity_v2:           maturityV2,
          inherent_risk:         inherentRisk,
          residual_risk:         residualRisk.residual_risk,
          risk_score:            residualRisk.risk_score,
          action_priority:       actionPriority.priority_level,
          action_priority_score: actionPriority.priority_score,
        };
        // ── Diagnóstico empresarial por cluster ──
        enrichedCluster.diagnosis = generateClusterDiagnosis(enrichedCluster);
        allClusterResults.push(enrichedCluster);
      }
    }
  }

  const overall = calculateOverallAssessmentScore(dimensionResults);

  const priorities = allClusterResults
    .filter(c => c.weighted_score !== null && c.weighted_score !== undefined)
    .map(c => calculateClusterRiskPriority(c.cluster_key, c.weighted_score))
    .sort((a, b) => b.priority_score - a.priority_score);

  const action_plan = generateActionPlan({ clusters: allClusterResults });

  const systemic_weaknesses = detectSystemicWeaknesses(allClusterResults);
  const system_findings     = generateFindings(systemic_weaknesses);

  const executive_summary = generateExecutiveSummary({ overall, dimensions: dimensionResults, clusters: allClusterResults, action_plan, system_findings });

  return { overall, dimensions: dimensionResults, subdimensions: allSubdimResults, clusters: allClusterResults, priorities, action_plan, systemic_weaknesses, system_findings, executive_summary };
}

// Re-exports
export { getMaturityLevel, scoreToMaturityIndex } from '../config/maturityConfig';
export { getInherentRisk, getClusterRiskInfo, RISK_LEVELS } from '../config/clusterRiskConfig';
export { formatKey } from './helpers';