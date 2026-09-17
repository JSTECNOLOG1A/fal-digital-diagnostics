/**
 * Lote 7 da reescrita do FAL 8D clássico — dimensão "financeiro" (60 perguntas).
 * Ver update-fal8d-practical-actions-sistemas.ts para o contexto completo.
 * Rodar com: npx tsx prisma/update-fal8d-practical-actions-financeiro.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

type Row = { id: string; title: string; checklist: string; evidence: string };

const ROWS: Row[] = [
  // carteira_clientes
  { id: 'financeiro_carteira_clientes_001', title: 'Implantar cadastro e histórico comercial atualizado de clientes',
    checklist: '1) Levantar os dados mínimos que todo cliente deveria ter cadastrado (documento, contato, histórico de compra). 2) Verificar o cadastro atual e identificar lacunas. 3) Atualizar os cadastros incompletos, priorizando os clientes mais relevantes. 4) Definir responsável por manter o cadastro atualizado. 5) Definir rotina de atualização contínua.',
    evidence: 'Cadastro de clientes atualizado, com histórico comercial disponível para os clientes mais relevantes.' },
  { id: 'financeiro_carteira_clientes_002', title: 'Implantar acompanhamento de concentração e risco por cliente',
    checklist: '1) Calcular a participação de cada cliente no faturamento total. 2) Identificar concentração relevante (poucos clientes representando grande parte da receita). 3) Levantar o histórico de inadimplência por cliente. 4) Consolidar numa visão única de risco por cliente. 5) Revisar periodicamente.',
    evidence: 'Análise de concentração e inadimplência por cliente, revisada no último período.' },
  { id: 'financeiro_carteira_clientes_003', title: 'Segmentar a carteira de clientes para orientar ações comerciais e de crédito',
    checklist: '1) Definir critérios de segmentação (volume, risco, potencial, relacionamento). 2) Classificar a carteira atual conforme os critérios. 3) Definir ações diferentes por segmento (limite de crédito, prioridade comercial). 4) Aplicar a segmentação nas próximas decisões. 5) Revisar a segmentação periodicamente.',
    evidence: 'Carteira de clientes segmentada, com ações comerciais/crédito diferenciadas por segmento.' },
  { id: 'financeiro_carteira_clientes_004', title: 'Vincular mudanças relevantes na carteira à revisão de estratégia/limites',
    checklist: '1) Definir o que é uma mudança relevante (perda de cliente grande, novo cliente importante, aumento de inadimplência). 2) Definir que essa mudança dispara uma revisão da estratégia/limites comerciais. 3) Testar com a próxima mudança relevante que ocorrer. 4) Registrar a revisão e a decisão tomada. 5) Manter essa prática como rotina.',
    evidence: 'Pelo menos uma mudança relevante de carteira recente com revisão de estratégia/limites registrada.' },
  // indicadores_operacionais
  { id: 'financeiro_indicadores_operacionais_001', title: 'Definir e medir indicadores operacionais relevantes',
    checklist: '1) Identificar os indicadores mais relevantes para a atividade (produtividade, eficiência, perdas, capacidade). 2) Definir a fonte de dado de cada um. 3) Começar a medir regularmente. 4) Consolidar num painel simples. 5) Compartilhar com a gestão.',
    evidence: 'Indicadores operacionais definidos e medidos regularmente, consolidados num painel.' },
  { id: 'financeiro_indicadores_operacionais_002', title: 'Implantar comparação de indicadores operacionais com meta/padrão',
    checklist: '1) Definir meta ou padrão de referência para cada indicador (histórico, benchmark do setor). 2) Comparar o resultado medido com a meta/padrão periodicamente. 3) Identificar indicadores fora do esperado. 4) Discutir com a área responsável. 5) Registrar o resultado da comparação.',
    evidence: 'Comparação de indicadores operacionais com meta/padrão do último período, com desvios discutidos.' },
  { id: 'financeiro_indicadores_operacionais_003', title: 'Usar indicadores operacionais para corrigir falhas',
    checklist: '1) Priorizar os indicadores com maior desvio da meta. 2) Investigar a causa do desvio junto à área responsável. 3) Definir ação corretiva. 4) Implementar e acompanhar o efeito no indicador. 5) Documentar o ciclo (desvio → causa → ação → resultado).',
    evidence: 'Pelo menos um ciclo de correção documentado a partir de um indicador operacional (desvio, causa, ação, resultado).' },
  { id: 'financeiro_indicadores_operacionais_004', title: 'Criar rotina de revisão dos indicadores operacionais',
    checklist: '1) Definir periodicidade de revisão (ex.: semestral). 2) Avaliar se os indicadores atuais ainda refletem o que importa para o negócio. 3) Verificar a confiabilidade da fonte de dado. 4) Ajustar/substituir indicadores que perderam utilidade. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica dos indicadores operacionais, com ajustes aplicados quando necessário.' },
  // planejamento_estrategico
  { id: 'financeiro_planejamento_estrategico_001', title: 'Definir objetivos estratégicos claros para o negócio',
    checklist: '1) Reunir a liderança/sócios para discutir onde a empresa quer chegar. 2) Definir objetivos claros e mensuráveis (não genéricos). 3) Priorizar os 3-5 objetivos mais importantes do período. 4) Documentar formalmente. 5) Comunicar aos gestores/equipe.',
    evidence: 'Objetivos estratégicos documentados e comunicados à liderança/equipe.' },
  { id: 'financeiro_planejamento_estrategico_002', title: 'Desdobrar objetivos estratégicos em metas, responsáveis e prazos',
    checklist: '1) Pegar cada objetivo estratégico definido. 2) Quebrar em metas específicas e mensuráveis. 3) Atribuir responsável e prazo a cada meta. 4) Comunicar o desdobramento aos responsáveis. 5) Registrar num plano único.',
    evidence: 'Plano com metas, responsáveis e prazos desdobrados de cada objetivo estratégico.' },
  { id: 'financeiro_planejamento_estrategico_003', title: 'Implantar acompanhamento e correção de desvios do planejamento estratégico',
    checklist: '1) Definir rito de acompanhamento periódico (ex.: mensal ou trimestral). 2) Comparar o executado com o planejado em cada meta. 3) Identificar desvios relevantes. 4) Definir ação corretiva para os desvios. 5) Registrar o acompanhamento realizado.',
    evidence: 'Registro de acompanhamento do planejamento estratégico do último período, com ações corretivas aplicadas.' },
  { id: 'financeiro_planejamento_estrategico_004', title: 'Criar rotina de revisão do planejamento estratégico',
    checklist: '1) Definir periodicidade de revisão (ex.: anual). 2) Avaliar os resultados do período frente aos objetivos. 3) Considerar mudanças de contexto (mercado, regulação, operação). 4) Ajustar os objetivos/metas para o próximo ciclo. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica do planejamento estratégico, com objetivos ajustados para o próximo ciclo.' },
  // estrutura_capital
  { id: 'financeiro_estrutura_capital_001', title: 'Implantar acompanhamento de posição de caixa e dívidas',
    checklist: '1) Levantar todas as dívidas e compromissos financeiros ativos. 2) Consolidar numa visão única (valor, prazo, taxa, garantia). 3) Cruzar com a posição de caixa atual. 4) Atualizar essa visão periodicamente. 5) Compartilhar com a gestão.',
    evidence: 'Visão consolidada de caixa e dívidas, atualizada no último período.' },
  { id: 'financeiro_estrutura_capital_002', title: 'Implantar análise de indicadores de liquidez e endividamento',
    checklist: '1) Calcular os indicadores básicos (liquidez corrente, endividamento, alavancagem). 2) Comparar com histórico ou benchmark do setor. 3) Identificar sinais de alerta. 4) Discutir com a gestão. 5) Repetir periodicamente.',
    evidence: 'Indicadores de liquidez/endividamento/alavancagem calculados e discutidos no último período.' },
  { id: 'financeiro_estrutura_capital_003', title: 'Basear decisões de captação/renegociação em análise financeira formal',
    checklist: '1) Definir que toda decisão relevante de dívida passa por análise prévia (custo, prazo, impacto no caixa). 2) Elaborar essa análise antes da próxima decisão. 3) Comparar alternativas disponíveis. 4) Levar à aprovação da gestão. 5) Registrar o racional da decisão.',
    evidence: 'Pelo menos uma decisão de captação/renegociação recente com análise financeira documentada.' },
  { id: 'financeiro_estrutura_capital_004', title: 'Criar rotina de revisão da estrutura de capital',
    checklist: '1) Definir periodicidade de revisão (ex.: anual). 2) Avaliar se a estrutura atual (proporção dívida/capital próprio) ainda é adequada ao risco do negócio. 3) Avaliar a capacidade de pagamento futura. 4) Ajustar a estratégia de capital se necessário. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica da estrutura de capital, com decisões documentadas.' },
  // relacionamento_bancario
  { id: 'financeiro_relacionamento_bancario_001', title: 'Implantar controle de limites, custos e condições bancárias',
    checklist: '1) Levantar os limites, taxas e condições vigentes com cada banco. 2) Consolidar numa base única atualizada. 3) Definir responsável por manter atualizado. 4) Revisar sempre que houver mudança de condição. 5) Usar essa base nas próximas negociações.',
    evidence: 'Base atualizada de limites/condições bancárias por instituição.' },
  { id: 'financeiro_relacionamento_bancario_002', title: 'Implantar comparação de propostas entre instituições financeiras',
    checklist: '1) Antes de contratar uma nova linha, solicitar proposta de mais de uma instituição. 2) Comparar taxa, prazo, garantia exigida e custo total. 3) Documentar a comparação. 4) Escolher com base na comparação, não só no relacionamento existente. 5) Registrar a decisão e o racional.',
    evidence: 'Pelo menos uma comparação de propostas entre instituições documentada na última contratação relevante.' },
  { id: 'financeiro_relacionamento_bancario_003', title: 'Usar o relacionamento bancário estrategicamente',
    checklist: '1) Mapear os produtos/serviços que cada banco oferece além de crédito (câmbio, seguro, cash management). 2) Avaliar oportunidades de negociar melhores condições com base no relacionamento (volume, tempo de conta). 3) Priorizar os bancos mais estratégicos. 4) Negociar condições melhores usando essa posição. 5) Registrar o resultado das negociações.',
    evidence: 'Pelo menos uma negociação bancária recente com condição melhorada, registrada.' },
  { id: 'financeiro_relacionamento_bancario_004', title: 'Criar rotina de revisão das condições bancárias',
    checklist: '1) Definir periodicidade de revisão (ex.: anual). 2) Avaliar se a situação financeira da empresa melhorou (permitindo negociar taxas melhores). 3) Rever as condições vigentes com os bancos. 4) Renegociar quando fizer sentido. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica das condições bancárias, com renegociação quando aplicável.' },
  // posicionamento_mercado
  { id: 'financeiro_posicionamento_mercado_001', title: 'Definir claramente o posicionamento de mercado da empresa',
    checklist: '1) Levantar os principais concorrentes e como a empresa se diferencia deles. 2) Definir a proposta de valor para o cliente de forma clara. 3) Validar essa definição com a liderança. 4) Documentar formalmente. 5) Comunicar internamente (especialmente ao time comercial).',
    evidence: 'Posicionamento de mercado documentado e comunicado ao time comercial.' },
  { id: 'financeiro_posicionamento_mercado_002', title: 'Avaliar coerência entre preço, proposta de valor e canais com o posicionamento',
    checklist: '1) Pegar o posicionamento já definido. 2) Verificar se o preço praticado é coerente com ele. 3) Verificar se os canais de venda usados fazem sentido para o posicionamento. 4) Identificar incoerências. 5) Corrigir o que estiver desalinhado.',
    evidence: 'Análise de coerência entre preço/canais e posicionamento, com ajustes aplicados quando necessário.' },
  { id: 'financeiro_posicionamento_mercado_003', title: 'Vincular mudanças de mercado a ajustes de posicionamento',
    checklist: '1) Definir os sinais de mudança de mercado a observar (novo concorrente, mudança de preço, nova tecnologia). 2) Definir que sinais relevantes disparam uma avaliação de posicionamento. 3) Testar com a próxima mudança relevante. 4) Registrar o ajuste feito (ou a decisão de manter). 5) Manter essa prática como rotina.',
    evidence: 'Pelo menos um ajuste de posicionamento recente motivado por mudança de mercado, documentado.' },
  { id: 'financeiro_posicionamento_mercado_004', title: 'Criar rotina de revisão periódica do posicionamento de mercado',
    checklist: '1) Definir periodicidade de revisão (ex.: anual). 2) Reunir dados de mercado e desempenho do período. 3) Avaliar se o posicionamento ainda é o mais adequado. 4) Ajustar se necessário. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica do posicionamento de mercado, com base em dados do período.' },
  // gestao_caixa
  { id: 'financeiro_gestao_caixa_001', title: 'Implantar registro tempestivo e confiável de entradas e saídas de caixa',
    checklist: '1) Definir o processo de registro (sistema ou planilha) e a frequência (diária recomendada). 2) Definir responsável pelo registro. 3) Testar a confiabilidade comparando com extrato bancário. 4) Corrigir divergências encontradas. 5) Manter o registro atualizado diariamente.',
    evidence: 'Registro de caixa diário conferido com extrato bancário, sem divergências relevantes.' },
  { id: 'financeiro_gestao_caixa_002', title: 'Implantar projeção de fluxo de caixa com comparação previsto x realizado',
    checklist: '1) Montar uma projeção de caixa para as próximas semanas/meses. 2) Definir a periodicidade de atualização. 3) Comparar o realizado com o previsto a cada período. 4) Investigar desvios relevantes. 5) Ajustar a projeção com base no aprendizado.',
    evidence: 'Projeção de fluxo de caixa com comparação previsto x realizado do último período.' },
  { id: 'financeiro_gestao_caixa_003', title: 'Criar rotina de análise e tratativa de desvios de caixa',
    checklist: '1) Definir o que é um desvio relevante de caixa. 2) Definir um canal para reportar à gestão rapidamente. 3) Investigar a causa do desvio. 4) Definir ação corretiva. 5) Registrar a tratativa e o resultado.',
    evidence: 'Registro de pelo menos um desvio de caixa relevante com análise e tratativa da gestão.' },
  { id: 'financeiro_gestao_caixa_004', title: 'Usar o fluxo de caixa como base para decisões financeiras',
    checklist: '1) Definir que toda decisão de pagamento relevante, captação ou investimento consulta o fluxo de caixa projetado. 2) Testar essa prática nas próximas decisões. 3) Registrar se o fluxo de caixa influenciou a decisão. 4) Ajustar o processo se a prática não estiver sendo seguida. 5) Reforçar com a gestão a importância dessa consulta.',
    evidence: 'Pelo menos uma decisão financeira relevante recente com consulta ao fluxo de caixa documentada.' },
  // modelo_negocio
  { id: 'financeiro_modelo_negocio_001', title: 'Mapear claramente como o negócio gera receita, margem e valor',
    checklist: '1) Descrever as fontes de receita da empresa. 2) Para cada uma, identificar a margem aproximada. 3) Identificar o que gera valor real para o cliente em cada fonte. 4) Documentar essa visão de forma simples. 5) Validar com a liderança.',
    evidence: 'Documento simples descrevendo fontes de receita, margem aproximada e valor gerado, validado pela liderança.' },
  { id: 'financeiro_modelo_negocio_002', title: 'Implantar acompanhamento de resultado por produto/cliente/operação',
    checklist: '1) Definir a unidade de análise (produto, cliente, operação, unidade de negócio). 2) Calcular o resultado (margem) por unidade. 3) Identificar os que mais e os que menos geram resultado. 4) Compartilhar com a gestão. 5) Atualizar periodicamente.',
    evidence: 'Análise de resultado por produto/cliente/operação do último período, compartilhada com a gestão.' },
  { id: 'financeiro_modelo_negocio_003', title: 'Criar critério padrão de avaliação de novos negócios/investimentos',
    checklist: '1) Definir os critérios mínimos de avaliação (retorno esperado, prazo de payback, risco). 2) Criar um template simples para essa avaliação. 3) Aplicar o template na próxima oportunidade de negócio/investimento avaliada. 4) Levar à decisão da gestão com base nessa avaliação. 5) Registrar a decisão e o racional.',
    evidence: 'Template de avaliação de novo negócio/investimento aplicado na oportunidade mais recente.' },
  { id: 'financeiro_modelo_negocio_004', title: 'Criar rotina de revisão do modelo de negócio',
    checklist: '1) Definir periodicidade de revisão (ex.: anual). 2) Avaliar o desempenho por fonte de receita/produto do período. 3) Considerar mudanças relevantes de mercado. 4) Ajustar o modelo (foco, mix, precificação) se necessário. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica do modelo de negócio, com ajustes aplicados quando necessário.' },
  // indicadores_comerciais
  { id: 'financeiro_indicadores_comerciais_001', title: 'Definir e atualizar indicadores comerciais regularmente',
    checklist: '1) Definir os indicadores comerciais mais relevantes (conversão, ticket médio, volume, margem). 2) Definir a fonte de dado de cada um. 3) Começar a medir regularmente. 4) Consolidar num painel simples. 5) Compartilhar com o time comercial.',
    evidence: 'Indicadores comerciais definidos e atualizados regularmente, compartilhados com o time comercial.' },
  { id: 'financeiro_indicadores_comerciais_002', title: 'Implantar comparação de desempenho comercial',
    checklist: '1) Definir metas por equipe/canal/período. 2) Comparar o resultado real com a meta periodicamente. 3) Identificar desvios relevantes. 4) Discutir com o time comercial. 5) Registrar o resultado da comparação.',
    evidence: 'Comparação de desempenho comercial do último período, com desvios discutidos com o time.' },
  { id: 'financeiro_indicadores_comerciais_003', title: 'Usar indicadores comerciais para corrigir ações de venda/precificação',
    checklist: '1) Priorizar os indicadores com maior desvio. 2) Investigar a causa (preço, produto, equipe, canal). 3) Definir ação corretiva. 4) Implementar e acompanhar o efeito. 5) Documentar o ciclo completo.',
    evidence: 'Pelo menos um ciclo de correção documentado a partir de um indicador comercial.' },
  { id: 'financeiro_indicadores_comerciais_004', title: 'Criar rotina de revisão dos indicadores comerciais',
    checklist: '1) Definir periodicidade de revisão (ex.: semestral). 2) Avaliar se os indicadores atuais refletem a estratégia comercial vigente. 3) Ajustar/substituir indicadores desalinhados. 4) Comunicar mudanças ao time. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica dos indicadores comerciais, com ajustes aplicados quando necessário.' },
  // acompanhamento_resultados
  { id: 'financeiro_acompanhamento_resultados_001', title: 'Implantar apuração de resultados por período com dados confiáveis',
    checklist: '1) Definir a periodicidade de apuração (mensal recomendado). 2) Verificar a confiabilidade da fonte de dados (contábil, gerencial). 3) Padronizar o formato de apuração. 4) Aplicar no próximo período. 5) Validar os números com a contabilidade/financeiro.',
    evidence: 'Apuração de resultado do último período, validada com dados confiáveis.' },
  { id: 'financeiro_acompanhamento_resultados_002', title: 'Implantar comparação de resultados com meta/orçamento/histórico',
    checklist: '1) Definir a meta/orçamento de referência. 2) Comparar o resultado apurado com essa referência a cada período. 3) Calcular o desvio. 4) Discutir com a gestão. 5) Registrar a comparação.',
    evidence: 'Comparação de resultado realizado vs. meta/orçamento do último período, discutida com a gestão.' },
  { id: 'financeiro_acompanhamento_resultados_003', title: 'Implantar análise de causa das principais variações de resultado',
    checklist: '1) Priorizar as variações mais relevantes do período. 2) Investigar a causa de cada uma (volume, preço, custo, despesa). 3) Documentar a explicação. 4) Compartilhar com a gestão. 5) Repetir a cada período.',
    evidence: 'Análise de causa das principais variações de resultado do último período, documentada.' },
  { id: 'financeiro_acompanhamento_resultados_004', title: 'Vincular análises de resultado a decisões e planos de ação acompanhados',
    checklist: '1) Definir que toda análise relevante de resultado gera uma decisão ou plano de ação. 2) Registrar a decisão/ação decorrente de cada análise. 3) Definir responsável e prazo. 4) Acompanhar a execução no rito de gestão. 5) Verificar o efeito da ação no resultado seguinte.',
    evidence: 'Pelo menos um plano de ação decorrente de análise de resultado, acompanhado até a conclusão.' },
  // financas_agro_cpr_barter
  { id: 'financeiro_financas_agro_cpr_barter_001', title: 'Implantar controle central de CPR, barter e financiamentos de safra',
    checklist: '1) Levantar todas as operações ativas (CPR, barter, custeio, financiamento). 2) Registrar cada uma numa base única (valor, vencimento, garantia, contraparte). 3) Consolidar a exposição total. 4) Definir responsável por manter atualizado. 5) Revisar periodicamente.',
    evidence: 'Base central de operações de CPR/barter/financiamento de safra, atualizada.' },
  { id: 'financeiro_financas_agro_cpr_barter_002', title: 'Implantar acompanhamento de vencimentos e exposição de operações agro',
    checklist: '1) Usar a base já criada. 2) Definir alertas de vencimento com antecedência. 3) Calcular o custo financeiro efetivo de cada operação. 4) Consolidar a exposição total por contraparte/tipo. 5) Reportar à gestão periodicamente.',
    evidence: 'Acompanhamento de vencimentos e exposição das operações agro, com alertas configurados.' },
  { id: 'financeiro_financas_agro_cpr_barter_003', title: 'Formalizar análise de custo, risco e caixa antes de contratar operação agro',
    checklist: '1) Definir que toda nova operação (CPR, barter, crédito rural) passa por análise prévia. 2) Comparar o custo efetivo com alternativas disponíveis. 3) Avaliar o impacto no fluxo de caixa projetado. 4) Levar à aprovação da gestão. 5) Registrar o racional da decisão.',
    evidence: 'Pelo menos uma operação agro recente com análise de custo/risco/caixa documentada antes da contratação.' },
  { id: 'financeiro_financas_agro_cpr_barter_004', title: 'Criar rotina de revisão da eficiência financeira das operações agro',
    checklist: '1) Definir periodicidade de revisão (ex.: por safra). 2) Avaliar se as operações contratadas foram eficientes (custo real vs. esperado). 3) Avaliar os riscos materializados no período. 4) Ajustar a estratégia de financiamento da próxima safra. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica das operações agro, com ajustes aplicados na estratégia de financiamento.' },
  // planejamento_financeiro
  { id: 'financeiro_planejamento_financeiro_001', title: 'Elaborar orçamento/projeção financeira formal',
    checklist: '1) Definir o horizonte do orçamento (anual recomendado, com detalhamento mensal). 2) Reunir premissas de receita, custo e investimento. 3) Elaborar o orçamento com a liderança. 4) Aprovar formalmente. 5) Comunicar às áreas responsáveis.',
    evidence: 'Orçamento/projeção financeira formal aprovado para o próximo período.' },
  { id: 'financeiro_planejamento_financeiro_002', title: 'Implantar comparação de realizado vs. orçado',
    checklist: '1) Definir periodicidade de comparação (mensal recomendado). 2) Comparar receita, custo e investimento realizado com o orçado. 3) Calcular os desvios. 4) Discutir com a gestão. 5) Registrar a comparação.',
    evidence: 'Comparação realizado vs. orçado do último período, discutida com a gestão.' },
  { id: 'financeiro_planejamento_financeiro_003', title: 'Implantar análise e ação corretiva para desvios financeiros',
    checklist: '1) Priorizar os desvios mais relevantes entre realizado e orçado. 2) Investigar a causa de cada um. 3) Definir ação corretiva. 4) Implementar e acompanhar. 5) Documentar o ciclo completo.',
    evidence: 'Pelo menos um desvio financeiro relevante com análise de causa e ação corretiva documentada.' },
  { id: 'financeiro_planejamento_financeiro_004', title: 'Criar rotina de atualização do planejamento financeiro',
    checklist: '1) Definir periodicidade de atualização (ex.: trimestral, revisão do orçado). 2) Incorporar mudanças relevantes do negócio (nova operação, mudança de mercado). 3) Ajustar as premissas e o orçamento. 4) Aprovar a atualização com a gestão. 5) Comunicar às áreas.',
    evidence: 'Registro de atualização periódica do planejamento financeiro, aprovada pela gestão.' },
  // inteligencia_mercado
  { id: 'financeiro_inteligencia_mercado_001', title: 'Implantar acompanhamento sistemático de mercado',
    checklist: '1) Definir as fontes de informação de mercado (associações, cotações, concorrentes). 2) Definir quem acompanha e com que frequência. 3) Consolidar as informações num formato simples. 4) Compartilhar com a gestão/comercial. 5) Manter atualizado continuamente.',
    evidence: 'Registro de acompanhamento de mercado atualizado, compartilhado com a gestão/comercial.' },
  { id: 'financeiro_inteligencia_mercado_002', title: 'Transformar informação de mercado em análise para decisão comercial',
    checklist: '1) Pegar as informações de mercado já coletadas. 2) Traduzir em implicações práticas (preço a praticar, momento de compra/venda). 3) Apresentar essa análise à área comercial. 4) Usar na próxima decisão comercial relevante. 5) Registrar se a análise influenciou a decisão.',
    evidence: 'Pelo menos uma análise de mercado traduzida em decisão comercial, documentada.' },
  { id: 'financeiro_inteligencia_mercado_003', title: 'Vincular mudanças de mercado a decisões de preço/portfólio/compra/venda',
    checklist: '1) Definir os sinais de mudança de mercado a monitorar. 2) Definir que sinais relevantes disparam reavaliação de preço/portfólio/compra/venda. 3) Testar com a próxima mudança relevante. 4) Registrar a decisão tomada. 5) Manter essa prática como rotina.',
    evidence: 'Pelo menos uma decisão de preço/portfólio/compra/venda recente motivada por mudança de mercado, documentada.' },
  { id: 'financeiro_inteligencia_mercado_004', title: 'Formalizar rotina de atualização e discussão de informações de mercado',
    checklist: '1) Definir periodicidade da rotina (ex.: semanal ou quinzenal). 2) Definir quem participa (comercial, gestão, compras). 3) Definir pauta padrão. 4) Rodar a rotina por algumas semanas. 5) Registrar as discussões e decisões.',
    evidence: 'Calendário de rotina de discussão de mercado, com atas registradas.' },
  // estrategia_comercial
  { id: 'financeiro_estrategia_comercial_001', title: 'Definir metas comerciais estruturadas',
    checklist: '1) Definir o horizonte das metas (mensal, trimestral, anual). 2) Desdobrar as metas por equipe, canal ou produto conforme relevante. 3) Validar as metas com quem vai executá-las. 4) Comunicar formalmente. 5) Usar como referência de acompanhamento.',
    evidence: 'Metas comerciais definidas por período/equipe/canal/produto, comunicadas ao time.' },
  { id: 'financeiro_estrategia_comercial_002', title: 'Implantar acompanhamento de conversão, volume e margem de vendas',
    checklist: '1) Definir os indicadores a acompanhar (taxa de conversão, volume, margem). 2) Definir a fonte de dado e a frequência de acompanhamento. 3) Consolidar num painel simples. 4) Compartilhar com o time comercial. 5) Manter atualizado.',
    evidence: 'Painel de acompanhamento de vendas (conversão/volume/margem) atualizado regularmente.' },
  { id: 'financeiro_estrategia_comercial_003', title: 'Vincular ajustes de estratégia comercial a resultado, mercado e concorrência',
    checklist: '1) Definir rito periódico de revisão da estratégia comercial (ex.: trimestral). 2) Nessa revisão, considerar resultado do período, mudanças de mercado e movimento da concorrência. 3) Decidir ajustes necessários. 4) Comunicar e implementar os ajustes. 5) Registrar a revisão.',
    evidence: 'Registro de revisão da estratégia comercial do último trimestre, com ajustes aplicados.' },
  { id: 'financeiro_estrategia_comercial_004', title: 'Criar rotina de revisão das decisões comerciais relevantes',
    checklist: '1) Listar as decisões comerciais mais relevantes tomadas no período (grandes contratos, mudança de preço, novo canal). 2) Avaliar o resultado de cada uma. 3) Extrair aprendizados. 4) Ajustar critérios de decisão futura conforme o aprendizado. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica das decisões comerciais relevantes, com aprendizados documentados.' },
  // indicadores_financeiros
  { id: 'financeiro_indicadores_financeiros_001', title: 'Definir e acompanhar indicadores financeiros com frequência fixa',
    checklist: '1) Definir os indicadores financeiros mais relevantes (margem, liquidez, endividamento, ciclo de caixa). 2) Definir a frequência de acompanhamento (mensal recomendado). 3) Consolidar num painel simples. 4) Compartilhar com a gestão. 5) Manter atualizado.',
    evidence: 'Painel de indicadores financeiros atualizado com a frequência definida.' },
  { id: 'financeiro_indicadores_financeiros_002', title: 'Implantar comparação de indicadores financeiros com meta/histórico',
    checklist: '1) Definir meta ou referência histórica para cada indicador. 2) Comparar o resultado do período com essa referência. 3) Identificar indicadores fora do esperado. 4) Discutir com a gestão. 5) Registrar a comparação.',
    evidence: 'Comparação de indicadores financeiros com meta/histórico do último período, discutida com a gestão.' },
  { id: 'financeiro_indicadores_financeiros_003', title: 'Implantar análise de variação dos indicadores financeiros para apoiar decisões',
    checklist: '1) Priorizar as variações mais relevantes do período. 2) Investigar a causa de cada uma. 3) Documentar a explicação. 4) Usar essa análise para apoiar a próxima decisão relevante. 5) Registrar se a análise influenciou a decisão.',
    evidence: 'Análise de variação de indicadores financeiros do último período, vinculada a pelo menos uma decisão.' },
  { id: 'financeiro_indicadores_financeiros_004', title: 'Criar rotina de revisão dos indicadores financeiros',
    checklist: '1) Definir periodicidade de revisão (ex.: semestral). 2) Avaliar se os indicadores atuais ainda são úteis e refletem o momento do negócio. 3) Ajustar/substituir indicadores que perderam relevância. 4) Comunicar mudanças à gestão. 5) Registrar a revisão realizada.',
    evidence: 'Registro de revisão periódica dos indicadores financeiros, com ajustes aplicados quando necessário.' },
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

  console.log(`[financeiro] ${updatedQuestions} FalQuestion atualizadas, ${updatedActions} FalQuestionActionLibrary atualizadas. Total esperado: 60.`);
  if (missing.length) console.log(`FalQuestion não encontrada: ${missing.join(', ')}`);
  if (missingAction.length) console.log(`Sem FalQuestionActionLibrary (precisa criar): ${missingAction.join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
