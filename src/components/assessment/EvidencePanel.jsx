import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { useTenant } from '@/components/shared/TenantContext';
import { assessmentKey, tenantKey } from '@/lib/query-client';

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.dimensions
 * @param {any=} props.methodVersionId
 * @param {any=} props.tenantId
 */
export default function EvidencePanel({ assessmentId, dimensions, methodVersionId, tenantId }) {
  const { user } = useTenant();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [selectedDim, setSelectedDim] = useState(dimensions[0]?.key || '');

  const { data: checklist = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'checklist', methodVersionId),
    queryFn: () => base44.entities.EvidenceChecklist.filter({ method_version_id: methodVersionId }),
    enabled: !!methodVersionId,
  });

  const { data: evidences = [] } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'evidences'),
    queryFn: () => base44.entities.Evidence.filter({ assessment_id: assessmentId }),
    enabled: !!assessmentId,
  });

  const dimChecklist = checklist.filter(c => c.dimension_key === selectedDim);
  const dimEvidences = evidences.filter(e => e.dimension_key === selectedDim);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Evidence.create({
      tenant_id: tenantId,
      assessment_id: assessmentId,
      file_url,
      file_name: file.name,
      file_type: file.type,
      dimension_key: selectedDim,
      checklist_item_ids: [],
      tags: [],
      uploaded_by: user?.email,
    });
    queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'evidences') });
    setUploading(false);
  };

  const toggleChecklistItem = async (evidenceId, itemId) => {
    const ev = evidences.find(e => e.id === evidenceId);
    if (!ev) return;
    const ids = ev.checklist_item_ids || [];
    const newIds = ids.includes(itemId) ? ids.filter(i => i !== itemId) : [...ids, itemId];
    await base44.entities.Evidence.update(evidenceId, { checklist_item_ids: newIds });
    queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'evidences') });
  };

  const deleteEvidence = async (id) => {
    await base44.entities.Evidence.delete(id);
    queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'evidences') });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedDim} onValueChange={setSelectedDim}>
          <SelectTrigger className="w-64 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            {dimensions.map(d => <SelectItem key={d.key} value={d.key}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <input type="file" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
          <Button variant="outline" disabled={uploading} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> {uploading ? 'Enviando...' : 'Upload'}
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Checklist de Evidências Obrigatórias</CardTitle>
        </CardHeader>
        <CardContent>
          {dimChecklist.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">Nenhum item no checklist</p>
          ) : (
            <div className="space-y-2">
              {dimChecklist.map(item => {
                const satisfied = evidences.some(e => e.checklist_item_ids?.includes(item.item_id));
                return (
                  <div key={item.item_id} className={`flex items-center gap-2 p-2 rounded-lg text-sm ${satisfied ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                    {satisfied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-slate-300" />}
                    <span className={satisfied ? 'text-emerald-700' : 'text-slate-600'}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Arquivos Enviados ({dimEvidences.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {dimEvidences.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">Nenhum arquivo enviado para esta dimensão</p>
          ) : (
            <div className="space-y-2">
              {dimEvidences.map(ev => (
                <div key={ev.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <a href={ev.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate block">{ev.file_name}</a>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {dimChecklist.map(item => (
                          <button
                            key={item.item_id}
                            onClick={() => toggleChecklistItem(ev.id, item.item_id)}
                            className={`text-[10px] px-1.5 py-0.5 rounded ${ev.checklist_item_ids?.includes(item.item_id) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}
                          >
                            {item.label.substring(0, 30)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteEvidence(ev.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}