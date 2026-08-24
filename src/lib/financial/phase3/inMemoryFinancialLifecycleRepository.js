export default function createInMemoryFinancialLifecycleRepository(seed = {}) {
  const data = structuredClone(seed);
  const matches = (row, query = {}) => Object.entries(query).every(([key, value]) => value && typeof value === 'object' && '$in' in value ? value.$in.includes(row[key]) : row[key] === value);
  const entity = (name) => ({
    get: async (id) => data[name]?.find((row) => row.id === id) || null,
    filter: async (query = {}) => (data[name] || []).filter((row) => matches(row, query)),
    create: async (row) => { const item = { id: row.id || `${name}-${(data[name] || []).length + 1}`, ...row }; data[name] = [...(data[name] || []), item]; return item; },
    update: async (id, patch) => { const index = (data[name] || []).findIndex((row) => row.id === id); data[name][index] = { ...data[name][index], ...patch }; return data[name][index]; },
    bulkUpdate: async (rows) => Promise.all(rows.map((row) => entity(name).update(row.id, row))),
    updateMany: async (query, patch) => { for (const row of (data[name] || []).filter((item) => matches(item, query))) await entity(name).update(row.id, patch.$set || patch); },
  });
  return { entities: new Proxy({}, { get: (_, name) => entity(name) }), data };
}