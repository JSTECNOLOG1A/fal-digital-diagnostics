/**
 * FinancialIndicatorChartDialog
 * Modal com o gráfico de evolução de um indicador.
 * Não embutido na célula — aberto via ícone.
 */
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  formatIndicatorValue,
  getSnapshotPeriodLabel,
} from "./financialIndicatorUtils";

/**
 * @param {Object} props
 * @param {any=} props.indicator
 * @param {any=} props.snapshots
 * @param {any=} props.open
 * @param {any=} props.onOpenChange
 */
export default function FinancialIndicatorChartDialog({
  indicator,
  snapshots = [],
  open,
  onOpenChange,
}) {
  if (!indicator) return null;

  const data = snapshots
    .slice()
    .reverse()
    .map((snapshot) => ({
      period: getSnapshotPeriodLabel(snapshot),
      value:
        snapshot?.value === null ||
        snapshot?.value === undefined ||
        Number.isNaN(Number(snapshot.value))
          ? null
          : Number(snapshot.value),
    }))
    .filter((item) => item.value !== null);

  const hasEnoughHistory = data.length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[#00547A]">
            Evolução — {indicator.fullLabel}
          </DialogTitle>
        </DialogHeader>

        {!hasEnoughHistory ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Histórico insuficiente para este indicador.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis
                  width={72}
                  tickFormatter={(v) => {
                    const n = Number(v);
                    if (isNaN(n)) return "";
                    if (indicator.format === "percent") {
                      return `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
                    }
                    const abs = Math.abs(n);
                    if (abs >= 1e9) return `${(n / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}Bi`;
                    if (abs >= 1e6) return `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}Mi`;
                    if (abs >= 1e3) return `${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
                    return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
                  }}
                />
                <Tooltip
                  formatter={(value) => [
                    formatIndicatorValue(value, indicator),
                    indicator.label,
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#00856F"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}