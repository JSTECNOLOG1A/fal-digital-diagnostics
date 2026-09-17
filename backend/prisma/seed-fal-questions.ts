/**
 * Seed one-off: popula fal_questions com o banco real (311 perguntas)
 * já importado e validado durante a sessão de migração do domínio 8D.
 * Fonte: ../src/api/falSeedData/falQuestions.json (mesmo dado usado no
 * mock local base44, convertido a partir das planilhas reais do usuário).
 *
 * Rodar com: npx tsx prisma/seed-fal-questions.ts
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  const raw = readFileSync(
    join(__dirname, '..', '..', 'src', 'api', 'falSeedData', 'falQuestions.json'),
    'utf-8',
  );
  const questions = JSON.parse(raw) as Array<{
    question_id: string;
    dimension_key: string;
    subdimension_key: string;
    cluster_key: string;
    process_stage: string;
    sequence_order: number;
    diagnostic_depth: string[];
    level_applicability: string[];
    question_weight: number;
    question_text: string;
    guidance?: string;
    evidence_hint?: string;
    is_killer_question?: boolean;
    is_critical?: boolean;
    dependency?: string;
  }>;

  const existing = await prisma.falQuestion.count();
  if (existing > 0) {
    console.log(`fal_questions já tem ${existing} registros — pulando (rode com --force pra recriar).`);
    if (!process.argv.includes('--force')) return;
    await prisma.falQuestion.deleteMany({});
  }

  let created = 0;
  for (const q of questions) {
    if (!q.question_id || !q.question_text) continue;
    await prisma.falQuestion.create({
      data: {
        questionId: q.question_id,
        dimensionKey: q.dimension_key,
        subdimensionKey: q.subdimension_key,
        clusterKey: q.cluster_key,
        processStage: q.process_stage,
        sequenceOrder: q.sequence_order || 0,
        diagnosticDepth: q.diagnostic_depth || [],
        levelApplicability: q.level_applicability || [],
        questionWeight: q.question_weight ?? 1,
        questionText: q.question_text,
        guidance: q.guidance || null,
        evidenceHint: q.evidence_hint || null,
        isKillerQuestion: !!q.is_killer_question,
        isCritical: !!q.is_critical,
        dependency: q.dependency || null,
      },
    });
    created++;
  }
  console.log(`Seed concluído: ${created} perguntas criadas em fal_questions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
