# BASE44 RLS — IMPLEMENTAÇÃO DE SEGURANÇA MULTI-TENANT

**Data:** 2026-07-12  
**Versão:** v3.0 (Patch de Fechamento — Fase 1)

---

## 1. MODELO DE IDENTIDADE

### Campos do Usuário

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `role` | built-in | Papel técnico Base44: `admin` \| `user` |
| `app_role` | custom | Papel operacional FAL: `hq_admin` \| `tenant_admin` \| `consultant` \| `client_viewer` |
| `tenant_id` | custom | Tenant do usuário (null para hq_admin) |
| `client_id` | custom | Para client_viewer apenas |

### Resolução Canônica (`resolveAppRole`)

```text
app_role válido? → usa app_role
role === 'admin'? → hq_admin (legacy compat)
role === 'user' sem app_role? → null (DENY)
```

### Contrato

| Papel Técnico | app_role | Escopo |
|---------------|----------|--------|
| admin | hq_admin | global |
| user | tenant_admin | tenant |
| user | consultant | tenant |
| user | client_viewer | tenant/read-only |
| user | null | DENY |

---

## 2. MATRIZ DE PERMISSÕES

### Read

| app_role | Escopo |
|----------|--------|
| hq_admin | global |
| tenant_admin | próprio tenant |
| consultant | próprio tenant |
| client_viewer | próprio tenant e recursos autorizados |
| null | DENY |

### Create/Update

| app_role | Escopo |
|----------|--------|
| hq_admin | global |
| tenant_admin | próprio tenant |
| consultant | próprio tenant, conforme área |
| client_viewer | DENY |
| null | DENY |

### Delete

| app_role | Escopo |
|----------|--------|
| hq_admin | global |
| tenant_admin | próprio tenant, quando permitido |
| consultant | DENY |
| client_viewer | DENY |
| null | DENY |

### Tenant Switch

| app_role | Permissão |
|----------|-----------|
| hq_admin | ALLOW |
| tenant_admin | DENY |
| consultant | DENY |
| client_viewer | DENY |
| null | DENY |

---

## 3. ENTIDADES CRÍTICAS

| Entidade | tenant_id | RLS Pattern |
|----------|-----------|-------------|
| Group | ✅ | Filter by tenant_id in all queries |
| Company | ✅ | Filter by tenant_id in all queries |
| OperationalUnit | ✅ | Filter by tenant_id in all queries |
| Assessment | ✅ | Filter by tenant_id + assertTenantAccess |
| FinancialDiagnosis | ✅ | Filter by tenant_id + assertTenantAccess |
| FinancialUpload | ✅ | Inherited from diagnosis |
| FinancialStatementLine | ✅ | Inherited from diagnosis |
| FinancialIndicatorSnapshot | ✅ | Inherited from diagnosis |
| FinancialFinding | ✅ | Inherited from diagnosis |
| ActionPlan | ✅ | Filter by tenant_id + assertTenantAccess |
| ActionTask | ✅ | Inherited from plan |
| Report | ✅ | Filter by tenant_id + assertTenantAccess |
| AssessmentReportVersion | ✅ | Inherited from assessment |
| FinancialAccountPlan | ✅ | Filter by tenant_id |
| FinancialAccountPlanLine | ✅ | Inherited from plan |
| Tenant | ✅ | HQ: all; others: own only |
| User | N/A | HQ: all; tenant_admin: own tenant; others: own only |

---

## 4. GUARDS BACKEND

### Padrão Canônico (todas as funções mutáveis)

```ts
const user = await base44.auth.me();
if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

const appRole = resolveAppRole(user);
const isHQ = appRole === 'hq_admin';

// Role guard
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
if (!WRITE_ROLES.has(appRole)) {
  return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });
}

// Tenant guard (canonical — from resource, not payload)
if (!isHQ && resource.tenant_id !== user.tenant_id) {
  return Response.json({ error: 'Forbidden: tenant mismatch' }, { status: 403 });
}
```

### DELETE Operations

```ts
const DELETE_ROLES = new Set(['hq_admin', 'tenant_admin']);
if (!DELETE_ROLES.has(appRole)) {
  return Response.json({ error: 'Forbidden: delete permission required' }, { status: 403 });
}
```

### HQ-Only Operations

```ts
if (appRole !== 'hq_admin') {
  return Response.json({ error: 'Forbidden: HQ only' }, { status: 403 });
}
```

---

## 5. RESOLUÇÃO CANÔNICA DE TENANT (CROSS-tenant FIXES)

### Princípio

O tenant_id deve ser derivado do **recurso autoritativo**, nunca do payload.

### Funções Corrigidas

| Função | Fix |
|--------|-----|
| deleteAccountPlan | Load plan → canonicalTenantId = plan.tenant_id → validate |
| assignGroupOrderNumber | Load group → canonicalTenantId = group.tenant_id → validate |
| convertFinancialRecommendation | Load rec + diagnosis → compare → derive canonical → validate |

### Padrão

```ts
const resource = await base44.asServiceRole.entities.X.get(resource_id);
if (!resource) return Response.json({ error: 'Not found' }, { status: 404 });

const canonicalTenantId = resource.tenant_id;

if (!isHQ && canonicalTenantId !== user.tenant_id) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

if (payload_tenant_id && payload_tenant_id !== canonicalTenantId) {
  return Response.json({ error: 'Tenant mismatch' }, { status: 403 });
}

// Use canonicalTenantId in ALL subsequent filters
```

---

## 6. CACHE E INVALIDATION (SEC-015)

### Query Key Factories (tenant-scoped)

```js
tenantKey(tenantId, ...parts)       → ['tenant', tenantId, ...parts]
financialKey(tenantId, diagId, ...) → ['tenant', tenantId, 'financial', diagId, ...]
assessmentKey(tenantId, assId, ...) → ['tenant', tenantId, 'assessment', assId, ...]
groupKey(tenantId, groupId, ...)    → ['tenant', tenantId, 'group', groupId, ...]
actionPlanKey(tenantId, ...)        → ['tenant', tenantId, 'actionplan', ...]
reportKey(tenantId, ...)            → ['tenant', tenantId, 'report', ...]
clientPortalKey(tenantId, ...)      → ['tenant', tenantId, 'portal', ...]
```

### Invalidation Rules

- `invalidateFinancialQueries(qc, diagId, tenantId)` — only touches queries where `key[1] === tenantId`
- Legacy fallback ONLY when `tenantId === null` (global admin context)
- Cross-tenant invalidation is blocked by design

---

## 7. FRONTEND GUARDS

### Route Policies (`routePolicies.js`)

| Tipo | Policy | client_viewer |
|------|--------|---------------|
| Read | `requireRead` | ALLOW |
| Write | `requireWrite` | DENY |
| Admin | `requireHQ` / `requireAdmin` | DENY |
| Portal | `allowAll` | ALLOW |

### PermissionGuard (UI mutations)

```jsx
<PermissionGuard area="actionplan">
  <Button>Nova Tarefa</Button>
</PermissionGuard>

<PermissionGuard requireDelete>
  <Button>Purge</Button>
</PermissionGuard>
```

### Areas

| Area | canManage* | client_viewer |
|------|-----------|---------------|
| group | canWrite | DENY |
| diagnosis | canWrite | DENY |
| questionnaire | canWrite | DENY |
| financial | canWrite | DENY |
| consolidation | canWrite | DENY |
| actionplan | canWrite | DENY |
| reviews | canWrite | DENY |
| reports | canWrite | DENY |
| users | isAdmin | DENY |
| exclusions | canDelete | DENY |
| tenant_switch | isHQ | DENY |

---

## 8. PROVISIONAMENTO DE USUÁRIOS

### assignUserAccessProfile (HQ-only)

- hq_admin pode atribuir qualquer role
- tenant_admin pode atribuir apenas consultant/client_viewer ao próprio tenant
- hq_admin deve ter tenant_id = null
- Nunca permitir auto-atribuição
- Registrar AuditLog

### migrateUserAccessProfiles (HQ-only, idempotent)

- Matriz explícita: `[{ email, app_role, tenant_id }]`
- Não infere tenant/role do domínio de email
- Usuários sem entrada na matriz → app_role = null → DENY
- Relatório before/after sem dados sensíveis

---

## 9. AUDITORES AUTOMATIZADOS

### audit:rbac-functions

Detecta:
- Função usa `user.role` diretamente em guards (deve usar `appRole`)
- Função mutável usa `asServiceRole` sem `resolveAppRole`
- Role guard existe como texto mas não é chamado antes da mutation
- Resource ID carregado depois de validar apenas `tenant_id` do payload
- Recurso autoritativo sem comparação de tenant
- Payload tenant sobrepõe tenant do recurso

### audit:seg02

Valida:
- Role guard presente
- Roles permitidas corretas
- Trust model (user-scoped vs service-role)
- Uso de `resolveAppRole`
- Presença de tenant guard autoritativo
- Coerência entre matriz e código

### audit:query-cache

Valida:
- Query keys tenant-scoped
- Factories incluem tenantId como primeiro elemento
- Invalidation não contamina cross-tenant
- Legacy fallback apenas quando tenantId = null