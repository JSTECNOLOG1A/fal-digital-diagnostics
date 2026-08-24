import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

// ── Tenant-scoped query key factories ──────────────────────────────────────────
export const tenantKey = (tenantId, ...parts) => [
  'tenant', tenantId || 'no-tenant', ...parts
];

export const financialKey = (tenantId, diagnosisId, ...parts) => [
  'tenant', tenantId || 'no-tenant',
  'financial', diagnosisId || 'no-diagnosis', ...parts
];

export const assessmentKey = (tenantId, assessmentId, ...parts) => [
  'tenant', tenantId || 'no-tenant',
  'assessment', assessmentId || 'no-assessment', ...parts
];

export const groupKey = (tenantId, groupId, ...parts) => [
  'tenant', tenantId || 'no-tenant',
  'group', groupId || 'no-group', ...parts
];

export const companyKey = (tenantId, companyId, ...parts) => [
  'tenant', tenantId || 'no-tenant',
  'company', companyId || 'no-company', ...parts
];

export const unitKey = (tenantId, unitId, ...parts) => [
  'tenant', tenantId || 'no-tenant',
  'unit', unitId || 'no-unit', ...parts
];

export const actionPlanKey = (tenantId, assessmentId, planId, ...parts) => [
  'tenant', tenantId || 'no-tenant',
  'actionplan', assessmentId || 'no-assessment', planId || 'no-plan', ...parts
];

export const reportKey = (tenantId, assessmentId, ...parts) => [
  'tenant', tenantId || 'no-tenant',
  'report', assessmentId || 'no-assessment', ...parts
];

export const clientPortalKey = (tenantId, clientId, ...parts) => [
  'tenant', tenantId || 'no-tenant',
  'portal', clientId || 'no-client', ...parts
];

/**
 * Invalida todos os queries relacionados a dados financeiros via wildcard predicate.
 * Cobre: fin-*, financial-*, composição, indicadores, achados, uploads, etc.
 */
export const invalidateFinancialQueries = async (queryClient, diagnosisId = null, tenantId = null) => {
  const promises = [
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        // Chaves tenant-scoped: ['tenant', tenantId, 'financial', ...]
        if (Array.isArray(key) && key[0] === 'tenant' && key[2] === 'financial') {
          return !tenantId || key[1] === tenantId;
        }
        // SEC-015: Legacy fallback — ONLY when tenantId is null (global admin context).
        // When tenantId is provided, do NOT touch legacy keys (prevents cross-tenant invalidation).
        if (tenantId) return false;
        const firstKey = Array.isArray(key) ? key[0] : key;
        return typeof firstKey === 'string' &&
               (firstKey.startsWith('fin-') || firstKey.startsWith('financial-'));
      }
    })
  ];

  if (diagnosisId) {
    // SEC-015: refetch usando as MESMAS factory keys das queries (tenant-scoped)
    if (tenantId) {
      promises.push(
        queryClient.refetchQueries({ queryKey: financialKey(tenantId, diagnosisId, 'meta') }),
        queryClient.refetchQueries({ queryKey: financialKey(tenantId, diagnosisId, 'uploads') }),
        queryClient.refetchQueries({ queryKey: financialKey(tenantId, diagnosisId, 'statements') }),
        queryClient.refetchQueries({ queryKey: financialKey(tenantId, diagnosisId, 'indicators') }),
        queryClient.refetchQueries({ queryKey: financialKey(tenantId, diagnosisId, 'validations') }),
      );
    }
    // SEC-015: Legacy refetch — ONLY when tenantId is null (global admin context).
    if (!tenantId) {
      promises.push(
        queryClient.refetchQueries({ queryKey: ['financial-diagnosis', diagnosisId] }),
        queryClient.refetchQueries({ queryKey: ['financial-uploads', diagnosisId] }),
        queryClient.refetchQueries({ queryKey: ['fin-statements-v2', diagnosisId] }),
        queryClient.refetchQueries({ queryKey: ['fin-indicators', diagnosisId] }),
      );
    }
  }

  await Promise.all(promises);
};

/**
 * Invalida todos os queries relacionados a planos de ação via wildcard predicate.
 * Cobre: action-plan, action-tasks, action-plan-reviews, recommendations, task-reviews.
 * Seguro para multi-tenant: invalida apenas queries do tenant especificado (quando tenantId fornecido)
 * ou todas (quando não fornecido — usado em contextos sem tenant scope como reviews globais).
 */
export const invalidateActionPlanQueries = async (queryClient, assessmentId = null, planId = null, tenantId = null) => {
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key)) return false;
      const firstKey = key[0];
      // Chaves tenant-scoped: ['tenant', tenantId, 'actionplan', ...]
      if (firstKey === 'tenant' && key[2] === 'actionplan') {
        if (tenantId && key[1] !== tenantId) return false;
        if (assessmentId && key[3] !== assessmentId) return false;
        if (planId && key[4] !== planId) return false;
        return true;
      }
      if (firstKey === 'tenant' && key[2] === 'assessment') {
        if (tenantId && key[1] !== tenantId) return false;
        return true; // invalida todas as queries assessment-scoped do tenant
      }
      // SEC-015: Legacy fallback — ONLY when tenantId is null (global admin context).
      if (tenantId) return false;
      const legacyPatterns = ['action-plan', 'action-tasks', 'action-plan-reviews', 'recommendations', 'task-reviews'];
      return typeof firstKey === 'string' && legacyPatterns.some(p => firstKey === p || firstKey.startsWith(p));
    }
  });
};

/**
 * Invalida todos os queries relacionados a assessments via wildcard predicate.
 * Cobre: fal-responses, fal-snapshots, scores, assessment-detail, assessment-flow.
 * Seguro para multi-tenant: invalida apenas queries do tenant especificado.
 */
export const invalidateAssessmentQueries = async (queryClient, assessmentId = null, tenantId = null) => {
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key)) return false;
      const firstKey = key[0];
      if (firstKey === 'tenant' && key[2] === 'assessment') {
        if (tenantId && key[1] !== tenantId) return false;
        if (assessmentId && key[3] !== assessmentId) return false;
        return true;
      }
      // SEC-015: Legacy fallback — ONLY when tenantId is null (global admin context).
      if (tenantId) return false;
      const legacyPatterns = ['fal-responses', 'fal-snap', 'assessment', 'assessments', 'agg-snapshot', 'journey-'];
      return typeof firstKey === 'string' && legacyPatterns.some(p => firstKey === p || firstKey.startsWith(p));
    }
  });
};

/**
 * Invalida todos os queries estruturais (groups, companies, units) via wildcard predicate.
 * Seguro para multi-tenant: invalida apenas queries do tenant especificado.
 */
export const invalidateStructureQueries = async (queryClient, tenantId = null, scope = null) => {
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key)) return false;
      const firstKey = key[0];
      if (firstKey === 'tenant') {
        if (tenantId && key[1] !== tenantId) return false;
        const family = key[2];
        if (scope === 'group' && family !== 'group') return false;
        if (scope === 'company' && family !== 'company') return false;
        if (scope === 'unit' && family !== 'unit') return false;
        return ['group', 'company', 'unit'].includes(family);
      }
      // SEC-015: Legacy fallback — ONLY when tenantId is null (global admin context).
      if (tenantId) return false;
      const legacyPatterns = ['groups', 'companies', 'units', 'group-', 'company-', 'unit-', 'groups-tree', 'companies-tree', 'units-tree'];
      return typeof firstKey === 'string' && legacyPatterns.some(p => firstKey === p || firstKey.startsWith(p));
    }
  });
};

/**
 * Invalida todos os queries relacionados a relatórios via wildcard predicate.
 * Seguro para multi-tenant: invalida apenas queries do tenant especificado.
 */
export const invalidateReportQueries = async (queryClient, assessmentId = null, tenantId = null) => {
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key)) return false;
      const firstKey = key[0];
      if (firstKey === 'tenant' && key[2] === 'report') {
        if (tenantId && key[1] !== tenantId) return false;
        if (assessmentId && key[3] !== assessmentId) return false;
        return true;
      }
      // SEC-015: Legacy fallback — ONLY when tenantId is null (global admin context).
      if (tenantId) return false;
      const legacyPatterns = ['report-version', 'reports-', 'report-', 'cycle'];
      return typeof firstKey === 'string' && legacyPatterns.some(p => firstKey === p || firstKey.startsWith(p));
    }
  });
};

/**
 * Invalida todos os queries relacionados ao portal do cliente via wildcard predicate.
 * Seguro para multi-tenant: invalida apenas queries do tenant especificado.
 */
export const invalidatePortalQueries = async (queryClient, clientId = null, tenantId = null) => {
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key)) return false;
      const firstKey = key[0];
      if (firstKey === 'tenant' && key[2] === 'portal') {
        if (tenantId && key[1] !== tenantId) return false;
        if (clientId && key[3] !== clientId) return false;
        return true;
      }
      // SEC-015: Legacy fallback — ONLY when tenantId is null (global admin context).
      if (tenantId) return false;
      const legacyPatterns = ['client-portal', 'client-detail', 'client-'];
      return typeof firstKey === 'string' && legacyPatterns.some(p => firstKey === p || firstKey.startsWith(p));
    }
  });
};