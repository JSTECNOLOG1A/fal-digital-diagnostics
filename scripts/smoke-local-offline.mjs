/**
 * Smoke offline — valida rotinas locais sem Base44.
 * Uso: node scripts/smoke-local-offline.mjs
 */
import { createLocalBase44Client } from '../src/api/localBase44Client.js';
import {
  LOCAL_TEST_CREDENTIALS,
  createLocalTestUser,
  validateLocalTestCredentials,
} from '../src/lib/localTestAuth.js';

const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  // Em Node, import.meta.env não existe como no Vite — simulamos DEV local.
  if (!globalThis.import_meta_env_shim) {
    // localTestAuth usa import.meta.env via Vite; aqui validamos a lógica pura.
  }

  check(
    'credenciais locais válidas',
    validateLocalTestCredentials(LOCAL_TEST_CREDENTIALS.email, LOCAL_TEST_CREDENTIALS.password),
    `${LOCAL_TEST_CREDENTIALS.email}`
  );
  check(
    'credenciais inválidas rejeitadas',
    !validateLocalTestCredentials('x@y.com', 'wrong'),
  );

  const user = createLocalTestUser();
  check('usuário HQ seed', user.app_role === 'hq_admin' && user.role === 'admin');

  const client = createLocalBase44Client();
  const tenants = await client.entities.Tenant.filter({ active: true }, 'name', 100);
  check('tenants seed >= 1', tenants.length >= 1, `count=${tenants.length}`);
  check(
    'tenant demo presente',
    tenants.some((t) => t.slug === 'demo-local'),
  );

  const methodVersions = await client.entities.MethodVersion.filter({ status: 'active' });
  check('method version ativa', methodVersions.length >= 1);

  const tenant = tenants.find((t) => t.slug === 'demo-local');
  const got = await client.entities.Tenant.get(tenant.id);
  check('Tenant.get funciona', got?.id === tenant.id);

  const groups = await client.entities.Group.filter({ tenant_id: tenant.id });
  check('grupo seed no tenant', groups.length >= 1);

  const companies = await client.entities.Company.filter({ tenant_id: tenant.id });
  check('empresa seed no tenant', companies.length >= 1);

  const created = await client.entities.Assessment.create({
    tenant_id: tenant.id,
    name: 'Assessment Smoke',
    status: 'draft',
  });
  check('Assessment.create', !!created?.id);

  const listed = await client.entities.Assessment.filter({ tenant_id: tenant.id });
  check('Assessment.filter', listed.some((a) => a.id === created.id));

  const updated = await client.entities.Assessment.update(created.id, { status: 'in_progress' });
  check('Assessment.update', updated.status === 'in_progress');

  await client.entities.Assessment.delete(created.id);
  let deleted = false;
  try {
    await client.entities.Assessment.get(created.id);
  } catch (e) {
    deleted = e.status === 404;
  }
  check('Assessment.delete', deleted);

  const fn = await client.functions.invoke('smokeProbe', { ping: true });
  check('functions.invoke stub', fn?.data?.success === true && fn?.data?.local === true);

  const me = await client.auth.me();
  check('auth.me local', !!me?.email);

  // HTTP smoke do frontend
  try {
    const res = await fetch('http://localhost:5173/');
    check('frontend HTTP 200', res.status === 200);
    const html = await res.text();
    check('frontend serve root', html.includes('root') || html.includes('Base44') || html.includes('vite'));
  } catch (e) {
    check('frontend HTTP 200', false, e.message);
    check('frontend serve root', false, 'servidor offline');
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n---');
  console.log(`Total: ${results.length} | PASS: ${results.length - failed.length} | FAIL: ${failed.length}`);
  if (failed.length) {
    process.exitCode = 1;
  }

  // JSON summary for reporting
  console.log(JSON.stringify({ suite: 'smoke-local-offline', results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
