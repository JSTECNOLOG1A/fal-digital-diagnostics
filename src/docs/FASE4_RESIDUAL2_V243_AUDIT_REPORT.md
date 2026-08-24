# MÉTODO FAL — FASE 4 — RESIDUAL 2 v2.43

## Resultado

**NÃO HOMOLOGADA.** O núcleo produtivo de identidade de plano, cancelamento de revisão, oficialidade e artefato PDF foi integrado e passou pelas validações abaixo. Os requisitos obrigatórios de suíte comportamental completa, runtime A–H, paginação integral de todas as fontes e três verificações completas ainda não foram concluídos; portanto, não foi produzido pacote final nem declarada a Fase 4 homologada.

## Entregas verificadas

- `generateActionPlan` agora constrói `plan_key`, pagina planos e tarefas, bloqueia ambiguidade de planos ativos com `ACTION_PLAN_IDENTITY_AMBIGUOUS`, calcula fingerprint SHA-256 canônico e retorna reuso sem mutação quando o fingerprint coincide.
- Regeneração preserva tarefas `in_progress`, `done` e `blocked`; a diferença de geração é persistida no plano.
- A linha do tempo de revisões não grava mais diretamente no frontend: solicita motivo, confirmação de preservação das alterações live e usa `cancelActionPlanReview`.
- A geração marcada como oficial chama `setOfficialAssessmentReportVersion`; a lista de versões oferece a ação explícita “Tornar oficial” somente para quem pode administrar relatórios.
- `ReportPreview` gera Blob PDF, confirma o prefixo `%PDF`, calcula SHA-256 dos bytes, faz upload, chama `commitReportPdfArtifact`, relê metadados e baixa o artefato. Falhas passam a persistir `pdf_status=failed` sem tocar no payload.
- `commitReportPdfArtifact` valida URL HTTPS, SHA-256, contagem de páginas, checksum do payload, status e tenant.
- A matriz de writers agora percorre frontend e funções, classifica os writers conhecidos e falha para escrita sem classe permitida.

## Evidências executadas

| Controle | Resultado |
|---|---|
| backend compile | PASS — 125/125 |
| SEG-02 | PASS — 125/125 reconciliadas |
| RBAC functions | PASS — 0 violações |
| writer matrix | PASS — 15 writers classificados |
| action-review lifecycle | PASS |
| report snapshot immutability | PASS |
| official uniqueness | PASS |
| PDF artifact integrity | PASS |
| test:ci | PASS |
| lint | PASS |
| typecheck | PASS |
| build | PASS |
| testes de funções alteradas | PASS — recursos inexistentes retornaram 404 controlado |

## Pendências impeditivas

1. Criar os nove arquivos da suíte `test:phase4`, com injeções de falha produtivas e mutation tests reais.
2. Integrar `test:phase4` e os novos contratos comportamentais ao `verify`.
3. Paginar todos os demais leitores e fontes de manifest exigidos, incluindo recomendações, bibliotecas, revisões e payload do relatório.
4. Completar `source_manifest` com checksums das fontes financeiras, da revisão e do plano.
5. Executar e registrar a fixture descartável Runtime A–H, incluindo PDF real, download, screenshots e cleanup.
6. Executar três `verify` sucessivos com a mesma Tree SHA e reabrir em ambiente limpo via `npm ci`.

A Fase 3 financeira não foi alterada e a Fase 5 não foi iniciada.