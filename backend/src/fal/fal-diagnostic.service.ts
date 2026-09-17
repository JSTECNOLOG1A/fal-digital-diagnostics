import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { AssessmentService } from './assessment.service';

const ENGINE_VERSION = '3.0.0';

const CANONICAL_DIMENSIONS = [
  { key: 'governanca', axis: 'Governança' },
  { key: 'juridico', axis: 'Jurídico / Societário' },
  { key: 'controles_internos', axis: 'Controles Internos' },
  { key: 'financeiro', axis: 'Financeiro' },
  { key: 'contabil', axis: 'Contábil' },
  { key: 'tributario', axis: 'Fiscal' },
  { key: 'operacional', axis: 'Operacional' },
  { key: 'sistemas', axis: 'Tecnologia / Sistemas' },
];

/**
 * Configuração metodológica padrão. base44 suportava FalMethodologyConfig
 * (por tenant ou global) — não migrado ainda (nenhuma tela de admin criada
 * pra isso e nenhum tenant real depende de override hoje); sempre usa o
 * "builtin" default, que é exatamente o que já acontece hoje quando não há
 * config ativa cadastrada.
 */
const DEFAULT_CONFIG = {
  methodology_version: '3.0.0-default',
  config_id: 'builtin',
  source: 'builtin',
  score_range_max: 3,
  killer_question_enabled: true,
  killer_question_threshold: 2,
  killer_question_cap: 2.0,
  risk_dominance_enabled: true,
  risk_dominance_cluster_threshold: 2.0,
  risk_dominance_dimension_cap: 2.5,
  concentration_penalty_enabled: true,
  concentration_penalty_cluster_threshold: 2.5,
  concentration_penalty_min_clusters: 3,
  concentration_penalty_value: 0.3,
  cluster_min_questions_for_scoring: 1,
  overall_score_method: 'weighted_by_dimension' as const,
  dimension_weights: {} as Record<string, Record<string, number>>,
  level_thresholds: { critico: 1.0, basico: 1.8, estruturado: 2.5 },
  critical_cluster_threshold: 1.0,
};

/**
 * Diagnóstico da Reforma Tributária — mesmas 8 dimensões/regras do FAL 8D,
 * mas com os pesos de dimensão da planilha (Diagnostico_FAL_Reforma_Tributaria_v0_9),
 * já que ali "Tributário" (17%) e "Controles internos" (14%) pesam mais do que
 * o peso implícito 1 (equivalente a igual-peso) usado no FAL 8D clássico.
 * `code` bate com o MethodVersion criado em prisma/seed-tax-reform-method.ts —
 * resolvido em tempo de execução (não por UUID fixo) via reformaTributariaMethodVersionId.
 */
const REFORMA_TRIBUTARIA_METHOD_CODE = 'reforma_tributaria_8d';

const REFORMA_TRIBUTARIA_DIMENSION_WEIGHTS: Record<string, number> = {
  governanca: 0.13,
  juridico: 0.11,
  controles_internos: 0.14,
  financeiro: 0.13,
  contabil: 0.1,
  tributario: 0.17,
  operacional: 0.1,
  sistemas: 0.12,
};

const REFORMA_TRIBUTARIA_CONFIG = {
  ...DEFAULT_CONFIG,
  methodology_version: 'reforma_tributaria_8d-v0.9',
  config_id: 'reforma_tributaria_8d',
  source: 'reforma_tributaria_8d',
  dimension_weights: {
    company: REFORMA_TRIBUTARIA_DIMENSION_WEIGHTS,
    unit: REFORMA_TRIBUTARIA_DIMENSION_WEIGHTS,
    group: REFORMA_TRIBUTARIA_DIMENSION_WEIGHTS,
  } as Record<string, Record<string, number>>,
};

const DEFAULT_CLUSTER_META = {
  impact_weight: 3,
  legal_risk_weight: 2,
  operational_risk_weight: 3,
  financial_impact_weight: 3,
  implementation_effort_weight: 3,
};

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function weightedAvg(items: { value: number; weight: number }[]): number {
  if (!items || items.length === 0) return 0;
  let sumVW = 0;
  let sumW = 0;
  for (const { value, weight } of items) {
    const w = typeof weight === 'number' && weight > 0 ? weight : 1;
    sumVW += (value || 0) * w;
    sumW += w;
  }
  if (sumW === 0) return 0;
  const result = sumVW / sumW;
  return isFinite(result) ? Math.round(result * 100) / 100 : 0;
}

function scoreToLevel(score: number | null, thresholds: typeof DEFAULT_CONFIG.level_thresholds): string {
  if (score === null || score === undefined || isNaN(score)) return 'N/A';
  if (score < thresholds.critico) return 'Crítico';
  if (score < thresholds.basico) return 'Básico';
  if (score < thresholds.estruturado) return 'Estruturado';
  return 'Avançado';
}

function resolveDimensionWeight(cfg: typeof DEFAULT_CONFIG, dimKey: string, targetType: string): number {
  const byTarget = cfg.dimension_weights[targetType] || {};
  return safeNum(byTarget[dimKey], 1);
}

function indexToLevel(idx: number): string {
  if (idx >= 12) return 'CRÍTICA';
  if (idx >= 8) return 'ALTA';
  if (idx >= 4) return 'MÉDIA';
  return 'BAIXA';
}

function computePriorityIndex(clusterScore: number, meta = DEFAULT_CLUSTER_META): number {
  const maturityGap = 3 - Math.min(3, clusterScore);
  const riskScore =
    (meta.legal_risk_weight + meta.operational_risk_weight + meta.financial_impact_weight) / 3;
  const impactFactor = meta.impact_weight;
  const effort = Math.max(1, meta.implementation_effort_weight);
  return Math.round(((maturityGap * riskScore * impactFactor) / effort) * 100) / 100;
}

function benchmarkPosition(score: number, bm: any) {
  if (!bm) return { position: 'sem_benchmark', label: 'Sem dados de benchmark' };
  if (score >= Number(bm.p90Score)) return { position: 'top10', label: 'Top 10% do mercado', icon: '🏆' };
  if (score >= Number(bm.p75Score)) return { position: 'acima', label: 'Acima da média do mercado', icon: '✅' };
  if (score >= Number(bm.avgScore)) return { position: 'medio', label: 'Na média do mercado', icon: '⚠️' };
  return { position: 'abaixo', label: 'Abaixo da média do mercado', icon: '🔴' };
}

function selectRecommendations(recs: any[], priorityLevel: string) {
  const count = priorityLevel === 'CRÍTICA' ? 3 : priorityLevel === 'ALTA' ? 2 : 1;
  return [...recs]
    .sort((a, b) => b.impactLevel - a.impactLevel || a.implementationComplexity - b.implementationComplexity)
    .slice(0, count);
}

@Injectable()
export class FalDiagnosticService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly assessments: AssessmentService,
  ) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  private async loadAssessmentForCompute(tx: PrismaClient, actor: AuthUser, assessmentId: string) {
    const assessment = await tx.assessment.findFirst({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (!isHQ(actor.role) && actor.tenantId && assessment.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Forbidden');
    }
    return assessment;
  }

  /**
   * Núcleo do scoring de UMA dimensão a partir de um conjunto de respostas já
   * filtrado (por entidade, no caso multi-entidade, ou todas as respostas do
   * assessment, no caso single-entidade). Extraído de computeDiagnostic pra
   * poder ser chamado uma vez por entidade em assessments multi_entity_master
   * — ver correção da colisão logo abaixo, em computeDiagnostic.
   */
  private scoreOneDimension(
    subMap: Map<string, Map<string, any[]>> | undefined,
    responseByQuestionId: Map<string, any>,
    cfg: typeof DEFAULT_CONFIG,
    thresholds: typeof DEFAULT_CONFIG.level_thresholds,
  ): {
    score: number; level: string; weight_sum: number; response_count: number;
    subdimension_scores: Record<string, any>; cluster_scores: Record<string, number>;
    penalties: any[]; rules: string[];
  } {
    if (!subMap || subMap.size === 0) {
      return { score: 0, level: 'Crítico', weight_sum: 0, response_count: 0, subdimension_scores: {}, cluster_scores: {}, penalties: [], rules: [] };
    }

    const penaltiesApplied: any[] = [];
    const rulesApplied = new Set<string>();
    const subdimensionScores: Record<string, any> = {};
    const clusterScoresFlat: Record<string, number> = {};
    const dimSubItems: { value: number; weight: number }[] = [];
    let dimResponseCount = 0;

    for (const [subKey, cluMap] of subMap.entries()) {
      const subClusterItems: { value: number; weight: number }[] = [];
      const subClusters: Record<string, any> = {};
      let subRespCount = 0;

      for (const [cluKey, clusterQs] of cluMap.entries()) {
        const clusterItems: { value: number; weight: number }[] = [];
        let hasKillerFail = false;
        let cluRespCount = 0;

        for (const q of clusterQs as any[]) {
          const resp = responseByQuestionId.get(q.id);
          const w = safeNum(q.questionWeight, 1);
          if (resp !== undefined) {
            const s = safeNum(resp.score, 0);
            clusterItems.push({ value: s, weight: w });
            cluRespCount++;
            if (cfg.killer_question_enabled && q.isKillerQuestion === true && s <= cfg.killer_question_threshold) {
              hasKillerFail = true;
            }
          }
        }

        if (cluRespCount < cfg.cluster_min_questions_for_scoring) continue;

        let clusterScore = weightedAvg(clusterItems);
        if (hasKillerFail) {
          const cap = cfg.killer_question_cap;
          if (clusterScore > cap) {
            rulesApplied.add('killer_question_cap');
            penaltiesApplied.push({
              type: 'killer_question_cap', cluster_key: cluKey,
              value: round2(clusterScore - cap),
              detail: `Cluster ${cluKey}: score ${round2(clusterScore)} → cap ${cap}`,
            });
            clusterScore = cap;
          }
        }
        clusterScore = round2(clusterScore);
        subRespCount += cluRespCount;
        dimResponseCount += cluRespCount;

        subClusters[cluKey] = {
          score: clusterScore, level: scoreToLevel(clusterScore, thresholds),
          response_count: cluRespCount, total_questions: (clusterQs as any[]).length,
          killer_capped: hasKillerFail,
        };
        clusterScoresFlat[`${subKey}:${cluKey}`] = clusterScore;

        const totalClusterWeight = (clusterQs as any[]).reduce((s, q) => s + safeNum(q.questionWeight, 1), 0);
        subClusterItems.push({ value: clusterScore, weight: Math.max(totalClusterWeight, 1) });
      }

      if (subClusterItems.length === 0) continue;

      const subScore = weightedAvg(subClusterItems);
      const subTotalWeight = subClusterItems.reduce((s, i) => s + i.weight, 0);

      subdimensionScores[subKey] = {
        score: subScore, level: scoreToLevel(subScore, thresholds), response_count: subRespCount,
        total_questions: [...cluMap.values()].reduce((s, qs) => s + (qs as any[]).length, 0),
        cluster_scores: subClusters,
      };
      dimSubItems.push({ value: subScore, weight: Math.max(subTotalWeight, 1) });
    }

    if (dimSubItems.length === 0) {
      return { score: 0, level: 'Crítico', weight_sum: 0, response_count: 0, subdimension_scores: subdimensionScores, cluster_scores: clusterScoresFlat, penalties: [], rules: [] };
    }

    let dimScore = weightedAvg(dimSubItems);
    const dimTotalWeight = dimSubItems.reduce((s, i) => s + i.weight, 0);

    const clusterScoreValues = Object.values(clusterScoresFlat);
    if (cfg.risk_dominance_enabled && clusterScoreValues.length > 0) {
      const clusterMin = Math.min(...clusterScoreValues);
      if (clusterMin < cfg.risk_dominance_cluster_threshold && dimScore > cfg.risk_dominance_dimension_cap) {
        rulesApplied.add('risk_dominance_cap');
        penaltiesApplied.push({
          type: 'risk_dominance_cap', cluster_key: null,
          value: round2(dimScore - cfg.risk_dominance_dimension_cap),
          detail: `cluster_min=${round2(clusterMin)} < ${cfg.risk_dominance_cluster_threshold} → cap ${cfg.risk_dominance_dimension_cap} (score era ${round2(dimScore)})`,
        });
        dimScore = cfg.risk_dominance_dimension_cap;
      }
    }

    if (cfg.concentration_penalty_enabled && clusterScoreValues.length > 0) {
      const clustersBelow = clusterScoreValues.filter((s) => s < cfg.concentration_penalty_cluster_threshold).length;
      if (clustersBelow >= cfg.concentration_penalty_min_clusters) {
        rulesApplied.add('concentration_penalty');
        const actualScore = round2(Math.max(0, dimScore - cfg.concentration_penalty_value));
        penaltiesApplied.push({
          type: 'concentration_penalty', cluster_key: null,
          value: cfg.concentration_penalty_value,
          detail: `${clustersBelow} clusters < ${cfg.concentration_penalty_cluster_threshold} → -${cfg.concentration_penalty_value} (${round2(dimScore)} → ${actualScore})`,
        });
        dimScore = actualScore;
      }
    }

    dimScore = round2(dimScore);
    return {
      score: dimScore, level: scoreToLevel(dimScore, thresholds), weight_sum: dimTotalWeight,
      response_count: dimResponseCount, subdimension_scores: subdimensionScores, cluster_scores: clusterScoresFlat,
      penalties: penaltiesApplied, rules: [...rulesApplied],
    };
  }

  /** Porta de base44/functions/computeFalDiagnostic. */
  async computeDiagnostic(actor: AuthUser, assessmentId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await this.loadAssessmentForCompute(tx, actor, assessmentId);
      const methodVersion = assessment.methodVersionId
        ? await tx.methodVersion.findUnique({ where: { id: assessment.methodVersionId } })
        : null;
      const cfg = methodVersion?.code === REFORMA_TRIBUTARIA_METHOD_CODE
        ? REFORMA_TRIBUTARIA_CONFIG
        : DEFAULT_CONFIG;
      const thresholds = cfg.level_thresholds;
      const targetType = assessment.targetType || 'company';

      const ALL_DIM_KEYS = CANONICAL_DIMENSIONS.map((d) => d.key);
      const activeDimSet = new Set(
        assessment.activeDimensions?.length
          ? assessment.activeDimensions.filter((d) => ALL_DIM_KEYS.includes(d))
          : ALL_DIM_KEYS,
      );

      let questionSet = assessment.questionSet || [];
      if (questionSet.length === 0) {
        const built = await this.assessments.buildQuestionSet(actor, assessmentId);
        questionSet = built.total > 0
          ? (await tx.assessment.findUnique({ where: { id: assessmentId } }))!.questionSet
          : [];
        if (questionSet.length === 0) {
          throw new BadRequestException('question_set vazio — nenhuma pergunta aplicável encontrada');
        }
      }

      const activeDimsList = [...activeDimSet];
      const [allQuestions, allResponses] = await Promise.all([
        tx.falQuestion.findMany({
          where: { dimensionKey: { in: activeDimsList } },
          orderBy: { sequenceOrder: 'asc' },
        }),
        tx.falResponse.findMany({ where: { assessmentId } }),
      ]);

      const questionMap = new Map(allQuestions.map((q) => [q.id, q]));
      const responseByQuestionId = new Map(allResponses.map((r) => [r.falQuestionId, r]));
      const setQuestions = questionSet.map((id) => questionMap.get(id)).filter(Boolean) as typeof allQuestions;

      const answeredIds = new Set(allResponses.map((r) => r.falQuestionId));
      const unanswered = questionSet.filter((id) => !answeredIds.has(id));
      const completeness =
        questionSet.length > 0
          ? Math.round(((questionSet.length - unanswered.length) / questionSet.length) * 100)
          : 0;

      // ── Árvore dimensão → subdimensão → cluster → [perguntas] ──
      const dimTree = new Map<string, Map<string, Map<string, typeof allQuestions>>>();
      for (const q of setQuestions) {
        const dimKey = q.dimensionKey || '_none';
        const subKey = q.subdimensionKey || '_none';
        const cluKey = q.clusterKey || '_none';
        if (!dimTree.has(dimKey)) dimTree.set(dimKey, new Map());
        const subMap = dimTree.get(dimKey)!;
        if (!subMap.has(subKey)) subMap.set(subKey, new Map());
        const cluMap = subMap.get(subKey)!;
        if (!cluMap.has(cluKey)) cluMap.set(cluKey, [] as any);
        (cluMap.get(cluKey) as any[]).push(q);
      }

      // ── Segmentação por entidade (assessments multi_entity_master) ──
      // Sem isso, respostas de entidades diferentes pra mesma pergunta
      // compartilhada colidiam num único Map keyed só por falQuestionId —
      // a última resposta gravada "vencia" e as outras eram descartadas
      // silenciosamente. Corrigido calculando cada dimensão por entidade
      // (via AssessmentScope) e consolidando por peso, em vez de agrupar
      // tudo numa pool única.
      const scopeRows = await tx.assessmentScope.findMany({ where: { assessmentId } });
      const scopesByDim = new Map<string, typeof scopeRows>();
      for (const s of scopeRows) {
        if (!scopesByDim.has(s.dimensionKey)) scopesByDim.set(s.dimensionKey, []);
        scopesByDim.get(s.dimensionKey)!.push(s);
      }

      const dimensionScores: Record<string, any> = {};
      const penaltiesApplied: any[] = [];
      const rulesApplied = new Set<string>();
      const scopeUpdates: { id: string; data: Prisma.AssessmentScopeUpdateInput }[] = [];

      const buildScopeUpdate = (
        scope: (typeof scopeRows)[number],
        result: { score: number; level: string; response_count: number },
        dimQuestionCount: number,
      ) => {
        const answeredCount = Math.min(result.response_count, dimQuestionCount);
        const completionRatio = dimQuestionCount > 0 ? round2(Math.min(1, answeredCount / dimQuestionCount)) : 0;
        const status = completionRatio >= 1 ? 'completed' : answeredCount > 0 ? 'in_progress' : 'not_started';
        scopeUpdates.push({
          id: scope.id,
          data: {
            score: result.score, maturityLevel: result.level, answeredCount,
            questionCount: dimQuestionCount, requiredCount: dimQuestionCount,
            completionRatio, status,
          },
        });
      };

      for (const dim of CANONICAL_DIMENSIONS) {
        if (!activeDimSet.has(dim.key)) {
          dimensionScores[dim.key] = {
            score: null, level: 'N/A', weight_sum: 0, response_count: 0,
            active: false, subdimension_scores: {}, cluster_scores: {},
          };
          continue;
        }

        const subMap = dimTree.get(dim.key);
        const dimScopes = scopesByDim.get(dim.key) || [];
        const dimQuestionCount = setQuestions.filter((q) => q!.dimensionKey === dim.key).length;

        if (dimScopes.length <= 1) {
          // Caminho single-entidade — mesmo comportamento de sempre
          // (a maioria esmagadora dos assessments não tem AssessmentScope).
          const filteredResp = dimScopes.length === 1
            ? new Map(allResponses.filter((r) => r.evaluatedEntityId === dimScopes[0].evaluatedEntityId).map((r) => [r.falQuestionId, r]))
            : responseByQuestionId;
          const result = this.scoreOneDimension(subMap, filteredResp, cfg, thresholds);
          for (const p of result.penalties) penaltiesApplied.push({ ...p, dimension_key: dim.key });
          for (const r of result.rules) rulesApplied.add(r);
          dimensionScores[dim.key] = {
            score: result.score, level: result.level, weight_sum: result.weight_sum,
            response_count: result.response_count, active: true,
            subdimension_scores: result.subdimension_scores, cluster_scores: result.cluster_scores,
          };
          if (dimScopes.length === 1) buildScopeUpdate(dimScopes[0], result, dimQuestionCount);
          continue;
        }

        // Caminho multi-entidade — calcula cada entidade isoladamente com o
        // mesmo motor de sempre, depois consolida por peso (AssessmentScope.weight).
        const entityResults = dimScopes.map((scope) => {
          const filteredResp = new Map(
            allResponses.filter((r) => r.evaluatedEntityId === scope.evaluatedEntityId).map((r) => [r.falQuestionId, r]),
          );
          const result = this.scoreOneDimension(subMap, filteredResp, cfg, thresholds);
          buildScopeUpdate(scope, result, dimQuestionCount);
          return { scope, result };
        });

        const mergedSubdims: Record<string, any> = {};
        const mergedClusters: Record<string, number> = {};
        const entityScores: any[] = [];
        let mergedResponseCount = 0;
        let mergedWeightSum = 0;

        for (const { scope, result } of entityResults) {
          const label = scope.evaluatedEntityName || scope.evaluatedEntityId;
          for (const [subKey, subData] of Object.entries(result.subdimension_scores)) {
            mergedSubdims[`${label}::${subKey}`] = subData;
          }
          for (const [compositeKey, score] of Object.entries(result.cluster_scores)) {
            mergedClusters[`${label}::${compositeKey}`] = score;
          }
          mergedResponseCount += result.response_count;
          mergedWeightSum += result.weight_sum;
          entityScores.push({
            entity_id: scope.evaluatedEntityId, entity_name: scope.evaluatedEntityName,
            score: result.score, level: result.level, response_count: result.response_count,
          });
          for (const p of result.penalties) {
            penaltiesApplied.push({ ...p, dimension_key: dim.key, entity_id: scope.evaluatedEntityId, entity_name: scope.evaluatedEntityName });
          }
          for (const r of result.rules) rulesApplied.add(r);
        }

        const includedItems = entityResults
          .filter(({ scope }) => scope.includeInConsolidatedScore !== false)
          .map(({ scope, result }) => ({ value: result.score, weight: safeNum(scope.weight, 1) }));
        const consolidatedScore = round2(
          weightedAvg(includedItems.length ? includedItems : entityResults.map(({ result }) => ({ value: result.score, weight: 1 }))),
        );

        dimensionScores[dim.key] = {
          score: consolidatedScore, level: scoreToLevel(consolidatedScore, thresholds),
          weight_sum: mergedWeightSum, response_count: mergedResponseCount, active: true,
          subdimension_scores: mergedSubdims, cluster_scores: mergedClusters, entity_scores: entityScores,
        };
      }

      // ── Score geral ──
      const activeDims = CANONICAL_DIMENSIONS.filter((d) => activeDimSet.has(d.key));
      let overallScore = 0;
      const dimensionWeightsUsed: Record<string, number> = {};

      if (cfg.overall_score_method === 'weighted_by_dimension') {
        rulesApplied.add('weighted_by_dimension_score');
        const items = activeDims.map((d) => {
          const w = resolveDimensionWeight(cfg, d.key, targetType);
          dimensionWeightsUsed[d.key] = w;
          return { value: safeNum(dimensionScores[d.key]?.score, 0), weight: w };
        });
        overallScore = weightedAvg(items);
      } else {
        const vals = activeDims.map((d) => safeNum(dimensionScores[d.key]?.score, 0));
        overallScore = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        activeDims.forEach((d) => (dimensionWeightsUsed[d.key] = 1));
      }

      overallScore = round2(overallScore);
      const overallLevel = scoreToLevel(overallScore, thresholds);
      const maturityIndex = Math.round((overallScore / cfg.score_range_max) * 100);

      const radarPoints = CANONICAL_DIMENSIONS.map((dim) => ({
        axis: dim.axis, dimension: dim.key,
        score: activeDimSet.has(dim.key) ? safeNum(dimensionScores[dim.key]?.score, 0) : 0,
        level: dimensionScores[dim.key]?.level || 'N/A', active: activeDimSet.has(dim.key),
      }));

      const dimensionRiskSummary: Record<string, any> = {};
      for (const dim of CANONICAL_DIMENSIONS) {
        const dimData = dimensionScores[dim.key];
        if (!dimData?.active || !dimData.cluster_scores) continue;
        let criticalKey: string | null = null;
        let criticalScore = Infinity;
        for (const [compositeKey, score] of Object.entries(dimData.cluster_scores as Record<string, number>)) {
          if (typeof score === 'number' && score < criticalScore) {
            criticalScore = score;
            criticalKey = compositeKey;
          }
        }
        dimensionRiskSummary[dim.key] = {
          dimension_score: safeNum(dimData.score, 0),
          critical_cluster_key: criticalKey ? criticalKey.split(':').pop() : null,
          critical_cluster_composite: criticalKey,
          critical_cluster_score: criticalScore === Infinity ? null : round2(criticalScore),
        };
      }

      const gapsTop = radarPoints
        .filter((p) => p.active)
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .map((p) => ({ dimension: p.dimension, axis: p.axis, score: p.score, level: p.level }));

      let criticalClustersCount = 0;
      let totalClustersCount = 0;
      for (const dim of CANONICAL_DIMENSIONS) {
        const dimData = dimensionScores[dim.key];
        if (!dimData?.active || !dimData.cluster_scores) continue;
        for (const score of Object.values(dimData.cluster_scores as Record<string, number>)) {
          totalClustersCount++;
          if (typeof score === 'number' && score < cfg.critical_cluster_threshold) criticalClustersCount++;
        }
      }

      // ── Evolução histórica ──
      let totalEvolution: number | null = null;
      if (assessment.targetType && assessment.targetId) {
        const allTargetAssessments = await tx.assessment.findMany({
          where: {
            tenantId: assessment.tenantId,
            targetType: assessment.targetType,
            targetId: assessment.targetId,
          },
          orderBy: { createdAt: 'asc' },
          take: 100,
        });
        if (allTargetAssessments.length > 1) {
          const first = allTargetAssessments[0];
          if (first.id !== assessmentId) {
            const firstSnap = await tx.falDiagnosticSnapshot.findFirst({
              where: { assessmentId: first.id },
              orderBy: { computedAt: 'desc' },
            });
            if (firstSnap?.overallScore != null) {
              totalEvolution = round2(overallScore - Number(firstSnap.overallScore));
            }
          }
        }
      }

      const methodologyLog = {
        methodology_version: cfg.methodology_version,
        config_id: cfg.config_id,
        config_source: cfg.source,
        engine_version: ENGINE_VERSION,
        overall_score_method: cfg.overall_score_method,
        rules_applied: [...rulesApplied],
        penalties_applied: penaltiesApplied,
        dimension_weights_used: dimensionWeightsUsed,
        thresholds_used: thresholds,
      };

      for (const u of scopeUpdates) {
        await tx.assessmentScope.update({ where: { id: u.id }, data: u.data });
      }

      const saved = await tx.falDiagnosticSnapshot.create({
        data: {
          tenantId: assessment.tenantId,
          assessmentId,
          cycleId: assessment.cycleId,
          targetType: assessment.targetType,
          targetId: assessment.targetId,
          computedBy: actor.email,
          questionSet,
          dimensionScores,
          overallScore,
          overallLevel,
          radarPoints,
          gapsTop,
          sectorSnapshot: [],
          activeDimensions: [...activeDimSet],
          dimensionRiskSummary,
          maturityIndex,
          totalEvolution,
          criticalClustersCount,
          totalClustersCount,
          actionExecutionRate: null,
          impactPotential: null,
          valueLeverSummary: undefined,
          methodologyLog,
        },
      });

      const staleUpdate = {
        diagnosticStatus: 'done',
        diagnosticGeneratedAt: saved.computedAt,
        snapshotId: saved.id,
        staleFromStep: null,
        updatedBy: actor.email,
      };
      await tx.assessmentFlowState.upsert({
        where: { assessmentId },
        update: staleUpdate,
        create: { tenantId: assessment.tenantId, assessmentId, ...staleUpdate },
      });

      await this.audit.log({
        actorId: actor.id,
        tenantId: assessment.tenantId,
        action: 'fal_diagnostic_computed',
        entityType: 'fal_diagnostic_snapshot',
        entityId: saved.id,
      });

      return { ...saved, completenessPct: completeness, unansweredCount: unanswered.length };
    });
  }

  /** Porta de base44/functions/computeFalPriority. */
  async computePriority(actor: AuthUser, assessmentId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await this.loadAssessmentForCompute(tx, actor, assessmentId);
      const snap = await tx.falDiagnosticSnapshot.findFirst({
        where: { assessmentId }, orderBy: { computedAt: 'desc' },
      });
      if (!snap) throw new NotFoundException('No FalDiagnosticSnapshot found');

      const dimScores = (snap.dimensionScores as any) || {};
      const allClusters: { cluster: string; priority_index: number; priority_level: string }[] = [];

      for (const dimData of Object.values<any>(dimScores)) {
        if (!dimData.active || dimData.score === null) continue;
        for (const subData of Object.values<any>(dimData.subdimension_scores || {})) {
          for (const [clusterName, clusterInfo] of Object.entries<any>(subData.cluster_scores || {})) {
            const clusterScore = typeof clusterInfo === 'object' ? (clusterInfo.score ?? 0) : (clusterInfo ?? 0);
            const idx = computePriorityIndex(clusterScore);
            allClusters.push({ cluster: clusterName, priority_index: idx, priority_level: indexToLevel(idx) });
          }
        }
      }

      allClusters.sort((a, b) => b.priority_index - a.priority_index);
      const criticos = allClusters.filter((c) => c.priority_level === 'CRÍTICA').slice(0, 50);
      const alta = allClusters.filter((c) => c.priority_level === 'ALTA').slice(0, 50);
      const media = allClusters.filter((c) => c.priority_level === 'MÉDIA').slice(0, 50);
      const baixa = allClusters.filter((c) => c.priority_level === 'BAIXA').slice(0, 50);

      const priorityComputedAt = new Date();
      const updated = await tx.falDiagnosticSnapshot.update({
        where: { id: snap.id },
        data: {
          clustersCriticos: criticos,
          clustersAltaPrioridade: alta,
          clustersMediaPrioridade: media,
          clustersBaixaPrioridade: baixa,
          priorityComputedAt,
          priorityComputedBy: actor.email,
        },
      });

      await tx.assessmentFlowState.upsert({
        where: { assessmentId },
        update: {
          prioritiesStatus: 'done', prioritiesGeneratedAt: priorityComputedAt,
          prioritiesSnapshotId: snap.id, staleFromStep: null, updatedBy: actor.email,
        },
        create: {
          tenantId: assessment.tenantId, assessmentId, diagnosticStatus: 'done',
          prioritiesStatus: 'done', prioritiesGeneratedAt: priorityComputedAt, prioritiesSnapshotId: snap.id,
        },
      });

      return {
        ok: true, snapshotId: snap.id, totalClusters: allClusters.length,
        criticos: criticos.length, alta: alta.length, media: media.length, baixa: baixa.length,
        snapshot: updated,
      };
    });
  }

  /** Porta de base44/functions/computeClusterIntelligence. */
  async computeIntelligence(actor: AuthUser, assessmentId: string, benchmarkGroup = 'agronegocio') {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await this.loadAssessmentForCompute(tx, actor, assessmentId);
      const snap = await tx.falDiagnosticSnapshot.findFirst({
        where: { assessmentId }, orderBy: { computedAt: 'desc' },
      });
      if (!snap) throw new NotFoundException('No FalDiagnosticSnapshot');

      const [allCauses, allRecs, allBenches] = await Promise.all([
        tx.falClusterCause.findMany(),
        tx.falClusterRecommendation.findMany(),
        tx.falBenchmark.findMany(),
      ]);

      const causesByCluster = new Map<string, typeof allCauses>();
      for (const c of allCauses) {
        if (!causesByCluster.has(c.clusterKey)) causesByCluster.set(c.clusterKey, [] as any);
        (causesByCluster.get(c.clusterKey) as any[]).push(c);
      }
      const recsByCluster = new Map<string, typeof allRecs>();
      for (const r of allRecs) {
        if (!recsByCluster.has(r.clusterKey)) recsByCluster.set(r.clusterKey, [] as any);
        (recsByCluster.get(r.clusterKey) as any[]).push(r);
      }
      const benchByKey = new Map<string, (typeof allBenches)[number]>();
      for (const b of allBenches) benchByKey.set(`${b.clusterKey}:${b.benchmarkGroup}`, b);

      // NOTA: mesma limitação do base44 original — snap.cluster_priority nunca
      // é escrito por computePriority (que grava listas rankeadas separadas,
      // não um mapa por chave), então esse lookup é sempre {} na prática e
      // priority_level cai sempre em 'BAIXA'. Bug pré-existente, portado como
      // está — não introduzido por esta migração.
      const clusterPriorityMap: Record<string, any> = (snap as any).clusterPriority || {};

      const clusterAnalysis: Record<string, any> = {};
      const dimScores = (snap.dimensionScores as any) || {};

      for (const [dimKey, dimData] of Object.entries<any>(dimScores)) {
        if (!dimData.active || dimData.score === null) continue;
        for (const [subKey, subData] of Object.entries<any>(dimData.subdimension_scores || {})) {
          for (const [clusterName, clusterInfo] of Object.entries<any>(subData.cluster_scores || {})) {
            const clusterScore = typeof clusterInfo === 'object' ? clusterInfo.score : clusterInfo;
            if (clusterScore === null || clusterScore === undefined) continue;

            const priorityKey = `${subKey}:${clusterName}`;
            const priorityData = clusterPriorityMap[priorityKey] || {};
            const priorityLevel = priorityData.priority_level || 'BAIXA';

            let rootCauses: any[] = [];
            if (clusterScore < 2.0) {
              rootCauses = (causesByCluster.get(clusterName) || [])
                .filter((c: any) => clusterScore < Number(c.triggerScoreBelow ?? 2.0))
                .sort((a: any, b: any) => Number(b.probabilityWeight || 1) - Number(a.probabilityWeight || 1))
                .slice(0, 3)
                .map((c: any) => ({
                  cause_key: c.causeKey,
                  cause_description: c.causeDescription,
                  probability: Number(c.probabilityWeight) >= 5 ? 'Alta' : Number(c.probabilityWeight) >= 3 ? 'Média' : 'Baixa',
                  probability_weight: Number(c.probabilityWeight),
                }));
            }

            const bm = benchByKey.get(`${clusterName}:${benchmarkGroup}`) || benchByKey.get(`${clusterName}:geral`) || null;
            const bmPosition = benchmarkPosition(clusterScore, bm);
            const benchmarkInfo = bm
              ? {
                  ...bmPosition,
                  avg_score: Number(bm.avgScore),
                  p75_score: bm.p75Score != null ? Number(bm.p75Score) : null,
                  p90_score: bm.p90Score != null ? Number(bm.p90Score) : null,
                  gap_to_avg: round2(Number(bm.avgScore) - clusterScore),
                  gap_to_p75: bm.p75Score != null ? round2(Number(bm.p75Score) - clusterScore) : null,
                  benchmark_group: benchmarkGroup,
                  sample_size: bm.sampleSize,
                }
              : { position: 'sem_benchmark', label: 'Sem dados de benchmark' };

            const recs = recsByCluster.get(clusterName) || [];
            const selectedRecs = selectRecommendations(recs, priorityLevel).map((r: any) => ({
              recommendation_key: r.recommendationKey,
              recommendation_text: r.recommendationText,
              impact_level: r.impactLevel,
              implementation_complexity: r.implementationComplexity,
              estimated_time: r.estimatedTime,
            }));

            clusterAnalysis[priorityKey] = {
              dimension: dimKey, subdimension: subKey, cluster: clusterName, score: clusterScore,
              priority_level: priorityLevel, priority_index: priorityData.priority_index || 0,
              benchmark: benchmarkInfo, root_causes: rootCauses, recommendations: selectedRecs,
            };
          }
        }
      }

      const intelligenceComputedAt = new Date();
      const updated = await tx.falDiagnosticSnapshot.update({
        where: { id: snap.id },
        data: { clusterAnalysis, intelligenceComputedAt, intelligenceBenchmarkGroup: benchmarkGroup },
      });

      await tx.assessmentFlowState.updateMany({
        where: { assessmentId },
        data: {
          intelligenceStatus: 'done', intelligenceGeneratedAt: intelligenceComputedAt,
          intelligenceSnapshotId: snap.id, staleFromStep: null, updatedBy: actor.email,
        },
      });

      const all = Object.values(clusterAnalysis).sort((a: any, b: any) => b.priority_index - a.priority_index);
      return {
        ok: true, snapshotId: snap.id, clustersAnalyzed: all.length,
        clustersWithCauses: all.filter((c: any) => c.root_causes?.length > 0).length,
        clustersBelowBenchmark: all.filter((c: any) => c.benchmark?.position === 'abaixo').length,
        top10: all.slice(0, 10),
        snapshot: updated,
      };
    });
  }

  async getLatestSnapshot(actor: AuthUser, assessmentId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      await this.loadAssessmentForCompute(tx, actor, assessmentId);
      return tx.falDiagnosticSnapshot.findFirst({
        where: { assessmentId },
        orderBy: { computedAt: 'desc' },
      });
    });
  }

  /**
   * Porta de base44/functions/publishFalAssessment. Não portamos o passo de
   * Cycle (a entidade nunca existiu neste ambiente — o original já lidava
   * com essa ausência via optional chaining, caindo num id sentinela
   * `default_<assessmentId>`) nem a atualização de Report (entidade legada
   * excluída do escopo geral desta migração e, na prática, sem nenhuma
   * linha real pra atualizar mesmo no sistema original).
   */
  async publish(actor: AuthUser, assessmentId: string, cycleIdInput?: string) {
    const COVERAGE_THRESHOLD = 0.7;
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await this.loadAssessmentForCompute(tx, actor, assessmentId);
      const cycleId = cycleIdInput || assessment.cycleId || `default_${assessmentId}`;

      const questionSet = assessment.questionSet || [];
      if (questionSet.length === 0) {
        throw new BadRequestException('question_set vazio — monte o questionário antes de publicar');
      }

      const allResponses = await tx.falResponse.findMany({ where: { tenantId: assessment.tenantId, assessmentId } });
      const answeredIds = new Set(allResponses.map((r) => r.falQuestionId));
      const answeredCount = questionSet.filter((id) => answeredIds.has(id)).length;
      const coverage = answeredCount / questionSet.length;

      if (coverage < COVERAGE_THRESHOLD) {
        const unansweredIds = questionSet.filter((id) => !answeredIds.has(id));
        throw new BadRequestException({
          message: `Cobertura insuficiente: ${Math.round(coverage * 100)}% (mínimo 70%). Há ${unansweredIds.length} pergunta(s) sem resposta.`,
          pendencias: unansweredIds,
          coverage: Math.round(coverage * 100),
        });
      }

      let sourceSnapshot = await tx.falDiagnosticSnapshot.findFirst({
        where: { tenantId: assessment.tenantId, assessmentId, status: 'draft' },
        orderBy: { computedAt: 'desc' },
      });
      if (!sourceSnapshot) {
        await this.computeDiagnostic(actor, assessmentId);
        sourceSnapshot = await tx.falDiagnosticSnapshot.findFirst({
          where: { assessmentId }, orderBy: { computedAt: 'desc' },
        });
      }
      if (!sourceSnapshot) throw new BadRequestException('Não foi possível obter FalDiagnosticSnapshot');

      const now = new Date();
      const publishedPayload = {
        tenantId: assessment.tenantId, assessmentId, cycleId, targetType: assessment.targetType,
        targetId: assessment.targetId, answersCoverage: Math.round(coverage * 100) / 100,
        dimensionScores: sourceSnapshot.dimensionScores as Prisma.InputJsonValue,
        overallScore: sourceSnapshot.overallScore, overallLevel: sourceSnapshot.overallLevel,
        radarPoints: sourceSnapshot.radarPoints as Prisma.InputJsonValue,
        gapsTop: sourceSnapshot.gapsTop as Prisma.InputJsonValue, sectorSnapshot: sourceSnapshot.sectorSnapshot,
        activeDimensions: sourceSnapshot.activeDimensions, questionSet: sourceSnapshot.questionSet,
        status: 'published', computedAt: sourceSnapshot.computedAt, publishedAt: now, publishedBy: actor.email,
        sourceSnapshotId: sourceSnapshot.id, methodologyLog: sourceSnapshot.methodologyLog as Prisma.InputJsonValue,
        maturityIndex: sourceSnapshot.maturityIndex, dimensionRiskSummary: sourceSnapshot.dimensionRiskSummary as Prisma.InputJsonValue,
      };

      const existingPublished = await tx.falDiagnosticSnapshot.findFirst({
        where: { tenantId: assessment.tenantId, assessmentId, cycleId, status: 'published' },
        orderBy: { publishedAt: 'desc' },
      });
      const snapshotPublished = existingPublished
        ? await tx.falDiagnosticSnapshot.update({ where: { id: existingPublished.id }, data: publishedPayload })
        : await tx.falDiagnosticSnapshot.create({ data: publishedPayload });

      await tx.assessment.update({
        where: { id: assessmentId },
        data: { status: 'published', completedAt: now, cycleId },
      });

      await this.audit.log({
        actorId: actor.id, tenantId: assessment.tenantId, action: 'assessment_published',
        entityType: 'fal_diagnostic_snapshot', entityId: snapshotPublished.id,
        metadata: {
          cycle_id: cycleId, coverage: Math.round(coverage * 100),
          overall_score: Number(sourceSnapshot.overallScore), overall_level: sourceSnapshot.overallLevel,
          source_snapshot_id: sourceSnapshot.id,
        },
      });

      return { ok: true, snapshotPublished, coverage: Math.round(coverage * 100), cycleId };
    });
  }
}
