import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onClose
 * @param {any=} props.pendencies
 */
export default function PendenciesModal({ open, onClose, pendencies }) {
  if (!pendencies) return null;

  const total = (pendencies.dimensions?.length || 0) + (pendencies.mqe?.length || 0) + (pendencies.evidence?.length || 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            Pendências para Gerar Relatório ({total})
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {pendencies.dimensions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Dimensões IFME Incompletas</p>
              <div className="space-y-1">
                {pendencies.dimensions.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-red-50 rounded text-sm text-red-700">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {d}
                  </div>
                ))}
              </div>
            </div>
          )}
          {pendencies.mqe?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">MQE Incompletos</p>
              <div className="space-y-1">
                {pendencies.mqe.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-amber-50 rounded text-sm text-amber-700">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {m}
                  </div>
                ))}
              </div>
            </div>
          )}
          {pendencies.evidence?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Evidências Obrigatórias Pendentes</p>
              <div className="space-y-1">
                {pendencies.evidence.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-orange-50 rounded text-sm text-orange-700">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {e}
                  </div>
                ))}
              </div>
            </div>
          )}
          {total === 0 && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">Nenhuma pendência encontrada.</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}