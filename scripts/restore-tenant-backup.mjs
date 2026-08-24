import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const [file, ...flags] = process.argv.slice(2);
const apply = flags.includes('--apply');
const tenantFlag = flags.find((flag) => flag.startsWith('--tenant='))?.slice(9);
if (!file) throw new Error('Uso: node scripts/restore-tenant-backup.mjs backup.json --tenant=<tenant_id> [--apply]');
const backup = JSON.parse(readFileSync(file, 'utf8'));
if (backup?.manifest?.format !== 'fal-tenant-backup' || backup?.manifest?.format_version !== 1) throw new Error('Formato de backup inválido');
if (!tenantFlag || tenantFlag !== backup.manifest.tenant_id) throw new Error('Tenant informado diverge do pacote; restore recusado');
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value ?? null;
const sha = (value) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
for (const [fileName, entry] of Object.entries(backup.manifest.entities || {})) { const rows = backup.data[fileName.replace('.json', '')]; if (!Array.isArray(rows) || rows.length !== entry.count || sha(rows) !== entry.sha256) throw new Error(`Integridade inválida: ${fileName}`); }
const global = sha({ manifest: { ...backup.manifest, global_sha256: null }, data: backup.data });
if (global !== backup.manifest.global_sha256) throw new Error('Checksum global inválido');
const summary = Object.fromEntries(Object.entries(backup.manifest.entities).map(([fileName, entry]) => [fileName.replace('.json', ''), { creates: entry.count, updates: 0, conflicts: 0 }]));
console.log(JSON.stringify({ mode: apply ? 'apply_blocked_without_admin_runner' : 'dry-run', tenant_id: tenantFlag, summary }, null, 2));
if (apply) throw new Error('Restore com escrita requer executor administrativo autenticado; este script deliberadamente não escreve dados.');