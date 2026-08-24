import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Pencil } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { financialKey } from '@/lib/query-client';
import { currentFinancialScopeKey } from '@/lib/hooks/useCurrentFinancialOutputScope';
import { useTenant } from '@/components/shared/TenantContext';

const ACTIVITY_OPTIONS = [
  { value: 'operating', label: 'Atividades Operacionais' },
  { value: 'investing', label: 'Atividades de Investimento' },
  { value: 'financing', label: 'Atividades de Financiamento' },
];

const TYPE_OPTIONS = [
  { value: 'patrimonio_liquido', label: 'Ajuste de Patrimônio Líquido' },
  { value: 'reclassificacao', label: 'Reclassificação Contábil' },
  { value: 'outros', label: 'Outros' },
];

const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'decimal', maximumFractionDigits: 0 }).format(v || 0);

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 * @param {any=} props.uploadId
 * @param {any=} props.periods
 * @param {any=} props.periodLabelMap
  * @param {any=} props.open
  * @param {any=} props.onOpenChange
 */
export default function DfcManualAdjustmentDialog({ diagnosisId, uploadId, periods = [], periodLabelMap = {}, open, onOpenChange }) {
  const { tenantId } = useTenant();
  const [activity, setActivity] = useState('financing');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('patrimonio_liquido');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [notes, setNotes] = useState('');
  const [justification, setJustification] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existing = [] } = useQuery({
    queryKey: financialKey(tenantId, diagnosisId, 'dfc-manual-adjustments'),
    queryFn: () => base44.entities.FinancialDfcManualAdjustment.filter({ financial_diagnosis_id: diagnosisId }, 'created_date', 500),
    enabled: !!diagnosisId && open,
  });

  const refreshDfc = () => {
    queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'dfc-manual-adjustments') });
    queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'dfc-composition') });
    queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'dfc-validation') });
    queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'statements') });
    queryClient.invalidateQueries({ queryKey: financialKey(tenantId, diagnosisId, 'validations') });
    queryClient.invalidateQueries({ queryKey: currentFinancialScopeKey(tenantId, diagnosisId) });
  };

  useEffect(() => {
    if (open && periods.length > 0 && !selectedPeriod) {
      setSelectedPeriod(periods[periods.length - 1]);
    }
    if (!open) {
      setLabel(''); setValue(''); setNotes(''); setJustification(''); setActivity('financing'); setAdjustmentType('patrimonio_liquido'); setEditingId(null);
    }
  }, [open, periods]);

  const handleSave = async () => {
    if (!label.trim()) { toast({ title: 'Informe o nome do ajuste', variant: 'destructive' }); return; }
    const numValue = parseFloat(String(value).replace(/\./g, '').replace(',', '.'));
    if (isNaN(numValue) || numValue === 0) { toast({ title: 'Valor inválido', variant: 'destructive' }); return; }
    if (!selectedPeriod) { toast({ title: 'Selecione o período', variant: 'destructive' }); return; }
    if (!justification.trim()) { toast({ title: 'Informe a justificativa', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      const payload = {
        action: editingId ? 'update' : 'create',
        adjustment_id: editingId || null,
        financial_diagnosis_id: diagnosisId,
        financial_upload_id: uploadId || null,
        column_key: selectedPeriod,
        period: selectedPeriod,
        activity,
        label: label.trim(),
        value: numValue,
        adjustment_type: adjustmentType,
        notes: notes.trim() || null,
        justification: justification.trim(),
      };
      await base44.functions.invoke('manageDfcManualAdjustment', payload);
      toast({ title: editingId ? 'Ajuste atualizado' : 'Ajuste inserido na DFC', description: `${label} — ${fmtBRL(numValue)}` });
      setLabel(''); setValue(''); setNotes(''); setJustification(''); setEditingId(null);
      refreshDfc();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await base44.functions.invoke('manageDfcManualAdjustment', { action: 'delete', adjustment_id: id, financial_diagnosis_id: diagnosisId, financial_upload_id: uploadId || null });
      if (editingId === id) { setLabel(''); setValue(''); setNotes(''); setEditingId(null); }
      refreshDfc();
    } catch (e) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' });
    }
  };

  const handleEdit = (a) => {
    setEditingId(a.id);
    setLabel(a.label || '');
    setValue(a.value != null ? fmtBRL(a.value) : '');
    setActivity(a.activity || 'financing');
    setAdjustmentType(a.adjustment_type || 'patrimonio_liquido');
    setSelectedPeriod(a.column_key || a.period || '');
    setNotes(a.notes || '');
    setJustification(a.justification || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setLabel(''); setValue(''); setNotes(''); setJustification('');
    setActivity('financing'); setAdjustmentType('patrimonio_liquido');
  };

  const fmtPeriod = (p) => periodLabelMap[p] || p;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajuste Manual da DFC</DialogTitle>
        </DialogHeader>

        {existing.length > 0 && (
          <div className="space-y-1 max-h-44 overflow-y-auto mb-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Ajustes inseridos</p>
            {existing.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg text-xs">
                <span className="flex-1 truncate text-amber-900 font-medium">{a.label}</span>
                <span className="text-slate-400">{ACTIVITY_OPTIONS.find(o => o.value === a.activity)?.label}</span>
                <span className="tabular-nums font-semibold text-amber-900 whitespace-nowrap">{fmtBRL(a.value)}</span>
                <button onClick={() => handleEdit(a)} className={`flex-shrink-0 ${editingId === a.id ? 'text-amber-600' : 'text-slate-400 hover:text-amber-600'}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(a.id)} className="text-slate-400 hover:text-red-500 flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome do Ajuste</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Reorganização contábil" className="mt-1" />
          </div>

          <div>
            <Label className="text-xs">Justificativa *</Label>
            <Input value={justification} onChange={e => setJustification(e.target.value)} placeholder="Explique o motivo e a origem do ajuste" className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Atividade</Label>
              <Select value={activity} onValueChange={setActivity}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo de Ajuste</Label>
              <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input value={value} onChange={e => setValue(e.target.value)} placeholder="29.000.000,00" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Período</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {periods.map(p => <SelectItem key={p} value={p}>{fmtPeriod(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {editingId && (
            <Button variant="ghost" onClick={handleCancelEdit} className="text-slate-500">
              Cancelar edição
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
            {editingId ? 'Salvar Alterações' : <><Plus className="w-4 h-4 mr-1" /> Inserir Ajuste</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}