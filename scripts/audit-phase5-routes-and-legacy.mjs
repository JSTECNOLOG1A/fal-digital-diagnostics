import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const requiredPolicies = ['Dashboard', 'Groups', 'GroupDetail', 'Tenants', 'SystemSettings', 'SmokeTest', 'FalHardening', 'Onboarding'];
const policy = readFileSync('src/lib/routePolicies.js', 'utf8'); const app = readFileSync('src/App.jsx', 'utf8'); const failures = [];
for (const name of requiredPolicies) if (!policy.includes(`${name}:`)) failures.push(`Policy ausente: ${name}`);
if (!app.includes('GroupCycleDashboard') || !app.includes('tab=visao-geral')) failures.push('Redirect legado GroupCycleDashboard inválido');
const legacyDir = 'src/components/legacy'; const legacyFiles = existsSync(legacyDir) ? readdirSync(legacyDir).filter((file) => file.endsWith('.jsx')) : [];
const projectSources = ['src/App.jsx', 'src/pages.config.js', ...readdirSync('src/pages').filter((name) => name.endsWith('.jsx')).map((name) => join('src/pages', name))].map((path) => readFileSync(path, 'utf8')).join('\n');
for (const file of legacyFiles) { const component = file.replace('.jsx', ''); if (projectSources.includes(component)) failures.push(`Consumer legado ativo sem migração: ${component}`); }
if (app.includes('IntegratedSynthesisBlock')) failures.push('Referência proibida: IntegratedSynthesisBlock');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`PASS: ${legacyFiles.length} componentes legados sem consumer de rota; redirect explícito preservado e nenhuma extensão é usada como justificativa.`);