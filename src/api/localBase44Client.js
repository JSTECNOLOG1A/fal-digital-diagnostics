import {
  clearLocalTestSession,
  createLocalTestUser,
  getLocalTestSession,
} from '../lib/localTestAuth.js';
import { clarity, CLARITY_FEATURES } from './clarityClient.js';
import falQuestionsSeed from './falSeedData/falQuestions.json';
import falRecommendationLibrarySeed from './falSeedData/falRecommendationLibrary.json';
import falClusterCauseSeed from './falSeedData/falClusterCause.json';
import falClusterRecommendationSeed from './falSeedData/falClusterRecommendation.json';
import falActionLibrarySeed from './falSeedData/falActionLibrary.json';
import falQuestionActionLibrarySeed from './falSeedData/falQuestionActionLibrary.json';
import falBenchmarkSeed from './falSeedData/falBenchmark.json';
import {
  mapCompanyFromApi,
  mapFinancialAccountPlanFromApi,
  mapFinancialAccountPlanLineFromApi,
  mapFinancialDfcClassificationOverrideFromApi,
  mapFinancialDfcCompositionLineFromApi,
  mapFinancialDfcManualAdjustmentFromApi,
  mapFinancialDiagnosisFromApi,
  mapFinancialFindingFromApi,
  mapFinancialRecommendationFromApi,
  mapFinancialActionProposalFromApi,
  mapFinancialIndicatorSnapshotFromApi,
  mapFinancialMappingResolutionFromApi,
  mapFinancialProcessingRunFromApi,
  mapFinancialStatementLineFromApi,
  mapFinancialUploadFromApi,
  mapGroupFromApi,
  mapTenantFromApi,
  mapUnitFromApi,
  mapAssessmentFromApi,
  mapFalQuestionFromApi,
  mapFalResponseFromApi,
  mapMqeQuestionFromApi,
  mapMqeResponseFromApi,
  mapFalContentSuggestionFromApi,
  splitAssessmentPayload,
  mapMethodVersionFromApi,
  mapFalDiagnosticSnapshotFromApi,
  mapFalAggregateSnapshotFromApi,
  mapSystemicCrossingAnalysisFromApi,
  mapSystemicDimensionImpactFromApi,
  mapActionPlanFromApi,
  mapActionTaskFromApi,
  mapActionRecommendationFromApi,
  mapActionPlanReviewFromApi,
  mapActionTaskReviewFromApi,
  mapAssessmentReportVersionFromApi,
} from './clarityMappers.js';

const store = new Map();

// ── Persistência via localStorage ──────────────────────────────────────────
// Sem isso, o mock local (usado quando VITE_LOCAL_TEST_AUTH=true) guarda tudo
// só em memória — qualquer F5/reload da página reiniciava o "banco" do zero
// (assessments, respostas, sugestões de IA, tudo). Aqui persistimos o `store`
// inteiro a cada escrita e reidratamos no load do módulo, então o estado
// sobrevive a reloads normais (mas ainda é só deste navegador/aba — não é um
// backend de verdade, e `localStorage.clear()` ou modo anônimo ainda zeram).
const LOCAL_STORE_KEY = 'fal_local_mock_store_v1';

function persistStore() {
  try {
    const plain = {};
    for (const [entity, collection] of store.entries()) {
      plain[entity] = Object.fromEntries(collection);
    }
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(plain));
  } catch (e) {
    console.warn('[local-base44] falha ao persistir store no localStorage:', e.message);
  }
}

function hydrateStoreFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    if (!raw) return;
    const plain = JSON.parse(raw);
    for (const [entity, records] of Object.entries(plain)) {
      store.set(entity, new Map(Object.entries(records)));
    }
  } catch (e) {
    console.warn('[local-base44] falha ao reidratar store do localStorage:', e.message);
  }
}

function makeId(prefix = 'local') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getCollection(entity) {
  if (!store.has(entity)) store.set(entity, new Map());
  return store.get(entity);
}

function matchesQuery(record, query = {}) {
  return Object.entries(query).every(([key, value]) => record?.[key] === value);
}

function createEntityApi(entity) {
  return {
    async list(sort, limit = 100) {
      const rows = [...getCollection(entity).values()];
      return typeof limit === 'number' ? rows.slice(0, limit) : rows;
    },
    async filter(query = {}, sort, limit = 100) {
      const rows = [...getCollection(entity).values()].filter((row) => matchesQuery(row, query));
      return typeof limit === 'number' ? rows.slice(0, limit) : rows;
    },
    async get(id) {
      const row = getCollection(entity).get(id);
      if (!row) {
        /** @type {any} */
        const error = new Error(`${entity} not found`);
        error.status = 404;
        throw error;
      }
      return row;
    },
    async create(data = {}) {
      const id = data.id || makeId(entity);
      const row = {
        ...data,
        id,
        created_date: data.created_date || new Date().toISOString(),
        updated_date: new Date().toISOString(),
      };
      getCollection(entity).set(id, row);
      persistStore();
      return row;
    },
    async update(id, data = {}) {
      const current = await this.get(id);
      const row = {
        ...current,
        ...data,
        id,
        updated_date: new Date().toISOString(),
      };
      getCollection(entity).set(id, row);
      persistStore();
      return row;
    },
    async delete(id) {
      getCollection(entity).delete(id);
      persistStore();
      return { id };
    },
    async deleteMany(ids = []) {
      ids.forEach((id) => getCollection(entity).delete(id));
      persistStore();
      return { deleted: ids.length };
    },
    async bulkCreate(items = []) {
      return Promise.all(items.map((item) => this.create(item)));
    },
    subscribe() {
      return () => {};
    },
  };
}


function createClarityHierarchyEntity(entityName) {
  const local = createEntityApi(entityName);

  if (entityName === 'Tenant') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listTenants();
        return rows.map(mapTenantFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await this.list();
        if (query.active === true || query.is_active === true) {
          rows = rows.filter((t) => t.active);
        }
        if (query.slug) rows = rows.filter((t) => t.slug === query.slug);
        return rows;
      },
      async get(id) {
        const row = mapTenantFromApi(await clarity.getTenant(id));
        if (!row) {
          const error = new Error('Tenant not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      async create(data = {}) {
        const created = await clarity.createTenant({
          name: data.name,
          slug: data.slug,
          logoUrl: data.logo_url || data.logoUrl,
        });
        return mapTenantFromApi(created);
      },
      async update(id, data = {}) {
        const body = {};
        if (data.name !== undefined) body.name = data.name;
        if (data.logo_url !== undefined || data.logoUrl !== undefined) {
          body.logoUrl = data.logo_url ?? data.logoUrl;
        }
        if (data.active !== undefined) body.isActive = data.active;
        if (data.is_active !== undefined) body.isActive = data.is_active;
        const updated = await clarity.updateTenant(id, body);
        return mapTenantFromApi(updated);
      },
    };
  }

  if (entityName === 'Group') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listGroups();
        return rows.map(mapGroupFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await this.list();
        if (query.tenant_id) rows = rows.filter((g) => g.tenant_id === query.tenant_id);
        return rows;
      },
      async get(id) {
        const row = (await this.list()).find((g) => g.id === id);
        if (!row) {
          const error = new Error('Group not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      async create(data = {}) {
        const created = await clarity.createGroup({
          name: data.name,
          tenantId: data.tenant_id || data.tenantId,
        });
        return mapGroupFromApi(created);
      },
      async update(id, data = {}) {
        const body = {};
        if (data.name !== undefined) body.name = data.name;
        if (data.is_archived !== undefined) body.isArchived = data.is_archived;
        const updated = await clarity.updateGroup(id, body);
        return mapGroupFromApi(updated);
      },
      async delete(id) {
        await clarity.deleteGroup(id);
        return { id };
      },
    };
  }

  if (entityName === 'Company') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listCompanies();
        return rows.map(mapCompanyFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await clarity.listCompanies(query.group_id, {
          includeArchived: query.include_archived === true || query.includeArchived === true,
        });
        rows = rows.map(mapCompanyFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((c) => c.tenant_id === query.tenant_id);
        if (query.group_id) rows = rows.filter((c) => c.group_id === query.group_id);
        if (query.is_archived === false) rows = rows.filter((c) => !c.is_archived);
        if (query.is_archived === true) rows = rows.filter((c) => c.is_archived);
        return rows;
      },
      async get(id) {
        const row = (await this.list()).find((c) => c.id === id);
        if (!row) {
          const error = new Error('Company not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      async create(data = {}) {
        const created = await clarity.createCompany({
          name: data.name,
          groupId: data.group_id || data.groupId,
          tenantId: data.tenant_id || data.tenantId,
          cnpj: data.cnpj || data.tax_id,
          sector: data.sector,
          erpSystem: data.erp_system || data.erpSystem,
        });
        return mapCompanyFromApi(created);
      },
      async update(id, data = {}) {
        const body = {};
        if (data.name !== undefined) body.name = data.name;
        if (data.cnpj !== undefined) body.cnpj = data.cnpj;
        if (data.sector !== undefined) body.sector = data.sector;
        if (data.erp_system !== undefined || data.erpSystem !== undefined) {
          body.erpSystem = data.erp_system ?? data.erpSystem;
        }
        if (data.is_archived !== undefined) body.isArchived = data.is_archived;
        const updated = await clarity.updateCompany(id, body);
        return mapCompanyFromApi(updated);
      },
      async delete(id) {
        await clarity.deleteCompany(id);
        return { id };
      },
    };
  }

  if (entityName === 'OperationalUnit') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listUnits();
        return rows.map(mapUnitFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await clarity.listUnits(query.company_id);
        rows = rows.map(mapUnitFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((u) => u.tenant_id === query.tenant_id);
        return rows;
      },
      async get(id) {
        const row = (await this.list()).find((u) => u.id === id);
        if (!row) {
          const error = new Error('OperationalUnit not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      async create(data = {}) {
        const created = await clarity.createUnit({
          name: data.name,
          companyId: data.company_id || data.companyId,
          tenantId: data.tenant_id || data.tenantId,
          code: data.code,
        });
        return mapUnitFromApi(created);
      },
      async update(id, data = {}) {
        const body = {};
        if (data.name !== undefined) body.name = data.name;
        if (data.code !== undefined) body.code = data.code;
        if (data.is_active !== undefined) body.isActive = data.is_active;
        if (data.is_archived !== undefined) body.isArchived = data.is_archived;
        const updated = await clarity.updateUnit(id, body);
        return mapUnitFromApi(updated);
      },
      async delete(id) {
        await clarity.deleteUnit(id);
        return { id };
      },
    };
  }

  return local;
}

/** Só repassa as chaves que o DTO do backend realmente aceita (a API rejeita campos desconhecidos). */
function pick(data, keys) {
  const out = {};
  for (const [snake, camel] of keys) {
    if (data[snake] !== undefined) out[camel] = data[snake];
  }
  return out;
}

const FINANCIAL_DIAGNOSIS_CREATE_KEYS = [
  ['tenant_id', 'tenantId'],
  ['group_id', 'groupId'],
  ['company_id', 'companyId'],
  ['unit_id', 'unitId'],
  ['scope_level', 'scopeLevel'],
  ['analysis_type', 'analysisType'],
  ['title', 'title'],
  ['first_period', 'firstPeriod'],
  ['last_period', 'lastPeriod'],
  ['periodicidade', 'periodicidade'],
  ['account_plan_id', 'accountPlanId'],
  ['notes', 'notes'],
  ['data_base_abertura', 'dataBaseAbertura'],
  ['data_base_fechamento', 'dataBaseFechamento'],
  ['months_count', 'monthsCount'],
];
const FINANCIAL_DIAGNOSIS_UPDATE_KEYS = [
  ['title', 'title'],
  ['status', 'status'],
  ['first_period', 'firstPeriod'],
  ['last_period', 'lastPeriod'],
  ['periodicidade', 'periodicidade'],
  ['account_plan_id', 'accountPlanId'],
  ['notes', 'notes'],
  ['data_base_abertura', 'dataBaseAbertura'],
  ['data_base_fechamento', 'dataBaseFechamento'],
  ['months_count', 'monthsCount'],
  ['current_upload_id', 'currentUploadId'],
  ['is_archived', 'isArchived'],
];
const FINANCIAL_ACCOUNT_PLAN_CREATE_KEYS = [
  ['group_id', 'groupId'],
  ['tenant_id', 'tenantId'],
  ['name', 'name'],
  ['description', 'description'],
  ['version', 'version'],
  ['is_default', 'isDefault'],
];
const FINANCIAL_ACCOUNT_PLAN_UPDATE_KEYS = [
  ['name', 'name'],
  ['description', 'description'],
  ['version', 'version'],
  ['is_active', 'isActive'],
  ['is_default', 'isDefault'],
  ['is_archived', 'isArchived'],
];
const FINANCIAL_ACCOUNT_PLAN_LINE_FIELD_KEYS = [
  ['account_code', 'accountCode'],
  ['account_code_display', 'accountCodeDisplay'],
  ['account_name', 'accountName'],
  ['account_type', 'accountType'],
  ['parent_account_code', 'parentAccountCode'],
  ['classification', 'classification'],
  ['statement_code', 'statementCode'],
  ['bp_group', 'bpGroup'],
  ['ebitda_component', 'ebitdaComponent'],
  ['canonical_key', 'canonicalKey'],
  ['dfc_classification', 'dfcClassification'],
  ['statement_group', 'statementGroup'],
  ['is_active', 'isActive'],
  ['notes', 'notes'],
];
const FINANCIAL_UPLOAD_CREATE_KEYS = [
  ['financial_diagnosis_id', 'financialDiagnosisId'],
  ['file_url', 'fileUrl'],
  ['file_name', 'fileName'],
  ['version_number', 'versionNumber'],
  ['is_current', 'isCurrent'],
  ['replacement_status', 'replacementStatus'],
  ['source_key', 'sourceKey'],
  ['input_checksum', 'inputChecksum'],
  ['source_entity_id', 'sourceEntityId'],
  ['source_entity_type', 'sourceEntityType'],
  ['source_entity_name', 'sourceEntityName'],
  ['source_period', 'sourcePeriod'],
  ['notes', 'notes'],
];
const FINANCIAL_UPLOAD_UPDATE_KEYS = [
  ['source_period', 'sourcePeriod'],
  ['notes', 'notes'],
  ['is_current', 'isCurrent'],
];

/**
 * Entidades da jornada financeira (Fase 1) que já têm backend real —
 * ver src/financial/* no backend. Segue o mesmo padrão de
 * createClarityHierarchyEntity: por fora, ainda parece um "entity" da
 * Base44 (list/filter/get/create/update/delete), por dentro fala com o
 * Postgres via clarityClient.
 */
function createClarityFinancialEntity(entityName) {
  const local = createEntityApi(entityName);

  if (entityName === 'FinancialDiagnosis') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listFinancialDiagnoses({});
        return rows.map(mapFinancialDiagnosisFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await clarity.listFinancialDiagnoses({
          groupId: query.group_id,
          companyId: query.company_id,
          unitId: query.unit_id,
        });
        rows = rows.map(mapFinancialDiagnosisFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((d) => d.tenant_id === query.tenant_id);
        if (query.status) rows = rows.filter((d) => d.status === query.status);
        if (query.is_archived === false) rows = rows.filter((d) => !d.is_archived);
        if (query.is_archived === true) rows = rows.filter((d) => d.is_archived);
        return rows;
      },
      async get(id) {
        const row = mapFinancialDiagnosisFromApi(await clarity.getFinancialDiagnosis(id));
        if (!row) {
          const error = new Error('FinancialDiagnosis not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      async create(data = {}) {
        const created = await clarity.createFinancialDiagnosis(
          pick(data, FINANCIAL_DIAGNOSIS_CREATE_KEYS),
        );
        return mapFinancialDiagnosisFromApi(created);
      },
      async update(id, data = {}) {
        const updated = await clarity.updateFinancialDiagnosis(
          id,
          pick(data, FINANCIAL_DIAGNOSIS_UPDATE_KEYS),
        );
        return mapFinancialDiagnosisFromApi(updated);
      },
      async delete(id) {
        await clarity.deleteFinancialDiagnosis(id);
        return { id };
      },
    };
  }

  if (entityName === 'FinancialAccountPlan') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listFinancialAccountPlans();
        return rows.map(mapFinancialAccountPlanFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await clarity.listFinancialAccountPlans(query.group_id);
        rows = rows.map(mapFinancialAccountPlanFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((p) => p.tenant_id === query.tenant_id);
        if (query.is_active === true) rows = rows.filter((p) => p.is_active);
        if (query.is_active === false) rows = rows.filter((p) => !p.is_active);
        return rows;
      },
      async get(id) {
        const row = mapFinancialAccountPlanFromApi(await clarity.getFinancialAccountPlan(id));
        if (!row) {
          const error = new Error('FinancialAccountPlan not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      async create(data = {}) {
        const created = await clarity.createFinancialAccountPlan(
          pick(data, FINANCIAL_ACCOUNT_PLAN_CREATE_KEYS),
        );
        return mapFinancialAccountPlanFromApi(created);
      },
      async update(id, data = {}) {
        const updated = await clarity.updateFinancialAccountPlan(
          id,
          pick(data, FINANCIAL_ACCOUNT_PLAN_UPDATE_KEYS),
        );
        return mapFinancialAccountPlanFromApi(updated);
      },
      async delete(id) {
        await clarity.deleteFinancialAccountPlan(id);
        return { id };
      },
    };
  }

  if (entityName === 'FinancialAccountPlanLine') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}) {
        const planId = query.account_plan_id;
        if (!planId) return [];
        let rows = await clarity.listFinancialAccountPlanLines(planId);
        rows = rows.map(mapFinancialAccountPlanLineFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((l) => l.tenant_id === query.tenant_id);
        return rows;
      },
      async create(data = {}) {
        const created = await clarity.createFinancialAccountPlanLine({
          accountPlanId: data.account_plan_id,
          ...pick(data, FINANCIAL_ACCOUNT_PLAN_LINE_FIELD_KEYS),
        });
        return mapFinancialAccountPlanLineFromApi(created);
      },
      async bulkCreate(items = []) {
        if (items.length === 0) return [];
        const accountPlanId = items[0].account_plan_id;
        await clarity.bulkCreateFinancialAccountPlanLines({
          accountPlanId,
          lines: items.map((item) => pick(item, FINANCIAL_ACCOUNT_PLAN_LINE_FIELD_KEYS)),
        });
        return clarity
          .listFinancialAccountPlanLines(accountPlanId)
          .then((rows) => rows.map(mapFinancialAccountPlanLineFromApi));
      },
      async update(id, data = {}) {
        const updated = await clarity.updateFinancialAccountPlanLine(
          id,
          pick(data, FINANCIAL_ACCOUNT_PLAN_LINE_FIELD_KEYS),
        );
        return mapFinancialAccountPlanLineFromApi(updated);
      },
      async delete(id) {
        await clarity.deleteFinancialAccountPlanLine(id);
        return { id };
      },
      async deleteMany(ids = []) {
        await Promise.all(ids.map((id) => clarity.deleteFinancialAccountPlanLine(id)));
        return { deleted: ids.length };
      },
    };
  }

  if (entityName === 'FinancialUpload') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}) {
        const diagnosisId = query.financial_diagnosis_id;
        let rows = await clarity.listFinancialUploads(diagnosisId);
        rows = rows.map(mapFinancialUploadFromApi).filter(Boolean);
        if (query.is_current !== undefined) rows = rows.filter((u) => u.is_current === query.is_current);
        return rows;
      },
      async get(id) {
        const row = mapFinancialUploadFromApi(await clarity.getFinancialUpload(id));
        if (!row) {
          const error = new Error('FinancialUpload not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      async create(data = {}) {
        const created = await clarity.createFinancialUpload(
          pick(data, FINANCIAL_UPLOAD_CREATE_KEYS),
        );
        return mapFinancialUploadFromApi(created);
      },
      async update(id, data = {}) {
        const updated = await clarity.updateFinancialUpload(
          id,
          pick(data, FINANCIAL_UPLOAD_UPDATE_KEYS),
        );
        return mapFinancialUploadFromApi(updated);
      },
      async delete(id) {
        await clarity.deleteFinancialUpload(id);
        return { id };
      },
    };
  }

  if (entityName === 'FinancialStatementLine') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}, sort, limit) {
        const diagnosisId = query.financial_diagnosis_id;
        if (!diagnosisId) return [];
        let rows = await clarity.listFinancialStatementLines(diagnosisId, {
          financialUploadId: query.financial_upload_id,
          processingRunId: query.processing_run_id,
          publicationStatus: query.publication_status,
        });
        rows = rows.map(mapFinancialStatementLineFromApi).filter(Boolean);
        if (query.statement_code) rows = rows.filter((l) => l.statement_code === query.statement_code);
        if (query.dataset_scope) rows = rows.filter((l) => l.dataset_scope === query.dataset_scope);
        if (query.canonical_key) rows = rows.filter((l) => l.canonical_key === query.canonical_key);
        return typeof limit === 'number' ? rows.slice(0, limit) : rows;
      },
    };
  }

  if (entityName === 'FinancialIndicatorSnapshot') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}, sort, limit) {
        const diagnosisId = query.financial_diagnosis_id;
        if (!diagnosisId) return [];
        let rows = await clarity.listFinancialIndicatorSnapshots(diagnosisId, {
          processingRunId: query.processing_run_id,
          publicationStatus: query.publication_status,
          indicatorCode: query.indicator_code,
        });
        rows = rows.map(mapFinancialIndicatorSnapshotFromApi).filter(Boolean);
        if (query.dataset_scope) rows = rows.filter((s) => s.dataset_scope === query.dataset_scope);
        return typeof limit === 'number' ? rows.slice(0, limit) : rows;
      },
    };
  }

  if (entityName === 'FinancialDfcCompositionLine') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}, sort, limit) {
        const diagnosisId = query.financial_diagnosis_id;
        if (!diagnosisId) return [];
        let rows = await clarity.listFinancialDfcCompositionLines(diagnosisId, {
          processingRunId: query.processing_run_id,
          publicationStatus: query.publication_status,
        });
        rows = rows.map(mapFinancialDfcCompositionLineFromApi).filter(Boolean);
        return typeof limit === 'number' ? rows.slice(0, limit) : rows;
      },
    };
  }

  if (entityName === 'FinancialMappingResolution') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}, sort, limit) {
        const diagnosisId = query.financial_diagnosis_id;
        if (!diagnosisId) return [];
        let rows = await clarity.listFinancialMappingResolutions(diagnosisId, {
          financialUploadId: query.financial_upload_id,
          processingRunId: query.processing_run_id,
          publicationStatus: query.publication_status,
        });
        rows = rows.map(mapFinancialMappingResolutionFromApi).filter(Boolean);
        return typeof limit === 'number' ? rows.slice(0, limit) : rows;
      },
    };
  }

  if (entityName === 'FinancialDfcClassificationOverride') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}, sort, limit) {
        const diagnosisId = query.financial_diagnosis_id;
        if (!diagnosisId) return [];
        let rows = await clarity.listFinancialDfcClassificationOverrides(diagnosisId);
        rows = rows.map(mapFinancialDfcClassificationOverrideFromApi).filter(Boolean);
        if (query.status) rows = rows.filter((o) => o.status === query.status);
        return typeof limit === 'number' ? rows.slice(0, limit) : rows;
      },
    };
  }

  if (entityName === 'FinancialDfcManualAdjustment') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}, sort, limit) {
        const diagnosisId = query.financial_diagnosis_id;
        if (!diagnosisId) return [];
        let rows = await clarity.listFinancialDfcManualAdjustments(diagnosisId);
        rows = rows.map(mapFinancialDfcManualAdjustmentFromApi).filter(Boolean);
        return typeof limit === 'number' ? rows.slice(0, limit) : rows;
      },
    };
  }

  if (entityName === 'FinancialProcessingRun') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}, sort, limit) {
        const diagnosisId = query.financial_diagnosis_id;
        if (!diagnosisId) return [];
        let rows = await clarity.listFinancialProcessingRuns(diagnosisId);
        rows = rows.map(mapFinancialProcessingRunFromApi).filter(Boolean);
        if (query.status) rows = rows.filter((r) => r.status === query.status);
        if (query.operation_type) rows = rows.filter((r) => r.operation_type === query.operation_type);
        return typeof limit === 'number' ? rows.slice(0, limit) : rows;
      },
    };
  }

  // ── Relatório da Análise: achados/recomendações/propostas — reais no
  // Postgres (backend/src/financial-report/), não mais mock local. ──

  if (entityName === 'FinancialFinding') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}, sort, limit) {
        const diagnosisId = query.financial_diagnosis_id;
        if (!diagnosisId) return [];
        let rows = (await clarity.listFinancialFindings(diagnosisId)).map(mapFinancialFindingFromApi).filter(Boolean);
        if (query.origin) rows = rows.filter((f) => f.origin === query.origin);
        if (query.status) rows = rows.filter((f) => f.status === query.status);
        if (query.finding_scope) rows = rows.filter((f) => f.finding_scope === query.finding_scope);
        if (query.source_type) rows = rows.filter((f) => f.source_type === query.source_type);
        return typeof limit === 'number' ? rows.slice(0, limit) : rows;
      },
      async create(data = {}) {
        const created = await clarity.createManualFinancialFinding({
          financialDiagnosisId: data.financial_diagnosis_id,
          title: data.title,
          description: data.description,
          severity: data.severity,
          period: data.period,
          evidenceNumeric: data.evidence_numeric,
        });
        return mapFinancialFindingFromApi(created);
      },
      async update(id, data = {}) {
        let action = null;
        if (data.report_inclusion_status === 'approved') action = 'approve';
        else if (data.report_inclusion_status === 'excluded') action = 'exclude';
        else if (data.report_inclusion_status === 'internal_only') action = 'internal_only';
        else if (data.report_inclusion_status === 'candidate') action = 'unapprove';
        else if (data.report_inclusion_edited_text) action = 'edit';
        else if (data.status === 'ignored') action = 'ignore';
        else if (data.status === 'open') action = 'reopen';
        if (!action) return local.update ? local.update(id, data) : { id, ...data };
        const updated = await clarity.manageFinancialFinding(id, {
          action,
          editedText: data.report_inclusion_edited_text,
          classification: data.classification,
        });
        return mapFinancialFindingFromApi(updated);
      },
    };
  }

  if (entityName === 'FinancialRecommendation') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}, sort, limit) {
        const diagnosisId = query.financial_diagnosis_id;
        if (!diagnosisId) return [];
        let rows = (await clarity.listFinancialRecommendations(diagnosisId)).map(mapFinancialRecommendationFromApi).filter(Boolean);
        return typeof limit === 'number' ? rows.slice(0, limit) : rows;
      },
      async get(id) {
        const rows = await this.filter({});
        const row = rows.find((r) => r.id === id);
        if (!row) {
          const error = new Error('FinancialRecommendation not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      async update(id, data = {}) {
        let action = null;
        if (data.report_inclusion_status === 'approved') action = 'approve';
        else if (data.report_inclusion_status === 'excluded') action = 'exclude';
        else if (data.report_inclusion_status === 'internal_only') action = 'internal_only';
        else if (data.report_inclusion_status === 'candidate') action = 'unapprove';
        else if (data.report_inclusion_status === 'edited') action = 'edit';
        if (action) {
          const updated = await clarity.manageFinancialRecommendation(id, {
            action,
            title: data.title,
            diagnosticThesis: data.diagnostic_thesis,
            suggestedAction: data.suggested_action,
            expectedImpact: data.expected_impact,
          });
          return mapFinancialRecommendationFromApi(updated);
        }
        const updated = await clarity.updateFinancialRecommendation(id, {
          editableText: data.editable_text,
          consultantComment: data.consultant_comment,
          priority: data.priority,
        });
        return mapFinancialRecommendationFromApi(updated);
      },
    };
  }

  if (entityName === 'FinancialActionProposal') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}, sort, limit) {
        const diagnosisId = query.financial_diagnosis_id;
        if (!diagnosisId) return [];
        let rows = (await clarity.listFinancialActionProposals(diagnosisId)).map(mapFinancialActionProposalFromApi).filter(Boolean);
        if (query.financial_recommendation_id) rows = rows.filter((p) => p.financial_recommendation_id === query.financial_recommendation_id);
        return typeof limit === 'number' ? rows.slice(0, limit) : rows;
      },
    };
  }

  return local;
}

const FAL_RESPONSE_CREATE_KEYS = [
  ['assessment_id', 'assessmentId'],
  ['fal_question_id', 'falQuestionId'],
  ['dimension_key', 'dimensionKey'],
  ['subdimension_key', 'subdimensionKey'],
  ['cluster_key', 'clusterKey'],
  ['score', 'score'],
  ['justification', 'justification'],
  ['confidence_level', 'confidenceLevel'],
  ['flag', 'flag'],
  ['evidence_notes', 'evidenceNotes'],
  ['evidence_file_urls', 'evidenceFileUrls'],
  ['evaluated_entity_id', 'evaluatedEntityId'],
  ['evaluated_entity_type', 'evaluatedEntityType'],
];
const FAL_RESPONSE_UPDATE_KEYS = [
  ['score', 'score'],
  ['justification', 'justification'],
  ['confidence_level', 'confidenceLevel'],
  ['flag', 'flag'],
  ['evidence_notes', 'evidenceNotes'],
  ['evidence_file_urls', 'evidenceFileUrls'],
];
const MQE_RESPONSE_CREATE_KEYS = [
  ['assessment_id', 'assessmentId'],
  ['mqe_question_id', 'mqeQuestionId'],
  ['crossing_key', 'crossingKey'],
  ['score', 'score'],
  ['justification', 'justification'],
  ['divergence_notes', 'divergenceNotes'],
];
const MQE_RESPONSE_UPDATE_KEYS = [
  ['score', 'score'],
  ['justification', 'justification'],
  ['divergence_notes', 'divergenceNotes'],
];

/**
 * Ponte pro domínio 8D/Assessment/MQE/Copiloto no backend real (NestJS +
 * Postgres) — mesmo padrão de createClarityHierarchyEntity/
 * createClarityFinancialEntity: local como fallback de shape, métodos reais
 * batem no Postgres via clarityClient quando useClarityFal está ligado.
 */
function createClarityFalEntity(entityName) {
  const local = createEntityApi(entityName);

  if (entityName === 'Assessment') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listAssessments({});
        return rows.map(mapAssessmentFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await clarity.listAssessments({
          targetType: query.target_type,
          targetId: query.target_id,
          groupId: query.group_id,
          companyId: query.company_id,
          unitId: query.unit_id,
          includeArchived: query.status === 'archived' || query.include_archived === true,
        });
        rows = rows.map(mapAssessmentFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((a) => a.tenant_id === query.tenant_id);
        if (query.status) rows = rows.filter((a) => a.status === query.status);
        if (query.assessment_mode) rows = rows.filter((a) => a.assessment_mode === query.assessment_mode);
        if (query.competence) rows = rows.filter((a) => a.competence === query.competence);
        // method_version_id: null busca só o FAL 8D clássico (assessments sem
        // método atribuído); um id busca só o diagnóstico daquele método (ex.:
        // Reforma Tributária 8D) — evita misturar os dois tipos na mesma tela.
        if (query.method_version_id !== undefined) {
          rows = rows.filter((a) => (a.method_version_id || null) === query.method_version_id);
        }
        return rows;
      },
      async get(id) {
        const row = mapAssessmentFromApi(await clarity.getAssessment(id));
        if (!row) {
          const error = new Error('Assessment not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      async create(data = {}) {
        const created = await clarity.createAssessment(splitAssessmentPayload(data));
        return mapAssessmentFromApi(created);
      },
      async update(id, data = {}) {
        const updated = await clarity.updateAssessment(id, splitAssessmentPayload(data));
        return mapAssessmentFromApi(updated);
      },
      async delete(id) {
        await clarity.deleteAssessment(id);
        return { id };
      },
    };
  }

  if (entityName === 'FalQuestion') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listFalQuestions({});
        return rows.map(mapFalQuestionFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await clarity.listFalQuestions({
          dimensionKey: query.dimension_key,
          clusterKey: query.cluster_key,
        });
        rows = rows.map(mapFalQuestionFromApi).filter(Boolean);
        return rows;
      },
      async get(id) {
        const rows = await clarity.listFalQuestions({ ids: id });
        const row = mapFalQuestionFromApi(rows[0]);
        if (!row) {
          const error = new Error('FalQuestion not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
    };
  }

  if (entityName === 'FalResponse') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}) {
        const assessmentId = query.assessment_id;
        if (!assessmentId) return [];
        let rows = await clarity.listFalResponses(assessmentId, query.dimension_key);
        rows = rows.map(mapFalResponseFromApi).filter(Boolean);
        return rows;
      },
      async create(data = {}) {
        const created = await clarity.createFalResponse(pick(data, FAL_RESPONSE_CREATE_KEYS));
        return mapFalResponseFromApi(created);
      },
      async update(id, data = {}) {
        const updated = await clarity.updateFalResponse(id, pick(data, FAL_RESPONSE_UPDATE_KEYS));
        return mapFalResponseFromApi(updated);
      },
    };
  }

  if (entityName === 'MQEQuestion') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}) {
        const methodVersionId = query.method_version_id;
        if (!methodVersionId) return [];
        let rows = await clarity.listMqeQuestions(methodVersionId, query.crossing_key);
        rows = rows.map(mapMqeQuestionFromApi).filter(Boolean);
        return rows;
      },
    };
  }

  if (entityName === 'MQEResponse') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}) {
        const assessmentId = query.assessment_id;
        if (!assessmentId) return [];
        let rows = await clarity.listMqeResponses(assessmentId, query.crossing_key);
        rows = rows.map(mapMqeResponseFromApi).filter(Boolean);
        return rows;
      },
      async create(data = {}) {
        const created = await clarity.createMqeResponse(pick(data, MQE_RESPONSE_CREATE_KEYS));
        return mapMqeResponseFromApi(created);
      },
      async update(id, data = {}) {
        const updated = await clarity.updateMqeResponse(id, pick(data, MQE_RESPONSE_UPDATE_KEYS));
        return mapMqeResponseFromApi(updated);
      },
    };
  }

  if (entityName === 'MethodVersion') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listMethodVersions();
        return rows.map(mapMethodVersionFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await clarity.listMethodVersions(query.status);
        rows = rows.map(mapMethodVersionFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((m) => m.tenant_id === query.tenant_id || m.tenant_id === null);
        return rows;
      },
      async get(id) {
        const row = mapMethodVersionFromApi(await clarity.getMethodVersion(id));
        if (!row) {
          const error = new Error('MethodVersion not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
    };
  }

  if (entityName === 'FalDiagnosticSnapshot') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listFalDiagnosticSnapshots({});
        return rows.map(mapFalDiagnosticSnapshotFromApi).filter(Boolean);
      },
      async filter(query = {}, sort, limit) {
        let rows = await clarity.listFalDiagnosticSnapshots({
          assessmentId: query.assessment_id,
          targetType: query.target_type,
          targetId: query.target_id,
          limit,
        });
        rows = rows.map(mapFalDiagnosticSnapshotFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((s) => s.tenant_id === query.tenant_id);
        return rows;
      },
      async get(id) {
        const row = mapFalDiagnosticSnapshotFromApi(await clarity.getFalDiagnosticSnapshot(id));
        if (!row) {
          const error = new Error('FalDiagnosticSnapshot not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
    };
  }

  if (entityName === 'FalAggregateSnapshot') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listFalAggregateSnapshots({});
        return rows.map(mapFalAggregateSnapshotFromApi).filter(Boolean);
      },
      async filter(query = {}, sort, limit) {
        let rows = await clarity.listFalAggregateSnapshots({
          levelType: query.level_type,
          levelId: query.level_id,
          limit,
        });
        rows = rows.map(mapFalAggregateSnapshotFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((a) => a.tenant_id === query.tenant_id);
        return rows;
      },
    };
  }

  if (entityName === 'SystemicCrossingAnalysis') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}) {
        if (!query.assessment_id) return [];
        const rows = await clarity.listSystemicCrossings(query.assessment_id);
        return rows.map(mapSystemicCrossingAnalysisFromApi).filter(Boolean);
      },
    };
  }

  if (entityName === 'SystemicDimensionImpact') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}) {
        if (!query.assessment_id) return [];
        const rows = await clarity.listSystemicDimensionImpacts(query.assessment_id);
        return rows.map(mapSystemicDimensionImpactFromApi).filter(Boolean);
      },
    };
  }

  if (entityName === 'ActionPlan') {
    const notSupported = () => {
      throw new Error('ActionPlan.create/update direto não é suportado no backend real — use generateActionPlan.');
    };
    return {
      ...local,
      async list() {
        const rows = await clarity.listActionPlans({});
        return rows.map(mapActionPlanFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await clarity.listActionPlans({
          assessmentId: query.assessment_id, groupId: query.group_id,
          targetType: query.target_type, targetId: query.target_id,
        });
        rows = rows.map(mapActionPlanFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((p) => p.tenant_id === query.tenant_id);
        if (query.status) rows = rows.filter((p) => p.status === query.status);
        return rows;
      },
      async get(id) {
        const row = mapActionPlanFromApi(await clarity.getActionPlan(id));
        if (!row) {
          const error = new Error('ActionPlan not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      create: notSupported,
      update: notSupported,
    };
  }

  if (entityName === 'ActionTask') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}) {
        if (!query.plan_id) return [];
        let rows = await clarity.listActionTasks(query.plan_id);
        rows = rows.map(mapActionTaskFromApi).filter(Boolean);
        if (query.status) rows = rows.filter((t) => t.status === query.status);
        if (query.tenant_id) rows = rows.filter((t) => t.tenant_id === query.tenant_id);
        return rows;
      },
      create() {
        throw new Error('ActionTask.create direto não é suportado no backend real — use createManualActionTask.');
      },
      update() {
        throw new Error('ActionTask.update direto não é suportado no backend real — use updateActionTaskWithHistory.');
      },
    };
  }

  if (entityName === 'ActionRecommendation') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listActionRecommendations({});
        return rows.map(mapActionRecommendationFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await clarity.listActionRecommendations({
          assessmentId: query.assessment_id, actionPlanId: query.action_plan_id, status: query.status,
        });
        rows = rows.map(mapActionRecommendationFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((r) => r.tenant_id === query.tenant_id);
        return rows;
      },
      create() {
        throw new Error('ActionRecommendation.create direto não é suportado — use manageActionRecommendation(action="create_manual").');
      },
      update() {
        throw new Error('ActionRecommendation.update direto não é suportado — use manageActionRecommendation.');
      },
    };
  }

  if (entityName === 'ActionPlanReview') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}) {
        if (!query.action_plan_id) return [];
        let rows = await clarity.listActionPlanReviews(query.action_plan_id);
        rows = rows.map(mapActionPlanReviewFromApi).filter(Boolean);
        if (query.status) rows = rows.filter((r) => r.status === query.status);
        return rows;
      },
    };
  }

  if (entityName === 'ActionTaskReview') {
    return {
      ...local,
      async list() {
        return [];
      },
      async filter(query = {}) {
        if (!query.action_task_id) return [];
        let rows = await clarity.listActionTaskReviews(query.action_task_id);
        rows = rows.map(mapActionTaskReviewFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((r) => r.tenant_id === query.tenant_id);
        return rows;
      },
    };
  }

  if (entityName === 'AssessmentReportVersion') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listReports({});
        return rows.map(mapAssessmentReportVersionFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        // tenant_id sozinho (sem assessment_id) é uma consulta válida —
        // "todos os relatórios do tenant" (Central de Relatórios global).
        let rows = await clarity.listReports({ assessmentId: query.assessment_id, reportType: query.report_type });
        rows = rows.map(mapAssessmentReportVersionFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((r) => r.tenant_id === query.tenant_id);
        if (query.status) rows = rows.filter((r) => r.status === query.status);
        return rows;
      },
      async get(id) {
        const row = mapAssessmentReportVersionFromApi(await clarity.getReport(id));
        if (!row) {
          const error = new Error('AssessmentReportVersion not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
    };
  }

  if (entityName === 'FalContentSuggestion') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listFalContentSuggestions();
        return rows.map(mapFalContentSuggestionFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await clarity.listFalContentSuggestions(query.content_type);
        rows = rows.map(mapFalContentSuggestionFromApi).filter(Boolean);
        if (query.status) rows = rows.filter((s) => s.status === query.status);
        if (query.cluster_key) rows = rows.filter((s) => s.cluster_key === query.cluster_key);
        if (query.trigger) rows = rows.filter((s) => s.trigger === query.trigger);
        return rows;
      },
    };
  }

  return local;
}

/**
 * Client Base44 offline — sem rede, sem redirect, dados só em memória.
 */
export function createLocalBase44Client() {
  hydrateStoreFromLocalStorage();
  seedLocalDemoData();
  persistStore();

  const hierarchyEntities = new Set([
    'Tenant',
    'Group',
    'Company',
    'OperationalUnit',
  ]);

  const financialEntities = new Set([
    'FinancialDiagnosis',
    'FinancialAccountPlan',
    'FinancialAccountPlanLine',
    'FinancialUpload',
    'FinancialStatementLine',
    'FinancialIndicatorSnapshot',
    'FinancialDfcCompositionLine',
    'FinancialMappingResolution',
    'FinancialDfcClassificationOverride',
    'FinancialDfcManualAdjustment',
    'FinancialProcessingRun',
    'FinancialFinding',
    'FinancialRecommendation',
    'FinancialActionProposal',
  ]);

  const falEntities = new Set([
    'Assessment',
    'FalQuestion',
    'FalResponse',
    'MQEQuestion',
    'MQEResponse',
    'FalContentSuggestion',
    'MethodVersion',
    'FalDiagnosticSnapshot',
    'FalAggregateSnapshot',
    'SystemicCrossingAnalysis',
    'SystemicDimensionImpact',
    'ActionPlan',
    'ActionTask',
    'ActionRecommendation',
    'ActionPlanReview',
    'ActionTaskReview',
    'AssessmentReportVersion',
  ]);

  const entities = new Proxy(
    {},
    {
      get(_target, entityName) {
        if (typeof entityName !== 'string' || entityName === 'then') return undefined;
        if (
          CLARITY_FEATURES.useClarityHierarchy &&
          hierarchyEntities.has(entityName)
        ) {
          return createClarityHierarchyEntity(entityName);
        }
        if (
          CLARITY_FEATURES.useClarityFinancial &&
          financialEntities.has(entityName)
        ) {
          return createClarityFinancialEntity(entityName);
        }
        if (
          CLARITY_FEATURES.useClarityFal &&
          falEntities.has(entityName)
        ) {
          return createClarityFalEntity(entityName);
        }
        return createEntityApi(entityName);
      },
    }
  );

  return {
    entities,
    auth: {
      async me() {
        if (CLARITY_FEATURES.useClarityAuth) {
          const { mapClarityUserToAppUser } = await import('./clarityMappers.js');
          return mapClarityUserToAppUser(await clarity.me());
        }
        return getLocalTestSession() || createLocalTestUser();
      },
      async isAuthenticated() {
        if (CLARITY_FEATURES.useClarityAuth) {
          return !!localStorage.getItem('clarity.accessToken');
        }
        return !!getLocalTestSession();
      },
      setToken() {},
      redirectToLogin() {},
      logout() {
        if (CLARITY_FEATURES.useClarityAuth) {
          clarity.logout().catch(() => {});
        }
        clearLocalTestSession();
      },
      loginWithProvider() {},
      async loginViaEmailPassword() {
        throw new Error('Use o login local da tela de desenvolvimento');
      },
      async updateMe(data = {}) {
        const current = getLocalTestSession() || createLocalTestUser();
        const next = { ...current, ...data };
        // Persistência fica a cargo do AuthContext/session local.
        return next;
      },
    },
    functions: {
      async invoke(name, payload = {}) {
        console.info(`[local-base44] function: ${name}`, payload);

        if (name === 'deleteAccountPlanLines') {
          const planId = payload.account_plan_id;
          const tenantId = payload.tenant_id;
          if (!planId || !tenantId) {
            throw new Error('account_plan_id e tenant_id são obrigatórios');
          }
          if (CLARITY_FEATURES.useClarityFinancial) {
            const result = await clarity.deleteAllFinancialAccountPlanLines(planId);
            const deleted = result?.deleted ?? 0;
            return {
              data: { success: true, deleted, failed: 0, total: deleted, message: `${deleted} linhas deletadas` },
              deleted,
              failed: 0,
              total: deleted,
            };
          }
          const linesApi = createEntityApi('FinancialAccountPlanLine');
          let lines = await linesApi.filter(
            { account_plan_id: planId, tenant_id: tenantId },
            'account_code',
            20000,
          );
          if (lines.length === 0) {
            lines = await linesApi.filter(
              { account_plan_id: planId },
              'account_code',
              20000,
            );
          }
          const ids = lines.map((l) => l.id);
          await linesApi.deleteMany(ids);
          return {
            data: {
              success: true,
              deleted: ids.length,
              failed: 0,
              total: ids.length,
              message: `${ids.length} linhas deletadas`,
            },
            deleted: ids.length,
            failed: 0,
            total: ids.length,
          };
        }

        if (name === 'deleteAccountPlan') {
          const planId = payload.account_plan_id;
          const tenantId = payload.tenant_id;
          if (!planId) throw new Error('account_plan_id é obrigatório');

          if (CLARITY_FEATURES.useClarityFinancial) {
            const result = await clarity.deleteAllFinancialAccountPlanLines(planId);
            await clarity.deleteFinancialAccountPlan(planId);
            const deletedLines = result?.deleted ?? 0;
            return {
              data: { success: true, deleted_lines: deletedLines, deleted_plan: true },
              deleted_lines: deletedLines,
            };
          }

          const plansApi = createEntityApi('FinancialAccountPlan');
          const plan = await plansApi.get(planId);
          const canonicalTenantId = plan.tenant_id || tenantId;

          const linesApi = createEntityApi('FinancialAccountPlanLine');
          const lines = await linesApi.filter(
            { account_plan_id: planId, tenant_id: canonicalTenantId },
            'account_code',
            20000,
          );
          await linesApi.deleteMany(lines.map((l) => l.id));
          await plansApi.delete(planId);

          return {
            data: {
              success: true,
              deleted_lines: lines.length,
              deleted_plan: true,
            },
            deleted_lines: lines.length,
          };
        }

        if (name === 'getFinancialJourneyState' && CLARITY_FEATURES.useClarityFinancial) {
          const data = await clarity.getFinancialJourneyState(payload.financial_diagnosis_id);
          return { data };
        }

        if (name === 'updateFinancialJourneyPosition' && CLARITY_FEATURES.useClarityFinancial) {
          const data = await clarity.updateFinancialJourneyPosition({
            financialDiagnosisId: payload.financial_diagnosis_id,
            step: payload.step,
          });
          return { data };
        }

        if (name === 'validateFinancialUpload' && CLARITY_FEATURES.useClarityFinancial) {
          const data = await clarity.validateFinancialUpload({
            uploadId: payload.upload_id,
            diagnosisId: payload.diagnosis_id,
          });
          return { data };
        }

        if (name === 'buildFinancialStatements' && CLARITY_FEATURES.useClarityFinancial) {
          // Só o ramo "parse do upload" (analysisType='individual') está
          // portado — prepared_run_id (multi-entidade) e dfc_only (rebuild
          // de DFC sem reprocessar Excel) ainda caem no stub genérico abaixo.
          if (payload.prepared_run_id || payload.dfc_only) {
            console.info(`[local-base44] buildFinancialStatements: ramo ainda não portado (prepared_run_id/dfc_only)`, payload);
            return {
              data: {
                success: false,
                local: true,
                error: 'Este tipo de processamento (multi-entidade ou reprocessamento só de DFC) ainda não está disponível neste ambiente.',
              },
            };
          }
          const data = await clarity.buildFinancialStatements({
            uploadId: payload.upload_id,
            diagnosisId: payload.diagnosis_id,
            periodOverride: payload.period_override ?? null,
          });
          return { data };
        }

        if (name === 'resolveCurrentFinancialOutputScope' && CLARITY_FEATURES.useClarityFinancial) {
          const data = await clarity.resolveCurrentFinancialOutputScope(payload.diagnosis_id);
          return { data };
        }

        if (name === 'manageDfcManualAdjustment' && CLARITY_FEATURES.useClarityFinancial) {
          // Porta de manageDfcManualAdjustment/entry.ts (Base44): CRUD do
          // ajuste + recálculo automático da DFC (dfc_only) em seguida.
          // Antes disso caía no stub genérico (linha ~965 abaixo) que
          // devolvia { success: true } sem gravar nada — o ajuste "sumia"
          // silenciosamente.
          if (payload.action === 'create') {
            const data = await clarity.createFinancialDfcManualAdjustment({
              financialDiagnosisId: payload.financial_diagnosis_id,
              financialUploadId: payload.financial_upload_id ?? null,
              activity: payload.activity,
              label: payload.label,
              value: payload.value,
              period: payload.period,
              columnKey: payload.column_key ?? payload.period,
              adjustmentType: payload.adjustment_type ?? null,
              justification: payload.justification,
              notes: payload.notes ?? null,
            });
            return { data: { success: true, action: 'create', adjustment_id: data?.adjustment?.id, run_id: data?.run_id } };
          }
          if (payload.action === 'update') {
            const data = await clarity.updateFinancialDfcManualAdjustment(payload.adjustment_id, {
              financialDiagnosisId: payload.financial_diagnosis_id,
              activity: payload.activity,
              label: payload.label,
              value: payload.value,
              period: payload.period,
              columnKey: payload.column_key ?? payload.period,
              adjustmentType: payload.adjustment_type ?? null,
              justification: payload.justification,
              notes: payload.notes ?? null,
            });
            return { data: { success: true, action: 'update', adjustment_id: payload.adjustment_id, run_id: data?.run_id } };
          }
          if (payload.action === 'delete') {
            const data = await clarity.deleteFinancialDfcManualAdjustment(payload.adjustment_id, payload.financial_diagnosis_id);
            return { data: { success: true, action: 'delete', adjustment_id: payload.adjustment_id, run_id: data?.run_id } };
          }
          throw new Error(`manageDfcManualAdjustment: ação desconhecida "${payload.action}"`);
        }

        if (name === 'checkFinancialDiagnosisIntegrity' && CLARITY_FEATURES.useClarityFinancial) {
          const data = await clarity.checkFinancialDiagnosisIntegrity(payload.financial_diagnosis_id);
          return { data };
        }

        if (name === 'purgeFinancialUploadData' && CLARITY_FEATURES.useClarityFinancial) {
          const data = await clarity.purgeFinancialDiagnosis(payload.diagnosis_id, payload.confirm !== false);
          return { data };
        }

        if (name === 'purgeFinancialDerivedData' && CLARITY_FEATURES.useClarityFinancial) {
          const data = await clarity.purgeFinancialUploadDerived(payload.upload_id, payload.diagnosis_id);
          return { data };
        }

        if (name === 'deleteFinancialUploadSafe' && CLARITY_FEATURES.useClarityFinancial) {
          const data = await clarity.deleteFinancialUploadSafe(
            payload.financial_diagnosis_id,
            payload.financial_upload_id,
          );
          return { data };
        }

        // ── finalizeFinancialInsights / convertFinancialRecommendation ──
        // Achados/recomendações/propostas (FinancialFinding/Recommendation/
        // ActionProposal) agora são reais no Postgres
        // (backend/src/financial-report/) — porta de
        // generateFinancialInterpretations + generateFinancialRecommendations
        // do base44 original. finalizeFinancialInsights só encadeia as duas
        // chamadas reais, mesmo contrato que as telas já esperavam.
        if (name === 'finalizeFinancialInsights') {
          const diagId = payload.financial_diagnosis_id;
          const interp = await clarity.generateFinancialFindings(diagId, 'replace');
          const rec = await clarity.generateFinancialRecommendations(diagId, 'replace');
          return {
            data: {
              success: true,
              findings_created: interp.created,
              recommendations_created: rec.recommendations_created,
              action_proposals_created: rec.action_proposals_created,
            },
          };
        }

        if (name === 'convertFinancialRecommendation') {
          const result = await clarity.convertFinancialRecommendation({
            financialRecommendationId: payload.financial_recommendation_id,
            financialFindingId: payload.financial_finding_id,
            financialDiagnosisId: payload.financial_diagnosis_id,
            taskTitle: payload.task_title,
            description: payload.description,
            horizon: payload.horizon,
            ownerName: payload.owner_name,
            priority: payload.priority,
            indicatorCode: payload.indicator_code,
            indicatorLabel: payload.indicator_label,
          });
          return { data: { task: result.task, plan_id: result.planId } };
        }

        // "Estornar o envio" — desfaz um convertFinancialRecommendation
        // anterior (ver unconvertToTask em financial-insight.service.ts):
        // cancela a tarefa (nunca deleta) e devolve o achado/recomendação
        // de origem pro estado "não enviado".
        if (name === 'unconvertFinancialActionTask') {
          const result = await clarity.unconvertFinancialActionTask({
            actionTaskId: payload.action_task_id,
            financialDiagnosisId: payload.financial_diagnosis_id,
          });
          return { data: result };
        }

        // ── buildFalQuestionSet ──
        // ── Marco 2: motor de scoring — telas chamam essas funções ora com
        // try/catch (thrown error é tratado), ora checando `res.data?.error`
        // (espera um valor resolvido). Pra funcionar nos dois estilos sem
        // trocar nenhuma tela, essas 6 (mutação/cálculo) engolem erro HTTP e
        // devolvem { data: { error } } — mesma convenção que o mock local já
        // usa pra erros "esperados" (ex: question_set vazio).
        if (name === 'computeFalDiagnostic' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.computeFalDiagnostic(payload.assessment_id);
            return { data: mapFalDiagnosticSnapshotFromApi(data) };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'computeFalPriority' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.computeFalPriority(payload.assessment_id);
            return { data };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'computeClusterIntelligence' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.computeClusterIntelligence(payload.assessment_id, payload.benchmark_group);
            return { data };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'computeMfisAnalysis' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.computeMfisAnalysis(payload.assessment_id);
            return { data };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'computeGroupAggregate' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.computeGroupAggregate(payload.group_id);
            return { data };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'computeCompanyAggregate' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.computeCompanyAggregate(payload.company_id);
            return { data };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'getAssessmentFlow' && CLARITY_FEATURES.useClarityFal) {
          const data = await clarity.getAssessmentFlow(payload.assessment_id);
          return { data };
        }

        // ── Marco 3: Plano de Ação — mesma convenção de erro-como-dado das
        // funções de scoring acima (algumas telas usam try/catch, outras
        // checam res.data?.error — engolir e devolver {data:{error}} cobre
        // os dois estilos sem precisar tocar em nenhuma tela).
        if (name === 'generateActionPlan' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.generateActionPlan({
              assessmentId: payload.assessmentId, cycleId: payload.cycleId || undefined,
              maxTasks: payload.maxTasks, scoreThreshold: payload.scoreThreshold,
            });
            return {
              data: {
                ok: true,
                plan: mapActionPlanFromApi(data.plan),
                tasks: (data.tasks || []).map(mapActionTaskFromApi),
                roadmap: data.roadmap, generation_summary: data.generationSummary, dedup_stats: data.dedupStats,
              },
            };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'generateActionRecommendations' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.generateActionRecommendations({
              assessmentId: payload.assessment_id, actionPlanId: payload.action_plan_id,
              mode: payload.mode, scope: payload.scope,
            });
            return { data: { success: true, created_count: data.createdCount, skipped_count: data.skippedCount, weak_clusters_found: data.weakClustersFound, created_ids: data.createdIds } };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'manageActionRecommendation' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.manageActionRecommendation({
              action: payload.action, recommendationId: payload.recommendation_id,
              recommendationData: payload.recommendation_data, editData: payload.edit_data || payload.updates,
              clusterKey: payload.cluster_key, subdimensionKey: payload.subdimension_key,
              rejectedReason: payload.rejected_reason, planId: payload.plan_id, taskTitle: payload.task_title,
              description: payload.description, horizon: payload.horizon, ownerName: payload.owner_name,
              priority: payload.priority, evidenceRequired: payload.evidence_required, expectedResult: payload.expected_result,
            });
            return {
              data: {
                ...data,
                recommendation: data.recommendation ? mapActionRecommendationFromApi(data.recommendation) : undefined,
                task: data.task ? mapActionTaskFromApi(data.task) : undefined,
              },
            };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'createManualActionTask' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.createManualActionTask({ planId: payload.plan_id, task: payload.task });
            return { data: { task: mapActionTaskFromApi(data.task), plan: mapActionPlanFromApi(data.plan), operation_id: data.operationId } };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'updateActionTaskWithHistory' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.updateActionTaskWithHistory({
              taskId: payload.task_id, updates: payload.updates, comment: payload.comment,
              reviewId: payload.review_id, overrideJustification: payload.override_justification,
            });
            return { data: { task: mapActionTaskFromApi(data.task), plan: data.plan ? mapActionPlanFromApi(data.plan) : undefined, changed_fields: data.changedFields, operation_id: data.operationId, reused: data.reused } };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'createActionPlanReviewWithSnapshot' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.openActionPlanReview({
              actionPlanId: payload.action_plan_id, reviewDate: payload.review_date, visitType: payload.visit_type,
            });
            return { data: { review: mapActionPlanReviewFromApi(data.review), reused: data.reused } };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'completeActionPlanReview' && CLARITY_FEATURES.useClarityFal) {
          try {
            const rd = payload.review_data || {};
            const data = await clarity.completeActionPlanReview({
              reviewId: payload.review_id,
              executiveSummary: payload.executive_summary ?? rd.executive_summary,
              decisions: payload.decisions ?? rd.decisions,
              nextReviewDate: payload.next_review_date ?? rd.next_review_date,
            });
            return { data: { review: mapActionPlanReviewFromApi(data.review), plan: mapActionPlanFromApi(data.plan) } };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'cancelActionPlanReview' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.cancelActionPlanReview({
              reviewId: payload.review_id, reason: payload.reason, confirmLiveChanges: payload.confirm_live_changes,
            });
            return { data: { review: mapActionPlanReviewFromApi(data.review) } };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }

        // ── Marco 5: Relatórios ──
        if (name === 'generateAssessmentReportVersion' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.generateReportVersion({
              assessmentId: payload.assessment_id, reportType: payload.report_type, reportTitle: payload.report_title,
              presetId: payload.preset_id, reportParameters: payload.report_parameters,
              actionPlanReviewId: payload.action_plan_review_id,
            });
            return {
              data: {
                report_version_id: data.reportVersionId, report_code: data.reportCode,
                report_version_number: data.reportVersionNumber, status: data.status, reused: data.reused,
                payload_summary: data.payloadSummary && {
                  has_diagnostic: data.payloadSummary.hasDiagnostic, has_action_plan: data.payloadSummary.hasActionPlan,
                  task_count: data.payloadSummary.taskCount, review_count: data.payloadSummary.reviewCount,
                  plan_kpis: data.payloadSummary.planKpis,
                },
              },
            };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'getReportVersionSnapshot' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.getReportSnapshot(payload.report_version_id);
            return {
              data: {
                payload_snapshot: data.payloadSnapshot,
                report_metadata: {
                  id: data.reportMetadata.id, report_code: data.reportMetadata.reportCode, report_title: data.reportMetadata.reportTitle,
                  report_type: data.reportMetadata.reportType, report_version_number: data.reportMetadata.reportVersionNumber,
                  generated_at: data.reportMetadata.generatedAt, generated_by: data.reportMetadata.generatedBy,
                  mark_as_official: data.reportMetadata.markAsOfficial, status: data.reportMetadata.status,
                  payload_checksum: data.reportMetadata.payloadChecksum, pdf_status: data.reportMetadata.pdfStatus,
                  pdf_file_url: data.reportMetadata.pdfFileUrl,
                },
              },
            };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'generatePdfFromReportVersion' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.getReportRenderPayload(payload.report_version_id);
            return { data: { report_version_id: data.reportVersionId, report_code: data.reportCode, payload: data.payload, preview_url: data.previewUrl, assessment_id: data.assessmentId } };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'setOfficialAssessmentReportVersion' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.setOfficialReportVersion(payload.report_version_id);
            return { data: { report_version: mapAssessmentReportVersionFromApi(data) } };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'archiveReportVersion' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.archiveReportVersion({
              reportVersionId: payload.report_version_id, replacementReportVersionId: payload.replacement_report_version_id,
              reason: payload.reason,
            });
            return { data: { report_version: mapAssessmentReportVersionFromApi(data) } };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'beginReportPdfArtifact' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.beginReportPdf({ reportVersionId: payload.report_version_id });
            return { data: { reused: data.reused, operation_id: data.operationId, report_version: mapAssessmentReportVersionFromApi(data.reportVersion) } };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }
        if (name === 'commitReportPdfArtifact' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.commitReportPdf({
              reportVersionId: payload.report_version_id, pdfStatus: payload.pdf_status, pdfError: payload.pdf_error,
              pdfOperationId: payload.pdf_operation_id, pdfFileUrl: payload.pdf_file_url, pdfUploadIdentifier: payload.pdf_upload_identifier,
              pdfPageCount: payload.pdf_page_count, pdfFileSize: payload.pdf_file_size, pdfChecksum: payload.pdf_checksum,
              payloadChecksum: payload.payload_checksum,
            });
            return { data: { report_version: mapAssessmentReportVersionFromApi(data) } };
          } catch (e) {
            return { data: { error: e.message } };
          }
        }

        // ── Marco 6: publicação, escopos multi-entidade, substituição de pergunta ──
        if (name === 'publishFalAssessment' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.publishFalAssessment(payload.assessmentId, payload.cycleId);
            return {
              data: {
                success: data.ok, cycle_id: data.cycleId, coverage: data.coverage,
                snapshot: data.snapshotPublished,
              },
            };
          } catch (e) {
            return { data: { error: e.message, ...(e.body || {}) } };
          }
        }
        if (name === 'generateAssessmentScopes' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.generateAssessmentScopes(payload.assessment_id);
            return { data };
          } catch (e) {
            return { data: { error: e.message, ...(e.body || {}) } };
          }
        }
        if (name === 'swapFalQuestion' && CLARITY_FEATURES.useClarityFal) {
          try {
            const data = await clarity.swapFalQuestion(payload.assessment_id, {
              originalQuestionId: payload.original_question_id,
              swapReason: payload.swap_reason,
              swapReasonLabel: payload.swap_reason_label,
            });
            return { data };
          } catch (e) {
            return { data: { error: e.message, ...(e.body || {}) } };
          }
        }

        // Porta simplificada do motor real (base44/functions/buildFalQuestionSet):
        // filtra por dimensão ativa/nível/profundidade e faz cobertura balanceada
        // por subdimensão (CORE_PER_SUBDIM). NÃO replica o passo de reforço por
        // dimensão fraca a partir de respostas existentes — isso fica pro roadmap
        // de IA (gerador de perguntas) combinado com a Fase 2 do motor financeiro.
        if (name === 'buildFalQuestionSet' && CLARITY_FEATURES.useClarityFal) {
          const data = await clarity.buildAssessmentQuestionSet(payload.assessment_id);
          return { data };
        }
        if (name === 'buildFalQuestionSet') {
          const assessmentId = payload.assessment_id;
          const assessment = await entities.Assessment.get(assessmentId).catch(() => null);
          if (!assessment) return { data: { error: 'Assessment não encontrado' } };

          const ALL_DIMS_PT = ['governanca', 'juridico', 'controles_internos', 'financeiro', 'contabil', 'tributario', 'operacional', 'sistemas'];
          const activeDimensions = assessment.active_dimensions?.length > 0 ? assessment.active_dimensions : ALL_DIMS_PT;
          const depth = assessment.diagnostic_depth || 'rapid';
          const targetType = assessment.target_type || 'company';
          const DEPTH_CONFIG = {
            rapid: { CORE_PER_SUBDIM: 2 },
            standard: { CORE_PER_SUBDIM: 3 },
            deep: { CORE_PER_SUBDIM: 5 },
          };
          const corePerSubdim = (DEPTH_CONFIG[depth] || DEPTH_CONFIG.rapid).CORE_PER_SUBDIM;

          const depthMatch = (qDepths) => {
            if (!qDepths || qDepths.length === 0) return true;
            if (depth === 'rapid') return qDepths.includes('rapid');
            if (depth === 'standard') return qDepths.includes('rapid') || qDepths.includes('standard');
            return true; // deep: aceita tudo
          };
          const levelMatch = (levels) => {
            if (!levels || levels.length === 0) return true;
            if (targetType === 'group') return levels.includes('group') || levels.includes('company');
            return levels.includes(targetType);
          };

          const allQuestions = await entities.FalQuestion.filter({}, 'sequence_order', 2000);
          const eligible = allQuestions.filter((q) =>
            activeDimensions.includes(q.dimension_key) && levelMatch(q.level_applicability) && depthMatch(q.diagnostic_depth)
          );

          const bySubdim = new Map();
          for (const q of eligible) {
            const key = q.subdimension_key || q.dimension_key;
            if (!bySubdim.has(key)) bySubdim.set(key, []);
            bySubdim.get(key).push(q);
          }

          const finalSet = [];
          const summary = {};
          for (const [, qs] of bySubdim) {
            qs.sort((a, b) => (b.question_weight || 1) - (a.question_weight || 1));
            for (const q of qs.slice(0, corePerSubdim)) {
              finalSet.push(q.id);
              summary[q.dimension_key] = (summary[q.dimension_key] || 0) + 1;
            }
          }

          if (finalSet.length === 0) {
            return {
              data: {
                error: 'Banco de perguntas FAL vazio ou incompatível com o perfil deste assessment.',
                active_dimensions_used: activeDimensions,
                total_eligible: eligible.length,
              },
            };
          }

          await entities.Assessment.update(assessmentId, { question_set: finalSet });

          try {
            await localTriggerGapDetectedSuggestions(entities, { eligible, activeDimensions, corePerSubdim, requestedBy: 'local-dev' });
          } catch (gapErr) {
            console.warn('[local-base44] gap detection falhou (não bloqueante):', gapErr.message);
          }

          return { data: { success: true, total: finalSet.length, by_dimension: summary, active_dimensions_used: activeDimensions, depth } };
        }

        // ── generateFalContentSuggestions ──
        // Sem InvokeLLM disponível neste ambiente local (não há integração
        // de LLM configurada fora do base44 real) — gera rascunhos por
        // template simples, só para permitir testar o fluxo de revisão
        // (fila pendente → editar/aprovar/rejeitar) ponta a ponta aqui.
        // model_used fica marcado como 'local-fallback-template' para não
        // ser confundido com uma sugestão real de IA.
        if (name === 'generateFalContentSuggestions' && CLARITY_FEATURES.useClarityFal) {
          const data = await clarity.generateFalContentSuggestion({
            clusterKey: payload.cluster_key,
            contentType: payload.content_type,
            count: payload.count,
            triggerScore: payload.trigger_score,
            requestedBy: payload.requested_by,
          });
          return {
            data: {
              success: data.success,
              created_count: data.createdCount,
              suggestions: (data.suggestions || []).map(mapFalContentSuggestionFromApi),
            },
          };
        }
        if (name === 'generateFalContentSuggestions') {
          const { cluster_key, requested_by } = payload;
          const contentType = payload.content_type === 'recommendation' ? 'recommendation' : 'question';
          const count = Math.min(Number(payload.count) || 3, 8);
          if (!cluster_key) return { data: { error: 'cluster_key é obrigatório' } };

          const existing = await entities.FalQuestion.filter({ cluster_key }, 'sequence_order', 200);
          if (existing.length === 0) {
            return { data: { error: `Nenhuma pergunta existente encontrada para cluster_key="${cluster_key}".` } };
          }
          const { dimension_key, subdimension_key } = existing[0];

          if (contentType === 'recommendation') {
            const score = Number(payload.trigger_score);
            if (![0, 1, 2, 3].includes(score)) {
              return { data: { error: 'trigger_score é obrigatório e deve ser 0, 1, 2 ou 3 para content_type="recommendation".' } };
            }
            const [current] = await entities.FalRecommendationLibrary.filter({ cluster_key, trigger_score: score }, 'id', 5);
            const clusterLabel = cluster_key.replace(/_cluster$/, '').replace(/_/g, ' ');
            const RATING_TEXT = {
              0: { verb: 'Estruturar', tone: 'apresentou maturidade crítica' },
              1: { verb: 'Corrigir fragilidades em', tone: 'indica existência parcial da rotina, com falhas relevantes' },
              2: { verb: 'Aprimorar', tone: 'possui funcionamento razoável, mas pode evoluir' },
              3: { verb: 'Manter monitoramento de', tone: 'apresenta maturidade satisfatória' },
            }[score];
            const gapByScore = { 0: 0, 1: 1, 2: 2, 3: null };
            const typeByScore = { 0: 'structural', 1: 'corrective', 2: 'improvement', 3: 'monitoring' };
            const timeframeByScore = { 0: '180d', 1: '90d', 2: '60d', 3: '180d' };
            const draft_payload = {
              recommendation_key: current?.recommendation_key || `fal_rec_${cluster_key}_r${score}_ia`,
              source: 'global_library',
              source_type: 'cluster_rating',
              dimension_key,
              subdimension_key,
              cluster_key,
              question_id: null,
              trigger_score: score,
              gap_level: gapByScore[score],
              is_actionable: score !== 3,
              recommendation_type: typeByScore[score],
              recommendation_title: `${RATING_TEXT.verb} ${clusterLabel} (rascunho local)`,
              recommendation_description: `O cluster "${clusterLabel}" ${RATING_TEXT.tone}. [Rascunho local sem LLM real — revisar e detalhar antes de aprovar.]`,
              implementation_steps: ['Revisar este texto (gerado por fallback local, não IA real)', 'Detalhar passos específicos do processo', 'Definir responsável e prazo'],
              evidence_required: 'A definir na revisão.',
              success_indicators: 'A definir na revisão.',
              routine_template: `Checklist periódico para ${clusterLabel}.`,
              effort_level: 3,
              impact_level: score === 0 ? 5 : score === 1 ? 4 : score === 2 ? 3 : 2,
              priority_weight: score === 0 ? 90 : score === 1 ? 75 : score === 2 ? 50 : 20,
              typical_owner: current?.typical_owner || '',
              estimated_timeframe: timeframeByScore[score],
              cluster_question_count: existing.length,
              tenant_id: 'global',
              version: current ? `${(parseFloat(current.version) || 1) + 0.1}` : '1.0',
              notes: 'Gerado via copiloto de IA (fallback local) — revisar antes de publicar.',
              is_active: true,
            };
            const suggestion = await entities.FalContentSuggestion.create({
              tenant_id: null,
              content_type: 'recommendation',
              dimension_key,
              subdimension_key,
              cluster_key,
              trigger: 'manual',
              requested_by: requested_by || 'local-dev',
              model_used: 'local-fallback-template',
              prompt_context_summary: current ? `Substitui recomendação atual "${current.recommendation_title}" (fallback local).` : 'Nova recomendação (fallback local).',
              draft_payload,
              status: 'pending',
            });
            return { data: { success: true, created_count: 1, suggestions: [{ ...suggestion, rationale: 'Rascunho local (sem LLM real) — texto genérico proposital, detalhar na revisão.' }] } };
          }

          const created = await localGenerateQuestionSuggestions(entities, {
            cluster_key, dimension_key, subdimension_key, existing, count,
            requested_by: requested_by || 'local-dev', trigger: 'manual',
          });
          return { data: { success: true, created_count: created.length, suggestions: created } };
        }

        // ── reviewFalContentSuggestion ──
        if (name === 'reviewFalContentSuggestion' && CLARITY_FEATURES.useClarityFal) {
          const data = await clarity.reviewFalContentSuggestion(payload.suggestion_id, {
            action: payload.action,
            editedPayload: payload.edited_payload,
            comment: payload.comment,
          });
          return {
            data: {
              success: data.success,
              status: data.status,
              published_entity_id: data.publishedEntityId ?? null,
            },
          };
        }
        if (name === 'reviewFalContentSuggestion') {
          const { suggestion_id, action, edited_payload, comment } = payload;
          if (!suggestion_id || !['approve', 'reject'].includes(action)) {
            return { data: { error: 'suggestion_id e action ("approve"|"reject") são obrigatórios' } };
          }
          const suggestion = await entities.FalContentSuggestion.get(suggestion_id).catch(() => null);
          if (!suggestion) return { data: { error: 'Sugestão não encontrada' } };
          if (suggestion.status !== 'pending') {
            return { data: { error: `Sugestão já revisada (status atual: ${suggestion.status})` } };
          }

          if (action === 'reject') {
            await entities.FalContentSuggestion.update(suggestion_id, {
              status: 'rejected',
              reviewed_by: 'local-dev',
              reviewed_at: new Date().toISOString(),
              review_comment: comment || '',
            });
            return { data: { success: true, status: 'rejected' } };
          }

          const finalPayload = { ...suggestion.draft_payload, ...(edited_payload || {}) };
          const wasEdited = !!edited_payload && Object.keys(edited_payload).length > 0;
          let publishedId = null;
          if (suggestion.content_type === 'question') {
            const createdQ = await entities.FalQuestion.create(finalPayload);
            publishedId = createdQ.id;
          } else if (suggestion.content_type === 'recommendation') {
            const [existingRec] = await entities.FalRecommendationLibrary.filter({ recommendation_key: finalPayload.recommendation_key }, 'id', 1);
            if (existingRec) {
              await entities.FalRecommendationLibrary.update(existingRec.id, finalPayload);
              publishedId = existingRec.id;
            } else {
              const createdRec = await entities.FalRecommendationLibrary.create(finalPayload);
              publishedId = createdRec.id;
            }
          } else {
            return { data: { error: `Publicação para content_type="${suggestion.content_type}" ainda não implementada` } };
          }
          await entities.FalContentSuggestion.update(suggestion_id, {
            status: wasEdited ? 'edited_approved' : 'approved',
            reviewed_by: 'local-dev',
            reviewed_at: new Date().toISOString(),
            review_comment: comment || '',
            published_entity_id: publishedId,
          });
          return { data: { success: true, status: wasEdited ? 'edited_approved' : 'approved', published_entity_id: publishedId } };
        }

        // ── getFalResponses ──
        // Sem isso, o questionário FAL nunca via as respostas que ele mesmo
        // acabava de salvar (a tela recarrega via essa função pra pré-popular
        // respostas e recalcular o progresso) — respostas eram gravadas em
        // FalResponse normalmente, só não voltavam pra UI.
        if (name === 'getFalResponses' && CLARITY_FEATURES.useClarityFal) {
          const rows = await clarity.listFalResponses(payload.assessment_id, payload.dimension_key);
          return { data: { responses: rows.map(mapFalResponseFromApi) } };
        }
        if (name === 'getFalResponses') {
          const { assessment_id, dimension_key } = payload;
          if (!assessment_id) return { data: { error: 'assessment_id é obrigatório' } };
          const filter = { assessment_id };
          if (dimension_key) filter.dimension_key = dimension_key;
          const responses = await entities.FalResponse.filter(filter, 'dimension_key', 500);
          return { data: { responses } };
        }

        console.info(`[local-base44] function stub (sem implementação): ${name}`);
        return {
          data: {
            success: true,
            local: true,
            function: name,
            message: 'Base44 desconectado — função local stub',
          },
        };
      },
    },
    integrations: new Proxy(
      {},
      {
        get(_target, namespace) {
          return new Proxy(
            {},
            {
              get(_t, method) {
                // Core.UploadFile: quando o Fase 1 financeiro está ligado,
                // sobe o arquivo de verdade pro MinIO (mesmo passo que a
                // Base44 fazia antes do FinancialUpload.create).
                // Core.UploadFile é um único ponto de entrada compartilhado
                // por vários domínios (upload financeiro, PDF de relatório).
                // Sem sinal explícito de domínio no payload ({file} só),
                // desambiguamos pelo mimetype: PDF é sempre relatório,
                // nunca planilha financeira.
                if (namespace === 'Core' && method === 'UploadFile') {
                  if (CLARITY_FEATURES.useClarityFal) {
                    return async ({ file } = {}) => {
                      if (file?.type === 'application/pdf') {
                        const res = await clarity.uploadReportPdf(file);
                        return { file_url: res.fileUrl, url: res.fileUrl };
                      }
                      if (CLARITY_FEATURES.useClarityFinancial) return clarity.uploadFinancialFile(file);
                      return { local: true };
                    };
                  }
                  if (CLARITY_FEATURES.useClarityFinancial) {
                    return async ({ file } = {}) => clarity.uploadFinancialFile(file);
                  }
                }
                return async () => ({ local: true });
              },
            }
          );
        },
      }
    ),
    appLogs: {
      async logUserInApp() {},
      async fetchLogs() {
        return [];
      },
      async getStats() {
        return {};
      },
    },
    users: {
      async inviteUser() {
        return { success: true, local: true };
      },
    },
    agents: {
      async getConversations() {
        return [];
      },
      async listConversations() {
        return [];
      },
    },
    analytics: {
      track() {},
      cleanup() {},
    },
    setToken() {},
    getConfig() {
      return { serverUrl: 'local://offline', appId: 'local-test-app', requiresAuth: false };
    },
    cleanup() {
      store.clear();
    },
  };
}

function seedEntity(entity, records) {
  const collection = getCollection(entity);
  for (const record of records) {
    collection.set(record.id, {
      ...record,
      created_date: record.created_date || new Date().toISOString(),
      updated_date: record.updated_date || new Date().toISOString(),
    });
  }
}

function seedLocalDemoData() {
  if (getCollection('Tenant').size > 0) return;

  const methodVersionId = 'local-method-v1';
  const tenantId = 'local-tenant-demo';

  seedEntity('MethodVersion', [
    {
      id: methodVersionId,
      name: 'Método FAL Local v1',
      version: '1.0.0-local',
      status: 'active',
      description: 'Versão seed para desenvolvimento offline',
    },
  ]);

  seedEntity('Tenant', [
    {
      id: tenantId,
      name: 'Tenant Demo Local',
      slug: 'demo-local',
      active: true,
      active_method_version_id: methodVersionId,
      logo_url: '',
    },
    {
      id: 'local-tenant-agro',
      name: 'Agro Consultoria Demo',
      slug: 'agro-demo',
      active: true,
      active_method_version_id: methodVersionId,
      logo_url: '',
    },
  ]);

  seedEntity('Group', [
    {
      id: 'local-group-1',
      name: 'Grupo Demo FAL',
      tenant_id: tenantId,
      status: 'active',
    },
  ]);

  seedEntity('Company', [
    {
      id: 'local-company-1',
      name: 'Fazenda Demo Ltda',
      tenant_id: tenantId,
      group_id: 'local-group-1',
      status: 'active',
    },
  ]);

  seedFalLibraries();
}

/**
 * Banco de perguntas e bibliotecas do Motor FAL — dados reais fornecidos
 * pelo usuário (export do base44), convertidos para JSON e semeados aqui
 * só para permitir testar o questionário/8D neste ambiente local, sem
 * conexão com o base44 real. tenant_id: 'global' nas recomendações porque
 * é isso que generateActionPlan realmente consulta (ver nota separada:
 * o importador real grava tenant_id: null para import global, o que NUNCA
 * bate com essa query — bug real, fora do escopo deste seed).
 */
function seedFalLibraries() {
  seedEntity('FalQuestion', falQuestionsSeed.map((q) => ({ ...q, id: makeId('FalQuestion'), tenant_id: null })));
  seedEntity('FalRecommendationLibrary', falRecommendationLibrarySeed.map((r) => ({ ...r, id: makeId('FalRecommendationLibrary'), tenant_id: 'global' })));
  seedEntity('FalClusterCause', falClusterCauseSeed.map((c) => ({ ...c, id: makeId('FalClusterCause') })));
  seedEntity('FalClusterRecommendation', falClusterRecommendationSeed.map((r) => ({ ...r, id: makeId('FalClusterRecommendation') })));
  seedEntity('FalActionLibrary', falActionLibrarySeed.map((a) => ({ ...a, id: makeId('FalActionLibrary') })));
  seedEntity('FalQuestionActionLibrary', falQuestionActionLibrarySeed.map((a) => ({ ...a, id: makeId('FalQuestionActionLibrary') })));
  seedEntity('FalBenchmark', falBenchmarkSeed.map((b) => ({ ...b, id: makeId('FalBenchmark') })));
}

/**
 * Gera N sugestões de pergunta (fallback local por template) para um
 * cluster. Compartilhada entre o gatilho manual (generateFalContentSuggestions)
 * e o gatilho automático por lacuna (buildFalQuestionSet → gap_detected).
 */
async function localGenerateQuestionSuggestions(entities, { cluster_key, dimension_key, subdimension_key, existing, count, requested_by, trigger }) {
  const maxSeq = Math.max(0, ...existing.map((q) => q.sequence_order || 0));
  const coveredStages = new Set(existing.map((q) => q.process_stage));
  const STAGES = ['existence', 'request', 'analysis', 'approval', 'execution', 'record', 'control', 'monitoring', 'audit'];
  const uncoveredStages = STAGES.filter((s) => !coveredStages.has(s));
  const clusterLabel = cluster_key.replace(/_cluster$/, '').replace(/_/g, ' ');

  const TEMPLATE_BY_STAGE = {
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

  const created = [];
  for (let i = 0; i < count; i++) {
    const stage = uncoveredStages[i] || STAGES[(existing.length + i) % STAGES.length];
    const draft_payload = {
      question_id: `${cluster_key.replace(/_cluster$/, '')}_ia_${Date.now()}_${i}`,
      dimension_key,
      subdimension_key,
      cluster_key,
      process_stage: stage,
      sequence_order: maxSeq + i + 1,
      diagnostic_depth: ['standard', 'deep'],
      level_applicability: ['group', 'company', 'unit'],
      question_weight: 1,
      question_text: TEMPLATE_BY_STAGE[stage](clusterLabel),
      guidance: '',
      evidence_hint: '',
    };
    const suggestion = await entities.FalContentSuggestion.create({
      tenant_id: null,
      content_type: 'question',
      dimension_key,
      subdimension_key,
      cluster_key,
      trigger,
      requested_by,
      model_used: 'local-fallback-template',
      prompt_context_summary: `${existing.length} pergunta(s) existente(s) consideradas (fallback local, sem LLM real).`,
      draft_payload,
      status: 'pending',
    });
    created.push({ ...suggestion, rationale: `Estágio "${stage}" ainda não coberto pelas perguntas existentes do cluster (rascunho local, revisar com atenção).` });
  }
  return created;
}

const GAP_MAX_CLUSTERS_PER_RUN = 3;

/**
 * Espelha triggerGapDetectedSuggestions do buildFalQuestionSet real: varre
 * clusters rasos (menos perguntas elegíveis que o alvo) e dispara geração
 * automática, sem duplicar se já houver sugestão gap_detected pendente.
 */
async function localTriggerGapDetectedSuggestions(entities, { eligible, activeDimensions, corePerSubdim, requestedBy }) {
  const byCluster = {};
  for (const q of eligible) {
    if (!activeDimensions.includes(q.dimension_key) || !q.cluster_key) continue;
    (byCluster[q.cluster_key] ||= []).push(q);
  }
  const gaps = Object.entries(byCluster)
    .filter(([, qs]) => qs.length < corePerSubdim)
    .sort((a, b) => a[1].length - b[1].length)
    .slice(0, GAP_MAX_CLUSTERS_PER_RUN);

  for (const [clusterKey, qs] of gaps) {
    const alreadyPending = await entities.FalContentSuggestion.filter({
      cluster_key: clusterKey, content_type: 'question', trigger: 'gap_detected', status: 'pending',
    }, 'id', 1);
    if (alreadyPending.length > 0) continue;

    const { dimension_key, subdimension_key } = qs[0];
    const needed = Math.min(Math.max(corePerSubdim - qs.length, 1), 5);
    await localGenerateQuestionSuggestions(entities, {
      cluster_key: clusterKey, dimension_key, subdimension_key, existing: qs, count: needed,
      requested_by: requestedBy, trigger: 'gap_detected',
    });
  }
}

