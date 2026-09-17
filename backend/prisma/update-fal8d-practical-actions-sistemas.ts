/**
 * Update one-off: reescreve guidance/evidence_hint (fal_questions) e
 * action_title/how_to_execute/expected_evidence (fal_question_action_library)
 * das perguntas do FAL 8D CLÁSSICO (method_version_id nulo), dimensão
 * "sistemas" (12 perguntas) — primeiro lote da reescrita completa do banco
 * clássico, que hoje não tem NENHUM conteúdo prático (guidance/evidence_hint
 * vazios, ação genérica idêntica em todas as perguntas).
 *
 * Mesmo padrão da Reforma Tributária: checklist numerado de passos
 * concretos + evidência específica, aprovado pelo usuário.
 *
 * Rodar com: npx tsx prisma/update-fal8d-practical-actions-sistemas.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

type Row = { id: string; title: string; checklist: string; evidence: string };

const ROWS: Row[] = [
  { id: 'sistemas_seguranca_informacao_001', title: 'Implantar controle de acesso a informações e dados críticos',
    checklist: '1) Levantar quais sistemas/pastas contêm dados críticos (financeiro, clientes, fornecedores, folha). 2) Verificar quem tem acesso a cada um hoje. 3) Remover acessos desnecessários e definir perfis por função. 4) Implantar login/senha individual (não compartilhado). 5) Definir rotina de revisão periódica de acessos.',
    evidence: 'Lista de sistemas/dados críticos com controle de acesso implantado e revisão de perfis registrada.' },
  { id: 'sistemas_sistemas_gestao_001', title: 'Centralizar operação, comercial e financeiro num sistema de gestão único',
    checklist: '1) Mapear onde cada área guarda hoje sua informação (planilha, papel, sistema isolado). 2) Avaliar se um sistema de gestão já existente pode cobrir as três áreas. 3) Priorizar a implantação/uso pela área de maior risco primeiro. 4) Migrar os dados críticos para o sistema centralizado. 5) Descontinuar as planilhas paralelas após validar o sistema.',
    evidence: 'Sistema de gestão em uso cobrindo operação, comercial e financeiro, planilhas paralelas descontinuadas.' },
  { id: 'sistemas_infraestrutura_tecnologica_001', title: 'Avaliar e adequar a infraestrutura tecnológica às necessidades da operação',
    checklist: '1) Levantar os gargalos relatados pelos usuários (lentidão, quedas, falta de equipamento). 2) Comparar a capacidade atual (internet, servidores, computadores) com o volume real de operação. 3) Priorizar os gargalos que mais afetam a operação. 4) Elaborar um plano de investimento/adequação. 5) Implementar as melhorias priorizadas.',
    evidence: 'Levantamento de gargalos de infraestrutura com plano de adequação e melhorias implementadas.' },
  { id: 'sistemas_sistemas_gestao_002', title: 'Eliminar retrabalho de dados entre sistemas e áreas',
    checklist: '1) Mapear onde o mesmo dado é digitado/lançado mais de uma vez em áreas diferentes. 2) Verificar se existe integração possível entre os sistemas envolvidos. 3) Priorizar os casos de maior retrabalho/erro. 4) Implantar a integração ou um processo padronizado de conferência única. 5) Medir a redução de retrabalho após a mudança.',
    evidence: 'Mapeamento de retrabalho entre sistemas/áreas, com integração ou processo de conferência única implantado.' },
  { id: 'sistemas_seguranca_informacao_002', title: 'Implantar acompanhamento de riscos e incidentes de segurança da informação',
    checklist: '1) Definir onde registrar incidentes/vulnerabilidades (mesmo que uma planilha simples). 2) Definir quem é responsável por identificar e registrar. 3) Rodar uma varredura inicial de vulnerabilidades óbvias (senha fraca, acesso genérico, backup ausente). 4) Registrar os achados e priorizar correção. 5) Revisar o registro periodicamente.',
    evidence: 'Registro de riscos/incidentes de segurança da informação com achados priorizados e revisão periódica.' },
  { id: 'sistemas_infraestrutura_tecnologica_002', title: 'Implantar monitoramento regular de disponibilidade e desempenho da infraestrutura',
    checklist: '1) Definir os indicadores básicos a acompanhar (disponibilidade de internet, servidor, sistemas críticos). 2) Definir como medir (ferramenta simples ou relato da equipe de TI/suporte). 3) Estabelecer periodicidade de acompanhamento. 4) Registrar as ocorrências de indisponibilidade/lentidão. 5) Usar o histórico para priorizar investimentos.',
    evidence: 'Registro periódico de disponibilidade/desempenho da infraestrutura com histórico de ocorrências.' },
  { id: 'sistemas_seguranca_informacao_003', title: 'Criar rotina de resposta a incidentes de segurança com correção e aprendizado',
    checklist: '1) Definir o passo a passo mínimo ao identificar um incidente (conter, avaliar, corrigir). 2) Definir quem é acionado em cada tipo de incidente. 3) Documentar o incidente e a correção aplicada. 4) Registrar a lição aprendida e o que muda para evitar recorrência. 5) Testar o processo no próximo incidente real ou simulado.',
    evidence: 'Registro de incidentes de segurança com resposta, correção aplicada e lição aprendida documentada.' },
  { id: 'sistemas_sistemas_gestao_003', title: 'Implantar checagem preventiva de parametrização e cadastro',
    checklist: '1) Identificar os pontos do sistema mais sujeitos a erro (preço, tributo, cliente, fornecedor). 2) Definir uma checagem/validação antes de uma mudança entrar em produção. 3) Definir quem faz essa checagem. 4) Registrar os erros pegos antes de impactar a operação. 5) Ajustar a checagem conforme novos tipos de erro aparecerem.',
    evidence: 'Checagem preventiva de parametrização/cadastro implantada, com erros identificados antes do impacto.' },
  { id: 'sistemas_infraestrutura_tecnologica_003', title: 'Formalizar tratativa de problemas de infraestrutura com prioridade e responsável',
    checklist: '1) Definir um canal único para reportar problema de infraestrutura. 2) Definir critério de prioridade (crítico, alto, médio, baixo). 3) Atribuir responsável por tratar cada prioridade. 4) Definir prazo esperado de resposta por prioridade. 5) Acompanhar se os problemas críticos são resolvidos no prazo.',
    evidence: 'Canal de reporte de problemas de infraestrutura com prioridade, responsável e prazo definidos, histórico de resolução.' },
  { id: 'sistemas_seguranca_informacao_004', title: 'Criar rotina de revisão periódica das práticas de segurança da informação',
    checklist: '1) Listar as práticas de segurança hoje em vigor (senha, backup, acesso, antivírus). 2) Definir periodicidade de revisão (ex.: semestral). 3) Checar se cada prática ainda é suficiente frente a novos riscos. 4) Atualizar o que estiver desatualizado. 5) Registrar a revisão realizada.',
    evidence: 'Registro de pelo menos uma revisão periódica das práticas de segurança, com atualizações aplicadas.' },
  { id: 'sistemas_sistemas_gestao_004', title: 'Criar rotina de revisão periódica do sistema e suas parametrizações',
    checklist: '1) Definir periodicidade de revisão (ex.: trimestral ou semestral). 2) Checar se as parametrizações refletem a operação real da empresa. 3) Identificar parametrizações desatualizadas (produto descontinuado, regra antiga, usuário que saiu). 4) Corrigir o que for encontrado. 5) Registrar a revisão e os ajustes feitos.',
    evidence: 'Registro de revisão periódica do sistema/parametrizações com ajustes aplicados.' },
  { id: 'sistemas_infraestrutura_tecnologica_004', title: 'Criar rotina de revisão da infraestrutura conforme crescimento do negócio',
    checklist: '1) Definir periodicidade de revisão (ex.: anual, ou a cada expansão relevante). 2) Comparar a capacidade atual com o crescimento/plano da empresa. 3) Identificar gargalos futuros antes que virem problema real. 4) Priorizar investimento conforme o plano de crescimento. 5) Registrar a revisão e as decisões tomadas.',
    evidence: 'Registro de revisão periódica de infraestrutura vinculada ao plano de crescimento, com decisões registradas.' },
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

  console.log(`[sistemas] ${updatedQuestions} FalQuestion atualizadas, ${updatedActions} FalQuestionActionLibrary atualizadas.`);
  if (missing.length) console.log(`Não encontradas: ${missing.join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
