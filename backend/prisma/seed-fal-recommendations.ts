/**
 * Seed one-off: popula fal_recommendation_library com o banco real (216
 * recomendações) já importado e validado durante a sessão de migração
 * do domínio 8D.
 * Fonte: ../../src/api/falSeedData/falRecommendationLibrary.json
 *
 * Rodar com: npx tsx prisma/seed-fal-recommendations.ts
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  const raw = readFileSync(
    join(__dirname, '..', '..', 'src', 'api', 'falSeedData', 'falRecommendationLibrary.json'),
    'utf-8',
  );
  const rows = JSON.parse(raw) as Array<Record<string, any>>;

  const existing = await prisma.falRecommendationLibrary.count();
  if (existing > 0) {
    console.log(`fal_recommendation_library já tem ${existing} registros — pulando (rode com --force pra recriar).`);
    if (!process.argv.includes('--force')) return;
    await prisma.falRecommendationLibrary.deleteMany({});
  }

  let created = 0;
  for (const r of rows) {
    if (!r.recommendation_key || !r.recommendation_title) continue;
    await prisma.falRecommendationLibrary.create({
      data: {
        recommendationKey: r.recommendation_key,
        source: r.source || null,
        sourceType: r.source_type || null,
        dimensionKey: r.dimension_key,
        subdimensionKey: r.subdimension_key || null,
        clusterKey: r.cluster_key,
        questionId: r.question_id || null,
        triggerScore: r.trigger_score ?? null,
        gapLevel: r.gap_level ?? null,
        isActionable: r.is_actionable ?? true,
        recommendationType: r.recommendation_type || null,
        recommendationTitle: r.recommendation_title,
        recommendationDescription: r.recommendation_description || null,
        implementationSteps: Array.isArray(r.implementation_steps) ? r.implementation_steps : [],
        evidenceRequired: r.evidence_required || null,
        successIndicators: r.success_indicators || null,
        routineTemplate: r.routine_template || null,
        effortLevel: r.effort_level ?? null,
        impactLevel: r.impact_level ?? null,
        priorityWeight: r.priority_weight ?? null,
        typicalOwner: r.typical_owner || null,
        estimatedTimeframe: r.estimated_timeframe || null,
        clusterQuestionCount: r.cluster_question_count ?? null,
        tenantId: 'global',
        version: r.version ? String(r.version) : '1.0',
        notes: r.notes || null,
        isActive: r.is_active ?? true,
      },
    });
    created++;
  }
  console.log(`Seed concluído: ${created} recomendações criadas em fal_recommendation_library.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
