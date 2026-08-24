/**
 * FinancialIndicatorCell
 * Célula da tela HOJE — card com borda, valor atual,
 * comparativo vs. período anterior (setas) e badge de status.
 */
import React from "react";
import { HelpCircle, LineChart, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { formatIndicatorValue, getSnapshotPeriodLabel, evaluateBenchmark } from "./financialIndicatorUtils";

const SEVERITY_MAP = {
  ok: { label: "Saudável", bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
  atencao: { label: "Atenção", bg: "#fef3c7", text: "#B45309", border: "#FCD34D" },
  relevante: { label: "Relevante", bg: "#fef3c7", text: "#B45309", border: "#FCD34D" },
  critico: { label: "Crítico", bg: "#feecec", text: "#B42318", border: "#FDA29B" },
};

function computeVariation(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatVariation(v) {
  const n = Number(v);
  if (isNaN(n)) return null;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

/**
 * @param {Object} props
 * @param {any=} props.indicator
 * @param {any=} props.snapshot
 * @param {any=} props.previousSnapshot
 * @param {any=} props.onHelp
 * @param {any=} props.onChart
 */
export default function FinancialIndicatorCell({
  indicator,
  snapshot,
  previousSnapshot,
  onHelp,
  onChart,
}) {
  const value = snapshot?.value;
  const currentValue = value != null ? Number(value) : null;
  const previousValue =
    snapshot?.previous_value != null
      ? Number(snapshot.previous_value)
      : previousSnapshot?.value != null
        ? Number(previousSnapshot.value)
        : null;

  const variation = computeVariation(currentValue, previousValue);
  const variationLabel = variation != null ? formatVariation(variation) : null;
  const previousPeriodLabel = previousSnapshot
    ? getSnapshotPeriodLabel(previousSnapshot)
    : null;

  const isPositive = variation != null && variation > 0;
  const isNegative = variation != null && variation < 0;
  const isNeutral = variation != null && variation === 0;

  // Status: prioriza severity do backend; se ausente, deriva do benchmark de mercado
  const backendSev = snapshot?.severity ? SEVERITY_MAP[snapshot.severity] : null;
  const benchmarkSev = evaluateBenchmark(value, indicator);
  const sev = backendSev || benchmarkSev;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2">
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => onHelp?.(indicator)}
          className="text-left text-[11px] font-semibold uppercase leading-3 tracking-wide text-[#00547A] hover:underline"
        >
          {indicator.label}
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onChart?.(indicator)}
            className="flex h-5 w-5 items-center justify-center rounded-sm border border-[#00856F] text-[#00856F] hover:bg-emerald-50"
            title="Ver histórico"
          >
            <LineChart className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onHelp?.(indicator)}
            className="text-[#C2410C] hover:opacity-80"
            title="Ajuda"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="text-base font-bold leading-tight tabular-nums text-slate-900">
        {formatIndicatorValue(value, indicator)}
      </div>

      <div className="flex items-center justify-between gap-2">
        {variationLabel && previousPeriodLabel ? (
          <div className="flex items-center gap-1 text-[11px] font-medium">
            {isPositive && <ArrowUp className="h-3 w-3 text-emerald-700" />}
            {isNegative && <ArrowDown className="h-3 w-3 text-red-600" />}
            {isNeutral && <Minus className="h-3 w-3 text-slate-400" />}
            <span
              className={
                isPositive
                  ? "text-emerald-700"
                  : isNegative
                    ? "text-red-600"
                    : "text-slate-500"
              }
            >
              {variationLabel}
            </span>
            <span className="text-slate-400">vs. {previousPeriodLabel}</span>
          </div>
        ) : (
          <span />
        )}

        {sev && (
          <span
            className="inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
            style={{ background: sev.bg, color: sev.text, borderColor: sev.border }}
          >
            {sev.label}
          </span>
        )}
      </div>
    </div>
  );
}