import { describe, expect, it } from 'vitest';
import { executeBackendFunction } from '@/lib/phase4/backendFunctionHarness';

const user = { email: 'consultant@fal.test', tenant_id: 'tenant-f4', app_role: 'consultant' };
const versions = [{ id: 'report-1', tenant_id: 'tenant-f4', assessment_id: 'assessment-f4', report_type: 'executive_summary', status: 'active', mark_as_official: true, pdf_status: 'generated' }, { id: 'report-2', tenant_id: 'tenant-f4', assessment_id: 'assessment-f4', report_type: 'executive_summary', status: 'generated', mark_as_official: false, pdf_status: 'generated' }];

describe('F4 productive official and archive', () => {
  it('replaces the official report through the real handler', async () => {
    const result = await executeBackendFunction({ functionName: 'setOfficialAssessmentReportVersion', user, seed: { AssessmentReportVersion: versions }, payload: { report_version_id: 'report-2' } });
    expect(result.response.status).toBe(200);
    expect(result.state.AssessmentReportVersion.filter((item) => item.mark_as_official)).toHaveLength(1);
    expect(result.state.AssessmentReportVersion.find((item) => item.id === 'report-2').status).toBe('active');
  });
  it('protects the sole official archive through the real handler', async () => {
    const result = await executeBackendFunction({ functionName: 'archiveReportVersion', user, seed: { AssessmentReportVersion: [versions[0]] }, payload: { report_version_id: 'report-1' } });
    expect(result.response.status).toBe(409);
    expect(result.response.body.error).toBe('OFFICIAL_REPORT_REPLACEMENT_REQUIRED');
  });
});