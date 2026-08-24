import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeftRight, Info, Upload, FileText, X, Loader2 } from 'lucide-react';
import { FAL_DIMENSION_LABELS, getClusterLabel, getSubdimLabel } from '@/components/fal/falOfficialMatrix';
import QuestionCriticalityBadge from './QuestionCriticalityBadge';
import QuestionFlagMenu from './QuestionFlagMenu';
import ConfidencePicker from './ConfidencePicker';
import ScoreSelector from '@/components/shared/questionnaire/ScoreSelector';
import { base44 } from '@/api/base44Client';

const SUPPORT_CHIPS = [
'Sem evidência formal',
'Processo informal',
'Depende de pessoas-chave',
'Existe política/documento',
'Rotina validada',
'Evidência anexada'];


/**
 * @param {Object} props
 * @param {any=} props.q
 * @param {any=} props.idx
 * @param {any=} props.total
 * @param {any=} props.answer
  * @param {any=} props.onAnswer
  * @param {any=} props.onScoreSelect
  * @param {any=} props.swapped
  * @param {any=} props.onSwap
 */
export default function QuestionCard({ q, idx, total, answer = {}, onAnswer, onScoreSelect, swapped, onSwap }) {
  const [showGuidance, setShowGuidance] = useState(false);
  const [uploading, setUploading] = useState(false);

  const answered = answer.score !== undefined;
  const isCritical = q.is_killer_question || q.is_critical;
  const needsEvidence = isCritical && answered && answer.score <= 1;
  const needsJustification = isCritical && answered && answer.score <= 1 && !answer.justification?.trim();
  const fileUrls = answer.evidence_file_urls || [];

  const handleScoreChange = (val) => {
    onAnswer({ score: val });
    if (onScoreSelect) onScoreSelect(val);
  };

  const toggleChip = (chip) => {
    const current = answer.justification || '';
    if (current.includes(chip)) {
      onAnswer({ justification: current.replace(chip, '').replace(/^[;\s]+|[;\s]+$/g, '').replace(/;\s*;/g, ';') });
    } else {
      onAnswer({ justification: current ? `${current}; ${chip}` : chip });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onAnswer({ evidence_file_urls: [...fileUrls, file_url] });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeFile = (url) => {
    onAnswer({ evidence_file_urls: fileUrls.filter((u) => u !== url) });
  };

  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm flex flex-col overflow-hidden
      ${q.is_killer_question ? 'border-red-200' : q.is_critical ? 'border-amber-200' : answered ? 'border-blue-200' : 'border-slate-200'}`}>

      {/* Barra superior */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2.5 border-b border-slate-100 flex-shrink-0">
        <div className="flex flex-col gap-1">
          {(q.subdimension_key || q.cluster_key) &&
          <span className="font-bold text-slate-800 text-xl">
              {q.subdimension_key ?
            getSubdimLabel(q.subdimension_key) :
            getClusterLabel(q.cluster_key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              {q.subdimension_key && q.cluster_key &&
            <span className="text-slate-400 font-normal hidden"> · {getClusterLabel(q.cluster_key).replace(/\bcluster\b/gi, '').replace(/_/g, ' ').replace(/\s{2,}/g, ' ').trim()}</span>
            }
            </span>
          }
          <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-medium">
            Pergunta {idx + 1}{total ? ` de ${total}` : ''}
          </span>
          <QuestionCriticalityBadge question={q} />
          {answer.flag &&
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border
              ${answer.flag === 'conflito' ? 'bg-red-50 text-red-600 border-red-200' :
            answer.flag === 'revisar' ? 'bg-blue-50 text-blue-600 border-blue-200' :
            'bg-orange-50 text-orange-600 border-orange-200'}`}>
              {answer.flag.toUpperCase()}
            </span>
            }
          </div>
        </div>
        <div className="flex items-center gap-2">
          <QuestionFlagMenu currentFlag={answer.flag} onChange={(flag) => onAnswer({ flag })} />
          {!swapped ?
          <button
            title="Substituir pergunta"
            onClick={onSwap}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-lg border border-slate-200 hover:border-amber-200 transition-all">
            
              <ArrowLeftRight className="w-3 h-3" /> Trocar
            </button> :

          <span className="text-[11px] text-amber-500 flex items-center gap-1 px-2 py-0.5 bg-amber-50 rounded-lg border border-amber-200">
              <ArrowLeftRight className="w-3 h-3" /> Trocada
            </span>
          }
        </div>
      </div>

      {/* Texto da pergunta */}
      <div className="px-5 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5 hidden">
          <span className="text-xs text-slate-400 font-medium">Peso {q.question_weight || 1}</span>
          <span className="text-slate-300 text-xs">·</span>
          <span className="text-xs text-slate-400">{FAL_DIMENSION_LABELS[q.dimension_key] || q.dimension_key}</span>
          {q.guidance &&
          <button
            onClick={() => setShowGuidance((g) => !g)}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors">
            
              <Info className="w-3 h-3" />
              {showGuidance ? 'Ocultar' : 'Por que importa?'}
            </button>
          }
        </div>
        <h2 className="text-base font-bold text-slate-900 leading-snug">
          {q.question_text}
        </h2>
        {showGuidance && q.guidance &&
        <div className="mt-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 leading-relaxed">
            {q.guidance}
          </div>
        }
      </div>

      {/* Seletor de nota */}
      <div className="px-5 pb-3 flex-shrink-0">
        <ScoreSelector value={answer.score} onChange={handleScoreChange} />
      </div>

      {/* Justificativa + Evidências */}
      <div className="px-5 pb-4 flex-shrink-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Justificativa — 2/3 */}
          <div className="lg:col-span-2 flex flex-col gap-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Justificativa
                {needsJustification && <span className="text-red-500 font-bold ml-1">* obrigatória</span>}
              </label>
              <div className="relative">
                <Textarea
                  placeholder="Fundamente esta avaliação com fatos concretos..."
                  value={answer.justification || ''}
                  onChange={(e) => onAnswer({ justification: e.target.value })}
                  className={`min-h-[68px] text-xs resize-none pr-12 py-2 rounded-xl transition-all ${
                  needsJustification ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200'}`
                  }
                  maxLength={2000} />
                
                <span className="absolute bottom-2 right-2.5 text-[9px] text-slate-400 pointer-events-none">
                  {(answer.justification || '').length}/2k
                </span>
              </div>
            </div>
            {/* Chips de apoio — complementam sem apagar */}
            <div className="flex flex-wrap gap-1">
              {SUPPORT_CHIPS.map((chip) => {
                const active = (answer.justification || '').includes(chip);
                return (
                  <button
                    key={chip}
                    onClick={() => toggleChip(chip)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                    active ?
                    'bg-slate-800 text-white border-slate-800' :
                    'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`
                    }>
                    
                    {chip}
                  </button>);

              })}
            </div>
          </div>

          {/* Evidências — 1/3 */}
          <div className="lg:col-span-1 flex flex-col gap-2">
            <div>
              <label className={`text-xs font-bold block mb-1 ${needsEvidence ? 'text-red-500' : 'text-slate-700'}`}>
                Evidências {needsEvidence && <span>*</span>}
              </label>
              <Textarea
                placeholder={q.evidence_hint ? `Ex: ${q.evidence_hint}` : 'Notas sobre evidências...'}
                value={answer.evidence_notes || ''}
                onChange={(e) => onAnswer({ evidence_notes: e.target.value })}
                className="min-h-[68px] text-[11px] resize-none border-slate-200 py-2 rounded-xl hidden" />
              
            </div>
            <div className="flex items-stretch justify-between gap-2 flex-wrap">
              <label className={`flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer px-3 rounded-xl border transition-all min-h-[68px] ${
               needsEvidence ?
               'border-red-300 bg-red-50 text-red-700 hover:bg-red-100' :
               'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`
               }>
                {uploading ?
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando</> :
                <><Upload className="w-3.5 h-3.5" /> Anexar</>}
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
                {fileUrls.length} {fileUrls.length === 1 ? 'anexo' : 'anexos'}
              </span>
            </div>
          </div>
        </div>

        {/* Lista de arquivos */}
        {fileUrls.length > 0 &&
        <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
            {fileUrls.map((url, i) =>
          <div key={i} className="flex items-center gap-1.5 text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-900 hover:underline font-medium truncate max-w-[120px]">
                  Arquivo {i + 1}
                </a>
                <button onClick={() => removeFile(url)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
          )}
          </div>
        }
      </div>

      {/* Confiança */}
      <div className="px-5 pb-3 border-t border-slate-100 pt-2.5 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-bold text-slate-600">Confiança</span>
        </div>
        <ConfidencePicker
          value={answer.confidence_level}
          onChange={(val) => onAnswer({ confidence_level: val })} />
        
      </div>
    </div>);

}