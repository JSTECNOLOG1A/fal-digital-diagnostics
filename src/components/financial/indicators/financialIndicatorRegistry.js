/**
 * financialIndicatorRegistry.js
 * Metadata VISUAL dos 16 indicadores principais do Método FAL.
 * Usa EXCLUSIVAMENTE códigos reais gerados pelo backend (buildFinancialStatements).
 *
 * NÃO calcula — apenas descreve como exibir.
 * Kanitz e EBITDA Gerencial ficam de fora (renderizados em abas próprias).
 *
 * Benchmark de mercado: cada indicador possui faixas saudavel/atencao
 * para classificação automática do status (Saudável / Médio / Atenção).
 *   orientacao "crescente"  → valor alto é bom (saudavel > atencao)
 *   orientacao "decrescente" → valor baixo é bom (saudavel < atencao)
 *   tipo "sinal"             → positivo = saudável, negativo = atenção
 */
export const financialIndicatorRegistry = [
  // ── Liquidez ───────────────────────────────────────────────────────────────
  {
    key: "liquidez_corrente",
    label: "LIQ. CORRENTE",
    fullLabel: "Liquidez corrente",
    group: "liquidez",
    groupLabel: "INDICADORES DE LIQUIDEZ",
    format: "number",
    decimals: 2,
    order: 10,
    formula: "Ativo Circulante / Passivo Circulante",
    description:
      "Mede a capacidade da empresa de honrar obrigações de curto prazo com ativos de curto prazo.",
    benchmark: {
      orientacao: "crescente",
      saudavel: 1.5,
      atencao: 1.0,
      referencia: "≥ 1,5  |  1,0–1,5  |  < 1,0",
      descritivo: "Capacidade folgada para pagar obrigações de curto prazo.",
    },
  },
  {
    key: "liquidez_seca",
    label: "LIQ. SECA",
    fullLabel: "Liquidez seca",
    group: "liquidez",
    groupLabel: "INDICADORES DE LIQUIDEZ",
    format: "number",
    decimals: 2,
    order: 20,
    formula: "(Ativo Circulante − Estoques) / Passivo Circulante",
    description: "Mede a liquidez de curto prazo desconsiderando estoques.",
    benchmark: {
      orientacao: "crescente",
      saudavel: 1.0,
      atencao: 0.7,
      referencia: "≥ 1,0  |  0,7–1,0  |  < 0,7",
      descritivo: "Liquidez robusta mesmo desconsiderando estoques.",
    },
  },
  {
    key: "liquidez_imediata",
    label: "LIQ. IMEDIATA",
    fullLabel: "Liquidez imediata",
    group: "liquidez",
    groupLabel: "INDICADORES DE LIQUIDEZ",
    format: "number",
    decimals: 2,
    order: 30,
    formula: "Caixa e Equivalentes / Passivo Circulante",
    description:
      "Mede a liquidez imediata considerando apenas recursos disponíveis.",
    benchmark: {
      orientacao: "crescente",
      saudavel: 0.2,
      atencao: 0.1,
      referencia: "≥ 0,2  |  0,1–0,2  |  < 0,1",
      descritivo: "Disponibilidade imediata suficiente para urgências.",
    },
  },
  {
    key: "capital_circulante_liquido",
    label: "CAP. CIRC. LÍQ.",
    fullLabel: "Capital circulante líquido",
    group: "liquidez",
    groupLabel: "INDICADORES DE LIQUIDEZ",
    format: "currency",
    decimals: 2,
    order: 50,
    formula: "Ativo Circulante − Passivo Circulante",
    description:
      "Representa a folga ou insuficiência financeira de curto prazo.",
    benchmark: {
      tipo: "sinal",
      referencia: "Positivo  |  Neutro  |  Negativo",
      descritivo: "Folga financeira de curto prazo positiva.",
    },
  },

  // ── Endividamento ───────────────────────────────────────────────────────────
  {
    key: "divida_liquida_sobre_ebitda",
    label: "DÍV. LÍQ. / EBITDA",
    fullLabel: "Dívida líquida / EBITDA",
    group: "endividamento",
    groupLabel: "INDICADORES DE ENDIVIDAMENTO",
    format: "multiple",
    decimals: 2,
    order: 10,
    formula: "Dívida Líquida / Resultado Operacional",
    description:
      "Indica em quantos anos a empresa pagaria sua dívida líquida com a geração operacional.",
    benchmark: {
      orientacao: "decrescente",
      saudavel: 2.0,
      atencao: 3.5,
      referencia: "≤ 2,0x  |  2,0x–3,5x  |  > 3,5x",
      descritivo: "Dívida líquida baixa em relação à geração operacional.",
    },
  },
  {
    key: "passivo_sobre_ativo",
    label: "PASSIVO / ATIVO",
    fullLabel: "Passivo / ativo",
    group: "endividamento",
    groupLabel: "INDICADORES DE ENDIVIDAMENTO",
    format: "number",
    decimals: 2,
    order: 20,
    formula: "Passivo Exigível Total / Ativo Total",
    description:
      "Mede a participação de capital de terceiros no financiamento dos ativos.",
    benchmark: {
      orientacao: "decrescente",
      saudavel: 0.4,
      atencao: 0.6,
      referencia: "≤ 0,4  |  0,4–0,6  |  > 0,6",
      descritivo: "Baixa dependência de capital de terceiros.",
    },
  },
  {
    key: "capital_terceiros_sobre_pl",
    label: "CAP. TERCEIROS / PL",
    fullLabel: "Capital de terceiros / patrimônio líquido",
    group: "endividamento",
    groupLabel: "INDICADORES DE ENDIVIDAMENTO",
    format: "multiple",
    decimals: 2,
    order: 30,
    formula: "Passivo Exigível / Patrimônio Líquido",
    description:
      "Mede a proporção entre recursos de terceiros e capital próprio.",
    benchmark: {
      orientacao: "decrescente",
      saudavel: 0.5,
      atencao: 1.0,
      referencia: "≤ 0,5x  |  0,5x–1,0x  |  > 1,0x",
      descritivo: "Equilíbrio entre capital próprio e de terceiros.",
    },
  },
  {
    key: "composicao_endividamento",
    label: "COMP. DÍVIDA",
    fullLabel: "Composição da dívida",
    group: "endividamento",
    groupLabel: "INDICADORES DE ENDIVIDAMENTO",
    format: "percent",
    decimals: 2,
    order: 40,
    formula: "Passivo Circulante / Passivo Exigível Total",
    description:
      "Indica quanto da dívida total está concentrada no curto prazo.",
    benchmark: {
      orientacao: "decrescente",
      saudavel: 0.4,
      atencao: 0.7,
      referencia: "≤ 40%  |  40%–70%  |  > 70%",
      descritivo: "Dívida concentrada no longo prazo, sem pressão de curto prazo.",
    },
  },

  // ── Rentabilidade ──────────────────────────────────────────────────────────
  {
    key: "margem_bruta",
    label: "M. BRUTA",
    fullLabel: "Margem bruta",
    group: "rentabilidade",
    groupLabel: "INDICADORES DE RENTABILIDADE",
    format: "percent",
    decimals: 2,
    order: 10,
    formula: "Lucro Bruto / Receita Líquida",
    description: "Mede a rentabilidade bruta após custos diretos.",
    benchmark: {
      orientacao: "crescente",
      saudavel: 0.3,
      atencao: 0.15,
      referencia: "≥ 30%  |  15%–30%  |  < 15%",
      descritivo: "Rentabilidade bruta saudável após custos diretos.",
    },
  },
  {
    key: "margem_ebitda",
    label: "M. EBITDA",
    fullLabel: "Margem EBITDA",
    group: "rentabilidade",
    groupLabel: "INDICADORES DE RENTABILIDADE",
    format: "percent",
    decimals: 2,
    order: 20,
    formula: "Resultado Operacional / Receita Líquida",
    description:
      "Mede a geração operacional antes de depreciação, amortização, resultado financeiro e tributos.",
    benchmark: {
      orientacao: "crescente",
      saudavel: 0.2,
      atencao: 0.1,
      referencia: "≥ 20%  |  10%–20%  |  < 10%",
      descritivo: "Alta eficiência na geração de caixa operacional.",
    },
  },
  {
    key: "margem_liquida",
    label: "M. LÍQUIDA",
    fullLabel: "Margem líquida",
    group: "rentabilidade",
    groupLabel: "INDICADORES DE RENTABILIDADE",
    format: "percent",
    decimals: 2,
    order: 30,
    formula: "Lucro Líquido / Receita Líquida",
    description: "Mede a parcela da receita convertida em lucro líquido.",
    benchmark: {
      orientacao: "crescente",
      saudavel: 0.1,
      atencao: 0.05,
      referencia: "≥ 10%  |  5%–10%  |  < 5%",
      descritivo: "Boa conversão da receita em lucro líquido.",
    },
  },
  {
    key: "roe",
    label: "ROE",
    fullLabel: "Retorno sobre patrimônio líquido",
    group: "rentabilidade",
    groupLabel: "INDICADORES DE RENTABILIDADE",
    format: "percent",
    decimals: 2,
    order: 40,
    formula: "Lucro Líquido / Patrimônio Líquido",
    description: "Mede o retorno gerado sobre o capital próprio.",
    benchmark: {
      orientacao: "crescente",
      saudavel: 0.15,
      atencao: 0.08,
      referencia: "≥ 15%  |  8%–15%  |  < 8%",
      descritivo: "Excelente retorno sobre o capital dos sócios.",
    },
  },
  {
    key: "roic",
    label: "ROIC",
    fullLabel: "Retorno sobre capital investido",
    group: "rentabilidade",
    groupLabel: "INDICADORES DE RENTABILIDADE",
    format: "percent",
    decimals: 2,
    order: 50,
    formula: "Resultado Operacional / Capital Investido",
    description: "Mede o retorno operacional sobre o capital investido.",
    benchmark: {
      orientacao: "crescente",
      saudavel: 0.12,
      atencao: 0.08,
      referencia: "≥ 12%  |  8%–12%  |  < 8%",
      descritivo: "Retorno atrativo sobre o capital investido.",
    },
  },

  // ── Eficiência ──────────────────────────────────────────────────────────────
  {
    key: "prazo_medio_recebimento",
    label: "PMR",
    fullLabel: "Prazo médio de recebimento",
    group: "eficiencia",
    groupLabel: "INDICADORES DE EFICIÊNCIA",
    format: "days",
    decimals: 0,
    order: 10,
    formula: "(Contas a Receber / Receita Bruta) × 360",
    description:
      "Indica o prazo médio, em dias, que a empresa leva para receber suas vendas.",
    benchmark: {
      orientacao: "decrescente",
      saudavel: 30,
      atencao: 60,
      referencia: "≤ 30  |  30–60  |  > 60",
      descritivo: "Recebimento ágil das vendas, ciclo financeiro curto.",
    },
  },
  {
    key: "prazo_medio_pagamento",
    label: "PMP",
    fullLabel: "Prazo médio de pagamento",
    group: "eficiencia",
    groupLabel: "INDICADORES DE EFICIÊNCIA",
    format: "days",
    decimals: 0,
    order: 20,
    formula: "(Fornecedores / Custo) × 360",
    description:
      "Indica o prazo médio, em dias, que a empresa leva para pagar seus fornecedores.",
    benchmark: {
      orientacao: "crescente",
      saudavel: 45,
      atencao: 30,
      referencia: "≥ 45  |  30–45  |  < 30",
      descritivo: "Bom poder de negociação com fornecedores, prazos estendidos.",
    },
  },
  {
    key: "crescimento_receita", label: "CRESC. RECEITA", fullLabel: "Crescimento de receita", group: "eficiencia", groupLabel: "INDICADORES DE EFICIÊNCIA", format: "percent", decimals: 2, order: 60,
    formula: "(Receita atual − anterior) / Receita anterior", description: "Mede a variação da receita entre períodos.", benchmark: { orientacao: "crescente", saudavel: 0.1, atencao: 0, referencia: "≥ 10% | 0%–10% | < 0%", descritivo: "Crescimento consistente da receita." }
  },
  { key: "liquidez_geral", label: "LIQ. GERAL", fullLabel: "Liquidez geral", group: "liquidez", groupLabel: "INDICADORES DE LIQUIDEZ", format: "number", decimals: 2, order: 40, formula: "Realizável total / Passivo exigível", description: "Mede a cobertura das obrigações totais por ativos realizáveis." },
  { key: "divida_liquida", label: "DÍVIDA LÍQUIDA", fullLabel: "Dívida líquida", group: "endividamento", groupLabel: "INDICADORES DE ENDIVIDAMENTO", format: "currency", decimals: 2, order: 50, formula: "Dívida bruta − disponibilidade imediata", description: "Dívida financeira líquida de caixa e aplicações de liquidez imediata." },
  { key: "margem_ebit", label: "M. EBIT", fullLabel: "Margem EBIT", group: "rentabilidade", groupLabel: "INDICADORES DE RENTABILIDADE", format: "percent", decimals: 2, order: 25, formula: "EBIT / Receita Líquida", description: "Margem operacional após depreciação e amortização." },
  { key: "roa", label: "ROA", fullLabel: "Retorno sobre ativos", group: "rentabilidade", groupLabel: "INDICADORES DE RENTABILIDADE", format: "percent", decimals: 2, order: 45, formula: "Resultado Líquido / Ativo Total", description: "Retorno líquido gerado pelos ativos." },
  { key: "giro_ativo", label: "GIRO ATIVO", fullLabel: "Giro do ativo", group: "eficiencia", groupLabel: "INDICADORES DE EFICIÊNCIA", format: "number", decimals: 2, order: 70, formula: "Receita Líquida / Ativo Total", description: "Eficiência dos ativos na geração de receita." },
  { key: "prazo_medio_estoque", label: "PME", fullLabel: "Prazo médio de estoque", group: "eficiencia", groupLabel: "INDICADORES DE EFICIÊNCIA", format: "days", decimals: 0, order: 30, formula: "Estoques × 360 / |Custos|", description: "Permanência média dos estoques." },
  { key: "ciclo_operacional", label: "CICLO OP.", fullLabel: "Ciclo operacional", group: "eficiencia", groupLabel: "INDICADORES DE EFICIÊNCIA", format: "days", decimals: 0, order: 40, formula: "PMR + PME", description: "Dias entre a compra e o recebimento da venda." },
  { key: "ciclo_financeiro", label: "CICLO FIN.", fullLabel: "Ciclo financeiro", group: "eficiencia", groupLabel: "INDICADORES DE EFICIÊNCIA", format: "days", decimals: 0, order: 50, formula: "Ciclo Operacional − PMP", description: "Dias de financiamento do ciclo operacional." },
];

// Ordem canônica dos grupos visuais
export const INDICATOR_GROUP_ORDER = [
  "liquidez",
  "endividamento",
  "rentabilidade",
  "eficiencia",
];