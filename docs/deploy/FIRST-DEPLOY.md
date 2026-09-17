# Primeiro deploy — Método FAL

Checklist para o **primeiro** ambiente em https://metodofal.clarityib.com.br

## Pré-requisitos

- [ ] VPS Clarity com Docker + Traefik (`traefik-net` existente)
- [ ] DNS A: `metodofal.clarityib.com.br` → IP do VPS
- [ ] Código deste repo no servidor em `/var/www/html/metodofal`
- [ ] Arquivo `.env.production` criado **no servidor** (nunca no Git)

## 1. DNS

No painel DNS do domínio `clarityib.com.br`:

| Tipo | Nome | Valor |
|---|---|---|
| A | `metodofal` | IP público do VPS |

Confirme:

```bash
dig +short metodofal.clarityib.com.br A
```

## 2. Secrets no VPS

```bash
cd /var/www/html/metodofal
cp .env.production.example .env.production
nano .env.production   # ou vim
chmod 600 .env.production
```

| Variável | Regra |
|---|---|
| `POSTGRES_PASSWORD` / `FAL_APP_PASSWORD` | Fortes e **diferentes** |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥32 chars cada, diferentes |
| `CREDENTIALS_ENCRYPTION_KEY` | 64 chars hex (32 bytes) |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Fortes e **diferentes**; usados pelo storage de uploads/relatórios financeiros |
| `SEED_HQ_PASSWORD` | ≥12 chars; anote em local seguro |
| `CORS_ORIGINS` | `https://metodofal.clarityib.com.br` |
| `RUN_SEED_ON_BOOT` | `true` só no primeiro boot |

Gerar secrets (exemplo):

```bash
openssl rand -base64 48
openssl rand -hex 32
```

## 3. Subir stack

```bash
cd /var/www/html/metodofal
docker network inspect traefik-net >/dev/null   # deve existir
docker compose -f docker-compose.traefik.yml --env-file .env.production up -d --build
docker compose -f docker-compose.traefik.yml --env-file .env.production ps
```

Aguarde `fal-prod-api` e `fal-prod-web` ficarem **healthy**.

## 4. Smoke

```bash
curl -sk https://metodofal.clarityib.com.br/api/v1/health
curl -sk -o /dev/null -w '%{http_code}\n' https://metodofal.clarityib.com.br/
```

1. [ ] Health API 200  
2. [ ] Front 200  
3. [ ] Login com `SEED_HQ_EMAIL` / `SEED_HQ_PASSWORD`  
4. [ ] Após sucesso: `RUN_SEED_ON_BOOT=false` no `.env.production` e `docker compose ... up -d` (sem rebuild obrigatório)

## 5. Rollback rápido

```bash
cd /var/www/html/metodofal
docker compose -f docker-compose.traefik.yml --env-file .env.production down
# Volumes fal_prod_pgdata / fal_prod_redis são preservados até docker volume rm
```

## Referências

- Atualizar produção: [`UPDATE.md`](./UPDATE.md)
- Prompt Claude Code / Cursor: [`PROMPT-AGENTE-DEPLOY.md`](./PROMPT-AGENTE-DEPLOY.md)
- Instruções Claude Code: [`CLAUDE.md`](../../CLAUDE.md)
- Segurança: [`../SECURITY_ISO27001_BASELINE.md`](../SECURITY_ISO27001_BASELINE.md)
