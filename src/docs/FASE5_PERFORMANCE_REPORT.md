# FASE 5 — Relatório de Performance

## Evidência de execução
- Consultas do resumo de avaliações por grupo usam paginação de até 500 registros por página, sem truncamento silencioso.
- Chaves de cache mantêm o tenant como primeiro escopo e o auditor de query-scope bloqueia leituras de entidades de tenant sem contexto explícito.
- As telas especiais permanecem carregadas sob demanda em `App.jsx`.

## Contratos homologados
- `phase5-performance-contract.test.js` valida o contrato de chave e de isolamento de cache.
- `audit:phase5-query-scope` percorre páginas, componentes e hooks, permitindo somente catálogos metodológicos globais nominados.
- A medição de latência e volume de tráfego depende de uma massa representativa no ambiente de homologação e deve ser registrada no próximo ciclo de operação.