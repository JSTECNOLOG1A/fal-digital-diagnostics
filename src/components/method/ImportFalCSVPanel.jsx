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

const EXAMPLE_CSV = `question_id,dimension_key,subdimension_key,cluster_key,process_stage,sequence_order,diagnostic_depth,level_applicability,question_text,question_weight,dependency
governanca_estrutura_governanca_001,governanca,estrutura_governanca,estrutura_governanca_cluster,existence,1,"rapid,standard,deep","group,company,unit","Existe instância formal de tomada de decisão estratégica?",1,
juridico_estrutura_societaria_001,juridico,estrutura_societaria,estrutura_societaria_cluster,existence,1,"rapid,standard,deep","group,company,unit","O contrato social está atualizado e registrado?",1,
controles_internos_segregacao_funcoes_001,controles_internos,segregacao_funcoes,segregacao_funcoes_cluster,control,1,"standard,deep","company,unit","Existe separação formal entre quem autoriza e quem executa pagamentos?",1.15,
financeiro_gestao_caixa_001,financeiro,gestao_caixa,gestao_caixa_cluster,existence,1,"rapid,standard,deep","group,company,unit","A empresa possui fluxo de caixa projetado (mínimo 3 meses)?",1,
contabil_organizacao_contabil_001,contabil,organizacao_contabil,organizacao_contabil_cluster,existence,1,"rapid,standard,deep","company,unit","A contabilidade está em dia e sem pendências fiscais?",1,
tributario_apuracao_tributos_001,tributario,apuracao_tributos,apuracao_tributos_cluster,existence,1,"rapid,standard,deep","group,company,unit","Existe procedimento formal definido para apuração dos tributos federais, estaduais e municipais?",1,
operacional_gestao_producao_001,operacional,gestao_producao,gestao_producao_cluster,existence,1,"standard,deep","company,unit","Existe planejamento formal de safra com metas de produtividade?",1,
sistemas_sistemas_gestao_001,sistemas,sistemas_gestao,sistemas_gestao_cluster,existence,1,"rapid,standard,deep","group,company,unit","A empresa utiliza ERP ou sistema integrado de gestão?",1,`;

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
    const res = await base44.functions.invoke('importFalQuestionBankV3', { csv_text: csvText, dry_run: true });
    if (res.data?.success === false || res.data?.errors) setError(res.data);
    else setPreview(res.data);
    setLoading(false);
  };

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await base44.functions.invoke('importFalQuestionBankV3', { csv_text: csvText, dry_run: false });
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
              {['question_id', 'dimension_key', 'subdimension_key', 'cluster_key', 'process_stage', 'sequence_order', 'diagnostic_depth', 'level_applicability', 'question_text', 'question_weight (opc.)', 'dependency (opc.)'].map((col, i) => (
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