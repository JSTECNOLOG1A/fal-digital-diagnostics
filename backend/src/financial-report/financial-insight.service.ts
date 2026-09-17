import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { FinancialOutputService } from '../financial/financial-output.service';
import { ActionPlanService } from '../fal/action-plan.service';
import {
  detectComparisonFindings,
  detectCrossStatementFindings,
  detectSnapshotFindings,
  IndicatorRow,
  StatementRow,
} from './financial-finding-detector.util';
import { findRecommendationMapping } from './financial-recommendation-map.const';
import {
  ConvertFinancialRecommendationDto,
  CreateManualFinancialFindingDto,
  GenerateFinancialFindingsDto,
  GenerateFinancialRecommendationsDto,
  ManageFinancialFindingDto,
  ManageFinancialRecommendationDto,
  UpdateFinancialRecommendationDto,
} from './dto/financial-report.dto';

const HORIZON_DAYS: Record<string, number> = { '30d': 30, '60d': 60, '90d': 90, '180d': 180 };

/**
 * Achados/Recomendações/Propostas de ação do diagnóstico financeiro — porta
 * de generateFinancialInterpretations, generateFinancialRecommendations e
 * convertFinancialRecommendation (base44/functions/*), promovendo o que lá
 * era mock local (FinancialFinding/Recommendation/ActionProposal via
 * localStorage) para tabelas reais. Ver nota de arquitetura no início do
 * bloco "Relatório da Análise Financeira" em schema.prisma.
 */
@Injectable()
export class FinancialInsightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly output: FinancialOutputService,
    private readonly actionPlans: ActionPlanService,
    private readonly audit: AuditService,
  ) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  private async loadDiagnosis(actor: AuthUser, diagnosisId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const diagnosis = await tx.financialDiagnosis.findFirst({ where: { id: diagnosisId, deletedAt: null } });
      if (!diagnosis) throw new NotFoundException('FinancialDiagnosis not found');
      if (!isHQ(actor.role) && actor.tenantId !== diagnosis.tenantId) {
        throw new ForbiddenException('Tenant scope violation');
      }
      return diagnosis;
    });
  }

  // ── Achados ──────────────────────────────────────────────────────────

  async listFindings(actor: AuthUser, diagnosisId: string) {
    await this.loadDiagnosis(actor, diagnosisId);
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialFinding.findMany({ where: { financialDiagnosisId: diagnosisId }, orderBy: [{ period: 'desc' }, { severity: 'desc' }] }),
    );
  }

  async generateFindings(actor: AuthUser, dto: GenerateFinancialFindingsDto) {
    const diagnosis = await this.loadDiagnosis(actor, dto.financialDiagnosisId);
    const mode = dto.mode || 'replace';

    const scope = await this.output.resolveOutputScope(actor, dto.financialDiagnosisId);
    if ('error' in scope) throw new BadRequestException(scope.error);

    // Sem processingRunId: cada período tem seu próprio processing run
    // "active" (upload por ano) — mesma regra de agregação usada por
    // buildPayload() em financial-report-data.service.ts (ver comentário lá).
    // Restringir a um único processing_run_id (o "snapshot atual") descarta
    // todos os períodos exceto o mais recente, deixando o motor de achados
    // sem dados pra detectar qualquer coisa num diagnóstico multi-upload.
    const [rawIndicators, rawStatementLines] = await Promise.all([
      this.output.listIndicatorSnapshots(actor, dto.financialDiagnosisId, { publicationStatus: 'active' }),
      this.output.listStatementLines(actor, dto.financialDiagnosisId, { publicationStatus: 'active' }),
    ]);

    const indicators: IndicatorRow[] = rawIndicators
      .filter((i) => !i.entityCode)
      .map((i) => ({ indicatorCode: i.indicatorCode, period: i.period, value: i.value === null ? null : Number(i.value) }));
    const statementLines: StatementRow[] = rawStatementLines
      .filter((l) => !l.entityCode)
      .map((l) => ({ canonicalKey: l.canonicalKey, statementCode: l.statementCode, period: l.period, value: Number(l.value) }));

    const periods = [...new Set(indicators.map((i) => i.period))].sort();

    const detected = [
      ...detectSnapshotFindings(indicators, statementLines, periods),
      ...detectComparisonFindings(indicators, statementLines, periods),
      ...detectCrossStatementFindings(indicators, statementLines, periods),
    ];

    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      // ── Preserva status/curadoria de achados já existentes (mesma chave) ──
      const existingAuto = await tx.financialFinding.findMany({
        where: { financialDiagnosisId: dto.financialDiagnosisId, origin: 'auto_interpretation' },
      });
      const existingByKey = new Map(existingAuto.map((f) => [f.findingKey, f]));

      let deletedCount = 0;
      if (mode === 'replace') {
        const del = await tx.financialFinding.deleteMany({
          where: { financialDiagnosisId: dto.financialDiagnosisId, origin: 'auto_interpretation' },
        });
        deletedCount = del.count;
      }

      const rowsToCreate: Prisma.FinancialFindingCreateManyInput[] = [];
      const seen = new Set<string>();
      for (const f of detected) {
        const findingKey = [f.period ?? 'geral', f.comparisonPeriod ?? '', f.findingType].join('|');
        if (seen.has(findingKey)) continue;
        seen.add(findingKey);
        const previous = existingByKey.get(findingKey);
        rowsToCreate.push({
          tenantId: diagnosis.tenantId,
          financialDiagnosisId: dto.financialDiagnosisId,
          groupId: diagnosis.groupId,
          companyId: diagnosis.companyId,
          unitId: diagnosis.unitId,
          title: f.title,
          description: f.description,
          severity: f.severity,
          findingType: f.findingType,
          financialIndicator: f.financialIndicator ?? null,
          period: f.period,
          comparisonPeriod: f.comparisonPeriod ?? null,
          findingScope: f.findingScope,
          findingKey,
          sourceType: f.sourceType,
          sourceRefId: f.sourceRefId ?? null,
          origin: 'auto_interpretation',
          confidenceLevel: f.confidenceLevelOverride ?? 'medium',
          status: previous?.status === 'converted_to_recommendation' ? 'converted_to_recommendation' : (previous?.status ?? 'open'),
          evidenceNumeric: f.evidenceNumeric as unknown as Prisma.InputJsonValue,
          reportInclusionStatus: previous?.reportInclusionStatus ?? 'candidate',
        });
      }

      if (rowsToCreate.length > 0) {
        await tx.financialFinding.createMany({ data: rowsToCreate });
      }

      return {
        success: true,
        mode,
        deleted: deletedCount,
        created: rowsToCreate.length,
        periods_analyzed: periods,
      };
    });
  }

  async createManualFinding(actor: AuthUser, dto: CreateManualFinancialFindingDto) {
    const diagnosis = await this.loadDiagnosis(actor, dto.financialDiagnosisId);
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialFinding.create({
        data: {
          tenantId: diagnosis.tenantId,
          financialDiagnosisId: dto.financialDiagnosisId,
          groupId: diagnosis.groupId,
          companyId: diagnosis.companyId,
          unitId: diagnosis.unitId,
          title: dto.title,
          description: dto.description,
          severity: dto.severity ?? 'medium',
          findingType: 'manual',
          period: dto.period,
          findingScope: 'period_snapshot',
          findingKey: `manual::${crypto.randomUUID()}`,
          sourceType: 'manual',
          origin: 'manual',
          confidenceLevel: 'medium',
          status: 'open',
          evidenceNumeric: (dto.evidenceNumeric ?? []) as unknown as Prisma.InputJsonValue,
          reportInclusionStatus: 'candidate',
        },
      }),
    );
  }

  async manageFinding(actor: AuthUser, id: string, dto: ManageFinancialFindingDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const finding = await tx.financialFinding.findFirst({ where: { id } });
      if (!finding) throw new NotFoundException('Finding not found');
      if (!isHQ(actor.role) && finding.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden');

      const data: Prisma.FinancialFindingUpdateInput = {};
      switch (dto.action) {
        case 'approve':
          data.reportInclusionStatus = 'approved';
          break;
        case 'edit':
          if (!dto.editedText) throw new BadRequestException('editedText is required for action=edit');
          data.reportInclusionStatus = 'edited';
          data.reportInclusionEditedText = dto.editedText;
          break;
        case 'exclude':
          data.reportInclusionStatus = 'excluded';
          break;
        case 'internal_only':
          data.reportInclusionStatus = 'internal_only';
          break;
        case 'unapprove':
          // Desfaz approve/edit — volta pra 'candidate' (fora do relatório
          // até nova decisão), sem mexer em reportInclusionEditedText (não
          // perde o texto editado, só o consultor decide se volta a valer)
          // nem em nenhum campo de Plano de Ação (actionPlanStatus/
          // actionTaskId) — são decisões independentes por design (ver
          // FindingCard em FinancialActionsPanel.jsx).
          data.reportInclusionStatus = 'candidate';
          break;
        case 'reopen':
          data.status = 'open';
          break;
        case 'ignore':
          data.status = 'ignored';
          break;
      }
      if (dto.classification) data.classification = dto.classification;

      return tx.financialFinding.update({ where: { id }, data });
    });
  }

  // ── Recomendações ────────────────────────────────────────────────────

  /** Curadoria de inclusão na seção "4. Recomendações avulsas" do relatório — mesmo padrão de manageFinding, independente do reportInclusionStatus do achado-pai (ver comentário no schema, FinancialRecommendation.reportInclusionStatus). */
  async manageRecommendation(actor: AuthUser, id: string, dto: ManageFinancialRecommendationDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const rec = await tx.financialRecommendation.findFirst({ where: { id } });
      if (!rec) throw new NotFoundException('Recommendation not found');
      if (!isHQ(actor.role) && rec.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden');

      const data: Prisma.FinancialRecommendationUpdateInput = {};
      switch (dto.action) {
        case 'approve':
          data.reportInclusionStatus = 'approved';
          break;
        case 'edit':
          data.reportInclusionStatus = 'edited';
          if (dto.title !== undefined) data.title = dto.title;
          if (dto.diagnosticThesis !== undefined) data.diagnosticThesis = dto.diagnosticThesis;
          if (dto.suggestedAction !== undefined) data.suggestedAction = dto.suggestedAction;
          if (dto.expectedImpact !== undefined) data.expectedImpact = dto.expectedImpact;
          break;
        case 'exclude':
          data.reportInclusionStatus = 'excluded';
          break;
        case 'internal_only':
          data.reportInclusionStatus = 'internal_only';
          break;
        case 'unapprove':
          data.reportInclusionStatus = 'candidate';
          break;
      }

      return tx.financialRecommendation.update({ where: { id }, data });
    });
  }

  async listRecommendations(actor: AuthUser, diagnosisId: string) {
    await this.loadDiagnosis(actor, diagnosisId);
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialRecommendation.findMany({ where: { financialDiagnosisId: diagnosisId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async listActionProposals(actor: AuthUser, diagnosisId: string) {
    await this.loadDiagnosis(actor, diagnosisId);
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialActionProposal.findMany({ where: { financialDiagnosisId: diagnosisId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async generateRecommendations(actor: AuthUser, dto: GenerateFinancialRecommendationsDto) {
    const diagnosis = await this.loadDiagnosis(actor, dto.financialDiagnosisId);
    const mode = dto.mode || 'replace';

    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const openFindings = await tx.financialFinding.findMany({
        where: { financialDiagnosisId: dto.financialDiagnosisId, origin: 'auto_interpretation', status: 'open' },
      });

      if (mode === 'replace') {
        const autoRecs = await tx.financialRecommendation.findMany({
          where: { financialDiagnosisId: dto.financialDiagnosisId, financialFindingId: { not: null } },
        });
        const openFindingIds = new Set(openFindings.map((f) => f.id));
        const toDelete = autoRecs.filter((r) => r.financialFindingId && openFindingIds.has(r.financialFindingId));
        if (toDelete.length > 0) {
          await tx.financialActionProposal.deleteMany({ where: { financialRecommendationId: { in: toDelete.map((r) => r.id) } } });
          await tx.financialRecommendation.deleteMany({ where: { id: { in: toDelete.map((r) => r.id) } } });
        }
      }

      const existingFindingIdsWithRec = new Set(
        (
          await tx.financialRecommendation.findMany({
            where: { financialDiagnosisId: dto.financialDiagnosisId, financialFindingId: { not: null } },
            select: { financialFindingId: true },
          })
        ).map((r) => r.financialFindingId),
      );

      let recommendationsCreated = 0;
      let actionProposalsCreated = 0;
      const created: Array<{ findingId: string; recommendationId: string; proposalId: string }> = [];

      for (const finding of openFindings) {
        if (existingFindingIdsWithRec.has(finding.id)) continue;
        const mapping = findRecommendationMapping(finding.findingType);
        if (!mapping) continue;

        const horizonLabel = { '30d': '30 dias', '60d': '60 dias', '90d': '90 dias' }[mapping.horizon];
        const recommendation = await tx.financialRecommendation.create({
          data: {
            tenantId: diagnosis.tenantId,
            financialDiagnosisId: dto.financialDiagnosisId,
            financialFindingId: finding.id,
            title: mapping.title,
            diagnosticThesis: finding.title,
            probableCause: finding.description,
            suggestedAction: mapping.description,
            expectedImpact: `Horizonte sugerido: ${horizonLabel}. Área sugerida: ${mapping.area}.`,
            priority: mapping.priority,
            editableText: mapping.description,
            relatedIndicatorCodes: finding.financialIndicator ? [finding.financialIndicator] : [],
          },
        });
        const proposal = await tx.financialActionProposal.create({
          data: {
            tenantId: diagnosis.tenantId,
            financialDiagnosisId: dto.financialDiagnosisId,
            financialRecommendationId: recommendation.id,
            title: `Executar: ${mapping.title}`,
            description: `${mapping.description} (Horizonte sugerido: ${horizonLabel}; Área sugerida: ${mapping.area})`,
            priority: mapping.priority,
            status: 'proposed',
          },
        });
        await tx.financialFinding.update({ where: { id: finding.id }, data: { status: 'converted_to_recommendation' } });

        recommendationsCreated++;
        actionProposalsCreated++;
        created.push({ findingId: finding.id, recommendationId: recommendation.id, proposalId: proposal.id });
      }

      return { success: true, mode, findings_read: openFindings.length, recommendations_created: recommendationsCreated, action_proposals_created: actionProposalsCreated, created };
    });
  }

  async updateRecommendation(actor: AuthUser, id: string, dto: UpdateFinancialRecommendationDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const rec = await tx.financialRecommendation.findFirst({ where: { id } });
      if (!rec) throw new NotFoundException('Recommendation not found');
      if (!isHQ(actor.role) && rec.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden');
      return tx.financialRecommendation.update({
        where: { id },
        data: {
          ...(dto.editableText !== undefined ? { editableText: dto.editableText } : {}),
          ...(dto.consultantComment !== undefined ? { consultantComment: dto.consultantComment } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        },
      });
    });
  }

  /**
   * Converte uma FinancialRecommendation em ActionTask direto no plano de
   * ação central do grupo — porta de convertFinancialRecommendation. Não
   * passa por ActionRecommendation: a curadoria já aconteceu no achado →
   * recomendação → clique do consultor neste endpoint, que É a aprovação.
   */
  async convertRecommendation(actor: AuthUser, dto: ConvertFinancialRecommendationDto) {
    if (!isHQ(actor.role) && actor.role !== 'tenant_admin' && actor.role !== 'consultant') {
      throw new ForbiddenException('Forbidden: write permission required');
    }
    const diagnosis = await this.loadDiagnosis(actor, dto.financialDiagnosisId);

    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const rec = dto.financialRecommendationId
        ? await tx.financialRecommendation.findFirst({ where: { id: dto.financialRecommendationId } })
        : null;
      if (dto.financialRecommendationId && !rec) throw new NotFoundException('Recomendação financeira não encontrada');

      // Envio direto de um achado, sem recomendação pré-existente — ver
      // comentário no DTO. Serve tanto os achados sem mapeamento em
      // RECOMMENDATION_MAP (cross_statement) quanto qualquer achado que o
      // consultor queira enviar diretamente pela tela de revisão.
      const finding = dto.financialFindingId
        ? await tx.financialFinding.findFirst({ where: { id: dto.financialFindingId, financialDiagnosisId: dto.financialDiagnosisId } })
        : null;
      if (dto.financialFindingId && !finding) throw new NotFoundException('Achado financeiro não encontrado');

      const groupId = diagnosis.groupId || diagnosis.companyId;
      if (!groupId) throw new BadRequestException('Diagnóstico financeiro sem grupo/empresa vinculado');

      // Mesma lógica de resolução de convertFinancialRecommendation: qualquer
      // plano já existente do grupo serve (independente de ter nascido do
      // motor 8D com assessmentId ou de uma conversão financeira anterior) —
      // planKey só precisa ser único na criação, não é usado na busca.
      let plan = await tx.actionPlan.findFirst({
        where: { groupId, tenantId: diagnosis.tenantId },
        orderBy: { generatedAt: 'desc' },
      });
      if (!plan) {
        const groupAssessment = await tx.assessment.findFirst({
          where: { groupId, tenantId: diagnosis.tenantId },
          orderBy: { createdAt: 'desc' },
        });
        plan = await tx.actionPlan.create({
          data: {
            tenantId: diagnosis.tenantId,
            assessmentId: groupAssessment?.id ?? null,
            groupId,
            targetType: 'group',
            targetId: groupId,
            planKey: [groupAssessment?.id ?? 'financial_diagnostic', 'group', groupId].join('|'),
            status: 'draft',
            generatedAt: new Date(),
            generatedBy: actor.email,
          },
        });
      }

      const horizon = dto.horizon || '90d';
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (HORIZON_DAYS[horizon] || 90));

      const indicatorLabel = dto.indicatorLabel || dto.indicatorCode || rec?.relatedIndicatorCodes?.[0] || 'Análise Financeira';
      const operationId = crypto.randomUUID();
      const taskTitle = dto.taskTitle || finding?.title;
      if (!taskTitle) throw new BadRequestException('taskTitle é obrigatório');

      const task = await tx.actionTask.create({
        data: {
          tenantId: diagnosis.tenantId,
          planId: plan.id,
          assessmentId: plan.assessmentId,
          sourceType: 'financial_diagnostic',
          financialDiagnosisId: dto.financialDiagnosisId,
          financialFindingId: rec?.financialFindingId ?? finding?.id ?? null,
          title: taskTitle,
          description: dto.description || rec?.suggestedAction || rec?.diagnosticThesis || finding?.description || taskTitle,
          reason: rec?.diagnosticThesis || rec?.probableCause || finding?.title || '',
          ownerName: dto.ownerName || '',
          priority: dto.priority || 'medium',
          horizon,
          dueDate,
          status: 'todo',
          originType: 'manual',
          originDetail: `Análise Financeira · ${indicatorLabel}`,
          isManual: true,
          isSystemGenerated: false,
          taskLayer: 'strategic',
          dimensionKey: 'analise_financeira',
          clusterKey: indicatorLabel,
          operationId,
          taskKey: `finrec::${rec?.id ?? 'manual'}::${Date.now()}`,
        } as Prisma.ActionTaskUncheckedCreateInput,
      });

      if (rec) {
        await tx.financialRecommendation.update({
          where: { id: rec.id },
          data: { isApproved: true, approvedBy: actor.email, approvedAt: new Date() },
        });

        const proposal = await tx.financialActionProposal.findFirst({ where: { financialRecommendationId: rec.id } });
        if (proposal) {
          await tx.financialActionProposal.update({
            where: { id: proposal.id },
            data: { status: 'exported', exportedToFal: true, falActionPlanId: plan.id, falActionTaskId: task.id, exportedAt: new Date() },
          }).catch(() => undefined);
        }
      }

      // Marca o achado como convertido — vale tanto pro achado ligado a uma
      // recomendação (rec.financialFindingId) quanto pro envio direto
      // (finding, sem recomendação — ver comentário no DTO).
      const findingIdToUpdate = rec?.financialFindingId ?? finding?.id ?? null;
      if (findingIdToUpdate) {
        await tx.financialFinding.update({
          where: { id: findingIdToUpdate },
          data: {
            actionPlanStatus: 'converted_to_task',
            actionRecommendationId: rec?.id ?? null,
            actionTaskId: task.id,
            actionPlanId: plan.id,
            convertedToTaskAt: new Date(),
            convertedToTaskBy: actor.email,
          },
        }).catch(() => undefined);
      }

      await this.actionPlans.recalculate(tx, plan.id);

      await this.audit.log({
        actorId: actor.id,
        tenantId: diagnosis.tenantId,
        action: 'financial_recommendation.convert',
        entityType: 'action_task',
        entityId: task.id,
        metadata: { financialDiagnosisId: dto.financialDiagnosisId, financialRecommendationId: rec?.id ?? null, financialFindingId: findingIdToUpdate },
      });

      return { task, planId: plan.id };
    });
  }

  /**
   * "Estornar o envio" — desfaz um convertRecommendation anterior. Segue a
   * mesma convenção já usada em todo o Plano de Ação (ActionTask nunca é
   * apagada, só transiciona de status — ver STATUS_OPTIONS em
   * ListaExecutivaTab.jsx): a tarefa vai pra 'cancelled', não é deletada,
   * preservando histórico. O achado/recomendação de origem volta ao estado
   * "não enviado", liberando um novo envio (que cria uma tarefa nova).
   */
  async unconvertToTask(actor: AuthUser, dto: { actionTaskId: string; financialDiagnosisId: string }) {
    if (!isHQ(actor.role) && actor.role !== 'tenant_admin' && actor.role !== 'consultant') {
      throw new ForbiddenException('Forbidden: write permission required');
    }
    const diagnosis = await this.loadDiagnosis(actor, dto.financialDiagnosisId);

    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const task = await tx.actionTask.findFirst({ where: { id: dto.actionTaskId, financialDiagnosisId: dto.financialDiagnosisId } });
      if (!task) throw new NotFoundException('Tarefa não encontrada para este diagnóstico');

      await tx.actionTask.update({ where: { id: task.id }, data: { status: 'cancelled' } });

      if (task.financialFindingId) {
        await tx.financialFinding.update({
          where: { id: task.financialFindingId },
          data: {
            actionPlanStatus: 'not_sent',
            actionTaskId: null,
            actionPlanId: null,
            actionRecommendationId: null,
            convertedToTaskAt: null,
            convertedToTaskBy: null,
          },
        }).catch(() => undefined);
      }

      const proposal = await tx.financialActionProposal.findFirst({ where: { falActionTaskId: task.id } });
      if (proposal) {
        await tx.financialActionProposal.update({
          where: { id: proposal.id },
          data: { status: 'proposed', exportedToFal: false, falActionPlanId: null, falActionTaskId: null, exportedAt: null },
        }).catch(() => undefined);

        if (proposal.financialRecommendationId) {
          await tx.financialRecommendation.update({
            where: { id: proposal.financialRecommendationId },
            data: { isApproved: false, approvedBy: null, approvedAt: null },
          }).catch(() => undefined);
        }
      }

      if (task.planId) await this.actionPlans.recalculate(tx, task.planId);

      await this.audit.log({
        actorId: actor.id,
        tenantId: diagnosis.tenantId,
        action: 'financial_recommendation.unconvert',
        entityType: 'action_task',
        entityId: task.id,
        metadata: { financialDiagnosisId: dto.financialDiagnosisId, financialFindingId: task.financialFindingId ?? null },
      });

      return { success: true };
    });
  }
}
