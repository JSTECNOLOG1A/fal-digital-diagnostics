/**
 * Normaliza tipo de conta vindo de planilha / ERP.
 * Varia por sistema:
 * - Excel FAL comum: A = Analítica, S = Sintética
 * - Protheus CT1_CLASSE: 1 = Sintética, 2 = Analítica
 *
 * @param {unknown} raw
 * @returns {'analitica'|'sintetica'|null} null se vazio ou inválido
 */
export function resolveAccountTypeFromImport(raw) {
  const v = String(raw ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!v) return null;

  if (
    v === '1' ||
    v === 'S' ||
    v === 'SYNTHETIC' ||
    v.startsWith('SINT')
  ) {
    return 'sintetica';
  }

  if (
    v === '2' ||
    v === 'A' ||
    v === 'ANALYTICAL' ||
    v.startsWith('ANAL')
  ) {
    return 'analitica';
  }

  return null;
}

/**
 * Rótulo curto para UI (S / A).
 * @param {'analitica'|'sintetica'|string|null|undefined} accountType
 */
export function accountTypeBadge(accountType) {
  return accountType === 'sintetica' ? 'S' : 'A';
}
