/**
 * Adapters: API Clarity (camelCase) ↔ formato Base44/FAL (snake_case).
 */

/**
 * O backend grava data_base_abertura/data_base_fechamento como DateTime e
 * devolve ISO completo (ex: "2023-12-01T00:00:00.000Z"). O formulário do
 * frontend (FinancialDefinitionForm) espera essas duas colunas em "MM/AAAA",
 * então convertemos de volta aqui — mantém o mesmo formato que o form manda
 * ao criar/atualizar (ver financial.dto.ts no backend).
 */
function toMonthYear(isoOrNull) {
  if (!isoOrNull) return null;
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${mm}/${yyyy}`;
}

export function mapClarityUserToAppUser(user) {
  if (!user) return null;
  const access =
    user.accessStatus || user.access_status || 'active';
  return {
    id: user.id,
    email: user.email,
    full_name: user.name,
    name: user.name,
    role: user.role === 'hq_admin' ? 'admin' : 'user',
    app_role: user.role,
    tenant_id: user.tenantId ?? user.tenant_id ?? null,
    client_id: user.clientId ?? user.client_id ?? null,
    access_status: access,
    is_clarity_user: true,
  };
}

export function mapTenantFromApi(t) {
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    logo_url: t.logoUrl ?? null,
    active: t.isActive !== false && !t.deletedAt,
    is_active: t.isActive !== false,
    created_date: t.createdAt,
    updated_date: t.updatedAt,
  };
}

export function mapGroupFromApi(g) {
  if (!g) return null;
  return {
    id: g.id,
    name: g.name,
    tenant_id: g.tenantId,
    is_archived: !!g.deletedAt,
    created_date: g.createdAt,
    updated_date: g.updatedAt,
    companies: Array.isArray(g.companies)
      ? g.companies.map(mapCompanyFromApi)
      : undefined,
  };
}

export function mapCompanyFromApi(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    tenant_id: c.tenantId,
    group_id: c.groupId,
    cnpj: c.cnpj ?? null,
    tax_id: c.cnpj ?? c.tax_id ?? null,
    sector: c.sector ?? null,
    erp_system: c.erpSystem ?? null,
    is_archived: !!c.deletedAt,
    created_date: c.createdAt,
    updated_date: c.updatedAt,
    units: Array.isArray(c.units) ? c.units.map(mapUnitFromApi) : undefined,
  };
}

export function mapUnitFromApi(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    code: u.code ?? null,
    tenant_id: u.tenantId,
    company_id: u.companyId,
    is_active: !u.deletedAt,
    is_archived: !!u.deletedAt,
    created_date: u.createdAt,
    updated_date: u.updatedAt,
  };
}

// ── Diagnóstico Financeiro (Fase 1) ────────────────────────────────────

export function mapFinancialDiagnosisFromApi(d) {
  if (!d) return null;
  return {
    id: d.id,
    tenant_id: d.tenantId,
    group_id: d.groupId ?? null,
    company_id: d.companyId ?? null,
    unit_id: d.unitId ?? null,
    scope_level: d.scopeLevel ?? null,
    analysis_type: d.analysisType,
    title: d.title,
    status: d.status,
    first_period: d.firstPeriod ?? null,
    last_period: d.lastPeriod ?? null,
    periodicidade: d.periodicidade ?? null,
    account_plan_id: d.accountPlanId ?? null,
    notes: d.notes ?? null,
    data_base_abertura: toMonthYear(d.dataBaseAbertura),
    data_base_fechamento: toMonthYear(d.dataBaseFechamento),
    months_count: d.monthsCount ?? null,
    presenting_entity_id: d.presentingEntityId ?? null,
    parent_entity_id: d.parentEntityId ?? null,
    current_upload_id: d.currentUploadId ?? null,
    current_processing_snapshot_id: d.currentProcessingSnapshotId ?? null,
    integrity_status: d.integrityStatus ?? null,
    integrity_blocking_count: d.integrityBlockingCount ?? null,
    integrity_warning_count: d.integrityWarningCount ?? null,
    integrity_checked_at: d.integrityCheckedAt ?? null,
    // Só presente na listagem (financial-diagnosis.service.ts::list) —
    // undefined em get()/create()/update(), tratado como "desconhecido"
    // pelo consumidor (GroupFinancialAnalysesTab.jsx), não como "false".
    has_finalized_report: d.hasFinalizedReport,
    is_archived: !!d.deletedAt,
    created_date: d.createdAt,
    updated_date: d.updatedAt,
  };
}

export function mapFinancialAccountPlanFromApi(p) {
  if (!p) return null;
  return {
    id: p.id,
    tenant_id: p.tenantId,
    group_id: p.groupId,
    name: p.name,
    description: p.description ?? null,
    version: p.version ?? null,
    is_active: p.isActive !== false,
    is_default: !!p.isDefault,
    // Ainda não portado (Fase 1): a vigência do plano fica em branco aqui.
    valid_from: p.validFrom ?? null,
    is_archived: !!p.deletedAt,
    created_date: p.createdAt,
    updated_date: p.updatedAt,
  };
}

export function mapFinancialAccountPlanLineFromApi(l) {
  if (!l) return null;
  return {
    id: l.id,
    tenant_id: l.tenantId,
    account_plan_id: l.accountPlanId,
    account_code: l.accountCode,
    account_code_display: l.accountCodeDisplay ?? null,
    account_name: l.accountName,
    account_type: l.accountType ?? null,
    parent_account_code: l.parentAccountCode ?? null,
    classification: l.classification ?? null,
    statement_code: l.statementCode ?? null,
    bp_group: l.bpGroup ?? null,
    ebitda_component: l.ebitdaComponent ?? null,
    canonical_key: l.canonicalKey ?? null,
    dfc_classification: l.dfcClassification ?? null,
    sign_rule: l.signRule ?? 'normal',
    statement_group: l.statementGroup ?? null,
    is_active: l.isActive !== false,
    notes: l.notes ?? null,
    created_date: l.createdAt,
    updated_date: l.updatedAt,
  };
}

/** Decimal do Prisma chega serializado como string ("1234.5600") — convertemos
 *  pra number aqui pra não quebrar soma/subtração no frontend (string + string
 *  concatena em vez de somar). null/undefined viram null, nunca 0 ou NaN. */
function toNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mapFinancialStatementLineFromApi(l) {
  if (!l) return null;
  return {
    id: l.id,
    tenant_id: l.tenantId,
    financial_diagnosis_id: l.financialDiagnosisId,
    financial_upload_id: l.financialUploadId ?? null,
    processing_run_id: l.processingRunId,
    entity_code: l.entityCode ?? null,
    period: l.period,
    column_key: l.columnKey ?? null,
    column_label: l.columnLabel ?? null,
    period_type: l.periodType ?? null,
    statement_code: l.statementCode,
    statement_family: l.statementFamily ?? null,
    group_label: l.groupLabel ?? null,
    rubric_label: l.rubricLabel ?? null,
    canonical_key: l.canonicalKey,
    line_type: l.lineType,
    display_order: l.displayOrder ?? null,
    note_reference: l.noteReference ?? null,
    value: toNum(l.value),
    dataset_scope: l.datasetScope ?? 'individual',
    reporting_entity_id: l.reportingEntityId ?? null,
    publication_status: l.publicationStatus ?? 'active',
    published_at: l.publishedAt ?? null,
    superseded_at: l.supersededAt ?? null,
    created_date: l.createdAt,
  };
}

export function mapFinancialIndicatorSnapshotFromApi(s) {
  if (!s) return null;
  return {
    id: s.id,
    tenant_id: s.tenantId,
    financial_diagnosis_id: s.financialDiagnosisId,
    processing_run_id: s.processingRunId,
    entity_code: s.entityCode ?? null,
    period: s.period,
    column_key: s.columnKey ?? null,
    column_label: s.columnLabel ?? null,
    period_type: s.periodType ?? null,
    indicator_code: s.indicatorCode,
    value: toNum(s.value),
    previous_value: toNum(s.previousValue),
    variation_value: toNum(s.variationValue),
    variation_percent: toNum(s.variationPercent),
    signal: s.signal ?? null,
    severity: s.severity ?? null,
    confidence_level: s.confidenceLevel ?? null,
    validation_code: s.validationCode ?? null,
    formula: s.formula ?? null,
    numerator: s.numerator ?? null,
    denominator: s.denominator ?? null,
    canonical_sources: s.canonicalSources ?? null,
    dataset_scope: s.datasetScope ?? 'individual',
    reporting_entity_id: s.reportingEntityId ?? null,
    publication_status: s.publicationStatus ?? 'active',
    published_at: s.publishedAt ?? null,
    superseded_at: s.supersededAt ?? null,
    created_date: s.createdAt,
  };
}

export function mapFinancialDfcCompositionLineFromApi(c) {
  if (!c) return null;
  return {
    id: c.id,
    tenant_id: c.tenantId,
    financial_diagnosis_id: c.financialDiagnosisId,
    processing_run_id: c.processingRunId,
    period: c.period,
    column_key: c.columnKey ?? null,
    rubric_key: c.rubricKey,
    rubric_label: c.rubricLabel ?? null,
    canonical_key: c.canonicalKey ?? null,
    bucket: c.bucket,
    bucket_source: c.bucketSource ?? null,
    previous_value: toNum(c.previousValue),
    current_value: toNum(c.currentValue),
    delta: toNum(c.delta),
    impact_on_dfc: toNum(c.impactOnDfc),
    dataset_scope: c.datasetScope ?? 'individual',
    reporting_entity_id: c.reportingEntityId ?? null,
    publication_status: c.publicationStatus ?? 'active',
    created_date: c.createdAt,
  };
}

export function mapFinancialMappingResolutionFromApi(m) {
  if (!m) return null;
  return {
    id: m.id,
    tenant_id: m.tenantId,
    financial_diagnosis_id: m.financialDiagnosisId,
    financial_upload_id: m.financialUploadId,
    processing_run_id: m.processingRunId,
    account_code: m.accountCode,
    canonical_key: m.canonicalKey ?? null,
    mapping_source: m.mappingSource,
    blocking_issue: m.blockingIssue === true,
    resolved_confidence: m.resolvedConfidence ?? null,
    publication_status: m.publicationStatus ?? 'active',
    created_date: m.createdAt,
  };
}

export function mapFinancialDfcClassificationOverrideFromApi(o) {
  if (!o) return null;
  return {
    id: o.id,
    tenant_id: o.tenantId,
    financial_diagnosis_id: o.financialDiagnosisId,
    canonical_key: o.canonicalKey,
    manual_bucket: o.manualBucket,
    status: o.status ?? 'active',
    created_by: o.createdBy ?? null,
    created_date: o.createdAt,
    updated_date: o.updatedAt,
  };
}

export function mapFinancialDfcManualAdjustmentFromApi(a) {
  if (!a) return null;
  return {
    id: a.id,
    tenant_id: a.tenantId,
    financial_diagnosis_id: a.financialDiagnosisId,
    financial_upload_id: a.financialUploadId ?? null,
    activity: a.activity,
    label: a.label ?? null,
    value: toNum(a.value),
    period: a.period,
    column_key: a.columnKey ?? null,
    adjustment_type: a.adjustmentType ?? null,
    justification: a.justification ?? null,
    notes: a.notes ?? null,
    created_by: a.createdBy ?? null,
    created_date: a.createdAt,
    updated_date: a.updatedAt,
  };
}

export function mapFinancialProcessingRunFromApi(r) {
  if (!r) return null;
  return {
    id: r.id,
    tenant_id: r.tenantId,
    financial_diagnosis_id: r.financialDiagnosisId,
    financial_upload_id: r.financialUploadId ?? null,
    operation_type: r.operationType,
    operation_key: r.operationKey,
    status: r.status,
    started_at: r.startedAt,
    completed_at: r.completedAt ?? null,
    triggered_by: r.triggeredBy ?? null,
    source_entity_id: r.sourceEntityId ?? null,
    source_period: r.sourcePeriod ?? null,
    input_checksum: r.inputChecksum ?? null,
    result_summary: r.resultSummary ?? null,
    cleanup_pending: r.cleanupPending === true,
    error_details: r.errorDetails ?? null,
    created_date: r.startedAt,
  };
}

export function mapFinancialUploadFromApi(u) {
  if (!u) return null;
  return {
    id: u.id,
    tenant_id: u.tenantId,
    financial_diagnosis_id: u.financialDiagnosisId,
    file_name: u.fileName,
    file_url: u.fileUrl,
    version_number: u.versionNumber ?? null,
    upload_status: u.uploadStatus,
    is_current: u.isCurrent !== false,
    source_entity_id: u.sourceEntityId ?? null,
    source_entity_type: u.sourceEntityType ?? null,
    source_entity_name: u.sourceEntityName ?? null,
    source_period: u.sourcePeriod ?? null,
    source_key: u.sourceKey ?? null,
    input_checksum: u.inputChecksum ?? null,
    replacement_status: u.replacementStatus ?? null,
    notes: u.notes ?? null,
    validation_summary: u.validationSummary ?? null,
    current_validation_run_id: u.currentValidationRunId ?? null,
    current_validation_checksum: u.currentValidationChecksum ?? null,
    validated_at: u.validatedAt ?? null,
    created_date: u.createdAt,
    updated_date: u.updatedAt,
  };
}

// ── Marco 2: motor de scoring (diagnóstico, prioridade, inteligência, MFIS, agregados) ──

export function mapFalDiagnosticSnapshotFromApi(s) {
  if (!s) return null;
  return {
    id: s.id,
    tenant_id: s.tenantId,
    assessment_id: s.assessmentId,
    cycle_id: s.cycleId ?? null,
    target_type: s.targetType ?? null,
    target_id: s.targetId ?? null,
    computed_at: s.computedAt,
    computed_by: s.computedBy ?? null,
    question_set: s.questionSet ?? [],
    dimension_scores: s.dimensionScores ?? {},
    overall_score: toNum(s.overallScore),
    overall_level: s.overallLevel,
    radar_points: s.radarPoints ?? [],
    gaps_top: s.gapsTop ?? [],
    sector_snapshot: s.sectorSnapshot ?? [],
    active_dimensions: s.activeDimensions ?? [],
    dimension_risk_summary: s.dimensionRiskSummary ?? {},
    maturity_index: s.maturityIndex,
    total_evolution: toNum(s.totalEvolution),
    critical_clusters_count: s.criticalClustersCount ?? 0,
    total_clusters_count: s.totalClustersCount ?? 0,
    action_execution_rate: s.actionExecutionRate ?? null,
    impact_potential: toNum(s.impactPotential),
    value_lever_summary: s.valueLeverSummary ?? null,
    methodology_log: s.methodologyLog ?? {},
    clusters_criticos: s.clustersCriticos ?? [],
    clusters_alta_prioridade: s.clustersAltaPrioridade ?? [],
    clusters_media_prioridade: s.clustersMediaPrioridade ?? [],
    clusters_baixa_prioridade: s.clustersBaixaPrioridade ?? [],
    priority_computed_at: s.priorityComputedAt ?? null,
    priority_computed_by: s.priorityComputedBy ?? null,
    cluster_analysis: s.clusterAnalysis ?? null,
    intelligence_computed_at: s.intelligenceComputedAt ?? null,
    intelligence_benchmark_group: s.intelligenceBenchmarkGroup ?? null,
    created_date: s.createdAt,
  };
}

export function mapFalAggregateSnapshotFromApi(a) {
  if (!a) return null;
  return {
    id: a.id,
    tenant_id: a.tenantId,
    level_type: a.levelType,
    level_id: a.levelId,
    computed_at: a.computedAt,
    computed_by: a.computedBy ?? null,
    overall_score: toNum(a.overallScore),
    overall_level: a.overallLevel,
    dimension_scores: a.dimensionScores ?? {},
    radar_points: a.radarPoints ?? [],
    source_assessments: a.sourceAssessments ?? [],
    aggregation_rule: a.aggregationRule ?? 'mean',
    created_date: a.createdAt,
    updated_date: a.updatedAt,
  };
}

export function mapSystemicCrossingAnalysisFromApi(c) {
  if (!c) return null;
  return {
    id: c.id,
    tenant_id: c.tenantId,
    assessment_id: c.assessmentId,
    computed_at: c.computedAt,
    computed_by: c.computedBy ?? null,
    crossing_key: c.crossingKey,
    crossing_label: c.crossingLabel,
    crossing_type: c.crossingType,
    dimension_a_key: c.dimensionAKey,
    dimension_a_label: c.dimensionALabel,
    dimension_b_key: c.dimensionBKey,
    dimension_b_label: c.dimensionBLabel,
    dimension_a_score_raw: toNum(c.dimensionAScoreRaw),
    dimension_b_score_raw: toNum(c.dimensionBScoreRaw),
    mqe_score_raw: toNum(c.mqeScoreRaw),
    has_mqe_data: !!c.hasMqeData,
    cross_score_base_raw: toNum(c.crossScoreBaseRaw),
    cross_weight: toNum(c.crossWeight),
    cross_score_final: toNum(c.crossScoreFinal),
    tension_level: c.tensionLevel,
    tension_rank: c.tensionRank ?? null,
    is_fragile: !!c.isFragile,
    is_critical: !!c.isCritical,
    interpretation_text: c.interpretationText ?? '',
    risk_summary: c.riskSummary ?? '',
    recommended_focus: c.recommendedFocus ?? '',
    systemic_weight: toNum(c.systemicWeight),
  };
}

export function mapSystemicDimensionImpactFromApi(d) {
  if (!d) return null;
  return {
    id: d.id,
    tenant_id: d.tenantId,
    assessment_id: d.assessmentId,
    computed_at: d.computedAt,
    dimension_key: d.dimensionKey,
    dimension_label: d.dimensionLabel,
    related_crossings_count: d.relatedCrossingsCount,
    fragile_crossings_count: d.fragileCrossingsCount,
    critical_crossings_count: d.criticalCrossingsCount,
    average_cross_score: toNum(d.averageCrossScore),
    leverage_score: toNum(d.leverageScore),
    is_systemic_leverage_point: !!d.isSystemicLeveragePoint,
    systemic_summary: d.systemicSummary ?? '',
  };
}

// ── Marco 3: Plano de Ação ────────────────────────────────────────────

export function mapActionPlanFromApi(p) {
  if (!p) return null;
  return {
    id: p.id,
    tenant_id: p.tenantId,
    assessment_id: p.assessmentId,
    group_id: p.groupId ?? null,
    company_id: p.companyId ?? null,
    unit_id: p.unitId ?? null,
    cycle_id: p.cycleId ?? null,
    diagnostic_snapshot_id: p.diagnosticSnapshotId ?? null,
    target_type: p.targetType ?? null,
    target_id: p.targetId ?? null,
    plan_key: p.planKey,
    generation_fingerprint: p.generationFingerprint ?? null,
    current_revision_id: p.currentRevisionId ?? null,
    last_review_number: p.lastReviewNumber ?? 0,
    published_at: p.publishedAt ?? null,
    updated_at: p.updatedAt,
    updated_by: p.updatedBy ?? null,
    status: p.status,
    overall_progress_percentage: toNum(p.overallProgressPercentage) ?? 0,
    total_tasks: p.totalTasks ?? 0,
    done_tasks: p.doneTasks ?? 0,
    blocked_tasks: p.blockedTasks ?? 0,
    overdue_tasks: p.overdueTasks ?? 0,
    critical_open_tasks: p.criticalOpenTasks ?? 0,
    next_due_date: p.nextDueDate ?? null,
    generation_diff_summary: p.generationDiffSummary ?? null,
    engine_version: p.engineVersion ?? null,
    generation_config: p.generationConfig ?? null,
    generation_summary: p.generationSummary ?? null,
    roadmap: p.roadmap ?? null,
    generated_at: p.generatedAt ?? null,
    generated_by: p.generatedBy ?? null,
    created_date: p.createdAt,
  };
}

export function mapActionTaskFromApi(t) {
  if (!t) return null;
  return {
    id: t.id,
    tenant_id: t.tenantId,
    plan_id: t.planId,
    assessment_id: t.assessmentId,
    target_type: t.targetType ?? null,
    target_id: t.targetId ?? null,
    dimension_key: t.dimensionKey ?? null,
    subdimension_key: t.subdimensionKey ?? null,
    cluster_key: t.clusterKey ?? null,
    evaluated_entity_id: t.evaluatedEntityId ?? null,
    evaluated_entity_type: t.evaluatedEntityType ?? null,
    evaluated_entity_name: t.evaluatedEntityName ?? null,
    task_key: t.taskKey,
    operation_id: t.operationId ?? null,
    operation_status: t.operationStatus ?? 'active',
    action_library_key: t.actionLibraryKey ?? null,
    title: t.title,
    description: t.description ?? null,
    horizon: t.horizon ?? null,
    priority: t.priority ?? null,
    action_type: t.actionType ?? null,
    task_layer: t.taskLayer ?? 'strategic',
    typical_owner: t.typicalOwner ?? null,
    impact_score: t.impactScore ?? null,
    effort_score: t.effortScore ?? null,
    evidence_severity: t.evidenceSeverity ?? null,
    evidence_missing: !!t.evidenceMissing,
    priority_score: toNum(t.priorityScore),
    origin_score: toNum(t.originScore),
    origin_type: t.originType ?? null,
    origin_key: t.originKey ?? null,
    origin_detail: t.originDetail ?? null,
    question_action_id: t.questionActionId ?? null,
    how_to_execute: t.howToExecute ?? null,
    execution_guidance: t.executionGuidance ?? null,
    expected_evidence: t.expectedEvidence ?? null,
    completion_evidence: t.completionEvidence ?? null,
    blocked_reason: t.blockedReason ?? null,
    last_checkin_at: t.lastCheckinAt ?? null,
    last_checkin_comment: t.lastCheckinComment ?? null,
    last_updated_by: t.lastUpdatedBy ?? null,
    frequency: t.frequency ?? null,
    reason: t.reason ?? null,
    dependency_task_keys: t.dependencyTaskKeys ?? [],
    is_blocked: !!t.isBlocked,
    status: t.status,
    progress_percentage: t.progressPercentage ?? 0,
    assigned_to: t.assignedTo ?? null,
    owner_name: t.ownerName ?? null,
    start_date: t.startDate ?? null,
    due_date: t.dueDate ?? null,
    completed_at: t.completedAt ?? null,
    is_manual: !!t.isManual,
    is_system_generated: t.isSystemGenerated !== false,
    consultant_notes: t.consultantNotes ?? null,
    evidence_questions: t.evidenceQuestions ?? [],
    playbook_key: t.playbookKey ?? null,
    created_date: t.createdAt,
    updated_date: t.updatedAt,
  };
}

export function mapActionRecommendationFromApi(r) {
  if (!r) return null;
  return {
    id: r.id,
    tenant_id: r.tenantId,
    assessment_id: r.assessmentId ?? null,
    action_plan_id: r.actionPlanId ?? null,
    financial_diagnosis_id: r.financialDiagnosisId ?? null,
    financial_finding_id: r.financialFindingId ?? null,
    source_type: r.sourceType ?? 'manual',
    source_ref_id: r.sourceRefId ?? null,
    dimension_key: r.dimensionKey ?? null,
    subdimension_key: r.subdimensionKey ?? null,
    cluster_key: r.clusterKey ?? null,
    question_id: r.questionId ?? null,
    evaluated_entity_id: r.evaluatedEntityId ?? null,
    evaluated_entity_type: r.evaluatedEntityType ?? null,
    evaluated_entity_name: r.evaluatedEntityName ?? null,
    task_layer: r.taskLayer ?? null,
    title: r.title,
    recommendation_text: r.recommendationText,
    rationale: r.rationale ?? null,
    practical_steps: r.practicalSteps ?? null,
    evidence_required: r.evidenceRequired ?? null,
    expected_deliverable: r.expectedDeliverable ?? null,
    expected_result: r.expectedResult ?? null,
    suggested_owner_area: r.suggestedOwnerArea ?? null,
    suggested_deadline_days: r.suggestedDeadlineDays ?? null,
    priority: r.priority ?? 'medium',
    impact_score: r.impactScore ?? null,
    effort_score: r.effortScore ?? null,
    complexity_level: r.complexityLevel ?? null,
    consultant_origin_context: r.consultantOriginContext ?? null,
    status: r.status,
    approved_by: r.approvedBy ?? null,
    approved_at: r.approvedAt ?? null,
    rejected_reason: r.rejectedReason ?? null,
    converted_task_ids: r.convertedTaskIds ?? [],
    converted_at: r.convertedAt ?? null,
    converted_by: r.convertedBy ?? null,
    suggest_to_library: !!r.suggestToLibrary,
    library_entry_id: r.libraryEntryId ?? null,
    created_by: r.createdBy ?? null,
    created_date: r.createdAt,
    updated_date: r.updatedAt,
  };
}

export function mapActionPlanReviewFromApi(r) {
  if (!r) return null;
  return {
    id: r.id,
    action_plan_id: r.actionPlanId,
    assessment_id: r.assessmentId,
    tenant_id: r.tenantId,
    review_key: r.reviewKey,
    commit_status: r.commitStatus ?? 'active',
    review_number: r.reviewNumber,
    review_date: r.reviewDate,
    visit_type: r.visitType ?? 'intermediate',
    consultant_id: r.consultantId ?? null,
    consultant_name: r.consultantName ?? null,
    executive_summary: r.executiveSummary ?? null,
    overall_progress_before: toNum(r.overallProgressBefore),
    overall_progress_after: toNum(r.overallProgressAfter),
    fal_dimension_scores_snapshot: r.falDimensionScoresSnapshot ?? null,
    opening_snapshot: r.openingSnapshot ?? null,
    closing_snapshot: r.closingSnapshot ?? null,
    status: r.status,
    opened_at: r.openedAt ?? null,
    opened_by: r.openedBy ?? null,
    cancelled_at: r.cancelledAt ?? null,
    cancelled_by: r.cancelledBy ?? null,
    cancellation_reason: r.cancellationReason ?? null,
    completed_at: r.completedAt ?? null,
    created_date: r.createdAt,
  };
}

export function mapActionTaskReviewFromApi(r) {
  if (!r) return null;
  return {
    id: r.id,
    action_plan_review_id: r.actionPlanReviewId,
    action_plan_id: r.actionPlanId,
    action_task_id: r.actionTaskId,
    tenant_id: r.tenantId,
    operation_id: r.operationId,
    commit_status: r.commitStatus ?? 'active',
    previous_status: r.previousStatus ?? null,
    new_status: r.newStatus ?? null,
    previous_progress_percentage: r.previousProgressPercentage ?? null,
    new_progress_percentage: r.newProgressPercentage ?? null,
    consultant_comment: r.consultantComment ?? null,
    client_comment: r.clientComment ?? null,
    evidence_urls: r.evidenceUrls ?? [],
    change_type: r.changeType,
    changes: r.changes ?? [],
    created_by: r.createdBy ?? null,
    created_date: r.createdAt,
  };
}

export function mapActionTaskActivityFromApi(a) {
  if (!a) return null;
  return {
    id: a.id,
    action_task_id: a.actionTaskId,
    action_plan_id: a.actionPlanId,
    tenant_id: a.tenantId,
    operation_id: a.operationId,
    commit_status: a.commitStatus ?? 'active',
    type: a.type,
    before: a.before ?? {},
    after: a.after ?? {},
    changed_fields: a.changedFields ?? [],
    review_id: a.reviewId ?? null,
    comment: a.comment ?? null,
    note: a.note ?? null,
    actor: a.actor ?? null,
    timestamp: a.timestamp,
    created_by: a.createdBy ?? null,
  };
}

// ── Marco 5: Relatórios ──────────────────────────────────────────────

export function mapAssessmentReportVersionFromApi(r) {
  if (!r) return null;
  return {
    id: r.id,
    assessment_id: r.assessmentId,
    tenant_id: r.tenantId,
    action_plan_id: r.actionPlanId ?? null,
    review_id: r.reviewId ?? null,
    report_type: r.reportType,
    report_title: r.reportTitle,
    report_version_number: r.reportVersionNumber,
    report_code: r.reportCode,
    previous_report_version_id: r.previousReportVersionId ?? null,
    status: r.status,
    action_plan_review_id: r.actionPlanReviewId ?? null,
    assessment_revision_number: r.assessmentRevisionNumber ?? null,
    preset_id: r.presetId ?? null,
    report_parameters: r.reportParameters ?? {},
    payload_snapshot: r.payloadSnapshot ?? null,
    payload_checksum: r.payloadChecksum ?? null,
    source_manifest: r.sourceManifest ?? null,
    diagnostic_snapshot_id: r.diagnosticSnapshotId ?? null,
    priority_snapshot_id: r.prioritySnapshotId ?? null,
    pdf_status: r.pdfStatus ?? null,
    pdf_file_url: r.pdfFileUrl ?? null,
    pdf_upload_identifier: r.pdfUploadIdentifier ?? null,
    pdf_checksum: r.pdfChecksum ?? null,
    pdf_generated_at: r.pdfGeneratedAt ?? null,
    pdf_started_at: r.pdfStartedAt ?? null,
    pdf_started_by: r.pdfStartedBy ?? null,
    pdf_operation_id: r.pdfOperationId ?? null,
    pdf_generator_version: r.pdfGeneratorVersion ?? null,
    pdf_page_count: r.pdfPageCount ?? null,
    pdf_file_size: r.pdfFileSize ?? null,
    pdf_storage_provider: r.pdfStorageProvider ?? null,
    pdf_storage_key: r.pdfStorageKey ?? null,
    pdf_error: r.pdfError ?? null,
    generated_at: r.generatedAt ?? null,
    generated_by: r.generatedBy ?? null,
    notes: r.notes ?? null,
    error_message: r.errorMessage ?? null,
    mark_as_official: !!r.markAsOfficial,
    archived_at: r.archivedAt ?? null,
    archived_by: r.archivedBy ?? null,
    archive_reason: r.archiveReason ?? null,
    created_date: r.createdAt,
    updated_date: r.updatedAt,
  };
}

// ── Diagnóstico 8D / Assessment / MQE / Copiloto de IA ──────────────────

export function mapMethodVersionFromApi(mv) {
  if (!mv) return null;
  return {
    // payload é o bag livre pra dimensions/crossings/penalty_profiles —
    // ainda vazio (só {note}) até a tela de administração do método ser
    // migrada; espalhar primeiro deixa os campos abaixo sempre vencerem.
    ...(mv.payload || {}),
    id: mv.id,
    tenant_id: mv.tenantId ?? null,
    code: mv.code,
    name: mv.name,
    version: mv.version,
    status: mv.isPublished ? 'active' : 'draft',
    published_at: mv.publishedAt ?? null,
    created_date: mv.createdAt,
    updated_date: mv.updatedAt,
  };
}

/**
 * Campos "core" do Assessment que viraram coluna própria no Postgres —
 * qualquer outro campo (telas legadas como FalAssessmentSetupPage:
 * dimension_target_mapping, linked_entities, scope_hash,
 * configuration_status, coverage_mode, report_status, diagnostic_cycle,
 * ...) vai/vem inteiro do bag `metadata`, pra nunca perder dado silenciosamente
 * quando uma tela manda um campo que ainda não virou coluna.
 */
/** snake_case (payload vindo das telas) → { core: camelCase, metadata: resto } */
export function splitAssessmentPayload(data = {}) {
  const CORE_MAP = {
    tenant_id: 'tenantId', client_id: 'clientId', method_version_id: 'methodVersionId',
    title: 'title', display_name: 'displayName', status: 'status',
    started_at: 'startedAt', completed_at: 'completedAt', group_id: 'groupId',
    company_id: 'companyId', unit_id: 'unitId', target_type: 'targetType',
    target_id: 'targetId', cycle_label: 'cycleLabel', assessment_type: 'assessmentType',
    assessment_mode: 'assessmentMode', competence: 'competence', cycle_number: 'cycleNumber',
    cycle_id: 'cycleId', context_note: 'contextNote', penalty_profile_key: 'penaltyProfileKey',
    assigned_to: 'assignedTo', scope_mode: 'scopeMode', recipient_name: 'recipientName',
    active_dimensions: 'activeDimensions', diagnostic_depth: 'diagnosticDepth',
    question_set: 'questionSet', progress_percentage: 'progressPercentage',
    last_saved_at: 'lastSavedAt', last_subdimension_key: 'lastSubdimensionKey',
  };
  const core = {};
  const metadata = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (key === 'is_archived') {
      core.status = value ? 'archived' : core.status;
      continue;
    }
    if (key === 'id' || key === 'created_date' || key === 'updated_date' || key === 'created_by_id') continue;
    if (CORE_MAP[key]) core[CORE_MAP[key]] = value;
    else metadata[key] = value;
  }
  if (Object.keys(metadata).length > 0) core.metadata = metadata;
  return core;
}

export function mapAssessmentFromApi(a) {
  if (!a) return null;
  return {
    ...(a.metadata || {}),
    id: a.id,
    tenant_id: a.tenantId,
    client_id: a.clientId ?? null,
    method_version_id: a.methodVersionId ?? null,
    title: a.title,
    display_name: a.displayName ?? null,
    status: a.status,
    started_at: a.startedAt ?? null,
    completed_at: a.completedAt ?? null,
    group_id: a.groupId ?? null,
    company_id: a.companyId ?? null,
    unit_id: a.unitId ?? null,
    target_type: a.targetType ?? null,
    target_id: a.targetId ?? null,
    cycle_label: a.cycleLabel ?? null,
    assessment_type: a.assessmentType ?? null,
    assessment_mode: a.assessmentMode ?? 'single_entity',
    competence: a.competence ?? null,
    cycle_number: a.cycleNumber ?? null,
    cycle_id: a.cycleId ?? null,
    context_note: a.contextNote ?? null,
    penalty_profile_key: a.penaltyProfileKey ?? null,
    assigned_to: a.assignedTo ?? null,
    scope_mode: a.scopeMode ?? null,
    recipient_name: a.recipientName ?? null,
    active_dimensions: a.activeDimensions ?? [],
    diagnostic_depth: a.diagnosticDepth ?? 'rapid',
    question_set: a.questionSet ?? [],
    progress_percentage: a.progressPercentage ?? 0,
    last_saved_at: a.lastSavedAt ?? null,
    last_subdimension_key: a.lastSubdimensionKey ?? null,
    is_archived: a.status === 'archived' || !!a.deletedAt,
    created_date: a.createdAt,
    updated_date: a.updatedAt,
  };
}

export function mapFalQuestionFromApi(q) {
  if (!q) return null;
  return {
    id: q.id,
    question_id: q.questionId,
    dimension_key: q.dimensionKey,
    subdimension_key: q.subdimensionKey,
    cluster_key: q.clusterKey,
    process_stage: q.processStage,
    sequence_order: q.sequenceOrder ?? 0,
    diagnostic_depth: q.diagnosticDepth ?? [],
    level_applicability: q.levelApplicability ?? [],
    question_weight: toNum(q.questionWeight) ?? 1,
    question_text: q.questionText,
    guidance: q.guidance ?? null,
    evidence_hint: q.evidenceHint ?? null,
    is_killer_question: !!q.isKillerQuestion,
    is_critical: !!q.isCritical,
    dependency: q.dependency ?? null,
    created_date: q.createdAt,
    updated_date: q.updatedAt,
  };
}

export function mapFalResponseFromApi(r) {
  if (!r) return null;
  return {
    id: r.id,
    tenant_id: r.tenantId,
    assessment_id: r.assessmentId,
    fal_question_id: r.falQuestionId,
    dimension_key: r.dimensionKey,
    subdimension_key: r.subdimensionKey ?? null,
    cluster_key: r.clusterKey ?? null,
    score: r.score,
    justification: r.justification ?? null,
    confidence_level: r.confidenceLevel ?? 'auto_declarada',
    flag: r.flag ?? null,
    evidence_notes: r.evidenceNotes ?? null,
    evidence_file_urls: r.evidenceFileUrls ?? [],
    evaluated_entity_id: r.evaluatedEntityId ?? null,
    evaluated_entity_type: r.evaluatedEntityType ?? null,
    created_date: r.createdAt,
    updated_date: r.updatedAt,
  };
}

export function mapMqeQuestionFromApi(q) {
  if (!q) return null;
  return {
    id: q.id,
    method_version_id: q.methodVersionId,
    crossing_key: q.crossingKey,
    code: q.code ?? null,
    text: q.text,
    weight: toNum(q.weight) ?? 1,
    order: q.order ?? 0,
    guidance: q.guidance ?? null,
    sector_tags: q.sectorTags ?? [],
    sector_type: q.sectorType ?? null,
    evidence_hint: q.evidenceHint ?? null,
    risk_tag: q.riskTag ?? null,
    created_date: q.createdAt,
    updated_date: q.updatedAt,
  };
}

export function mapMqeResponseFromApi(r) {
  if (!r) return null;
  return {
    id: r.id,
    tenant_id: r.tenantId,
    assessment_id: r.assessmentId,
    mqe_question_id: r.mqeQuestionId,
    crossing_key: r.crossingKey,
    score: r.score,
    justification: r.justification ?? null,
    divergence_notes: r.divergenceNotes ?? null,
    created_date: r.createdAt,
    updated_date: r.updatedAt,
  };
}

export function mapFalContentSuggestionFromApi(s) {
  if (!s) return null;
  return {
    id: s.id,
    tenant_id: s.tenantId ?? null,
    content_type: s.contentType,
    dimension_key: s.dimensionKey ?? null,
    subdimension_key: s.subdimensionKey ?? null,
    cluster_key: s.clusterKey,
    trigger: s.trigger,
    requested_by: s.requestedBy ?? null,
    model_used: s.modelUsed ?? null,
    prompt_context_summary: s.promptContextSummary ?? null,
    draft_payload: s.draftPayload,
    status: s.status,
    reviewed_by: s.reviewedBy ?? null,
    reviewed_at: s.reviewedAt ?? null,
    review_comment: s.reviewComment ?? null,
    published_entity_id: s.publishedEntityId ?? null,
    assessment_id: s.assessmentId ?? null,
    fal_question_id: s.falQuestionId ?? null,
    rationale: s.rationale ?? undefined,
    created_date: s.createdAt,
    updated_date: s.updatedAt,
  };
}

// ── Relatório da Análise Financeira: achados / recomendações / propostas / versões ──

export function mapFinancialFindingFromApi(f) {
  if (!f) return null;
  return {
    id: f.id,
    tenant_id: f.tenantId,
    financial_diagnosis_id: f.financialDiagnosisId,
    group_id: f.groupId ?? null,
    company_id: f.companyId ?? null,
    unit_id: f.unitId ?? null,
    title: f.title,
    description: f.description ?? null,
    severity: f.severity,
    finding_type: f.findingType,
    financial_indicator: f.financialIndicator ?? null,
    period: f.period ?? null,
    comparison_period: f.comparisonPeriod ?? null,
    finding_scope: f.findingScope,
    financial_upload_id: f.financialUploadId ?? null,
    finding_key: f.findingKey,
    source_type: f.sourceType,
    source_ref_id: f.sourceRefId ?? null,
    origin: f.origin,
    confidence_level: f.confidenceLevel,
    status: f.status,
    evidence_numeric: f.evidenceNumeric ?? [],
    classification: f.classification ?? null,
    interpretation: f.interpretation ?? null,
    potential_impact: f.potentialImpact ?? null,
    investigation_question: f.investigationQuestion ?? null,
    report_inclusion_status: f.reportInclusionStatus,
    report_inclusion_edited_text: f.reportInclusionEditedText ?? null,
    action_plan_status: f.actionPlanStatus,
    action_recommendation_id: f.actionRecommendationId ?? null,
    action_task_id: f.actionTaskId ?? null,
    action_plan_id: f.actionPlanId ?? null,
    sent_to_action_plan_at: f.sentToActionPlanAt ?? null,
    sent_to_action_plan_by: f.sentToActionPlanBy ?? null,
    converted_to_task_at: f.convertedToTaskAt ?? null,
    converted_to_task_by: f.convertedToTaskBy ?? null,
    rejected_reason: f.rejectedReason ?? null,
    created_date: f.createdAt,
    updated_date: f.updatedAt,
  };
}

export function mapFinancialRecommendationFromApi(r) {
  if (!r) return null;
  return {
    id: r.id,
    tenant_id: r.tenantId,
    financial_diagnosis_id: r.financialDiagnosisId,
    financial_finding_id: r.financialFindingId ?? null,
    title: r.title,
    diagnostic_thesis: r.diagnosticThesis ?? null,
    probable_cause: r.probableCause ?? null,
    suggested_action: r.suggestedAction ?? null,
    expected_impact: r.expectedImpact ?? null,
    priority: r.priority,
    editable_text: r.editableText ?? null,
    consultant_comment: r.consultantComment ?? null,
    is_approved: !!r.isApproved,
    approved_at: r.approvedAt ?? null,
    approved_by: r.approvedBy ?? null,
    report_inclusion_status: r.reportInclusionStatus || 'candidate',
    related_indicator_codes: r.relatedIndicatorCodes ?? [],
    created_date: r.createdAt,
    updated_date: r.updatedAt,
  };
}

export function mapFinancialActionProposalFromApi(p) {
  if (!p) return null;
  return {
    id: p.id,
    tenant_id: p.tenantId,
    financial_diagnosis_id: p.financialDiagnosisId,
    financial_recommendation_id: p.financialRecommendationId ?? null,
    title: p.title,
    description: p.description ?? null,
    priority: p.priority,
    status: p.status,
    exported_to_fal: !!p.exportedToFal,
    fal_action_plan_id: p.falActionPlanId ?? null,
    fal_action_task_id: p.falActionTaskId ?? null,
    exported_at: p.exportedAt ?? null,
    consultant_adjustment: p.consultantAdjustment ?? null,
    created_date: p.createdAt,
    updated_date: p.updatedAt,
  };
}

export function mapFinancialReportVersionFromApi(v) {
  if (!v) return null;
  return {
    id: v.id,
    tenant_id: v.tenantId,
    financial_diagnosis_id: v.financialDiagnosisId,
    version_number: v.versionNumber,
    status: v.status,
    base_date_period: v.baseDatePeriod ?? null,
    comparative_periods: v.comparativePeriods ?? [],
    payload_snapshot: v.payloadSnapshot ?? null,
    payload_checksum: v.payloadChecksum ?? null,
    reviewed_text_overrides: v.reviewedTextOverrides ?? null,
    pdf_status: v.pdfStatus ?? null,
    pdf_file_url: v.pdfFileUrl ?? null,
    pdf_checksum: v.pdfChecksum ?? null,
    pdf_generated_at: v.pdfGeneratedAt ?? null,
    pdf_page_count: v.pdfPageCount ?? null,
    pdf_file_size: v.pdfFileSize ?? null,
    pdf_storage_key: v.pdfStorageKey ?? null,
    pdf_error: v.pdfError ?? null,
    watermark_draft: v.watermarkDraft !== false,
    generated_at: v.generatedAt ?? null,
    generated_by: v.generatedBy ?? null,
    finalized_at: v.finalizedAt ?? null,
    finalized_by: v.finalizedBy ?? null,
    notes: v.notes ?? null,
    created_date: v.createdAt,
    updated_date: v.updatedAt,
  };
}
