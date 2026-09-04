/**
 * FinancialAnalysisNoteEditor
 * Textarea para o comentário manual do consultor, combinado com a leitura
 * automática na mesma seção (Demonstrações ou Indicadores). Um registro
 * "vivo" por (diagnóstico, seção) — upsert ao salvar, com debounce.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { financialKey } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import { Loader2, Check, PenLine } from 'lucide-react';

const SAVE_DEBOUNCE_MS = 900;

/**
 * @param {Object} props
 * @param {string} props.diagnosisId
 * @param {string} props.tenantId
 * @param {'statements'|'indicators'} props.section
 */
export default function FinancialAnalysisNoteEditor({ diagnosisId, tenantId, section }) {
  const queryClient = useQueryClient();
  const { user } = useTenant();
  const currentUserEmail = user?.email || '';
  const queryKey = financialKey(tenantId, diagnosisId, `analysis-note-${section}`);

  const { data: existing, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const rows = await base44.entities.FinancialAnalysisNote.filter(
        { financial_diagnosis_id: diagnosisId, tenant_id: tenantId, section }, '-updated_at', 1
      );
      return rows[0] || null;
    },
    enabled: !!diagnosisId && !!tenantId,
  });

  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | saving | saved
  const loadedRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!loadedRef.current && existing !== undefined) {
      setText(existing?.content || '');
      loadedRef.current = true;
    }
  }, [existing]);

  const save = async (value) => {
    setStatus('saving');
    try {
      if (existing?.id) {
        await base44.entities.FinancialAnalysisNote.update(existing.id, {
          content: value,
          updated_by: currentUserEmail || '',
          updated_at: new Date().toISOString(),
        });
      } else {
        await base44.entities.FinancialAnalysisNote.create({
          tenant_id: tenantId,
          financial_diagnosis_id: diagnosisId,
          section,
          content: value,
          updated_by: currentUserEmail || '',
          updated_at: new Date().toISOString(),
        });
      }
      await queryClient.invalidateQueries({ queryKey });
      setStatus('saved');
    } catch {
      setStatus('idle');
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);
    setStatus('idle');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(value), SAVE_DEBOUNCE_MS);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (isLoading) return null;

  return (
    <div className="border border-slate-300">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-b border-slate-300">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
          <PenLine className="w-3 h-3" /> Comentário do consultor
        </span>
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          {status === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> salvando…</>}
          {status === 'saved' && <><Check className="w-3 h-3 text-emerald-600" /> salvo</>}
        </span>
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        rows={4}
        placeholder="Inclua aqui observações que complementem a leitura automática acima..."
        className="w-full px-3 py-2 text-sm focus:outline-none resize-y"
      />
    </div>
  );
}
