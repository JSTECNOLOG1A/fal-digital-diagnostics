/**
 * Validação CRUD da API FAL (auth + hierarquia + tenant).
 * Uso: node scripts/validate-crud-api.mjs
 */
const API = process.env.FAL_API_URL || 'http://localhost:3001/api/v1';
const EMAIL = process.env.SEED_HQ_EMAIL || 'admin@fal.local';
const PASSWORD = process.env.SEED_HQ_PASSWORD || 'FalTest123!';

const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, path, { body, token, tenantId } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message || res.statusText;
    const err = new Error(`${method} ${path} → ${res.status}: ${msg}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return { status: res.status, data };
}

async function main() {
  console.log(`=== Validação CRUD API @ ${API} ===\n`);

  // Health
  try {
    const h = await req('GET', '/health');
    check('health', h.data?.status === 'ok' || h.status === 200, JSON.stringify(h.data));
  } catch (e) {
    check('health', false, e.message);
    process.exit(1);
  }

  // Auth
  let token;
  let tenantId;
  try {
    const login = await req('POST', '/auth/login', {
      body: { email: EMAIL, password: PASSWORD },
    });
    token = login.data.accessToken;
    check('login HQ', !!token && login.data.user?.role === 'hq_admin', login.data.user?.email);
    const me = await req('GET', '/auth/me', { token });
    check('auth/me', me.data?.email === EMAIL, me.data?.role);
  } catch (e) {
    check('login HQ', false, e.message);
    process.exit(1);
  }

  // Tenants
  try {
    const list = await req('GET', '/tenants', { token });
    check('list tenants', Array.isArray(list.data) && list.data.length >= 1, `n=${list.data.length}`);
    tenantId = list.data[0].id;
    const got = await req('GET', `/tenants/${tenantId}`, { token });
    check('get tenant', got.data?.id === tenantId);

    const renamed = `Tenant Demo Local ${Date.now().toString().slice(-4)}`;
    const upd = await req('PATCH', `/tenants/${tenantId}`, {
      token,
      body: { name: renamed },
    });
    check('update tenant (salvar)', upd.data?.name === renamed);

    await req('PATCH', `/tenants/${tenantId}`, {
      token,
      body: { name: 'Tenant Demo Local' },
    });
    check('restore tenant name', true);
  } catch (e) {
    check('tenants CRUD', false, e.message);
  }

  // Group create/update/archive(delete soft)
  let groupId;
  let companyId;
  let unitId;
  const stamp = Date.now().toString(36);

  try {
    const g = await req('POST', '/groups', {
      token,
      tenantId,
      body: { name: `Grupo Validação ${stamp}`, tenantId },
    });
    groupId = g.data.id;
    check('create group (incluir)', !!groupId, g.data.name);

    const gUpd = await req('PATCH', `/groups/${groupId}`, {
      token,
      tenantId,
      body: { name: `Grupo Validação Editado ${stamp}` },
    });
    check('update group (alterar)', gUpd.data?.name?.includes('Editado'));

    const listed = await req('GET', '/groups', { token, tenantId });
    check(
      'list groups contains created',
      listed.data.some((x) => x.id === groupId),
      `n=${listed.data.length}`,
    );
  } catch (e) {
    check('group create/update', false, e.message);
  }

  try {
    const c = await req('POST', '/companies', {
      token,
      tenantId,
      body: {
        name: `Empresa Validação ${stamp}`,
        groupId,
        tenantId,
        cnpj: '12.345.678/0001-90',
        sector: 'Agro',
      },
    });
    companyId = c.data.id;
    check('create company (incluir)', !!companyId, `cnpj=${c.data.cnpj}`);

    const cUpd = await req('PATCH', `/companies/${companyId}`, {
      token,
      tenantId,
      body: { name: `Empresa Editada ${stamp}`, sector: 'Serviços' },
    });
    check('update company (alterar)', cUpd.data?.name?.includes('Editada') && cUpd.data?.sector === 'Serviços');
  } catch (e) {
    check('company create/update', false, e.message);
  }

  try {
    const u = await req('POST', '/units', {
      token,
      tenantId,
      body: {
        name: `Unidade Validação ${stamp}`,
        companyId,
        tenantId,
        code: 'UV1',
      },
    });
    unitId = u.data.id;
    check('create unit (incluir)', !!unitId);

    const uUpd = await req('PATCH', `/units/${unitId}`, {
      token,
      tenantId,
      body: { name: `Unidade Editada ${stamp}`, code: 'UV2' },
    });
    check('update unit (alterar)', uUpd.data?.code === 'UV2');
  } catch (e) {
    check('unit create/update', false, e.message);
  }

  // Soft delete / excluir
  try {
    await req('DELETE', `/units/${unitId}`, { token, tenantId });
    const units = await req('GET', '/units', { token, tenantId });
    check('delete unit (excluir)', !units.data.some((x) => x.id === unitId));

    await req('DELETE', `/companies/${companyId}`, { token, tenantId });
    const companies = await req('GET', '/companies', { token, tenantId });
    check('delete company (excluir)', !companies.data.some((x) => x.id === companyId));

    await req('DELETE', `/groups/${groupId}`, { token, tenantId });
    const groups = await req('GET', '/groups', { token, tenantId });
    check('delete group (excluir)', !groups.data.some((x) => x.id === groupId));
  } catch (e) {
    check('soft deletes', false, e.message);
  }

  // Local-domain CRUD still available via in-memory (smoke script)
  // Auth reject
  try {
    await req('POST', '/auth/login', {
      body: { email: EMAIL, password: 'wrong-password' },
    });
    check('login inválido rejeitado', false, 'aceitou senha errada');
  } catch (e) {
    check('login inválido rejeitado', e.status === 401, `status=${e.status}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Resultado: ${results.length - failed.length}/${results.length} PASS ===`);
  if (failed.length) {
    console.log('Falhas:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
