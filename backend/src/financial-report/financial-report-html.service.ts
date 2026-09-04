import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { formatKanitzFi, indicatorFullLabel } from './financial-report-formatting.util';
import { INDICATOR_REGISTRY, KANITZ_ZONE_LABELS } from './financial-indicator-registry.const';

/**
 * Monta o HTML/CSS impresso do Relatório da Análise a partir do payload de
 * FinancialReportDataService. Renderizado tanto para a prévia em tela (via
 * endpoint autenticado normal, num iframe) quanto para o PDF (Puppeteer
 * chama esta mesma função em processo, sem precisar de rota separada no
 * frontend nem de token de renderização) — mesmo HTML nos dois casos, zero
 * divergência entre prévia e PDF exportado.
 *
 * Orientação: documento retrato por padrão; seções específicas (o BP, via
 * classe "page-landscape") viram paisagem sozinhas quando a régua de coluna
 * não cabe — CSS Paged Media com página nomeada (ver css()), num único
 * page.pdf(), sem precisar gerar/mesclar dois PDFs.
 */
@Injectable()
export class FinancialReportHtmlService {
  /**
   * Logo FAL Agro embutida como data URI (base64) — funciona igual na
   * prévia em tela e no page.setContent() do Puppeteer, sem depender de
   * rede/autenticação para buscar um arquivo externo. Lida uma vez e
   * cacheada; nest-cli.json copia assets/ para dist/ no build (senão
   * __dirname aponta pra dist/financial-report e o PNG não estaria lá).
   */
  private static logoDataUriCache: string | null = null;
  /** Público: mantido exportado caso outro serviço precise da logo crua no futuro. */
  logoDataUri(): string {
    if (FinancialReportHtmlService.logoDataUriCache) return FinancialReportHtmlService.logoDataUriCache;
    try {
      const filePath = path.join(__dirname, 'assets', 'fal-logo.png');
      const buf = fs.readFileSync(filePath);
      FinancialReportHtmlService.logoDataUriCache = `data:image/png;base64,${buf.toString('base64')}`;
    } catch {
      FinancialReportHtmlService.logoDataUriCache = '';
    }
    return FinancialReportHtmlService.logoDataUriCache;
  }

  render(payload: any, opts: { watermarkDraft?: boolean; versionNumber?: number } = {}): string {
    const { watermarkDraft, versionNumber } = opts;
    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório de Análise Econômico-Financeira</title>
<style>${this.css()}</style>
</head>
<body>
${watermarkDraft ? '<div class="watermark">RASCUNHO</div>' : ''}
${this.renderCover(payload, versionNumber)}
${this.renderExecutiveSummary(payload)}
${this.renderStatementsSection(payload)}
${this.renderIndicatorsSection(payload)}
${this.renderKanitzSection(payload)}
${this.renderInsightsSection(payload)}
${this.renderRecommendationsSection(payload)}
</body>
</html>`;
  }

  private css(): string {
    return `
      /*
       * Altura de cabeçalho padronizada: 25mm (2,5cm) de margem de topo em
       * TODA página física exceto a capa — mesmo valor em retrato e
       * paisagem, pra a logo (headerTemplate do Puppeteer, ver
       * financial-report-pdf.service.ts) ficar sempre no mesmo lugar/altura
       * e o conteúdo começar sempre exatamente onde a margem termina, sem
       * respiro extra por página (antes cada seção reservava seu próprio
       * espaço via padding-top, dava alturas diferentes entre páginas —
       * bug real reportado). Capa mantém a margem original (14mm): tem a
       * logo grande central própria, não a pequena de canto repetida.
       */
      @page { size: A4 portrait; margin: 25mm 16mm 18mm 16mm; }
      @page :first { margin-top: 14mm; }
      /*
       * Página nomeada (CSS Paged Media) usada só quando a régua de coluna
       * fixa (LABEL_COL_MM/VALUE_COL_MM) não cabe em retrato com os dois
       * painéis do BP lado a lado — ex.: 3+ períodos. "page: bp-landscape"
       * troca SÓ essa página para paisagem dentro do mesmo page.pdf();
       * a próxima seção volta a herdar a @page padrão (retrato) automática,
       * já que a propriedade não se propaga para irmãos, só descendentes.
       */
      @page bp-landscape { size: A4 landscape; margin: 25mm 12mm 14mm 12mm; }
      .page-landscape { page: bp-landscape; }
      * { box-sizing: border-box; }
      /*
       * "Carlito" primeiro, não "Calibri": no container (Debian, sem fontes
       * Microsoft) o Chromium não encadeia corretamente pra 'Calibri' quando
       * o primeiro nome da lista ('Aptos', que nunca existiu aqui) falha —
       * cai direto no fallback genérico sans-serif (DejaVu Sans, bem mais
       * larga), estourando a régua de coluna calibrada em Calibri e
       * quebrando linha onde a prévia não quebrava. Carlito é metricamente
       * compatível com Calibri (Google/Red Hat, mesmas larguras de
       * caractere) — citando-o primeiro, direto, resolve sem ambiguidade de
       * encadeamento; 'Calibri' continua na lista pra quando este mesmo HTML
       * é aberto num navegador Windows real (a régua fica igual nos dois).
       */
      body { font-family: 'Carlito', 'Calibri', 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 10.5pt; line-height: 1.45; margin: 0; }
      .watermark { position: fixed; top: 45%; left: 15%; font-size: 90pt; color: rgba(220,38,38,0.12); transform: rotate(-30deg); z-index: 999; font-weight: 700; }
      .page { break-before: page; }
      .page:first-child { break-before: avoid; }
      .cover { break-before: avoid; min-height: 240mm; display: flex; flex-direction: column; justify-content: space-between; }
      .cover-top { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 18mm; }
      .cover-logo { width: 95mm; height: auto; margin-bottom: 16mm; }
      .cover-client-logo-space { width: 95mm; height: 34mm; margin-bottom: 14mm; }
      .cover h1 { font-size: 22pt; color: #1e293b; margin-bottom: 4mm; }
      .cover .subtitle { font-size: 13pt; color: #475569; margin-bottom: 12mm; }
      .cover .meta-row { display: flex; justify-content: space-between; padding: 2mm 0; border-bottom: 0.3mm solid #e2e8f0; font-size: 10.5pt; }
      .cover .meta-label { color: #64748b; }
      .cover .confidential { text-align: center; font-weight: 700; letter-spacing: 2px; color: #b91c1c; margin-top: 10mm; }
      h2.section-title { background: #1e293b; color: #fff; padding: 3mm 4mm; font-size: 13pt; margin: 0 0 5mm 0; break-after: avoid; }
      h3.subsection-title { background: #475569; color: #fff; padding: 2mm 3.5mm; font-size: 11pt; margin: 6mm 0 4mm 0; break-after: avoid; }
      h4.subtitle { color: #0f172a; font-weight: 700; font-size: 10.5pt; margin: 4mm 0 2mm 0; break-after: avoid; }
      .meta-bar { display: flex; flex-wrap: wrap; gap: 3mm 8mm; background: #f1f5f9; padding: 2.5mm 4mm; font-size: 9pt; color: #475569; margin-bottom: 4mm; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 4mm; font-size: 9pt; break-inside: avoid; }
      /* Régua única de coluna — mesma largura de texto e de número nas três
         demonstrações (BP/DRE/DFC), padrão auditoria: não redistribui
         conforme o conteúdo. */
      table.statement-table { table-layout: fixed; width: auto; }
      table.statement-table td, table.statement-table th { overflow-wrap: break-word; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; }
      /* Cabeçalho de ano/período sempre centralizado na coluna (só o
         cabeçalho — os valores numéricos abaixo continuam alinhados à
         direita, padrão contábil); a primeira coluna (rótulo/grupo) sempre
         à esquerda, em th e td. */
      th { background: #1e293b; color: #fff; text-align: center; padding: 1.5mm 2mm; font-weight: 600; }
      th:first-child, td:first-child { text-align: left; }
      td { padding: 1.2mm 2mm; text-align: right; border-bottom: 0.2mm solid #e2e8f0; }
      tr.row-group td { font-weight: 700; background: #e2e8f0; color: #334155; text-transform: uppercase; font-size: 8.5pt; }
      tr.row-detail td { color: #334155; }
      tr.row-detail td:first-child { padding-left: 5mm; }
      tr.row-calculated td { font-weight: 600; background: #f1f5f9; border-top: 0.25mm solid #cbd5e1; }
      tr.row-total td { font-weight: 700; background: #1e293b; color: #fff; border-top: 0.4mm solid #475569; }
      /* Linha divulgada que precisa de classificação manual antes da versão
         definitiva (ex.: DFC "Movimentações Patrimoniais Não Identificadas")
         — não pode ficar escondida como uma linha comum. */
      tr.row-highlight-warning td { background: #fffbeb; color: #92400e; font-weight: 600; }
      /* Selo de status de reconciliação da DFC (ver renderDfcReconciliationNote). */
      .dfc-reconciliation-note { margin-top: 8px; padding: 8px 12px; border-radius: 4px; border: 1px solid; font-size: 9.5px; }
      .dfc-reconciliation-note strong { display: block; margin-bottom: 2px; font-size: 10px; }
      .dfc-reconciliation-note p { margin: 0; }
      .dfc-reconciliation-ok { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
      .dfc-reconciliation-manual { background: #eff6ff; border-color: #bfdbfe; color: #1e40af; }
      .dfc-reconciliation-blocked { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
      /*
       * Painéis do BP lado a lado — Ativo e Passivo raramente têm o mesmo
       * número de linhas (contas diferentes por natureza), então o total de
       * cada lado não cai na mesma altura por acaso. align-items:stretch
       * (padrão do flex) faz os dois painéis terem a MESMA altura (a do
       * painel mais alto); dentro de cada painel, .panel-total-push com
       * margin-top:auto empurra só a tabela de total pro fim dessa altura
       * compartilhada — os dois totais ficam sempre alinhados na base,
       * mesmo painel mais curto sobrando espaço em branco acima do total
       * dele (mesmo truque do SidePanel/mt-auto na tela real).
       */
      .statement-panels { display: flex; gap: 4mm; margin-bottom: 4mm; align-items: stretch; }
      .statement-panels > div.panel-flex { display: flex; flex-direction: column; flex: 0 0 auto; min-width: 0; }
      .statement-panels table { margin-bottom: 0; }
      .panel-total-push { margin-top: auto; }
      /*
       * Régua fixa também nos quadros de indicadores (Liquidez/Endividamento/
       * Rentabilidade/Eficiência) — mesmo princípio do BP/DRE/DFC: sem
       * colgroup, cada quadro auto-dimensionava a própria coluna de texto e
       * de valor com base só no seu próprio conteúdo (largura de "M. BRUTA"
       * != "CAP. TERCEIROS / PL"), então os quadros empilhados na mesma
       * página não ficavam alinhados entre si. Calibrado medindo o rótulo
       * mais largo ("CAP. TERCEIROS / PL", 8.5pt/600) e o valor mais largo
       * plausível (moeda negativa formatada "-R$ 999.999.999,99", 9pt/700 —
       * a coluna "Atual" é a única em negrito, então dita o pior caso).
       */
      table.indicator-table { table-layout: fixed; width: auto; }
      table.indicator-table th { background: #1e293b; }
      th.indicator-group-th { text-align: left; }
      td.indicator-label { text-align: left; text-transform: uppercase; font-size: 8.5pt; color: #1e293b; font-weight: 600; overflow-wrap: break-word; }
      td.indicator-current { font-weight: 700; color: #0f172a; }
      p.narrative { margin: 0 0 3mm 0; text-align: justify; }
      /*
       * Semáforo de risco — traço vertical fino (não badge, não ponto
       * dentro de uma caixa) na cor de classificação, à esquerda do achado.
       * Design deliberadamente contido: o resto do relatório é texto sóbrio
       * em preto/cinza sobre branco, então achados não podem ser a única
       * seção "cheia de cor" — o traço já basta pra sinalizar risco sem
       * competir visualmente com o conteúdo. Divisória fina entre achados
       * (não moldura completa) separa os cartões dentro de cada grupo.
       */
      .finding-rule { border-left: 0.8mm solid; padding: 0 0 3mm 3.5mm; margin-bottom: 3mm; border-bottom: 0.2mm solid #e2e8f0; break-inside: avoid; }
      .finding-rule-last { border-bottom: none; margin-bottom: 4mm; padding-bottom: 0; }
      .finding-rule-head { display: flex; align-items: baseline; gap: 2mm; }
      .finding-rule h5 { margin: 0; font-size: 10pt; font-weight: 600; color: #0f172a; flex: 1; }
      .finding-rule .tag-classification { margin: 0; font-size: 7.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.02em; flex-shrink: 0; }
      .finding-rule .narrative { margin: 1.5mm 0 0 0; font-size: 9pt; color: #475569; }
      .finding-card-tags { display: flex; flex-wrap: wrap; gap: 2mm; margin: 1.5mm 0 0 0; font-size: 8pt; color: #94a3b8; }
      /* Resumo executivo por cor — leitura rápida antes de entrar achado a achado; única legenda da seção 3 (a versão com texto explicativo foi removida por duplicar esta). */
      .semaforo-summary { display: flex; gap: 6mm; padding: 0 0.5mm 3mm; border-bottom: 0.2mm solid #e2e8f0; margin-bottom: 4mm; font-size: 9pt; font-weight: 600; color: #1e293b; }
      .semaforo-summary span { display: inline-flex; align-items: center; gap: 2mm; }
      .semaforo-summary .dot { width: 4.2mm; height: 4.2mm; border-radius: 50%; border: 0.6mm solid #1e293b; box-sizing: border-box; }
      .kv { display: flex; gap: 8mm; margin: 3mm 0; }
      .kv .item { }
      .kv .item .label { font-size: 8pt; color: #64748b; }
      .kv .item .value { font-size: 13pt; font-weight: 700; color: #1e293b; }
      .empty-note { color: #94a3b8; font-style: italic; font-size: 9pt; }
      .kanitz-layout { display: flex; gap: 6mm; align-items: flex-start; margin: 3mm 0; break-inside: avoid; }
      .kanitz-svg-wrap { flex: 0 0 62mm; }
      .kanitz-interpretation { flex: 1; display: flex; flex-direction: column; gap: 3mm; }
      .kanitz-zone-card { border: 0.3mm solid; border-radius: 2mm; padding: 3mm 4mm; }
      .kanitz-zone-title { font-size: 12pt; font-weight: 700; }
      .kanitz-zone-fi { font-size: 8pt; font-weight: 500; color: #475569; background: #fff; border-radius: 3mm; padding: 0.5mm 2mm; margin-left: 2mm; }
      .kanitz-zone-short { font-size: 9.5pt; font-weight: 600; color: #1e293b; margin: 1mm 0; }
      .kanitz-zone-desc { font-size: 9pt; color: #475569; margin: 1mm 0; }
      .kanitz-legend { display: flex; flex-direction: column; gap: 2mm; }
      .kanitz-legend-item { display: flex; gap: 2.5mm; align-items: flex-start; font-size: 8.5pt; color: #475569; }
      .kanitz-legend-item .dot { width: 3mm; height: 3mm; border-radius: 50%; flex-shrink: 0; margin-top: 1mm; }
    `;
  }

  private renderCover(payload: any, versionNumber?: number): string {
    const cover = payload?.cover ?? {};
    const logo = this.logoDataUri();
    return `<section class="page cover">
      <div class="cover-top">
        ${logo ? `<img class="cover-logo" src="${logo}" alt="FAL Agro" />` : ''}
        <div class="cover-client-logo-space"></div>
        <h1>Relatório de Análise Econômico-Financeira</h1>
        <div class="subtitle">${this.esc(cover.companyName || '')}${cover.groupName ? ` · Grupo ${this.esc(cover.groupName)}` : ''}</div>
      </div>
      <div>
        <div class="meta-row"><span class="meta-label">Tipo de análise</span><span>${this.esc(cover.analysisTypeLabel || '')}</span></div>
        <div class="meta-row"><span class="meta-label">Data-base atual</span><span>${this.esc(cover.baseDateLabel || '')}</span></div>
        <div class="meta-row"><span class="meta-label">Períodos comparativos</span><span>${this.esc((cover.comparativePeriodLabels || []).join(', ') || '—')}</span></div>
        <div class="meta-row"><span class="meta-label">Data de emissão</span><span>${new Date(cover.issueDate || Date.now()).toLocaleDateString('pt-BR')}</span></div>
        <div class="meta-row"><span class="meta-label">Versão</span><span>v${versionNumber ?? 1}.0</span></div>
        <div class="confidential">CONFIDENCIAL</div>
      </div>
    </section>`;
  }

  private renderExecutiveSummary(payload: any): string {
    const kanitz = payload?.kanitz?.current;
    const findings = payload?.insights?.dataBaseAtual ?? [];
    const critical = findings.filter((f: any) => f.classification === 'critico' || f.severity === 'high' || f.severity === 'critical');

    // Síntese executiva: usa o texto gerado por LLM quando disponível (ver
    // FinancialNarrativeLlmService — opcional, cai no texto determinístico
    // abaixo sem GEMINI_API_KEY configurada ou se a chamada falhar).
    const llmText: string | null = payload?.narrative?.executiveSummaryLlm ?? null;
    const introHtml = llmText
      ? llmText.split(/\n{2,}/).map((p) => `<p class="narrative">${this.esc(p.trim())}</p>`).join('')
      : `<p class="narrative">Este relatório apresenta a análise econômico-financeira de ${this.esc(payload?.cover?.companyName || '')} com data-base em ${this.esc(payload?.cover?.baseDateLabel || '')}${(payload?.cover?.comparativePeriodLabels || []).length ? `, comparada aos períodos de ${this.esc((payload.cover.comparativePeriodLabels || []).join(', '))}` : ''}.</p>
      ${kanitz?.fi !== null && kanitz?.fi !== undefined ? `<p class="narrative">O Fator de Insolvência de Kanitz na data-base atual é de ${formatKanitzFi(Number(kanitz.fi))}, posicionando a empresa na ${(kanitz.zoneLabel || '').toLowerCase()}.</p>` : ''}`;

    return `<section class="page">      <h2 class="section-title">Síntese executiva</h2>
      ${introHtml}
      ${critical.length > 0
        ? `<h4 class="subtitle">Principais pontos de atenção</h4><ul>${critical.slice(0, 5).map((f: any) => `<li>${this.esc(f.title)}</li>`).join('')}</ul>`
        : '<p class="empty-note">Nenhum achado crítico identificado na data-base atual.</p>'}
    </section>`;
  }

  private renderStatementsSection(payload: any): string {
    const s = payload?.statements ?? {};
    const bp = this.renderStatement(s.bp, '1.1');
    const dre = this.renderStatement(s.dre, '1.2');
    const dfc = this.renderStatement(s.dfc, '1.3');
    // Título "1." e o BP (1.1) na MESMA página/seção — sem quebra de página
    // entre eles (por pedido explícito do usuário) — DRE/DFC continuam cada
    // uma em página exclusiva. BP troca pra paisagem sozinho quando a régua
    // de coluna não cabe em retrato; DRE/DFC (tabela única) seguem sempre
    // em retrato.
    return `<section class="page${bp.landscape ? ' page-landscape' : ''}">      <h2 class="section-title">1. Análise das demonstrações contábeis — Data-base: ${this.esc(payload?.cover?.baseDateLabel || '')}</h2>
      ${bp.html}
    </section>
    <section class="page">${dre.html}</section>
    <section class="page">${dfc.html}</section>`;
  }

  /**
   * Régua-padrão de coluna (mm) — mesma proporção texto:número nas três
   * demonstrações. Calibrada por medição real (canvas.measureText a 9pt
   * Aptos/Calibri) sobre o rótulo mais longo de fato renderizado nas três
   * demonstrações ("(+/-) Variação de Passivos Operacionais", ~59,7mm com
   * padding) e sobre o maior valor numérico plausível — até a casa dos
   * bilhões negativos, "(9.999.999.999)" ~20,4mm de texto — mais o padding
   * de célula (2mm cada lado). Um valor de coluna maior que o necessário
   * (ex.: 26mm) cria vão morto visível entre o texto e o número
   * alinhado à direita — não é "padrão auditoria", é desperdício de régua.
   */
  private static readonly LABEL_COL_MM = 62;
  private static readonly VALUE_COL_MM = 22;
  /** Largura útil da página retrato (A4 menos margens de 16mm cada lado, ver css()). */
  private static readonly CONTENT_WIDTH_MM = 178;
  /** Largura útil da página paisagem nomeada "bp-landscape" (297mm - 12mm×2, ver css()). */
  private static readonly CONTENT_WIDTH_LANDSCAPE_MM = 273;
  private static readonly PANEL_GAP_MM = 4;

  /**
   * Largura de coluna para uma tabela que dispõe de `availableWidthMm`.
   * Quando a régua-padrão (62mm + 26mm×período) cabe no espaço disponível
   * (caso comum de DRE/DFC — tabela única, largura cheia da página), usa o
   * padrão exato. Quando não cabe (BP com dois painéis lado a lado, cada um
   * só com metade da página), encolhe as DUAS colunas na mesma proporção
   * (mantém a mesma razão texto:número, só reduz a escala) em vez de deixar
   * a coluna de texto larga e "sobrando" espaço morto antes do número.
   */
  private computeColumnWidths(
    availableWidthMm: number,
    periodsCount: number,
    idealLabel: number = FinancialReportHtmlService.LABEL_COL_MM,
    idealValue: number = FinancialReportHtmlService.VALUE_COL_MM,
  ): { labelMm: number; valueMm: number } {
    if (periodsCount <= 0) return { labelMm: Math.min(idealLabel, availableWidthMm), valueMm: idealValue };
    const idealTotal = idealLabel + idealValue * periodsCount;
    if (idealTotal <= availableWidthMm) return { labelMm: idealLabel, valueMm: idealValue };
    const scale = availableWidthMm / idealTotal;
    return { labelMm: Math.max(24, idealLabel * scale), valueMm: Math.max(12, idealValue * scale) };
  }

  /**
   * Decide, só para o BP (dois painéis lado a lado), se a régua-padrão cabe
   * em retrato; se não, se cabe em paisagem sem encolher; só encolhe
   * proporcionalmente (mantendo a razão texto:número) se nem paisagem for
   * suficiente (muitos períodos). "Se necessário, paisagem" — nunca o
   * contrário: retrato é sempre a primeira opção.
   */
  private resolvePanelLayout(periodsCount: number): { landscape: boolean; cols: { labelMm: number; valueMm: number } } {
    const idealLabel = FinancialReportHtmlService.LABEL_COL_MM;
    const idealValue = FinancialReportHtmlService.VALUE_COL_MM;
    const idealTotal = idealLabel + idealValue * Math.max(periodsCount, 0);
    const portraitPerPanel = (FinancialReportHtmlService.CONTENT_WIDTH_MM - FinancialReportHtmlService.PANEL_GAP_MM) / 2;
    if (idealTotal <= portraitPerPanel) return { landscape: false, cols: { labelMm: idealLabel, valueMm: idealValue } };
    const landscapePerPanel = (FinancialReportHtmlService.CONTENT_WIDTH_LANDSCAPE_MM - FinancialReportHtmlService.PANEL_GAP_MM) / 2;
    if (idealTotal <= landscapePerPanel) return { landscape: true, cols: { labelMm: idealLabel, valueMm: idealValue } };
    return { landscape: true, cols: this.computeColumnWidths(landscapePerPanel, periodsCount) };
  }

  private renderStatement(section: any, numberPrefix: string): { html: string; landscape: boolean } {
    if (!section) return { html: '', landscape: false };
    const periods: string[] = section.periods ?? [];
    const hasData = section.panels?.some((p: any) => p.rows.length > 0) || section.rows?.length > 0;

    let tableHtml: string;
    let landscape = false;
    if (!hasData) {
      tableHtml = '<p class="empty-note">Demonstração ainda não disponível.</p>';
    } else if (section.panels) {
      const layout = this.resolvePanelLayout(periods.length);
      landscape = layout.landscape;
      tableHtml = `<div class="statement-panels">${section.panels
        .map(
          (panel: any) => `<div class="panel-flex">
            ${this.renderStatementTable(panel.label, periods, layout.cols, panel.rows, null, null)}
            <div class="panel-total-push">${this.renderTotalRowTable(layout.cols, periods, panel.totalLabel, panel.totalValues)}</div>
          </div>`,
        )
        .join('')}</div>`;
    } else {
      const cols = this.computeColumnWidths(FinancialReportHtmlService.CONTENT_WIDTH_MM, periods.length);
      tableHtml = this.renderStatementTable('Descrição de rubricas', periods, cols, section.rows, null, null);
    }

    const html = `
      <h3 class="subsection-title">${numberPrefix} ${this.esc(section.title)} — ${this.esc(section.dateLabel)}</h3>
      ${tableHtml}
      <h4 class="subtitle">${numberPrefix}.1 Comentários sobre a posição atual</h4>
      <p class="narrative">${this.esc(section.currentComment)}</p>
      ${section.historicalComment ? `<h4 class="subtitle">${numberPrefix}.2 Evolução histórica</h4><p class="narrative">${this.esc(section.historicalComment)}</p>` : ''}
      ${section.dfcReconciliation ? this.renderDfcReconciliationNote(section.dfcReconciliation) : ''}
    `;
    return { html, landscape };
  }

  /** Selo de status de reconciliação da DFC — ver DfcReconciliation em financial-report-data.service.ts. */
  private renderDfcReconciliationNote(r: { status: 'automatica' | 'manual' | 'nao_conciliada'; unclassifiedPeriods: string[] }): string {
    const info = {
      automatica: { cls: 'ok', label: 'DFC conciliada automaticamente', desc: 'Todos os períodos fecharam sem resíduo não identificado.' },
      manual: {
        cls: 'manual',
        label: 'DFC conciliada mediante classificação manual',
        desc: 'Há resíduo em "Movimentações patrimoniais não identificadas" que foi objeto de revisão e classificação manual pelo consultor responsável.',
      },
      nao_conciliada: {
        cls: 'blocked',
        label: 'DFC não conciliada — validação necessária',
        desc: `Resíduo pendente de classificação em "Movimentações patrimoniais não identificadas" nos período(s): ${r.unclassifiedPeriods.map((p) => this.esc(p)).join(', ')}. A versão definitiva do relatório não pode ser emitida enquanto este resíduo não for investigado e classificado.`,
      },
    }[r.status];
    return `<div class="dfc-reconciliation-note dfc-reconciliation-${info.cls}">
      <strong>${info.label}</strong>
      <p>${info.desc}</p>
    </div>`;
  }

  /**
   * Uma tabela de demonstração — mesma hierarquia visual das telas reais
   * (cabeçalho escuro, linha de grupo em cinza-claro em negrito, linhas de
   * detalhe indentadas, subtotal calculado, total final escuro), agora com
   * régua de coluna fixa (colgroup) igual nas três demonstrações — a
   * largura deixa de variar conforme o conteúdo de cada célula.
   */
  private renderStatementTable(
    headerLabel: string,
    periods: string[],
    cols: { labelMm: number; valueMm: number },
    rows: Array<{ kind: string; label: string; values: Record<string, number | null>; hideValues?: boolean; highlight?: 'warning' }>,
    totalLabel: string | null,
    totalValues: Record<string, number | null> | null,
  ): string {
    const colgroup = `<colgroup><col style="width:${cols.labelMm}mm">${periods.map(() => `<col style="width:${cols.valueMm}mm">`).join('')}</colgroup>`;
    const bodyRows = rows
      .map((r) => {
        const cells = periods
          .map((p) => `<td>${r.hideValues ? '' : this.fmtMoney(r.values?.[p])}</td>`)
          .join('');
        return `<tr class="row-${r.kind}${r.highlight ? ` row-highlight-${r.highlight}` : ''}"><td>${this.esc(r.label)}</td>${cells}</tr>`;
      })
      .join('');
    const totalRow = totalLabel && totalValues
      ? `<tr class="row-total"><td>${this.esc(totalLabel)}</td>${periods.map((p) => `<td>${this.fmtMoney(totalValues[p])}</td>`).join('')}</tr>`
      : '';
    // Cabeçalho da coluna usa o período curto ("2025"), não a data-base por
    // extenso — mesmo padrão das telas reais (rótulo longo só no título da
    // seção e no texto narrativo, não repetido em toda coluna).
    return `<table class="statement-table">${colgroup}<thead><tr><th>${this.esc(headerLabel)}</th>${periods.map((p) => `<th>${this.esc(p)}</th>`).join('')}</tr></thead><tbody>${bodyRows}${totalRow}</tbody></table>`;
  }

  /**
   * Tabela isolada só com a linha de total — mesmo colgroup (mesma régua de
   * coluna) da tabela de corpo acima dela, então os dois `<table>` empilhados
   * mantêm as colunas alinhadas mesmo sendo elementos separados. Existe
   * separada do corpo especificamente para o BP (painéis Ativo/Passivo lado
   * a lado): empurrada pro fim do painel via .panel-total-push (margin-top:
   * auto), replicando o alinhamento da base entre os dois totais que a tela
   * real já faz (SidePanel.jsx, mt-auto) — Ativo e Passivo raramente têm o
   * mesmo número de linhas, então sem isso os totais saem em alturas
   * diferentes.
   */
  private renderTotalRowTable(
    cols: { labelMm: number; valueMm: number },
    periods: string[],
    totalLabel: string | null,
    totalValues: Record<string, number | null> | null,
  ): string {
    if (!totalLabel || !totalValues) return '';
    const colgroup = `<colgroup><col style="width:${cols.labelMm}mm">${periods.map(() => `<col style="width:${cols.valueMm}mm">`).join('')}</colgroup>`;
    const totalRow = `<tr class="row-total"><td>${this.esc(totalLabel)}</td>${periods.map((p) => `<td>${this.fmtMoney(totalValues[p])}</td>`).join('')}</tr>`;
    return `<table class="statement-table">${colgroup}<tbody>${totalRow}</tbody></table>`;
  }

  /**
   * Régua fixa dos quadros de indicadores — coluna de texto igual à do
   * DRE/DFC (LABEL_COL_MM, 62mm), pra alinhar visualmente com as
   * demonstrações quando aparecem perto umas das outras no relatório; a
   * coluna de valor usa sua própria largura (30mm — precisa de mais espaço
   * que o número puro das demonstrações porque indicadores em moeda vêm
   * com o prefixo "R$"/"-R$", ver medição em computeColumnWidths).
   */
  private static readonly INDICATOR_VALUE_COL_MM = 30;

  /**
   * Mesma tabela da tela real de Histórico de indicadores
   * (FinancialIndicatorsHistory.jsx): cabeçalho escuro com o nome do grupo
   * na primeira célula, períodos em colunas — sem coluna de variação
   * inventada. A primeira coluna de dado usa o ano real da data-base (não
   * mais o rótulo genérico "Atual"), mesmo texto que a tela real já corrigiu
   * para exibir.
   */
  private renderIndicatorsSection(payload: any): string {
    const groups = payload?.indicators ?? [];
    const basePeriod: string | null = payload?.periodContext?.basePeriod ?? null;
    const historicalPeriods: string[] = [...(payload?.periodContext?.comparativePeriods ?? [])].reverse();
    const periodCount = (basePeriod ? 1 : 0) + historicalPeriods.length;
    const cols = this.computeColumnWidths(
      FinancialReportHtmlService.CONTENT_WIDTH_MM,
      periodCount,
      FinancialReportHtmlService.LABEL_COL_MM,
      FinancialReportHtmlService.INDICATOR_VALUE_COL_MM,
    );
    const colgroup = `<colgroup><col style="width:${cols.labelMm}mm">${[basePeriod, ...historicalPeriods]
      .map(() => `<col style="width:${cols.valueMm}mm">`)
      .join('')}</colgroup>`;

    // Cada grupo (liquidez/endividamento/rentabilidade/eficiência) traz sua
    // própria tabela SEGUIDA imediatamente do comentário desse mesmo
    // grupo — não um bloco de tabelas e só depois um comentário genérico
    // cobrindo tudo. Numeração 2.1/2.2/2.3/2.4 por grupo; o Termômetro de
    // Kanitz (renderKanitzSection) já é fixo em "2.5", por isso os grupos
    // aqui nunca podem passar de 4 sem colidir com esse número.
    const groupsWithRows = groups.filter((g: any) => g.rows?.length);
    const body = groupsWithRows
      .map((g: any, idx: number) => {
        const rows = g.rows
          .map((r: any) => {
            const byPeriod = new Map(r.values.map((v: any) => [v.period, v.formatted]));
            const currentCell = `<td class="indicator-current">${byPeriod.get(basePeriod) ?? '—'}</td>`;
            const historicalCells = historicalPeriods.map((p) => `<td>${byPeriod.get(p) ?? '—'}</td>`).join('');
            return `<tr><td class="indicator-label">${this.esc(r.label)}</td>${currentCell}${historicalCells}</tr>`;
          })
          .join('');
        const table = `<table class="indicator-table">${colgroup}<thead><tr><th class="indicator-group-th">${this.esc(g.label)}</th><th class="indicator-current-th">${this.esc(basePeriod ?? 'Atual')}</th>${historicalPeriods.map((p) => `<th>${this.esc(p)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;

        // Comentário técnico gerado por LLM, um por grupo (ver
        // FinancialNarrativeLlmService/financial-report-data.service.ts) —
        // essa seção nunca teve versão determinística equivalente à de
        // BP/DRE/DFC (só a tabela). Ausente (sem GEMINI_API_KEY, timeout
        // etc.), o grupo simplesmente não exibe comentário — nunca quebra
        // a geração do relatório.
        const prefix = `2.${idx + 1}`;
        const currentCommentHtml = g.currentComment
          ? `<h4 class="subtitle">${prefix}.1 Comentários sobre a posição atual</h4>${g.currentComment.split(/\n{2,}/).map((p: string) => `<p class="narrative">${this.esc(p.trim())}</p>`).join('')}`
          : '';
        const historicalCommentHtml = g.historicalComment
          ? `<h4 class="subtitle">${prefix}.2 Evolução histórica</h4>${g.historicalComment.split(/\n{2,}/).map((p: string) => `<p class="narrative">${this.esc(p.trim())}</p>`).join('')}`
          : '';

        return `<h3 class="subsection-title">${prefix} ${this.esc(g.label)}</h3>${table}${currentCommentHtml}${historicalCommentHtml}`;
      })
      .join('');

    return `<section class="page">      <h2 class="section-title">2. Análise dos indicadores financeiros — Data-base: ${this.esc(payload?.cover?.baseDateLabel || '')}</h2>
      ${body || '<p class="empty-note">Nenhum indicador calculado.</p>'}
    </section>`;
  }

  private renderKanitzSection(payload: any): string {
    const k = payload?.kanitz;
    if (!k) return '';
    const fi = k.current?.fi !== null && k.current?.fi !== undefined ? Number(k.current.fi) : null;
    const zoneInfo = this.kanitzZoneInfo(fi);
    const historyRows = (k.history ?? [])
      .map((h: any) => `<tr><td>${this.esc(h.periodLabel)}</td><td>${formatKanitzFi(h.fi)}</td><td>${h.zone ? this.esc(KANITZ_ZONE_LABELS[h.zone as 'insolvencia' | 'penumbra' | 'solvencia'] ?? h.zone) : '—'}</td></tr>`)
      .join('');
    return `<section class="page">      <h2 class="section-title">2.5 Termômetro de Kanitz</h2>
      <div class="kanitz-layout">
        <div class="kanitz-svg-wrap">${this.renderKanitzThermometerSvg(fi)}</div>
        <div class="kanitz-interpretation">
          <div class="kanitz-zone-card" style="background:${zoneInfo.bgColor};border-color:${zoneInfo.borderColor};">
            <div class="kanitz-zone-title" style="color:${zoneInfo.color};">${this.esc(zoneInfo.label)} <span class="kanitz-zone-fi">Fator ${this.esc(zoneInfo.formatted)}</span></div>
            <p class="kanitz-zone-short">${this.esc(zoneInfo.shortLabel)}</p>
            <p class="kanitz-zone-desc">${this.esc(zoneInfo.description)}</p>
            <p class="kanitz-zone-desc"><strong>Direcionamento:</strong> ${this.esc(zoneInfo.recommendation)}</p>
          </div>
          <div class="kanitz-legend">
            <div class="kanitz-legend-item"><span class="dot" style="background:#047857;"></span><div><strong>Solvente</strong> — de 0 a +7<br/>Situação financeira saudável, com maior capacidade de pagamento.</div></div>
            <div class="kanitz-legend-item"><span class="dot" style="background:#d97706;"></span><div><strong>Penumbra</strong> — de 0 a -3<br/>Zona intermediária, exigindo atenção aos indicadores financeiros.</div></div>
            <div class="kanitz-legend-item"><span class="dot" style="background:#dc2626;"></span><div><strong>Insolvente</strong> — abaixo de -3<br/>Maior risco financeiro e necessidade de medidas corretivas.</div></div>
          </div>
        </div>
      </div>
      <div class="meta-bar">Data-base: ${this.esc(k.current?.periodLabel || '')}</div>
      <h4 class="subtitle">2.5.2 Comentários sobre o Kanitz atual</h4>
      <p class="narrative">${this.esc(k.comment)}</p>
      ${k.history?.length > 1 ? `<h4 class="subtitle">2.5.3 Evolução histórica</h4><table><thead><tr><th>Período</th><th>FI</th><th>Zona</th></tr></thead><tbody>${historyRows}</tbody></table><p class="narrative">${this.esc(k.historicalComment || '')}</p>` : ''}
      ${k.insight ? `<div class="finding-rule finding-rule-last" style="border-left-color:${FinancialReportHtmlService.SEMAFORO_AMBER};"><div class="finding-rule-head"><h5>Insight — Termômetro de Kanitz</h5></div><p class="narrative">${this.esc(k.insight)}</p></div>` : ''}
    </section>`;
  }

  /** Réplica estática (sem animação) da lógica de zona de src/components/financial/KanitzThermometer.jsx::getKanitzZone. */
  private kanitzZoneInfo(value: number | null) {
    const formatted = formatKanitzFi(value, true);
    if (value === null) {
      return { label: 'Sem cálculo', shortLabel: 'Indisponível', color: '#64748b', bgColor: '#f1f5f9', borderColor: '#cbd5e1', description: 'O fator de Kanitz ainda não foi calculado para este período.', recommendation: 'Verifique se os indicadores necessários estão disponíveis.', formatted };
    }
    if (value >= 0) {
      return { label: 'Solvente', shortLabel: 'Situação saudável', color: '#047857', bgColor: '#ecfdf5', borderColor: '#10b981', description: 'A empresa apresenta boa capacidade de pagamento e menor risco financeiro.', recommendation: 'Manter acompanhamento periódico dos indicadores financeiros.', formatted };
    }
    if (value >= -3) {
      return { label: 'Penumbra', shortLabel: 'Zona de atenção', color: '#d97706', bgColor: '#fffbeb', borderColor: '#f59e0b', description: 'Existem sinais de fragilidade financeira que exigem acompanhamento.', recommendation: 'Avaliar liquidez, endividamento, margem e geração de caixa.', formatted };
    }
    return { label: 'Insolvente', shortLabel: 'Risco de insolvência', color: '#dc2626', bgColor: '#fef2f2', borderColor: '#ef4444', description: 'A empresa apresenta maior risco financeiro e dificuldade potencial de honrar compromissos.', recommendation: 'Priorizar plano de ação financeiro, renegociação e recomposição de caixa.', formatted };
  }

  /**
   * Réplica estática (sem framer-motion — PDF não anima) do SVG de
   * src/components/financial/KanitzThermometer.jsx — mesma geometria,
   * gradientes e marcador, só sem as transições de entrada.
   */
  private renderKanitzThermometerSvg(rawValue: number | null): string {
    const MIN = -7, MAX = 7;
    const value = rawValue === null ? null : Math.min(Math.max(rawValue, MIN), MAX);
    const valueToY = (v: number) => {
      const topY = 42, bottomY = 338;
      return topY + ((MAX - v) / (MAX - MIN)) * (bottomY - topY);
    };
    const yPlus7 = valueToY(7);
    const yZero = valueToY(0);
    const yMinus3 = valueToY(-3);
    const yMinus7 = valueToY(-7);
    const markerY = value === null ? yZero : valueToY(value);
    const zoneInfo = this.kanitzZoneInfo(value);

    const ticks: string[] = [];
    for (let t = -6; t <= 6; t++) {
      if ([7, 0, -3, -7].includes(t)) continue;
      const y = valueToY(t);
      const x2 = t % 2 === 0 ? '112' : '106';
      ticks.push(`<line x1="96" y1="${y}" x2="${x2}" y2="${y}" stroke="#94a3b8" stroke-width="1.5" />`);
    }

    const liquid = value !== null
      ? `<rect x="152" width="94" y="${markerY}" height="${392 - markerY}" fill="rgba(255,255,255,0.42)" />
         <path d="M 152 ${markerY} Q 175 ${markerY - 3.5} 199 ${markerY} T 246 ${markerY} L 246 ${markerY + 6} Q 223 ${markerY + 2.5} 199 ${markerY + 6} T 152 ${markerY + 6} Z" fill="rgba(255,255,255,0.85)" stroke="#ffffff" stroke-width="1.5" />`
      : '';
    const marker = value !== null
      ? `<line x1="256" y1="${markerY}" x2="315" y2="${markerY}" stroke="${zoneInfo.color}" stroke-width="3" stroke-linecap="round" />
         <circle cx="323" cy="${markerY}" r="22" fill="${zoneInfo.bgColor}" stroke="${zoneInfo.color}" stroke-width="3" />
         <text x="323" y="${markerY + 6}" text-anchor="middle" font-size="14" font-weight="700" fill="${zoneInfo.color}">${this.esc(zoneInfo.formatted)}</text>`
      : '';

    return `<svg viewBox="0 0 360 420" style="height:360px;width:100%;max-width:260px;display:block;margin:0 auto;">
      <defs>
        <linearGradient id="kanitzGreen" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="#047857"/><stop offset="50%" stop-color="#22c55e"/><stop offset="100%" stop-color="#047857"/></linearGradient>
        <linearGradient id="kanitzYellow" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="#d97706"/><stop offset="50%" stop-color="#facc15"/><stop offset="100%" stop-color="#d97706"/></linearGradient>
        <linearGradient id="kanitzRed" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="#b91c1c"/><stop offset="50%" stop-color="#ef4444"/><stop offset="100%" stop-color="#b91c1c"/></linearGradient>
      </defs>
      <line x1="76" y1="${yPlus7}" x2="112" y2="${yPlus7}" stroke="#0f172a" stroke-width="2" />
      <line x1="76" y1="${yZero}" x2="112" y2="${yZero}" stroke="#0f172a" stroke-width="2" />
      <line x1="76" y1="${yMinus3}" x2="112" y2="${yMinus3}" stroke="#0f172a" stroke-width="2" />
      <line x1="76" y1="${yMinus7}" x2="112" y2="${yMinus7}" stroke="#0f172a" stroke-width="2" />
      ${ticks.join('')}
      <text x="42" y="${yPlus7 + 8}" text-anchor="middle" font-size="22" font-weight="700" fill="#047857">+7</text>
      <text x="42" y="${yZero + 8}" text-anchor="middle" font-size="22" font-weight="700" fill="#0f172a">0</text>
      <text x="42" y="${yMinus3 + 8}" text-anchor="middle" font-size="22" font-weight="700" fill="#d97706">-3</text>
      <text x="42" y="${yMinus7 + 8}" text-anchor="middle" font-size="22" font-weight="700" fill="#dc2626">-7</text>
      <path d="M 162 42 Q 162 20 184 20 L 214 20 Q 236 20 236 42 L 236 322 Q 260 342 260 372 Q 260 404 199 404 Q 138 404 138 372 Q 138 342 162 322 Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="5" />
      <clipPath id="tubeClip"><path d="M 176 46 Q 176 34 188 34 L 210 34 Q 222 34 222 46 L 222 330 Q 246 348 246 374 Q 246 392 199 392 Q 152 392 152 374 Q 152 348 176 330 Z" /></clipPath>
      <g clip-path="url(#tubeClip)">
        <rect x="152" y="${yPlus7}" width="94" height="${yZero - yPlus7}" fill="url(#kanitzGreen)" opacity="0.6" />
        <rect x="152" y="${yZero}" width="94" height="${yMinus3 - yZero}" fill="url(#kanitzYellow)" opacity="0.6" />
        <rect x="152" y="${yMinus3}" width="94" height="${yMinus7 - yMinus3 + 70}" fill="url(#kanitzRed)" opacity="0.6" />
        ${liquid}
      </g>
      <line x1="154" y1="${yZero}" x2="244" y2="${yZero}" stroke="#ffffff" stroke-width="4" />
      <line x1="154" y1="${yMinus3}" x2="244" y2="${yMinus3}" stroke="#ffffff" stroke-width="4" />
      <path d="M 184 48 Q 184 38 194 38" stroke="rgba(255,255,255,0.55)" stroke-width="8" stroke-linecap="round" fill="none" />
      <ellipse cx="181" cy="374" rx="10" ry="18" transform="rotate(35 181 374)" fill="rgba(255,255,255,0.4)" />
      ${marker}
    </svg>`;
  }

  private static readonly CLASSIFICATION_LABEL: Record<string, string> = {
    critico: 'Crítico', atencao: 'Atenção', oportunidade: 'Oportunidade', informativo: 'Informativo',
  };

  /**
   * Semáforo de risco: um ponto colorido, não um badge — vermelho/âmbar por
   * classificação (curadoria do consultor, prioridade sobre a severidade
   * técnica bruta do motor de detecção) com fallback pra severidade quando
   * o achado ainda não foi classificado; verde/cinza cobrem os casos sem
   * conotação de risco (oportunidade/informativo).
   */
  private static readonly SEMAFORO_RED = '#DC2626';
  // Amarelo puro por pedido explícito do usuário (ciente de que, como
  // traço/ponto pequeno sobre papel branco, tem baixo contraste — a bolinha
  // do resumo (.semaforo-summary .dot) ganhou contorno preto fino por isso).
  private static readonly SEMAFORO_AMBER = '#FFFF00';
  private static readonly SEMAFORO_GREEN = '#047857';

  /** Semáforo de 3 cores (mesma paleta do termômetro de Kanitz, ver .kanitz-legend) — nunca mais que vermelho/âmbar/verde. */
  private semaforoColor(f: { classification?: string | null; severity?: string | null }): string {
    switch (f.classification) {
      case 'critico': return FinancialReportHtmlService.SEMAFORO_RED;
      case 'atencao': return FinancialReportHtmlService.SEMAFORO_AMBER;
      case 'oportunidade':
      case 'informativo':
        return FinancialReportHtmlService.SEMAFORO_GREEN;
    }
    switch (f.severity) {
      case 'critical':
      case 'high':
        return FinancialReportHtmlService.SEMAFORO_RED;
      case 'medium': return FinancialReportHtmlService.SEMAFORO_AMBER;
      default: return FinancialReportHtmlService.SEMAFORO_GREEN;
    }
  }

  /**
   * Cartão de achado — traço vertical de risco (não ponto+caixa, não badge
   * de severidade), alinhado ao tom sóbrio/texto-corrido do resto do
   * relatório (ver comentário no CSS, .finding-rule). Tira de resumo
   * (contagem por cor) logo abaixo da legenda dá a leitura executiva antes
   * do detalhe achado a achado.
   */
  private renderInsightsSection(payload: any): string {
    const insights = payload?.insights ?? {};
    const groups: Array<[string, string, any[]]> = [
      ['3.1', 'Achados relacionados à data-base atual', insights.dataBaseAtual ?? []],
      ['3.2', 'Achados relacionados à evolução histórica', insights.evolucaoHistorica ?? []],
      ['3.3', 'Achados integrados para decisão', insights.integrados ?? []],
    ];

    // Resumo por cor — deduplicado por id, já que "Achados integrados" pode
    // repetir um achado já listado em 3.1/3.2 sob outra ótica de leitura.
    const byId = new Map<string, any>();
    for (const [, , items] of groups) for (const f of items) if (f?.id) byId.set(f.id, f);
    const counts = { red: 0, amber: 0, green: 0 };
    for (const f of byId.values()) {
      const color = this.semaforoColor(f);
      if (color === FinancialReportHtmlService.SEMAFORO_RED) counts.red++;
      else if (color === FinancialReportHtmlService.SEMAFORO_AMBER) counts.amber++;
      else counts.green++;
    }

    const renderGroup = (prefix: string, label: string, items: any[]) => {
      if (!items?.length) return `<h4 class="subtitle">${prefix} ${label}</h4><p class="empty-note">Nenhum achado aprovado nesta categoria.</p>`;
      const cards = items
        .map((f: any, idx: number) => {
          const tags = [
            f.period ? `período ${f.period}` : null,
            f.comparisonPeriod ? `vs ${f.comparisonPeriod}` : null,
            indicatorFullLabel(f.financialIndicator),
          ].filter(Boolean);
          const classificationLabel = f.classification ? (FinancialReportHtmlService.CLASSIFICATION_LABEL[f.classification] ?? f.classification) : '';
          const isLast = idx === items.length - 1;
          return `<div class="finding-rule${isLast ? ' finding-rule-last' : ''}" style="border-left-color:${this.semaforoColor(f)};">
            <div class="finding-rule-head">
              <h5>${prefix}.${idx + 1} ${this.esc(f.title)}</h5>
              ${classificationLabel ? `<span class="tag-classification">${this.esc(classificationLabel)}</span>` : ''}
            </div>
            <p class="narrative">${this.esc(f.reportInclusionEditedText || f.description || '')}</p>
            ${tags.length ? `<div class="finding-card-tags">${tags.map((t) => `<span>${this.esc(t)}</span>`).join('')}</div>` : ''}
          </div>`;
        })
        .join('');
      return `<h4 class="subtitle">${prefix} ${label}</h4>${cards}`;
    };
    return `<section class="page">      <h2 class="section-title">3. Insights e achados relevantes</h2>
      <div class="semaforo-summary">
        <span><span class="dot" style="background:${FinancialReportHtmlService.SEMAFORO_RED};"></span>${counts.red} crítico${counts.red === 1 ? '' : 's'}</span>
        <span><span class="dot" style="background:${FinancialReportHtmlService.SEMAFORO_AMBER};"></span>${counts.amber} atenção</span>
        <span><span class="dot" style="background:${FinancialReportHtmlService.SEMAFORO_GREEN};"></span>${counts.green} oportunidade${counts.green === 1 ? '' : 's'}</span>
      </div>
      ${groups.map(([prefix, label, items]) => renderGroup(prefix, label, items)).join('')}
    </section>`;
  }

  private static readonly PRIORITY_LABEL: Record<string, string> = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' };

  /**
   * Recomendações avulsas — recomendações aprovadas na aba Ações & Achados
   * (FinancialRecommendation.reportInclusionStatus), formatadas em
   * Tese/Ação/Impacto para dar conteúdo objetivo à análise da administração
   * e ao FP&A do cliente. Independente da seção 3 (achados) — uma
   * recomendação pode estar aqui sem que o achado que a originou apareça
   * na seção 3, e vice-versa (ver comentário no schema Prisma).
   */
  private renderRecommendationsSection(payload: any): string {
    const recommendations: any[] = payload?.recommendations ?? [];
    if (!recommendations.length) return '';
    const cards = recommendations
      .map((r: any, idx: number) => {
        const isLast = idx === recommendations.length - 1;
        const priorityLabel = r.priority ? (FinancialReportHtmlService.PRIORITY_LABEL[r.priority] ?? r.priority) : '';
        return `<div class="finding-rule${isLast ? ' finding-rule-last' : ''}" style="border-left-color:#475569;">
          <div class="finding-rule-head">
            <h5>4.${idx + 1} ${this.esc(r.title)}</h5>
            ${priorityLabel ? `<span class="tag-classification">${this.esc(priorityLabel)}</span>` : ''}
          </div>
          ${r.diagnosticThesis ? `<p class="narrative"><strong>Tese:</strong> ${this.esc(r.diagnosticThesis)}</p>` : ''}
          ${r.suggestedAction ? `<p class="narrative"><strong>Ação:</strong> ${this.esc(r.suggestedAction)}</p>` : ''}
          ${r.expectedImpact ? `<p class="narrative"><strong>Impacto:</strong> ${this.esc(r.expectedImpact)}</p>` : ''}
        </div>`;
      })
      .join('');
    return `<section class="page">      <h2 class="section-title">4. Recomendações avulsas</h2>
      <p class="narrative">As recomendações a seguir consolidam pontos de atenção identificados nesta análise em formato objetivo — tese, ação recomendada e impacto esperado — servindo de insumo para a análise da administração e para o planejamento financeiro (FP&A) da empresa.</p>
      ${cards}
    </section>`;
  }

  /**
   * Célula de valor da tabela — mesma formatação de ValueCell nas telas
   * reais (BalanceSheetView/IncomeStatementView/CashFlowStatementView.jsx):
   * inteiro agrupado por milhar, sem símbolo de moeda, negativos entre
   * parênteses, zero/nulo como "-". A notação "R$ X milhões" só é usada na
   * narrativa (comentários), nunca dentro da própria tabela.
   */
  private fmtMoney(v: number | null | undefined): string {
    if (v === null || v === undefined || v === 0) return '-';
    const digits = new Intl.NumberFormat('pt-BR', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(v));
    return v < 0 ? `(${digits})` : digits;
  }

  private esc(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  }
}
