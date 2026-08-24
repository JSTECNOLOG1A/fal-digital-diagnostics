# SEG-01 — Multi-Session Runtime Proof Runbook

## Status

```
SEG-01 BLOCKED — EXTERNAL RUNTIME EXECUTION REQUIRED
```

## Objective

Prove that backend RBAC guards (SEG-03) correctly deny cross-tenant and
unauthorized-role access in a real multi-session runtime environment.

This runbook cannot be executed within the agent sandbox because it requires
multiple authenticated sessions, real OAuth tokens for different user roles,
and cross-tenant test data. The audit must be performed externally.

## Prerequisites

- Base44 Preview environment
- At least 2 tenants (Tenant A, Tenant B) with test data
- 4 user accounts with different roles

## Sessions Required

| Session | Role              | Tenant    | Purpose                      |
|---------|-------------------|-----------|------------------------------|
| A       | consultant        | Tenant A  | Primary authenticated user   |
| B       | consultant        | Tenant B  | Cross-tenant denial proof    |
| V       | client_viewer     | Tenant A  | Write-role denial proof      |
| HQ      | hq_admin          | (global)  | HQ cross-tenant access proof |

## Test Scenarios

### Scenario 1: Same-tenant access (ALLOW)

- **Session:** A (consultant, Tenant A)
- **Action:** Call `generateActionPlan` with `assessmentId` from Tenant A
- **Expected:** 200 OK
- **Assert:** ActionPlan created with correct `tenant_id`

### Scenario 2: Cross-tenant denial (DENY)

- **Session:** A (consultant, Tenant A)
- **Action:** Call `generateActionPlan` with `assessmentId` from Tenant B
- **Expected:** 403 Forbidden — tenant mismatch
- **Assert:** No ActionPlan created

### Scenario 3: client_viewer write denial (DENY)

- **Session:** V (client_viewer, Tenant A)
- **Action:** Call `generateActionPlan` with `assessmentId` from Tenant A
- **Expected:** 403 Forbidden — "Forbidden: write permission required"
- **Assert:** `assertCanWrite` blocks before any `.create()` call

### Scenario 4: client_viewer task update denial (DENY)

- **Session:** V (client_viewer, Tenant A)
- **Action:** Call `updateActionTaskWithHistory` with `task_id` from Tenant A
- **Expected:** 403 Forbidden — "Forbidden: write permission required"

### Scenario 5: HQ cross-tenant access (ALLOW)

- **Session:** HQ (hq_admin)
- **Action:** Call `checkFinancialDiagnosisIntegrity` with `financial_diagnosis_id` from Tenant B
- **Payload field:** `financial_diagnosis_id` (NOT `diagnosis_id` — verified in entry.ts line 30)
- **Expected:** 200 OK — HQ bypasses tenant guard

### Scenario 6: Same-tenant integrity check (ALLOW)

- **Session:** A (consultant, Tenant A)
- **Action:** Call `checkFinancialDiagnosisIntegrity` with `financial_diagnosis_id` from Tenant A
- **Payload field:** `financial_diagnosis_id` (NOT `diagnosis_id`)
- **Expected:** 200 OK

### Scenario 7: Cross-tenant integrity check denial (DENY)

- **Session:** A (consultant, Tenant A)
- **Action:** Call `checkFinancialDiagnosisIntegrity` with `financial_diagnosis_id` from Tenant B
- **Payload field:** `financial_diagnosis_id` (NOT `diagnosis_id`)
- **Expected:** 403 Forbidden — tenant mismatch

## Endpoints to Test

| Function                          | Method | Payload Field                              |
|-----------------------------------|--------|---------------------------------------------|
| getAssessmentFlow                 | POST   | `assessment_id` (snake_case)                |
| generateActionPlan                | POST   | `assessmentId` (camelCase) — verified       |
| updateActionTaskWithHistory       | POST   | `task_id` (snake_case)                      |
| createActionPlanReview            | POST   | `assessment_id`, `plan_id` (snake_case)     |
| generateAssessmentReportVersion   | POST   | `assessment_id` (snake_case)                |
| manageActionRecommendation        | POST   | `recommendation_id`, `action` (snake_case)  |
| checkFinancialDiagnosisIntegrity  | POST   | `financial_diagnosis_id` (snake_case)       |
| publishFalAssessment              | POST   | `assessment_id` (snake_case)                |

## Expected Results Matrix

| Role          | Same tenant | Cross tenant                       |
|---------------|-------------|-------------------------------------|
| hq_admin      | ALLOW 200   | ALLOW 200 (HQ bypass)              |
| tenant_admin  | ALLOW 200   | DENY 403                           |
| consultant    | ALLOW 200   | DENY 403                           |
| client_viewer | DENY 403    | DENY 403                           |

## Execution Steps

1. Open Base44 Preview in 4 separate browser sessions (or use Testing Agent)
2. Authenticate each session with the appropriate user account
3. For each scenario, invoke the endpoint via the app UI or direct API call
4. Record the HTTP status code and response body
5. Verify no unauthorized mutations occurred (check database)

## Test Data Required

- Tenant A: 1 assessment, 1 financial diagnosis, 1 action plan with tasks
- Tenant B: 1 assessment, 1 financial diagnosis, 1 action plan with tasks
- Both tenants must have completed the upload + validation pipeline

## Blocking Note

This runbook cannot be executed within the agent sandbox because it requires:

- Multiple authenticated sessions simultaneously
- Real OAuth tokens for different user roles
- Cross-tenant test data in a live database

The audit must be performed externally using Base44 Preview, Testing Agent,
or a CI environment with session support.

## Pass Criteria

All 7 scenarios must produce the expected HTTP status codes. Any unexpected
200 (especially for client_viewer or cross-tenant access) constitutes a FAIL.