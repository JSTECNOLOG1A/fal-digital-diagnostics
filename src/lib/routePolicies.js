/**
 * SEG-03 — Single Source of Truth for Route Policies (Residual 9)
 * =====================================================================
 * CORREÇÃO DE DESVIO DE REQUISITO:
 *   O requisito aprovado NÃO é "client_viewer bloqueado de todas as telas".
 *   O requisito aprovado É:
 *     client_viewer → acessa telas autorizadas em modo de leitura
 *     client_viewer → não cria, não altera, não publica, não processa, não exclui
 *
 *   READ ACCESS ≠ WRITE ACCESS
 *   ROUTE ACCESS ≠ MUTATION PERMISSION
 *
 * Quatro grupos de rotas:
 *   A. Administrativas — requireHQ / requireAdmin
 *   B. Operacionais de leitura — requireRead (client_viewer tem acesso)
 *   C. Edição/configuração — requireWrite (client_viewer bloqueado)
 *   D. Portal do cliente — allowAll
 *
 * deny-by-default: rotas não listadas recebem { requireWrite: true }.
 */
export const ROUTE_POLICIES = {
  // ── B. Rotas operacionais de leitura (client_viewer: ALLOW read) ──
  Dashboard:              { requireRead: true },
  Groups:                 { requireRead: true },
  GroupDetail:            { requireRead: true },
  ConsultantCockpit:      { requireRead: true },
  Assessments:            { requireRead: true },
  AssessmentDetail:       { requireRead: true },
  ClientDetail:           { requireRead: true },
  Clients:                { requireRead: true },
  CompanyDetail:          { requireRead: true },
  UnitDetail:             { requireRead: true },
  ActionPlanPage:         { requireRead: true },
  MfisPage:               { requireRead: true },
  ReportPreview:          { requireRead: true },

  // ── C. Rotas de edição/configuração (client_viewer: DENY) ──
  CrossingQuestionnaire:  { requireWrite: true },
  DimensionQuestionnaire: { requireWrite: true },

  // ── A. Rotas administrativas (client_viewer + consultant: DENY) ──
  Tenants:        { requireHQ: true },
  MethodAdmin:    { requireAdmin: true },
  SystemSettings: { requireAdmin: true },
  Integrations:   { requireAdmin: true },
  SystemLaunches: { requireHQ: true },
  FalHardening:   { requireHQ: true },
  SmokeTest:      { requireHQ: true },
  QuestionsList:  { requireAdmin: true },

  // ── D. Portal do cliente (all authenticated roles) ──
  ClientPortal:   { allowAll: true },

  // ── Special routes (not in pages.config — explicit <Route> in App.jsx) ──
  FinancialDiagnosisDetail:      { requireRead: true },
  FinancialAccountPlanManager:   { requireWrite: true },
  FalAssessmentSetup:            { requireWrite: true },
  ReportsCenterPage:             { requireRead: true },
  ActionPlanManagement:          { requireRead: true },
  Onboarding:                    { requireWrite: true },
};

/**
 * Returns the policy for a given route name.
 * deny-by-default: unlisted routes receive { requireWrite: true }.
 * @param {string} routeName
 * @returns {{ requireWrite?: boolean, requireRead?: boolean, requireHQ?: boolean, requireAdmin?: boolean, allowAll?: boolean }}
 */
export function getRoutePolicy(routeName) {
  return ROUTE_POLICIES[routeName] || { requireWrite: true };
}