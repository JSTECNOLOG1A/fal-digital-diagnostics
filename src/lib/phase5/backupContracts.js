export function classifyRestoreRow(source, destination) {
  if (!destination) return 'create';
  if (source.tenant_id !== destination.tenant_id) return 'conflict';
  return JSON.stringify(source) === JSON.stringify(destination) ? 'unchanged' : 'update';
}
export function hasOrphanReference(row, refs) { return Object.entries(refs).some(([field, ids]) => row[field] && !ids.includes(row[field])); }