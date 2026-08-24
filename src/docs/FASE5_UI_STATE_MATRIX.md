# FASE 5 — Matriz de Estados de Interface

| Tela | Loading | Empty | Erro | Permissão | Retry / feedback |
|---|---|---|---|---|---|
| Visão Geral do Grupo | Queries do cockpit | Alertas orientam iniciar diagnóstico | Falha de query deve exibir `AppError` local | `requireRead` | Próximo Movimento tem destino único |
| Estrutura | Carregamento do grupo | Organograma orienta criar empresa | Mensagem de ação necessária | `PermissionGuard` para mutação | Dialogs invalidam cache estrutural |
| Diagnóstico 8D | Estado próprio do módulo | Orientação para iniciar | Estado do módulo | `requireWrite` para alterações | Retorno ao cockpit preservado |
| Financeiro | Estado próprio do módulo | Orientação para criar análise | Estado do módulo | Guardas financeiros | Navegação sem recalcular assessment |
| Plano e Relatórios | Estado próprio do módulo | Próximo Movimento contextual | Estado do módulo | Read/write conforme ação | Retorno por grupo/assessment |
| Onboarding | Carregamento de progresso | Não aplicável | Mensagem inline de ação | Cliente bloqueado; tenant validado no backend | Persistente e reexecutável sem duplicação |

A matriz será expandida com cenários 403, 404, 500, timeout, upload interrompido e erro de render nas entregas de observabilidade.