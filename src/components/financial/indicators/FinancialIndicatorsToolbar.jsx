/**
 * FinancialIndicatorsToolbar
 * Botões segmentados sem card, sem sombra.
 * [HOJE] [HISTÓRICO]  |  [ANUAL] [TRIMESTRAL] [MENSAL]
 */
import React from "react";
import { BarChart3, Table2 } from "lucide-react";

const viewOptions = [
{ key: "today", label: "HOJE", icon: Table2 },
{ key: "history", label: "HISTÓRICO", icon: BarChart3 }];


const periodOptions = [
{ key: "annual", label: "ANUAL" },
{ key: "quarterly", label: "TRIMESTRAL" },
{ key: "monthly", label: "MENSAL" }];


/**
 * @param {Object} props
 * @param {any=} props.active
 * @param {any=} props.disabled
 * @param {any=} props.children
 * @param {any=} props.onClick
 * @param {any=} props.variant
 * @param {any=} props.isFirst
 * @param {any=} props.isLast
 */
function SegmentedButton({
  active,
  disabled,
  children,
  onClick,
  variant = "blue",
  isFirst,
  isLast
}) {
  const activeClass =
  variant === "green" ?
  "border-[#00856F] bg-[#00856F] text-white" :
  "border-[#00547A] bg-[#00547A] text-white";

  const inactiveClass =
  variant === "green" ?
  "border-[#00856F] bg-white text-[#00856F] hover:bg-emerald-50" :
  "border-[#00547A] bg-white text-[#00547A] hover:bg-sky-50";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
      "h-9 border px-4 text-xs font-bold uppercase tracking-wide transition",
      active ? activeClass : inactiveClass,
      disabled ? "cursor-not-allowed opacity-40" : "",
      isFirst ? "rounded-l-md" : "-ml-px",
      isLast ? "rounded-r-md" : ""].
      join(" ")}>
      
      {children}
    </button>);

}

/**
 * @param {Object} props
 * @param {any=} props.viewMode
 * @param {any=} props.onViewModeChange
 * @param {any=} props.periodMode
 * @param {any=} props.onPeriodModeChange
 * @param {any=} props.availablePeriodModes
 * @param {any=} props.company
 * @param {any=} props.referenceDate
 */
export default function FinancialIndicatorsToolbar({
  viewMode,
  onViewModeChange,
  periodMode,
  onPeriodModeChange,
  availablePeriodModes,
  company,
  referenceDate
}) {
  const hasAnyPeriodMode = availablePeriodModes && availablePeriodModes.size > 0;

  function isPeriodDisabled(key) {
    if (!hasAnyPeriodMode) return false;
    return !availablePeriodModes.has(key);
  }

  return (
    <div className="flex flex-col gap-3 border-b border-slate-300 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="text-2xl font-extrabold uppercase tracking-tight text-[hsl(var(--chart-3))]">INDICADORES FINANCEIROS

        </h2>
        {(company?.name || referenceDate) &&
        <p className="mt-1 text-sm text-slate-600 hidden">
            Método FAL
            {company?.name ? ` • ${company.name}` : ""}
            {referenceDate ? ` • Referência: ${referenceDate}` : ""}
          </p>
        }
      </div>

      <div className="flex flex-wrap items-center gap-4 lg:justify-end">
        <div className="inline-flex">
          {viewOptions.map((option, index) => {
            const Icon = option.icon;
            return (
              <SegmentedButton
                key={option.key}
                active={viewMode === option.key}
                onClick={() => onViewModeChange(option.key)}
                isFirst={index === 0}
                isLast={index === viewOptions.length - 1}>
                
                <span className="inline-flex items-center gap-2">
                  {option.label}
                  <Icon className="h-4 w-4" />
                </span>
              </SegmentedButton>);

          })}
        </div>

        <div className="inline-flex">
          {periodOptions.map((option, index) =>
          <SegmentedButton
            key={option.key}
            active={periodMode === option.key}
            disabled={isPeriodDisabled(option.key)}
            onClick={() => onPeriodModeChange(option.key)}
            variant="green"
            isFirst={index === 0}
            isLast={index === periodOptions.length - 1}>
            
              {option.label}
            </SegmentedButton>
          )}
        </div>
      </div>
    </div>);

}