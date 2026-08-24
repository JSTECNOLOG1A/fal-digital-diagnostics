import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function resolveAppRole(user) {
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!WRITE_ROLES.has(appRole)) return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });

    const body = await req.json();
    const { groupId, tenantId } = body;

    if (!groupId || !tenantId) {
      return Response.json({ error: 'groupId e tenantId são obrigatórios' }, { status: 400 });
    }
    if (appRole !== 'hq_admin' && tenantId !== user.tenant_id) return Response.json({ error: 'Forbidden: tenant não autorizado' }, { status: 403 });

    // Fetch todas as empresas do grupo
    const companies = await base44.entities.Company.filter({
      group_id: groupId,
      tenant_id: tenantId,
    });

    // Fetch links existentes
    const existingLinks = await base44.entities.CompanyOwnershipLink.filter({
      group_id: groupId,
      tenant_id: tenantId,
    });

    const report = {
      companiesRead: companies.length,
      legacyCompaniesFound: 0,
      linksCreated: 0,
      linksUpdated: 0,
      linksIgnored: 0,
      warnings: [],
      errors: [],
    };

    const linksToCreate = [];
    const today = new Date().toLocaleDateString('pt-BR');

    // Função para normalizar nomes (remover acentos, espaços, maiúsculas)
    const normalize = (str) => {
      if (!str) return '';
      return str
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    };

    // Processar cada empresa
    for (const company of companies) {
      if (!company.societary_composition || !Array.isArray(company.societary_composition)) {
        continue;
      }

      if (company.societary_composition.length > 0) {
        report.legacyCompaniesFound++;
      }

      // Processar cada sócio no campo legado
      for (const partner of company.societary_composition) {
        const isGroupCompany = partner.partner_type === 'group_company';
        const pct = parseFloat(String(partner.equity_percentage || '0').replace(',', '.'));

        // Validação básica
        if (pct <= 0 || pct > 100) {
          report.warnings.push(
            `Percentual inválido para sócio ${partner.partner_name} de ${company.name}: ${pct}%`
          );
          continue;
        }

        // Chave de unicidade: invested_company_id + investidor
        let existingLink = null;
        if (isGroupCompany) {
          existingLink = existingLinks.find(
            (link) =>
              link.invested_company_id === company.id &&
              link.investor_company_id === partner.company_id
          );
        } else {
          existingLink = existingLinks.find(
            (link) =>
              link.invested_company_id === company.id &&
              normalize(link.investor_person_name) === normalize(partner.partner_name)
          );
        }

        if (existingLink) {
          // Link já existe
          if (Math.abs(existingLink.percentage - pct) > 0.01) {
            // Percentual diferiu → atualizar
            try {
              await base44.entities.CompanyOwnershipLink.update(existingLink.id, {
                percentage: pct,
                notes: `${existingLink.notes || ''} | Percentual atualizado via migração legada em ${today}`.trim(),
              });
              report.linksUpdated++;
            } catch (err) {
              report.errors.push(
                `Erro ao atualizar link ${existingLink.id}: ${err.message}`
              );
            }
          } else {
            // Percentual idêntico → ignorar
            report.linksIgnored++;
          }
        } else {
          // Criar novo link
          linksToCreate.push({
            tenant_id: tenantId,
            group_id: groupId,
            investor_company_id: isGroupCompany ? partner.company_id : null,
            investor_person_name: !isGroupCompany ? partner.partner_name.trim() : null,
            invested_company_id: company.id,
            percentage: pct,
            relationship_type: isGroupCompany ? 'quotista' : 'investidor_pessoa_fisica',
            is_controller: pct > 50,
            notes: `Migrado de Company.societary_composition em ${today} | Lote: MIG-LEGACY-${groupId}`,
          });
        }
      }
    }

    // Bulk create
    if (linksToCreate.length > 0) {
      try {
        await base44.entities.CompanyOwnershipLink.bulkCreate(linksToCreate);
        report.linksCreated = linksToCreate.length;
      } catch (err) {
        report.errors.push(`Erro ao criar bulk links: ${err.message}`);
      }
    }

    return Response.json(report);
  } catch (error) {
    console.error('Erro na migração:', error);
    return Response.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
});