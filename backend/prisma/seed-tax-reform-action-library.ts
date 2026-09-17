/**
 * Seed one-off: popula fal_question_action_library para as 96 perguntas da
 * Reforma Tributária 8D (seed-tax-reform-method.ts).
 *
 * Sem isso, action-plan.service.ts::generate() nunca cria candidato
 * operacional para essas perguntas — o motor só gera tarefa por pergunta
 * quando existe uma linha correspondente aqui (join por question_id),
 * mesmo que a pergunta já tenha guidance/evidence_hint preenchidos em
 * fal_questions. Confirmado rodando generate() num assessment de teste
 * antes deste seed: candidates_total=0 mesmo com respostas de nota baixa.
 *
 * action_title = a "Ação recomendada" original da planilha
 * (Diagnostico_FAL_Reforma_Tributaria_v0_9.xlsx), um resumo curto e
 * específico por pergunta — não repetido entre as 96. reason_template usa
 * o motivo específico já escrito em seed-tax-reform-method.ts (não repete
 * o placeholder genérico "Por que importa" da planilha original).
 *
 * trigger_score_max=2 (escala 0-3, mesmo default do restante do banco):
 * dispara para nota 0/1/2, não dispara em 3 (maturidade avançada).
 * impact_level deriva do peso da pergunta (1/2/3 na planilha → 3/4/5 aqui).
 *
 * Aditivo por design (idempotente por question_id, nunca deleta).
 *
 * Rodar com: npx tsx prisma/seed-tax-reform-action-library.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

const DIMENSION_OWNER: Record<string, string> = {
  governanca: 'Diretoria / PMO',
  juridico: 'Jurídico / Societário',
  controles_internos: 'Controladoria / Controles internos',
  financeiro: 'Financeiro / Tesouraria / Pricing',
  contabil: 'Contabilidade / Controladoria',
  tributario: 'Fiscal / Tributário',
  operacional: 'Operações / RH / Gestão da mudança',
  sistemas: 'TI / ERP / Tax technology',
};

type Row = { id: string; dim: string; sub: string; weight: 1 | 2 | 3; action: string; reason: string };

// `action` = "Ação recomendada" original da planilha (título curto e
// específico). `reason` = motivo específico já usado no guidance da
// pergunta em seed-tax-reform-method.ts (1ª frase, sem o "Primeiro passo").
const ROWS: Row[] = [
  { id: 'D1-01', dim: 'governanca', sub: 'Patrocínio executivo', weight: 2, action: 'Formalizar sponsor executivo, alçadas e responsabilidades.', reason: 'Sem um sponsor com poder de decisão, conflitos entre áreas travam a transição por falta de alguém que corte o nó.' },
  { id: 'D1-02', dim: 'governanca', sub: 'Programa formal', weight: 2, action: 'Criar termo de abertura do Programa de Transição Tributária.', reason: 'Tratar como "projeto de TI" faz a empresa perder o impacto em preço, contrato, caixa e cultura.' },
  { id: 'D1-03', dim: 'governanca', sub: 'Comitê multidisciplinar', weight: 2, action: 'Implantar comitê multidisciplinar com rito e pauta fixa.', reason: 'Decisões tomadas só pelo fiscal frequentemente quebram o comercial ou o financeiro por falta de visão cruzada.' },
  { id: 'D1-04', dim: 'governanca', sub: 'Orçamento e capacidade', weight: 2, action: 'Dimensionar capacidade e aprovar orçamento por workstream.', reason: 'Sem orçamento e capacidade reservados, a transição compete por recursos com a operação do dia a dia e sempre perde.' },
  { id: 'D1-05', dim: 'governanca', sub: 'Roadmap 2026–2033', weight: 2, action: 'Construir roadmap 2026–2033 com caminho crítico.', reason: 'A reforma tem marcos legais escalonados até 2033 — sem roadmap único as dependências entre áreas ficam invisíveis.' },
  { id: 'D1-06', dim: 'governanca', sub: 'Matriz decisória', weight: 2, action: 'Criar matriz RACI e log de decisões da reforma.', reason: 'Sem uma matriz de alçadas clara, decisões urgentes ficam paradas esperando "alguém decidir".' },
  { id: 'D1-07', dim: 'governanca', sub: 'Monitoramento normativo', weight: 2, action: 'Implantar monitoramento normativo versionado.', reason: 'As regras da reforma ainda estão sendo publicadas em ondas — mudanças chegam pela imprensa em vez de um canal controlado.' },
  { id: 'D1-08', dim: 'governanca', sub: 'Gestão de riscos', weight: 3, action: 'Criar registro central de riscos e planos de resposta.', reason: 'Riscos não registrados formalmente só aparecem quando já viraram incidente.' },
  { id: 'D1-09', dim: 'governanca', sub: 'KPIs de prontidão', weight: 2, action: 'Definir painel executivo de prontidão com metas por frente.', reason: 'Sem um painel único, a diretoria só descobre atraso quando o prazo já estourou.' },
  { id: 'D1-10', dim: 'governanca', sub: 'Comunicação interna', weight: 2, action: 'Criar plano de comunicação segmentado por área.', reason: 'Sem comunicação segmentada, times operacionais reagem com resistência por não entenderem o "porquê".' },
  { id: 'D1-11', dim: 'governanca', sub: 'Governança de terceiros', weight: 2, action: 'Formalizar governança e aceite de fornecedores críticos.', reason: 'Sem SLA formalizado, atraso de um fornecedor crítico não tem consequência contratual nem contingência.' },
  { id: 'D1-12', dim: 'governanca', sub: 'Aprovação de cenários', weight: 2, action: 'Instituir gate executivo para aprovação de cenários.', reason: 'Cenários implantados sem aprovação formal geram exposição jurídica e financeira não deliberada.' },

  { id: 'D2-01', dim: 'juridico', sub: 'Inventário contratual', weight: 3, action: 'Criar inventário contratual por materialidade e risco.', reason: 'Sem inventário, contratos de longo prazo com preço fechado viram passivo silencioso.' },
  { id: 'D2-02', dim: 'juridico', sub: 'Cláusulas de alteração tributária', weight: 3, action: 'Revisar cláusulas de alteração tributária.', reason: 'Contrato sem cláusula de variação tributária trava o repasse de custo novo ao cliente.' },
  { id: 'D2-03', dim: 'juridico', sub: 'Repasse e preço por fora', weight: 3, action: 'Inserir cláusulas de destaque, repasse e recomposição.', reason: 'Sem previsão contratual de destaque "por fora", o cliente pode ler o novo tributo como aumento unilateral.' },
  { id: 'D2-04', dim: 'juridico', sub: 'Reequilíbrio econômico', weight: 3, action: 'Estruturar protocolo de reequilíbrio econômico-financeiro.', reason: 'Contratos de longo prazo sem gatilho de reequilíbrio deixam a empresa sem instrumento formal de pleito.' },
  { id: 'D2-05', dim: 'juridico', sub: 'Contratos intercompany', weight: 2, action: 'Revisar contratos e políticas intercompany.', reason: 'Operações intercompany sem contrato formalizado sob a nova lógica geram risco de questionamento do crédito.' },
  { id: 'D2-06', dim: 'juridico', sub: 'Estrutura societária', weight: 2, action: 'Executar análise societária e operacional integrada.', reason: 'A lógica de destino muda o racional de onde vale a pena manter ou consolidar filiais/CNPJs.' },
  { id: 'D2-07', dim: 'juridico', sub: 'Procurações e acessos', weight: 2, action: 'Revisar procurações, perfis e segregação de acessos.', reason: 'Procuração desatualizada ou acesso concentrado é ponto único de falha e risco de segregação.' },
  { id: 'D2-08', dim: 'juridico', sub: 'Contencioso e contingências', weight: 2, action: 'Integrar contencioso ao plano de transição.', reason: 'Sem esse inventário, a empresa pode adotar posição que contradiz uma tese defendida no sistema antigo.' },
  { id: 'D2-09', dim: 'juridico', sub: 'Proteção de dados', weight: 2, action: 'Revisar bases legais, contratos e controles de dados.', reason: 'Novas integrações com tax engine e portais trafegam dado sensível sem avaliação formal de base legal.' },
  { id: 'D2-10', dim: 'juridico', sub: 'Renegociação com clientes', weight: 3, action: 'Criar plano de renegociação com clientes críticos.', reason: 'Renegociar tudo de última hora, sem segmentação, gera desgaste comercial desnecessário.' },
  { id: 'D2-11', dim: 'juridico', sub: 'Renegociação com fornecedores', weight: 3, action: 'Criar plano de renegociação com fornecedores.', reason: 'Fornecedor em regime que não gera o crédito esperado pode virar o elo mais caro da cadeia sem que ninguém perceba.' },
  { id: 'D2-12', dim: 'juridico', sub: 'Pareceres e decisões', weight: 2, action: 'Criar repositório de decisões jurídicas versionadas.', reason: 'Interpretações tomadas informalmente não sobrevivem a uma fiscalização nem a uma troca de equipe.' },

  { id: 'D3-01', dim: 'controles_internos', sub: 'Pedido ao faturamento', weight: 3, action: 'Revisar controles do order-to-cash.', reason: 'Um erro de classificação no início do fluxo se propaga para o documento fiscal e o crédito do cliente.' },
  { id: 'D3-02', dim: 'controles_internos', sub: 'Requisição ao pagamento', weight: 3, action: 'Revisar controles do procure-to-pay.', reason: 'Comprar sem validar o regime tributário do fornecedor pode gerar crédito menor do que o preço negociado presumia.' },
  { id: 'D3-03', dim: 'controles_internos', sub: 'Estoques e movimentações', weight: 2, action: 'Implantar controles tributários de movimentação de estoques.', reason: 'Movimentações de estoque não conciliadas são a origem mais comum de descasamento entre físico e crédito.' },
  { id: 'D3-04', dim: 'controles_internos', sub: 'Alteração de dados mestres', weight: 3, action: 'Implantar governança de alterações cadastrais.', reason: 'Um cadastro alterado sem aprovação muda a tributação de todas as operações seguintes daquele item.' },
  { id: 'D3-05', dim: 'controles_internos', sub: 'Segregação de funções', weight: 3, action: 'Corrigir conflitos de segregação de funções.', reason: 'A mesma pessoa cadastrar a regra e aprovar o documento é a porta mais comum para erro passar despercebido.' },
  { id: 'D3-06', dim: 'controles_internos', sub: 'Mudanças tributárias', weight: 2, action: 'Implantar gestão formal de mudanças tributárias.', reason: 'Alterar regra direto em produção, sem teste prévio, pode gerar documento fiscal incorreto em escala.' },
  { id: 'D3-07', dim: 'controles_internos', sub: 'Ajustes manuais', weight: 2, action: 'Criar política e monitoramento de ajustes manuais.', reason: 'Ajuste manual sem aprovação e sem rastro é o ponto mais difícil de defender numa fiscalização.' },
  { id: 'D3-08', dim: 'controles_internos', sub: 'Evidência de créditos', weight: 3, action: 'Implantar dossiê eletrônico e trilha de créditos.', reason: 'Crédito reconhecido sem dossiê completo não resiste a uma auditoria e pode precisar ser estornado.' },
  { id: 'D3-09', dim: 'controles_internos', sub: 'Devoluções e cancelamentos', weight: 2, action: 'Padronizar tratamento de eventos pós-emissão.', reason: 'Evento pós-emissão tratado de forma ad-hoc gera inconsistência entre documento fiscal e financeiro.' },
  { id: 'D3-10', dim: 'controles_internos', sub: 'Monitoramento de exceções', weight: 2, action: 'Implantar monitoramento de exceções tributárias.', reason: 'Sem painel de exceções, o time só descobre um problema recorrente quando o volume acumulado já é grande.' },
  { id: 'D3-11', dim: 'controles_internos', sub: 'Aprovações e logs', weight: 2, action: 'Reforçar trilha de auditoria dos controles críticos.', reason: 'Controle sem log completo não serve como evidência numa auditoria, mesmo que funcione.' },
  { id: 'D3-12', dim: 'controles_internos', sub: 'Teste de efetividade', weight: 2, action: 'Criar programa de testes de efetividade.', reason: 'Controle desenhado mas nunca testado pode estar quebrado há meses sem que ninguém saiba.' },

  { id: 'D4-01', dim: 'financeiro', sub: 'Fluxo de caixa e split', weight: 3, action: 'Incluir split payment e tributos no fluxo de caixa.', reason: 'O split payment separa o tributo do valor recebido — sem projetar isso, o caixa disponível fica superestimado.' },
  { id: 'D4-02', dim: 'financeiro', sub: 'Monetização de créditos', weight: 3, action: 'Modelar prazo e custo financeiro dos créditos.', reason: 'Saldo credor que demora para virar caixa tem um custo financeiro real raramente medido.' },
  { id: 'D4-03', dim: 'financeiro', sub: 'Capital de giro', weight: 3, action: 'Recalcular capital de giro da transição.', reason: 'O ciclo financeiro muda com a nova sistemática de crédito/débito — o número antigo pode estar errado.' },
  { id: 'D4-04', dim: 'financeiro', sub: 'Formação de preço', weight: 3, action: 'Implantar repricing por família e perfil de cliente.', reason: 'Manter a tabela de preço antiga sem resimular o efeito líquido pode erodir margem silenciosamente.' },
  { id: 'D4-05', dim: 'financeiro', sub: 'Margem por produto', weight: 3, action: 'Recalcular margem econômica por operação.', reason: 'Margem calculada com a metodologia antiga pode mostrar lucro onde na verdade há perda de caixa.' },
  { id: 'D4-06', dim: 'financeiro', sub: 'Funding e linhas', weight: 2, action: 'Estruturar plano de funding e contingência.', reason: 'Descasamentos temporários de caixa sem linha de contingência já aprovada viram problema de liquidez em cima da hora.' },
  { id: 'D4-07', dim: 'financeiro', sub: 'Prazos de clientes e fornecedores', weight: 2, action: 'Renegociar prazos com base no ciclo financeiro.', reason: 'Analisar prazo de cliente e de recuperação de crédito separadamente esconde o efeito real no ciclo de caixa.' },
  { id: 'D4-08', dim: 'financeiro', sub: 'Pagamentos e retenções', weight: 2, action: 'Mapear impacto financeiro por meio de pagamento.', reason: 'Cada meio de pagamento pode ter regra diferente de retenção/split, gerando divergência de valor recebido.' },
  { id: 'D4-09', dim: 'financeiro', sub: 'Tesouraria e conciliação', weight: 2, action: 'Implantar conciliação tributária-financeira.', reason: 'Sem conciliação, uma diferença entre documentado e recebido só é percebida quando o caixa já não fecha.' },
  { id: 'D4-10', dim: 'financeiro', sub: 'Capex e investimentos', weight: 1, action: 'Revisar business cases de capex.', reason: 'Um investimento aprovado com a regra de crédito antiga pode ter retorno diferente sob a nova sistemática.' },
  { id: 'D4-11', dim: 'financeiro', sub: 'Sensibilidade e estresse', weight: 2, action: 'Executar cenários de sensibilidade e estresse.', reason: 'Rodar um único cenário base esconde o quanto a empresa é sensível a mudança de alíquota ou prazo de crédito.' },
  { id: 'D4-12', dim: 'financeiro', sub: 'Indicadores e covenants', weight: 2, action: 'Revisar covenants e comunicação com financiadores.', reason: 'Covenant calculado sobre indicadores que mudam de metodologia pode ser rompido tecnicamente sem piora real.' },

  { id: 'D5-01', dim: 'contabil', sub: 'Plano de contas', weight: 2, action: 'Atualizar plano de contas para IBS/CBS e transição.', reason: 'Lançar tudo numa conta genérica impede rastrear separadamente crédito, débito e ressarcimento.' },
  { id: 'D5-02', dim: 'contabil', sub: 'Políticas contábeis', weight: 2, action: 'Formalizar política contábil dos tributos da reforma.', reason: 'Sem política formal, cada contador pode reconhecer o crédito de um jeito diferente.' },
  { id: 'D5-03', dim: 'contabil', sub: 'Conciliação fiscal-contábil', weight: 3, action: 'Implantar conciliação fiscal-contábil-financeira.', reason: 'Divergência entre apurado no fiscal e lançado no contábil, não conciliada, é o achado mais comum numa auditoria.' },
  { id: 'D5-04', dim: 'contabil', sub: 'Aging de créditos', weight: 3, action: 'Criar aging e política de recuperabilidade.', reason: 'Créditos antigos sem classificação de risco podem estar contabilizados como ativo sem serem recuperáveis.' },
  { id: 'D5-05', dim: 'contabil', sub: 'Provisões e contingências', weight: 2, action: 'Integrar riscos da reforma ao processo de provisões.', reason: 'Interpretações ainda incertas precisam de avaliação formal sobre provisão vs. divulgação.' },
  { id: 'D5-06', dim: 'contabil', sub: 'Cut-off', weight: 2, action: 'Revisar controles de cut-off tributário.', reason: 'Um documento reconhecido no período errado distorce o resultado de ambos os períodos.' },
  { id: 'D5-07', dim: 'contabil', sub: 'Fechamento mensal', weight: 2, action: 'Criar fechamento assistido IBS/CBS.', reason: 'Fechamento sem roteiro formal depende da memória de quem faz.' },
  { id: 'D5-08', dim: 'contabil', sub: 'Vínculo documento-lançamento', weight: 3, action: 'Reforçar rastreabilidade documento–contabilidade.', reason: 'Sem rastreabilidade, responder a uma fiscalização exige reconstruir manualmente a origem de cada número.' },
  { id: 'D5-09', dim: 'contabil', sub: 'Intercompany e consolidação', weight: 2, action: 'Padronizar contabilização e conciliação intercompany.', reason: 'Eliminar intercompany sem preservar a trilha tributária dificulta explicar depois a origem de um crédito.' },
  { id: 'D5-10', dim: 'contabil', sub: 'Divulgações', weight: 1, action: 'Preparar divulgações e comunicação financeira.', reason: 'Não divulgar um efeito material da transição pode comprometer a confiança de sócios e financiadores.' },
  { id: 'D5-11', dim: 'contabil', sub: 'Evidência para auditoria', weight: 2, action: 'Definir pacote padrão de evidências.', reason: 'Documentação organizada só para uso interno raramente resiste ao padrão de um auditor externo.' },
  { id: 'D5-12', dim: 'contabil', sub: 'Reporting gerencial', weight: 1, action: 'Criar reporting gerencial integrado.', reason: 'Relatórios fragmentados obrigam a diretoria a montar o quadro completo na cabeça — e frequentemente não monta.' },

  { id: 'D6-01', dim: 'tributario', sub: 'Mapa de operações', weight: 3, action: 'Construir mapa tributário de operações.', reason: 'Sem o mapa completo é impossível saber quantas regras de IBS/CBS a empresa realmente precisa configurar.' },
  { id: 'D6-02', dim: 'tributario', sub: 'NCM e NBS', weight: 3, action: 'Executar saneamento de NCM/NBS.', reason: 'Classificação errada de NCM/NBS é a causa mais comum de tributo calculado errado em escala.' },
  { id: 'D6-03', dim: 'tributario', sub: 'CST e cClassTrib', weight: 3, action: 'Implantar motor de classificação tributária.', reason: 'cClassTrib sem fundamento documentado vira escolha arbitrária difícil de defender numa fiscalização.' },
  { id: 'D6-04', dim: 'tributario', sub: 'Sistema atual', weight: 2, action: 'Consolidar baseline tributário atual.', reason: 'Sem o baseline do sistema atual, fica impossível validar se a migração preservou benefícios e regimes.' },
  { id: 'D6-05', dim: 'tributario', sub: 'Incidência IBS/CBS', weight: 3, action: 'Modelar regra IBS/CBS por operação.', reason: 'A regra de incidência varia por local, natureza da operação e sujeito passivo — sem modelar, o motor erra nos casos específicos.' },
  { id: 'D6-06', dim: 'tributario', sub: 'Elegibilidade de crédito', weight: 3, action: 'Criar motor de elegibilidade de créditos.', reason: 'Assumir crédito integral sem checar elegibilidade é a forma mais comum de superestimar o crédito disponível.' },
  { id: 'D6-07', dim: 'tributario', sub: 'Regimes diferenciados', weight: 3, action: 'Mapear tratamentos diferenciados e específicos.', reason: 'Deixar de identificar um regime diferenciado aplicável significa pagar mais tributo do que o devido.' },
  { id: 'D6-08', dim: 'tributario', sub: 'Comércio exterior', weight: 3, action: 'Construir matriz de comércio exterior.', reason: 'Operações de comércio exterior têm regras próprias que afetam diretamente a competitividade de preço.' },
  { id: 'D6-09', dim: 'tributario', sub: 'Agronegócio', weight: 3, action: 'Modelar cadeias agro por operação e perfil.', reason: 'O agronegócio tem operações (barter, CPR, armazenagem) com tratamento muito diferente entre si.' },
  { id: 'D6-10', dim: 'tributario', sub: 'Simples Nacional', weight: 2, action: 'Comparar Simples versus regime regular.', reason: 'Comprar de ou vender para uma empresa do Simples tem efeito de crédito diferente do regime regular.' },
  { id: 'D6-11', dim: 'tributario', sub: 'Documentos fiscais', weight: 3, action: 'Executar adequação e testes de DF-e.', reason: 'Um leiaute não adequado a tempo trava a emissão do documento — e, portanto, a venda.' },
  { id: 'D6-12', dim: 'tributario', sub: 'Apuração assistida', weight: 3, action: 'Desenhar fechamento e apuração assistida.', reason: 'Sem desenhar o processo antes, o fechamento tributário do primeiro mês real vira um exercício às cegas.' },

  { id: 'D7-01', dim: 'operacional', sub: 'Mapeamento de processos', weight: 3, action: 'Mapear processos críticos ponta a ponta.', reason: 'Sem o mapa ponta a ponta, o time redesenha de memória e esquece etapas.' },
  { id: 'D7-02', dim: 'operacional', sub: 'Donos de processo', weight: 2, action: 'Nomear donos dos processos críticos.', reason: 'Um processo sem dono claro não tem quem decida os ajustes nem quem responda quando algo falha.' },
  { id: 'D7-03', dim: 'operacional', sub: 'Treinamento por função', weight: 2, action: 'Implantar trilhas de capacitação por função.', reason: 'Treinamento genérico "sobre a reforma" ensina pouco do que cada função precisa mudar na prática.' },
  { id: 'D7-04', dim: 'operacional', sub: 'Gestão da mudança', weight: 2, action: 'Criar plano formal de gestão da mudança.', reason: 'Mudança tratada só como projeto técnico ignora a resistência natural das pessoas.' },
  { id: 'D7-05', dim: 'operacional', sub: 'Comportamento comercial', weight: 2, action: 'Capacitar e revisar políticas comerciais.', reason: 'Vendedor negociando sem entender o efeito no crédito do cliente pode destruir margem sem perceber.' },
  { id: 'D7-06', dim: 'operacional', sub: 'Comportamento de compras', weight: 2, action: 'Revisar critérios e treinamento de compras.', reason: 'Comprador que decide só pelo preço bruto pode escolher sistematicamente o fornecedor mais caro em custo líquido.' },
  { id: 'D7-07', dim: 'operacional', sub: 'Procedimentos operacionais', weight: 2, action: 'Atualizar procedimentos operacionais.', reason: 'Time seguindo POP desatualizado reproduz o erro do processo antigo mesmo depois do sistema mudar.' },
  { id: 'D7-08', dim: 'operacional', sub: 'Contingência operacional', weight: 2, action: 'Criar e testar contingência operacional.', reason: 'Sem plano de contingência, instabilidade nos sistemas oficiais pode parar a emissão de documento fiscal.' },
  { id: 'D7-09', dim: 'operacional', sub: 'Incentivos e metas', weight: 1, action: 'Revisar metas e incentivos conflitantes.', reason: 'Meta baseada só em volume pode incentivar negócios que parecem bons mas destroem valor.' },
  { id: 'D7-10', dim: 'operacional', sub: 'Rituais interfuncionais', weight: 2, action: 'Implantar ritos interfuncionais.', reason: 'Sem rito recorrente entre áreas, dependências cruzadas ficam invisíveis até virarem atraso.' },
  { id: 'D7-11', dim: 'operacional', sub: 'Prontidão da linha de frente', weight: 2, action: 'Aplicar testes de prontidão e reciclagem.', reason: 'Usuário que só opera com ajuda constante de um colega não está realmente pronto.' },
  { id: 'D7-12', dim: 'operacional', sub: 'Lições aprendidas', weight: 1, action: 'Criar ciclo de melhoria contínua.', reason: 'Sem ciclo formal de lições aprendidas, o mesmo erro tende a se repetir em produção.' },

  { id: 'D8-01', dim: 'sistemas', sub: 'Roadmap do ERP', weight: 3, action: 'Formalizar plano de adequação do ERP.', reason: 'Descobrir tarde que o roadmap do fornecedor não bate com o calendário legal deixa a empresa sem plano B.' },
  { id: 'D8-02', dim: 'sistemas', sub: 'Ambientes', weight: 3, action: 'Revisar ambientes e governança de transportes.', reason: 'Testar mudança tributária direto em produção expõe a operação real a erro de configuração.' },
  { id: 'D8-03', dim: 'sistemas', sub: 'Leiautes DF-e', weight: 3, action: 'Executar bateria de testes de DF-e.', reason: 'Um campo obrigatório não implementado a tempo faz o documento ser rejeitado, parando a venda.' },
  { id: 'D8-04', dim: 'sistemas', sub: 'Dados mestres', weight: 3, action: 'Implantar governança de dados mestres.', reason: 'Motor tributário bem configurado não compensa cadastro de baixa qualidade — o erro se propaga.' },
  { id: 'D8-05', dim: 'sistemas', sub: 'Motor tributário', weight: 3, action: 'Estruturar motor tributário auditável.', reason: 'Regra espalhada em vários sistemas é impossível de auditar e corrigir rapidamente.' },
  { id: 'D8-06', dim: 'sistemas', sub: 'Integrações', weight: 3, action: 'Mapear e testar integrações ponta a ponta.', reason: 'Uma integração não mapeada é um ponto cego quando falha.' },
  { id: 'D8-07', dim: 'sistemas', sub: 'APIs e portais', weight: 2, action: 'Implantar governança de APIs e portais.', reason: 'Certificado vencido ou robô sem monitoramento é causa comum e boba de parada de operação fiscal.' },
  { id: 'D8-08', dim: 'sistemas', sub: 'Acessos e segurança', weight: 3, action: 'Revisar RBAC e segregação de acesso.', reason: 'Acesso mal segregado permite configurar e aprovar regra tributária sem checagem cruzada.' },
  { id: 'D8-09', dim: 'sistemas', sub: 'Testes integrados', weight: 3, action: 'Criar suíte completa de testes.', reason: 'Testar só o caminho feliz deixa passar exatamente os casos que mais geram problema em produção.' },
  { id: 'D8-10', dim: 'sistemas', sub: 'Logs e observabilidade', weight: 2, action: 'Implantar observabilidade tributária.', reason: 'Sem observabilidade, uma taxa crescente de rejeição só é percebida quando já é grande.' },
  { id: 'D8-11', dim: 'sistemas', sub: 'Backup e contingência', weight: 2, action: 'Testar backup e recuperação.', reason: 'Backup nunca restaurado em teste não é garantia — a hora de descobrir que falha não pode ser num incidente real.' },
  { id: 'D8-12', dim: 'sistemas', sub: 'Capacidade de fornecedores', weight: 2, action: 'Revalidar capacidade e SLA dos fornecedores.', reason: 'Fornecedor crítico sem SLA claro pode deixar a empresa sem suporte no pico de demanda.' },
];

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function main() {
  const questionIds = ROWS.map((r) => `rt_${r.id}`);
  const [existingRows, falQuestions] = await Promise.all([
    prisma.falQuestionActionLibrary.findMany({
      where: { questionId: { in: questionIds } },
      select: { questionId: true },
    }),
    prisma.falQuestion.findMany({
      where: { questionId: { in: questionIds } },
      select: { questionId: true, evidenceHint: true, guidance: true },
    }),
  ]);
  const existingIds = new Set(existingRows.map((r) => r.questionId));
  // expected_evidence/how_to_execute reaproveitam o mesmo conteúdo já
  // escrito em fal_questions (seed-tax-reform-method.ts) — evita duplicar
  // 96 textos longos aqui; fonte única de verdade fica na pergunta.
  const evidenceByQuestionId = new Map(falQuestions.map((q) => [q.questionId, q.evidenceHint]));
  const guidanceByQuestionId = new Map(falQuestions.map((q) => [q.questionId, q.guidance]));

  let created = 0;
  let skipped = 0;
  for (const r of ROWS) {
    const questionId = `rt_${r.id}`;
    if (existingIds.has(questionId)) { skipped++; continue; }
    const subKey = slugify(r.sub);
    await prisma.falQuestionActionLibrary.create({
      data: {
        questionId,
        dimensionKey: r.dim,
        subdimensionKey: subKey,
        clusterKey: `${subKey}_cluster`,
        sectorGroup: 'geral',
        triggerScoreMax: 2,
        actionType: 'implantacao',
        actionTitle: r.action,
        actionDescription: r.reason,
        howToExecute: guidanceByQuestionId.get(questionId) || null,
        expectedEvidence: evidenceByQuestionId.get(questionId) || null,
        reasonTemplate: `${r.reason} Nota atual: {score}/3.`,
        impactLevel: r.weight === 3 ? 5 : r.weight === 2 ? 4 : 3,
        effortLevel: 3,
        responsibleRole: DIMENSION_OWNER[r.dim] || null,
        isActive: true,
      },
    });
    created++;
  }
  console.log(`${created} FalQuestionActionLibrary criada(s), ${skipped} já existiam.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
