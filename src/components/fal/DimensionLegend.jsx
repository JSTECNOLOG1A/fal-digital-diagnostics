/**
 * DimensionLegend — Lista colapsável com resumo técnico das 8 dimensões FAL™
 */
import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const DIMENSIONS = [
  { key: 'GOV', label: 'Governança',           color: '#0f172a', bg: '#f8fafc', border: '#e2e8f0', text: 'Estrutura de tomada de decisão, alçadas, papéis dos sócios e instâncias formais de governança (conselho, reuniões estruturadas, planejamento estratégico).' },
  { key: 'JUR', label: 'Jurídico / Societário', color: '#6366f1', bg: '#f5f3ff', border: '#c4b5fd', text: 'Organização societária, regularidade legal, contratos com sócios, funcionários e terceiros, e gestão de riscos jurídicos e contenciosos.' },
  { key: 'CTR', label: 'Controles Internos',    color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd', text: 'Existência e eficácia dos processos de controle operacional — aprovações, autorizações, segregação de funções, auditoria interna e gestão de riscos.' },
  { key: 'FIN', label: 'Financeiro',             color: '#047857', bg: '#f0fdf4', border: '#bbf7d0', text: 'Gestão financeira: planejamento de caixa, controle orçamentário, indicadores de desempenho financeiro, relacionamento bancário e acesso a crédito.' },
  { key: 'CON', label: 'Contábil',               color: '#92400e', bg: '#fffbeb', border: '#fde68a', text: 'Qualidade e tempestividade das informações contábeis, confiabilidade dos demonstrativos, integração com o financeiro e uso da contabilidade como ferramenta de gestão.' },
  { key: 'TRI', label: 'Fiscal / Tributário',    color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe', text: 'Planejamento tributário, conformidade fiscal, gestão de obrigações acessórias e exposição a riscos fiscais e autuações.' },
  { key: 'OPE', label: 'Operacional / Cultura e Ambiente', color: '#b45309', bg: '#fff7ed', border: '#fed7aa', text: 'Processos operacionais, produtividade, gestão de pessoas, indicadores de desempenho operacional e capacidade de execução do negócio.' },
  { key: 'SIS', label: 'Tecnologia / Sistemas',  color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc', text: 'Nível de automação, integração de sistemas (ERP, CRM, BI), qualidade dos dados e maturidade tecnológica para suporte à gestão e tomada de decisão.' },
];

/**
 * @param {Object} props
 * @param {any=} props.activeDimensions
 */
export default function DimensionLegend({ activeDimensions }) {
  const [collapsed, setCollapsed] = useState(false);

  // Sempre exibe todas as 8 dimensões, independentemente do escopo ativo
  const dims = DIMENSIONS;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Leitura Estruturada das Dimensões — Visão Integrada de Gestão
        </p>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          {collapsed ? <><ChevronDown className="w-3.5 h-3.5" /> Expandir</> : <><ChevronUp className="w-3.5 h-3.5" /> Recolher</>}
        </button>
      </div>

      {/* List */}
      {!collapsed && (
        <div className="divide-y divide-slate-50">
          {dims.map(d => (
            <div key={d.key} className="flex items-start gap-2.5 px-4 py-2">
              <span
                className="flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded mt-0.5"
                style={{ color: d.color, background: d.border }}
              >
                {d.key}
              </span>
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-[11px] font-semibold text-slate-700 shrink-0">{d.label}</p>
                <p className="text-[11px] text-slate-400 leading-snug">{d.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}