import { describe, expect, it } from 'vitest';
import { executeBackendFunction } from '@/lib/phase4/backendFunctionHarness';

describe('F4 productive report version guard', () => {
  it('executes the real version handler and fail-closes when mandatory sources are absent', async () => {
    const result = await executeBackendFunction({ functionName: 'generateAssessmentReportVersion', user: { email: 'consultant@fal.test', tenant_id: 'tenant-f4', app_role: 'consultant' }, seed: { Assessment: [{ id: 'assessment-f4', tenant_id: 'tenant-f4' }] }, payload: { assessment_id: 'assessment-f4', report_type: 'executive_summary', report_title: 'R' } });
    expect(result.productiveSourcePath).toContain('generateAssessmentReportVersion/entry.ts');
    expect(result.response.status).toBeGreaterThanOrEqual(400);
    expect(result.mutations).toHaveLength(0);
  });
});