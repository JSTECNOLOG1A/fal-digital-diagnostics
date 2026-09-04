/**
 * Seed one-off: popula fal_cluster_causes e fal_cluster_recommendations
 * com os dados reais (54 registros cada) importados nesta sessão de
 * migração do domínio 8D.
 * Fontes: ../../src/api/falSeedData/falClusterCause.json e
 * .../falClusterRecommendation.json
 *
 * NOTA: falBenchmark.json NÃO é semeado aqui de propósito — seu formato
 * (sector/benchmark_value/benchmark_description) não bate com o schema
 * real de FalBenchmark (benchmark_group/avg_score/p75_score/p90_score),
 * que exige percentis reais. Semear com percentis nulos faria
 * benchmarkPosition() em computeClusterIntelligence classificar tudo
 * incorretamente como "top10" (null vira 0 na comparação >=).
 *
 * Rodar com: npx tsx prisma/seed-fal-intelligence.ts
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

function loadJson(name: string) {
  const raw = readFileSync(
    join(__dirname, '..', '..', 'src', 'api', 'falSeedData', name),
    'utf-8',
  );
  return JSON.parse(raw) as Array<Record<string, any>>;
}

async function seedCauses(force: boolean) {
  const existing = await prisma.falClusterCause.count();
  if (existing > 0) {
    console.log(`fal_cluster_causes já tem ${existing} registros — pulando.`);
    if (!force) return;
    await prisma.falClusterCause.deleteMany({});
  }
  const rows = loadJson('falClusterCause.json');
  let created = 0;
  for (const c of rows) {
    if (!c.cluster_key || !c.cause_key || !c.cause_description) continue;
    await prisma.falClusterCause.create({
      data: {
        clusterKey: c.cluster_key,
        dimensionKey: c.dimension_key || null,
        causeKey: c.cause_key,
        causeDescription: c.cause_description,
        probabilityWeight: c.probability_weight ?? 1,
        triggerScoreBelow: c.trigger_score_below ?? 2,
      },
    });
    created++;
  }
  console.log(`Seed concluído: ${created} causas criadas em fal_cluster_causes.`);
}

async function seedRecommendations(force: boolean) {
  const existing = await prisma.falClusterRecommendation.count();
  if (existing > 0) {
    console.log(`fal_cluster_recommendations já tem ${existing} registros — pulando.`);
    if (!force) return;
    await prisma.falClusterRecommendation.deleteMany({});
  }
  const rows = loadJson('falClusterRecommendation.json');
  let created = 0;
  for (const r of rows) {
    if (!r.cluster_key || !r.recommendation_key || !r.recommendation_text) continue;
    await prisma.falClusterRecommendation.create({
      data: {
        clusterKey: r.cluster_key,
        dimensionKey: r.dimension_key || null,
        recommendationKey: r.recommendation_key,
        recommendationText: r.recommendation_text,
        impactLevel: r.impact_level ?? 3,
        implementationComplexity: r.implementation_complexity ?? 3,
        estimatedTime: r.estimated_time || null,
      },
    });
    created++;
  }
  console.log(`Seed concluído: ${created} recomendações criadas em fal_cluster_recommendations.`);
}

async function main() {
  const force = process.argv.includes('--force');
  await seedCauses(force);
  await seedRecommendations(force);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
