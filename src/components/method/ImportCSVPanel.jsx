import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle2, AlertTriangle, Eye, Download } from 'lucide-react';

const DIM_LABELS = {
  governanca: 'Governança', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Tributário',
  juridico: 'Jurídico', operacional: 'Operacional', sistemas: 'Sistemas',
};

const EXAMPLE_CSV = `id,dimension,subdimension,question_text,sector_applicability,weight,trigger_condition
GOV-01,governanca,Estrutura de Decisão,"Existe instância formal de tomada de decisão estratégica?",all,3,
GOV-S01,governanca,Governança Rural,"Existe governança formal sobre decisões do ciclo produtivo?","agriculture;livestock",2,agro_governance
FIN-01,financeiro,Fluxo de Caixa,"A empresa possui fluxo de caixa projetado (mínimo 3 meses)?",all,3,
OPR-S01,operacional,Safra,"Existe planejamento formal de safra com metas de produtividade?","agriculture;agro_livestock",2,agro_harvest`;

export default function ImportCSVPanel() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(/** @type {string} */ (ev.target.result));
    reader.readAsText(file, 'UTF-8');
  };

  const handleDryRun = async () => {
    if (!csvText) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await base44.functions.invoke('importQuestionsCSV', { csv_text: csvText, dry_run: true });
      if (res.data.success === false || res.data.errors) {
        setError(res.data);
      } else {
        setPreview(res.data);
      }
    } catch (e) {
      setError({ error: e.message });
    }
    setLoading(false);
  };

  const handleImport = async () => {
    if (!csvText) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke('importQuestionsCSV', { csv_text: csvText, dry_run: false });
      if (res.data.success === false || res.data.errors) {
        setError(res.data);
      } else {
        setResult(res.data);
        setPreview(null);
      }
    } catch (e) {
      setError({ error: e.message });
    }
    setLoading(false);
  };

  const downloadExample = () => {
    const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exemplo_perguntas_fal.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-0 shadow-sm mt-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="w-4 h-4" /> Importar Perguntas via CSV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Format info */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-700 mb-2">Colunas esperadas:</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <span><span className="font-mono text-blue-700">id</span> — código único (ex: GOV-01)</span>
            <span><span className="font-mono text-blue-700">dimension</span> — nome ou chave da dimensão</span>
            <span><span className="font-mono text-blue-700">subdimension</span> — subdimensão (vira orientação)</span>
            <span><span className="font-mono text-blue-700">question_text</span> — texto da pergunta</span>
            <span><span className="font-mono text-blue-700">sector_applicability</span> — setor(es), separados por ;</span>
            <span><span className="font-mono text-blue-700">weight</span> — peso: 1, 2 ou 3</span>
            <span><span className="font-mono text-blue-700">trigger_condition</span> — condição (opcional)</span>
          </div>
          <p className="mt-2 text-slate-500">Valores válidos para <span className="font-mono">sector_applicability</span>: all, agriculture, livestock, agro_livestock, input_retail, agro_industry — separados por ; para múltiplos.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={downloadExample} className="gap-2">
            <Download className="w-3 h-3" /> Baixar exemplo CSV
          </Button>
        </div>

        {/* File picker */}
        <div
          className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
          onClick={() => fileRef.current && fileRef.current.click()}
        >
          <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          {fileName
            ? <p className="text-sm font-medium text-slate-700">{fileName}</p>
            : <p className="text-sm text-slate-400">Clique para selecionar o arquivo CSV</p>
          }
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
        </div>

        {csvText && !result && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleDryRun} disabled={loading} className="gap-2">
              <Eye className="w-4 h-4" /> {loading ? 'Validando...' : 'Pré-visualizar'}
            </Button>
            {preview && (
              <Button onClick={handleImport} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <Upload className="w-4 h-4" /> {loading ? 'Importando...' : `Importar ${preview.questions_to_import} perguntas`}
              </Button>
            )}
          </div>
        )}

        {/* Errors */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <p className="text-sm font-semibold text-red-700">{error.error}</p>
            </div>
            {error.errors?.map((e, i) => (
              <p key={i} className="text-xs text-red-600 ml-6">• {e}</p>
            ))}
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-blue-700">
                Pré-visualização — {preview.questions_to_import} perguntas · {preview.version_code}
              </p>
            </div>
            <div className="space-y-1">
              {Object.entries(preview.preview_by_dimension || {}).map(([dim, qs]) => (
                <div key={dim} className="flex items-center justify-between text-xs py-1 border-b border-blue-100">
                  <span className="font-medium text-slate-700">{DIM_LABELS[dim] || dim}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{qs.length} perguntas</Badge>
                    <span className="text-slate-400">{qs.filter(q => q.sector_type === 'core').length} core · {qs.filter(q => q.sector_type === 'sector').length} setoriais</span>
                  </div>
                </div>
              ))}
            </div>
            {preview.warnings?.length > 0 && (
              <div className="mt-2">
                {preview.warnings.map((w, i) => <p key={i} className="text-xs text-amber-600">⚠ {w}</p>)}
              </div>
            )}
          </div>
        )}

        {/* Success */}
        {result && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-700">
                {result.questions_imported} perguntas importadas com sucesso — {result.version_code}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(result.by_dimension || {}).filter(([, n]) => n > 0).map(([dim, n]) => (
                <p key={dim} className="text-xs text-emerald-600">• {DIM_LABELS[dim] || dim}: {n}</p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}