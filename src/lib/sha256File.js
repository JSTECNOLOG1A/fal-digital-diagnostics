export async function sha256File(file) {
  if (!file?.arrayBuffer) throw new Error('Arquivo inválido para checksum');
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}