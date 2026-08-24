import { describe, expect, it } from 'vitest';
import { executeBackendFunction } from '@/lib/phase4/backendFunctionHarness';

const checksum = 'a'.repeat(64);
const user = { email: 'consultant@fal.test', tenant_id: 'tenant-1', app_role: 'consultant' };
const report = { id: 'report-1', tenant_id: 'tenant-1', assessment_id: 'assessment-1', report_type: 'executive_summary', report_title: 'R', status: 'generated', payload_checksum: checksum };

describe('R4-PROD PDF handlers', () => {
  it('executes productive begin handler and persists a single pending operation', async () => {
    const result = await executeBackendFunction({ functionName: 'beginReportPdfArtifact', user, seed: { AssessmentReportVersion: [report] }, payload: { report_version_id: report.id } });
    expect(result.productiveSourcePath).toContain('beginReportPdfArtifact/entry.ts');
    expect(result.response.status).toBe(200);
    expect(result.body.reused).toBe(false);
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0]).toMatchObject({ entity: 'AssessmentReportVersion', method: 'update' });
    expect(result.state.AssessmentReportVersion[0].pdf_status).toBe('pending');
  });
  it('rejects concurrent begin against a physical pending operation', async () => {
    const pending = { ...report, pdf_status: 'pending', pdf_operation_id: 'winner' };
    const result = await executeBackendFunction({ functionName: 'beginReportPdfArtifact', user, seed: { AssessmentReportVersion: [pending] }, payload: { report_version_id: report.id } });
    expect(result.response.status).toBe(409);
    expect(result.body.error).toBe('PDF_OPERATION_IN_PROGRESS');
    expect(result.mutations).toHaveLength(0);
  });
  it('executes productive commit handler with actual operation and metadata', async () => {
    const pending = { ...report, pdf_status: 'pending', pdf_operation_id: 'operation-1' };
    const result = await executeBackendFunction({ functionName: 'commitReportPdfArtifact', user, seed: { AssessmentReportVersion: [pending] }, payload: { report_version_id: report.id, pdf_operation_id: 'operation-1', payload_checksum: checksum, pdf_upload_identifier: 'upload-1', pdf_file_url: 'https://files.base44.com/report.pdf', pdf_storage_provider: 'base44', pdf_storage_key: 'reports/report.pdf', pdf_file_size: 12, pdf_page_count: 1, pdf_checksum: checksum } });
    expect(result.response.status).toBe(200);
    expect(result.state.AssessmentReportVersion[0]).toMatchObject({ pdf_status: 'generated', pdf_upload_identifier: 'upload-1', pdf_storage_key: 'reports/report.pdf' });
  });
  it('accepts the Base44 file URL only when it is the matching upload identifier', async () => {
    const pending = { ...report, pdf_status: 'pending', pdf_operation_id: 'operation-2' };
    const url = 'https://files.base44.com/report.pdf';
    const result = await executeBackendFunction({ functionName: 'commitReportPdfArtifact', user, seed: { AssessmentReportVersion: [pending] }, payload: { report_version_id: report.id, pdf_operation_id: 'operation-2', payload_checksum: checksum, pdf_upload_identifier: url, pdf_file_url: url, pdf_storage_provider: 'base44', pdf_storage_key: null, pdf_file_size: 12, pdf_page_count: 1, pdf_checksum: checksum } });
    expect(result.response.status).toBe(200);
    expect(result.state.AssessmentReportVersion[0].pdf_storage_key).toBeNull();
  });
  it('rejects external or mismatched URL upload identifiers', async () => {
    const pending = { ...report, pdf_status: 'pending', pdf_operation_id: 'operation-3' };
    const result = await executeBackendFunction({ functionName: 'commitReportPdfArtifact', user, seed: { AssessmentReportVersion: [pending] }, payload: { report_version_id: report.id, pdf_operation_id: 'operation-3', payload_checksum: checksum, pdf_upload_identifier: 'https://external.example/report.pdf', pdf_file_url: 'https://files.base44.com/report.pdf', pdf_storage_provider: 'base44', pdf_storage_key: null, pdf_file_size: 12, pdf_page_count: 1, pdf_checksum: checksum } });
    expect(result.response.status).toBe(400);
    expect(result.body.error).toBe('PDF_STORAGE_REFERENCE_INVALID');
  });
});