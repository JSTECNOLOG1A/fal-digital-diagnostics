# FAL Backend — API própria

NestJS + PostgreSQL (Prisma) + Redis + MinIO.

## Subir em 1 comando

```bash
cd backend
cp .env.example .env   # se ainda não existir
npm run setup
npm run start:dev
```

- API: http://localhost:3001/api/v1  
- Swagger: http://localhost:3001/docs  
- Credenciais seed: `admin@fal.local` / `FalTest123!`

## Segurança (baseline)

Ver `../docs/SECURITY_ISO27001_BASELINE.md`.

Controles ativos:
- JWT access curto + refresh rotativo (hash SHA-256)
- Senhas Argon2id
- RBAC deny-by-default (`hq_admin`, `tenant_admin`, `consultant`, `client_viewer`)
- Isolamento multi-tenant (TenantGuard + PostgreSQL RLS com `FORCE`)
- Role runtime `fal_app` sem BYPASSRLS
- Helmet, CORS allowlist, rate limit, ValidationPipe whitelist
- Audit log de ações sensíveis
- Credenciais Protheus com AES-256-GCM

## Domínio modelado (v0.1)

Plataforma: Tenant, User, RefreshToken, AuditLog, UserInvite  
Hierarquia: Group → Company → OperationalUnit  
Integração: ProtheusConnection / SyncJob / Staging  
FAL: MethodVersion, Client, Assessment  
LGPD: DataSubjectRequest  

Próximas sprints: FalQuestion/Response, Financial*, ActionPlan*, Reports.
