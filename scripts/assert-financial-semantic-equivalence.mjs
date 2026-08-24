#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { generateDfcAdapter } from './generate-dfc-test-adapter.mjs';
import { SOURCE_RUBRICS, CALCULATED_RUBRICS, STATEMENT_TOTALS } from '../src/lib/financial/phase3/canonicalRegistry.js';
import { executeProductionEngine } from '../src/lib/financial/phase3/productionAdapter.js';
import { executeGeneratedBackendEngine, applyGeneratedBackendEliminations, GENERATED_BACKEND_REGISTRY } from '../src/lib/financial/phase3/generatedFinancialBackendEngine.js';
import { PHASE3_FIXTURE } from '../src/lib/financial/phase3/phase3Fixture.js';
import { applyEliminations } from '../src/lib/financial/phase3/consolidationEngine.js';

const failures=[];
function compare(a,b,path='root'){
  if(a===null||b===null){if(a!==b)failures.push(`null_zero:${path}`);return;}
  if(typeof a==='number'||typeof b==='number'){if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>0.01)failures.push(`number:${path}`);return;}
  if(Array.isArray(a)||Array.isArray(b)){if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length){failures.push(`array:${path}`);return;}a.forEach((v,i)=>compare(v,b[i],`${path}[${i}]`));return;}
  if(typeof a==='object'&&typeof b==='object'){const keys=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();for(const key of keys)compare(a[key],b[key],`${path}.${key}`);return;}
  if(a!==b)failures.push(`value:${path}`);
}
function project(result){return {
  registry_version:result.registry_version, formula_version:result.formula_version, statements:result.statements,
  bp:{expected:result.bp.expected,actual:result.bp.actual,difference:result.bp.difference,balanced:result.bp.balanced,validation_code:result.bp.validation?.code || null},
  indicators:(result.indicators || []).map((item)=>({indicator_code:item.indicator_code,value:item.value,confidence_level:item.confidence_level,validation_code:item.validation_code || null,formula:item.formula,components:item.components || null})),
};}
function compareEngines(source,label){compare(project(executeProductionEngine({source_values:source})),project(executeGeneratedBackendEngine({source_values:source})),label);}
if(readFileSync('src/lib/financial/phase3/generatedDfcEngine.js','utf8')!==generateDfcAdapter())failures.push('dfc_generated_adapter_out_of_sync');
const gross=Object.values(PHASE3_FIXTURE.entities).reduce((out,entity)=>{for(const[key,value]of Object.entries(entity))out[key]=(out[key]||0)+value;return out;},{});
compareEngines(applyEliminations(gross,PHASE3_FIXTURE.eliminations),'fixture_frontend');
compareEngines(applyGeneratedBackendEliminations(gross,PHASE3_FIXTURE.eliminations),'fixture_backend');
for(const dataset of [{},Object.fromEntries(Object.keys(SOURCE_RUBRICS).map(k=>[k,0])),{...gross,patrimonio_prejuizos:-50},{...gross,patrimonio_prejuizos:50},{...gross,total_passivo_circulante:0}])compareEngines(dataset,'edge');
let seed=1729;const rand=()=>((seed=seed*48271%2147483647)/2147483647);for(let n=0;n<100;n++){const source={};for(const key of Object.keys(SOURCE_RUBRICS))source[key]=Math.round((rand()*2000-500)*100)/100;compareEngines(source,`dataset:${n}`);}
const semanticFields=['statement_code','line_type','family','presentation_group','presentation_order','display_label','normal_balance','presentation_sign','debit_presentation_effect','credit_presentation_effect','dfc_treatment','elimination_eligible','active'];
for(const[key,front]of Object.entries(SOURCE_RUBRICS))for(const field of semanticFields)if(JSON.stringify(front[field]??null)!==JSON.stringify(GENERATED_BACKEND_REGISTRY.rubrics[key]?.[field]??null))failures.push(`REGISTRY_SEMANTIC_DRIFT canonical_key=${key} field=${field}`);
const mutations=[['patrimonio_prejuizos','presentation_sign'],['patrimonio_prejuizos','debit_presentation_effect'],['passivo_circulante_fornecedores','credit_presentation_effect']];for(const[key,field]of mutations){const mutated={...SOURCE_RUBRICS[key],[field]:'__mutation__'};if(JSON.stringify(mutated[field])===JSON.stringify(GENERATED_BACKEND_REGISTRY.rubrics[key][field]))failures.push(`mutation_not_detected:${key}:${field}`);}
if(Object.keys(SOURCE_RUBRICS).length!==44||Object.keys(CALCULATED_RUBRICS).length!==9||Object.keys(STATEMENT_TOTALS).length!==8)failures.push('registry_counts');
console.log(`financial_semantic_equivalence_failures=${failures.length}`);if(failures.length){console.error(failures.slice(0,50));process.exit(1)}console.log('financial_semantic_equivalence=PASS engines=2 datasets=105 tolerance=0.01 mutations=9');