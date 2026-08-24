const clone = (value) => structuredClone(value);
const readPath = (row, path) => path.split('.').reduce((value, key) => value?.[key], row);

export function matchOperator(actual, operator, expected) {
  switch (operator) {
    case '$gt': return actual > expected;
    case '$gte': return actual >= expected;
    case '$lt': return actual < expected;
    case '$lte': return actual <= expected;
    case '$ne': return actual !== expected;
    case '$eq': return actual === expected;
    case '$in': return Array.isArray(actual) ? actual.some((value) => expected.includes(value)) : expected.includes(actual);
    case '$nin': return Array.isArray(actual) ? actual.every((value) => !expected.includes(value)) : !expected.includes(actual);
    case '$exists': return expected ? actual !== undefined && actual !== null : actual === undefined || actual === null;
    default: throw new Error(`UNSUPPORTED_QUERY_OPERATOR:${operator}`);
  }
}

export function matchField(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) return Object.entries(expected).every(([operator, operand]) => matchOperator(actual, operator, operand));
  return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
}

export function matches(row, query = {}) {
  if (query.$or) return query.$or.some((branch) => matches(row, branch));
  if (query.$and) return query.$and.every((branch) => matches(row, branch));
  return Object.entries(query).every(([field, expected]) => !field.startsWith('$') && matchField(readPath(row, field), expected));
}

function sortRows(rows, sort) {
  if (!sort) return rows;
  const fields = String(sort).split(',').map((item) => item.trim());
  return rows.sort((a, b) => {
    for (const key of fields) {
      const descending = key.startsWith('-');
      const field = descending ? key.slice(1) : key;
      const av = readPath(a, field);
      const bv = readPath(b, field);
      if (av === bv) continue;
      return (av > bv ? 1 : -1) * (descending ? -1 : 1);
    }
    return 0;
  });
}

export function createInMemoryRepository(seed = {}, failureController) {
  const state = clone(seed);
  const mutations = [];
  const entityCalls = [];
  let counter = 0;
  const runMutation = async (name, method, id, input, apply) => {
    const callNumber = failureController?.check(`${name}.${method}`, 'before', state);
    const before = id ? clone((state[name] || []).find((row) => row.id === id) || null) : null;
    try {
      const result = apply();
      const after = id ? clone((state[name] || []).find((row) => row.id === id) || null) : null;
      const record = { entity: name, method, id, callNumber, before, input: clone(input), after, committed: true, failedBefore: false, failedAfter: false };
      mutations.push(record);
      try { failureController?.check(`${name}.${method}`, 'after', state); } catch (error) { record.failedAfter = true; throw error; }
      return clone(result);
    } catch (error) {
      if (!mutations.at(-1)?.failedAfter) mutations.push({ entity: name, method, id, callNumber, before, input: clone(input), after: null, committed: false, failedBefore: true, failedAfter: false });
      throw error;
    }
  };
  const entity = (name) => ({
    async get(id) { entityCalls.push({ entity: name, method: 'get', id }); return clone((state[name] || []).find((row) => row.id === id) || null); },
    async list() { entityCalls.push({ entity: name, method: 'list' }); return clone(state[name] || []); },
    async filter(query = {}, sort, limit = 500) { const rows = sortRows((state[name] || []).filter((row) => matches(row, query)), sort).slice(0, limit); entityCalls.push({ entity: name, method: 'filter', query: clone(query), sort, limit, returnedIds: rows.map((row) => row.id) }); return clone(rows); },
    async create(data) { return runMutation(name, 'create', data.id || `${name}-${counter + 1}`, data, () => { const record = { id: data.id || `${name}-${++counter}`, ...clone(data) }; state[name] ||= []; state[name].push(record); return record; }); },
    async update(id, data) { return runMutation(name, 'update', id, data, () => { const index = (state[name] || []).findIndex((row) => row.id === id); if (index < 0) throw new Error(`Entity ${name} with ID ${id} not found`); state[name][index] = { ...state[name][index], ...clone(data), updated_date: new Date().toISOString() }; return state[name][index]; }); },
    async delete(id) { return runMutation(name, 'delete', id, {}, () => { state[name] = (state[name] || []).filter((row) => row.id !== id); }); },
    async deleteMany(query) { return runMutation(name, 'deleteMany', null, query, () => { state[name] = (state[name] || []).filter((row) => !matches(row, query)); }); },
    async updateMany(query, update) { return runMutation(name, 'updateMany', null, { query, update }, () => { for (const row of (state[name] || []).filter((item) => matches(item, query))) Object.assign(row, update.$set || update); }); },
    async bulkCreate(rows) { return Promise.all(rows.map((row) => entity(name).create(row))); },
    async bulkUpdate(rows) { return Promise.all(rows.map((row) => entity(name).update(row.id, row))); },
  });
  return { state, mutations, entityCalls, entities: new Proxy({}, { get: (_target, name) => entity(name) }) };
}