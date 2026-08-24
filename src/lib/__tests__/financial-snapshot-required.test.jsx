import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const readFn = (name) => readFileSync(`base44/functions/${name}/entry.ts`, 'utf8');

describe('R4-SNP — snapshot obrigatório e fail-closed', () => {
  it.each(['buildFinancialStatements', 'prepareFinancialAnalysisDataset', 'finalizeFinancialInsights'])('%s exige snapshot_id antes do sucesso', (name) => {
    const source = readFn(name);
    expect(source).toMatch(/createFinancialProcessingSnapshot/);
    expect(source).toMatch(/snapshot\?\.snapshot_id/);
    expect(source).toMatch(/sem snapshot obrigatório/);
  });

  it('não converte falha de fonte crítica em arrays vazios', () => {
    const source = readFn('createFinancialProcessingSnapshot');
    expect(source).not.toMatch(/(?:FinancialStatementLine|FinancialIndicatorSnapshot|PreparedFinancialDatasetLine)[\s\S]{0,240}\.catch\(\(\)\s*=>\s*\[\]\)/);
  });

  it('aceita committing sem exigir succeeded prematuro', () => {
    const source = readFn('createFinancialProcessingSnapshot');
    expect(source).toMatch(/\['committing', 'succeeded'\]/);
  });

  it('seleciona predecessor pelo ponteiro corrente ativo, não pela maior versão', () => {
    const source = readFn('createFinancialProcessingSnapshot');
    expect(source).toMatch(/diagnosis\.current_processing_snapshot_id/);
    expect(source).toMatch(/PREVIOUS_SNAPSHOT_NOT_ACTIVE/);
    expect(source).not.toMatch(/const previousSnapshot = existingSnapshots\[0\]/);
  });

  it('publica current_processing_snapshot_id somente após releitura do snapshot e do run', () => {
    const source = readFn('createFinancialProcessingSnapshot');
    const reread = source.indexOf('persistedSnapshot');
    const publish = source.indexOf('current_processing_snapshot_id', reread);
    expect(reread).toBeGreaterThan(-1);
    expect(publish).toBeGreaterThan(reread);
  });
});