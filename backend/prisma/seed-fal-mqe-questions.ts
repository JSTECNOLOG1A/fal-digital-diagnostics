/**
 * Seed one-off: popula MQEQuestion — perguntas de qualidade de integração
 * por cruzamento estrutural (os 9 semeados em seed-fal-mfis-crossings.ts).
 *
 * Cada pergunta mede a QUALIDADE DA RELAÇÃO entre as duas dimensões do
 * cruzamento, não repete o score de nenhuma dimensão isolada — ex.:
 * financeiro_x_contabil não pergunta "a contabilidade é boa?", pergunta se
 * os números financeiros e contábeis batem entre si. Escala 0-3, mesma do
 * questionário 8D principal.
 *
 * Sem isso, computeMfisAnalysis sempre roda em fallback (has_mqe_data:false,
 * média simples entre as duas dimensões) — nunca o cálculo real ponderado
 * 35% dim_a + 35% dim_b + 30% MQE.
 *
 * v2: 3 perguntas por cruzamento (27 no total) — a v1 tinha só 1 por
 * cruzamento (9 no total) e foi considerada pobre demais pra um
 * questionário de verdade. Este script é ADITIVO por design (verifica por
 * `code`, só insere o que falta) — nunca apaga MQEQuestion existente,
 * porque MQEResponse tem FK sem onDelete:Cascade pra ela, e já existem
 * respostas reais gravadas (deletar quebraria a integridade referencial ou
 * apagaria dado real de teste).
 *
 * Rodar com: npx tsx prisma/seed-fal-mqe-questions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

const QUESTIONS = [
  // ── governanca_x_juridico ──
  {
    crossingKey: 'governanca_x_juridico', order: 0, code: 'mqe_gov_jur_001',
    text: 'As decisões de governança (societárias, de sócios, do conselho) são sistematicamente respaldadas e formalizadas por instrumentos jurídicos adequados (contratos, atas, acordos)?',
    guidance: 'Avalie o fluxo real entre a decisão tomada na governança e sua formalização jurídica — não a existência isolada de estrutura jurídica ou de governança.',
    evidenceHint: 'Atas de reunião com respaldo em acordo de sócios ou contrato social atualizado.',
  },
  {
    crossingKey: 'governanca_x_juridico', order: 1, code: 'mqe_gov_jur_002',
    text: 'Os contratos com sócios, terceiros e colaboradores refletem de fato as decisões e alçadas definidas pela governança, ou existem práticas paralelas não formalizadas?',
    guidance: 'Mede se o jurídico executa o que a governança decide, ou se opera desconectado dela.',
    evidenceHint: 'Um contrato recente comparado com a decisão de governança que o originou.',
  },
  {
    crossingKey: 'governanca_x_juridico', order: 2, code: 'mqe_gov_jur_003',
    text: 'Quando surge um conflito ou risco jurídico relevante, a governança é acionada e participa da decisão, ou o jurídico resolve isoladamente sem retorno formal à governança?',
    guidance: 'Avalia o fluxo de escalonamento de risco jurídico até a instância de governança — não a qualidade da defesa jurídica em si.',
    evidenceHint: 'Registro de um conflito jurídico recente e de quem decidiu o encaminhamento.',
  },

  // ── governanca_x_controles_internos ──
  {
    crossingKey: 'governanca_x_controles_internos', order: 0, code: 'mqe_gov_ctrl_001',
    text: 'As diretrizes definidas pela governança são efetivamente traduzidas em políticas e controles internos monitorados no dia a dia?',
    guidance: 'O objetivo é medir a tradução prática de decisão em controle — não a maturidade isolada de governança nem de controles internos.',
    evidenceHint: 'Política formal derivada de uma decisão de governança, com indicador de monitoramento ativo.',
  },
  {
    crossingKey: 'governanca_x_controles_internos', order: 1, code: 'mqe_gov_ctrl_002',
    text: 'Os controles internos existentes nasceram de uma decisão deliberada da governança, ou foram criados isoladamente por áreas operacionais sem conexão com nenhuma diretriz formal?',
    guidance: 'Mede a origem dos controles — se vêm de cima (governança) ou surgiram de forma fragmentada.',
    evidenceHint: 'Um controle interno relevante e a decisão de governança (se houver) que o originou.',
  },
  {
    crossingKey: 'governanca_x_controles_internos', order: 2, code: 'mqe_gov_ctrl_003',
    text: 'A governança recebe e analisa relatórios de controles internos (falhas, exceções, riscos) com periodicidade definida, usando-os para ajustar suas próprias decisões?',
    guidance: 'Mede o fluxo de retorno — controles internos informando a governança, não só a governança informando os controles.',
    evidenceHint: 'Um relatório de exceção de controle interno discutido em reunião de governança.',
  },

  // ── governanca_x_sistemas ──
  {
    crossingKey: 'governanca_x_sistemas', order: 0, code: 'mqe_gov_sis_001',
    text: 'As decisões e diretrizes de governança são registradas e rastreáveis em sistemas formais (atas digitais, ERP, ferramentas de gestão), e não apenas em registros informais?',
    guidance: 'Avalie a trilha de auditoria das decisões de governança — não a maturidade tecnológica isolada da empresa.',
    evidenceHint: 'Sistema ou repositório com histórico de atas e decisões pesquisável.',
  },
  {
    crossingKey: 'governanca_x_sistemas', order: 1, code: 'mqe_gov_sis_002',
    text: 'As ferramentas e sistemas usados pela empresa foram escolhidos ou aprovados por um processo de decisão formal da governança, ou cada área adota sistemas próprios sem alinhamento?',
    guidance: 'Mede se a governança realmente decide sobre tecnologia, ou se sistemas surgem de forma descentralizada e sem supervisão.',
    evidenceHint: 'Decisão de governança que aprovou (ou não) a adoção de um sistema em uso hoje.',
  },
  {
    crossingKey: 'governanca_x_sistemas', order: 2, code: 'mqe_gov_sis_003',
    text: 'Os indicadores e relatórios apresentados à governança nas reuniões de resultado vêm de sistemas confiáveis, ou dependem de compilações manuais feitas às pressas antes da reunião?',
    guidance: 'Mede a confiabilidade da informação que efetivamente chega à governança — não a existência de sistemas em si.',
    evidenceHint: 'Origem (sistema vs. planilha manual) do último relatório apresentado em reunião de governança.',
  },

  // ── financeiro_x_contabil ──
  {
    crossingKey: 'financeiro_x_contabil', order: 0, code: 'mqe_fin_con_001',
    text: 'Os números usados pela gestão financeira no dia a dia (fluxo de caixa, DRE gerencial) são conciliados e batem com os registros contábeis oficiais, com periodicidade definida?',
    guidance: 'O foco é a coerência entre a visão gerencial e a visão contábil — não a qualidade de cada uma isoladamente.',
    evidenceHint: 'Rotina de conciliação financeiro-contábil documentada, com data e responsável.',
  },
  {
    crossingKey: 'financeiro_x_contabil', order: 1, code: 'mqe_fin_con_002',
    text: 'Decisões financeiras relevantes (aprovar investimento, renegociar dívida) são tomadas com base em demonstrações contábeis atualizadas, ou o financeiro opera com dados próprios desconectados da contabilidade?',
    guidance: 'Mede se a contabilidade efetivamente influencia a decisão financeira, não só se os números existem.',
    evidenceHint: 'Uma decisão financeira recente e a demonstração contábil usada para embasá-la.',
  },
  {
    crossingKey: 'financeiro_x_contabil', order: 2, code: 'mqe_fin_con_003',
    text: 'Divergências entre o resultado apurado internamente pelo financeiro e o resultado contábil oficial são investigadas e explicadas, ou são toleradas como normais?',
    guidance: 'Mede a postura da empresa diante de divergências — investigação ativa versus tolerância passiva.',
    evidenceHint: 'Último caso de divergência financeiro-contábil e como foi tratado.',
  },

  // ── financeiro_x_tributario ──
  {
    crossingKey: 'financeiro_x_tributario', order: 0, code: 'mqe_fin_trib_001',
    text: 'O planejamento financeiro (fluxo de caixa, projeções) incorpora de forma sistemática o calendário e os valores das obrigações fiscais previstas?',
    guidance: 'Avalie se a empresa é surpreendida por obrigações fiscais ou se elas já estão provisionadas na gestão de caixa.',
    evidenceHint: 'Projeção de caixa com linha específica de obrigações fiscais previstas.',
  },
  {
    crossingKey: 'financeiro_x_tributario', order: 1, code: 'mqe_fin_trib_002',
    text: 'Mudanças na legislação tributária ou no regime fiscal da empresa chegam ao financeiro a tempo de ajustar o planejamento de caixa, ou o impacto só é percebido quando a obrigação vence?',
    guidance: 'Mede a antecipação — se a informação tributária flui pra frente do calendário financeiro, ou chega atrasada.',
    evidenceHint: 'Última mudança tributária relevante e quando o financeiro tomou conhecimento dela.',
  },
  {
    crossingKey: 'financeiro_x_tributario', order: 2, code: 'mqe_fin_trib_003',
    text: 'Decisões financeiras relevantes (distribuição de lucros, grandes compras) consideram o impacto tributário antes de serem executadas?',
    guidance: 'Mede se o tributário é consultado antes da decisão financeira, não depois (quando já não há o que ajustar).',
    evidenceHint: 'Uma decisão financeira recente de porte e se houve análise tributária prévia.',
  },

  // ── operacional_x_financeiro ──
  {
    crossingKey: 'operacional_x_financeiro', order: 0, code: 'mqe_ope_fin_001',
    text: 'Os resultados e indicadores da operação (produção, vendas, eficiência) são traduzidos em indicadores financeiros que orientam decisões de investimento e prioridade?',
    guidance: 'O objetivo é medir se a operação "fala a mesma língua" que o financeiro — não a eficiência operacional isolada.',
    evidenceHint: 'Indicador financeiro construído a partir de dado operacional (ex.: custo por unidade produzida).',
  },
  {
    crossingKey: 'operacional_x_financeiro', order: 1, code: 'mqe_ope_fin_002',
    text: 'Decisões de expandir ou reduzir a operação (contratar, investir em equipamento, abrir nova frente) são sustentadas por uma análise financeira prévia de viabilidade?',
    guidance: 'Mede se a operação consulta o financeiro antes de crescer/reduzir, ou decide por conta própria.',
    evidenceHint: 'Última decisão de expansão/redução operacional e se houve análise financeira prévia.',
  },
  {
    crossingKey: 'operacional_x_financeiro', order: 2, code: 'mqe_ope_fin_003',
    text: 'Quando a operação enfrenta um problema de custo ou eficiência, existe um canal claro para que isso chegue ao financeiro e seja tratado, ou cada área resolve (ou ignora) por conta própria?',
    guidance: 'Mede o canal de comunicação de problemas operacionais com impacto financeiro — não a frequência dos problemas em si.',
    evidenceHint: 'Um problema operacional recente com impacto de custo e como chegou (ou não) ao financeiro.',
  },

  // ── operacional_x_sistemas ──
  {
    crossingKey: 'operacional_x_sistemas', order: 0, code: 'mqe_ope_sis_001',
    text: 'Os processos operacionais críticos (produção, estoque, logística) são suportados e registrados em sistemas formais, sem depender de controle manual ou paralelo?',
    guidance: 'Avalie a cobertura de sistema sobre a operação real — não a maturidade do sistema isolado.',
    evidenceHint: 'Processo crítico mapeado com o sistema que o registra hoje.',
  },
  {
    crossingKey: 'operacional_x_sistemas', order: 1, code: 'mqe_ope_sis_002',
    text: 'Os sistemas usados na operação diária conversam entre si, ou cada etapa do processo depende de reentrada manual de dados em ferramentas isoladas?',
    guidance: 'Mede a integração entre sistemas operacionais — não a existência de cada sistema isoladamente.',
    evidenceHint: 'Um processo que passa por mais de um sistema e se há reentrada manual de dados entre eles.',
  },
  {
    crossingKey: 'operacional_x_sistemas', order: 2, code: 'mqe_ope_sis_003',
    text: 'Quando um sistema operacional apresenta falha ou fica indisponível, existe um procedimento definido para a operação continuar sem parar ou perder informação?',
    guidance: 'Mede resiliência da operação frente à falha de sistema — não a frequência de falhas.',
    evidenceHint: 'Último incidente de indisponibilidade de sistema e como a operação reagiu.',
  },

  // ── sistemas_x_contabil ──
  {
    crossingKey: 'sistemas_x_contabil', order: 0, code: 'mqe_sis_con_001',
    text: 'Os sistemas operacionais (ERP, planilhas de controle) alimentam de forma automática ou confiável os registros contábeis, sem retrabalho manual significativo?',
    guidance: 'O foco é a integração de dados entre sistema operacional e contabilidade — não a qualidade contábil isolada.',
    evidenceHint: 'Fluxo de dados do sistema operacional até o lançamento contábil, com ou sem intervenção manual.',
  },
  {
    crossingKey: 'sistemas_x_contabil', order: 1, code: 'mqe_sis_con_002',
    text: 'Os lançamentos contábeis originados de sistemas operacionais são conferidos por amostragem, ou presume-se que estão sempre corretos sem nenhuma verificação?',
    guidance: 'Mede se existe controle de qualidade sobre os dados que os sistemas entregam à contabilidade.',
    evidenceHint: 'Rotina de conferência (ou ausência dela) de lançamentos automáticos.',
  },
  {
    crossingKey: 'sistemas_x_contabil', order: 2, code: 'mqe_sis_con_003',
    text: 'Quando um sistema operacional muda (nova versão, nova ferramenta, migração), a integração com a contabilidade é testada e validada antes de entrar em produção?',
    guidance: 'Mede a governança de mudanças de sistema no que toca à integridade dos dados contábeis — não a frequência de mudanças.',
    evidenceHint: 'Última mudança de sistema relevante e se a integração contábil foi testada antes de valer.',
  },

  // ── contabil_x_tributario ──
  {
    crossingKey: 'contabil_x_tributario', order: 0, code: 'mqe_con_trib_001',
    text: 'A escrituração contábil é utilizada como base direta e confiável para o cumprimento das obrigações fiscais acessórias, sem divergências recorrentes entre o contabilizado e o declarado?',
    guidance: 'Avalie a consistência entre contabilidade e apuração fiscal — não a qualidade contábil nem fiscal isoladas.',
    evidenceHint: 'Comparativo entre saldo contábil e valor declarado em uma obrigação acessória recente.',
  },
  {
    crossingKey: 'contabil_x_tributario', order: 1, code: 'mqe_con_trib_002',
    text: 'As obrigações fiscais acessórias são geradas automaticamente a partir da escrituração contábil, ou exigem um trabalho manual paralelo de reclassificação e ajuste?',
    guidance: 'Mede o grau de automação/dependência manual entre contabilidade e apuração fiscal.',
    evidenceHint: 'Processo de geração da última obrigação acessória entregue.',
  },
  {
    crossingKey: 'contabil_x_tributario', order: 2, code: 'mqe_con_trib_003',
    text: 'Quando a fiscalização ou uma auditoria questiona uma informação declarada, a empresa consegue rastreá-la até o lançamento contábil de origem com facilidade?',
    guidance: 'Mede a rastreabilidade fiscal-contábil de ponta a ponta — um proxy direto de risco de autuação.',
    evidenceHint: 'Exercício de rastrear uma informação declarada até seu lançamento contábil de origem.',
  },
];

async function main() {
  const mv = await prisma.methodVersion.findFirst({
    where: { code: 'FAL', isPublished: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!mv) {
    console.log('Nenhuma MethodVersion publicada com code=FAL encontrada — nada a semear.');
    return;
  }

  const existingCodes = new Set(
    (await prisma.mQEQuestion.findMany({ where: { methodVersionId: mv.id }, select: { code: true } })).map((q) => q.code),
  );

  let created = 0;
  let skipped = 0;
  for (const q of QUESTIONS) {
    if (existingCodes.has(q.code)) { skipped++; continue; }
    await prisma.mQEQuestion.create({
      data: {
        methodVersionId: mv.id, crossingKey: q.crossingKey, code: q.code, text: q.text,
        guidance: q.guidance, evidenceHint: q.evidenceHint, order: q.order, weight: 1,
      },
    });
    created++;
  }
  console.log(`${created} MQEQuestion(s) criada(s), ${skipped} já existiam — MethodVersion ${mv.id} (${mv.code} v${mv.version}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
