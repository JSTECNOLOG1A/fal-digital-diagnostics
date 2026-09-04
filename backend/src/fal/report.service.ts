import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import {
  ArchiveReportVersionDto,
  BeginPdfArtifactDto,
  CommitPdfArtifactDto,
  GenerateReportVersionDto,
} from './dto/report.dto';

const REPORT_RENDERER_VERSION = 'FAL-RPT-2.46-nest';
const PDF_GENERATOR_VERSION = 'FAL-PDF-2.46-nest';
const COMPLETED_STATUSES = ['done', 'completed'];
const isTaskCompleted = (t: { status: string }) => COMPLETED_STATUSES.includes(t.status);
const isTaskActive = (t: { status: string }) => t.status !== 'cancelled';

const DIM_LABELS: Record<string, string> = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal/Tributário',
  operacional: 'Operacional', sistemas: 'Tecnologia',
};

const REPORT_TYPE_CODE: Record<string, string> = {
  initial_diagnostic: 'DIA', approved_action_plan: 'PAP', review_cycle: 'REV',
  consolidated_evolution: 'EVO', executive_summary: 'EXE', action_scope: 'ESC',
  financial_diagnostic: 'FIN', synthetic_integrated: 'SIN', custom: 'CUS',
};

const UNSUPPORTED_REPORT_TYPES = new Set(['financial_diagnostic', 'synthetic_integrated']);

function generateReportCode(reportType: string, versionNumber: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const typeCode = REPORT_TYPE_CODE[reportType] || 'RPT';
  return `${typeCode}-${y}${m}-v${versionNumber}`;
}

function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}
function sha256(value: any): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  async list(actor: AuthUser, query: { assessmentId?: string; reportType?: string }) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) => {
      const where: Prisma.AssessmentReportVersionWhereInput = isHQ(actor.role) ? {} : { tenantId: actor.tenantId! };
      if (query.assessmentId) where.assessmentId = query.assessmentId;
      if (query.reportType) where.reportType = query.reportType;
      return tx.assessmentReportVersion.findMany({ where, orderBy: { reportVersionNumber: 'desc' } });
    });
  }

  async get(actor: AuthUser, id: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const version = await tx.assessmentReportVersion.findFirst({ where: { id } });
      if (!version) throw new NotFoundException('Report version not found');
      return version;
    });
  }

  private async buildPayloadSnapshot(tx: Prisma.TransactionClient, assessment: any, params: { actionPlanReviewId?: string }) {
    const snapshot: Record<string, any> = {
      assessment: {
        id: assessment.id, title: assessment.title, tenant_id: assessment.tenantId, status: assessment.status,
        target_type: assessment.targetType, target_id: assessment.targetId, group_id: assessment.groupId,
        company_id: assessment.companyId, unit_id: assessment.unitId, active_dimensions: assessment.activeDimensions,
        competence: assessment.competence,
      },
    };

    const diagSnap = await tx.falDiagnosticSnapshot.findFirst({
      where: { assessmentId: assessment.id }, orderBy: { computedAt: 'desc' },
    });
    if (diagSnap) {
      snapshot.diagnostic_snapshot = {
        id: diagSnap.id, overall_score: Number(diagSnap.overallScore), overall_level: diagSnap.overallLevel,
        dimension_scores: diagSnap.dimensionScores, computed_at: diagSnap.computedAt, radar_points: diagSnap.radarPoints,
        maturity_index: diagSnap.maturityIndex, gaps_top: diagSnap.gapsTop,
      };
    }

    const plan = await tx.actionPlan.findFirst({ where: { assessmentId: assessment.id }, orderBy: { createdAt: 'desc' } });
    if (plan) {
      snapshot.action_plan = {
        id: plan.id, status: plan.status, overall_progress_percentage: Number(plan.overallProgressPercentage),
        generated_at: plan.generatedAt, generation_fingerprint: plan.generationFingerprint, updated_at: plan.updatedAt,
      };
      const tasks = await tx.actionTask.findMany({ where: { planId: plan.id }, orderBy: { priorityScore: 'desc' }, take: 300 });
      snapshot.tasks = tasks.map((t) => ({
        id: t.id, title: t.title, status: t.status, status_normalized: isTaskCompleted(t) ? 'completed' : t.status,
        priority: t.priority, dimension_key: t.dimensionKey, due_date: t.dueDate, owner_name: t.ownerName,
        progress_percentage: t.progressPercentage, horizon: t.horizon, action_type: t.actionType,
        task_layer: t.taskLayer, is_completed: isTaskCompleted(t), is_active: isTaskActive(t), plan_id: t.planId,
      }));
      const activeTasks = tasks.filter(isTaskActive);
      const doneTasks = tasks.filter(isTaskCompleted);
      snapshot.plan_kpis = {
        total: tasks.length, active: activeTasks.length, completed: doneTasks.length,
        todo: activeTasks.filter((t) => t.status === 'todo').length,
        in_progress: activeTasks.filter((t) => t.status === 'in_progress').length,
        blocked: activeTasks.filter((t) => t.status === 'blocked').length,
        cancelled: tasks.filter((t) => t.status === 'cancelled').length,
        progress_pct: activeTasks.length > 0 ? Math.round((doneTasks.length / activeTasks.length) * 100) : 0,
        critical_open: activeTasks.filter((t) => t.priority === 'critical' && !isTaskCompleted(t)).length,
      };

      const reviews = await tx.actionPlanReview.findMany({ where: { actionPlanId: plan.id }, orderBy: { reviewNumber: 'asc' }, take: 50 });
      snapshot.reviews = reviews.map((r) => ({
        id: r.id, review_number: r.reviewNumber, review_date: r.reviewDate, visit_type: r.visitType, status: r.status,
        consultant_name: r.consultantName, overall_progress_before: r.overallProgressBefore ? Number(r.overallProgressBefore) : null,
        overall_progress_after: r.overallProgressAfter ? Number(r.overallProgressAfter) : null,
        executive_summary: r.executiveSummary, completed_at: r.completedAt,
      }));
      if (params.actionPlanReviewId) {
        snapshot.task_reviews = await tx.actionTaskReview.findMany({
          where: { actionPlanReviewId: params.actionPlanReviewId }, orderBy: { createdAt: 'asc' }, take: 200,
        });
      }
    }

    return snapshot;
  }

  /** Porta de base44/functions/generateAssessmentReportVersion. */
  async generate(actor: AuthUser, dto: GenerateReportVersionDto) {
    if (UNSUPPORTED_REPORT_TYPES.has(dto.reportType)) {
      throw new BadRequestException(
        `Tipo de relatório "${dto.reportType}" ainda não suportado neste ambiente — depende de dados financeiros/síntese integrada que não foram migrados.`,
      );
    }
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await tx.assessment.findFirst({ where: { id: dto.assessmentId } });
      if (!assessment) throw new NotFoundException('Assessment not found');
      if (!isHQ(actor.role) && assessment.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden');
      const tenantId = assessment.tenantId;

      // ── Guards metodológicos ──
      if (['initial_diagnostic', 'executive_summary', 'consolidated_evolution'].includes(dto.reportType)) {
        const snap = await tx.falDiagnosticSnapshot.findFirst({ where: { assessmentId: assessment.id } });
        if (!snap) throw new BadRequestException('Nenhum snapshot de diagnóstico encontrado. Execute o diagnóstico antes de gerar o relatório.');
      }
      if (['approved_action_plan', 'review_cycle', 'consolidated_evolution'].includes(dto.reportType)) {
        const plan = await tx.actionPlan.findFirst({ where: { assessmentId: assessment.id } });
        if (!plan) throw new BadRequestException('Nenhum plano de ação encontrado. Gere o plano de ação antes de emitir este relatório.');
        const task = await tx.actionTask.findFirst({ where: { planId: plan.id } });
        if (!task) throw new BadRequestException('Plano de ação sem tarefas. Gere as tarefas antes de emitir o relatório.');
      }
      if (dto.reportType === 'review_cycle' && dto.actionPlanReviewId) {
        const review = await tx.actionPlanReview.findFirst({ where: { id: dto.actionPlanReviewId } });
        if (!review) throw new BadRequestException('Revisão não encontrada.');
        if (review.status !== 'completed') throw new BadRequestException('Apenas revisões concluídas podem gerar relatório. Conclua a revisão antes.');
      }

      const existingVersions = await tx.assessmentReportVersion.findMany({
        where: { assessmentId: dto.assessmentId, reportType: dto.reportType, tenantId },
        orderBy: { reportVersionNumber: 'desc' },
      });

      const payloadSnapshot = await this.buildPayloadSnapshot(tx, assessment, { actionPlanReviewId: dto.actionPlanReviewId });
      const contentParameters = {
        report_title: dto.reportTitle, preset_id: dto.presetId || null,
        audience: (dto.reportParameters as any)?.audience || null, notes: (dto.reportParameters as any)?.notes || null,
        action_plan_review_id: dto.actionPlanReviewId || null,
      };
      const payloadChecksum = sha256({
        payload_content_snapshot: payloadSnapshot, contentParameters, report_type: dto.reportType,
        renderer_version: REPORT_RENDERER_VERSION, method_version: assessment.methodVersionId || null,
      });

      const reused = existingVersions.find((v) => v.payloadChecksum === payloadChecksum && v.status !== 'failed');
      if (reused) {
        return { reportVersionId: reused.id, reportCode: reused.reportCode, reportVersionNumber: reused.reportVersionNumber, status: reused.status, reused: true };
      }

      const nextVersion = (existingVersions[0]?.reportVersionNumber || 0) + 1;
      const reportCode = generateReportCode(dto.reportType, nextVersion);
      const sourceManifest = {
        diagnostic_snapshot: { id: payloadSnapshot.diagnostic_snapshot?.id || null },
        action_plan: { id: payloadSnapshot.action_plan?.id || null, fingerprint: payloadSnapshot.action_plan?.generation_fingerprint || null },
        review: { id: dto.actionPlanReviewId || null },
        renderer_version: REPORT_RENDERER_VERSION, cutoff_at: new Date().toISOString(),
      };

      const reportVersion = await tx.assessmentReportVersion.create({
        data: {
          assessmentId: dto.assessmentId, tenantId, reportType: dto.reportType, reportTitle: dto.reportTitle,
          reportVersionNumber: nextVersion, reportCode, status: 'generated', markAsOfficial: false,
          presetId: dto.presetId || null, actionPlanReviewId: dto.actionPlanReviewId || null,
          assessmentRevisionNumber: payloadSnapshot.reviews?.length || null,
          reportParameters: { ...contentParameters, _generated_by: actor.email, _generated_at: new Date().toISOString() },
          payloadSnapshot, payloadChecksum, sourceManifest,
          previousReportVersionId: existingVersions[0]?.id || null,
          actionPlanId: payloadSnapshot.action_plan?.id || null, reviewId: dto.actionPlanReviewId || null,
          diagnosticSnapshotId: payloadSnapshot.diagnostic_snapshot?.id || null,
          generatedAt: new Date(), generatedBy: actor.email,
        },
      });

      return {
        reportVersionId: reportVersion.id, reportCode, reportVersionNumber: nextVersion, status: 'generated',
        payloadSummary: {
          hasDiagnostic: !!payloadSnapshot.diagnostic_snapshot, hasActionPlan: !!payloadSnapshot.action_plan,
          taskCount: payloadSnapshot.tasks?.length || 0, reviewCount: payloadSnapshot.reviews?.length || 0,
          planKpis: payloadSnapshot.plan_kpis,
        },
      };
    });
  }

  /** Porta de base44/functions/getReportVersionSnapshot. */
  async getSnapshot(actor: AuthUser, reportVersionId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const version = await tx.assessmentReportVersion.findFirst({ where: { id: reportVersionId } });
      if (!version) throw new NotFoundException('Versão de relatório não encontrada');
      if (!version.payloadSnapshot) {
        throw new BadRequestException('Este relatório não possui payload_snapshot. Gere uma nova versão.');
      }
      return {
        payloadSnapshot: version.payloadSnapshot,
        reportMetadata: {
          id: version.id, reportCode: version.reportCode, reportTitle: version.reportTitle,
          reportType: version.reportType, reportVersionNumber: version.reportVersionNumber,
          generatedAt: version.generatedAt, generatedBy: version.generatedBy, markAsOfficial: version.markAsOfficial,
          status: version.status, payloadChecksum: version.payloadChecksum, pdfStatus: version.pdfStatus,
          pdfFileUrl: version.pdfFileUrl,
        },
      };
    });
  }

  /**
   * Porta de base44/functions/generatePdfFromReportVersion — reconstrói o
   * payload de exibição a partir do snapshot imutável. Não gera PDF binário
   * (isso acontece no navegador); ver nota de escopo no schema.prisma.
   */
  async getRenderPayload(actor: AuthUser, reportVersionId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const version = await tx.assessmentReportVersion.findFirst({ where: { id: reportVersionId } });
      if (!version) throw new NotFoundException('Versão de relatório não encontrada');
      if (!version.payloadSnapshot) {
        throw new BadRequestException('payload_snapshot ausente. Este relatório não pode ser reproduzido — regenere-o pela Central de Relatórios.');
      }
      const snap = version.payloadSnapshot as any;
      const assessmentSnap = snap.assessment || {};
      let tenantData: any = null;
      let methodVersion: any = null;
      try {
        if (assessmentSnap.tenant_id) tenantData = await tx.tenant.findUnique({ where: { id: assessmentSnap.tenant_id } });
        const full = await tx.assessment.findUnique({ where: { id: version.assessmentId } });
        if (full?.methodVersionId) methodVersion = await tx.methodVersion.findUnique({ where: { id: full.methodVersionId } });
      } catch {
        /* best-effort */
      }

      const diagSnap = snap.diagnostic_snapshot || {};
      const tasks = snap.tasks || [];
      const dimensionScores = diagSnap.dimension_scores || {};
      const dimensionsList = Object.entries<any>(dimensionScores).map(([key, data]) => ({
        key, name: DIM_LABELS[key] || key, score: data.score || 0, level: data.level || 'Crítico', active: data.active !== false,
      }));

      const payload = {
        assessment_id: version.assessmentId, report_code: version.reportCode, report_type: version.reportType,
        report_title: version.reportTitle, report_version_number: version.reportVersionNumber,
        generated_at: version.generatedAt, generated_by: version.generatedBy, mark_as_official: version.markAsOfficial,
        is_from_snapshot: true,
        tenant_name: tenantData?.name || '', tenant_logo_url: tenantData?.logoUrl || null,
        method_version: methodVersion?.version || 'FAL v1.0', competence: assessmentSnap.competence || '',
        cover: {
          assessment_date: assessmentSnap.competence || version.generatedAt, completion_date: version.generatedAt,
          method_version: methodVersion?.version || 'FAL v1.0', tenant_name: tenantData?.name || '',
          tenant_logo_url: tenantData?.logoUrl || null,
        },
        executive_summary: {
          overall_maturity_level: diagSnap.overall_level || 'N/A', overall_maturity_score: diagSnap.overall_score || 0,
          overall_maturity_index: diagSnap.maturity_index || diagSnap.overall_score || 0,
        },
        maturity_profile: {
          dimensions: dimensionsList, radar_data: diagSnap.radar_points || [],
          level_distribution: {
            critical: dimensionsList.filter((d) => d.level === 'Crítico').length,
            basic: dimensionsList.filter((d) => d.level === 'Básico').length,
            structured: dimensionsList.filter((d) => d.level === 'Estruturado').length,
            advanced: dimensionsList.filter((d) => d.level === 'Avançado').length,
          },
        },
        action_plan: {
          total_tasks: tasks.length,
          tasks_by_priority: {
            critical: tasks.filter((t: any) => t.priority === 'critical').length,
            high: tasks.filter((t: any) => t.priority === 'high').length,
            medium: tasks.filter((t: any) => t.priority === 'medium').length,
            low: tasks.filter((t: any) => t.priority === 'low').length,
          },
          tasks_by_horizon: {
            '30d': tasks.filter((t: any) => t.horizon === '30d'), '60d': tasks.filter((t: any) => t.horizon === '60d'),
            '90d': tasks.filter((t: any) => t.horizon === '90d'), '180d': tasks.filter((t: any) => t.horizon === '180d'),
          },
          all_tasks: tasks, kpis: snap.plan_kpis || {},
        },
        reviews: snap.reviews || [],
        methodology: {
          method_version_code: methodVersion?.version || 'FAL v1.0',
          ifme_explanation: 'IFME™ (Índice FAL de Maturidade Empresarial) avalia 8 dimensões organizacionais em escala 0–3.',
          scale_explanation: 'Escala: 0=Crítico, 1=Básico, 2=Estruturado, 3=Avançado.',
        },
      };

      return {
        reportVersionId, reportCode: version.reportCode, payload,
        previewUrl: `/ReportPreview?report_version_id=${reportVersionId}&from_snapshot=true`,
        assessmentId: version.assessmentId,
      };
    });
  }

  /** Porta de base44/functions/setOfficialAssessmentReportVersion. */
  async setOfficial(actor: AuthUser, reportVersionId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const version = await tx.assessmentReportVersion.findFirst({ where: { id: reportVersionId } });
      if (!version) throw new NotFoundException('Report version not found');
      if (!isHQ(actor.role) && version.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden: tenant mismatch');
      if (!['generated', 'active'].includes(version.status)) {
        throw new ConflictException('Only generated or active reports can be official');
      }
      const siblings = await tx.assessmentReportVersion.findMany({
        where: { tenantId: version.tenantId, assessmentId: version.assessmentId, reportType: version.reportType, markAsOfficial: true },
      });
      await tx.assessmentReportVersion.update({ where: { id: version.id }, data: { markAsOfficial: true, status: 'active' } });
      for (const item of siblings.filter((i) => i.id !== version.id)) {
        await tx.assessmentReportVersion.update({ where: { id: item.id }, data: { markAsOfficial: false } });
      }
      return tx.assessmentReportVersion.findFirst({ where: { id: version.id } });
    });
  }

  /** Porta de base44/functions/archiveReportVersion. */
  async archive(actor: AuthUser, dto: ArchiveReportVersionDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const version = await tx.assessmentReportVersion.findFirst({ where: { id: dto.reportVersionId } });
      if (!version) throw new NotFoundException('Versão não encontrada');
      if (!isHQ(actor.role) && version.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden: relatório pertence a outro tenant');
      if (version.status === 'archived') throw new BadRequestException('Relatório já está arquivado');
      if (version.pdfStatus === 'pending') throw new ConflictException('REPORT_PDF_OPERATION_IN_PROGRESS');

      const siblings = await tx.assessmentReportVersion.findMany({
        where: { tenantId: version.tenantId, assessmentId: version.assessmentId, reportType: version.reportType },
      });
      const activeOfficials = siblings.filter((s) => s.markAsOfficial && ['generated', 'active'].includes(s.status));
      if (version.markAsOfficial && activeOfficials.length === 1 && !dto.replacementReportVersionId) {
        throw new ConflictException('OFFICIAL_REPORT_REPLACEMENT_REQUIRED');
      }
      const replacement = dto.replacementReportVersionId
        ? siblings.find((s) => s.id === dto.replacementReportVersionId && ['generated', 'active'].includes(s.status))
        : null;
      if (dto.replacementReportVersionId && (!replacement || replacement.pdfStatus === 'pending')) {
        throw new ConflictException('OFFICIAL_REPORT_REPLACEMENT_INVALID');
      }

      if (replacement) {
        await tx.assessmentReportVersion.update({ where: { id: replacement.id }, data: { markAsOfficial: true, status: 'active' } });
      }
      await tx.assessmentReportVersion.update({
        where: { id: version.id },
        data: { markAsOfficial: false, status: 'archived', archivedAt: new Date(), archivedBy: actor.email, archiveReason: dto.reason || null },
      });
      return tx.assessmentReportVersion.findFirst({ where: { id: version.id } });
    });
  }

  /** Porta de base44/functions/beginReportPdfArtifact. */
  async beginPdf(actor: AuthUser, dto: BeginPdfArtifactDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const version = await tx.assessmentReportVersion.findFirst({ where: { id: dto.reportVersionId } });
      if (!version) throw new NotFoundException('Report version not found');
      if (!isHQ(actor.role) && version.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden: tenant mismatch');
      if (!['generated', 'active'].includes(version.status)) throw new ConflictException('REPORT_VERSION_NOT_GENERATABLE');
      if (version.pdfStatus === 'generated' && version.pdfFileUrl && version.pdfChecksum && version.pdfGeneratorVersion === PDF_GENERATOR_VERSION) {
        return { reused: true, reportVersion: version };
      }
      if (version.pdfStatus === 'pending') throw new ConflictException('PDF_OPERATION_IN_PROGRESS');
      const operationId = crypto.randomUUID();
      const pending = await tx.assessmentReportVersion.update({
        where: { id: version.id },
        data: { pdfStatus: 'pending', pdfOperationId: operationId, pdfStartedAt: new Date(), pdfStartedBy: actor.email, pdfError: null },
      });
      return { reused: false, operationId, reportVersion: pending };
    });
  }

  /**
   * Porta de base44/functions/commitReportPdfArtifact — adaptada pro storage
   * real (MinIO, via /fal/reports/pdf-storage) em vez de exigir URL do
   * domínio base44; a validação de integridade (checksum, tamanho, página)
   * é a mesma.
   */
  async commitPdf(actor: AuthUser, dto: CommitPdfArtifactDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const version = await tx.assessmentReportVersion.findFirst({ where: { id: dto.reportVersionId } });
      if (!version) throw new NotFoundException('Report version not found');
      if (!isHQ(actor.role) && version.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden: tenant mismatch');

      if (dto.pdfStatus === 'failed') {
        if (version.pdfStatus !== 'pending' || dto.pdfOperationId !== version.pdfOperationId) throw new ConflictException('PDF_OPERATION_MISMATCH');
        return tx.assessmentReportVersion.update({
          where: { id: version.id }, data: { pdfStatus: 'failed', pdfError: dto.pdfError || 'PDF generation failed' },
        });
      }

      if (version.pdfStatus !== 'pending' || dto.pdfOperationId !== version.pdfOperationId) throw new ConflictException('PDF_OPERATION_MISMATCH');
      if (!['generated', 'active'].includes(version.status)) throw new ConflictException('REPORT_VERSION_NOT_GENERATABLE');
      if (!dto.pdfFileUrl || !dto.pdfUploadIdentifier) throw new BadRequestException('PDF_STORAGE_REFERENCE_INVALID');
      if (!Number.isInteger(Number(dto.pdfFileSize)) || Number(dto.pdfFileSize) < 1) throw new BadRequestException('PDF_ARTIFACT_METADATA_INVALID');
      if (!Number.isInteger(Number(dto.pdfPageCount)) || Number(dto.pdfPageCount) < 1) throw new BadRequestException('PDF_ARTIFACT_METADATA_INVALID');
      if (!dto.pdfChecksum || !/^[a-f0-9]{64}$/i.test(dto.pdfChecksum)) throw new BadRequestException('PDF_ARTIFACT_METADATA_INVALID');
      if (!dto.payloadChecksum || dto.payloadChecksum !== version.payloadChecksum) throw new ConflictException('PAYLOAD_CHECKSUM_MISMATCH');

      const updated = await tx.assessmentReportVersion.update({
        where: { id: version.id },
        data: {
          pdfStatus: 'generated', pdfFileUrl: dto.pdfFileUrl, pdfUploadIdentifier: dto.pdfUploadIdentifier,
          pdfChecksum: dto.pdfChecksum.toLowerCase(), pdfPageCount: Number(dto.pdfPageCount), pdfFileSize: Number(dto.pdfFileSize),
          pdfStorageProvider: 'minio', pdfGeneratorVersion: PDF_GENERATOR_VERSION, pdfGeneratedAt: new Date(), pdfError: null,
        },
      });
      return updated;
    });
  }
}
