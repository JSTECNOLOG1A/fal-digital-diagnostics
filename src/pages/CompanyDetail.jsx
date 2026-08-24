import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Building2, MapPin, Factory, Plus, ArrowRight, BarChart2, MessageSquare, FileText, BarChart3 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import NotesPanel from '@/components/hierarchy/NotesPanel';
import AggregateResultPanel from '@/components/hierarchy/AggregateResultPanel';
import { invalidateStructureQueries } from '@/lib/query-client';
import CreateAssessmentDialog from '@/components/hierarchy/CreateAssessmentDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import ArchiveDeleteControls from '@/components/shared/ArchiveDeleteControls';
import EditEntityDialog from '@/components/assessments/EditEntityDialog';
import { format } from 'date-fns';
import { PencilIcon } from 'lucide-react';
import NewDiagnosisTypePicker from '@/components/financial/NewDiagnosisTypePicker';
import CreateFinancialDiagnosisDialog from '@/components/financial/CreateFinancialDiagnosisDialog.jsx';
import { DIAGNOSIS_STATUS_CONFIG } from '@/lib/financialConstants';
import PermissionGuard from '@/components/shared/PermissionGuard';

const UNIT_TYPES = ['Fazenda', 'Revenda', 'Indústria', 'Armazém', 'Logística', 'Administrativa', 'Outro'];

const UNIT_ICONS = {
  Fazenda: '🌾', Revenda: '🏪', Indústria: '🏭', Armazém: '🏗️',
  Logística: '🚛', Administrativa: '🏢', Outro: '📍',
};

export default function CompanyDetail() {
  const params = new URLSearchParams(window.location.search);
  const companyId = params.get('id');
  const { user, methodVersion } = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState('units');
  const [unitDialog, setUnitDialog] = useState(false);
  const [assessmentDialog, setAssessmentDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [typePicker, setTypePicker] = useState(false);
  const [financialDialog, setFinancialDialog] = useState(false);
  const [unitForm, setUnitForm] = useState({ name: '', unit_type: 'Fazenda', location_state: '' });

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

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => base44.entities.Company.get(companyId),
    enabled: !!companyId,
  });

  const { data: group } = useQuery({
    queryKey: ['group', company?.group_id],
    queryFn: () => base44.entities.Group.get(company.group_id),
    enabled: !!company?.group_id,
  });

  const { data: unitsRaw = [] } = useQuery({
    queryKey: ['units', companyId],
    queryFn: () => base44.entities.OperationalUnit.filter({ company_id: companyId }, 'name', 200),
    enabled: !!companyId,
  });
  const units = unitsRaw.filter(u => u.is_active !== false);

  const { data: companyAssessments = [] } = useQuery({
    queryKey: ['company-assessments', companyId],
    queryFn: () => base44.entities.Assessment.filter({ target_type: 'company', target_id: companyId }, '-created_date', 20),
    enabled: !!companyId,
  });

  const { data: financialDiagnoses = [] } = useQuery({
    queryKey: ['financial-diagnoses', companyId],
    queryFn: () => base44.entities.FinancialDiagnosis.filter({ company_id: companyId }, '-created_date', 20),
    enabled: !!companyId,
  });

  const createUnitMutation = useMutation({
    mutationFn: () => base44.entities.OperationalUnit.create({
      ...unitForm,
      tenant_id: user?.tenant_id || company?.tenant_id,
      company_id: companyId,
      is_active: true,
    }),
    onSuccess: () => {
      invalidateStructureQueries(queryClient, user?.tenant_id || company?.tenant_id, 'unit');
      setUnitDialog(false);
      setUnitForm({ name: '', unit_type: 'Fazenda', location_state: '' });
    },
  });

  async function checkCompanyDependencies() {
    const [units, assessments, snapshots] = await Promise.all([
      base44.entities.OperationalUnit.filter({ company_id: companyId }, 'created_date', 1),
      base44.entities.Assessment.filter({ target_type: 'company', target_id: companyId }, 'created_date', 1),
      base44.entities.FalDiagnosticSnapshot.filter({ target_type: 'company', target_id: companyId }, 'created_date', 1),
    ]);
    const reasons = [];
    if (units.length > 0) reasons.push(`${units.length} unidade(s) operacional(is) vinculada(s)`);
    if (assessments.length > 0) reasons.push(`${assessments.length} diagnóstico(s) vinculado(s)`);
    if (snapshots.length > 0) reasons.push(`${snapshots.length} resultado(s) de diagnóstico`);
    return { ok: reasons.length === 0, reasons };
  }

  if (!company) return <div className="p-8 text-center text-slate-400">Carregando...</div>;

  const TABS = [
    { key: 'units', label: 'Unidades', icon: Factory },
    { key: 'assessments', label: 'Diagnósticos', icon: FileText },
    { key: 'results', label: 'Resultados Consolidados', icon: BarChart2 },
    { key: 'notes', label: 'Notas', icon: MessageSquare },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        {group && (
          <>
            <Link to={createPageUrl('Groups')} className="hover:text-slate-700">Grupos</Link>
            <span>/</span>
            <Link to={createPageUrl(`GroupDetail?id=${group.id}`)} className="hover:text-slate-700">{group.name}</Link>
            <span>/</span>
          </>
        )}
        {!group && <Link to={createPageUrl('Groups')} className="hover:text-slate-700"><ArrowLeft className="w-4 h-4 inline" /> Voltar</Link>}
        <span className="text-slate-700">{company.name}</span>
      </div>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Building2 className="w-7 h-7 text-blue-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
          <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
            {company.sector && <span>{company.sector}</span>}
            {company.tax_id && <span className="font-mono">{company.tax_id}</span>}
            {company.company_size && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">{company.company_size}</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{units.length} unidade(s) operacional(is)</p>
        </div>
         <div className="flex gap-2">
           <Button onClick={() => setEditDialog(true)} size="sm" variant="outline" className="gap-1.5 border-slate-300 text-slate-600 hover:bg-slate-50">
             <PencilIcon className="w-3.5 h-3.5" /> Editar
           </Button>
           <Button onClick={() => setTypePicker(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
             <Plus className="w-3.5 h-3.5" /> Diagnóstico da Empresa
           </Button>
         </div>
        </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
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

      {tab === 'units' && (
        <div>
          <div className="flex justify-end mb-4">
            <PermissionGuard area="company">
            <Button onClick={() => setUnitDialog(true)} size="sm" variant="outline" className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Nova Unidade
            </Button>
            </PermissionGuard>
          </div>
          {units.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Factory className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma unidade operacional cadastrada</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {units.map(u => (
                <Link key={u.id} to={createPageUrl(`UnitDetail?id=${u.id}`)}>
                  <Card className="border-0 shadow-sm fal-card-hover cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 text-lg">
                        {UNIT_ICONS[u.unit_type] || '📍'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-900 truncate">{u.name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{u.unit_type}</span>
                          {u.location_state && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{u.location_state}</span>}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'assessments' && (
        <div className="space-y-4">
          {/* Diagnósticos FAL tradicionais */}
          {companyAssessments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Diagnósticos FAL™</p>
              <div className="space-y-2">
                {companyAssessments.map(a => (
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
            </div>
          )}

          {/* Diagnósticos Financeiros */}
          {financialDiagnoses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Diagnósticos Financeiros</p>
              <div className="space-y-2">
                {financialDiagnoses.map(d => {
                  const cfg = DIAGNOSIS_STATUS_CONFIG[d.status] || { label: d.status, cls: 'bg-slate-100 text-slate-500' };
                  return (
                    <Link key={d.id} to={createPageUrl(`FinancialDiagnosisDetail?id=${d.id}`)}>
                      <Card className="border-0 shadow-sm fal-card-hover cursor-pointer">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <BarChart3 className="w-4 h-4 text-blue-500" />
                            <div>
                              <p className="text-sm font-medium">{d.title}</p>
                              <p className="text-xs text-slate-400">
                                {d.created_date ? format(new Date(d.created_date), 'dd/MM/yyyy') : ''}
                                {d.sector ? ` · ${d.sector}` : ''}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {companyAssessments.length === 0 && financialDiagnoses.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum diagnóstico ainda</p>
            </div>
          )}
        </div>
      )}

      {tab === 'results' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <AggregateResultPanel levelType="company" levelId={companyId} label={company.name} />
          </CardContent>
        </Card>
      )}

      {tab === 'notes' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <NotesPanel tenantId={user?.tenant_id} entityType="company" entityId={companyId} currentUser={user} />
          </CardContent>
        </Card>
      )}

      {/* Add Unit Dialog */}
      <Dialog open={unitDialog} onOpenChange={setUnitDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Unidade Operacional</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={unitForm.name} onChange={e => setUnitForm({...unitForm, name: e.target.value})} placeholder="Ex: Fazenda Santa Helena" /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={unitForm.unit_type} onValueChange={v => setUnitForm({...unitForm, unit_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={unitForm.location_state} onValueChange={v => setUnitForm({...unitForm, location_state: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnitDialog(false)}>Cancelar</Button>
            <Button onClick={() => createUnitMutation.mutate()} disabled={!unitForm.name || createUnitMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {createUnitMutation.isPending ? 'Criando...' : 'Criar Unidade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditEntityDialog
        open={editDialog}
        onOpenChange={setEditDialog}
        entityType="company"
        entity={company}
        onSaved={() => invalidateStructureQueries(queryClient, user?.tenant_id || company?.tenant_id, 'company')}
      />

      {assessmentDialog && (
         <CreateAssessmentDialog
           open={assessmentDialog}
          onClose={() => setAssessmentDialog(false)}
          targetType="company"
          targetId={companyId}
          groupId={company.group_id}
          companyId={companyId}
          tenantId={user?.tenant_id}
          methodVersionId={methodVersion?.id}
          userName={user?.email}
          targetName={company?.name}
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
          tenantId={user?.tenant_id || company?.tenant_id}
          scopeLevel="company"
          groupId={company?.group_id}
          companyId={companyId}
          defaultTitle={`Diagnóstico Financeiro — ${company?.name}`}
        />
      )}

      {/* Danger Zone */}
      <div className="mt-10">
        <ArchiveDeleteControls
          entityType="company"
          entityId={companyId}
          entityName={company.name}
          isArchived={!!company.is_archived}
          checkDependencies={checkCompanyDependencies}
          onArchived={() => window.location.reload()}
          onDeleted={() => navigate(createPageUrl(company.group_id ? `GroupDetail?id=${company.group_id}` : 'Groups'))}
        />
      </div>
    </div>
  );
}