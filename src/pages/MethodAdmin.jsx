import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Layers, GitBranch, Scale, ListChecks } from 'lucide-react';
import ImportBankPanel from '@/components/method/ImportBankPanel';
import ImportCSVPanel from '@/components/method/ImportCSVPanel';
import ImportFalCSVPanel from '@/components/method/ImportFalCSVPanel';

export default function MethodAdmin() {
  const { methodVersion, isHQ, user, loading: authLoading } = useTenant();

  useEffect(() => {
    if (!authLoading && !user) {
      base44.auth.redirectToLogin(window.location.href);
    }
  }, [authLoading, user]);

  const { data: questions = [] } = useQuery({
    queryKey: ['all-questions', methodVersion?.id],
    queryFn: () => base44.entities.Question.filter({ method_version_id: methodVersion.id }),
    enabled: !!methodVersion?.id,
  });

  const { data: mqeQuestions = [] } = useQuery({
    queryKey: ['all-mqe', methodVersion?.id],
    queryFn: () => base44.entities.MQEQuestion.filter({ method_version_id: methodVersion.id }),
    enabled: !!methodVersion?.id,
  });

  const { data: checklist = [] } = useQuery({
    queryKey: ['all-checklist', methodVersion?.id],
    queryFn: () => base44.entities.EvidenceChecklist.filter({ method_version_id: methodVersion.id }),
    enabled: !!methodVersion?.id,
  });

  if (!methodVersion) {
    return <div className="p-8 text-center text-slate-400">Nenhuma versão do método ativa. Inicialize o seed no Dashboard.</div>;
  }

  const dims = methodVersion.dimensions || [];
  const crosses = methodVersion.crossings || [];
  const profiles = methodVersion.penalty_profiles || [];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administração do Método</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="font-mono">{methodVersion.version_code}</Badge>
            <Badge className={methodVersion.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
              {methodVersion.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 text-center">
            <Layers className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{questions.length}</p>
            <p className="text-xs text-slate-500">Perguntas IFME</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 text-center">
            <GitBranch className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{mqeQuestions.length}</p>
            <p className="text-xs text-slate-500">Perguntas MQE</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 text-center">
            <ListChecks className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{checklist.length}</p>
            <p className="text-xs text-slate-500">Itens Checklist</p>
          </CardContent>
        </Card>
      </div>

      {/* Dimensions */}
      <Card className="border-0 shadow-sm mb-6">
        <CardHeader><CardTitle className="text-base">8 Dimensões IFME™</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dims.map(d => {
              const dq = questions.filter(q => q.dimension_key === d.key);
              return (
                <div key={d.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-slate-400">{dq.length} perguntas</p>
                  </div>
                  <Badge variant="outline" className="font-mono">{(d.global_weight * 100).toFixed(0)}%</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Crossings */}
      <Card className="border-0 shadow-sm mb-6">
        <CardHeader><CardTitle className="text-base">10 Cruzamentos MFIS™</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-2">
            {crosses.map(c => {
              const cq = mqeQuestions.filter(q => q.crossing_key === c.key);
              return (
                <div key={c.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-slate-400">{cq.length} perguntas MQE</p>
                  </div>
                  <Badge variant="outline" className="font-mono">{c.key}</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Penalty Profiles */}
      <Card className="border-0 shadow-sm mb-6">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Scale className="w-4 h-4" /> Perfis de Penalidade</CardTitle></CardHeader>
        <CardContent>
          {profiles.map(p => (
            <div key={p.key} className="p-4 bg-slate-50 rounded-lg">
              <p className="font-medium text-sm mb-2">{p.name}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
                <div>FDE baixo: {(p.fde_low_penalty * 100).toFixed(0)}%</div>
                <div>FDE médio: {(p.fde_mid_penalty * 100).toFixed(0)}%</div>
                <div>FAG baixo: {(p.fag_low_penalty * 100).toFixed(0)}%</div>
                <div>FAG alto: {(p.fag_high_penalty * 100).toFixed(0)}%</div>
                <div>FAS baixo: {(p.fas_low_penalty * 100).toFixed(0)}%</div>
                <div>FAS alto: {(p.fas_high_penalty * 100).toFixed(0)}%</div>
                <div className="col-span-2">Cap crítico: {p.fde_critical_cap}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {isHQ && <ImportBankPanel />}
      {isHQ && <ImportCSVPanel />}
      {isHQ && <ImportFalCSVPanel />}

      {!isHQ && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          ⚠️ Somente o HQ Admin pode editar o método, perguntas, pesos e regras.
        </div>
      )}
    </div>
  );
}