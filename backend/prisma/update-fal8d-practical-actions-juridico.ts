/**
 * Lote 3 da reescrita do FAL 8D clássico — dimensão "juridico" (28 perguntas).
 * Ver update-fal8d-practical-actions-sistemas.ts para o contexto completo.
 * Rodar com: npx tsx prisma/update-fal8d-practical-actions-juridico.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

type Row = { id: string; title: string; checklist: string; evidence: string };

const ROWS: Row[] = [
  { id: 'juridico_contratos_operacionais_001', title: 'Criar controle central de contratos operacionais relevantes',
    checklist: '1) Levantar os contratos operacionais em vigor (fornecimento, prestação de serviço, arrendamento, transporte). 2) Priorizar os de maior valor/criticidade para a operação. 3) Registrar cada um numa base única (nome, vigência, valor, objeto). 4) Definir responsável por manter essa base atualizada. 5) Guardar os contratos originais/digitalizados de forma acessível.',
    evidence: 'Base central de contratos operacionais com os principais dados de cada um, responsável definido.' },
  { id: 'juridico_regularidade_ambiental_001', title: 'Criar controle central de licenças e obrigações ambientais',
    checklist: '1) Levantar todas as licenças/autorizações ambientais exigidas pela operação. 2) Verificar quais estão vigentes, vencidas ou pendentes de renovação. 3) Registrar cada uma numa base única com data de vencimento. 4) Regularizar as pendências encontradas. 5) Definir responsável por manter o controle atualizado.',
    evidence: 'Base central de licenças/obrigações ambientais com status e vencimento de cada uma, pendências regularizadas.' },
  { id: 'juridico_regularidade_fundiaria_001', title: 'Organizar e atualizar a documentação fundiária',
    checklist: '1) Levantar todas as áreas usadas pela empresa (próprias, arrendadas, comodato). 2) Verificar a documentação de cada área (matrícula, contrato, georreferenciamento). 3) Identificar documentos ausentes ou desatualizados. 4) Regularizar o que estiver pendente. 5) Organizar tudo numa pasta/base única de fácil acesso.',
    evidence: 'Documentação fundiária organizada por área, com pendências identificadas e regularizadas.' },
  { id: 'juridico_estrutura_societaria_001', title: 'Formalizar e atualizar a estrutura societária',
    checklist: '1) Levantar o contrato/estatuto social vigente e verificar se reflete a realidade atual (sócios, participações, poderes). 2) Identificar divergências entre o formal e o real. 3) Regularizar as divergências com apoio jurídico. 4) Atualizar os registros nos órgãos competentes (Junta Comercial, etc.). 5) Guardar a documentação atualizada de forma acessível.',
    evidence: 'Contrato/estatuto social atualizado e registrado, divergências identificadas foram regularizadas.' },
  { id: 'juridico_riscos_trabalhistas_001', title: 'Levantar as principais exposições a risco trabalhista',
    checklist: '1) Mapear as frentes de maior exposição (terceirização, jornada, periculosidade, sazonalidade). 2) Levantar reclamações/passivos trabalhistas recentes como fonte de sinal. 3) Consultar o jurídico/RH sobre pontos de atenção conhecidos. 4) Consolidar numa lista de riscos trabalhistas priorizados. 5) Validar a lista com a liderança.',
    evidence: 'Lista de exposições a risco trabalhista priorizadas, validada com jurídico/RH.' },
  { id: 'juridico_contencioso_001', title: 'Criar controle central de processos judiciais e contingências',
    checklist: '1) Levantar todos os processos judiciais ativos (cível, trabalhista, tributário). 2) Registrar cada um numa base única (partes, valor, fase, risco estimado). 3) Vincular ao advogado/escritório responsável. 4) Definir rotina de atualização periódica com o jurídico. 5) Compartilhar o resumo com financeiro/contábil para provisão.',
    evidence: 'Base central de processos judiciais com valor, fase e risco estimado, atualizada com o jurídico responsável.' },
  { id: 'juridico_contratos_comerciais_001', title: 'Criar controle central de contratos comerciais',
    checklist: '1) Levantar os contratos comerciais vigentes com clientes e representantes. 2) Registrar os principais termos (vigência, condições de preço/reajuste, exclusividade). 3) Priorizar os de maior valor/risco para revisão detalhada. 4) Consolidar numa base única de fácil consulta. 5) Definir responsável por manter atualizado.',
    evidence: 'Base central de contratos comerciais com principais termos registrados e responsável definido.' },
  { id: 'juridico_regularidade_ambiental_002', title: 'Implantar acompanhamento de vencimentos e exigências ambientais',
    checklist: '1) Usar a base de licenças já criada como ponto de partida. 2) Definir alertas de vencimento com antecedência mínima (ex.: 90 dias). 3) Levantar exigências condicionantes de cada licença (o que precisa ser cumprido, não só renovado). 4) Atribuir responsável por cada pendência. 5) Revisar o status periodicamente.',
    evidence: 'Alertas de vencimento configurados e lista de exigências/condicionantes com responsável por pendência.' },
  { id: 'juridico_estrutura_societaria_002', title: 'Organizar o arquivo de documentos societários',
    checklist: '1) Listar os documentos societários essenciais (atas, contratos sociais, alterações, procurações). 2) Verificar se todos estão disponíveis e na versão mais atual. 3) Digitalizar e organizar numa pasta única e acessível. 4) Definir responsável pela guarda e atualização. 5) Revisar a organização a cada alteração societária.',
    evidence: 'Pasta organizada com documentos societários atualizados e responsável pela guarda definido.' },
  { id: 'juridico_contratos_operacionais_002', title: 'Implantar acompanhamento de prazos e obrigações dos contratos operacionais',
    checklist: '1) Usar a base de contratos já criada como ponto de partida. 2) Para cada contrato, registrar prazos de entrega, obrigações e valores esperados. 3) Definir alertas para vencimentos e obrigações próximas. 4) Comparar periodicamente o executado vs. o contratado (custo, prazo). 5) Registrar desvios encontrados.',
    evidence: 'Acompanhamento de prazos/obrigações por contrato, com desvios entre executado e contratado registrados.' },
  { id: 'juridico_regularidade_fundiaria_002', title: 'Mapear e acompanhar restrições e riscos das áreas utilizadas',
    checklist: '1) Verificar restrições ambientais, de reserva legal ou APP em cada área. 2) Verificar se há sobreposição, disputa ou pendência de regularização. 3) Consolidar os riscos por área numa lista única. 4) Priorizar a regularização das áreas de maior risco. 5) Revisar periodicamente conforme mudanças na legislação ou na operação.',
    evidence: 'Lista de restrições/riscos por área utilizada, com priorização de regularização.' },
  { id: 'juridico_contratos_comerciais_002', title: 'Implantar acompanhamento de prazos e reajustes dos contratos comerciais',
    checklist: '1) Usar a base de contratos comerciais já criada. 2) Registrar data de reajuste, obrigações e cláusulas de risco de cada contrato. 3) Definir alertas para reajustes e vencimentos próximos. 4) Acompanhar se os reajustes estão sendo aplicados corretamente. 5) Registrar desvios e tratativas.',
    evidence: 'Acompanhamento de prazos/reajustes por contrato comercial, com desvios registrados e tratados.' },
  { id: 'juridico_contencioso_002', title: 'Detalhar valor, fase e risco de perda de cada processo',
    checklist: '1) Usar a base de processos já criada. 2) Para cada processo, registrar valor atualizado, fase processual e probabilidade de perda (com apoio do advogado). 3) Classificar o risco (provável, possível, remoto) conforme critério contábil. 4) Atualizar essa classificação periodicamente com o jurídico. 5) Repassar ao contábil para fins de provisão.',
    evidence: 'Processos classificados por valor, fase e risco de perda, atualizados com o jurídico responsável.' },
  { id: 'juridico_riscos_trabalhistas_002', title: 'Implantar acompanhamento das rotinas trabalhistas críticas',
    checklist: '1) Listar as rotinas críticas (controle de jornada, processo de admissão/desligamento, gestão de terceiros). 2) Verificar se cada rotina tem um procedimento documentado e seguido. 3) Testar uma amostra recente de cada rotina. 4) Corrigir desvios encontrados. 5) Definir responsável por cada rotina.',
    evidence: 'Procedimentos das rotinas trabalhistas críticas documentados, amostra testada com desvios corrigidos.' },
  { id: 'juridico_contratos_operacionais_003', title: 'Criar rotina de análise e tratativa de desvios contratuais',
    checklist: '1) Definir o que conta como desvio relevante (atraso, descumprimento, custo fora do previsto). 2) Definir um canal para reportar o desvio à gestão. 3) Definir o passo a passo de análise (causa, impacto, ação). 4) Registrar a tratativa e o resultado. 5) Usar o histórico para renegociar ou não renovar contratos problemáticos.',
    evidence: 'Registro de desvios contratuais com análise e tratativa da gestão documentadas.' },
  { id: 'juridico_estrutura_societaria_003', title: 'Criar rito de avaliação prévia para alterações societárias',
    checklist: '1) Definir que toda alteração societária relevante passa por avaliação prévia. 2) Envolver jurídico, tributário e a diretoria nessa avaliação. 3) Documentar o impacto esperado antes de formalizar a alteração. 4) Aprovar formalmente antes de executar. 5) Registrar o racional da decisão.',
    evidence: 'Pelo menos uma alteração societária recente com avaliação prévia documentada (jurídico, tributário, estratégico).' },
  { id: 'juridico_regularidade_fundiaria_003', title: 'Criar checklist de due diligence fundiária antes de compra/arrendamento',
    checklist: '1) Definir os itens mínimos de checagem (matrícula, ônus, restrições ambientais, disputas). 2) Formalizar um checklist padrão de due diligence. 3) Exigir esse checklist antes de qualquer nova aquisição/arrendamento/expansão. 4) Aplicar no próximo caso real. 5) Arquivar a due diligence junto à documentação da área.',
    evidence: 'Checklist de due diligence fundiária aplicado na aquisição/arrendamento mais recente.' },
  { id: 'juridico_contencioso_003', title: 'Integrar contingências às decisões financeiras e operacionais relevantes',
    checklist: '1) Definir que toda decisão relevante (investimento, financiamento, expansão) considera o mapa de contingências. 2) Compartilhar o resumo de contingências com financeiro na hora de decidir. 3) Registrar se a contingência influenciou a decisão. 4) Repetir esse cruzamento nas próximas decisões relevantes. 5) Revisar se a prática está sendo seguida.',
    evidence: 'Pelo menos uma decisão relevante recente com o mapa de contingências considerado e registrado.' },
  { id: 'juridico_regularidade_ambiental_003', title: 'Criar rotina de ação corretiva para não conformidades ambientais',
    checklist: '1) Definir o que é uma não conformidade ambiental (autuação, condicionante não cumprida, denúncia). 2) Definir o processo: identificar → avaliar → corrigir → acompanhar. 3) Atribuir responsável para cada não conformidade encontrada. 4) Registrar a correção aplicada. 5) Acompanhar até o fechamento.',
    evidence: 'Registro de não conformidades ambientais com ação corretiva e acompanhamento até o fechamento.' },
  { id: 'juridico_riscos_trabalhistas_003', title: 'Criar rotina de análise de causa para ocorrências trabalhistas',
    checklist: '1) Levantar as ocorrências/passivos trabalhistas mais recentes. 2) Para cada uma, investigar a causa-raiz (não só resolver o caso pontual). 3) Definir ação corretiva para evitar recorrência. 4) Implementar a ação (ajuste de processo, treinamento, política). 5) Verificar se a recorrência caiu depois da correção.',
    evidence: 'Análise de causa e ação corretiva documentada para pelo menos uma ocorrência trabalhista recente.' },
  { id: 'juridico_contratos_comerciais_003', title: 'Criar rito de revisão jurídica antes de assinar ou renovar contrato relevante',
    checklist: '1) Definir o critério de "contrato relevante" (valor, prazo, risco). 2) Definir que todo contrato relevante passa por revisão jurídica antes da assinatura/renovação. 3) Criar um checklist mínimo de pontos a revisar (preço, reajuste, rescisão, penalidade). 4) Aplicar no próximo contrato relevante. 5) Registrar os ajustes pedidos pela revisão.',
    evidence: 'Checklist de revisão jurídica aplicado no contrato relevante mais recente, com ajustes registrados.' },
  { id: 'juridico_estrutura_societaria_004', title: 'Criar rotina de revisão periódica da estrutura societária',
    checklist: '1) Definir periodicidade de revisão (ex.: anual). 2) Avaliar se a estrutura ainda atende ao porte e à estratégia atual do negócio. 3) Identificar necessidade de ajuste (nova holding, reorganização, saída de sócio). 4) Levar ao jurídico/tributário para avaliar viabilidade. 5) Registrar a revisão e a decisão tomada.',
    evidence: 'Registro de revisão periódica da estrutura societária, com decisão documentada.' },
  { id: 'juridico_contencioso_004', title: 'Criar rotina de revisão do contencioso com foco preventivo',
    checklist: '1) Definir periodicidade de revisão (ex.: trimestral). 2) Nessa revisão, identificar padrões recorrentes nos processos (mesma causa se repetindo). 3) Definir ação preventiva para reduzir a causa recorrente. 4) Acompanhar se a ação reduziu novos casos. 5) Registrar a revisão e o resultado.',
    evidence: 'Registro de revisão periódica do contencioso com padrão recorrente identificado e ação preventiva aplicada.' },
  { id: 'juridico_regularidade_ambiental_004', title: 'Criar rotina de revisão preventiva da regularidade ambiental',
    checklist: '1) Definir periodicidade de revisão (ex.: semestral). 2) Verificar se surgiram novas exigências legais aplicáveis à operação. 3) Antecipar renovações e condicionantes antes do prazo apertar. 4) Ajustar o plano de regularização conforme necessário. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica preventiva da regularidade ambiental, com plano ajustado.' },
  { id: 'juridico_riscos_trabalhistas_004', title: 'Criar rotina de revisão preventiva dos riscos trabalhistas',
    checklist: '1) Definir periodicidade de revisão (ex.: semestral). 2) Revisar a lista de exposições e passivos trabalhistas. 3) Identificar tendências (mesma causa repetindo entre casos). 4) Definir ação preventiva (treinamento, ajuste de processo, revisão de política). 5) Registrar a revisão e a ação aplicada.',
    evidence: 'Registro de revisão periódica dos riscos trabalhistas, com ação preventiva aplicada.' },
  { id: 'juridico_contratos_operacionais_004', title: 'Criar rotina de revisão periódica dos contratos operacionais',
    checklist: '1) Definir periodicidade de revisão (ex.: anual). 2) Avaliar se cada contrato ainda é competitivo em custo e eficiente na entrega. 3) Identificar contratos com risco crescente ou baixo desempenho. 4) Decidir renegociar, substituir ou manter cada um. 5) Registrar a revisão e as decisões.',
    evidence: 'Registro de revisão periódica dos contratos operacionais, com decisões de renegociação/substituição registradas.' },
  { id: 'juridico_contratos_comerciais_004', title: 'Criar rotina de revisão da carteira de contratos comerciais',
    checklist: '1) Definir periodicidade de revisão (ex.: semestral). 2) Avaliar a carteira por risco (inadimplência, concentração, condições desfavoráveis). 3) Priorizar ação para os contratos de maior risco. 4) Ajustar política comercial se necessário. 5) Registrar a revisão e as decisões.',
    evidence: 'Registro de revisão periódica da carteira de contratos comerciais, com ações priorizadas.' },
  { id: 'juridico_regularidade_fundiaria_004', title: 'Criar rotina de revisão periódica da situação fundiária',
    checklist: '1) Definir periodicidade de revisão (ex.: anual). 2) Verificar se surgiram novas restrições, disputas ou pendências nas áreas utilizadas. 3) Confirmar que a documentação continua válida e atualizada. 4) Priorizar regularização de pendências novas. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica da situação fundiária, com pendências novas identificadas e priorizadas.' },
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

  console.log(`[juridico] ${updatedQuestions} FalQuestion atualizadas, ${updatedActions} FalQuestionActionLibrary atualizadas.`);
  if (missing.length) console.log(`FalQuestion não encontrada: ${missing.join(', ')}`);
  if (missingAction.length) console.log(`Sem FalQuestionActionLibrary (precisa criar): ${missingAction.join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
