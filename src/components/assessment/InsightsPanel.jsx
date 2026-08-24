import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2, ChevronDown, ChevronUp, CheckCircle2, X, Edit3 } from 'lucide-react';

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 * @param {any=} props.onApply
 */
export default function InsightsPanel({ assessmentId, tenantId, onApply }) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedInsight, setEditedInsight] = useState(null);

  const { data: latestInsight } = useQuery({
    queryKey: ['insight', assessmentId],
    queryFn: async () => {
      const list = await base44.entities.Insight.filter({ assessment_id: assessmentId, tenant_id: tenantId }, '-created_date', 1);
      return list[0] || null;
    },
    enabled: !!assessmentId,
  });

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await base44.functions.invoke('generateInsights', { assessment_id: assessmentId });
      if (res.data?.error) {
        setGenError(res.data.error);
      } else {
        queryClient.invalidateQueries({ queryKey: ['insight', assessmentId] });
        setExpanded(true);
        setEditing(false);
        setEditedInsight(null);
      }
    } catch (e) {
      setGenError(e.response?.data?.error || e.message || 'Erro ao gerar sugestões.');
    }
    setGenerating(false);
  };

  const displayInsight = editing ? editedInsight : latestInsight;

  const startEdit = () => {
    setEditedInsight({ ...latestInsight });
    setEditing(true);
  };

  const handleApply = () => {
    const ins = displayInsight || latestInsight;
    if (onApply) onApply(ins);
  };

  const handleDiscard = () => {
    setEditing(false);
    setEditedInsight(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={generating}
          className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
        >
          {generating
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando sugestões...</>
            : <><Sparkles className="w-3.5 h-3.5" /> Gerar sugestões (IA)</>
          }
        </Button>

        {latestInsight && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-purple-600 hover:underline flex items-center gap-1"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            v{latestInsight.version} gerada por {latestInsight.generated_by?.split('@')[0]}
          </button>
        )}
      </div>

      {genError && (
        <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{genError}</p>
      )}

      {latestInsight && expanded && (
        <Card className="border border-purple-100 bg-purple-50/30 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Sugestões IA — v{latestInsight.version}
              </p>
              <div className="flex gap-2">
                {!editing && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 text-slate-500" onClick={startEdit}>
                    <Edit3 className="w-3 h-3" /> Editar
                  </Button>
                )}
                {editing && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 text-slate-500" onClick={handleDiscard}>
                    <X className="w-3 h-3" /> Descartar
                  </Button>
                )}
                <Button size="sm" className="h-6 text-xs gap-1 bg-purple-600 hover:bg-purple-700 text-white" onClick={handleApply}>
                  <CheckCircle2 className="w-3 h-3" /> Aplicar no Relatório
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">Sumário Executivo</p>
              {editing ? (
                <textarea
                  className="w-full text-xs border rounded-lg p-2 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-purple-400"
                  value={editedInsight?.executive_summary || ''}
                  onChange={e => setEditedInsight(prev => ({ ...prev, executive_summary: e.target.value }))}
                />
              ) : (
                <p className="text-xs text-slate-600 leading-relaxed">{displayInsight?.executive_summary}</p>
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              {[
                { field: 'top_findings', label: '🔍 Principais Achados' },
                { field: 'top_risks', label: '⚠️ Principais Riscos' },
                { field: 'next_actions_30d', label: '🎯 Próximas Ações (30d)' },
              ].map(({ field, label }) => (
                <div key={field}>
                  <p className="text-xs font-semibold text-slate-700 mb-1">{label}</p>
                  {editing ? (
                    <textarea
                      className="w-full text-xs border rounded-lg p-2 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-purple-400"
                      value={(editedInsight?.[field] || []).join('\n')}
                      onChange={e => setEditedInsight(prev => ({ ...prev, [field]: e.target.value.split('\n').filter(Boolean) }))}
                    />
                  ) : (
                    <ul className="space-y-1">
                      {(displayInsight?.[field] || []).map((item, i) => (
                        <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                          <span className="text-slate-400 flex-shrink-0">{i + 1}.</span> {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">Quadrante FAL 2D</p>
              {editing ? (
                <textarea
                  className="w-full text-xs border rounded-lg p-2 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-purple-400"
                  value={editedInsight?.quadrant_explanation || ''}
                  onChange={e => setEditedInsight(prev => ({ ...prev, quadrant_explanation: e.target.value }))}
                />
              ) : (
                <p className="text-xs text-slate-600 leading-relaxed">{displayInsight?.quadrant_explanation}</p>
              )}
            </div>

            <p className="text-[10px] text-purple-500 italic">{displayInsight?.confidence_note}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}