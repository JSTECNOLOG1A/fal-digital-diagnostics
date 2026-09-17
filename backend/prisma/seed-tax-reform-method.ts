/**
 * Seed one-off: cria o MethodVersion "reforma_tributaria_8d" e as 96
 * FalQuestion do Diagnóstico FAL da Reforma Tributária (planilha
 * Diagnostico_FAL_Reforma_Tributaria_v0_9.xlsx, fornecida pelo usuário).
 *
 * Reaproveita as MESMAS 8 dimension_key do FAL 8D clássico (governanca,
 * juridico, controles_internos, financeiro, contabil, tributario,
 * operacional, sistemas) — elas correspondem 1:1 às 8 dimensões da
 * planilha, o que reaproveita de graça labels/ícones/radar/agregação já
 * existentes. O que isola este banco de perguntas do FAL 8D é o
 * `methodVersionId` (FalQuestion.methodVersionId), não a dimension_key —
 * ver fal_question_method_version_id migration e assessment.service.ts::
 * buildQuestionSet().
 *
 * Conteúdo de cada pergunta: a planilha original trazia uma "Ação
 * recomendada" própria por pergunta (boa, não genérica) mas a coluna "Por
 * que importa" era o MESMO texto idêntico nas 96 linhas — um placeholder
 * não preenchido. Reescrito aqui: `guidance` combina o motivo específico da
 * pergunta com um primeiro passo concreto (não a frase genérica da
 * planilha), e `evidenceHint` é a evidência mínima e específica esperada —
 * seguindo a mesma régua de qualidade que a própria planilha define na aba
 * "Manual": "Ação genérica não deve ser aceita."
 *
 * Pesos/criticidade extraídos da planilha (coluna "Peso da pergunta":
 * 1=Média, 2=Alta, 3=Crítica — correlação 1:1 confirmada linha a linha).
 * `defaultOwner` por dimensão vem da aba "Configuração" e é usado por
 * action-plan.service.ts::generate() para preencher suggested_owner_area
 * nas recomendações operacionais.
 *
 * Aditivo por design (idempotente por `questionId`, nunca deleta) — mesmo
 * padrão de seed-fal-mqe-questions.ts.
 *
 * Rodar com: npx tsx prisma/seed-tax-reform-method.ts
 */
import { PrismaClient } from '@prisma/client';

// method_versions e fal_questions: method_versions tem RLS forçada (tenant-
// scoped), fal_questions é global — usar a role owner (bypassa RLS) evita
// qualquer ambiguidade de app.tenant_id, mesmo padrão dos outros seeds.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

const METHOD_CODE = 'reforma_tributaria_8d';
const METHOD_VERSION = 'v0.9';

const DIMENSIONS = [
  { key: 'governanca', label: 'Governança e estratégia', weight: 0.13, defaultOwner: 'Diretoria / PMO' },
  { key: 'juridico', label: 'Jurídico e societário', weight: 0.11, defaultOwner: 'Jurídico / Societário' },
  { key: 'controles_internos', label: 'Controles internos', weight: 0.14, defaultOwner: 'Controladoria / Controles internos' },
  { key: 'financeiro', label: 'Financeiro', weight: 0.13, defaultOwner: 'Financeiro / Tesouraria / Pricing' },
  { key: 'contabil', label: 'Contábil', weight: 0.1, defaultOwner: 'Contabilidade / Controladoria' },
  { key: 'tributario', label: 'Tributário', weight: 0.17, defaultOwner: 'Fiscal / Tributário' },
  { key: 'operacional', label: 'Operacional e cultura', weight: 0.1, defaultOwner: 'Operações / RH / Gestão da mudança' },
  { key: 'sistemas', label: 'Sistemas e TI', weight: 0.12, defaultOwner: 'TI / ERP / Tax technology' },
];

type Q = {
  id: string; dim: string; sub: string; stage: string; weight: 1 | 2 | 3;
  text: string; guidance: string; evidenceHint: string;
};

// Cada `guidance` = motivo específico da pergunta (não genérico) + primeiro
// passo concreto. Cada `evidenceHint` = evidência mínima e auditável.
const QUESTIONS: Q[] = [
  // ── 1. Governança e estratégia ──
  { id: 'D1-01', dim: 'governanca', sub: 'Patrocínio executivo', stage: 'governance', weight: 2,
    text: 'Existe patrocinador executivo formal, com autoridade para decidir prioridades, orçamento e conflitos da transição?',
    guidance: 'Sem um sponsor com poder de decisão, conflitos entre áreas (fiscal x comercial x TI) travam a transição por falta de alguém que corte o nó. Primeiro passo: levar ao board a nomeação formal, com escopo de decisão explícito (orçamento, prioridade, escalonamento).',
    evidenceHint: 'Ata ou termo de nomeação do sponsor, com escopo de decisão descrito.' },
  { id: 'D1-02', dim: 'governanca', sub: 'Programa formal', stage: 'governance', weight: 2,
    text: 'A Reforma Tributária está estruturada como programa empresarial, e não apenas como projeto fiscal ou de ERP?',
    guidance: 'Tratar como "projeto de TI" faz a empresa perder o impacto em preço, contrato, caixa e cultura — que não são decisões de TI. Primeiro passo: redigir um termo de abertura de programa que liste todas as frentes afetadas, não só a fiscal.',
    evidenceHint: 'Termo de abertura do programa com escopo multi-frente e roadmap aprovado.' },
  { id: 'D1-03', dim: 'governanca', sub: 'Comitê multidisciplinar', stage: 'governance', weight: 2,
    text: 'Existe comitê recorrente com Fiscal, Contábil, Financeiro, Jurídico, TI, Comercial, Compras e Operações?',
    guidance: 'Decisões tomadas só pelo fiscal (ex.: regra de crédito) frequentemente quebram o comercial (preço) ou o financeiro (caixa) por falta de visão cruzada. Primeiro passo: definir calendário fixo, pauta padrão e lista de decisões que passam pelo comitê antes de valer.',
    evidenceHint: 'Calendário recorrente do comitê com atas e decisões registradas.' },
  { id: 'D1-04', dim: 'governanca', sub: 'Orçamento e capacidade', stage: 'resource', weight: 2,
    text: 'Há orçamento, horas internas e capacidade de fornecedores reservados para a transição?',
    guidance: 'Sem orçamento e capacidade reservados, a transição compete por recursos com a operação do dia a dia e sempre perde. Primeiro passo: dimensionar horas por workstream e formalizar o budget junto à diretoria.',
    evidenceHint: 'Budget aprovado, capacity plan por workstream e contratos de fornecedores.' },
  { id: 'D1-05', dim: 'governanca', sub: 'Roadmap 2026–2033', stage: 'planning', weight: 2,
    text: 'A empresa possui roadmap por marcos legais, tecnológicos, comerciais e financeiros até 2033?',
    guidance: 'A reforma tem marcos legais escalonados até 2033 — sem um roadmap único, cada área monta seu próprio cronograma e as dependências entre eles (ex.: ERP pronto antes do teste fiscal) ficam invisíveis. Primeiro passo: montar o roadmap com marcos legais como coluna-mestra e as demais frentes amarradas a eles.',
    evidenceHint: 'Roadmap com marcos, responsáveis e dependências entre frentes.' },
  { id: 'D1-06', dim: 'governanca', sub: 'Matriz decisória', stage: 'governance', weight: 2,
    text: 'As decisões críticas possuem responsável, aprovador, prazo e critério de escalonamento?',
    guidance: 'Sem uma matriz de alçadas clara, decisões urgentes (ex.: como tratar uma NCM controversa) ficam paradas esperando "alguém decidir". Primeiro passo: montar uma matriz RACI cobrindo as decisões mais recorrentes do programa.',
    evidenceHint: 'Matriz RACI e um log de decisões já tomadas com data e responsável.' },
  { id: 'D1-07', dim: 'governanca', sub: 'Monitoramento normativo', stage: 'monitor', weight: 2,
    text: 'Existe rotina formal para monitorar leis, atos, notas técnicas, leiautes e orientações oficiais?',
    guidance: 'As regras da reforma ainda estão sendo publicadas em ondas — sem monitoramento formal, mudanças de leiaute ou de alíquota chegam pela imprensa em vez de por um canal controlado. Primeiro passo: definir as fontes oficiais a monitorar e quem lê cada uma.',
    evidenceHint: 'Calendário de monitoramento com fontes, responsáveis e registro de alertas tratados.' },
  { id: 'D1-08', dim: 'governanca', sub: 'Gestão de riscos', stage: 'risk', weight: 3,
    text: 'Os riscos da transição são registrados, avaliados, atribuídos e acompanhados pela administração?',
    guidance: 'Riscos não registrados formalmente (ex.: dependência de um único fornecedor de tax engine) só aparecem quando já viraram incidente. Primeiro passo: abrir um risk register único do programa, com dono e plano de resposta por risco.',
    evidenceHint: 'Risk register vivo, com planos de resposta e evidência de acompanhamento em comitê.' },
  { id: 'D1-09', dim: 'governanca', sub: 'KPIs de prontidão', stage: 'monitor', weight: 2,
    text: 'A diretoria acompanha indicadores de prontidão, cadastros, testes, contratos, caixa e treinamento?',
    guidance: 'Sem um painel único, a diretoria só descobre atraso em uma frente quando o prazo já estourou. Primeiro passo: definir 5-8 indicadores de prontidão (ex.: % de cadastros saneados, % de contratos revisados) com meta e dono.',
    evidenceHint: 'Painel executivo com metas por frente e periodicidade de atualização definida.' },
  { id: 'D1-10', dim: 'governanca', sub: 'Comunicação interna', stage: 'change', weight: 2,
    text: 'Existe plano de comunicação que explique impactos, decisões e responsabilidades por público?',
    guidance: 'Sem comunicação segmentada, times operacionais recebem informação incompleta ou tardia e reagem com resistência por não entenderem o "porquê". Primeiro passo: mapear os públicos internos e as mensagens específicas que cada um precisa.',
    evidenceHint: 'Plano de comunicação com cronograma, públicos e materiais já distribuídos.' },
  { id: 'D1-11', dim: 'governanca', sub: 'Governança de terceiros', stage: 'vendor', weight: 2,
    text: 'Fornecedores de ERP, tax engine, documentos fiscais e consultoria têm escopo, SLA e entregáveis definidos?',
    guidance: 'Sem escopo e SLA formalizados, atraso de um fornecedor crítico (ex.: tax engine) não tem consequência contratual nem plano de contingência. Primeiro passo: revisar os contratos vigentes e formalizar SLA e matriz de responsabilidade para os fornecedores críticos.',
    evidenceHint: 'Contratos com SLA explícito e matriz de responsabilidades por fornecedor crítico.' },
  { id: 'D1-12', dim: 'governanca', sub: 'Aprovação de cenários', stage: 'decision', weight: 2,
    text: 'Os cenários de preço, crédito, caixa e contratos são formalmente aprovados antes da implantação?',
    guidance: 'Cenários implantados sem aprovação formal (ex.: nova política de repasse de preço) geram exposição jurídica e financeira sem que a diretoria tenha decidido conscientemente assumir o risco. Primeiro passo: instituir um gate obrigatório de aprovação executiva antes de qualquer cenário ir para produção.',
    evidenceHint: 'Memória de cálculo do cenário com ata de aprovação executiva anexada.' },

  // ── 2. Jurídico e societário ──
  { id: 'D2-01', dim: 'juridico', sub: 'Inventário contratual', stage: 'contract', weight: 3,
    text: 'Existe inventário completo dos contratos afetados por tributos, preço, crédito, prazo ou local da operação?',
    guidance: 'Sem inventário, contratos de longo prazo com cláusula de preço fechado viram passivo silencioso quando a carga tributária mudar. Primeiro passo: levantar os contratos vigentes e classificá-los por materialidade e exposição à reforma.',
    evidenceHint: 'Base de contratos classificada por materialidade, com responsável por revisão.' },
  { id: 'D2-02', dim: 'juridico', sub: 'Cláusulas de alteração tributária', stage: 'contract', weight: 3,
    text: 'Os contratos definem tratamento para criação, extinção ou alteração de tributos?',
    guidance: 'Contrato sem cláusula de variação tributária trava o repasse de custo novo ao cliente — a empresa absorve a diferença sozinha. Primeiro passo: revisar a minuta padrão e os contratos críticos para incluir/ajustar essa cláusula.',
    evidenceHint: 'Cláusula-modelo aprovada e parecer de aderência para os contratos críticos.' },
  { id: 'D2-03', dim: 'juridico', sub: 'Repasse e preço por fora', stage: 'contract', weight: 3,
    text: 'Os contratos permitem destacar tributos por fora e recompor preço líquido e margem?',
    guidance: 'Sem previsão contratual de destaque "por fora", o novo modelo de tributo (visível ao comprador) pode ser lido como aumento de preço unilateral pelo cliente. Primeiro passo: inserir cláusula de destaque e mecanismo de recomposição nos contratos e propostas comerciais.',
    evidenceHint: 'Cláusula de destaque/repasse revisada em contratos e propostas comerciais vigentes.' },
  { id: 'D2-04', dim: 'juridico', sub: 'Reequilíbrio econômico', stage: 'contract', weight: 3,
    text: 'Há mecanismo de reequilíbrio para contratos de longo prazo, públicos ou privados?',
    guidance: 'Contratos de longo prazo sem gatilho de reequilíbrio deixam a empresa sem instrumento formal para pleitear ajuste quando o novo sistema tributário alterar a equação econômica original. Primeiro passo: mapear os contratos de longo prazo e desenhar o protocolo de pleito (evento, prazo, evidência).',
    evidenceHint: 'Matriz de eventos de reequilíbrio e um procedimento de pleito formalizado.' },
  { id: 'D2-05', dim: 'juridico', sub: 'Contratos intercompany', stage: 'societary', weight: 2,
    text: 'Operações entre partes relacionadas estão mapeadas e documentadas sob a nova lógica tributária?',
    guidance: 'Operações intercompany sem contrato/preço formalizado sob a nova lógica geram risco de questionamento sobre a origem e legitimidade do crédito entre as empresas do grupo. Primeiro passo: mapear os fluxos intercompany existentes e revisar os contratos/preços à luz do IBS/CBS.',
    evidenceHint: 'Contratos intercompany atualizados com preços e fluxos documentados.' },
  { id: 'D2-06', dim: 'juridico', sub: 'Estrutura societária', stage: 'societary', weight: 2,
    text: 'A estrutura de empresas, filiais e unidades foi avaliada quanto a cadastro, destino, crédito e governança?',
    guidance: 'A lógica de destino (onde o tributo é devido) muda o racional de onde vale a pena manter ou consolidar filiais/CNPJs. Primeiro passo: mapear a estrutura societária atual e simular o efeito da regra de destino em cada unidade.',
    evidenceHint: 'Organograma societário com CNPJs, inscrições e parecer sobre destino/crédito.' },
  { id: 'D2-07', dim: 'juridico', sub: 'Procurações e acessos', stage: 'digital', weight: 2,
    text: 'Procurações, perfis e acessos aos portais tributários estão atualizados e segregados?',
    guidance: 'Procuração desatualizada ou acesso concentrado numa única pessoa é um ponto único de falha operacional e um risco de segregação de função. Primeiro passo: levantar todas as procurações e acessos ativos e revisar quem realmente deveria ter cada um.',
    evidenceHint: 'Matriz de procurações e acessos vigentes, com data da última revisão.' },
  { id: 'D2-08', dim: 'juridico', sub: 'Contencioso e contingências', stage: 'legal', weight: 2,
    text: 'Contingências do sistema atual foram inventariadas para evitar migração de riscos e decisões incoerentes?',
    guidance: 'Sem esse inventário, a empresa corre o risco de adotar, no novo sistema, uma posição que contradiz a tese defendida num processo do sistema antigo. Primeiro passo: levantar o mapa de processos/teses ativos e confrontar com as decisões que estão sendo tomadas para a transição.',
    evidenceHint: 'Mapa de contencioso ativo com provisões e teses, cruzado com as decisões de transição.' },
  { id: 'D2-09', dim: 'juridico', sub: 'Proteção de dados', stage: 'legal', weight: 2,
    text: 'Integrações, plataformas e compartilhamentos de dados tributários foram avaliados sob LGPD e segurança?',
    guidance: 'Novas integrações com tax engine e portais oficiais frequentemente trafegam dado sensível (fiscal, financeiro, de terceiros) sem uma avaliação formal de base legal e segurança. Primeiro passo: mapear os novos fluxos de dados criados pela transição e avaliar sob LGPD.',
    evidenceHint: 'Avaliação de impacto (DPIA) ou parecer cobrindo os novos fluxos de dados da transição.' },
  { id: 'D2-10', dim: 'juridico', sub: 'Renegociação com clientes', stage: 'contract', weight: 3,
    text: 'Clientes críticos foram segmentados para renegociação de preço, prazo, crédito e documentação?',
    guidance: 'Renegociar tudo de última hora, sem segmentação, gera desgaste comercial desnecessário com os clientes mais importantes. Primeiro passo: segmentar a carteira por materialidade e definir a estratégia de negociação por segmento antes de abordar o cliente.',
    evidenceHint: 'Matriz de clientes críticos com estratégia de negociação por segmento.' },
  { id: 'D2-11', dim: 'juridico', sub: 'Renegociação com fornecedores', stage: 'contract', weight: 3,
    text: 'Fornecedores críticos foram segmentados por regime, crédito gerado, preço e risco documental?',
    guidance: 'Fornecedor em regime que não gera o crédito esperado pode virar o elo mais caro da cadeia sem que ninguém tenha percebido a tempo. Primeiro passo: segmentar fornecedores críticos por regime tributário e crédito gerado, simulando o custo líquido real de cada um.',
    evidenceHint: 'Matriz de fornecedores críticos com regime, crédito simulado e plano de renegociação.' },
  { id: 'D2-12', dim: 'juridico', sub: 'Pareceres e decisões', stage: 'legal', weight: 2,
    text: 'Interpretações relevantes possuem fundamento, responsável, aprovação e registro de vigência?',
    guidance: 'Interpretações tomadas informalmente (ex.: "decidimos tratar assim") sem parecer registrado não sobrevivem a uma fiscalização nem a uma troca de equipe. Primeiro passo: criar um repositório único de decisões jurídicas com fundamento e data de vigência.',
    evidenceHint: 'Repositório de pareceres/decisões versionado, com fundamento e vigência registrados.' },

  // ── 3. Controles internos ──
  { id: 'D3-01', dim: 'controles_internos', sub: 'Pedido ao faturamento', stage: 'process', weight: 3,
    text: 'O fluxo pedido–faturamento possui controles para cliente, local, operação, preço, documento e classificação tributária?',
    guidance: 'Um erro de classificação no início do fluxo (ex.: local da operação errado) se propaga para o documento fiscal, o crédito do cliente e a apuração — e só é achado semanas depois. Primeiro passo: mapear o fluxo atual e identificar onde faltam pontos de controle.',
    evidenceHint: 'Fluxograma do order-to-cash com matriz de controles e amostras testadas.' },
  { id: 'D3-02', dim: 'controles_internos', sub: 'Requisição ao pagamento', stage: 'process', weight: 3,
    text: 'O fluxo compra–pagamento valida fornecedor, regime, classificação, documento, crédito e pagamento?',
    guidance: 'Comprar de um fornecedor sem validar o regime tributário dele pode gerar um crédito menor do que o esperado no preço negociado — descoberto só na apuração. Primeiro passo: revisar o fluxo procure-to-pay e inserir validação de regime/crédito antes da aprovação da compra.',
    evidenceHint: 'Fluxograma do procure-to-pay com pontos de aprovação e amostras testadas.' },
  { id: 'D3-03', dim: 'controles_internos', sub: 'Estoques e movimentações', stage: 'inventory', weight: 2,
    text: 'Entradas, transferências, devoluções, perdas e industrialização estão mapeadas e conciliadas?',
    guidance: 'Movimentações de estoque não conciliadas (perda, transferência entre filiais) são a origem mais comum de descasamento entre o físico e o crédito escriturado. Primeiro passo: mapear os tipos de movimentação e implantar conciliação periódica.',
    evidenceHint: 'Procedimento de conciliação de estoque com relatório periódico assinado.' },
  { id: 'D3-04', dim: 'controles_internos', sub: 'Alteração de dados mestres', stage: 'master_data', weight: 3,
    text: 'Mudanças de NCM, NBS, CST, cClassTrib, clientes e fornecedores seguem workflow de aprovação?',
    guidance: 'Um cadastro alterado sem aprovação (ex.: NCM trocado por engano) muda a tributação de todas as operações seguintes daquele item, sem ninguém perceber até a apuração. Primeiro passo: implantar workflow de aprovação para qualquer alteração em cadastro fiscal.',
    evidenceHint: 'Workflow de aprovação de cadastro com log de quem alterou o quê e quando.' },
  { id: 'D3-05', dim: 'controles_internos', sub: 'Segregação de funções', stage: 'sod', weight: 3,
    text: 'Cadastro, parametrização, emissão, ajuste e aprovação estão segregados?',
    guidance: 'A mesma pessoa poder cadastrar a regra E aprovar o documento que a usa é a porta mais comum para erro (ou fraude) passar despercebido. Primeiro passo: mapear quem tem acesso a cada etapa hoje e identificar conflitos de segregação.',
    evidenceHint: 'Matriz de segregação de funções (SoD) com teste de acesso por perfil.' },
  { id: 'D3-06', dim: 'controles_internos', sub: 'Mudanças tributárias', stage: 'change', weight: 2,
    text: 'Alterações de regras e parâmetros passam por solicitação, teste, aprovação e transporte controlado?',
    guidance: 'Alterar uma regra de tributação direto em produção, sem teste prévio, pode gerar documento fiscal incorreto em escala antes que alguém perceba. Primeiro passo: formalizar o processo de change request para regras tributárias, com teste obrigatório em homologação.',
    evidenceHint: 'Change request com evidência de teste em homologação antes do transporte.' },
  { id: 'D3-07', dim: 'controles_internos', sub: 'Ajustes manuais', stage: 'manual', weight: 2,
    text: 'Ajustes manuais de débito, crédito, documento ou apuração são limitados, aprovados e rastreáveis?',
    guidance: 'Ajuste manual sem aprovação e sem rastro é o ponto mais difícil de defender numa fiscalização, porque não há como reconstituir o racional depois. Primeiro passo: definir política de ajuste manual (quem pode, com qual aprovação, com qual evidência).',
    evidenceHint: 'Política de ajustes manuais com log de aprovação e amostras auditadas.' },
  { id: 'D3-08', dim: 'controles_internos', sub: 'Evidência de créditos', stage: 'credit', weight: 3,
    text: 'Créditos possuem documento, regra, período, condição, vínculo contábil e status de realização?',
    guidance: 'Crédito reconhecido sem dossiê completo (documento + regra + vínculo contábil) não resiste a uma auditoria e pode precisar ser estornado depois de já ter sido usado no caixa. Primeiro passo: definir o pacote mínimo de evidência exigido para cada crédito relevante.',
    evidenceHint: 'Dossiê eletrônico de créditos com conciliação contábil por item.' },
  { id: 'D3-09', dim: 'controles_internos', sub: 'Devoluções e cancelamentos', stage: 'returns', weight: 2,
    text: 'Devoluções, cancelamentos, descontos e ajustes têm tratamento padronizado e conciliado?',
    guidance: 'Evento pós-emissão tratado de forma ad-hoc (cada analista faz de um jeito) gera inconsistência entre o documento fiscal e o financeiro/contábil. Primeiro passo: padronizar o procedimento para cada tipo de evento pós-emissão.',
    evidenceHint: 'Procedimento padronizado por tipo de evento, com conciliação periódica.' },
  { id: 'D3-10', dim: 'controles_internos', sub: 'Monitoramento de exceções', stage: 'monitor', weight: 2,
    text: 'Exceções de cadastro, documento, alíquota, crédito e pagamento geram alertas e tratativa?',
    guidance: 'Sem um painel de exceções, o time só descobre um problema recorrente quando o volume acumulado já é grande. Primeiro passo: definir as exceções mais críticas a monitorar e montar um painel com SLA de tratativa.',
    evidenceHint: 'Painel de exceções com tickets abertos, SLA e taxa de resolução.' },
  { id: 'D3-11', dim: 'controles_internos', sub: 'Aprovações e logs', stage: 'control', weight: 2,
    text: 'Controles críticos preservam quem executou, quem aprovou, data, justificativa e evidência?',
    guidance: 'Controle sem log completo (quem fez, quem aprovou, por quê) não serve como evidência em uma auditoria ou fiscalização, mesmo que o controle em si funcione. Primeiro passo: revisar os controles críticos e garantir que todos gravem log completo.',
    evidenceHint: 'Amostra de logs de controles críticos com todos os campos preenchidos.' },
  { id: 'D3-12', dim: 'controles_internos', sub: 'Teste de efetividade', stage: 'audit', weight: 2,
    text: 'Os controles são testados periodicamente com amostras, falhas, plano corretivo e reteste?',
    guidance: 'Controle desenhado mas nunca testado pode estar quebrado há meses sem que ninguém saiba. Primeiro passo: montar um programa mínimo de testes periódicos para os controles mais críticos da transição.',
    evidenceHint: 'Papel de trabalho de teste com amostra, falha encontrada e reteste.' },

  // ── 4. Financeiro ──
  { id: 'D4-01', dim: 'financeiro', sub: 'Fluxo de caixa e split', stage: 'cash', weight: 3,
    text: 'O fluxo de caixa projeta segregação de tributos, split payment e diferença entre débito e crédito?',
    guidance: 'O split payment separa o tributo do valor recebido no ato do pagamento — sem projetar isso, o caixa disponível projetado fica maior do que o caixa real. Primeiro passo: incluir uma linha específica de split payment no modelo de fluxo de caixa.',
    evidenceHint: 'Fluxo de caixa projetado com linha de split payment e memória de cálculo.' },
  { id: 'D4-02', dim: 'financeiro', sub: 'Monetização de créditos', stage: 'credit', weight: 3,
    text: 'A empresa projeta prazo, probabilidade e custo de monetização de saldos credores?',
    guidance: 'Saldo credor que demora para virar caixa tem um custo financeiro real (funding, oportunidade) que raramente é medido explicitamente. Primeiro passo: montar um aging de créditos com cenários de prazo (30/60/90/180 dias) e custo de funding associado.',
    evidenceHint: 'Aging de créditos com cenários de prazo e custo de funding calculado.' },
  { id: 'D4-03', dim: 'financeiro', sub: 'Capital de giro', stage: 'cash', weight: 3,
    text: 'A necessidade de capital de giro foi recalculada por cenário, unidade e sazonalidade?',
    guidance: 'O ciclo financeiro muda com a nova sistemática de crédito/débito — usar o número de capital de giro do sistema antigo pode subestimar (ou superestimar) a necessidade real de caixa. Primeiro passo: recalcular o capital de giro por unidade, considerando os novos prazos de crédito.',
    evidenceHint: 'Modelo de capital de giro recalculado com sensibilidade por unidade/sazonalidade.' },
  { id: 'D4-04', dim: 'financeiro', sub: 'Formação de preço', stage: 'pricing', weight: 3,
    text: 'Preço líquido, tributo por fora, crédito do cliente, margem e elasticidade são simulados por família?',
    guidance: 'Manter a tabela de preço antiga sem resimular o efeito líquido (tributo por fora, crédito repassado) pode erodir margem silenciosamente família por família. Primeiro passo: simular o preço líquido e a margem por família de produto/serviço antes de aprovar a nova tabela.',
    evidenceHint: 'Modelo de repricing por família de produto/serviço com aprovação formal.' },
  { id: 'D4-05', dim: 'financeiro', sub: 'Margem por produto', stage: 'margin', weight: 3,
    text: 'A margem é medida após custo líquido, créditos, frete, prazo, split e despesas?',
    guidance: 'Margem calculada com a metodologia antiga (sem considerar crédito e split novos) pode mostrar lucro onde na verdade há perda de caixa. Primeiro passo: reconstruir a DRE gerencial por produto/serviço com a metodologia de custo líquido pós-reforma.',
    evidenceHint: 'DRE gerencial por produto/serviço recalculada com a nova metodologia de custo líquido.' },
  { id: 'D4-06', dim: 'financeiro', sub: 'Funding e linhas', stage: 'funding', weight: 2,
    text: 'Existem limites de crédito e linhas de contingência para absorver descasamentos da transição?',
    guidance: 'Descasamentos temporários de caixa (ex.: crédito represado nos primeiros meses) sem uma linha de contingência já aprovada viram um problema de liquidez em cima da hora. Primeiro passo: negociar previamente uma linha de contingência dimensionada para o pior cenário projetado.',
    evidenceHint: 'Linha de contingência aprovada com limite e condições, dimensionada ao cenário de descasamento.' },
  { id: 'D4-07', dim: 'financeiro', sub: 'Prazos de clientes e fornecedores', stage: 'working_capital', weight: 2,
    text: 'Prazos de recebimento, pagamento e recuperação tributária são analisados em conjunto?',
    guidance: 'Analisar prazo de cliente e prazo de recuperação de crédito separadamente esconde o efeito real no ciclo de caixa combinado. Primeiro passo: montar uma visão única de PMR, PMP e prazo de recuperação tributária lado a lado.',
    evidenceHint: 'Análise combinada de PMR/PMP/prazo de recuperação, com cenários simulados.' },
  { id: 'D4-08', dim: 'financeiro', sub: 'Pagamentos e retenções', stage: 'payment', weight: 2,
    text: 'Meios de pagamento e retenções tributárias estão mapeados por canal e contrato?',
    guidance: 'Cada meio de pagamento (cartão, boleto, PIX) pode ter uma regra diferente de retenção/split, e um mapeamento incompleto gera divergência entre o valor esperado e o valor efetivamente recebido. Primeiro passo: mapear a regra de retenção por meio de pagamento e adquirente.',
    evidenceHint: 'Mapa de meios de pagamento com regra de retenção por adquirente/contrato.' },
  { id: 'D4-09', dim: 'financeiro', sub: 'Tesouraria e conciliação', stage: 'treasury', weight: 2,
    text: 'Tesouraria concilia documento, recebimento, split, crédito e saldo tributário?',
    guidance: 'Sem conciliação tributário-financeira, uma diferença entre o valor documentado e o valor recebido só é percebida quando o caixa já não fecha. Primeiro passo: implantar rotina de conciliação entre documento fiscal, recebimento e saldo tributário.',
    evidenceHint: 'Relatório de conciliação tributário-financeira com periodicidade definida.' },
  { id: 'D4-10', dim: 'financeiro', sub: 'Capex e investimentos', stage: 'capex', weight: 1,
    text: 'Investimentos previstos consideram créditos, fluxo de caixa e transição de tributos atuais?',
    guidance: 'Um investimento aprovado com a regra de crédito antiga pode ter retorno diferente sob a nova sistemática. Primeiro passo: revisar os business cases de capex em andamento à luz do novo tratamento de crédito.',
    evidenceHint: 'Business case revisado com o efeito de crédito/caixa da nova sistemática.' },
  { id: 'D4-11', dim: 'financeiro', sub: 'Sensibilidade e estresse', stage: 'scenario', weight: 2,
    text: 'Existem cenários de alíquota, crédito, prazo, inadimplência, câmbio e volume?',
    guidance: 'Rodar um único cenário "base" esconde o quanto a empresa é sensível a uma mudança de alíquota ou de prazo de crédito. Primeiro passo: montar 2-3 cenários de estresse com as variáveis mais incertas da transição.',
    evidenceHint: 'Matriz de sensibilidade/stress test com pelo menos 2 cenários além do base.' },
  { id: 'D4-12', dim: 'financeiro', sub: 'Indicadores e covenants', stage: 'monitor', weight: 2,
    text: 'Indicadores financeiros e covenants foram avaliados sob os efeitos da transição?',
    guidance: 'Um covenant bancário calculado sobre indicadores que mudam de metodologia (ex.: margem, endividamento) pode ser rompido tecnicamente sem que a empresa tenha piorado de fato. Primeiro passo: revisar os covenants vigentes e simular o efeito da nova metodologia neles.',
    evidenceHint: 'Simulação de covenants sob a nova metodologia, com comunicação prévia ao financiador se necessário.' },

  // ── 5. Contábil ──
  { id: 'D5-01', dim: 'contabil', sub: 'Plano de contas', stage: 'accounting', weight: 2,
    text: 'O plano de contas distingue débitos, créditos, saldos, ressarcimentos e efeitos de transição?',
    guidance: 'Lançar tudo na mesma conta genérica de "tributos" impede rastrear separadamente crédito, débito e ressarcimento — cada um com regra e prazo diferentes. Primeiro passo: revisar o plano de contas e criar o de-para para as novas contas necessárias.',
    evidenceHint: 'Plano de contas atualizado com de-para documentado para os novos tributos.' },
  { id: 'D5-02', dim: 'contabil', sub: 'Políticas contábeis', stage: 'accounting', weight: 2,
    text: 'Políticas definem reconhecimento, mensuração, apresentação e baixa dos créditos tributários?',
    guidance: 'Sem política formal, cada contador pode reconhecer o crédito de um jeito diferente, quebrando a comparabilidade entre períodos e entre empresas do grupo. Primeiro passo: formalizar a política contábil dos tributos da reforma no manual contábil.',
    evidenceHint: 'Manual contábil atualizado e aprovado com a política dos novos tributos.' },
  { id: 'D5-03', dim: 'contabil', sub: 'Conciliação fiscal-contábil', stage: 'reconciliation', weight: 3,
    text: 'Documento, apuração, contas contábeis, contas a pagar/receber e caixa são conciliados?',
    guidance: 'Divergência entre o que foi apurado no fiscal e o que foi lançado no contábil, não conciliada, é o tipo de achado mais comum (e mais caro) numa auditoria. Primeiro passo: implantar conciliação fiscal-contábil-financeira periódica, não só no fechamento anual.',
    evidenceHint: 'Conciliação fiscal-contábil-financeira com papel de trabalho mensal.' },
  { id: 'D5-04', dim: 'contabil', sub: 'Aging de créditos', stage: 'credit', weight: 3,
    text: 'Créditos a recuperar são classificados por origem, idade, risco, restrição e realização?',
    guidance: 'Créditos antigos sem classificação de risco de realização podem estar contabilizados como ativo quando na prática já não são recuperáveis. Primeiro passo: montar o aging de créditos por origem e avaliar a recuperabilidade de cada faixa.',
    evidenceHint: 'Aging de créditos com dossiê de suporte e avaliação de recuperabilidade por faixa.' },
  { id: 'D5-05', dim: 'contabil', sub: 'Provisões e contingências', stage: 'provision', weight: 2,
    text: 'Riscos e incertezas de interpretação são avaliados para provisão ou divulgação?',
    guidance: 'Interpretações ainda incertas da nova legislação (comuns num período de transição) precisam de avaliação formal sobre se geram provisão ou apenas divulgação — decidir isso informalmente expõe a demonstração financeira. Primeiro passo: levar as interpretações mais incertas para avaliação formal com o jurídico/auditoria.',
    evidenceHint: 'Matriz de riscos de interpretação com parecer sobre provisão vs. divulgação.' },
  { id: 'D5-06', dim: 'contabil', sub: 'Cut-off', stage: 'closing', weight: 2,
    text: 'O fechamento assegura competência correta para documentos, eventos, créditos e pagamentos?',
    guidance: 'Um documento emitido num período mas reconhecido em outro (cut-off errado) distorce o resultado de ambos os períodos. Primeiro passo: revisar o checklist de fechamento para incluir testes de cut-off específicos dos novos tributos.',
    evidenceHint: 'Checklist de fechamento com teste de cut-off tributário evidenciado.' },
  { id: 'D5-07', dim: 'contabil', sub: 'Fechamento mensal', stage: 'closing', weight: 2,
    text: 'Existe roteiro de fechamento com responsáveis, prazos, conciliações e evidências?',
    guidance: 'Fechamento sem roteiro formal depende da memória de quem faz — no primeiro mês de ausência dessa pessoa, uma etapa crítica pode ser esquecida. Primeiro passo: documentar o roteiro de fechamento assistido, com cada etapa, prazo e responsável.',
    evidenceHint: 'Calendário e checklist de fechamento com sign-off por etapa.' },
  { id: 'D5-08', dim: 'contabil', sub: 'Vínculo documento-lançamento', stage: 'traceability', weight: 3,
    text: 'Lançamentos permitem rastrear documento, item, regra, crédito, pagamento e ajuste?',
    guidance: 'Sem rastreabilidade documento-lançamento, responder a uma fiscalização exige reconstruir manualmente a origem de cada número — um trabalho caro e sujeito a erro. Primeiro passo: testar, com uma amostra real, se dá para rastrear um lançamento até o documento de origem hoje.',
    evidenceHint: 'Amostra de lançamentos rastreados até o documento e a regra de origem.' },
  { id: 'D5-09', dim: 'contabil', sub: 'Intercompany e consolidação', stage: 'intercompany', weight: 2,
    text: 'Operações intercompany são conciliadas e eliminadas sem perder a trilha tributária?',
    guidance: 'Eliminar operações intercompany na consolidação sem preservar a trilha tributária individual dificulta explicar, depois, a origem de um crédito ou débito de uma empresa específica do grupo. Primeiro passo: padronizar a contabilização intercompany preservando a trilha por empresa.',
    evidenceHint: 'Conciliação intercompany com trilha tributária preservada por empresa do grupo.' },
  { id: 'D5-10', dim: 'contabil', sub: 'Divulgações', stage: 'reporting', weight: 1,
    text: 'Notas explicativas e relatórios gerenciais consideram riscos e efeitos materiais da reforma?',
    guidance: 'Não divulgar um efeito material da transição (ex.: mudança relevante de margem) pode comprometer a confiança de sócios e financiadores nas demonstrações. Primeiro passo: mapear os efeitos materiais já conhecidos e preparar a minuta de nota explicativa.',
    evidenceHint: 'Minuta de nota explicativa cobrindo os efeitos materiais já identificados, com aprovação.' },
  { id: 'D5-11', dim: 'contabil', sub: 'Evidência para auditoria', stage: 'audit', weight: 2,
    text: 'A documentação suporta revisão independente, auditoria e fiscalização?',
    guidance: 'Documentação organizada só para uso interno raramente resiste ao padrão de evidência exigido por um auditor externo ou fiscal. Primeiro passo: definir o pacote padrão de evidências que qualquer revisor externo deveria conseguir seguir sem apoio da equipe interna.',
    evidenceHint: 'Pacote padrão de evidências testado com uma revisão simulada.' },
  { id: 'D5-12', dim: 'contabil', sub: 'Reporting gerencial', stage: 'reporting', weight: 1,
    text: 'A gestão recebe visão integrada de carga, crédito, caixa, margem e risco?',
    guidance: 'Relatórios fragmentados (um de fiscal, outro de financeiro, outro de contábil) obrigam a diretoria a montar o quadro completo na cabeça — e frequentemente não monta. Primeiro passo: desenhar um reporting único que junte carga tributária, crédito, caixa, margem e risco numa só visão.',
    evidenceHint: 'Reporting gerencial integrado, com periodicidade mensal e envio efetivo à gestão.' },

  // ── 6. Tributário ──
  { id: 'D6-01', dim: 'tributario', sub: 'Mapa de operações', stage: 'tax_map', weight: 3,
    text: 'Todas as operações de entrada, saída, transferência, importação, exportação e serviços estão inventariadas?',
    guidance: 'Sem o mapa completo, é impossível saber quantas regras diferentes de IBS/CBS a empresa realmente precisa configurar — o volume costuma ser maior do que a percepção inicial. Primeiro passo: inventariar todos os tipos de operação realizados hoje, com volume por tipo.',
    evidenceHint: 'Matriz de operações com volumes, cobrindo entrada, saída, transferência e serviços.' },
  { id: 'D6-02', dim: 'tributario', sub: 'NCM e NBS', stage: 'classification', weight: 3,
    text: 'NCM e NBS estão saneados, justificados, versionados e ligados aos itens e serviços?',
    guidance: 'Classificação errada de NCM/NBS é a causa mais comum de tributo calculado errado em escala — um erro no cadastro se repete em toda venda daquele item. Primeiro passo: rodar um saneamento amostral do cadastro de produtos/serviços para medir a taxa de erro atual.',
    evidenceHint: 'Amostra de saneamento de NCM/NBS com laudo técnico e histórico de alterações.' },
  { id: 'D6-03', dim: 'tributario', sub: 'CST e cClassTrib', stage: 'classification', weight: 3,
    text: 'CST e cClassTrib são definidos por operação, vigência, documento e fundamento?',
    guidance: 'cClassTrib sem fundamento documentado por trás vira uma escolha arbitrária difícil de defender numa fiscalização. Primeiro passo: montar a tabela de regras (operação → CST/cClassTrib → fundamento) e validar com testes reais.',
    evidenceHint: 'Tabela de regras de classificação com fundamento e resultado de testes.' },
  { id: 'D6-04', dim: 'tributario', sub: 'Sistema atual', stage: 'legacy', weight: 2,
    text: 'PIS/Cofins, ICMS, ISS e IPI atuais estão mapeados para comparação e transição?',
    guidance: 'Sem o baseline do sistema atual bem documentado, fica impossível comparar e validar se a migração para IBS/CBS preservou (ou não) benefícios e regimes especiais que a empresa já tinha. Primeiro passo: consolidar as regras e benefícios atuais como baseline de comparação.',
    evidenceHint: 'Baseline tributário atual consolidado, com benefícios e regimes vigentes documentados.' },
  { id: 'D6-05', dim: 'tributario', sub: 'Incidência IBS/CBS', stage: 'new_tax', weight: 3,
    text: 'Incidência, base, local, sujeito passivo e alíquotas são definidos por operação?',
    guidance: 'A regra de incidência do IBS/CBS varia conforme local, natureza da operação e sujeito passivo — sem modelar isso operação a operação, o motor tributário aplica uma regra genérica que erra nos casos específicos. Primeiro passo: modelar a regra de incidência para as operações de maior volume primeiro.',
    evidenceHint: 'Memória de cálculo da incidência por operação, com base legal citada.' },
  { id: 'D6-06', dim: 'tributario', sub: 'Elegibilidade de crédito', stage: 'credit', weight: 3,
    text: 'Crédito é condicionado a documento, operação, pagamento, vinculação e restrições aplicáveis?',
    guidance: 'Assumir crédito integral sem checar as condições de elegibilidade (documento válido, pagamento efetuado, vinculação à atividade) é a forma mais comum de superestimar o crédito disponível e depois ter que estornar. Primeiro passo: montar as regras de elegibilidade e testá-las contra um lote real de compras.',
    evidenceHint: 'Matriz de elegibilidade de crédito testada contra um lote real de operações.' },
  { id: 'D6-07', dim: 'tributario', sub: 'Regimes diferenciados', stage: 'specific', weight: 3,
    text: 'Reduções, alíquota zero, imunidades, regimes específicos e tratamentos setoriais estão identificados?',
    guidance: 'Deixar de identificar um regime diferenciado aplicável ao setor da empresa significa pagar mais tributo do que o devido, mês após mês, sem que ninguém perceba. Primeiro passo: mapear todos os regimes diferenciados que podem se aplicar ao setor e aos produtos da empresa.',
    evidenceHint: 'Matriz de regimes diferenciados aplicáveis, com fonte legal e produtos/operações afetados.' },
  { id: 'D6-08', dim: 'tributario', sub: 'Comércio exterior', stage: 'foreign_trade', weight: 3,
    text: 'Importação, exportação, ZFM, ALC, ZPE e regimes aduaneiros estão modelados?',
    guidance: 'Operações de comércio exterior têm regras próprias que não podem ser tratadas como uma venda doméstica genérica — modelar errado aqui afeta diretamente a competitividade de preço na exportação/importação. Primeiro passo: modelar separadamente cada regime aduaneiro relevante para a empresa.',
    evidenceHint: 'Matriz de comércio exterior com bases, créditos e documentos por regime aduaneiro.' },
  { id: 'D6-09', dim: 'tributario', sub: 'Agronegócio', stage: 'agro', weight: 3,
    text: 'Produtor PF/PJ, cooperativas, insumos, barter, CPR, armazenagem e exportação estão separados?',
    guidance: 'O agronegócio tem operações (barter, CPR, armazenagem, venda por cooperativa) com tratamento tributário muito diferente entre si — tratar tudo como uma venda padrão gera erro sistemático em toda a cadeia. Primeiro passo: modelar separadamente cada tipo de operação agro relevante para a empresa.',
    evidenceHint: 'Matriz de cadeias agro com casos reais testados por tipo de operação (barter, CPR, etc.).' },
  { id: 'D6-10', dim: 'tributario', sub: 'Simples Nacional', stage: 'simple', weight: 2,
    text: 'Efeitos para contribuinte, fornecedor e adquirente estão simulados por cadeia B2B/B2C?',
    guidance: 'Comprar de ou vender para uma empresa do Simples tem efeito de crédito diferente do regime regular — sem simular isso, a política comercial pode estar penalizando (ou favorecendo) parceiros do Simples sem intenção. Primeiro passo: simular o efeito de crédito nas cadeias B2B que envolvem o Simples Nacional.',
    evidenceHint: 'Simulação comparativa Simples vs. regime regular para as cadeias B2B relevantes.' },
  { id: 'D6-11', dim: 'tributario', sub: 'Documentos fiscais', stage: 'dfe', weight: 3,
    text: 'Leiautes, campos, validações, eventos e contingências dos DF-e estão preparados?',
    guidance: 'Um leiaute de nota fiscal não adequado a tempo trava a emissão de documento (e, portanto, a venda) no primeiro dia de vigência da nova regra. Primeiro passo: obter o cronograma oficial de leiautes e cruzar com a data de adequação real do sistema.',
    evidenceHint: 'Plano de testes de DF-e com notas técnicas seguidas e evidência de homologação.' },
  { id: 'D6-12', dim: 'tributario', sub: 'Apuração assistida', stage: 'assessment', weight: 3,
    text: 'Débitos, créditos, pagamentos, pendências, ajustes e ressarcimentos são conciliados no processo futuro?',
    guidance: 'O modelo de apuração assistida muda a mecânica de conciliação entre o que o fisco calcula e o que a empresa apura — sem desenhar esse processo antes, o fechamento tributário do primeiro mês real vira um exercício às cegas. Primeiro passo: desenhar, em ambiente de teste, como será o fechamento e a conciliação da apuração assistida.',
    evidenceHint: 'Desenho do processo de apuração assistida testado em ambiente de homologação.' },

  // ── 7. Operacional e cultura ──
  { id: 'D7-01', dim: 'operacional', sub: 'Mapeamento de processos', stage: 'process', weight: 3,
    text: 'Processos afetados estão documentados com entradas, decisões, controles, sistemas e saídas?',
    guidance: 'Sem o mapa de processo ponta a ponta, é impossível saber com precisão quais telas, aprovações e sistemas realmente precisam mudar — o time acaba redesenhando de memória e esquecendo etapas. Primeiro passo: mapear os processos críticos afetados pela reforma, ponta a ponta.',
    evidenceHint: 'Mapas de processo com gaps identificados entre o estado atual e o necessário.' },
  { id: 'D7-02', dim: 'operacional', sub: 'Donos de processo', stage: 'governance', weight: 2,
    text: 'Cada processo afetado possui owner com metas, responsabilidades e autoridade?',
    guidance: 'Um processo sem dono claro não tem quem decida os ajustes necessários nem quem responda quando algo falha durante a transição. Primeiro passo: nomear um owner para cada processo crítico mapeado, com autoridade real de decisão.',
    evidenceHint: 'Matriz de owners de processo com nome, escopo e autoridade de decisão.' },
  { id: 'D7-03', dim: 'operacional', sub: 'Treinamento por função', stage: 'training', weight: 2,
    text: 'Trilhas de capacitação variam conforme responsabilidade de diretoria, fiscal, TI, compras, vendas e operação?',
    guidance: 'Um treinamento genérico "sobre a reforma" para todo mundo ensina pouco de útil para quem precisa, na prática, mudar como emite nota ou negocia preço. Primeiro passo: montar trilhas de capacitação específicas por função, com o que cada uma precisa saber fazer diferente.',
    evidenceHint: 'Matriz de treinamento por função com avaliação de aprendizado aplicada.' },
  { id: 'D7-04', dim: 'operacional', sub: 'Gestão da mudança', stage: 'change', weight: 2,
    text: 'Existe plano de impactos, stakeholders, resistências, comunicação e adoção?',
    guidance: 'Mudança tratada só como "projeto técnico" ignora a resistência natural das pessoas a mudar rotina — e a adoção real do novo processo fica bem abaixo do planejado. Primeiro passo: mapear os stakeholders mais impactados e as resistências esperadas antes de desenhar a comunicação.',
    evidenceHint: 'Plano de change management com mapa de stakeholders e resistências identificadas.' },
  { id: 'D7-05', dim: 'operacional', sub: 'Comportamento comercial', stage: 'sales', weight: 2,
    text: 'Vendas entendem preço por fora, crédito do cliente, margem e limites de negociação?',
    guidance: 'Um vendedor negociando desconto sem entender o efeito no crédito do cliente ou na margem líquida pode fechar negócios que destroem valor sem perceber. Primeiro passo: capacitar o time comercial nos novos limites de negociação e revisar as políticas de desconto.',
    evidenceHint: 'Treinamento comercial aplicado e política de negociação revisada e comunicada.' },
  { id: 'D7-06', dim: 'operacional', sub: 'Comportamento de compras', stage: 'procurement', weight: 2,
    text: 'Compras avalia custo líquido, crédito, regime, documento e prazo do fornecedor?',
    guidance: 'Comprador que decide só pelo preço bruto (sem considerar o crédito gerado) pode escolher sistematicamente o fornecedor mais caro em termos de custo líquido real. Primeiro passo: revisar os critérios de decisão de compra para incluir custo líquido, não só preço de tabela.',
    evidenceHint: 'Política de compras revisada com critério de custo líquido e treinamento aplicado.' },
  { id: 'D7-07', dim: 'operacional', sub: 'Procedimentos operacionais', stage: 'procedure', weight: 2,
    text: 'POPs e instruções foram atualizados para as novas regras e controles?',
    guidance: 'Time operacional seguindo um POP desatualizado reproduz o erro do processo antigo mesmo depois que o sistema já mudou. Primeiro passo: revisar e republicar os POPs dos processos críticos afetados, com comunicação formal da mudança.',
    evidenceHint: 'POPs atualizados, aprovados e com evidência de comunicação à equipe.' },
  { id: 'D7-08', dim: 'operacional', sub: 'Contingência operacional', stage: 'contingency', weight: 2,
    text: 'Há procedimentos para falha de ERP, portal, DF-e, integração ou fornecedor?',
    guidance: 'Sem plano de contingência, uma instabilidade nos sistemas oficiais no início da vigência pode parar a emissão de documento fiscal e, com ela, a operação. Primeiro passo: desenhar e testar o procedimento de contingência para os pontos de falha mais prováveis.',
    evidenceHint: 'Plano de contingência operacional testado, com procedimento manual documentado.' },
  { id: 'D7-09', dim: 'operacional', sub: 'Incentivos e metas', stage: 'performance', weight: 1,
    text: 'Metas de vendas, compras e operação evitam comportamentos que destruam margem, crédito ou compliance?',
    guidance: 'Uma meta comercial baseada só em volume, sem considerar margem líquida pós-reforma, pode incentivar o time a fechar negócios que parecem bons mas destroem valor. Primeiro passo: revisar as metas e incentivos vigentes em busca de conflitos com o novo modelo tributário.',
    evidenceHint: 'Revisão de metas/incentivos com identificação de conflitos e ajuste proposto.' },
  { id: 'D7-10', dim: 'operacional', sub: 'Rituais interfuncionais', stage: 'governance', weight: 2,
    text: 'Áreas realizam ritos para tratar exceções, decisões e dependências da transição?',
    guidance: 'Sem um rito recorrente entre áreas, dependências cruzadas (ex.: TI esperando definição do fiscal) ficam invisíveis até virarem atraso. Primeiro passo: instituir um rito curto e recorrente entre as áreas mais dependentes entre si.',
    evidenceHint: 'Calendário de ritos interfuncionais com atas e indicadores de dependência tratados.' },
  { id: 'D7-11', dim: 'operacional', sub: 'Prontidão da linha de frente', stage: 'readiness', weight: 2,
    text: 'Usuários-chave conseguem executar cenários críticos sem apoio informal?',
    guidance: 'Usuário que só consegue operar o novo processo com ajuda constante de um colega mais experiente não está realmente pronto — e essa dependência não escala. Primeiro passo: aplicar um teste prático dos cenários mais críticos com os usuários-chave, sem apoio.',
    evidenceHint: 'Resultado de teste de prontidão prático, com plano de reciclagem para quem não passou.' },
  { id: 'D7-12', dim: 'operacional', sub: 'Lições aprendidas', stage: 'improvement', weight: 1,
    text: 'Incidentes, falhas de teste e dúvidas viram melhoria de processo, conteúdo e sistema?',
    guidance: 'Sem um ciclo formal de lições aprendidas, o mesmo erro identificado num teste tende a se repetir em produção porque o aprendizado ficou só na cabeça de quem viu o problema. Primeiro passo: criar um registro simples de lições aprendidas, revisado periodicamente pelo comitê.',
    evidenceHint: 'Registro de lições aprendidas com ação de melhoria associada a cada item.' },

  // ── 8. Sistemas e TI ──
  { id: 'D8-01', dim: 'sistemas', sub: 'Roadmap do ERP', stage: 'erp', weight: 3,
    text: 'O fornecedor do ERP possui roadmap, versões, requisitos e datas compatíveis com a empresa?',
    guidance: 'Descobrir tarde que o roadmap do fornecedor não bate com o calendário legal da reforma deixa a empresa sem tempo hábil para um plano B. Primeiro passo: obter formalmente o roadmap do fornecedor e cruzar com os marcos legais.',
    evidenceHint: 'Roadmap do fornecedor formalizado, com datas comparadas aos marcos legais.' },
  { id: 'D8-02', dim: 'sistemas', sub: 'Ambientes', stage: 'testing', weight: 3,
    text: 'Desenvolvimento, homologação e produção estão separados, atualizados e governados?',
    guidance: 'Testar mudança tributária direto em produção (por falta de ambiente de homologação funcional) expõe a operação real a erro de configuração. Primeiro passo: garantir que o ambiente de homologação está atualizado e realmente reflete a produção.',
    evidenceHint: 'Arquitetura de ambientes documentada com calendário de sincronização entre eles.' },
  { id: 'D8-03', dim: 'sistemas', sub: 'Leiautes DF-e', stage: 'dfe', weight: 3,
    text: 'Campos IBS/CBS, regras de validação e eventos estão implementados e testados?',
    guidance: 'Um campo obrigatório não implementado a tempo faz o documento fiscal ser rejeitado pelo ambiente oficial — parando a venda até a correção. Primeiro passo: rodar uma bateria de testes de emissão cobrindo os cenários de maior volume.',
    evidenceHint: 'Evidências de teste (XML) cobrindo os principais cenários de emissão.' },
  { id: 'D8-04', dim: 'sistemas', sub: 'Dados mestres', stage: 'master_data', weight: 3,
    text: 'Produtos, serviços, parceiros, locais, contratos e parâmetros possuem qualidade e ownership?',
    guidance: 'Motor tributário bem configurado não compensa cadastro de produto/parceiro de baixa qualidade — o erro de origem se propaga para toda operação que usa aquele cadastro. Primeiro passo: medir a qualidade atual dos dados mestres mais usados (produtos, parceiros) e definir owner por domínio.',
    evidenceHint: 'Relatório de qualidade de dados mestres com owner definido por domínio.' },
  { id: 'D8-05', dim: 'sistemas', sub: 'Motor tributário', stage: 'tax_engine', weight: 3,
    text: 'Regras tributárias são centralizadas, versionadas, testáveis e explicáveis?',
    guidance: 'Regra tributária espalhada em vários sistemas (ou hardcoded) é impossível de auditar e de corrigir rapidamente quando a legislação mudar de novo. Primeiro passo: avaliar se as regras estão centralizadas num motor único, versionado e testável.',
    evidenceHint: 'Arquitetura do motor tributário documentada, com log de versões de regra.' },
  { id: 'D8-06', dim: 'sistemas', sub: 'Integrações', stage: 'integration', weight: 3,
    text: 'Integrações entre ERP, tax engine, DF-e, financeiro, contábil e portais estão mapeadas?',
    guidance: 'Uma integração não mapeada é um ponto cego — quando falha, ninguém sabe imediatamente que sistema está causando a divergência de dado entre as áreas. Primeiro passo: mapear todas as integrações relevantes e testar cada uma ponta a ponta.',
    evidenceHint: 'Mapa de integrações com SLA definido e evidência de teste ponta a ponta.' },
  { id: 'D8-07', dim: 'sistemas', sub: 'APIs e portais', stage: 'digital', weight: 2,
    text: 'APIs, certificados, procurações, robôs e serviços oficiais possuem governança e monitoramento?',
    guidance: 'Certificado digital vencido ou robô sem monitoramento é uma das causas mais bobas (e mais comuns) de parada de operação fiscal. Primeiro passo: inventariar certificados, credenciais e robôs críticos com data de expiração e responsável.',
    evidenceHint: 'Inventário de acessos/certificados com data de expiração e alerta configurado.' },
  { id: 'D8-08', dim: 'sistemas', sub: 'Acessos e segurança', stage: 'security', weight: 3,
    text: 'Perfis, privilégios, segregação, autenticação e revisão periódica estão adequados?',
    guidance: 'Acesso de sistema mal segregado permite que uma única pessoa configure e aprove regra tributária sem checagem cruzada — o mesmo risco de segregação de função, só que dentro do sistema. Primeiro passo: revisar os perfis de acesso ao motor tributário e ao ERP quanto à segregação.',
    evidenceHint: 'Matriz de acessos revisada com evidência de segregação entre configuração e aprovação.' },
  { id: 'D8-09', dim: 'sistemas', sub: 'Testes integrados', stage: 'testing', weight: 3,
    text: 'Há plano de testes unitários, integrados, regressão, volume e cenários negativos?',
    guidance: 'Testar só o "caminho feliz" (cenário sem erro) deixa passar exatamente os casos que mais geram problema em produção — cenário negativo, volume alto, exceção. Primeiro passo: montar a matriz de testes incluindo cenários negativos e de volume, não só o caminho padrão.',
    evidenceHint: 'Matriz de testes com resultados, incluindo cenários negativos e de volume.' },
  { id: 'D8-10', dim: 'sistemas', sub: 'Logs e observabilidade', stage: 'monitor', weight: 2,
    text: 'Falhas, rejeições, alterações e exceções são registradas, alertadas e tratadas?',
    guidance: 'Sem observabilidade, uma taxa crescente de rejeição de documento fiscal só é percebida quando o volume de reclamação de cliente já é grande. Primeiro passo: implantar um painel básico de observabilidade para as falhas mais críticas do motor tributário.',
    evidenceHint: 'Dashboard de observabilidade com alertas configurados e tickets tratados.' },
  { id: 'D8-11', dim: 'sistemas', sub: 'Backup e contingência', stage: 'contingency', weight: 2,
    text: 'Dados, regras, certificados e configurações possuem backup, recuperação e contingência testada?',
    guidance: 'Backup que nunca foi restaurado em teste não é garantia nenhuma — a hora de descobrir que ele não funciona não pode ser durante um incidente real. Primeiro passo: testar a restauração de backup das regras e configurações críticas.',
    evidenceHint: 'Evidência de teste de restauração de backup, com data e resultado documentado.' },
  { id: 'D8-12', dim: 'sistemas', sub: 'Capacidade de fornecedores', stage: 'vendor', weight: 2,
    text: 'ERP, tax engine, integradores e suporte têm capacidade, SLA e plano de escalonamento?',
    guidance: 'Fornecedor crítico sem SLA de atendimento claro pode deixar a empresa sem suporte justamente no pico de demanda (perto de um marco legal). Primeiro passo: revalidar com cada fornecedor crítico a capacidade e o SLA de atendimento para os picos esperados.',
    evidenceHint: 'SLA revalidado por fornecedor crítico, com plano de escalonamento formalizado.' },
];

async function main() {
  let mv = await prisma.methodVersion.findFirst({
    where: { tenantId: null, code: METHOD_CODE, version: METHOD_VERSION },
  });
  if (!mv) {
    mv = await prisma.methodVersion.create({
      data: {
        tenantId: null,
        code: METHOD_CODE,
        version: METHOD_VERSION,
        name: 'Diagnóstico FAL da Reforma Tributária',
        isPublished: true,
        publishedAt: new Date(),
        payload: { dimensions: DIMENSIONS },
      },
    });
  }
  console.log(`MethodVersion ${mv.id} (${mv.code} v${mv.version}) — dimensions payload com ${DIMENSIONS.length} entradas.`);

  const existingIds = new Set(
    (await prisma.falQuestion.findMany({ where: { methodVersionId: mv.id }, select: { questionId: true } })).map((q) => q.questionId),
  );

  let created = 0;
  let skipped = 0;
  let seq = 0;
  for (const q of QUESTIONS) {
    seq++;
    const questionId = `rt_${q.id}`;
    if (existingIds.has(questionId)) { skipped++; continue; }
    const subKey = slugify(q.sub);
    await prisma.falQuestion.create({
      data: {
        questionId,
        methodVersionId: mv.id,
        dimensionKey: q.dim,
        subdimensionKey: subKey,
        clusterKey: `${subKey}_cluster`,
        processStage: q.stage,
        sequenceOrder: seq,
        diagnosticDepth: ['rapid', 'standard', 'deep'],
        levelApplicability: ['group', 'company', 'unit'],
        questionWeight: q.weight,
        questionText: q.text,
        guidance: q.guidance,
        evidenceHint: q.evidenceHint,
        isKillerQuestion: false,
        isCritical: q.weight === 3,
      },
    });
    created++;
  }
  console.log(`${created} FalQuestion(s) criada(s), ${skipped} já existiam — MethodVersion ${mv.id}.`);
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
