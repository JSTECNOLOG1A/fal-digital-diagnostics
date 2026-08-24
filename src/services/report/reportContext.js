/**
 * resolveReportContext — Validação e resolução centralizada de contexto de relatório
 * Valida IDs, ciclo, cobertura e permissões
 */
import { base44 } from '@/api/base44Client';
import { isValidReportCombination } from './reportTypes';

const MIN_GROUP_REPORT_COVERAGE = 0.8; // 80% mínimo para relatório de grupo

/**
 * Resolve e valida contexto de relatório
 * @param {string} reportScope — 'group', 'company', 'unit'
 * @param {string} reportMode — 'executive', 'full_scope', 'tactical', 'operational'
 * @param {string} cycleId — ID do ciclo (obrigatório)
 * @param {string?} groupId
 * @param {string?} companyId
 * @param {string?} unitId
 * @returns {Promise<Object>} — contexto resolvido com validações
 */
export async function resolveReportContext({
  reportScope,
  reportMode,
  cycleId,
  groupId,
  companyId,
  unitId,
}) {
  // Validação 1: combinação válida
  if (!isValidReportCombination(reportScope, reportMode)) {
    throw new Error(
      `Combinação inválida: escopo='${reportScope}', modo='${reportMode}'`
    );
  }

  // Validação 2: ciclo existe e é válido
  if (!cycleId) throw new Error('cycle_id obrigatório');
  let cycle;
  try {
    cycle = await base44.entities.FalAssessmentCycle.get(cycleId);
  } catch {
    throw new Error(`Ciclo ${cycleId} não encontrado`);
  }

  // Validação 3: resolve contexto conforme escopo
  const context = { cycle };

  if (reportScope === 'group') {
    if (!groupId) throw new Error('group_id obrigatório para relatório de grupo');
    const group = await base44.entities.Group.get(groupId);
    context.group = group;

    // Valida cobertura
    const companies = await base44.entities.Company.filter({ group_id: groupId });
    const activeCompanies = companies.filter(c => !c.is_archived);

    // Conta empresas com assessments no ciclo
    const assessments = await base44.entities.Assessment.filter({
      group_id: groupId,
      cycle_id: cycleId,
    });
    const uniqueCompanies = new Set(assessments.map(a => a.company_id).filter(Boolean));

    context.coverage = {
      total_companies: activeCompanies.length,
      assessed_companies: uniqueCompanies.size,
      coverage_ratio: activeCompanies.length ? uniqueCompanies.size / activeCompanies.length : 0,
    };

    // Define se é parcial
    context.is_partial = context.coverage.coverage_ratio < MIN_GROUP_REPORT_COVERAGE;

    // Validação: reportMode 'executive' requer cobertura mínima
    if (reportMode === 'executive' && context.is_partial && cycle.status !== 'closed') {
      console.warn(
        `Cobertura parcial (${(context.coverage.coverage_ratio * 100).toFixed(0)}%). Ciclo não está fechado. Relatório será marcado como parcial.`
      );
    }
  }

  if (reportScope === 'company') {
    if (!companyId) throw new Error('company_id obrigatório para relatório de empresa');
    const company = await base44.entities.Company.get(companyId);
    context.company = company;

    if (company.group_id) {
      const group = await base44.entities.Group.get(company.group_id);
      context.group = group;
    }

    // Valida que empresa tem assessment no ciclo
    const assessments = await base44.entities.Assessment.filter({
      company_id: companyId,
      cycle_id: cycleId,
    });
    if (assessments.length === 0) {
      throw new Error(
        `Empresa ${companyId} não possui avaliação no ciclo ${cycleId}`
      );
    }
  }

  if (reportScope === 'unit') {
    if (!unitId) throw new Error('unit_id obrigatório para relatório de unidade');
    const unit = await base44.entities.OperationalUnit.get(unitId);
    context.unit = unit;

    // Resolve company e group
    if (unit.company_id) {
      const company = await base44.entities.Company.get(unit.company_id);
      context.company = company;
      if (company.group_id) {
        const group = await base44.entities.Group.get(company.group_id);
        context.group = group;
      }
    }

    // Valida que unidade tem assessment no ciclo
    const assessments = await base44.entities.Assessment.filter({
      unit_id: unitId,
      cycle_id: cycleId,
    });
    if (assessments.length === 0) {
      throw new Error(
        `Unidade ${unitId} não possui avaliação no ciclo ${cycleId}`
      );
    }
  }

  return context;
}

/**
 * Valida se é permitido gerar um relatório dado o contexto
 */
export function validateReportGenerationPermission(context, reportScope, reportMode) {
  // Relatório executivo: aceita cobertura parcial, mas marca como partial
  if (reportMode === 'executive' && context.is_partial) {
    console.warn('Gerando relatório executivo com cobertura parcial');
  }

  // Relatório full_scope: requer cobertura boa ou ciclo fechado
  if (reportMode === 'full_scope') {
    if (context.is_partial && context.cycle.status !== 'closed') {
      throw new Error(
        'Relatório Consolidado requer cobertura mínima de 80% ou ciclo fechado'
      );
    }
  }

  return true;
}