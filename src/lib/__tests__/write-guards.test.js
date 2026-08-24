/**
 * Write Guards — P0 Corrective Patch Tests
 * =====================================================================
 * Tests the resolveAppRole + assertCanWrite guard logic used by the 11
 * write-guarded backend functions.
 *
 * Fixtures:
 *   hqAdmin       → ALLOW
 *   tenantAdmin   → ALLOW
 *   consultant    → ALLOW
 *   clientViewer  → DENY 403
 *   unclassified  → DENY 403 (role=user, app_role=null)
 *
 * For denied cases, verifies that NO mutation is ever called.
 */
import { describe, it, expect, vi } from 'vitest';

// ── Replicate exact guard logic from backend functions ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);

function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);

function assertCanWrite(appRole) {
  if (!WRITE_ROLES.has(appRole)) {
    throw Object.assign(
      new Error('Forbidden: write permission required'),
      { status: 403 }
    );
  }
}

// ── Fixtures ──
const hqAdmin = { role: 'admin', app_role: 'hq_admin', tenant_id: null };
const tenantAdmin = { role: 'user', app_role: 'tenant_admin', tenant_id: 'tenant-a' };
const consultant = { role: 'user', app_role: 'consultant', tenant_id: 'tenant-a' };
const clientViewer = { role: 'user', app_role: 'client_viewer', tenant_id: 'tenant-a' };
const unclassified = { role: 'user', app_role: null, tenant_id: 'tenant-a' };

// ── Mock mutation tracker ──
function createMutationTracker() {
  const tracker = {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkCreate: vi.fn(),
    bulkUpdate: vi.fn(),
    bulkDelete: vi.fn(),
  };
  return tracker;
}

describe('Write Guards — P0', () => {
  describe('resolveAppRole', () => {
    it('hq_admin → hq_admin', () => {
      expect(resolveAppRole(hqAdmin)).toBe('hq_admin');
    });
    it('tenant_admin → tenant_admin', () => {
      expect(resolveAppRole(tenantAdmin)).toBe('tenant_admin');
    });
    it('consultant → consultant', () => {
      expect(resolveAppRole(consultant)).toBe('consultant');
    });
    it('client_viewer → client_viewer', () => {
      expect(resolveAppRole(clientViewer)).toBe('client_viewer');
    });
    it('unclassified (role=user, app_role=null) → null (DENY)', () => {
      expect(resolveAppRole(unclassified)).toBe(null);
    });
    it('null user → null', () => {
      expect(resolveAppRole(null)).toBe(null);
    });
  });

  describe('assertCanWrite — ALLOW cases', () => {
    it('hq_admin → ALLOW (no throw)', () => {
      const appRole = resolveAppRole(hqAdmin);
      expect(() => assertCanWrite(appRole)).not.toThrow();
    });
    it('tenant_admin → ALLOW (no throw)', () => {
      const appRole = resolveAppRole(tenantAdmin);
      expect(() => assertCanWrite(appRole)).not.toThrow();
    });
    it('consultant → ALLOW (no throw)', () => {
      const appRole = resolveAppRole(consultant);
      expect(() => assertCanWrite(appRole)).not.toThrow();
    });
  });

  describe('assertCanWrite — DENY cases', () => {
    it('client_viewer → DENY 403', () => {
      const appRole = resolveAppRole(clientViewer);
      expect(() => assertCanWrite(appRole)).toThrow();
      try {
        assertCanWrite(appRole);
        expect.unreachable('Should have thrown');
      } catch (e) {
        expect(e.status).toBe(403);
        expect(e.message).toBe('Forbidden: write permission required');
      }
    });
    it('unclassified → DENY 403', () => {
      const appRole = resolveAppRole(unclassified);
      expect(() => assertCanWrite(appRole)).toThrow();
      try {
        assertCanWrite(appRole);
        expect.unreachable('Should have thrown');
      } catch (e) {
        expect(e.status).toBe(403);
      }
    });
  });

  describe('Denied cases — no mutations called', () => {
    it('client_viewer: create/update/delete/bulk* never called', () => {
      const mutations = createMutationTracker();
      const appRole = resolveAppRole(clientViewer);

      try {
        assertCanWrite(appRole);
        // If guard passes (shouldn't), mutations would be called
        mutations.create({});
        mutations.update('id', {});
        mutations.delete('id');
        mutations.bulkCreate([]);
        mutations.bulkUpdate([]);
        mutations.bulkDelete({});
      } catch {
        // Guard blocked — expected
      }

      expect(mutations.create).not.toHaveBeenCalled();
      expect(mutations.update).not.toHaveBeenCalled();
      expect(mutations.delete).not.toHaveBeenCalled();
      expect(mutations.bulkCreate).not.toHaveBeenCalled();
      expect(mutations.bulkUpdate).not.toHaveBeenCalled();
      expect(mutations.bulkDelete).not.toHaveBeenCalled();
    });

    it('unclassified: create/update/delete/bulk* never called', () => {
      const mutations = createMutationTracker();
      const appRole = resolveAppRole(unclassified);

      try {
        assertCanWrite(appRole);
        mutations.create({});
        mutations.update('id', {});
        mutations.delete('id');
        mutations.bulkCreate([]);
        mutations.bulkUpdate([]);
        mutations.bulkDelete({});
      } catch {
        // Guard blocked — expected
      }

      expect(mutations.create).not.toHaveBeenCalled();
      expect(mutations.update).not.toHaveBeenCalled();
      expect(mutations.delete).not.toHaveBeenCalled();
      expect(mutations.bulkCreate).not.toHaveBeenCalled();
      expect(mutations.bulkUpdate).not.toHaveBeenCalled();
      expect(mutations.bulkDelete).not.toHaveBeenCalled();
    });
  });

  describe('ALLOW cases — mutations proceed', () => {
    it('hq_admin: create is called after guard passes', () => {
      const mutations = createMutationTracker();
      const appRole = resolveAppRole(hqAdmin);

      assertCanWrite(appRole);
      mutations.create({});

      expect(mutations.create).toHaveBeenCalledTimes(1);
    });

    it('consultant: update is called after guard passes', () => {
      const mutations = createMutationTracker();
      const appRole = resolveAppRole(consultant);

      assertCanWrite(appRole);
      mutations.update('id', {});

      expect(mutations.update).toHaveBeenCalledTimes(1);
    });
  });
});