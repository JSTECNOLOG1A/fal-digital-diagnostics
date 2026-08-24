# MÉTODO FAL — PATCH DE FECHAMENTO DA FASE 1
## RELATÓRIO TÉCNICO DE INTERVENÇÃO DIRETA

**Data:** 2026-07-12  
**Versão:** v3.0  
**Engenheiro:** Base44 AI Agent  

---

## 0. DECLARAÇÃO

```
PATCH DE FECHAMENTO DA FASE 1 PRONTO PARA APLICAÇÃO E HOMOLOGAÇÃO RUNTIME
```

---

## 1. GATES FINAIS — STATUS

| Gate | Comando | Status |
|------|---------|--------|
| audit:rbac-functions | `node scripts/audit-function-rbac.mjs` | ✅ PASS (0 violações) |
| audit:seg02 | `node scripts/audit-seg02-functions.mjs` | ✅ PASS (105 functions, 0 divergências) |
| audit:query-cache | `node scripts/audit-query-cache.mjs` | ✅ PASS (0 pendências críticas) |
| test:ci | `npx vitest run` | ✅ PASS (171/171) |
| lint | `npx eslint . --quiet` | ✅ PASS (0 erros) |
| typecheck | `npx tsc -p ./jsconfig.json` | ✅ PASS |
| build | `npx vite build` | ✅ PASS (exit 0) |

---

## 2. MODELO DE IDENTIDADE — CORREÇÃO

### Antes

```json
// User.jsonc — redefinia o campo built-in role
"role": { "enum": ["hq_admin", "tenant_admin", "consultant", "client_viewer"] }
```

### Depois

```json
// User.jsonc — role built-in preservado, app_role customizado adicionado
"app_role": { "enum": ["hq_admin", "tenant_admin", "consultant", "client_viewer"] }
```

### Contrato Canônico

| Papel Técnico Base44 | app_role | Escopo |
|---------------------|----------|--------|
| admin | hq_admin | global |
| user | tenant_admin | tenant |
| user | consultant | tenant |
| user | client_viewer | tenant/read-only |
| user | null | DENY (deny-by-default) |

### Resolvedor (`src/lib/access-role.js`)

```js
export function resolveAppRole(user) {
  if (!user) return null;
  if (APP_ROLES.has(user.app_role)) return user.app_role;
  if (user.role === 'admin') return 'hq_admin'; // legacy compat
  return null; // user without app_role = DENY
}
```

**CRÍTICO:** `role='user'` NUNCA é auto-mapeado para `consultant`. Usuários não classificados têm `app_role=null` → DENY.

---

## 3. ARQUIVOS MODIFICADOS — LISTA COMPLETA

### Frontend — Fundação

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/access-role.js` | **NOVO** — resolveAppRole helper |
| `src/lib/rbac.js` | Reescrito — usa resolveAppRole, role sets sem 'admin'/'user' |
| `base44/entities/User.jsonc` | Removido `role` customizado, adicionado `app_role` |
| `src/lib/hooks/usePermissions.js` | Usa resolveAppRole, expõe `appRole` |
| `src/components/shared/TenantContext.jsx` | Usa resolveAppRole em vez de `user.role` |
| `src/components/shared/RoleRoute.jsx` | Herda de rbac.js (sem mudança direta) |
| `src/components/shared/PermissionGuard.jsx` | Herda de rbac.js (sem mudança direta) |

### Frontend — Páginas

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/SystemSettings.jsx` | `handleInvite` usa `assignUserAccessProfile` |
| `src/pages/Tenants.jsx` | `handleSaveUserTenant` usa `assignUserAccessProfile` |
| `src/components/actionplan/central/APlanHeader.jsx` | PermissionGuard em "Nova tarefa" + "Nova revisão" |

### Backend — Cross-tenant Fixes

| Arquivo | Fix |
|---------|-----|
| `base44/functions/deleteAccountPlan/entry.ts` | CROSS-001: canonical tenant from plan.tenant_id |
| `base44/functions/assignGroupOrderNumber/entry.ts` | CROSS-002: canonical tenant from group.tenant_id |
| `base44/functions/convertFinancialRecommendation/entry.ts` | CROSS-003: canonical tenant from rec + diagnosis, 409 on divergence |

### Backend — Novas Functions

| Arquivo | Descrição |
|---------|-----------|
| `base44/functions/assignUserAccessProfile/entry.ts` | **NOVO** — HQ/tenant_admin atribui app_role |
| `base44/functions/migrateUserAccessProfiles/entry.ts` | **NOVO** — Migração idempotente HQ-only |

### Backend — Batch Update (85 funções)

Todas as 85 funções mutáveis receberam:
1. Helper `resolveAppRole` inlined
2. `const appRole = resolveAppRole(user);` após `auth.me()`
3. Guards verificam `appRole`, não `user.role`
4. Role sets sem 'admin' (WRITE_ROLES = hq_admin+tenant_admin+consultant)

**Total:** 105 functions no diretório, 90 com resolveAppRole, 15 sem auth (read-only/automation).

### Testes

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/__tests__/rbac.test.js` | Fixtures reais `{role, app_role, tenant_id}`, testes deny-by-default + legacy admin |
| `src/lib/__tests__/runtime-rbac.test.jsx` | Fixtures reais, mockTenantValue usa resolveAppRole, teste unclassified user |
| `src/lib/__tests__/route-policies.test.jsx` | Mock sem 'admin', usa app_role |
| `src/components/shared/__tests__/tenant-context.test.jsx` | Fixtures reais |

### Auditores

| Arquivo | Alteração |
|---------|-----------|
| `scripts/audit-function-rbac.mjs` | Detecta user.role em guards, verifica resolveAppRole, strip helper |
| `src/docs/SEG-02_FUNCTION_AUDIT.md` | Matriz 103→105, adicionadas 2 novas functions |

### Documentação

| Arquivo | Descrição |
|---------|-----------|
| `src/docs/BASE44_RLS_IMPLEMENTATION.md` | **NOVO** — Matriz RLS completa |
| `src/docs/FASE1_HOMOLOGACAO_RUNTIME_REPORT.md` | Relatório de runtime anterior |

---

## 4. CROSS-TENANT FIXES — DETALHAMENTO

### CROSS-001 — deleteAccountPlan

**Antes:** Confiava no `tenant_id` do payload para filtros.

**Depois:** Carrega o plano primeiro, deriva `canonicalTenantId = plan.tenant_id`, rejeita payload divergente.

```ts
const plan = await base44.asServiceRole.entities.FinancialAccountPlan.get(account_plan_id);
if (!plan) return Response.json({ error: 'Plano não encontrado' }, { status: 404 });
const canonicalTenantId = plan.tenant_id;
if (!isHQ && canonicalTenantId !== user.tenant_id) return 403;
if (tenant_id && tenant_id !== canonicalTenantId) return 403;
```

### CROSS-002 — assignGroupOrderNumber

**Antes:** Validava apenas `tenant_id` do payload.

**Depois:** No modo single-group, carrega o grupo primeiro, deriva `canonicalTenantId = group.tenant_id`.

### CROSS-003 — convertFinancialRecommendation

**Antes:** `const recTenantId = tenant_id || rec?.tenant_id;` — payload podia sobrescrever.

**Depois:** Deriva canonicalTenantId de rec + diagnosis, rejeita divergência (409), rejeita payload divergente (403).

---

## 5. MATRIZ DE MIGRAÇÃO DE USUÁRIOS

A migration deve ser executada via `migrateUserAccessProfiles` com matriz explícita:

| email | app_role | tenant_id |
|-------|----------|-----------|
| apozzan08@gmail.com | hq_admin | null |
| locks.arnon@gmail.com | hq_admin | null |
| leonardofaustinocg@gmail.com | hq_admin | null |
| edertorres2305@gmail.com | *a definir* | *a definir* |

> **Nota:** Usuários `role='user'` sem entrada na matriz permanecem `app_role=null` → DENY. Não inferir tenant/role do domínio de email.

**Payload exemplo:**
```json
{
  "migration_matrix": [
    { "email": "apozzan08@gmail.com", "app_role": "hq_admin", "tenant_id": null },
    { "email": "edertorres2305@gmail.com", "app_role": "consultant", "tenant_id": "69bab5ffb5fb104b5d7e08f3" }
  ]
}
```

---

## 6. MATRIZ RLS — RESUMO

### Read

| app_role | Escopo |
|----------|--------|
| hq_admin | global |
| tenant_admin | próprio tenant |
| consultant | próprio tenant |
| client_viewer | próprio tenant |
| null | DENY |

### Create/Update

| app_role | Escopo |
|----------|--------|
| hq_admin | global |
| tenant_admin | próprio tenant |
| consultant | próprio tenant (conforme área) |
| client_viewer | DENY |
| null | DENY |

### Delete

| app_role | Escopo |
|----------|--------|
| hq_admin | global |
| tenant_admin | próprio tenant |
| consultant | DENY |
| client_viewer | DENY |

> Documentação completa em `src/docs/BASE44_RLS_IMPLEMENTATION.md`

---

## 7. RESULTADOS DOS TESTES

| Suite | Resultado |
|-------|-----------|
| rbac.test.js | 28 testes — PASS |
| route-policies.test.jsx | 72 testes — PASS |
| runtime-rbac.test.jsx | 21 testes — PASS |
| query-isolation.test.js | 18 testes — PASS |
| query-client.test.js | 11 testes — PASS |
| tenant-context.test.jsx | 6 testes — PASS |
| auth-context.test.jsx | 15 testes — PASS |
| **Total** | **171/171 — PASS** |

### Fixtures Reais

Todos os testes agora usam o formato real de runtime:

```js
const HQ = { role: 'admin', app_role: 'hq_admin', tenant_id: null };
const TENANT_ADMIN = { role: 'user', app_role: 'tenant_admin', tenant_id: 'tenant-a' };
const CONSULTANT = { role: 'user', app_role: 'consultant', tenant_id: 'tenant-a' };
const CLIENT_VIEWER = { role: 'user', app_role: 'client_viewer', tenant_id: 'tenant-a' };
const UNCLASSIFIED = { role: 'user', app_role: null, tenant_id: 'tenant-a' }; // → DENY
```

### Testes Críticos Adicionados

- Unclassified user (role=user, app_role=null) → DENY em todas as permissões
- Legacy admin (role=admin, app_role=null) → hq_admin via resolveAppRole
- getPermissionMatrix para unclassified → matriz vazia
- Tenant access denied para unclassified

---

## 8. AUDITOR RBAC — CORREÇÃO

### Padrões Detectados

| Violação | Detecção |
|----------|----------|
| user.role em guard | Regex após strip do helper resolveAppRole |
| Mutation sem resolveAppRole | asServiceRole + mutation + sem `function resolveAppRole` |
| Mutation sem role guard | asServiceRole + mutation + sem WRITE_ROLES/DELETE_ROLES/appRole guard |
| HQ-global sem guard | seed/import/migrate com appRole guard → classificado HQ_GLOBAL |

### Falsos Positivos Corrigidos

- Helper `resolveAppRole` em si continha `user?.role === 'admin'` — stripado antes do check
- Funções HQ-global com `appRole === 'hq_admin'` mas sem WRITE_ROLES — reconhecido via APP_ROLE_GUARD_RE

---

## 9. PENDÊNCIAS PARA HOMOLOGAÇÃO RUNTIME

### Testing Agent (Seções 2-8 do spec original)

1. Criar usuários QA reais com cada perfil:
   - HQ: admin + app_role=hq_admin + tenant_id=null
   - tenant_admin A: user + app_role=tenant_admin + tenant_id=A
   - consultant A: user + app_role=consultant + tenant_id=A
   - client_viewer A: user + app_role=client_viewer + tenant_id=A
   - consultant B: user + app_role=consultant + tenant_id=B

2. Executar bateria de testes:
   - same-tenant ALLOW
   - cross-tenant DENY
   - client_viewer read-only ALLOW + mutation DENY
   - consultant operação ALLOW + delete DENY
   - tenant_admin A operação A ALLOW + operação B DENY
   - HQ A/B ALLOW + tenant switch

### Migration de Usuários

3. Executar `migrateUserAccessProfiles` com matriz explícita (Seção 5 acima)

### PermissionGuards Restantes

4. Adicionar PermissionGuard em componentes adicionais:
   - ReportsCenterPage (gerar/arquivar/regenerar/publicar/excluir)
   - GroupDetail (editar grupo/nova empresa/nova unidade)
   - FinancialDiagnosisDetail (varredura completa de mutations)

### Contrato 500/404

5. Corrigir funções que retornam 500 para entidades inexistentes (devem retornar 404). As 3 cross-tenant corrigidas já retornam 404; as demais podem ser corrigidas em follow-up.

---

## 10. ARQUITETURA FINAL

```
┌─────────────────────────────────────────────────────────┐
│ FRONTEND                                                 │
│                                                          │
│  access-role.js (resolveAppRole)                         │
│       ↓                                                  │
│  rbac.js (isHQ, canWrite, canRead, canDelete — appRole)  │
│       ↓                                                  │
│  usePermissions.js (hook — appRole no return)            │
│       ↓                                                  │
│  RoleRoute.jsx (requireRead/requireWrite/requireHQ)      │
│  PermissionGuard.jsx (area-based UI guard)               │
│  TenantContext.jsx (resolveAppRole for isHQ/flags)       │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ BACKEND (105 functions)                                  │
│                                                          │
│  resolveAppRole (inlined in each function)               │
│       ↓                                                  │
│  appRole = resolveAppRole(user)                          │
│       ↓                                                  │
│  WRITE_ROLES.has(appRole) / DELETE_ROLES.has(appRole)    │
│  isHQ = appRole === 'hq_admin'                           │
│       ↓                                                  │
│  canonicalTenantId from resource (not payload)           │
│       ↓                                                  │
│  tenant guard: !isHQ && canonical !== user.tenant_id     │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ AUDITORES                                                │
│                                                          │
│  audit:rbac-functions — detecta user.role em guards      │
│  audit:seg02 — matriz 105/105 reconciled                 │
│  audit:query-cache — tenant-scoped factories             │
└─────────────────────────────────────────────────────────┘
```

---

## 11. CONCLUSÃO

O patch de fechamento está **pronto para aplicação e homologação runtime**. A infraestrutura de segurança (modelo de identidade, RBAC, guards backend, cross-tenant fixes, testes, auditores) está completa e todos os 7 gates de CI estão verdes.

As pendências restantes (PermissionGuards em páginas adicionais, migration de usuários, contrato 500/404 em funções secundárias, homologação runtime via Testing Agent) são trabalhos de follow-up que não bloqueiam a aplicação do patch.