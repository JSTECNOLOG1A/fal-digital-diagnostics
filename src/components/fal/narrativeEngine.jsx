/**
 * narrativeEngine.js
 * =========================================================================
 * Motor de Narrativa Diagnóstica FAL
 *
 * Interpreta os dados já existentes do FalDiagnosticSnapshot e produz
 * uma leitura consultiva estruturada em 6 blocos.
 *
 * NÃO altera nenhum dado. É puramente interpretativo.
 * =========================================================================
 */

import { FAL_DIMENSIONS, FAL_DIMENSION_LABELS } from './falOfficialMatrix';

// ─── LIMIARES DE MATURIDADE (escala 0–3, alinhados com maturityConfig e backend) ─
const THRESHOLDS = {
  critico:     { max: 1.0 },
  basico:      { min: 1.0, max: 1.8  },
  estruturado: { min: 1.8, max: 2.5  },
  avancado:    { min: 2.5             },
};

function classifyScore(score) {
  if (score < 1.0)  return 'Crítico';
  if (score < 1.8)  return 'Básico';
  if (score < 2.5)  return 'Estruturado';
  return 'Avançado';
}

function dimLabel(key) {
  return FAL_DIMENSION_LABELS[key] || key;
}

// ─── CORRELAÇÕES ENTRE MAPAS (regras fixas e auditáveis) ──────────────────────
// Cada correlação define: se mapa A e mapa B estão ambos fracos → há interseção relevante
const CROSS_MAP_CORRELATIONS = [
  {
    dims: ['governanca', 'financeiro'],
    description: (la, lb) =>
      `A fragilidade em ${la} impacta diretamente ${lb}: sem processos decisórios estruturados e metas claras, a gestão financeira tende a operar de forma reativa, sem previsibilidade orçamentária consistente.`,
  },
  {
    dims: ['governanca', 'controles_internos'],
    description: (la, lb) =>
      `A deficiência em ${la} se reflete em ${lb}: quando não há definição clara de papéis e alçadas, os controles internos tendem a ser inconsistentes, com segregação de funções comprometida e ausência de fluxos de aprovação formais.`,
  },
  {
    dims: ['controles_internos', 'contabil'],
    description: (la, lb) =>
      `A fragilidade em ${la} contamina a qualidade de ${lb}: sem controles operacionais consistentes, os lançamentos contábeis perdem precisão e tempestividade, gerando demonstrações financeiras de confiabilidade reduzida.`,
  },
  {
    dims: ['contabil', 'financeiro'],
    description: (la, lb) =>
      `A deficiência em ${la} limita a capacidade de ${lb}: decisões financeiras dependem de informações contábeis confiáveis. Sem demonstrações consistentes, o planejamento de caixa e a gestão de endividamento ficam comprometidos.`,
  },
  {
    dims: ['tributario', 'juridico'],
    description: (la, lb) =>
      `A vulnerabilidade em ${la} se conecta ao risco em ${lb}: contingências fiscais não provisionadas ou regimes tributários inadequados costumam gerar passivos jurídicos de difícil reversão.`,
  },
  {
    dims: ['sistemas', 'controles_internos'],
    description: (la, lb) =>
      `A deficiência em ${la} fragiliza ${lb}: sem sistemas integrados e confiáveis, os controles internos dependem de processos manuais propensos a erro, reduzindo a rastreabilidade e a segurança das informações operacionais.`,
  },
  {
    dims: ['sistemas', 'contabil'],
    description: (la, lb) =>
      `A fragilidade em ${la} compromete ${lb}: a ausência de integração entre ERP e contabilidade gera retrabalho, atrasa fechamentos e aumenta o risco de inconsistência nos registros contábeis.`,
  },
  {
    dims: ['operacional', 'financeiro'],
    description: (la, lb) =>
      `A deficiência em ${la} repercute em ${lb}: sem planejamento operacional e controle de custos estruturado, a formação de resultado financeiro torna-se imprevisível, dificultando a gestão de caixa e o planejamento de capital.`,
  },
  {
    dims: ['governanca', 'juridico'],
    description: (la, lb) =>
      `A fragilidade em ${la} amplifica riscos em ${lb}: a ausência de estrutura societária formalizada e processos decisórios documentados eleva a exposição a litígios e contingências contratuais.`,
  },
];

// ─── IMPLICAÇÕES ESTRATÉGICAS POR COMBINAÇÃO DE FRAGILIDADES ──────────────────
const STRATEGIC_IMPLICATIONS = [
  {
    condition: (weakDims) => weakDims.includes('governanca'),
    text: 'A ausência de governança estruturada tende a amplificar todos os demais riscos à medida que a empresa cresce: decisões tomadas de forma informal se tornam insustentáveis com o aumento de complexidade operacional.',
  },
  {
    condition: (weakDims) => weakDims.includes('financeiro') && weakDims.includes('controles_internos'),
    text: 'A combinação de controles internos frágeis com gestão financeira incipiente cria risco significativo de descontinuidade de caixa em cenários de expansão ou crise setorial.',
  },
  {
    condition: (weakDims) => weakDims.includes('tributario'),
    text: 'Fragilidades tributárias tendem a se acumular silenciosamente: o custo de regularização cresce de forma não linear com o tempo, podendo comprometer o resultado operacional de múltiplos exercícios.',
  },
  {
    condition: (weakDims) => weakDims.includes('contabil'),
    text: 'Sem informações contábeis confiáveis e tempestivas, a empresa opera com visibilidade limitada de seu patrimônio real, dificultando negociações bancárias, atração de investidores e processos sucessórios.',
  },
  {
    condition: (weakDims) => weakDims.includes('sistemas'),
    text: 'A dependência de controles manuais limita a capacidade de escala da operação: à medida que o volume cresce, o esforço de controle cresce desproporcionalmente sem o suporte tecnológico adequado.',
  },
  {
    condition: (weakDims) => weakDims.includes('juridico'),
    text: 'Vulnerabilidades jurídicas e societárias, quando não endereçadas preventivamente, tendem a se transformar em passivos expressivos que consomem energia de gestão e recursos financeiros em momentos críticos.',
  },
  {
    condition: (weakDims) => weakDims.includes('operacional'),
    text: 'Deficiências operacionais crônicas limitam a formação de resultado e pressionam margens: sem controle estruturado de custos e produtividade, a empresa tende a crescer receita sem crescer resultado.',
  },
];

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────────────

/**
 * generateDiagnosticNarrative(snapshot, activeDimensions?)
 *
 * @param {object} snapshot - FalDiagnosticSnapshot completo
 * @param {string[]} [activeDimensions] - lista de dimension_keys ativas no assessment
 * @returns {object} narrativa com 6 blocos:
 *   { visaoGeral, fragilidades, pontosFOrtes, intersecoes, implicacoes, direcao, metadata }
 */
export function generateDiagnosticNarrative(snapshot, activeDimensions) {
  if (!snapshot) return null;

  const overallScore = snapshot.overall_score || 0;
  const overallLevel = snapshot.overall_level || classifyScore(overallScore);
  const dimScores    = snapshot.dimension_scores || {};
  const gapsTop      = snapshot.gaps_top || [];
  const penalties    = snapshot.methodology_log?.penalties_applied || [];

  // Dimensões ativas no diagnóstico
  const activeDims = activeDimensions && activeDimensions.length > 0
    ? activeDimensions
    : FAL_DIMENSIONS.map(d => d.key);

  // Calcula score de cada dimensão ativa
  const scoredDims = activeDims
    .map(key => {
      const data = dimScores[key];
      const score = data?.score ?? data?.weighted_score ?? null;
      return { key, label: dimLabel(key), score, level: score != null ? classifyScore(score) : null };
    })
    .filter(d => d.score !== null);

  const weakDims   = scoredDims.filter(d => d.score < 1.8).sort((a, b) => a.score - b.score);
  const strongDims = scoredDims.filter(d => d.score >= 2.0).sort((a, b) => b.score - a.score);
  const critDims   = scoredDims.filter(d => d.score < 1.0);
  const weakKeys   = weakDims.map(d => d.key);

  // ── BLOCO 1: Visão Geral ────────────────────────────────────────────────────
  const visaoGeral = _buildVisaoGeral(overallScore, overallLevel, scoredDims, weakDims, critDims, penalties);

  // ── BLOCO 2: Fragilidades ───────────────────────────────────────────────────
  const fragilidades = _buildFragilidades(weakDims, critDims, gapsTop, dimScores, penalties);

  // ── BLOCO 3: Pontos Fortes ──────────────────────────────────────────────────
  const pontosFOrtes = _buildPontosFortes(strongDims, weakDims, scoredDims);

  // ── BLOCO 4: Interseções entre Mapas ────────────────────────────────────────
  const intersecoes = _buildIntersecoes(weakKeys, scoredDims);

  // ── BLOCO 5: Implicações Estratégicas ───────────────────────────────────────
  const implicacoes = _buildImplicacoes(weakKeys, overallScore, penalties);

  // ── BLOCO 6: Direção Prioritária ────────────────────────────────────────────
  const direcao = _buildDirecao(weakDims, strongDims, overallScore, gapsTop);

  return {
    visaoGeral,
    fragilidades,
    pontosFOrtes,
    intersecoes,
    implicacoes,
    direcao,
    metadata: {
      overall_score: overallScore,
      overall_level: overallLevel,
      weak_dims_count: weakDims.length,
      strong_dims_count: strongDims.length,
      critical_dims_count: critDims.length,
      generated_from: snapshot.assessment_id,
    },
  };
}

// ─── CONSTRUTORES DE CADA BLOCO ────────────────────────────────────────────────

function _buildVisaoGeral(overallScore, overallLevel, scoredDims, weakDims, critDims, penalties) {
  const total = scoredDims.length;
  const weakCount = weakDims.length;
  const hasPenalties = penalties.length > 0;

  let intro = '';
  if (overallScore < 1.0) {
    intro = `O diagnóstico estrutural revela uma empresa em estágio crítico de maturidade, com score geral de ${overallScore.toFixed(2)} (escala 0–3). `;
    intro += `A maioria das dimensões avaliadas apresenta estruturação incipiente, indicando que os fundamentos organizacionais ainda precisam ser estabelecidos antes de qualquer iniciativa de expansão ou aceleração.`;
  } else if (overallScore < 1.8) {
    intro = `O diagnóstico aponta uma empresa em fase básica de maturidade estrutural, com score geral de ${overallScore.toFixed(2)}. `;
    intro += `Existem iniciativas e práticas em construção, mas ainda sem consistência e formalização suficientes para sustentar crescimento com controle.`;
  } else if (overallScore < 2.5) {
    intro = `O diagnóstico posiciona a empresa em nível estruturado de maturidade, com score geral de ${overallScore.toFixed(2)}. `;
    intro += `Os principais processos estão implementados, mas ainda há gaps relevantes que limitam a eficiência sistêmica e a capacidade de escala ordenada.`;
  } else {
    intro = `O diagnóstico indica uma empresa com maturidade estrutural avançada, com score geral de ${overallScore.toFixed(2)}. `;
    intro += `A base organizacional é sólida, com práticas bem estabelecidas na maioria das dimensões, o que suporta iniciativas de crescimento e complexidade crescente.`;
  }

  // Desequilíbrio entre mapas
  let balanco = '';
  if (total > 0 && weakCount > 0) {
    const pct = Math.round((weakCount / total) * 100);
    if (pct > 60) {
      balanco = ` Há um desequilíbrio estrutural significativo: ${weakCount} de ${total} dimensões avaliadas estão abaixo do nível Estruturado, sinalizando fragilidades sistêmicas que se reforçam mutuamente.`;
    } else if (pct > 30) {
      balanco = ` O perfil estrutural é parcialmente desenvolvido: ${weakCount} de ${total} dimensões ainda demandam atenção prioritária para consolidar a base operacional e de controle.`;
    } else if (weakCount > 0) {
      balanco = ` Em linhas gerais, a estrutura é sólida, com pontos específicos de melhoria em ${weakCount} dimensão(ões) que merecem atenção para elevar a consistência global.`;
    }
  }

  const penaltyNote = hasPenalties
    ? ` O motor metodológico identificou ${penalties.length} penalidade(s) aplicada(s) ao diagnóstico, o que indica a presença de fatores de risco qualificados que impactaram a pontuação final.`
    : '';

  return intro + balanco + penaltyNote;
}

function _buildFragilidades(weakDims, critDims, gapsTop, dimScores, penalties) {
  if (weakDims.length === 0) {
    return 'O diagnóstico não identificou dimensões com fragilidade estrutural significativa. A empresa demonstra maturidade consistente em todas as áreas avaliadas.';
  }

  let text = '';

  if (critDims.length > 0) {
    const critLabels = critDims.map(d => d.label).join(', ');
    text += `As dimensões em estágio crítico — ${critLabels} — representam o núcleo de vulnerabilidade da empresa. `;
    text += `Nessas áreas, os processos fundamentais ainda não foram estabelecidos de forma consistente, o que cria riscos de natureza operacional, financeira ou legal que tendem a se ampliar com o tempo. `;
  }

  const basicDims = weakDims.filter(d => d.score >= 1.0 && d.score < 1.8);
  if (basicDims.length > 0) {
    const basicLabels = basicDims.map(d => d.label).join(', ');
    text += `Em nível básico de maturidade encontram-se ${basicLabels}: existem práticas iniciais, mas sem a formalização e consistência necessárias para sustentar operações de maior escala ou complexidade. `;
  }

  // Subdimensões mais frágeis via gaps_top
  if (gapsTop && gapsTop.length > 0) {
    const topGap = gapsTop[0];
    if (topGap) {
      text += `O maior gap individual identificado está em ${topGap.axis || topGap.dimension}, com score de ${(topGap.score || 0).toFixed(2)}, classificado como ${topGap.level || 'Crítico'}. `;
    }
  }

  // Penalidades
  if (penalties.length > 0) {
    const killerPenalties = penalties.filter(p => p.type === 'killer');
    if (killerPenalties.length > 0) {
      text += `Foram identificadas ${killerPenalties.length} questão(ões) killer respondida(s) com score crítico, aplicando penalidade de cap sobre seus respectivos clusters — sinal de vulnerabilidade qualificada que vai além do score médio. `;
    }
  }

  // Leitura interpretativa
  if (weakDims.length >= 3) {
    text += `A concentração de fragilidades em múltiplas dimensões sugere que a empresa ainda está em processo de construção de sua base estrutural, o que demanda uma abordagem sistêmica — e não apenas intervenções pontuais — para gerar evolução sustentável.`;
  } else {
    text += `Os gaps identificados são específicos e tratáveis: com foco e priorização adequada, é possível avançar significativamente na maturidade estrutural em ciclos relativamente curtos.`;
  }

  return text;
}

function _buildPontosFortes(strongDims, weakDims, scoredDims) {
  if (strongDims.length === 0) {
    if (scoredDims.length === 0) return 'Não há dados suficientes para identificar pontos fortes no diagnóstico atual.';
    return 'O diagnóstico atual não identificou dimensões com maturidade significativamente superior às demais. Há oportunidade de construção estrutural ampla e equilibrada.';
  }

  const top = strongDims.slice(0, 3);
  const labels = top.map(d => d.label);

  let text = `As dimensões com maior maturidade relativa são ${labels.join(', ')}. `;

  // Interpretação por dimensão específica
  const interpretations = {
    governanca:         'A solidez em Governança indica que a empresa possui estrutura de decisão e controle mais madura, o que é fator habilitador para qualquer processo de crescimento ou complexidade.',
    juridico:           'A consistência jurídica e societária sugere menor exposição a passivos contratuais e fundiários, criando base mais segura para operações e negociações.',
    controles_internos: 'Os controles internos desenvolvidos indicam processos operacionais mais rastreáveis e com menor risco de desvios, fraudes ou perdas não percebidas.',
    financeiro:         'A maturidade financeira demonstra capacidade de planejamento e gestão de caixa, o que confere maior previsibilidade e poder de negociação com o mercado.',
    contabil:           'A qualidade contábil fornece uma base de informação confiável para decisões estratégicas, financiamento e avaliação patrimonial.',
    tributario:         'A regularidade fiscal reduz a exposição a contingências tributárias e permite aproveitamento mais eficiente de incentivos e créditos disponíveis.',
    operacional:        'A maturidade operacional indica capacidade de produzir com consistência e controle, o que sustenta a formação de resultado e a escalabilidade.',
    sistemas:           'A infraestrutura de sistemas desenvolvida cria base tecnológica para controles mais eficientes, integração de dados e suporte à tomada de decisão.',
  };

  for (const d of top) {
    if (interpretations[d.key]) {
      text += interpretations[d.key] + ' ';
    }
  }

  if (weakDims.length > 0 && strongDims.length > 0) {
    text += `O contraste entre as dimensões fortes e as frágeis indica que a empresa tem capacidade comprovada de construir maturidade estrutural — o que é um ativo relevante para o processo de evolução nas áreas com maior déficit.`;
  }

  return text.trim();
}

function _buildIntersecoes(weakKeys, scoredDims) {
  const relevantCorrelations = CROSS_MAP_CORRELATIONS.filter(corr =>
    corr.dims.every(d => weakKeys.includes(d))
  );

  if (relevantCorrelations.length === 0) {
    // Verifica se há pelo menos uma relação parcial (um dos dois frágeis)
    const partialCorrelations = CROSS_MAP_CORRELATIONS.filter(corr =>
      corr.dims.some(d => weakKeys.includes(d)) && scoredDims.some(s => corr.dims.includes(s.key))
    );

    if (partialCorrelations.length === 0) {
      return 'O diagnóstico não identificou padrões de interseção crítica entre dimensões. As dimensões apresentam comportamentos relativamente independentes no perfil atual.';
    }

    return 'O diagnóstico não aponta intersecções críticas simultâneas entre mapas. As fragilidades identificadas são pontuais e não configuram, neste momento, padrão de vulnerabilidade cruzada.';
  }

  let text = 'O diagnóstico revela padrões de interseção estrutural entre mapas que merecem atenção especial — pois fragilidades combinadas tendem a se amplificar mutuamente:\n\n';

  for (const corr of relevantCorrelations) {
    const [keyA, keyB] = corr.dims;
    const labelA = dimLabel(keyA);
    const labelB = dimLabel(keyB);
    text += `• ${corr.description(labelA, labelB)}\n\n`;
  }

  if (relevantCorrelations.length >= 2) {
    text += 'A presença de múltiplas interseções críticas sugere que a empresa enfrenta um desafio estrutural interconectado — onde a resolução isolada de cada mapa, sem visão sistêmica, tenderá a gerar melhorias parciais e de baixa durabilidade.';
  } else {
    text += 'Essa interseção deve ser tratada de forma integrada no plano de ação, garantindo que as iniciativas em cada mapa se reforcem mutuamente.';
  }

  return text;
}

function _buildImplicacoes(weakKeys, overallScore, penalties) {
  const applicableImplications = STRATEGIC_IMPLICATIONS
    .filter(imp => imp.condition(weakKeys))
    .map(imp => imp.text);

  if (applicableImplications.length === 0) {
    if (overallScore >= 2.5) {
      return 'Com o nível de maturidade atual, a empresa está em posição favorável para absorver crescimento sem degradação estrutural relevante, desde que mantenha o ritmo de evolução das dimensões ainda em desenvolvimento.';
    }
    return 'A manutenção do perfil estrutural atual sem evolução tende a criar gargalos operacionais e de controle à medida que o negócio avança em complexidade.';
  }

  let text = '';

  if (overallScore < 1.0) {
    text += 'Se o perfil estrutural atual se mantiver sem evolução significativa, a empresa tende a enfrentar limitações crescentes à medida que avança em escala e complexidade:\n\n';
  } else if (overallScore < 1.8) {
    text += 'O cenário estrutural atual apresenta riscos que, embora gerenciáveis no curto prazo, tendem a se intensificar com o crescimento do negócio:\n\n';
  } else {
    text += 'Mesmo com maturidade estrutural relativamente desenvolvida, há implicações estratégicas nos gaps identificados que merecem atenção:\n\n';
  }

  for (const impl of applicableImplications) {
    text += `• ${impl}\n\n`;
  }

  if (penalties.length > 0) {
    text += `• As penalidades metodológicas registradas indicam vulnerabilidades qualificadas — pontos onde o risco real pode ser superior ao sugerido pelo score médio, demandando atenção imediata independentemente da priorização geral.`;
  }

  return text.trim();
}

function _buildDirecao(weakDims, strongDims, overallScore, gapsTop) {
  const critDims = weakDims.filter(d => d.score < 1.0);
  const basicDims = weakDims.filter(d => d.score >= 1.0 && d.score < 1.8);

  let text = '';

  if (weakDims.length === 0) {
    return 'Com o perfil de maturidade atual, a direção prioritária é a consolidação e sofisticação das práticas já existentes — evoluindo de processos estruturados para processos avançados, com maior integração entre dimensões e orientação a dados.';
  }

  // Frentes prioritárias
  if (critDims.length > 0) {
    const critLabels = critDims.slice(0, 2).map(d => d.label).join(' e ');
    text += `A prioridade imediata deve ser ${critLabels}: dimensões em estágio crítico representam riscos que precisam ser endereçados antes de qualquer iniciativa de escala. `;
    text += `O plano de ação deve concentrar os primeiros movimentos em estabelecer os fundamentos mínimos nessas áreas. `;
  }

  if (basicDims.length > 0) {
    const basicLabels = basicDims.slice(0, 2).map(d => d.label).join(' e ');
    text += `Em seguida, ${basicLabels} demandam evolução do nível básico para estruturado: o objetivo é transformar práticas informais em processos documentados, consistentes e rastreáveis. `;
  }

  // Estruturantes
  if (weakDims.some(d => d.key === 'governanca')) {
    text += `O fortalecimento da Governança tem caráter estruturante: ele cria o contexto de decisão e controle que potencializa a efetividade das melhorias em todas as demais dimensões. `;
  }

  // Quick wins inferidos
  if (gapsTop && gapsTop.length > 1) {
    const gap2 = gapsTop[1];
    if (gap2 && gap2.score > 0.5) {
      text += `O segundo maior gap — ${gap2.axis || gap2.dimension} — apresenta score de ${(gap2.score || 0).toFixed(2)}, indicando que já existem bases iniciais sobre as quais é possível construir melhorias com menor esforço relativo. `;
    }
  }

  // Ponte para o plano de ação
  text += `O plano de ação gerado pelo diagnóstico traduz essa direção em iniciativas concretas, priorizadas por impacto e horizonte. `;
  text += `A sequência sugerida parte dos fundamentos críticos, avança pelas frentes estruturantes e converge para uma operação com maior previsibilidade, controle e capacidade de aceleração sustentável.`;

  return text;
}