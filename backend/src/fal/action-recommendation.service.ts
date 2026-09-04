import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import {
  GenerateActionRecommendationsDto,
  ManageActionRecommendationDto,
} from './dto/action-plan.dto';

const DIM_LABELS: Record<string, string> = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal',
  operacional: 'Operacional', sistemas: 'Tecnologia',
};

function getMaturityLabel(score: number): string {
  if (score < 1.0) return 'Crítico';
  if (score < 1.8) return 'Básico';
  if (score < 2.5) return 'Estruturado';
  return 'Avançado';
}
function getPriorityFromScore(score: number): string {
  if (score < 1.0) return 'critical';
  if (score < 1.5) return 'high';
  if (score < 2.0) return 'medium';
  return 'low';
}
function normalizeClusterKey(ck: string | null): string | null {
  return ck && ck.includes(':') ? ck.split(':').pop()! : ck;
}
function normalizeTitle(t: string): string {
  return (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class ActionRecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  async list(actor: AuthUser, query: { assessmentId?: string; actionPlanId?: string; status?: string }) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) => {
      const where: any = isHQ(actor.role) ? {} : { tenantId: actor.tenantId };
      if (query.assessmentId) where.assessmentId = query.assessmentId;
      if (query.actionPlanId) where.actionPlanId = query.actionPlanId;
      if (query.status) where.status = query.status;
      return tx.actionRecommendation.findMany({ where, orderBy: { createdAt: 'desc' } });
    });
  }

  /**
   * Porta de base44/functions/generateActionRecommendations. O motor real
   * usava InvokeLLM (IA) pra escrever o texto — sem integração de LLM neste
   * ambiente, sempre usa o fallback por template (mesma convenção do
   * copiloto do Marco 1: model_used sinalizando que não é texto de IA real).
   */
  async generate(actor: AuthUser, dto: GenerateActionRecommendationsDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const [assessment, plan] = await Promise.all([
        tx.assessment.findFirst({ where: { id: dto.assessmentId } }),
        tx.actionPlan.findFirst({ where: { id: dto.actionPlanId } }),
      ]);
      if (!assessment || !plan) throw new NotFoundException('Assessment ou ActionPlan não encontrado');
      if (!isHQ(actor.role) && assessment.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden');
      const tenantId = assessment.tenantId;
      if (plan.assessmentId !== dto.assessmentId || plan.tenantId !== tenantId) {
        throw new ForbiddenException('Plano não pertence a este assessment/tenant');
      }

      const snap = await tx.falDiagnosticSnapshot.findFirst({
        where: { assessmentId: dto.assessmentId }, orderBy: { computedAt: 'desc' },
      });
      if (!snap) throw new BadRequestException('Nenhum snapshot diagnóstico encontrado. Execute o diagnóstico primeiro.');

      const dimScores = (snap.dimensionScores as any) || {};
      const targetDimensions = dto.scope?.dimensions || Object.keys(dimScores);

      const weakClusters: { dimension_key: string; cluster_key: string | null; cluster_score: number }[] = [];
      for (const dimKey of targetDimensions) {
        const dimData = dimScores[dimKey];
        if (!dimData) continue;
        const clusterScores = dimData.cluster_scores || {};
        for (const [clusterKey, clusterData] of Object.entries<any>(clusterScores)) {
          const clusterScore = typeof clusterData === 'object' ? clusterData.score ?? clusterData : clusterData;
          if (clusterScore < 2.0) weakClusters.push({ dimension_key: dimKey, cluster_key: clusterKey, cluster_score: clusterScore });
        }
        if (Object.keys(clusterScores).length === 0 && (dimData.score || 0) < 2.0) {
          weakClusters.push({ dimension_key: dimKey, cluster_key: null, cluster_score: dimData.score || 0 });
        }
      }

      const existingRecs = await tx.actionRecommendation.findMany({ where: { actionPlanId: dto.actionPlanId, tenantId } });
      const activeRecs = existingRecs.filter((r) => !['rejected', 'cancelled'].includes(r.status));
      const existingClusterKeys = new Set(
        activeRecs.filter((r) => r.clusterKey).map((r) => `${r.dimensionKey}:${normalizeClusterKey(r.clusterKey)}`),
      );
      const existingDimKeys = new Set(activeRecs.map((r) => r.dimensionKey));
      const existingTitlesNorm = new Set(activeRecs.map((r) => normalizeTitle(r.title)));

      let createdCount = 0;
      let skippedCount = 0;
      const createdIds: string[] = [];

      for (const weak of weakClusters) {
        const { dimension_key: dimKey, cluster_key: clusterKey, cluster_score: clusterScore } = weak;
        const normalizedClusterKey = normalizeClusterKey(clusterKey);
        const normalizedLookupKey = normalizedClusterKey ? `${dimKey}:${normalizedClusterKey}` : null;

        if (normalizedClusterKey && existingClusterKeys.has(normalizedLookupKey!)) { skippedCount++; continue; }
        if (!normalizedClusterKey && existingDimKeys.has(dimKey)) { skippedCount++; continue; }

        const dimLabel = DIM_LABELS[dimKey] || dimKey;
        const clusterLabel = clusterKey ? clusterKey.replace(/_/g, ' ').replace(/\bcluster\b/gi, '').trim() : dimLabel;
        const maturityLabel = getMaturityLabel(clusterScore);
        const priority = getPriorityFromScore(clusterScore);

        const title = `Estruturar controles em ${clusterLabel} (${dimLabel})`;
        if (existingTitlesNorm.has(normalizeTitle(title))) {
          skippedCount++;
          if (normalizedClusterKey) existingClusterKeys.add(normalizedLookupKey!); else existingDimKeys.add(dimKey);
          continue;
        }
        const recText = `A frente de ${clusterLabel} na dimensão ${dimLabel} apresentou score ${clusterScore.toFixed(2)}, indicando maturidade ${maturityLabel}. São necessárias ações corretivas para elevar o nível de controle operacional nesta área.`;
        const practicalSteps = `1. Revisar as respostas críticas levantadas no diagnóstico para esta frente.\n2. Designar responsável específico e definir cronograma de implantação.\n3. Documentar o processo e criar indicadores de acompanhamento.`;
        const evidenceRequired = 'Procedimento documentado, responsável designado e indicador de controle ativo.';

        const rec = await tx.actionRecommendation.create({
          data: {
            tenantId, assessmentId: dto.assessmentId, actionPlanId: dto.actionPlanId, sourceType: 'fal_diagnostic',
            sourceRefId: normalizedClusterKey ? `fal_cluster:${dto.assessmentId}:${dimKey}:${normalizedClusterKey}` : `fal_dim:${dto.assessmentId}:${dimKey}`,
            dimensionKey: dimKey, clusterKey: normalizedClusterKey, title, recommendationText: recText,
            practicalSteps, evidenceRequired, priority, impactScore: clusterScore < 1.0 ? 5 : clusterScore < 1.5 ? 4 : 3,
            effortScore: 2, status: 'suggested', createdBy: actor.email,
          },
        });
        createdIds.push(rec.id);
        createdCount++;
        if (normalizedClusterKey) existingClusterKeys.add(normalizedLookupKey!); else existingDimKeys.add(dimKey);
        existingTitlesNorm.add(normalizeTitle(title));
      }

      return { success: true, createdCount, skippedCount, weakClustersFound: weakClusters.length, createdIds };
    });
  }

  /** Porta de base44/functions/manageActionRecommendation. */
  async manage(actor: AuthUser, dto: ManageActionRecommendationDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      if (dto.action === 'create_manual') {
        const data = dto.recommendationData as any;
        if (!data?.title || !data?.recommendation_text) throw new BadRequestException('title e recommendation_text são obrigatórios');
        const tenantId = isHQ(actor.role) ? data.tenant_id : actor.tenantId;
        if (!tenantId) throw new BadRequestException('tenant_id é obrigatório');
        const rec = await tx.actionRecommendation.create({
          data: {
            tenantId, title: data.title, recommendationText: data.recommendation_text,
            dimensionKey: data.dimension_key, subdimensionKey: data.subdimension_key, clusterKey: data.cluster_key,
            rationale: data.rationale, practicalSteps: data.practical_steps, evidenceRequired: data.evidence_required,
            priority: data.priority || 'medium', suggestedOwnerArea: data.suggested_owner_area,
            consultantOriginContext: data.consultant_origin_context, sourceType: 'manual',
            status: 'needs_classification', createdBy: actor.email,
          },
        });
        return { recommendation: rec };
      }

      if (dto.action === 'link_cluster') {
        if (!dto.recommendationId || !dto.clusterKey) throw new BadRequestException('recommendationId e clusterKey são obrigatórios');
        const rec = await tx.actionRecommendation.findFirst({ where: { id: dto.recommendationId } });
        if (!rec) throw new NotFoundException('Recomendação não encontrada');
        if (!isHQ(actor.role) && rec.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden');
        const updated = await tx.actionRecommendation.update({
          where: { id: dto.recommendationId },
          data: { clusterKey: dto.clusterKey, subdimensionKey: dto.subdimensionKey || null },
        });
        return { recommendation: updated };
      }

      if (dto.action === 'edit') {
        if (!dto.recommendationId || !dto.editData) throw new BadRequestException('recommendationId e editData são obrigatórios');
        const rec = await tx.actionRecommendation.findFirst({ where: { id: dto.recommendationId } });
        if (!rec) throw new NotFoundException('Recomendação não encontrada');
        if (!isHQ(actor.role) && rec.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden');
        if (rec.status === 'converted_to_tasks') throw new BadRequestException('Não é possível editar recomendação já convertida em tarefa');
        const allowed = ['title', 'recommendation_text', 'rationale', 'practical_steps', 'evidence_required', 'expected_result', 'suggested_owner_area', 'priority', 'impact_score', 'effort_score'];
        const editData = dto.editData as any;
        const sanitized: any = {};
        const map: Record<string, string> = {
          title: 'title', recommendation_text: 'recommendationText', rationale: 'rationale',
          practical_steps: 'practicalSteps', evidence_required: 'evidenceRequired', expected_result: 'expectedResult',
          suggested_owner_area: 'suggestedOwnerArea', priority: 'priority', impact_score: 'impactScore', effort_score: 'effortScore',
        };
        for (const k of allowed) if (editData[k] !== undefined) sanitized[map[k]] = editData[k];
        const updated = await tx.actionRecommendation.update({ where: { id: dto.recommendationId }, data: sanitized });
        return { recommendation: updated };
      }

      if (!dto.recommendationId) throw new BadRequestException('recommendationId é obrigatório');
      const rec = await tx.actionRecommendation.findFirst({ where: { id: dto.recommendationId } });
      if (!rec) throw new NotFoundException('Recomendação não encontrada');
      if (!isHQ(actor.role) && rec.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden: recomendação pertence a outro tenant');

      if (dto.action === 'approve') {
        if (!['suggested', 'needs_classification'].includes(rec.status)) {
          throw new BadRequestException(`Não é possível aprovar recomendação com status "${rec.status}"`);
        }
        const updated = await tx.actionRecommendation.update({
          where: { id: dto.recommendationId }, data: { status: 'approved', approvedBy: actor.email, approvedAt: new Date() },
        });
        return { recommendation: updated };
      }

      if (dto.action === 'reject') {
        if (['converted_to_tasks', 'rejected', 'cancelled'].includes(rec.status)) {
          throw new BadRequestException(`Não é possível rejeitar recomendação com status "${rec.status}"`);
        }
        const updated = await tx.actionRecommendation.update({
          where: { id: dto.recommendationId }, data: { status: 'rejected', rejectedReason: dto.rejectedReason || '' },
        });
        return { recommendation: updated };
      }

      if (dto.action === 'convert') {
        if (!['suggested', 'approved', 'needs_classification'].includes(rec.status)) {
          throw new BadRequestException(`Recomendação com status "${rec.status}" não pode ser convertida`);
        }
        if (rec.convertedTaskIds?.length > 0) throw new BadRequestException('Recomendação já foi convertida em tarefa');
        if (!dto.planId) throw new BadRequestException('planId é obrigatório');
        if (!dto.taskTitle) throw new BadRequestException('taskTitle é obrigatório');

        const plan = await tx.actionPlan.findFirst({ where: { id: dto.planId } });
        if (!plan) throw new NotFoundException('ActionPlan não encontrado');
        if (!isHQ(actor.role) && plan.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden: plano pertence a outro tenant');

        const daysMap: Record<string, number> = { '30d': 30, '60d': 60, '90d': 90, '180d': 180 };
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (daysMap[dto.horizon || '90d'] || 90));

        const task = await tx.actionTask.create({
          data: {
            tenantId: rec.tenantId, planId: plan.id, assessmentId: rec.assessmentId || plan.assessmentId,
            title: dto.taskTitle, description: dto.description || rec.recommendationText,
            howToExecute: rec.howToExecute || rec.practicalSteps, expectedEvidence: dto.evidenceRequired || rec.evidenceRequired || rec.expectedEvidence,
            reason: rec.rationale, ownerName: dto.ownerName || rec.suggestedOwnerArea || '',
            typicalOwner: rec.suggestedOwnerArea, priority: dto.priority || rec.priority || 'medium',
            horizon: dto.horizon || rec.horizon || '90d', dueDate, impactScore: rec.impactScore, effortScore: rec.effortScore,
            dimensionKey: rec.dimensionKey, subdimensionKey: rec.subdimensionKey, clusterKey: rec.clusterKey,
            status: 'todo', originType: rec.originType || (rec.sourceType === 'manual' ? 'manual' : 'cluster'),
            originScore: rec.originScore, originKey: rec.originKey, originDetail: rec.originDetail,
            sourceType: rec.sourceType === 'financial_diagnostic' ? 'financial_diagnostic' : rec.sourceType === 'manual' ? 'manual' : 'fal_diagnostic',
            financialDiagnosisId: rec.financialDiagnosisId, financialFindingId: rec.financialFindingId,
            evaluatedEntityId: rec.evaluatedEntityId, evaluatedEntityType: rec.evaluatedEntityType, evaluatedEntityName: rec.evaluatedEntityName,
            frequency: rec.frequency || 'once', dependencyTaskKeys: rec.dependencyTaskKeys || [], playbookKey: rec.playbookKey,
            actionLibraryKey: rec.actionLibraryKey, questionActionId: rec.questionActionId,
            evidenceSeverity: rec.evidenceSeverity, evidenceMissing: rec.evidenceMissing ?? false, evidenceQuestions: rec.evidenceQuestions || [],
            isManual: rec.sourceType === 'manual', isSystemGenerated: false, taskLayer: rec.taskLayer || 'strategic',
            taskKey: `rec::${rec.id}::${crypto.randomUUID()}`,
          },
        });
        const existingIds = rec.convertedTaskIds || [];
        await tx.actionRecommendation.update({
          where: { id: dto.recommendationId },
          data: { status: 'converted_to_tasks', convertedTaskIds: [...existingIds, task.id], convertedBy: actor.email, convertedAt: new Date() },
        });
        return { task, recommendationUpdated: true };
      }

      if (dto.action === 'improve_ai') {
        throw new BadRequestException('IA não disponível neste ambiente — sem integração de LLM configurada. Edite a recomendação manualmente (action="edit").');
      }

      if (dto.action === 'suggest_library') {
        if (!rec.dimensionKey || !rec.title) throw new BadRequestException('Recomendação precisa de dimension_key e title para sugerir à biblioteca');
        const entry = await tx.actionRecommendationLibrary.create({
          data: {
            tenantId: rec.tenantId, dimensionKey: rec.dimensionKey, subdimensionKey: rec.subdimensionKey,
            clusterKey: rec.clusterKey, recommendationTitle: rec.title, recommendationText: rec.recommendationText,
            rationale: rec.rationale, practicalSteps: rec.practicalSteps, evidenceRequired: rec.evidenceRequired,
            expectedResult: rec.expectedResult, suggestedOwnerArea: rec.suggestedOwnerArea, impactScore: rec.impactScore,
            effortScore: rec.effortScore, complexityLevel: rec.complexityLevel, isActive: true, isDraft: true,
            suggestedBy: actor.email, createdBy: actor.email,
          },
        });
        await tx.actionRecommendation.update({
          where: { id: dto.recommendationId }, data: { suggestToLibrary: true, libraryEntryId: entry.id },
        });
        return { libraryEntry: entry };
      }

      throw new BadRequestException(`action inválida: ${dto.action}`);
    });
  }
}
