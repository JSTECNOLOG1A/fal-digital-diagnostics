export function compareMeasurements(before, after) {
  return { request_delta: after.requests - before.requests, tab_request_delta: after.tab_requests - before.tab_requests, screen_time_delta_ms: after.screen_time_ms - before.screen_time_ms, chunk_delta: after.chunks - before.chunks };
}
export function isTenantScopedKey(key, tenantId) {
  return Array.isArray(key) && key[0] === 'tenant' && key[1] === tenantId;
}