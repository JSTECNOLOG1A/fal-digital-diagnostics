# RC-1 — Manifesto da release candidata v2.62

- Versão: `FAL-v2.62`.
- Build SHA: gerado no `prebuild` pelo SHA-256 da árvore-fonte ou recebido em `FAL_BUILD_SHA`.
- jsPDF: `4.2.1` fixado em `package.json` e `package-lock.json`.
- Correções RC-1: entrada automática no onboarding; convite inicial por HQ/tenant_admin; correlation_id persistido no support bundle.
- Mutation da FASE 4: separada em `hardening:phase4-mutations`; não integra o gate bloqueante `verify:rc1`.
- Pacote: não deve conter `node_modules`, `dist`, `.git`, ZIPs antigos ou `src/docs/audit-artifacts`.
- Go Live: proibido sem tabela operacional completa e gates de release aprovados.