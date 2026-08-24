const encoder = new TextEncoder();

export function roleOf(user) {
  return user?.app_role || (user?.role === 'admin' ? 'hq_admin' : null);
}

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key]) ]));
  return value ?? null;
}

export async function sha256(value) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(canonical(value))));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}