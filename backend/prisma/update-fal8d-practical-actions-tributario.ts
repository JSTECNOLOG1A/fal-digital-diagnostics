/**
 * Lote 6 da reescrita do FAL 8D clássico — dimensão "tributario" (43 perguntas).
 * Ver update-fal8d-practical-actions-sistemas.ts para o contexto completo.
 * Rodar com: npx tsx prisma/update-fal8d-practical-actions-tributario.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

type Row = { id: string; title: string; checklist: string; evidence: string };

const ROWS: Row[] = [
  // enquadramento_tributario
  { id: 'tributario_enquadramento_tributario_001', title: 'Formalizar processo de definição do enquadramento tributário',
    checklist: '1) Levantar como o enquadramento (Simples, Presumido, Real) foi decidido originalmente. 2) Documentar os critérios e dados que embasam a decisão. 3) Definir quem é responsável por essa análise (contador/consultoria tributária). 4) Formalizar o processo de revisão periódica. 5) Aplicar o processo formalizado na próxima revisão.',
    evidence: 'Processo formal de definição/revisão do enquadramento tributário documentado, com responsável definido.' },
  { id: 'tributario_enquadramento_tributario_002', title: 'Implantar revisão periódica de adequação do regime tributário',
    checklist: '1) Definir periodicidade de revisão (ex.: anual, antes do prazo de opção). 2) Simular o resultado tributário nos regimes alternativos disponíveis. 3) Comparar com o regime atual. 4) Levar o resultado à decisão da administração. 5) Registrar a revisão realizada, mesmo quando a decisão é manter o regime.',
    evidence: 'Simulação comparativa de regimes tributários do último ciclo, com decisão registrada.' },
  { id: 'tributario_enquadramento_tributario_003', title: 'Documentar a análise técnica que sustenta o regime tributário escolhido',
    checklist: '1) Reunir os dados usados para a decisão (faturamento, margem, folha, projeção). 2) Documentar a memória de cálculo comparando os regimes. 3) Formalizar num parecer técnico. 4) Validar com contador/consultoria responsável. 5) Arquivar junto à documentação fiscal.',
    evidence: 'Parecer técnico com memória de cálculo sustentando a escolha do regime tributário atual.' },
  { id: 'tributario_enquadramento_tributario_004', title: 'Formalizar aprovação da administração para mudança de regime',
    checklist: '1) Definir que toda mudança de regime passa por aprovação formal da administração/sócios. 2) Apresentar a análise técnica antes da decisão. 3) Registrar a aprovação (ata ou documento formal). 4) Executar a mudança somente após essa aprovação. 5) Arquivar a evidência junto à documentação.',
    evidence: 'Ata ou documento formal de aprovação da administração para a última mudança de regime (ou confirmação de manutenção).' },
  { id: 'tributario_enquadramento_tributario_005', title: 'Criar registro histórico das decisões de enquadramento tributário',
    checklist: '1) Definir onde registrar (pasta ou sistema simples). 2) Reunir as análises e decisões já tomadas no histórico da empresa. 3) Registrar retroativamente o que for possível. 4) Definir que toda nova análise/decisão entra nesse registro. 5) Manter atualizado.',
    evidence: 'Registro histórico de análises e decisões de enquadramento tributário, atualizado.' },
  { id: 'tributario_enquadramento_tributario_006', title: 'Vincular a revisão de enquadramento a mudanças legais e operacionais',
    checklist: '1) Definir gatilhos de revisão extraordinária (mudança de lei relevante, mudança de porte, nova atividade). 2) Manter a revisão periódica já definida. 3) Cruzar mudanças legais/operacionais recentes com o regime atual a cada revisão. 4) Ajustar se necessário. 5) Registrar a análise.',
    evidence: 'Revisão de enquadramento tributário do último ciclo, considerando mudanças legais/operacionais relevantes.' },
  { id: 'tributario_enquadramento_tributario_007', title: 'Implantar auditoria/revisão periódica do processo de enquadramento tributário',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Definir se será revisão por consultoria externa ou revisão interna independente. 3) Executar a revisão/auditoria do processo (não só do resultado). 4) Documentar achados. 5) Corrigir e acompanhar até o fechamento.',
    evidence: 'Relatório de revisão/auditoria do processo de enquadramento tributário, com achados corrigidos.' },
  // tributario_agro_especifico
  { id: 'tributario_tributario_agro_especifico_001', title: 'Formalizar processo de gestão das obrigações tributárias do agro',
    checklist: '1) Levantar as obrigações específicas aplicáveis (Funrural, ITR, GIA rural, etc.). 2) Documentar o processo de apuração e envio de cada uma. 3) Definir responsável. 4) Validar com consultoria especializada em agro. 5) Aplicar o processo formalizado.',
    evidence: 'Processo formal de gestão das obrigações tributárias agro documentado, com responsável definido.' },
  { id: 'tributario_tributario_agro_especifico_002', title: 'Implantar acompanhamento das regras tributárias específicas do agro',
    checklist: '1) Definir as fontes oficiais a monitorar (legislação federal/estadual agro). 2) Definir quem acompanha e com que frequência. 3) Testar a aplicação correta numa amostra de operações recentes. 4) Corrigir desvios encontrados. 5) Manter o acompanhamento contínuo.',
    evidence: 'Amostra de operações agro testada quanto à aplicação correta das regras específicas, desvios corrigidos.' },
  { id: 'tributario_tributario_agro_especifico_003', title: 'Mapear e analisar tecnicamente os benefícios fiscais do agronegócio',
    checklist: '1) Levantar os benefícios fiscais potencialmente aplicáveis ao negócio. 2) Avaliar tecnicamente a elegibilidade de cada um. 3) Priorizar os de maior impacto financeiro. 4) Implementar o uso correto dos benefícios validados. 5) Documentar a análise para sustentar o uso perante fiscalização.',
    evidence: 'Análise técnica de benefícios fiscais agro aplicáveis, com uso implementado e documentado.' },
  { id: 'tributario_tributario_agro_especifico_004', title: 'Implantar controle formal da escrituração do Livro Caixa/LCDPR',
    checklist: '1) Confirmar se a empresa/produtor está obrigado ao LCDPR. 2) Definir o processo de escrituração (o que lançar, com que frequência). 3) Atribuir responsável pela escrituração. 4) Conferir a escrituração periodicamente. 5) Manter o histórico organizado para eventual fiscalização.',
    evidence: 'Escrituração do Livro Caixa/LCDPR em dia, com conferência periódica registrada.' },
  { id: 'tributario_tributario_agro_especifico_005', title: 'Estruturar o lastro documental da escrituração do Livro Caixa',
    checklist: '1) Definir quais documentos suportam cada lançamento (nota fiscal, recibo, comprovante). 2) Verificar, numa amostra, se os lançamentos têm lastro documental. 3) Regularizar lançamentos sem suporte. 4) Formalizar o procedimento de escrituração com essa exigência. 5) Aplicar nos próximos lançamentos.',
    evidence: 'Amostra de lançamentos do Livro Caixa conferida com lastro documental, casos sem suporte regularizados.' },
  { id: 'tributario_tributario_agro_especifico_006', title: 'Organizar a guarda documental dos comprovantes do Livro Caixa',
    checklist: '1) Definir a estrutura de arquivo dos comprovantes (por mês, por tipo). 2) Organizar os comprovantes existentes nessa estrutura. 3) Definir prazo de guarda conforme legislação. 4) Definir responsável pela organização contínua. 5) Testar a localização de um comprovante para validar.',
    evidence: 'Estrutura de arquivo de comprovantes do Livro Caixa implantada, teste de localização bem-sucedido.' },
  { id: 'tributario_tributario_agro_especifico_007', title: 'Segregar contas bancárias da atividade rural das pessoais',
    checklist: '1) Verificar se a movimentação da atividade rural passa por conta própria (não misturada com pessoa física). 2) Se não houver segregação, abrir/definir conta específica para a atividade. 3) Migrar a movimentação para a conta correta. 4) Comunicar a regra a quem movimenta recursos. 5) Monitorar periodicamente para evitar mistura recorrente.',
    evidence: 'Conta bancária específica para a atividade rural em uso, sem mistura com movimentação pessoal recente.' },
  { id: 'tributario_tributario_agro_especifico_008', title: 'Implantar monitoramento periódico de conformidade fiscal rural',
    checklist: '1) Definir os pontos de checagem (documentos fiscais, benefícios aplicados, obrigações entregues). 2) Definir periodicidade de checagem. 3) Executar a checagem. 4) Registrar e corrigir desvios encontrados. 5) Reportar à gestão.',
    evidence: 'Checagem periódica de conformidade fiscal rural, com desvios corrigidos e reportados.' },
  { id: 'tributario_tributario_agro_especifico_009', title: 'Implantar auditoria/revisão periódica do processo tributário agro',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Definir se será revisão por especialista externo ou interna independente. 3) Executar a revisão/auditoria. 4) Documentar achados. 5) Corrigir e acompanhar até o fechamento.',
    evidence: 'Relatório de revisão/auditoria do processo tributário agro, com achados corrigidos.' },
  // riscos_fiscais
  { id: 'tributario_riscos_fiscais_001', title: 'Estruturar processo de identificação de riscos fiscais',
    checklist: '1) Mapear as operações de maior complexidade/volume tributário. 2) Para cada uma, identificar o risco fiscal potencial (classificação, crédito, obrigação). 3) Consolidar numa lista única de riscos. 4) Validar com o time fiscal/consultoria. 5) Manter a lista viva.',
    evidence: 'Lista de riscos fiscais identificados por operação, validada com o time fiscal.' },
  { id: 'tributario_riscos_fiscais_002', title: 'Criar rito de avaliação tributária prévia para novas operações',
    checklist: '1) Definir que toda nova operação/estrutura contratual relevante passa por avaliação tributária prévia. 2) Envolver o fiscal/consultoria nessa avaliação. 3) Documentar o impacto esperado antes de executar. 4) Aprovar formalmente antes de seguir. 5) Registrar o racional.',
    evidence: 'Pelo menos uma operação/estrutura nova recente com avaliação tributária prévia documentada.' },
  { id: 'tributario_riscos_fiscais_003', title: 'Criar registro central de autuações e contingências fiscais',
    checklist: '1) Levantar as autuações/processos administrativos fiscais ativos. 2) Registrar cada um numa base única (valor, fase, risco). 3) Vincular ao responsável (interno ou escritório externo). 4) Manter atualizado periodicamente. 5) Compartilhar com contábil/financeiro para provisão.',
    evidence: 'Base central de autuações/contingências fiscais com valor, fase e risco, atualizada.' },
  { id: 'tributario_riscos_fiscais_004', title: 'Implantar acompanhamento de contingências fiscais relevantes',
    checklist: '1) Usar a base já criada como ponto de partida. 2) Priorizar as contingências de maior valor/risco. 3) Definir rito de acompanhamento periódico com o responsável. 4) Registrar a evolução de cada uma. 5) Reportar à gestão as mudanças relevantes.',
    evidence: 'Acompanhamento periódico das contingências fiscais mais relevantes, com evolução registrada.' },
  { id: 'tributario_riscos_fiscais_005', title: 'Implantar monitoramento periódico de riscos fiscais operacionais',
    checklist: '1) Definir periodicidade de monitoramento (ex.: trimestral). 2) Revisar a lista de riscos fiscais identificados. 3) Verificar se surgiram riscos novos com novas operações. 4) Atualizar a priorização. 5) Reportar à gestão.',
    evidence: 'Registro de monitoramento periódico de riscos fiscais operacionais, com atualização da priorização.' },
  { id: 'tributario_riscos_fiscais_006', title: 'Implantar auditoria/revisão periódica do processo de gestão de riscos fiscais',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Definir se será revisão externa ou interna independente. 3) Executar a revisão/auditoria do processo. 4) Documentar achados. 5) Corrigir e acompanhar até o fechamento.',
    evidence: 'Relatório de revisão/auditoria do processo de gestão de riscos fiscais, com achados corrigidos.' },
  // apuracao_tributos
  { id: 'tributario_apuracao_tributos_001', title: 'Formalizar o procedimento de apuração tributária',
    checklist: '1) Levantar como a apuração é feita hoje para cada esfera (federal, estadual, municipal). 2) Documentar o passo a passo de cada apuração. 3) Definir responsável por cada uma. 4) Validar com contador/consultoria. 5) Aplicar o procedimento no próximo ciclo.',
    evidence: 'Procedimento formal de apuração tributária documentado por esfera, aplicado no ciclo mais recente.' },
  { id: 'tributario_apuracao_tributos_002', title: 'Adequar a parametrização do sistema fiscal/ERP usado na apuração',
    checklist: '1) Verificar se a apuração usa sistema ou é feita manualmente/em planilha. 2) Se usa sistema, testar a parametrização contra uma amostra de operações reais. 3) Corrigir parametrizações incorretas encontradas. 4) Se não usa sistema, avaliar a adoção de um módulo fiscal. 5) Documentar a parametrização validada.',
    evidence: 'Amostra de apuração testada contra a parametrização do sistema fiscal, correções aplicadas.' },
  { id: 'tributario_apuracao_tributos_003', title: 'Implantar revisão técnica das memórias de cálculo antes do envio',
    checklist: '1) Definir quem revisa a memória de cálculo antes do envio (segregado de quem apura). 2) Definir um checklist mínimo de revisão. 3) Aplicar a revisão no próximo ciclo. 4) Registrar a revisão (sign-off). 5) Só enviar após essa revisão.',
    evidence: 'Memória de cálculo da apuração mais recente com revisão técnica registrada (sign-off) antes do envio.' },
  { id: 'tributario_apuracao_tributos_004', title: 'Formalizar controle das memórias de cálculo e ajustes do LALUR/LACS',
    checklist: '1) Levantar os ajustes fiscais (adições/exclusões) aplicados na apuração de IRPJ/CSLL. 2) Documentar o fundamento de cada ajuste. 3) Organizar a memória de cálculo de forma rastreável. 4) Conciliar com a escrituração contábil. 5) Manter o histórico organizado por ano-calendário.',
    evidence: 'Memórias de cálculo do LALUR/LACS organizadas e conciliadas com a escrituração contábil do último período.' },
  { id: 'tributario_apuracao_tributos_005', title: 'Analisar tecnicamente dedutibilidade de despesas e uso de JCP',
    checklist: '1) Levantar as despesas de maior valor/risco de dedutibilidade questionável. 2) Avaliar tecnicamente a dedutibilidade de cada uma. 3) Avaliar a viabilidade e o benefício de distribuir via JCP. 4) Documentar a análise. 5) Implementar as oportunidades validadas.',
    evidence: 'Análise técnica de dedutibilidade/JCP documentada, com oportunidades implementadas.' },
  { id: 'tributario_apuracao_tributos_006', title: 'Estruturar e parametrizar o processo de apuração de tributos indiretos',
    checklist: '1) Mapear o processo atual de apuração de cada tributo indireto. 2) Verificar a parametrização do sistema para cada um. 3) Testar contra uma amostra de operações. 4) Corrigir divergências. 5) Documentar o processo validado.',
    evidence: 'Processo de apuração de tributos indiretos documentado e testado contra amostra de operações.' },
  { id: 'tributario_apuracao_tributos_007', title: 'Implantar controle técnico do cadastro fiscal de produtos',
    checklist: '1) Levantar o cadastro de produtos e verificar NCM, CEST, CST, CFOP de uma amostra. 2) Identificar erros/inconsistências. 3) Corrigir o cadastro. 4) Definir workflow de aprovação para novo cadastro/alteração. 5) Definir rotina de checagem periódica.',
    evidence: 'Amostra de cadastro fiscal de produtos corrigida, com workflow de aprovação implantado.' },
  { id: 'tributario_apuracao_tributos_008', title: 'Analisar tecnicamente créditos fiscais e exclusões de base de cálculo',
    checklist: '1) Levantar os créditos/exclusões potencialmente aplicáveis (insumos, ICMS na base PIS/COFINS). 2) Avaliar tecnicamente a elegibilidade. 3) Quantificar o benefício potencial. 4) Implementar o uso validado. 5) Documentar a análise para sustentar perante fiscalização.',
    evidence: 'Análise técnica de créditos fiscais/exclusões documentada, com uso implementado quando validado.' },
  { id: 'tributario_apuracao_tributos_009', title: 'Implantar controle de vencimento e regularidade fiscal',
    checklist: '1) Levantar as certidões/obrigações que atestam regularidade fiscal em cada esfera. 2) Verificar o status atual de cada uma. 3) Regularizar pendências encontradas. 4) Definir alertas de vencimento. 5) Definir responsável por manter atualizado.',
    evidence: 'Controle de regularidade fiscal por esfera com alertas de vencimento, pendências regularizadas.' },
  { id: 'tributario_apuracao_tributos_010', title: 'Implantar monitoramento periódico dos domicílios eletrônicos fiscais',
    checklist: '1) Levantar os domicílios eletrônicos aplicáveis (e-CAC, domicílio estadual/municipal). 2) Definir quem acessa e com que frequência. 3) Definir o processo de tratativa quando surgir intimação/pendência. 4) Testar o processo com um caso real. 5) Registrar o histórico de checagens.',
    evidence: 'Registro de monitoramento periódico dos domicílios eletrônicos fiscais, com tratativas registradas.' },
  { id: 'tributario_apuracao_tributos_011', title: 'Definir alçadas de aprovação para pagamento de tributos e passivos fiscais',
    checklist: '1) Levantar os tipos de decisão (pagamento de tributo, reconhecimento de passivo, parcelamento). 2) Definir quem aprova cada tipo, conforme valor/risco. 3) Documentar a matriz de alçadas. 4) Comunicar formalmente. 5) Aplicar nas próximas decisões.',
    evidence: 'Matriz de alçadas para pagamento/reconhecimento de passivo fiscal documentada e comunicada.' },
  { id: 'tributario_apuracao_tributos_012', title: 'Implantar auditoria/revisão periódica do processo de apuração tributária',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Definir se será revisão externa ou interna independente. 3) Executar a revisão/auditoria do processo. 4) Documentar achados. 5) Corrigir e acompanhar até o fechamento.',
    evidence: 'Relatório de revisão/auditoria do processo de apuração tributária, com achados corrigidos.' },
  { id: 'tributario_apuracao_tributos_013', title: 'Implantar revisão periódica de eficiência fiscal entre regimes',
    checklist: '1) Definir periodicidade (ex.: anual, antes do prazo de opção). 2) Simular o resultado tributário em Lucro Real e Presumido com dados reais/projetados. 3) Comparar a carga tributária e o fluxo de caixa resultante. 4) Levar à decisão da administração. 5) Registrar a análise e a decisão.',
    evidence: 'Simulação comparativa Real vs. Presumido do último ciclo, com decisão da administração registrada.' },
  { id: 'tributario_apuracao_tributos_014', title: 'Analisar tecnicamente a segregação de receitas/atividades para eficiência tributária',
    checklist: '1) Mapear as diferentes atividades/receitas da empresa. 2) Avaliar se a segregação (em CNPJs ou centros de resultado) traria benefício tributário legítimo. 3) Quantificar o benefício potencial e o custo de implementação. 4) Validar a viabilidade jurídica/tributária com especialista. 5) Levar à decisão da administração.',
    evidence: 'Análise técnica de segregação de receitas/atividades documentada, com decisão da administração registrada.' },
  // obrigacoes_acessorias
  { id: 'tributario_obrigacoes_acessorias_001', title: 'Formalizar o procedimento de preparação e entrega de obrigações acessórias',
    checklist: '1) Levantar todas as obrigações acessórias aplicáveis (SPED, DCTF, GIA, EFD, etc.). 2) Documentar o passo a passo de preparação de cada uma. 3) Definir responsável por cada obrigação. 4) Validar com contador/consultoria. 5) Aplicar o procedimento no próximo ciclo.',
    evidence: 'Procedimento formal de preparação/entrega de obrigações acessórias documentado, aplicado no ciclo mais recente.' },
  { id: 'tributario_obrigacoes_acessorias_002', title: 'Implantar calendário de vencimentos das obrigações acessórias',
    checklist: '1) Levantar todas as obrigações e seus prazos legais. 2) Montar um calendário único (mesmo que uma planilha) com todas as datas. 3) Definir alertas de vencimento com antecedência. 4) Definir responsável por cada entrega. 5) Acompanhar o cumprimento mensalmente.',
    evidence: 'Calendário de vencimentos das obrigações acessórias, com cumprimento acompanhado no último ciclo.' },
  { id: 'tributario_obrigacoes_acessorias_003', title: 'Integrar a geração das obrigações acessórias ao sistema fiscal/ERP',
    checklist: '1) Verificar quais obrigações hoje são geradas manualmente (fora do sistema). 2) Avaliar se o sistema fiscal/ERP atual suporta a geração automática. 3) Priorizar a integração das obrigações de maior risco de erro manual. 4) Implementar e testar a geração automática. 5) Manter geração manual apenas onde não houver alternativa, com dupla checagem.',
    evidence: 'Obrigações acessórias críticas geradas via sistema fiscal/ERP, testadas contra o processo manual anterior.' },
  { id: 'tributario_obrigacoes_acessorias_004', title: 'Implantar revisão prévia ao envio das obrigações acessórias',
    checklist: '1) Definir quem revisa antes do envio (segregado de quem prepara). 2) Definir um checklist mínimo de revisão (valores batendo com a apuração, campos obrigatórios preenchidos). 3) Aplicar a revisão no próximo envio. 4) Registrar a revisão (sign-off). 5) Só enviar após essa revisão.',
    evidence: 'Obrigação acessória mais recente com revisão prévia registrada (sign-off) antes do envio.' },
  { id: 'tributario_obrigacoes_acessorias_005', title: 'Criar registro central de entregas e protocolos de obrigações acessórias',
    checklist: '1) Definir onde guardar os protocolos/recibos de entrega (pasta ou sistema). 2) Registrar cada entrega com data, protocolo e responsável. 3) Migrar o histórico recente para esse registro. 4) Manter atualizado a cada nova entrega. 5) Usar o registro para provar tempestividade em caso de questionamento.',
    evidence: 'Registro central de entregas e protocolos de obrigações acessórias, atualizado com as entregas recentes.' },
  { id: 'tributario_obrigacoes_acessorias_006', title: 'Implantar monitoramento de divergências apontadas pelo fisco',
    checklist: '1) Definir onde essas divergências aparecem (malha fiscal, cruzamento de dados, notificação). 2) Definir quem monitora e com que frequência. 3) Definir o processo de tratativa quando surgir divergência. 4) Testar o processo com um caso real ou recente. 5) Registrar o histórico de tratativas.',
    evidence: 'Registro de monitoramento de divergências fiscais pós-envio, com tratativas documentadas.' },
  { id: 'tributario_obrigacoes_acessorias_007', title: 'Implantar auditoria/revisão periódica do processo de obrigações acessórias',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Definir se será revisão externa ou interna independente. 3) Executar a revisão/auditoria do processo. 4) Documentar achados. 5) Corrigir e acompanhar até o fechamento.',
    evidence: 'Relatório de revisão/auditoria do processo de obrigações acessórias, com achados corrigidos.' },
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

  console.log(`[tributario] ${updatedQuestions} FalQuestion atualizadas, ${updatedActions} FalQuestionActionLibrary atualizadas. Total esperado: 43.`);
  if (missing.length) console.log(`FalQuestion não encontrada: ${missing.join(', ')}`);
  if (missingAction.length) console.log(`Sem FalQuestionActionLibrary (precisa criar): ${missingAction.join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
