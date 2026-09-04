import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { ActionPlanService } from './action-plan.service';
import {
  CancelActionPlanReviewDto,
  CompleteActionPlanReviewDto,
  OpenActionPlanReviewDto,
} from './dto/action-plan.dto';

@Injectable()
export class ActionPlanReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: ActionPlanService,
  ) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  async list(actor: AuthUser, actionPlanId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.actionPlanReview.findMany({ where: { actionPlanId }, orderBy: { reviewNumber: 'desc' } }),
    );
  }

  /** Porta de base44/functions/createActionPlanReviewWithSnapshot. */
  async open(actor: AuthUser, dto: OpenActionPlanReviewDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const plan = await tx.actionPlan.findFirst({ where: { id: dto.actionPlanId } });
      if (!plan) throw new NotFoundException('Action plan not found');
      if (!isHQ(actor.role) && plan.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden: tenant mismatch');

      if (plan.currentRevisionId) {
        const pointed = await tx.actionPlanReview.findFirst({ where: { id: plan.currentRevisionId } });
        if (pointed?.status === 'draft') return { review: pointed, reused: true };
      }
      const reviews = await tx.actionPlanReview.findMany({ where: { actionPlanId: plan.id } });
      const reviewKey = `${plan.tenantId}|${plan.id}|open`;
      const existing = reviews.find((r) => r.reviewKey === reviewKey && r.status === 'draft');
      if (existing) return { review: existing, reused: true };

      const tasks = await tx.actionTask.findMany({ where: { planId: plan.id } });
      const candidate = await tx.actionPlanReview.create({
        data: {
          actionPlanId: plan.id, assessmentId: plan.assessmentId, tenantId: plan.tenantId,
          reviewKey, reviewNumber: Math.max(0, ...reviews.map((r) => r.reviewNumber || 0)) + 1,
          reviewDate: new Date(dto.reviewDate), visitType: dto.visitType || 'intermediate',
          consultantId: actor.id, consultantName: actor.name || actor.email, status: 'draft',
          openingSnapshot: {
            opened_at: new Date().toISOString(), opened_by: actor.email,
            task_state_before: tasks.map((t) => ({ task_id: t.id, task_key: t.taskKey, status: t.status, progress_percentage: t.progressPercentage, due_date: t.dueDate })),
          },
          openedAt: new Date(), openedBy: actor.email,
        },
      });
      await tx.actionPlan.update({ where: { id: plan.id }, data: { currentRevisionId: candidate.id, updatedBy: actor.email } });

      // Cancela outros rascunhos concorrentes (equivalente ao antigo lock de "candidate/active").
      const rivals = await tx.actionPlanReview.findMany({
        where: { actionPlanId: plan.id, status: 'draft', id: { not: candidate.id } },
      });
      for (const rival of rivals) {
        await tx.actionPlanReview.update({
          where: { id: rival.id },
          data: { status: 'cancelled', cancellationReason: 'Concurrent review opening collision' },
        });
      }
      return { review: candidate, reused: false };
    });
  }

  /** Porta de base44/functions/completeActionPlanReview. */
  async complete(actor: AuthUser, dto: CompleteActionPlanReviewDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const review = await tx.actionPlanReview.findFirst({ where: { id: dto.reviewId } });
      if (!review) throw new NotFoundException('Review not found');
      if (review.status !== 'draft') throw new BadRequestException('Only draft reviews can be completed');
      if (!isHQ(actor.role) && review.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden: tenant mismatch');

      const plan = await tx.actionPlan.findFirst({ where: { id: review.actionPlanId } });
      if (!plan) throw new NotFoundException('Action plan not found');
      const tasks = await tx.actionTask.findMany({ where: { planId: plan.id, tenantId: plan.tenantId } });
      const recalculated = await this.plans.recalculate(tx, plan.id);

      const closingSnapshot = {
        task_state_after: tasks.map((t) => ({ task_id: t.id, task_key: t.taskKey, status: t.status, progress_percentage: t.progressPercentage, due_date: t.dueDate })),
        overall_progress_after: Number(recalculated.overallProgressPercentage),
        tasks_completed_in_review: tasks.filter((t) => t.status === 'done').map((t) => t.id),
        tasks_blocked_in_review: tasks.filter((t) => t.status === 'blocked' || t.isBlocked).map((t) => t.id),
        cancelled_tasks: tasks.filter((t) => t.status === 'cancelled').map((t) => t.id),
        executive_summary: dto.executiveSummary || review.executiveSummary || null,
        decisions: dto.decisions || null,
        next_review_date: dto.nextReviewDate || null,
        closed_at: new Date().toISOString(), closed_by: actor.email,
      };

      await tx.actionPlan.update({
        where: { id: plan.id },
        data: { currentRevisionId: review.id, lastReviewNumber: review.reviewNumber, updatedBy: actor.email },
      });
      const completed = await tx.actionPlanReview.update({
        where: { id: review.id },
        data: {
          status: 'completed', closingSnapshot, overallProgressAfter: closingSnapshot.overall_progress_after,
          executiveSummary: closingSnapshot.executive_summary, completedAt: new Date(),
        },
      });
      return { review: completed, plan: await tx.actionPlan.findFirst({ where: { id: plan.id } }) };
    });
  }

  /** Porta de base44/functions/cancelActionPlanReview. */
  async cancel(actor: AuthUser, dto: CancelActionPlanReviewDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const review = await tx.actionPlanReview.findFirst({ where: { id: dto.reviewId } });
      if (!review) throw new NotFoundException('Review not found');
      if (review.status !== 'draft') throw new BadRequestException('Only draft reviews can be cancelled');
      if (!isHQ(actor.role) && review.tenantId !== actor.tenantId) throw new ForbiddenException('Forbidden: tenant mismatch');
      if (!dto.confirmLiveChanges) throw new BadRequestException('LIVE_CHANGES_CONFIRMATION_REQUIRED');

      const updated = await tx.actionPlanReview.update({
        where: { id: review.id },
        data: {
          status: 'cancelled', cancelledAt: new Date(), cancelledBy: actor.email, cancellationReason: dto.reason,
          closingSnapshot: { ...(review.closingSnapshot as any || {}), cancellation_model: 'live_changes_preserved', cancelled_at: new Date().toISOString() },
        },
      });
      const plan = await tx.actionPlan.findFirst({ where: { id: review.actionPlanId } });
      if (plan?.currentRevisionId === review.id) {
        await tx.actionPlan.update({ where: { id: plan.id }, data: { currentRevisionId: null, updatedBy: actor.email } });
      }
      return { review: updated };
    });
  }
}
