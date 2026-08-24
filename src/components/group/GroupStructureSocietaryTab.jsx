import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Users, Percent, AlertCircle, Plus, Trash2, Edit2, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import CreateOwnershipLinkDialog from '@/components/assessments/CreateOwnershipLinkDialog';
import { invalidateStructureQueries, groupKey } from '@/lib/query-client';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Altura padrão de cada card
const CARD_HEIGHT = 280;
const CARD_WIDTH = 320;
const VERTICAL_GAP = 60;
const HORIZONTAL_GAP = 80;

/**
 * @param {Object} props
 * @param {any=} props.groupId
 * @param {any=} props.tenantId
 * @param {any=} props.onAddCompany
 */
export default function GroupStructureSocietaryTab({ groupId, tenantId, onAddCompany }) {
  const [zoom, setZoom] = useState(100);
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [cardPositions, setCardPositions] = useState(/** @type {Record<string, any>} */ ({}));
  const [linkDialog, setLinkDialog] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [migrationState, setMigrationState] = useState(null);
  const [migrationReport, setMigrationReport] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Buscar empresas do grupo
  const { data: companies = [] } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'companies'),
    queryFn: () => base44.entities.Company.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  // Buscar vínculos de propriedade
  const { data: ownershipLinks = [] } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'ownership-links'),
    queryFn: () => base44.entities.CompanyOwnershipLink.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  // Mutation para deletar
  const deleteMutation = useMutation({
    mutationFn: (/** @type {any} */ linkId) => base44.entities.CompanyOwnershipLink.delete(linkId),
    onSuccess: () => {
      invalidateStructureQueries(queryClient, tenantId, 'company');
      setDeleteDialog(null);
    },
  });

  // Mapear investidores por empresa investida
  const investorsMap = ownershipLinks.reduce((acc, link) => {
    if (!acc[link.invested_company_id]) {
      acc[link.invested_company_id] = [];
    }
    acc[link.invested_company_id].push(link);
    return acc;
  }, {});

  // Mapear investimentos por empresa investidora
  const investmentsMap = ownershipLinks.reduce((acc, link) => {
    const investorId = link.investor_company_id || link.investor_person_name;
    if (!acc[investorId]) {
      acc[investorId] = [];
    }
    acc[investorId].push(link);
    return acc;
  }, {});

  // Separar empresas em investidoras, investidas e sem vínculo
  const investorCompanies = companies.filter(c => {
    const investments = investmentsMap[c.id] || [];
    return investments.length > 0;
  });

  const investedCompanies = companies.filter(c => {
    const investors = investorsMap[c.id] || [];
    return investors.length > 0;
  });

  // Empresas sem vínculo societário (composição pendente)
  const companiesWithoutLinks = companies.filter(c => {
    const investors = investorsMap[c.id] || [];
    const investments = investmentsMap[c.id] || [];
    return investors.length === 0 && investments.length === 0;
  });

  // Detectar se há dados legados para migrar
  const hasLegacyData = companies.some(
    c => c.societary_composition && Array.isArray(c.societary_composition) && c.societary_composition.length > 0
  );

  // Função de migração
  const handleMigrate = async () => {
    setMigrationState('migrating');
    try {
      const result = await base44.functions.invoke('migrateLegacySocietaryCompositionToOwnershipLinks', {
        groupId,
        tenantId,
      });
      setMigrationReport(result);
      setMigrationState('done');
      
      // Invalidar queries após migração
      invalidateStructureQueries(queryClient, tenantId, 'company');
      
      toast({
        variant: 'default',
        title: 'Migração Concluída',
        description: `${result.linksCreated} links criados, ${result.linksUpdated} atualizados.`,
      });
    } catch (err) {
      console.error('Erro na migração:', err);
      toast({
        variant: 'destructive',
        title: 'Erro na Migração',
        description: err.message || 'Falha ao migrar dados legados.',
      });
      setMigrationState('error');
    }
  };

  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company ? company.trade_name || company.name : companyId;
  };

  // Calcular posições dos cards no canvas
  useEffect(() => {
    if (!containerRef.current) return;

    const positions = {};
    let currentY = 40;

    // Renderizar investidoras na coluna esquerda
    investorCompanies.forEach((company, idx) => {
      positions[`investor-${company.id}`] = {
        x: 40,
        y: currentY,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        type: 'investor',
      };
      currentY += CARD_HEIGHT + VERTICAL_GAP;
    });

    // Renderizar investidas na coluna direita
    currentY = 40;
    investedCompanies.forEach((company) => {
      positions[`invested-${company.id}`] = {
        x: CARD_WIDTH + HORIZONTAL_GAP + 40,
        y: currentY,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        type: 'invested',
      };
      currentY += CARD_HEIGHT + VERTICAL_GAP;
    });

    setCardPositions(positions);
  }, [investorCompanies, investedCompanies]);

  // Renderizar conectores SVG
  const renderConnectors = () => {
    const paths = [];
    const connectorData = [];

    ownershipLinks.forEach((link, idx) => {
      const investorKey = `investor-${link.investor_company_id || 'person'}`;
      const investedKey = `invested-${link.invested_company_id}`;

      const investorPos = cardPositions[investorKey];
      const investedPos = cardPositions[investedKey];

      if (!investorPos || !investedPos) return;

      // Calcular pontos de saída e entrada
      const startX = investorPos.x + investorPos.width;
      const startY = investorPos.y + investorPos.height / 2;
      const endX = investedPos.x;
      const endY = investedPos.y + investedPos.height / 2;

      connectorData.push({
        startX,
        startY,
        endX,
        endY,
        percentage: link.percentage,
        controlador: link.is_controller,
        index: idx,
      });
    });

    // Agrupar conectores por destino para aplicar offset e evitar sobreposição
    const connectorsByTarget = {};
    connectorData.forEach(conn => {
      const key = `${conn.endX}-${conn.endY}`;
      if (!connectorsByTarget[key]) {
        connectorsByTarget[key] = [];
      }
      connectorsByTarget[key].push(conn);
    });

    // Renderizar conectores com offset
    Object.values(connectorsByTarget).forEach(conns => {
      const totalCount = conns.length;
      conns.forEach((conn, connIdx) => {
        // Calcular offset para evitar sobreposição
        const offset = (connIdx - (totalCount - 1) / 2) * 8;

        // Bezier curve suave
        const controlPointX = (conn.startX + conn.endX) / 2;
        const controlPointY1 = conn.startY + 60;
        const controlPointY2 = conn.endY - 60;

        const pathData = `M ${conn.startX} ${conn.startY + offset} 
                         C ${controlPointX} ${controlPointY1}, ${controlPointX} ${controlPointY2}, ${conn.endX} ${conn.endY + offset}`;

        const strokeColor = conn.controlador ? '#059669' : '#64748b';
        const strokeWidth = conn.controlador ? 2.5 : 2;

        paths.push(
          <path
            key={`connector-${conn.index}`}
            d={pathData}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
            opacity={0.7}
            vectorEffect="non-scaling-stroke"
          />
        );

        // Label do percentual no meio da curva (apenas se houver espaço)
        if (totalCount === 1) {
          const midX = (conn.startX + conn.endX) / 2;
          const midY = (conn.startY + conn.endY) / 2;
          paths.push(
            <text
              key={`label-${conn.index}`}
              x={midX}
              y={midY}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill={strokeColor}
              style={{
                pointerEvents: 'none',
                textShadow: '0 0 4px white',
                filter: 'drop-shadow(0 0 3px white)',
              }}
            >
              {conn.percentage.toFixed(1)}%
            </text>
          );
        }
      });
    });

    return paths;
  };

  const svgHeight = Math.max(
    investorCompanies.length * (CARD_HEIGHT + VERTICAL_GAP) + 80,
    investedCompanies.length * (CARD_HEIGHT + VERTICAL_GAP) + 80,
    600
  );

  const svgWidth = CARD_WIDTH * 2 + HORIZONTAL_GAP + 120;

  return (
    <div className="space-y-4">
      {/* Header com controles */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Fluxo de Investimentos</h3>
          <p className="text-xs text-slate-500 mt-1">Múltiplos investidores → investidas com vínculos SVG</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg p-1">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 10))}
              className="px-2 py-1 text-xs hover:bg-slate-100 rounded"
            >
              −
            </button>
            <span className="text-xs font-medium w-12 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom(Math.min(150, zoom + 10))}
              className="px-2 py-1 text-xs hover:bg-slate-100 rounded"
            >
              +
            </button>
          </div>
          <div className="flex gap-2">
            {hasLegacyData && !migrationReport && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={handleMigrate}
                disabled={migrationState === 'migrating'}
              >
                {migrationState === 'migrating' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Migrando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" /> Migrar Histórico
                  </>
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setEditingLink(null);
                setLinkDialog(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Novo Vínculo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={onAddCompany}
            >
              <Plus className="w-3.5 h-3.5" /> Nova Empresa
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de relatório de migração */}
      {migrationReport && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-blue-900 space-y-1">
              <div className="font-semibold">Relatório de Migração</div>
              <div className="text-xs space-y-0.5">
                <p>Empresas lidas: <span className="font-mono">{migrationReport.companiesRead}</span></p>
                <p>Links criados: <span className="font-mono text-green-700 font-bold">{migrationReport.linksCreated}</span></p>
                <p>Links atualizados: <span className="font-mono text-blue-700 font-bold">{migrationReport.linksUpdated}</span></p>
                <p>Links ignorados: <span className="font-mono">{migrationReport.linksIgnored}</span></p>
                {migrationReport.warnings.length > 0 && (
                  <p className="text-amber-700">⚠️ Avisos: {migrationReport.warnings.length}</p>
                )}
                {migrationReport.errors.length > 0 && (
                  <p className="text-red-700">❌ Erros: {migrationReport.errors.length}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canvas com SVG e cards */}
      <div 
        ref={containerRef}
        className="border border-slate-200 rounded-lg bg-slate-50 overflow-auto relative"
        style={{ minHeight: '700px' }}
      >
        {companies.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma empresa cadastrada</p>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', overflow: 'visible' }}>
            {/* SVG para conectores */}
            <svg
              ref={svgRef}
              width={svgWidth}
              height={svgHeight}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
                zIndex: 0,
              }}
            >
              <defs>
                <marker
                  id="arrowhead-green"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#059669" />
                </marker>
                <marker
                  id="arrowhead-slate"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
                </marker>
              </defs>
              {renderConnectors()}
            </svg>

            {/* Cards com conteúdo (z-index > SVG) */}
            <div
              style={{
                position: 'relative',
                zIndex: 10,
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
                width: '100%',
              }}
            >
              {/* Coluna: Investidoras */}
              <div style={{ position: 'absolute', top: 0, left: 0 }}>
                {investorCompanies.map((company) => {
                  const investmentsList = investmentsMap[company.id] || [];
                  const pos = cardPositions[`investor-${company.id}`];

                  if (!pos) return null;

                  return (
                    <div
                      key={`investor-${company.id}`}
                      style={{
                        position: 'absolute',
                        left: pos.x,
                        top: pos.y,
                        width: CARD_WIDTH,
                      }}
                    >
                      <CompanyCard
                        company={company}
                        getCompanyName={getCompanyName}
                        type="investor"
                        investments={investmentsList}
                        onEditLink={(link) => {
                          setEditingLink(link);
                          setLinkDialog(true);
                        }}
                        onDeleteLink={(linkId) => setDeleteDialog(linkId)}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Coluna: Investidas */}
              <div style={{ position: 'absolute', top: 0, left: CARD_WIDTH + HORIZONTAL_GAP + 40 }}>
                {investedCompanies.map((company) => {
                  const investorsList = investorsMap[company.id] || [];
                  const totalEquity = investorsList.reduce((sum, l) => sum + (l.percentage || 0), 0);
                  const pos = cardPositions[`invested-${company.id}`];

                  if (!pos) return null;

                  return (
                    <div
                      key={`invested-${company.id}`}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: pos.y,
                        width: CARD_WIDTH,
                      }}
                    >
                      <CompanyCard
                        company={company}
                        getCompanyName={getCompanyName}
                        type="invested"
                        investors={investorsList}
                        totalEquity={totalEquity}
                        onEditLink={(link) => {
                          setEditingLink(link);
                          setLinkDialog(true);
                        }}
                        onDeleteLink={(linkId) => setDeleteDialog(linkId)}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Espaçamento para scroll */}
              <div style={{ height: svgHeight, pointerEvents: 'none' }} />
            </div>
          </div>
        )}
      </div>

      {/* Alerta de empresas sem composição */}
      {companiesWithoutLinks.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">⚠️ Composição Pendente</div>
              <p>{companiesWithoutLinks.length} empresa(s) sem vínculo societário cadastrado.</p>
              <div className="mt-1 space-y-0.5">
                {companiesWithoutLinks.map(c => (
                  <div key={c.id} className="text-[11px] text-yellow-700">
                    • {c.trade_name || c.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legenda */}
      {ownershipLinks.length > 0 && (
        <div className="flex items-center gap-6 text-xs text-slate-600 border border-slate-200 rounded-lg p-3 bg-white">
          <div className="flex items-center gap-2">
            <div style={{ width: '16px', height: '2px', background: '#059669' }}></div>
            <span>Controlador</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: '16px', height: '2px', background: '#64748b' }}></div>
            <span>Investidor</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Múltiplos vínculos</span>
          </div>
          {investorCompanies.length > 0 && (
            <div className="text-slate-500">
              {investorCompanies.length} investidor(es) → {investedCompanies.length} investida(s)
            </div>
          )}
        </div>
      )}

      {/* Dialog para criar/editar vínculo */}
      <CreateOwnershipLinkDialog
        open={linkDialog}
        onOpenChange={setLinkDialog}
        groupId={groupId}
        tenantId={tenantId}
        companies={companies}
        existingLink={editingLink}
        onCreated={() => {
          setEditingLink(null);
          setLinkDialog(false);
        }}
      />

      {/* Dialog de confirmação de delete */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Vínculo Societário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este vínculo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog)}
            className="bg-red-600 hover:bg-red-700"
          >
            Deletar
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Componente do Card
/**
 * @param {Object} props
 * @param {any=} props.company
 * @param {any=} props.getCompanyName
 * @param {any=} props.type
 * @param {any=} props.investors
 * @param {any=} props.investments
 * @param {any=} props.totalEquity
 * @param {any=} props.onEditLink
 * @param {any=} props.onDeleteLink
 */
function CompanyCard({ company, getCompanyName, type, investors, investments, totalEquity, onEditLink, onDeleteLink }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm" style={{ minHeight: CARD_HEIGHT }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-slate-900 truncate">
            {company.trade_name || company.name}
          </h4>
          {company.tax_id && (
            <p className="text-xs text-slate-500">{company.tax_id}</p>
          )}
        </div>
      </div>

      {/* Seção: Investidores (para empresa investida) */}
      {type === 'invested' && investors && investors.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-slate-700">
              Investidores {investors.length > 1 && `(${investors.length})`}
            </span>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {investors.map((link, idx) => {
              const investorName = link.investor_company_id
                ? getCompanyName(link.investor_company_id)
                : link.investor_person_name;
              return (
                <div key={idx} className="flex items-center justify-between text-xs group">
                  <span className="text-slate-700 truncate flex-1">
                    {investorName}
                    {link.is_controller && (
                      <span className="ml-1 inline-block px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                        Ctrl
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1 ml-2">
                    <span className="text-slate-900 font-semibold">
                      {link.percentage.toFixed(2)}%
                    </span>
                    <div className="hidden group-hover:flex gap-0.5">
                      <button
                        onClick={() => onEditLink(link)}
                        className="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteLink(link.id)}
                        className="p-1 hover:bg-red-100 rounded text-red-600 transition-colors"
                        title="Deletar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {totalEquity !== 100 && (
            <div className="mt-2 flex items-start gap-1 p-2 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700">
              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>Total: {totalEquity.toFixed(2)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Seção: Investimentos (para empresa investidora) */}
      {type === 'investor' && investments && investments.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-slate-700">
              Participa de ({investments.length})
            </span>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {investments.map((link, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs group">
                <span className="text-slate-700 truncate flex-1">
                  {getCompanyName(link.invested_company_id)}
                </span>
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-slate-900 font-semibold">
                    {link.percentage.toFixed(2)}%
                  </span>
                  <div className="hidden group-hover:flex gap-0.5">
                    <button
                      onClick={() => onEditLink(link)}
                      className="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onDeleteLink(link.id)}
                      className="p-1 hover:bg-red-100 rounded text-red-600 transition-colors"
                      title="Deletar"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadados */}
      {(company.share_capital || company.sector) && (
        <div className="mt-4 pt-4 border-t text-xs text-slate-600 space-y-1">
          {company.share_capital && (
            <p>Capital: <span className="font-medium">R$ {(company.share_capital / 1000000).toFixed(1)}M</span></p>
          )}
          {company.sector && (
            <p>Setor: <span className="font-medium">{company.sector}</span></p>
          )}
        </div>
      )}
    </div>
  );
}