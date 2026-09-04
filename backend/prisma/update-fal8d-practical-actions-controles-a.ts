/**
 * Lote 8a da reescrita do FAL 8D clássico — dimensão "controles_internos",
 * parte 1: compras, controle_estoques, custos_agricolas, endividamento (36 perguntas).
 * Ver update-fal8d-practical-actions-sistemas.ts para o contexto completo.
 * Rodar com: npx tsx prisma/update-fal8d-practical-actions-controles-a.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

type Row = { id: string; title: string; checklist: string; evidence: string };

const ROWS: Row[] = [
  // compras
  { id: 'controles_internos_compras_001', title: 'Formalizar política/procedimento de compras',
    checklist: '1) Levantar como o processo de compras funciona hoje na prática. 2) Documentar o passo a passo formal (solicitação, cotação, aprovação, pedido, recebimento). 3) Definir responsável por cada etapa. 4) Aprovar e comunicar à equipe. 5) Aplicar no próximo ciclo de compras.',
    evidence: 'Política/procedimento de compras formalizado e comunicado à equipe.' },
  { id: 'controles_internos_compras_002', title: 'Implantar requisição formal de compra',
    checklist: '1) Criar um formulário/modelo simples de requisição de compra. 2) Definir que nenhuma compra relevante inicia sem essa requisição. 3) Comunicar a exigência às áreas solicitantes. 4) Aplicar nas próximas compras. 5) Arquivar as requisições para rastreabilidade.',
    evidence: 'Requisições de compra formalizadas para as compras mais recentes.' },
  { id: 'controles_internos_compras_003', title: 'Migrar a emissão e controle de pedidos de compra para o sistema',
    checklist: '1) Verificar se hoje os pedidos são feitos fora do sistema (e-mail, telefone, papel). 2) Avaliar o módulo de compras do ERP/sistema disponível. 3) Migrar os pedidos para esse módulo. 4) Treinar a equipe de compras. 5) Descontinuar o processo paralelo.',
    evidence: 'Pedidos de compra emitidos e controlados no sistema, processo paralelo descontinuado.' },
  { id: 'controles_internos_compras_004', title: 'Implantar cotação obrigatória para compras relevantes',
    checklist: '1) Definir o valor/critério a partir do qual uma compra exige cotação. 2) Definir o número mínimo de cotações (ex.: 3). 3) Criar um modelo simples de comparação. 4) Aplicar na próxima compra relevante. 5) Arquivar as cotações para rastreabilidade.',
    evidence: 'Cotações comparativas registradas para a última compra relevante.' },
  { id: 'controles_internos_compras_005', title: 'Definir alçadas de aprovação para pedidos de compra',
    checklist: '1) Definir faixas de valor e o aprovador de cada faixa. 2) Documentar a matriz de alçadas. 3) Configurar o sistema (se possível) para exigir essa aprovação. 4) Comunicar à equipe. 5) Testar com o próximo pedido.',
    evidence: 'Matriz de alçadas de compras documentada e aplicada no pedido mais recente.' },
  { id: 'controles_internos_compras_006', title: 'Implantar conferência de três vias (pedido, nota fiscal, mercadoria)',
    checklist: '1) Definir quem faz essa conferência no recebimento. 2) Definir o que checar (quantidade, preço, especificação). 3) Definir o que fazer quando houver divergência. 4) Testar com o próximo recebimento. 5) Registrar as conferências feitas.',
    evidence: 'Conferência de três vias registrada no recebimento mais recente, com tratativa de divergências.' },
  { id: 'controles_internos_compras_007', title: 'Integrar os registros de compras a estoque e contabilidade',
    checklist: '1) Verificar se hoje há lançamento duplicado (compra registrada separadamente em cada área). 2) Avaliar a integração disponível no sistema atual. 3) Configurar/ativar a integração. 4) Testar com uma compra real. 5) Eliminar o lançamento duplicado.',
    evidence: 'Compra recente refletida automaticamente em estoque e contabilidade, sem lançamento duplicado.' },
  { id: 'controles_internos_compras_008', title: 'Implantar monitoramento periódico de fornecedores e preços',
    checklist: '1) Definir os indicadores a acompanhar (preço médio, volume por fornecedor, concentração). 2) Definir periodicidade de análise. 3) Consolidar num painel simples. 4) Identificar oportunidades (fornecedor caro, concentração excessiva). 5) Reportar à gestão.',
    evidence: 'Painel de monitoramento de fornecedores/preços atualizado, com oportunidades identificadas.' },
  { id: 'controles_internos_compras_009', title: 'Implantar auditoria/revisão periódica do processo de compras',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Testar uma amostra de compras contra o procedimento formal. 3) Identificar desvios. 4) Corrigir e reforçar treinamento. 5) Documentar a revisão.',
    evidence: 'Relatório de revisão/auditoria do processo de compras, com desvios corrigidos.' },
  // controle_estoques
  { id: 'controles_internos_controle_estoques_001', title: 'Formalizar procedimento de controle de estoques',
    checklist: '1) Levantar como as movimentações são controladas hoje. 2) Documentar o procedimento (entrada, saída, transferência). 3) Definir responsável. 4) Aprovar e comunicar. 5) Aplicar no próximo ciclo.',
    evidence: 'Procedimento formal de controle de estoques documentado e comunicado.' },
  { id: 'controles_internos_controle_estoques_002', title: 'Migrar registro de movimentação de estoque para sistema/controle estruturado',
    checklist: '1) Verificar se hoje há movimentação sem registro formal. 2) Definir o sistema/planilha a usar. 3) Migrar o controle atual para essa ferramenta. 4) Treinar quem registra. 5) Eliminar controles paralelos.',
    evidence: 'Movimentações de estoque registradas em sistema/controle estruturado, controles paralelos eliminados.' },
  { id: 'controles_internos_controle_estoques_003', title: 'Segmentar o controle de estoque por produto/cultura/unidade',
    checklist: '1) Definir a granularidade necessária (produto, cultura, unidade). 2) Ajustar o registro para capturar essa segmentação. 3) Migrar o histórico recente se possível. 4) Validar com uma contagem de amostra. 5) Manter a segmentação nos próximos registros.',
    evidence: 'Estoque segmentado por produto/cultura/unidade, validado com contagem de amostra.' },
  { id: 'controles_internos_controle_estoques_004', title: 'Implantar conferência entre registro de estoque e documentos',
    checklist: '1) Definir a periodicidade da conferência. 2) Comparar uma amostra de registros com o documento de origem (NF, requisição). 3) Identificar divergências. 4) Corrigir o registro quando necessário. 5) Documentar a conferência.',
    evidence: 'Conferência entre estoque e documentos de origem realizada, divergências corrigidas.' },
  { id: 'controles_internos_controle_estoques_005', title: 'Implantar inventário físico periódico',
    checklist: '1) Definir periodicidade do inventário (ex.: semestral ou anual). 2) Definir o método de contagem. 3) Executar o próximo inventário. 4) Comparar com o saldo registrado. 5) Ajustar o registro conforme o resultado.',
    evidence: 'Relatório do inventário físico mais recente, com comparação e ajuste do saldo registrado.' },
  { id: 'controles_internos_controle_estoques_006', title: 'Implantar reconciliação entre estoque físico e contábil',
    checklist: '1) Usar o resultado do inventário físico. 2) Comparar com o saldo contábil/sistema. 3) Investigar divergências relevantes. 4) Corrigir o registro contábil quando necessário. 5) Documentar a reconciliação.',
    evidence: 'Reconciliação entre estoque físico e contábil do último inventário, com divergências tratadas.' },
  { id: 'controles_internos_controle_estoques_007', title: 'Implantar análise e justificativa de perdas/diferenças de estoque',
    checklist: '1) Priorizar as diferenças mais relevantes encontradas na reconciliação. 2) Investigar a causa (perda, furto, erro de registro, deterioração). 3) Documentar a justificativa. 4) Definir ação para reduzir a causa. 5) Acompanhar se a diferença reduziu no próximo ciclo.',
    evidence: 'Análise e justificativa documentada para as principais diferenças de estoque do último ciclo.' },
  { id: 'controles_internos_controle_estoques_008', title: 'Implantar monitoramento de acuracidade e giro de estoque',
    checklist: '1) Definir os indicadores (% de acuracidade, giro por item/categoria). 2) Calcular periodicamente. 3) Identificar itens com baixo giro ou baixa acuracidade. 4) Definir ação (revisão de compra, campanha de queima de estoque parado). 5) Reportar à gestão.',
    evidence: 'Indicadores de acuracidade e giro de estoque monitorados, com ações definidas para itens críticos.' },
  { id: 'controles_internos_controle_estoques_009', title: 'Implantar auditoria/revisão periódica do processo de controle de estoques',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Testar o processo contra o procedimento formal. 3) Identificar desvios. 4) Corrigir e reforçar treinamento. 5) Documentar a revisão.',
    evidence: 'Relatório de revisão/auditoria do processo de controle de estoques, com desvios corrigidos.' },
  // custos_agricolas
  { id: 'controles_internos_custos_agricolas_001', title: 'Formalizar metodologia de apuração de custos agrícolas',
    checklist: '1) Levantar como os custos são apurados hoje. 2) Documentar a metodologia (o que entra, como ratear custos comuns). 3) Validar com contabilidade/controladoria. 4) Aprovar formalmente. 5) Aplicar na próxima safra.',
    evidence: 'Metodologia de apuração de custos agrícolas documentada e validada.' },
  { id: 'controles_internos_custos_agricolas_002', title: 'Implantar registro de custos por safra/cultura/unidade',
    checklist: '1) Definir a granularidade de registro necessária. 2) Ajustar o sistema/planilha para capturar essa segmentação. 3) Migrar dados recentes se possível. 4) Treinar quem lança os custos. 5) Manter a segmentação nos próximos registros.',
    evidence: 'Custos de produção registrados por safra/cultura/unidade no ciclo mais recente.' },
  { id: 'controles_internos_custos_agricolas_003', title: 'Detalhar o registro de custos por talhão/área produtiva',
    checklist: '1) Definir a unidade de registro (talhão, área, centro de custo). 2) Ajustar o processo de apontamento de custo para essa granularidade. 3) Treinar a equipe de campo/operação. 4) Testar com um ciclo. 5) Corrigir o que não estiver funcionando.',
    evidence: 'Custos agrícolas registrados por talhão/área produtiva no último ciclo testado.' },
  { id: 'controles_internos_custos_agricolas_004', title: 'Implantar controle de consumo de insumos, mão de obra e operações',
    checklist: '1) Definir o que registrar (insumo aplicado, horas de mão de obra, operações mecanizadas). 2) Definir quem registra e com que frequência. 3) Consolidar por talhão/cultura. 4) Conferir a consistência dos dados. 5) Usar para compor o custo de produção.',
    evidence: 'Controle de consumo de insumos/mão de obra/operações do último ciclo, usado na apuração de custo.' },
  { id: 'controles_internos_custos_agricolas_005', title: 'Implantar comparação de custo previsto vs. realizado por safra/cultura',
    checklist: '1) Usar o orçamento/planejamento de safra já elaborado. 2) Comparar com o custo real apurado ao final do ciclo. 3) Calcular o desvio. 4) Investigar as causas dos maiores desvios. 5) Registrar a comparação.',
    evidence: 'Comparação de custo previsto vs. realizado da última safra, com desvios investigados.' },
  { id: 'controles_internos_custos_agricolas_006', title: 'Implantar conciliação entre custo agrícola gerencial e registro contábil',
    checklist: '1) Comparar o total de custo apurado gerencialmente com o registrado na contabilidade. 2) Investigar divergências. 3) Ajustar o processo para reduzir a divergência. 4) Repetir a cada fechamento. 5) Documentar a conciliação.',
    evidence: 'Conciliação entre custo agrícola gerencial e contábil do último fechamento, divergências tratadas.' },
  { id: 'controles_internos_custos_agricolas_007', title: 'Implantar análise de variação de custo entre safras',
    checklist: '1) Comparar o custo por hectare/unidade entre a safra atual e anteriores. 2) Identificar variações relevantes. 3) Investigar a causa (clima, preço de insumo, produtividade). 4) Documentar a explicação. 5) Usar no planejamento da próxima safra.',
    evidence: 'Análise de variação de custo entre safras documentada, usada no planejamento seguinte.' },
  { id: 'controles_internos_custos_agricolas_008', title: 'Implantar monitoramento de rentabilidade por cultura/área',
    checklist: '1) Cruzar o custo apurado com a receita gerada por cultura/área. 2) Calcular a rentabilidade (margem) de cada uma. 3) Identificar culturas/áreas mais e menos rentáveis. 4) Compartilhar com a gestão. 5) Usar na decisão de mix de próxima safra.',
    evidence: 'Análise de rentabilidade por cultura/área do último ciclo, usada em decisão de mix.' },
  { id: 'controles_internos_custos_agricolas_009', title: 'Implantar auditoria/revisão periódica do processo de custos agrícolas',
    checklist: '1) Definir periodicidade (anual, por safra). 2) Testar o processo contra a metodologia formal. 3) Identificar desvios. 4) Corrigir e ajustar a metodologia se necessário. 5) Documentar a revisão.',
    evidence: 'Relatório de revisão/auditoria do processo de custos agrícolas, com ajustes aplicados.' },
  // endividamento
  { id: 'controles_internos_endividamento_001', title: 'Formalizar política de gestão de dívidas e financiamentos',
    checklist: '1) Levantar como as decisões de dívida são tomadas hoje. 2) Documentar critérios (quando captar, limites aceitáveis). 3) Validar com a gestão/sócios. 4) Aprovar formalmente. 5) Comunicar aos responsáveis financeiros.',
    evidence: 'Política de gestão de dívidas formalizada e aprovada.' },
  { id: 'controles_internos_endividamento_002', title: 'Implantar controle central de operações de crédito e financiamento',
    checklist: '1) Levantar todas as operações ativas. 2) Registrar cada uma numa base única (valor, prazo, taxa, garantia). 3) Definir responsável por manter atualizado. 4) Migrar controles paralelos para essa base única. 5) Manter atualizado a cada nova operação.',
    evidence: 'Base central de operações de crédito/financiamento, atualizada e única.' },
  { id: 'controles_internos_endividamento_003', title: 'Formalizar análise de CET e impacto no caixa antes de captar',
    checklist: '1) Definir que toda captação passa por essa análise antes de contratar. 2) Calcular o CET de cada proposta. 3) Simular o impacto no fluxo de caixa projetado. 4) Comparar alternativas. 5) Registrar a análise e a decisão.',
    evidence: 'Pelo menos uma captação recente com análise de CET e impacto no caixa documentada.' },
  { id: 'controles_internos_endividamento_004', title: 'Definir alçadas de aprovação para operações de crédito',
    checklist: '1) Definir faixas de valor e aprovador de cada faixa. 2) Documentar a matriz de alçadas. 3) Comunicar formalmente. 4) Aplicar na próxima operação. 5) Registrar a aprovação.',
    evidence: 'Matriz de alçadas de crédito documentada e aplicada na operação mais recente.' },
  { id: 'controles_internos_endividamento_005', title: 'Estruturar o controle das condições contratuais das dívidas',
    checklist: '1) Levantar os contratos de dívida vigentes. 2) Registrar as condições principais de cada um (prazo, taxa, garantia, covenants). 3) Consolidar numa base única. 4) Verificar aderência às condições (covenants cumpridos). 5) Manter atualizado.',
    evidence: 'Base de condições contratuais das dívidas atualizada, com verificação de covenants.' },
  { id: 'controles_internos_endividamento_006', title: 'Implantar conciliação periódica de saldos de dívida',
    checklist: '1) Definir periodicidade (mensal recomendado). 2) Comparar o saldo registrado com extrato/posição do banco. 3) Investigar divergências. 4) Corrigir o registro quando necessário. 5) Documentar a conciliação.',
    evidence: 'Conciliação de saldos de dívida do último período, divergências tratadas.' },
  { id: 'controles_internos_endividamento_007', title: 'Implantar monitoramento de indicadores de endividamento',
    checklist: '1) Definir os indicadores (dívida/EBITDA, dívida líquida, cobertura de juros). 2) Calcular periodicamente. 3) Comparar com limites/covenants estabelecidos. 4) Identificar sinais de alerta. 5) Reportar à gestão.',
    evidence: 'Indicadores de endividamento monitorados periodicamente, com sinais de alerta reportados.' },
  { id: 'controles_internos_endividamento_008', title: 'Implantar análise periódica do perfil de dívidas',
    checklist: '1) Definir periodicidade (ex.: anual). 2) Avaliar o perfil (curto vs. longo prazo, moeda, taxa fixa vs. variável). 3) Avaliar se o perfil é adequado ao fluxo de caixa do negócio. 4) Propor ajustes (alongamento, troca de indexador). 5) Registrar a análise.',
    evidence: 'Registro de análise periódica do perfil de dívidas, com ajustes propostos quando aplicável.' },
  { id: 'controles_internos_endividamento_009', title: 'Implantar auditoria/revisão periódica do processo de gestão de endividamento',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Testar o processo contra a política formal. 3) Identificar desvios. 4) Corrigir e ajustar. 5) Documentar a revisão.',
    evidence: 'Relatório de revisão/auditoria do processo de gestão de endividamento, com ajustes aplicados.' },
];

async function main() {
  let updatedQuestions = 0;
  let updatedActions = 0;
  const missing: string[] = [];
  const missingAction: string[] = [];

  for (const row of ROWS) {
    const q = await prisma.falQuestion.findUnique({ where: { questionId: row.id } });
    if (!q) { missing.push(row.id); continue; }

    await prisma.falQuestion.update({
      where: { questionId: row.id },
      data: { guidance: row.checklist, evidenceHint: row.evidence },
    });
    updatedQuestions++;

    const updated = await prisma.falQuestionActionLibrary.updateMany({
      where: { questionId: row.id },
      data: {
        actionTitle: row.title,
        actionDescription: row.checklist,
        howToExecute: row.checklist,
        expectedEvidence: row.evidence,
      },
    });
    updatedActions += updated.count;
    if (updated.count === 0) missingAction.push(row.id);
  }

  console.log(`[controles_internos parte A] ${updatedQuestions} FalQuestion atualizadas, ${updatedActions} FalQuestionActionLibrary atualizadas. Total esperado: 36.`);
  if (missing.length) console.log(`FalQuestion não encontrada: ${missing.join(', ')}`);
  if (missingAction.length) console.log(`Sem FalQuestionActionLibrary (precisa criar): ${missingAction.join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
