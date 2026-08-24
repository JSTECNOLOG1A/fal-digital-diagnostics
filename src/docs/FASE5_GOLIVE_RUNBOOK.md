# RC-1 — Runbook de Go Live e rollback

## Antes da janela
1. Executar `npm ci`, auditoria de dependências e `npm run verify:rc1` em árvore limpa.
2. Confirmar jsPDF 4.2.1, critical=0, versão e build SHA exibidos no healthcheck.
3. Executar os oito fluxos da FASE 4 e todos os controles RC-1 com IDs e evidências.
4. Exportar backup integral por tenant, validar checksums e executar restore dry-run contra destino conhecido.

## Critério GO
- Todos os controles bloqueantes RC1-01 a RC1-10 em PASS/ACEITO.
- Zero falha operacional aberta.
- Release ZIP e SHA-256 coincidentes.

## Rollback
1. Suspender novos writes e registrar horário/correlation_id da decisão.
2. Reaplicar a release anterior identificada pelo SHA registrado no manifesto.
3. Validar healthcheck, autenticação, tenant isolation e leitura dos dados.
4. Usar o backup pré-release apenas após validator e dry-run; nenhuma escrita automática.
5. Registrar decisão, executor, versão anterior/nova e evidências no AuditLog/relatório de incidente.