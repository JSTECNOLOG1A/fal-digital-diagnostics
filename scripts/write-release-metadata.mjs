import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const excluded = new Set([
  'base44/shared/releaseMetadata.ts',
  'metodo-fal-fase5-entrega.zip',
]);
const excludedParts = new Set(['node_modules', 'dist', '.git', 'audit-artifacts']);
const roots = ['src', 'base44', 'scripts', 'package.json', 'package-lock.json'];

function collect(path, files = []) {
  const info = statSync(path);
  if (info.isFile()) {
    const rel = relative('.', path).replaceAll('\\', '/');
    if (!excluded.has(rel) && !rel.endsWith('.zip')) files.push(rel);
    return files;
  }

  for (const name of readdirSync(path).sort()) {
    if (excludedParts.has(name)) continue;
    collect(join(path, name), files);
  }

  return files;
}

function sourceTreeSha() {
  const hash = createHash('sha256');
  const files = roots.flatMap((root) => collect(root)).sort();

  for (const file of files) {
    hash.update(file);
    hash.update('\0');
    hash.update(createHash('sha256').update(readFileSync(file)).digest());
    hash.update('\n');
  }

  return hash.digest('hex');
}

const source = process.env.FAL_BUILD_SHA || sourceTreeSha();
const version = process.env.FAL_RELEASE_VERSION || 'FAL-v2.62';

writeFileSync(
  'base44/shared/releaseMetadata.ts',
  `export const releaseMetadata = {
  version: '${version}',
  buildSha: '${source}'
};
`,
);

console.log(`release metadata: ${version} ${source}`);