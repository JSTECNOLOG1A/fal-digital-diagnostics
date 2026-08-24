import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { inviteRolesFor } from '@/components/settings/UserAccessPanel';

describe('RC-1 release contracts', () => {
  it('permite que HQ convide tenant_admin sem ampliar o tenant_admin', () => {
    expect(inviteRolesFor(true).map((item) => item.value)).toContain(
      'tenant_admin',
    );

    expect(inviteRolesFor(false).map((item) => item.value)).not.toContain(
      'tenant_admin',
    );
  });

  it('mantém onboarding automático e correlação do suporte no código produtivo', () => {
    const app = readFileSync('src/App.jsx', 'utf8');

    const boundary = readFileSync(
      'src/components/shared/AppErrorBoundary.jsx',
      'utf8',
    );

    const bundle = readFileSync(
      'base44/functions/createSupportBundle/entry.ts',
      'utf8',
    );

    expect(app).toContain("operation: 'get'");
    expect(app).toContain("navigate('/onboarding'");
    expect(boundary).toContain('correlation_id: correlationId');
    expect(bundle).toContain(
      'correlation_id: correlationId || errorId',
    );
  });

  it('separa mutation hardening do gate bloqueante da RC-1', () => {
    const pkg = JSON.parse(
      readFileSync('package.json', 'utf8'),
    );

    expect(pkg.scripts['verify:rc1']).not.toContain(
      'phase4-mutations',
    );

    expect(
      pkg.scripts['hardening:phase4-mutations'],
    ).toContain('run-phase4-mutations');
  });
});