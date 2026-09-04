/**
 * Update one-off: reescreve guidance/evidence_hint (fal_questions) e
 * action_title/how_to_execute/expected_evidence (fal_question_action_library)
 * das 96 perguntas da Reforma Tributária 8D no formato "checklist numerado
 * de passos concretos + evidência específica" — pedido do usuário depois de
 * apontar que o formato anterior (1 frase de motivo + "primeiro passo: X")
 * ainda era pouco prático pra quem tem pouca experiência.
 *
 * Idempotente por natureza (é um UPDATE por question_id, não um insert) —
 * pode rodar de novo sem duplicar nada.
 *
 * Rodar com: npx tsx prisma/update-tax-reform-practical-actions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

type Row = {
  id: string;
  title: string;
  checklist: string; // "1) ... 2) ... 3) ..."
  evidence: string;
};

const ROWS: Row[] = [
  // ── 1. Governança e estratégia ──
  { id: 'D1-01', title: 'Formalizar sponsor executivo com poder de decisão real',
    checklist: '1) Identificar quem no C-level vai assumir o papel. 2) Redigir termo de nomeação descrevendo o escopo de decisão (orçamento, prioridade, resolução de conflitos entre áreas). 3) Levar para aprovação formal em reunião de diretoria/conselho. 4) Comunicar a nomeação a todas as áreas do programa. 5) Definir o canal para acionar o sponsor em caso de impasse.',
    evidence: 'Termo de nomeação assinado, ata da reunião de aprovação e comunicado interno enviado às áreas.' },
  { id: 'D1-02', title: 'Criar termo de abertura do Programa de Transição Tributária',
    checklist: '1) Listar todas as frentes afetadas (fiscal, financeiro, comercial, TI, jurídico, operações). 2) Definir objetivo, escopo e fora-de-escopo do programa. 3) Montar o roadmap macro com marcos por frente. 4) Definir a estrutura de governança (comitê, sponsor, rito de decisão). 5) Aprovar o termo com a diretoria e publicar internamente.',
    evidence: 'Termo de abertura assinado, com escopo multi-frente, roadmap macro e estrutura de governança definidos.' },
  { id: 'D1-03', title: 'Implantar comitê multidisciplinar com rito e pauta fixa',
    checklist: '1) Definir os representantes de Fiscal, Contábil, Financeiro, Jurídico, TI, Comercial, Compras e Operações. 2) Fixar periodicidade (ex.: quinzenal) e duração do comitê. 3) Criar template de pauta fixa (pendências, decisões, riscos, próximos passos). 4) Rodar as 3 primeiras reuniões e ajustar o rito conforme necessário. 5) Manter atas registradas e decisões rastreáveis.',
    evidence: 'Calendário recorrente do comitê, 3+ atas registradas com decisões e responsáveis.' },
  { id: 'D1-04', title: 'Dimensionar capacidade e aprovar orçamento por workstream',
    checklist: '1) Listar as frentes de trabalho (workstreams) do programa. 2) Estimar horas internas necessárias por frente. 3) Levantar a necessidade de consultoria/fornecedor externo por frente. 4) Consolidar num orçamento único e submeter à diretoria. 5) Formalizar a aprovação e comunicar os limites a cada líder de frente.',
    evidence: 'Budget aprovado por workstream, capacity plan com horas estimadas e aprovações formais anexadas.' },
  { id: 'D1-05', title: 'Construir roadmap 2026–2033 com caminho crítico',
    checklist: '1) Levantar os marcos legais oficiais já publicados (calendário da reforma). 2) Mapear os marcos internos dependentes (ERP, testes, treinamento, contratos). 3) Identificar o caminho crítico (o que atrasa tudo se atrasar). 4) Atribuir responsável e prazo a cada marco. 5) Publicar o roadmap e revisar mensalmente no comitê.',
    evidence: 'Roadmap com marcos legais e internos, caminho crítico identificado, responsáveis e datas.' },
  { id: 'D1-06', title: 'Criar matriz RACI e log de decisões da reforma',
    checklist: '1) Listar as decisões recorrentes do programa (ex.: aprovar cenário de preço, aprovar mudança de regra tributária). 2) Para cada uma, definir quem Executa, quem Aprova, quem é Consultado e quem é Informado. 3) Definir prazo-padrão e critério de escalonamento quando não há resposta. 4) Publicar a matriz para todo o programa. 5) Abrir um log simples (planilha ou sistema) para registrar cada decisão tomada.',
    evidence: 'Matriz RACI publicada e log de decisões com pelo menos as primeiras decisões já registradas.' },
  { id: 'D1-07', title: 'Implantar monitoramento normativo versionado',
    checklist: '1) Listar as fontes oficiais a monitorar (Receita Federal, Comitê Gestor do IBS, notas técnicas, leiautes). 2) Definir quem lê cada fonte e com que frequência. 3) Criar um repositório único com data e versão de cada norma relevante. 4) Definir o fluxo: norma nova → quem avalia impacto → quem decide ação. 5) Testar o fluxo com uma norma recente.',
    evidence: 'Calendário de monitoramento com fontes e responsáveis, repositório de normas versionado, um ciclo completo já testado.' },
  { id: 'D1-08', title: 'Criar registro central de riscos e planos de resposta',
    checklist: '1) Levantar os riscos já conhecidos do programa (com todas as áreas, não só o fiscal). 2) Classificar cada risco por probabilidade e impacto. 3) Definir dono e plano de resposta para os riscos críticos/altos. 4) Consolidar num risk register único e acessível ao comitê. 5) Revisar o risk register a cada reunião de comitê.',
    evidence: 'Risk register com riscos classificados, dono e plano de resposta; evidência de revisão periódica em ata.' },
  { id: 'D1-09', title: 'Definir painel executivo de prontidão com metas por frente',
    checklist: '1) Escolher 5-8 indicadores que representem prontidão real (ex.: % cadastros saneados, % contratos revisados, % testes concluídos). 2) Definir meta e prazo para cada indicador. 3) Definir a fonte de dado de cada indicador (quem alimenta, com que frequência). 4) Montar o painel (planilha ou dashboard) e apresentar à diretoria. 5) Atualizar e revisar periodicamente.',
    evidence: 'Painel executivo com indicadores, metas, prazos e histórico de pelo menos 2 atualizações.' },
  { id: 'D1-10', title: 'Criar plano de comunicação segmentado por área',
    checklist: '1) Mapear os públicos internos afetados (diretoria, fiscal, comercial, operação, etc.). 2) Definir a mensagem específica que cada público precisa (o que muda pra ele, na prática). 3) Escolher os canais (reunião, e-mail, mural, treinamento). 4) Montar um cronograma de comunicação alinhado ao roadmap do programa. 5) Executar a primeira rodada e coletar feedback.',
    evidence: 'Plano de comunicação com públicos, mensagens e cronograma; evidência de pelo menos uma rodada executada.' },
  { id: 'D1-11', title: 'Formalizar governança e aceite de fornecedores críticos',
    checklist: '1) Listar os fornecedores críticos (ERP, tax engine, emissor de documentos fiscais, consultoria). 2) Revisar/renegociar escopo, SLA e entregáveis de cada um à luz da reforma. 3) Definir matriz de responsabilidade (o que é do fornecedor, o que é da empresa). 4) Formalizar em aditivo contratual ou termo de aceite. 5) Definir rito de acompanhamento (reunião periódica com cada fornecedor crítico).',
    evidence: 'Contratos/aditivos com SLA explícito e matriz de responsabilidades por fornecedor crítico.' },
  { id: 'D1-12', title: 'Instituir gate executivo para aprovação de cenários',
    checklist: '1) Definir quais tipos de cenário exigem aprovação formal (preço, crédito, caixa, contrato). 2) Definir quem aprova cada tipo (pode variar por valor/risco). 3) Criar um template padrão de memória de cálculo para submissão. 4) Definir o prazo de resposta do aprovador. 5) Rodar o processo com o primeiro cenário real antes de generalizar.',
    evidence: 'Memória de cálculo padrão, ata de aprovação do primeiro cenário submetido ao gate.' },

  // ── 2. Jurídico e societário ──
  { id: 'D2-01', title: 'Criar inventário contratual por materialidade e risco',
    checklist: '1) Levantar todos os contratos ativos com clientes e fornecedores relevantes. 2) Classificar por materialidade (valor, prazo) e exposição a mudança tributária (preço, crédito, local). 3) Priorizar os contratos de maior risco/valor para revisão. 4) Atribuir responsável pela revisão de cada contrato priorizado. 5) Consolidar o inventário numa base única e mantê-la atualizada.',
    evidence: 'Base de contratos classificada por materialidade e risco, com responsável de revisão atribuído.' },
  { id: 'D2-02', title: 'Revisar cláusulas de alteração tributária nos contratos críticos',
    checklist: '1) Verificar, contrato a contrato (priorizados), se existe cláusula de variação tributária. 2) Redigir cláusula-modelo cobrindo criação, extinção e alteração de tributos. 3) Validar a cláusula-modelo com o jurídico. 4) Negociar a inclusão/ajuste da cláusula nos contratos críticos vigentes. 5) Incluir a cláusula-modelo em todos os novos contratos e propostas.',
    evidence: 'Cláusula-modelo aprovada e parecer de aderência para os contratos críticos revisados.' },
  { id: 'D2-03', title: 'Inserir cláusulas de destaque, repasse e recomposição de preço',
    checklist: '1) Mapear os contratos/propostas onde o tributo hoje está embutido no preço. 2) Redigir cláusula de destaque "por fora" e de recomposição de preço líquido. 3) Simular o efeito da cláusula em 2-3 contratos reais para validar o racional. 4) Validar com jurídico e comercial. 5) Aplicar a cláusula em contratos críticos e novas propostas.',
    evidence: 'Cláusula de destaque/repasse revisada e simulação de efeito em contratos reais documentada.' },
  { id: 'D2-04', title: 'Estruturar protocolo de reequilíbrio econômico-financeiro',
    checklist: '1) Identificar os contratos de longo prazo (públicos e privados) sem cláusula de reequilíbrio. 2) Definir os eventos que disparam o direito de pleito (ex.: variação de carga tributária acima de X%). 3) Desenhar o procedimento de pleito (quem aciona, com qual evidência, prazo de resposta). 4) Validar o protocolo com jurídico. 5) Comunicar o protocolo às áreas comercial e financeira.',
    evidence: 'Matriz de eventos de reequilíbrio e procedimento de pleito formalizado e comunicado.' },
  { id: 'D2-05', title: 'Revisar contratos e políticas intercompany',
    checklist: '1) Mapear todos os fluxos intercompany do grupo (produtos, serviços, rateio de custos). 2) Verificar se cada fluxo tem contrato/preço formalizado. 3) Revisar o preço/base de cada fluxo à luz da nova lógica de crédito (IBS/CBS). 4) Ajustar contratos onde necessário. 5) Documentar o racional de preço para sustentar a legitimidade do crédito entre empresas do grupo.',
    evidence: 'Contratos intercompany atualizados com preços e fluxos documentados, racional de preço registrado.' },
  { id: 'D2-06', title: 'Executar análise societária e operacional integrada',
    checklist: '1) Levantar o organograma societário completo (CNPJs, filiais, unidades). 2) Simular o efeito da regra de destino em cada unidade (onde o tributo passa a ser devido). 3) Avaliar se a estrutura atual ainda faz sentido sob a nova lógica (consolidar, manter, criar filial). 4) Levar a análise e recomendação para a diretoria decidir. 5) Registrar a decisão e o racional.',
    evidence: 'Organograma societário com CNPJs/inscrições e parecer sobre destino/crédito por unidade.' },
  { id: 'D2-07', title: 'Revisar procurações, perfis e segregação de acessos',
    checklist: '1) Levantar todas as procurações e acessos ativos aos portais tributários. 2) Verificar quem realmente ainda precisa de cada acesso (revisão de necessidade). 3) Identificar concentração de acesso numa única pessoa (risco de ponto único de falha). 4) Atualizar/revogar procurações desnecessárias. 5) Definir rotina de revisão periódica (ex.: semestral).',
    evidence: 'Matriz de procurações e acessos vigentes, com data da última revisão e ajustes já aplicados.' },
  { id: 'D2-08', title: 'Integrar contencioso ao plano de transição',
    checklist: '1) Levantar o mapa de processos/teses ativas relacionadas ao sistema tributário atual. 2) Cruzar cada tese com as decisões que estão sendo tomadas para a transição. 3) Identificar contradições (posição na transição que enfraquece uma tese em curso). 4) Ajustar a decisão ou documentar o racional de aceitar o risco. 5) Manter esse cruzamento revisado a cada marco relevante do contencioso.',
    evidence: 'Mapa de contencioso ativo cruzado com as decisões de transição, com parecer sobre contradições encontradas.' },
  { id: 'D2-09', title: 'Mapear fluxos de dados tributários e formalizar avaliação LGPD',
    checklist: '1) Levantar todas as integrações e compartilhamentos de dados tributários criados ou alterados pela reforma (tax engine, portal da SEFAZ, contabilidade terceirizada, cloud do ERP). 2) Para cada uma, identificar que dado trafega (CPF/CNPJ, valores, dados de terceiros) e quem tem acesso. 3) Definir a base legal de cada compartilhamento junto ao jurídico. 4) Verificar contrato/termo de confidencialidade com cada fornecedor que recebe o dado. 5) Aplicar controles mínimos (criptografia em trânsito, controle de acesso, log de quem acessou) e registrar tudo num parecer ou DPIA simplificado.',
    evidence: 'Lista de integrações/fluxos de dados tributários com base legal, fornecedor responsável e controles de segurança aplicados; parecer jurídico ou DPIA simplificado assinado.' },
  { id: 'D2-10', title: 'Criar plano de renegociação com clientes críticos',
    checklist: '1) Segmentar a carteira de clientes por materialidade e exposição à mudança de preço/crédito. 2) Definir a estratégia de negociação por segmento (o que pode ceder, o que é inegociável). 3) Preparar material de apoio explicando o efeito da reforma pro cliente. 4) Priorizar e agendar as conversas com os clientes mais críticos primeiro. 5) Registrar o resultado de cada negociação e ajustar contrato/documentação.',
    evidence: 'Matriz de clientes críticos com estratégia de negociação por segmento e registro dos resultados das primeiras conversas.' },
  { id: 'D2-11', title: 'Criar plano de renegociação com fornecedores críticos',
    checklist: '1) Segmentar fornecedores críticos por regime tributário, crédito gerado e risco documental. 2) Simular o custo líquido real de cada fornecedor sob a nova regra (não só o preço de tabela). 3) Priorizar fornecedores onde o crédito esperado está em risco. 4) Negociar ajuste de preço, documentação ou substituição de fornecedor onde necessário. 5) Registrar o resultado e atualizar contratos.',
    evidence: 'Matriz de fornecedores críticos com regime, crédito simulado e plano de renegociação, com resultados registrados.' },
  { id: 'D2-12', title: 'Criar repositório de decisões jurídicas versionadas',
    checklist: '1) Definir o formato padrão de um parecer/decisão (fundamento, responsável, data de vigência, revisores). 2) Levantar as interpretações relevantes já tomadas informalmente e formalizá-las retroativamente. 3) Criar um repositório único (pasta compartilhada ou sistema) versionado. 4) Definir quem pode registrar e quem aprova cada entrada. 5) Divulgar o repositório às áreas que dependem dessas decisões (fiscal, contábil, comercial).',
    evidence: 'Repositório de decisões jurídicas versionado, com pelo menos as interpretações mais relevantes já registradas e aprovadas.' },

  // ── 3. Controles internos ──
  { id: 'D3-01', title: 'Revisar controles do order-to-cash',
    checklist: '1) Mapear o fluxo atual: pedido → aprovação → faturamento → documento fiscal. 2) Identificar em cada etapa onde cliente, local, operação, preço e classificação tributária são definidos. 3) Testar uma amostra de pedidos recentes procurando erro de classificação/preço. 4) Inserir pontos de controle (validação) nas etapas com maior taxa de erro. 5) Documentar o fluxo revisado e treinar o time.',
    evidence: 'Fluxograma do order-to-cash com matriz de controles e resultado do teste de amostra.' },
  { id: 'D3-02', title: 'Revisar controles do procure-to-pay',
    checklist: '1) Mapear o fluxo atual: requisição → cotação → compra → recebimento → pagamento. 2) Verificar se o regime tributário e a classificação do fornecedor são validados antes da aprovação da compra. 3) Testar uma amostra de compras recentes conferindo crédito gerado vs. esperado. 4) Inserir validação de regime/crédito como etapa obrigatória de aprovação. 5) Documentar e treinar compras/financeiro.',
    evidence: 'Fluxograma do procure-to-pay com pontos de aprovação e resultado do teste de amostra.' },
  { id: 'D3-03', title: 'Implantar controles tributários de movimentação de estoques',
    checklist: '1) Listar os tipos de movimentação (entrada, transferência entre filiais, devolução, perda, industrialização). 2) Definir o tratamento tributário esperado para cada tipo. 3) Implantar conciliação periódica entre o físico e o crédito escriturado. 4) Testar a conciliação com um ciclo completo. 5) Formalizar o procedimento e definir responsável pela conciliação mensal.',
    evidence: 'Procedimento de conciliação de estoque com relatório do primeiro ciclo testado.' },
  { id: 'D3-04', title: 'Implantar governança de alterações cadastrais',
    checklist: '1) Listar os campos críticos (NCM, NBS, CST, cClassTrib, dados de clientes/fornecedores). 2) Desenhar o workflow: solicitação → validação técnica → aprovação → alteração → log. 3) Definir quem pode solicitar e quem aprova cada tipo de alteração. 4) Implantar o workflow no sistema ou, na ausência de automação, um processo manual controlado. 5) Testar com uma alteração real e revisar o log gerado.',
    evidence: 'Workflow de aprovação de cadastro com log de quem alterou o quê e quando, testado em um caso real.' },
  { id: 'D3-05', title: 'Corrigir conflitos de segregação de funções',
    checklist: '1) Mapear quem tem acesso a cadastro, parametrização, emissão, ajuste e aprovação hoje. 2) Identificar os casos onde a mesma pessoa acumula funções incompatíveis. 3) Priorizar os conflitos de maior risco (ex.: quem cadastra a regra também aprova o documento). 4) Redesenhar os perfis de acesso para segregar as funções críticas. 5) Testar o novo desenho com um caso real e documentar a matriz de SoD.',
    evidence: 'Matriz de segregação de funções (SoD) com teste de acesso por perfil, conflitos críticos corrigidos.' },
  { id: 'D3-06', title: 'Implantar gestão formal de mudanças tributárias',
    checklist: '1) Definir o processo de change request para qualquer alteração de regra/parâmetro tributário. 2) Exigir teste obrigatório em ambiente de homologação antes de qualquer mudança. 3) Definir quem aprova o transporte para produção. 4) Manter log de todas as mudanças (o quê, quando, quem, teste realizado). 5) Rodar o processo com a próxima mudança real e ajustar o que não funcionar.',
    evidence: 'Change request com evidência de teste em homologação e aprovação antes do transporte para produção.' },
  { id: 'D3-07', title: 'Criar política e monitoramento de ajustes manuais',
    checklist: '1) Levantar os tipos de ajuste manual hoje permitidos (débito, crédito, documento, apuração). 2) Definir limites e exigência de aprovação para cada tipo. 3) Exigir justificativa e evidência anexada em todo ajuste manual. 4) Implantar um log central de ajustes manuais. 5) Auditar uma amostra de ajustes recentes para validar aderência à política.',
    evidence: 'Política de ajustes manuais formalizada, log central implantado e amostra auditada.' },
  { id: 'D3-08', title: 'Implantar dossiê eletrônico e trilha de créditos',
    checklist: '1) Definir o pacote mínimo de evidência exigido por crédito (documento, regra aplicada, período, vínculo contábil). 2) Levantar os créditos relevantes já reconhecidos e verificar se têm esse pacote completo. 3) Montar/completar o dossiê para os créditos mais materiais. 4) Implantar rotina para todo novo crédito nascer com o dossiê completo. 5) Conciliar periodicamente o dossiê com o saldo contábil.',
    evidence: 'Dossiê eletrônico de créditos com conciliação contábil por item, para os créditos mais materiais.' },
  { id: 'D3-09', title: 'Padronizar tratamento de eventos pós-emissão',
    checklist: '1) Listar os tipos de evento pós-emissão (devolução, cancelamento, desconto, ajuste). 2) Definir o procedimento padrão para cada tipo (documento exigido, prazo, aprovação). 3) Verificar se hoje cada área trata esses eventos de forma diferente. 4) Padronizar e comunicar o procedimento único. 5) Implantar conciliação periódica entre documento fiscal e financeiro/contábil.',
    evidence: 'Procedimento padronizado por tipo de evento pós-emissão, com conciliação periódica implantada.' },
  { id: 'D3-10', title: 'Implantar monitoramento de exceções tributárias',
    checklist: '1) Definir as exceções mais críticas a monitorar (cadastro, documento, alíquota, crédito, pagamento). 2) Definir a fonte de dado de cada exceção (relatório, log de sistema). 3) Montar um painel simples (mesmo que manual, uma planilha) com essas exceções. 4) Definir SLA de tratativa por tipo de exceção. 5) Rodar por um ciclo e ajustar o que gerar ruído demais ou pouco demais.',
    evidence: 'Painel de exceções com tickets/registro, SLA definido e taxa de resolução do primeiro ciclo.' },
  { id: 'D3-11', title: 'Reforçar trilha de auditoria dos controles críticos',
    checklist: '1) Listar os controles mais críticos do processo tributário. 2) Verificar se cada um registra quem executou, quem aprovou, data, justificativa e evidência. 3) Identificar os controles com log incompleto. 4) Ajustar o processo/sistema para capturar o log completo. 5) Testar com uma amostra recente se a trilha está de fato reconstituível.',
    evidence: 'Amostra de logs de controles críticos com todos os campos preenchidos (quem, quando, aprovação, evidência).' },
  { id: 'D3-12', title: 'Criar programa de testes de efetividade dos controles',
    checklist: '1) Priorizar os controles mais críticos para teste (os de maior risco/impacto). 2) Definir a amostra e a frequência de teste de cada um. 3) Rodar o primeiro ciclo de teste e documentar falhas encontradas. 4) Definir plano corretivo para cada falha. 5) Agendar o reteste para confirmar a correção.',
    evidence: 'Papel de trabalho do primeiro ciclo de testes, com falhas encontradas, plano corretivo e reteste agendado.' },

  // ── 4. Financeiro ──
  { id: 'D4-01', title: 'Incluir split payment e tributos no fluxo de caixa',
    checklist: '1) Entender exatamente como o split payment vai reter o tributo no momento do pagamento. 2) Criar uma linha específica no modelo de fluxo de caixa para o valor retido. 3) Simular o efeito em pelo menos 2 meses de operação histórica. 4) Ajustar a projeção de caixa disponível considerando essa retenção. 5) Validar o modelo com a tesouraria antes de usar para decisão.',
    evidence: 'Fluxo de caixa projetado com linha de split payment e memória de cálculo da simulação.' },
  { id: 'D4-02', title: 'Modelar prazo e custo financeiro dos créditos a recuperar',
    checklist: '1) Levantar o saldo credor atual e sua origem. 2) Montar um aging por faixa de prazo (30/60/90/180 dias). 3) Estimar a probabilidade de realização de cada faixa. 4) Calcular o custo financeiro de carregar esse crédito (funding, oportunidade). 5) Apresentar o resultado à diretoria/financeiro para decisão sobre política de monetização.',
    evidence: 'Aging de créditos com cenários de prazo e custo de funding calculado, apresentado à gestão.' },
  { id: 'D4-03', title: 'Recalcular capital de giro da transição',
    checklist: '1) Levantar o modelo de capital de giro atual (premissas de prazo de crédito/débito). 2) Identificar quais premissas mudam com a nova sistemática. 3) Recalcular a necessidade de capital de giro por unidade/sazonalidade. 4) Comparar com o modelo antigo e quantificar a diferença. 5) Comunicar o resultado à tesouraria para ajuste de linhas de crédito se necessário.',
    evidence: 'Modelo de capital de giro recalculado com sensibilidade por unidade/sazonalidade, comparado ao modelo antigo.' },
  { id: 'D4-04', title: 'Implantar repricing por família e perfil de cliente',
    checklist: '1) Segmentar o portfólio por família de produto/serviço. 2) Para cada família, simular preço líquido, tributo por fora, crédito do cliente e margem resultante. 3) Identificar famílias onde a margem cai abaixo do aceitável na tabela atual. 4) Propor nova tabela de preço por família. 5) Levar para aprovação executiva antes de implantar (ver gate de aprovação de cenários, D1-12).',
    evidence: 'Modelo de repricing por família de produto/serviço, com aprovação formal registrada.' },
  { id: 'D4-05', title: 'Recalcular margem econômica por operação',
    checklist: '1) Levantar a metodologia de cálculo de margem usada hoje. 2) Identificar o que falta considerar (crédito, frete, prazo, split, despesas). 3) Reconstruir a DRE gerencial por produto/serviço com a metodologia completa. 4) Comparar a margem antiga vs. nova para os produtos/serviços mais relevantes. 5) Comunicar as diferenças materiais à diretoria.',
    evidence: 'DRE gerencial por produto/serviço recalculada, com comparação entre metodologia antiga e nova.' },
  { id: 'D4-06', title: 'Estruturar plano de funding e contingência',
    checklist: '1) Estimar o pior cenário de descasamento de caixa da transição (ex.: crédito represado nos primeiros meses). 2) Verificar as linhas de crédito e limites já disponíveis. 3) Identificar o gap entre o disponível e o necessário no pior cenário. 4) Negociar previamente uma linha de contingência dimensionada para esse gap. 5) Formalizar a linha antes que o cenário se materialize.',
    evidence: 'Linha de contingência aprovada com limite e condições, dimensionada ao cenário de descasamento estimado.' },
  { id: 'D4-07', title: 'Renegociar prazos com base no ciclo financeiro completo',
    checklist: '1) Levantar PMR, PMP e prazo médio de recuperação tributária separadamente. 2) Montar uma visão única do ciclo financeiro combinado. 3) Identificar onde o ciclo piora com a nova sistemática. 4) Priorizar clientes/fornecedores onde a renegociação de prazo traria mais alívio. 5) Executar a renegociação e monitorar o efeito no ciclo.',
    evidence: 'Análise combinada de PMR/PMP/prazo de recuperação, com cenários simulados e priorização definida.' },
  { id: 'D4-08', title: 'Mapear impacto financeiro por meio de pagamento',
    checklist: '1) Listar os meios de pagamento usados (cartão, boleto, PIX, outros) e respectivos adquirentes. 2) Para cada um, identificar a regra de retenção/split aplicável. 3) Comparar o valor esperado vs. o valor efetivamente recebido numa amostra recente. 4) Ajustar a conciliação financeira para considerar essa diferença. 5) Comunicar o impacto ao time comercial se afetar negociação com cliente.',
    evidence: 'Mapa de meios de pagamento com regra de retenção por adquirente/contrato, amostra conciliada.' },
  { id: 'D4-09', title: 'Implantar conciliação tributária-financeira',
    checklist: '1) Definir os pontos a conciliar: documento, recebimento, split, crédito, saldo tributário. 2) Desenhar a rotina de conciliação (frequência, responsável, ferramenta). 3) Rodar o primeiro ciclo com dado real. 4) Documentar as diferenças encontradas e investigar a causa. 5) Formalizar a rotina como parte do fechamento periódico.',
    evidence: 'Relatório de conciliação tributário-financeira do primeiro ciclo, com diferenças investigadas.' },
  { id: 'D4-10', title: 'Revisar business cases de capex sob a nova sistemática',
    checklist: '1) Listar os investimentos em avaliação ou já aprovados que dependem de crédito tributário. 2) Recalcular o efeito de caixa e crédito de cada um sob a nova regra. 3) Identificar business cases cujo retorno muda materialmente. 4) Levar os casos com mudança relevante para reaprovação. 5) Atualizar o critério de avaliação de novos investimentos daqui pra frente.',
    evidence: 'Business cases revisados com o efeito de crédito/caixa da nova sistemática, casos relevantes reaprovados.' },
  { id: 'D4-11', title: 'Executar cenários de sensibilidade e estresse',
    checklist: '1) Definir as variáveis mais incertas (alíquota, crédito, prazo, inadimplência, câmbio, volume). 2) Montar o cenário base e pelo menos 2 cenários de estresse. 3) Rodar os cenários no modelo financeiro. 4) Identificar o ponto de ruptura (a partir de que variação a empresa tem problema real). 5) Apresentar os resultados à diretoria com recomendação de mitigação.',
    evidence: 'Matriz de sensibilidade/stress test com pelo menos 2 cenários além do base, apresentada à diretoria.' },
  { id: 'D4-12', title: 'Revisar covenants e comunicação com financiadores',
    checklist: '1) Levantar os covenants vigentes em contratos bancários. 2) Simular o efeito da nova metodologia tributária/contábil sobre cada indicador coberto. 3) Identificar covenants em risco de rompimento técnico. 4) Preparar comunicação proativa aos financiadores explicando a mudança de metodologia. 5) Negociar ajuste do covenant se necessário, antes do rompimento.',
    evidence: 'Simulação de covenants sob a nova metodologia e evidência de comunicação prévia ao financiador quando aplicável.' },

  // ── 5. Contábil ──
  { id: 'D5-01', title: 'Atualizar plano de contas para IBS/CBS e transição',
    checklist: '1) Levantar o plano de contas atual usado para tributos. 2) Identificar a necessidade de contas específicas (débito, crédito, saldo, ressarcimento, efeito de transição). 3) Desenhar o de-para entre o plano antigo e o novo. 4) Validar com a contabilidade/auditoria externa. 5) Implantar e testar com um mês de lançamentos reais.',
    evidence: 'Plano de contas atualizado com de-para documentado, testado com lançamentos reais.' },
  { id: 'D5-02', title: 'Formalizar política contábil dos tributos da reforma',
    checklist: '1) Definir o critério de reconhecimento, mensuração, apresentação e baixa dos novos créditos/débitos. 2) Redigir a política num documento formal. 3) Validar com auditoria externa se aplicável. 4) Aprovar a política com a controladoria/diretoria. 5) Treinar a equipe contábil na nova política.',
    evidence: 'Manual contábil atualizado e aprovado com a política dos novos tributos, evidência de treinamento da equipe.' },
  { id: 'D5-03', title: 'Implantar conciliação fiscal-contábil-financeira',
    checklist: '1) Definir os pontos a conciliar: documento, apuração, contas contábeis, contas a pagar/receber, caixa. 2) Desenhar a rotina (frequência mensal recomendada, responsável). 3) Rodar o primeiro ciclo e documentar divergências. 4) Investigar a causa-raiz de cada divergência relevante. 5) Formalizar a conciliação como etapa obrigatória do fechamento.',
    evidence: 'Conciliação fiscal-contábil-financeira do primeiro ciclo, com papel de trabalho e divergências investigadas.' },
  { id: 'D5-04', title: 'Criar aging e política de recuperabilidade de créditos',
    checklist: '1) Levantar todos os créditos a recuperar e sua origem. 2) Classificar por idade, risco e restrição aplicável. 3) Avaliar a recuperabilidade de cada faixa (o que é realista recuperar). 4) Definir política de baixa/provisão para créditos não recuperáveis. 5) Montar o dossiê de suporte para os créditos classificados como recuperáveis.',
    evidence: 'Aging de créditos com dossiê de suporte e avaliação de recuperabilidade por faixa.' },
  { id: 'D5-05', title: 'Integrar riscos da reforma ao processo de provisões',
    checklist: '1) Levantar as interpretações da nova legislação ainda incertas (com jurídico/tributário). 2) Para cada uma, avaliar se gera obrigação provável (provisão) ou apenas risco a divulgar. 3) Calcular o valor estimado quando aplicável. 4) Validar com auditoria externa se necessário. 5) Registrar a decisão (provisionar ou divulgar) com o racional.',
    evidence: 'Matriz de riscos de interpretação com parecer sobre provisão vs. divulgação e cálculo quando aplicável.' },
  { id: 'D5-06', title: 'Revisar controles de cut-off tributário',
    checklist: '1) Mapear os pontos de corte de período (documentos, eventos, créditos, pagamentos). 2) Verificar se o fechamento atual testa competência correta em cada ponto. 3) Adicionar teste de cut-off específico para os novos tributos ao checklist de fechamento. 4) Rodar o teste no próximo fechamento. 5) Corrigir o procedimento se houver falha.',
    evidence: 'Checklist de fechamento com teste de cut-off tributário evidenciado no ciclo mais recente.' },
  { id: 'D5-07', title: 'Criar fechamento assistido IBS/CBS',
    checklist: '1) Documentar o roteiro atual de fechamento mensal. 2) Adicionar as etapas específicas de IBS/CBS (conciliação, ajustes, revisão). 3) Definir responsável e prazo por etapa. 4) Rodar o roteiro completo no próximo fechamento. 5) Ajustar o roteiro com base no aprendizado do primeiro ciclo.',
    evidence: 'Calendário e checklist de fechamento com sign-off por etapa, testado em pelo menos um ciclo.' },
  { id: 'D5-08', title: 'Reforçar rastreabilidade documento–contabilidade',
    checklist: '1) Pegar uma amostra de lançamentos recentes relacionados a tributos. 2) Tentar rastrear cada um até o documento, item, regra, crédito e pagamento de origem. 3) Identificar onde a rastreabilidade quebra. 4) Ajustar o processo/sistema para preservar o vínculo. 5) Retestar com uma nova amostra.',
    evidence: 'Amostra de lançamentos rastreados até o documento e a regra de origem, com problemas identificados corrigidos.' },
  { id: 'D5-09', title: 'Padronizar contabilização e conciliação intercompany',
    checklist: '1) Levantar como cada empresa do grupo contabiliza hoje as operações intercompany. 2) Definir um padrão único de contabilização preservando a trilha tributária. 3) Ajustar as empresas que estão fora do padrão. 4) Implantar conciliação periódica das eliminações intercompany. 5) Validar que a trilha tributária individual não se perde na consolidação.',
    evidence: 'Conciliação intercompany com trilha tributária preservada por empresa do grupo.' },
  { id: 'D5-10', title: 'Preparar divulgações e comunicação financeira',
    checklist: '1) Levantar os efeitos materiais já conhecidos da transição (margem, caixa, contingências). 2) Redigir a minuta de nota explicativa cobrindo esses efeitos. 3) Validar com auditoria externa se aplicável. 4) Preparar comunicação para sócios/financiadores se o efeito for relevante. 5) Aprovar e publicar junto às próximas demonstrações.',
    evidence: 'Minuta de nota explicativa cobrindo os efeitos materiais já identificados, com aprovação registrada.' },
  { id: 'D5-11', title: 'Definir pacote padrão de evidências para auditoria',
    checklist: '1) Listar os tipos de operação/decisão que mais provavelmente serão auditados. 2) Para cada tipo, definir o pacote mínimo de evidência (documento, cálculo, aprovação). 3) Testar o pacote com uma revisão simulada interna. 4) Ajustar o que faltar. 5) Publicar o padrão para as áreas envolvidas.',
    evidence: 'Pacote padrão de evidências testado com uma revisão simulada, ajustes aplicados.' },
  { id: 'D5-12', title: 'Criar reporting gerencial integrado',
    checklist: '1) Levantar os relatórios hoje existentes (fiscal, financeiro, contábil) e o que cada um cobre. 2) Desenhar um reporting único juntando carga tributária, crédito, caixa, margem e risco. 3) Definir a fonte de dado e o responsável por cada bloco. 4) Rodar a primeira versão e validar com a gestão. 5) Formalizar a periodicidade (mensal recomendado).',
    evidence: 'Reporting gerencial integrado, com periodicidade mensal e evidência de envio à gestão.' },

  // ── 6. Tributário ──
  { id: 'D6-01', title: 'Construir mapa tributário de operações',
    checklist: '1) Levantar todos os tipos de operação realizados (entrada, saída, transferência, importação, exportação, serviços). 2) Quantificar o volume de cada tipo. 3) Classificar por complexidade/risco tributário. 4) Priorizar as operações de maior volume/risco para modelagem detalhada. 5) Manter o mapa atualizado conforme novas operações surgirem.',
    evidence: 'Matriz de operações com volumes, cobrindo entrada, saída, transferência e serviços, priorização definida.' },
  { id: 'D6-02', title: 'Executar saneamento de NCM/NBS',
    checklist: '1) Rodar uma amostra de saneamento no cadastro de produtos/serviços. 2) Medir a taxa de erro/desatualização encontrada. 3) Priorizar o saneamento pelos itens de maior volume de venda. 4) Documentar o laudo/justificativa de cada classificação revisada. 5) Definir rotina de manutenção para novos itens.',
    evidence: 'Amostra de saneamento de NCM/NBS com laudo técnico, histórico de alterações e rotina de manutenção definida.' },
  { id: 'D6-03', title: 'Implantar motor de classificação tributária (CST/cClassTrib)',
    checklist: '1) Montar a tabela de regras: operação → CST/cClassTrib → fundamento legal. 2) Priorizar as operações de maior volume. 3) Testar a tabela contra uma amostra real de operações. 4) Corrigir divergências encontradas. 5) Definir dono da tabela e rotina de atualização quando a legislação mudar.',
    evidence: 'Tabela de regras de classificação com fundamento e resultado de testes contra amostra real.' },
  { id: 'D6-04', title: 'Consolidar baseline tributário atual',
    checklist: '1) Levantar as regras vigentes de PIS/Cofins, ICMS, ISS e IPI aplicáveis à empresa. 2) Documentar os benefícios e regimes especiais hoje usufruídos. 3) Organizar num documento único de baseline. 4) Usar o baseline para comparar com a modelagem da nova regra (D6-05 em diante). 5) Validar o baseline com o time fiscal.',
    evidence: 'Baseline tributário atual consolidado, com benefícios e regimes vigentes documentados.' },
  { id: 'D6-05', title: 'Modelar regra IBS/CBS por operação',
    checklist: '1) Priorizar as operações de maior volume (do mapa em D6-01). 2) Para cada uma, definir incidência, base de cálculo, local e sujeito passivo. 3) Elaborar a memória de cálculo com fundamento legal citado. 4) Validar com o time fiscal/jurídico. 5) Repetir para as demais operações por ordem de prioridade.',
    evidence: 'Memória de cálculo da incidência por operação priorizada, com base legal citada.' },
  { id: 'D6-06', title: 'Criar motor de elegibilidade de créditos',
    checklist: '1) Definir as condições de elegibilidade de crédito (documento válido, operação, pagamento, vinculação, restrições). 2) Montar a matriz de elegibilidade por tipo de compra/operação. 3) Testar a matriz contra um lote real de compras recentes. 4) Ajustar a matriz com base nos erros encontrados. 5) Usar a matriz para orientar compras e financeiro.',
    evidence: 'Matriz de elegibilidade de crédito testada contra um lote real de operações, com ajustes aplicados.' },
  { id: 'D6-07', title: 'Mapear tratamentos diferenciados e específicos',
    checklist: '1) Levantar reduções, alíquota zero, imunidades e regimes específicos que podem se aplicar ao setor/produtos da empresa. 2) Validar a aplicabilidade de cada um com fonte legal. 3) Priorizar os que representam maior economia tributária. 4) Implementar os tratamentos validados no motor/processo. 5) Revisar periodicamente se surgirem novos regimes.',
    evidence: 'Matriz de regimes diferenciados aplicáveis, com fonte legal e produtos/operações afetados.' },
  { id: 'D6-08', title: 'Construir matriz de comércio exterior',
    checklist: '1) Levantar as operações de importação, exportação e regimes aduaneiros usados (ZFM, ALC, ZPE). 2) Modelar separadamente cada regime (base, crédito, documentos exigidos). 3) Validar com especialista em comércio exterior. 4) Testar com uma operação real de cada tipo. 5) Documentar o resultado para uso do time fiscal/logística.',
    evidence: 'Matriz de comércio exterior com bases, créditos e documentos por regime aduaneiro, testada com operação real.' },
  { id: 'D6-09', title: 'Modelar cadeias agro por operação e perfil',
    checklist: '1) Levantar os tipos de operação agro relevantes (produtor PF/PJ, cooperativas, insumos, barter, CPR, armazenagem, exportação). 2) Modelar o tratamento tributário específico de cada tipo. 3) Testar com casos reais da operação da empresa. 4) Validar com especialista tributário do setor. 5) Documentar e treinar o time comercial/fiscal nas particularidades.',
    evidence: 'Matriz de cadeias agro com casos reais testados por tipo de operação (barter, CPR, etc.).' },
  { id: 'D6-10', title: 'Comparar Simples Nacional versus regime regular',
    checklist: '1) Mapear as cadeias B2B/B2C que envolvem fornecedores ou clientes do Simples Nacional. 2) Simular o efeito de crédito em cada cadeia sob a nova regra. 3) Comparar o resultado com o regime regular equivalente. 4) Ajustar a política comercial/de compras se a diferença for relevante. 5) Comunicar o resultado às áreas comercial e de compras.',
    evidence: 'Simulação comparativa Simples vs. regime regular para as cadeias B2B relevantes, com política ajustada.' },
  { id: 'D6-11', title: 'Executar adequação e testes de documentos fiscais eletrônicos',
    checklist: '1) Obter o cronograma oficial de leiautes/notas técnicas aplicáveis. 2) Cruzar com o cronograma de adequação real do sistema/fornecedor. 3) Montar um plano de testes cobrindo os cenários de maior volume. 4) Executar os testes em homologação e registrar resultados. 5) Corrigir falhas e reter até a homologação completa antes de ir a produção.',
    evidence: 'Plano de testes de DF-e com notas técnicas seguidas e evidência de homologação completa.' },
  { id: 'D6-12', title: 'Desenhar fechamento e apuração assistida',
    checklist: '1) Entender o novo modelo de apuração assistida (o que o fisco calcula vs. o que a empresa concilia). 2) Desenhar o processo de conciliação de débitos, créditos, pagamentos, pendências e ajustes. 3) Testar o processo em ambiente de homologação com dado simulado. 4) Ajustar responsabilidades e prazos internos com base no teste. 5) Documentar o processo final antes da vigência real.',
    evidence: 'Desenho do processo de apuração assistida testado em ambiente de homologação, com responsabilidades definidas.' },

  // ── 7. Operacional e cultura ──
  { id: 'D7-01', title: 'Mapear processos críticos ponta a ponta',
    checklist: '1) Listar os processos mais afetados pela reforma (vendas, compras, fiscal, financeiro). 2) Mapear cada um ponta a ponta: entradas, decisões, controles, sistemas, saídas. 3) Identificar os gaps entre o processo atual e o necessário pós-reforma. 4) Priorizar os gaps por criticidade. 5) Usar o mapa como base para redesenho e treinamento.',
    evidence: 'Mapas de processo com gaps identificados entre o estado atual e o necessário.' },
  { id: 'D7-02', title: 'Nomear donos dos processos críticos',
    checklist: '1) Para cada processo crítico mapeado (D7-01), identificar quem deveria ser o dono. 2) Validar a nomeação com a liderança da área. 3) Definir a autoridade e responsabilidade do dono (o que ele pode decidir sozinho). 4) Comunicar formalmente a nomeação. 5) Acompanhar se o dono está de fato exercendo o papel após 1-2 meses.',
    evidence: 'Matriz de owners de processo com nome, escopo e autoridade de decisão, comunicada formalmente.' },
  { id: 'D7-03', title: 'Implantar trilhas de capacitação por função',
    checklist: '1) Mapear o que cada função precisa saber fazer diferente (diretoria, fiscal, TI, compras, vendas, operação). 2) Montar conteúdo específico por trilha (não um treinamento genérico único). 3) Definir formato e carga horária por trilha. 4) Aplicar a primeira rodada e avaliar aprendizado. 5) Ajustar o conteúdo com base no resultado da avaliação.',
    evidence: 'Matriz de treinamento por função com avaliação de aprendizado aplicada na primeira rodada.' },
  { id: 'D7-04', title: 'Criar plano formal de gestão da mudança',
    checklist: '1) Mapear os stakeholders mais impactados e o tipo de resistência esperada de cada um. 2) Definir a estratégia de engajamento por grupo (não só comunicação, também escuta). 3) Montar o cronograma de ações de change management alinhado ao roadmap do programa. 4) Executar as primeiras ações e monitorar sinais de resistência. 5) Ajustar o plano com base no que está funcionando ou não.',
    evidence: 'Plano de change management com mapa de stakeholders, resistências identificadas e ações já executadas.' },
  { id: 'D7-05', title: 'Capacitar e revisar políticas comerciais',
    checklist: '1) Identificar os conceitos que o time comercial precisa entender (preço por fora, crédito do cliente, margem líquida). 2) Revisar a política de desconto/negociação para refletir os novos limites de margem. 3) Treinar o time comercial nos novos conceitos e limites. 4) Testar com casos reais de negociação. 5) Monitorar se as negociações estão respeitando os novos limites.',
    evidence: 'Treinamento comercial aplicado e política de negociação revisada e comunicada ao time.' },
  { id: 'D7-06', title: 'Revisar critérios e treinamento de compras',
    checklist: '1) Revisar os critérios de decisão de compra para incluir custo líquido (não só preço de tabela). 2) Criar uma calculadora/checklist simples pro comprador aplicar o critério novo. 3) Treinar o time de compras no novo critério. 4) Testar com decisões de compra recentes/futuras. 5) Monitorar se o critério está sendo aplicado na prática.',
    evidence: 'Política de compras revisada com critério de custo líquido e evidência de treinamento aplicado.' },
  { id: 'D7-07', title: 'Atualizar procedimentos operacionais (POPs)',
    checklist: '1) Listar os POPs dos processos críticos afetados pela reforma. 2) Revisar cada um confrontando com as novas regras e controles. 3) Atualizar o conteúdo e formato de aprovação. 4) Publicar e comunicar formalmente a atualização. 5) Verificar, por amostragem, se o time está seguindo a versão atualizada.',
    evidence: 'POPs atualizados, aprovados e com evidência de comunicação à equipe.' },
  { id: 'D7-08', title: 'Criar e testar contingência operacional',
    checklist: '1) Identificar os pontos de falha mais prováveis (ERP fora do ar, portal oficial instável, DF-e rejeitado em massa, falha de integração, falha de fornecedor). 2) Desenhar o procedimento manual de contingência para cada um. 3) Definir quem aciona e como a operação continua durante a falha. 4) Testar pelo menos um cenário de contingência simulado. 5) Ajustar o procedimento com base no teste.',
    evidence: 'Plano de contingência operacional testado, com procedimento manual documentado.' },
  { id: 'D7-09', title: 'Revisar metas e incentivos conflitantes',
    checklist: '1) Levantar as metas e incentivos vigentes de vendas, compras e operação. 2) Verificar se alguma meta incentiva comportamento que destrói margem, crédito ou compliance sob a nova regra. 3) Priorizar as metas de maior risco de conflito. 4) Propor ajuste às metas/incentivos identificados. 5) Validar e comunicar o ajuste às áreas.',
    evidence: 'Revisão de metas/incentivos com conflitos identificados e ajuste proposto/aprovado.' },
  { id: 'D7-10', title: 'Implantar ritos interfuncionais',
    checklist: '1) Identificar as áreas com mais dependência cruzada (ex.: fiscal e TI, comercial e financeiro). 2) Definir um rito curto e recorrente entre elas (ex.: 30 min semanais). 3) Definir pauta fixa focada em exceções, decisões pendentes e dependências. 4) Rodar por algumas semanas e ajustar a cadência. 5) Manter indicador simples de dependências resolvidas no prazo.',
    evidence: 'Calendário de ritos interfuncionais com atas e indicadores de dependência tratados.' },
  { id: 'D7-11', title: 'Aplicar testes de prontidão e reciclagem',
    checklist: '1) Definir os cenários críticos que um usuário-chave precisa saber executar sozinho. 2) Montar um teste prático (não teórico) desses cenários. 3) Aplicar o teste com os usuários-chave. 4) Identificar quem não passou e o gap específico. 5) Aplicar reciclagem focada nesse gap e retestar.',
    evidence: 'Resultado de teste de prontidão prático, com plano de reciclagem para quem não passou.' },
  { id: 'D7-12', title: 'Criar ciclo de melhoria contínua',
    checklist: '1) Criar um registro simples (planilha ou sistema) para lições aprendidas. 2) Definir o que entra: incidentes, falhas de teste, dúvidas recorrentes. 3) Revisar o registro periodicamente no comitê do programa. 4) Transformar cada lição relevante numa ação de melhoria (processo, conteúdo ou sistema). 5) Fechar o loop verificando se a ação foi implementada.',
    evidence: 'Registro de lições aprendidas com ação de melhoria associada a cada item relevante.' },

  // ── 8. Sistemas e TI ──
  { id: 'D8-01', title: 'Formalizar plano de adequação do ERP',
    checklist: '1) Solicitar formalmente ao fornecedor o roadmap de versões/releases relacionados à reforma. 2) Cruzar as datas do fornecedor com os marcos legais oficiais. 3) Identificar gaps de prazo (fornecedor atrasado vs. marco legal). 4) Formalizar um plano de adequação interno com esse cronograma. 5) Acompanhar o cumprimento em reunião periódica com o fornecedor.',
    evidence: 'Roadmap do fornecedor formalizado, com datas comparadas aos marcos legais e plano de adequação interno.' },
  { id: 'D8-02', title: 'Revisar ambientes e governança de transportes',
    checklist: '1) Verificar se existem ambientes de desenvolvimento, homologação e produção realmente separados. 2) Verificar se o ambiente de homologação está sincronizado/atualizado em relação à produção. 3) Definir calendário de sincronização. 4) Definir o processo de transporte controlado (quem aprova, o que é testado antes). 5) Testar o processo com uma mudança real.',
    evidence: 'Arquitetura de ambientes documentada com calendário de sincronização e processo de transporte testado.' },
  { id: 'D8-03', title: 'Executar bateria de testes de DF-e',
    checklist: '1) Levantar os campos e regras de validação obrigatórios (IBS/CBS) nas notas técnicas oficiais. 2) Priorizar os cenários de emissão de maior volume para teste. 3) Rodar a bateria de testes em homologação. 4) Registrar e corrigir falhas encontradas. 5) Reter em homologação até a bateria passar integralmente antes de ir a produção.',
    evidence: 'Evidências de teste (XMLs) cobrindo os principais cenários de emissão, sem falhas pendentes.' },
  { id: 'D8-04', title: 'Implantar governança de dados mestres',
    checklist: '1) Priorizar os domínios de dado mestre mais usados (produtos, parceiros). 2) Medir a qualidade atual (amostra de erros/inconsistências). 3) Definir um owner por domínio. 4) Implantar rotina de saneamento contínuo (não só uma correção pontual). 5) Monitorar a qualidade periodicamente com um indicador simples.',
    evidence: 'Relatório de qualidade de dados mestres com owner definido por domínio e rotina de saneamento em curso.' },
  { id: 'D8-05', title: 'Estruturar motor tributário auditável',
    checklist: '1) Avaliar se as regras tributárias estão centralizadas num único motor ou espalhadas em vários sistemas. 2) Se espalhadas, priorizar a centralização das regras de maior volume/risco. 3) Garantir que toda regra seja versionada (histórico de mudanças). 4) Garantir que o motor seja testável (dá pra simular um caso e ver o resultado). 5) Documentar a arquitetura para consulta futura.',
    evidence: 'Arquitetura do motor tributário documentada, com log de versões de regra.' },
  { id: 'D8-06', title: 'Mapear e testar integrações ponta a ponta',
    checklist: '1) Listar todas as integrações entre ERP, tax engine, DF-e, financeiro, contábil e portais oficiais. 2) Para cada uma, definir o SLA esperado (tempo de resposta, disponibilidade). 3) Testar cada integração ponta a ponta com um caso real. 4) Registrar falhas e corrigir antes de considerar pronta. 5) Manter o mapa de integrações atualizado conforme o cenário evoluir.',
    evidence: 'Mapa de integrações com SLA definido e evidência de teste ponta a ponta de cada uma.' },
  { id: 'D8-07', title: 'Implantar governança de APIs e portais',
    checklist: '1) Inventariar certificados digitais, credenciais de API e robôs usados nos portais oficiais. 2) Registrar a data de expiração de cada certificado/credencial. 3) Configurar alerta automático antes do vencimento. 4) Definir responsável por cada credencial. 5) Testar a renovação de pelo menos um certificado para validar o processo.',
    evidence: 'Inventário de acessos/certificados com data de expiração, alerta configurado e responsável definido.' },
  { id: 'D8-08', title: 'Revisar RBAC e segregação de acesso ao motor tributário',
    checklist: '1) Levantar os perfis de acesso ao motor tributário e ao ERP hoje existentes. 2) Verificar se quem configura regra também aprova documento (conflito de segregação). 3) Redesenhar os perfis para segregar configuração e aprovação. 4) Aplicar a mudança e testar com um caso real. 5) Definir rotina de revisão periódica de acessos.',
    evidence: 'Matriz de acessos revisada com evidência de segregação entre configuração e aprovação.' },
  { id: 'D8-09', title: 'Criar suíte completa de testes (incluindo cenários negativos)',
    checklist: '1) Montar a matriz de testes cobrindo unitário, integrado, regressão e volume. 2) Incluir explicitamente cenários negativos (dado inválido, exceção, volume alto). 3) Rodar a suíte em homologação. 4) Registrar e corrigir defeitos encontrados. 5) Definir critério de saída (o que precisa passar antes de ir a produção).',
    evidence: 'Matriz de testes com resultados, incluindo cenários negativos e de volume, defeitos corrigidos.' },
  { id: 'D8-10', title: 'Implantar observabilidade tributária',
    checklist: '1) Definir as falhas/exceções mais críticas a monitorar (rejeição de documento, erro de integração, alteração indevida). 2) Montar um dashboard básico com esses indicadores. 3) Configurar alertas para os casos mais graves. 4) Definir quem trata cada alerta e o SLA. 5) Rodar por um período e ajustar o que gerar ruído.',
    evidence: 'Dashboard de observabilidade com alertas configurados e tickets tratados no primeiro ciclo.' },
  { id: 'D8-11', title: 'Testar backup e recuperação',
    checklist: '1) Confirmar que dados, regras, certificados e configurações críticas têm backup regular. 2) Selecionar um item crítico para teste de restauração. 3) Executar o teste de restauração completo. 4) Documentar o tempo e o resultado do teste. 5) Corrigir o processo de backup se a restauração falhar ou demorar demais.',
    evidence: 'Evidência de teste de restauração de backup, com data, item testado e resultado documentado.' },
  { id: 'D8-12', title: 'Revalidar capacidade e SLA dos fornecedores críticos',
    checklist: '1) Listar ERP, tax engine, integradores e suporte crítico. 2) Para cada um, revisar o SLA de atendimento contratado. 3) Estimar o pico de demanda esperado (ex.: perto de um marco legal). 4) Confirmar com o fornecedor que ele suporta esse pico. 5) Formalizar plano de escalonamento caso o SLA não seja cumprido.',
    evidence: 'SLA revalidado por fornecedor crítico, com plano de escalonamento formalizado.' },
];

function buildActionDescription(row: Row): string {
  return row.checklist;
}

async function main() {
  let updatedQuestions = 0;
  let updatedActions = 0;
  let missing: string[] = [];

  for (const row of ROWS) {
    const questionId = `rt_${row.id}`;

    const q = await prisma.falQuestion.findUnique({ where: { questionId } });
    if (!q) { missing.push(questionId); continue; }

    await prisma.falQuestion.update({
      where: { questionId },
      data: {
        guidance: row.checklist,
        evidenceHint: row.evidence,
      },
    });
    updatedQuestions++;

    const updated = await prisma.falQuestionActionLibrary.updateMany({
      where: { questionId },
      data: {
        actionTitle: row.title,
        actionDescription: buildActionDescription(row),
        howToExecute: row.checklist,
        expectedEvidence: row.evidence,
      },
    });
    updatedActions += updated.count;
  }

  console.log(`${updatedQuestions} FalQuestion atualizadas, ${updatedActions} FalQuestionActionLibrary atualizadas.`);
  if (missing.length) console.log(`Não encontradas (verificar): ${missing.join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
