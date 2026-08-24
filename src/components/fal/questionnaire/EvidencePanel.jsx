import React, { useState } from 'react';
import { Paperclip, Upload, X, FileText, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Textarea } from '@/components/ui/textarea';

/**
 * @param {Object} props
 * @param {any=} props.answer
 * @param {any=} props.onChange
 * @param {any=} props.evidenceHint
 * @param {any=} props.required
 */
export default function EvidencePanel({ answer, onChange, evidenceHint, required }) {
  const [uploading, setUploading] = useState(false);
  const fileUrls = answer?.evidence_file_urls || [];
  const notes    = answer?.evidence_notes || '';

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange({ evidence_file_urls: [...fileUrls, file_url] });
    setUploading(false);
    e.target.value = '';
  };

  const removeFile = (url) => {
    onChange({ evidence_file_urls: fileUrls.filter(u => u !== url) });
  };

  return (
    <div className={`mt-3 rounded-lg border p-3 space-y-2 ${required && !notes && fileUrls.length === 0 ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-slate-50/50'}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
          <Paperclip className="w-3 h-3" />
          Evidências
          {required && <span className="text-amber-600 ml-1">*obrigatório</span>}
        </span>
        {evidenceHint && (
          <span className="text-[10px] text-slate-400 italic hidden sm:block">Ex: {evidenceHint}</span>
        )}
      </div>

      <Textarea
        placeholder={evidenceHint ? `Observações... (ex: ${evidenceHint})` : 'Observações, referências ou contexto da evidência...'}
        value={notes}
        onChange={e => onChange({ evidence_notes: e.target.value })}
        className="h-12 text-xs resize-none bg-white"
      />

      {fileUrls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {fileUrls.map((url, i) => (
            <div key={i} className="flex items-center gap-1 text-[10px] bg-white border border-slate-200 rounded px-2 py-1">
              <FileText className="w-3 h-3 text-blue-500" />
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline max-w-[120px] truncate">
                Arquivo {i + 1}
              </a>
              <button onClick={() => removeFile(url)} className="text-slate-400 hover:text-red-500 ml-1">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-blue-600 cursor-pointer w-fit transition-colors">
        {uploading
          ? <><Loader2 className="w-3 h-3 animate-spin" /> Enviando...</>
          : <><Upload className="w-3 h-3" /> Anexar documento</>}
        <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
      </label>
    </div>
  );
}