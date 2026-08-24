# MÉTODO FAL — FASE 4 — RESIDUAL 4 v2.45

## Parecer

**NÃO HOMOLOGADA.** A Fase 3 não foi alterada e a Fase 5 não foi iniciada. Este ciclo fecha correções produtivas pontuais, porém não produz prova suficiente para o pacote final solicitado.

## Implementado

- `archiveReportVersion` adotou `resolveAppRole` e `assertCanWrite` canônicos; `client_viewer` não escreve.
- Arquivo de relatório agora bloqueia PDF pendente, exige replacement válido para a única versão oficial e restaura a versão anterior/replacement se o commit lógico falhar.
- O fingerprint do plano não inclui mais timestamps operacionais de recomendações convertidas.
- O fallback de `FinancialSourceOutputHead` valida snapshot, tenant, status ativo, run e checksum antes de entrar no fingerprint. Divergências retornam HTTP 409.
- Respostas e catálogo de recomendações passam a usar paginação integral no gerador do plano.
- A reutilização de PDF é avaliada antes da renderização e usa checksum, versão do gerador, storage key e URL do artefato; a comparação tautológica foi removida.
- A identidade de conteúdo do relatório agora inclui o título visível.

## Evidências executadas

| Controle | Resultado |
|---|---|
| backend compile | PASS — 125/125 |
| RBAC functions | PASS — 125/125, zero violations |
| action plan fingerprint auditor | PASS |
| official report auditor | PASS |
| test:phase4 existente | PASS — 9 arquivos / 27 testes |
| lint | PASS |
| typecheck | PASS |
| build | PASS |
| smoke de archiveReportVersion | PASS — 404 controlado para versão inexistente |
| smoke de generateActionPlan | PASS — 404/500 controlado para assessment inexistente |

## Bloqueadores formais restantes

1. Os nove testes de Fase 4 ainda são decorativos; não foram substituídos por adapters equivalentes ou execução de fixture produtiva.
2. Mutation runner A–E, prova de falha e inclusão no `verify` não foram implementados.
3. Commit lógico fail-closed completo do plano, com compensação física em todas as etapas, não foi implementado.
4. Paginação ainda precisa ser aplicada e provada em todas as fontes e telas listadas no requisito.
5. Não há prova runtime A–H, fixtures descartáveis, screenshots, download de PDF arquivado ou cleanup.
6. Não foram produzidas três execuções verdes de `verify`, Tree SHA coincidente, ambiente limpo, ZIP final ou remoção comprovada de artefatos PARTIAL.
7. A plataforma não expõe neste fluxo um verificador server-side de existência/ownership de URL retornada por UploadFile; a validação atual restringe a referência persistida, mas não substitui uma API de storage autenticada.

## Conclusão

A Fase 4 continua não homologada. Os bloqueadores acima devem ser resolvidos com evidência executável antes de qualquer declaração de homologação.