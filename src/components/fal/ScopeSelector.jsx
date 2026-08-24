import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckSquare, Square, Layers, LayoutGrid, SlidersHorizontal, Lock, Info } from 'lucide-react';
import { DIMENSION_LABELS, getSuggestedDimensions, getOptionalDimensions } from './dimensionMatrix';

const ALL_DIMENSIONS = Object.entries(DIMENSION_LABELS).map(([key, label]) => ({ key, label }));

const EST_PER_DIM = 9; // rough estimate per dimension

/**
 * @param {Object} props
 * @param {any=} props.assessment
 * @param {any=} props.onConfirm
 * @param {any=} props.readOnly
 */
export default function ScopeSelector({ assessment, onConfirm, readOnly = false }) {
  const [mode, setMode] = useState(assessment?.scope_mode || 'suggested');
  const [templateId, setTemplateId] = useState(assessment?.scope_template_id || '');
  const [customDims, setCustomDims] = useState(
    assessment?.active_dimensions?.length ? assessment.active_dimensions : ALL_DIMENSIONS.map(d => d.key)
  );
  const [saving, setSaving] = useState(false);

  // Auto-load suggested dimensions based on target_type on mount
  useEffect(() => {
    if (!assessment?.active_dimensions || assessment.active_dimensions.length === 0) {
      if (assessment?.target_type) {
        const suggested = getSuggestedDimensions(assessment.target_type);
        setCustomDims(suggested);
      }
    }
  }, [assessment?.target_type]);

  const { data: templates = [] } = useQuery({
    queryKey: ['scope-templates'],
    queryFn: () => base44.entities.ScopeTemplate.list('sort_order', 20),
  });

  const selectedTemplate = templates.find(t => t.id === templateId);

  // Resolve preview of active dims
  let previewDims;
  let suggestedDims = assessment?.target_type ? getSuggestedDimensions(assessment.target_type) : [];
  let optionalDims = assessment?.target_type ? getOptionalDimensions(assessment.target_type) : [];

  if (mode === 'full') previewDims = ALL_DIMENSIONS.map(d => d.key);
  else if (mode === 'template') previewDims = selectedTemplate?.active_dimensions || [];
  else if (mode === 'suggested') previewDims = suggestedDims;
  else previewDims = customDims;

  const estQuestions = `${previewDims.length * 5}–${previewDims.length * EST_PER_DIM}`;

  const toggleDim = (key) => {
    setCustomDims(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleConfirm = async () => {
    setSaving(true);
    let activeDims;
    if (mode === 'full') activeDims = ALL_DIMENSIONS.map(d => d.key);
    else if (mode === 'template') activeDims = selectedTemplate?.active_dimensions || ALL_DIMENSIONS.map(d => d.key);
    else if (mode === 'suggested') activeDims = suggestedDims;
    else activeDims = customDims;

    await onConfirm({
      scope_mode: mode,
      scope_template_id: mode === 'template' ? templateId : null,
      active_dimensions: activeDims,
    });
    setSaving(false);
  };

  const locked = assessment?.scope_locked;

  if (readOnly || locked) {
    return (
      <Card className="border-0 shadow-sm mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              {(() => {
                const scopeLabel =
                  assessment?.scope_mode === 'template' ? (selectedTemplate?.name || 'Template') :
                  assessment?.scope_mode === 'custom' ? 'Personalizado' :
                  assessment?.scope_mode === 'suggested' ? 'Sugerido' :
                  assessment?.scope_mode === 'full' ? 'Full Scope (8D)' :
                  'Escopo configurado';
                return (
                  <>
                    <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      Escopo: {scopeLabel}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {(assessment?.active_dimensions || ALL_DIMENSIONS.map(d => d.key)).length} dimensões ativas · {assessment?.scope_locked ? 'Congelado' : 'Configurado'}
                    </p>
                  </>
                );
              })()}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(assessment?.active_dimensions || ALL_DIMENSIONS.map(d => d.key)).map(dk => {
                const dim = ALL_DIMENSIONS.find(d => d.key === dk);
                return <Badge key={dk} variant="outline" className="text-[10px]">{dim?.label || dk}</Badge>;
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm mb-6">
      <CardContent className="p-5 space-y-5">
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">Escopo do Diagnóstico</h3>
          <p className="text-xs text-slate-400">Defina quais dimensões serão avaliadas neste diagnóstico.</p>
        </div>

        {/* Suggested info banner */}
        {assessment?.target_type && (
          <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700">
              <p className="font-semibold mb-1">Escopo sugerido para {assessment.target_type.charAt(0).toUpperCase() + assessment.target_type.slice(1)}</p>
              <p>{suggestedDims.map(d => DIMENSION_LABELS[d]).join(', ')}</p>
              {optionalDims.length > 0 && (
                <p className="text-blue-600 mt-1">Opcionais: {optionalDims.map(d => DIMENSION_LABELS[d]).join(', ')}</p>
              )}
            </div>
          </div>
        )}

        {/* Mode selector */}
        <div className="grid sm:grid-cols-4 gap-3">
          {[
            ...(assessment?.target_type ? [{ id: 'suggested', label: 'Sugerido', desc: 'Automático para este nível', icon: Layers }] : []),
            { id: 'full', label: 'Full Scope (8D)', desc: 'Todas as 8 dimensões', icon: Layers },
            { id: 'template', label: 'Template', desc: 'Escopo pré-definido', icon: LayoutGrid },
            { id: 'custom', label: 'Personalizado', desc: 'Escolha manual', icon: SlidersHorizontal },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setMode(opt.id)}
              className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all ${
                mode === opt.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <opt.icon className={`w-4 h-4 mb-1.5 ${mode === opt.id ? 'text-blue-600' : 'text-slate-400'}`} />
              <p className={`text-sm font-semibold ${mode === opt.id ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</p>
              <p className="text-xs text-slate-400">{opt.desc}</p>
            </button>
          ))}
        </div>

        {/* Template selector */}
        {mode === 'template' && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Selecionar Template</p>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Escolha um template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.description && <span className="text-slate-400 ml-1">— {t.description}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedTemplate.active_dimensions.map(dk => {
                  const dim = ALL_DIMENSIONS.find(d => d.key === dk);
                  return <Badge key={dk} variant="outline" className="text-xs">{dim?.label || dk}</Badge>;
                })}
              </div>
            )}
          </div>
        )}

        {/* Custom selector */}
        {mode === 'custom' && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Selecione as dimensões (todas disponíveis independente do nível)</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {ALL_DIMENSIONS.map(dim => {
                const active = customDims.includes(dim.key);
                const isSuggested = assessment?.target_type && suggestedDims.includes(dim.key);
                const isOptional = assessment?.target_type && optionalDims.includes(dim.key);
                const isExtra = assessment?.target_type && !isSuggested && !isOptional;
                return (
                  <button
                    key={dim.key}
                    onClick={() => toggleDim(dim.key)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm transition-all ${
                      active
                        ? 'border-blue-400 bg-blue-50 text-blue-800'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {active
                      ? <CheckSquare className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      : <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                    <span>{dim.label}</span>
                    {isSuggested && <span className="text-[10px] text-blue-600 ml-auto">Sugerida</span>}
                    {isOptional && <span className="text-[10px] text-amber-600 ml-auto">Opcional</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div>
            <p className="text-xs font-medium text-slate-700">Dimensões ativas: <strong>{previewDims.length} de 8</strong></p>
            <p className="text-xs text-slate-400 mt-0.5">Estimativa de perguntas: {estQuestions}</p>
          </div>
          <Button
            onClick={handleConfirm}
            disabled={saving || (mode === 'template' && !templateId) || (mode === 'custom' && customDims.length === 0)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            {saving ? 'Confirmando...' : 'Confirmar Escopo e Iniciar Diagnóstico'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}