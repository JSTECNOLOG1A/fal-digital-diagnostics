# RELATÓRIO DE AUDITORIA — PATCH CORRETIVO BACKEND P0

**Data:** 2026-07-12  
**Versão:** v2.12 → v2.13 (P0 Corrective Patch)  
**Status:** BACKEND P0 CORRIGIDO E PRONTO PARA HOMOLOGAÇÃO RUNTIME

---

## 1. RESUMO EXECUTIVO

O ZIP v2.12 não estava apto para publicação: 23 funções backend não compilavam, 85 resolvers de identidade estavam quebrados, 11 write guards verificavam o papel incorreto, e o onboarding de usuários convidados tinha zero consumers. Este patch corrige mecanicamente as 107 functions, reescreve os auditores que retornavam falso verde, e integra o fluxo de pending profile no login.

---

## 2. MÉTRICAS — ANTES E DEPOIS

| Métrica                    | Antes | Depois |
| -------------------------- | ----: | -----: |
| functions backend          |   107 |    107 |
| parse failures             |    23 |      0 |
| resolvers quebrados        |    85 |      0 |
| write guards por user.role |    11 |      0 |
| duplicate isHQ             |    23 |      0 |
| consumer applyPending      |     0 |      1 |
| migration partial-success  |     1 |      0 |
| testes automatizados       |   ~120 |   ~140 |
| auditores falso verde      |     2 |      0 |

---

## 3. GATES EXECUTADOS

| Gate                    | Resultado |
| ----------------------- | --------- |
| audit:backend-compile   | ✅ 107/107 pass, 0 failures |
| audit:rbac-functions    | ✅ 0 violações |
| audit:identity-usage    | ✅ 0 violações |
| write-guards.test.js    | ✅ 15 testes (ALLOW/DENY/no-mutations) |
| auth-pending-profile.test.js | ✅ 5 testes (apply/skip/404/409) |

---

## 4. CORREÇÕES APLICADAS

### 4.1 Gate de Compilação (Item 1)
- **Criado:** `scripts/audit-backend-compile.mjs`
- Usa `esbuild.transform` para compilar sintaticamente todos os `base44/functions/*/entry.ts`
- Dependência `esbuild@^0.25.0` instalada
- Adicionado ao `package.json`: `"audit:backend-compile"` e integrado ao `"verify"`

### 4.2 Correção Mecânica das 107 Functions (Itens 2, 3, 4)
Script de correção executado via sandbox Node.js, modificando 85 arquivos:

**85 resolveAppRole corrigidos:**
- Antes: `if (appRole === 'hq_admin') return 'hq_admin';` (variável não existe dentro da função)
- Depois: `if (user?.role === 'admin') return 'hq_admin';`

**11 write guards corrigidos:**
- assinatura: `function assertCanWrite(u)` → `function assertCanWrite(appRole)`
- body: `!WRITE_ROLES.has(u?.role)` → `!WRITE_ROLES.has(appRole)`
- chamada: `assertCanWrite(user)` → `assertCanWrite(appRole)`

**24 isHQ deduped:**
- Removidas declarações duplicadas de `const isHQ = appRole === 'hq_admin';`
- Mantida apenas a primeira declaração (fonte de verdade única)

### 4.3 falTestSuite — Correção de Testes Quebrados (Item 2)
- 2 funções de teste tinham `const isHQ = appRole === 'hq_admin'` (appRole não existe no escopo do teste)
- Corrigido para `const isHQUser = resolveAppRole(user) === 'hq_admin'`
- Fixtures atualizadas para usar `app_role` em vez de `role`

### 4.4 Testes dos Write Guards (Item 5)
- **Criado:** `src/lib/__tests__/write-guards.test.js`
- 5 fixtures: hqAdmin, tenantAdmin, consultant, clientViewer, unclassified
- hq_admin → ALLOW, tenant_admin → ALLOW, consultant → ALLOW
- client_viewer → DENY 403, unclassified → DENY 403
- Para casos negados: verifica create/update/delete/bulkCreate/bulkUpdate/bulkDelete NUNCA chamados

### 4.5 Reescrita do audit:rbac-functions (Item 6)
- **Reescrito:** `scripts/audit-function-rbac.mjs`
- v1 retornava "0 violações" mesmo com 23 funções sem compilar — falso verde
- v2 valida: assinatura do guard, argumento passado, uso de appRole, ordem guard→mutation, redeclarações, fallback de admin, body do resolveAppRole
- Falha para fixtures: `assertCanWrite(u)`, `WRITE_ROLES.has(user.role)`, `appRole ===` dentro de resolver, `const isHQ` duplicado

### 4.6 Reescrita do audit:identity-usage (Item 7)
- **Reescrito:** `scripts/audit-identity-usage.mjs`
- v1 ignorava todo o bloco `resolveAppRole` — permitiu 85 resolvers quebrados
- v2 valida cada resolver: exige `VALID_APP_ROLES.has(user?.app_role)` + `user?.role === 'admin'`
- Falha ao encontrar: `appRole ===` dentro de resolver, `role=user → consultant`, aliases (u.role, actor.role, currentUser.role, targetUser.role) em guards

### 4.7 Integração do applyPendingUserAccessProfile (Item 8)
- **Modificado:** `src/lib/AuthContext.jsx`
- Após `auth.me()`, se usuário existe e `app_role` está vazio, chama `applyPendingUserAccessProfile`
- Em sucesso: re-lê usuário, limpa caches se tenant mudou
- 404 = sem pending (não é erro), 409 = erro de onboarding (logado)
- Sem loop — chamado apenas uma vez por `checkAppState`

- **Criado:** `src/lib/__tests__/auth-pending-profile.test.js`
- 5 cenários: apply+success, app_role já existe, 404, 409, success:false

### 4.8 System Settings — Convite Somente HQ (Item 9)
- **Modificado:** `src/pages/SystemSettings.jsx`
- Card "Convidar Usuário" envolto em `{isHQ && (...)}`
- Removido `(isHQ || isTenantAdmin)` do seletor de papel
- Somente HQ visualiza e executa o convite

### 4.9 Correção da Ordem do Convite (Item 10)
- **Modificado:** `base44/functions/inviteUserWithAccessProfile/entry.ts`
- Fluxo anterior: invite → criar pending (orphan se pending falha)
- Fluxo corrigido: criar pending → invite → se invite falha, marcar pending como error
- Não retorna `invite_sent: true` se pending não estiver persistido

### 4.10 Validação de Tenant em assignUserAccessProfile (Item 11)
- **Modificado:** `base44/functions/assignUserAccessProfile/entry.ts`
- Adicionado passo 6b: valida que target tenant existe e está ativo
- Retorna 404 se tenant não encontrado
- Retorna 400 se tenant inativo

### 4.11 Migração All-or-Nothing (Item 12)
- **Modificado:** `base44/functions/migrateUserAccessProfiles/entry.ts`
- Passo 8 reescrito: salva estados originais antes de qualquer update
- Ao primeiro erro: interrompe loop, reverte todos os usuários alterados, retorna `success: false`
- Postcondition check após cada update (`PROFILE_POSTCONDITION_FAILED`)
- Sucesso somente quando `applied = esperado`, `skipped = 0`, `rollback_failures = 0`

### 4.12 PermissionGuard em ActionPlanManagementPage (Item 13)
- **Modificado:** `src/pages/ActionPlanManagementPage.jsx`
- Importado `PermissionGuard` e `usePermissions`
- Botão "Gerar Plano de Ação" envolto com `<PermissionGuard requireWrite>`
- Callbacks `onAddTask` e `onRegenerate` condicionais a `canWrite`
- `AddManualTaskModal` envolto com `<PermissionGuard requireWrite>`
- Toda mutation acessível por rota `requireRead` agora tem guard no frontend

### 4.13 package.json (Item 1)
- **Modificado:** `package.json`
- Adicionado: `"audit:backend-compile": "node scripts/audit-backend-compile.mjs"`
- Atualizado `"verify"` com todos os 5 auditores + lint + typecheck + test:ci + build

---

## 5. ARQUIVOS ALTERADOS — LISTA COMPLETA

### Scripts (3 arquivos)
1. `scripts/audit-backend-compile.mjs` — NOVO
2. `scripts/audit-function-rbac.mjs` — REESCRITO
3. `scripts/audit-identity-usage.mjs` — REESCRITO

### Backend Functions — Correção Mecânica (85 arquivos)
archiveReportVersion, buildFalQuestionSet, buildFinancialStatements, buildReportPayload, cancelActionPlanReview, checkFinancialDiagnosisIntegrity, completeActionPlanReview, computeClusterIntelligence, computeCompanyAggregate, computeConsultantPortfolio, computeFalDiagnostic, computeFalPriority, computeGroupAggregate, computeInsights, computePortfolioBenchmark, computeScores, createActionPlanReview, createActionPlanReviewWithSnapshot, debugCaixaComposition, debugCaixaContas, debugCaixaDetalhado, debugCaixaVazao, debugDfcCompositionDetailed, debugExcelHeaders, debugPlMapping, debugPlVsResultado, debugResultadoLiquido, debugTodasContas, deduplicateActionPlanReviews, deduplicateActionRecommendations, deleteAccountPlanLines, falHardeningReport, falIntegrityCheck, falTestSuite, finalizeFinancialInsights, fixFalGroupApplicability, generateActionPlan, generateActionRecommendations, generateAssessmentReportVersion, generateConsultantAlerts, generateFinancialInterpretations, generateFinancialRecommendations, generateInsights, generatePdfFromReportVersion, generateReport, generateSyntheticDiagnostic, getAssessmentFlow, getBankTemplate, getFalResponses, getReportVersionSnapshot, importFalQuestionBankV3, importFalQuestions, importFalRecommendationLibrary, importMethodBank, importMethodQuestions, importQuestionsCSV, manageActionRecommendation, manageDiagnosticLink, manageFinancialConsolidationEntry, migrateFalDimKeys, migrateFalQuestionBank, migrateLegacySocietaryCompositionToOwnershipLinks, migrateQuestionsToClusters, narrativeEngine, onFalResponseChange, prepareFinancialAnalysisDataset, publishFalAssessment, purgeFinancialDerivedData, purgeFinancialUploadData, rebuildFalQuestionBank, reconcileIntercompany, reindexFalQuestionBank, restructureFalMatrix, runtimeSecurityProof, saveDfcClassificationOverride, seedActionLibraries, seedFalClusterMeta, seedFalClusters, seedFalIntelligence, seedFalLibrariesAgronegocio, seedFalQuestionApplicability, seedFalValueLevers, seedIntelligenceCatalog, seedMethodData, seedMethodStructure, seedMqeQuestions, sendFindingToActionPlan, simulateFalImpact, swapFalQuestion, updateActionTaskWithHistory, validateFinancialUpload

### Backend Functions — Correções Estruturais (4 arquivos)
1. `base44/functions/falTestSuite/entry.ts` — isHQ test fix
2. `base44/functions/inviteUserWithAccessProfile/entry.ts` — ordem invertida
3. `base44/functions/assignUserAccessProfile/entry.ts` — tenant validation
4. `base44/functions/migrateUserAccessProfiles/entry.ts` — all-or-nothing rollback

### Frontend (5 arquivos)
1. `src/lib/AuthContext.jsx` — applyPendingUserAccessProfile integration
2. `src/pages/SystemSettings.jsx` — invite card HQ-only
3. `src/pages/ActionPlanManagementPage.jsx` — PermissionGuard
4. `src/lib/__tests__/write-guards.test.js` — NOVO
5. `src/lib/__tests__/auth-pending-profile.test.js` — NOVO

### Config (1 arquivo)
1. `package.json` — audit:backend-compile + verify

### Dependências
1. `esbuild@^0.25.0` — instalado

**Total de arquivos alterados/criados: 98**

---

## 6. PENDÊNCIAS PARA HOMOLOGAÇÃO RUNTIME (FASE 1)

O patch P0 está completo mecanicamente. Os seguintes passos são runtime e devem ser executados antes de declarar a FASE 1 homologada:

1. **RLS (Item 14):** Aplicar regras de Row-Level Security nas entidades críticas
2. **Security Scan:** Executar scan completo após RLS
3. **Criação de usuários de teste:** hq_admin, tenant_admin A, consultant A, client_viewer A, consultant B
4. **Testes same-tenant e cross-tenant:** Validar isolamento multi-tenant
5. **Teste do pending no primeiro login:** Validar fluxo end-to-end
6. **Teste client_viewer read-only:** Validar negação de mutações
7. **Teste das 11 functions corrigidas:** Validar ALLOW/DENY com usuários reais
8. **verify x3:** Executar `npm run verify` três vezes consecutivas sem limpeza manual

---

## 7. DECLARAÇÃO

```
BACKEND P0 CORRIGIDO E PRONTO PARA HOMOLOGAÇÃO RUNTIME
```

A FASE 1 NÃO está homologada. Os gates de compilação, RBAC e identidade estão verdes. As pendências de runtime (RLS, testes cross-tenant, testes com usuários reais) devem ser executadas antes da homologação final.