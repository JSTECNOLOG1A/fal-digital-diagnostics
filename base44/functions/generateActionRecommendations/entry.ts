import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const DIM_LABELS = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal',
  operacional: 'Operacional', sistemas: 'Tecnologia',
};

function getMaturityLabel(score) {
  if (score < 1.0) return 'Crítico';
  if (score < 1.8) return 'Básico';
  if (score < 2.5) return 'Estruturado';
  return 'Avançado';
}

function getPriorityFromScore(score) {
  if (score < 1.0) return 'critical';
  if (score < 1.5) return 'high';
  if (score < 2.0) return 'medium';
  return 'low';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // SEG-03: Write guard — blocks client_viewer from mutations (WRITE_OPERATION)
    const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
    if (!WRITE_ROLES.has(appRole)) {
      return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });
    }

    const body = await req.json();
    const { assessment_id, action_plan_id, mode = 'library_plus_ai', scope } = body;

    if (!assessment_id || !action_plan_id) {
      return Response.json({ error: 'assessment_id e action_plan_id são obrigatórios' }, { status: 400 });
    }

    const [assessment, plan] = await Promise.all([
      base44.asServiceRole.entities.Assessment.get(assessment_id),
      base44.asServiceRole.entities.ActionPlan.get(action_plan_id),
    ]);

    if (!assessment || !plan) {
      return Response.json({ error: 'Assessment ou ActionPlan não encontrado' }, { status: 404 });
    }

    if (!isHQ && assessment.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = assessment.tenant_id;
    if (plan.assessment_id !== assessment_id || plan.tenant_id !== tenantId) {
      return Response.json({ error: 'Plano não pertence a este assessment/tenant' }, { status: 403 });
    }

    // 1. Snapshot diagnóstico
    const snapshots = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
      { assessment_id }, '-computed_at', 1
    );
    const snapshot = snapshots[0];
    if (!snapshot) {
      return Response.json({ error: 'Nenhum snapshot diagnóstico encontrado. Execute o diagnóstico primeiro.' }, { status: 400 });
    }

    const dimensionScores = snapshot.dimension_scores || {};
    const targetDimensions = scope?.dimensions || Object.keys(dimensionScores);

    // 2. Coletar todos os clusters com scores baixos do snapshot (granularidade de cluster)
    const weakClusters = [];
    for (const dimKey of targetDimensions) {
      const dimData = dimensionScores[dimKey];
      if (!dimData) continue;
      const clusterScores = dimData.cluster_scores || {};
      for (const [clusterKey, clusterData] of Object.entries(clusterScores)) {
        const clusterScore = typeof clusterData === 'object' ? (clusterData.score ?? clusterData) : clusterData;
        if (clusterScore < 2.0) {
          weakClusters.push({
            dimension_key: dimKey,
            cluster_key: clusterKey,
            cluster_score: clusterScore,
            dim_score: dimData.score || 0,
          });
        }
      }
      // Se a dimensão tem score baixo mas não tem clusters detalhados, adicionar como fallback
      if (Object.keys(clusterScores).length === 0 && (dimData.score || 0) < 2.0) {
        weakClusters.push({
          dimension_key: dimKey,
          cluster_key: null,
          cluster_score: dimData.score || 0,
          dim_score: dimData.score || 0,
        });
      }
    }

    // 3. Carregar recomendações existentes para deduplicação
    const existingRecs = await base44.asServiceRole.entities.ActionRecommendation.filter(
      { action_plan_id, tenant_id: tenantId }, 'created_date', 500
    ).catch(() => []);

    const activeRecs = existingRecs.filter(r => !['rejected', 'cancelled'].includes(r.status));

    // Normaliza cluster_key: remove prefixo "dim:" se existir
    const normalizeClusterKey = (ck) => ck && ck.includes(':') ? ck.split(':').pop() : ck;

    // Deduplicação por cluster_key normalizado
    const existingClusterKeys = new Set(
      activeRecs
        .filter(r => r.cluster_key)
        .map(r => `${r.dimension_key}:${normalizeClusterKey(r.cluster_key)}`)
    );
    // Deduplicação por dimensão sem cluster (limitado a 1 por dimensão)
    const existingDimKeys = new Set(
      activeRecs.map(r => r.dimension_key)
    );

    // Normaliza título para comparação de similaridade
    const normalizeTitle = (t) => (t || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const existingTitlesNorm = new Set(activeRecs.map(r => normalizeTitle(r.title)));

    // 4. Buscar respostas do diagnóstico para enriquecer o contexto da IA
    const allResponses = await base44.asServiceRole.entities.FalResponse.filter(
      { assessment_id }, '-created_date', 1000
    ).catch(() => []);

    // Mapear respostas baixas por cluster
    const lowScoreResponsesByCluster = {};
    for (const resp of allResponses) {
      if (resp.score < 2) {
        const key = `${resp.dimension_key}:${resp.cluster_key}`;
        if (!lowScoreResponsesByCluster[key]) lowScoreResponsesByCluster[key] = [];
        lowScoreResponsesByCluster[key].push(resp);
      }
    }

    // 5. Buscar FalQuestions para contextualizar (para enriquecer prompts)
    const falQuestions = await base44.asServiceRole.entities.FalQuestion.filter({}, 'cluster_key', 2000).catch(() => []);
    const questionsByCluster = {};
    for (const q of falQuestions) {
      const key = `${q.dimension_key}:${q.cluster_key}`;
      if (!questionsByCluster[key]) questionsByCluster[key] = [];
      questionsByCluster[key].push(q);
    }

    let createdCount = 0;
    let skippedCount = 0;
    const createdIds = [];

    // 6. Gerar UMA recomendação por cluster fraco (sem duplicatas)
    for (const weak of weakClusters) {
      const { dimension_key: dimKey, cluster_key: clusterKey, cluster_score } = weak;
      const lookupKey = clusterKey ? `${dimKey}:${clusterKey}` : null;

      // Verificar se já existe recomendação ativa para este cluster (normalizado)
      const normalizedClusterKey = normalizeClusterKey(clusterKey);
      const normalizedLookupKey = normalizedClusterKey ? `${dimKey}:${normalizedClusterKey}` : null;

      if (normalizedClusterKey && existingClusterKeys.has(normalizedLookupKey)) {
        skippedCount++;
        continue;
      }
      // Para dimensões sem cluster: só gerar se ainda não tem NENHUMA recomendação ativa nessa dimensão
      if (!normalizedClusterKey && existingDimKeys.has(dimKey)) {
        skippedCount++;
        continue;
      }

      const dimLabel = DIM_LABELS[dimKey] || dimKey;
      const clusterLabel = clusterKey ? clusterKey.replace(/_/g, ' ').replace(/\bcluster\b/gi, '').trim() : dimLabel;
      const maturityLabel = getMaturityLabel(cluster_score);
      const priority = getPriorityFromScore(cluster_score);

      let title = '';
      let recText = '';
      let practicalSteps = '';
      let evidenceRequired = '';
      let expectedResult = '';

      if (mode !== 'library_only') {
        // Construir contexto detalhado das perguntas com score baixo neste cluster
        const clusterResponses = lowScoreResponsesByCluster[lookupKey] || [];
        const clusterQuestions = questionsByCluster[lookupKey] || [];

        // Montar lista de perguntas críticas que falharam
        const failedQuestionsContext = clusterResponses.map(resp => {
          const question = clusterQuestions.find(q => q.question_id === resp.fal_question_id);
          const scoreLabel = resp.score === 0 ? 'Crítico (0)' : resp.score === 1 ? 'Parcial (1)' : 'Em desenvolvimento (1.x)';
          return `- "${question?.question_text || resp.fal_question_id}": Score ${scoreLabel}${resp.justification ? ` — Observação do consultor: "${resp.justification}"` : ''}`;
        }).join('\n');

        const hasDetailedContext = failedQuestionsContext.length > 0;

        try {
          const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Você é um consultor sênior especializado no Método FAL de diagnóstico empresarial.
Gere uma recomendação técnica específica e prática baseada nos resultados do diagnóstico abaixo.

EMPRESA: ${assessment.title}
DIMENSÃO: ${dimLabel}
CLUSTER/FRENTE: ${clusterLabel}
SCORE DO CLUSTER: ${cluster_score.toFixed(2)} / 3.0 (Maturidade: ${maturityLabel})

${hasDetailedContext ? `PERGUNTAS COM FALHA IDENTIFICADAS NO DIAGNÓSTICO:
${failedQuestionsContext}

A recomendação DEVE ser diretamente relacionada às falhas específicas listadas acima.` : `Score abaixo de 2.0 neste cluster. Gere uma recomendação de melhoria estrutural.`}

INSTRUÇÕES:
- O título deve ser específico e acionável (ex: "Implementar conferência sistemática entre pedido de compra e nota fiscal" — NÃO "Estruturar rotina de compras")
- O texto deve explicar O QUE fazer, POR QUÊ é crítico e QUAL O IMPACTO esperado
- Os passos práticos devem ser concretos, numerados e executáveis
- As evidências devem ser documentos ou registros específicos que comprovam a implementação
- Evite frases genéricas como "definir responsável e documentar procedimento"
- Use linguagem profissional mas direta

Retorne JSON com: title, recommendation_text, practical_steps, evidence_required, expected_result`,
            response_json_schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                recommendation_text: { type: 'string' },
                practical_steps: { type: 'string' },
                evidence_required: { type: 'string' },
                expected_result: { type: 'string' },
              }
            }
          });

          if (aiResult?.title) {
            title = aiResult.title;
            recText = aiResult.recommendation_text || '';
            practicalSteps = aiResult.practical_steps || '';
            evidenceRequired = aiResult.evidence_required || '';
            expectedResult = aiResult.expected_result || '';
          }
        } catch (e) {
          // fallback abaixo
        }
      }

      // Verificar similaridade de título antes de criar (evita duplicatas semânticas da IA)
      if (title) {
        const titleNorm = normalizeTitle(title);
        if (existingTitlesNorm.has(titleNorm)) {
          skippedCount++;
          if (normalizedClusterKey) existingClusterKeys.add(normalizedLookupKey);
          else existingDimKeys.add(dimKey);
          continue;
        }
      }

      // Fallback se IA falhou ou modo library_only
      if (!title) {
        title = `Estruturar controles em ${clusterLabel} (${dimLabel})`;
        recText = `A frente de ${clusterLabel} na dimensão ${dimLabel} apresentou score ${cluster_score.toFixed(2)}, indicando maturidade ${maturityLabel}. São necessárias ações corretivas para elevar o nível de controle operacional nesta área.`;
        practicalSteps = `1. Revisar as respostas críticas levantadas no diagnóstico para esta frente.\n2. Designar responsável específico e definir cronograma de implantação.\n3. Documentar o processo e criar indicadores de acompanhamento.`;
        evidenceRequired = `Procedimento documentado, responsável designado e indicador de controle ativo.`;
      }

      const rec = await base44.asServiceRole.entities.ActionRecommendation.create({
        tenant_id: tenantId,
        assessment_id,
        action_plan_id,
        source_type: 'fal_diagnostic',
        source_ref_id: normalizedClusterKey
          ? `fal_cluster:${assessment_id}:${dimKey}:${normalizedClusterKey}`
          : `fal_dim:${assessment_id}:${dimKey}`,
        dimension_key: dimKey,
        cluster_key: normalizedClusterKey || null,
        title,
        recommendation_text: recText,
        practical_steps: practicalSteps,
        evidence_required: evidenceRequired,
        expected_result: expectedResult || null,
        priority,
        impact_score: cluster_score < 1.0 ? 5 : cluster_score < 1.5 ? 4 : 3,
        effort_score: 2,
        status: 'suggested',
        created_by: user.email,
      });

      createdIds.push(rec.id);
      createdCount++;

      // Marcar como coberto para evitar duplicatas dentro do mesmo loop
      if (normalizedClusterKey) existingClusterKeys.add(normalizedLookupKey);
      else existingDimKeys.add(dimKey);
      existingTitlesNorm.add(normalizeTitle(title));
    }

    return Response.json({
      success: true,
      createdCount,
      skippedCount,
      weakClustersFound: weakClusters.length,
      created_ids: createdIds,
      mode,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});