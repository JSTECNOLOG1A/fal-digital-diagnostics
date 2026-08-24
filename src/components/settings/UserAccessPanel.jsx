import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { tenantKey } from '@/lib/query-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const standardInviteRoles = [
  { value: 'consultant', label: 'Consultor' },
  { value: 'client_viewer', label: 'Cliente (somente leitura)' },
];

export const inviteRolesFor = (isHQ) => isHQ
  ? [{ value: 'tenant_admin', label: 'Administrador do tenant' }, ...standardInviteRoles]
  : standardInviteRoles;

export default function UserAccessPanel({ tenantId, canManage, isHQ = false }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('Acesso revogado pelo administrador.');
  const [email, setEmail] = useState('');
  const inviteRoles = inviteRolesFor(isHQ);
  const [appRole, setAppRole] = useState(isHQ ? 'tenant_admin' : 'consultant');
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [inviting, setInviting] = useState(false);
  const administration = useQuery({ queryKey: tenantKey(tenantId, 'settings-administration'), queryFn: async () => (await base44.functions.invoke('getTenantUserAdministration', { tenant_id: tenantId })).data, enabled: !!tenantId && canManage });
  const refresh = () => queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'settings-administration') });
  const invite = async (event) => {
    event.preventDefault(); setInviting(true); setNotice(''); setFormError('');
    try {
      await base44.functions.invoke('inviteUserWithAccessProfile', { email: email.trim().toLowerCase(), app_role: appRole, tenant_id: tenantId });
      setEmail(''); setNotice('Convite enviado e acesso registrado.'); refresh();
    } catch (error) { setFormError(error?.response?.data?.error || 'Não foi possível enviar o convite.'); } finally { setInviting(false); }
  };
  const resend = async (inviteEmail) => { await base44.functions.invoke('resendUserInvitation', { email: inviteEmail }); setNotice('Convite reenviado.'); refresh(); };
  const revoke = async (userId) => { await base44.functions.invoke('revokeUserAccess', { user_id: userId, reason }); setNotice('Acesso revogado.'); refresh(); };
  if (!canManage) return <section className="fal-card p-5"><h2 className="fal-title">Administração de acesso</h2><p className="fal-muted text-sm mt-2">Seu perfil não tem permissão para administrar acessos.</p></section>;
  if (administration.isLoading) return <section className="fal-card p-5">Carregando administração de acesso...</section>;
  if (administration.error) return <section className="fal-card p-5"><p className="text-sm" style={{ color: 'var(--fal-danger-text)' }}>Não foi possível carregar os dados administrativos.</p><Button variant="outline" className="mt-3" onClick={refresh}>Tentar novamente</Button></section>;
  const { users = [], pending = [], history = [] } = administration.data || {};
  return <section className="fal-card p-5 space-y-5"><div><h2 className="fal-title">Administração de acessos</h2><p className="fal-muted text-sm">Usuários, convites pendentes e histórico do tenant.</p></div>{notice && <p className="text-sm" style={{ color: 'var(--fal-success-text)' }}>{notice}</p>}<form className="grid gap-3 md:grid-cols-[1fr_220px_auto]" onSubmit={invite}><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail do responsável" aria-label="E-mail do responsável" required /><select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" value={appRole} onChange={(event) => setAppRole(event.target.value)} aria-label="Perfil de acesso">{inviteRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select><Button type="submit" disabled={inviting || !email.trim()}>{inviting ? 'Convidando...' : 'Convidar'}</Button></form>{formError && <p className="text-sm" style={{ color: 'var(--fal-danger-text)' }}>{formError}</p>}<Input value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Motivo da revogação" /><div><h3 className="font-semibold text-sm mb-2">Usuários</h3>{users.length ? users.map((user) => <div key={user.id} className="border-b border-slate-200 py-2 flex items-center justify-between gap-3"><span className="text-sm">{user.full_name || user.email} · {user.app_role || 'sem perfil'} · {user.access_status || 'active'}</span>{user.access_status !== 'revoked' && <Button variant="outline" size="sm" onClick={() => revoke(user.id)}>Revogar</Button>}</div>) : <p className="fal-muted text-sm">Nenhum usuário ativo neste tenant.</p>}</div><div><h3 className="font-semibold text-sm mb-2">Convites pendentes</h3>{pending.length ? pending.map((item) => <div key={item.id} className="border-b border-slate-200 py-2 flex items-center justify-between"><span className="text-sm">{item.email} · {item.app_role}</span><Button variant="outline" size="sm" onClick={() => resend(item.email)}>Reenviar</Button></div>) : <p className="fal-muted text-sm">Sem convites pendentes.</p>}</div><div><h3 className="font-semibold text-sm mb-2">Histórico administrativo</h3>{history.length ? history.slice(0, 10).map((item) => <p key={item.id} className="text-sm border-b border-slate-200 py-2">{item.action} · {item.timestamp}</p>) : <p className="fal-muted text-sm">Sem eventos registrados.</p>}</div></section>;
}