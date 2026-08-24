import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppErrorBoundary from '@/components/shared/AppErrorBoundary';

function BrokenView() { throw new Error('falha controlada'); }

describe('F5-OBS-01 observability', () => {
  it('renders a global friendly fallback with a support identifier', () => {
    const previous = console.error; console.error = () => {};
    render(React.createElement(AppErrorBoundary, null, React.createElement(BrokenView)));
    console.error = previous;
    expect(screen.getByText(/não foi possível abrir/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });
});