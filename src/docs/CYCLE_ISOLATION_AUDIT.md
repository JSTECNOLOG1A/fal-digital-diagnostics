# 🔒 Auditoria de Isolamento de Ciclos

## Status: CRÍTICO ⚠️

Esta é a **PRIORIDADE 1** do sistema.

Garantir que `cycle_id` seja OBRIGATÓRIO em todas as queries analíticas impede a mistura de dados entre ciclos.

---

## Regra Ouro

```
❌ NUNCA:
const snaps = await base44.entities.FalDiagnosticSnapshot.filter({ group_id });

✅ SEMPRE:
const snaps = await base44.entities.FalDiagnosticSnapshot.filter({ group_id, cycle_id });
```

---

## Queries que DEVEM incluir cycle_id

### 1. FalDiagnosticSnapshot (✅ AUDITADO)
- Todas as queries devem filtrar por `cycle_id`
- **Files**: buildReportPayload.js, generateReport.js, computeGroupAggregateFunction.js
- **Status**: ✅ IMPLEMENTADO

### 2. FalAggregateSnapshot (✅ AUDITADO)
- Todas as queries devem filtrar por `cycle_id` (quando aplicável)
- **Files**: AggregateResultPanel.jsx, buildReportPayload.js
- **Status**: ✅ IMPLEMENTADO

### 3. Assessment (✅ AUDITADO)
- Queries de coverage devem filtrar por `cycle_id`
- **Files**: reportContext.js, generateReport.js
- **Status**: ✅ IMPLEMENTADO

### 4. ActionPlan (✅ AUDITADO)
- Queries de plano devem filtrar por `cycle_id`
- **Files**: buildReportPayload.js, ActionPlanPage.jsx
- **Status**: ✅ IMPLEMENTADO

### 5. SystemicCrossingAnalysis (✅ AUDITADO)
- Queries de MFIS devem filtrar por `cycle_id`
- **Files**: buildReportPayload.js
- **Status**: ✅ IMPLEMENTADO

### 6. FalResponse (⚠️ REVISAR)
- Queries que buscam respostas de pergunta devem filtrar por `cycle_id`
- **Risco**: Pode estar buscando respostas de ciclos diferentes
- **Ação**: Verificar em components/fal/questionnaire/* e páginas de diagnóstico

### 7. EvidenceChecklist (⚠️ REVISAR)
- Queries de evidências devem manter isolamento
- **Risco**: Moderado
- **Ação**: Verificar em components/assessment/*

### 8. FalResponse (⚠️ REVISAR)
- Queries de pergunta-resposta
- **Risco**: Pode misturar respostas de ciclos anteriores
- **Ação**: Revisar em DimensionQuestionnaire.jsx e CrossingQuestionnaire.jsx

---

## Checklist de Auditoria

### Implementado ✅
- [x] computeGroupAggregateFunction.js — cycle_id obrigatório (FUNÇÃO OFICIAL)
- [x] buildReportPayload.js — todas as queries incluem cycle_id
- [x] generateReport.js — cycle_id obrigatório como entrada
- [x] AggregateResultPanel.jsx — passa cycleId para queries
- [x] GroupCycleDashboard.jsx — passa cycleId para queries + reportMode correto no preview
- [x] ReportGenerationPanel.jsx — armazena previewMode efetivamente clicado
- [x] Removido: services/aggregation/computeGroupAggregate.js (quebrado, substituído por backend)

### Pendente ⚠️
- [ ] Questionnaire pages — verificar isolamento de FalResponse
- [ ] Assessment detail — verificar queries de respostas
- [ ] Evidence panel — verificar isolamento de evidências

### Não Aplicável
- [ ] Group, Company, OperationalUnit — não são cycle-bound
- [ ] MethodVersion — não é cycle-bound
- [ ] Question, MQEQuestion — metadados, não cycle-bound

---

## Como Testar

### Teste 1: Verificar Mistura de Ciclos (Manual)

```javascript
// 1. Criar Ciclo 1, fazer diagnóstico → score 60
// 2. Criar Ciclo 2, fazer diagnóstico → score 75

// 3. Abrir Ciclo 1 → deve mostrar 60
// 4. Abrir Ciclo 2 → deve mostrar 75

// ❌ BUG: se mostrar 65 (média), há mistura
// ✅ OK: se mostrar exato de cada ciclo
```

### Teste 2: Query Audit (Automático)

Procurar por padrões:
```javascript
// ❌ Deve gerar warning
FalDiagnosticSnapshot.filter({ group_id });
Assessment.filter({ group_id });

// ✅ OK
FalDiagnosticSnapshot.filter({ group_id, cycle_id });
Assessment.filter({ group_id, cycle_id });
```

---

## Impacto Comercial

Se `cycle_id` não for isolado:

❌ Relatórios podem misturar dados  
❌ Comparação entre ciclos invalida  
❌ Plano de ação pode puxar ações de ciclos anteriores  
❌ Score do grupo pode ser "fantasma"  

👉 **O sistema parece funcionar, mas gera decisões baseadas em dados errados.**

---

## Função Oficial de Aggregate do Grupo

**Fonte única de verdade:**
```
functions/computeGroupAggregateFunction.js
```

**Características:**
- ✅ Exige cycle_id obrigatório
- ✅ Calcula weighted average (por revenue/headcount)
- ✅ Aplica dispersion penalty (std_dev × 0.3)
- ✅ Persiste FalAggregateSnapshot com cycle_id
- ✅ Calcula delta vs ciclo anterior (via parent_cycle_id)

**Chamada oficial:**
```javascript
const result = await base44.functions.invoke('computeGroupAggregate', {
  group_id,
  cycle_id // OBRIGATÓRIO
});
```

**NÃO usar:**
- ❌ computeGroupAggregate (legado, removido)
- ❌ qualquer outro serviço local que calcule aggregate

---

## Próximas Auditorias

1. **Fase 2** (após esta implementação):
   - [ ] Auditoria de todas as queries de pergunta/resposta
   - [ ] Auditoria de snapshot de empresa
   - [ ] Auditoria de evidências

2. **Fase 3**:
   - [ ] Testes automáticos de isolamento
   - [ ] Dashboard de saúde (mostrar cobertura por ciclo)

---

## Referência Rápida

**Sempre que escrever query de snapshot/assessment/plano:**

1. ✅ Verificar se é cycle-bound
2. ✅ Incluir `cycle_id` na query
3. ✅ Testar com múltiplos ciclos
4. ✅ Verificar se há comparação histórica (então buscar ciclo anterior)

**Dúvida?** → Procure por `cycle_id` na query. Se não encontrar e for agregado/analítico → BUG.