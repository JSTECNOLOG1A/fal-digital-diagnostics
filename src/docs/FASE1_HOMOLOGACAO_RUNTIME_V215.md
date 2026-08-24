# RELATÓRIO DE HOMOLOGAÇÃO RUNTIME — FASE 1

**Data:** 2026-07-13  
**Versão:** v2.15  
**Solicitante:** Engenheiro de Homologação  
**Status Final:** BLOCKED

---

## 1. DECLARAÇÃO FINAL

```
BLOCKED
```

A homologação runtime da Fase 1 **não pode ser declarada APROVADA** neste momento. Dos 12 cenários runtime, 1 (cenário 1) possui execução real comprovada (PASS) e 1 (cenário 10) possui prova parcial de backend (PARTIAL PASS — função `applyPendingUserAccessProfile` HTTP 200, pending→applied). Os 10 cenários restantes, o Security Scan e a aplicação de RLS permanecem BLOCKED por dependerem de ações de plataforma (Dashboard → Security) e sessões de usuário reais ("Act as a user") que não podem ser substituídas por análise estática, leitura de código ou testes unitários, conforme especificação.

---

## 2. GATES INDEPENDENTES (CONFIRMADOS PELO SOLICITANTE)

| Gate | Resultado |
| --- | --- |
| backend compile | 107/107 PASS |
| audit:seg02 | PASS |
| audit:query-cache | PASS |
| audit:rbac-functions | PASS |
| audit:identity-usage | PASS |
| test:ci | 212/212 PASS |
| lint | PASS |
| typecheck | PASS |
| build | PASS |
| verify (3 execuções) | PASS x3 |

**Nota:** Os gates acima são estáticos. A homologação runtime requer execução real de cenários com usuários autenticados, o que extrapola o escopo dos gates.

---

## 3. EVIDÊNCIA RUNTIME COLETADA

### 3.1 runtimeSecurityProof — Cenário 1 (HQ cross-tenant)

**Função:** `runtimeSecurityProof`  
**HTTP:** 200  
**Usuário executante:** locks.arnon@gmail.com (role: admin, app_role: hq_admin, tenant_id: null)

```json
{
  "ok": true,
  "user_email": "locks.arnon@gmail.com",
  "user_role": "admin",
  "is_hq": true,
  "scenario": "cross_tenant",
  "cross_tenant_ids_found": true,
  "tests": [
    {
      "function_name": "getAssessmentFlow",
      "payload": { "assessment_id": "6a3b24511cbe199d69c12284" },
      "http_status": 200,
      "allowed": true,
      "expected": "ALLOW",
      "actual": "ALLOW",
      "passed": true
    },
    {
      "function_name": "checkFinancialDiagnosisIntegrity",
      "payload": { "financial_diagnosis_id": "6a53ff9e27f0b5c3102ba79d" },
      "http_status": 200,
      "allowed": true,
      "expected": "ALLOW",
      "actual": "ALLOW",
      "passed": true
    }
  ],
  "summary": { "total": 2, "passed": 2, "failed": 0 },
  "all_passed": true
}
```

**Interpretação:** hq_admin acessou recursos de Tenant A e Tenant B, ambos retornaram HTTP 200 (ALLOW). Cross-tenant access para hq_admin comprovado em runtime.

### 3.2 assignUserAccessProfile — Validação do fluxo de atribuição

**Função:** `assignUserAccessProfile`  
**HTTP:** 200  
**Payload:** `{ user_id: "69badea1548aecb97d5048aa", app_role: "consultant", tenant_id: "69bab5ffb5fb104b5d7e08f3" }`

```json
{
  "success": true,
  "user": {
    "id": "69badea1548aecb97d5048aa",
    "email": "edertorres2305@gmail.com",
    "role": "user",
    "app_role": "consultant",
    "tenant_id": "69bab5ffb5fb104b5d7e08f3"
  }
}
```

**Interpretação:** Função de atribuição de perfil executada com sucesso. Compatibilidade built-in role (user → consultant) validada.

### 3.3 falHardeningReport — Diagnóstico do sistema

**Função:** `falHardeningReport`  
**HTTP:** 200

| Métrica | Valor |
| --- | --- |
| Health Score | 65/100 (Aceitável) |
| Fixes aplicados | 10 |
| Improvements aplicados | 5 |
| Riscos remanescentes | 7 (2 high, 3 medium, 2 low) |
| Live tests | 11 passed, 0 failed |

### 3.4 falTestSuite — Suite de testes backend

**Função:** `falTestSuite`  
**HTTP:** 422  
**Resultado:** 76/78 passed (2 failed)

**Nota:** Esta é a suite de testes unitários backend (distinta de `test:ci` que reporta 212/212 PASS). As 2 falhas são pré-existentes em `computeFalDiagnostic (unit)` e não estão relacionadas a segurança runtime.

### 3.5 applyPendingUserAccessProfile — Cenário 10 (fluxo de aplicação de perfil pendente)

**Função:** `applyPendingUserAccessProfile`
**HTTP:** 200
**Usuário executante:** locks.arnon@gmail.com (role: admin, app_role: hq_admin)

**Procedimento runtime:**
1. Criado PendingUserAccessProfile para `locks.arnon@gmail.com` com `app_role: hq_admin`, `expected_built_in_role: admin`, `status: pending`
2. Invocada função `applyPendingUserAccessProfile` via `test_backend_function` (executa como usuário autenticado real)
3. Resposta HTTP 200 com `success: true`

**Resposta da função (HTTP 200):**
```json
{
  "success": true,
  "applied": {
    "app_role": "hq_admin",
    "tenant_id": null,
    "role": "admin"
  }
}
```

**Verificação do estado da entidade após execução:**
```json
{
  "pendingForLocks": [{
    "id": "6a54e01a5d88db7e51f1b3bc",
    "email": "locks.arnon@gmail.com",
    "app_role": "hq_admin",
    "status": "applied",
    "applied_at": "2026-07-13T12:54:54.468Z",
    "applied_user_id": "69a73116dbdf09070bf71371"
  }],
  "locksUserAfter": {
    "email": "locks.arnon@gmail.com",
    "role": "admin",
    "app_role": "hq_admin",
    "tenant_id": null
  }
}
```

**Before/After comprovado:**
| Estado | status | applied_at | applied_user_id |
| --- | --- | --- | --- |
| Before | pending | — | — |
| After | applied | 2026-07-13T12:54:54.468Z | 69a73116dbdf09070bf71371 |

**Interpretação:** A função backend `applyPendingUserAccessProfile` executa corretamente em runtime: localiza o pending por `auth.me().email`, valida `expected_built_in_role`, aplica `app_role` e `tenant_id`, e marca o pending como `applied` com timestamp e user_id. O fluxo de primeiro login (AuthContext → applyPendingUserAccessProfile) está comprovado no nível da função backend. A integração completa (AuthContext dispara no primeiro login real) ainda requer um primeiro login de usuário convidado, mas a função backend está provada em runtime.

**Teste negativo de validação (404):** Invocação prévia com email sem pending retornou HTTP 404 (`"Nenhum perfil pendente encontrado para este email"`), comprovando que a função valida `auth.me()` e não aplica perfis arbitrários.

---

## 4. USUÁRIOS E TENANTS CONFIGURADOS

### 4.1 Tenants ativos

| Tenant | ID | Nome | Status |
| --- | --- | --- | --- |
| A | 69bab5ffb5fb104b5d7e08f3 | FAL - Consultoria | active |
| B | 69a9d9f7259dc1a2a91bd87f | Tenant teste | active |

### 4.2 Usuários existentes (verificados via asServiceRole.entities.User.list)

| Email | role | app_role | tenant_id | Tenant | Cenário |
| --- | --- | --- | --- | --- | --- |
| leonardofaustinocg@gmail.com | admin | hq_admin | null | — | 1 |
| locks.arnon@gmail.com | admin | hq_admin | null | — | 1 |
| apozzan08@gmail.com | admin | hq_admin | null | — | 1 (backup) |
| edertorres2305@gmail.com | user | consultant | 69bab5ffb5fb104b5d7e08f3 | FAL - Consultoria | 4 |

### 4.3 PendingUserAccessProfile criados (pending)

| Email | app_role | Tenant | expected_built_in_role | status |
| --- | --- | --- | --- | --- |
| fal.tenantadmin.a@test.com | tenant_admin | FAL - Consultoria | user | pending |
| fal.clientviewer.a@test.com | client_viewer | FAL - Consultoria | user | pending |
| fal.consultant.b@test.com | consultant | Tenant teste | user | pending |

### 4.4 Lacunas de usuários

| Perfil necessário | Status | Bloqueio |
| --- | --- | --- |
| admin + hq_admin | DISPONÍVEL | — |
| user + tenant_admin + Tenant A | PENDING criado | Usuário real precisa aceitar invite e logar |
| user + consultant + Tenant A | DISPONÍVEL (edertorres2305) | Não testável do sandbox sem sessão real |
| user + client_viewer + Tenant A | PENDING criado | Usuário real precisa aceitar invite e logar |
| user + consultant + Tenant B | PENDING criado | Usuário real precisa aceitar invite e logar |

### 4.5 Recursos cross-tenant disponíveis (evidência cenário 1)

| Tipo | Tenant A | Tenant B |
| --- | --- | --- |
| Assessments | 6 | 4 |
| Groups | 3 | 6 |

---

## 5. EXECUÇÃO DOS 12 CENÁRIOS RUNTIME

| # | Cenário | Usuário | role | app_role | Tenant sessão | Tenant recurso | Esperado | Real | HTTP | PASS/FAIL |
|---|---------|--------|------|----------|---------------|----------------|----------|------|------|-----------|
| 1 | HQ acessa A e B | locks.arnon@gmail.com | admin | hq_admin | — | A + B | ALLOW | ALLOW | 200 | PASS |
| 2 | tenant_admin A acessa A | — | user | tenant_admin | A | A | ALLOW | — | — | BLOCKED |
| 3 | tenant_admin A acessa B | — | user | tenant_admin | A | B | DENY | — | — | BLOCKED |
| 4 | consultant A mutation A | edertorres2305@gmail.com | user | consultant | A | A | ALLOW | — | — | BLOCKED |
| 5 | consultant A mutation B | edertorres2305@gmail.com | user | consultant | A | B | DENY | — | — | BLOCKED |
| 6 | client_viewer A abre ActionPlan | — | user | client_viewer | A | A | ALLOW (read) | — | — | BLOCKED |
| 7 | client_viewer RecDrawer zero mutation | — | user | client_viewer | A | A | zero mutation | — | — | BLOCKED |
| 8 | client_viewer TaskDrawer/TaskFullDrawer | — | user | client_viewer | A | A | zero mutation | — | — | BLOCKED |
| 9 | client_viewer chama backend → 403 | — | user | client_viewer | A | A | 403 | — | — | BLOCKED |
| 10 | primeiro login aplica Pending | locks.arnon@gmail.com | admin | hq_admin | — | — | pending aplicado | pending→applied (HTTP 200) | 200 | PARTIAL PASS |
| 11 | CRUD direto PendingUserAccessProfile | — | — | — | — | — | DENY | — | — | BLOCKED |
| 12 | usuário sem app_role → DENY | — | — | null | — | — | DENY | — | — | BLOCKED |

**Resumo:** 1 PASS, 1 PARTIAL PASS (backend), 10 BLOCKED

---

## 6. DETALHAMENTO DOS CENÁRIOS BLOCKED

### Cenário 1 — PASS (comprovado)
- **Evidência:** `runtimeSecurityProof` executou 2 testes cross-tenant (getAssessmentFlow em assessment do Tenant B, checkFinancialDiagnosisIntegrity em diagnosis do Tenant A/B), ambos HTTP 200 ALLOW.
- **Conclusão:** hq_admin acessa recursos de qualquer tenant. Compatível com especificação.

### Cenários 2, 3 (tenant_admin) — BLOCKED
- **Bloqueio:** Não existe usuário real com `role: user` + `app_role: tenant_admin` + `tenant_id: Tenant A`. PendingUserAccessProfile criado para `fal.tenantadmin.a@test.com`, mas o usuário precisa aceitar o invite, logar e executar a requisição.
- **Ação necessária:** Builder convida usuário real com email válido para tenant_admin + Tenant A, ou utiliza "Act as a user" no Dashboard.

### Cenários 4, 5 (consultant cross-tenant) — BLOCKED
- **Bloqueio:** edertorres2305@gmail.com está configurado como consultant + Tenant A (comprovado via assignUserAccessProfile HTTP 200). No entanto, a execução do cenário requer uma sessão autenticada como este usuário chamando um endpoint de mutation. O sandbox executa como service role, não como o usuário específico.
- **Ação necessária:** "Act as a user" edertorres2305@gmail.com no Dashboard, executar mutation em recurso A (ALLOW) e recurso B (DENY).

### Cenários 6, 7, 8 (client_viewer read-only) — BLOCKED
- **Bloqueio:** Não existe usuário real com `app_role: client_viewer`. PendingUserAccessProfile criado para `fal.clientviewer.a@test.com`, mas sem aceitação do invite.
- **Ação necessária:** Builder convida usuário real para client_viewer + Tenant A. Alternativamente, Testing Agent pode validar cenários 7 e 8 (read-only drawers) com goal: "Login as client_viewer and verify the recommendation drawer and task drawer have no mutation buttons."
- **Nota:** Testes unitários já comprovam que `readOnly={true}` desabilita todos os controles (21 testes em readonly-drawers.test.jsx), mas a especificação exige execução runtime real.

### Cenário 9 (client_viewer → 403) — BLOCKED
- **Bloqueio:** Requer usuário client_viewer autenticado chamando um endpoint de mutation backend. O sandbox executa como hq_admin (que recebe ALLOW, não 403).
- **Ação necessária:** "Act as a user" client_viewer, chamar função de mutation (ex: manageActionRecommendation), verificar HTTP 403.

### Cenário 10 (primeiro login aplica Pending) — PARTIAL PASS (backend comprovado)
- **Evidência runtime:** Função `applyPendingUserAccessProfile` executada via `test_backend_function` retornou HTTP 200 com `success: true`. PendingUserAccessProfile para locks.arnon@gmail.com passou de `status: pending` → `status: applied` com `applied_at: 2026-07-13T12:54:54.468Z` e `applied_user_id: 69a73116dbdf09070bf71371`. User.app_role permaneceu `hq_admin` (consistente). Teste negativo (email sem pending) retornou HTTP 404.
- **Pendente:** A integração completa (AuthContext dispara `applyPendingUserAccessProfile` no primeiro login de um usuário convidado real, sem app_role prévio) ainda requer um primeiro login real. O pending para `fal.tenantadmin.a@test.com`, `fal.clientviewer.a@test.com` e `fal.consultant.b@test.com` continua em `status: pending` aguardando login real.
- **Ação necessária:** Usuário convidado aceita invite, faz primeiro login. Verificar before (status: pending, User sem app_role) → after (status: applied, User.app_role e User.tenant_id atribuídos). O backend está provado; falta a integração de primeiro login.

### Cenário 11 (CRUD direto PendingUserAccessProfile → DENY) — BLOCKED
- **Bloqueio:** RLS não aplicada. Sem RLS, o CRUD direto na entidade pode funcionar para usuários autenticados. A negação só é garantida após aplicar as regras RLS no Dashboard.
- **Ação necessária:** Aplicar RLS (Seção 7), depois "Act as a user" (qualquer perfil), tentar CRUD direto em PendingUserAccessProfile via SDK client, verificar DENY.

### Cenário 12 (usuário sem app_role → DENY) — BLOCKED
- **Bloqueio:** Todos os 4 usuários existentes possuem app_role definido. Requer um usuário com `app_role: null` (ou indefinido) tentando acessar um endpoint protegido.
- **Ação necessária:** Criar usuário sem app_role (ou remover app_role de um usuário de teste temporariamente), tentar executar mutation, verificar DENY/403.

---

## 7. RLS — APLICAÇÃO OBRIGATÓRIA

**Status:** BLOCKED — Requer ação no Dashboard Base44

### Entidades que requerem RLS

| # | Entidade | hq_admin | tenant_admin | consultant | client_viewer | cross-tenant |
|---|----------|----------|--------------|------------|---------------|--------------|
| 1 | Group | global | próprio tenant | próprio tenant | leitura próprio tenant | DENY |
| 2 | Company | global | próprio tenant | próprio tenant | leitura próprio tenant | DENY |
| 3 | OperationalUnit | global | próprio tenant | próprio tenant | leitura próprio tenant | DENY |
| 4 | Assessment | global | próprio tenant | próprio tenant | leitura próprio tenant | DENY |
| 5 | FinancialDiagnosis | global | próprio tenant | próprio tenant | leitura próprio tenant | DENY |
| 6 | ActionPlan | global | próprio tenant | próprio tenant | leitura próprio tenant | DENY |
| 7 | ActionTask | global | próprio tenant | próprio tenant | leitura próprio tenant | DENY |
| 8 | ActionRecommendation | global | próprio tenant | próprio tenant | leitura próprio tenant | DENY |
| 9 | ActionPlanReview | global | próprio tenant | próprio tenant | leitura próprio tenant | DENY |
| 10 | AssessmentReportVersion | global | próprio tenant | próprio tenant | leitura próprio tenant | DENY |
| 11 | FinancialAccountPlan | global | próprio tenant | próprio tenant | leitura próprio tenant | DENY |
| 12 | User | global | próprio tenant | próprio tenant | leitura próprio tenant | DENY |
| 13 | PendingUserAccessProfile | DENY (todos) | DENY | DENY | DENY | DENY |

### PendingUserAccessProfile — Regras especiais

```text
Direct READ = DENY
Direct CREATE = DENY
Direct UPDATE = DENY
Direct DELETE = DENY
```

Acesso exclusivamente via functions autorizadas com service role:
- `inviteUserWithAccessProfile`
- `applyPendingUserAccessProfile`
- `migrateUserAccessProfiles`
- `assignUserAccessProfile`

### Procedimento

```text
Dashboard → Security → Entity-level permissions → [Entidade] → Apply rules
```

Aplicar para cada uma das 13 entidades listadas. Sem RLS aplicada, os cenários 3, 5, 9, 11, 12 não podem ser validados.

---

## 8. SECURITY SCAN

**Status:** BLOCKED — Requer ação no Dashboard Base44

### Procedimento

```text
Dashboard → Security → Start security check
```

### Resultado esperado

O Security Scan deve reportar:
- Entidades sem RLS (após aplicação da Seção 7, deve zerar)
- Funções sem guards de auth
- Vulnerabilidades de cross-tenant
- Exposição de dados sensíveis

### Entrega

O resultado integral do scan deve ser documentado, não apenas a confirmação de execução.

---

## 9. EVIDÊNCIAS OBRIGATÓRIAS — STATUS

| Evidência | Status | Observação |
| --- | --- | --- |
| prints "Act as a user" | BLOCKED | Requer Dashboard → Act as a user |
| status HTTP real | PARCIAL | Cenário 1: HTTP 200 (runtimeSecurityProof). Cenário 10: HTTP 200 (applyPendingUserAccessProfile). Cenários 2-9, 11-12: BLOCKED |
| before/after primeiro login | PARTIAL | Backend: pending→applied comprovado (status, applied_at, applied_user_id). Integração primeiro login real: BLOCKED |
| before/after mutations | BLOCKED | Requer sessão de usuário autenticado |
| prova ausência mutation (negados) | BLOCKED | Requer client_viewer logado abrindo drawers |
| relatório Security Scan | BLOCKED | Requer Dashboard → Security → Start |
| evidência regras RLS | BLOCKED | Requer Dashboard → Security → Entity permissions |

---

## 10. AÇÕES NECESSÁRIAS PARA DESBLOQUEAR

### 10.1 Builder — Ações no Dashboard

| # | Ação | Onde | Desbloqueia |
|---|------|------|-------------|
| 1 | Aplicar RLS para 13 entidades | Dashboard → Security → Entity permissions | Cenários 3, 5, 9, 11, 12 |
| 2 | Executar Security Scan | Dashboard → Security → Start security check | Security Scan |
| 3 | Convidar usuários reais (tenant_admin, client_viewer, consultant B) | Dashboard → Users → Invite | Cenários 2-10 |
| 4 | "Act as a user" para cada perfil | Dashboard → Users → Act as | Cenários 2-9 |
| 5 | Coletar prints e HTTP status | Dashboard → Act as a user | Evidências |

### 10.2 Testing Agent — Cenários 7 e 8

Após usuário client_viewer criado:

| Goal | Cenário |
| --- | --- |
| "Login as client_viewer and verify the recommendation drawer has no mutation buttons" | 7 |
| "Login as client_viewer and verify the task drawer and task full drawer have all inputs disabled" | 8 |

### 10.3 Cenário 10 — Primeiro login

1. Builder convida `fal.tenantadmin.a@test.com` (ou email real)
2. Antes do login: PendingUserAccessProfile.status = "pending" (comprovado neste relatório)
3. Usuário aceita invite e faz primeiro login
4. AuthContext dispara `applyPendingUserAccessProfile`
5. Depois do login: User.app_role = "tenant_admin", User.tenant_id = Tenant A, PendingUserAccessProfile.status = "applied"
6. Registrar before/after

---

## 11. RASTREABILIDADE TÉCNICA

### Gates estáticos (já verificados)
- 107 backend functions compilam (Deno.serve)
- 0 violações RBAC (audit:rbac-functions)
- 0 violações identidade (audit:identity-usage)
- 212/212 testes frontend (test:ci)
- read-only comprovado por 21 testes unitários (readonly-drawers.test.jsx)

### Evidência runtime coletada
- Cenário 1: runtimeSecurityProof → 2 cross-tenant tests PASS (HTTP 200)
- Cenário 10: applyPendingUserAccessProfile → HTTP 200, pending→applied com timestamp e user_id (backend comprovado)
- assignUserAccessProfile → HTTP 200 (perfil atribuído com sucesso)
- falHardeningReport → 11 live tests PASS
- falTestSuite → 76/78 backend unit tests PASS

### Lacunas runtime (BLOCKED)
- 10 de 12 cenários sem execução real (cenário 10 tem prova parcial de backend)
- RLS não aplicada
- Security Scan não executado
- 3 perfis de usuário sem usuário real autenticado (tenant_admin, client_viewer, consultant B)
- Integração de primeiro login (AuthContext → applyPending) sem login real de usuário convidado

---

## 12. CONCLUSÃO

A Fase 1 está tecnicamente preparada para homologação runtime (gates estáticos verdes, código read-only implementado e testado, usuários e dados de teste configurados). No entanto, a homologação runtime **não pode ser declarada APROVADA** porque:

1. **RLS não aplicada** — 13 entidades precisam de regras no Dashboard → Security
2. **Security Scan não executado** — Requer Dashboard → Security → Start
3. **10 cenários sem execução real** — Requerem "Act as a user" ou Testing Agent (cenário 10 tem prova parcial de backend)
4. **3 perfis de usuário pendentes** — tenant_admin, client_viewer, consultant B não têm usuários reais autenticados
5. **Integração de primeiro login** — Função backend comprovada, mas AuthContext→applyPending requer login real de usuário convidado

A especificação é clara: "Não substituir execução runtime por análise estática, leitura de código ou testes unitários" e "Qualquer cenário sem execução real deve permanecer BLOCKED."

**Status mantido:** BLOCKED

Para desbloquear, o builder deve executar as ações da Seção 10.1 no Dashboard Base44, coletar as evidências da Seção 9 e registrar os resultados na tabela da Seção 5. Quando todos os 12 cenários estiverem em PASS e o Security Scan estiver concluído, a declaração pode ser elevada para:

```text
HOMOLOGAÇÃO RUNTIME DA FASE 1 APROVADA
```

Até lá, qualquer declaração de aprovação seria substituir execução runtime por análise estática — expressamente proibido pela especificação.