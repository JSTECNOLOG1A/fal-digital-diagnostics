import { readFileSync, readdirSync } from 'node:fs';

const app = readFileSync('src/App.jsx', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const functions = readdirSync('base44/functions', { withFileTypes: true }).filter((item) => item.isDirectory() && item.name.startsWith('debug'));
const failures = [];
if (pkg.dependencies.jspdf !== '4.2.1') failures.push('jsPDF deve permanecer exatamente 4.2.1');
if (functions.some((item) => app.includes(item.name))) failures.push('Function debug exposta por rota de aplicação');
if (!app.includes('AppErrorBoundary')) failures.push('ErrorBoundary global ausente');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`PASS: superfície de produção revisada; ${functions.length} functions debug não expostas por rota.`);