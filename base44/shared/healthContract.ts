import { releaseMetadata } from './releaseMetadata.ts';

export function buildHealthPayload(services: Record<string, string>) {
  const healthy = Object.values(services).every((status) => ['operational', 'not_checked'].includes(status));
  return { status: healthy ? 'healthy' : 'degraded', checked_at: new Date().toISOString(), version: releaseMetadata.version, build_sha: releaseMetadata.buildSha, services };
}