export const PHASE3_FIXTURE = {
  period:'2025',
  entities:{
    A:{ativo_circulante_caixa:100,ativo_circulante_receber:200,ativo_circulante_estoques:200,ativo_nc_investimentos:300,ativo_nao_circulante:400,passivo_circulante_fornecedores:250,passivo_circulante_emprestimos:350,patrimonio_capital:600,receita_bruta:800,custo_produtos:-500},
    B:{ativo_circulante_caixa:50,ativo_circulante_receber:100,ativo_circulante_estoques:150,ativo_nao_circulante:300,passivo_circulante_fornecedores:100,passivo_circulante_emprestimos:200,patrimonio_capital:300,receita_bruta:400,custo_produtos:-250},
  },
  eliminations:[
    {period:'2025',entry_nature:'elimination',entry_type:'intercompany_balance',source_entity_id:'A',counterparty_entity_id:'B',origin_entity_id:'A',destination_entity_id:'B',debit_canonical_key:'passivo_circulante_fornecedores',credit_canonical_key:'ativo_circulante_receber',amount:100,rationale:'Eliminação do saldo comercial intragrupo',justification:'Eliminação do saldo comercial intragrupo',status:'posted',dataset_scope:'consolidated',reporting_entity_id:'A'},
    {period:'2025',entry_nature:'elimination',entry_type:'investment_equity',source_entity_id:'A',counterparty_entity_id:'B',origin_entity_id:'A',destination_entity_id:'B',debit_canonical_key:'patrimonio_capital',credit_canonical_key:'ativo_nc_investimentos',amount:300,rationale:'Eliminação do investimento contra patrimônio',justification:'Eliminação do investimento contra patrimônio',status:'posted',dataset_scope:'consolidated',reporting_entity_id:'A'},
    {period:'2025',entry_nature:'elimination',entry_type:'intercompany_revenue_expense',source_entity_id:'A',counterparty_entity_id:'B',origin_entity_id:'A',destination_entity_id:'B',debit_canonical_key:'receita_bruta',credit_canonical_key:'custo_produtos',amount:100,rationale:'Eliminação da operação intragrupo',justification:'Eliminação da operação intragrupo',status:'posted',dataset_scope:'consolidated',reporting_entity_id:'A'},
  ],
  expected:{parent:{total_ativo:1200,total_passivo:600,total_patrimonio_liquido:600,receita_bruta:800,custos:-500,resultado_liquido:300},consolidated:{total_ativo:1400,total_passivo:800,total_patrimonio_liquido:600,receita_bruta:1100,custos:-650,resultado_liquido:450},combined:{total_ativo:1400,total_passivo:800,total_patrimonio_liquido:600,receita_bruta:1100,custos:-650,resultado_liquido:450}}
};
export function fixtureSeriesInput(){return {entities:PHASE3_FIXTURE.entities,eliminations:PHASE3_FIXTURE.eliminations};}