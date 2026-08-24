import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

/**
 * Matriz FAL Completa com Dimensões, Subdimensões e Clusters
 */
const FAL_STRUCTURE = {
  'governanca': {
    name: 'Governança',
    description: 'Estrutura de governança e processos decisórios',
    order: 1,
    level_applicability: ['group', 'company', 'unit'],
    subdimensions: {
      'governanca_societaria': {
        name: 'Governança Societária',
        description: 'Estrutura de sócios, acordos e sucessão',
        order: 1,
        clusters: {
          'acordo_socios': { name: 'Acordo de Sócios', order: 1 },
          'organograma_familiar': { name: 'Organograma Familiar', order: 2 },
          'sucessao_familiar': { name: 'Sucessão Familiar', order: 3 }
        }
      },
      'ritos_governanca': {
        name: 'Ritos de Governança',
        description: 'Reuniões, rituais e processos de decisão',
        order: 2,
        clusters: {
          'reuniao_conselho': { name: 'Reunião de Conselho', order: 1 },
          'reuniao_resultados': { name: 'Reunião de Resultados', order: 2 },
          'delegacao_autoridade': { name: 'Delegação de Autoridade', order: 3 }
        }
      }
    }
  },
  'juridico': {
    name: 'Jurídico',
    description: 'Aspectos legais e contratuais',
    order: 2,
    level_applicability: ['group', 'company'],
    subdimensions: {
      'contratos_comerciais': {
        name: 'Contratos Comerciais',
        description: 'Contratos com fornecedores e clientes',
        order: 1,
        clusters: {
          'contratos_fornecedores': { name: 'Contratos de Fornecedores', order: 1 },
          'contratos_clientes': { name: 'Contratos de Clientes', order: 2 },
          'garantias_contratuais': { name: 'Garantias Contratuais', order: 3 }
        }
      },
      'compliance_legal': {
        name: 'Compliance Legal',
        description: 'Conformidade legal e regulatória',
        order: 2,
        clusters: {
          'conformidade_ambiental': { name: 'Conformidade Ambiental', order: 1 },
          'conformidade_laboral': { name: 'Conformidade Laboral', order: 2 },
          'registro_marcas': { name: 'Registro de Marcas e Patentes', order: 3 }
        }
      }
    }
  },
  'controles_internos': {
    name: 'Controles Internos',
    description: 'Processos e controles operacionais',
    order: 3,
    level_applicability: ['company', 'unit'],
    subdimensions: {
      'controle_compras': {
        name: 'Controle de Compras',
        description: 'Processos de requisição, cotação e aprovação',
        order: 1,
        clusters: {
          'requisicao_compras': { name: 'Requisição de Compras', order: 1 },
          'cotacoes_fornecedores': { name: 'Cotações de Fornecedores', order: 2 },
          'homologacao_fornecedores': { name: 'Homologação de Fornecedores', order: 3 },
          'aprovacao_compras': { name: 'Aprovação de Compras', order: 4 }
        }
      },
      'controle_estoque': {
        name: 'Controle de Estoque',
        description: 'Gestão de inventário e materiais',
        order: 2,
        clusters: {
          'recebimento_materiais': { name: 'Recebimento de Materiais', order: 1 },
          'armazenagem': { name: 'Armazenagem', order: 2 },
          'saida_estoque': { name: 'Saída de Estoque', order: 3 },
          'inventario_fisico': { name: 'Inventário Físico', order: 4 }
        }
      },
      'controle_combustivel': {
        name: 'Controle de Combustível',
        description: 'Gestão de combustível e abastecimentos',
        order: 3,
        clusters: {
          'abastecimento_combustivel': { name: 'Abastecimento de Combustível', order: 1 },
          'consumo_combustivel': { name: 'Consumo de Combustível', order: 2 },
          'reposicao_tanques': { name: 'Reposição de Tanques', order: 3 }
        }
      }
    }
  },
  'financeiro': {
    name: 'Financeiro',
    description: 'Gestão de caixa e tesoraria',
    order: 4,
    level_applicability: ['company', 'unit'],
    subdimensions: {
      'fluxo_caixa': {
        name: 'Fluxo de Caixa',
        description: 'Previsão e controle de caixa',
        order: 1,
        clusters: {
          'previsibilidade_caixa': { name: 'Previsibilidade de Caixa', order: 1 },
          'controle_pagamentos': { name: 'Controle de Pagamentos', order: 2 },
          'controle_recebimentos': { name: 'Controle de Recebimentos', order: 3 },
          'sazonalidade_caixa': { name: 'Sazonalidade de Caixa', order: 4 }
        }
      },
      'credito_cobranca': {
        name: 'Crédito e Cobrança',
        description: 'Gestão de crédito a clientes e cobrança',
        order: 2,
        clusters: {
          'politica_credito': { name: 'Política de Crédito', order: 1 },
          'analise_credito': { name: 'Análise de Crédito', order: 2 },
          'cobranca_automatica': { name: 'Cobrança Automática', order: 3 }
        }
      },
      'investimentos': {
        name: 'Investimentos',
        description: 'Gestão de aplicações financeiras',
        order: 3,
        clusters: {
          'aplicacoes_financeiras': { name: 'Aplicações Financeiras', order: 1 },
          'gestao_dinheiro': { name: 'Gestão de Dinheiro', order: 2 }
        }
      }
    }
  },
  'contabil': {
    name: 'Contábil',
    description: 'Registros contábeis e relatórios',
    order: 5,
    level_applicability: ['company', 'unit'],
    subdimensions: {
      'registros_contabeis': {
        name: 'Registros Contábeis',
        description: 'Apropriação e lançamentos contábeis',
        order: 1,
        clusters: {
          'apropriacao_custos': { name: 'Apropriação de Custos', order: 1 },
          'lancamentos_contabeis': { name: 'Lançamentos Contábeis', order: 2 },
          'conciliacao_bancaria': { name: 'Conciliação Bancária', order: 3 }
        }
      },
      'relatorios_contabeis': {
        name: 'Relatórios Contábeis',
        description: 'Demonstrações e análises contábeis',
        order: 2,
        clusters: {
          'dre_mensal': { name: 'DRE Mensal', order: 1 },
          'balanco_patrimonial': { name: 'Balanço Patrimonial', order: 2 },
          'fluxo_caixa_contabil': { name: 'Fluxo de Caixa Contábil', order: 3 }
        }
      }
    }
  },
  'tributario': {
    name: 'Tributário',
    description: 'Obrigações fiscais e tributárias',
    order: 6,
    level_applicability: ['company', 'unit'],
    subdimensions: {
      'obrigacoes_fiscais': {
        name: 'Obrigações Fiscais',
        description: 'Apurações e declarações de impostos',
        order: 1,
        clusters: {
          'icms_ipi': { name: 'ICMS/IPI', order: 1 },
          'pis_cofins': { name: 'PIS/COFINS', order: 2 },
          'ir_irpj': { name: 'IR/IRPJ', order: 3 }
        }
      },
      'planejamento_tributario': {
        name: 'Planejamento Tributário',
        description: 'Estratégia e otimização fiscal',
        order: 2,
        clusters: {
          'regime_tributario': { name: 'Regime Tributário', order: 1 },
          'incentivos_fiscais': { name: 'Incentivos Fiscais', order: 2 }
        }
      }
    }
  },
  'operacional': {
    name: 'Operacional',
    description: 'Processos e eficiência operacional',
    order: 7,
    level_applicability: ['company', 'unit'],
    subdimensions: {
      'planejamento_operacional': {
        name: 'Planejamento Operacional',
        description: 'Planejamento de operações',
        order: 1,
        clusters: {
          'calendario_operacional': { name: 'Calendário Operacional', order: 1 },
          'manutencao_preventiva': { name: 'Manutenção Preventiva', order: 2 },
          'planejamento_compras': { name: 'Planejamento de Compras', order: 3 }
        }
      },
      'producao_qualidade': {
        name: 'Produção e Qualidade',
        description: 'Processos produtivos e controle de qualidade',
        order: 2,
        clusters: {
          'linha_producao': { name: 'Linha de Produção', order: 1 },
          'controle_qualidade': { name: 'Controle de Qualidade', order: 2 },
          'certificacoes': { name: 'Certificações', order: 3 }
        }
      }
    }
  },
  'sistemas': {
    name: 'Sistemas & Tecnologia',
    description: 'Infraestrutura de TI e sistemas',
    order: 8,
    level_applicability: ['company', 'unit'],
    subdimensions: {
      'infraestrutura': {
        name: 'Infraestrutura de TI',
        description: 'Hardware, redes e segurança',
        order: 1,
        clusters: {
          'backup_dados': { name: 'Backup e Recuperação', order: 1 },
          'seguranca_dados': { name: 'Segurança de Dados', order: 2 },
          'manutencao_hardware': { name: 'Manutenção de Hardware', order: 3 }
        }
      },
      'sistemas_erp': {
        name: 'Sistemas ERP',
        description: 'Implementação e uso de ERP',
        order: 2,
        clusters: {
          'configuracao_erp': { name: 'Configuração de ERP', order: 1 },
          'modulos_erp': { name: 'Módulos de ERP', order: 2 },
          'relatorios_erp': { name: 'Relatórios de ERP', order: 3 }
        }
      },
      'qualidade_dados': {
        name: 'Qualidade de Dados',
        description: 'Integridade e higiene de dados',
        order: 3,
        clusters: {
          'cadastro_maestro': { name: 'Cadastro Maestro', order: 1 },
          'higiene_dados': { name: 'Higiene de Dados', order: 2 },
          'integracao_sistemas': { name: 'Integração de Sistemas', order: 3 }
        }
      }
    }
  }
};

function isHQ(user) { return appRole === 'hq_admin'; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: HQ admin only' }, { status: 403 });

    const stats = { dimensions: 0, subdimensions: 0, clusters: 0 };
    const tenantId = 'global';

    // Seed dimensões
    for (const [dimKey, dimData] of Object.entries(FAL_STRUCTURE)) {
      const existing = await base44.asServiceRole.entities.FalDimension.filter(
        { tenant_id: tenantId, key: dimKey }, '-created_date', 1
      );

      if (existing.length === 0) {
        await base44.asServiceRole.entities.FalDimension.create({
          tenant_id: tenantId,
          key: dimKey,
          name: dimData.name,
          description: dimData.description,
          order: dimData.order,
          level_applicability: dimData.level_applicability
        });
        stats.dimensions++;
        console.log(`  [CREATE] Dimensão: ${dimKey}`);
      }

      // Seed subdimensões
      for (const [subdimKey, subdimData] of Object.entries(dimData.subdimensions || {})) {
        const existingSub = await base44.asServiceRole.entities.FalSubdimension.filter(
          { tenant_id: tenantId, dimension_key: dimKey, key: subdimKey }, '-created_date', 1
        );

        if (existingSub.length === 0) {
          await base44.asServiceRole.entities.FalSubdimension.create({
            tenant_id: tenantId,
            dimension_key: dimKey,
            key: subdimKey,
            name: subdimData.name,
            description: subdimData.description,
            order: subdimData.order
          });
          stats.subdimensions++;
          console.log(`    [CREATE] Subdimensão: ${subdimKey}`);
        }

        // Seed clusters
        for (const [clusterKey, clusterData] of Object.entries(subdimData.clusters || {})) {
          const existingCluster = await base44.asServiceRole.entities.FalCluster.filter(
            { tenant_id: tenantId, dimension_key: dimKey, subdimension_key: subdimKey, key: clusterKey },
            '-created_date', 1
          );

          if (existingCluster.length === 0) {
            await base44.asServiceRole.entities.FalCluster.create({
              tenant_id: tenantId,
              dimension_key: dimKey,
              subdimension_key: subdimKey,
              key: clusterKey,
              name: clusterData.name,
              order: clusterData.order
            });
            stats.clusters++;
            console.log(`      [CREATE] Cluster: ${clusterKey}`);
          }
        }
      }
    }

    return Response.json({
      ok: true,
      message: 'Estrutura FAL implantada com sucesso',
      stats
    });
  } catch (error) {
    console.error('[seedMethodStructure] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});