/**
 * GroupStructureOrgChart.jsx
 * Layout Hierárquico por Coordenadas Absolutas e Conectores em SVG.
 * 100% Determinístico, livre de colisões e usando React Ref padrão (ref={canvasRef}).
 */
import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Building2, MapPin, Plus, ExternalLink, RefreshCw,
  Maximize2, ChevronRight, BookOpen, Download, Loader2,
  Pencil, Lock, Unlock, Ban, CheckCircle2 } from
'lucide-react';
import CreateUnitDialog from '@/components/assessments/CreateUnitDialog';
import EditEntityDialog from '@/components/assessments/EditEntityDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { groupKey, invalidateStructureQueries } from '@/lib/query-client';

const ROLE_LABELS = {
  matriz: 'Matriz',
  holding: 'Holding',
  sub_holding: 'Sub-Holding',
  filial: 'Filial',
  investida: 'Investida',
  joint_venture: 'Joint Venture',
  coligada: 'Coligada',
};

/* ── Constantes de Layout Hierárquico ── */
const ROOT_W = 360;
const ROOT_H = 135;

const COMPANY_W = 320;
const COMPANY_H = 195; // Card de Empresa com altura estrita no CSS

const UNIT_W = 290;
const UNIT_H = 54;
const UNIT_GAP = 10;

const GAP_X = 48;
const ROOT_Y = 32;
const UNITS_START_GAP = 34;

const ROOT_TO_FIRST_LEVEL_GAP = 130;
const COMPANY_LEVEL_0_Y = ROOT_Y + ROOT_H + ROOT_TO_FIRST_LEVEL_GAP;
const LEVEL_VERTICAL_GAP = 90; // Distância segura após o término das unidades do nível anterior

const CANVAS_PADDING_X = 48;
const CANVAS_PADDING_BOTTOM = 48;

/* ── Helpers ── */
function formatCurrency(val) {
  if (!val) return null;
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `R$ ${(val / 1_000).toFixed(0)}K`;
  return `R$ ${val.toLocaleString('pt-BR')}`;
}

function getEntityStatusClass(entity) {
  if (!entity) return 'operational';
  if (entity.is_operational === false) return 'non-operational';
  const status = entity.operational_status || entity.operation_status || entity.operational_type || null;
  if (status === 'non_operational' || status === 'nao_operacional' || status === 'Não operacional') return 'non-operational';
  if (status === 'partial' || status === 'partially_operational' || status === 'parcial') return 'partial';
  return 'operational';
}

function getEntityStatusLabel(entity) {
  const c = getEntityStatusClass(entity);
  if (c === 'non-operational') return 'Não operacional';
  if (c === 'partial') return 'Parcial';
  return 'Operacional';
}

/* ── Função 1: Montar Árvore Visual (Ownership Principal + Complementar) ── */
function buildVisualHierarchy(companies, ownershipLinks) {
  const companyById = Object.fromEntries(
    companies.map((company) => [company.id, company])
  );

  const linksByInvested = ownershipLinks.reduce((acc, link) => {
    if (!link.invested_company_id) return acc;
    if (!acc[link.invested_company_id]) {
      acc[link.invested_company_id] = [];
    }
    acc[link.invested_company_id].push(link);
    return acc;
  }, {});

  const parentByCompany = {};
  const primaryLinkByCompany = {};
  const secondaryLinksByCompany = {};

  companies.forEach((company) => {
    const links = linksByInvested[company.id] || [];

    if (!links.length) {
      parentByCompany[company.id] = null;
      primaryLinkByCompany[company.id] = null;
      secondaryLinksByCompany[company.id] = [];
      return;
    }

    // Regra do Pai Visual Principal: Prioriza is_controller, depois maior percentual
    const controllerLink =
    links.find((link) => link.is_controller && link.investor_company_id && companyById[link.investor_company_id]) ||
    [...links].
    filter((link) => link.investor_company_id && companyById[link.investor_company_id]).
    sort((a, b) => Number(b.percentage || 0) - Number(a.percentage || 0))[0];

    if (
    controllerLink &&
    controllerLink.investor_company_id &&
    companyById[controllerLink.investor_company_id] &&
    controllerLink.investor_company_id !== company.id)
    {
      parentByCompany[company.id] = controllerLink.investor_company_id;
      primaryLinkByCompany[company.id] = controllerLink;
    } else {
      parentByCompany[company.id] = null;
      primaryLinkByCompany[company.id] = null;
    }

    // Vínculos secundários: todos exceto o primário
    secondaryLinksByCompany[company.id] = links.filter((link) => {
      if (!link.investor_company_id) return false;
      if (!companyById[link.investor_company_id]) return false;
      if (controllerLink && link.id === controllerLink.id) return false;
      return true;
    });
  });

  const childrenByParent = {};

  companies.forEach((company) => {
    const parentId = parentByCompany[company.id];
    const key = parentId || 'root';

    if (!childrenByParent[key]) {
      childrenByParent[key] = [];
    }
    childrenByParent[key].push(company);
  });

  return {
    companyById,
    linksByInvested,
    parentByCompany,
    primaryLinkByCompany,
    secondaryLinksByCompany,
    childrenByParent
  };
}

/* ── Função 2: Calcular Degraus por Nível ── */
function calculateCompanyLevels(companies, parentByCompany) {
  const levelByCompany = {};
  const visiting = new Set();

  function getLevel(companyId) {
    if (levelByCompany[companyId] !== undefined) {
      return levelByCompany[companyId];
    }

    if (visiting.has(companyId)) {
      levelByCompany[companyId] = 0; // Prevenção de loop
      return 0;
    }

    visiting.add(companyId);
    const parentId = parentByCompany[companyId];

    if (!parentId) {
      levelByCompany[companyId] = 0;
    } else {
      levelByCompany[companyId] = getLevel(parentId) + 1;
    }

    visiting.delete(companyId);
    return levelByCompany[companyId];
  }

  companies.forEach((company) => getLevel(company.id));
  return levelByCompany;
}

/* ── Função 3: Calcular Layout Dinâmico Acumulado ── */
function calculateHierarchicalLayouts(companies, hierarchy, unitsByCompany) {
  const { parentByCompany } = hierarchy;
  const levelByCompany = calculateCompanyLevels(companies, parentByCompany);

  const companiesByLevel = companies.reduce((acc, company) => {
    const level = levelByCompany[company.id] || 0;
    if (!acc[level]) acc[level] = [];
    acc[level].push(company);
    return acc;
  }, {});

  const maxLevel = Math.max(0, ...Object.keys(companiesByLevel).map(Number));

  // 1. Calcular o Y exato de cada nível com base no acúmulo de unidades do nível anterior
  const levelY = {};
  let currentY = COMPANY_LEVEL_0_Y;

  for (let level = 0; level <= maxLevel; level++) {
    const levelCompanies = companiesByLevel[level] || [];
    levelY[level] = currentY;

    const maxLevelColumnHeight = Math.max(
      COMPANY_H + UNITS_START_GAP + UNIT_H,
      ...levelCompanies.map((company) => {
        const units = unitsByCompany[company.id] || [];
        const unitsHeight = units.length > 0 ?
        units.length * UNIT_H + (units.length - 1) * UNIT_GAP :
        UNIT_H;

        return COMPANY_H + UNITS_START_GAP + unitsHeight;
      })
    );

    currentY += maxLevelColumnHeight + LEVEL_VERTICAL_GAP;
  }

  // 2. Definir dimensões usando a maior largura de nível encontrada
  const maxLevelWidth = Math.max(
    1,
    ...Object.values(companiesByLevel).map((levelCompanies) =>
    levelCompanies.length * COMPANY_W + Math.max(0, levelCompanies.length - 1) * GAP_X
    )
  );

  const canvasWidth = Math.max(maxLevelWidth + CANVAS_PADDING_X * 2, 1100);
  const rootX = canvasWidth / 2 - ROOT_W / 2;

  const layouts = [];

  for (let level = 0; level <= maxLevel; level++) {
    const levelCompanies = companiesByLevel[level] || [];
    const levelWidth = levelCompanies.length * COMPANY_W + Math.max(0, levelCompanies.length - 1) * GAP_X;
    const firstX = canvasWidth / 2 - levelWidth / 2;
    const y = levelY[level];

    levelCompanies.forEach((company, index) => {
      const units = unitsByCompany[company.id] || [];
      const x = firstX + index * (COMPANY_W + GAP_X);

      const unitsHeight = units.length > 0 ?
      units.length * UNIT_H + (units.length - 1) * UNIT_GAP :
      UNIT_H;

      layouts.push({
        company,
        units,
        level,
        x,
        y,
        centerX: x + COMPANY_W / 2,
        topY: y,
        bottomY: y + COMPANY_H,
        unitsTopY: y + COMPANY_H + UNITS_START_GAP,
        unitsHeight,
        parentId: parentByCompany[company.id] || null
      });
    });
  }

  const maxColumnHeight = Math.max(
    COMPANY_LEVEL_0_Y + COMPANY_H,
    ...layouts.map((layout) => layout.unitsTopY + layout.unitsHeight)
  );

  const canvasHeight = maxColumnHeight + CANVAS_PADDING_BOTTOM;

  return {
    layouts,
    canvasWidth,
    canvasHeight,
    rootX,
    levelByCompany
  };
}

/* ── Conectores SVG Hierárquicos (Padrão Anticolisão + Complementares) ── */
function OperationalConnectors({ rootX, rootY, layouts, secondaryLinksByCompany }) {
  if (!layouts.length) return null;

  const layoutByCompanyId = Object.fromEntries(
    layouts.map((layout) => [layout.company.id, layout])
  );

  const rootBottomX = rootX + ROOT_W / 2;
  const rootBottomY = rootY + ROOT_H;

  const rootCompanies = layouts.filter((layout) => !layout.parentId);
  const paths = [];

  // 1. Conexão Grupo -> Empresas Raiz (Nível 0)
  if (rootCompanies.length > 0) {
    const rootHubY = rootCompanies[0].topY - 56;
    const firstRootX = Math.min(...rootCompanies.map((l) => l.centerX));
    const lastRootX = Math.max(...rootCompanies.map((l) => l.centerX));

    paths.push(
      <path
        key="root-vertical"
        d={`M ${rootBottomX} ${rootBottomY} L ${rootBottomX} ${rootHubY}`}
        stroke="#94a3b8"
        strokeWidth="1.5"
        fill="none" />

    );

    if (rootCompanies.length > 1) {
      paths.push(
        <path
          key="root-horizontal"
          d={`M ${firstRootX} ${rootHubY} L ${lastRootX} ${rootHubY}`}
          stroke="#94a3b8"
          strokeWidth="1.5"
          fill="none" />

      );
    }

    rootCompanies.forEach((layout) => {
      paths.push(
        <path
          key={`root-to-${layout.company.id}`}
          d={`M ${layout.centerX} ${rootHubY} L ${layout.centerX} ${layout.topY}`}
          stroke="#94a3b8"
          strokeWidth="1.5"
          fill="none" />

      );
    });
  }

  // 2. Conexão Controladora -> Controlada (Começa ABAIXO do bloco de unidades do pai)
  layouts.
  filter((layout) => layout.parentId).
  forEach((layout) => {
    const parent = layoutByCompanyId[layout.parentId];
    if (!parent) return;

    const startX = parent.centerX;
    const startY = parent.unitsTopY + parent.unitsHeight + 8;
    const endX = layout.centerX;
    const endY = layout.topY;

    const midY = startY + (endY - startY) / 2;

    paths.push(
      <path
        key={`company-to-company-${parent.company.id}-${layout.company.id}`}
        d={`M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`}
        stroke="#94a3b8"
        strokeWidth="1.5"
        fill="none" />

    );
  });

  // 3. Conexão Empresa -> Unidades
  layouts.forEach((layout) => {
    paths.push(
      <path
        key={`to-units-${layout.company.id}`}
        d={`M ${layout.centerX} ${layout.bottomY} L ${layout.centerX} ${layout.unitsTopY}`}
        stroke="#bbf7d0"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        fill="none" />

    );
  });

  // 4. Vínculos societários complementares (secundários)
  if (secondaryLinksByCompany) {
    Object.entries(secondaryLinksByCompany).forEach(([investedCompanyId, links]) => {
      const investedLayout = layoutByCompanyId[investedCompanyId];
      if (!investedLayout || !links.length) return;

      links.forEach((link, index) => {
        const investorLayout = layoutByCompanyId[link.investor_company_id];
        if (!investorLayout) return;

        const startX = investorLayout.centerX;
        const startY = investorLayout.unitsTopY + investorLayout.unitsHeight + 18 + index * 10;

        const endX = investedLayout.centerX;
        const endY = investedLayout.topY - 12 - index * 10;

        const midY = startY + (endY - startY) / 2;

        paths.push(
          <path
            key={`secondary-link-${link.id || `${link.investor_company_id}-${investedCompanyId}-${index}`}`}
            d={`M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`}
            stroke="#64748b"
            strokeWidth="1.2"
            strokeDasharray="5 5"
            fill="none"
            opacity="0.55" />

        );
      });
    });
  }

  return paths;
}

/* ── Componentes de Nó Estáveis ── */
function GroupRootNode({ group, companiesCount, unitsCount, operationalUnits, nonOperationalUnits }) {
  return (
    <div className="org-root-node w-full h-full">
      <div className="flex items-start gap-3">
        <div className="org-root-icon">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="org-root-name truncate">{group.name}</h4>
          <p className="org-root-meta truncate">
            {[group.structure_type || group.group_type, group.entity_nature || group.operation_type, group.main_sector || group.sector].
            filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <div className="org-root-metrics">
        <div>
          <strong>{companiesCount}</strong>
          <span>Empresas</span>
        </div>
        <div>
          <strong>{unitsCount}</strong>
          <span>Unidades</span>
        </div>
        <div>
          <strong>{operationalUnits}</strong>
          <span>Operacionais</span>
        </div>
        <div>
          <strong>{nonOperationalUnits}</strong>
          <span>Não op.</span>
        </div>
      </div>
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.company
 * @param {any=} props.unitsCount
 * @param {any=} props.operationalUnits
 * @param {any=} props.nonOperationalUnits
 * @param {any=} props.onAddUnit
  * @param {any=} props.view
 */
function CompanyNodeCard({ company, unitsCount, operationalUnits, nonOperationalUnits, onAddUnit }) {
  const statusClass = getEntityStatusClass(company);
  const statusLabel = getEntityStatusLabel(company);
  const capitalFormatted = formatCurrency(company.share_capital);

  return (
    <div className="company-node-card">
      <div className="company-node-header">
        <div className="company-node-icon">
          <Building2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="company-node-title truncate">
                {company.trade_name || company.name}
              </div>
              <div className="company-node-meta flex flex-col gap-0.5">
                {company.tax_id && <span className="font-mono text-sm pl-1 pr-6">{company.tax_id}</span>}
                {(company.city || company.state) &&
                <span className="flex items-center gap-0.5 text-[10px]">
                    <MapPin className="w-2.5 h-2.5" />
                    {[company.city, company.state].filter(Boolean).join('/')}
                  </span>
                }
                {company.sector && <span className="text-[10px] truncate text-slate-500">{company.sector}</span>}
              </div>
            </div>
            <span className={`entity-status-chip ${statusClass} flex-shrink-0`}>{statusLabel}</span>
          </div>
        </div>
      </div>

      <div className="company-node-metrics">
        <div>
          <strong>{unitsCount}</strong>
          <span>{unitsCount === 1 ? 'Unidade' : 'Unidades'}</span>
        </div>
        <div>
          <strong>{operationalUnits}</strong>
          <span>Operacionais</span>
        </div>
        <div>
          {capitalFormatted ?
          <><strong className="text-[11px] truncate">{capitalFormatted}</strong><span>Capital Social</span></> :
          <><strong>{nonOperationalUnits}</strong><span>Não op.</span></>
          }
        </div>
      </div>

      <div className="company-node-footer">
        <button type="button" onClick={onAddUnit} className="company-node-action-btn">
          <Plus className="w-3 h-3" /> Unidade
        </button>
        <Link to={createPageUrl(`CompanyDetail?id=${company.id}`)} className="company-node-action-btn primary">
          Abrir <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.unit
 */
function UnitNodeCard({ unit }) {
  const statusClass = getEntityStatusClass(unit);
  const statusLabel = getEntityStatusLabel(unit);

  return (
    <div className="unit-node-card">
      <div className="unit-node-icon">
        <MapPin className="w-5 h-5" />
      </div>
      <div className="unit-node-content">
        <div>
          <div className="unit-node-title">{unit.name}</div>
          <div className="unit-node-meta">
            {[unit.city, unit.location_state || unit.state].filter(Boolean).join('/')}
            {unit.unit_type ? ` · ${unit.unit_type}` : ''}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 mt-1.5">
          <span className={`entity-status-chip ${statusClass} flex-shrink-0 text-[10px]`}>{statusLabel}</span>
          <Link to={createPageUrl(`UnitDetail?id=${unit.id}`)} className="text-[10px] font-bold flex items-center gap-1 text-emerald-700 hover:text-emerald-800 transition-colors flex-shrink-0">
            Ver detalhes <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.onAddUnit
 */
function EmptyUnitNode({ onAddUnit }) {
  return (
    <button onClick={onAddUnit} className="empty-unit-node">
      <Plus className="w-3.5 h-3.5" />
      <span><strong>+ Unidade</strong> · Nenhuma cadastrada</span>
    </button>);

}

/**
 * @param {Object} props
 * @param {any=} props.company
 * @param {any=} props.units
 * @param {any=} props.onAddUnit
 */
function CompanyColumn({ company, units, onAddUnit }) {
  const operationalUnits = units.filter((u) => getEntityStatusClass(u) === 'operational').length;
  const nonOperationalUnits = units.filter((u) => getEntityStatusClass(u) === 'non-operational').length;

  return (
    <div className="company-column flex flex-col items-center">
      <CompanyNodeCard
        company={company}
        unitsCount={units.length}
        operationalUnits={operationalUnits}
        nonOperationalUnits={nonOperationalUnits}
        onAddUnit={onAddUnit} />
      
      <div className="units-column" style={{ marginTop: UNITS_START_GAP }}>
        {units.length > 0 &&
        units.map((unit) =>
        <UnitNodeCard key={unit.id} unit={unit} />
        )
        }
      </div>
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.group
 * @param {any=} props.tenantId
 * @param {any=} props.onAddCompany
  * @param {any=} props.view
 */
export default function GroupStructureOrgChart({ group, tenantId, onAddCompany }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canvasRef = useRef(null);
  const printRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [showLegend, setShowLegend] = useState(true);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [addUnitFor, setAddUnitFor] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [busyCompanyId, setBusyCompanyId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);

  const handlePrintPdf = async () => {
    const target = canvasRef.current;
    if (!target) return;
    setExportingPdf(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      const fileName = `Organograma_${(group?.name || 'Grupo').replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);
    } catch (e) {
      alert('Erro ao gerar PDF: ' + (e.message || 'Tente novamente.'));
    } finally {
      setExportingPdf(false);
    }
  };

  // 1. Fetch de Empresas (inclui bloqueadas para gestão na mesma tela)
  const { data: companiesRaw = [], isLoading: loadingCompanies } = useQuery({
    queryKey: groupKey(tenantId, group?.id, 'companies-oc'),
    queryFn: () =>
      base44.entities.Company.filter({
        group_id: group.id,
        include_archived: true,
      }),
    enabled: !!group?.id
  });
  const allCompanies = companiesRaw;
  const companies = companiesRaw.filter((c) => !c.is_archived && c.is_active !== false);
  const companyIds = companies.map((c) => c.id);
  const companyIdsKey = [...companyIds].sort().join('|');

  // 2. Fetch de CompanyOwnershipLink (Composição Societária)
  const { data: ownershipLinks = [] } = useQuery({
    queryKey: groupKey(tenantId, group?.id, 'ownership-links-oc'),
    queryFn: () => base44.entities.CompanyOwnershipLink.filter({ group_id: group.id }, '-percentage', 500),
    enabled: !!group?.id
  });

  // 3. Fetch de Unidades
  const { data: allUnitsRaw = [] } = useQuery({
    queryKey: groupKey(tenantId, group?.id, 'units-org-chart', companyIdsKey),
    queryFn: async () => {
      if (!companyIds.length) return [];
      const results = await Promise.all(
        companyIds.map((cid) =>
        base44.entities.OperationalUnit.filter({ company_id: cid }, 'name', 100)
        )
      );
      return results.flat();
    },
    enabled: !!group?.id && companyIds.length > 0
  });
  const activeUnits = allUnitsRaw.filter((u) => u.is_active !== false);

  const unitsByCompany = activeUnits.reduce((acc, unit) => {
    if (!acc[unit.company_id]) acc[unit.company_id] = [];
    acc[unit.company_id].push(unit);
    return acc;
  }, {});

  const totalOperational = activeUnits.filter((u) => getEntityStatusClass(u) === 'operational').length;
  const totalNonOperational = activeUnits.filter((u) => getEntityStatusClass(u) === 'non-operational').length;

  // 4. Construção da Árvore e Layout Hierárquico Dinâmico
  const hierarchy = buildVisualHierarchy(companies, ownershipLinks);
  const { layouts, canvasWidth, canvasHeight, rootX } = calculateHierarchicalLayouts(
    companies,
    hierarchy,
    unitsByCompany
  );

  // 5. Ajustar Tela Proporcional (Largura e Altura)
  const handleFitToScreen = () => {
    if (!canvasRef.current) {
      setZoom(1);
      return;
    }
    const viewportWidth = canvasRef.current.clientWidth - 48;
    const viewportHeight = canvasRef.current.clientHeight - 48;

    const zoomByWidth = viewportWidth / canvasWidth;
    const zoomByHeight = viewportHeight / canvasHeight;

    const calculatedZoom = Math.min(1, zoomByWidth, zoomByHeight);
    setZoom(Math.max(0.4, Number(calculatedZoom.toFixed(2))));
  };

  useEffect(() => {
    if (companies.length > 3) {
      handleFitToScreen();
    }
  }, [companies.length, canvasHeight]);

  function handleAddUnit(companyId) {
    setAddUnitFor(companyId);
    setUnitDialogOpen(true);
  }

  function invalidateCompanies() {
    invalidateStructureQueries(queryClient, tenantId, 'group');
    queryClient.invalidateQueries({ queryKey: groupKey(tenantId, group?.id, 'companies-oc') });
    queryClient.invalidateQueries({ queryKey: groupKey(tenantId, group?.id, 'companies') });
    queryClient.invalidateQueries({ queryKey: groupKey(tenantId, group?.id, 'companies-all') });
  }

  function handleEditCompany(company) {
    if (company.is_archived) {
      toast({
        title: 'Empresa bloqueada',
        description: 'Desbloqueie a empresa antes de editar.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedCompanyId(company.id);
    setEditingCompany(company);
    setEditOpen(true);
  }

  async function handleToggleBlock(company) {
    const nextBlocked = !company.is_archived;
    setBusyCompanyId(company.id);
    try {
      await base44.entities.Company.update(company.id, { is_archived: nextBlocked });
      invalidateCompanies();
      toast({
        title: nextBlocked ? 'Empresa bloqueada' : 'Empresa desbloqueada',
        description: nextBlocked
          ? `“${company.name}” foi bloqueada.`
          : `“${company.name}” voltou a ficar ativa.`,
      });
    } catch (err) {
      toast({
        title: 'Falha ao alterar status',
        description: err?.message || 'Erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setBusyCompanyId(null);
    }
  }

  if (loadingCompanies) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Carregando estrutura operacional…
      </div>);

  }

  return (
    <div className="structure-panel flex flex-col">
      {/* Header */}
      <div className="structure-panel-header flex items-start justify-between gap-16 mb-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Organograma societário</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {allCompanies.length} empresa{allCompanies.length === 1 ? '' : 's'} no grupo
            {allCompanies.some((c) => c.is_archived)
              ? ` · ${allCompanies.filter((c) => c.is_archived).length} bloqueada(s)`
              : ''}
          </p>
        </div>
        <div className="structure-panel-actions flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="h-8 gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
            onClick={onAddCompany ?? (() => {})}
          >
            <Plus className="w-3.5 h-3.5" />
            Incluir empresa
          </Button>
          <button onClick={handleFitToScreen} className="structure-action-btn">
            <Maximize2 className="w-3.5 h-3.5" /> Ajustar à tela
          </button>
          <div className="zoom-control">
            <button onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.1).toFixed(1))))} className="zoom-btn">−</button>
            <span className="zoom-value">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(1.3, Number((z + 0.1).toFixed(1))))} className="zoom-btn">+</button>
          </div>
          <button onClick={() => setShowLegend((l) => !l)} className={`structure-action-btn ${showLegend ? 'active' : ''}`}>
            <BookOpen className="w-3.5 h-3.5" /> Legenda
          </button>
          <button onClick={handlePrintPdf} disabled={exportingPdf} className="structure-action-btn">
            {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exportingPdf ? 'Gerando PDF...' : 'Imprimir PDF'}
          </button>
        </div>
      </div>

      {/* Canvas Principal */}
      <div
        ref={canvasRef}
        className="structure-canvas relative w-full overflow-auto border rounded-xl bg-slate-50/50"
        style={{ minHeight: '620px' }}>
        
        {/* Wrapper de Escala sem cortes de margens */}
        <div
          style={{
            width: `${canvasWidth * zoom}px`,
            height: `${canvasHeight * zoom}px`,
            position: 'relative',
            margin: '0 auto'
          }}>
          
          {/* Linhas Conectoras - Fora do transform scale */}
          {companies.length > 0 &&
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${canvasWidth * zoom}px`,
              height: `${canvasHeight * zoom}px`,
              zIndex: 1,
              pointerEvents: 'none'
            }}>
            
              <svg
              className="absolute inset-0 overflow-visible"
              width="100%"
              height="100%"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
              
                <g style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'top left' }}>
                  <OperationalConnectors
                  rootX={rootX}
                  rootY={ROOT_Y}
                  layouts={layouts}
                  secondaryLinksByCompany={hierarchy.secondaryLinksByCompany} />
                
                </g>
              </svg>
            </div>
          }

          <div
            className="relative transition-transform duration-150"
            style={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              position: 'absolute',
              left: 0,
              top: 0,
              zIndex: 10
            }}>
            
            {/* Grupo (Nó Raiz) */}
            <div
              style={{
                position: 'absolute',
                left: `${rootX}px`,
                top: `${ROOT_Y}px`,
                width: `${ROOT_W}px`,
                height: `${ROOT_H}px`,
                zIndex: 10
              }}>
              
              <GroupRootNode
                group={group}
                companiesCount={companies.length}
                unitsCount={activeUnits.length}
                operationalUnits={totalOperational}
                nonOperationalUnits={totalNonOperational} />
              
            </div>

            {/* Empresas e Sub-holdings em Posição Absoluta */}
            {companies.length === 0 ?
            <div
              style={{
                position: 'absolute',
                left: `${canvasWidth / 2 - 140}px`,
                top: `${COMPANY_LEVEL_0_Y}px`,
                width: '280px',
                zIndex: 10
              }}>
              
                <button onClick={onAddCompany ?? (() => {})} className="empty-unit-node w-full">
                  <Plus className="w-3.5 h-3.5" />
                  <span><strong>+ Empresa</strong> · Nenhuma cadastrada</span>
                </button>
              </div> :

            layouts.map((layout) =>
            <div
              key={layout.company.id}
              style={{
                position: 'absolute',
                left: `${layout.x}px`,
                top: `${layout.y}px`,
                width: `${COMPANY_W}px`,
                zIndex: 10
              }}>
              
                  <CompanyColumn
                company={layout.company}
                units={layout.units}
                onAddUnit={() => handleAddUnit(layout.company.id)} />
              
                </div>
            )
            }
          </div>
        </div>
      </div>

      {showLegend &&
      <div className="structure-legend mt-4 flex items-center gap-4 border rounded-lg p-2 px-3 bg-white w-fit self-start flex-wrap">
          <div className="structure-legend-item text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500 block" />
            Operacional
          </div>
          <div className="structure-legend-item text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-500 block" />
            Parcialmente operacional
          </div>
          <div className="structure-legend-item text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-slate-300 block" />
            Não operacional
          </div>
        </div>
      }

      {/* Lista de empresas — mesma tela do organograma */}
      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Empresas do grupo</h4>
            <p className="text-xs text-slate-400">Selecione, edite, bloqueie ou desbloqueie</p>
          </div>
        </div>

        {allCompanies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
            Nenhuma empresa cadastrada. Use <strong>Incluir empresa</strong> no topo.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="w-10 px-3 py-2 font-medium" />
                  <th className="px-3 py-2 font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium">Documento</th>
                  <th className="px-3 py-2 font-medium">Papel</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {allCompanies.map((company) => {
                  const selected = selectedCompanyId === company.id;
                  const blocked = !!company.is_archived;
                  const busy = busyCompanyId === company.id;
                  return (
                    <tr
                      key={company.id}
                      onClick={() => setSelectedCompanyId(company.id)}
                      className={cn(
                        'cursor-pointer border-b border-slate-50 last:border-0 transition-colors',
                        selected ? 'bg-blue-50/70' : 'hover:bg-slate-50/80',
                        blocked && 'opacity-75',
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'flex h-4 w-4 items-center justify-center rounded-full border',
                            selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white',
                          )}
                        >
                          {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className={cn('font-medium text-slate-800 truncate', blocked && 'line-through decoration-slate-400')}>
                          {company.name}
                        </p>
                        {company.trade_name ? (
                          <p className="truncate text-xs text-slate-400">{company.trade_name}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-600">
                        {company.tax_id || company.cnpj || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        {ROLE_LABELS[company.company_role] || company.company_role || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {blocked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            <Ban className="h-3 w-3" /> Bloqueada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                            <CheckCircle2 className="h-3 w-3" /> Ativa
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 px-2 text-xs"
                            disabled={busy || blocked}
                            onClick={() => handleEditCompany(company)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'h-8 gap-1 px-2 text-xs',
                              blocked ? 'text-green-700' : 'text-red-600',
                            )}
                            disabled={busy}
                            onClick={() => handleToggleBlock(company)}
                          >
                            {busy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : blocked ? (
                              <Unlock className="h-3.5 w-3.5" />
                            ) : (
                              <Lock className="h-3.5 w-3.5" />
                            )}
                            {blocked ? 'Desbloquear' : 'Bloquear'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateUnitDialog
        open={unitDialogOpen}
        onOpenChange={setUnitDialogOpen}
        tenantId={tenantId}
        companies={companies}
        companyId={addUnitFor || undefined}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: groupKey(tenantId, null, 'units-org-chart') });
          queryClient.invalidateQueries({ queryKey: groupKey(tenantId, null, 'units-oc') });
          setUnitDialogOpen(false);
        }} />

      <EditEntityDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingCompany(null);
        }}
        entityType="company"
        entity={editingCompany}
        onSaved={() => {
          invalidateCompanies();
          setEditOpen(false);
          setEditingCompany(null);
        }}
      />
      
    </div>);

}