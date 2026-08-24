import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SWAP_REASONS = [
  { value: 'nao_aplicavel',          label: 'Não aplicável ao caso' },
  { value: 'redacao_inadequada',     label: 'Redação inadequada' },
  { value: 'informacao_indisponivel', label: 'Informação indisponível no momento' },
  { value: 'duplicada_parecida',     label: 'Pergunta duplicada / muito parecida' },
  { value: 'outro',                  label: 'Outro' },
];

const FALLBACK_LABELS = {
  cluster:      'mesmo cluster',
  subdimension: 'mesma subdimensão',
  dimension:    'mesma dimensão',
};

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onClose
 * @param {any=} props.question
 * @param {any=} props.assessmentId
 * @param {any=} props.onSwapConfirmed
 */
export default function SwapQuestionModal({ open, onClose, question, assessmentId, onSwapConfirmed }) {
  const [selectedReason, setSelectedReason] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleClose = () => {
    setSelectedReason(null);
    setError(null);
    setResult(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedReason) return;
    setLoading(true);
    setError(null);
    try {
      const reasonLabel = SWAP_REASONS.find(r => r.value === selectedReason)?.label;
      const res = await base44.functions.invoke('swapFalQuestion', {
        assessment_id: assessmentId,
        original_question_id: question.id,
        swap_reason: selectedReason,
        swap_reason_label: reasonLabel,
      });

      if (res.data?.error) {
        setError(res.data.error);
        return;
      }

      setResult(res.data);
      // Notificar o pai para atualizar o questionário
      if (onSwapConfirmed) {
        onSwapConfirmed({
          originalId: question.id,
          replacementQuestion: res.data.replacement_question,
          fallbackLevel: res.data.fallback_level,
        });
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Erro inesperado ao trocar a pergunta.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <ArrowLeftRight className="w-4 h-4 text-amber-500" />
            Trocar esta pergunta
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Pergunta substituída com sucesso
              </div>
              <p className="text-xs text-emerald-600">
                Substituta encontrada via <strong>{FALLBACK_LABELS[result.fallback_level] || result.fallback_level}</strong>.
              </p>
              <div className="mt-2 p-3 bg-white border border-emerald-100 rounded text-xs text-slate-700 leading-relaxed">
                <span className="font-mono text-slate-400 mr-1">{result.replacement_question?.code}</span>
                {result.replacement_question?.question_text}
              </div>
            </div>
            <Button onClick={handleClose} className="w-full bg-emerald-600 hover:bg-emerald-700">
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pergunta original */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide">Pergunta atual</p>
              <p className="text-xs text-slate-600 font-mono leading-relaxed">
                <span className="text-slate-400 mr-1">{question?.code}</span>
                {question?.question_text}
              </p>
            </div>

            {/* Seleção de motivo */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Motivo da troca <span className="text-red-500">*</span></p>
              <div className="space-y-1.5">
                {SWAP_REASONS.map(reason => (
                  <button
                    key={reason.value}
                    onClick={() => setSelectedReason(reason.value)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      selectedReason === reason.value
                        ? 'border-blue-500 bg-blue-50 text-blue-800 font-medium'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {reason.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Aviso metodológico */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                A substituta será selecionada automaticamente da mesma dimensão metodológica,
                priorizando o mesmo cluster. A troca é registrada para auditoria.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={handleClose} disabled={loading} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!selectedReason || loading}
                className="flex-1 bg-amber-600 hover:bg-amber-700 gap-2"
              >
                {loading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Trocando...</>
                  : <><ArrowLeftRight className="w-3.5 h-3.5" /> Confirmar troca</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}