/**
 * FinancialIndicatorsToday
 * Tela HOJE — grade de cards com borda, valor atual,
 * comparativo vs. período anterior e badge de status.
 */
import React from "react";
import FinancialIndicatorCell from "./FinancialIndicatorCell";
import { chunkArray } from "./financialIndicatorUtils";

const DESKTOP_COLUMNS = 5;

/**
 * @param {Object} props
 * @param {any=} props.groupedIndicators
 * @param {any=} props.snapshotsByIndicator
 * @param {any=} props.onHelp
 * @param {any=} props.onChart
 */
export default function FinancialIndicatorsToday({
  groupedIndicators,
  snapshotsByIndicator,
  onHelp,
  onChart
}) {
  if (!groupedIndicators?.length) {
    return (
      <div className="py-8 text-sm text-slate-500">
        Nenhum indicador financeiro disponível para exibição.
      </div>);
  }

  return (
    <div className="space-y-3 bg-transparent">
      {groupedIndicators.map((group) => {
        const rows = chunkArray(group.indicators, DESKTOP_COLUMNS);

        return (
          <section key={group.group} className="pb-1">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#3D9A94]">
              {group.groupLabel}
            </h3>

            <div className="w-full">
              {rows.map((row, rowIndex) => (
                <div
                  key={`${group.group}-${rowIndex}`}
                  className={`grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-5${rowIndex > 0 ? " mt-2" : ""}`}
                >
                  {row.map((indicator) => {
                    const snapshots =
                      snapshotsByIndicator.get(indicator.key) || [];
                    const currentSnapshot = snapshots[0];
                    const previousSnapshot = snapshots[1];
                    return (
                      <FinancialIndicatorCell
                        key={indicator.key}
                        indicator={indicator}
                        snapshot={currentSnapshot}
                        previousSnapshot={previousSnapshot}
                        onHelp={onHelp}
                        onChart={onChart}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}