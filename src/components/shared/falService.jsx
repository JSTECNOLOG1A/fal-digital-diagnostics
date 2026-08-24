/**
 * falService — Camada de serviço intermediária para o módulo FAL
 *
 * Centraliza todas as chamadas ao backend FAL (entidades + funções).
 * Benefícios:
 * - Mudanças de nome de função/entidade em um único lugar
 * - Facilita mock em testes de integração
 */

import { base44 } from '@/api/base44Client';

// ── Assessments ───────────────────────────────────────────────────────────────

export const assessmentService = {
  get:    (id)           => base44.entities.Assessment.get(id),
  update: (id, data)     => base44.entities.Assessment.update(id, data),
  list:   (sort, limit)  => base44.entities.Assessment.list(sort || '-created_date', limit || 50),
  filter: (q, sort, lim) => base44.entities.Assessment.filter(q, sort, lim),
};

// ── Questions ─────────────────────────────────────────────────────────────────

export const questionService = {
  list:   ()   => base44.entities.FalQuestion.list(),
  filter: (q)  => base44.entities.FalQuestion.filter(q),
  get:    (id) => base44.entities.FalQuestion.get(id),
};

// ── Responses ─────────────────────────────────────────────────────────────────

export const responseService = {
  forAssessment: (assessmentId) =>
    base44.entities.FalResponse.filter({ assessment_id: assessmentId }),

  create: (data) => base44.entities.FalResponse.create(data),

  update: (id, data) => base44.entities.FalResponse.update(id, data),

  upsert: async (existing, questionId, assessmentId, tenantId, fields) => {
    const payload = {
      score:              fields.score,
      justification:      fields.justification      || '',
      confidence_level:   fields.confidence_level   || 'auto_declarada',
      flag:               fields.flag               || null,
      evidence_notes:     fields.evidence_notes     || '',
      evidence_file_urls: fields.evidence_file_urls || [],
    };
    if (existing?.id) {
      return base44.entities.FalResponse.update(existing.id, payload);
    }
    return base44.entities.FalResponse.create({
      ...payload,
      tenant_id:        tenantId,
      assessment_id:    assessmentId,
      fal_question_id:  questionId,
      dimension_key:    fields.dimension_key    || '',
      subdimension_key: fields.subdimension_key || null,
      cluster_key:      fields.cluster_key      || null,
    });
  },
};

// ── Diagnostic ────────────────────────────────────────────────────────────────

export const diagnosticService = {
  compute: (assessmentId) =>
    base44.functions.invoke('computeFalDiagnostic', { assessment_id: assessmentId }),

  getLatestSnapshot: (assessmentId) =>
    base44.entities.FalDiagnosticSnapshot
      .filter({ assessment_id: assessmentId }, '-computed_at', 1)
      .then(r => r[0] || null),

  buildQuestionSet: (assessmentId) =>
    base44.functions.invoke('buildFalQuestionSet', { assessment_id: assessmentId }),
};

// ── Action Plan ───────────────────────────────────────────────────────────────

export const actionPlanService = {
  generate: (assessmentId, opts = {}) =>
    base44.functions.invoke('generateActionPlan', {
      assessmentId,
      cycleId:        opts.cycleId        || null,
      maxTasks:       opts.maxTasks       || 20,
      scoreThreshold: opts.scoreThreshold || 2.5,
    }),

  getPlan: (assessmentId) =>
    base44.entities.ActionPlan
      .filter({ assessment_id: assessmentId }, '-created_date', 1)
      .then(r => r[0] || null),

  getTasks: (planId) =>
    base44.entities.ActionTask.filter({ plan_id: planId }, '-priority_score', 100),

  updateTask: (task_id, updates, source = 'service') =>
    base44.functions.invoke('updateActionTaskWithHistory', { task_id, updates, source }),
};

// ── Admin / Hardening ─────────────────────────────────────────────────────────

export const adminService = {
  runTestSuite: (suite = 'all') =>
    base44.functions.invoke('falTestSuite', { suite }),

  runIntegrityCheck: (assessmentId = null) =>
    base44.functions.invoke('falIntegrityCheck', assessmentId ? { assessment_id: assessmentId } : {}),

  getHardeningReport: () =>
    base44.functions.invoke('falHardeningReport', {}),
};