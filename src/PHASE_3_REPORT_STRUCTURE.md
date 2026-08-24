# Phase 3 — Relatório Narrativo FAL™ — Documentação Técnica

## 1. DataMapper: buildReportPayload(assessmentId)

### Assinatura
```javascript
buildReportPayload(assessmentId: string) → Promise<ReportPayload>
```

### Localização
`functions/buildReportPayload.js`

### Fontes de Dados
| Entidade | Campo | Uso |
|----------|-------|-----|
| Assessment | id, method_version_id, created_date, cycle_number, competence | Metadados |
| Group/Company/Unit | name | Identificação da entidade |
| MethodVersion | version_code, dimensions, crossings | Configuração metodológica |
| FalDiagnosticSnapshot | dimension_scores, overall_score, overall_level, radar_points, active_dimensions | Scores dimensionais |
| SystemicCrossingAnalysis | all fields | MFIS details + tensões |
| SystemicDimensionImpact | is_systemic_leverage_point, dimension_label, leverage_score | Ponto de alavanca |
| ActionPlan + ActionTask | all fields | Plano de ação completo |

---

## 2. Shape Final do Payload

### Estrutura Canônica
```javascript
{
  // Metadados
  assessment_id: string,
  assessment_date: date,
  method_version: string,
  cycle_number: number,
  competence: string,

  // Capa
  cover: {
    company_name: string,
    group_name: string,
    unit_name: string,
    assessment_date: date,
    method_version: string,
    cycle_number: number,
    competence: string,
  },

  // Sumário executivo
  executive_summary: {
    overall_maturity_level: 'Crítico' | 'Básico' | 'Estruturado' | 'Avançado',
    overall_maturity_score: number (0-3),
    overall_maturity_index: number (0-100),
    main_systemic_tension: string,
    systemic_leverage_dimension: string,
    top_risks: string[],
    strategic_focus: string, // preenchido pelo engine
  },

  // Perfil de maturidade
  maturity_profile: {
    dimensions: [{
      key: string,
      name: string,
      score: number (0-3),
      level: string,
      weight_sum: number,
      response_count: number,
      active: boolean,
    }],
    radar_data: [{
      axis: string,
      dimension: string,
      score: number,
      level: string,
      active: boolean,
    }],
    level_distribution: {
      critical: number,
      basic: number,
      structured: number,
      advanced: number,
    },
  },

  // Fragilidades
  fragilities: {
    top_crossings: [{
      crossing_key: string,
      crossing_label: string,
      dim_a: string,
      dim_b: string,
      cross_score_final: number (0-3),
      has_mqe_data: boolean,
      tension_rank: number,
    }],
  },

  // Análise sistêmica (MFIS)
  mfis_analysis: {
    all_crossings: [...],
    top_tensions: [...],
    systemic_leverage_dimension: string,
    systemic_summary_text: string,
    dimension_impacts: [...],
  },

  // Plano de ação
  action_plan: {
    total_tasks: number,
    tasks_by_priority: {
      critical: number,
      high: number,
      medium: number,
      low: number,
    },
    tasks_by_horizon: {
      '90_days': ActionTask[],
      '180_days': ActionTask[],
      '365_days': ActionTask[],
    },
    all_tasks: ActionTask[],
  },

  // Prioridades estratégicas
  strategic_priorities: [], // array de strings (preenchido pelo engine),

  // Metodologia
  methodology: {
    method_version_code: string,
    ifme_explanation: string,
    mfis_explanation: string,
    mqe_explanation: string,
    scale_explanation: string,
  },
}
```

---

## 3. Narrative Engine: narrativeEngine.js

### Localização
`src/services/report/narrativeEngine.js`

### Funções Exportadas

#### 1. `generateExecutiveSummary(reportPayload) → string`
Gera sumário executivo de 4-5 parágrafos.

**Campos consumidos:**
- `cover.company_name`
- `executive_summary.overall_maturity_*`
- `executive_summary.main_systemic_tension`
- `executive_summary.systemic_leverage_dimension`
- `executive_summary.top_risks`
- `maturity_profile.dimensions`
- `action_plan.all_tasks`

**Output esperado:**
```
A análise FAL™ indica que a organização [EMPRESA] encontra-se em estágio 
de maturidade [NÍVEL] ([ÍNDICE]% do potencial máximo).

Das [N] dimensões avaliadas, [M] apresentam fragilidades críticas que 
requerem intervenção imediata.

A principal tensão sistêmica concentra-se em [CRUZAMENTO], indicando 
ruptura significativa na integração entre estas áreas.

A dimensão [ALAVANCA] foi identificada como ponto de alavanca sistêmica, 
sugerindo que melhorias estruturadas nesta área tendem a gerar efeito 
multiplicador sobre as demais dimensões organizacionais.

Recomenda-se priorizar as [N] primeiras ações estratégicas nos próximos 
90 dias, focando na consolidação da governança e integração operacional.
```

---

#### 2. `generateFragilitiesNarrative(reportPayload) → string`
Descreve top 5 fragilidades com interpretação de risco.

**Campos consumidos:**
- `fragilities.top_crossings` (top 5)
- Mapeamento interno de `crossing_key` → risco business

**Output esperado:**
```
As principais fragilidades sistêmicas identificadas são:

1. Financeiro × Contábil (nível crítico)
   Contabilidade não acompanha realidade financeira operacional

2. Operações × Sistemas (nível grave)
   Deficiência na automação e suporte sistêmico de processos operacionais

[...]

Essas fragilidades representam pontos de estrangulamento que, se não 
endereçados, limitam significativamente a escalabilidade da organização.
```

---

#### 3. `generateMfisNarrative(reportPayload) → string`
Explica análise sistêmica e ponto de alavanca.

**Campos consumidos:**
- `mfis_analysis.top_tensions`
- `mfis_analysis.systemic_leverage_dimension`
- `maturity_profile.dimensions` (para score da alavanca)

**Output esperado:**
```
A matriz de interdependência sistêmica (MFIS™) revela um total de [N] 
tensões estruturais significativas na organização, sendo [M] em nível crítico.

A dimensão [ALAVANCA] (score: [SCORE]/3) emerge como ponto de alavanca 
sistêmica central. Intervenções estruturadas nesta dimensão tendem a 
cascatear benefícios sobre as demais áreas, criando efeito multiplicador 
de melhoria organizacional.

As três principais tensões estão localizadas em:
1. [TENSÃO 1]
2. [TENSÃO 2]
3. [TENSÃO 3]

Essas tensões revelam que a organização opera em silos, com pouca integração 
entre suas funções críticas. Endereçá-las é fundamental para evolução de 
maturidade.
```

---

#### 4. `generatePriorityNarrative(reportPayload) → string`
Estrutura 3 prioridades estratégicas derivadas de MFIS + fragilidades.

**Campos consumidos:**
- `mfis_analysis.systemic_leverage_dimension`
- `mfis_analysis.top_tensions`
- `fragilities.top_crossings`
- `maturity_profile.dimensions`

**Output esperado:**
```
Com base na análise de maturidade, sistêmica e plano de ação, recomenda-se 
executar as seguintes prioridades estratégicas:

**Prioridade 1: Fortalecer e integrar [ALAVANCA]**
A dimensão [ALAVANCA] é o eixo central de transformação. Melhorias estruturadas 
nesta área irradiam positivamente para toda a organização.

**Prioridade 2: Resolver integração crítica: [TENSÃO 1]**
A maior fragilidade identificada está na integração entre [DIM_A] e [DIM_B]. 
Essas duas áreas operando em silos limitam exponencialmente a escalabilidade 
da organização.

**Prioridade 3: Consolidar [DIMENSÃO CRÍTICA]**
Dimensões em nível crítico carecem de fundações sólidas. Investimentos em 
formalização, documentação e automação são prerequisites para qualquer outra 
transformação.

Essas três alavancas, quando operadas de forma integrada, tendem a gerar 
o maior retorno de investimento em transformação organizacional.
```

---

#### 5. `generateActionPlanNarrative(reportPayload) → string`
Descreve estrutura e sequência do plano de ação.

**Campos consumidos:**
- `action_plan.total_tasks`
- `action_plan.tasks_by_priority`
- `action_plan.tasks_by_horizon`

**Output esperado:**
```
O plano de ação consolidado compreende [N] iniciativas estruturadas em 
três horizontes temporais:

**90 dias** — [N90] ações
Foco em fundações: governança, comunicação, estruturação de grupos de 
trabalho.

**180 dias** — [N180] ações
Implementação: sistemas, processos, capacitação.

**365 dias** — [N365] ações
Consolidação e maturação de mudanças.

Das [N] ações, [C] são críticas e [H] são de alta prioridade, demandando 
atenção executiva direta.

Recomenda-se atribuir sponsors claros para cada iniciativa e instituir 
cadência mensal de acompanhamento, com métricas visíveis de progresso.
```

---

#### 6. `enrichReportPayload(reportPayload) → EnrichedReportPayload`
Função utilitária que adiciona **todas as narrativas** ao payload original.

**Uso:**
```javascript
const rawPayload = await buildReportPayload(assessmentId);
const enrichedPayload = enrichReportPayload(rawPayload);
// enrichedPayload agora contém todos os campos originais + .narrative em cada seção
```

---

## 4. Exemplo Real de Payload Preenchido

```javascript
{
  assessment_id: "ass_123456",
  assessment_date: "2026-03-16",
  method_version: "FAL v1.0",
  cycle_number: 1,
  competence: "03/2026",

  cover: {
    company_name: "Grupo Agro Brasil > Agrotech Solutions",
    group_name: "Grupo Agro Brasil",
    unit_name: "Agrotech Solutions",
    assessment_date: "2026-03-16",
    method_version: "FAL v1.0",
    cycle_number: 1,
    competence: "03/2026",
  },

  executive_summary: {
    overall_maturity_level: "Básico",
    overall_maturity_score: 1.2,
    overall_maturity_index: 40,
    main_systemic_tension: "Financeiro × Operações",
    systemic_leverage_dimension: "Financeiro",
    top_risks: [
      "Financeiro × Operações",
      "Operações × Sistemas",
      "Governança × Controles",
    ],
    strategic_focus: "", // será preenchido
  },

  maturity_profile: {
    dimensions: [
      {
        key: "governanca",
        name: "Governança",
        score: 1.0,
        level: "Básico",
        weight_sum: 4,
        response_count: 12,
        active: true,
      },
      {
        key: "financeiro",
        name: "Financeiro",
        score: 1.5,
        level: "Básico",
        weight_sum: 4,
        response_count: 10,
        active: true,
      },
      // ... (restantes 6 dimensões)
    ],
    radar_data: [
      { axis: "GV", dimension: "Governança", score: 1.0, level: "Básico", active: true },
      { axis: "FI", dimension: "Financeiro", score: 1.5, level: "Básico", active: true },
      // ... (restantes)
    ],
    level_distribution: {
      critical: 2,
      basic: 4,
      structured: 2,
      advanced: 0,
    },
  },

  fragilities: {
    top_crossings: [
      {
        crossing_key: "FxO",
        crossing_label: "Financeiro × Operações",
        dim_a: "Financeiro",
        dim_b: "Operações",
        cross_score_final: 0.8,
        has_mqe_data: true,
        tension_rank: 1,
      },
      // ... (top 5)
    ],
  },

  mfis_analysis: {
    all_crossings: [...],
    top_tensions: [...],
    systemic_leverage_dimension: "Financeiro",
    systemic_summary_text: "Análise sistêmica indica fragilidades estruturais...",
    dimension_impacts: [...],
  },

  action_plan: {
    total_tasks: 24,
    tasks_by_priority: {
      critical: 6,
      high: 8,
      medium: 7,
      low: 3,
    },
    tasks_by_horizon: {
      '90_days': [...],
      '180_days': [...],
      '365_days': [...],
    },
    all_tasks: [...],
  },

  strategic_priorities: [],

  methodology: {
    method_version_code: "FAL v1.0",
    ifme_explanation: "IFME™ avalia 8 dimensões...",
    mfis_explanation: "MFIS™ mapeia tensões...",
    mqe_explanation: "MQE™ qualifica integração...",
    scale_explanation: "Escala: 0=Crítico, 1=Básico, 2=Estruturado, 3=Avançado",
  },
}
```

---

## 5. Resumo de Funções Narrativas

| Função | Input | Output | Campos Consumidos |
|--------|-------|--------|-------------------|
| `generateExecutiveSummary()` | reportPayload | 4-5 parágrafos | overall_maturity_*, main_systemic_tension, systemic_leverage_dimension, dimensions, action_plan |
| `generateFragilitiesNarrative()` | reportPayload | Lista de 5 fragilidades com contexto de risco | top_crossings, crossing_key mapping |
| `generateMfisNarrative()` | reportPayload | Explicação de MFIS + ponto de alavanca | top_tensions, systemic_leverage_dimension, dimension scores |
| `generatePriorityNarrative()` | reportPayload | 3 prioridades estratégicas estruturadas | systemic_leverage_dimension, top_tensions, dimensions críticas |
| `generateActionPlanNarrative()` | reportPayload | Sequência de 90–180–365 dias com contexto | tasks_by_horizon, tasks_by_priority |
| `enrichReportPayload()` | reportPayload | reportPayload enriched com todas as narrativas | (todos os anteriores) |

---

## 6. Próximos Passos

✅ **Concluído:**
- DataMapper (`buildReportPayload()`)
- Narrative Engine (`narrativeEngine.js`)
- Shape canônico do payload
- Exemplos de output

⏭️ **Próxima fase:**
- Criar 8 componentes React para cada seção
- Implementar PDF renderer
- Integrar tudo em função backend `generateReport()`

---