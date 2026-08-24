# MÉTODO FAL — FASE 2 — RESIDUAL 4
## Relatório de auditoria técnica — candidato, não homologado

**Data:** 2026-07-14 (America/Sao_Paulo)  
**Baseline ZIP:** SHA-256 `835771be5f16c6bdaec6defa9ccb1cc28a7a15242d670b7f3e4311fb572d09de`  
**Fase 3:** não iniciada  
**Conclusão da Fase 2:** **NÃO DECLARADA**

## 1. Estado executivo

O pacote recebeu correções estruturais e de fail-closed para SEG-02, RBAC, typecheck/read-only, definição financeira, checksum, snapshots, tombstone, lock de período, convergência concorrente e pós-condições. A homologação permanece bloqueada até a execução dos cenários A–H no Testing Agent, três execuções consecutivas do `npm run verify` sobre a árvore atual e geração externa do ZIP integral.

A última execução completa disponível do `verify` terminou com `exit 1` por duas asserções estruturais: ausência de `previousScopeIds` e ocorrência documental prematura de `current_processing_snapshot_id`. Ambas foram corrigidas na implementação, sem alteração dos critérios dos testes. O executor de comandos passou a montar `/app` com uma cópia anterior: informou o script antigo de `test:phase2` e ausência de testes que a árvore editável já contém. Portanto, nenhum verde posterior é atribuído neste relatório.

## 2. Evidência de gates obtida antes da dessincronização

| Gate | Resultado observado | Evidência |
|---|---:|---|
| backend compile | PASS | `113/113`, failed `0` |
| SEG-02 | PASS | real `113`, matriz `113`, missing/extras/duplicates/unclassified `0` |
| query/cache | PASS | pending `0` |
| RBAC | PASS | violations `0` |
| test:phase2 (execução anterior) | PASS | `60/60` |
| typecheck (execução focal anterior) | PASS | exit `0` |
| testes focais de concorrência/snapshot/lock (antes da interrupção) | PASS | `15/15` |
| verify completo | FAIL | duas asserções estruturais, corrigidas depois |
| verify consecutivo 1/3 | NÃO COMPROVADO | executor dessincronizado |
| verify consecutivo 2/3 | NÃO EXECUTADO | depende do anterior |
| verify consecutivo 3/3 | NÃO EXECUTADO | depende do anterior |

## 3. Arquivos alterados

### Frontend
- `src/components/financial/FinancialDefinitionForm.jsx`
- `src/components/financial/CompanyMultiSelect.jsx`
- `src/pages/FinancialDiagnosisDetail.jsx`
- `src/components/group/GroupFinancialAnalysesTab.jsx`
- `src/lib/sha256File.js`

### Backend
- `base44/functions/saveFinancialAnalysisDefinition/entry.ts`
- `base44/functions/validateFinancialUpload/entry.ts`
- `base44/functions/buildFinancialStatements/entry.ts`
- `base44/functions/prepareFinancialAnalysisDataset/entry.ts`
- `base44/functions/finalizeFinancialInsights/entry.ts`
- `base44/functions/createFinancialProcessingSnapshot/entry.ts`
- `base44/functions/replaceFinancialSourcePeriod/entry.ts`
- `base44/functions/deleteFinancialUploadSafe/entry.ts`
- `base44/functions/_shared/financialProcessingRun.ts`

### Entidades
- `base44/entities/FinancialProcessingRun.jsonc`
- `base44/entities/FinancialUpload.jsonc`
- `base44/entities/FinancialProcessingSnapshot.jsonc`
- `base44/entities/FinancialPeriodLock.jsonc`

### Scripts
- `scripts/audit-seg02-functions.mjs`
- `scripts/audit-function-rbac.mjs`
- `scripts/audit-financial-data-integrity.mjs`
- `package.json`

### Testes
- `src/lib/__tests__/financial-definition-readonly.test.jsx`
- `src/lib/__tests__/financial-content-hash.test.js`
- `src/lib/__tests__/financial-snapshot-required.test.jsx`
- `src/lib/__tests__/financial-delete-tombstone.test.jsx`
- `src/lib/__tests__/financial-replacement-lock.test.jsx`
- `src/lib/__tests__/financial-run-concurrency.test.jsx`
- `src/lib/__tests__/financial-validation-failclosed.test.jsx`
- `src/lib/__tests__/seg02-negative.test.js`
- `src/lib/__tests__/fase2-residual3.test.jsx`

### Documentação
- `src/docs/SEG-02_FUNCTION_AUDIT.md`
- `src/docs/FASE2_RESIDUAL4_FINAL_AUDIT_REPORT.md`

## 4. De/para por requisito

### R4-SEG-02
- **Antes:** `_shared` podia contaminar o inventário; ausência de prova negativa reproduzível.
- **Depois:** inventário exclui `_shared`, reconcilia dinamicamente e aceita `--inject-unclassified-function` para simular endpoint sem matriz.
- **Teste:** `seg02-negative.test.js` exige exit não zero, missing explícito e `SEG-02 audit FAILED`.
- **Status:** implementação presente; execução final na árvore atual pendente.

### R4-SEG-03
- **Antes:** auditoria baseada em reconhecimento genérico, com falso positivo/falso verde.
- **Depois:** política derivada por function a partir da matriz; mutation semântica; guard efetivo anterior; políticas WRITE_ROLES, TENANT_ADMIN_SCOPED, HQ_ONLY, SELF_SERVICE, AUTOMATION_TRUST e READ_ONLY.
- **Evidência anterior:** 113 classificadas, violations `0`.
- **Status:** gate anterior verde; reexecução final pendente.

### R4-TS-01
- **Antes:** contrato `readOnly` e shapes de escopo divergentes.
- **Depois:** JSDoc explícito e helper `scopeRow` com contrato societário completo.
- **Evidência anterior:** typecheck exit `0`.

### R4-UI-RO
- **Antes:** action bar era ocultada, mas controles ainda podiam alterar estado.
- **Depois:** selects, inputs e botões recebem bloqueio; multi-select recebe `disabled/readOnly`; preview e gravação não executam; `handleSave` possui retorno imediato.
- **Teste:** viewer sem invoke e consultant com invoke correto.
- **Status:** teste estrutural/comportamental local presente; cenário G multiusuário ainda pendente no Testing Agent.

### R4-DEF
- **Antes:** rollback não provava restauração integral e não registrava explicitamente IDs anteriores.
- **Depois:** `previousDiagnosis`, `previousScope`, `previousScopeIds` e IDs criados são preservados; rollback atua em IDs exatos; diagnóstico e escopo são relidos e comparados; campos societários participam da pós-condição; `save_definition` consta no enum.
- **Status:** contrato corrigido; matriz completa de failure injection runtime pendente.

### R4-UPL
- **Antes:** somente `filter → create`, sem convergência posterior.
- **Depois:** operation keys incorporam versão/checksum; após create, contendores são relidos e ordenados; perdedor é cancelado e retorna `reused=true`; helper canônico contém o mesmo protocolo; caminhos DFC/preparado fecham run.
- **Limite verificado:** o protocolo converge outputs, mas a plataforma não expõe neste código uma restrição única transacional que garanta `processing_runs=1` físico; pode existir run perdedor cancelado. Logo, o critério literal `processing_runs=1` ainda exige prova/runtime ou mecanismo atômico nativo adicional.
- **Status:** **PENDENTE R4-UPL-ATOMIC**; impede conclusão.

### R4-HASH
- **Antes:** nome/tamanho/data formavam pseudo-checksum não determinístico.
- **Depois:** SHA-256 dos bytes no frontend; backend baixa e recalcula; algoritmo e metadados persistidos; operation key usa checksum real.
- **Teste:** mesmos bytes/nomes diferentes; bytes diferentes/metadados iguais; retry; modificação.
- **Status:** implementação e teste presentes; replay runtime pendente.

### R4-SNP
- **Antes:** snapshot não era obrigatório em todos os consumidores e leituras críticas podiam degradar.
- **Depois:** build, prepare, finalize, DFC-only e replacement exigem snapshot; manifesto canônico e SHA-256; snapshot relido; run relido; ponteiro current publicado e relido somente depois; retry reutiliza snapshot do run.
- **Status:** contrato corrigido; cenário H runtime pendente.

### R4-PER
- **Antes:** substituição sem lease convergente completo.
- **Depois:** lock por diagnóstico/entidade/período/scope, candidato, validação candidate mode, swap, pós-condição, snapshot e release.
- **Status:** estrutura presente; nove failure injections runtime pendentes.

### R4-PUR
- **Antes:** risco de sucesso com fonte crítica incompleta.
- **Depois:** manifesto before/deleted/preserved/after/errors, pós-condição e estados failed/partial_failed esperados pela auditoria de integridade.
- **Status:** execução E runtime pendente.

### R4-DEL
- **Antes:** exclusão física podia anteceder fechamento integral.
- **Depois:** `pending_delete → purge/recalculo/integridade/pós-condição → tombstoned`, com estado recuperável e snapshot.
- **Status:** implementação presente; falhas após tombstone/recálculo/snapshot pendentes em runtime.

### R4-INT
- **Antes:** validação podia retornar sucesso mesmo após falha ao persistir estado.
- **Depois:** cleanup, persistência e atualização final são fail-closed; run vira partial_failed; upload, diagnóstico e run são relidos antes do sucesso; candidate mode preservado.
- **Status:** testes estruturais presentes; dez cenários runtime pendentes.

### R4-TEST
- **Status:** cenários A–H não são declarados executados. Devem ser executados pelo Testing Agent com dois usuários e fixtures persistidas.

## 5. Segurança

Última evidência executada:

```text
SEG-02: real=113, matrix=113
missing=0
extras=0
duplicates=0
unclassified=0
RBAC violations=0
```

A matriz atual inclui `saveFinancialAnalysisDefinition` como endpoint tenant-guarded. A function autentica via `auth.me()`, resolve `app_role`, exige write role, deriva tenant pelo diagnóstico e bloqueia divergência.

## 6. Cenários comportamentais A–H

| Cenário | Evidência exigida | Estado |
|---|---|---|
| A jornada individual | IDs, refresh, runs e outputs | pendente Testing Agent |
| B concorrência | runs físicos, outputs e reused | pendente; bloqueador atômico |
| C replacement sucesso | preservação integral | pendente Testing Agent |
| D failure injection replacement | nove pontos e releitura | pendente Testing Agent |
| E purge/delete | normal + falhas | pendente Testing Agent |
| F dois usuários | steps independentes e refresh | pendente Testing Agent |
| G viewer | navegação + mutations=0 | pendente Testing Agent |
| H snapshots v1/v2 | replay, counts e checksums | pendente Testing Agent |

Nenhum payload, HTTP status, ID, screenshot ou vídeo foi fabricado.

## 7. Runs, snapshots e failure injection

A tabela de IDs reais somente poderá ser preenchida após A–H. Não há IDs inventados neste relatório. Os contratos implementados registram `operation_key`, `operation_type`, run, status, reused, checksum, snapshot, predecessor, timestamps e erro por estágio.

## 8. Pendências formais

| ID | Causa | Impacto | Gate/evidência faltante | Correção necessária |
|---|---|---|---|---|
| R4-UPL-ATOMIC | ausência de restrição única/CAS nativa comprovada | pode haver run perdedor cancelado além do vencedor | cenário B | usar mecanismo atômico suportado pela plataforma e provar `runs=1` |
| R4-TEST-AH | fluxos exigem sessão/navegação/fixtures persistidas | sem homologação comportamental | A–H | executar pelo Testing Agent e anexar evidências |
| R4-VERIFY-3X | executor `/app` dessincronizado da árvore editável | gates pós-correção não comprovados | três verifies | reexecutar quando o runner montar a revisão atual |
| R4-ZIP | ZIP integral não gerado neste ambiente | artefato de entrega ausente | nome/tamanho/SHA | gerar após todos os gates verdes |

## 9. Protocolo final de homologação

Executar, na árvore sincronizada, sem alterações intermediárias:

```bash
npm run audit:backend-compile
npm run audit:seg02
npm run audit:query-cache
npm run audit:rbac-functions
npm run audit:identity-usage
npm run audit:financial-integrity
npm run test:phase2
npm run lint
npm run typecheck
npm run test:ci
npm run build
npm run verify
npm run verify
npm run verify
```

Depois executar A–H no Testing Agent, anexar evidências, gerar ZIP integral, calcular tamanho/SHA-256 e somente então promover este documento de **candidato** para **homologado**.