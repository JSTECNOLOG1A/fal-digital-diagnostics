import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useTenant } from '@/components/shared/TenantContext';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { TenantProvider } from '@/components/shared/TenantContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import LocalLoginPage from '@/components/LocalLoginPage';
import RoleRoute from '@/components/shared/RoleRoute';
import { ROUTE_POLICIES, getRoutePolicy } from '@/lib/routePolicies';
import { PASSWORD_LOGIN_ENABLED } from '@/lib/AuthContext';
import AppErrorBoundary from '@/components/shared/AppErrorBoundary';

// Páginas extras não registradas no pages.config (rotas especiais)
const FinancialDiagnosisDetail = lazy(() => import('./pages/FinancialDiagnosisDetail.jsx'));
const FinancialAccountPlanManager = lazy(() => import('./pages/FinancialAccountPlanManager.jsx'));
const FalAssessmentSetupPage = lazy(() => import('./pages/FalAssessmentSetupPage.jsx'));
const ReportsCenterPage = lazy(() => import('./pages/ReportsCenterPage.jsx'));
const ActionPlanManagementPage = lazy(() => import('./pages/ActionPlanManagementPage.jsx'));

// Spinner centralizado reutilizável
const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--fal-bg-page)' }}>
    <img
      src="https://media.base44.com/images/public/69a73116dbdf09070bf71370/e6f16581b_image.png"
      alt="FAL Digital"
      className="h-12 w-12 animate-spin"
      style={{ animationDuration: '2.4s' }}
    />
  </div>
);

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

// LayoutWrapper: envolve página + layout num único boundary de Suspense
const LayoutWrapper = ({ children, currentPageName }) => (
  <Suspense fallback={<PageLoader />}>
    {Layout
      ? <Layout currentPageName={currentPageName}>{children}</Layout>
      : children
    }
  </Suspense>
);

// SEG-03: ROUTE_POLICIES is now imported from @/lib/routePolicies (single source of truth).
// Both App.jsx and route-policies.test.jsx import from the same module — zero drift.

const AuthenticatedApp = () => {
  const { isAuthenticated, authChecked, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const { isClient } = useTenant();

  useEffect(() => {
    if (PASSWORD_LOGIN_ENABLED) return;
    if (
      authChecked &&
      !isLoadingAuth &&
      !isLoadingPublicSettings &&
      !isAuthenticated &&
      authError?.type !== 'user_not_registered'
    ) {
      navigateToLogin();
    }
  }, [authChecked, isLoadingAuth, isLoadingPublicSettings, isAuthenticated, authError, navigateToLogin]);

  if (isLoadingPublicSettings || isLoadingAuth || !authChecked) {
    return <PageLoader />;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    if (PASSWORD_LOGIN_ENABLED) return <LocalLoginPage />;
    return <PageLoader />;
  }

  return (
    <Routes>
      {/* Rota raiz — direciona cada perfil para sua experiência */}
      <Route path="/" element={
        isClient
          ? <Navigate to="/ClientPortal" replace />
          : <LayoutWrapper currentPageName={mainPageKey}>
              <MainPage />
            </LayoutWrapper>
      } />

      {/* Páginas do pages.config — TODAS com policy explícita (SEG-03) */}
      {Object.entries(Pages).map(([path, Page]) => {
        const policy = getRoutePolicy(path);
        return (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                {policy.allowAll
                  ? <Page />
                  : <RoleRoute {...policy}><Page /></RoleRoute>
                }
              </LayoutWrapper>
            }
          />
        );
      })}

      {/* Redirect legado */}
      <Route path="/GroupCycleDashboard" element={
        (() => {
          const gid = new URLSearchParams(window.location.search).get('group_id');
          return <Navigate to={gid ? `/GroupDetail?id=${gid}&tab=visao-geral` : '/Groups'} replace />;
        })()
      } />

      {/* Rotas especiais (não registradas no pages.config) */}
      <Route path="/FinancialDiagnosisDetail" element={
        <LayoutWrapper currentPageName="FinancialDiagnosisDetail">
          <RoleRoute requireRead>
            <FinancialDiagnosisDetail />
          </RoleRoute>
        </LayoutWrapper>
      } />
      <Route path="/FinancialAccountPlanManager" element={
        <LayoutWrapper currentPageName="FinancialAccountPlanManager">
          <RoleRoute requireWrite>
            <FinancialAccountPlanManager />
          </RoleRoute>
        </LayoutWrapper>
      } />
      <Route path="/FalAssessmentSetup" element={
        <LayoutWrapper currentPageName="FalAssessmentSetup">
          <RoleRoute requireWrite>
            <FalAssessmentSetupPage />
          </RoleRoute>
        </LayoutWrapper>
      } />
      <Route path="/ReportsCenterPage" element={
        <LayoutWrapper currentPageName="ReportsCenterPage">
          <RoleRoute requireRead>
            <ReportsCenterPage />
          </RoleRoute>
        </LayoutWrapper>
      } />
      <Route path="/assessment/:assessment_id/action-plan" element={
        <LayoutWrapper currentPageName="ActionPlanManagement">
          <RoleRoute requireRead>
            <ActionPlanManagementPage />
          </RoleRoute>
        </LayoutWrapper>
      } />
      <Route path="/assessment/:assessment_id/action-plan/review/:review_id" element={
        <LayoutWrapper currentPageName="ActionPlanManagement">
          <RoleRoute requireRead>
            <ActionPlanManagementPage />
          </RoleRoute>
        </LayoutWrapper>
      } />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AppErrorBoundary>
              <AuthenticatedApp />
            </AppErrorBoundary>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </TenantProvider>
    </AuthProvider>
  );
}

export default App;