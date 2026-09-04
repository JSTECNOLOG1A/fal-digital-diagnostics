/**
 * Seed one-off: popula fal_action_library com os dados reais (54 registros)
 * importados nesta sessão de migração do domínio 8D.
 * Fonte: ../../src/api/falSeedData/falActionLibrary.json
 *
 * Rodar com: npx tsx prisma/seed-fal-action-library.ts
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  const raw = readFileSync(
    join(__dirname, '..', '..', 'src', 'api', 'falSeedData', 'falActionLibrary.json'),
    'utf-8',
  );
  const rows = JSON.parse(raw) as Array<Record<string, any>>;

  const existing = await prisma.falActionLibrary.count();
  if (existing > 0) {
    console.log(`fal_action_library já tem ${existing} registros — pulando (rode com --force pra recriar).`);
    if (!process.argv.includes('--force')) return;
    await prisma.falActionLibrary.deleteMany({});
  }

  let created = 0;
  for (const a of rows) {
    if (!a.action_key || !a.title || !a.dimension_key) continue;
    await prisma.falActionLibrary.create({
      data: {
        tenantId: a.tenant_id || null,
        actionKey: a.action_key,
        title: a.title,
        description: a.description || null,
        dimensionKey: a.dimension_key,
        subdimensionKey: a.subdimension_key || null,
        clusterKey: a.cluster_key || null,
        driverIds: a.driver_ids || [],
        scoreTriggerMax: a.score_trigger_max ?? 2.5,
        killerQuestionTrigger: !!a.killer_question_trigger,
        impactScore: a.impact_score ?? null,
        effortScore: a.effort_score ?? null,
        actionType: a.action_type || null,
        defaultHorizon: a.default_horizon || null,
        typicalOwner: a.typical_owner || null,
        dependencyActionKeys: a.dependency_action_keys || [],
        levelApplicability: a.level_applicability || ['group', 'company', 'unit', 'holding'],
        sectorTags: a.sector_tags || [],
        isActive: a.active !== false,
      },
    });
    created++;
  }
  console.log(`Seed concluído: ${created} ações criadas em fal_action_library.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
