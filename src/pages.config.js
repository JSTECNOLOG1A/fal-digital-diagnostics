import { lazy } from 'react';

// Todas as páginas são lazy — carregadas apenas quando a rota é acessada
// MfisPage e ReportPreview REMOVIDOS daqui pois estavam duplicados em App.jsx
// Agora apenas as páginas do loop principal ficam aqui
const ActionPlanPage          = lazy(() => import('./pages/ActionPlanPage'));
const Assessments             = lazy(() => import('./pages/Assessments'));
const AssessmentDetail        = lazy(() => import('./pages/AssessmentDetail'));
const ClientDetail            = lazy(() => import('./pages/ClientDetail'));
const ClientPortal            = lazy(() => import('./pages/ClientPortal'));
const Clients                 = lazy(() => import('./pages/Clients'));
const CompanyDetail           = lazy(() => import('./pages/CompanyDetail'));
const ConsultantCockpit       = lazy(() => import('./pages/ConsultantCockpit'));
const CrossingQuestionnaire   = lazy(() => import('./pages/CrossingQuestionnaire'));
const Dashboard               = lazy(() => import('./pages/Dashboard'));
const DimensionQuestionnaire  = lazy(() => import('./pages/DimensionQuestionnaire'));
const FalHardening            = lazy(() => import('./pages/FalHardening'));
const GroupDetail             = lazy(() => import('./pages/GroupDetail'));
const Groups                  = lazy(() => import('./pages/Groups'));
const MethodAdmin             = lazy(() => import('./pages/MethodAdmin'));
const MfisPage                = lazy(() => import('./pages/MfisPage'));
const QuestionsList           = lazy(() => import('./pages/QuestionsList'));
const ReportPreview           = lazy(() => import('./pages/ReportPreview'));
const SmokeTest               = lazy(() => import('./pages/SmokeTest'));
const SystemSettings          = lazy(() => import('./pages/SystemSettings'));
const SystemLaunches          = lazy(() => import('./pages/SystemLaunches'));
const Tenants                 = lazy(() => import('./pages/Tenants'));
const UnitDetail              = lazy(() => import('./pages/UnitDetail'));
const Integrations            = lazy(() => import('./pages/Integrations'));

// Layout também lazy — carregado junto com a primeira página acessada
const __Layout = lazy(() => import('./Layout.jsx'));

export const PAGES = {
  "ActionPlanPage":         ActionPlanPage,
  "Assessments":            Assessments,
  "AssessmentDetail":       AssessmentDetail,
  "ClientDetail":           ClientDetail,
  "ClientPortal":           ClientPortal,
  "Clients":                Clients,
  "CompanyDetail":          CompanyDetail,
  "ConsultantCockpit":      ConsultantCockpit,
  "CrossingQuestionnaire":  CrossingQuestionnaire,
  "Dashboard":              Dashboard,
  "DimensionQuestionnaire": DimensionQuestionnaire,
  "FalHardening":           FalHardening,
  "GroupDetail":            GroupDetail,
  "Groups":                 Groups,
  "MethodAdmin":            MethodAdmin,
  "MfisPage":               MfisPage,
  "QuestionsList":          QuestionsList,
  "ReportPreview":          ReportPreview,
  "SmokeTest":              SmokeTest,
  "SystemSettings":         SystemSettings,
  "SystemLaunches":         SystemLaunches,
  "Tenants":                Tenants,
  "UnitDetail":             UnitDetail,
  "Integrations":           Integrations,
};

export const pagesConfig = {
  mainPage: "Dashboard",
  Pages: PAGES,
  Layout: __Layout,
};