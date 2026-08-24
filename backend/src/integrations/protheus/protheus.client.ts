/**
 * Thin REST client for TOTVS Protheus REST adapters.
 *
 * Auth order (Totvs Cloud varia por ambiente):
 *  1) Sessão HTML do /rest (__USER/__PSW) — costuma funcionar no cloudtotvs
 *  2) OAuth2 Bearer /api/oauth2/v1/token
 *  3) Basic Auth
 *
 * Empresa/Filial NÃO são campos do CT1: são contexto multiempresa.
 */
export type ProtheusAuth = {
  baseUrl: string;
  username: string;
  password: string;
  companyCode: string;
  branchCode?: string | null;
};

export type ProtheusFetchResult = {
  items: Array<{ externalId: string; payload: Record<string, unknown> }>;
  rawStatus: number;
  url: string;
  authMode?: string;
  /** Quantidade antes do filtro CT1_BLOQ (se aplicado). */
  rawCountBeforeFilter?: number;
};

type AuthContext = {
  mode: string;
  headers: Record<string, string>;
  cookie?: string;
};

const DEFAULT_RESOURCE_PATHS: Record<string, string> = {
  chart_of_accounts: '/CtbRestSaldos/consultar',
  trial_balance: '/api/ctb/balance/model1',
  customers: '/api/clarity/v1/customers',
};

const DEFAULT_TABLE_BY_RESOURCE: Record<string, string> = {
  chart_of_accounts: 'CT1',
};

export class ProtheusClient {
  constructor(private readonly auth: ProtheusAuth) {}

  private rootBase(): string {
    return this.auth.baseUrl.replace(/\/$/, '');
  }

  private empresa(): string {
    return (this.auth.companyCode || '01').trim() || '01';
  }

  private filial(): string {
    return (this.auth.branchCode || '01').trim() || '01';
  }

  private contextHeaders(): Record<string, string> {
    const empresa = this.empresa();
    const filial = this.filial();
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      tenantId: `${empresa},${filial}`,
      Empresa: empresa,
      Filial: filial,
    };
  }

  private collectCookies(res: Response): string {
    const parts: string[] = [];
    const anyHeaders = res.headers as Headers & {
      getSetCookie?: () => string[];
    };
    if (typeof anyHeaders.getSetCookie === 'function') {
      for (const c of anyHeaders.getSetCookie()) {
        parts.push(c.split(';')[0]);
      }
    }
    const single = res.headers.get('set-cookie');
    if (single) {
      // pode vir concatenado
      for (const chunk of single.split(/,(?=[^;]+?=)/)) {
        parts.push(chunk.split(';')[0].trim());
      }
    }
    return [...new Set(parts.filter(Boolean))].join('; ');
  }

  /** Login da página /rest (mesmo fluxo do catálogo HTML). */
  async obtainSessionCookie(): Promise<string> {
    const body = new URLSearchParams({
      __USER: this.auth.username,
      __PSW: this.auth.password,
    });

    const res = await fetch(`${this.rootBase()}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/json',
      },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });

    let cookie = this.collectCookies(res);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location') || '/';
      const followUrl = loc.startsWith('http')
        ? loc
        : `${this.rootBase()}${loc.startsWith('/') ? '' : '/'}${loc}`;
      const follow = await fetch(followUrl, {
        headers: {
          Cookie: cookie,
          Accept: 'text/html,application/json',
        },
        signal: AbortSignal.timeout(30_000),
      });
      cookie = this.collectCookies(follow) || cookie;
    }

    // Alguns ambientes devolvem 200 com o catálogo + cookie
    if (!cookie && res.status === 200) {
      const html = await res.clone().text().catch(() => '');
      if (/accordion|RESTFul/i.test(html) && !/name="__USER"/i.test(html)) {
        // sessão implícita sem set-cookie útil — segue sem cookie
        return '';
      }
    }

    if (!cookie && res.status >= 400) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Protheus session login HTTP ${res.status}: ${text.slice(0, 200)}`,
      );
    }

    return cookie;
  }

  async obtainAccessToken(): Promise<string> {
    // Prefer body form (mais seguro / aceito em vários builds)
    const tokenUrl = new URL('api/oauth2/v1/token', `${this.rootBase()}/`);
    tokenUrl.searchParams.set('grant_type', 'password');
    tokenUrl.searchParams.set('username', this.auth.username);
    tokenUrl.searchParams.set('password', this.auth.password);

    const res = await fetch(tokenUrl.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        tenantId: `${this.empresa()},${this.filial()}`,
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: this.auth.username,
        password: this.auth.password,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(
        `Protheus OAuth HTTP ${res.status}: ${text.slice(0, 300) || res.statusText}`,
      );
    }

    const json = JSON.parse(text) as Record<string, unknown>;
    const token = String(json.access_token || '');
    if (!token) throw new Error('Protheus OAuth: access_token ausente');
    return token;
  }

  private async resolveAuth(): Promise<{ auth: AuthContext; errors: string[] }> {
    const errors: string[] = [];

    // 1) Sessão /rest
    try {
      const cookie = await this.obtainSessionCookie();
      if (cookie) {
        return {
          auth: {
            mode: 'session',
            headers: { Cookie: cookie },
            cookie,
          },
          errors,
        };
      }
      errors.push('session: sem cookie (pode ainda funcionar em alguns hosts)');
      // tenta mesmo assim com session vazia + basic depois
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }

    // 2) OAuth
    try {
      const token = await this.obtainAccessToken();
      return {
        auth: {
          mode: 'bearer',
          headers: { Authorization: `Bearer ${token}` },
        },
        errors,
      };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }

    // 3) Basic
    const basic = Buffer.from(
      `${this.auth.username}:${this.auth.password}`,
      'utf8',
    ).toString('base64');
    return {
      auth: {
        mode: 'basic',
        headers: { Authorization: `Basic ${basic}` },
      },
      errors,
    };
  }

  async fetchResource(
    resource: string,
    pathOverride?: string,
    opts?: { table?: string },
  ): Promise<ProtheusFetchResult> {
    const rawPath =
      pathOverride?.trim() ||
      DEFAULT_RESOURCE_PATHS[resource] ||
      (resource.startsWith('/') ? resource : null);

    if (!rawPath) {
      throw new Error(
        `Unsupported Protheus resource: ${resource}. Informe pathOverride.`,
      );
    }

    let result: ProtheusFetchResult;

    // CtbRestSaldos: no catálogo = GET/POST consultar — usa POST com body
    if (/ctbrestsaldos/i.test(rawPath)) {
      result = await this.fetchCtbRestSaldos(rawPath);
    } else if (
      /api\/ctb\/balance\/model1/i.test(rawPath) ||
      resource === 'trial_balance'
    ) {
      result = await this.fetchBalanceModel1();
    } else {
      result = await this.fetchGenericGet(resource, rawPath, opts);
    }

    // Sempre remove CT1_BLOQ=1 no plano de contas (qualquer path / fallback)
    if (resource === 'chart_of_accounts') {
      return this.filterChartToActiveAccounts(result);
    }
    return result;
  }

  /**
   * CtbRestSaldos / balance NÃO devolvem CT1_BLOQ. Busca CT1 (genericQuery) e
   * remove contas com CT1_BLOQ = 1 (bloqueadas). Mantém só ativas (2).
   * Falha fechada: sem mapa CT1, não devolve o plano completo (mistura bloqueadas).
   */
  private async filterChartToActiveAccounts(
    saldos: ProtheusFetchResult,
  ): Promise<ProtheusFetchResult> {
    const bloqMap = await this.fetchCt1BloqByCode();
    if (!bloqMap.size) {
      throw new Error(
        'Não foi possível consultar CT1_BLOQ no Protheus (genericQuery). ' +
          'Sem esse filtro o plano viria com contas bloqueadas. Tente de novo ou libere o endpoint genericQuery.',
      );
    }

    const lookupBloq = (code: string): string | undefined => {
      if (!code) return undefined;
      const direct = bloqMap.get(code);
      if (direct != null) return direct;
      // Fallback leve: sem zeros à esquerda (só se a chave normalizada for única no mapa)
      const stripped = code.replace(/^0+/, '') || '0';
      if (stripped === code) return undefined;
      const directStripped = bloqMap.get(stripped);
      if (directStripped != null) return directStripped;
      return undefined;
    };

    const filtered = saldos.items
      .map((item) => {
        const code = String(
          item.externalId ||
            item.payload?.conta ||
            item.payload?.CT1_CONTA ||
            item.payload?.ct1_conta ||
            '',
        ).trim();
        const bloq = lookupBloq(code);
        const payload = {
          ...item.payload,
          ...(bloq != null ? { CT1_BLOQ: bloq, bloq, ct1_bloq: bloq } : {}),
        };
        return { ...item, payload, externalId: code || item.externalId };
      })
      .filter((item) => {
        const code = String(item.externalId || '').trim();
        const bloq = lookupBloq(code);
        // Só importa conta comprovadamente ativa (2). Bloqueada (1) ou sem CT1 → fora.
        return bloq === '2';
      });

    return {
      ...saldos,
      items: filtered,
      rawCountBeforeFilter: saldos.items.length,
      authMode: `${saldos.authMode || 'saldos'}+ct1_bloq_active_only(${bloqMap.size}→${filtered.length})`,
    };
  }

  /**
   * Mapa conta → CT1_BLOQ ('1' bloqueada | '2' ativa).
   *
   * Importante: no genericQuery da TOTVS Cloud, NÃO enviar Empresa/Filial na query
   * string — o adapter trata cada query param como campo e responde
   * `Field FILIAL not found`. Contexto vai só nos headers.
   */
  private async fetchCt1BloqByCode(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const empresa = this.empresa();
    const filial = this.filial();
    const { auth } = await this.resolveAuth();
    const attempts = this.buildAuthAttempts(auth);
    const pageSize = 100;

    // Preferir path relativo a /rest (baseUrl já termina em /rest)
    const paths = uniquePaths([
      '/api/framework/v1/genericQuery',
      '/api/framework/v1/genericquery',
    ]);

    // "all" primeiro: mapa completo (ativa+bloqueada) para filtrar saldos com precisão
    const queryVariants: Array<{
      label: string;
      params: Record<string, string>;
    }> = [
      {
        label: 'all',
        params: {
          tables: 'CT1',
          fields: 'CT1_CONTA,CT1_BLOQ',
        },
      },
      {
        label: 'active-eq',
        params: {
          tables: 'CT1',
          fields: 'CT1_CONTA,CT1_BLOQ',
          filter: "CT1_BLOQ eq '2'",
        },
      },
      {
        label: 'active-plain',
        params: {
          tables: 'CT1',
          fields: 'CT1_CONTA,CT1_BLOQ',
          filter: "CT1_BLOQ='2'",
        },
      },
    ];

    const tenantVariants = [`${empresa},${filial}`, empresa, ''];

    for (const path of paths) {
      for (const variant of queryVariants) {
        for (const tenantId of tenantVariants) {
          for (const attempt of attempts) {
            let page = 1;
            let gotAny = false;
            const pageMap = new Map<string, string>();
            while (page <= 200) {
              const url = new URL(path.replace(/^\//, ''), `${this.rootBase()}/`);
              for (const [k, v] of Object.entries(variant.params)) {
                url.searchParams.set(k, v);
              }
              url.searchParams.set('page', String(page));
              url.searchParams.set('pageSize', String(pageSize));
              url.searchParams.set('pagesize', String(pageSize));
              // NÃO setar Empresa/Filial na URL — quebra o genericQuery

              const headers: Record<string, string> = {
                Accept: 'application/json',
                ...attempt.headers,
                Empresa: empresa,
                Filial: filial,
              };
              if (tenantId) headers.tenantId = tenantId;

              const response = await fetch(url.toString(), {
                method: 'GET',
                headers,
                signal: AbortSignal.timeout(60_000),
              });
              if (!response.ok) break;

              const data = (await response.json().catch(() => null)) as unknown;
              const rows = normalizeRows(data);
              if (!rows.length) break;

              gotAny = true;
              for (const row of rows) {
                if (!row || typeof row !== 'object') continue;
                const obj = row as Record<string, unknown>;
                const code = String(
                  obj.CT1_CONTA ?? obj.ct1_conta ?? obj.conta ?? obj.CONTA ?? '',
                ).trim();
                if (!code) continue;
                const rawBloq =
                  obj.CT1_BLOQ ?? obj.ct1_bloq ?? obj.BLOQ ?? obj.bloq;
                const bloqStr = String(rawBloq ?? '')
                  .trim()
                  .toUpperCase();
                // Consulta "só ativas": ausência de BLOQ = ativa. Consulta "all": sem campo = desconhecido.
                if (!bloqStr) {
                  if (variant.label.startsWith('active')) {
                    pageMap.set(code, '2');
                  }
                  continue;
                }
                pageMap.set(code, bloqStr === '1' ? '1' : '2');
              }

              if (rows.length < pageSize) break;
              page += 1;
            }

            if (gotAny && pageMap.size > 0) {
              for (const [k, v] of pageMap) map.set(k, v);
              return map;
            }
          }
        }
      }
    }

    // Fallback: binding chart of accounts (alguns clouds TOTVS)
    const bindingPaths = uniquePaths([
      '/v2/bindingchartofaccounts/account',
      '/v1/bindingchartofaccounts/account',
      '/api/v2/bindingchartofaccounts/account',
    ]);
    for (const path of bindingPaths) {
      for (const tenantId of [`${empresa},${filial}`, empresa, '']) {
        for (const attempt of attempts) {
          const url = new URL(path.replace(/^\//, ''), `${this.rootBase()}/`);
          url.searchParams.set('empresa', empresa);
          url.searchParams.set('filial', filial);
          url.searchParams.set('tabela', 'CT1');
          const headers: Record<string, string> = {
            Accept: 'application/json',
            ...attempt.headers,
            Empresa: empresa,
            Filial: filial,
          };
          if (tenantId) headers.tenantId = tenantId;
          const response = await fetch(url.toString(), {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(60_000),
          });
          if (!response.ok) continue;
          const data = (await response.json().catch(() => null)) as unknown;
          const rows = normalizeRows(data);
          for (const row of rows) {
            if (!row || typeof row !== 'object') continue;
            const obj = row as Record<string, unknown>;
            const code = String(
              obj.CT1_CONTA ??
                obj.ct1_conta ??
                obj.conta ??
                obj.account ??
                obj.accountCode ??
                obj.code ??
                '',
            ).trim();
            if (!code) continue;
            const bloqRaw = String(
              obj.CT1_BLOQ ??
                obj.ct1_bloq ??
                obj.BLOQ ??
                obj.bloq ??
                obj.blocked ??
                obj.status ??
                '',
            )
              .trim()
              .toUpperCase();
            if (
              bloqRaw === '1' ||
              bloqRaw === 'S' ||
              bloqRaw === 'BLOCKED' ||
              bloqRaw === 'BLOQUEADA'
            ) {
              map.set(code, '1');
            } else if (
              bloqRaw === '2' ||
              bloqRaw === 'A' ||
              bloqRaw === 'ACTIVE' ||
              bloqRaw === 'ATIVA' ||
              bloqRaw === ''
            ) {
              map.set(code, '2');
            }
          }
          if (map.size > 0) return map;
        }
      }
    }

    return map;
  }

  /** POST /CtbRestSaldos/consultar — saldos (traz contas + valores). */
  private async fetchCtbRestSaldos(pathHint: string): Promise<ProtheusFetchResult> {
    let empresa = this.empresa();
    let filial = this.filial();
    const { auth, errors } = await this.resolveAuth();
    const authAttempts = this.buildAuthAttempts(auth);

    // erp_context já autenticou (200) neste ambiente — usa para ajustar tenant
    const ctx = await this.readErpContext(authAttempts);
    if (ctx?.empresa) empresa = ctx.empresa;
    if (ctx?.filial) filial = ctx.filial;

    const year = new Date().getFullYear();
    const bodies: Array<{ label: string; body: Record<string, unknown> }> = [
      {
        label: 'v1',
        body: {
          EMPRESA: empresa,
          FILIAL: filial,
          DATADE: `01/01/${year}`,
          DATAATE: `31/12/${year}`,
          CONTADE: '',
          CONTAATE: 'ZZZZZZZZZZ',
        },
      },
      {
        label: 'v2',
        body: {
          cEmp: empresa,
          cFil: filial,
          dDataDe: `${year}0101`,
          dDataAte: `${year}1231`,
        },
      },
      {
        label: 'empty',
        body: {},
      },
    ];

    const pathVariants = uniquePaths([
      pathHint,
      '/CTBRESTSALDOS/consultar',
      '/CtbRestSaldos/consultar',
      '/CTBRESTSALDOS/CONSULTAR',
      '/ctbrestsaldos/consultar',
    ]);

    const tenantVariants = [
      `${empresa},${filial}`,
      `${empresa},${filial.trim()}`,
      empresa,
      '', // alguns serviços 401 se tenantId inválido — tenta sem
    ];

    const errorLog: string[] = [];
    const pushErr = (msg: string) => {
      errorLog.push(msg);
      if (errorLog.length > 10) errorLog.shift();
    };

    for (const path of pathVariants) {
      const url = new URL(path.replace(/^\//, ''), `${this.rootBase()}/`);
      for (const tenantId of tenantVariants) {
        for (const attempt of authAttempts) {
          for (const payload of bodies) {
            const headers: Record<string, string> = {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              ...attempt.headers,
            };
            if (tenantId) headers.tenantId = tenantId;
            headers.Empresa = empresa;
            headers.Filial = filial;

            const response = await fetch(url.toString(), {
              method: 'POST',
              headers,
              body: JSON.stringify(payload.body),
              signal: AbortSignal.timeout(90_000),
            });

            const text = await response.text().catch(() => '');
            if (response.ok) {
              let data: unknown;
              try {
                data = JSON.parse(text);
              } catch {
                throw new Error(
                  `CtbRestSaldos OK mas não-JSON: ${text.slice(0, 200)}`,
                );
              }
              return {
                items: mapAccountRows(data),
                rawStatus: response.status,
                url: url.toString(),
                authMode: `post/${attempt.mode}/${payload.label}/tenant=${tenantId || 'none'}`,
              };
            }

            pushErr(
              `POST ${path} [${payload.label}] t=${tenantId || '∅'} ${attempt.mode} → ${response.status} ${text.slice(0, 160)}`,
            );

            if (response.status === 400 || response.status === 422) continue;
            if (response.status === 404) break;
            if (response.status === 401 || response.status === 403) break;
          }
        }
      }
    }

    // Fallback: balancete oficial TOTVS (mesmo objetivo: contas + saldos)
    try {
      return await this.fetchBalanceModel1();
    } catch (balanceErr) {
      pushErr(
        balanceErr instanceof Error
          ? `fallback balance/model1: ${balanceErr.message.slice(0, 220)}`
          : 'fallback balance/model1 falhou',
      );
    }

    const authHints = errors.length ? ` AuthSetup: ${errors.join(' | ')}` : '';
    const ctxHint = ctx
      ? ` erp_context={empresa:${ctx.empresa},filial:${ctx.filial}}`
      : ' erp_context=indisponível';
    throw new Error(
      `CtbRestSaldos/consultar falhou.${ctxHint} Últimos erros: ${errorLog.slice(-6).join(' || ')}.${authHints}`,
    );
  }

  /** Lê /.well-known/erp_context (já retornou 200 neste cloud). */
  private async readErpContext(
    authAttempts: AuthContext[],
  ): Promise<{ empresa?: string; filial?: string; raw?: unknown } | null> {
    const url = `${this.rootBase()}/.well-known/erp_context`;
    for (const attempt of authAttempts) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...attempt.headers,
          },
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) continue;
        const raw = (await res.json()) as Record<string, unknown>;
        const empresa = String(
          raw.company ??
            raw.Company ??
            raw.empresa ??
            raw.M0_CODIGO ??
            raw.companyCode ??
            raw.group ??
            '',
        ).trim();
        const filial = String(
          raw.branch ??
            raw.Branch ??
            raw.filial ??
            raw.M0_CODFIL ??
            raw.branchCode ??
            '',
        ).trim();
        // tenantId "01,0104"
        let emp = empresa;
        let fil = filial;
        const tenant = String(raw.tenantId ?? raw.tenantid ?? '');
        if ((!emp || !fil) && tenant.includes(',')) {
          const [a, b] = tenant.split(',').map((s) => s.trim());
          emp = emp || a;
          fil = fil || b;
        }
        return {
          empresa: emp || undefined,
          filial: fil || undefined,
          raw,
        };
      } catch {
        /* next */
      }
    }
    return null;
  }

  /** POST /api/ctb/balance/model1 (balancete oficial TOTVS). */
  private async fetchBalanceModel1(): Promise<ProtheusFetchResult> {
    const empresa = this.empresa();
    const filial = this.filial();
    const { auth, errors } = await this.resolveAuth();
    const authAttempts = this.buildAuthAttempts(auth);
    const year = new Date().getFullYear();
    const url = new URL('api/ctb/balance/model1', `${this.rootBase()}/`);

    const body = {
      GRUPO_EMPRESA: empresa,
      FILIAL: filial,
      DATA_INICIAL: `01/01/${year}`,
      DATA_FINAL: `31/12/${year}`,
      IMPRIME_CONTAS: 3,
    };

    let lastError = '';
    for (const attempt of authAttempts) {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          tenantId: `${empresa},${filial}`,
          ...attempt.headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      });
      const text = await response.text().catch(() => '');
      if (response.ok) {
        const data = JSON.parse(text) as unknown;
        return {
          items: mapAccountRows(data),
          rawStatus: response.status,
          url: url.toString(),
          authMode: `balance-model1/${attempt.mode}`,
        };
      }
      lastError = `HTTP ${response.status} via ${attempt.mode}: ${text.slice(0, 280)}`;
      if (response.status !== 401 && response.status !== 403) break;
    }

    const authHints = errors.length ? ` Login: ${errors.join(' | ')}` : '';
    throw new Error(`api/ctb/balance/model1 falhou: ${lastError}.${authHints}`);
  }

  private buildAuthAttempts(auth: AuthContext): AuthContext[] {
    const attempts: AuthContext[] = [auth];
    const basic = Buffer.from(
      `${this.auth.username}:${this.auth.password}`,
      'utf8',
    ).toString('base64');
    if (auth.mode === 'session') {
      attempts.push({
        mode: 'session+basic',
        headers: {
          ...(auth.cookie ? { Cookie: auth.cookie } : {}),
          Authorization: `Basic ${basic}`,
        },
        cookie: auth.cookie,
      });
    }
    if (auth.mode !== 'basic') {
      attempts.push({
        mode: 'basic',
        headers: { Authorization: `Basic ${basic}` },
      });
    }
    return attempts;
  }

  private async fetchGenericGet(
    resource: string,
    path: string,
    opts?: { table?: string },
  ): Promise<ProtheusFetchResult> {
    const empresa = this.empresa();
    const filial = this.filial();
    const tabela =
      opts?.table?.trim() ||
      DEFAULT_TABLE_BY_RESOURCE[resource] ||
      'CT1';

    const url = new URL(path.replace(/^\//, ''), `${this.rootBase()}/`);
    url.searchParams.set('Empresa', empresa);
    url.searchParams.set('Filial', filial);
    url.searchParams.set('tabela', tabela);
    url.searchParams.set('company', empresa);
    url.searchParams.set('branch', filial);
    url.searchParams.set('table', tabela);

    const { auth, errors } = await this.resolveAuth();
    const attempts = this.buildAuthAttempts(auth);

    const contextVariants = [
      { label: 'empresa+filial', empresa, filial, tenantId: `${empresa},${filial}` },
      { label: 'empresa-only', empresa, filial: '', tenantId: empresa },
      { label: 'filial-blank', empresa, filial: '  ', tenantId: `${empresa},  ` },
    ];

    let lastError = '';
    for (const ctx of contextVariants) {
      const tryUrl = new URL(url.toString());
      tryUrl.searchParams.set('Empresa', ctx.empresa);
      tryUrl.searchParams.set('Filial', ctx.filial);
      tryUrl.searchParams.set('tabela', tabela);
      tryUrl.searchParams.set('company', ctx.empresa);
      tryUrl.searchParams.set('branch', ctx.filial);
      tryUrl.searchParams.set('table', tabela);

      for (const attempt of attempts) {
        const response = await fetch(tryUrl.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            tenantId: ctx.tenantId,
            Empresa: ctx.empresa,
            Filial: ctx.filial,
            ...attempt.headers,
          },
          signal: AbortSignal.timeout(60_000),
        });

        if (response.ok) {
          const data = (await response.json()) as unknown;
          return {
            items: mapAccountRows(data),
            rawStatus: response.status,
            url: tryUrl.toString(),
            authMode: `${attempt.mode}/${ctx.label}`,
          };
        }

        const text = await response.text().catch(() => '');
        lastError = `HTTP ${response.status} via ${attempt.mode}/${ctx.label}: ${text.slice(0, 280)}`;
        if (response.status === 403 && /empresa|filial/i.test(text)) break;
        if (response.status !== 401 && response.status !== 403) break;
      }
    }

    const authHints = errors.length
      ? ` Tentativas de login: ${errors.join(' | ')}`
      : '';
    throw new Error(
      `Protheus em ${url.pathname}: ${lastError}.${authHints} ` +
        '403 empresa/filial = usuário autenticou sem acesso ao par informado.',
    );
  }

  /**
   * Descobre empresas/filiais acessíveis (para corrigir 403 de contexto).
   * Ignora grupos de usuário (DEFAULT/Administradores) do getgroups.
   */
  async discoverCompanies(): Promise<{
    attempts: Array<{ path: string; status: number; preview: string }>;
    companies: Array<Record<string, unknown>>;
    branches: Array<Record<string, unknown>>;
    hint: string;
  }> {
    const { auth: resolved } = await this.resolveAuth();
    const root = this.rootBase();
    const paths = [
      '/.well-known/erp_context',
      '/.well-known/integrations',
      // Modelos publicados no catálogo deste ambiente
      '/COMPANIES/',
      '/BRANCHES/',
      '/CRMMBRANCHS/',
      '/CRMMBRANCHS',
      '/GENERICQUERY',
      '/GENERICRECORDS',
      '/api/framework/v1/companies',
      '/api/framework/v1/branches',
    ];

    const attempts: Array<{ path: string; status: number; preview: string }> =
      [];
    const companies: Array<Record<string, unknown>> = [];
    const branches: Array<Record<string, unknown>> = [];

    const basic = Buffer.from(
      `${this.auth.username}:${this.auth.password}`,
      'utf8',
    ).toString('base64');

    const authHeaders: Record<string, string> = {
      Accept: 'application/json',
      Authorization: resolved.headers.Authorization || `Basic ${basic}`,
      ...(resolved.headers.Cookie ? { Cookie: resolved.headers.Cookie } : {}),
    };

    for (const path of paths) {
      const url = `${root}${path}`;
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: authHeaders,
          signal: AbortSignal.timeout(20_000),
        });
        const text = await res.text().catch(() => '');
        attempts.push({ path, status: res.status, preview: text.slice(0, 400) });
        if (!res.ok) continue;
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          continue;
        }
        // Sempre guarda erp_context bruto
        if (path.includes('erp_context') && data && typeof data === 'object') {
          companies.push({
            _source: 'erp_context',
            ...(data as Record<string, unknown>),
          });
        }
        collectCompanyBranchRows(data, companies, branches);
      } catch (err) {
        attempts.push({
          path,
          status: 0,
          preview: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const hint =
      companies.length || branches.length
        ? 'Copie M0_CODIGO / company / code para Empresa e M0_CODFIL / branch para Filial. Ignore group_id/displayname de perfil (Administradores, FINANCEIRO, etc.).'
        : 'As APIs de empresa/filial não estão publicadas neste /rest (404). O que vinha antes era /getgroups = grupos de usuário. Descubra o código no Protheus: login SmartClient do Admin mostra Empresa/Filial, ou Configurador → Empresas (SM0) / acesso do usuário.';

    return { attempts, companies, branches, hint };
  }
}

function normalizeRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  for (const key of [
    'items',
    'data',
    'accounts',
    'contas',
    'results',
    'value',
    'companies',
    'branches',
    'saldos',
    'SALDOS',
    'balancete',
    'objects',
    'Objects',
    'CT1',
    'ct1',
    'records',
    'Records',
    'ITEMS',
  ]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  // genericQuery às vezes: { tables: { CT1: [...] } }
  if (obj.tables && typeof obj.tables === 'object') {
    const tables = obj.tables as Record<string, unknown>;
    for (const key of Object.keys(tables)) {
      if (Array.isArray(tables[key])) return tables[key] as unknown[];
    }
  }
  if (obj.CT1_CONTA || obj.conta || obj.account || obj.CT1_BLOQ) return [obj];
  return [];
}

function mapAccountRows(
  data: unknown,
): Array<{ externalId: string; payload: Record<string, unknown> }> {
  return normalizeRows(data).map((row, index) => {
    const obj = (row ?? {}) as Record<string, unknown>;
    const externalId = String(
      obj.CT1_CONTA ??
        obj.ct1_conta ??
        obj.CQ0_CONTA ??
        obj.CQ1_CONTA ??
        obj.account ??
        obj.conta ??
        obj.CONTA ??
        obj.codigo ??
        obj.code ??
        obj.id ??
        `row-${index}`,
    );
    return { externalId, payload: obj };
  });
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const n = p.startsWith('/') ? p : `/${p}`;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function collectCompanyBranchRows(
  data: unknown,
  companies: Array<Record<string, unknown>>,
  branches: Array<Record<string, unknown>>,
) {
  // erp_context às vezes é um objeto único
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (
      obj.company ||
      obj.Company ||
      obj.M0_CODIGO ||
      obj.tenantId ||
      obj.group
    ) {
      companies.push(obj);
    }
  }

  const rows = normalizeRows(data);
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const blob = JSON.stringify(rec).toLowerCase();
    // grupos de usuário ≠ empresa
    if (
      /administradores|default/.test(blob) &&
      !/m0_codigo|companycode|codemp|empresa/.test(blob)
    ) {
      continue;
    }
    if (/m0_codfil|branchcode|codfil|filial/.test(blob) && !/m0_codigo/.test(blob)) {
      branches.push(rec);
    } else if (/m0_codigo|companycode|codemp|empresa|company/.test(blob)) {
      companies.push(rec);
    } else if (/branch/.test(blob)) {
      branches.push(rec);
    }
  }
}

export function defaultPathForResource(resource: string): string | null {
  return DEFAULT_RESOURCE_PATHS[resource] ?? null;
}
