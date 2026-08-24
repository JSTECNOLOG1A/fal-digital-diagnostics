import React from 'react';
import { base44 } from '@/api/base44Client';

export function AppLoader() {
  return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 mt-4">Carregando FAL® Digital...</p>
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.message
 */
export function AppError({ message }) {
  const isNoTenant = message === 'TENANT_REQUIRED';
  return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-sm px-6">
        {isNoTenant ? (
          <>
            <p className="text-sm font-semibold text-slate-700 mb-1">Tenant não associado</p>
            <p className="text-xs text-slate-500 mb-4">
              Seu usuário não está vinculado a nenhum tenant. Solicite ao administrador que associe sua conta.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-red-600 mb-1">Erro de sessão</p>
            <p className="text-xs text-slate-500 mb-4">{message}</p>
          </>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md"
          >
            Recarregar
          </button>
          <button
            onClick={() => (/** @type {any} */ (base44.auth.redirectToLogin))()}
            className="text-xs text-blue-600 underline"
          >
            Fazer login novamente
          </button>
        </div>
      </div>
    </div>
  );
}