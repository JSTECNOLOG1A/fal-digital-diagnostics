import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, CheckCircle2, XCircle, FileJson, Info } from 'lucide-react';

const EXAMPLE_STRUCTURE = {
  dimensions: [
    {
      key: "governanca",
      name: "Governança (TCWG)",
      questions: [
        { code: "GOV-01", text: "A empresa possui estrutura de governança formalizada?", weight: 3, guidance: "Verificar ata de constituição.", sector_tags: ["all"], sector_type: "core", evidence_hint: "estatuto social", risk_tag: "governance_structure" },
        { code: "GOV-S01", text: "Existe planejamento formal de safra?", weight: 2, sector_tags: ["agriculture","agro_livestock"], sector_type: "sector", evidence_hint: "plano de safra", risk_tag: "agro_governance_planning" }
      ],
      checklist: [
        { item_id: "gov_chk_1", label: "Estatuto Social ou Contrato Social atualizado", required: true },
        { item_id: "gov_chk_2", label: "Atas de reunião do TCWG (últimos 12 meses)", required: true }
      ]
    }
  ],
  crossings: [
    {
      key: "GxF",
      name: "Governança × Financeiro",
      dim_a: "governanca",
      dim_b: "financeiro",
      mqe_questions: [
        { code: "GxF-01", text: "As decisões financeiras relevantes são aprovadas pelo TCWG?", weight: 1, sector_tags: ["all"], sector_type: "core", risk_tag: "governance_financial_alignment" }
      ]
    }
  ]
};

export default function ImportBankPanel() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [versionCode, setVersionCode] = useState('');
  const [notes, setNotes] = useState('');
  const [activate, setActivate] = useState(false);
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [showExample, setShowExample] = useState(false);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setParsed(null);
    setParseError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(/** @type {string} */ (ev.target.result));
        setParsed(data);
      } catch {
        setParseError('Arquivo JSON inválido. Verifique a estrutura.');
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!parsed || !versionCode) return;
    setImporting(true);
    setResult(null);
    const res = await base44.functions.invoke('importMethodBank', {
      bank: parsed,
      version_code: versionCode,
      notes,
      activate
    });
    setResult(res.data);
    setImporting(false);
  };

  const dimCount = parsed?.dimensions?.length || 0;
  const qCount = parsed?.dimensions?.reduce((s, d) => s + (d.questions?.length || 0), 0) || 0;
  const crossCount = parsed?.crossings?.length || 0;
  const mqeCount = parsed?.crossings?.reduce((s, c) => s + (c.mqe_questions?.length || 0), 0) || 0;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="w-4 h-4" /> Importar Banco de Perguntas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <strong>Regras:</strong> Pesos globais das dimensões são <strong>congelados</strong> e não podem ser alterados via import. A importação cria uma nova MethodVersion (draft). Tenants existentes não são migrados automaticamente.
        </div>

        <div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowExample(!showExample)}>
            <Info className="w-3.5 h-3.5" /> {showExample ? 'Ocultar' : 'Ver'} estrutura esperada do JSON
          </Button>
          {showExample && (
            <pre className="mt-2 p-3 bg-slate-900 text-slate-100 text-[10px] rounded-lg overflow-x-auto max-h-64">
              {JSON.stringify(EXAMPLE_STRUCTURE, null, 2)}
            </pre>
          )}
        </div>

        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
          <FileJson className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <label className="cursor-pointer">
            <span className="text-sm text-blue-600 hover:underline font-medium">Selecionar arquivo JSON</span>
            <input type="file" accept=".json" className="hidden" onChange={handleFile} />
          </label>
          {file && <p className="text-xs text-slate-500 mt-1">{file.name}</p>}
        </div>

        {parseError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {parseError}
          </div>
        )}

        {parsed && !parseError && (
          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 grid grid-cols-2 gap-2">
            <div>📐 Dimensões: <strong>{dimCount}</strong></div>
            <div>❓ Perguntas IFME: <strong>{qCount}</strong></div>
            <div>🔀 Cruzamentos: <strong>{crossCount}</strong></div>
            <div>📊 Perguntas MQE: <strong>{mqeCount}</strong></div>
          </div>
        )}

        {parsed && !parseError && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700">Código da Versão *</label>
              <input
                type="text"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ex: FAL v1.1"
                value={versionCode}
                onChange={e => setVersionCode(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Notas (opcional)</label>
              <input
                type="text"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ex: Banco definitivo v1.1 aprovado em 04/2026"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={activate} onChange={e => setActivate(e.target.checked)} className="rounded" />
              <span>Ativar esta versão imediatamente (novos tenants usarão esta versão)</span>
            </label>

            <Button
              onClick={handleImport}
              disabled={!versionCode || importing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Importando...' : 'Importar Banco'}
            </Button>
          </div>
        )}

        {result && (
          <div className={`p-4 rounded-xl border text-sm ${result.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            {result.error ? (
              <>
                <div className="flex items-center gap-2 font-semibold mb-2"><XCircle className="w-4 h-4" /> Erro na importação</div>
                <p>{result.error}</p>
                {result.errors && <ul className="mt-2 list-disc list-inside text-xs space-y-1">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 font-semibold mb-2"><CheckCircle2 className="w-4 h-4" /> Importação concluída!</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span>Versão: <strong>{result.version_code}</strong></span>
                  <span>Status: <strong>{result.status}</strong></span>
                  <span>Perguntas IFME: <strong>{result.questions_created}</strong></span>
                  <span>Perguntas MQE: <strong>{result.mqe_questions_created}</strong></span>
                </div>
                <p className="mt-2 text-xs opacity-80">{result.note}</p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}