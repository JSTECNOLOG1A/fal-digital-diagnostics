# Baseline de segurança — ISO/IEC 27001 (e LGPD)

Este documento mapeia controles implementados no backend FAL (`backend/`) contra a ISO/IEC 27001:2022 e requisitos de privacidade (LGPD / alinhamento ISO 27701).

> Não substitui certificação formal. É o **baseline técnico** do produto para auditoria interna e evolução contínua.

## Controles implementados

| Tema ISO 27001 | Controle | Implementação FAL |
|---|---|---|
| A.5 Políticas | Política de segurança da informação | Este baseline + deny-by-default RBAC |
| A.5.15 / A.8.2 | Controle de acesso / classificação | Roles `hq_admin`, `tenant_admin`, `consultant`, `client_viewer` |
| A.8.3 | Restrição de acesso | `RolesGuard` + `TenantGuard` + RLS PostgreSQL |
| A.8.5 | Autenticação segura | Argon2id + JWT access 15m + refresh rotativo |
| A.8.9 | Gestão de configuração | `.env` separado; secrets fora do código |
| A.8.10 | Restrição de software | Dependências pinadas; Node ≥ 20 |
| A.8.11 | Mascaramento de dados | Sem dump de senha; hash apenas; Protheus AES-GCM |
| A.8.12 | Prevenção de vazamento | CORS allowlist; sem stack em prod (filter) |
| A.8.15 | Logging | `AuditLog` + `X-Request-Id` |
| A.8.16 | Monitoramento | Healthcheck `/health`; throttling 120/min |
| A.8.24 | Uso de criptografia | TLS (deploy); AES-256-GCM credenciais; Argon2id |
| A.8.25 / A.8.26 | SDLC seguro | ValidationPipe whitelist; Prisma tipado |
| A.5.34 / privacidade | Privacidade PII | `DataSubjectRequest`; matriz LGPD Fase 5 no frontend |
| A.8.10 / backup | Disponibilidade | Volumes Docker; backup/restore Fase 5 (próximo) |

## Isolamento multi-tenant (crítico)

1. **Aplicação:** `TenantGuard` valida `tenantId` em body/query/header/rota.  
2. **Banco:** políticas RLS com `app.tenant_id` / `app.is_hq`.  
3. **FORCE RLS:** tabelas de domínio forçam política mesmo para owner.  
4. **Runtime role:** `fal_app` sem `BYPASSRLS`; migrations usam `DATABASE_URL_OWNER`.  
5. **Interceptor:** `TenantRlsInterceptor` define session vars por request JWT.

## Autenticação e sessão

- Access token JWT curto (`JWT_ACCESS_TTL`, default 15m)
- Refresh token opaco armazenado como SHA-256; rotação no refresh
- Logout revoga refresh
- Contas `revoked` / `suspended` rejeitadas na strategy JWT

## Requisitos de produção (checklist)

- [ ] Trocar todas as senhas/secrets do `.env`
- [ ] Postgres com TLS e backups automatizados
- [ ] HTTPS / reverse proxy (TLS 1.2+)
- [ ] `NODE_ENV=production`
- [ ] Rotação de `JWT_*` e `CREDENTIALS_ENCRYPTION_KEY`
- [ ] Alertas em falhas de auth e rate-limit
- [ ] Revisar retenção de `audit_logs` e DSR (LGPD art. 18)
- [ ] Pen-test / revisão de segurança antes de go-live

## Fora do escopo desta sprint

- WAF / SIEM integrado
- MFA obrigatório
- Cofre de secrets (Vault/KMS) — usar em deploy cloud
- Modelagem completa Financial / ActionPlan / Report
