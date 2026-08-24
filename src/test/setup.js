import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ═════════════════════════════════════════════════════════════════════════════
// QA-005 — Global Base44 SDK mock
// ═════════════════════════════════════════════════════════════════════════════
// Prevents ANY test file from initializing the real Base44 SDK.
// base44Client.js calls createClient() at module level, which attempts
// network calls to localhost:3000 (ECONNREFUSED). AuthContext.jsx also
// imports @base44/sdk/dist/utils/axios-client directly. With singleFork:
// true, modules are shared across test files — a single unmocked import
// pollutes the entire process.
//
// Per-file vi.mock() calls in individual test files OVERRIDE these defaults.
vi.mock('@/api/base44Client', () => {
  const mockEntity = {
    get: () => Promise.resolve(null),
    filter: () => Promise.resolve([]),
    list: () => Promise.resolve([]),
    create: () => Promise.resolve({}),
    update: () => Promise.resolve({}),
    delete: () => Promise.resolve({}),
    bulkCreate: () => Promise.resolve([]),
    bulkUpdate: () => Promise.resolve([]),
    updateMany: () => Promise.resolve({}),
    deleteMany: () => Promise.resolve({}),
    schema: () => Promise.resolve({}),
    subscribe: () => () => {},
  };
  return {
    base44: {
      entities: new Proxy({}, { get: () => mockEntity }),
      asServiceRole: {
        entities: new Proxy({}, { get: () => mockEntity }),
        functions: { invoke: () => Promise.resolve({ data: {}, status: 200 }) },
        integrations: { Core: new Proxy({}, { get: () => () => Promise.resolve({}) }) },
      },
      auth: {
        me: () => Promise.resolve(null),
        isAuthenticated: () => Promise.resolve(false),
        logout: () => {},
        redirectToLogin: () => {},
        updateMe: () => Promise.resolve({}),
      },
      functions: { invoke: () => Promise.resolve({ data: {}, status: 200 }) },
      integrations: { Core: new Proxy({}, { get: () => () => Promise.resolve({}) }) },
      analytics: { track: () => {} },
      agents: {},
      users: { inviteUser: () => Promise.resolve({}) },
    },
  };
});

vi.mock('@base44/sdk/dist/utils/axios-client', () => ({
  createAxiosClient: () => ({ get: () => Promise.resolve({}) }),
}));

vi.mock('@/api/clarityClient', () => ({
  clarity: {
    login: () => Promise.reject(new Error('clarity mocked')),
    logout: () => Promise.resolve(),
    me: () => Promise.resolve(null),
    listTenants: () => Promise.resolve([]),
    listGroups: () => Promise.resolve([]),
    listCompanies: () => Promise.resolve([]),
    listUnits: () => Promise.resolve([]),
  },
  CLARITY_FEATURES: {
    useClarityAuth: false,
    useClarityHierarchy: false,
    useClarityUsers: false,
    useClarityProtheus: false,
  },
}));

// ── Suppress jsdom "Not implemented: navigation" errors ──────────────────────
try {
  Object.defineProperty(window.location, 'href', {
    configurable: true,
    set: () => {},
    get: () => 'http://localhost/',
  });
} catch (_) {
  const origError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Not implemented: navigation')) return;
    origError.apply(console, args);
  };
}