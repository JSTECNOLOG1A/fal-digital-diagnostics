import { describe, expect, it } from 'vitest';
import { calculateIndicators, safeDivide } from '@/lib/financial/phase3/indicatorEngine';

const values={ total_ativo_circulante:500,total_passivo_circulante:250,total_ativo:1200,total_passivo:600,total_patrimonio_liquido:600,ativo_circulante_caixa:100,ativo_circulante_aplicacoes_liquidez_imediata:50,ativo_circulante_receber:200,ativo_circulante_estoques:100,ativo_nc_receber_lp:100,passivo_circulante_fornecedores:100,passivo_circulante_emprestimos:200,passivo_nao_circulante:300,receita_bruta:1000,receita_liquida:900,custos:-500,lucro_bruto:400,ebit:250,ebitda:300,resultado_liquido:120 };
const byCode=(list,code)=>list.find(i=>i.indicator_code===code);

describe('F3 indicadores',()=>{
  it('não converte denominador zero em zero',()=>expect(safeDivide(10,0)).toBeNull());
  it('marca baixa confiança e warning com denominador zero',()=>{const i=byCode(calculateIndicators({...values,total_passivo_circulante:0}),'liquidez_corrente');expect(i.value).toBeNull();expect(i.confidence_level).toBe('low');expect(i.warning).toBe('INDICATOR_DENOMINATOR_UNAVAILABLE');});
  it('usa caixa e aplicações de liquidez imediata',()=>expect(byCode(calculateIndicators(values),'liquidez_imediata').value).toBe(0.6));
  it('não inclui aplicação não circulante restrita na liquidez imediata',()=>expect(byCode(calculateIndicators({...values,ativo_nc_aplicacoes:9999}),'liquidez_imediata').value).toBe(0.6));
  it('calcula liquidez corrente e seca',()=>{const list=calculateIndicators(values);expect(byCode(list,'liquidez_corrente').value).toBe(2);expect(byCode(list,'liquidez_seca').value).toBe(1.6);});
  it('calcula dívida líquida e alavancagem',()=>{const list=calculateIndicators(values);expect(byCode(list,'divida_liquida').value).toBe(350);expect(byCode(list,'divida_liquida_sobre_ebitda').value).toBeCloseTo(1.1666667);});
  it('calcula margens, ROA, ROE e giro',()=>{const list=calculateIndicators(values);expect(byCode(list,'margem_bruta').value).toBeCloseTo(4/9);expect(byCode(list,'roa').value).toBe(0.1);expect(byCode(list,'roe').value).toBe(0.2);expect(byCode(list,'giro_ativo').value).toBe(0.75);});
  it('calcula prazos e ciclos',()=>{const list=calculateIndicators(values);expect(byCode(list,'prazo_medio_recebimento').value).toBe(72);expect(byCode(list,'prazo_medio_pagamento').value).toBe(72);expect(byCode(list,'prazo_medio_estoque').value).toBe(72);expect(byCode(list,'ciclo_financeiro').value).toBe(72);});
  it('entrega todas as 23 famílias/códigos mínimos',()=>expect(calculateIndicators(values)).toHaveLength(23));
  it('estampa versão de fórmula',()=>expect(calculateIndicators(values).every(i=>i.formula_version==='FAL-FIN-3.0.0')).toBe(true));
  it('distingue caixa ausente de caixa zero',()=>{const absent=byCode(calculateIndicators({...values,ativo_circulante_caixa:undefined,ativo_circulante_aplicacoes_liquidez_imediata:undefined}),'liquidez_imediata');const zero=byCode(calculateIndicators({...values,ativo_circulante_caixa:0,ativo_circulante_aplicacoes_liquidez_imediata:0}),'liquidez_imediata');expect(absent).toEqual(expect.objectContaining({value:null,confidence_level:'low',validation_code:'INDICATOR_SOURCE_UNAVAILABLE'}));expect(zero.value).toBe(0);});
  it.each([
    ['PC ausente',{total_passivo_circulante:undefined},'liquidez_corrente'],
    ['receita ausente',{receita_bruta:undefined},'prazo_medio_recebimento'],
    ['custo ausente',{custos:undefined},'prazo_medio_pagamento'],
    ['PL ausente',{total_patrimonio_liquido:undefined},'roe'],
    ['EBITDA ausente',{ebitda:undefined},'divida_liquida_sobre_ebitda'],
    ['valor NaN',{ativo_circulante_caixa:NaN,ativo_circulante_aplicacoes_liquidez_imediata:undefined},'liquidez_imediata'],
    ['valor infinito',{total_patrimonio_liquido:Infinity},'roe'],
  ])('retorna null e baixa confiança para %s',(_label,patch,code)=>expect(byCode(calculateIndicators({...values,...patch}),code)).toEqual(expect.objectContaining({value:null,confidence_level:'low'})));
  it('distingue PC zero de PC ausente pelo warning',()=>{expect(byCode(calculateIndicators({...values,total_passivo_circulante:0}),'liquidez_corrente').validation_code).toBe('INDICATOR_DENOMINATOR_UNAVAILABLE');expect(byCode(calculateIndicators({...values,total_passivo_circulante:undefined}),'liquidez_corrente').validation_code).toBe('INDICATOR_DENOMINATOR_UNAVAILABLE');});
});