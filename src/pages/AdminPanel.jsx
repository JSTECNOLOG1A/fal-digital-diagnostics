import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { getPermissionMatrix } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building, UserCog, ShieldCheck, LayoutDashboard, Plus, Copy, CheckCircle2,
  RefreshCw, Ban, Pencil, Users as UsersIcon,
} from 'lucide-react';

const ROLE_ORDER = ['hq_admin', 'tenant_admin', 'consultant', 'client_viewer'];
const ROLE_LABELS = {
  hq_admin: 'HQ Admin',
  tenant_admin: 'Admin do Tenant',
  consultant: 'Consultor',
  client_viewer: 'Cliente (leitura)',
};
const AREA_LABELS = {
  group: 'Grupos', company: 'Empresas', unit: 'Unidades', diagnosis: 'Diagnósticos',
  questionnaire: 'Questionários', financial: 'Financeiro', consolidation: 'Consolidação',
  actionplan: 'Plano de Ação', reviews: 'Revisões', reports: 'Relatórios', users: 'Usuários',
  exclusions: 'Exclusões', tenant_switch: 'Trocar Tenant',
};
const STATUS_LABELS = { active: 'Ativo', invited: 'Convidado', revoked: 'Revogado', suspended: 'Suspenso' };
const STATUS_CLASS = {
  active: 'bg-emerald-100 text-emerald-700',
  invited: 'bg-amber-100 text-amber-700',
  revoked: 'bg-red-100 text-red-700',
  suspended: 'bg-slate-100 text-slate-500',
};

function groupCount(rows, field) {
  return rows.reduce((acc, r) => {
    const key = r[field] || 'sem_valor';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

/**
 * @param {Object} props
 * @param {any=} props.icon
 * @param {any=} props.label
 * @param {any=} props.value
 * @param {any=} props.hint
 */
function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
          <p className="text-xs text-slate-500 mt-1">{label}</p>
          {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab() {
  const { data: tenants = [], isLoading: loadingTenants } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => base44.entities.Tenant.list('-created_date', 200),
  });
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
  });

  if (loadingTenants || loadingUsers) {
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>;
  }

  const activeTenants = tenants.filter((t) => t.active).length;
  const byStatus = groupCount(users, 'access_status');
  const byRole = groupCount(users, 'app_role');

  return (
    <div className="space-y-6 mt-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building} label="Tenants ativos" value={activeTenants} hint={`${tenants.length} no total`} />
        <StatCard icon={UsersIcon} label="Usuários ativos" value={byStatus.active || 0} hint={`${users.length} no total`} />
        <StatCard icon={Ban} label="Usuários revogados" value={byStatus.revoked || 0} />
        <StatCard icon={ShieldCheck} label="HQ Admins" value={byRole.hq_admin || 0} />
      </div>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Usuários por papel</h3>
          <div className="flex flex-wrap gap-2">
            {ROLE_ORDER.map((role) => (
              <Badge key={role} className="bg-slate-100 text-slate-600">{ROLE_LABELS[role]}: {byRole[role] || 0}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TenantsTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [form, setForm] = useState({ name: '', slug: '' });

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => base44.entities.Tenant.list('-created_date', 200),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Tenant.create(data),
    onSuccess: () => { invalidate(); setDialogOpen(false); setForm({ name: '', slug: '' }); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Tenant.update(id, data),
    onSuccess: () => { invalidate(); setDialogOpen(false); setEditingTenant(null); },
  });

  function openCreate() { setEditingTenant(null); setForm({ name: '', slug: '' }); setDialogOpen(true); }
  function openEdit(t) { setEditingTenant(t); setForm({ name: t.name, slug: t.slug }); setDialogOpen(true); }
  function toggleActive(t) { updateMutation.mutate({ id: t.id, data: { is_active: !t.active } }); }
  function save() {
    if (editingTenant) updateMutation.mutate({ id: editingTenant.id, data: { name: form.name } });
    else createMutation.mutate(form);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Consultorias licenciadas no Método FAL.</p>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Novo Tenant
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Building className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum tenant cadastrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => (
            <Card key={t.id} className="border-0 shadow-sm">
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Building className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{t.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{t.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={t.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                    {t.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(t)}>
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toggleActive(t)} disabled={updateMutation.isPending}>
                    {t.active ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {t.active ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTenant ? 'Editar Tenant' : 'Novo Tenant'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Consultoria *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            {!editingTenant && (
              <div>
                <Label>Slug (identificador) *</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="ex: minha-consultoria" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={save}
              disabled={!form.name || (!editingTenant && !form.slug) || createMutation.isPending || updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : editingTenant ? 'Salvar' : 'Criar Tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const [tenantFilter, setTenantFilter] = useState('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'consultant', tenant_id: '' });
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState(null);
  const [assignUser, setAssignUser] = useState(null);
  const [assignForm, setAssignForm] = useState({ role: '', tenant_id: '' });
  const [assigning, setAssigning] = useState(false);

  const { data: tenants = [] } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => base44.entities.Tenant.list('-created_date', 200),
  });

  const { data: administration, isLoading } = useQuery({
    queryKey: ['admin-users-administration', tenantFilter],
    queryFn: async () => (await base44.functions.invoke('getTenantUserAdministration', {
      tenant_id: tenantFilter === 'all' ? undefined : tenantFilter,
    })).data,
  });

  const users = administration?.users || [];
  const pending = administration?.pending || [];
  const history = administration?.history || [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-users-administration'] });
  const tenantName = (id) => tenants.find((t) => t.id === id)?.name || '—';

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true); setInviteError('');
    const res = await base44.functions.invoke('inviteUserWithAccessProfile', {
      email: inviteForm.email.trim().toLowerCase(),
      name: inviteForm.name.trim() || inviteForm.email.trim(),
      app_role: inviteForm.role,
      tenant_id: inviteForm.role === 'hq_admin' ? undefined : inviteForm.tenant_id,
    });
    setInviting(false);
    if (res?.data?.error) { setInviteError(res.data.error); return; }
    setTempPasswordResult({ email: inviteForm.email, password: res?.data?.temporary_password });
    setInviteOpen(false);
    setInviteForm({ email: '', name: '', role: 'consultant', tenant_id: '' });
    refresh();
  }

  async function handleResend(user) {
    const res = await base44.functions.invoke('resendUserInvitation', { user_id: user.id });
    if (res?.data?.temporary_password) setTempPasswordResult({ email: user.email, password: res.data.temporary_password });
    refresh();
  }

  async function handleRevoke(user) {
    if (!window.confirm(`Revogar o acesso de ${user.email}?`)) return;
    await base44.functions.invoke('revokeUserAccess', { user_id: user.id, reason: 'Revogado pelo administrador' });
    refresh();
  }

  function openAssign(user) {
    setAssignUser(user);
    setAssignForm({ role: user.app_role || '', tenant_id: user.tenant_id || '' });
  }

  async function handleAssign() {
    setAssigning(true);
    await base44.functions.invoke('assignUserAccessProfile', {
      user_id: assignUser.id,
      app_role: assignForm.role,
      tenant_id: assignForm.role === 'hq_admin' ? undefined : assignForm.tenant_id,
    });
    setAssigning(false);
    setAssignUser(null);
    refresh();
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={tenantFilter} onValueChange={setTenantFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por tenant..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tenants</SelectItem>
            {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setInviteOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Convidar usuário
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {users.length === 0 && <p className="text-sm text-slate-400 py-8 text-center">Nenhum usuário encontrado.</p>}
          {users.map((u) => (
            <Card key={u.id} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{u.full_name || u.email}</p>
                  <p className="text-xs text-slate-400 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-blue-50 text-blue-600 text-[10px]">{ROLE_LABELS[u.app_role] || u.app_role || 'sem perfil'}</Badge>
                  <Badge className="bg-slate-100 text-slate-500 text-[10px]">{tenantName(u.tenant_id)}</Badge>
                  <Badge className={`text-[10px] ${STATUS_CLASS[u.access_status] || 'bg-slate-100 text-slate-500'}`}>
                    {STATUS_LABELS[u.access_status] || u.access_status}
                  </Badge>
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openAssign(u)}>
                    <UserCog className="w-3.5 h-3.5" /> Reatribuir
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => handleResend(u)}>
                    <RefreshCw className="w-3.5 h-3.5" /> Reenviar
                  </Button>
                  {u.access_status !== 'revoked' && (
                    <Button size="sm" variant="outline" className="text-xs gap-1 text-red-600 hover:text-red-700" onClick={() => handleRevoke(u)}>
                      <Ban className="w-3.5 h-3.5" /> Revogar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Convites pendentes</h3>
          <div className="space-y-2">
            {pending.map((p) => (
              <Card key={p.id} className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-center justify-between text-sm">
                  <span>{p.email} · {ROLE_LABELS[p.app_role] || p.app_role}</span>
                  <Button size="sm" variant="outline" onClick={() => handleResend(p)}>Reenviar</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Histórico administrativo</h3>
          <div className="space-y-1">
            {history.map((h) => (
              <p key={h.id} className="text-xs text-slate-400 border-b border-slate-100 py-1.5">{h.action} · {new Date(h.timestamp).toLocaleString('pt-BR')}</p>
            ))}
          </div>
        </div>
      )}

      {/* Convidar */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar usuário</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={handleInvite}>
            <div><Label>Nome</Label><Input value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} /></div>
            <div><Label>E-mail *</Label><Input type="email" required value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} /></div>
            <div>
              <Label>Papel</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_ORDER.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {inviteForm.role !== 'hq_admin' && (
              <div>
                <Label>Tenant *</Label>
                <Select value={inviteForm.tenant_id} onValueChange={(v) => setInviteForm({ ...inviteForm, tenant_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um tenant..." /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
            <p className="text-xs text-slate-400">Não há envio de e-mail configurado — a senha temporária aparece na tela após criar, pra você repassar manualmente.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={inviting || !inviteForm.email || (inviteForm.role !== 'hq_admin' && !inviteForm.tenant_id)} className="bg-blue-600 hover:bg-blue-700 text-white">
                {inviting ? 'Convidando...' : 'Convidar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reatribuir */}
      <Dialog open={!!assignUser} onOpenChange={(open) => !open && setAssignUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reatribuir {assignUser?.email}</DialogTitle></DialogHeader>
          {assignUser && (
            <div className="space-y-4">
              <div>
                <Label>Papel</Label>
                <Select value={assignForm.role} onValueChange={(v) => setAssignForm({ ...assignForm, role: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {ROLE_ORDER.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {assignForm.role !== 'hq_admin' && (
                <div>
                  <Label>Tenant</Label>
                  <Select value={assignForm.tenant_id} onValueChange={(v) => setAssignForm({ ...assignForm, tenant_id: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignUser(null)}>Cancelar</Button>
            <Button
              onClick={handleAssign}
              disabled={assigning || !assignForm.role || (assignForm.role !== 'hq_admin' && !assignForm.tenant_id)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {assigning ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Senha temporária */}
      <Dialog open={!!tempPasswordResult} onOpenChange={(open) => !open && setTempPasswordResult(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Senha temporária gerada</DialogTitle></DialogHeader>
          {tempPasswordResult && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Repasse manualmente pra <strong>{tempPasswordResult.email}</strong> (não há envio de e-mail):</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={tempPasswordResult.password || ''} className="font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => navigator.clipboard?.writeText(tempPasswordResult.password || '')}
                  title="Copiar"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setTempPasswordResult(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfilesTab() {
  const rows = ROLE_ORDER.map((role) => ({ role, matrix: getPermissionMatrix({ app_role: role, access_status: 'active' }) }));
  const areas = Object.keys(AREA_LABELS);
  const badgeClass = { ALLOW: 'bg-emerald-100 text-emerald-700', DENY: 'bg-slate-100 text-slate-400', 'READ-ONLY': 'bg-amber-100 text-amber-700', 'N/A': 'bg-slate-50 text-slate-300' };
  return (
    <div className="mt-6 overflow-x-auto">
      <p className="text-sm text-slate-500 mb-4">Os 4 papéis do Método FAL são fixos no código — esta tabela mostra o que cada um pode fazer.</p>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-800 text-white text-xs uppercase">
            <th className="text-left px-3 py-2.5 font-medium">Área</th>
            {ROLE_ORDER.map((r) => <th key={r} className="px-3 py-2.5 font-medium">{ROLE_LABELS[r]}</th>)}
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => (
            <tr key={area} className="border-b border-slate-100">
              <td className="px-3 py-2.5 font-medium text-slate-700">{AREA_LABELS[area]}</td>
              {rows.map(({ role, matrix }) => (
                <td key={role} className="px-3 py-2.5 text-center">
                  <Badge className={`text-[10px] ${badgeClass[matrix[area]] || badgeClass['N/A']}`}>{matrix[area] || 'N/A'}</Badge>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const VALID_TABS = new Set(['overview', 'tenants', 'users', 'profiles']);

export default function AdminPanel() {
  const { isHQ, loading } = useTenant();
  const urlTab = new URLSearchParams(window.location.search).get('tab');
  const [tab, setTab] = useState(VALID_TABS.has(urlTab) ? urlTab : 'overview');

  if (loading) return <div className="p-8 text-center text-slate-400">Carregando...</div>;
  if (!isHQ) return <div className="p-8 text-center text-slate-400">Acesso restrito ao HQ Admin.</div>;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-600" /> Administração
        </h1>
        <p className="text-sm text-slate-500 mt-1">Tenants, usuários e perfis do Método FAL.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5"><LayoutDashboard className="w-3.5 h-3.5" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="tenants" className="gap-1.5"><Building className="w-3.5 h-3.5" /> Tenants</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><UsersIcon className="w-3.5 h-3.5" /> Usuários</TabsTrigger>
          <TabsTrigger value="profiles" className="gap-1.5"><UserCog className="w-3.5 h-3.5" /> Perfis</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="tenants"><TenantsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="profiles"><ProfilesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
