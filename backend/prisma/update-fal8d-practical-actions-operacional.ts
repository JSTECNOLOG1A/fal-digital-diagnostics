/**
 * Lote 4 da reescrita do FAL 8D clássico — dimensão "operacional" (20 perguntas).
 * Ver update-fal8d-practical-actions-sistemas.ts para o contexto completo.
 * Rodar com: npx tsx prisma/update-fal8d-practical-actions-operacional.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

type Row = { id: string; title: string; checklist: string; evidence: string };

const ROWS: Row[] = [
  { id: 'operacional_gestao_insumos_001', title: 'Implantar registro de consumo de insumos por área/cultura',
    checklist: '1) Definir a unidade de registro (talhão, área, cultura ou atividade). 2) Escolher uma ferramenta simples (planilha ou sistema) para registrar. 3) Treinar quem aplica o insumo a registrar quantidade e data. 4) Consolidar os registros por período. 5) Revisar a consistência dos dados registrados.',
    evidence: 'Registro de consumo de insumos por área/cultura, com dados consolidados de pelo menos um ciclo.' },
  { id: 'operacional_gestao_producao_001', title: 'Implantar registro de produção por área/cultura/processo',
    checklist: '1) Definir a unidade de registro (talhão, área, cultura, linha de processo). 2) Escolher uma ferramenta simples para registrar volume produzido. 3) Definir quem registra e com que frequência. 4) Consolidar os dados por período/safra. 5) Revisar a consistência dos dados registrados.',
    evidence: 'Registro de produção por área/cultura/processo, consolidado de pelo menos um período recente.' },
  { id: 'operacional_gestao_safra_e_logistica_001', title: 'Criar plano de safra com acompanhamento de execução',
    checklist: '1) Montar o plano de safra antes do início do ciclo (área, cultura, cronograma, insumos previstos). 2) Definir marcos de acompanhamento ao longo da safra. 3) Registrar o executado frente ao planejado em cada marco. 4) Identificar desvios relevantes. 5) Ajustar o plano da próxima safra com base no aprendizado.',
    evidence: 'Plano de safra documentado com acompanhamento de execução registrado em pelo menos um ciclo.' },
  { id: 'operacional_planejamento_produtivo_001', title: 'Formalizar o planejamento de produção antes do ciclo',
    checklist: '1) Definir os itens mínimos do plano (área, meta de produção, recursos necessários, cronograma). 2) Elaborar o plano antes do início de cada ciclo. 3) Validar o plano com quem executa a operação. 4) Comunicar o plano à equipe envolvida. 5) Guardar o plano para comparação posterior com o realizado.',
    evidence: 'Plano de produção documentado e comunicado antes do início do ciclo mais recente.' },
  { id: 'operacional_gestao_pessoas_001', title: 'Definir funções e responsabilidades por posição',
    checklist: '1) Listar as posições/cargos existentes na operação. 2) Para cada uma, descrever as principais responsabilidades. 3) Validar a descrição com quem ocupa a posição hoje. 4) Comunicar formalmente (mesmo que num documento simples). 5) Usar essa base em novas contratações.',
    evidence: 'Descrição de função por posição, validada e comunicada aos colaboradores.' },
  { id: 'operacional_planejamento_produtivo_002', title: 'Implantar comparação entre produção realizada e planejada',
    checklist: '1) Definir a meta/capacidade esperada por ciclo (a partir do plano de produção). 2) Registrar o realizado ao final do ciclo. 3) Calcular o desvio entre planejado e realizado. 4) Discutir o desvio com a equipe responsável. 5) Registrar as causas identificadas.',
    evidence: 'Comparação entre produção realizada e planejada do último ciclo, com desvios registrados.' },
  { id: 'operacional_gestao_safra_e_logistica_002', title: 'Implantar controle de prazos logísticos de produção e escoamento',
    checklist: '1) Mapear as etapas logísticas críticas (colheita, transporte, armazenagem, escoamento). 2) Definir prazo esperado para cada etapa. 3) Registrar o prazo real de cada etapa executada. 4) Identificar atrasos e seu impacto. 5) Ajustar o planejamento logístico do próximo ciclo.',
    evidence: 'Controle de prazos logísticos com comparação entre esperado e realizado no último ciclo.' },
  { id: 'operacional_gestao_pessoas_002', title: 'Implantar acompanhamento de desempenho por meta ou indicador',
    checklist: '1) Definir indicadores simples de desempenho por função (produtividade, qualidade, prazo). 2) Definir meta para cada indicador. 3) Acompanhar o resultado periodicamente. 4) Dar retorno (feedback) ao colaborador sobre o resultado. 5) Usar o histórico para decisões de desenvolvimento ou remuneração.',
    evidence: 'Indicadores de desempenho por função com metas e acompanhamento periódico registrado.' },
  { id: 'operacional_gestao_insumos_002', title: 'Implantar comparação entre consumo real e planejado de insumos',
    checklist: '1) Definir o consumo esperado por área/cultura (a partir do plano de safra). 2) Registrar o consumo real ao longo do ciclo. 3) Calcular o desvio entre esperado e real. 4) Investigar desvios relevantes. 5) Ajustar o planejamento de insumos do próximo ciclo.',
    evidence: 'Comparação entre consumo real e planejado de insumos do último ciclo, com desvios investigados.' },
  { id: 'operacional_gestao_producao_002', title: 'Implantar comparação de produtividade com meta/histórico',
    checklist: '1) Definir a meta de produtividade (por área/cultura) com base em histórico ou benchmark. 2) Calcular a produtividade real ao final do ciclo. 3) Comparar com a meta e com ciclos anteriores. 4) Identificar áreas/culturas com desvio relevante. 5) Discutir o resultado com quem executa a operação.',
    evidence: 'Comparação de produtividade real vs. meta/histórico do último ciclo, com áreas de desvio identificadas.' },
  { id: 'operacional_gestao_safra_e_logistica_003', title: 'Criar rotina de ajuste corretivo para problemas de safra/logística',
    checklist: '1) Definir o que conta como problema relevante (atraso, quebra de safra, gargalo logístico). 2) Definir um canal para reportar o problema rapidamente. 3) Definir o passo a passo de resposta (avaliar impacto, decidir ajuste, comunicar). 4) Registrar o ajuste aplicado e o resultado. 5) Usar o aprendizado no planejamento do próximo ciclo.',
    evidence: 'Registro de pelo menos um problema de safra/logística com ajuste corretivo aplicado e resultado documentado.' },
  { id: 'operacional_gestao_insumos_003', title: 'Criar rotina de análise de causa para desvios de insumos',
    checklist: '1) Priorizar os desvios de consumo/custo mais relevantes. 2) Investigar a causa-raiz de cada um (aplicação incorreta, perda, preço, clima). 3) Definir ação corretiva para a causa identificada. 4) Implementar a ação. 5) Verificar se o desvio reduziu no ciclo seguinte.',
    evidence: 'Análise de causa e ação corretiva documentada para pelo menos um desvio relevante de insumos.' },
  { id: 'operacional_gestao_pessoas_003', title: 'Criar rotina de revisão da estrutura de pessoas',
    checklist: '1) Definir periodicidade de revisão (ex.: anual ou por ciclo de safra). 2) Avaliar se a estrutura atual (quantidade, funções) atende à necessidade real do negócio. 3) Cruzar com o desempenho registrado. 4) Decidir ajustes (realocação, contratação, capacitação). 5) Registrar a revisão e as decisões.',
    evidence: 'Registro de revisão periódica da estrutura de pessoas, com decisões de ajuste documentadas.' },
  { id: 'operacional_gestao_producao_003', title: 'Criar rotina de análise de causa para desvios de produção',
    checklist: '1) Priorizar os desvios de produção mais relevantes. 2) Investigar a causa-raiz (clima, praga, falha de processo, mão de obra). 3) Definir ação corretiva. 4) Implementar a ação. 5) Verificar se a produtividade melhorou no ciclo seguinte.',
    evidence: 'Análise de causa e ação corretiva documentada para pelo menos um desvio relevante de produção.' },
  { id: 'operacional_planejamento_produtivo_003', title: 'Criar rotina de análise de desvios do planejamento produtivo',
    checklist: '1) Priorizar os desvios entre planejado e realizado mais relevantes. 2) Investigar se a causa é de recurso (insumo, mão de obra, clima) ou de meta mal dimensionada. 3) Ajustar recursos ou a meta para o próximo ciclo conforme a causa. 4) Registrar a decisão tomada. 5) Comparar o resultado no ciclo seguinte.',
    evidence: 'Análise de desvio do planejamento produtivo com ajuste de recurso/meta aplicado no ciclo seguinte.' },
  { id: 'operacional_gestao_safra_e_logistica_004', title: 'Criar rotina de revisão do planejamento de safra e logística',
    checklist: '1) Ao final de cada safra, comparar o planejado com o executado (produção, prazos, logística). 2) Identificar os principais aprendizados e desvios. 3) Ajustar as premissas do plano da próxima safra. 4) Validar o plano ajustado com a equipe operacional. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão do planejamento de safra/logística ao final do último ciclo, com ajustes aplicados.' },
  { id: 'operacional_planejamento_produtivo_004', title: 'Criar rotina de revisão do planejamento produtivo',
    checklist: '1) Definir periodicidade de revisão (por ciclo ou anual). 2) Incorporar os aprendizados dos desvios analisados. 3) Considerar mudanças operacionais (nova área, novo processo, nova cultura). 4) Atualizar o plano para o próximo ciclo. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica do planejamento produtivo, com aprendizados incorporados ao próximo ciclo.' },
  { id: 'operacional_gestao_pessoas_004', title: 'Criar rotina de revisão da gestão de pessoas',
    checklist: '1) Definir periodicidade de revisão (ex.: semestral). 2) Avaliar os resultados de desempenho e a rotatividade da equipe. 3) Identificar falhas recorrentes (treinamento insuficiente, função mal definida). 4) Definir ação de desenvolvimento ou correção. 5) Registrar a revisão e as ações aplicadas.',
    evidence: 'Registro de revisão periódica da gestão de pessoas, com ações de desenvolvimento/correção aplicadas.' },
  { id: 'operacional_gestao_producao_004', title: 'Criar rotina de revisão dos processos produtivos',
    checklist: '1) Definir periodicidade de revisão (por ciclo ou anual). 2) Avaliar a eficiência atual do processo (tempo, custo, qualidade). 3) Identificar oportunidades de melhoria com base no histórico. 4) Implementar a melhoria priorizada. 5) Medir o efeito no ciclo seguinte.',
    evidence: 'Registro de revisão periódica dos processos produtivos, com melhoria implementada e efeito medido.' },
  { id: 'operacional_gestao_insumos_004', title: 'Criar rotina de revisão da eficiência no uso de insumos',
    checklist: '1) Definir periodicidade de revisão (por ciclo ou anual). 2) Avaliar a eficiência do uso de insumos (resultado por unidade aplicada). 3) Comparar com benchmark ou histórico. 4) Identificar oportunidade de otimização (dose, timing, fornecedor). 5) Ajustar o planejamento de insumos do próximo ciclo.',
    evidence: 'Registro de revisão periódica da eficiência de insumos, com ajuste aplicado ao planejamento seguinte.' },
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

  console.log(`[operacional] ${updatedQuestions} FalQuestion atualizadas, ${updatedActions} FalQuestionActionLibrary atualizadas.`);
  if (missing.length) console.log(`FalQuestion não encontrada: ${missing.join(', ')}`);
  if (missingAction.length) console.log(`Sem FalQuestionActionLibrary (precisa criar): ${missingAction.join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
