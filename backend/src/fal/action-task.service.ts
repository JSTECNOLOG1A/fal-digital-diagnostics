import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { ActionPlanService } from './action-plan.service';
import { CreateManualActionTaskDto, UpdateActionTaskWithHistoryDto } from './dto/action-plan.dto';

const MUTABLE_FIELDS = new Set([
  'title', 'description', 'status', 'progress_percentage', 'assigned_to', 'owner_name',
  'start_date', 'due_date', 'priority', 'horizon', 'expected_evidence', 'completion_evidence',
  'blocked_reason', 'dependency_task_keys', 'execution_guidance', 'consultant_notes',
  'last_checkin_at', 'last_checkin_comment',
]);

const FIELD_MAP: Record<string, string> = {
  title: 'title', description: 'description', status: 'status', progress_percentage: 'progressPercentage',
  assigned_to: 'assignedTo', owner_name: 'ownerName', start_date: 'startDate', due_date: 'dueDate',
  priority: 'priority', horizon: 'horizon', expected_evidence: 'expectedEvidence',
  completion_evidence: 'completionEvidence', blocked_reason: 'blockedReason',
  dependency_task_keys: 'dependencyTaskKeys', execution_guidance: 'executionGuidance',
  consultant_notes: 'consultantNotes', last_checkin_at: 'lastCheckinAt', last_checkin_comment: 'lastCheckinComment',
};

@Injectable()
export class ActionTaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: ActionPlanService,
  ) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  async list(actor: AuthUser, planId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.actionTask.findMany({ where: { planId }, orderBy: { createdAt: 'asc' } }),
    );
  }

  /** Porta de base44/functions/createManualActionTask. */
  async createManual(actor: AuthUser, dto: CreateManualActionTaskDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const plan = await tx.actionPlan.findFirst({ where: { id: dto.planId } });
      if (!plan) throw new NotFoundException('Action plan not found');
      if (!isHQ(actor.role) && plan.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden: tenant mismatch');

      const t = dto.task as Record<string, any>;
      if (!t?.title || !t?.dimension_key || !t?.cluster_key) {
        throw new BadRequestException('title, dimension_key and cluster_key are required');
      }
      const operationId = crypto.randomUUID();
      const created = await tx.actionTask.create({
        data: {
          tenantId: plan.tenantId, planId: plan.id, assessmentId: plan.assessmentId,
          title: t.title, description: t.description, dimensionKey: t.dimension_key, clusterKey: t.cluster_key,
          subdimensionKey: t.subdimension_key, priority: t.priority, horizon: t.horizon,
          typicalOwner: t.typical_owner, ownerName: t.owner_name, dueDate: t.due_date ? new Date(t.due_date) : null,
          originType: 'manual', originDetail: 'Tarefa criada manualmente pelo consultor',
          isManual: true, isSystemGenerated: false, status: 'todo', progressPercentage: 0,
          operationId, operationStatus: 'active', taskKey: `manual::${plan.id}::${operationId}`,
        } as Prisma.ActionTaskUncheckedCreateInput,
      });
      await tx.actionTaskActivity.create({
        data: {
          actionTaskId: created.id, actionPlanId: plan.id, tenantId: plan.tenantId, operationId,
          commitStatus: 'active', type: 'note', before: {}, after: { title: created.title, status: created.status },
          changedFields: ['created'], note: 'Manual task created', actor: actor.email, createdBy: actor.email,
        },
      });
      const recalculated = await this.plans.recalculate(tx, plan.id);
      return { task: created, plan: recalculated, operationId };
    });
  }

  /** Porta de base44/functions/updateActionTaskWithHistory. */
  async updateWithHistory(actor: AuthUser, dto: UpdateActionTaskWithHistoryDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const updates = dto.updates || {};
      if (!Object.keys(updates).length) throw new BadRequestException('updates is required');
      if (Object.keys(updates).some((k) => !MUTABLE_FIELDS.has(k))) {
        throw new BadRequestException('Unsupported task update field');
      }

      const task = await tx.actionTask.findFirst({ where: { id: dto.taskId } });
      if (!task) throw new NotFoundException('Task not found');
      if (!isHQ(actor.role) && task.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden: tenant mismatch');
      const plan = await tx.actionPlan.findFirst({ where: { id: task.planId } });
      if (!plan) throw new NotFoundException('Action plan not found');

      const status = (updates.status as string) ?? task.status;
      const progress = Number(updates.progress_percentage ?? task.progressPercentage ?? 0);
      if (progress < 0 || progress > 100) throw new BadRequestException('progress_percentage must be between 0 and 100');
      if (status === 'done' && (progress !== 100 || !(updates.completion_evidence ?? task.completionEvidence))) {
        throw new BadRequestException('done requires progress=100 and completion_evidence');
      }
      if (status === 'blocked' && !(updates.blocked_reason ?? task.blockedReason)) {
        throw new BadRequestException('blocked requires blocked_reason');
      }

      const dependencyKeys = (updates.dependency_task_keys as string[]) ?? task.dependencyTaskKeys ?? [];
      if (dependencyKeys.length && (status === 'in_progress' || status === 'done')) {
        const tasks = await tx.actionTask.findMany({ where: { planId: plan.id } });
        const deps = dependencyKeys.map((key) => tasks.find((t) => t.taskKey === key)).filter(Boolean) as typeof tasks;
        const canOverride = status === 'done' && ['hq_admin', 'tenant_admin'].includes(actor.role) && dto.overrideJustification;
        if (deps.some((t) => t.status !== 'done') && !canOverride) {
          throw new BadRequestException('TASK_DEPENDENCY_OPEN');
        }
      }

      const mapped: Record<string, any> = {};
      for (const [k, v] of Object.entries(updates)) mapped[FIELD_MAP[k]] = v;
      if (mapped.startDate) mapped.startDate = new Date(mapped.startDate);
      if (mapped.dueDate) mapped.dueDate = new Date(mapped.dueDate);
      if (mapped.lastCheckinAt) mapped.lastCheckinAt = new Date(mapped.lastCheckinAt);
      mapped.isBlocked = status === 'blocked';
      mapped.lastUpdatedBy = actor.email;
      if (status === 'done') mapped.completedAt = new Date();
      if (status !== 'done' && task.status === 'done') mapped.completedAt = null;

      const before = task;
      const changed = Object.keys(mapped).filter((k) => JSON.stringify((task as any)[k] ?? null) !== JSON.stringify(mapped[k] ?? null));
      if (!changed.length && !dto.comment) return { task, reused: true };

      const operationId = crypto.randomUUID();
      await tx.actionTaskActivity.create({
        data: {
          actionTaskId: task.id, actionPlanId: plan.id, tenantId: task.tenantId, operationId, commitStatus: 'active',
          type: status !== task.status ? 'status_change' : 'progress_update', before: before as any,
          after: { ...before, ...mapped } as any, changedFields: changed, reviewId: dto.reviewId || null,
          comment: dto.comment || null, actor: actor.email, createdBy: actor.email,
        },
      });
      const updated = await tx.actionTask.update({ where: { id: task.id }, data: mapped });
      let taskReview = null;
      if (dto.reviewId) {
        taskReview = await tx.actionTaskReview.create({
          data: {
            actionPlanReviewId: dto.reviewId, actionPlanId: plan.id, actionTaskId: task.id, tenantId: task.tenantId,
            operationId, commitStatus: 'active', previousStatus: task.status, newStatus: updated.status,
            previousProgressPercentage: task.progressPercentage, newProgressPercentage: updated.progressPercentage,
            changeType: status !== task.status ? 'status_change' : 'progress_update',
            changes: changed.map((field) => ({ field, old_value: (before as any)[field] ?? null, new_value: mapped[field] ?? null })),
            consultantComment: dto.comment || null, createdBy: actor.email,
          },
        });
      }
      const recalculated = await this.plans.recalculate(tx, plan.id);
      return { task: updated, plan: recalculated, changedFields: changed, operationId, taskReview };
    });
  }
}
