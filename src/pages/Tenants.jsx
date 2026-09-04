import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Building, UserCog, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Tenants() {
  const { isHQ, methodVersion, user, loading: authLoading } = useTenant();

  useEffect(() => {
    if (!authLoading && !user) {
      base44.auth.redirectToLogin(window.location.href);
    }
  }, [authLoading, user]);
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '' });

  const [userDialog, setUserDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignTenantId, setAssignTenantId] = useState('');
  const [assignAppRole, setAssignAppRole] = useState('');
  const [savingUser, setSavingUser] = useState(false);
  const [savedUser, setSavedUser] = useState(false);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => base44.entities.Tenant.list('-created_date', 100),
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (/** @type {any} */ data) => base44.entities.Tenant.create({
      ...data,
      active: true,
      active_method_version_id: methodVersion?.id || '',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setDialogOpen(false);
      setForm({ name: '', slug: '' });
    },
  });

  function openUserDialog(u) {
    setSelectedUser(u);
    setAssignTenantId(u.tenant_id || 'none');
    setAssignAppRole(u.app_role || '');
    setSavedUser(false);
    setUserDialog(true);
  }

  // Built-in role compatibility check
  const expectedBuiltInRole = (appRole) => appRole === 'hq_admin' ? 'admin' : 'user';
  const builtInRoleMismatch = selectedUser && assignAppRole && selectedUser.role !== expectedBuiltInRole(assignAppRole);

  async function handleSaveUserTenant() {
    setSavingUser(true);
    // Use assignUserAccessProfile — never assume 'consultant' as default
    await base44.functions.invoke('assignUserAccessProfile', {
      user_id: selectedUser.id,
      app_role: assignAppRole,
      tenant_id: assignAppRole === 'hq_admin' ? null : (assignTenantId === 'none' ? null : assignTenantId),
    });
    queryClient.invalidateQueries({ queryKey: ['all-users'] });
    setSavingUser(false);
    setSavedUser(true);
    setTimeout(() => setUserDialog(false), 1200);
  }

  if (!isHQ) return <div className="p-8 text-center text-slate-400">Acesso restrito ao HQ Admin.</div>;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenants</h1>
          <p className="text-sm text-slate-500 mt-1">Consultorias licenciadas</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Novo Tenant
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Building className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum tenant cadastrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map(t => (
            <Card key={t.id} className="border-0 shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Building className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{t.slug}</p>
                  </div>
                </div>
                <Badge className={t.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                  {t.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Users section */}
      <div className="mt-10 mb-6">
        <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
          <UserCog className="w-5 h-5 text-slate-500" /> Usuários & Tenants
        </h2>
        <p className="text-sm text-slate-500 mb-4">Atribua cada usuário a um tenant específico.</p>

        {usersLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="space-y-2">
            {allUsers.map(u => {
              const t = tenants.find(t => t.id === u.tenant_id);
              return (
                <Card key={u.id} className="border-0 shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{u.full_name || u.email}</p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {t ? (
                        <Badge className="bg-blue-100 text-blue-700 text-xs">{t.name}</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-400 text-xs">Sem tenant</Badge>
                      )}
                      <Badge className="bg-slate-50 text-slate-500 text-[10px]">role: {u.role || '—'}</Badge>
                      <Badge className="bg-blue-50 text-blue-600 text-[10px]">{u.app_role || 'sem perfil'}</Badge>
                      <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openUserDialog(u)}>
                        <UserCog className="w-3.5 h-3.5" /> Atribuir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign tenant dialog */}
      <Dialog open={userDialog} onOpenChange={setUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" /> Atribuir Tenant
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium">{selectedUser.full_name || selectedUser.email}</p>
                <p className="text-xs text-slate-400">{selectedUser.email}</p>
                <div className="flex gap-2 mt-1.5">
                  <Badge className="bg-slate-100 text-slate-500 text-[10px]">role: {selectedUser.role || '—'}</Badge>
                  <Badge className="bg-blue-50 text-blue-600 text-[10px]">app_role: {selectedUser.app_role || '—'}</Badge>
                  <Badge className="bg-emerald-50 text-emerald-600 text-[10px]">tenant: {tenants.find(t => t.id === selectedUser.tenant_id)?.name || '—'}</Badge>
                </div>
              </div>
              <div>
                <Label>App Role (papel operacional)</Label>
                <Select value={assignAppRole} onValueChange={setAssignAppRole}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione um app_role..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hq_admin">HQ Admin (global)</SelectItem>
                    <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                    <SelectItem value="consultant">Consultor</SelectItem>
                    <SelectItem value="client_viewer">Client Viewer (read-only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tenant</Label>
                <Select value={assignTenantId} onValueChange={setAssignTenantId} disabled={assignAppRole === 'hq_admin'}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione um tenant..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem tenant (HQ/Admin) —</SelectItem>
                    {tenants.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 mt-1.5">
                  {assignAppRole === 'hq_admin'
                    ? 'HQ Admin possui acesso global (sem tenant).'
                    : 'O usuário verá apenas os dados do tenant selecionado.'}
                </p>
              </div>
              {builtInRoleMismatch && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <span className="text-red-600 text-xs font-semibold">⚠ Built-in role incompatível</span>
                  <p className="text-xs text-red-600">
                    Esperado <strong>{expectedBuiltInRole(assignAppRole)}</strong>, encontrado <strong>{selectedUser.role}</strong>.
                    Altere o papel técnico no Dashboard do Base44 antes de aplicar.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveUserTenant}
              disabled={savingUser || savedUser || !assignAppRole || builtInRoleMismatch || (assignAppRole !== 'hq_admin' && assignTenantId === 'none')}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {savedUser
                ? <><CheckCircle2 className="w-4 h-4" /> Salvo!</>
                : savingUser ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Tenant</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome da Consultoria *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div><Label>Slug (identificador) *</Label><Input value={form.slug} onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} placeholder="ex: minha-consultoria" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.slug || createMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {createMutation.isPending ? 'Criando...' : 'Criar Tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}