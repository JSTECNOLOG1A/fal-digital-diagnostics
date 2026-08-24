/**
 * FinancialIndicatorsHistory
 * Tela HISTÓRICO — tabela full scope por grupos, no padrão Status Invest.
 * Coluna ATUAL destacada em verde. Períodos históricos em colunas.
 */
import React from "react";
import { HelpCircle, LineChart } from "lucide-react";
import {
  formatIndicatorValue,
  getSnapshotPeriodKey,
} from "./financialIndicatorUtils";

/**
 * @param {Object} props
 * @param {any=} props.groupedIndicators
 * @param {any=} props.snapshotsByIndicator
 * @param {any=} props.periods
 * @param {any=} props.onHelp
 * @param {any=} props.onChart
 */
export default function FinancialIndicatorsHistory({
  groupedIndicators,
  snapshotsByIndicator,
  periods,
  onHelp,
  onChart,
}) {
  if (!groupedIndicators?.length) {
    return (
      <div className="py-8 text-sm text-slate-500">
        Nenhum indicador financeiro disponível para histórico.
      </div>
    );
  }

  if (!periods?.length) {
    return (
      <div className="py-8 text-sm text-slate-500">
        Histórico insuficiente para os indicadores financeiros.
      </div>
    );
  }

  // "Atual" = período mais recente; colunas históricas = períodos anteriores.
  // Evita duplicação entre a coluna ATUAL em destaque e a primeira coluna histórica.
  const currentPeriod = periods[0];
  const historicalPeriods = periods.slice(1);

  return (
    <div className="space-y-4 bg-transparent">
      {groupedIndicators.map((group) => (
        <section key={group.group}>
          <div className="overflow-x-auto bg-white">
            <table className="table-fixed border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="w-64 px-2 py-0.5 text-left font-bold uppercase tracking-wide text-[#3D9A94]">
                    {group.groupLabel}
                  </th>
                  <th className="w-8 px-1 py-0.5" />
                  <th className="w-8 px-1 py-0.5" />
                  <th className="w-24 bg-[#00856F] px-2 py-0.5 text-right font-bold uppercase text-white">
                    Atual
                  </th>
                  {historicalPeriods.map((period) => (
                    <th
                      key={period.key}
                      className="w-24 px-2 py-0.5 text-right font-bold text-slate-800"
                    >
                      {period.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {group.indicators.map((indicator) => {
                  const snapshots =
                    snapshotsByIndicator.get(indicator.key) || [];
                  const currentSnapshot =
                    snapshots.find(
                      (item) => getSnapshotPeriodKey(item) === currentPeriod.key
                    ) || snapshots[0];

                  return (
                    <tr
                      key={indicator.key}
                      className="border-b border-slate-200 hover:bg-slate-50"
                    >
                      <td className="px-2 py-0.5 text-left">
                        <button
                          type="button"
                          onClick={() => onHelp?.(indicator)}
                          className="whitespace-normal text-left font-normal uppercase leading-tight text-[#00547A] underline underline-offset-2 decoration-slate-300 hover:decoration-[#00547A]"
                        >
                          {indicator.label}
                        </button>
                      </td>
                      <td className="px-1 py-0.5 text-center">
                        <button
                          type="button"
                          onClick={() => onHelp?.(indicator)}
                          className="text-[#C2410C] hover:opacity-80"
                          title="Ajuda"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      </td>
                      <td className="px-1 py-0.5 text-center">
                        <button
                          type="button"
                          onClick={() => onChart?.(indicator)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-[#00856F] text-[#00856F] hover:bg-emerald-50"
                          title="Ver histórico"
                        >
                          <LineChart className="h-3.5 w-3.5" />
                        </button>
                      </td>
                      <td className="bg-emerald-50 px-2 py-0.5 text-right font-semibold tabular-nums text-slate-900">
                        {formatIndicatorValue(
                          currentSnapshot?.value,
                          indicator
                        )}
                      </td>
                      {historicalPeriods.map((period) => {
                        const snapshot = snapshots.find(
                          (item) => getSnapshotPeriodKey(item) === period.key
                        );
                        return (
                          <td
                            key={period.key}
                            className="px-2 py-0.5 text-right tabular-nums text-slate-900"
                          >
                            {formatIndicatorValue(snapshot?.value, indicator)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}