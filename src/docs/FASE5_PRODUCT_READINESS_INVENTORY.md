# FASE 5 — Inventário de Prontidão do Produto

| Item | Uso produtivo / consumer | Role e tenant guard | Estados / desempenho | Risco e ação F5 |
|---|---|---|---|---|
| `src/App.jsx` | Roteamento autenticado e rotas especiais | `RoleRoute` e `routePolicies` | Suspense central; sem roteamento público administrativo | Auditar toda rota por `audit:phase5-routes` |
| `src/Layout.jsx` | Navegação lateral e seletor de tenant | `usePermissions` / `TenantContext` | Responsivo desktop/mobile | Manter navegação técnica fora do perfil cliente |
| `pages.config.js` | Registro lazy das páginas históricas | Policy avaliada no loop de rotas | Lazy loading | Rotas novas devem ser explícitas em `App.jsx` |
| `routePolicies.js` | Fonte única de autorização de rota | Deny-by-default | N/A | Cobertura obrigatória de toda rota |
| `GroupCockpit.jsx` | Visão Geral oficial do grupo | Tenant recebido do contexto | Queries tenant-scoped; estados vazios orientados | Remover cores literais em evolução visual |
| `useGroupAssessment.js` | Seleção única do assessment principal | Query por tenant e grupo | Cache via `groupKey` | Proibir seletores locais concorrentes |
| `nextMovementEngine.js` | Próximo Movimento oficial | Sem mutação | 10 estados documentados | Cobrir contratos de destino e contexto |
| `GroupDetail.jsx` | Sete abas oficiais do grupo | `RoleRoute` externo | Skeleton inicial e abas responsivas | Incluir tenant em filtros legados restantes |
| `ClientPortal.jsx` | Portal em leitura | `allowAll` autenticado | Depende de dados por cliente | Revisar mascaramento e LGPD |
| `SystemSettings.jsx` | Perfil do tenant e convite | Administrador | Feedback de formulário | Migrar alertas técnicos para estado inline |
| `Tenants.jsx` | Administração global | HQ | Listas hoje limitadas | Paginação e logs administrativos pendentes |
| `components/legacy/*` | Compatibilidade histórica | Sem acesso direto planejado | N/A | Inventariados pelo auditor; migrar ou remover por arquivo |
| `AppLoader.jsx` | Loading e erro de sessão | N/A | Mensagem e retry | Converter estilos para tokens FAL |
| `TenantContext.jsx` | Tenant ativo e troca HQ | HQ troca tenant; demais fixos | Timeout e cache clear | Evitar logs com identificadores pessoais |
| `PermissionGuard.jsx` / `RoleRoute.jsx` | Controle de ação e rota | RBAC central | Redirect seguro | Testar matriz de papéis |
| `query-client.js` | Cache e invalidação | Factories tenant-scoped | retry=1; invalidação por escopo | Auditar chaves legadas |
| `globals.css` / `index.css` | Tokens FAL | N/A | Responsivo via componentes | Consolidar classes hardcoded gradualmente |
| `User.jsonc`, `Tenant.jsonc`, `AuditLog.jsonc` | Identidade, tenant e rastreabilidade | Regras em functions | N/A | Revisar campos de log e LGPD |
| Funções de acesso | Convite, aplicação e atribuição de perfil | Validação server-side | N/A | Completar revogação e histórico administrativo |
| `runtimeSecurityProof` | Evidência de segurança | Admin | N/A | Manter fora do fluxo cliente |
| `debug*` functions | Diagnóstico técnico | Não expor ao cliente | N/A | Auditoria de superfície produtiva pendente |

## Entrega inicial F5
O onboarding persistente (`OnboardingProgress` e `manageTenantOnboarding`) está tenant-scoped, registra auditoria e evita duplicação por grupo, CNPJ e unidade. As frentes de backup/restore, LGPD, observabilidade e administração completa de usuários permanecem para as próximas entregas controladas da Fase 5.