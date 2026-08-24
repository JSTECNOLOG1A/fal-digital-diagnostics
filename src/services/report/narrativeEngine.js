/**
 * narrativeEngine.js
 * 
 * Camada pura de transformação de dados estruturados em narrativa consultiva.
 * 
 * Princípio: recebe APENAS o payload do buildReportPayload(), sem query interna.
 * Todas as funções são puras e determinísticas.
 */

// ═══════════════════════════════════════════════════════════════
// NARRATIVA EXECUTIVA DE GRUPO (com dispersão)
// ═══════════════════════════════════════════════════════════════

/**
 * Gera narrativa consultiva real para relatório de GRUPO.
 * Lê payload canônico — sem consultas internas.
 * Cobre: estado, risco principal, oportunidade, dispersão, prioridade de ataque.
 */
export function generateGroupExecutiveNarrative(payload) {
  const { headline = {}, dispersion, dimensions = [], clusters = [] } = payload;
  const { overallScore, overallLevel, deltaScore } = headline;

  if (!overallScore && !dispersion) return null;

  const levelLabel = {
    Crítico:     'maturidade crítica',
    Básico:      'maturidade básica',
    Estruturado: 'maturidade estruturada',
    Avançado:    'maturidade avançada',
  }[overallLevel] || 'maturidade em desenvolvimento';

  const deltaText = deltaScore != null
    ? deltaScore > 0
      ? ` A evolução em relação ao ciclo anterior é positiva (+${deltaScore.toFixed(2)} pontos), sinalizando progresso real.`
      : deltaScore < 0
      ? ` Em comparação ao ciclo anterior, o índice recuou ${Math.abs(deltaScore).toFixed(2)} pontos, sinalizando necessidade de revisão do programa de melhoria.`
      : ' O resultado se manteve estável em relação ao ciclo anterior.'
    : '';

  // Parágrafo 1: Estado geral
  const p1 = `O grupo apresenta ${levelLabel}, com índice IFME™ de ${overallScore?.toFixed(2) || '—'}/3,00.${deltaText}`;

  // Parágrafo 2: Dispersão / assimetria
  let p2 = '';
  if (dispersion && dispersion.assessed_count >= 2) {
    const { best_company, worst_company, gap, dispersion_risk, std, mean } = dispersion;
    const riskLabel = {
      crítico: 'crítico',
      alto: 'alto',
      moderado: 'moderado',
      baixo: 'baixo',
    }[dispersion_risk] || 'moderado';

    const gapInterpretation = gap >= 1.5
      ? 'A heterogeneidade é severa e representa o principal risco consolidado do grupo — o score médio mascara realidades operacionais radicalmente distintas.'
      : gap >= 0.8
      ? 'A assimetria entre as empresas é significativa, indicando que o grupo opera com padrões de maturidade incompatíveis entre suas unidades.'
      : gap >= 0.4
      ? 'Há dispersão relevante entre as empresas do grupo, com diferenças de maturidade que demandam padronização.'
      : 'A variação entre empresas é controlada, sugerindo razoável homogeneidade operacional no grupo.';

    p2 = `O risco de dispersão interna é ${riskLabel} (gap de ${gap.toFixed(2)} pontos entre extremos). ${gapInterpretation} A empresa com melhor desempenho é ${best_company.name} (${best_company.score?.toFixed(2)}), enquanto ${worst_company.name} apresenta o índice mais baixo (${worst_company.score?.toFixed(2)}), concentrando os principais focos de risco.`;
  } else if (dispersion && dispersion.assessed_count === 1) {
    p2 = `Apenas uma empresa foi avaliada neste ciclo — o score consolidado representa uma visão parcial do grupo. Recomenda-se ampliar a cobertura antes de conclusões definitivas.`;
  }

  // Parágrafo 3: Dimensão crítica / oportunidade
  const criticalDims = dimensions.filter(d => d.level === 'Crítico' && d.active !== false);
  const topCluster = clusters[0];
  let p3 = '';
  if (criticalDims.length > 0) {
    const names = criticalDims.slice(0, 2).map(d => d.name).join(' e ');
    p3 = `As dimensões de ${names} concentram as fragilidades mais críticas do grupo, representando o maior risco operacional e o maior potencial de impacto com intervenção estruturada.`;
  } else if (topCluster) {
    p3 = `O cluster "${topCluster.name || topCluster.cluster_key}" apresenta a maior fragilidade identificada, sendo o principal foco de atenção para o ciclo atual.`;
  }

  // Parágrafo 4: Direção prioritária
  const p4 = dispersion?.dispersion_risk === 'crítico' || dispersion?.dispersion_risk === 'alto'
    ? 'A prioridade imediata é reduzir a assimetria interna: padronizar os processos críticos nas empresas com menor maturidade e criar mecanismo de governança consolidada no grupo.'
    : criticalDims.length > 0
    ? 'A prioridade imediata é endereçar as dimensões críticas identificadas, com foco em fundamentos: formalização de processos, implantação de controles e alinhamento entre áreas.'
    : 'O grupo tem base para evoluir para o próximo nível. A prioridade é institucionalizar as boas práticas existentes e expandir o padrão de maturidade para as áreas ainda em desenvolvimento.';

  return [p1, p2, p3, p4].filter(Boolean).join('\n\n');
}

// ═══════════════════════════════════════════════════════════════
// SUMÁRIO EXECUTIVO
// ═══════════════════════════════════════════════════════════════

export function generateExecutiveSummary(reportPayload) {
  const {
    cover = {},
    executive_summary = {},
    maturity_profile = {},
    mfis_analysis = {},
    action_plan = {},
  } = reportPayload || {};

  const {
    overall_maturity_level,
    overall_maturity_index,
    main_systemic_tension,
    systemic_leverage_dimension,
    top_risks,
  } = executive_summary || {};

  const dimensions = maturity_profile?.dimensions || [];
  const activeDimCount = dimensions.filter((d) => d.active).length;
  const criticalDimCount = dimensions.filter((d) => d.level === 'Crítico' && d.active).length;

  const maturityLabel = {
    Crítico: 'crítica',
    Básico: 'básica',
    Estruturado: 'estruturada',
    Avançado: 'avançada',
  }[overall_maturity_level] || 'moderada';

  const allTasks = action_plan?.all_tasks || [];
  const topTasksCount = Math.min(3, allTasks.length);

  const meta = reportPayload?.report_metadata || {};
  const entityName = meta.group_name || meta.company_name || cover?.company_name || '—';

  const text = `
  A análise FAL™ indica que a organização ${entityName} encontra-se em estágio de maturidade ${maturityLabel} (${overall_maturity_index ?? 0}% do potencial máximo).

  Das ${activeDimCount} dimensões avaliadas, ${criticalDimCount} apresentam fragilidades críticas que requerem intervenção imediata.

  A principal tensão sistêmica concentra-se em ${main_systemic_tension || '—'}, indicando ruptura significativa na integração entre estas áreas.

  A dimensão ${systemic_leverage_dimension || '—'} foi identificada como ponto de alavanca sistêmica, sugerindo que melhorias estruturadas nesta área tendem a gerar efeito multiplicador sobre as demais dimensões organizacionais.

  Recomenda-se priorizar as ${topTasksCount} primeiras ações estratégicas nos próximos 90 dias, focando na consolidação da governança e integração operacional.
   `.trim();

   return text || 'Análise de maturidade em andamento.';
}

// ═══════════════════════════════════════════════════════════════
// NARRATIVA DE FRAGILIDADES
// ═══════════════════════════════════════════════════════════════

export function generateFragilitiesNarrative(reportPayload) {
  const { fragilities = {} } = reportPayload || {};
  const { top_crossings } = fragilities || {};

  if (!top_crossings || top_crossings.length === 0) {
    return 'Nenhuma fragilidade crítica identificada.';
  }

  const riskDescriptions = {
    GxF: 'Falta de alinhamento entre direcionamento estratégico e estrutura operacional',
    GxC: 'Governança desconectada de controles operacionais',
    FxO: 'Desintegração entre planejamento financeiro e execução operacional',
    OxS: 'Deficiência na automação e suporte sistêmico de processos operacionais',
    FxC: 'Contabilidade não acompanha realidade financeira operacional',
    PxG: 'Falta de direcionamento estratégico claro para pessoas',
    default: 'Integração deficiente entre as dimensões',
  };

  const descriptions = top_crossings.slice(0, 5).map((crossing, idx) => {
    const keyLabel = crossing.crossing_key || '—';
    const scoreLabel =
      crossing.cross_score_final < 1
        ? 'crítico'
        : crossing.cross_score_final < 1.5
        ? 'grave'
        : crossing.cross_score_final < 2
        ? 'moderado'
        : 'leve';
    const risk = riskDescriptions[keyLabel] || riskDescriptions.default;

    return `${idx + 1}. **${crossing.crossing_label}** (nível ${scoreLabel})
   ${risk}`;
  });

  const text = `
As principais fragilidades sistêmicas identificadas são:

${descriptions.join('\n\n')}

Essas fragilidades representam pontos de estrangulamento que, se não endereçados, limitam significativamente a escalabilidade da organização.
  `.trim();

  return text;
}

// ═══════════════════════════════════════════════════════════════
// NARRATIVA MFIS (ANÁLISE SISTÊMICA)
// ═══════════════════════════════════════════════════════════════

export function generateMfisNarrative(reportPayload) {
  const { mfis_analysis = {}, maturity_profile = {} } = reportPayload || {};
  const { systemic_leverage_dimension, top_tensions = [] } = mfis_analysis || {};
  const dimensions = maturity_profile.dimensions || [];

  const leverageDim = dimensions.find((d) => d.name === systemic_leverage_dimension);
  const leverageScore = leverageDim?.score || 0;

  const tensionCount = top_tensions.length;
  const criticalTensions = top_tensions.filter((t) => (t.cross_score_final ?? 1) < 1).length;

  const text = `
A matriz de interdependência sistêmica (MFIS™) revela um total de ${tensionCount} tensões estruturais significativas na organização, sendo ${criticalTensions} em nível crítico.

A dimensão **${systemic_leverage_dimension || '—'}** (score: ${(leverageScore || 0).toFixed(2)}/3) emerge como ponto de alavanca sistêmica central. Intervenções estruturadas nesta dimensão tendem a cascatear benefícios sobre as demais áreas, criando efeito multiplicador de melhoria organizacional.

As três principais tensões estão localizadas em:

${top_tensions.slice(0, 3).map((t, i) => `${i + 1}. ${t.crossing_label}`).join('\n')}

Essas tensões revelam que a organização opera em silos, com pouca integração entre suas funções críticas. Endereçá-las é fundamental para evolução de maturidade.
  `.trim();

  return text;
}

// ═══════════════════════════════════════════════════════════════
// NARRATIVA DE PRIORIDADES ESTRATÉGICAS
// ═══════════════════════════════════════════════════════════════

export function generateStrategicPriorities(reportPayload) {
  const { mfis_analysis = {}, maturity_profile = {}, fragilities = {} } = reportPayload || {};
  const { systemic_leverage_dimension, top_tensions = [] } = mfis_analysis || {};
  const { top_crossings = [] } = fragilities;
  const dimensions = maturity_profile.dimensions || [];
  const criticalDims = dimensions.filter((d) => d.level === 'Crítico' && d.active);

  return [
    {
      title: `Fortalecer: ${systemic_leverage_dimension || 'Dimensão de Alavanca'}`,
      description: `A dimensão de alavanca sistêmica identificada pelo MFIS™. Melhorias estruturadas aqui irradiam positivamente sobre toda a organização, com efeito multiplicador sobre governança, processos e controles.`,
      impact: 'Alto — efeito cascata sobre múltiplas dimensões',
      affected: [systemic_leverage_dimension, top_tensions[0]?.dim_a].filter(Boolean).join(', ') || '—',
      actions: [
        'Mapear gaps críticos na dimensão',
        'Estruturar grupo de trabalho dedicado',
        'Definir KPIs de evolução mensal',
      ],
    },
    {
      title: `Resolver tensão: ${top_tensions[0]?.crossing_label || 'Integração Sistêmica'}`,
      description: `A maior ruptura sistêmica identificada. Essas duas áreas operando em silos limitam exponencialmente a escalabilidade e a previsibilidade gerencial da organização.`,
      impact: 'Médio a alto — impacto direto em decisões executivas',
      affected: [top_tensions[0]?.dim_a, top_tensions[0]?.dim_b].filter(Boolean).join(' + ') || '—',
      actions: [
        'Realizar diagnóstico de causa-raiz',
        'Criar rituais de integração entre equipes',
        'Padronizar fluxos críticos de interface',
      ],
    },
    {
      title: `Consolidar: ${criticalDims[0]?.name || 'Controles Internos'}`,
      description: `Dimensão(ões) em nível crítico requerem fundações sólidas. Formalização, documentação e automação são pré-requisitos para qualquer outra transformação duradoura.`,
      impact: 'Médio — base para sustentabilidade da operação',
      affected: criticalDims.slice(0, 3).map((d) => d.name).join(', ') || '—',
      actions: [
        'Documentar processos críticos',
        'Implementar controles básicos',
        'Treinar equipes nas novas rotinas',
      ],
    },
  ];
}

export function generatePriorityNarrative(reportPayload) {
  const { mfis_analysis = {}, maturity_profile = {}, fragilities = {} } = reportPayload || {};
  const { systemic_leverage_dimension, top_tensions = [] } = mfis_analysis || {};
  const { top_crossings = [] } = fragilities;
  const dimensions = maturity_profile.dimensions || [];

  // Prioridade 1: Fortalecer dimensão de alavanca
  const p1 = {
    title: `Fortalecer e integrar ${systemic_leverage_dimension}`,
    description: `A dimensão ${systemic_leverage_dimension} é o eixo central de transformação. Melhorias estruturadas nesta área irradiam positivamente para toda a organização.`,
  };

  // Prioridade 2: Endereçar maior tensão sistêmica
  const p2 = {
    title: `Resolver integração crítica: ${top_tensions[0]?.crossing_label || 'Integração sistêmica'}`,
    description: `A maior fragilidade identificada está na integração entre ${top_tensions[0]?.dim_a || '—'} e ${top_tensions[0]?.dim_b || '—'}. Essas duas áreas operando em silos limitam exponencialmente a escalabilidade da organização.`,
  };

  // Prioridade 3: Consolidar controles
  const criticalDims = dimensions.filter((d) => d.level === 'Crítico' && d.active);
  const p3Title = criticalDims.length > 0 ? `Consolidar ${criticalDims[0]?.name || 'controles'}` : 'Consolidar controles internos';
  const p3 = {
    title: p3Title,
    description: `Dimensões em nível crítico carecem de fundações sólidas. Investimentos em formalização, documentação e automação são prerequisites para qualquer outra transformação.`,
  };

  const priorities = [p1, p2, p3];

  const text = `
Com base na análise de maturidade, sistêmica e plano de ação, recomenda-se executar as seguintes prioridades estratégicas:

${priorities.map((p, i) => `**Prioridade ${i + 1}: ${p.title}**
${p.description}`).join('\n\n')}

Essas três alavancas, quando operadas de forma integrada, tendem a gerar o maior retorno de investimento em transformação organizacional.
  `.trim();

  return text;
}

// ═══════════════════════════════════════════════════════════════
// NARRATIVA DO PLANO DE AÇÃO
// ═══════════════════════════════════════════════════════════════

export function generateActionPlanNarrative(reportPayload) {
  const { action_plan = {}, cover = {} } = reportPayload || {};
  const tasks_by_priority = action_plan?.tasks_by_priority || {};
  const tasks_by_horizon = action_plan?.tasks_by_horizon || {};
  const all_tasks = action_plan?.all_tasks || [];

  const criticalCount = tasks_by_priority.critical || 0;
  const highCount = tasks_by_priority.high || 0;
  const total90d = (tasks_by_horizon['90_days'] || []).length;
  const total180d = (tasks_by_horizon['180_days'] || []).length;
  const total365d = (tasks_by_horizon['365_days'] || []).length;

  const text = `
O plano de ação consolidado compreende ${all_tasks.length} iniciativas estruturadas em três horizontes temporais:

**90 dias** — ${total90d} ações
Foco em fundações: governança, comunicação, estruturação de grupos de trabalho.

**180 dias** — ${total180d} ações
Implementação: sistemas, processos, capacitação.

**365 dias** — ${total365d} ações
Consolidação e maturação de mudanças.

Das ${all_tasks.length} ações, ${criticalCount} são críticas e ${highCount} são de alta prioridade, demandando atenção executiva direta.

Recomenda-se atribuir sponsors claros para cada iniciativa e instituir cadência mensal de acompanhamento, com métricas visíveis de progresso.
  `.trim();

  return text;
}

// ═══════════════════════════════════════════════════════════════
// DIAGNÓSTICO INTELIGENTE (Smart Diagnosis)
// ═══════════════════════════════════════════════════════════════

export function generateSmartDiagnosis(reportPayload) {
  const { maturity_profile = {}, mfis_analysis = {} } = reportPayload || {};
  const dimensions = maturity_profile.dimensions || [];
  const { systemic_leverage_dimension } = mfis_analysis || {};

  const criticalDims = dimensions.filter((d) => d.level === 'Crítico' && d.active);
  const advancedDims = dimensions.filter((d) => d.level === 'Avançado' && d.active);

  const keyFindings = [
    criticalDims.length > 0
      ? `${criticalDims.length} dimensão(ões) em nível crítico requerem intervenção imediata`
      : 'Nenhuma dimensão em nível crítico — organização em trajetória de melhoria',
    advancedDims.length > 0
      ? `${advancedDims.length} dimensão(ões) em nível avançado — modelos a serem replicados`
      : 'Nenhuma dimensão em nível avançado — espaço significativo para evolução',
  ];

  return {
    key_findings: keyFindings,
    systemic_insights: [
      `A dimensão ${systemic_leverage_dimension || '—'} é o eixo de transformação — melhorias aqui irradiam para todo o sistema`,
      'Silos funcionais comprometem a escalabilidade — integração é prerequisite para transformação',
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// NARRATIVAS POR DIMENSÃO
// ═══════════════════════════════════════════════════════════════

export function generateDimensionNarratives(reportPayload) {
  const { maturity_profile = {} } = reportPayload || {};
  const dimensions = maturity_profile.dimensions || [];

  return dimensions
    .filter((d) => d.active)
    .map((dim) => {
      const levelDescriptions = {
        Crítico: 'carece de fundações sólidas',
        Básico: 'tem estrutura mínima funcional',
        Estruturado: 'opera com controles formalizados',
        Avançado: 'é modelo de maturidade para a organização',
      };

      return {
        dimension_key: dim.key,
        dimension_name: dim.name,
        score: dim.score,
        level: dim.level,
        narrative: `${dim.name} ${levelDescriptions[dim.level] || 'está em desenvolvimento'}. Score: ${(dim.score || 0).toFixed(2)}/3.`,
      };
    });
}

// ═══════════════════════════════════════════════════════════════
// CONSOLIDAÇÃO: PREENCHER PAYLOAD COM NARRATIVAS
// ═══════════════════════════════════════════════════════════════

/**
 * enrichReportPayload(reportPayload)
 * Adiciona todas as narrativas ao payload, retornando versão final.
 */
export function enrichReportPayload(reportPayload) {
   if (!reportPayload) {
     console.error('[enrichReportPayload] Payload vazio — retornando nulo');
     return null;
   }

   const isGroup = reportPayload?.report_scope?.level === 'group' || reportPayload?.meta?.reportScope === 'group';
   const groupNarrative = isGroup ? generateGroupExecutiveNarrative(reportPayload) : null;

  return {
    ...reportPayload,
    executive_summary: {
      ...reportPayload.executive_summary,
      narrative: groupNarrative || generateExecutiveSummary(reportPayload),
    },
    fragilities: {
      ...reportPayload.fragilities,
      narrative: generateFragilitiesNarrative(reportPayload),
    },
    mfis_analysis: {
      ...reportPayload.mfis_analysis,
      narrative: generateMfisNarrative(reportPayload),
    },
    smart_diagnosis: generateSmartDiagnosis(reportPayload),
    strategic_priorities: Array.isArray(reportPayload?.strategic_priorities)
      ? reportPayload.strategic_priorities
      : generateStrategicPriorities(reportPayload),
    dimension_narratives: generateDimensionNarratives(reportPayload),
    action_plan: {
      ...reportPayload.action_plan,
      narrative: generateActionPlanNarrative(reportPayload),
    },
  };
}