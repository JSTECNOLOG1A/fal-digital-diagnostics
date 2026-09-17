# Método FAL (fal-digital-diagnostics) — instruções para Claude Code

Diagnóstico financeiro / plano de contas (React/Vite + NestJS/Prisma + Postgres).  
Responda sempre em **português**.

## Entrega obrigatória (Git + Deploy)

Ao terminar um ajuste, **pergunte** se deve salvar no Git / push / deploy — a menos que o usuário já tenha pedido.

Siga `docs/deploy/UPDATE.md`. Prompt completo: `docs/deploy/PROMPT-AGENTE-DEPLOY.md`.

### Ordem
1. Código testado localmente
2. **Commit** (só se pedido)
3. **Push** (só se pedido)
4. **Deploy VPS** (só se pedido): `/var/www/html/metodofal` +  
   `docker compose -f docker-compose.traefik.yml --env-file .env.production up -d --build`
5. Smoke: containers `healthy`, `/api/v1/health` 200, validar a feature

### Proibido
- Commitar `.env`, `.env.local`, `.env.production`, `backend/.env`, senhas, tokens, chaves, dumps
- `git push --force` em `main`/`master`
- Deploy de working tree não commitada
- Sobrescrever `.env.production` no VPS
- Apagar volumes Docker de produção sem pedido explícito
- Inventar ou repetir senhas de servidor no chat se evitável

### Commit
- Mensagem curta em português, foco no **porquê**
- Usar HEREDOC: `git commit -m "$(cat <<'EOF' ... EOF)"`
- Se hook falhar: corrigir e **novo** commit (não amend, salvo pedido explícito + condições seguras)

### Produção
- Host: https://metodofal.clarityib.com.br
- Containers: `fal-prod-web`, `fal-prod-api`, `fal-prod-postgres`, `fal-prod-redis`, `fal-prod-minio`
- Aguardar healthy antes de declarar sucesso
- Relatar hash do commit deployado

## Dev local (resumo)

```bash
# Frontend
cp .env.local.example .env.local   # se existir; senão use o .env.local documentado no README
npm install && npm run dev

# Backend
cd backend && cp .env.example .env
npm run setup && npm run start:dev
```

Login local típico: `admin@fal.local` (ver `src/lib/localTestAuth.js` / seed).

## Frases úteis do usuário
- “Salvar no git”
- “Salvar, push e deploy”
- “Só deploy do commit atual”
