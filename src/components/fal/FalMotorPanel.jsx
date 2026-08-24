import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, AlertCircle, ShieldAlert, Settings2, Database, Download } from 'lucide-react';
import { useTenant } from '@/components/shared/TenantContext';
import { invalidateAssessmentQueries } from '@/lib/query-client';

/**
 * @param {Object} props
 * @param {any=} props.assessment
 */
export default function FalMotorPanel({ assessment }) {
  const assessmentId = assessment?.id;
  const questionSet = assessment?.question_set || [];
  const { isHQ, tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [rebuildingSet, setRebuildingSet] = useState(false);
  const [rebuildingBank, setRebuildingBank] = useState(false);
  const [seedingMeta, setSeedingMeta] = useState(false);
  const [seedMetaResult, setSeedMetaResult] = useState(null);
  const [seedingIntel, setSeedingIntel] = useState(false);
  const [seedIntelResult, setSeedIntelResult] = useState(null);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(null);
  const [restructuring, setRestructuring] = useState(false);
  const [restructureConfirm, setRestructureConfirm] = useState(false);
  const [restructureResult, setRestructureResult] = useState(null);
  const [rebuildConfirm, setRebuildConfirm] = useState(false);
  const [rebuildResult, setRebuildResult] = useState(null);
  const [exporting, setExporting] = useState(false);

  const handleExportQuestions = async () => {
    setExporting(true);
    const res = await base44.functions.invoke('exportFalQuestions', {});
    const csv = res.data;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fal_questions_full_export.csv';
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const handleRestructure = async () => {
    if (!restructureConfirm) { setRestructureConfirm(true); return; }
    setRestructuring(true);
    setError(null);
    setRestructureConfirm(false);
    const res = await base44.functions.invoke('restructureFalMatrix', {});
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      setRestructureResult(res.data);
    }
    setRestructuring(false);
  };

  const handleSeedMeta = async () => {
    setSeedingMeta(true);
    setError(null);
    const res = await base44.functions.invoke('seedFalClusterMeta', {});
    if (res.data?.error) setError(res.data.error);
    else setSeedMetaResult(res.data);
    setSeedingMeta(false);
  };

  const handleSeedIntelligence = async () => {
    setSeedingIntel(true);
    setError(null);
    const res = await base44.functions.invoke('seedFalIntelligence', {});
    if (res.data?.error) setError(res.data.error);
    else setSeedIntelResult(res.data);
    setSeedingIntel(false);
  };

  const handleRebuildBank = async () => {
    if (!rebuildConfirm) { setRebuildConfirm(true); return; }
    setRebuildingBank(true);
    setError(null);
    setRebuildConfirm(false);
    const res = await base44.functions.invoke('rebuildFalQuestionBank', {});
    if (res.data?.error) setError(res.data.error);
    else setRebuildResult(res.data);
    setRebuildingBank(false);
  };

  const handleRebuildSet = async () => {
    if (!confirm) { setConfirm(true); return; }
    setRebuildingSet(true);
    setError(null);
    setConfirm(false);
    const res = await base44.functions.invoke('buildFalQuestionSet', { assessment_id: assessmentId });
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      setDone(res.data);
      invalidateAssessmentQueries(queryClient, assessmentId, tenantId);
    }
    setRebuildingSet(false);
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-500" />
            Motor FAL — Configuração Técnica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg space-y-1">
            <p className="text-sm font-medium text-slate-700">Status do Question Set</p>
            <p className="text-xs text-slate-500">
              {questionSet.length > 0
                ? `${questionSet.length} perguntas selecionadas e congeladas para auditoria`
                : 'Nenhum set gerado'}
            </p>
            {questionSet.length > 0 && (
              <Badge variant="outline" className="text-xs mt-1">Congelado</Badge>
            )}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Área técnica restrita</p>
              <p className="text-xs text-amber-700 mt-0.5">
                O questionário FAL é gerado automaticamente ao criar o assessment e não deve ser regenerado
                sem justificativa, pois invalida respostas anteriores.
              </p>
            </div>
          </div>

          {isHQ && (
            <div className="space-y-4">
              {/* Exportar Banco de Perguntas */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600">Exportar Banco de Perguntas</p>
                <p className="text-xs text-slate-500">Gera um CSV completo com todas as perguntas do banco FAL para revisão metodológica.</p>
                <Button variant="outline" size="sm" onClick={handleExportQuestions} disabled={exporting} className="gap-1.5">
                  {exporting
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exportando...</>
                    : <><Download className="w-3.5 h-3.5" /> Exportar fal_questions_full_export.csv</>}
                </Button>
              </div>

              {/* Reestruturar Matriz */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600">Reestruturação da Matriz Metodológica</p>
                <p className="text-xs text-slate-500">Recria subdimensões e clusters conforme o método FAL oficial. Remapeia perguntas automaticamente.</p>
                {restructureConfirm && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    ⚠️ <strong>ATENÇÃO:</strong> Esta operação apaga todas as subdimensões e clusters existentes e recria a matriz completa. Perguntas serão remapeadas. Clique novamente para confirmar.
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleRestructure} disabled={restructuring}
                    className={`gap-1.5 ${restructureConfirm ? 'border-red-400 text-red-600 hover:bg-red-50' : ''}`}>
                    {restructuring
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reestruturando...</>
                      : <><Database className="w-3.5 h-3.5" /> {restructureConfirm ? '⚠️ Confirmar Reestruturação' : 'Reestruturar Matriz FAL'}</>}
                  </Button>
                  {restructureConfirm && <Button variant="ghost" size="sm" onClick={() => setRestructureConfirm(false)}>Cancelar</Button>}
                </div>
                {restructureResult && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 space-y-1">
                    <p className="font-semibold">✅ Reestruturação concluída</p>
                    <p>Dimensões: {restructureResult.final_state?.total_dimensions} · Subdims: {restructureResult.final_state?.total_subdimensions} · Clusters: {restructureResult.final_state?.total_clusters}</p>
                    <p>Perguntas migradas: {restructureResult.migration?.questions_migrated} · Não mapeadas: {restructureResult.migration?.questions_unmapped}</p>
                    {restructureResult.validation?.questions_without_cluster > 0 && (
                      <p className="text-amber-700">⚠️ {restructureResult.validation.questions_without_cluster} perguntas sem cluster</p>
                    )}
                  </div>
                )}
              </div>

              {/* Seed Cluster Meta */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600">Metadados de Priorização (FalClusterMeta)</p>
                <p className="text-xs text-slate-500">Popula os pesos de impacto, risco e esforço para cada cluster. Necessário para o motor de prioridades.</p>
                <Button variant="outline" size="sm" onClick={handleSeedMeta} disabled={seedingMeta} className="gap-1.5">
                  {seedingMeta
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Populando...</>
                    : <><Database className="w-3.5 h-3.5" /> Seed Cluster Meta</>}
                </Button>
                {seedMetaResult && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700">
                    ✅ Criados: {seedMetaResult.created} · Atualizados: {seedMetaResult.updated} · Total: {seedMetaResult.total}
                  </div>
                )}
              </div>

              {/* Seed Intelligence */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600">Base de Inteligência (Causas, Recomendações, Benchmarks)</p>
                <p className="text-xs text-slate-500">Popula causas prováveis, recomendações e benchmarks para o motor de diagnóstico inteligente.</p>
                <Button variant="outline" size="sm" onClick={handleSeedIntelligence} disabled={seedingIntel} className="gap-1.5">
                  {seedingIntel
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Populando...</>
                    : <><Database className="w-3.5 h-3.5" /> Seed Inteligência FAL</>}
                </Button>
                {seedIntelResult && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700 space-y-0.5">
                    <p>✅ Causas: +{seedIntelResult.causes?.created} · Recomendações: +{seedIntelResult.recommendations?.created} · Benchmarks: +{seedIntelResult.benchmarks?.created}</p>
                  </div>
                )}
              </div>

              {/* Reconstruir Banco de Perguntas */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600">Banco de Perguntas FAL</p>
                <p className="text-xs text-slate-500">Reconstrói o banco de perguntas com base na nova matriz metodológica. Reaproveitaperguntas úteis e gera novas onde necessário.</p>
                {rebuildConfirm && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    ⚠️ Esta operação desativa as perguntas antigas e cria o banco completo novo. Clique novamente para confirmar.
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleRebuildBank} disabled={rebuildingBank}
                   className={`gap-1.5 ${rebuildConfirm ? 'border-red-400 text-red-600 hover:bg-red-50' : ''}`}>
                   {rebuildingBank
                     ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reconstruindo banco...</>
                     : <><Database className="w-3.5 h-3.5" /> {rebuildConfirm ? '⚠️ Confirmar Reconstrução' : 'Reconstruir Banco de Perguntas'}</>}
                  </Button>
                  {rebuildConfirm && <Button variant="ghost" size="sm" onClick={() => setRebuildConfirm(false)}>Cancelar</Button>}
                </div>
                {rebuildResult && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 space-y-1">
                    <p className="font-semibold">✅ Banco reconstruído</p>
                    <p>Criadas: {rebuildResult.operations?.created} · Reaproveitadas: {rebuildResult.operations?.reused} · Desativadas: {rebuildResult.operations?.deactivated}</p>
                    <p>Ativas: {rebuildResult.validation?.total_questions_active} · Rapid: {rebuildResult.validation?.total_questions_rapid} · Standard: {rebuildResult.validation?.total_questions_standard} · Deep: {rebuildResult.validation?.total_questions_deep}</p>
                    {rebuildResult.validation?.subdimensions_lacking_standard > 0 && (
                      <p className="text-amber-700">⚠️ {rebuildResult.validation.subdimensions_lacking_standard} subdimensões com &lt;3 perguntas standard</p>
                    )}
                  </div>
                )}
              </div>

              {/* Regenerar Question Set */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600">Question Set do Assessment</p>
              {confirm && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  ⚠️ Confirme: isso vai <strong>apagar o question_set atual</strong> e gerar um novo,
                  invalidando todas as respostas anteriores. Clique novamente para confirmar.
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRebuildSet}
                disabled={rebuildingSet}
                className={`gap-1.5 ${confirm ? 'border-red-400 text-red-600 hover:bg-red-50' : ''}`}
              >
                {rebuildingSet
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerando...</>
                  : <><RefreshCw className="w-3.5 h-3.5" /> {confirm ? '⚠️ Confirmar Regeneração' : 'Regenerar Question Set'}</>}
              </Button>
              {confirm && (
                <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                  Cancelar
                </Button>
              )}
              </div>
            </div>
          )}

          {done && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
              Set regenerado: {done.total} perguntas · {done.adaptive_pass ? 'pass adaptativo' : 'pass inicial'}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}