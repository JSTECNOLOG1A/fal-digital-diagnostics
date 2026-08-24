import { describe, expect, it } from 'vitest';
import { canonical, sha256 } from '../../../base44/shared/tenantBackupIntegrity.ts';
import { classifyRestoreRow, hasOrphanReference } from '@/lib/phase5/backupContracts';

describe('F5-BKP-01 backup integrity', () => {
  it('keeps checksum stable and detects corruption', async () => { const original = { b: 2, a: { z: 1, y: 2 } }; expect(canonical(original)).toEqual({ a: { y: 2, z: 1 }, b: 2 }); expect(await sha256(original)).not.toBe(await sha256({ ...original, b: 3 })); });
  it('calculates create update and conflict without writing', () => { expect(classifyRestoreRow({ id: '1', tenant_id: 't1', name: 'A' }, null)).toBe('create'); expect(classifyRestoreRow({ id: '1', tenant_id: 't1', name: 'A' }, { id: '1', tenant_id: 't1', name: 'B' })).toBe('update'); expect(classifyRestoreRow({ id: '1', tenant_id: 't1' }, { id: '1', tenant_id: 't2' })).toBe('conflict'); });
  it('rejects orphan references', () => expect(hasOrphanReference({ company_id: 'missing' }, { company_id: ['known'] })).toBe(true));
});