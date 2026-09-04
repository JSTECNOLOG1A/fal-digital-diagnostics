/**
 * Bridge to Clarity API during Base44 cutover.
 * Mirror of apps/web/src/api/clarityClient.ts (JS for current Vite app).
 */

const DEFAULT_BASE =
  (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_CLARITY_API_URL) ||
  'http://localhost:3001/api/v1';

const storageKeys = {
  access: 'clarity.accessToken',
  refresh: 'clarity.refreshToken',
};

function getAccess() {
  return localStorage.getItem(storageKeys.access);
}

function getRefresh() {
  return localStorage.getItem(storageKeys.refresh);
}

function setTokens(tokens) {
  if (!tokens) {
    localStorage.removeItem(storageKeys.access);
    localStorage.removeItem(storageKeys.refresh);
    return;
  }
  localStorage.setItem(storageKeys.access, tokens.accessToken);
  localStorage.setItem(storageKeys.refresh, tokens.refreshToken);
}

export class ClarityClient {
  constructor(opts = {}) {
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
    this.getAccessToken = opts.getAccessToken || getAccess;
    this.getRefreshToken = opts.getRefreshToken || getRefresh;
    this.setTokens = opts.setTokens || setTokens;
    this.onUnauthorized = opts.onUnauthorized;
    this.refreshPromise = null;
  }

  async login(email, password) {
    const data = await this.request('POST', '/auth/login', { email, password }, { auth: false });
    this.setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
    });
    return data;
  }

  async logout() {
    const refreshToken = this.getRefreshToken();
    try {
      if (this.getAccessToken()) {
        await this.request('POST', '/auth/logout', { refreshToken });
      }
    } finally {
      this.setTokens(null);
    }
  }

  me() {
    return this.request('GET', '/auth/me');
  }

  listGroups() {
    return this.request('GET', '/groups');
  }

  createGroup(body) {
    return this.request('POST', '/groups', body);
  }

  listCompanies(groupId, opts = {}) {
    const params = new URLSearchParams();
    if (groupId) params.set('groupId', groupId);
    if (opts.includeArchived) params.set('includeArchived', 'true');
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/companies${q}`);
  }

  createCompany(body) {
    return this.request('POST', '/companies', body);
  }

  listUnits(companyId) {
    const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return this.request('GET', `/units${q}`);
  }

  createUnit(body) {
    return this.request('POST', '/units', body);
  }

  updateGroup(id, body) {
    return this.request('PATCH', `/groups/${encodeURIComponent(id)}`, body);
  }

  deleteGroup(id) {
    return this.request('DELETE', `/groups/${encodeURIComponent(id)}`);
  }

  updateCompany(id, body) {
    return this.request('PATCH', `/companies/${encodeURIComponent(id)}`, body);
  }

  deleteCompany(id) {
    return this.request('DELETE', `/companies/${encodeURIComponent(id)}`);
  }

  updateUnit(id, body) {
    return this.request('PATCH', `/units/${encodeURIComponent(id)}`, body);
  }

  deleteUnit(id) {
    return this.request('DELETE', `/units/${encodeURIComponent(id)}`);
  }

  updateTenant(id, body) {
    return this.request('PATCH', `/tenants/${encodeURIComponent(id)}`, body);
  }

  inviteUser(body) {
    return this.request('POST', '/users/invite', body);
  }

  revokeUser(body) {
    return this.request('POST', '/users/revoke', body);
  }

  listUsers() {
    return this.request('GET', '/users');
  }

  listTenants() {
    return this.request('GET', '/tenants');
  }

  createTenant(body) {
    return this.request('POST', '/tenants', body);
  }

  getTenant(tenantId) {
    return this.request('GET', `/tenants/${encodeURIComponent(tenantId)}`);
  }

  getProtheusConnection(tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('GET', `/integrations/protheus/connection${q}`);
  }

  upsertProtheusConnection(body) {
    return this.request('POST', '/integrations/protheus/connection', body);
  }

  startProtheusSync(body) {
    return this.request('POST', '/integrations/protheus/sync', body);
  }

  fetchProtheusResource(body) {
    return this.request('POST', '/integrations/protheus/fetch', body);
  }

  discoverProtheus(body) {
    return this.request('POST', '/integrations/protheus/discover', body);
  }

  listProtheusJobs(tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('GET', `/integrations/protheus/jobs${q}`);
  }

  listProtheusStaging(tenantId, resource) {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    if (resource) params.set('resource', resource);
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/integrations/protheus/staging${q}`);
  }

  // ── Integrações genéricas ─────────────────────────────────

  listIntegrationConnections(tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('GET', `/integrations/connections${q}`);
  }

  upsertIntegrationConnection(body) {
    return this.request('POST', '/integrations/connections', body);
  }

  listIntegrationApiKeys(tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('GET', `/integrations/api-keys${q}`);
  }

  createIntegrationApiKey(body) {
    return this.request('POST', '/integrations/api-keys', body);
  }

  revokeIntegrationApiKey(id, tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('DELETE', `/integrations/api-keys/${encodeURIComponent(id)}${q}`);
  }

  listWebhookEndpoints(tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('GET', `/integrations/webhooks/endpoints${q}`);
  }

  createWebhookEndpoint(body) {
    return this.request('POST', '/integrations/webhooks/endpoints', body);
  }

  dispatchWebhook(body) {
    return this.request('POST', '/integrations/webhooks/dispatch', body);
  }

  listInboundEvents(tenantId, provider) {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    if (provider) params.set('provider', provider);
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/integrations/inbound-events${q}`);
  }

  listIntegrationJobs(tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('GET', `/integrations/jobs${q}`);
  }

  // ── Diagnóstico Financeiro (Fase 1) ───────────────────────

  listFinancialDiagnoses(params = {}) {
    const q = new URLSearchParams();
    if (params.groupId) q.set('groupId', params.groupId);
    if (params.companyId) q.set('companyId', params.companyId);
    if (params.unitId) q.set('unitId', params.unitId);
    if (params.includeArchived) q.set('includeArchived', 'true');
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request('GET', `/financial/diagnoses${qs}`);
  }

  getFinancialDiagnosis(id) {
    return this.request('GET', `/financial/diagnoses/${encodeURIComponent(id)}`);
  }

  createFinancialDiagnosis(body) {
    return this.request('POST', '/financial/diagnoses', body);
  }

  updateFinancialDiagnosis(id, body) {
    return this.request('PATCH', `/financial/diagnoses/${encodeURIComponent(id)}`, body);
  }

  deleteFinancialDiagnosis(id) {
    return this.request('DELETE', `/financial/diagnoses/${encodeURIComponent(id)}`);
  }

  listFinancialAccountPlans(groupId) {
    const q = groupId ? `?groupId=${encodeURIComponent(groupId)}` : '';
    return this.request('GET', `/financial/account-plans${q}`);
  }

  getFinancialAccountPlan(id) {
    return this.request('GET', `/financial/account-plans/${encodeURIComponent(id)}`);
  }

  createFinancialAccountPlan(body) {
    return this.request('POST', '/financial/account-plans', body);
  }

  updateFinancialAccountPlan(id, body) {
    return this.request('PATCH', `/financial/account-plans/${encodeURIComponent(id)}`, body);
  }

  deleteFinancialAccountPlan(id) {
    return this.request('DELETE', `/financial/account-plans/${encodeURIComponent(id)}`);
  }

  listFinancialAccountPlanLines(accountPlanId) {
    return this.request('GET', `/financial/account-plans/${encodeURIComponent(accountPlanId)}/lines`);
  }

  deleteAllFinancialAccountPlanLines(accountPlanId) {
    return this.request('DELETE', `/financial/account-plans/${encodeURIComponent(accountPlanId)}/lines`);
  }

  createFinancialAccountPlanLine(body) {
    return this.request('POST', '/financial/account-plan-lines', body);
  }

  bulkCreateFinancialAccountPlanLines(body) {
    return this.request('POST', '/financial/account-plan-lines/bulk', body);
  }

  updateFinancialAccountPlanLine(id, body) {
    return this.request('PATCH', `/financial/account-plan-lines/${encodeURIComponent(id)}`, body);
  }

  deleteFinancialAccountPlanLine(id) {
    return this.request('DELETE', `/financial/account-plan-lines/${encodeURIComponent(id)}`);
  }

  listFinancialUploads(financialDiagnosisId) {
    const q = financialDiagnosisId
      ? `?financialDiagnosisId=${encodeURIComponent(financialDiagnosisId)}`
      : '';
    return this.request('GET', `/financial/uploads${q}`);
  }

  getFinancialUpload(id) {
    return this.request('GET', `/financial/uploads/${encodeURIComponent(id)}`);
  }

  /** Passo 1: grava o arquivo no MinIO, devolve { file_url }. */
  async uploadFinancialFile(file) {
    const form = new FormData();
    form.append('file', file);
    return this.requestForm('POST', '/financial/uploads/storage', form);
  }

  /** Passo 2: cria o registro FinancialUpload (JSON, sem o arquivo). */
  createFinancialUpload(body) {
    return this.request('POST', '/financial/uploads', body);
  }

  updateFinancialUpload(id, body) {
    return this.request('PATCH', `/financial/uploads/${encodeURIComponent(id)}`, body);
  }

  deleteFinancialUpload(id) {
    return this.request('DELETE', `/financial/uploads/${encodeURIComponent(id)}`);
  }

  getFinancialJourneyState(financialDiagnosisId) {
    return this.request(
      'GET',
      `/financial/journey-state?financialDiagnosisId=${encodeURIComponent(financialDiagnosisId)}`,
    );
  }

  updateFinancialJourneyPosition(body) {
    return this.request('POST', '/financial/journey-position', body);
  }

  validateFinancialUpload(body) {
    return this.request('POST', '/financial/validate-upload', body);
  }

  buildFinancialStatements(body) {
    return this.request('POST', '/financial/build-statements', body);
  }

  purgeFinancialDiagnosis(diagnosisId, confirm = true) {
    return this.request('POST', '/financial/purge-diagnosis', { diagnosisId, confirm });
  }

  purgeFinancialUploadDerived(uploadId, diagnosisId) {
    return this.request('POST', '/financial/purge-upload-derived', { uploadId, diagnosisId });
  }

  deleteFinancialUploadSafe(financialDiagnosisId, financialUploadId) {
    return this.request('POST', '/financial/delete-upload-safe', { financialDiagnosisId, financialUploadId });
  }

  resolveCurrentFinancialOutputScope(financialDiagnosisId) {
    return this.request(
      'GET',
      `/financial/output-scope?financialDiagnosisId=${encodeURIComponent(financialDiagnosisId)}`,
    );
  }

  checkFinancialDiagnosisIntegrity(financialDiagnosisId) {
    return this.request(
      'GET',
      `/financial/integrity-check?financialDiagnosisId=${encodeURIComponent(financialDiagnosisId)}`,
    );
  }

  listFinancialProcessingRuns(financialDiagnosisId) {
    return this.request(
      'GET',
      `/financial/processing-runs?financialDiagnosisId=${encodeURIComponent(financialDiagnosisId)}`,
    );
  }

  listFinancialStatementLines(financialDiagnosisId, opts = {}) {
    const q = new URLSearchParams({ financialDiagnosisId });
    if (opts.financialUploadId) q.set('financialUploadId', opts.financialUploadId);
    if (opts.processingRunId) q.set('processingRunId', opts.processingRunId);
    if (opts.publicationStatus) q.set('publicationStatus', opts.publicationStatus);
    return this.request('GET', `/financial/statement-lines?${q.toString()}`);
  }

  listFinancialIndicatorSnapshots(financialDiagnosisId, opts = {}) {
    const q = new URLSearchParams({ financialDiagnosisId });
    if (opts.processingRunId) q.set('processingRunId', opts.processingRunId);
    if (opts.publicationStatus) q.set('publicationStatus', opts.publicationStatus);
    if (opts.indicatorCode) q.set('indicatorCode', opts.indicatorCode);
    return this.request('GET', `/financial/indicator-snapshots?${q.toString()}`);
  }

  listFinancialDfcCompositionLines(financialDiagnosisId, opts = {}) {
    const q = new URLSearchParams({ financialDiagnosisId });
    if (opts.processingRunId) q.set('processingRunId', opts.processingRunId);
    if (opts.publicationStatus) q.set('publicationStatus', opts.publicationStatus);
    return this.request('GET', `/financial/dfc-composition-lines?${q.toString()}`);
  }

  listFinancialMappingResolutions(financialDiagnosisId, opts = {}) {
    const q = new URLSearchParams({ financialDiagnosisId });
    if (opts.financialUploadId) q.set('financialUploadId', opts.financialUploadId);
    if (opts.processingRunId) q.set('processingRunId', opts.processingRunId);
    if (opts.publicationStatus) q.set('publicationStatus', opts.publicationStatus);
    return this.request('GET', `/financial/mapping-resolutions?${q.toString()}`);
  }

  // ── Relatório da Análise: achados / recomendações / propostas de ação ──

  listFinancialFindings(financialDiagnosisId) {
    return this.request('GET', `/financial-report/insights/findings?financialDiagnosisId=${encodeURIComponent(financialDiagnosisId)}`);
  }

  generateFinancialFindings(financialDiagnosisId, mode) {
    return this.request('POST', '/financial-report/insights/findings/generate', { financialDiagnosisId, mode });
  }

  createManualFinancialFinding(body) {
    return this.request('POST', '/financial-report/insights/findings/manual', body);
  }

  manageFinancialFinding(id, body) {
    return this.request('POST', `/financial-report/insights/findings/${encodeURIComponent(id)}/manage`, body);
  }

  listFinancialRecommendations(financialDiagnosisId) {
    return this.request('GET', `/financial-report/insights/recommendations?financialDiagnosisId=${encodeURIComponent(financialDiagnosisId)}`);
  }

  generateFinancialRecommendations(financialDiagnosisId, mode) {
    return this.request('POST', '/financial-report/insights/recommendations/generate', { financialDiagnosisId, mode });
  }

  updateFinancialRecommendation(id, body) {
    return this.request('POST', `/financial-report/insights/recommendations/${encodeURIComponent(id)}/update`, body);
  }

  manageFinancialRecommendation(id, body) {
    return this.request('POST', `/financial-report/insights/recommendations/${encodeURIComponent(id)}/manage`, body);
  }

  convertFinancialRecommendation(body) {
    return this.request('POST', '/financial-report/insights/recommendations/convert', body);
  }

  unconvertFinancialActionTask(body) {
    return this.request('POST', '/financial-report/insights/recommendations/unconvert', body);
  }

  listFinancialActionProposals(financialDiagnosisId) {
    return this.request('GET', `/financial-report/insights/action-proposals?financialDiagnosisId=${encodeURIComponent(financialDiagnosisId)}`);
  }

  // ── Relatório da Análise: versões / PDF ─────────────────────────────

  listFinancialReportVersions(financialDiagnosisId) {
    return this.request('GET', `/financial-report/${encodeURIComponent(financialDiagnosisId)}/versions`);
  }

  generateOrUpdateFinancialReportVersion(financialDiagnosisId, overwriteReviewedText) {
    return this.request('POST', `/financial-report/${encodeURIComponent(financialDiagnosisId)}/versions`, { overwriteReviewedText });
  }

  getFinancialReportVersion(versionId) {
    return this.request('GET', `/financial-report/versions/${encodeURIComponent(versionId)}`);
  }

  updateFinancialReportVersionText(versionId, sectionKey, text) {
    return this.request('POST', `/financial-report/versions/${encodeURIComponent(versionId)}/text`, { sectionKey, text });
  }

  finalizeFinancialReportVersion(versionId, notes) {
    return this.request('POST', `/financial-report/versions/${encodeURIComponent(versionId)}/finalize`, { notes });
  }

  exportFinancialReportVersionPdf(versionId) {
    return this.request('POST', `/financial-report/versions/${encodeURIComponent(versionId)}/export-pdf`);
  }

  /** Baixa o PDF já gerado como blob — fora de request() por ser resposta binária, não JSON. */
  async downloadFinancialReportVersionPdf(versionId) {
    const token = this.getAccessToken();
    const tenantId = typeof localStorage !== 'undefined' ? localStorage.getItem('fal_active_tenant_id') : null;
    const res = await fetch(`${this.baseUrl}/financial-report/versions/${encodeURIComponent(versionId)}/pdf`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
      },
    });
    if (!res.ok) throw new Error(`Clarity API ${res.status}: falha ao baixar PDF`);
    const disposition = res.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const blob = await res.blob();
    return { blob, filename: filenameMatch?.[1] || `relatorio-${versionId}.pdf` };
  }

  /** HTML renderizado da versão (mesmo template usado no PDF) — usado na prévia em tela, dentro de um iframe. */
  async getFinancialReportRenderHtml(versionId) {
    const token = this.getAccessToken();
    const tenantId = typeof localStorage !== 'undefined' ? localStorage.getItem('fal_active_tenant_id') : null;
    const res = await fetch(`${this.baseUrl}/financial-report/versions/${encodeURIComponent(versionId)}/render-html`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
      },
    });
    if (!res.ok) throw new Error(`Clarity API ${res.status}: falha ao carregar prévia do relatório`);
    return res.text();
  }

  listFinancialDfcClassificationOverrides(financialDiagnosisId) {
    return this.request(
      'GET',
      `/financial/dfc-classification-overrides?financialDiagnosisId=${encodeURIComponent(financialDiagnosisId)}`,
    );
  }

  listFinancialDfcManualAdjustments(financialDiagnosisId) {
    return this.request(
      'GET',
      `/financial/dfc-manual-adjustments?financialDiagnosisId=${encodeURIComponent(financialDiagnosisId)}`,
    );
  }

  createFinancialDfcManualAdjustment(body) {
    return this.request('POST', '/financial/dfc-manual-adjustments', body);
  }

  updateFinancialDfcManualAdjustment(adjustmentId, body) {
    return this.request('PATCH', `/financial/dfc-manual-adjustments/${encodeURIComponent(adjustmentId)}`, body);
  }

  deleteFinancialDfcManualAdjustment(adjustmentId, financialDiagnosisId) {
    return this.request(
      'DELETE',
      `/financial/dfc-manual-adjustments/${encodeURIComponent(adjustmentId)}?financialDiagnosisId=${encodeURIComponent(financialDiagnosisId)}`,
    );
  }

  // ── Marco 2: motor de scoring (diagnóstico, prioridade, inteligência, MFIS, agregados) ──

  getAssessmentFlow(assessmentId) {
    return this.request('GET', `/fal/assessments/${encodeURIComponent(assessmentId)}/flow`);
  }

  computeFalDiagnostic(assessmentId) {
    return this.request('POST', `/fal/assessments/${encodeURIComponent(assessmentId)}/diagnostic`);
  }

  computeFalPriority(assessmentId) {
    return this.request('POST', `/fal/assessments/${encodeURIComponent(assessmentId)}/priority`);
  }

  computeClusterIntelligence(assessmentId, benchmarkGroup) {
    const q = benchmarkGroup ? `?benchmarkGroup=${encodeURIComponent(benchmarkGroup)}` : '';
    return this.request('POST', `/fal/assessments/${encodeURIComponent(assessmentId)}/intelligence${q}`);
  }

  computeMfisAnalysis(assessmentId) {
    return this.request('POST', `/fal/assessments/${encodeURIComponent(assessmentId)}/mfis`);
  }

  publishFalAssessment(assessmentId, cycleId) {
    return this.request('POST', `/fal/assessments/${encodeURIComponent(assessmentId)}/publish`, cycleId ? { cycleId } : {});
  }

  generateAssessmentScopes(assessmentId) {
    return this.request('POST', `/fal/assessments/${encodeURIComponent(assessmentId)}/scopes/generate`);
  }

  listAssessmentScopes(assessmentId) {
    return this.request('GET', `/fal/assessments/${encodeURIComponent(assessmentId)}/scopes`);
  }

  swapFalQuestion(assessmentId, body) {
    return this.request('POST', `/fal/assessments/${encodeURIComponent(assessmentId)}/question-swaps`, body);
  }

  computeCompanyAggregate(companyId) {
    return this.request('POST', `/fal/companies/${encodeURIComponent(companyId)}/aggregate`);
  }

  computeGroupAggregate(groupId) {
    return this.request('POST', `/fal/groups/${encodeURIComponent(groupId)}/aggregate`);
  }

  listFalDiagnosticSnapshots(params = {}) {
    const q = new URLSearchParams();
    if (params.assessmentId) q.set('assessmentId', params.assessmentId);
    if (params.targetType) q.set('targetType', params.targetType);
    if (params.targetId) q.set('targetId', params.targetId);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request('GET', `/fal/diagnostic-snapshots${qs}`);
  }

  getFalDiagnosticSnapshot(id) {
    return this.request('GET', `/fal/diagnostic-snapshots/${encodeURIComponent(id)}`);
  }

  listFalAggregateSnapshots(params = {}) {
    const q = new URLSearchParams();
    if (params.levelType) q.set('levelType', params.levelType);
    if (params.levelId) q.set('levelId', params.levelId);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request('GET', `/fal/aggregate-snapshots${qs}`);
  }

  listSystemicCrossings(assessmentId) {
    return this.request('GET', `/fal/systemic-crossings?assessmentId=${encodeURIComponent(assessmentId)}`);
  }

  listSystemicDimensionImpacts(assessmentId) {
    return this.request('GET', `/fal/systemic-dimension-impacts?assessmentId=${encodeURIComponent(assessmentId)}`);
  }

  // ── Marco 3: Plano de Ação ────────────────────────────────

  listActionPlans(params = {}) {
    const q = new URLSearchParams();
    if (params.assessmentId) q.set('assessmentId', params.assessmentId);
    if (params.groupId) q.set('groupId', params.groupId);
    if (params.targetType) q.set('targetType', params.targetType);
    if (params.targetId) q.set('targetId', params.targetId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request('GET', `/fal/action-plans${qs}`);
  }

  getActionPlan(id) {
    return this.request('GET', `/fal/action-plans/${encodeURIComponent(id)}`);
  }

  generateActionPlan(body) {
    return this.request('POST', '/fal/action-plans/generate', body);
  }

  listActionTasks(planId) {
    return this.request('GET', `/fal/action-tasks?planId=${encodeURIComponent(planId)}`);
  }

  createManualActionTask(body) {
    return this.request('POST', '/fal/action-tasks/manual', body);
  }

  updateActionTaskWithHistory(body) {
    return this.request('POST', '/fal/action-tasks/update-with-history', body);
  }

  listActionRecommendations(params = {}) {
    const q = new URLSearchParams();
    if (params.assessmentId) q.set('assessmentId', params.assessmentId);
    if (params.actionPlanId) q.set('actionPlanId', params.actionPlanId);
    if (params.status) q.set('status', params.status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request('GET', `/fal/action-recommendations${qs}`);
  }

  generateActionRecommendations(body) {
    return this.request('POST', '/fal/action-recommendations/generate', body);
  }

  manageActionRecommendation(body) {
    return this.request('POST', '/fal/action-recommendations/manage', body);
  }

  listActionPlanReviews(actionPlanId) {
    return this.request('GET', `/fal/action-plan-reviews?actionPlanId=${encodeURIComponent(actionPlanId)}`);
  }

  openActionPlanReview(body) {
    return this.request('POST', '/fal/action-plan-reviews/open', body);
  }

  completeActionPlanReview(body) {
    return this.request('POST', '/fal/action-plan-reviews/complete', body);
  }

  cancelActionPlanReview(body) {
    return this.request('POST', '/fal/action-plan-reviews/cancel', body);
  }

  listActionTaskReviews(taskId) {
    return this.request('GET', `/fal/action-task-reviews?taskId=${encodeURIComponent(taskId)}`);
  }

  listActionTaskActivities(taskId) {
    return this.request('GET', `/fal/action-task-activities?taskId=${encodeURIComponent(taskId)}`);
  }

  // ── Marco 5: Relatórios ───────────────────────────────────

  listReports(params = {}) {
    const q = new URLSearchParams();
    if (params.assessmentId) q.set('assessmentId', params.assessmentId);
    if (params.reportType) q.set('reportType', params.reportType);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request('GET', `/fal/reports${qs}`);
  }

  getReport(id) {
    return this.request('GET', `/fal/reports/${encodeURIComponent(id)}`);
  }

  getReportSnapshot(id) {
    return this.request('GET', `/fal/reports/${encodeURIComponent(id)}/snapshot`);
  }

  getReportRenderPayload(id) {
    return this.request('GET', `/fal/reports/${encodeURIComponent(id)}/render-payload`);
  }

  generateReportVersion(body) {
    return this.request('POST', '/fal/reports/generate', body);
  }

  setOfficialReportVersion(id) {
    return this.request('POST', `/fal/reports/${encodeURIComponent(id)}/set-official`);
  }

  archiveReportVersion(body) {
    return this.request('POST', '/fal/reports/archive', body);
  }

  beginReportPdf(body) {
    return this.request('POST', '/fal/reports/pdf/begin', body);
  }

  async uploadReportPdf(file) {
    const form = new FormData();
    form.append('file', file);
    return this.requestForm('POST', '/fal/reports/pdf/storage', form);
  }

  commitReportPdf(body) {
    return this.request('POST', '/fal/reports/pdf/commit', body);
  }

  listMethodVersions(status) {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request('GET', `/fal/method-versions${q}`);
  }

  getMethodVersion(id) {
    return this.request('GET', `/fal/method-versions/${encodeURIComponent(id)}`);
  }

  // ── Diagnóstico 8D / Assessment / MQE / Copiloto de IA ────

  listAssessments(params = {}) {
    const q = new URLSearchParams();
    if (params.targetType) q.set('targetType', params.targetType);
    if (params.targetId) q.set('targetId', params.targetId);
    if (params.groupId) q.set('groupId', params.groupId);
    if (params.companyId) q.set('companyId', params.companyId);
    if (params.unitId) q.set('unitId', params.unitId);
    if (params.includeArchived) q.set('includeArchived', 'true');
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request('GET', `/fal/assessments${qs}`);
  }

  getAssessment(id) {
    return this.request('GET', `/fal/assessments/${encodeURIComponent(id)}`);
  }

  createAssessment(body) {
    return this.request('POST', '/fal/assessments', body);
  }

  updateAssessment(id, body) {
    return this.request('PATCH', `/fal/assessments/${encodeURIComponent(id)}`, body);
  }

  deleteAssessment(id) {
    return this.request('DELETE', `/fal/assessments/${encodeURIComponent(id)}`);
  }

  buildAssessmentQuestionSet(id) {
    return this.request('POST', `/fal/assessments/${encodeURIComponent(id)}/build-question-set`);
  }

  listFalQuestions(params = {}) {
    const q = new URLSearchParams();
    if (params.dimensionKey) q.set('dimensionKey', params.dimensionKey);
    if (params.clusterKey) q.set('clusterKey', params.clusterKey);
    if (params.ids) q.set('ids', params.ids);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request('GET', `/fal/questions${qs}`);
  }

  createFalQuestion(body) {
    return this.request('POST', '/fal/questions', body);
  }

  listFalResponses(assessmentId, dimensionKey) {
    const q = new URLSearchParams({ assessmentId });
    if (dimensionKey) q.set('dimensionKey', dimensionKey);
    return this.request('GET', `/fal/responses?${q.toString()}`);
  }

  createFalResponse(body) {
    return this.request('POST', '/fal/responses', body);
  }

  updateFalResponse(id, body) {
    return this.request('PATCH', `/fal/responses/${encodeURIComponent(id)}`, body);
  }

  listMqeQuestions(methodVersionId, crossingKey) {
    const q = new URLSearchParams({ methodVersionId });
    if (crossingKey) q.set('crossingKey', crossingKey);
    return this.request('GET', `/fal/mqe/questions?${q.toString()}`);
  }

  listMqeResponses(assessmentId, crossingKey) {
    const q = new URLSearchParams({ assessmentId });
    if (crossingKey) q.set('crossingKey', crossingKey);
    return this.request('GET', `/fal/mqe/responses?${q.toString()}`);
  }

  createMqeResponse(body) {
    return this.request('POST', '/fal/mqe/responses', body);
  }

  updateMqeResponse(id, body) {
    return this.request('PATCH', `/fal/mqe/responses/${encodeURIComponent(id)}`, body);
  }

  listFalContentSuggestions(contentType) {
    const q = contentType ? `?contentType=${encodeURIComponent(contentType)}` : '';
    return this.request('GET', `/fal/content-suggestions${q}`);
  }

  generateFalContentSuggestion(body) {
    return this.request('POST', '/fal/content-suggestions/generate', body);
  }

  reviewFalContentSuggestion(id, body) {
    return this.request('POST', `/fal/content-suggestions/${encodeURIComponent(id)}/review`, body);
  }

  /** Como request(), mas para multipart/form-data (upload de arquivo). */
  async requestForm(method, path, formData, opts = {}) {
    const auth = opts.auth !== false;
    const headers = { Accept: 'application/json' };
    // Sem 'Content-Type' — o browser define automaticamente com o boundary
    // correto do multipart/form-data.
    if (auth) {
      const token = this.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const tenantId =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('fal_active_tenant_id')
          : null;
      if (tenantId) headers['X-Tenant-Id'] = tenantId;
    }

    const res = await fetch(`${this.baseUrl}${path}`, { method, headers, body: formData });

    if (res.status === 401 && auth && opts.retry !== false) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.requestForm(method, path, formData, { ...opts, retry: false });
      }
      this.setTokens(null);
      this.onUnauthorized?.();
      throw new Error('Clarity API 401: Unauthorized');
    }

    if (!res.ok) {
      let message = res.statusText;
      try {
        const err = await res.json();
        message = Array.isArray(err.message) ? err.message.join(', ') : err.message || message;
      } catch {
        /* ignore */
      }
      throw new Error(`Clarity API ${res.status}: ${message}`);
    }

    if (res.status === 204) return undefined;
    return res.json();
  }

  async request(method, path, body, opts = {}) {
    const auth = opts.auth !== false;
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      const token = this.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const tenantId =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('fal_active_tenant_id')
          : null;
      if (tenantId) headers['X-Tenant-Id'] = tenantId;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 401 && auth && opts.retry !== false) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request(method, path, body, { ...opts, retry: false });
      }
      this.setTokens(null);
      this.onUnauthorized?.();
      throw new Error('Clarity API 401: Unauthorized');
    }

    if (!res.ok) {
      let message = res.statusText;
      let body = null;
      try {
        body = await res.json();
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message || message;
      } catch {
        /* ignore */
      }
      const error = new Error(`Clarity API ${res.status}: ${message}`);
      // Alguns endpoints (ex.: publish/scope/question-swap) anexam campos
      // extras ao corpo do erro (pendencias, coverage, swap_record) — o
      // localBase44Client precisa deles pra reconstruir o formato de
      // resposta que as telas legadas esperam de base44.functions.invoke.
      error.body = body;
      error.status = res.status;
      throw error;
    }

    if (res.status === 204) return undefined;
    return res.json();
  }

  async tryRefresh() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        this.setTokens(data);
        return true;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }
}

export const clarity = new ClarityClient();

/** Flip per domain when ready to leave Base44 */
export const CLARITY_FEATURES = {
  useClarityAuth:
    typeof import.meta.env !== 'undefined' &&
    import.meta.env.VITE_CLARITY_AUTH === 'true',
  useClarityHierarchy:
    typeof import.meta.env !== 'undefined' &&
    import.meta.env.VITE_CLARITY_HIERARCHY === 'true',
  useClarityUsers:
    typeof import.meta.env !== 'undefined' &&
    import.meta.env.VITE_CLARITY_USERS === 'true',
  useClarityProtheus:
    typeof import.meta.env !== 'undefined' &&
    (import.meta.env.VITE_CLARITY_PROTHEUS === 'true' ||
      import.meta.env.VITE_CLARITY_INTEGRATIONS === 'true' ||
      import.meta.env.VITE_CLARITY_AUTH === 'true'),
  useClarityIntegrations:
    typeof import.meta.env !== 'undefined' &&
    (import.meta.env.VITE_CLARITY_INTEGRATIONS === 'true' ||
      import.meta.env.VITE_CLARITY_AUTH === 'true'),
  /** Diagnóstico Financeiro Fase 1 (estrutura/fontes/validação) — Postgres real. */
  useClarityFinancial:
    typeof import.meta.env !== 'undefined' &&
    (import.meta.env.VITE_CLARITY_FINANCIAL === 'true' ||
      import.meta.env.VITE_CLARITY_AUTH === 'true'),
  /** Domínio 8D/Assessment/MQE/Copiloto de IA — Postgres real. */
  useClarityFal:
    typeof import.meta.env !== 'undefined' &&
    (import.meta.env.VITE_CLARITY_FAL === 'true' ||
      import.meta.env.VITE_CLARITY_AUTH === 'true'),
};
