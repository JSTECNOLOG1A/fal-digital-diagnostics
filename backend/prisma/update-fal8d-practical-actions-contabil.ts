/**
 * Lote 5 da reescrita do FAL 8D clássico — dimensão "contabil" (36 perguntas).
 * Ver update-fal8d-practical-actions-sistemas.ts para o contexto completo.
 * Rodar com: npx tsx prisma/update-fal8d-practical-actions-contabil.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

type Row = { id: string; title: string; checklist: string; evidence: string };

const ROWS: Row[] = [
  // demonstracoes_financeiras
  { id: 'contabil_demonstracoes_financeiras_001', title: 'Formalizar o procedimento de elaboração das demonstrações financeiras',
    checklist: '1) Levantar como as demonstrações são elaboradas hoje (passo a passo real). 2) Documentar esse passo a passo num procedimento formal. 3) Definir responsável por cada etapa. 4) Validar o procedimento com a contabilidade/auditoria externa se houver. 5) Aplicar o procedimento no próximo fechamento.',
    evidence: 'Procedimento formal de elaboração das demonstrações financeiras, aplicado no fechamento mais recente.' },
  { id: 'contabil_demonstracoes_financeiras_002', title: 'Definir periodicidade fixa de elaboração das demonstrações financeiras',
    checklist: '1) Definir a periodicidade adequada ao porte do negócio (mensal, trimestral). 2) Formalizar um calendário anual com as datas de cada demonstração. 3) Comunicar o calendário à equipe contábil/financeira. 4) Cumprir o calendário nos próximos ciclos. 5) Revisar o calendário se houver atraso recorrente.',
    evidence: 'Calendário de elaboração de demonstrações financeiras, com cumprimento registrado nos últimos ciclos.' },
  { id: 'contabil_demonstracoes_financeiras_003', title: 'Estruturar o fechamento contábil com etapas de revisão formal',
    checklist: '1) Documentar o roteiro de fechamento (contas a conciliar, ajustes, revisões). 2) Definir quem revisa antes da demonstração ser considerada final. 3) Aplicar o roteiro no próximo fechamento. 4) Registrar as revisões feitas (sign-off). 5) Ajustar o roteiro conforme falhas encontradas.',
    evidence: 'Roteiro de fechamento com revisões formais registradas (sign-off) no ciclo mais recente.' },
  { id: 'contabil_demonstracoes_financeiras_004', title: 'Formalizar aprovação da gestão/responsável técnico para as demonstrações',
    checklist: '1) Definir quem precisa aprovar antes da demonstração ser publicada/usada (sócio, diretor, contador responsável). 2) Criar um passo formal de aprovação (assinatura, ata, e-mail formal). 3) Aplicar no próximo ciclo. 4) Guardar a evidência de aprovação. 5) Não considerar a demonstração final sem essa aprovação.',
    evidence: 'Evidência de aprovação formal (assinatura/ata) das demonstrações financeiras do ciclo mais recente.' },
  { id: 'contabil_demonstracoes_financeiras_005', title: 'Definir rotinas e prazos formais de fechamento contábil',
    checklist: '1) Listar as etapas do fechamento (conciliações, lançamentos de ajuste, apuração). 2) Definir prazo para cada etapa dentro do ciclo de fechamento. 3) Definir responsável por etapa. 4) Publicar o calendário de fechamento. 5) Acompanhar o cumprimento dos prazos.',
    evidence: 'Calendário de fechamento com prazos por etapa e responsável, cumprimento acompanhado.' },
  { id: 'contabil_demonstracoes_financeiras_006', title: 'Documentar o suporte dos principais saldos e estimativas',
    checklist: '1) Listar os saldos e estimativas mais relevantes (provisões, ativo biológico, contas a receber). 2) Para cada um, reunir a documentação/memória de cálculo que sustenta o valor. 3) Organizar essa documentação de forma acessível. 4) Atualizar a cada fechamento. 5) Disponibilizar para auditoria/revisão quando solicitado.',
    evidence: 'Documentação/memória de cálculo organizada para os principais saldos e estimativas do último fechamento.' },
  { id: 'contabil_demonstracoes_financeiras_007', title: 'Implantar análise gerencial das demonstrações financeiras',
    checklist: '1) Definir um rito de apresentação das demonstrações à gestão (reunião pós-fechamento). 2) Preparar uma leitura executiva (não só os números brutos). 3) Discutir os principais pontos de atenção com a gestão. 4) Registrar decisões tomadas a partir dessa análise. 5) Repetir a cada ciclo.',
    evidence: 'Registro de pelo menos uma reunião de análise gerencial das demonstrações, com decisões documentadas.' },
  { id: 'contabil_demonstracoes_financeiras_008', title: 'Implantar monitoramento de variações relevantes',
    checklist: '1) Definir o que é uma variação relevante (ex.: acima de X% entre períodos). 2) Comparar cada fechamento com o período anterior e com o orçado (se houver). 3) Investigar a causa das variações relevantes encontradas. 4) Registrar a explicação. 5) Reportar à gestão.',
    evidence: 'Análise de variações relevantes do último fechamento, com causas investigadas e reportadas à gestão.' },
  { id: 'contabil_demonstracoes_financeiras_009', title: 'Implantar revisão ou auditoria periódica das demonstrações financeiras',
    checklist: '1) Avaliar a necessidade de auditoria externa conforme o porte/exigência (sócios, bancos, investidores). 2) Se não houver auditoria externa, definir uma revisão interna independente (outra pessoa que não elaborou). 3) Definir periodicidade (anual, no mínimo). 4) Executar a primeira revisão/auditoria. 5) Corrigir os achados encontrados.',
    evidence: 'Relatório de revisão ou auditoria das demonstrações financeiras mais recente, com achados tratados.' },
  // compliance_contabil
  { id: 'contabil_compliance_contabil_001', title: 'Formalizar manual contábil com as normas aplicáveis',
    checklist: '1) Levantar as normas contábeis (CPC/IFRS) aplicáveis ao porte e setor da empresa. 2) Redigir um manual contábil cobrindo os critérios de reconhecimento e mensuração relevantes. 3) Validar com contador/auditor responsável. 4) Aprovar formalmente com a gestão. 5) Divulgar o manual à equipe contábil.',
    evidence: 'Manual contábil formal com as normas aplicáveis, aprovado e divulgado à equipe.' },
  { id: 'contabil_compliance_contabil_002', title: 'Exigir documento formal e evidência de suporte em todo lançamento',
    checklist: '1) Definir a regra: nenhum lançamento sem documento de suporte. 2) Verificar, numa amostra recente, se essa regra está sendo seguida. 3) Identificar lançamentos sem suporte adequado. 4) Regularizar os casos encontrados. 5) Comunicar a regra formalmente à equipe.',
    evidence: 'Amostra de lançamentos conferida com documento de suporte, casos sem suporte regularizados.' },
  { id: 'contabil_compliance_contabil_003', title: 'Estruturar procedimentos de conformidade contábil',
    checklist: '1) Mapear os pontos de maior risco de não conformidade (reconhecimento de receita, provisões, ativo biológico). 2) Definir o procedimento correto para cada ponto crítico. 3) Documentar e comunicar à equipe. 4) Testar a aderência numa amostra. 5) Corrigir desvios encontrados.',
    evidence: 'Procedimentos de conformidade contábil documentados para os pontos de maior risco, amostra testada.' },
  { id: 'contabil_compliance_contabil_004', title: 'Formalizar aprovação técnica para mudanças de política contábil',
    checklist: '1) Definir que toda mudança de política contábil relevante passa por avaliação técnica antes de aplicada. 2) Envolver o contador/auditor responsável nessa avaliação. 3) Documentar o racional da mudança. 4) Aprovar formalmente antes de aplicar. 5) Atualizar o manual contábil com a mudança.',
    evidence: 'Pelo menos uma mudança de política contábil recente com avaliação e aprovação técnica documentada.' },
  { id: 'contabil_compliance_contabil_005', title: 'Padronizar a execução dos lançamentos contábeis',
    checklist: '1) Mapear os tipos de lançamento mais recorrentes. 2) Definir o procedimento padrão de execução de cada tipo (o que verificar antes de lançar). 3) Documentar e treinar a equipe. 4) Testar a aderência numa amostra. 5) Ajustar o procedimento conforme necessário.',
    evidence: 'Procedimento padronizado de lançamento documentado, com amostra testada e aderência confirmada.' },
  { id: 'contabil_compliance_contabil_006', title: 'Documentar formalmente os principais registros e estimativas',
    checklist: '1) Listar os registros/estimativas mais relevantes e sujeitos a julgamento (provisão, depreciação, ativo biológico). 2) Documentar o critério e a memória de cálculo de cada um. 3) Organizar essa documentação de forma acessível. 4) Atualizar a cada fechamento. 5) Disponibilizar para revisão/auditoria.',
    evidence: 'Documentação formal com critério e memória de cálculo das principais estimativas contábeis.' },
  { id: 'contabil_compliance_contabil_007', title: 'Criar rotina de revisão de aderência às normas contábeis',
    checklist: '1) Definir periodicidade de revisão (ex.: semestral). 2) Selecionar uma amostra de registros para checar aderência à norma. 3) Identificar desvios. 4) Corrigir e documentar a correção. 5) Registrar a revisão realizada.',
    evidence: 'Registro de pelo menos uma revisão periódica de aderência às normas contábeis, com desvios corrigidos.' },
  { id: 'contabil_compliance_contabil_008', title: 'Implantar monitoramento de riscos de conformidade contábil',
    checklist: '1) Listar os riscos de não conformidade mais prováveis para o negócio. 2) Definir como cada um será monitorado (indicador, checagem periódica). 3) Atribuir responsável pelo monitoramento. 4) Registrar os achados. 5) Escalar riscos relevantes à gestão.',
    evidence: 'Lista de riscos de conformidade contábil monitorados, com achados registrados e escalados quando relevante.' },
  { id: 'contabil_compliance_contabil_009', title: 'Implantar auditoria/revisão periódica do processo de conformidade contábil',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Definir se será auditoria externa ou revisão interna independente. 3) Executar a revisão/auditoria. 4) Documentar os achados. 5) Corrigir e acompanhar até o fechamento dos achados.',
    evidence: 'Relatório de revisão/auditoria do processo de conformidade contábil, com achados corrigidos.' },
  // ativo_biologico_cpc29
  { id: 'contabil_ativo_biologico_cpc29_001', title: 'Formalizar política contábil de mensuração de ativos biológicos (CPC 29)',
    checklist: '1) Levantar os tipos de ativo biológico da empresa (lavoura, rebanho, floresta). 2) Definir o critério de mensuração para cada um (valor justo ou custo) conforme CPC 29. 3) Documentar a política formalmente. 4) Validar com contador/auditor especializado em agro. 5) Aprovar e divulgar à equipe.',
    evidence: 'Política contábil de ativo biológico formalizada conforme CPC 29, validada e aprovada.' },
  { id: 'contabil_ativo_biologico_cpc29_002', title: 'Implantar controle físico/quantitativo dos ativos biológicos',
    checklist: '1) Definir a unidade de controle (área plantada, cabeças de gado, volume). 2) Registrar periodicamente a quantidade física de cada ativo biológico. 3) Comparar com o que está registrado na contabilidade. 4) Corrigir divergências encontradas. 5) Definir responsável por manter o controle atualizado.',
    evidence: 'Controle físico/quantitativo de ativos biológicos, conciliado com o registro contábil.' },
  { id: 'contabil_ativo_biologico_cpc29_003', title: 'Padronizar o critério de mensuração de valor justo/custo dos ativos biológicos',
    checklist: '1) Confirmar qual critério (valor justo ou custo) se aplica a cada tipo de ativo biológico. 2) Documentar a fonte de preço/custo usada na mensuração (ex.: cotação de mercado, laudo). 3) Aplicar o critério de forma consistente entre períodos. 4) Validar com responsável técnico. 5) Registrar a memória de cálculo de cada mensuração.',
    evidence: 'Memória de cálculo da mensuração de ativo biológico com critério consistente e validado.' },
  { id: 'contabil_ativo_biologico_cpc29_004', title: 'Formalizar revisão técnica das premissas de mensuração',
    checklist: '1) Listar as premissas usadas (preço, produtividade esperada, taxa de desconto, ciclo). 2) Definir quem é o responsável técnico que revisa essas premissas. 3) Submeter as premissas à revisão antes de cada fechamento. 4) Documentar a aprovação. 5) Registrar mudanças de premissa entre períodos e o motivo.',
    evidence: 'Premissas de mensuração de ativo biológico revisadas e aprovadas por responsável técnico no último fechamento.' },
  { id: 'contabil_ativo_biologico_cpc29_005', title: 'Implantar atualização periódica do registro de ativos biológicos',
    checklist: '1) Definir a periodicidade de atualização (mensal ou por marco produtivo). 2) Definir os eventos que disparam atualização extraordinária (perda, colheita antecipada, mortalidade). 3) Atualizar o registro contábil conforme a periodicidade/evento. 4) Conciliar com o controle físico. 5) Registrar a atualização realizada.',
    evidence: 'Registro contábil de ativo biológico atualizado no último ciclo, conciliado com o controle físico.' },
  { id: 'contabil_ativo_biologico_cpc29_006', title: 'Implantar reconciliação entre controle físico e registro contábil',
    checklist: '1) Definir a periodicidade da reconciliação (ex.: mensal). 2) Comparar a quantidade física registrada com o valor contábil. 3) Investigar divergências encontradas. 4) Corrigir o registro quando necessário. 5) Documentar a reconciliação realizada.',
    evidence: 'Reconciliação entre controle físico e registro contábil do último período, com divergências tratadas.' },
  { id: 'contabil_ativo_biologico_cpc29_007', title: 'Implantar análise de variação do valor de ativos biológicos entre períodos',
    checklist: '1) Definir o que é uma variação relevante (ex.: acima de X% entre períodos). 2) Comparar o valor do ativo biológico período a período. 3) Investigar a causa das variações relevantes (preço, volume, mortalidade, novo plantio). 4) Documentar a explicação. 5) Reportar à gestão.',
    evidence: 'Análise de variação do valor de ativo biológico do último período, com causas documentadas.' },
  { id: 'contabil_ativo_biologico_cpc29_008', title: 'Criar rotina de revisão do processo de mensuração de ativos biológicos',
    checklist: '1) Definir periodicidade de revisão (ex.: semestral ou anual). 2) Avaliar se o processo/premissas ainda são adequados à realidade da operação. 3) Identificar necessidade de ajuste (nova cultura, mudança de mercado). 4) Aplicar o ajuste. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica do processo de mensuração de ativo biológico, com ajustes aplicados.' },
  { id: 'contabil_ativo_biologico_cpc29_009', title: 'Implantar auditoria/revisão periódica da mensuração de ativos biológicos',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Definir se será auditoria externa ou revisão interna independente com apoio de especialista agro. 3) Executar a revisão/auditoria. 4) Documentar achados. 5) Corrigir e acompanhar até o fechamento.',
    evidence: 'Relatório de auditoria/revisão do processo de mensuração de ativo biológico, com achados corrigidos.' },
  // organizacao_contabil
  { id: 'contabil_organizacao_contabil_001', title: 'Formalizar manual de rotinas contábeis',
    checklist: '1) Levantar as rotinas contábeis existentes (lançamento, conciliação, fechamento, arquivo). 2) Documentar cada rotina num manual simples. 3) Validar com a equipe que executa. 4) Aprovar e divulgar formalmente. 5) Atualizar sempre que a rotina mudar.',
    evidence: 'Manual de rotinas contábeis documentado, validado e divulgado à equipe.' },
  { id: 'contabil_organizacao_contabil_002', title: 'Estruturar o arquivamento dos documentos contábeis',
    checklist: '1) Definir a estrutura de arquivo (por tipo, por período, digital ou físico). 2) Migrar os documentos existentes para essa estrutura. 3) Definir responsável pelo arquivamento contínuo. 4) Definir prazo de guarda conforme legislação. 5) Testar a localização de um documento aleatório para validar a estrutura.',
    evidence: 'Estrutura de arquivamento contábil implantada, teste de localização de documento bem-sucedido.' },
  { id: 'contabil_organizacao_contabil_003', title: 'Definir rotina de classificação, registro e revisão de lançamentos',
    checklist: '1) Documentar o passo a passo: classificação → registro → revisão. 2) Definir quem executa e quem revisa cada etapa (segregação). 3) Aplicar a rotina nos próximos lançamentos. 4) Testar uma amostra para validar aderência. 5) Ajustar o que não estiver funcionando.',
    evidence: 'Rotina de classificação/registro/revisão documentada, amostra testada com aderência confirmada.' },
  { id: 'contabil_organizacao_contabil_004', title: 'Definir responsabilidades claras nas atividades contábeis',
    checklist: '1) Listar as atividades contábeis (lançamento, conciliação, fechamento, envio de obrigações). 2) Atribuir um responsável a cada atividade. 3) Documentar e comunicar formalmente. 4) Verificar se não há sobreposição ou lacuna de responsabilidade. 5) Ajustar quando houver mudança de equipe.',
    evidence: 'Matriz de responsabilidades das atividades contábeis documentada e comunicada.' },
  { id: 'contabil_organizacao_contabil_005', title: 'Verificar e reforçar a aderência às rotinas contábeis padronizadas',
    checklist: '1) Pegar o manual/procedimento já documentado. 2) Testar uma amostra de execuções recentes contra o procedimento. 3) Identificar desvios. 4) Corrigir e reforçar treinamento onde necessário. 5) Repetir o teste periodicamente.',
    evidence: 'Amostra de rotinas contábeis testada contra o procedimento padronizado, desvios corrigidos.' },
  { id: 'contabil_organizacao_contabil_006', title: 'Garantir rastreabilidade dos documentos e evidências contábeis',
    checklist: '1) Verificar se cada lançamento relevante consegue ser rastreado até o documento de origem. 2) Identificar lançamentos sem essa rastreabilidade. 3) Corrigir o processo/arquivo para garantir o vínculo. 4) Testar com uma amostra. 5) Manter a prática nos próximos lançamentos.',
    evidence: 'Amostra de lançamentos rastreados até o documento de origem, sem lacunas encontradas.' },
  { id: 'contabil_organizacao_contabil_007', title: 'Criar rotina de revisão periódica de consistência dos registros contábeis',
    checklist: '1) Definir periodicidade de revisão (ex.: mensal, no fechamento). 2) Definir os pontos de checagem (contas com saldo estranho, lançamentos duplicados, contas não conciliadas). 3) Executar a revisão. 4) Corrigir o que for encontrado. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica de consistência dos registros contábeis, com correções aplicadas.' },
  { id: 'contabil_organizacao_contabil_008', title: 'Implantar monitoramento de riscos de organização/qualidade contábil',
    checklist: '1) Listar os riscos mais prováveis (perda de documento, lançamento incorreto, atraso). 2) Definir como cada um será monitorado. 3) Atribuir responsável pelo monitoramento. 4) Registrar os achados. 5) Escalar riscos relevantes à gestão.',
    evidence: 'Lista de riscos de organização/qualidade contábil monitorados, com achados registrados.' },
  { id: 'contabil_organizacao_contabil_009', title: 'Implantar revisão/auditoria periódica do processo contábil',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Definir se será auditoria externa ou revisão interna independente. 3) Executar a revisão/auditoria. 4) Documentar achados. 5) Corrigir e acompanhar até o fechamento dos achados.',
    evidence: 'Relatório de revisão/auditoria do processo contábil, com achados corrigidos.' },
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

  console.log(`[contabil] ${updatedQuestions} FalQuestion atualizadas, ${updatedActions} FalQuestionActionLibrary atualizadas.`);
  if (missing.length) console.log(`FalQuestion não encontrada: ${missing.join(', ')}`);
  if (missingAction.length) console.log(`Sem FalQuestionActionLibrary (precisa criar): ${missingAction.join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
