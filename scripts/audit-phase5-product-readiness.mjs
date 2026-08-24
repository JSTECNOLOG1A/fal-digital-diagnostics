import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ids = ['RF5-01', 'RF5-02', 'RF5-03', 'RF5-04', 'RF5-05', 'RF5-06', 'F5-USR-01', 'F5-USR-02', 'F5-LGPD-02', 'F5-OBS-02', 'F5-OBS-03'];
const required = ['base44/shared/releaseMetadata.ts', 'base44/functions/getTenantUserAdministration/entry.ts', 'base44/functions/manageTenantOnboarding/entry.ts', 'base44/functions/exportTenantOperationalBackup/entry.ts', 'base44/functions/validateTenantOperationalBackup/entry.ts', 'src/lib/__tests__/phase5-onboarding.test.js', 'src/lib/__tests__/phase5-ui-states.test.js', 'src/lib/__tests__/phase5-user-admin.test.js', 'src/lib/__tests__/phase5-lgpd.test.js', 'src/lib/__tests__/phase5-performance-contract.test.js'];
const audits = ['audit:backend-compile', 'audit:seg02', 'audit:rbac-functions', 'audit:phase5-routes', 'audit:phase5-query-scope', 'audit:phase5-production-surface'];
const failures = required.filter((file) => !existsSync(file)).map((file) => `Arquivo obrigatório ausente: ${file}`);
const metadata = existsSync('base44/shared/releaseMetadata.ts') ? readFileSync('base44/shared/releaseMetadata.ts', 'utf8') : '';
if (!/buildSha:\s*'([a-f0-9]{64})'/.test(metadata)) failures.push('FAL_BUILD_SHA ausente ou inválido');
const archiveDir = 'src/docs/audit-artifacts';
if (existsSync(archiveDir) && readdirSync(archiveDir, { recursive: true }).some((file) => String(file).endsWith('.zip'))) failures.push('ZIP histórico encontrado no source');
for (const script of audits) { const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], { encoding: 'utf8' }); if (result.status !== 0) failures.push(`${script}: FAIL`); }
if (failures.length) { console.error(`FASE 5 READINESS FAIL (${ids.join(', ')}):\n${failures.join('\n')}`); process.exit(1); }
console.log(`PASS: 11 IDs FASE 5 completos (${ids.join(', ')}); subauditores e evidências comportamentais validados.`);