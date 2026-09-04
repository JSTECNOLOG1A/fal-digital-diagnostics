/**
 * FinancialIndicatorsPanel
 * Orquestra a área de Indicadores Financeiros no padrão Status Invest.
 * Duas visões: HOJE (valores atuais por grupo) e HISTÓRICO (tabela comparativa).
 * Cada indicador pode abrir um drawer com fórmula, achados, recomendações,
 * ações propostas e formulário de criação de tarefa (incursão no plano de ação).
 *
 * Kanitz permanece em aba própria — não aparece aqui.
 */
import React, { useState, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { financialKey } from "@/lib/query-client";
import { useCurrentFinancialOutputScope } from "@/lib/hooks/useCurrentFinancialOutputScope";
import { TrendingUp } from "lucide-react";
import FinancialIndicatorsToolbar from "./FinancialIndicatorsToolbar";
import FinancialIndicatorsToday from "./FinancialIndicatorsToday";
import FinancialIndicatorsHistory from "./FinancialIndicatorsHistory";
import FinancialIndicatorsInsights from "./FinancialIndicatorsInsights";
import FinancialIndicatorHelpDrawer from "./FinancialIndicatorHelpDrawer";
import FinancialIndicatorChartDialog from "./FinancialIndicatorChartDialog";
import { financialIndicatorRegistry } from "./financialIndicatorRegistry";
import {
  getAvailablePeriodModes,
  getGroupedIndicators,
  getHistoricalPeriods,
  normalizeSnapshotsByIndicator,
} from "./financialIndicatorUtils";

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.periodFilter
 * @param {any=} props.setPeriodFilter
 * @param {any=} props.tenantId
 * @param {any=} props.diagnosis
 */
export default function FinancialIndicatorsPanel({
  diagnosisId,
  periodFilter,
  setPeriodFilter,
  tenantId,
  diagnosis,
}) {
  const [viewMode, setViewMode] = useState("today");
  const [drawerIndicator, setDrawerIndicator] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chartIndicator, setChartIndicator] = useState(null);

  const periodMode = periodFilter || "annual";

  const { data: currentScope } = useCurrentFinancialOutputScope(diagnosisId, tenantId);
  // ── Fetch indicator snapshots ──
  const { data: rawIndicators = [], isLoading } = useQuery({
    queryKey: [...financialKey(tenantId, diagnosisId, "indicators"), currentScope?.snapshot_id, currentScope?.processing_run_id],
    queryFn: () =>
      base44.entities.FinancialIndicatorSnapshot.filter(
        { financial_diagnosis_id: diagnosisId, publication_status: 'active' },
        "-period",
        10000
      ),
    enabled: !!currentScope?.processing_run_id,
    placeholderData: keepPreviousData,
  });
  // Multi-entidade: excluir snapshots individuais quando há séries preparadas
  const hasPreparedSeries = rawIndicators.some((i) =>
    ["parent", "consolidated", "combined"].includes(i.dataset_scope)
  );
  const indicators = hasPreparedSeries
    ? rawIndicators.filter((i) => i.dataset_scope !== "individual")
    : rawIndicators;

  // ── Fetch findings ──
  const { data: findings = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, "findings"),
    queryFn: () =>
      base44.entities.FinancialFinding.filter(
        { financial_diagnosis_id: diagnosisId, tenant_id: tenantId },
        "-created_date",
        500
      ),
    enabled: !!diagnosisId && !!tenantId,
  });

  // ── Fetch recommendations ──
  const { data: recommendations = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, "recommendations"),
    queryFn: () =>
      base44.entities.FinancialRecommendation.filter(
        { financial_diagnosis_id: diagnosisId, tenant_id: tenantId },
        "-created_date",
        500
      ),
    enabled: !!diagnosisId && !!tenantId,
  });

  // ── Fetch proposals ──
  const { data: proposals = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, "action-proposals"),
    queryFn: () =>
      base44.entities.FinancialActionProposal.filter(
        { financial_diagnosis_id: diagnosisId, tenant_id: tenantId },
        "-created_date",
        500
      ),
    enabled: !!diagnosisId && !!tenantId,
  });

  // ── Fetch action plans (for task creation) ──
  const { data: actionPlans = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, "action-plans"),
    queryFn: async () => {
      const filters = [];
      if (diagnosis?.group_id)
        filters.push(
          base44.entities.ActionPlan.filter(
            { group_id: diagnosis.group_id, tenant_id: tenantId },
            "-created_date",
            50
          )
        );
      if (diagnosis?.company_id)
        filters.push(
          base44.entities.ActionPlan.filter(
            { company_id: diagnosis.company_id, tenant_id: tenantId },
            "-created_date",
            50
          )
        );
      if (diagnosis?.unit_id)
        filters.push(
          base44.entities.ActionPlan.filter(
            { unit_id: diagnosis.unit_id, tenant_id: tenantId },
            "-created_date",
            50
          )
        );
      if (filters.length === 0) return [];
      const results = await Promise.all(filters);
      const map = new Map();
      for (const list of results) for (const p of list) map.set(p.id, p);
      return [...map.values()];
    },
    enabled: !!diagnosisId && !!tenantId && !!diagnosis,
  });

  // ── Derived data ──
  const availablePeriodModes = useMemo(
    () => getAvailablePeriodModes(indicators),
    [indicators]
  );

  const groupedIndicators = useMemo(
    () => getGroupedIndicators(financialIndicatorRegistry),
    []
  );

  const snapshotsByIndicator = useMemo(
    () =>
      normalizeSnapshotsByIndicator(
        indicators,
        financialIndicatorRegistry,
        { financialDiagnosisId: diagnosisId, periodMode }
      ),
    [indicators, diagnosisId, periodMode]
  );

  const periods = useMemo(
    () => getHistoricalPeriods(snapshotsByIndicator),
    [snapshotsByIndicator]
  );

  // ── Loading / Empty ──
  if (isLoading) {
    return (
      <p className="text-sm text-slate-400 py-8 text-center">
        Carregando indicadores...
      </p>
    );
  }

  if (indicators.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Indicadores ainda não disponíveis.</p>
      </div>
    );
  }

  const openDrawer = (indicator) => {
    setDrawerIndicator(indicator);
    setDrawerOpen(true);
  };

  // Deriva nome/referência para o subtítulo
  const company = { name: diagnosis?.title };
  const referenceDate =
    diagnosis?.data_base_fechamento || diagnosis?.last_period || null;

  return (
    <div className="space-y-5 bg-transparent">
      <FinancialIndicatorsToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        periodMode={periodMode}
        onPeriodModeChange={(mode) => setPeriodFilter?.(mode)}
        availablePeriodModes={availablePeriodModes}
        company={company}
        referenceDate={referenceDate}
      />

      {viewMode === "today" && (
        <FinancialIndicatorsToday
          groupedIndicators={groupedIndicators}
          snapshotsByIndicator={snapshotsByIndicator}
          onHelp={openDrawer}
          onChart={setChartIndicator}
        />
      )}

      {viewMode === "history" && (
        <FinancialIndicatorsHistory
          groupedIndicators={groupedIndicators}
          snapshotsByIndicator={snapshotsByIndicator}
          periods={periods}
          onHelp={openDrawer}
          onChart={setChartIndicator}
        />
      )}

      <FinancialIndicatorsInsights diagnosisId={diagnosisId} tenantId={tenantId} />

      <FinancialIndicatorHelpDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        indicator={drawerIndicator}
        diagnosis={diagnosis}
        diagnosisId={diagnosisId}
        tenantId={tenantId}
        findings={findings}
        recommendations={recommendations}
        proposals={proposals}
        actionPlans={actionPlans}
      />

      <FinancialIndicatorChartDialog
        indicator={chartIndicator}
        snapshots={
          chartIndicator
            ? snapshotsByIndicator.get(chartIndicator.key) || []
            : []
        }
        open={!!chartIndicator}
        onOpenChange={(open) => {
          if (!open) setChartIndicator(null);
        }}
      />
    </div>
  );
}