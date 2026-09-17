import React from 'react';
import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

/**
 * Tenants — mantido só como redirecionamento pro Admin Panel (aba Tenants),
 * pra não quebrar o link já existente em SystemLaunches.jsx. A tela de
 * verdade (criação de tenant + administração de usuários/perfis) agora
 * vive em AdminPanel.jsx, que substitui a antiga seção "Usuários & Tenants"
 * daqui — que chamava base44.entities.User.list() e a função
 * 'assignUserAccessProfile', nenhum dos dois com implementação real
 * (User caía no mock em memória; a função caía no stub genérico que finge
 * sucesso sem persistir nada).
 */
export default function Tenants() {
  return <Navigate to={`${createPageUrl('AdminPanel')}?tab=tenants`} replace />;
}
