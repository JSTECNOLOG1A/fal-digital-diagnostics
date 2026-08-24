import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
  scope: { data: null, isLoading: false, isError: false },
  compositionFilter: vi.fn(),
  manualFilter: vi.fn(),
}));

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      FinancialDfcCompositionLine: { filter: mocks.compositionFilter },
      FinancialDfcManualAdjustment: { filter: mocks.manualFilter },
    },
  },
}));
vi.mock('@/components/shared/TenantContext', () => ({ useTenant: () => ({ tenantId: 'tenant-1' }) }));
vi.mock('@/lib/hooks/useCurrentFinancialOutputScope', () => ({ useCurrentFinancialOutputScope: () => mocks.scope }));
vi.mock('@/components/financial/DfcAlertsBlock', () => ({ default: () => null }));
vi.mock('@/components/financial/DfcClassificationEditor', () => ({ default: () => null }));
vi.mock('@/components/financial/DfcManualAdjustmentDialog', () => ({ default: () => null }));

import CashFlowStatementView from '@/components/financial/CashFlowStatementView';

const dfcLines = [{
  canonical_key: 'dfc_variacao_ativos_operacionais',
  rubric_label: 'Variação de ativos operacionais',
  column_key: 'A-2025',
  value: 0,
}];

function renderDfc() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CashFlowStatementView lines={dfcLines} periods={['A-2025']} diagnosisId="diagnosis-1" />
    </QueryClientProvider>,
  );
}

describe('RC1-DFC-CURRENT-SCOPE — composição da DFC', () => {
  beforeEach(() => {
    cleanup();
    mocks.compositionFilter.mockReset();
    mocks.manualFilter.mockReset().mockResolvedValue([]);
  });

  it('não consulta composição sem current scope e permanece fail-closed', async () => {
    mocks.scope = { data: null, isLoading: false, isError: false };
    renderDfc();

    expect(await screen.findByText('Composição da DFC indisponível')).toBeInTheDocument();
    expect(mocks.compositionFilter).not.toHaveBeenCalled();
  });

  it('consulta somente o diagnóstico, run atual e linhas ativas', async () => {
    mocks.scope = { data: { processing_run_id: 'run-current', snapshot_id: 'snapshot-current' }, isLoading: false, isError: false };
    mocks.compositionFilter.mockResolvedValue([]);
    renderDfc();

    await waitFor(() => expect(mocks.compositionFilter).toHaveBeenCalledTimes(1));
    expect(mocks.compositionFilter).toHaveBeenCalledWith({
      financial_diagnosis_id: 'diagnosis-1',
      processing_run_id: 'run-current',
      publication_status: 'active',
    }, 'bucket', 5000);
  });

  it('não exibe candidate, superseded ou invalid e não soma run histórico da mesma rubrica', async () => {
    mocks.scope = { data: { processing_run_id: 'run-current', snapshot_id: 'snapshot-current' }, isLoading: false, isError: false };
    mocks.compositionFilter.mockResolvedValue([
      { rubric_key: 'contas_receber', rubric_label: 'Conta ativa', column_key: 'A-2025', impact_on_dfc: 100, processing_run_id: 'run-current', publication_status: 'active' },
      { rubric_key: 'contas_receber', rubric_label: 'Conta candidata', column_key: 'A-2025', impact_on_dfc: 900, processing_run_id: 'run-current', publication_status: 'candidate' },
      { rubric_key: 'contas_receber', rubric_label: 'Conta supersedida', column_key: 'A-2025', impact_on_dfc: 800, processing_run_id: 'run-previous', publication_status: 'superseded' },
      { rubric_key: 'contas_receber', rubric_label: 'Conta inválida', column_key: 'A-2025', impact_on_dfc: 700, processing_run_id: 'run-previous', publication_status: 'invalid' },
    ]);
    renderDfc();

    expect(await screen.findByText('Conta ativa')).toBeInTheDocument();
    expect(screen.queryByText('Conta candidata')).not.toBeInTheDocument();
    expect(screen.queryByText('Conta supersedida')).not.toBeInTheDocument();
    expect(screen.queryByText('Conta inválida')).not.toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.queryByText('1.000')).not.toBeInTheDocument();
  });
});

describe('RC1-ARCH-ATOMIC — gate de certificação', () => {
  it('mantém o go-live bloqueado enquanto não existe coordenador transacional documentado', () => {
    const adr = readFileSync('src/docs/RC1_ATOMICITY_ARCHITECTURE_DECISION.md', 'utf8');
    expect(adr).toContain('não comprova transação de entidades');
    expect(adr).toContain('coordenador transacional');
    expect(adr).toContain('Go Live permanecem não aprovados');
  });
});