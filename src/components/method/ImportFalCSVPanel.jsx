import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, CheckCircle2, AlertTriangle, Eye, Download, Activity } from 'lucide-react';

const DIM_LABELS = {
  governanca: 'Governança', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal',
  juridico: 'Jurídico / Societário', operacional: 'Operacional', sistemas: 'Tecnologia / Sistemas',
};

const EXAMPLE_CSV = `id,dimension,subdimension,question_text,sector_applicability,weight,trigger_condition
GOV-01,governanca,Estrutura de governança,"Existe instância formal de tomada de decisão estratégica?",all,3,
GOV-02,governanca,Planejamento estratégico,"Há relatórios periódicos de gestão compartilhados com sócios/diretores?",all,2,
GOV-03,governanca,Gestão de riscos,"A empresa possui mapeamento formal de riscos estratégicos?",all,2,
JUR-01,juridico,Estrutura societária,"O contrato social está atualizado e registrado?",all,3,
CI-01,controles_internos,Segregação de funções,"Existe separação formal entre quem autoriza e quem executa pagamentos?",all,3,
FIN-01,financeiro,Fluxo de caixa,"A empresa possui fluxo de caixa projetado (mínimo 3 meses)?",all,3,
FIN-02,financeiro,Planejamento financeiro,"Existe orçamento anual formalizado e acompanhado mensalmente?",all,2,
FIN-03,financeiro,Endividamento e relação bancária,"A empresa conhece seu custo médio de capital?",all,2,
FIN-04,financeiro,Indicadores financeiros,"São calculados indicadores de liquidez mensalmente?",all,1,
CTB-01,contabil,Escrituração contábil,"A contabilidade está em dia e sem pendências fiscais?",all,3,
TRB-01,tributario,Apuração tributária,"A empresa possui análise de enquadramento tributário atualizada?",all,3,
TRB-02,tributario,Planejamento tributário,"Há planejamento tributário preventivo realizado anualmente?",all,2,
OPR-01,operacional,Comercial,"Existem metas comerciais formalizadas e acompanhadas?",all,2,
OPR-S01,operacional,Produção / operação,"Existe planejamento formal de safra com metas de produtividade?","agriculture;agro_livestock",2,agro_harvest
SIS-01,sistemas,Sistemas de gestão,"A empresa utiliza ERP ou sistema integrado de gestão?",all,3,
SIS-02,sistemas,Segurança da informação,"Existem políticas de backup e segurança de dados implementadas?",all,2,`;

export default function ImportFalCSVPanel() {
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
    setLoading(true);
    setError(null);
    setPreview(null);
    const res = await base44.functions.invoke('importFalQuestions', { csv_text: csvText, dry_run: true });
    if (res.data?.success === false || res.data?.errors) setError(res.data);
    else setPreview(res.data);
    setLoading(false);
  };

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await base44.functions.invoke('importFalQuestions', { csv_text: csvText, dry_run: false });
    if (res.data?.success === false || res.data?.errors) setError(res.data);
    else { setResult(res.data); setPreview(null); }
    setLoading(false);
  };

  const downloadExample = () => {
    const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exemplo_fal_questions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-0 shadow-sm mt-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" /> Importar Banco FAL (Motor FAL) via CSV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-2">
          <p>Este painel importa perguntas para o <strong>Motor FAL</strong> (FalQuestion). São perguntas independentes do Método IFME/MQE, usadas no diagnóstico adaptativo (60–90 perguntas, score 0–3).</p>
          <div>
            <p className="font-semibold mb-1">Colunas do CSV (na ordem):</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {['id', 'dimension', 'subdimension', 'question_text', 'sector_applicability', 'weight', 'trigger_condition'].map((col, i) => (
                <span key={col} className="font-mono text-[11px]">{i + 1}. {col}</span>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-blue-600">
            Dimensões válidas: <span className="font-mono">governanca, juridico, controles_internos, financeiro, contabil, tributario, operacional, sistemas</span>
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={downloadExample} className="gap-2">
          <Download className="w-3 h-3" /> Baixar exemplo CSV
        </Button>

        <div
          className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
          onClick={() => fileRef.current && fileRef.current.click()}
        >
          <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          {fileName
            ? <p className="text-sm font-medium text-slate-700">{fileName}</p>
            : <p className="text-sm text-slate-400">Clique para selecionar o arquivo CSV</p>}
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
        </div>

        {csvText && !result && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleDryRun} disabled={loading} className="gap-2">
              <Eye className="w-4 h-4" /> {loading ? 'Validando...' : 'Pré-visualizar'}
            </Button>
            {preview && (
              <Button onClick={handleImport} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <Upload className="w-4 h-4" /> {loading ? 'Importando...' : `Importar ${preview.total} perguntas`}
              </Button>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <p className="text-sm font-semibold text-red-700">{error.error || 'Erro de validação'}</p>
            </div>
            {error.errors?.map((e, i) => <p key={i} className="text-xs text-red-600 ml-6">• {e}</p>)}
          </div>
        )}

        {preview && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-blue-700">{preview.total} perguntas prontas para importar</p>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(preview.by_dimension || {}).map(([dim, n]) => (
                <p key={dim} className="text-xs text-blue-600">• {DIM_LABELS[dim] || dim}: {n} perguntas</p>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-700">{result.imported} perguntas FAL importadas</p>
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