import { PrismaClient, AppRole, AccessStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient({
  datasources: {
    db: {
      // Seed roda como owner (bypass RLS / CREATE)
      url: process.env.DATABASE_URL_OWNER || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  // Com FORCE RLS, mesmo o owner precisa de contexto HQ no seed
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.is_hq', 'true', false), set_config('app.tenant_id', '', false)`,
  );

  const email = process.env.SEED_HQ_EMAIL ?? 'admin@fal.local';
  const password = process.env.SEED_HQ_PASSWORD ?? 'FalTest123!';
  const tenantSlug = process.env.SEED_TENANT_SLUG ?? 'demo';
  const tenantName = process.env.SEED_TENANT_NAME ?? 'Tenant Demo Local';

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: tenantName, isActive: true, deletedAt: null },
    create: { name: tenantName, slug: tenantSlug },
  });

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.user.upsert({
    where: { email },
    update: {
      name: 'HQ Admin',
      passwordHash,
      role: AppRole.hq_admin,
      tenantId: null,
      accessStatus: AccessStatus.active,
      deletedAt: null,
    },
    create: {
      email,
      name: 'HQ Admin',
      passwordHash,
      role: AppRole.hq_admin,
      tenantId: null,
      accessStatus: AccessStatus.active,
    },
  });

  const tenantAdminEmail = `admin@${tenantSlug}.local`;
  await prisma.user.upsert({
    where: { email: tenantAdminEmail },
    update: {
      name: 'Tenant Admin',
      passwordHash,
      role: AppRole.tenant_admin,
      tenantId: tenant.id,
      accessStatus: AccessStatus.active,
      deletedAt: null,
    },
    create: {
      email: tenantAdminEmail,
      name: 'Tenant Admin',
      passwordHash,
      role: AppRole.tenant_admin,
      tenantId: tenant.id,
      accessStatus: AccessStatus.active,
    },
  });

  const groupExisting = await prisma.group.findFirst({
    where: { tenantId: tenant.id, name: 'Agro Consultoria Demo', deletedAt: null },
  });
  const group =
    groupExisting ??
    (await prisma.group.create({
      data: {
        name: 'Agro Consultoria Demo',
        tenantId: tenant.id,
      },
    }));

  const companyExisting = await prisma.company.findFirst({
    where: { tenantId: tenant.id, name: 'Fazenda Demo Ltda', deletedAt: null },
  });
  if (!companyExisting) {
    await prisma.company.create({
      data: {
        name: 'Fazenda Demo Ltda',
        tenantId: tenant.id,
        groupId: group.id,
        cnpj: '00.000.000/0001-00',
        sector: 'Agro',
      },
    });
  }

  const methodExisting = await prisma.methodVersion.findFirst({
    where: { tenantId: tenant.id, code: 'FAL', version: '1.0.0' },
  });
  if (!methodExisting) {
    await prisma.methodVersion.create({
      data: {
        tenantId: tenant.id,
        code: 'FAL',
        version: '1.0.0',
        name: 'Método FAL',
        isPublished: true,
        publishedAt: new Date(),
        payload: { note: 'Catálogo base — expandir nas próximas sprints' },
      },
    });
  }

  console.log('Seed OK');
  console.log(`  HQ: ${email} / (SEED_HQ_PASSWORD)`);
  console.log(`  Tenant admin: ${tenantAdminEmail}`);
  console.log(`  Tenant: ${tenant.slug} (${tenant.id})`);
  console.log(`  Group: ${group.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
