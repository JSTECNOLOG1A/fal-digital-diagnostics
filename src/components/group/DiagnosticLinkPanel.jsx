/**
 * DiagnosticLinkPanel
 * UI para vincular/desvincular diagnóstico FAL + Financeiro.
 * Gera síntese integrada a partir do vínculo ativo.
 * Linguagem orientada ao usuário — evita termos técnicos como DiagnosticLink.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Network, Link2, Link2Off, RefreshCw, AlertCircle,
  ChevronDown, ChevronRight, Loader2
} from 'lucide-react';

const RISK_CONFIG = {
  critical: { label: 'Crítico',  cls: 'bg-red-100 text-red-700 border-red-200' },
  high:     { label: 'Alto',     cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  medium:   { label: 'Moderado', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  low:      { label: 'Baixo',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

/**
 * @param {Object} props
 * @param {any=} props.snapshot
 */
function SynthesisView({ snapshot }) {
  const [expanded, setExpanded] = useState(false);
  if (!snapshot) return null;
  const risk = RISK_CONFIG[snapshot.synthetic_risk_level] || RISK_CONFIG.medium;

  return (
    <div className="space-y-3">
      {/* Risco síntese */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-500">Risco integrado:</span>
        <Badge className={`text-xs border ${risk.cls}`}>{risk.label}</Badge>
        <span className="text-xs text-slate-400">{new Date(snapshot.generated_at).toLocaleDateString('pt-BR')}</span>
      </div>

      {/* Sumário integrado */}
      <p className="text-sm text-slate-700 leading-relaxed">{snapshot.integrated_summary}</p>

      {/* Toggle detalhes */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {expanded ? 'Ocultar detalhes' : 'Ver correlações e recomendações'}
      </button>

      {expanded && (
        <div className="space-y-4">
          {/* Correlações */}
          {snapshot.correlations?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Correlações identificadas</p>
              <div className="space-y-2">
                {snapshot.correlations.map((c, i) => {
                  const r = RISK_CONFIG[c.risk_level] || RISK_CONFIG.medium;
                  return (
                    <div key={i} className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                      <Badge className={`text-[10px] border flex-shrink-0 ${r.cls}`}>{r.label}</Badge>
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{c.fal_dimension}</p>
                        <p className="text-xs text-slate-500 leading-snug">{c.interpretation}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contradições */}
          {snapshot.contradictions?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contradições a analisar</p>
              <div className="space-y-2">
                {snapshot.contradictions.map((c, i) => (
                  <div key={i} className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                    <p className="text-xs font-semibold text-amber-800">{c.title}</p>
                    <p className="text-xs text-amber-700 leading-snug mt-0.5">{c.description}</p>
                    {c.possible_explanation && (
                      <p className="text-[10px] text-amber-600 mt-1">↳ {c.possible_explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendações */}
          {snapshot.recommendations?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recomendações</p>
              <div className="space-y-2">
                {snapshot.recommendations.map((r, i) => {
                  const rc = RISK_CONFIG[r.priority] || RISK_CONFIG.medium;
                  return (
                    <div key={i} className="flex items-start gap-2 p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                      <Badge className={`text-[10px] border flex-shrink-0 ${rc.cls}`}>{rc.label}</Badge>
                      <div>
                        <p className="text-xs font-semibold text-indigo-800">{r.title}</p>
                        <p className="text-xs text-indigo-600 leading-snug">{r.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.groupId
 * @param {any=} props.tenantId
 * @param {any=} props.falAssessmentId
 * @param {any=} props.user
 */
export default function DiagnosticLinkPanel({ groupId, tenantId, falAssessmentId, user }) {
  const qc = useQueryClient();
  const [linking, setLinking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [selectedFinId, setSelectedFinId] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [error, setError] = useState(null);

  // Vínculo ativo
  const { data: links = [] } = useQuery({
    queryKey: ['diagnostic-links', groupId, falAssessmentId],
    queryFn: () => base44.entities.DiagnosticLink.filter(
      { group_id: groupId, fal_assessment_id: falAssessmentId, tenant_id: tenantId, status: 'active' },
      '-created_date', 1
    ),
    enabled: !!groupId && !!falAssessmentId && !!tenantId,
  });
  const activeLink = links[0] || null;

  // Síntese mais recente
  const { data: syntheses = [], refetch: refetchSynthesis } = useQuery({
    queryKey: ['synthetic-snapshot', activeLink?.id],
    queryFn: () => base44.entities.SyntheticDiagnosticSnapshot.filter(
      { diagnostic_link_id: activeLink.id, tenant_id: tenantId },
      '-generated_at', 1
    ),
    enabled: !!activeLink?.id && !!tenantId,
  });
  const latestSynthesis = syntheses[0] || null;

  // Diagnósticos financeiros disponíveis
  const { data: finDiagnoses = [] } = useQuery({
    queryKey: ['fin-diagnoses-link', groupId],
    queryFn: () => base44.entities.FinancialDiagnosis.filter({ group_id: groupId }, '-created_date', 20),
    enabled: !!groupId && showLinkForm,
  });

  const handleLink = async () => {
    if (!selectedFinId) { setError('Selecione um diagnóstico financeiro.'); return; }
    setLinking(true); setError(null);
    const action = activeLink ? 'replace' : 'create';
    const res = await base44.functions.invoke('manageDiagnosticLink', {
      action,
      fal_assessment_id: falAssessmentId,
      financial_diagnosis_id: selectedFinId,
      link_type: 'synthetic_analysis',
    });
    if (res.data?.error) { setError(res.data.error); setLinking(false); return; }
    qc.invalidateQueries({ queryKey: ['diagnostic-links', groupId, falAssessmentId] });
    setLinking(false);
    setShowLinkForm(false);
    setSelectedFinId('');
  };

  const handleUnlink = async () => {
    if (!activeLink) return;
    setUnlinking(true); setError(null);
    const res = await base44.functions.invoke('manageDiagnosticLink', {
      action: 'unlink',
      fal_assessment_id: falAssessmentId,
    });
    if (res.data?.error) { setError(res.data.error); }
    qc.invalidateQueries({ queryKey: ['diagnostic-links', groupId, falAssessmentId] });
    setUnlinking(false);
  };

  const handleGenerateSynthesis = async () => {
    if (!activeLink) return;
    setGenerating(true); setError(null);
    const res = await base44.functions.invoke('generateSyntheticDiagnostic', { diagnostic_link_id: activeLink.id });
    if (res.data?.error) { setError(res.data.error); }
    else { await refetchSynthesis(); qc.invalidateQueries({ queryKey: ['synthetic-snapshot', activeLink.id] }); }
    setGenerating(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center flex-shrink-0">
          <Network className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800">Síntese Integrada</p>
          <p className="text-xs text-slate-400">Leitura conjunta FAL + Financeiro</p>
        </div>
        {activeLink && (
          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">Vinculado</Badge>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {!activeLink ? (
          /* Estado: sem vínculo */
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Vincule um diagnóstico financeiro para gerar a leitura integrada FAL + Financeiro.
            </p>

            {!showLinkForm ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2 border-cyan-300 text-cyan-700 hover:bg-cyan-50"
                onClick={() => setShowLinkForm(true)}
              >
                <Link2 className="w-3.5 h-3.5" /> Vincular diagnóstico financeiro
              </Button>
            ) : (
              <div className="space-y-2">
                <Select value={selectedFinId} onValueChange={setSelectedFinId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecione o diagnóstico financeiro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {finDiagnoses.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title || d.id} {d.last_period ? `· ${d.last_period}` : ''}
                      </SelectItem>
                    ))}
                    {finDiagnoses.length === 0 && (
                      <SelectItem value="none" disabled>Nenhum diagnóstico financeiro encontrado</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={() => setShowLinkForm(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs gap-1"
                    onClick={handleLink}
                    disabled={linking || !selectedFinId}
                  >
                    {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                    Vincular
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Estado: com vínculo ativo */
          <div className="space-y-4">
            {/* Síntese */}
            {latestSynthesis ? (
              <SynthesisView snapshot={latestSynthesis} />
            ) : (
              <p className="text-xs text-slate-500">Vínculo ativo. Gere a síntese integrada para ver a leitura conjunta.</p>
            )}

            {/* Ações */}
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onClick={handleGenerateSynthesis}
                disabled={generating}
                className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {latestSynthesis ? 'Regenerar síntese' : 'Gerar síntese integrada'}
              </Button>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-xs text-slate-400 hover:text-slate-600 gap-1"
                  onClick={() => setShowLinkForm(true)}
                >
                  <RefreshCw className="w-3 h-3" /> Trocar vínculo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-xs text-red-400 hover:text-red-600 gap-1"
                  onClick={handleUnlink}
                  disabled={unlinking}
                >
                  <Link2Off className="w-3 h-3" />
                  {unlinking ? 'Desvinculando...' : 'Desvincular'}
                </Button>
              </div>
            </div>

            {showLinkForm && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs text-slate-500 font-medium">Trocar vínculo financeiro:</p>
                <Select value={selectedFinId} onValueChange={setSelectedFinId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecione outro diagnóstico financeiro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {finDiagnoses.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title || d.id} {d.last_period ? `· ${d.last_period}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={() => setShowLinkForm(false)}>Cancelar</Button>
                  <Button size="sm" className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs gap-1" onClick={handleLink} disabled={linking || !selectedFinId}>
                    {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmar'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}