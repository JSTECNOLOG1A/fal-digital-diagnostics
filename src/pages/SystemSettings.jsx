import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/components/shared/TenantContext';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Cable, Upload } from 'lucide-react';
import UserAccessPanel from '@/components/settings/UserAccessPanel';
import PrivacySupportPanel from '@/components/settings/PrivacySupportPanel';

export default function SystemSettings() {
  const { isHQ, isTenantAdmin, tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [tenantName, setTenantName] = useState('');
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const canManage = Boolean(isHQ || isTenantAdmin);

  const tenantData = useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: () => base44.entities.Tenant.get(tenantId),
    enabled: !!tenantId && canManage,
  });

  useEffect(() => {
    if (tenantData.data) {
      setTenantName(tenantData.data.name || '');
      setLogoPreview(tenantData.data.logo_url || null);
    }
  }, [tenantData.data]);

  const save = async () => {
    setSaving(true);
    await base44.entities.Tenant.update(tenantId, { name: tenantName.trim() });
    await queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenantId] });
    setSaving(false);
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Tenant.update(tenantId, { logo_url: file_url });
    setLogoPreview(file_url);
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl fal-title">Configurações</h1>
        <p className="fal-muted text-sm mt-1">
          Gerencie dados, acesso e operações autorizadas.
        </p>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex gap-2">
              <Building2 className="w-4 h-4" /> Perfil da consultoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 items-center">
              {logoPreview && (
                <img src={logoPreview} alt="Logo" className="w-12 h-12 object-contain" />
              )}
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Enviar logo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={upload}
              />
            </div>
            <div>
              <Label>Nome da consultoria</Label>
              <Input
                value={tenantName}
                onChange={(event) => setTenantName(event.target.value)}
              />
            </div>
            <Button disabled={saving || !tenantName.trim()} onClick={save}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex gap-2">
              <Cable className="w-4 h-4" /> Integrações
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Conexões, API Keys e webhooks com sistemas externos.
            </p>
            <Button asChild variant="outline">
              <Link to={createPageUrl('Integrations')}>Abrir</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <UserAccessPanel tenantId={tenantId} canManage={canManage} isHQ={isHQ} />
      <PrivacySupportPanel canOperate={canManage} />
    </div>
  );
}
