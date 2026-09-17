# Atualizar produção — Método FAL (fal-digital-diagnostics)

Guia curto para o time (Claude Code / Cursor). Deploy: **manual** no VPS Clarity (Traefik).

| Item | Valor |
|---|---|
| Domínio | https://metodofal.clarityib.com.br |
| Código no servidor | `/var/www/html/metodofal` |
| Compose | `docker-compose.traefik.yml` |
| Env | `.env.production` (**só no servidor**, nunca no Git) |
| Containers | `fal-prod-web`, `fal-prod-api`, `fal-prod-postgres`, `fal-prod-redis`, `fal-prod-minio` |
| Rede Traefik | `traefik-net` (externa, já existe no VPS) |

---

## Fluxo obrigatório (cada entrega)

```
1. Ajuste local → teste
2. Commit no Git
3. Push para origin
4. Sync do código no VPS
5. docker compose up -d --build
6. Smoke test (health + tela afetada)
```

Nunca faça deploy de código que **não** esteja commitado.  
Nunca faça push de `.env`, senhas ou chaves.

---

## 1. No notebook (dev)

```bash
cd /caminho/para/fal-digital-diagnostics
git pull
# ... alterações + teste local ...
git status
git add <arquivos relevantes>
git commit -m "mensagem clara do porquê"
git push origin HEAD
```

### Segurança no Git

- **Não** commitar: `.env`, `.env.local`, `.env.production`, `backend/.env`, credenciais, dumps, chaves SSH
- Evitar `git push --force` em `main`/`master`
- Preferir commits pequenos e revisáveis

---

## 2. No VPS (produção)

```bash
cd /var/www/html/metodofal

# Se o diretório for um clone Git:
git pull

# Rebuild e sobe (migrations rodam no boot da API)
docker compose -f docker-compose.traefik.yml --env-file .env.production up -d --build
```

Se o VPS **não** tiver Git remoto, sincronize o tree commitado via `rsync`/`scp` e rode o mesmo `docker compose`.

### Rebuild parcial (opcional)

| Mudança | Comando sugerido |
|---|---|
| Só frontend (`src/…`) | `... up -d --build web` |
| API / migrations / backend | `... up -d --build api` (ou stack completa) |
| Compose / env / ambos | stack completa (`up -d --build`) |

**Não** edite nem sobrescreva `.env.production` no servidor sem alinhamento do time.

Após o **primeiro** deploy bem-sucedido, defina `RUN_SEED_ON_BOOT=false` no `.env.production` (evita re-seed a cada restart).

---

## 3. Smoke test pós-deploy

```bash
docker ps --filter name=fal-prod
# Esperar fal-prod-web e fal-prod-api = healthy

curl -sk https://metodofal.clarityib.com.br/api/v1/health
curl -sk -o /dev/null -w '%{http_code}\n' https://metodofal.clarityib.com.br/
curl -sk -o /dev/null -w '%{http_code}\n' https://metodofal.clarityib.com.br/healthz
```

1. Health API → 200 (`{"status":"ok",...}`)  
2. Front carrega (hard refresh se cache)  
3. Login HQ com `SEED_HQ_EMAIL` / senha do `.env.production`  
4. Validar a tela/fluxo alterado  

Traefik pode responder `404` enquanto o container está `starting`/`unhealthy` — aguarde **healthy**.

---

## Checklist rápido

- [ ] `git status` limpo (ou só arquivos intencionais)
- [ ] Commit feito
- [ ] Push feito (`origin` atualizado)
- [ ] Código no VPS sincronizado com o commit
- [ ] `docker compose ... up -d --build` ok
- [ ] Containers healthy
- [ ] Health + smoke da feature ok
- [ ] `.env.production` intacto

---

## Prompt para o agente (Claude Code / Cursor)

- **Claude Code:** leia [`CLAUDE.md`](../../CLAUDE.md) na raiz. Na entrega, use [`PROMPT-AGENTE-DEPLOY.md`](./PROMPT-AGENTE-DEPLOY.md) ou diga: “Salvar no git, push e deploy”.
- **Cursor:** cole o prompt em [`PROMPT-AGENTE-DEPLOY.md`](./PROMPT-AGENTE-DEPLOY.md) ou @ a rule `deploy-seguro`.

Primeiro deploy / secrets: [`FIRST-DEPLOY.md`](./FIRST-DEPLOY.md).
