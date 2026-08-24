import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useTenant } from '@/components/shared/TenantContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { AppLoader, AppError } from '@/components/shared/AppLoader';
import TenantPickerDialog from '@/components/shared/TenantPickerDialog';
import {
  LayoutDashboard, Briefcase, Layers, LogOut, Menu, Building2, ScrollText, Rocket,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

function SidebarContent({ collapsed, currentPageName, onNavigate, onChangeTenant }) {
  const { user, tenant, isHQ, isClient } = useTenant();
  // SEG-03: Runtime consumer of rbac.js — canSwitchTenant replaces raw isHQ check
  const perms = usePermissions();

  const mainNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard', roles: ['hq_admin', 'tenant_admin', 'consultant'] },
    { name: 'DataHub', icon: Layers, page: 'Groups', roles: ['hq_admin', 'tenant_admin', 'consultant'] },
    { name: 'Cockpit', icon: Briefcase, page: 'ConsultantCockpit', roles: ['hq_admin', 'tenant_admin', 'consultant'] },
    { name: 'Relatórios', icon: ScrollText, page: 'ReportsCenterPage', roles: ['hq_admin', 'tenant_admin', 'consultant'] },
    { name: 'Lançamentos', icon: Rocket, page: 'SystemLaunches', roles: ['hq_admin'] },
  ];

  const clientNav = [
    { name: 'Meu Portal', icon: LayoutDashboard, page: 'ClientPortal', roles: ['client_viewer'] },
  ];

  // Use appRole from perms, not user.role — deny-by-default for unclassified
  const nav = perms.appRole === 'client_viewer' ? clientNav : (perms.canRead ? mainNav : []);
  const filteredNav = nav.filter(item => item.roles.includes(perms.appRole || ''));

  return (
    <div className="flex flex-col h-full">
      <div className={`p-4 ${collapsed ? 'px-3' : ''}`} style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        {!collapsed ? (
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">FAL<span style={{color:'var(--fal-green-400)'}}>®</span> Digital</h1>
            <p className="text-[10px] mt-0.5" style={{color:'var(--fal-text-inverse-muted)'}}>V1.0</p>
          </div>
        ) : (
          <div className="text-center">
            <span className="text-lg font-bold text-white">F</span>
            <span className="text-lg font-bold" style={{color:'var(--fal-green-400)'}}>®</span>
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {filteredNav.map(item => {
          const active = currentPageName === item.page;
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${collapsed ? 'justify-center' : ''}`}
              style={active ? {
                background: 'rgba(47,166,106,0.14)',
                color: '#7FE3A5',
                borderLeft: collapsed ? 'none' : '3px solid var(--fal-green-400)',
                paddingLeft: collapsed ? undefined : '10px',
              } : { color: 'var(--fal-text-inverse-muted)' }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='#FFFFFF'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background=''; e.currentTarget.style.color='var(--fal-text-inverse-muted)'; }}}
              title={item.name}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`p-4 ${collapsed ? 'px-2' : ''}`} style={{borderTop:'1px solid rgba(255,255,255,0.08)'}}>
        {!collapsed && user && (
          <div className="mb-3">
            <p className="text-xs truncate" style={{color:'var(--fal-text-inverse-muted)'}}>{user.email}</p>
            <p className="text-[10px] capitalize" style={{color:'rgba(156,163,175,0.5)'}}>{perms.appRole || 'sem perfil'}</p>
          </div>
        )}
        {/* SEG-03: Runtime RBAC — canSwitchTenant from rbac.js via usePermissions */}
        {perms.canSwitchTenant && onChangeTenant && (
          <button
            onClick={onChangeTenant}
            className={`flex items-center gap-2 text-sm transition-colors hover:text-white mb-2 ${collapsed ? 'justify-center w-full' : ''}`}
            style={{color:'var(--fal-text-inverse-muted)'}}
          >
            <Building2 className="w-4 h-4" />
            {!collapsed && 'Trocar Tenant'}
          </button>
        )}
        <button
          onClick={() => base44.auth.logout()}
          className={`flex items-center gap-2 text-sm transition-colors hover:text-white ${collapsed ? 'justify-center w-full' : ''}`}
          style={{color:'var(--fal-text-inverse-muted)'}}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && 'Sair'}
        </button>
      </div>
    </div>
  );
}

function LayoutInner({ children, currentPageName }) {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showTenantPicker, setShowTenantPicker] = useState(false);
  const { loading, error, tenantId, isHQ, setActiveTenantId } = useTenant();

  if (loading) return <AppLoader />;
  if (error)   return <AppError message={error} />;

  return (
    <div className="flex h-screen" style={{background:'var(--fal-bg-page)'}} onClick={() => !collapsed && setCollapsed(true)}>
      {/* Desktop sidebar */}
      <aside 
        className={`hidden lg:flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} relative flex-shrink-0 cursor-pointer`}
        style={{background:'linear-gradient(180deg, var(--fal-navy-950) 0%, var(--fal-navy-900) 100%)'}}
        onClick={(e) => {
          if (collapsed) setCollapsed(false);
          e.stopPropagation();
        }}
      >
        <SidebarContent 
          collapsed={collapsed} 
          currentPageName={currentPageName} 
          onNavigate={() => setCollapsed(true)} 
          onChangeTenant={() => setShowTenantPicker(true)} 
        />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 flex flex-col" style={{background:'linear-gradient(180deg, var(--fal-navy-950) 0%, var(--fal-navy-900) 100%)'}}>
            <SidebarContent collapsed={false} currentPageName={currentPageName} onNavigate={() => setMobileOpen(false)} onChangeTenant={() => { setMobileOpen(false); setShowTenantPicker(true); }} />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <TenantPickerDialog forceOpen={showTenantPicker} onClose={() => setShowTenantPicker(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-sm font-bold" style={{color:'var(--fal-text-strong)'}}>FAL<span style={{color:'var(--fal-green-400)'}}>®</span> Digital</h1>
          <div className="w-9" />
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <LayoutInner currentPageName={currentPageName}>
      {children}
    </LayoutInner>
  );
}