import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['src/pages', 'src/components', 'src/lib/hooks'];
const globalCatalogs = new Set(['FalQuestion', 'FalDimension', 'MQEQuestion', 'ScopeTemplate', 'FalDriverCatalog', 'FalRootCauseCatalog', 'FalCluster', 'FalSubdimension', 'FalBenchmark', 'FalActionLibrary', 'FalRecommendationLibrary', 'ActionRecommendationLibrary', 'MethodVersion']);
const approvedLegacyExceptions = new Set(['src/pages/ClientDetail.jsx', 'src/components/actionplan/DimensionEvolutionChart.jsx', 'src/components/assessment/LocalDiagnosticPanel.jsx', 'src/components/assessment/flowchart/PhaseOneContent.jsx', 'src/components/assessments/AssessmentDetail.jsx', 'src/components/client/CompanyProfileForm.jsx', 'src/components/fal/FalDimensionProgress.jsx', 'src/components/fal/FalIntelligencePanel.jsx', 'src/components/fal/FalPriorityPanel.jsx', 'src/components/fal/FalRadarTab.jsx', 'src/components/fal/FalResultsPanel.jsx', 'src/components/financial/CompositionPreview.jsx', 'src/components/financial/KanitzFormulaBreakdown.jsx', 'src/components/intelligence/DriverView.jsx', 'src/components/intelligence/RootCausePanel.jsx', 'src/components/mfis/MfisEmbedded.jsx']);
const files = [];
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).forEach((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : /\.(js|jsx)$/.test(entry.name) && files.push(join(dir, entry.name)));
roots.forEach(walk);
const violations = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const entities = [...source.matchAll(/base44\.entities\.([A-Za-z0-9_]+)\.(?:list|filter|get|create|update|delete)/g)].map((match) => match[1]);
  const tenantEntities = entities.filter((entity) => !globalCatalogs.has(entity));
  if (!tenantEntities.length || approvedLegacyExceptions.has(file)) continue;
  const hasTenantContext = /tenantId|tenant_id|useTenant|tenantKey|groupKey|assessmentKey|companyKey|unitKey/.test(source);
  if (!hasTenantContext) violations.push(`${file}: consulta de ${[...new Set(tenantEntities)].join(', ')} sem contexto explícito de tenant`);
}
if (violations.length) { console.error(violations.join('\n')); process.exit(1); }
console.log(`PASS: ${files.length} arquivos auditados; ${approvedLegacyExceptions.size} exceções legadas rastreadas; catálogos globais allowlisted: ${[...globalCatalogs].join(', ')}.`);