/**
 * computeMfisAnalysis
 * Motor de cálculo do MFIS — Matriz FAL de Interdependência Sistêmica™
 *
 * Etapa A: definições fixas, cálculo derivado, normalização, classificação, ranking
 *
 * Payload: { assessment_id }
 *
 * Fluxo:
 *  1. Lê FalDiagnosticSnapshot (scores por dimensão)
 *  2. Lê respostas MQE (FalResponse com crossings, via crossing_status ou MQEResponse)
 *  3. Para cada um dos 11 cruzamentos:
 *     a. Resolve scores das dimensões A e B (fallback: 0 se dimensão inativa)
 *     b. Resolve mqe_score (fallback se ausente)
 *     c. Calcula cross_score_base_raw (0–3)
 *     d. Normaliza para 0–100
 *     e. Aplica peso do tipo de cruzamento
 *     f. Classifica tensão
 *  4. Calcula ranking de tensões (ascendente por score final)
 *  5. Calcula SystemicDimensionImpact e leverage_score por dimensão
 *  6. Gera interpretação automática por cruzamento
 *  7. Gera síntese executiva
 *  8. Persiste SystemicCrossingAnalysis (upsert por assessment_id + crossing_key)
 *  9. Persiste SystemicDimensionImpact (upsert por assessment_id + dimension_key)
 * 10. Atualiza AssessmentFlowState (simulation_status → stale se action_plan está done)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function resolveAppRole(user) {
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

// ── Labels de dimensão (fallback) ──────────────────────────────────────────────
const DIM_LABEL = {
  governanca:         'Governança',
  juridico:           'Jurídico',
  controles_internos: 'Controles Internos',
  financeiro:         'Financeiro',
  contabil:           'Contábil',
  tributario:         'Fiscal / Tributário',
  operacional:        'Operações',
  sistemas:           'Sistemas & Controles',
  estrategia:         'Estratégia',
};

const CROSSING_TYPE_WEIGHT = {
  institutional: 1.15,
  strategic:     1.10,
  financial:     1.10,
  operational:   1.05,
  integrity:     1.00,
};

// Interpretações automáticas por cruzamento (keys legadas mantidas para retrocompatibilidade)
const INTERPRETATIONS = {
  estrategia_x_governanca:         { fragile: 'A ausência de alinhamento entre planejamento estratégico e governança fragiliza a tomada de decisão e a execução das diretrizes organizacionais.', risk: 'Desconexão entre visão de longo prazo e estrutura decisória, gerando iniciativas sem ancoragem formal.', focus: 'Fortalecer processos de governança que traduzam objetivos estratégicos em accountability e monitoramento.' },
  estrategia_x_financeiro:         { fragile: 'A fragilidade entre planejamento estratégico e gestão financeira compromete a capacidade de sustentar iniciativas de longo prazo.', risk: 'Decisões estratégicas sem respaldo financeiro, gerando descontinuidade e pressão de caixa.', focus: 'Integrar o ciclo de planejamento estratégico ao orçamento e projeções financeiras de médio prazo.' },
  governanca_x_juridico:           { fragile: 'A interdependência entre governança e estrutura jurídica/societária está comprometida, aumentando exposição a riscos legais e societários.', risk: 'Decisões societárias mal suportadas juridicamente e contratos sem supervisão adequada.', focus: 'Alinhar a estrutura societária e os instrumentos jurídicos com os mecanismos de governança corporativa.' },
  governanca_x_sistemas:           { fragile: 'A governança não está sendo plenamente suportada por sistemas e controles formais, reduzindo rastreabilidade e supervisão.', risk: 'Decisões sem registro adequado e ausência de trilha de auditoria nos processos críticos.', focus: 'Implementar sistemas que suportem e registrem as decisões de governança.' },
  financeiro_x_contabil:           { fragile: 'Fragilidade entre disciplina financeira e confiabilidade contábil gera risco de inconsistência entre execução financeira e registros gerenciais.', risk: 'Divergência entre resultado real e resultado contábil, comprometendo decisões baseadas em dados.', focus: 'Estabelecer rotinas de conciliação entre gestão financeira e registros contábeis com periodicidade definida.' },
  financeiro_x_tributario:         { fragile: 'A integração entre fluxo financeiro e obrigações fiscais está comprometida, gerando risco de passivo tributário não provisionado.', risk: 'Planejamento de caixa sem incorporar obrigações fiscais, resultando em pressão de liquidez em períodos de apuração.', focus: 'Integrar o calendário fiscal ao planejamento financeiro e garantir provisões mensais adequadas.' },
  operacional_x_financeiro:        { fragile: 'A operação não está sendo devidamente traduzida em gestão financeira, criando desconexão entre resultado operacional e capacidade financeira.', risk: 'Crescimento operacional sem suporte financeiro ou decisões de investimento sem análise de viabilidade.', focus: 'Estruturar indicadores financeiros que reflitam a performance operacional.' },
  operacional_x_sistemas:          { fragile: 'Baixa tradução da rotina operacional em controles formais aumenta o risco de falhas de execução e rastreabilidade.', risk: 'Processos operacionais críticos sem suporte de sistema, controle ou padronização mínima.', focus: 'Mapear e sistematizar os processos operacionais críticos com apoio de ferramentas e controles formais.' },
  sistemas_x_contabil:             { fragile: 'A falta de integração entre sistemas de controle e contabilidade compromete a confiabilidade e tempestividade das informações contábeis.', risk: 'Relatórios contábeis desatualizados ou inconsistentes com a realidade operacional.', focus: 'Garantir que os sistemas operacionais alimentem automaticamente os registros contábeis.' },
  contabil_x_tributario:           { fragile: 'A qualidade contábil não está sustentando adequadamente a conformidade fiscal, gerando risco de inconsistências tributárias.', risk: 'Escrituração contábil inconsistente com as obrigações acessórias e apurações fiscais.', focus: 'Elevar a qualidade dos lançamentos contábeis como base para obrigações fiscais tempestivas e corretas.' },
  governanca_x_controles_internos: { fragile: 'A governança não está sendo convertida em mecanismos efetivos de controle interno, reduzindo supervisão e disciplina decisória.', risk: 'Decisões sem rastreabilidade, ausência de alçadas definidas e ambiente de controle frágil.', focus: 'Traduzir as diretrizes de governança em políticas e controles internos formalizados e monitorados.' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function safeNum(v, fallback = 0) {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

function round2(v) { return Math.round(v * 100) / 100; }

// Normaliza score 0–3 para 0–100
function normalize(score_0_3) {
  return round2(Math.min(100, Math.max(0, (score_0_3 / 3) * 100)));
}

function classifyTension(score_0_100) {
  if (score_0_100 >= 80) return 'madura';
  if (score_0_100 >= 60) return 'funcional';
  if (score_0_100 >= 40) return 'alerta';
  if (score_0_100 >= 20) return 'fragilidade';
  return 'ruptura';
}

// Gera texto de interpretação completo para um cruzamento dado seu score
function buildInterpretation(crossing_key, score_0_100) {
  const tpl = INTERPRETATIONS[crossing_key];
  if (!tpl) return { interpretation_text: '', risk_summary: '', recommended_focus: '' };
  return {
    interpretation_text: score_0_100 < 60 ? tpl.fragile : `O cruzamento apresenta integração ${score_0_100 >= 80 ? 'madura' : 'funcional'}, indicando coesão adequada entre as dimensões.`,
    risk_summary:    score_0_100 < 60 ? tpl.risk  : 'Sem riscos críticos identificados neste cruzamento.',
    recommended_focus: tpl.focus,
  };
}

// ── Motor principal ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!WRITE_ROLES.has(appRole)) return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });

    const { assessment_id } = await req.json();
    if (!assessment_id) return Response.json({ error: 'assessment_id required' }, { status: 400 });

    // ── 1. Carregar assessment, methodVersion e snapshot ─────────────────────
    const assessment = await base44.entities.Assessment.get(assessment_id);
    if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });
    const tenantId = assessment.tenant_id;

    // Carregar methodVersion para obter os crossings reais do tenant
    let MFIS_CROSSINGS = [];
    if (assessment.method_version_id) {
      const mv = await base44.entities.MethodVersion.get(assessment.method_version_id);
      if (mv?.crossings?.length) {
        MFIS_CROSSINGS = mv.crossings.map(c => ({
          key:          c.key,
          label:        c.name,
          dim_a:        c.dim_a,
          dim_b:        c.dim_b,
          crossing_type: 'operational', // tipo padrão; peso uniforme
          mqe_key:      c.key,          // chave usada no MQEResponse.crossing_key
        }));
      }
    }
    if (!MFIS_CROSSINGS.length) {
      return Response.json({ error: 'No crossings defined in MethodVersion' }, { status: 400 });
    }

    const snapshots = await base44.entities.FalDiagnosticSnapshot.filter(
      { assessment_id }, '-computed_at', 1
    );
    if (!snapshots.length) return Response.json({ error: 'No FalDiagnosticSnapshot found — run diagnostic first' }, { status: 404 });
    const snap = snapshots[0];
    const dimScores = snap.dimension_scores || {};

    // ── 2. Extrair scores por dimensão (0–3) ─────────────────────────────────
    const dimScoreMap = {};
    for (const [key, data] of Object.entries(dimScores)) {
      if (data.active && data.score !== null && data.score !== undefined) {
        dimScoreMap[key] = safeNum(data.score);
      }
    }

    // ── 3. Carregar scores MQE (crossing_status do assessment) ───────────────
    // crossing_status é um mapa: { [mqe_key]: { score, ... } } salvo no assessment
    const crossingStatus = assessment.crossing_status || {};
    // Também busca MQEResponse se disponível
    // Calcular média de scores por crossing_key (escala 0–3)
    let mqeResponseMap = {};
    try {
      const mqeResps = await base44.entities.MQEResponse.filter({ assessment_id }, '-created_date', 500);
      const mqeAccum = {};
      for (const r of mqeResps) {
        if (r.crossing_key && r.score !== null && r.score !== undefined) {
          if (!mqeAccum[r.crossing_key]) mqeAccum[r.crossing_key] = { sum: 0, count: 0 };
          mqeAccum[r.crossing_key].sum   += safeNum(r.score);
          mqeAccum[r.crossing_key].count += 1;
        }
      }
      for (const [key, acc] of Object.entries(mqeAccum)) {
        mqeResponseMap[key] = round2(acc.sum / acc.count);
      }
    } catch (_) { /* MQEResponse pode não existir — sem problema */ }

    const computedAt = new Date().toISOString();

    // ── 4. Calcular cada cruzamento ───────────────────────────────────────────
    const crossingResults = [];

    for (const crossing of MFIS_CROSSINGS) {
      const dimA = safeNum(dimScoreMap[crossing.dim_a], -1);
      const dimB = safeNum(dimScoreMap[crossing.dim_b], -1);

      // Se pelo menos uma dimensão está inativa/ausente, pular este cruzamento
      // (score 0 em dimensão ausente gera falso positivo de ruptura sistêmica)
      const dimAActive = dimA >= 0;
      const dimBActive = dimB >= 0;
      if (!dimAActive || !dimBActive) continue; // ambas devem estar ativas para calcular
      const dimAScore = dimA;
      const dimBScore = dimB;

      // Resolver MQE score (prioridade: MQEResponse > crossing_status)
      // mqeResponseMap pode estar indexado pelo mqe_key curto (ex: op_fin),
      // pelo crossing_key longo do MFIS (ex: operacional_x_financeiro),
      // ou pela chave do methodVersion.crossings — tentamos todos
      let mqeRaw = null;
      const mqeKeys = [crossing.mqe_key, crossing.key].filter(Boolean);
      for (const k of mqeKeys) {
        if (mqeResponseMap[k] !== undefined) { mqeRaw = mqeResponseMap[k]; break; }
        if (crossingStatus[k]?.score !== undefined) { mqeRaw = safeNum(crossingStatus[k].score); break; }
      }
      const hasMqeData = mqeRaw !== null;

      // Fórmula de score base (0–3)
      let crossScoreBaseRaw;
      if (hasMqeData) {
        crossScoreBaseRaw = (dimAScore * 0.35) + (dimBScore * 0.35) + (mqeRaw * 0.30);
      } else {
        // Fallback: média das dimensões
        crossScoreBaseRaw = (dimAScore + dimBScore) / 2;
      }
      crossScoreBaseRaw = round2(crossScoreBaseRaw);

      // Normalizar para 0–100
      const scoreNormalized = normalize(crossScoreBaseRaw);

      // Aplicar peso do tipo
      const weight = CROSSING_TYPE_WEIGHT[crossing.crossing_type] ?? 1.0;
      const scoreFinal = round2(Math.min(100, scoreNormalized * weight));

      const tensionLevel = classifyTension(scoreFinal);
      const isFragile    = scoreFinal < 40;
      const isCritical   = scoreFinal < 20;

      const { interpretation_text, risk_summary, recommended_focus } = buildInterpretation(crossing.key, scoreFinal);

      // systemic_weight: metadado analítico — mais frágil = peso maior (1.0–1.5, cap)
      const systemicWeight = round2(Math.min(1.5, 1 + ((100 - scoreFinal) / 200)));

      crossingResults.push({
        crossing_key:         crossing.key,
        crossing_label:       crossing.label,
        crossing_type:        crossing.crossing_type,
        dimension_a_key:      crossing.dim_a,
        dimension_a_label:    DIM_LABEL[crossing.dim_a] || crossing.dim_a,
        dimension_b_key:      crossing.dim_b,
        dimension_b_label:    DIM_LABEL[crossing.dim_b] || crossing.dim_b,
        dimension_a_score_raw: round2(dimAScore),
        dimension_b_score_raw: round2(dimBScore),
        mqe_score_raw:        mqeRaw !== null ? round2(mqeRaw) : null,
        has_mqe_data:         hasMqeData,
        cross_score_base_raw: crossScoreBaseRaw,
        cross_weight:         weight,
        cross_score_final:    scoreFinal,
        tension_level:        tensionLevel,
        is_fragile:           isFragile,
        is_critical:          isCritical,
        interpretation_text,
        risk_summary,
        recommended_focus,
        systemic_weight:      systemicWeight,
        // dim_active flags (informacional)
        dim_a_active:         dimAActive,
        dim_b_active:         dimBActive,
      });
    }

    // ── 5. Ranking de tensões (ascendente por score = mais frágil primeiro) ──
    crossingResults.sort((a, b) => a.cross_score_final - b.cross_score_final);
    crossingResults.forEach((c, i) => { c.tension_rank = i + 1; });

    // ── 6. SystemicDimensionImpact ────────────────────────────────────────────
    const dimImpact = {}; // dimension_key → acumuladores
    for (const cr of crossingResults) {
      for (const dimKey of [cr.dimension_a_key, cr.dimension_b_key]) {
        if (!dimImpact[dimKey]) {
          dimImpact[dimKey] = {
            related: 0, fragile: 0, critical: 0, score_sum: 0,
          };
        }
        dimImpact[dimKey].related++;
        if (cr.is_fragile)  dimImpact[dimKey].fragile++;
        if (cr.is_critical) dimImpact[dimKey].critical++;
        dimImpact[dimKey].score_sum += cr.cross_score_final;
      }
    }

    const dimImpactResults = [];
    for (const [dimKey, acc] of Object.entries(dimImpact)) {
      const avgScore = round2(acc.score_sum / acc.related);
      // leverage_score = (fragile * 3) + (critical * 5) + ((100 - avg) / 20)
      const leverageScore = round2((acc.fragile * 3) + (acc.critical * 5) + ((100 - avgScore) / 20));
      dimImpactResults.push({
        dimension_key:            dimKey,
        dimension_label:          DIM_LABEL[dimKey] || dimKey,
        related_crossings_count:  acc.related,
        fragile_crossings_count:  acc.fragile,
        critical_crossings_count: acc.critical,
        average_cross_score:      avgScore,
        leverage_score:           leverageScore,
        is_systemic_leverage_point: false, // será marcado após ordenação
      });
    }

    // Marcar ponto de alavanca: maior leverage_score
    dimImpactResults.sort((a, b) => b.leverage_score - a.leverage_score);
    if (dimImpactResults.length > 0) {
      dimImpactResults[0].is_systemic_leverage_point = true;
    }

    // Gerar systemic_summary por dimensão
    for (const d of dimImpactResults) {
      if (d.is_systemic_leverage_point) {
        d.systemic_summary = `${d.dimension_label} é o ponto de alavanca sistêmica — intervenções nesta dimensão têm maior potencial de impacto em cascata sobre os demais sistemas organizacionais.`;
      } else if (d.fragile_crossings_count > 0) {
        d.systemic_summary = `${d.dimension_label} apresenta ${d.fragile_crossings_count} cruzamento(s) frágil(is), indicando necessidade de atenção nas interdependências com outras dimensões.`;
      } else {
        d.systemic_summary = `${d.dimension_label} apresenta integração adequada com as demais dimensões do diagnóstico.`;
      }
    }

    const leverageDimension = dimImpactResults.find(d => d.is_systemic_leverage_point) || null;
    const topTensions  = crossingResults.slice(0, 5);
    const strongestCrossing = [...crossingResults].sort((a, b) => b.cross_score_final - a.cross_score_final)[0] || null;
    const fragileCount  = crossingResults.filter(c => c.is_fragile).length;
    const criticalCount = crossingResults.filter(c => c.is_critical).length;

    // ── 7. Síntese executiva ──────────────────────────────────────────────────
    const top3Labels = topTensions.slice(0, 3).map(c => c.crossing_label);
    let executiveSummary = `A análise de interdependência sistêmica indica que as principais tensões da organização se concentram em ${top3Labels.join(', ')}.`;
    if (leverageDimension) {
      executiveSummary += ` O ponto de alavanca identificado é ${leverageDimension.dimension_label}, sugerindo que intervenções estruturais nesta dimensão tendem a gerar efeito multiplicador sobre os demais sistemas organizacionais.`;
    }
    if (crossingResults.some(c => (c.dimension_a_key === 'governanca' || c.dimension_b_key === 'governanca') && c.is_fragile)) {
      executiveSummary += ` Fragilidades na governança e nos controles institucionais estão amplificando desequilíbrios em outras frentes de gestão.`;
    }

    // ── 8. Persistir SystemicCrossingAnalysis (upsert por assessment + crossing_key) ─
    const existingCrossings = await base44.entities.SystemicCrossingAnalysis.filter(
      { assessment_id }, '-created_date', 20
    );
    const existingByKey = new Map(existingCrossings.map(c => [c.crossing_key, c]));

    for (const cr of crossingResults) {
      const payload = {
        tenant_id:    tenantId,
        assessment_id,
        computed_at:  computedAt,
        computed_by:  user.email,
        ...cr,
      };
      delete payload.dim_a_active;
      delete payload.dim_b_active;

      const existing = existingByKey.get(cr.crossing_key);
      if (existing) {
        await base44.entities.SystemicCrossingAnalysis.update(existing.id, payload);
      } else {
        await base44.entities.SystemicCrossingAnalysis.create(payload);
      }
    }

    // ── 9. Persistir SystemicDimensionImpact ─────────────────────────────────
    const existingDimImpacts = await base44.entities.SystemicDimensionImpact.filter(
      { assessment_id }, '-created_date', 20
    );
    const existingDimByKey = new Map(existingDimImpacts.map(d => [d.dimension_key, d]));

    for (const d of dimImpactResults) {
      const payload = {
        tenant_id:    tenantId,
        assessment_id,
        computed_at:  computedAt,
        ...d,
      };
      const existing = existingDimByKey.get(d.dimension_key);
      if (existing) {
        await base44.entities.SystemicDimensionImpact.update(existing.id, payload);
      } else {
        await base44.entities.SystemicDimensionImpact.create(payload);
      }
    }

    console.log(`[computeMfisAnalysis] Done — assessment=${assessment_id} crossings=${crossingResults.length} fragile=${fragileCount} critical=${criticalCount} leverage=${leverageDimension?.dimension_key}`);

    return Response.json({
      ok: true,
      assessment_id,
      crossings_computed: crossingResults.length,
      fragile_count:      fragileCount,
      critical_count:     criticalCount,
      top_tensions:       topTensions,
      strongest_crossing: strongestCrossing,
      leverage_dimension: leverageDimension,
      executive_summary:  executiveSummary,
      // Payload pronto para Fase 3 (PDF)
      pdf_payload: {
        top_systemic_tensions:     topTensions,
        strongest_crossing:        strongestCrossing,
        systemic_leverage_dimension: leverageDimension,
        systemic_summary_text:     executiveSummary,
        systemic_crossings_table:  crossingResults,
        critical_crossings_count:  criticalCount,
        fragile_crossings_count:   fragileCount,
      },
    });

  } catch (e) {
    console.error('[computeMfisAnalysis]', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
});