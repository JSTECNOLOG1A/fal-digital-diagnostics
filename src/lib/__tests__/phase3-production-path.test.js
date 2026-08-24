import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { executeProductionEngine, PRODUCTION_ENGINE_CONTRACT } from '@/lib/financial/phase3/productionAdapter';
import { applyEliminations } from '@/lib/financial/phase3/consolidationEngine';
import { PHASE3_FIXTURE } from '@/lib/financial/phase3/phase3Fixture';

const read = (path) => readFileSync(path, 'utf8');
const sumEntities = (entities) => Object.values(entities).reduce((result, entity) => {
  for (const [key, value] of Object.entries(entity)) result[key] = (result[key] || 0) + value;
  return result;
}, {});

describe('F3 caminho produtivo', () => {
  it('expõe contrato versionado com 44 rubricas fonte', () => expect(PRODUCTION_ENGINE_CONTRACT).toEqual(expect.objectContaining({ registry_version:'3.0.0', formula_version:'FAL-FIN-3.0.0', source_rubrics:expect.any(Array) })));
  it('executa fixture individual no adapter usado pelo backend', () => expect(executeProductionEngine({ source_values:PHASE3_FIXTURE.entities.A }).statements).toEqual(expect.objectContaining(PHASE3_FIXTURE.expected.parent)));
  it('executa fixture consolidada após eliminações em rubricas fonte', () => {
    const gross = sumEntities(PHASE3_FIXTURE.entities);
    const source = applyEliminations(gross, PHASE3_FIXTURE.eliminations);
    expect(executeProductionEngine({ source_values:source }).statements).toEqual(expect.objectContaining(PHASE3_FIXTURE.expected.consolidated));
  });
  it('não calcula indicadores quando BP está desequilibrado', () => expect(executeProductionEngine({ source_values:{ ativo_circulante_caixa:100, patrimonio_capital:90 } }).indicators).toEqual([]));
  it('build e preparação consomem o mesmo endpoint canônico', () => {
    expect(read('base44/functions/buildFinancialStatements/entry.ts')).toContain("functions.invoke('executeFinancialEngine'");
    expect(read('base44/functions/prepareFinancialAnalysisDataset/entry.ts')).toContain("functions.invoke('executeFinancialEngine'");
  });
  it('build bloqueia BP com 422 antes de sucesso', () => {
    const source = read('base44/functions/buildFinancialStatements/entry.ts');
    expect(source).toContain("error: 'BP_ACCOUNTING_EQUATION_MISMATCH'");
    expect(source).toContain('{ status: 422 }');
  });
  it('snapshot é obrigatório entre committing e succeeded', () => {
    for (const path of ['base44/functions/buildFinancialStatements/entry.ts','base44/functions/prepareFinancialAnalysisDataset/entry.ts']) {
      const source = read(path);
      expect(source).toContain("status: 'committing'");
      expect(source).toContain('SNAPSHOT_POSTCONDITION_FAILED');
      expect(source).toContain("status: 'succeeded'");
    }
  });
  it('somente cédulas posted entram na preparação e no snapshot', () => {
    expect(read('base44/functions/prepareFinancialAnalysisDataset/entry.ts')).toContain("status: 'posted'");
    expect(read('base44/functions/createFinancialProcessingSnapshot/entry.ts')).not.toContain("['approved', 'posted']");
  });
});