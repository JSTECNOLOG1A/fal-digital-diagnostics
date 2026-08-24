/**
 * NewDiagnosisTypePicker
 * Tela de escolha do tipo de diagnóstico:
 *   - Diagnóstico FAL (wizard de escopo por dimensão)
 *   - Diagnóstico Financeiro Inteligente
 *
 * Props:
 *   onSelectFal()        — abre o wizard FAL (escopo por dimensão)
 *   onSelectFinancial()  — abre o fluxo financeiro
 *   onClose()
 */
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClipboardList, BarChart3, ArrowRight } from 'lucide-react';

const TYPES = [
  {
    key: 'fal',
    icon: ClipboardList,
    iconColor: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200 hover:border-indigo-400',
    title: 'Diagnóstico FAL',
    subtitle: 'Método FAL™ por questionário',
    description: 'Método FAL™ por questionário, com avaliação das 8 dimensões organizacionais e configuração de escopo por dimensão, empresa, fazenda ou unidade.',
    descriptionComplement: 'Permite vincular o diagnóstico a múltiplas entidades, definir onde cada dimensão será avaliada e gerar nota consolidada por dimensão e IFME™ consolidado.',
    tags: ['Questionário', '8 dimensões', 'Por dimensão', 'Múltiplas entidades', 'IFME™ consolidado', 'MFIS™', 'Plano de ação'],
  },
  {
    key: 'financial',
    icon: BarChart3,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200 hover:border-blue-400',
    title: 'Diagnóstico Financeiro Inteligente',
    subtitle: 'Engine própria — balancete contábil',
    description: 'Importa balancete Excel padronizado e gera DRE e balanço gerenciais, indicadores financeiros, alertas, recomendações e plano de ação.',
    descriptionComplement: null,
    tags: ['Upload Excel', 'DRE Gerencial', 'Indicadores', 'Sem score FAL'],
    badge: 'Novo',
    badgeCls: 'bg-blue-600',
  },
];

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onClose
 * @param {any=} props.onSelectFal
 * @param {any=} props.onSelectFinancial
 */
export default function NewDiagnosisTypePicker({ open, onClose, onSelectFal, onSelectFinancial }) {
  function handleSelect(key) {
    if (key === 'fal') onSelectFal?.();
    else if (key === 'financial') onSelectFinancial?.();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Novo Diagnóstico — Escolha o tipo
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            Selecione o tipo de análise que deseja iniciar.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          {TYPES.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => handleSelect(t.key)}
                className={`relative text-left p-5 rounded-xl border-2 transition-all duration-150 group ${t.borderColor} bg-white hover:shadow-md`}
              >
                {t.badge && (
                  <span className={`absolute top-3 right-3 text-[10px] font-bold ${t.badgeCls} text-white px-2 py-0.5 rounded-full`}>
                    {t.badge}
                  </span>
                )}

                <div className={`w-10 h-10 rounded-lg ${t.bgColor} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${t.iconColor}`} />
                </div>

                <p className="text-sm font-bold text-slate-900 leading-tight">{t.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 mb-2">{t.subtitle}</p>
                <p className="text-xs text-slate-600 leading-relaxed mb-2">{t.description}</p>
                {t.descriptionComplement && (
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{t.descriptionComplement}</p>
                )}

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {t.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className={`flex items-center gap-1 text-xs font-semibold ${t.iconColor} group-hover:gap-2 transition-all`}>
                  Selecionar <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}