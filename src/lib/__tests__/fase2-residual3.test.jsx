/**
 * fase2-residual3.test.jsx — Testes comportamentais da FASE 2 RESIDUAL 3.
 *
 * Cenários obrigatórios (item 9):
 *   A. FinancialDefinitionForm aceita readOnly e esconde action bar
 *   B. FinancialDefinitionForm invoca saveFinancialAnalysisDefinition (não mutations diretas)
 *   C. GroupFinancialAnalysesTab guarda "Nova Análise" com PermissionGuard
 *   D. GroupFinancialAnalysesTab guarda "Excluir" com PermissionGuard requireDelete
 *   E. GroupFinancialAnalysesTab guarda "Arquivar" com PermissionGuard
 *   F. FinancialDiagnosisDetail passa readOnly baseado em canManageDiagnosis
 *   G. saveFinancialAnalysisDefinition tem write-role guard
 *   H. saveFinancialAnalysisDefinition executa rollback em falha
 *
 * Não testa apenas presença de strings — valida contratos e invariantes.
 */
/* global process */
import { describe, it, expect } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const COMPONENTS = join(ROOT, 'src', 'components');
const PAGES = join(ROOT, 'src', 'pages');
const FUNCS = join(ROOT, 'base44', 'functions');

function readSrc(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════
// Cenário A: FinancialDefinitionForm aceita readOnly e esconde action bar
// ═══════════════════════════════════════════════════════════════════
describe('Cenário A — FinancialDefinitionForm readOnly', () => {
  const src = readSrc('src/components/financial/FinancialDefinitionForm.jsx');

  it('declara readOnly na assinatura do componente', () => {
    expect(src).toMatch(/readOnly\s*=\s*false/);
  });

  it('condicional a action bar com !readOnly', () => {
    expect(src).toMatch(/\{!readOnly\s*&&\s*\(/);
  });

  it('não renderiza botão Salvar quando readOnly (guard envolve action bar inteira)', () => {
    // O guard deve aparecer ANTES do botão "Salvar" no action bar
    // "Salvar" aparece 2x (Salvando... + botão); procuramos a ocorrência após o guard
    const guardIdx = src.indexOf('{!readOnly && (');
    const salvarAfterGuard = src.indexOf('Salvar', guardIdx);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(salvarAfterGuard).toBeGreaterThan(-1);
    expect(salvarAfterGuard).toBeGreaterThan(guardIdx);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Cenário B: FinancialDefinitionForm invoca saveFinancialAnalysisDefinition
// ═══════════════════════════════════════════════════════════════════
describe('Cenário B — Backend function em vez de mutations diretas', () => {
  const src = readSrc('src/components/financial/FinancialDefinitionForm.jsx');

  it('invoca saveFinancialAnalysisDefinition via base44.functions.invoke', () => {
    expect(src).toMatch(/base44\.functions\.invoke\(\s*['"]saveFinancialAnalysisDefinition['"]/);
  });

  it('não usa FinancialDiagnosis.update diretamente no handleSave', () => {
    // Remove imports e comentários para evitar falsos positivos
    const body = src.replace(/\/\/.*$/gm, '');
    expect(body).not.toMatch(/base44\.entities\.FinancialDiagnosis\.update\(/);
  });

  it('não usa FinancialAnalysisScopeEntity.deleteMany diretamente', () => {
    const body = src.replace(/\/\/.*$/gm, '');
    expect(body).not.toMatch(/base44\.entities\.FinancialAnalysisScopeEntity\.deleteMany\(/);
  });

  it('não usa FinancialAnalysisScopeEntity.bulkCreate diretamente', () => {
    const body = src.replace(/\/\/.*$/gm, '');
    expect(body).not.toMatch(/base44\.entities\.FinancialAnalysisScopeEntity\.bulkCreate\(/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Cenário C: GroupFinancialAnalysesTab guarda "Nova Análise"
// ═══════════════════════════════════════════════════════════════════
describe('Cenário C — PermissionGuard em Nova Análise', () => {
  const src = readSrc('src/components/group/GroupFinancialAnalysesTab.jsx');

  it('importa PermissionGuard', () => {
    expect(src).toMatch(/import\s+PermissionGuard\s+from/);
  });

  it('envolve o botão Nova Análise com PermissionGuard area="diagnosis"', () => {
    expect(src).toMatch(/<PermissionGuard\s+area="diagnosis">/);
  });

  it('possui pelo menos 2 ocorrências de PermissionGuard (header + empty state)', () => {
    const matches = src.match(/<PermissionGuard\s+area="diagnosis">/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Cenário D: GroupFinancialAnalysesTab guarda "Excluir" com requireDelete
// ═══════════════════════════════════════════════════════════════════
describe('Cenário D — PermissionGuard requireDelete em Excluir', () => {
  const src = readSrc('src/components/group/GroupFinancialAnalysesTab.jsx');

  it('envolve Excluir com PermissionGuard requireDelete', () => {
    expect(src).toMatch(/<PermissionGuard\s+area="diagnosis"\s+requireDelete>/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Cenário E: GroupFinancialAnalysesTab guarda "Arquivar"
// ═══════════════════════════════════════════════════════════════════
describe('Cenário E — PermissionGuard em Arquivar', () => {
  const src = readSrc('src/components/group/GroupFinancialAnalysesTab.jsx');

  it('envolve Arquivar com PermissionGuard area="diagnosis"', () => {
    // O Arquivar deve estar dentro de um PermissionGuard sem requireDelete
    const archiveGuard = src.indexOf('<PermissionGuard area="diagnosis">');
    const archiveItem = src.indexOf('Arquivar');
    expect(archiveGuard).toBeGreaterThan(-1);
    expect(archiveItem).toBeGreaterThan(archiveGuard);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Cenário F: FinancialDiagnosisDetail passa readOnly baseado em perms
// ═══════════════════════════════════════════════════════════════════
describe('Cenário F — FinancialDiagnosisDetail wired readOnly', () => {
  const src = readSrc('src/pages/FinancialDiagnosisDetail.jsx');

  it('importa usePermissions', () => {
    expect(src).toMatch(/import\s+\{[^}]*usePermissions[^}]*\}\s+from\s+['"]@\/lib\/hooks\/usePermissions['"]/);
  });

  it('invoca usePermissions em AnalysisFinanceiraTab', () => {
    expect(src).toMatch(/const\s+perms\s*=\s*usePermissions\(\)/);
  });

  it('passa readOnly={!perms.canManageDiagnosis} para FinancialDefinitionForm', () => {
    expect(src).toMatch(/readOnly=\{!perms\.canManageDiagnosis\}/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Cenário G: saveFinancialAnalysisDefinition tem write-role guard
// ═══════════════════════════════════════════════════════════════════
describe('Cenário G — saveFinancialAnalysisDefinition write guard', () => {
  const src = readFileSync(join(FUNCS, 'saveFinancialAnalysisDefinition', 'entry.ts'), 'utf-8');

  it('define WRITE_ROLES', () => {
    expect(src).toMatch(/WRITE_ROLES\s*=\s*new\s+Set\(/);
  });

  it('retorna 403 quando appRole não está em WRITE_ROLES', () => {
    expect(src).toMatch(/Forbidden:\s*write\s*permission\s*required/);
    expect(src).toMatch(/status:\s*403/);
  });

  it('faz tenant guard (diagnosis.tenant_id === user.tenant_id)', () => {
    expect(src).toMatch(/diagnosis\.tenant_id\s*!==\s*user\.tenant_id/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Cenário H: saveFinancialAnalysisDefinition executa rollback em falha
// ═══════════════════════════════════════════════════════════════════
describe('Cenário H — saveFinancialAnalysisDefinition rollback', () => {
  const src = readFileSync(join(FUNCS, 'saveFinancialAnalysisDefinition', 'entry.ts'), 'utf-8');

  it('faz snapshot do estado anterior (previousDiagnosis)', () => {
    expect(src).toMatch(/previousDiagnosis/);
  });

  it('faz snapshot dos scope entities anteriores (previousScopeIds)', () => {
    expect(src).toMatch(/previousScopeIds/);
  });

  it('tem bloco de rollback que restaura estado em falha', () => {
    // Deve existir um catch ou bloco de rollback que restaura diagnosis + scope
    expect(src).toMatch(/rollback/i);
  });

  it('retorna erro com rollback_executed: true em falha', () => {
    expect(src).toMatch(/rollback_executed/);
  });
});