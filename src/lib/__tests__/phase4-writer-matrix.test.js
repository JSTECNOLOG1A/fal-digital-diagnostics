import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

describe('R4-PROD-WRITER-MATRIX', () => {
  it('classifies the productive PDF begin update', () => {
    const result = spawnSync(process.execPath, ['scripts/assert-action-task-writers.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('writer_matrix=pass');
  });
  it('rejects a begin handler that writes ActionTask', () => {
    const result = spawnSync(process.execPath, ['scripts/assert-action-task-writers.mjs', '--inject-begin-action-task'], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('PROHIBITED_DIRECT_WRITE');
  });
  it('rejects a generate handler that writes AssessmentReportVersion', () => {
    const result = spawnSync(process.execPath, ['scripts/assert-action-task-writers.mjs', '--inject-generate-report-update'], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('AssessmentReportVersion');
  });
  it('rejects a frontend recommendation write', () => {
    const result = spawnSync(process.execPath, ['scripts/assert-action-task-writers.mjs', '--inject-frontend-recommendation-update'], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('ActionRecommendation');
  });
});