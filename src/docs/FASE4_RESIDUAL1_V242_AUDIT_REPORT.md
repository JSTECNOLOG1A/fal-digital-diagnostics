# MÉTODO FAL — FASE 4 — RESIDUAL 1 v2.42

## Status de homologação

**NÃO HOMOLOGADA.** Esta entrega corrige os controles críticos abaixo, mas não declara o fechamento integral da Fase 4: a suíte comportamental completa Phase 4, a fixture descartável Runtime A–H, a persistência frontend de PDF com upload e os três `verify` consecutivos ainda não foram implementados/executados.

## Implementado

- Corrigido o defeito fatal de escopo em `generateActionPlan`: a validação de tenant agora recebe `effectiveRole` explicitamente e não referencia `appRole` fora do escopo.
- Padronizado o RBAC dos seis writers do ciclo consultivo com `VALID_APP_ROLES`, `WRITE_ROLES`, `resolveAppRole` e `assertCanWrite` antes de qualquer mutação.
- `recalculateActionPlanState` passou a paginar tarefas, validar duplicidade de `task_key` e dependências, calcular indicadores físicos e confirmar a releitura do plano.
- `createManualActionTask` usa operação candidata, histórico candidato, recálculo, confirmação e invalidação compensatória em falha.
- `updateActionTaskWithHistory` captura a tarefa integral, usa dependências do estado resultante, cria registros candidatos e restaura tarefa/plano em falha.
- Revisões abertas usam chave determinística, candidate/active, ponteiro de plano e tratamento de colisão; conclusão usa estado `committing`, snapshot de fechamento e compensação do plano; cancelamento exige confirmação explícita de alterações live.
- Schemas de atividade, revisão e tarefa receberam `operation_id`, estados de commit e campos de invalidação.
- Adicionadas funções canônicas para oficialidade única do relatório e commit do artefato PDF com checksum do payload.
- O checksum de geração deixou de considerar `snapshot.generated_at` e passa a considerar conteúdo, tipo, parâmetros, renderer e versão do método.
- Arquivamento no centro de relatórios passou a chamar o backend canônico.

## Evidências executadas

| Controle | Resultado |
|---|---|
| Backend compile | PASS — 125/125 |
| SEG-02 | PASS — 125/125 reconciliadas |
| Audit RBAC functions | PASS — 0 violações |
| Writers de tarefas | PASS — 0 writes diretos no frontend |
| test:ci | PASS |
| lint | PASS |
| typecheck | PASS |
| build | PASS |
| Testes de função sem recurso existente | PASS — retornos 404 controlados para plano/versão inexistentes |

## Pacote

`FASE4_RESIDUAL1_V242_PARTIAL.zip`

- Arquivos: 824
- Integridade de reabertura: `true`
- SHA-256: `bfdb0305cce096df0307986f807189dad4d087f1d5e7d373d004c085063a959a`

## Pendências impeditivas para homologação

1. Implementar o fluxo frontend Blob → UploadFile → SHA-256 → `commitReportPdfArtifact`, com download e retry reais.
2. Aplicar paginação a todos os leitores legados de relatório, recomendações e bibliotecas.
3. Completar a identidade/fingerprint/reuse de `generateActionPlan` sem mutar tarefas em fingerprint idêntico.
4. Criar e executar `test:phase4` com injeções de falha e cenários A–H reais.
5. Substituir gates remanescentes baseados em texto por workflows comportamentais.
6. Executar três verificações completas com mesma Tree SHA e fixture removida.

A Fase 3 congelada não foi modificada e a Fase 5 não foi iniciada.