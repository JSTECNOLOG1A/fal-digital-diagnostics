/**
 * FalContentSuggestionsPanel
 * Copiloto de IA do banco FAL: gera rascunhos de perguntas OU recomendações
 * por cluster (considerando o que já existe, pra não repetir/duplicar) e
 * deixa em fila de revisão. Nada vira registro real (FalQuestion ou
 * FalRecommendationLibrary) sem aprovação explícita do consultor aqui.
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, CheckCircle2, XCircle, Pencil, ChevronDown } from 'lucide-react';

const DIM_LABELS = {
  governanca: 'Governança', juridico: 'Jurídico / Societário', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal', operacional: 'Operacional', sistemas: 'Tecnologia / Sistemas',
};

const RATING_OPTS = [
  { value: 0, label: '0 — Crítico (estrutural)' },
  { value: 1, label: '1 — Parcial (corretiva)' },
  { value: 2, label: '2 — Razoável (melhoria)' },
  { value: 3, label: '3 — Satisfatório (monitoramento)' },
];

function QuestionSuggestionBody({ s, editing, text, setText }) {
  return (
    <>
      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="w-full border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      ) : (
        <p className="text-sm font-medium text-slate-800">{text}</p>
      )}
      <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] font-medium text-slate-500 uppercase tracking-wide">
        <span>{s.draft_payload?.process_stage}</span>
        <span>· prof.: {(s.draft_payload?.diagnostic_depth || []).join(', ')}</span>
        <span>· nível: {(s.draft_payload?.level_applicability || []).join(', ')}</span>
      </div>
    </>
  );
}

function RecommendationSuggestionBody({ s, editing, text, setText }) {
  const d = s.draft_payload || {};
  return (
    <>
      <p className="text-sm font-semibold text-slate-800">{d.recommendation_title}</p>
      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full border border-slate-300 px-2 py-1.5 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      ) : (
        <p className="text-sm text-slate-700 mt-1">{text}</p>
      )}
      {d.implementation_steps?.length > 0 && (
        <ol className="list-decimal list-inside text-xs text-slate-600 mt-1.5 space-y-0.5">
          {d.implementation_steps.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
      )}
      <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] font-medium text-slate-500 uppercase tracking-wide">
        <span>faixa: {d.trigger_score}</span>
        <span>· prazo: {d.estimated_timeframe}</span>
        {d.typical_owner && <span>· resp.: {d.typical_owner}</span>}
      </div>
    </>
  );
}

function SuggestionCard({ s, onDone }) {
  const isQuestion = s.content_type === 'question';
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(isQuestion ? (s.draft_payload?.question_text || '') : (s.draft_payload?.recommendation_description || ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const editField = isQuestion ? 'question_text' : 'recommendation_description';
  const originalText = isQuestion ? s.draft_payload?.question_text : s.draft_payload?.recommendation_description;

  const submit = async (action) => {
    setBusy(true);
    setError(null);
    try {
      const edited_payload = editing && text !== originalText ? { [editField]: text } : undefined;
      const res = await base44.functions.invoke('reviewFalContentSuggestion', {
        suggestion_id: s.id,
        action,
        edited_payload,
      });
      if (res.data?.error) setError(res.data.error);
      else onDone?.();
    } catch (e) {
      setError(e.message || 'Erro ao revisar sugestão.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isQuestion
            ? <QuestionSuggestionBody s={s} editing={editing} text={text} setText={setText} />
            : <RecommendationSuggestionBody s={s} editing={editing} text={text} setText={setText} />}
          {s.rationale && <p className="text-xs text-slate-500 mt-1.5 italic">{s.rationale}</p>}
        </div>
        {s.trigger === 'gap_detected' && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 border border-amber-300 bg-amber-50 text-amber-700">
            Lacuna detectada
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="flex gap-2 justify-end mt-2.5 pt-2.5 border-t border-slate-100">
        <button
          onClick={() => setEditing((v) => !v)}
          disabled={busy}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1"
        >
          <Pencil className="w-3 h-3" /> {editing ? 'Cancelar edição' : 'Editar'}
        </button>
        <button
          onClick={() => submit('reject')}
          disabled={busy}
          className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1"
        >
          <XCircle className="w-3.5 h-3.5" /> Rejeitar
        </button>
        <button
          onClick={() => submit('approve')}
          disabled={busy}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Aprovar e publicar
        </button>
      </div>
    </div>
  );
}

export default function FalContentSuggestionsPanel() {
  const queryClient = useQueryClient();
  const [contentType, setContentType] = useState('question');
  const [clusterKey, setClusterKey] = useState('');
  const [count, setCount] = useState(3);
  const [triggerScore, setTriggerScore] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const { data: allQuestions = [] } = useQuery({
    queryKey: ['fal-questions-for-cluster-picker'],
    queryFn: () => base44.entities.FalQuestion.filter({}, 'cluster_key', 2000),
  });

  const { data: suggestions = [], isLoading: loadingSuggestions } = useQuery({
    queryKey: ['fal-content-suggestions', 'pending'],
    queryFn: () => base44.entities.FalContentSuggestion.filter({ status: 'pending' }, '-created_date', 200),
  });

  const clusterOptions = useMemo(() => {
    const byCluster = new Map();
    for (const q of allQuestions) {
      if (!q.cluster_key) continue;
      if (!byCluster.has(q.cluster_key)) {
        byCluster.set(q.cluster_key, { cluster_key: q.cluster_key, dimension_key: q.dimension_key, count: 0 });
      }
      byCluster.get(q.cluster_key).count++;
    }
    return [...byCluster.values()].sort((a, b) =>
      (a.dimension_key || '').localeCompare(b.dimension_key || '') || a.cluster_key.localeCompare(b.cluster_key)
    );
  }, [allQuestions]);

  const refetchSuggestions = () => {
    queryClient.invalidateQueries({ queryKey: ['fal-content-suggestions', 'pending'] });
    queryClient.invalidateQueries({ queryKey: ['fal-questions-for-cluster-picker'] });
  };

  const handleGenerate = async () => {
    if (!clusterKey) { setError('Selecione um cluster.'); return; }
    setGenerating(true);
    setError(null);
    try {
      const args = { cluster_key: clusterKey, content_type: contentType };
      if (contentType === 'question') args.count = count;
      else args.trigger_score = triggerScore;
      const res = await base44.functions.invoke('generateFalContentSuggestions', args);
      if (res.data?.error) setError(res.data.error);
      else refetchSuggestions();
    } catch (e) {
      setError(e.message || 'Erro ao gerar sugestões.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="border border-slate-200 bg-white">
      <div className="flex items-center gap-2 p-4 border-b border-slate-200">
        <Sparkles className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Copiloto de IA — Perguntas e Recomendações</h3>
      </div>

      <div className="p-4 space-y-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs text-slate-500">
          Gera rascunhos considerando o que já existe no cluster, para evitar redundância.
          Nada é publicado automaticamente — cada sugestão fica pendente até você aprovar ou rejeitar abaixo.
        </p>
        <div className="flex gap-1">
          {[{ v: 'question', l: 'Perguntas' }, { v: 'recommendation', l: 'Recomendações' }].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setContentType(opt.v)}
              className={`px-3 py-1 text-xs font-semibold border ${contentType === opt.v ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}
            >
              {opt.l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[240px]">
            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Cluster</label>
            <div className="relative">
              <select
                value={clusterKey}
                onChange={(e) => setClusterKey(e.target.value)}
                className="w-full appearance-none border border-slate-300 bg-white px-2.5 py-1.5 text-sm pr-8"
              >
                <option value="">Selecione um cluster...</option>
                {clusterOptions.map((c) => (
                  <option key={c.cluster_key} value={c.cluster_key}>
                    {DIM_LABELS[c.dimension_key] || c.dimension_key} — {c.cluster_key} ({c.count} perguntas)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          {contentType === 'question' ? (
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Qtde.</label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
              >
                {[1, 2, 3, 5, 8].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Faixa de maturidade</label>
              <select
                value={triggerScore}
                onChange={(e) => setTriggerScore(Number(e.target.value))}
                className="border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
              >
                {RATING_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating || !clusterKey}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-1.5 text-sm font-semibold disabled:opacity-60"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Gerar sugestões
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="p-4 space-y-2.5">
        {loadingSuggestions ? (
          <p className="text-sm text-slate-400 py-4 text-center">Carregando...</p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Nenhuma sugestão pendente.</p>
        ) : (
          suggestions.map((s) => <SuggestionCard key={s.id} s={s} onDone={refetchSuggestions} />)
        )}
      </div>
    </div>
  );
}
