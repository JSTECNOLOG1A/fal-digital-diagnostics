/**
 * FalValueLeversSection — Alavancas de Valor
 * Exibe a Curva FAL de Estabilidade Corporativa e as alavancas estratégicas
 * para impacto de longo prazo na organização.
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import FalValueLeverMap from './FalValueLeverMap';

/**
 * @param {Object} props
 * @param {any=} props.snapshot
 */
export default function FalValueLeversSection({ snapshot }) {
  if (!snapshot) {
    return (
      <div className="text-center py-16 text-slate-400">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nenhum diagnóstico calculado ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Curva FAL de Estabilidade Corporativa™</CardTitle>
          <p className="text-xs text-slate-500 mt-2">
            Alavancas de valor identificadas para potencializar o impacto estratégico de médio a longo prazo.
            Cada alavanca mapeia clusters críticos com maior potencial de melhoria sistêmica.
          </p>
        </CardHeader>
        <CardContent>
          {snapshot.value_lever_summary && Object.keys(snapshot.value_lever_summary).length > 0 ? (
            <FalValueLeverMap valueLeverSummary={snapshot.value_lever_summary} />
          ) : (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm">Alavancas de valor ainda não foram calculadas.</p>
              <p className="text-xs mt-1">Execute o diagnóstico completo para gerar análise de impacto estratégico.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}