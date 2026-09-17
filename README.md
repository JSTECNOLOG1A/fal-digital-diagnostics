**Welcome to FAL Digital Diagnostics**

Diagnóstico financeiro e plano de contas (React/Vite + NestJS).

## Desenvolvimento local

1. Clone o repositório
2. `npm install` (raiz) e `npm install` em `backend/`
3. Frontend: `.env.local` (modo local — `VITE_LOCAL_TEST_AUTH=true`)
4. Backend: `backend/.env` a partir de `backend/.env.example`, depois `npm run setup --prefix backend`
5. `npm run dev` + `npm run dev:api`

## Produção (VPS Clarity + Traefik)

| Item | Valor |
|---|---|
| URL | https://metodofal.clarityib.com.br |
| Path no VPS | `/var/www/html/metodofal` |
| Compose | `docker-compose.traefik.yml` |

Documentação completa:

- [`docs/deploy/UPDATE.md`](docs/deploy/UPDATE.md) — fluxo de entrega
- [`docs/deploy/FIRST-DEPLOY.md`](docs/deploy/FIRST-DEPLOY.md) — primeiro deploy
- [`docs/deploy/PROMPT-AGENTE-DEPLOY.md`](docs/deploy/PROMPT-AGENTE-DEPLOY.md) — prompt Claude Code / Cursor
- [`CLAUDE.md`](CLAUDE.md) — regras persistentes para Claude Code

## Base44 (legado)

Este projeto nasceu no Base44. O backend próprio (Nest) é o caminho atual; o Builder Base44 ainda pode refletir pushes se configurado.

Docs Base44: https://docs.base44.com/Integrations/Using-GitHub
