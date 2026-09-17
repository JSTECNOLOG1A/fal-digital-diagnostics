/**
 * Lote 8b (final) da reescrita do FAL 8D clássico — dimensão "controles_internos",
 * parte 2: folha_admissao, folha_demissao, folha_promocoes, gestao_imobilizado,
 * receitas_faturamento, segregacao_funcoes, tesouraria (60 perguntas).
 * Ver update-fal8d-practical-actions-sistemas.ts para o contexto completo.
 * Rodar com: npx tsx prisma/update-fal8d-practical-actions-controles-b.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

type Row = { id: string; title: string; checklist: string; evidence: string };

const ROWS: Row[] = [
  // folha_admissao
  { id: 'controles_internos_folha_admissao_001', title: 'Formalizar procedimento de contratação de colaboradores',
    checklist: '1) Levantar como as contratações acontecem hoje. 2) Documentar o passo a passo (requisição, seleção, documentação, admissão). 3) Definir responsável por cada etapa. 4) Aprovar e comunicar. 5) Aplicar na próxima contratação.',
    evidence: 'Procedimento de contratação formalizado e aplicado na admissão mais recente.' },
  { id: 'controles_internos_folha_admissao_002', title: 'Garantir registro no sistema de folha antes do início das atividades',
    checklist: '1) Definir o prazo mínimo de antecedência para o registro. 2) Verificar se isso está sendo cumprido hoje. 3) Ajustar o processo para garantir o registro prévio. 4) Testar com a próxima admissão. 5) Corrigir o que não estiver funcionando.',
    evidence: 'Última admissão registrada no sistema de folha antes do início das atividades.' },
  { id: 'controles_internos_folha_admissao_003', title: 'Implantar checklist de documentação obrigatória na contratação',
    checklist: '1) Listar os documentos obrigatórios exigidos por lei/política interna. 2) Criar um checklist de conferência. 3) Aplicar antes de cada contratação. 4) Não efetivar sem o checklist completo. 5) Arquivar a documentação conferida.',
    evidence: 'Checklist de documentação aplicado e completo na admissão mais recente.' },
  { id: 'controles_internos_folha_admissao_004', title: 'Definir alçada de aprovação prévia para admissões',
    checklist: '1) Definir quem aprova a abertura de vaga e a contratação final. 2) Documentar a alçada. 3) Comunicar aos gestores. 4) Aplicar na próxima contratação. 5) Registrar a aprovação.',
    evidence: 'Aprovação formal registrada para a admissão mais recente.' },
  { id: 'controles_internos_folha_admissao_005', title: 'Integrar o cadastro do colaborador entre folha, contabilidade e centro de custo',
    checklist: '1) Verificar se hoje há cadastro duplicado/manual entre sistemas. 2) Avaliar a integração disponível. 3) Configurar/ativar a integração. 4) Testar com a próxima admissão. 5) Eliminar o cadastro duplicado.',
    evidence: 'Cadastro de colaborador integrado entre folha, contabilidade e centro de custo, testado na admissão mais recente.' },
  { id: 'controles_internos_folha_admissao_006', title: 'Implantar controle de alocação correta em centro de custo',
    checklist: '1) Definir quem valida a alocação de centro de custo na admissão. 2) Verificar numa amostra recente se a alocação está correta. 3) Corrigir alocações erradas encontradas. 4) Reforçar a checagem nas próximas admissões. 5) Registrar o controle aplicado.',
    evidence: 'Amostra de alocações de centro de custo conferida, erros corrigidos.' },
  { id: 'controles_internos_folha_admissao_007', title: 'Implantar monitoramento de admissões vs. orçamento de pessoal',
    checklist: '1) Definir o orçamento/headcount planejado por área. 2) Comparar periodicamente com as admissões realizadas. 3) Identificar desvios. 4) Discutir com a gestão. 5) Registrar o monitoramento.',
    evidence: 'Comparação de admissões vs. orçamento de pessoal do último período, discutida com a gestão.' },
  { id: 'controles_internos_folha_admissao_008', title: 'Implantar auditoria/revisão periódica do processo de admissão',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Testar uma amostra de admissões contra o procedimento formal. 3) Identificar desvios. 4) Corrigir e reforçar treinamento. 5) Documentar a revisão.',
    evidence: 'Relatório de revisão/auditoria do processo de admissão, com desvios corrigidos.' },
  // folha_demissao
  { id: 'controles_internos_folha_demissao_001', title: 'Formalizar procedimento de desligamento de colaboradores',
    checklist: '1) Levantar como os desligamentos acontecem hoje. 2) Documentar o passo a passo (comunicação, cálculo, homologação, baixa). 3) Definir responsável por cada etapa. 4) Aprovar e comunicar. 5) Aplicar no próximo desligamento.',
    evidence: 'Procedimento de desligamento formalizado e aplicado no caso mais recente.' },
  { id: 'controles_internos_folha_demissao_002', title: 'Garantir registro tempestivo do desligamento no sistema de folha',
    checklist: '1) Definir o prazo máximo para registrar o desligamento após a decisão. 2) Verificar se isso está sendo cumprido. 3) Ajustar o processo se houver atraso recorrente. 4) Testar com o próximo desligamento. 5) Corrigir o que não funcionar.',
    evidence: 'Último desligamento registrado no sistema de folha dentro do prazo definido.' },
  { id: 'controles_internos_folha_demissao_003', title: 'Implantar conferência dos cálculos de rescisão antes do pagamento',
    checklist: '1) Definir quem revisa o cálculo (segregado de quem calcula). 2) Definir um checklist de conferência (verbas, descontos, prazo). 3) Aplicar no próximo desligamento. 4) Registrar a conferência (sign-off). 5) Só pagar após essa conferência.',
    evidence: 'Cálculo de rescisão mais recente com conferência registrada antes do pagamento.' },
  { id: 'controles_internos_folha_demissao_004', title: 'Definir alçada de aprovação para desligamentos',
    checklist: '1) Definir quem aprova o desligamento conforme o caso (gestor, RH, diretoria). 2) Documentar a alçada. 3) Comunicar aos gestores. 4) Aplicar no próximo caso. 5) Registrar a aprovação.',
    evidence: 'Aprovação formal registrada para o desligamento mais recente.' },
  { id: 'controles_internos_folha_demissao_005', title: 'Implantar bloqueio automático de pagamentos e acessos pós-desligamento',
    checklist: '1) Levantar todos os acessos/sistemas que o colaborador tem (folha, e-mail, sistemas, cartão). 2) Definir um checklist de bloqueio para o dia do desligamento. 3) Aplicar no próximo desligamento. 4) Verificar se todos os acessos foram de fato bloqueados. 5) Corrigir falhas encontradas.',
    evidence: 'Checklist de bloqueio de acessos aplicado e verificado no desligamento mais recente.' },
  { id: 'controles_internos_folha_demissao_006', title: 'Implantar controle de colaboradores ativos vs. desligados na folha',
    checklist: '1) Cruzar periodicamente a lista de desligados com a folha ativa. 2) Identificar inconsistências (desligado ainda ativo). 3) Corrigir imediatamente. 4) Investigar a causa da falha. 5) Repetir a checagem a cada fechamento de folha.',
    evidence: 'Checagem de desligados vs. folha ativa do último fechamento, sem inconsistências pendentes.' },
  { id: 'controles_internos_folha_demissao_007', title: 'Implantar monitoramento de indicadores de turnover',
    checklist: '1) Definir o indicador (taxa de turnover, por área/motivo). 2) Calcular periodicamente. 3) Identificar áreas com turnover elevado. 4) Discutir causas com a gestão/RH. 5) Registrar o monitoramento.',
    evidence: 'Indicador de turnover monitorado periodicamente, com áreas críticas discutidas.' },
  { id: 'controles_internos_folha_demissao_008', title: 'Implantar auditoria/revisão periódica do processo de desligamento',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Testar uma amostra de desligamentos contra o procedimento formal. 3) Identificar desvios. 4) Corrigir e reforçar treinamento. 5) Documentar a revisão.',
    evidence: 'Relatório de revisão/auditoria do processo de desligamento, com desvios corrigidos.' },
  // folha_promocoes
  { id: 'controles_internos_folha_promocoes_001', title: 'Formalizar procedimento de promoções e alterações salariais',
    checklist: '1) Levantar como essas decisões são tomadas hoje. 2) Documentar o processo (solicitação, justificativa, aprovação, implementação). 3) Definir responsável por cada etapa. 4) Aprovar e comunicar. 5) Aplicar na próxima alteração.',
    evidence: 'Procedimento de promoções/alterações salariais formalizado e aplicado no caso mais recente.' },
  { id: 'controles_internos_folha_promocoes_002', title: 'Garantir registro formal de promoções/alterações no sistema de folha',
    checklist: '1) Verificar se hoje há alteração combinada informalmente sem registro. 2) Definir que toda alteração passa pelo sistema antes de valer. 3) Comunicar a regra aos gestores. 4) Testar com a próxima alteração. 5) Corrigir desvios encontrados.',
    evidence: 'Última alteração salarial registrada formalmente no sistema de folha.' },
  { id: 'controles_internos_folha_promocoes_003', title: 'Exigir justificativa formal para alterações salariais relevantes',
    checklist: '1) Definir o que é uma alteração relevante (valor ou percentual). 2) Exigir justificativa documentada (desempenho, mercado, mudança de função). 3) Aplicar na próxima alteração relevante. 4) Arquivar a justificativa. 5) Usar como referência em decisões futuras.',
    evidence: 'Justificativa documentada para a alteração salarial relevante mais recente.' },
  { id: 'controles_internos_folha_promocoes_004', title: 'Definir alçada de aprovação para promoções e aumentos',
    checklist: '1) Definir faixas (valor/percentual) e aprovador de cada faixa. 2) Documentar a matriz de alçadas. 3) Comunicar aos gestores. 4) Aplicar na próxima decisão. 5) Registrar a aprovação.',
    evidence: 'Matriz de alçadas de promoções/aumentos documentada e aplicada no caso mais recente.' },
  { id: 'controles_internos_folha_promocoes_005', title: 'Garantir prazo de implementação da alteração antes do fechamento da folha',
    checklist: '1) Definir o prazo limite para lançar alterações antes do fechamento. 2) Comunicar o prazo aos responsáveis. 3) Verificar se está sendo cumprido. 4) Corrigir o processo se houver atraso recorrente. 5) Testar no próximo fechamento.',
    evidence: 'Alterações salariais do último mês implementadas dentro do prazo antes do fechamento da folha.' },
  { id: 'controles_internos_folha_promocoes_006', title: 'Implantar controle de aderência ao orçamento/política salarial',
    checklist: '1) Definir o orçamento/faixa salarial de referência por função. 2) Verificar cada alteração relevante contra essa referência antes de aprovar. 3) Sinalizar exceções que fogem da política. 4) Levar exceções à aprovação de nível superior. 5) Registrar o controle aplicado.',
    evidence: 'Alterações salariais recentes conferidas contra o orçamento/política, exceções aprovadas formalmente.' },
  { id: 'controles_internos_folha_promocoes_007', title: 'Implantar monitoramento do impacto de promoções/reajustes na folha',
    checklist: '1) Definir a periodicidade de acompanhamento (mensal). 2) Calcular o impacto financeiro das alterações do período. 3) Comparar com o orçamento de folha. 4) Reportar à gestão. 5) Ajustar o planejamento se necessário.',
    evidence: 'Impacto de promoções/reajustes na folha monitorado no último período, reportado à gestão.' },
  { id: 'controles_internos_folha_promocoes_008', title: 'Implantar auditoria/revisão periódica do processo de promoções e alterações salariais',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Testar uma amostra de alterações contra o procedimento formal. 3) Identificar desvios. 4) Corrigir e ajustar. 5) Documentar a revisão.',
    evidence: 'Relatório de revisão/auditoria do processo de promoções/alterações salariais, com desvios corrigidos.' },
  // gestao_imobilizado
  { id: 'controles_internos_gestao_imobilizado_001', title: 'Formalizar procedimento de registro e controle do imobilizado',
    checklist: '1) Levantar como o imobilizado é controlado hoje. 2) Documentar o procedimento (registro, controle, baixa). 3) Definir responsável. 4) Aprovar e comunicar. 5) Aplicar na próxima aquisição/baixa.',
    evidence: 'Procedimento de gestão de imobilizado formalizado e comunicado.' },
  { id: 'controles_internos_gestao_imobilizado_002', title: 'Implantar registro individualizado de ativos imobilizados',
    checklist: '1) Levantar o imobilizado existente. 2) Registrar cada item individualmente (não em lote) no sistema/planilha. 3) Atribuir um código único a cada ativo. 4) Definir responsável por manter atualizado. 5) Registrar novas aquisições individualmente daqui pra frente.',
    evidence: 'Registro individualizado de ativos imobilizados implantado, com código único por ativo.' },
  { id: 'controles_internos_gestao_imobilizado_003', title: 'Implantar identificação física e controle de localização dos ativos',
    checklist: '1) Priorizar os ativos de maior valor/relevância. 2) Etiquetar/identificar fisicamente cada um. 3) Registrar a localização (unidade, setor). 4) Vincular ao registro individual do ativo. 5) Atualizar quando o ativo for movimentado.',
    evidence: 'Ativos relevantes identificados fisicamente, com localização registrada e vinculada ao cadastro.' },
  { id: 'controles_internos_gestao_imobilizado_004', title: 'Definir aprovação formal para aquisição/baixa de imobilizado',
    checklist: '1) Definir alçadas de aprovação por valor. 2) Documentar a matriz. 3) Comunicar aos responsáveis. 4) Aplicar na próxima aquisição/baixa. 5) Registrar a aprovação.',
    evidence: 'Aprovação formal registrada para a última aquisição/baixa de ativo imobilizado.' },
  { id: 'controles_internos_gestao_imobilizado_005', title: 'Completar o registro de imobilizado com valor, data e vida útil',
    checklist: '1) Verificar quais ativos têm registro incompleto. 2) Levantar a informação faltante (nota fiscal, laudo). 3) Completar o cadastro. 4) Validar com contabilidade os critérios de vida útil. 5) Manter completo nos próximos registros.',
    evidence: 'Cadastro de imobilizado completo com valor, data de aquisição e vida útil para os ativos relevantes.' },
  { id: 'controles_internos_gestao_imobilizado_006', title: 'Implantar cálculo sistemático de depreciação',
    checklist: '1) Verificar se a depreciação é calculada manualmente ou via sistema. 2) Validar os critérios (taxa, método) com a contabilidade. 3) Configurar o cálculo automático se possível. 4) Conferir o resultado numa amostra. 5) Corrigir divergências encontradas.',
    evidence: 'Cálculo de depreciação sistemático implantado, amostra conferida com a contabilidade.' },
  { id: 'controles_internos_gestao_imobilizado_007', title: 'Implantar inventário físico periódico do imobilizado',
    checklist: '1) Definir periodicidade (ex.: anual). 2) Definir o método de contagem/conferência. 3) Executar o próximo inventário. 4) Comparar com o cadastro. 5) Ajustar o cadastro conforme o resultado (ativo baixado, não localizado).',
    evidence: 'Relatório do inventário físico de imobilizado mais recente, com ajustes aplicados ao cadastro.' },
  { id: 'controles_internos_gestao_imobilizado_008', title: 'Implantar monitoramento de utilização e manutenção dos ativos relevantes',
    checklist: '1) Priorizar os ativos críticos para a operação. 2) Definir indicadores de acompanhamento (uso, manutenção preventiva, vida útil restante). 3) Monitorar periodicamente. 4) Planejar substituição antes de falha crítica. 5) Registrar o monitoramento.',
    evidence: 'Monitoramento de utilização/manutenção dos ativos críticos, com plano de substituição quando aplicável.' },
  { id: 'controles_internos_gestao_imobilizado_009', title: 'Implantar auditoria/revisão periódica do processo de gestão do imobilizado',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Testar o processo contra o procedimento formal. 3) Identificar desvios. 4) Corrigir e ajustar. 5) Documentar a revisão.',
    evidence: 'Relatório de revisão/auditoria do processo de gestão do imobilizado, com desvios corrigidos.' },
  // receitas_faturamento
  { id: 'controles_internos_receitas_faturamento_001', title: 'Formalizar procedimento de registro e controle do faturamento',
    checklist: '1) Levantar como o faturamento é feito hoje. 2) Documentar o procedimento (pedido, faturamento, registro). 3) Definir responsável. 4) Aprovar e comunicar. 5) Aplicar no próximo ciclo.',
    evidence: 'Procedimento de faturamento formalizado e comunicado.' },
  { id: 'controles_internos_receitas_faturamento_002', title: 'Garantir registro do pedido de venda antes da nota fiscal',
    checklist: '1) Verificar se hoje há emissão de nota sem pedido formal registrado. 2) Definir que a nota só é emitida a partir de um pedido no sistema. 3) Comunicar a regra à equipe comercial/faturamento. 4) Testar com o próximo faturamento. 5) Corrigir desvios.',
    evidence: 'Última venda faturada com pedido registrado previamente no sistema.' },
  { id: 'controles_internos_receitas_faturamento_003', title: 'Integrar o faturamento com estoque e financeiro',
    checklist: '1) Verificar se hoje há atualização manual separada de estoque/financeiro após o faturamento. 2) Avaliar a integração disponível no sistema. 3) Configurar/ativar a integração. 4) Testar com uma venda real. 5) Eliminar a atualização manual duplicada.',
    evidence: 'Faturamento testado com atualização automática de estoque e financeiro, processo manual eliminado.' },
  { id: 'controles_internos_receitas_faturamento_004', title: 'Implantar conferência entre pedido, contrato e nota fiscal',
    checklist: '1) Definir quem faz essa conferência antes/depois da emissão. 2) Definir o que checar (preço, condição, quantidade conforme contrato). 3) Aplicar na próxima emissão relevante. 4) Registrar a conferência. 5) Corrigir divergências encontradas.',
    evidence: 'Conferência entre pedido/contrato/nota fiscal registrada na emissão mais recente relevante.' },
  { id: 'controles_internos_receitas_faturamento_005', title: 'Implantar validação fiscal prévia à emissão',
    checklist: '1) Definir os pontos de checagem fiscal (NCM, CST, alíquota, benefício aplicável). 2) Definir quem valida antes da emissão. 3) Aplicar na próxima emissão. 4) Registrar a validação. 5) Corrigir erros encontrados antes de emitir.',
    evidence: 'Validação fiscal registrada antes da emissão da nota fiscal mais recente.' },
  { id: 'controles_internos_receitas_faturamento_006', title: 'Implantar conciliação entre faturamento e registros contábeis/financeiros',
    checklist: '1) Definir periodicidade da conciliação (mensal). 2) Comparar o total faturado com o registrado na contabilidade/financeiro. 3) Investigar divergências. 4) Corrigir quando necessário. 5) Documentar a conciliação.',
    evidence: 'Conciliação entre faturamento e registros contábeis/financeiros do último mês, divergências tratadas.' },
  { id: 'controles_internos_receitas_faturamento_007', title: 'Implantar monitoramento de receita por cliente/produto/unidade',
    checklist: '1) Definir a segmentação de análise (cliente, produto, unidade). 2) Consolidar a receita nessa segmentação periodicamente. 3) Identificar concentrações ou quedas relevantes. 4) Compartilhar com a gestão. 5) Manter atualizado.',
    evidence: 'Análise de receita por cliente/produto/unidade do último período, compartilhada com a gestão.' },
  { id: 'controles_internos_receitas_faturamento_008', title: 'Implantar análise de variação de faturamento entre períodos',
    checklist: '1) Comparar o faturamento do período com o anterior. 2) Identificar variações relevantes. 3) Investigar a causa (volume, preço, sazonalidade, cliente). 4) Documentar a explicação. 5) Reportar à gestão.',
    evidence: 'Análise de variação de faturamento do último período, com causas documentadas e reportadas.' },
  { id: 'controles_internos_receitas_faturamento_009', title: 'Implantar auditoria/revisão periódica do processo de faturamento',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Testar uma amostra de faturamentos contra o procedimento formal. 3) Identificar desvios. 4) Corrigir e reforçar treinamento. 5) Documentar a revisão.',
    evidence: 'Relatório de revisão/auditoria do processo de faturamento, com desvios corrigidos.' },
  // segregacao_funcoes
  { id: 'controles_internos_segregacao_funcoes_001', title: 'Formalizar diretriz de segregação de funções',
    checklist: '1) Listar as atividades críticas da empresa (financeiro, compras, folha, fiscal). 2) Definir o princípio de segregação para cada uma (quem cadastra ≠ quem aprova ≠ quem executa). 3) Documentar a diretriz formalmente. 4) Aprovar com a gestão. 5) Comunicar à equipe.',
    evidence: 'Diretriz de segregação de funções formalizada e comunicada.' },
  { id: 'controles_internos_segregacao_funcoes_002', title: 'Segregar responsabilidades operacionais e de controle',
    checklist: '1) Mapear quem executa e quem controla cada atividade crítica hoje. 2) Identificar casos onde a mesma pessoa faz as duas coisas. 3) Priorizar os casos de maior risco. 4) Redistribuir responsabilidades para segregar. 5) Documentar a nova distribuição.',
    evidence: 'Matriz de responsabilidades operacionais vs. controle, com segregação aplicada nos casos críticos.' },
  { id: 'controles_internos_segregacao_funcoes_003', title: 'Implantar matriz de acessos que impeça execução e aprovação pela mesma pessoa',
    checklist: '1) Levantar os perfis de acesso atuais nos sistemas críticos. 2) Identificar usuários com permissão de executar E aprovar a mesma transação. 3) Ajustar os perfis para segregar. 4) Testar o ajuste com um caso real. 5) Documentar a matriz final.',
    evidence: 'Matriz de acessos revisada, sem usuário com permissão de executar e aprovar a mesma transação.' },
  { id: 'controles_internos_segregacao_funcoes_004', title: 'Definir alçadas de aprovação para atividades críticas',
    checklist: '1) Listar as atividades críticas que exigem aprovação. 2) Definir faixas de valor/risco e o aprovador de cada uma. 3) Documentar a matriz de alçadas. 4) Comunicar formalmente. 5) Aplicar nas próximas decisões.',
    evidence: 'Matriz de alçadas para atividades críticas documentada e comunicada.' },
  { id: 'controles_internos_segregacao_funcoes_005', title: 'Definir acessos por perfil de função (não por usuário individual)',
    checklist: '1) Mapear os perfis de função existentes (compras, financeiro, RH). 2) Definir o acesso padrão de cada perfil. 3) Migrar os usuários para o perfil correto. 4) Corrigir acessos individuais desalinhados. 5) Manter novos acessos baseados em perfil daqui pra frente.',
    evidence: 'Acessos aos sistemas organizados por perfil de função, desalinhamentos corrigidos.' },
  { id: 'controles_internos_segregacao_funcoes_006', title: 'Garantir rastreabilidade das atividades críticas via log',
    checklist: '1) Verificar se os sistemas críticos geram log de quem fez o quê e quando. 2) Ativar essa funcionalidade onde estiver desligada. 3) Definir por quanto tempo o log é mantido. 4) Testar a consulta de um log real. 5) Usar o log em caso de investigação de erro/fraude.',
    evidence: 'Log de atividades ativo nos sistemas críticos, teste de consulta realizado com sucesso.' },
  { id: 'controles_internos_segregacao_funcoes_007', title: 'Implantar revisão periódica de perfis de acesso',
    checklist: '1) Definir periodicidade (ex.: semestral). 2) Revisar os perfis de acesso ativos contra a função atual de cada usuário. 3) Remover acessos desnecessários (ex.: função mudou, colaborador saiu). 4) Corrigir conflitos de segregação encontrados. 5) Registrar a revisão.',
    evidence: 'Registro de revisão periódica de perfis de acesso, com correções aplicadas.' },
  { id: 'controles_internos_segregacao_funcoes_008', title: 'Implantar monitoramento de riscos de concentração de função/acesso',
    checklist: '1) Identificar pessoas-chave que concentram múltiplas funções críticas (ponto único de falha). 2) Avaliar o risco de cada concentração. 3) Priorizar a redução das concentrações mais críticas. 4) Definir plano de mitigação (backup, redistribuição). 5) Monitorar periodicamente.',
    evidence: 'Mapeamento de concentração de funções críticas, com plano de mitigação para os casos priorizados.' },
  { id: 'controles_internos_segregacao_funcoes_009', title: 'Implantar auditoria/revisão periódica do processo de segregação de funções',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Testar uma amostra de transações críticas quanto à segregação. 3) Identificar desvios. 4) Corrigir e ajustar. 5) Documentar a revisão.',
    evidence: 'Relatório de revisão/auditoria de segregação de funções, com desvios corrigidos.' },
  // tesouraria
  { id: 'controles_internos_tesouraria_001', title: 'Formalizar procedimento de gestão de tesouraria',
    checklist: '1) Levantar como a tesouraria opera hoje. 2) Documentar o procedimento (recebimento, pagamento, aplicação). 3) Definir responsável. 4) Aprovar e comunicar. 5) Aplicar no próximo ciclo.',
    evidence: 'Procedimento de gestão de tesouraria formalizado e comunicado.' },
  { id: 'controles_internos_tesouraria_002', title: 'Implantar registro diário de entradas e saídas financeiras',
    checklist: '1) Definir o sistema/controle a ser usado. 2) Definir responsável pelo registro diário. 3) Migrar o controle atual para essa ferramenta. 4) Conferir com extrato bancário periodicamente. 5) Manter o registro diário como rotina.',
    evidence: 'Registro diário de movimentação financeira implantado, conferido com extrato bancário.' },
  { id: 'controles_internos_tesouraria_003', title: 'Implantar projeção de fluxo de caixa para planejamento',
    checklist: '1) Montar uma projeção de caixa para as próximas semanas/meses. 2) Definir a periodicidade de atualização. 3) Usar a projeção para planejar pagamentos e decisões. 4) Comparar previsto vs. realizado periodicamente. 5) Ajustar a projeção conforme aprendizado.',
    evidence: 'Projeção de fluxo de caixa em uso, com pagamentos planejados a partir dela.' },
  { id: 'controles_internos_tesouraria_004', title: 'Definir alçadas de aprovação para pagamentos',
    checklist: '1) Definir faixas de valor e aprovador de cada faixa. 2) Documentar a matriz de alçadas. 3) Configurar no sistema/banco se possível. 4) Comunicar formalmente. 5) Aplicar no próximo pagamento.',
    evidence: 'Matriz de alçadas de pagamento documentada e aplicada no pagamento mais recente.' },
  { id: 'controles_internos_tesouraria_005', title: 'Migrar pagamentos para remessa eletrônica/integração com ERP',
    checklist: '1) Verificar se hoje há pagamento manual (cheque, digitação individual). 2) Avaliar a funcionalidade de remessa/integração disponível. 3) Configurar e testar com um lote de pagamentos. 4) Migrar o processo. 5) Descontinuar o processo manual paralelo.',
    evidence: 'Pagamentos realizados via remessa eletrônica/integração com ERP, processo manual descontinuado.' },
  { id: 'controles_internos_tesouraria_006', title: 'Segregar quem prepara e quem aprova pagamentos',
    checklist: '1) Verificar se hoje a mesma pessoa prepara e aprova. 2) Redistribuir as funções para segregar. 3) Ajustar o acesso ao sistema/banco conforme a nova distribuição. 4) Testar com o próximo pagamento. 5) Documentar a segregação aplicada.',
    evidence: 'Segregação entre preparo e aprovação de pagamento aplicada e testada no pagamento mais recente.' },
  { id: 'controles_internos_tesouraria_007', title: 'Implantar conciliação bancária periódica',
    checklist: '1) Definir periodicidade (mensal, no mínimo). 2) Comparar o saldo registrado com o extrato bancário. 3) Investigar divergências. 4) Corrigir o registro quando necessário. 5) Documentar a conciliação (sign-off).',
    evidence: 'Conciliação bancária do último mês documentada, divergências tratadas.' },
  { id: 'controles_internos_tesouraria_008', title: 'Implantar monitoramento periódico de posição de caixa e liquidez',
    checklist: '1) Definir a periodicidade de acompanhamento (semanal recomendado). 2) Consolidar a posição de caixa de todas as contas. 3) Calcular a liquidez disponível. 4) Reportar à gestão. 5) Usar para antecipar necessidade de captação.',
    evidence: 'Posição de caixa e liquidez monitorada periodicamente, reportada à gestão.' },
  { id: 'controles_internos_tesouraria_009', title: 'Implantar auditoria/revisão periódica do processo de tesouraria',
    checklist: '1) Definir periodicidade (anual recomendado). 2) Testar o processo contra o procedimento formal. 3) Identificar desvios. 4) Corrigir e ajustar. 5) Documentar a revisão.',
    evidence: 'Relatório de revisão/auditoria do processo de tesouraria, com desvios corrigidos.' },
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

  console.log(`[controles_internos parte B] ${updatedQuestions} FalQuestion atualizadas, ${updatedActions} FalQuestionActionLibrary atualizadas. Total esperado: 60.`);
  if (missing.length) console.log(`FalQuestion não encontrada: ${missing.join(', ')}`);
  if (missingAction.length) console.log(`Sem FalQuestionActionLibrary (precisa criar): ${missingAction.join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
