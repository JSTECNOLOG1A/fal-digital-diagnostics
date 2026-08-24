# MÉTODO FAL — FASE 4 — RESIDUAL 4 v2.47

## Entregas verificadas

- Matriz de writers por chamada: `beginReportPdfArtifact` é classificada como `PDF_BEGIN` e somente pode executar `AssessmentReportVersion.update` com os cinco campos permitidos.
- Prova negativa: a injeção de escrita de `ActionTask` no begin faz o auditor falhar.
- Harness produtivo: lê o `entry.ts`, substitui somente a factory do SDK, transpila/bundla com esbuild em diretório temporário, captura `Deno.serve`, envia `Request` real e devolve response, mutations e estado in-memory.
- Testes produtivos adicionados para begin, concorrência contra estado pending e commit de PDF. Eles executam os handlers reais, não constantes locais.
- Identificador de upload deixou de aceitar URL como identificador; o commit exige identificador opaco e URL Base44 separada.
- O pipeline inclui o teste negativo da matriz de writers.

## Gates executados

| Gate | Resultado |
|---|---|
| backend compile | PASS — 126/126 |
| SEG-02 | PASS — 126/126 |
| RBAC | PASS — zero violações |
| writer matrix | PASS — inclui `PDF_BEGIN` |
| test:phase4 | PASS — 10 arquivos / 29 testes |
| lint | PASS |
| typecheck | PASS |
| build | PASS |
| contrato real do commit sem ID | PASS — 400 controlado |

## Estado da homologação

**FASE 4 não homologada.**

Ainda faltam os requisitos produtivos completos: substituição das oito suítes restantes pelo harness, runner de mutações A–E, commit fail-closed do plano, paginação exaustiva de todas as fontes indicadas, manifest físico integral, orphan/retry de armazenamento, fixture runtime A–H, pacote ZIP e três verificações completas em diretório limpo. Nenhum desses itens foi declarado como concluído neste relatório.

A Fase 3 não foi alterada e a Fase 5 não foi iniciada.