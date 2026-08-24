import React, { useState } from 'react';
import ColumnOrderGuide from '@/components/financial/ColumnOrderGuide';

/**
 * Banner expansível "Como o sistema funciona".
 * Aparece diretamente ao abrir a aba Balancete, no lugar da cobertura temporal.
 */
export default function SystemHelpBanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl border"
      style={{
        background: '#f0f4f9',
        borderColor: '#d1d9e6',
        borderRadius: '10px',
      }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center justify-between w-full text-left px-4 py-3"
      >
        <span
          className="text-sm font-medium"
          style={{ color: '#3f4886' }}
        >
          Como o sistema funciona
        </span>
        <span
          className="text-xs font-normal ml-2 shrink-0"
          style={{ color: '#5a66a6' }}
        >
          {expanded ? '▲ Ocultar' : '▼ Expandir'}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <ul
            className="text-xs space-y-1.5 list-disc list-inside"
            style={{ color: '#3f4886' }}
          >
            <li>Arquivo <strong>.xlsx</strong> com aba <strong>Balancete</strong></li>
            <li>Linha 1 = cabeçalho; demais = uma conta analítica por linha</li>
            <li>Coluna <code>account_type</code>: <strong>A</strong> = analítica, <strong>S</strong> = sintética</li>
            <li>Com plano vinculado, a coluna <code>classification</code> é opcional</li>
            <li>
              <strong>Padrão de sinais:</strong> importe contas{' '}
              <strong>devedoras positivas</strong> e{' '}
              <strong>credoras negativas</strong>. O motor normaliza para o padrão
              auditoria automaticamente.
            </li>
          </ul>
          <ColumnOrderGuide />
        </div>
      )}
    </div>
  );
}