import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTenant, listTenants } from '@/api/dataSource';
import { useTenant } from '@/components/shared/TenantContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, CheckCircle2, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function slugify(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * @param {Object} props
 * @param {any=} props.forceOpen
 * @param {any=} props.onClose
 */
export default function TenantPickerDialog({ forceOpen = false, onClose }) {
  const queryClient = useQueryClient();
  const { loading, error, tenantId, isHQ, setActiveTenantId } = useTenant();
  const { toast } = useToast();
  const [selecting, setSelecting] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '' });

  const open = forceOpen || (!loading && !error && !tenantId);

  const {
    data: tenants = [],
    isPending,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['all-tenants-picker'],
    queryFn: () => listTenants(),
    enabled: open && isHQ,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (/** @type {{ name: string, slug: string }} */ payload) => createTenant(payload),
    onSuccess: async (tenant) => {
      await queryClient.invalidateQueries({ queryKey: ['all-tenants-picker'] });
      await queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setShowCreate(false);
      setForm({ name: '', slug: '' });
      toast({
        title: 'Tenant criado',
        description: `“${tenant.name}” está pronto para uso.`,
      });
      setSelecting(tenant.id);
      try {
        const result = await setActiveTenantId(tenant.id);
        if (result?.ok === false) {
          setSelecting(null);
          toast({
            title: 'Tenant criado, mas não selecionado',
            description: 'Selecione-o na lista abaixo.',
            variant: 'destructive',
          });
          return;
        }
        onClose?.();
      } catch (e) {
        setSelecting(null);
        toast({
          title: 'Tenant criado',
          description: e?.message || 'Selecione-o na lista para continuar.',
        });
      }
    },
    onError: (err) => {
      toast({
        title: 'Não foi possível criar o tenant',
        description: err?.message?.replace(/^Clarity API \d+:\s*/, '') || 'Erro inesperado.',
        variant: 'destructive',
      });
    },
  });

  async function handleSelect(tenant) {
    setSelecting(tenant.id);
    try {
      const result = await setActiveTenantId(tenant.id);
      if (result?.ok === false) {
        setSelecting(null);
        const messages = {
          TENANT_SWITCH_NOT_ALLOWED: 'Seu perfil não permite selecionar tenant. Contate o administrador para vincular sua conta.',
          TENANT_NOT_FOUND: 'Tenant não encontrado. Tente novamente.',
        };
        toast({
          title: 'Seleção bloqueada',
          description: messages[result.reason] || 'Erro desconhecido. Contate o administrador.',
          variant: 'destructive',
        });
      } else if (onClose) {
        onClose();
      }
    } catch (e) {
      setSelecting(null);
      toast({
        title: 'Erro ao selecionar tenant',
        description: e.message || 'Contate o administrador.',
        variant: 'destructive',
      });
    }
  }

  function handleCreateSubmit(e) {
    e?.preventDefault?.();
    const name = form.name.trim();
    const slug = (form.slug.trim() || slugify(name)).toLowerCase();
    if (!name || !slug) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o nome do tenant.',
        variant: 'destructive',
      });
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast({
        title: 'Slug inválido',
        description: 'Use apenas letras minúsculas, números e hífens.',
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate({ name, slug });
  }

  if (!open) return null;

  const canClose = forceOpen && !!tenantId;
  const showLoading = isHQ && (isPending || (isFetching && tenants.length === 0));

  return (
    <Dialog open={true} onOpenChange={canClose ? onClose : undefined}>
      <DialogContent className="max-w-md" onPointerDownOutside={canClose ? undefined : e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" style={{color:'var(--fal-green-400)'}} />
            Selecione um Tenant
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm fal-muted -mt-1">
          {isHQ
            ? 'Selecione o tenant que deseja gerenciar para continuar.'
            : 'Sua conta não está vinculada a um tenant. Contate o administrador.'}
        </p>

        {!isHQ ? (
          <div className="py-4">
            <div className="flex items-start gap-3 p-4 rounded-lg" style={{background:'var(--fal-warning-bg)', border:'1px solid var(--fal-warning-border)'}}>
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{color:'var(--fal-warning-text)'}} />
              <div>
                <p className="text-sm font-medium" style={{color:'var(--fal-warning-text)'}}>
                  Conta não configurada
                </p>
                <p className="text-xs mt-1" style={{color:'var(--fal-text-muted)'}}>
                  Seu perfil não permite seleção manual de tenant. Solicite ao administrador a vinculação do seu usuário a um tenant.
                </p>
              </div>
            </div>
          </div>
        ) : showLoading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : isError ? (
          <div className="py-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm text-slate-600">
              Não foi possível carregar os tenants.
            </p>
            <p className="text-xs text-slate-400">
              {queryError?.message?.replace(/^Clarity API \d+:\s*/, '') || 'Verifique se a API está no ar e se você está autenticado.'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar novamente
            </Button>
          </div>
        ) : tenants.length === 0 && !showCreate ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-slate-500">
              Nenhum tenant disponível ainda.
            </p>
            <Button
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              Criar primeiro tenant
            </Button>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {tenants.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {tenants.map(tenant => (
                  <button
                    key={tenant.id}
                    onClick={() => handleSelect(tenant)}
                    disabled={selecting !== null || createMutation.isPending}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{borderColor:'var(--fal-border-soft)'}}
                    onMouseEnter={e => { if (!selecting) { e.currentTarget.style.borderColor='var(--fal-green-400)'; e.currentTarget.style.background='var(--fal-green-50)'; }}}
                    onMouseLeave={e => { if (!selecting) { e.currentTarget.style.borderColor='var(--fal-border-soft)'; e.currentTarget.style.background=''; }}}
                  >
                    {tenant.logo_url ? (
                      <img src={tenant.logo_url} alt={tenant.name} className="w-8 h-8 rounded object-contain flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{tenant.name}</p>
                      {tenant.slug && <p className="text-xs text-slate-400">{tenant.slug}</p>}
                    </div>
                    {selecting === tenant.id ? (
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 opacity-0 group-hover:opacity-100" style={{color:'var(--fal-green-400)'}} />
                    )}
                  </button>
                ))}
              </div>
            )}

            {showCreate ? (
              <form onSubmit={handleCreateSubmit} className="space-y-3 rounded-lg border p-3" style={{borderColor:'var(--fal-border-soft)'}}>
                <p className="text-xs font-semibold text-slate-700">Novo tenant</p>
                <div>
                  <Label className="text-xs">Nome *</Label>
                  <Input
                    className="mt-1"
                    value={form.name}
                    placeholder="Ex: Consultoria Demo"
                    onChange={(e) => {
                      const name = e.target.value;
                      setForm((prev) => ({
                        name,
                        slug: prev.slug && prev.slug !== slugify(prev.name) ? prev.slug : slugify(name),
                      }));
                    }}
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs">Slug *</Label>
                  <Input
                    className="mt-1"
                    value={form.slug}
                    placeholder="consultoria-demo"
                    onChange={(e) => setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  {tenants.length > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                      Cancelar
                    </Button>
                  )}
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {createMutation.isPending ? 'Criando...' : 'Criar e selecionar'}
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                Criar novo tenant
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
