/**
 * ColumnOrderGuide
 * Exibe as colunas essenciais do modelo de Balancete com botão para copiar o cabeçalho.
 */
import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const COLUMNS = [
  { col: 'account_code',        type: 'required', desc: 'Código da conta contábil' },
  { col: 'account_description', type: 'required', desc: 'Descrição/nome da conta' },
  { col: 'account_type',        type: 'required', desc: 'A = Analítica  |  S = Sintética' },
  { col: 'debits',              type: 'optional', desc: 'Débitos do período' },
  { col: 'credits',             type: 'optional', desc: 'Créditos do período' },
];

const TYPE_CONFIG = {
  required: { label: 'Obrigatória', badge: 'bg-red-100 text-red-700',    row: 'bg-red-50/30' },
  optional: { label: 'Opcional',    badge: 'bg-slate-100 text-slate-500', row: 'bg-white' },
};

const COPY_HEADER = [
  'account_code',
  'account_description',
  'account_type',
  'debits',
  'credits',
].join('\t');

export default function ColumnOrderGuide() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(COPY_HEADER);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
          Colunas da aba Balancete
        </p>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
        >
          {copied
            ? <><Check className="w-3 h-3 text-emerald-500" /> Copiado!</>
            : <><Copy className="w-3 h-3" /> Copiar cabeçalho mínimo</>
          }
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-slate-800">
              <th className="text-left px-2 py-1.5 font-semibold text-white">Coluna</th>
              <th className="text-left px-2 py-1.5 font-semibold text-white hidden sm:table-cell">Descrição</th>
              <th className="text-left px-2 py-1.5 font-semibold text-white">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {COLUMNS.map((item) => {
              const cfg = TYPE_CONFIG[item.type];
              return (
                <tr key={item.col} className={cfg.row}>
                  <td className="px-2 py-1.5">
                    <code className={`font-bold ${item.highlight ? 'text-amber-700' : 'text-slate-700'}`}>
                      {item.col}
                    </code>
                  </td>
                  <td className="px-2 py-1.5 text-slate-500 hidden sm:table-cell">{item.desc}</td>
                  <td className="px-2 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] text-slate-400">
        Datas de abertura/fechamento e classificação são configuradas no cadastro da análise. Com plano de contas vinculado, a classificação gerencial é feita automaticamente pelo código.
      </p>
    </div>
  );
}