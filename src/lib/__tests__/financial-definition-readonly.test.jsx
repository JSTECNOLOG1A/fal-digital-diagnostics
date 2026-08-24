import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/api/base44Client', () => ({ base44: { functions: { invoke: mocks.invoke }, entities: {} } }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: ({ queryKey }) => {
    if (queryKey[0] === 'def-form-companies') return { data: [{ id: 'c1', name: 'Empresa 1' }, { id: 'c2', name: 'Empresa 2' }], isLoading: false };
    if (queryKey[0] === 'def-form-plans') return { data: [{ id: 'p1', name: 'Plano 1', is_active: true }], isLoading: false };
    return { data: [], isLoading: false };
  },
}));
vi.mock('react-router-dom', () => ({ Link: ({ children }) => <span>{children}</span> }));
vi.mock('@/utils', () => ({ createPageUrl: () => '#' }));

import FinancialDefinitionForm from '@/components/financial/FinancialDefinitionForm';
import CompanyMultiSelect from '@/components/financial/CompanyMultiSelect';

const diagnosis = { id: 'd1', analysis_type: 'individual', company_id: 'c1', account_plan_id: 'p1', periodicidade: 'anual', data_base_abertura: '01/2025', months_count: 12, title: 'Análise' };

describe('FinancialDefinitionForm read-only real', () => {
  beforeEach(() => mocks.invoke.mockClear());

  it('desabilita inputs, seletores e alternância, oculta preview/action bar e não invoca backend', async () => {
    render(<FinancialDefinitionForm diagnosis={diagnosis} diagnosisId="d1" tenantId="t1" groupId="g1" readOnly />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.every((input) => input.disabled || input.readOnly)).toBe(true);
    expect(screen.getAllByRole('combobox').every((select) => select.getAttribute('data-disabled') !== null || select.disabled)).toBe(true);
    expect(screen.getByRole('button', { name: 'Empresa' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Unidade' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Atualizar preview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Salvar/i })).not.toBeInTheDocument();
    fireEvent.change(inputs[0], { target: { value: '02/02/2025' } });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('CompanyMultiSelect bloqueia mudanças quando disabled', () => {
    const onToggle = vi.fn();
    render(<CompanyMultiSelect companies={[{ id: 'c1', name: 'Empresa 1' }]} selected={[]} onToggle={onToggle} disabled />);
    fireEvent.click(screen.getByRole('button', { name: /Empresa 1/ }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});