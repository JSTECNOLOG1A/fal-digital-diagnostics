/**
 * Utilitários de documento BR + consulta CNPJ (base pública da Receita Federal via BrasilAPI).
 */

export function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

export function formatCNPJ(value = '') {
  return onlyDigits(value)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);
}

export function formatCPF(value = '') {
  return onlyDigits(value)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
    .slice(0, 14);
}

export function formatTaxId(value, isIndividual) {
  return isIndividual ? formatCPF(value) : formatCNPJ(value);
}

export function isValidTaxIdLength(value, isIndividual) {
  const len = onlyDigits(value).length;
  return isIndividual ? len === 11 : len === 14;
}

/**
 * Consulta dados cadastrais públicos do CNPJ.
 * Fonte: base da Receita Federal publicada via BrasilAPI (não é scraping do portal).
 * @param {string} cnpj
 */
export async function fetchCnpjFromReceita(cnpj) {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) {
    throw new Error('CNPJ incompleto');
  }

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'MetodoFAL/1.0 (cadastro-empresarial)',
    },
  });

  if (res.status === 404) throw new Error('CNPJ não encontrado na base da Receita Federal');
  if (!res.ok) throw new Error(`Falha na consulta do CNPJ (${res.status})`);

  const data = await res.json();
  return {
    raw: data,
    razaoSocial: data.razao_social || '',
    nomeFantasia: data.nome_fantasia || '',
    city: data.municipio || '',
    state: data.uf || '',
    cnae: data.cnae_fiscal_descricao || data.cnae_fiscal || '',
    legalNature: data.natureza_juridica || '',
    shareCapital: data.capital_social != null ? String(data.capital_social) : '',
    street: [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(' '),
    number: data.numero || '',
    district: data.bairro || '',
    zip: data.cep || '',
    email: data.email || '',
    phone: data.ddd_telefone_1 || '',
  };
}
