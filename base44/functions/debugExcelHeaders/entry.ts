import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import * as XLSX from 'npm:xlsx@0.18.5';
import { unzipSync, zipSync } from 'npm:fflate@0.8.2';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const MINIMAL_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: debug function restricted to hq_admin' }, { status: 403 });

  const { upload_id } = await req.json();
  const upload = await base44.entities.FinancialUpload.get(upload_id);
  if (!upload) return Response.json({ error: 'Upload not found' }, { status: 404 });

  const fileResp = await fetch(upload.file_url);
  const raw = new Uint8Array(await fileResp.arrayBuffer());

  let cleaned = raw;
  try {
    const files = unzipSync(raw);
    const enc = new TextEncoder();
    cleaned = zipSync({ ...files, 'xl/styles.xml': enc.encode(MINIMAL_STYLES) });
  } catch {}

  const wb = XLSX.read(cleaned, { type: 'array', cellStyles: false, cellNF: false, cellFormula: false, defval: '' });
  
  const result = {};
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const headers = (rows[0] || []).map(h => String(h ?? '').trim());
    const sample = rows.slice(1, 4).map(r => headers.reduce((acc, h, i) => { acc[h] = r[i]; return acc; }, {}));
    result[sheetName] = { headers, sample_rows: sample };
  }

  return Response.json(result);
});