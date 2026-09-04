/**
 * Seed one-off: popula fal_question_action_library com os dados reais
 * (311 linhas, uma por FalQuestion) importados nesta sessão.
 *
 * A planilha do usuário só tem question_id/action_template/horizon/
 * owner_role — um formato bem mais simples que o schema real do motor
 * (que espera trigger_score_max, impact_level, effort_level, action_type
 * etc.). Aqui: dimension_key/subdimension_key/cluster_key são preenchidos
 * de verdade via join com fal_questions (dado real, não inventado);
 * os campos de scoring que a planilha não tem usam defaults documentados
 * (trigger_score_max=2, impact_level=3, effort_level=3, action_type=
 * 'implantacao') — ajustáveis depois por quem conhece o catálogo completo.
 *
 * Rodar com: npx tsx prisma/seed-fal-question-action-library.ts
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  const raw = readFileSync(
    join(__dirname, '..', '..', 'src', 'api', 'falSeedData', 'falQuestionActionLibrary.json'),
    'utf-8',
  );
  const rows = JSON.parse(raw) as Array<{
    question_id: string;
    action_template: string;
    horizon?: string;
    owner_role?: string;
  }>;

  const existing = await prisma.falQuestionActionLibrary.count();
  if (existing > 0) {
    console.log(`fal_question_action_library já tem ${existing} registros — pulando (rode com --force pra recriar).`);
    if (!process.argv.includes('--force')) return;
    await prisma.falQuestionActionLibrary.deleteMany({});
  }

  const questions = await prisma.falQuestion.findMany({
    select: { questionId: true, dimensionKey: true, subdimensionKey: true, clusterKey: true },
  });
  const questionByCode = new Map(questions.map((q) => [q.questionId, q]));

  let created = 0;
  let skippedNoQuestion = 0;
  for (const r of rows) {
    if (!r.question_id || !r.action_template) continue;
    const question = questionByCode.get(r.question_id);
    if (!question) {
      skippedNoQuestion++;
      continue;
    }
    await prisma.falQuestionActionLibrary.create({
      data: {
        questionId: r.question_id,
        dimensionKey: question.dimensionKey,
        subdimensionKey: question.subdimensionKey,
        clusterKey: question.clusterKey,
        actionTitle: r.action_template.slice(0, 120),
        actionDescription: r.action_template,
        responsibleRole: r.owner_role || null,
      },
    });
    created++;
  }
  console.log(`Seed concluído: ${created} ações criadas em fal_question_action_library (${skippedNoQuestion} puladas por question_id não encontrado).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
