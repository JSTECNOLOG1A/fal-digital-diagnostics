# MÉTODO FAL — FASE 2 — RESIDUAL 5
## Relatório de auditoria técnica parcial — bloqueios reais

**Data:** 2026-07-14 (America/Sao_Paulo)  
**Baseline informado:** `262edda0-0190-4910-ba70-b40078639bca.zip`  
**SHA-256 informado:** `de78e49ec01d000bcee97d11319aacf48018044cb48db1782cdec3340428af02`  
**Fase 3:** não iniciada  
**Fase 2:** **NÃO HOMOLOGADA**

## 1. Resultado executivo

O Residual 5 foi tratado sem reescrever módulos estáveis. Foram implementados o tombstone recuperável e o inventário fail-closed de testes. A falsa garantia concorrente baseada em `setTimeout(120)` + cancelamento posterior foi removida.

R5-ATOMIC e R5-PERIOD-LOCK não foram declarados implementados. A documentação oficial consultada não documenta restrição única, create-if-absent, compare-and-set, transação ou lock exclusivo para Entities. Como o requisito proíbe inventar garantia, nenhum desses mecanismos foi simulado.

Fonte consultada: `https://docs.base44.com/developers/backend/resources/entities/entity-schemas`. A página documenta tipos e validações JSON Schema, mas não índices únicos nem transações. As buscas oficiais por “atomic create if absent”, “unique constraint”, “compare-and-set” e “transaction” não retornaram um primitivo aplicável.

## 2. Status dos bloqueios

| Bloqueio | Estado | Evidência |
|---|---|---|
| R5-ATOMIC | BLOQUEADO | nenhum primitivo nativo documentado; prova marcada `todo`, não simulada |
| R5-PERIOD-LOCK | BLOQUEADO | entidade existe, mas não foi declarado consumer produtivo sem aquisição atômica |
| R5-TOMBSTONE | IMPLEMENTADO, runtime pendente | fluxo principal não chama `FinancialUpload.delete`; estados pending/delete_failed/tombstoned; snapshot obrigatório |
| R5-TEST-INVENTORY | IMPLEMENTADO | preflight físico + teste negativo por processo filho |
| R5-RUNTIME-AH | PENDENTE | deve ser executado no Testing Agent com duas sessões |
| R5-VERIFY-3X | PENDENTE | não há três logs consecutivos na árvore atual |
| R5-REPORT-TRUTH | PARCIAL | relatório não inventa diff, ZIP, IDs, logs ou cenários |

## 3. Alterações reais deste residual

| Arquivo | Status | Finalidade | Evidência disponível |
|---|---|---|---|
| `base44/entities/FinancialUpload.jsonc` | modificado | ciclo de exclusão separado do upload_status | schema contém active/pending_delete/tombstoned/delete_failed |
| `base44/functions/deleteFinancialUploadSafe/entry.ts` | modificado | tombstone sem delete físico do upload | auditor estático + teste comportamental fake |
| `base44/functions/_shared/financialProcessingRun.ts` | modificado | remove atraso/cancelamento como falsa atomicidade | não contém eleição pós-create |
| `base44/functions/validateFinancialUpload/entry.ts` | modificado | remove atraso/cancelamento | atomicidade continua pendente |
| `base44/functions/buildFinancialStatements/entry.ts` | modificado | remove atraso/cancelamento | atomicidade continua pendente |
| `base44/functions/prepareFinancialAnalysisDataset/entry.ts` | modificado | remove atraso/cancelamento | atomicidade continua pendente |
| `base44/functions/finalizeFinancialInsights/entry.ts` | modificado | remove atraso/cancelamento | atomicidade continua pendente |
| `scripts/assert-phase2-test-files.mjs` | criado | preflight fail-closed | enumera 13 arquivos e aceita probe negativo |
| `scripts/audit-financial-data-integrity.mjs` | modificado | reprova delete físico no fluxo principal | check R5-TOMBSTONE |
| `package.json` | modificado | preflight antes do Vitest | `node scripts/assert-phase2-test-files.mjs && vitest run ...` |
| `src/lib/__tests__/phase2-test-inventory.test.js` | criado | prova negativa de arquivo ausente | exige exit diferente de zero |
| `src/lib/__tests__/financial-delete-tombstone.test.jsx` | criado | estados e falhas do tombstone em fake repository | caminho feliz + cinco failure stages |
| `src/lib/__tests__/financial-replacement-lock.test.jsx` | criado | contrato em fake repository | rotulado explicitamente como não-prova produtiva |
| `src/lib/__tests__/financial-run-concurrency.test.jsx` | modificado | remove falsa prova por regex | cenários produtivos permanecem `todo` |
| `src/lib/__tests__/financial-processing.test.jsx` | modificado | atualiza contrato legado de delete para tombstone | rejeita `FinancialUpload.delete()` |
| `src/docs/FASE2_RESIDUAL5_AUDIT_REPORT.md` | criado | auditoria verdadeira | este documento |

Esta tabela é baseada nas edições realizadas nesta árvore. Não é apresentada como saída de `diff --name-status` contra o ZIP, pois o ZIP baseline não foi montado no ambiente de edição.

## 4. R5-TOMBSTONE — fluxo implementado

1. cria/reutiliza processing run pelo mecanismo legado, ainda não atômico;
2. marca upload `pending_delete`, com run e timestamp;
3. conta e limpa derivados, persistindo manifestos;
4. relê derivados e bloqueia limpeza parcial;
5. recalcula upload atual, períodos e months_count excluindo o upload alvo;
6. atualiza diagnóstico;
7. executa integridade fail-closed;
8. marca run sucedido com `snapshot_pending=true` para satisfazer o contrato atual do snapshot;
9. cria snapshot obrigatório;
10. relê upload, diagnóstico, run e snapshot;
11. grava `tombstoned` e `is_current=false`;
12. relê o upload e valida a pós-condição;
13. fecha o run com snapshot e checksum.

Em falha tardia, diagnóstico e flag `is_current` são compensados, upload vira `delete_failed`, o erro é persistido e o run vira `partial_failed`. O upload permanece consultável. Não existe retorno `upload_deleted=true` nem chamada física a `FinancialUpload.delete()` no fluxo principal.

Não foi criada rotina de garbage collection neste residual; portanto, nenhuma exclusão física posterior ocorre automaticamente.

## 5. R5-TEST-INVENTORY

O preflight enumera fisicamente todos os arquivos executados pelo `test:phase2`, incluindo os dois ausentes no baseline e o próprio teste negativo. Um probe via `PHASE2_REQUIRED_EXTRA` força arquivo inexistente; o processo deve terminar com exit não zero antes do Vitest.

Quantidade configurada atual: **13 arquivos de teste da Fase 2**.

## 6. Atomicidade e lock — decisão técnica

O SDK documentado fornece create, update, updateMany, delete, filter e list. Não foi encontrada garantia documentada de unicidade de campo, transação, CAS ou upsert condicional. `updateMany` não foi tratado como CAS porque a documentação disponível não promete isolamento/retorno adequado para provar aquisição única.

Consequências:

- não foi mantido `setTimeout` como lock;
- não foi mantido “um succeeded + um cancelled” como sucesso;
- não foram criadas functions `acquirePeriodLock`, `renewPeriodLock` ou `releasePeriodLock` que aparentassem exclusão mútua sem garanti-la;
- `FinancialPeriodLock` continua sem consumer produtivo e, por isso, R5-PERIOD-LOCK permanece aberto;
- os oito consumers exigidos não foram migrados para um helper atômico inexistente.

Bloqueio externo necessário: confirmação da Base44 de um primitivo atômico suportado ou disponibilização de unique constraint/CAS/transação. Esse ponto deve ser tratado com o suporte oficial da Base44 antes de continuar.

## 7. Evidência de runtime A–H

Nenhum cenário A–H foi declarado executado. Não há payloads, HTTP status, IDs, screenshots, vídeos, tabela de runs, tabela de locks ou tabela de snapshots gerados nesta etapa.

Execução deve ser feita no Testing Agent com os objetivos:

- “Executar os cenários A–H do Residual 5 com fixtures persistidas e duas sessões reais.”
- “Comprovar atomicidade literal, replacement com failure injection, tombstone, viewer e replay de snapshots.”

O cenário B não poderá ser aprovado antes da resolução de R5-ATOMIC.

## 8. Gates e entrega

Não são declarados nesta revisão:

- três `npm run verify` consecutivos com exit 0;
- logs integrais dos gates;
- diff real contra o ZIP baseline;
- novo ZIP, tamanho ou SHA-256;
- 312/312 ou qualquer nova contagem de testes;
- conclusão da Fase 2.

## 9. Pendências finais

| ID | Ação necessária |
|---|---|
| R5-ATOMIC | obter primitivo atômico oficial e integrar nos oito consumers |
| R5-PERIOD-LOCK | implementar acquire/renew/release sobre o mesmo primitivo e integrar replacement com finally |
| R5-RUNTIME-AH | executar no Testing Agent após atomicidade |
| R5-VERIFY-3X | executar três vezes na mesma árvore, sem alterações intermediárias |
| R5-REPORT-TRUTH | montar baseline, gerar diff e ZIP, anexar logs integrais |

**Confirmação:** nenhuma implementação da FASE 3 foi iniciada, preparada ou entregue.