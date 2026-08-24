# MÉTODO FAL — FASE 4 — RESIDUAL 4 v2.46

## Escopo efetivamente concluído neste ciclo

1. O runner agora usa `PHASE4_TEST_FILES`, inventário físico de nove arquivos, sem wildcard literal. O teste do runner falha caso o wildcard reapareça.
2. Foi criada a função `beginReportPdfArtifact`, com autenticação, RBAC, tenant guard, bloqueio de concorrência, confirmação do estado `pending`, `operation_id`, autoria e timestamp.
3. O commit de PDF exige a mesma operação pendente, checksum do payload, bytes/páginas válidos e identificador real retornado pela integração de upload. A URL não é mais copiada para `pdf_storage_key`.
4. A tela de relatório chama `begin` antes de renderizar/uploadar; reutilização ocorre antes de Blob, upload e commit. Após commit, invalida detalhe, snapshot e lista de versões.
5. O fingerprint do relatório separa parâmetros de conteúdo de `mark_as_official`. O manifesto usa o único renderer `FAL-RPT-2.46` e inclui hashes de snapshot, plano, revisão, tasks, parâmetros e cutoff.
6. O archive restaura somente o estado de archive/oficialidade permitido, não o registro inteiro.
7. A paginação do gerador de plano foi estendida às questões, catálogo de causas e biblioteca de ações por pergunta.
8. A matriz SEG-02 e o auditor RBAC foram reconciliados para as 126 funções.

## Evidência real executada

| Gate | Resultado |
|---|---|
| backend compile | PASS — 126/126 |
| SEG-02 | PASS — 126/126, zero ausentes/extras |
| RBAC functions | PASS — 126/126, zero violações |
| action-plan fingerprint | PASS |
| action-review lifecycle | PASS |
| report snapshot immutability | PASS |
| report official uniqueness | PASS |
| PDF artifact integrity | PASS |
| phase2 | PASS — 150 testes |
| phase4 | PASS — 9 arquivos / 27 testes |
| lint | PASS |
| typecheck | PASS |
| build | PASS |
| begin PDF contract | PASS — 400 controlado sem `report_version_id` |
| commit PDF contract | PASS — 400 controlado sem `report_version_id` |
| generate plan contract | PASS — 404 controlado para assessment inexistente |

## Não evidenciado — bloqueador de homologação

A homologação não pode ser emitida. A suíte Fase 4 ainda possui testes decorativos e não executa uma fixture persistida com os cenários A–H. Também não existem mutation runner isolado, logs de mutações, ciclo completo de PDF/upload/download/arquivo, três `verify` completos, ZIP reaberto em diretório limpo, manifesto externo ou prova de cleanup. Não há evidência válida para declarar os critérios produtivos solicitados como atendidos.

## Conclusão

A Fase 3 não foi alterada e a Fase 5 não foi iniciada. O Residual 4 continua ativo até que as evidências produtivas acima sejam implementadas e executadas.