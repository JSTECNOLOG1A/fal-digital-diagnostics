import { describe, expect, it } from 'vitest';
import { calculateKanitz } from '@/lib/financial/phase3/indicatorEngine';
const base={total_patrimonio_liquido:100,total_passivo:100,resultado_liquido:10,total_ativo_circulante:200,ativo_circulante_estoques:50,total_passivo_circulante:100};
describe('F3 Kanitz',()=>{
  it('aplica a fórmula oficial expected × actual',()=>{const r=calculateKanitz(base);const expected=.05*.1+1.65*2+3.55*1.5-1.06*2-.33*1;expect(r.value).toBeCloseTo(expected,10);});
  it('classifica FI > 0 como solvente',()=>expect(calculateKanitz(base).classification).toBe('solvente'));
  it('classifica -3 ≤ FI ≤ 0 como penumbra',()=>expect(calculateKanitz({...base,resultado_liquido:-1000,total_ativo_circulante:100,ativo_circulante_estoques:99,total_passivo:100,total_passivo_circulante:100}).classification).toBe('penumbra'));
  it('classifica FI < -3 como insolvência',()=>expect(calculateKanitz({...base,resultado_liquido:-10000,total_ativo_circulante:1,ativo_circulante_estoques:1,total_passivo:100,total_passivo_circulante:100}).classification).toBe('insolvencia'));
  it('PL zero não fabrica componentes nem FI',()=>{const r=calculateKanitz({...base,total_patrimonio_liquido:0});expect(r.value).toBeNull();expect(r.components.rentabilidade_do_pl).toBeNull();expect(r.confidence_level).toBe('low');});
  it('PL negativo calcula sem substituir por zero e reduz confiança',()=>{const r=calculateKanitz({...base,total_patrimonio_liquido:-100});expect(r.value).not.toBeNull();expect(r.components.capital_de_terceiros_sobre_pl).toBe(-1);expect(r.confidence_level).toBe('low');expect(r.warning).toBe('KANITZ_PL_NON_POSITIVE');});
});