import React, { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, BarChart2, MessageSquare, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import NotesPanel from '@/components/hierarchy/NotesPanel';
import CreateAssessmentDialog from '@/components/hierarchy/CreateAssessmentDialog';
import FalRadarChart from '@/components/fal/FalRadarChart';
import FalDimensionTable from '@/components/fal/FalDimensionTable';
import StatusBadge from '@/components/shared/StatusBadge';
import ArchiveDeleteControls from '@/components/shared/ArchiveDeleteControls';
import EditEntityDialog from '@/components/assessments/EditEntityDialog';
import { format } from 'date-fns';
import { PencilIcon } from 'lucide-react';
import NewDiagnosisTypePicker from '@/components/financial/NewDiagnosisTypePicker';
import CreateFinancialDiagnosisDialog from '@/components/financial/CreateFinancialDiagnosisDialog.jsx';

const LEVEL_STYLE = {
  Crítico: 'bg-red-100 text-red-700',
  Básico: 'bg-amber-100 text-amber-700',
  Estruturado: 'bg-blue-100 text-blue-700',
  Avançado: 'bg-emerald-100 text-emerald-700',
};

const UNIT_ICONS = {
  Fazenda: '🌾', Revenda: '🏪', Indústria: '🏭', Armazém: '🏗️',
  Logística: '🚛', Administrativa: '🏢', Outro: '📍',
};

export default function UnitDetail() {
  const params = new URLSearchParams(window.location.search);
  const unitId = params.get('id');
  const { user, methodVersion } = useTenant();
  const navigate = useNavigate();
  const [tab, setTab] = useState('assessments');
  const [assessmentDialog, setAssessmentDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [typePicker, setTypePicker] = useState(false);
  const [financialDialog, setFinancialDialog] = useState(false);

  const tabContentRef = useRef(null);
  const goToTab = useCallback((key) => {
    setTab(key);
    setTimeout(() => {
      if (!tabContentRef.current) return;
      let el = tabContentRef.current;
      let scrollParent = null;
      while (el.parentElement) {
        el = el.parentElement;
        const { overflow, overflowY } = window.getComputedStyle(el);
        if (/(auto|scroll)/.test(overflow + overflowY)) { scrollParent = el; break; }
      }
      if (scrollParent) {
        const targetTop = tabContentRef.current.getBoundingClientRect().top
          - scrollParent.getBoundingClientRect().top
          + scrollParent.scrollTop - 16;
        scrollParent.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else {
        tabContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }, []);

  const { data: unit } = useQuery({
    queryKey: ['unit', unitId],
    queryFn: () => base44.entities.OperationalUnit.get(unitId),
    enabled: !!unitId,
  });

  const { data: company } = useQuery({
    queryKey: ['company', unit?.company_id],
    queryFn: () => base44.entities.Company.get(unit.company_id),
    enabled: !!unit?.company_id,
  });

  const { data: unitAssessments = [] } = useQuery({
    queryKey: ['unit-assessments', unitId],
    queryFn: () => base44.entities.Assessment.filter({ target_type: 'unit', target_id: unitId }, '-created_date', 20),
    enabled: !!unitId,
  });

  // Get latest snapshot for this unit
  const latestAssessment = unitAssessments[0];
  const { data: snapshots = [] } = useQuery({
    queryKey: ['unit-snapshot', latestAssessment?.id],
    queryFn: () => base44.entities.FalDiagnosticSnapshot.filter({ assessment_id: latestAssessment.id }, '-computed_at', 1),
    enabled: !!latestAssessment?.id,
  });
  const latestSnap = snapshots[0] || null;

  async function checkUnitDependencies() {
    const [assessments, snapshots] = await Promise.all([
      base44.entities.Assessment.filter({ target_type: 'unit', target_id: unitId }, 'created_date', 1),
      base44.entities.FalDiagnosticSnapshot.filter({ target_type: 'unit', target_id: unitId }, 'created_date', 1),
    ]);
    const reasons = [];
    if (assessments.length > 0) reasons.push(`${assessments.length} diagnóstico(s) vinculado(s)`);
    if (snapshots.length > 0) reasons.push(`${snapshots.length} resultado(s) de diagnóstico`);
    return { ok: reasons.length === 0, reasons };
  }

  if (!unit) return <div className="p-8 text-center text-slate-400">Carregando...</div>;

  const TABS = [
    { key: 'assessments', label: 'Diagnósticos', icon: FileText },
    { key: 'results', label: 'Último Resultado', icon: BarChart2 },
    { key: 'notes', label: 'Notas', icon: MessageSquare },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6 flex-wrap">
        {company?.group_id && (
          <Link to={createPageUrl('Groups')} className="hover:text-slate-700">Grupos</Link>
        )}
        {company?.group_id && <span>/</span>}
        {company && (
          <>
            <Link to={createPageUrl(`CompanyDetail?id=${company.id}`)} className="hover:text-slate-700">{company.name}</Link>
            <span>/</span>
          </>
        )}
        <span className="text-slate-700">{unit.name}</span>
      </div>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl">
          {UNIT_ICONS[unit.unit_type] || '📍'}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{unit.name}</h1>
          <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">{unit.unit_type}</span>
            {unit.location_state && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{unit.location_state}</span>
            )}
            {!unit.is_active && <Badge className="bg-slate-100 text-slate-500 text-xs">Inativa</Badge>}
          </div>
          {latestSnap && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-lg font-bold text-slate-900">{latestSnap.overall_score?.toFixed(2)}</span>
              <Badge className={LEVEL_STYLE[latestSnap.overall_level] || 'bg-slate-100 text-slate-600'}>
                {latestSnap.overall_level}
              </Badge>
            </div>
          )}
          </div>
          <div className="flex gap-2">
          <Button onClick={() => setEditDialog(true)} size="sm" variant="outline" className="gap-1.5 border-slate-300 text-slate-600 hover:bg-slate-50">
            <PencilIcon className="w-3.5 h-3.5" /> Editar
          </Button>
          <Button onClick={() => setTypePicker(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
            <Plus className="w-3.5 h-3.5" /> Diagnóstico da Unidade
          </Button>
          </div>
          </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => goToTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Âncora de scroll */}
      <div ref={tabContentRef} style={{ scrollMarginTop: '8px' }} />

      {tab === 'assessments' && (
        <div className="space-y-2">
          {unitAssessments.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum diagnóstico para esta unidade</p>
            </div>
          ) : unitAssessments.map(a => (
            <Link key={a.id} to={createPageUrl(`AssessmentDetail?id=${a.id}`)}>
              <Card className="border-0 shadow-sm fal-card-hover cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-slate-400">{a.created_date ? format(new Date(a.created_date), 'dd/MM/yyyy') : ''}</p>
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {tab === 'results' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            {latestSnap ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-slate-900">{latestSnap.overall_score?.toFixed(2)}</span>
                  <Badge className={LEVEL_STYLE[latestSnap.overall_level] || 'bg-slate-100 text-slate-600'}>
                    {latestSnap.overall_level}
                  </Badge>
                  <span className="text-xs text-slate-400 ml-2">
                    Calculado em {new Date(latestSnap.computed_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <FalRadarChart radarPoints={latestSnap.radar_points} />
                <FalDimensionTable dimensionScores={latestSnap.dimension_scores} />
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum resultado disponível</p>
                <p className="text-xs mt-1">Execute um diagnóstico e calcule o resultado</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'notes' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <NotesPanel tenantId={user?.tenant_id} entityType="unit" entityId={unitId} currentUser={user} />
          </CardContent>
        </Card>
      )}

      <EditEntityDialog
       open={editDialog}
       onOpenChange={setEditDialog}
       entityType="unit"
       entity={unit}
       onSaved={() => {}}
      />

      {assessmentDialog && (
        <CreateAssessmentDialog
          open={assessmentDialog}
          onClose={() => setAssessmentDialog(false)}
          targetType="unit"
          targetId={unitId}
          groupId={company?.group_id}
          companyId={unit.company_id}
          unitId={unitId}
          tenantId={user?.tenant_id || unit?.tenant_id}
          methodVersionId={methodVersion?.id}
          userName={user?.email}
          targetName={unit?.name}
          onCreated={(a) => window.location.href = createPageUrl(`AssessmentDetail?id=${a.id}`)}
        />
      )}

      <NewDiagnosisTypePicker
        open={typePicker}
        onClose={() => setTypePicker(false)}
        onSelectFal={() => { setTypePicker(false); setAssessmentDialog(true); }}
        onSelectFinancial={() => { setTypePicker(false); setFinancialDialog(true); }}
      />

      {financialDialog && (
        <CreateFinancialDiagnosisDialog
          open={financialDialog}
          onClose={(created) => {
            setFinancialDialog(false);
            if (created?.id) navigate(createPageUrl(`FinancialDiagnosisDetail?id=${created.id}`));
          }}
          tenantId={user?.tenant_id || unit?.tenant_id}
          scopeLevel="unit"
          groupId={company?.group_id}
          companyId={unit?.company_id}
          unitId={unitId}
          defaultTitle={`Diagnóstico Financeiro — ${unit?.name}`}
        />
      )}

      {/* Danger Zone */}
      <div className="mt-10">
        <ArchiveDeleteControls
          entityType="unit"
          entityId={unitId}
          entityName={unit.name}
          isArchived={unit.is_active === false}
          checkDependencies={checkUnitDependencies}
          onArchived={() => window.location.reload()}
          onDeleted={() => navigate(createPageUrl(company ? `CompanyDetail?id=${unit.company_id}` : 'Groups'))}
        />
      </div>
    </div>
  );
}