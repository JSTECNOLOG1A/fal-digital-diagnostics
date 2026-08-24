import React from 'react';
import { Users, BarChart3, Check } from 'lucide-react';

const TYPES = [
  {
    key: 'multi_entity_master',
    title: 'Diagnóstico FAL',
    description: 'Avaliação empresarial pelo Método FAL 8D™, com definição de escopo por dimensão, empresa, filial, fazenda ou unidade, permitindo visão individual e consolidada.',
    Icon: Users,
    badge: null,
    badgeCls: '',
    highlight: true,
  },
  {
    key: 'financial',
    title: 'Diagnóstico Financeiro',
    description: 'Diagnóstico baseado em upload de balancete, demonstrativos e informações financeiras.',
    Icon: BarChart3,
    badge: null,
    highlight: false,
  },
];

/**
 * @param {Object} props
 * @param {any=} props.selected
 * @param {any=} props.onChange
 */
export default function AssessmentTypeSelector({ selected, onChange }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
      {TYPES.map(({ key, title, description, Icon, badge, badgeCls, highlight }) => {
        const active = selected === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`relative flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-left transition-all
              ${active
                ? 'border-blue-600 bg-blue-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }
              ${highlight && !active ? 'border-blue-200' : ''}
            `}
          >
            {badge && !active && (
              <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>
                {badge}
              </span>
            )}
            {active && (
              <span className="absolute top-3 right-3 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </span>
            )}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? 'bg-blue-600' : 'bg-slate-100'}`}>
              <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-500'}`} />
            </div>
            <div>
              <p className={`font-semibold text-sm ${active ? 'text-blue-900' : 'text-slate-800'}`}>{title}</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}