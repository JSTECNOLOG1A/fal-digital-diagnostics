/**
 * SEG-03 — Route Policy Integration Tests (Residual 9)
 * =====================================================================
 * CORREÇÃO: os testes agora acompanham o REQUISITO, não a implementação errada.
 *
 * Requisito aprovado:
 *   client_viewer → acessa telas autorizadas em modo de leitura
 *   client_viewer → bloqueado de ações mutáveis (requireWrite)
 *
 *   READ ACCESS ≠ WRITE ACCESS
 *   ROUTE ACCESS ≠ MUTATION PERMISSION
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RoleRoute from '@/components/shared/RoleRoute';
import { ROUTE_POLICIES, getRoutePolicy } from '@/lib/routePolicies';

// ── Mock usePermissions to inject specific roles ──────────────────────────────
const mockPerms = (appRole) => {
  // app_role values only — built-in 'admin'/'user' are resolved via resolveAppRole
  const roles = {
    hq_admin:      { isHQ: true,  isAdmin: true,  canWrite: true,  canRead: true,  canManageGroup: true,  canManageDiagnosis: true,  canManageQuestionnaire: true,  canManageConsolidation: true,  canManageActionPlan: true,  canManageReviews: true,  canManageReports: true,  canManageUsers: true,  canDeleteEntity: true,  canSwitchTenant: true,  canAccessClientPortal: true,  hasTenantAccess: () => true,  role: 'admin', appRole: 'hq_admin' },
    tenant_admin:  { isHQ: false, isAdmin: true,  canWrite: true,  canRead: true,  canManageGroup: true,  canManageDiagnosis: true,  canManageQuestionnaire: true,  canManageConsolidation: true,  canManageActionPlan: true,  canManageReviews: true,  canManageReports: true,  canManageUsers: true,  canDeleteEntity: true,  canSwitchTenant: false, canAccessClientPortal: true,  hasTenantAccess: () => true,  role: 'user', appRole: 'tenant_admin' },
    consultant:    { isHQ: false, isAdmin: false, canWrite: true,  canRead: true,  canManageGroup: true,  canManageDiagnosis: true,  canManageQuestionnaire: true,  canManageConsolidation: true,  canManageActionPlan: true,  canManageReviews: true,  canManageReports: true,  canManageUsers: false, canDeleteEntity: false, canSwitchTenant: false, canAccessClientPortal: true,  hasTenantAccess: () => true,  role: 'user', appRole: 'consultant' },
    client_viewer: { isHQ: false, isAdmin: false, canWrite: false, canRead: true,  canManageGroup: false, canManageDiagnosis: false, canManageQuestionnaire: false, canManageConsolidation: false, canManageActionPlan: false, canManageReviews: false, canManageReports: false, canManageUsers: false, canDeleteEntity: false, canSwitchTenant: false, canAccessClientPortal: true,  hasTenantAccess: () => true,  role: 'user', appRole: 'client_viewer' },
  };
  return roles[appRole] || roles.client_viewer;
};

let currentRole = 'client_viewer';
vi.mock('@/lib/hooks/usePermissions', () => ({
  usePermissions: () => mockPerms(currentRole),
}));

vi.mock('@/components/shared/TenantContext', () => ({
  useTenant: () => ({
    user: { role: currentRole === 'hq_admin' ? 'admin' : 'user', app_role: currentRole, tenant_id: 'tenant-A' },
    tenantId: 'tenant-A',
    isHQ: currentRole === 'hq_admin',
    loading: false,
    error: null,
  }),
  useTenantRequired: () => ({
    user: { role: currentRole === 'hq_admin' ? 'admin' : 'user', app_role: currentRole, tenant_id: 'tenant-A' },
    tenantId: 'tenant-A',
    isHQ: currentRole === 'hq_admin',
    loading: false,
    error: null,
  }),
}));

// ── Test harness ──
const TestPage = ({ name }) => <div data-testid="page-content">{name}</div>;
const DeniedPage = () => <div data-testid="denied">DENIED</div>;

function renderRoute(policy, role, routePath = '/test', initialEntry = routePath) {
  currentRole = role;
  const guard = policy.allowAll ? null : <RoleRoute {...policy}><TestPage name={routePath} /></RoleRoute>;
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={routePath} element={guard || <TestPage name={routePath} />} />
        <Route path="/" element={<DeniedPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Route groups per the corrected requirement ──
const READ_ROUTES = [
  'Dashboard', 'Groups', 'GroupDetail', 'ConsultantCockpit',
  'Assessments', 'AssessmentDetail', 'ClientDetail', 'Clients',
  'CompanyDetail', 'UnitDetail', 'ActionPlanPage', 'MfisPage', 'ReportPreview',
  'FinancialDiagnosisDetail', 'ReportsCenterPage', 'ActionPlanManagement',
];

const WRITE_ROUTES = [
  'CrossingQuestionnaire', 'DimensionQuestionnaire',
  'FinancialAccountPlanManager', 'FalAssessmentSetup',
];

const ADMIN_ROUTES = [
  'Tenants', 'MethodAdmin', 'SystemSettings', 'SystemLaunches', 'FalHardening', 'SmokeTest', 'QuestionsList',
];

// ── Tests ──
describe('SEG-03 — Route Policy Matrix (Residual 9 — corrected requirement)', () => {
  beforeEach(() => { currentRole = 'client_viewer'; });

  describe('client_viewer — READ access to operational routes', () => {
    it.each(READ_ROUTES)('ALLOWS client_viewer to %s in read mode', (routeName) => {
      const policy = ROUTE_POLICIES[routeName];
      const { container } = renderRoute(policy, 'client_viewer', `/${routeName}`);
      expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="denied"]')).toBeNull();
    });
  });

  describe('client_viewer — DENIED from write/config routes', () => {
    it.each(WRITE_ROUTES)('DENIES client_viewer from %s', (routeName) => {
      const policy = ROUTE_POLICIES[routeName];
      const { container } = renderRoute(policy, 'client_viewer', `/${routeName}`);
      expect(container.querySelector('[data-testid="page-content"]')).toBeNull();
      expect(container.querySelector('[data-testid="denied"]')).not.toBeNull();
    });
  });

  describe('client_viewer — DENIED from administrative routes', () => {
    it.each(ADMIN_ROUTES)('DENIES client_viewer from %s', (routeName) => {
      const policy = ROUTE_POLICIES[routeName];
      const { container } = renderRoute(policy, 'client_viewer', `/${routeName}`);
      expect(container.querySelector('[data-testid="page-content"]')).toBeNull();
      expect(container.querySelector('[data-testid="denied"]')).not.toBeNull();
    });
  });

  it('ALLOWS client_viewer to ClientPortal', () => {
    const policy = ROUTE_POLICIES.ClientPortal;
    const { container } = renderRoute(policy, 'client_viewer', '/ClientPortal');
    expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="denied"]')).toBeNull();
  });

  describe('client_viewer — deep links to read routes render the page', () => {
    it('ALLOWS client_viewer to deep link /GroupDetail?id=456&tab=estrutura', () => {
      const policy = getRoutePolicy('GroupDetail');
      const { container } = renderRoute(policy, 'client_viewer', '/GroupDetail', '/GroupDetail?id=456&tab=estrutura');
      expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="denied"]')).toBeNull();
    });

    it('ALLOWS client_viewer to deep link /AssessmentDetail?id=123&tab=diagnostico', () => {
      const policy = getRoutePolicy('AssessmentDetail');
      const { container } = renderRoute(policy, 'client_viewer', '/AssessmentDetail', '/AssessmentDetail?id=123&tab=diagnostico');
      expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="denied"]')).toBeNull();
    });

    it('ALLOWS client_viewer to deep link /FinancialDiagnosisDetail?id=789&tab=indicadores', () => {
      const policy = getRoutePolicy('FinancialDiagnosisDetail');
      const { container } = renderRoute(policy, 'client_viewer', '/FinancialDiagnosisDetail', '/FinancialDiagnosisDetail?id=789&tab=indicadores');
      expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="denied"]')).toBeNull();
    });

    it('ALLOWS client_viewer to /assessment/<id>/action-plan', () => {
      const policy = getRoutePolicy('ActionPlanManagement');
      const { container } = renderRoute(policy, 'client_viewer', '/assessment/123/action-plan');
      expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="denied"]')).toBeNull();
    });

    it('ALLOWS client_viewer to /ReportsCenterPage?assessment_id=123', () => {
      const policy = getRoutePolicy('ReportsCenterPage');
      const { container } = renderRoute(policy, 'client_viewer', '/ReportsCenterPage', '/ReportsCenterPage?assessment_id=123');
      expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="denied"]')).toBeNull();
    });
  });

  describe('consultant access', () => {
    const allOperational = [...READ_ROUTES, ...WRITE_ROUTES];
    it.each(allOperational)('ALLOWS consultant to %s', (routeName) => {
      const policy = ROUTE_POLICIES[routeName];
      const { container } = renderRoute(policy, 'consultant', `/${routeName}`);
      expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="denied"]')).toBeNull();
    });

    it.each(ADMIN_ROUTES)('DENIES consultant from %s (admin-only)', (routeName) => {
      const policy = ROUTE_POLICIES[routeName];
      const { container } = renderRoute(policy, 'consultant', `/${routeName}`);
      expect(container.querySelector('[data-testid="page-content"]')).toBeNull();
      expect(container.querySelector('[data-testid="denied"]')).not.toBeNull();
    });
  });

  describe('tenant_admin access', () => {
    it('ALLOWS tenant_admin to SystemSettings', () => {
      const policy = ROUTE_POLICIES.SystemSettings;
      const { container } = renderRoute(policy, 'tenant_admin', '/SystemSettings');
      expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
    });

    it('ALLOWS tenant_admin to Dashboard', () => {
      const policy = ROUTE_POLICIES.Dashboard;
      const { container } = renderRoute(policy, 'tenant_admin', '/Dashboard');
      expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
    });

    it('DENIES tenant_admin from Tenants (HQ-only)', () => {
      const policy = ROUTE_POLICIES.Tenants;
      const { container } = renderRoute(policy, 'tenant_admin', '/Tenants');
      expect(container.querySelector('[data-testid="page-content"]')).toBeNull();
      expect(container.querySelector('[data-testid="denied"]')).not.toBeNull();
    });
  });

  describe('hq_admin access', () => {
    it('ALLOWS hq_admin to Tenants', () => {
      const policy = ROUTE_POLICIES.Tenants;
      const { container } = renderRoute(policy, 'hq_admin', '/Tenants');
      expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
    });

    it('ALLOWS hq_admin to FinancialDiagnosisDetail (requireRead)', () => {
      const policy = getRoutePolicy('FinancialDiagnosisDetail');
      const { container } = renderRoute(policy, 'hq_admin', '/FinancialDiagnosisDetail');
      expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
    });

    it('ALLOWS hq_admin to AssessmentDetail', () => {
      const policy = ROUTE_POLICIES.AssessmentDetail;
      const { container } = renderRoute(policy, 'hq_admin', '/AssessmentDetail');
      expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
    });
  });

  describe('deny-by-default for unlisted routes', () => {
    it('DENIES client_viewer from unlisted route via getRoutePolicy', () => {
      const policy = getRoutePolicy('SomeNewPageNotInPolicies');
      expect(policy.requireWrite).toBe(true);
      const { container } = renderRoute(policy, 'client_viewer', '/SomeNewPageNotInPolicies');
      expect(container.querySelector('[data-testid="page-content"]')).toBeNull();
      expect(container.querySelector('[data-testid="denied"]')).not.toBeNull();
    });

    it('ALLOWS consultant to unlisted route via getRoutePolicy (deny-by-default = requireWrite)', () => {
      const policy = getRoutePolicy('AnotherNewPage');
      expect(policy.requireWrite).toBe(true);
      const { container } = renderRoute(policy, 'consultant', '/AnotherNewPage');
      expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
    });
  });

  describe('policy completeness', () => {
    it('ROUTE_POLICIES covers all pages in pages.config', () => {
      const pagesConfigKeys = [
        'ActionPlanPage', 'Assessments', 'AssessmentDetail', 'ClientDetail',
        'ClientPortal', 'Clients', 'CompanyDetail', 'ConsultantCockpit',
        'CrossingQuestionnaire', 'Dashboard', 'DimensionQuestionnaire',
        'FalHardening', 'GroupDetail', 'Groups', 'MethodAdmin', 'MfisPage',
        'QuestionsList', 'ReportPreview', 'SmokeTest', 'SystemSettings',
        'SystemLaunches', 'Tenants', 'UnitDetail',
      ];
      for (const page of pagesConfigKeys) {
        expect(ROUTE_POLICIES[page]).toBeDefined();
      }
    });

    it('ROUTE_POLICIES covers all special routes', () => {
      const specialRoutes = [
        'FinancialDiagnosisDetail', 'FinancialAccountPlanManager',
        'FalAssessmentSetup', 'ReportsCenterPage', 'ActionPlanManagement',
      ];
      for (const route of specialRoutes) {
        expect(ROUTE_POLICIES[route]).toBeDefined();
      }
    });

    it('getRoutePolicy returns deny-by-default for unlisted routes', () => {
      const policy = getRoutePolicy('NonExistentRoute');
      expect(policy.requireWrite).toBe(true);
    });

    it('ClientPortal is the ONLY allowAll route', () => {
      const allowAllRoutes = Object.entries(ROUTE_POLICIES)
        .filter(([, policy]) => policy.allowAll)
        .map(([name]) => name);
      expect(allowAllRoutes).toEqual(['ClientPortal']);
    });

    it('operational read routes use requireRead (not requireWrite)', () => {
      for (const route of READ_ROUTES) {
        const policy = ROUTE_POLICIES[route];
        expect(policy.requireRead).toBe(true);
        expect(policy.requireWrite).toBeUndefined();
      }
    });

    it('write/config routes use requireWrite', () => {
      for (const route of WRITE_ROUTES) {
        const policy = ROUTE_POLICIES[route];
        expect(policy.requireWrite).toBe(true);
      }
    });
  });
});