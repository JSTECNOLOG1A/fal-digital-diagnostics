import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

const DIM_LABEL: Record<string, string> = {
  governanca: 'Governança',
  juridico: 'Jurídico',
  controles_internos: 'Controles Internos',
  financeiro: 'Financeiro',
  contabil: 'Contábil',
  tributario: 'Fiscal / Tributário',
  operacional: 'Operações',
  sistemas: 'Sistemas & Controles',
  estrategia: 'Estratégia',
};

const CROSSING_TYPE_WEIGHT: Record<string, number> = {
  institutional: 1.15, strategic: 1.1, financial: 1.1, operational: 1.05, integrity: 1.0,
};

// estrategia_x_governanca e estrategia_x_financeiro foram removidos deste
// mapa: dependiam de uma dimensão "Estratégia" que nunca existiu no banco
// real de perguntas (não é uma das 8 dimensões canônicas, não é subdimensão
// de nada). Decisão tomada com o usuário: remapear esse conceito pra dentro
// de Governança (que já cobre planejamento estratégico) — ver
// seed-fal-mfis-crossings.ts para o racional completo. Ficam 9 cruzamentos.
const INTERPRETATIONS: Record<string, { fragile: string; risk: string; focus: string }> = {
  governanca_x_juridico: { fragile: 'A interdependência entre governança e estrutura jurídica/societária está comprometida, aumentando exposição a riscos legais e societários.', risk: 'Decisões societárias mal suportadas juridicamente e contratos sem supervisão adequada.', focus: 'Alinhar a estrutura societária e os instrumentos jurídicos com os mecanismos de governança corporativa.' },
  governanca_x_sistemas: { fragile: 'A governança não está sendo plenamente suportada por sistemas e controles formais, reduzindo rastreabilidade e supervisão.', risk: 'Decisões sem registro adequado e ausência de trilha de auditoria nos processos críticos.', focus: 'Implementar sistemas que suportem e registrem as decisões de governança.' },
  financeiro_x_contabil: { fragile: 'Fragilidade entre disciplina financeira e confiabilidade contábil gera risco de inconsistência entre execução financeira e registros gerenciais.', risk: 'Divergência entre resultado real e resultado contábil, comprometendo decisões baseadas em dados.', focus: 'Estabelecer rotinas de conciliação entre gestão financeira e registros contábeis com periodicidade definida.' },
  financeiro_x_tributario: { fragile: 'A integração entre fluxo financeiro e obrigações fiscais está comprometida, gerando risco de passivo tributário não provisionado.', risk: 'Planejamento de caixa sem incorporar obrigações fiscais, resultando em pressão de liquidez em períodos de apuração.', focus: 'Integrar o calendário fiscal ao planejamento financeiro e garantir provisões mensais adequadas.' },
  operacional_x_financeiro: { fragile: 'A operação não está sendo devidamente traduzida em gestão financeira, criando desconexão entre resultado operacional e capacidade financeira.', risk: 'Crescimento operacional sem suporte financeiro ou decisões de investimento sem análise de viabilidade.', focus: 'Estruturar indicadores financeiros que reflitam a performance operacional.' },
  operacional_x_sistemas: { fragile: 'Baixa tradução da rotina operacional em controles formais aumenta o risco de falhas de execução e rastreabilidade.', risk: 'Processos operacionais críticos sem suporte de sistema, controle ou padronização mínima.', focus: 'Mapear e sistematizar os processos operacionais críticos com apoio de ferramentas e controles formais.' },
  sistemas_x_contabil: { fragile: 'A falta de integração entre sistemas de controle e contabilidade compromete a confiabilidade e tempestividade das informações contábeis.', risk: 'Relatórios contábeis desatualizados ou inconsistentes com a realidade operacional.', focus: 'Garantir que os sistemas operacionais alimentem automaticamente os registros contábeis.' },
  contabil_x_tributario: { fragile: 'A qualidade contábil não está sustentando adequadamente a conformidade fiscal, gerando risco de inconsistências tributárias.', risk: 'Escrituração contábil inconsistente com as obrigações acessórias e apurações fiscais.', focus: 'Elevar a qualidade dos lançamentos contábeis como base para obrigações fiscais tempestivas e corretas.' },
  governanca_x_controles_internos: { fragile: 'A governança não está sendo convertida em mecanismos efetivos de controle interno, reduzindo supervisão e disciplina decisória.', risk: 'Decisões sem rastreabilidade, ausência de alçadas definidas e ambiente de controle frágil.', focus: 'Traduzir as diretrizes de governança em políticas e controles internos formalizados e monitorados.' },
};

function safeNum(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? fallback : n;
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function normalize(score03: number): number {
  return round2(Math.min(100, Math.max(0, (score03 / 3) * 100)));
}
function classifyTension(score0100: number): string {
  if (score0100 >= 80) return 'madura';
  if (score0100 >= 60) return 'funcional';
  if (score0100 >= 40) return 'alerta';
  if (score0100 >= 20) return 'fragilidade';
  return 'ruptura';
}
function buildInterpretation(crossingKey: string, score0100: number) {
  const tpl = INTERPRETATIONS[crossingKey];
  if (!tpl) return { interpretation_text: '', risk_summary: '', recommended_focus: '' };
  return {
    interpretation_text:
      score0100 < 60
        ? tpl.fragile
        : `O cruzamento apresenta integração ${score0100 >= 80 ? 'madura' : 'funcional'}, indicando coesão adequada entre as dimensões.`,
    risk_summary: score0100 < 60 ? tpl.risk : 'Sem riscos críticos identificados neste cruzamento.',
    recommended_focus: tpl.focus,
  };
}

type Crossing = { key: string; label: string; dim_a: string; dim_b: string; crossing_type: string; mqe_key: string };

@Injectable()
export class MfisService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  /** Porta de base44/functions/computeMfisAnalysis. */
  async compute(actor: AuthUser, assessmentId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await tx.assessment.findFirst({ where: { id: assessmentId } });
      if (!assessment) throw new NotFoundException('Assessment not found');
      if (!isHQ(actor.role) && actor.tenantId && assessment.tenantId !== actor.tenantId) {
        throw new ForbiddenException('Forbidden');
      }
      const tenantId = assessment.tenantId;

      let crossings: Crossing[] = [];
      if (assessment.methodVersionId) {
        const mv = await tx.methodVersion.findUnique({ where: { id: assessment.methodVersionId } });
        const payload = (mv?.payload as any) || {};
        if (payload.crossings?.length) {
          crossings = payload.crossings.map((c: any) => ({
            key: c.key, label: c.name, dim_a: c.dim_a, dim_b: c.dim_b,
            crossing_type: c.crossing_type || 'operational', mqe_key: c.key,
          }));
        }
      }
      if (!crossings.length) {
        throw new BadRequestException('No crossings defined in MethodVersion');
      }

      const snap = await tx.falDiagnosticSnapshot.findFirst({
        where: { assessmentId }, orderBy: { computedAt: 'desc' },
      });
      if (!snap) throw new NotFoundException('No FalDiagnosticSnapshot found — run diagnostic first');
      const dimScores = (snap.dimensionScores as any) || {};

      const dimScoreMap: Record<string, number> = {};
      for (const [key, data] of Object.entries<any>(dimScores)) {
        if (data.active && data.score !== null && data.score !== undefined) dimScoreMap[key] = safeNum(data.score);
      }

      const mqeResps = await tx.mQEResponse.findMany({ where: { assessmentId } });
      const mqeAccum: Record<string, { sum: number; count: number }> = {};
      for (const r of mqeResps) {
        if (r.crossingKey && r.score !== null && r.score !== undefined) {
          if (!mqeAccum[r.crossingKey]) mqeAccum[r.crossingKey] = { sum: 0, count: 0 };
          mqeAccum[r.crossingKey].sum += safeNum(r.score);
          mqeAccum[r.crossingKey].count += 1;
        }
      }
      const mqeResponseMap: Record<string, number> = {};
      for (const [key, acc] of Object.entries(mqeAccum)) mqeResponseMap[key] = round2(acc.sum / acc.count);

      const computedAt = new Date();
      const crossingResults: any[] = [];

      for (const crossing of crossings) {
        const dimA = safeNum(dimScoreMap[crossing.dim_a], -1);
        const dimB = safeNum(dimScoreMap[crossing.dim_b], -1);
        if (dimA < 0 || dimB < 0) continue;

        let mqeRaw: number | null = null;
        for (const k of [crossing.mqe_key, crossing.key].filter(Boolean)) {
          if (mqeResponseMap[k] !== undefined) { mqeRaw = mqeResponseMap[k]; break; }
        }
        const hasMqeData = mqeRaw !== null;

        let crossScoreBaseRaw = hasMqeData
          ? dimA * 0.35 + dimB * 0.35 + (mqeRaw as number) * 0.3
          : (dimA + dimB) / 2;
        crossScoreBaseRaw = round2(crossScoreBaseRaw);

        const scoreNormalized = normalize(crossScoreBaseRaw);
        const weight = CROSSING_TYPE_WEIGHT[crossing.crossing_type] ?? 1.0;
        const scoreFinal = round2(Math.min(100, scoreNormalized * weight));

        const tensionLevel = classifyTension(scoreFinal);
        const isFragile = scoreFinal < 40;
        const isCritical = scoreFinal < 20;
        const { interpretation_text, risk_summary, recommended_focus } = buildInterpretation(crossing.key, scoreFinal);
        const systemicWeight = round2(Math.min(1.5, 1 + (100 - scoreFinal) / 200));

        crossingResults.push({
          crossingKey: crossing.key, crossingLabel: crossing.label, crossingType: crossing.crossing_type,
          dimensionAKey: crossing.dim_a, dimensionALabel: DIM_LABEL[crossing.dim_a] || crossing.dim_a,
          dimensionBKey: crossing.dim_b, dimensionBLabel: DIM_LABEL[crossing.dim_b] || crossing.dim_b,
          dimensionAScoreRaw: round2(dimA), dimensionBScoreRaw: round2(dimB),
          mqeScoreRaw: mqeRaw !== null ? round2(mqeRaw) : null, hasMqeData,
          crossScoreBaseRaw, crossWeight: weight, crossScoreFinal: scoreFinal,
          tensionLevel, isFragile, isCritical,
          interpretationText: interpretation_text, riskSummary: risk_summary, recommendedFocus: recommended_focus,
          systemicWeight,
        });
      }

      crossingResults.sort((a, b) => a.crossScoreFinal - b.crossScoreFinal);
      crossingResults.forEach((c, i) => (c.tensionRank = i + 1));

      const dimImpact: Record<string, { related: number; fragile: number; critical: number; sum: number }> = {};
      for (const cr of crossingResults) {
        for (const dimKey of [cr.dimensionAKey, cr.dimensionBKey]) {
          if (!dimImpact[dimKey]) dimImpact[dimKey] = { related: 0, fragile: 0, critical: 0, sum: 0 };
          dimImpact[dimKey].related++;
          if (cr.isFragile) dimImpact[dimKey].fragile++;
          if (cr.isCritical) dimImpact[dimKey].critical++;
          dimImpact[dimKey].sum += cr.crossScoreFinal;
        }
      }

      const dimImpactResults: any[] = [];
      for (const [dimKey, acc] of Object.entries(dimImpact)) {
        const avgScore = round2(acc.sum / acc.related);
        const leverageScore = round2(acc.fragile * 3 + acc.critical * 5 + (100 - avgScore) / 20);
        dimImpactResults.push({
          dimensionKey: dimKey, dimensionLabel: DIM_LABEL[dimKey] || dimKey,
          relatedCrossingsCount: acc.related, fragileCrossingsCount: acc.fragile, criticalCrossingsCount: acc.critical,
          averageCrossScore: avgScore, leverageScore, isSystemicLeveragePoint: false,
        });
      }
      dimImpactResults.sort((a, b) => b.leverageScore - a.leverageScore);
      if (dimImpactResults.length > 0) dimImpactResults[0].isSystemicLeveragePoint = true;
      for (const d of dimImpactResults) {
        d.systemicSummary = d.isSystemicLeveragePoint
          ? `${d.dimensionLabel} é o ponto de alavanca sistêmica — intervenções nesta dimensão têm maior potencial de impacto em cascata sobre os demais sistemas organizacionais.`
          : d.fragileCrossingsCount > 0
            ? `${d.dimensionLabel} apresenta ${d.fragileCrossingsCount} cruzamento(s) frágil(is), indicando necessidade de atenção nas interdependências com outras dimensões.`
            : `${d.dimensionLabel} apresenta integração adequada com as demais dimensões do diagnóstico.`;
      }

      const leverageDimension = dimImpactResults.find((d) => d.isSystemicLeveragePoint) || null;
      const topTensions = crossingResults.slice(0, 5);
      const strongestCrossing = [...crossingResults].sort((a, b) => b.crossScoreFinal - a.crossScoreFinal)[0] || null;
      const fragileCount = crossingResults.filter((c) => c.isFragile).length;
      const criticalCount = crossingResults.filter((c) => c.isCritical).length;

      const top3Labels = topTensions.slice(0, 3).map((c) => c.crossingLabel);
      let executiveSummary = `A análise de interdependência sistêmica indica que as principais tensões da organização se concentram em ${top3Labels.join(', ')}.`;
      if (leverageDimension) {
        executiveSummary += ` O ponto de alavanca identificado é ${leverageDimension.dimensionLabel}, sugerindo que intervenções estruturais nesta dimensão tendem a gerar efeito multiplicador sobre os demais sistemas organizacionais.`;
      }
      if (crossingResults.some((c) => (c.dimensionAKey === 'governanca' || c.dimensionBKey === 'governanca') && c.isFragile)) {
        executiveSummary += ' Fragilidades na governança e nos controles institucionais estão amplificando desequilíbrios em outras frentes de gestão.';
      }

      for (const cr of crossingResults) {
        await tx.systemicCrossingAnalysis.upsert({
          where: { assessmentId_crossingKey: { assessmentId, crossingKey: cr.crossingKey } },
          update: { tenantId, computedAt, computedBy: actor.email, ...cr },
          create: { tenantId, assessmentId, computedAt, computedBy: actor.email, ...cr },
        });
      }
      for (const d of dimImpactResults) {
        await tx.systemicDimensionImpact.upsert({
          where: { assessmentId_dimensionKey: { assessmentId, dimensionKey: d.dimensionKey } },
          update: { tenantId, computedAt, ...d },
          create: { tenantId, assessmentId, computedAt, ...d },
        });
      }

      return {
        ok: true, assessmentId, crossingsComputed: crossingResults.length,
        fragileCount, criticalCount, topTensions, strongestCrossing, leverageDimension, executiveSummary,
        pdfPayload: {
          topSystemicTensions: topTensions, strongestCrossing, systemicLeverageDimension: leverageDimension,
          systemicSummaryText: executiveSummary, systemicCrossingsTable: crossingResults,
          criticalCrossingsCount: criticalCount, fragileCrossingsCount: fragileCount,
        },
      };
    });
  }
}
