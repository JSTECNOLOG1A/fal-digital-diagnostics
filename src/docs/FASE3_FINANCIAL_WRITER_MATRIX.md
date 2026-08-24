# FASE 3 — Matriz de Writers Financeiros

| Writer | Run obrigatório | Status obrigatório | Commit point |
|---|---:|---:|---|
| FinancialStatementLine | Sim | candidate → active | Snapshot ativo + head/pointer confirmado |
| FinancialIndicatorSnapshot | Sim | candidate → active | Snapshot ativo + head/pointer confirmado |
| FinancialValidationResult | Sim | candidate → active | Run sucedido antes do ponteiro de validação |
| FinancialMappingResolution | Sim | candidate → active | Snapshot ativo + head/pointer confirmado |
| FinancialTrialBalanceLine | Sim | candidate → active | Snapshot ativo + head/pointer confirmado |
| FinancialDfcCompositionLine | Sim | candidate → active | Snapshot ativo + head/pointer confirmado |
| PreparedFinancialDatasetLine | Sim | candidate → active | Snapshot ativo + diagnosis pointer confirmado |

O cleanup de versões anteriores é posterior ao commit e pode apenas marcar `cleanup_pending`; ele nunca desfaz o conjunto publicado.