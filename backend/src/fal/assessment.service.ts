import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { canWrite, isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import {
  CreateAssessmentDto,
  ListAssessmentsQueryDto,
  UpdateAssessmentDto,
} from './dto/fal.dto';

const ALL_DIMENSIONS = [
  'governanca',
  'juridico',
  'controles_internos',
  'financeiro',
  'contabil',
  'tributario',
  'operacional',
  'sistemas',
];

const DEPTH_CORE_PER_SUBDIM: Record<string, number> = {
  rapid: 2,
  standard: 3,
  deep: 5,
};

const GAP_MAX_CLUSTERS_PER_RUN = 3;
const STAGES = [
  'existence',
  'request',
  'analysis',
  'approval',
  'execution',
  'record',
  'control',
  'monitoring',
  'audit',
];
const TEMPLATE_BY_STAGE: Record<string, (label: string) => string> = {
  existence: (l) => `Existe processo formal definido para ${l}?`,
  request: (l) => `As solicitações relacionadas a ${l} seguem fluxo padronizado de abertura?`,
  analysis: (l) => `Existe análise documentada que suporte as decisões sobre ${l}?`,
  approval: (l) => `Existe alçada de aprovação definida para decisões relacionadas a ${l}?`,
  execution: (l) => `A execução das atividades de ${l} segue procedimento documentado?`,
  record: (l) => `Existe registro formal e rastreável das atividades de ${l}?`,
  control: (l) => `Existem controles definidos para mitigar riscos relacionados a ${l}?`,
  monitoring: (l) => `Existe monitoramento periódico dos indicadores relacionados a ${l}?`,
  audit: (l) => `O processo de ${l} é revisado ou auditado periodicamente?`,
};

@Injectable()
export class AssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private resolveTenantId(actor: AuthUser, explicit?: string): string {
    if (isHQ(actor.role)) {
      const id = explicit ?? actor.tenantId;
      if (!id) throw new ForbiddenException('tenantId is required');
      return id;
    }
    if (!actor.tenantId) throw new ForbiddenException('No tenant scope');
    if (explicit && explicit !== actor.tenantId) {
      throw new ForbiddenException('Tenant scope violation');
    }
    return actor.tenantId;
  }

  private rlsOpts(actor: AuthUser, tenantId?: string | null) {
    return { tenantId: tenantId ?? actor.tenantId, isHq: isHQ(actor.role) };
  }

  async list(actor: AuthUser, query: ListAssessmentsQueryDto) {
    const where: Prisma.AssessmentWhereInput = isHQ(actor.role)
      ? {}
      : { tenantId: actor.tenantId! };
    if (query.includeArchived !== 'true' && query.includeArchived !== '1') {
      where.deletedAt = null;
    }
    if (query.targetType) where.targetType = query.targetType;
    if (query.targetId) where.targetId = query.targetId;
    if (query.groupId) where.groupId = query.groupId;
    if (query.companyId) where.companyId = query.companyId;
    if (query.unitId) where.unitId = query.unitId;

    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.assessment.findMany({ where, orderBy: { createdAt: 'desc' } }),
    );
  }

  async get(actor: AuthUser, id: string) {
    const assessment = await this.prisma.withTenantContext(
      this.rlsOpts(actor),
      (tx) => tx.assessment.findFirst({ where: { id, deletedAt: null } }),
    );
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async create(actor: AuthUser, dto: CreateAssessmentDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    const tenantId = this.resolveTenantId(actor, dto.tenantId);
    const assessment = await this.prisma.withTenantContext(
      this.rlsOpts(actor, tenantId),
      (tx) =>
        tx.assessment.create({
          data: {
            tenantId,
            title: dto.title,
            displayName: dto.displayName,
            clientId: dto.clientId,
            methodVersionId: dto.methodVersionId,
            groupId: dto.groupId,
            companyId: dto.companyId,
            unitId: dto.unitId,
            targetType: dto.targetType,
            targetId: dto.targetId,
            assessmentType: dto.assessmentType,
            assessmentMode: dto.assessmentMode ?? 'single_entity',
            competence: dto.competence,
            cycleNumber: dto.cycleNumber,
            cycleId: dto.cycleId,
            contextNote: dto.contextNote,
            penaltyProfileKey: dto.penaltyProfileKey,
            assignedTo: dto.assignedTo,
            scopeMode: dto.scopeMode,
            recipientName: dto.recipientName,
            diagnosticDepth: dto.diagnosticDepth ?? 'rapid',
            activeDimensions: dto.activeDimensions ?? [],
            status: dto.status ?? 'draft',
            startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
            createdById: actor.id,
            metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
          },
        }),
    );
    await this.audit.log({
      actorId: actor.id,
      tenantId,
      action: 'assessment.create',
      entityType: 'assessment',
      entityId: assessment.id,
    });
    return assessment;
  }

  async update(actor: AuthUser, id: string, dto: UpdateAssessmentDto) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.assessment.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('Assessment not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const data: Prisma.AssessmentUncheckedUpdateInput = {};
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.displayName !== undefined) data.displayName = dto.displayName;
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.diagnosticDepth !== undefined) data.diagnosticDepth = dto.diagnosticDepth;
      if (dto.activeDimensions !== undefined) data.activeDimensions = dto.activeDimensions;
      if (dto.questionSet !== undefined) data.questionSet = dto.questionSet;
      if (dto.progressPercentage !== undefined) data.progressPercentage = dto.progressPercentage;
      if (dto.lastSavedAt !== undefined) data.lastSavedAt = new Date(dto.lastSavedAt);
      if (dto.lastSubdimensionKey !== undefined) data.lastSubdimensionKey = dto.lastSubdimensionKey;
      if (dto.contextNote !== undefined) data.contextNote = dto.contextNote;
      if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;
      if (dto.recipientName !== undefined) data.recipientName = dto.recipientName;
      if (dto.completedAt !== undefined) data.completedAt = new Date(dto.completedAt);
      if (dto.startedAt !== undefined) data.startedAt = new Date(dto.startedAt);
      if (dto.status === 'archived') data.deletedAt = null;
      if (dto.groupId !== undefined) data.groupId = dto.groupId;
      if (dto.companyId !== undefined) data.companyId = dto.companyId;
      if (dto.unitId !== undefined) data.unitId = dto.unitId;
      if (dto.clientId !== undefined) data.clientId = dto.clientId;
      if (dto.methodVersionId !== undefined) data.methodVersionId = dto.methodVersionId;
      if (dto.targetType !== undefined) data.targetType = dto.targetType;
      if (dto.targetId !== undefined) data.targetId = dto.targetId;
      if (dto.cycleLabel !== undefined) data.cycleLabel = dto.cycleLabel;
      if (dto.assessmentType !== undefined) data.assessmentType = dto.assessmentType;
      if (dto.assessmentMode !== undefined) data.assessmentMode = dto.assessmentMode;
      if (dto.competence !== undefined) data.competence = dto.competence;
      if (dto.cycleNumber !== undefined) data.cycleNumber = dto.cycleNumber;
      if (dto.cycleId !== undefined) data.cycleId = dto.cycleId;
      if (dto.penaltyProfileKey !== undefined) data.penaltyProfileKey = dto.penaltyProfileKey;
      if (dto.scopeMode !== undefined) data.scopeMode = dto.scopeMode;
      if (dto.metadata !== undefined) {
        const current = (existing.metadata as Record<string, unknown>) ?? {};
        data.metadata = { ...current, ...dto.metadata } as Prisma.InputJsonValue;
      }

      const assessment = await tx.assessment.update({ where: { id }, data });
      await this.audit.log({
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: 'assessment.update',
        entityType: 'assessment',
        entityId: id,
      });
      return assessment;
    });
  }

  async delete(actor: AuthUser, id: string) {
    if (!canWrite(actor.role)) throw new ForbiddenException();
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.assessment.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('Assessment not found');
      this.resolveTenantId(actor, existing.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const assessment = await tx.assessment.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.audit.log({
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: 'assessment.delete',
        entityType: 'assessment',
        entityId: id,
      });
      return assessment;
    });
  }

  /**
   * Porta do base44/functions/buildFalQuestionSet: filtra o banco global de
   * FalQuestion por dimensão ativa/nível/profundidade e monta cobertura
   * balanceada por subdimensão (CORE_PER_SUBDIM). Ao final, dispara detecção
   * de lacunas (clusters rasos) criando FalContentSuggestion pendentes.
   */
  async buildQuestionSet(actor: AuthUser, id: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await tx.assessment.findFirst({ where: { id } });
      if (!assessment) throw new NotFoundException('Assessment not found');
      this.resolveTenantId(actor, assessment.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        assessment.tenantId,
      );

      const activeDimensions =
        assessment.activeDimensions.length > 0 ? assessment.activeDimensions : ALL_DIMENSIONS;
      const depth = assessment.diagnosticDepth || 'rapid';
      const targetType = assessment.targetType || 'company';
      const corePerSubdim = DEPTH_CORE_PER_SUBDIM[depth] ?? DEPTH_CORE_PER_SUBDIM.rapid;

      const depthMatch = (qDepths: string[]) => {
        if (!qDepths || qDepths.length === 0) return true;
        if (depth === 'rapid') return qDepths.includes('rapid');
        if (depth === 'standard') return qDepths.includes('rapid') || qDepths.includes('standard');
        return true;
      };
      const levelMatch = (levels: string[]) => {
        if (!levels || levels.length === 0) return true;
        if (targetType === 'group') return levels.includes('group') || levels.includes('company');
        return levels.includes(targetType);
      };

      const allQuestions = await tx.falQuestion.findMany({
        orderBy: { sequenceOrder: 'asc' },
      });
      // FalQuestion.methodVersionId só é preenchido para métodos com banco de
      // perguntas PRÓPRIO (ex.: Reforma Tributária 8D) — as ~313 perguntas do
      // FAL 8D clássico têm methodVersionId nulo, mesmo que o Assessment em si
      // aponte para o MethodVersion "FAL" real (não nulo — isso já acontecia
      // antes desta migração, via useTenant().methodVersion). Comparação
      // direta null-vs-id quebraria o questionário de qualquer assessment FAL
      // 8D normal. Regra: se o método do assessment tem banco próprio (existe
      // ao menos 1 FalQuestion com esse methodVersionId), filtra estrito por
      // ele; senão, cai no pool legado (methodVersionId nulo) — que é
      // exatamente o comportamento de antes desta migração.
      const assessmentMethodVersionId = assessment.methodVersionId ?? null;
      const hasDedicatedBank =
        !!assessmentMethodVersionId &&
        allQuestions.some((q) => q.methodVersionId === assessmentMethodVersionId);
      const eligible = allQuestions.filter(
        (q) =>
          (hasDedicatedBank ? q.methodVersionId === assessmentMethodVersionId : q.methodVersionId === null) &&
          activeDimensions.includes(q.dimensionKey) &&
          levelMatch(q.levelApplicability) &&
          depthMatch(q.diagnosticDepth),
      );

      const bySubdim = new Map<string, typeof eligible>();
      for (const q of eligible) {
        const key = q.subdimensionKey || q.dimensionKey;
        if (!bySubdim.has(key)) bySubdim.set(key, []);
        bySubdim.get(key)!.push(q);
      }

      const finalSet: string[] = [];
      const summary: Record<string, number> = {};
      for (const [, qs] of bySubdim) {
        qs.sort((a, b) => Number(b.questionWeight) - Number(a.questionWeight));
        for (const q of qs.slice(0, corePerSubdim)) {
          finalSet.push(q.id);
          summary[q.dimensionKey] = (summary[q.dimensionKey] || 0) + 1;
        }
      }

      if (finalSet.length === 0) {
        throw new BadRequestException(
          'Banco de perguntas FAL vazio ou incompatível com o perfil deste assessment.',
        );
      }

      await tx.assessment.update({
        where: { id },
        data: { questionSet: finalSet },
      });

      try {
        await this.triggerGapDetectedSuggestions(tx, {
          eligible,
          activeDimensions,
          corePerSubdim,
          requestedBy: actor.email || actor.id,
        });
      } catch {
        // não bloqueante — mesma postura do mock local
      }

      return {
        success: true,
        total: finalSet.length,
        byDimension: summary,
        activeDimensionsUsed: activeDimensions,
        depth,
      };
    });
  }

  private async triggerGapDetectedSuggestions(
    tx: Prisma.TransactionClient,
    opts: {
      eligible: { id: string; dimensionKey: string; subdimensionKey: string; clusterKey: string }[];
      activeDimensions: string[];
      corePerSubdim: number;
      requestedBy: string;
    },
  ) {
    const byCluster = new Map<string, typeof opts.eligible>();
    for (const q of opts.eligible) {
      if (!opts.activeDimensions.includes(q.dimensionKey) || !q.clusterKey) continue;
      if (!byCluster.has(q.clusterKey)) byCluster.set(q.clusterKey, []);
      byCluster.get(q.clusterKey)!.push(q);
    }
    const gaps = [...byCluster.entries()]
      .filter(([, qs]) => qs.length < opts.corePerSubdim)
      .sort((a, b) => a[1].length - b[1].length)
      .slice(0, GAP_MAX_CLUSTERS_PER_RUN);

    for (const [clusterKey, qs] of gaps) {
      const alreadyPending = await tx.falContentSuggestion.findFirst({
        where: { clusterKey, contentType: 'question', trigger: 'gap_detected', status: 'pending' },
      });
      if (alreadyPending) continue;

      const { dimensionKey, subdimensionKey } = qs[0];
      const needed = Math.min(Math.max(opts.corePerSubdim - qs.length, 1), 5);
      await this.generateQuestionSuggestions(tx, {
        clusterKey,
        dimensionKey,
        subdimensionKey,
        existingCount: qs.length,
        count: needed,
        requestedBy: opts.requestedBy,
        trigger: 'gap_detected',
      });
    }
  }

  async generateQuestionSuggestions(
    tx: Prisma.TransactionClient,
    opts: {
      clusterKey: string;
      dimensionKey: string;
      subdimensionKey: string;
      existingCount: number;
      count: number;
      requestedBy: string;
      trigger: string;
    },
  ) {
    const existingMaxSeq = await tx.falQuestion.aggregate({
      where: { clusterKey: opts.clusterKey },
      _max: { sequenceOrder: true },
    });
    const existingQuestions = await tx.falQuestion.findMany({
      where: { clusterKey: opts.clusterKey },
      select: { processStage: true },
    });
    const coveredStages = new Set(existingQuestions.map((q) => q.processStage));
    const uncoveredStages = STAGES.filter((s) => !coveredStages.has(s));
    const clusterLabel = opts.clusterKey.replace(/_cluster$/, '').replace(/_/g, ' ');
    const maxSeq = existingMaxSeq._max.sequenceOrder || 0;

    const created = [];
    for (let i = 0; i < opts.count; i++) {
      const stage = uncoveredStages[i] || STAGES[(opts.existingCount + i) % STAGES.length];
      const draftPayload = {
        question_id: `${opts.clusterKey.replace(/_cluster$/, '')}_ia_${Date.now()}_${i}`,
        dimension_key: opts.dimensionKey,
        subdimension_key: opts.subdimensionKey,
        cluster_key: opts.clusterKey,
        process_stage: stage,
        sequence_order: maxSeq + i + 1,
        diagnostic_depth: ['standard', 'deep'],
        level_applicability: ['group', 'company', 'unit'],
        question_weight: 1,
        question_text: TEMPLATE_BY_STAGE[stage](clusterLabel),
        guidance: '',
        evidence_hint: '',
      };
      const suggestion = await tx.falContentSuggestion.create({
        data: {
          tenantId: null,
          contentType: 'question',
          dimensionKey: opts.dimensionKey,
          subdimensionKey: opts.subdimensionKey,
          clusterKey: opts.clusterKey,
          trigger: opts.trigger,
          requestedBy: opts.requestedBy,
          modelUsed: 'local-fallback-template',
          promptContextSummary: `${opts.existingCount} pergunta(s) existente(s) consideradas (fallback local, sem LLM real).`,
          draftPayload,
          status: 'pending',
        },
      });
      created.push({
        ...suggestion,
        rationale: `Estágio "${stage}" ainda não coberto pelas perguntas existentes do cluster (rascunho local, revisar com atenção).`,
      });
    }
    return created;
  }
}
