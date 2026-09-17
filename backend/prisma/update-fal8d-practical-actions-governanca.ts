/**
 * Lote 2 da reescrita do FAL 8D clássico — dimensão "governanca" (18 perguntas).
 * Ver update-fal8d-practical-actions-sistemas.ts para o contexto completo.
 * Rodar com: npx tsx prisma/update-fal8d-practical-actions-governanca.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

type Row = { id: string; title: string; checklist: string; evidence: string };

const ROWS: Row[] = [
  { id: 'governanca_estrutura_governanca_001', title: 'Definir papéis, responsabilidades e alçadas de decisão',
    checklist: '1) Listar as posições/funções-chave da empresa (sócios, diretoria, gerências). 2) Para cada uma, definir o que decide sozinho e o que precisa de aprovação superior. 3) Documentar num organograma funcional simples. 4) Comunicar formalmente a todos os envolvidos. 5) Revisar sempre que houver mudança de estrutura.',
    evidence: 'Organograma funcional com papéis e alçadas de decisão documentados e comunicados.' },
  { id: 'governanca_transparencia_001', title: 'Criar rotina de compartilhamento de informações entre sócios e gestores',
    checklist: '1) Definir quais informações são relevantes (resultado financeiro, indicadores operacionais, riscos). 2) Definir periodicidade e formato de compartilhamento (reunião, relatório). 3) Rodar a primeira rodada com sócios e gestores. 4) Coletar feedback sobre clareza e utilidade. 5) Ajustar o formato conforme necessário.',
    evidence: 'Registro de pelo menos uma rodada de compartilhamento de informações com sócios/gestores (ata ou relatório enviado).' },
  { id: 'governanca_gestao_riscos_001', title: 'Levantar e listar os principais riscos do negócio',
    checklist: '1) Reunir a liderança para um levantamento de riscos (financeiro, operacional, jurídico, mercado). 2) Consolidar numa lista única, sem duplicar. 3) Descrever objetivamente cada risco (o que pode acontecer, não uma sensação vaga). 4) Validar a lista com quem conhece cada área. 5) Manter a lista viva, revisando quando surgir risco novo.',
    evidence: 'Lista de riscos do negócio, descritos objetivamente e validados pela liderança.' },
  { id: 'governanca_processo_decisorio_001', title: 'Estruturar critério de decisão baseado em dado para as decisões relevantes',
    checklist: '1) Listar os tipos de decisão mais relevantes e recorrentes (investimento, contratação, preço). 2) Para cada tipo, definir quais dados/análises são mínimos antes de decidir. 3) Criar um template simples (1 página) para apoiar essas decisões. 4) Aplicar o template nas próximas decisões desse tipo. 5) Avaliar se a qualidade da decisão melhorou.',
    evidence: 'Template de apoio à decisão definido e aplicado em pelo menos uma decisão relevante recente.' },
  { id: 'governanca_processo_decisorio_002', title: 'Criar registro central de decisões importantes',
    checklist: '1) Definir onde registrar (planilha ou sistema simples). 2) Definir o que entra: decisão, responsável, data, racional. 3) Registrar retroativamente as decisões mais recentes relevantes. 4) Definir rotina para toda nova decisão importante ser registrada. 5) Revisar o registro periodicamente.',
    evidence: 'Registro central de decisões importantes com responsável e racional, atualizado regularmente.' },
  { id: 'governanca_transparencia_002', title: 'Padronizar a fonte única de dados apresentados internamente',
    checklist: '1) Levantar os relatórios/números que circulam hoje entre áreas. 2) Verificar se o mesmo indicador aparece com valores diferentes em relatórios diferentes. 3) Identificar a causa da divergência (fonte ou cálculo diferente). 4) Definir uma fonte única e um método único de cálculo por indicador. 5) Padronizar os relatórios com essa fonte única.',
    evidence: 'Comparação de relatórios com divergências identificadas e fonte única de dado definida por indicador.' },
  { id: 'governanca_estrutura_governanca_002', title: 'Definir fóruns e critérios formais para decisões relevantes',
    checklist: '1) Listar os tipos de decisão hoje tomadas de forma pontual/informal. 2) Definir se cada tipo deveria passar por um fórum (reunião de sócios, comitê) ou responsável único. 3) Estabelecer o critério de quando uma decisão precisa desse fórum. 4) Comunicar o novo processo. 5) Aplicar nas próximas decisões desse tipo.',
    evidence: 'Critério formal definido de quais decisões passam por fórum/responsável estabelecido, aplicado em casos recentes.' },
  { id: 'governanca_gestao_riscos_002', title: 'Avaliar impacto, probabilidade e priorizar os riscos levantados',
    checklist: '1) Pegar a lista de riscos já levantada. 2) Para cada risco, atribuir uma nota de impacto (baixo/médio/alto) e probabilidade. 3) Cruzar impacto x probabilidade para gerar uma priorização. 4) Validar a priorização com a liderança. 5) Focar as próximas ações nos riscos priorizados.',
    evidence: 'Riscos avaliados por impacto e probabilidade, com priorização validada pela liderança.' },
  { id: 'governanca_processo_decisorio_003', title: 'Implantar acompanhamento de resultado das decisões tomadas',
    checklist: '1) Pegar as decisões relevantes já registradas. 2) Definir um indicador simples de sucesso para cada uma. 3) Revisar periodicamente se o resultado esperado está acontecendo. 4) Registrar o que funcionou e o que não funcionou. 5) Usar esse aprendizado nas próximas decisões semelhantes.',
    evidence: 'Registro de acompanhamento de resultado de pelo menos uma decisão relevante, com aprendizado documentado.' },
  { id: 'governanca_estrutura_governanca_003', title: 'Garantir que informação relevante chegue a quem precisa decidir',
    checklist: '1) Mapear quais informações cada sócio/gestor precisa para decidir bem. 2) Verificar se essa informação chega hoje, e com que qualidade/prazo. 3) Identificar gaps (informação que não chega ou chega tarde). 4) Ajustar o fluxo/canal de comunicação para fechar o gap. 5) Confirmar com os próprios sócios/gestores se a informação passou a chegar melhor.',
    evidence: 'Mapeamento de necessidade de informação por sócio/gestor, com gaps identificados e fluxo ajustado.' },
  { id: 'governanca_gestao_riscos_003', title: 'Definir plano de ação para os riscos priorizados',
    checklist: '1) Pegar os riscos priorizados. 2) Para cada um, definir se a estratégia é reduzir, monitorar, transferir ou aceitar. 3) Definir a ação concreta e o responsável. 4) Definir prazo de implementação. 5) Acompanhar a execução no rito de gestão.',
    evidence: 'Plano de ação por risco priorizado, com estratégia, responsável e prazo definidos.' },
  { id: 'governanca_transparencia_003', title: 'Criar rotina de comunicação tempestiva de problemas e riscos',
    checklist: '1) Definir o que é "problema relevante" que precisa ser comunicado rapidamente (não esperar reunião mensal). 2) Definir canal e prazo máximo de comunicação (ex.: até 24h). 3) Definir quem precisa ser informado em cada tipo de problema. 4) Comunicar essa regra a toda a liderança. 5) Verificar se está sendo seguida no próximo problema real.',
    evidence: 'Regra de comunicação tempestiva definida e comunicada, com um caso real de aplicação registrado.' },
  { id: 'governanca_gestao_riscos_004', title: 'Criar rotina de revisão periódica do mapa de riscos',
    checklist: '1) Definir periodicidade de revisão (ex.: trimestral). 2) Checar se surgiram riscos novos e se os antigos ainda são relevantes. 3) Atualizar a priorização se necessário. 4) Revisar o andamento das ações de resposta. 5) Registrar a revisão realizada.',
    evidence: 'Registro de pelo menos uma revisão periódica do mapa de riscos, com atualizações aplicadas.' },
  { id: 'governanca_transparencia_004', title: 'Criar rotina de revisão da qualidade das informações gerenciais',
    checklist: '1) Definir periodicidade de revisão (ex.: semestral). 2) Avaliar se os relatórios gerenciais ainda são úteis e claros para quem decide. 3) Coletar feedback de quem usa esses relatórios. 4) Ajustar formato/conteúdo conforme o feedback. 5) Registrar a revisão e as mudanças aplicadas.',
    evidence: 'Registro de revisão periódica da qualidade das informações gerenciais, com ajustes aplicados.' },
  { id: 'governanca_estrutura_governanca_004', title: 'Criar rotina de revisão da estrutura de governança',
    checklist: '1) Definir periodicidade de revisão (ex.: anual, ou a cada mudança relevante de porte). 2) Avaliar se os papéis e alçadas ainda fazem sentido para o tamanho atual da empresa. 3) Identificar gaps (função sem dono, alçada desatualizada). 4) Ajustar a estrutura conforme necessário. 5) Registrar a revisão e as mudanças.',
    evidence: 'Registro de revisão periódica da estrutura de governança, com ajustes aplicados conforme o crescimento.' },
  { id: 'governanca_processo_decisorio_004', title: 'Criar rotina de revisão do processo decisório',
    checklist: '1) Definir periodicidade de revisão (ex.: semestral). 2) Avaliar decisões recentes: foram ágeis? foram bem embasadas? 3) Identificar gargalos no processo de decisão (demora, falta de dado, aprovação travada). 4) Ajustar o processo para resolver o gargalo mais crítico. 5) Registrar a revisão e o ajuste aplicado.',
    evidence: 'Registro de revisão periódica do processo decisório, com gargalo identificado e ajuste aplicado.' },
  { id: 'gestao_riscos_ia_1788030504840_0', title: 'Padronizar o fluxo de abertura de solicitações de gestão de riscos',
    checklist: '1) Definir o que conta como uma solicitação de gestão de riscos (reportar risco novo, pedir avaliação, pedir ação). 2) Criar um canal único de abertura (formulário, e-mail padrão, planilha). 3) Definir os campos mínimos exigidos na abertura (o que é o risco, quem reporta, urgência). 4) Comunicar o fluxo à equipe. 5) Testar com a próxima solicitação real.',
    evidence: 'Fluxo padronizado de abertura de solicitações de gestão de riscos, com canal único e campos mínimos definidos.' },
  { id: 'gestao_riscos_ia_1788032017645_2', title: 'Criar registro formal e rastreável das atividades de gestão de riscos',
    checklist: '1) Definir o que precisa ser registrado (risco identificado, avaliação, ação, resultado). 2) Escolher uma ferramenta simples e acessível (planilha compartilhada ou sistema). 3) Migrar o que já existe de forma informal para esse registro formal. 4) Definir quem atualiza e com que frequência. 5) Garantir que o histórico fique rastreável (não sobrescrever, manter data/autor).',
    evidence: 'Registro formal e rastreável das atividades de gestão de riscos, com histórico de atualizações preservado.' },
];

async function main() {
  let updatedQuestions = 0;
  let updatedActions = 0;
  const missing: string[] = [];

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
  }

  console.log(`[governanca] ${updatedQuestions} FalQuestion atualizadas, ${updatedActions} FalQuestionActionLibrary atualizadas.`);
  if (missing.length) console.log(`Não encontradas: ${missing.join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
