/**
 * useTaxReformMethodVersion — resolve o MethodVersion do Diagnóstico FAL da
 * Reforma Tributária (code: 'reforma_tributaria_8d'), semeado por
 * backend/prisma/seed-tax-reform-method.ts. O id é gerado em tempo de seed
 * (não é fixo entre ambientes), então qualquer tela que precise criar ou
 * filtrar um assessment desse método precisa resolvê-lo em runtime — não
 * hardcodar o UUID.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export const TAX_REFORM_METHOD_CODE = 'reforma_tributaria_8d';

export function useTaxReformMethodVersion() {
  const { data: methodVersions = [], isLoading } = useQuery({
    queryKey: ['method-version', TAX_REFORM_METHOD_CODE],
    queryFn: () => base44.entities.MethodVersion.filter({}),
    staleTime: 10 * 60 * 1000,
  });

  const methodVersion = methodVersions.find((m) => m.code === TAX_REFORM_METHOD_CODE) || null;

  return { methodVersion, isLoading };
}
