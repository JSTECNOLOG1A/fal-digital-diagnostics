import { describe, it, expect } from 'vitest';
import { sha256File } from '@/lib/sha256File';

const fileLike = (content, name, lastModified) => ({ name, lastModified, size: content.length, arrayBuffer: async () => new TextEncoder().encode(content).buffer });

describe('SHA-256 real do conteúdo financeiro', () => {
  it('produz o mesmo hash para conteúdo igual com nomes e datas diferentes', async () => {
    const a = await sha256File(fileLike('conteudo-contabil', 'a.xlsx', 1));
    const b = await sha256File(fileLike('conteudo-contabil', 'outro.xlsx', 999));
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produz hashes diferentes para bytes diferentes com metadados equivalentes', async () => {
    const a = await sha256File(fileLike('AAAA', 'mesmo.xlsx', 1));
    const b = await sha256File(fileLike('BBBB', 'mesmo.xlsx', 1));
    expect(a).not.toBe(b);
  });
});