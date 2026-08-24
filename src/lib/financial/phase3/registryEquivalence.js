export const REGISTRY_SEMANTIC_FIELDS = ['canonical_key','statement_code','line_type','family','presentation_group','presentation_order','display_label','normal_balance','presentation_sign','debit_presentation_effect','credit_presentation_effect','dfc_treatment','elimination_classification','elimination_eligible','active','formula','operands','coefficients','formula_version','registry_version'];
export function findRegistrySemanticDrift(left, right) {
  const failures=[];
  for(const key of [...new Set([...Object.keys(left || {}),...Object.keys(right || {})])].sort()){
    for(const field of REGISTRY_SEMANTIC_FIELDS){const a=left?.[key]?.[field]??null,b=right?.[key]?.[field]??null;if(JSON.stringify(a)!==JSON.stringify(b))failures.push(`REGISTRY_SEMANTIC_DRIFT canonical_key=${key} field=${field}`);}
  }
  return failures;
}