/**
 * Seed one-off: popula MethodVersion.payload.crossings — a matriz de 9
 * cruzamentos estruturais que o motor MFIS (mfis.service.ts) consome.
 *
 * Contexto: o racional textual dos cruzamentos já existia hardcoded em
 * mfis.service.ts (INTERPRETATIONS, herdado do base44 original, 11 chaves),
 * mas a definição estrutural (dim_a/dim_b/crossing_type) nunca foi semeada
 * em nenhuma MethodVersion real — payload.crossings sempre esteve vazio,
 * então o motor só produzia o fallback (has_mqe_data:false).
 *
 * Dos 11 cruzamentos originais, 2 (estrategia_x_governanca,
 * estrategia_x_financeiro) dependiam de uma dimensão "Estratégia" que nunca
 * existiu no banco real de perguntas (não é uma das 8 dimensões canônicas,
 * não é subdimensão de nada — confirmado via query ao banco). Decisão
 * tomada com o usuário: remapear esse conceito para dentro de Governança
 * (que já cobre "planejamento estratégico" na descrição da dimensão) e
 * descartar os 2 cruzamentos como redundantes com governanca_x_juridico /
 * governanca_x_sistemas. Ficam 9 cruzamentos reais e computáveis.
 *
 * crossing_type segue as 5 categorias já definidas em
 * CROSSING_TYPE_WEIGHT (mfis.service.ts): institutional (1.15), strategic
 * (1.10), financial (1.10), operational (1.05), integrity (1.00). Antes
 * deste seed, mfis.service.ts ignorava esse campo do payload e sempre
 * usava 'operational' hardcoded — bug corrigido junto (ver diff em
 * mfis.service.ts).
 *
 * Rodar com: npx tsx prisma/seed-fal-mfis-crossings.ts
 */
import { PrismaClient } from '@prisma/client';

// method_versions tem RLS forçada e esta linha é tenant-scoped (não global) —
// precisa da role "owner" (bypassa RLS), não da role de app (fal_app) que o
// DATABASE_URL padrão usa.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_OWNER } },
});

const CROSSINGS = [
  { key: 'governanca_x_juridico', name: 'Governança × Jurídico/Societário', dim_a: 'governanca', dim_b: 'juridico', crossing_type: 'institutional' },
  { key: 'governanca_x_controles_internos', name: 'Governança × Controles Internos', dim_a: 'governanca', dim_b: 'controles_internos', crossing_type: 'institutional' },
  { key: 'governanca_x_sistemas', name: 'Governança × Sistemas', dim_a: 'governanca', dim_b: 'sistemas', crossing_type: 'integrity' },
  { key: 'financeiro_x_contabil', name: 'Financeiro × Contábil', dim_a: 'financeiro', dim_b: 'contabil', crossing_type: 'financial' },
  { key: 'financeiro_x_tributario', name: 'Financeiro × Tributário', dim_a: 'financeiro', dim_b: 'tributario', crossing_type: 'financial' },
  { key: 'operacional_x_financeiro', name: 'Operacional × Financeiro', dim_a: 'operacional', dim_b: 'financeiro', crossing_type: 'operational' },
  { key: 'operacional_x_sistemas', name: 'Operacional × Sistemas', dim_a: 'operacional', dim_b: 'sistemas', crossing_type: 'operational' },
  { key: 'sistemas_x_contabil', name: 'Sistemas × Contábil', dim_a: 'sistemas', dim_b: 'contabil', crossing_type: 'integrity' },
  { key: 'contabil_x_tributario', name: 'Contábil × Tributário', dim_a: 'contabil', dim_b: 'tributario', crossing_type: 'financial' },
];

async function main() {
  const mv = await prisma.methodVersion.findFirst({
    where: { code: 'FAL', isPublished: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!mv) {
    console.log('Nenhuma MethodVersion publicada com code=FAL encontrada — nada a semear.');
    return;
  }
  const payload = (mv.payload as Record<string, unknown>) ?? {};
  const existing = (payload.crossings as unknown[]) || [];
  if (existing.length > 0) {
    console.log(`MethodVersion ${mv.id} já tem ${existing.length} cruzamento(s) — pulando (rode com --force pra sobrescrever).`);
    if (!process.argv.includes('--force')) return;
  }

  await prisma.methodVersion.update({
    where: { id: mv.id },
    data: { payload: { ...payload, crossings: CROSSINGS } },
  });
  console.log(`MethodVersion ${mv.id} (${mv.code} v${mv.version}) atualizada com ${CROSSINGS.length} cruzamentos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
