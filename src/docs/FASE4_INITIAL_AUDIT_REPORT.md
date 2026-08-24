# MÉTODO FAL — FASE 4 — Auditoria inicial v2.41

## Escopo implementado nesta entrega

- Inventário produtivo criado em `docs/FASE4_ACTION_REVIEW_REPORT_INVENTORY.md`.
- `ActionPlan` recebeu identidade de plano, fingerprint, vínculos de snapshots, estado agregado e referência de revisão corrente.
- Criada `recalculateActionPlanState`: recalcula tarefas ativas, concluídas, bloqueadas, vencidas, críticas, próximo prazo e progresso ponderado por prioridade, com fallback documentado para média simples.
- `updateActionTaskWithHistory` foi consolidada como writer canônico: valida transições, dependências, evidência, atribuição, início, bloqueio e override administrativo; grava atividade antes da mutação e reverte a tarefa se o histórico de revisão ou o recálculo falhar.
- A criação manual passou para `createManualActionTask`, com histórico append-only e recálculo do plano. O auditor confirmou zero writes diretos de ActionTask no frontend.
- `createActionPlanReviewWithSnapshot` é a abertura canônica; retorna revisão existente quando houver draft e captura baseline de tarefas, progresso, diagnóstico e prioridades.
- `createActionPlanReview` foi descontinuada com HTTP 410.
- `completeActionPlanReview` cria snapshot de fechamento, recalcula o plano e atualiza a referência da revisão atual.
- `cancelActionPlanReview` preserva a trilha e exige motivo.
- `AssessmentReportVersion` recebeu checksum, source manifest, parent version e metadados de PDF; a geração de relatório passou a reutilizar versão quando o checksum do payload é igual.
- Os novos gates foram incluídos no pipeline de verificação.

## Evidências executadas

| Gate | Resultado |
|---|---|
| backend compile | PASS — 123/123 functions |
| SEG-02 | PASS — 123 functions reconciliadas |
| action-task writers | PASS — 0 writes diretos no frontend |
| action-review lifecycle | PASS |
| testes completos | PASS — 48 arquivos / 496 testes |
| lint | PASS |
| typecheck | PASS |
| build | PASS |

## Não homologado

A Fase 4 **não está concluída** e não foi produzido ZIP integral. Permanecem pendentes: implementação de PDF persistido com bytes e checksum real; oficialidade transacional do relatório; paginação completa nos fluxos legados; suíte Phase 4 com failure injections e runtime A–H; fixture descartável; três verificações completas pós-entrega; reabertura de pacote limpo e screenshots.

O motor financeiro congelado não foi alterado. A Fase 5 não foi iniciada.