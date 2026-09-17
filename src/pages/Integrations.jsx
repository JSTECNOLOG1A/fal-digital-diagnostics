import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clarity, CLARITY_FEATURES } from '@/api/clarityClient';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { useToast } from '@/components/ui/use-toast';
import { buildAccountPlanLinesFromProtheus, isProtheusAccountActive } from '@/lib/protheusAccountPlanImport';
import { replaceAccountPlanLines } from '@/lib/replaceAccountPlanLines';
import {
  compareAccountHierarchy,
  extractParentAccountCode,
  sortAccountPlanTree,
} from '@/lib/accountPlanHierarchy';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Cable,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Webhook,
  Inbox,
  Database,
  Download,
} from 'lucide-react';

const PROTHEUS_DEFAULTS = {
  baseUrl: 'https://guilhermefrota148529.protheus.cloudtotvs.com.br:1657/rest',
  username: 'Admin',
  password: '',
  companyCode: '01',
  branchCode: '0104',
  pathOverride: '/CtbRestSaldos/consultar',
};
function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return String(value);
  }
}

function StatusBadge({ active, revoked }) {
  if (revoked || active === false) {
    return <Badge className="bg-slate-100 text-slate-600">Inativo</Badge>;
  }
  return <Badge className="bg-emerald-100 text-emerald-700">Ativo</Badge>;
}

export default function Integrations() {
  const { tenantId, tenant, isHQ, isTenantAdmin } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = Boolean(isHQ || isTenantAdmin);
  const enabled = CLARITY_FEATURES.useClarityIntegrations && !!tenantId && canManage;

  const [tab, setTab] = useState('connections');
  const [connOpen, setConnOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [hookOpen, setHookOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [secretReveal, setSecretReveal] = useState(null);
  const [revokeId, setRevokeId] = useState(null);

  const [connForm, setConnForm] = useState({
    provider: 'custom-erp',
    name: '',
    baseUrl: '',
    authType: 'api_key',
    apiKeySecret: '',
  });
  const [keyForm, setKeyForm] = useState({
    name: '',
    scopes: 'partner:ping, webhooks:receive',
  });
  const [hookForm, setHookForm] = useState({
    name: '',
    targetUrl: '',
    events: 'group.created, company.created, company.updated',
  });
  const [dispatchForm, setDispatchForm] = useState({
    event: 'company.created',
    payload: '{\n  "id": "demo-1",\n  "name": "Empresa Demo"\n}',
  });
  const [protheusForm, setProtheusForm] = useState(PROTHEUS_DEFAULTS);
  const [chartAccounts, setChartAccounts] = useState(
    /** @type {null | { count: number, jobId: string, url?: string, fetchedTotal?: number, items: Array<Record<string, any>> }} */ (null),
  );
  const [discoverResult, setDiscoverResult] = useState(
    /** @type {null | { companies: any[], branches: any[], attempts: any[], hint?: string }} */ (null),
  );
  const [importOpen, setImportOpen] = useState(false);
  const [importPlanId, setImportPlanId] = useState('');
  const [importPlanName, setImportPlanName] = useState('');
  const [importMode, setImportMode] = useState(/** @type {'existing'|'new'} */ ('new'));

  const qKey = useMemo(() => ['integrations', tenantId], [tenantId]);

  const sortedChartItems = useMemo(() => {
    const items = chartAccounts?.items;
    if (!items?.length) return [];
    const mapped = items.map((row) => ({
      ...row,
      code: String(row.code || row.externalId || '').trim(),
      parentCode: extractParentAccountCode(row),
    }));
    const hasParents = mapped.some((r) => r.parentCode);
    if (hasParents) {
      const ordered = sortAccountPlanTree(mapped);
      const byCode = new Map(ordered.map((r, i) => [r.code, i]));
      return [...items].sort((a, b) => {
        const ca = String(a.code || a.externalId || '').trim();
        const cb = String(b.code || b.externalId || '').trim();
        const ia = byCode.has(ca) ? byCode.get(ca) : 999999;
        const ib = byCode.has(cb) ? byCode.get(cb) : 999999;
        if (ia !== ib) return ia - ib;
        return compareAccountHierarchy(ca, cb);
      });
    }
    return [...items].sort((a, b) =>
      compareAccountHierarchy(
        String(a.code || a.externalId || ''),
        String(b.code || b.externalId || ''),
      ),
    );
  }, [chartAccounts]);

  const plansQ = useQuery({
    queryKey: ['financial-account-plans', tenantId],
    queryFn: () =>
      base44.entities.FinancialAccountPlan.filter(
        { tenant_id: tenantId, is_active: true },
        '-created_date',
        100,
      ),
    enabled: !!tenantId && canManage,
  });

  const protheusQ = useQuery({
    queryKey: [...qKey, 'protheus'],
    queryFn: () => clarity.getProtheusConnection(tenantId),
    enabled,
  });

  React.useEffect(() => {
    const c = protheusQ.data;
    if (!c) return;
    setProtheusForm((f) => ({
      ...f,
      baseUrl: c.baseUrl || f.baseUrl,
      username: c.username || f.username,
      companyCode: c.companyCode || f.companyCode || '01',
      branchCode: c.branchCode || f.branchCode || '01',
      password: '',
    }));
  }, [protheusQ.data]);

  const connectionsQ = useQuery({
    queryKey: [...qKey, 'connections'],
    queryFn: () => clarity.listIntegrationConnections(tenantId),
    enabled,
  });
  const keysQ = useQuery({
    queryKey: [...qKey, 'api-keys'],
    queryFn: () => clarity.listIntegrationApiKeys(tenantId),
    enabled,
  });
  const hooksQ = useQuery({
    queryKey: [...qKey, 'webhooks'],
    queryFn: () => clarity.listWebhookEndpoints(tenantId),
    enabled,
  });
  const eventsQ = useQuery({
    queryKey: [...qKey, 'inbound'],
    queryFn: () => clarity.listInboundEvents(tenantId),
    enabled,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qKey });

  const upsertConn = useMutation({
    mutationFn: () =>
      clarity.upsertIntegrationConnection({
        tenantId,
        provider: connForm.provider.trim(),
        name: connForm.name.trim(),
        baseUrl: connForm.baseUrl.trim() || undefined,
        authType: connForm.authType.trim() || 'api_key',
        secrets: connForm.apiKeySecret.trim()
          ? { apiKey: connForm.apiKeySecret.trim() }
          : undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Conexão salva' });
      setConnOpen(false);
      setConnForm({
        provider: 'custom-erp',
        name: '',
        baseUrl: '',
        authType: 'api_key',
        apiKeySecret: '',
      });
      invalidate();
    },
    onError: (err) =>
      toast({
        title: 'Falha ao salvar conexão',
        description: err.message,
        variant: 'destructive',
      }),
  });

  const createKey = useMutation({
    mutationFn: () =>
      clarity.createIntegrationApiKey({
        tenantId,
        name: keyForm.name.trim(),
        scopes: keyForm.scopes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: (data) => {
      setKeyOpen(false);
      setKeyForm({ name: '', scopes: 'partner:ping, webhooks:receive' });
      setSecretReveal({
        type: 'apiKey',
        value: data.apiKey,
        warning: data.warning,
      });
      invalidate();
    },
    onError: (err) =>
      toast({
        title: 'Falha ao criar API Key',
        description: err.message,
        variant: 'destructive',
      }),
  });

  const revokeKey = useMutation({
    mutationFn: (id) => clarity.revokeIntegrationApiKey(id, tenantId),
    onSuccess: () => {
      toast({ title: 'API Key revogada' });
      setRevokeId(null);
      invalidate();
    },
    onError: (err) =>
      toast({
        title: 'Falha ao revogar',
        description: err.message,
        variant: 'destructive',
      }),
  });

  const createHook = useMutation({
    mutationFn: () =>
      clarity.createWebhookEndpoint({
        tenantId,
        name: hookForm.name.trim(),
        targetUrl: hookForm.targetUrl.trim(),
        events: hookForm.events
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: (data) => {
      setHookOpen(false);
      setHookForm({
        name: '',
        targetUrl: '',
        events: 'group.created, company.created, company.updated',
      });
      setSecretReveal({
        type: 'signingSecret',
        value: data.signingSecret,
        warning: data.warning,
      });
      invalidate();
    },
    onError: (err) =>
      toast({
        title: 'Falha ao criar webhook',
        description: err.message,
        variant: 'destructive',
      }),
  });

  const dispatchHook = useMutation({
    mutationFn: () => {
      let payload;
      try {
        payload = JSON.parse(dispatchForm.payload);
      } catch {
        throw new Error('Payload JSON inválido');
      }
      return clarity.dispatchWebhook({
        tenantId,
        event: dispatchForm.event.trim(),
        payload,
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Dispatch enviado',
        description: `${data.deliveries?.length ?? 0} endpoint(s)`,
      });
      setDispatchOpen(false);
      invalidate();
    },
    onError: (err) =>
      toast({
        title: 'Falha no dispatch',
        description: err.message,
        variant: 'destructive',
      }),
  });

  const saveProtheus = useMutation({
    mutationFn: () => {
      if (!protheusForm.password.trim()) {
        throw new Error('Informe a senha Protheus para salvar a conexão');
      }
      return clarity.upsertProtheusConnection({
        tenantId,
        baseUrl: protheusForm.baseUrl.trim(),
        username: protheusForm.username.trim(),
        password: protheusForm.password,
        companyCode: protheusForm.companyCode.trim() || '01',
        branchCode: protheusForm.branchCode.trim() || '01',
      });
    },
    onSuccess: () => {
      toast({ title: 'Conexão Protheus salva' });
      setProtheusForm((f) => ({ ...f, password: '' }));
      queryClient.invalidateQueries({ queryKey: [...qKey, 'protheus'] });
    },
    onError: (err) =>
      toast({
        title: 'Falha ao salvar Protheus',
        description: err.message,
        variant: 'destructive',
      }),
  });

  const fetchChart = useMutation({
    mutationFn: async () => {
      if (!protheusForm.password.trim()) {
        throw new Error(
          'Informe a senha Protheus e salve/busque de novo (evita 401 com credencial antiga).',
        );
      }
      await clarity.upsertProtheusConnection({
        tenantId,
        baseUrl: protheusForm.baseUrl.trim(),
        username: protheusForm.username.trim(),
        password: protheusForm.password,
        companyCode: protheusForm.companyCode.trim() || '01',
        branchCode: protheusForm.branchCode.trim() || '01',
      });
      setProtheusForm((f) => ({ ...f, password: '' }));
      queryClient.invalidateQueries({ queryKey: [...qKey, 'protheus'] });
      return clarity.fetchProtheusResource({
        tenantId,
        resource: 'chart_of_accounts',
        pathOverride: protheusForm.pathOverride.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      setChartAccounts(data);
      toast({
        title: 'Plano de contas',
        description:
          data.fetchedTotal != null && data.fetchedTotal !== data.count
            ? `${data.count} conta(s) ativa(s) · ${data.fetchedTotal - data.count} bloqueada(s) ignorada(s)`
            : `${data.count} conta(s) ativa(s)${data.authMode?.includes('bloq_map_empty') || data.authMode?.includes('bloq_filter_failed') ? ' (aviso: API de saldos não informa bloqueio; filtro CT1 indisponível)' : ''}`,
      });
    },
    onError: (err) =>
      toast({
        title: 'Falha ao buscar plano de contas',
        description: err.message,
        variant: 'destructive',
      }),
  });

  const discoverProtheus = useMutation({
    mutationFn: async () => {
      if (!protheusForm.password.trim()) {
        throw new Error('Informe a senha Protheus antes de descobrir.');
      }
      await clarity.upsertProtheusConnection({
        tenantId,
        baseUrl: protheusForm.baseUrl.trim(),
        username: protheusForm.username.trim(),
        password: protheusForm.password,
        companyCode: protheusForm.companyCode.trim() || '01',
        branchCode: protheusForm.branchCode.trim() || '01',
      });
      setProtheusForm((f) => ({ ...f, password: '' }));
      queryClient.invalidateQueries({ queryKey: [...qKey, 'protheus'] });
      return clarity.discoverProtheus({ tenantId });
    },
    onSuccess: (data) => {
      setDiscoverResult(data);
      toast({
        title: 'Descoberta Protheus',
        description: `${data.companies?.length ?? 0} empresa(s), ${data.branches?.length ?? 0} filial(is)`,
      });
    },
    onError: (err) =>
      toast({
        title: 'Falha ao descobrir empresa/filial',
        description: err.message,
        variant: 'destructive',
      }),
  });

  const importToFal = useMutation({
    mutationFn: async () => {
      if (!chartAccounts?.items?.length) {
        throw new Error('Nenhuma conta carregada do Protheus');
      }
      if (!tenantId) throw new Error('Tenant não selecionado');

      let planId = importPlanId;
      let planName = '';

      if (importMode === 'new') {
        const name =
          importPlanName.trim() ||
          `Protheus ${new Date().toLocaleDateString('pt-BR')}`;
        const created = await base44.entities.FinancialAccountPlan.create({
          tenant_id: tenantId,
          name,
          description: `Importado do Protheus (job ${chartAccounts.jobId || '—'})`,
          version: 'v1.0',
          is_active: true,
          is_default: false,
        });
        planId = created.id;
        planName = created.name;
      } else {
        if (!planId) throw new Error('Selecione um plano existente');
        const plan = (plansQ.data || []).find((p) => p.id === planId);
        planName = plan?.name || planId;
      }

      const rawItems = chartAccounts.items || [];
      const hasBloqFlag = rawItems.some((row) => {
        const raw = row?.raw && typeof row.raw === 'object' ? row.raw : {};
        const v =
          row.blockedFlag ??
          row.CT1_BLOQ ??
          row.bloq ??
          row.ct1_bloq ??
          row.blocked ??
          raw.CT1_BLOQ ??
          raw.ct1_bloq ??
          raw.bloq;
        return v != null && String(v).trim() !== '';
      });
      if (!hasBloqFlag) {
        throw new Error(
          'Esta busca ainda não tem filtro CT1_BLOQ (contas bloqueadas). Clique em “Buscar plano de contas” de novo e depois importe.',
        );
      }
      // Filtro na importação: remove CT1_BLOQ=1 (bloqueada)
      const activeItems = rawItems.filter(isProtheusAccountActive);
      const blockedSkipped = rawItems.length - activeItems.length;

      const lines = buildAccountPlanLinesFromProtheus(activeItems, {
        planId,
        tenantId,
      });
      if (lines.length === 0) {
        throw new Error(
          'Nenhuma conta ativa válida para importar. Busque o plano de novo (filtro CT1_BLOQ).',
        );
      }

      // Substitui linhas do plano (limpa + grava) — nunca duplica
      await replaceAccountPlanLines({
        planId,
        tenantId,
        lines,
      });

      try {
        await base44.entities.FinancialAccountPlan.update(planId, {
          description: `Importado do Protheus (job ${chartAccounts.jobId || '—'})`,
        });
      } catch {
        // opcional
      }

      return {
        planId,
        planName,
        count: lines.length,
        blockedSkipped,
        fetched: rawItems.length,
      };
    },
    onSuccess: (data) => {
      setImportOpen(false);
      queryClient.invalidateQueries({
        queryKey: ['financial-account-plans', tenantId],
      });
      toast({
        title: 'Plano de contas atualizado',
        description:
          data.blockedSkipped > 0
            ? `${data.count} conta(s) ativa(s) em “${data.planName}” · ${data.blockedSkipped} bloqueada(s) ignorada(s)`
            : `${data.count} conta(s) ativa(s) em “${data.planName}”`,
      });
    },
    onError: (err) =>
      toast({
        title: 'Falha ao importar para o FAL',
        description: err.message,
        variant: 'destructive',
      }),
  });

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado' });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  }

  if (!canManage) {
    return (
      <div className="p-8 text-center text-slate-400">
        Acesso restrito a administradores.
      </div>
    );
  }

  if (!CLARITY_FEATURES.useClarityIntegrations) {
    return (
      <div className="p-8 text-center text-slate-400">
        Integrações desativadas. Defina <code>VITE_CLARITY_INTEGRATIONS=true</code>.
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="p-8 text-center text-slate-400">
        Selecione um tenant para gerenciar integrações.
      </div>
    );
  }

  const connections = connectionsQ.data ?? [];
  const apiKeys = keysQ.data ?? [];
  const hooks = hooksQ.data ?? [];
  const inbound = eventsQ.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl fal-title">Integrações</h1>
          <p className="fal-muted text-sm mt-1">
            Conecte ERPs e sistemas externos · tenant{' '}
            <span className="font-medium text-slate-700">{tenant?.name || tenantId}</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => invalidate()}
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4" />
            Protheus · Plano de contas
            {protheusQ.data?.isActive && (
              <Badge className="bg-emerald-100 text-emerald-700 ml-2">Conectado</Badge>
            )}
          </CardTitle>
          <p className="text-xs text-slate-500">
            Path sugerido: <code className="text-[11px]">/CtbRestSaldos/consultar</code>{' '}
            (saldos CTB — POST). Alternativa oficial:{' '}
            <code className="text-[11px]">/api/ctb/balance/model1</code>.
            Informe senha e Empresa/Filial corretas (ex.: 01 / 0104).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Base URL">
              <Input
                value={protheusForm.baseUrl}
                onChange={(e) =>
                  setProtheusForm((f) => ({ ...f, baseUrl: e.target.value }))
                }
              />
            </Field>
            <Field label="Usuário">
              <Input
                value={protheusForm.username}
                onChange={(e) =>
                  setProtheusForm((f) => ({ ...f, username: e.target.value }))
                }
              />
            </Field>
            <Field label="Senha">
              <Input
                type="password"
                value={protheusForm.password}
                placeholder={
                  protheusQ.data ? '•••••••• (informe para alterar)' : 'Senha Protheus'
                }
                onChange={(e) =>
                  setProtheusForm((f) => ({ ...f, password: e.target.value }))
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Empresa (contexto)">
                <Input
                  value={protheusForm.companyCode}
                  placeholder="01"
                  onChange={(e) =>
                    setProtheusForm((f) => ({ ...f, companyCode: e.target.value }))
                  }
                />
              </Field>
              <Field label="Filial (contexto)">
                <Input
                  value={protheusForm.branchCode}
                  placeholder="01"
                  onChange={(e) =>
                    setProtheusForm((f) => ({ ...f, branchCode: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Caminho REST do plano de contas (opcional)">
              <Input
                value={protheusForm.pathOverride}
                placeholder="/api/seu-servico/v1/planocontas"
                onChange={(e) =>
                  setProtheusForm((f) => ({ ...f, pathOverride: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={saveProtheus.isPending}
              onClick={() => saveProtheus.mutate()}
            >
              {saveProtheus.isPending ? 'Salvando…' : 'Salvar conexão'}
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={fetchChart.isPending}
              onClick={() => fetchChart.mutate()}
            >
              {fetchChart.isPending ? 'Buscando…' : 'Buscar plano de contas'}
            </Button>
            <Button
              variant="outline"
              disabled={discoverProtheus.isPending}
              onClick={() => discoverProtheus.mutate()}
            >
              {discoverProtheus.isPending ? 'Descobrindo…' : 'Descobrir empresa/filial'}
            </Button>
          </div>

          {discoverResult && (
            <div className="space-y-2 pt-2 border-t text-xs">
              <p className="text-slate-600">
                <strong>Atenção:</strong> grupos como <code>DEFAULT</code> /{' '}
                <code>Administradores</code> <em>não</em> são Empresa/Filial.
                Procure códigos tipo <code>01</code>, <code>M0_CODIGO</code>,{' '}
                <code>M0_CODFIL</code>.
                {discoverResult.hint ? (
                  <>
                    <br />
                    {discoverResult.hint}
                  </>
                ) : null}
              </p>
              <pre className="bg-slate-50 rounded-lg p-3 overflow-x-auto max-h-48 text-[11px] text-slate-700">
                {JSON.stringify(
                  {
                    companies: discoverResult.companies,
                    branches: discoverResult.branches,
                    attempts: discoverResult.attempts,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          )}

          {chartAccounts && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs text-slate-500">
                {chartAccounts.count} conta(s) ativa(s)
                {chartAccounts.fetchedTotal != null &&
                chartAccounts.fetchedTotal !== chartAccounts.count
                  ? ` · ${chartAccounts.fetchedTotal - chartAccounts.count} bloqueada(s) ignorada(s)`
                  : null}
                {' · '}job {chartAccounts.jobId}
                {chartAccounts.url ? (
                  <>
                    <br />
                    <span className="font-mono break-all">{chartAccounts.url}</span>
                  </>
                ) : null}
              </p>
              {chartAccounts.count === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">
                  Nenhuma conta retornada. Verifique o caminho REST no Protheus.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        setImportMode('new');
                        setImportPlanName(
                          `Protheus ${new Date().toLocaleDateString('pt-BR')}`,
                        );
                        setImportPlanId(plansQ.data?.[0]?.id || '');
                        setImportOpen(true);
                      }}
                    >
                      <Download className="w-4 h-4" />
                      Importar para o FAL
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to={createPageUrl('FinancialAccountPlanManager')}>
                        Abrir planos de contas
                      </Link>
                    </Button>
                  </div>
                  <div className="overflow-x-auto max-h-80 rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 sticky top-0">
                        <tr className="text-left text-xs text-white">
                          <th className="p-2 font-medium">Código</th>
                          <th className="p-2 font-medium">Descrição</th>
                          <th className="p-2 font-medium">Classe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedChartItems.map((row) => (
                          <tr key={row.externalId} className="border-t">
                            <td className="p-2 font-mono text-xs">
                              {row.code || row.externalId}
                            </td>
                            <td className="p-2">{row.name || '—'}</td>
                            <td className="p-2 text-xs text-slate-500">
                              {row.classType === '1' || row.classType === 1
                                ? '1 · Sintética'
                                : row.classType === '2' || row.classType === 2
                                  ? '2 · Analítica'
                                  : row.classType || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="connections" className="gap-1.5">
            <Cable className="w-3.5 h-3.5" /> Conexões
          </TabsTrigger>
          <TabsTrigger value="keys" className="gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5">
            <Webhook className="w-3.5 h-3.5" /> Webhooks
          </TabsTrigger>
          <TabsTrigger value="inbound" className="gap-1.5">
            <Inbox className="w-3.5 h-3.5" /> Eventos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setConnOpen(true)}
            >
              <Plus className="w-4 h-4" /> Nova conexão
            </Button>
          </div>
          {connectionsQ.isLoading ? (
            <SkeletonList />
          ) : connections.length === 0 ? (
            <EmptyState
              icon={Cable}
              title="Nenhuma conexão"
              hint="Cadastre URL e credenciais do sistema externo."
            />
          ) : (
            <div className="space-y-3">
              {connections.map((c) => (
                <Card key={c.id} className="border-0 shadow-sm">
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-sm">{c.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <span className="font-mono">{c.provider}</span>
                        {c.baseUrl ? ` · ${c.baseUrl}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Auth: {c.authType} · Dir: {c.direction}
                      </p>
                    </div>
                    <StatusBadge active={c.isActive} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="keys" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setKeyOpen(true)}
            >
              <Plus className="w-4 h-4" /> Nova API Key
            </Button>
          </div>
          {keysQ.isLoading ? (
            <SkeletonList />
          ) : apiKeys.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="Nenhuma API Key"
              hint="Gere uma chave para parceiros enviarem eventos ao FAL."
            />
          ) : (
            <div className="space-y-3">
              {apiKeys.map((k) => (
                <Card key={k.id} className="border-0 shadow-sm">
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{k.name}</p>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">
                        {k.keyPrefix}…
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 truncate">
                        Scopes: {(k.scopes || []).join(', ') || '—'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Último uso: {formatDate(k.lastUsedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge active={k.isActive} revoked={!!k.revokedAt} />
                      {k.isActive && !k.revokedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setRevokeId(k.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4 mt-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setDispatchOpen(true)}>
              <Send className="w-4 h-4" /> Dispatch teste
            </Button>
            <Button
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setHookOpen(true)}
            >
              <Plus className="w-4 h-4" /> Novo endpoint
            </Button>
          </div>
          {hooksQ.isLoading ? (
            <SkeletonList />
          ) : hooks.length === 0 ? (
            <EmptyState
              icon={Webhook}
              title="Nenhum webhook"
              hint="Cadastre URLs que o FAL notificará com HMAC."
            />
          ) : (
            <div className="space-y-3">
              {hooks.map((h) => (
                <Card key={h.id} className="border-0 shadow-sm">
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{h.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{h.targetUrl}</p>
                      <p className="text-[11px] text-slate-400 mt-1 truncate">
                        Eventos: {(h.events || []).join(', ')}
                      </p>
                    </div>
                    <StatusBadge active={h.isActive} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inbound" className="space-y-4 mt-4">
          {eventsQ.isLoading ? (
            <SkeletonList />
          ) : inbound.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Nenhum evento recebido"
              hint="Parceiros enviam via POST /integrations/partner/webhooks/:provider"
            />
          ) : (
            <div className="space-y-3">
              {inbound.map((e) => (
                <Card key={e.id} className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm">{e.eventType}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          <span className="font-mono">{e.provider}</span>
                          {e.externalId ? ` · ${e.externalId}` : ''}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {formatDate(e.createdAt)}
                      </span>
                    </div>
                    <pre className="mt-3 text-[11px] bg-slate-50 rounded-lg p-3 overflow-x-auto max-h-40 text-slate-600">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: conexão */}
      <Dialog open={connOpen} onOpenChange={setConnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conexão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field label="Provider">
              <Input
                value={connForm.provider}
                onChange={(e) => setConnForm((f) => ({ ...f, provider: e.target.value }))}
                placeholder="custom-erp"
              />
            </Field>
            <Field label="Nome">
              <Input
                value={connForm.name}
                onChange={(e) => setConnForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ERP Principal"
              />
            </Field>
            <Field label="Base URL">
              <Input
                value={connForm.baseUrl}
                onChange={(e) => setConnForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://erp.empresa.com/api"
              />
            </Field>
            <Field label="Tipo de auth">
              <Input
                value={connForm.authType}
                onChange={(e) => setConnForm((f) => ({ ...f, authType: e.target.value }))}
                placeholder="api_key | basic | oauth2 | none"
              />
            </Field>
            <Field label="API Key / segredo (opcional)">
              <Input
                type="password"
                value={connForm.apiKeySecret}
                onChange={(e) =>
                  setConnForm((f) => ({ ...f, apiKeySecret: e.target.value }))
                }
                placeholder="Será criptografado no servidor"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!connForm.name.trim() || !connForm.provider.trim() || upsertConn.isPending}
              onClick={() => upsertConn.mutate()}
            >
              {upsertConn.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: API Key */}
      <Dialog open={keyOpen} onOpenChange={setKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field label="Nome">
              <Input
                value={keyForm.name}
                onChange={(e) => setKeyForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Parceiro BI"
              />
            </Field>
            <Field label="Scopes (vírgula)">
              <Input
                value={keyForm.scopes}
                onChange={(e) => setKeyForm((f) => ({ ...f, scopes: e.target.value }))}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!keyForm.name.trim() || createKey.isPending}
              onClick={() => createKey.mutate()}
            >
              {createKey.isPending ? 'Gerando…' : 'Gerar chave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: webhook endpoint */}
      <Dialog open={hookOpen} onOpenChange={setHookOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo webhook outbound</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field label="Nome">
              <Input
                value={hookForm.name}
                onChange={(e) => setHookForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Notificar CRM"
              />
            </Field>
            <Field label="URL de destino">
              <Input
                value={hookForm.targetUrl}
                onChange={(e) => setHookForm((f) => ({ ...f, targetUrl: e.target.value }))}
                placeholder="https://crm.empresa.com/hooks/fal"
              />
            </Field>
            <Field label="Eventos (vírgula)">
              <Input
                value={hookForm.events}
                onChange={(e) => setHookForm((f) => ({ ...f, events: e.target.value }))}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHookOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !hookForm.name.trim() ||
                !hookForm.targetUrl.trim() ||
                createHook.isPending
              }
              onClick={() => createHook.mutate()}
            >
              {createHook.isPending ? 'Criando…' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: dispatch */}
      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispatch de teste</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field label="Evento">
              <Input
                value={dispatchForm.event}
                onChange={(e) =>
                  setDispatchForm((f) => ({ ...f, event: e.target.value }))
                }
              />
            </Field>
            <Field label="Payload JSON">
              <textarea
                className="w-full min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={dispatchForm.payload}
                onChange={(e) =>
                  setDispatchForm((f) => ({ ...f, payload: e.target.value }))
                }
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!dispatchForm.event.trim() || dispatchHook.isPending}
              onClick={() => dispatchHook.mutate()}
            >
              {dispatchHook.isPending ? 'Enviando…' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Segredo exibido uma vez */}
      <Dialog open={!!secretReveal} onOpenChange={(o) => !o && setSecretReveal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {secretReveal?.type === 'apiKey' ? 'API Key gerada' : 'Signing secret'}
            </DialogTitle>
          </DialogHeader>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-700">
                {secretReveal?.warning || 'Guarde agora — não será exibido de novo.'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <code className="flex-1 text-xs break-all bg-slate-50 p-3 rounded-lg">
                {secretReveal?.value}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyText(secretReveal?.value || '')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
          <DialogFooter>
            <Button onClick={() => setSecretReveal(null)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeId} onOpenChange={(o) => !o && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Parceiros com essa chave deixam de autenticar imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => revokeId && revokeKey.mutate(revokeId)}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar contas para o FAL</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500">
              {chartAccounts?.count || 0} conta(s) ativa(s) do Protheus serão gravadas
              como linhas de plano de contas.
              {importMode === 'existing'
                ? ' As contas atuais do plano selecionado serão substituídas.'
                : ' Classificação gerencial (BP/DRE) fica para depois.'}
            </p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={importMode === 'new'}
                  onChange={() => setImportMode('new')}
                />
                Criar plano novo
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={importMode === 'existing'}
                  onChange={() => setImportMode('existing')}
                />
                Usar plano existente
              </label>
            </div>
            {importMode === 'new' ? (
              <Field label="Nome do plano">
                <Input
                  value={importPlanName}
                  onChange={(e) => setImportPlanName(e.target.value)}
                  placeholder="Protheus 14/08/2026"
                />
              </Field>
            ) : (
              <Field label="Plano">
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={importPlanId}
                  onChange={(e) => setImportPlanId(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {(plansQ.data || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={importToFal.isPending}
              onClick={() => importToFal.mutate()}
            >
              {importToFal.isPending ? 'Importando…' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="text-center py-14 text-slate-400">
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="text-xs mt-1 max-w-sm mx-auto">{hint}</p>
    </div>
  );
}
