import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Plus, Search, Building2, Phone, Mail, ArrowRight } from 'lucide-react';
import { tenantKey } from '@/lib/query-client';

const SECTORS = [
  { value: 'general_business', label: 'Demais empresas' },
  { value: 'agriculture', label: 'Produção Agrícola' },
  { value: 'livestock', label: 'Pecuária' },
  { value: 'agro_livestock', label: 'Produção Mista (Agro+Pecuária)' },
  { value: 'input_retail', label: 'Revenda de Insumos' },
  { value: 'agro_industry', label: 'Indústria Agro' },
];

const sectorLabel = (val) => SECTORS.find(s => s.value === val)?.label || val;
const sectorTagsLabel = (tags) => (tags || []).map(sectorLabel).join(', ') || 'Demais empresas';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PermissionGuard from '@/components/shared/PermissionGuard';
import TaxIdRegistrationFields from '@/components/shared/TaxIdRegistrationFields';

export default function Clients() {
  const { user, loading: authLoading } = useTenant();

  useEffect(() => {
    if (!authLoading && !user) {
      base44.auth.redirectToLogin(window.location.href);
    }
  }, [authLoading, user]);
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', cnpj: '', tax_id: '', is_individual: false, trade_name: '', city: '', state: '', sector_tags: ['general_business'], contact_name: '', contact_email: '', contact_phone: '', notes: '' });

  const toggleSector = (val) => {
    setForm(prev => {
      const has = prev.sector_tags.includes(val);
      if (has) {
        const next = prev.sector_tags.filter(v => v !== val);
        return { ...prev, sector_tags: next.length ? next : ['general_business'] };
      }
      // Remove general_business if a real sector is chosen
      const next = prev.sector_tags.filter(v => v !== 'general_business');
      return { ...prev, sector_tags: [...next, val] };
    });
  };

  const tenantId = user?.tenant_id || 'global';

  const { data: clients = [], isLoading } = useQuery({
    queryKey: tenantKey(tenantId, 'clients'),
    queryFn: () => base44.entities.Client.filter(user?.tenant_id ? { tenant_id: user.tenant_id } : {}, '-created_date', 200),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (/** @type {any} */ data) => base44.entities.Client.create({
      ...data,
      cnpj: data.tax_id || data.cnpj,
      tax_id: data.tax_id || data.cnpj,
      tenant_id: user.tenant_id || 'global',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'clients') });
      setDialogOpen(false);
      setForm({ name: '', cnpj: '', tax_id: '', is_individual: false, trade_name: '', city: '', state: '', sector_tags: ['general_business'], contact_name: '', contact_email: '', contact_phone: '', notes: '' });
    },
  });

  const filtered = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj?.includes(search) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-500 mt-1">{clients.length} clientes cadastrados</p>
        </div>
        <PermissionGuard area="company">
        <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Novo Cliente
        </Button>
        </PermissionGuard>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar por nome, CNPJ ou contato..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 bg-white border-slate-200"
        />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-36 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum cliente encontrado</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(client => (
            <Link key={client.id} to={createPageUrl(`ClientDetail?id=${client.id}`)}>
              <Card className="border-0 shadow-sm fal-card-hover cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 truncate">{client.name}</h3>
                      {client.sector_tags?.length > 0 && <p className="text-xs text-slate-400 mt-0.5">{sectorTagsLabel(client.sector_tags)}</p>}
                      {client.cnpj && <p className="text-xs text-slate-400 font-mono mt-0.5">{client.cnpj}</p>}
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 mt-1" />
                  </div>
                  {(client.contact_email || client.contact_phone) && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                      {client.contact_email && (
                        <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" /> {client.contact_email}</span>
                      )}
                      {client.contact_phone && (
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {client.contact_phone}</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <TaxIdRegistrationFields
              isIndividual={form.is_individual}
              taxId={form.tax_id || form.cnpj}
              onChange={(patch) => setForm((prev) => ({
                ...prev,
                is_individual: patch.isIndividual ?? prev.is_individual,
                tax_id: patch.taxId ?? prev.tax_id,
                cnpj: patch.taxId ?? prev.cnpj,
              }))}
              onCompanyData={(data) => setForm((prev) => ({
                ...prev,
                name: data.razaoSocial || prev.name,
                trade_name: data.nomeFantasia || prev.trade_name,
                city: data.city || prev.city,
                state: data.state || prev.state,
                cnpj: prev.tax_id || prev.cnpj,
              }))}
            />
            <div><Label>{form.is_individual ? 'Nome completo *' : 'Razão social *'}</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            {!form.is_individual && (
              <div><Label>Nome fantasia</Label><Input value={form.trade_name} onChange={e => setForm({...form, trade_name: e.target.value})} /></div>
            )}
            <div>
              <Label>Setor(es)</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {SECTORS.map(s => {
                  const selected = form.sector_tags.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggleSector(s.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div><Label>Nome do contato</Label><Input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Email</Label><Input type="email" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} /></div>
              <div><Label>Telefone</Label><Input value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || createMutation.isPending || !(form.tax_id || form.cnpj)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}