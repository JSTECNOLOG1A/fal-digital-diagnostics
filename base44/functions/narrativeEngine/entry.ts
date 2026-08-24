/**
 * narrativeEngine.js (Backend version)
 * 
 * Camada pura de transformação de dados estruturados em narrativa consultiva.
 * Reutiliza exatamente a mesma lógica do frontend (services/report/narrativeEngine.js).
 * 
 * Princípio: recebe APENAS o payload do buildReportPayload(), sem query interna.
 * Todas as funções são puras e determinísticas.
 */

// ═══════════════════════════════════════════════════════════════
// SUMÁRIO EXECUTIVO
// ═══════════════════════════════════════════════════════════════

function generateExecutiveSummary(reportPayload) {
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

  const text = `
A análise FAL™ indica que a organização ${cover?.company_name || '—'} encontra-se em estágio de maturidade ${maturityLabel} (${overall_maturity_index ?? 0}% do potencial máximo).

Das ${activeDimCount} dimensões avaliadas, ${criticalDimCount} apresentam fragilidades críticas que requerem intervenção imediata.

A principal tensão sistêmica concentra-se em ${main_systemic_tension || '—'}, indicando ruptura significativa na integração entre estas áreas.

A dimensão ${systemic_leverage_dimension || '—'} foi identificada como ponto de alavanca sistêmica, sugerindo que melhorias estruturadas nesta área tendem a gerar efeito multiplicador sobre as demais dimensões organizacionais.

Recomenda-se priorizar as ${topTasksCount} primeiras ações estratégicas nos próximos 90 dias, focando na consolidação da governança e integração operacional.
  `.trim();

  return text;
}

// ═══════════════════════════════════════════════════════════════
// NARRATIVA DE FRAGILIDADES
// ═══════════════════════════════════════════════════════════════

function generateFragilitiesNarrative(reportPayload) {
  const { fragilities = {} } = reportPayload || {};
  const { top_crossings } = fragilities || {};

  if (!Array.isArray(top_crossings) || top_crossings.length === 0) {
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

function generateMfisNarrative(reportPayload) {
  const { mfis_analysis = {}, maturity_profile = {} } = reportPayload || {};
  const { systemic_leverage_dimension, top_tensions = [] } = mfis_analysis || {};
  const dimensions = maturity_profile.dimensions || [];

  const leverageDim = dimensions.find((d) => d.name === systemic_leverage_dimension);
  const leverageScore = leverageDim?.score || 0;

  const tensionCount = Array.isArray(top_tensions) ? top_tensions.length : 0;
  const criticalTensions = Array.isArray(top_tensions)
    ? top_tensions.filter((t) => (t.cross_score_final ?? 1) < 1).length
    : 0;

  const text = `
A matriz de interdependência sistêmica (MFIS™) revela um total de ${tensionCount} tensões estruturais significativas na organização, sendo ${criticalTensions} em nível crítico.

A dimensão **${systemic_leverage_dimension || '—'}** (score: ${(leverageScore || 0).toFixed(2)}/3) emerge como ponto de alavanca sistêmica central. Intervenções estruturadas nesta dimensão tendem a cascatear benefícios sobre as demais áreas, criando efeito multiplicador de melhoria organizacional.

As três principais tensões estão localizadas em:

${Array.isArray(top_tensions) && top_tensions.length > 0
    ? top_tensions.slice(0, 3).map((t, i) => `${i + 1}. ${t.crossing_label}`).join('\n')
    : 'Nenhuma tensão crítica identificada.'}

Essas tensões revelam que a organização opera em silos, com pouca integração entre suas funções críticas. Endereçá-las é fundamental para evolução de maturidade.
  `.trim();

  return text;
}

// ═══════════════════════════════════════════════════════════════
// NARRATIVA DE PRIORIDADES ESTRATÉGICAS
// ═══════════════════════════════════════════════════════════════

function generateStrategicPriorities(reportPayload) {
  const { mfis_analysis = {}, maturity_profile = {}, fragilities = {} } = reportPayload || {};
  const { systemic_leverage_dimension, top_tensions = [] } = mfis_analysis || {};
  const { top_crossings = [] } = fragilities;
  const dimensions = maturity_profile.dimensions || [];
  const criticalDims = dimensions.filter((d) => d.level === 'Crítico' && d.active);

  const topTensionLabel = Array.isArray(top_tensions) && top_tensions.length > 0
    ? top_tensions[0]?.crossing_label || 'Integração Sistêmica'
    : 'Integração Sistêmica';

  const topTensionDimA = Array.isArray(top_tensions) && top_tensions.length > 0
    ? top_tensions[0]?.dim_a
    : undefined;

  const topTensionDimB = Array.isArray(top_tensions) && top_tensions.length > 0
    ? top_tensions[0]?.dim_b
    : undefined;

  return [
    {
      title: `Fortalecer: ${systemic_leverage_dimension || 'Dimensão de Alavanca'}`,
      description: `A dimensão de alavanca sistêmica identificada pelo MFIS™. Melhorias estruturadas aqui irradiam positivamente sobre toda a organização, com efeito multiplicador sobre governança, processos e controles.`,
      impact: 'Alto — efeito cascata sobre múltiplas dimensões',
      affected: [systemic_leverage_dimension, topTensionDimA].filter(Boolean).join(', ') || '—',
      actions: [
        'Mapear gaps críticos na dimensão',
        'Estruturar grupo de trabalho dedicado',
        'Definir KPIs de evolução mensal',
      ],
    },
    {
      title: `Resolver tensão: ${topTensionLabel}`,
      description: `A maior ruptura sistêmica identificada. Essas duas áreas operando em silos limitam exponencialmente a escalabilidade e a previsibilidade gerencial da organização.`,
      impact: 'Médio a alto — impacto direto em decisões executivas',
      affected: [topTensionDimA, topTensionDimB].filter(Boolean).join(' + ') || '—',
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

// ═══════════════════════════════════════════════════════════════
// DIAGNÓSTICO INTELIGENTE (Smart Diagnosis)
// ═══════════════════════════════════════════════════════════════

function generateSmartDiagnosis(reportPayload) {
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

function generateDimensionNarratives(reportPayload) {
  const { maturity_profile = {} } = reportPayload || {};
  const dimensions = maturity_profile.dimensions || [];

  return Array.isArray(dimensions)
    ? dimensions
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
        })
    : [];
}

// ═══════════════════════════════════════════════════════════════
// CONSOLIDAÇÃO: PREENCHER PAYLOAD COM NARRATIVAS
// ═══════════════════════════════════════════════════════════════

/**
 * enrichReportPayload(reportPayload)
 * Adiciona todas as narrativas ao payload, retornando versão final.
 * Protege todos os arrays contra tipos inválidos.
 */
function enrichReportPayload(reportPayload) {
  return {
    ...reportPayload,
    executive_summary: {
      ...reportPayload.executive_summary,
      narrative: generateExecutiveSummary(reportPayload),
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
    strategic_priorities: Array.isArray(reportPayload?.strategic_priorities) && reportPayload.strategic_priorities.length > 0
      ? reportPayload.strategic_priorities
      : generateStrategicPriorities(reportPayload),
    dimension_narratives: Array.isArray(generateDimensionNarratives(reportPayload))
      ? generateDimensionNarratives(reportPayload)
      : [],
    action_plan: {
      ...reportPayload.action_plan,
      narrative: generateActionPlanNarrative(reportPayload),
    },
  };
}

function generateActionPlanNarrative(reportPayload) {
  const { action_plan = {}, cover = {} } = reportPayload || {};
  const tasks_by_priority = action_plan?.tasks_by_priority || {};
  const tasks_by_horizon = action_plan?.tasks_by_horizon || {};
  const all_tasks = Array.isArray(action_plan?.all_tasks) ? action_plan.all_tasks : [];

  const criticalCount = tasks_by_priority.critical || 0;
  const highCount = tasks_by_priority.high || 0;
  const total90d = Array.isArray(tasks_by_horizon['90_days']) ? tasks_by_horizon['90_days'].length : 0;
  const total180d = Array.isArray(tasks_by_horizon['180_days']) ? tasks_by_horizon['180_days'].length : 0;
  const total365d = Array.isArray(tasks_by_horizon['365_days']) ? tasks_by_horizon['365_days'].length : 0;

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

export { enrichReportPayload };