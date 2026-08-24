/**
 * falDimensionScopePolicy.js
 * Fonte única de verdade para a política de escopo por dimensão FAL.
 * ATENÇÃO: As dimension_keys aqui DEVEM ser idênticas às usadas em falOfficialMatrix.js
 * e no banco de FalQuestions. Não usar chaves inventadas.
 */

// Ordem oficial das 8 dimensões FAL
export const DIMENSION_KEYS_ORDERED = [
  'governanca',
  'juridico',
  'controles_internos',
  'financeiro',
  'contabil',
  'tributario',
  'operacional',
  'sistemas',
];

// Política por dimensão: níveis permitidos, nível padrão, ícone e label
const DIMENSION_SCOPE_POLICY = {
  governanca: {
    key: 'governanca',
    label: 'Governança',
    icon: '🏛️',
    description: 'Estrutura de governança, conselho, processo decisório, gestão de riscos e transparência.',
    allowed_levels: ['group', 'company'],
    default_level: 'group',
    sampling_modes: ['full'],
    consolidation_mode: 'direct',
  },
  juridico: {
    key: 'juridico',
    label: 'Jurídico / Societário',
    icon: '⚖️',
    description: 'Estrutura contratual, contratos rurais e comerciais, regularidade fundiária e ambiental, contencioso.',
    allowed_levels: ['group', 'company'],
    default_level: 'group',
    sampling_modes: ['full'],
    consolidation_mode: 'weighted_average',
  },
  controles_internos: {
    key: 'controles_internos',
    label: 'Controles Internos',
    icon: '🔒',
    description: 'Formalização de processos, segregação de funções, controle de estoques, compras, tesouraria e imobilizado.',
    allowed_levels: ['company', 'unit'],
    default_level: 'unit',
    sampling_modes: ['full', 'sample'],
    consolidation_mode: 'weighted_average',
  },
  financeiro: {
    key: 'financeiro',
    label: 'Financeiro',
    icon: '💰',
    description: 'Planejamento financeiro, gestão de caixa, estrutura de capital e relacionamento bancário.',
    allowed_levels: ['group', 'company'],
    default_level: 'company',
    sampling_modes: ['full'],
    consolidation_mode: 'weighted_average',
  },
  contabil: {
    key: 'contabil',
    label: 'Contábil',
    icon: '📊',
    description: 'Organização contábil, demonstrações financeiras, compliance e ativo biológico (CPC 29).',
    allowed_levels: ['company'],
    default_level: 'company',
    sampling_modes: ['full'],
    consolidation_mode: 'weighted_average',
  },
  tributario: {
    key: 'tributario',
    label: 'Fiscal / Tributário',
    icon: '🧾',
    description: 'Enquadramento tributário, apuração de tributos, obrigações acessórias e riscos fiscais.',
    allowed_levels: ['company'],
    default_level: 'company',
    sampling_modes: ['full'],
    consolidation_mode: 'weighted_average',
  },
  operacional: {
    key: 'operacional',
    label: 'Operacional',
    icon: '⚙️',
    description: 'Planejamento produtivo, gestão de insumos, gestão da produção e pessoas operacionais.',
    allowed_levels: ['company', 'unit'],
    default_level: 'unit',
    sampling_modes: ['full', 'sample'],
    consolidation_mode: 'weighted_average',
  },
  sistemas: {
    key: 'sistemas',
    label: 'Tecnologia / Sistemas',
    icon: '💻',
    description: 'Infraestrutura tecnológica, sistemas de gestão (ERP), segurança da informação e qualidade de dados.',
    allowed_levels: ['group', 'company', 'unit'],
    default_level: 'group',
    sampling_modes: ['full', 'sample'],
    consolidation_mode: 'hybrid',
  },
};

export default DIMENSION_SCOPE_POLICY;

/**
 * Retorna a política de uma dimensão pelo key.
 * Nunca retorna null — usa fallback seguro para chaves desconhecidas.
 */
export function getDimensionPolicy(dimensionKey) {
  return DIMENSION_SCOPE_POLICY[dimensionKey] || {
    key: dimensionKey,
    label: dimensionKey,
    icon: '📋',
    description: '',
    allowed_levels: ['group', 'company', 'unit'],
    default_level: 'company',
    sampling_modes: ['full', 'sample'],
    consolidation_mode: 'weighted_average',
  };
}