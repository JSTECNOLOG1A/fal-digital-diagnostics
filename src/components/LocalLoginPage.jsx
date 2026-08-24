import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { LOCAL_TEST_CREDENTIALS } from '@/lib/localTestAuth';
import { CLARITY_FEATURES } from '@/api/clarityClient';

export default function LocalLoginPage() {
  const { loginLocal, isClarityAuth } = useAuth();
  const [email, setEmail] = useState(LOCAL_TEST_CREDENTIALS.email);
  const [password, setPassword] = useState(LOCAL_TEST_CREDENTIALS.password);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await loginLocal(email, password);
      if (!result?.ok) {
        setError(result?.message || 'Falha no login');
        setLoading(false);
        return;
      }
      window.location.href = '/';
    } catch (e) {
      setError(e?.message || 'Falha no login');
      setLoading(false);
    }
  };

  const usingApi = isClarityAuth || CLARITY_FEATURES.useClarityAuth;

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--fal-bg-page)' }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md fal-card p-8 space-y-5"
      >
        <div>
          <p className="text-xs uppercase tracking-wide fal-muted">
            {usingApi ? 'API própria (PostgreSQL)' : 'Modo desenvolvimento'}
          </p>
          <h1 className="fal-title text-2xl mt-1">
            {usingApi ? 'Entrar no Método FAL' : 'Login local de teste'}
          </h1>
          <p className="fal-muted text-sm mt-2">
            {usingApi
              ? 'Autenticação via backend NestJS. Hierarquia e tenants vêm do banco relacional.'
              : 'Base44 desconectado. Auth e dados ficam só neste browser (memória local).'}
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2 bg-white"
            autoComplete="username"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2 bg-white"
            autoComplete="current-password"
            required
          />
        </label>

        {error ? (
          <p className="text-sm" style={{ color: 'var(--fal-danger-text)' }}>{error}</p>
        ) : null}

        <button type="submit" className="fal-btn-primary w-full" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        <div className="rounded-md border p-3 text-xs fal-muted space-y-1">
          <p><strong>HQ seed:</strong> {LOCAL_TEST_CREDENTIALS.email}</p>
          <p><strong>Senha:</strong> {LOCAL_TEST_CREDENTIALS.password}</p>
          {usingApi ? (
            <p className="pt-1">Tenant admin: admin@demo.local (mesma senha)</p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
