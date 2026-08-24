import { describe, expect, it } from 'vitest';
import { INDICATORS, SOURCE_RUBRICS, STATEMENT_TOTALS, validateRegistry, REGISTRY } from '@/lib/financial/phase3/canonicalRegistry';
describe('F3 inventário',()=>{
 it('registry não possui violações',()=>expect(validateRegistry(REGISTRY)).toEqual(expect.objectContaining({valid:true,violations:[]})));
 it('possui 44 rubricas fonte elegíveis, oito totais e 23 indicadores',()=>{expect(Object.keys(SOURCE_RUBRICS)).toHaveLength(44);expect(Object.values(SOURCE_RUBRICS).every((rubric)=>rubric.eliminationEligible)).toBe(true);expect(Object.keys(STATEMENT_TOTALS)).toHaveLength(8);expect(Object.keys(INDICATORS)).toHaveLength(23);});
});