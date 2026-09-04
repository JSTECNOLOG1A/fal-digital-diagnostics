import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { StorageService } from '../storage/storage.service';
import { FinancialReportHtmlService } from './financial-report-html.service';

/**
 * Exportação em PDF do Relatório da Análise — Puppeteer (Chromium do
 * sistema) renderiza em memória o mesmo HTML que a prévia em tela usa
 * (FinancialReportHtmlService.render), via page.setContent(), sem depender
 * do frontend/rede: o template HTML/CSS é a única fonte de verdade tanto
 * para a prévia (endpoint autenticado normal, ver getRenderHtml) quanto
 * para o PDF — zero divergência entre os dois por construção.
 */
@Injectable()
export class FinancialReportPdfService {
  private readonly logger = new Logger(FinancialReportPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly html: FinancialReportHtmlService,
  ) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  private async loadVersion(actor: AuthUser, versionId: string) {
    const version = await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialReportVersion.findFirst({ where: { id: versionId }, include: { financialDiagnosis: { select: { title: true } } } }),
    );
    if (!version) throw new NotFoundException('FinancialReportVersion not found');
    if (!isHQ(actor.role) && actor.tenantId !== version.tenantId) throw new ForbiddenException('Tenant scope violation');
    return version;
  }

  /** HTML renderizado da versão — usado pela prévia em tela (iframe autenticado normal). */
  async getRenderHtml(actor: AuthUser, versionId: string): Promise<string> {
    const version = await this.loadVersion(actor, versionId);
    if (!version.payloadSnapshot) throw new BadRequestException('Gere o relatório antes de visualizar.');
    return this.html.render(version.payloadSnapshot, { watermarkDraft: version.watermarkDraft, versionNumber: version.versionNumber });
  }

  async exportPdf(actor: AuthUser, versionId: string) {
    const version = await this.loadVersion(actor, versionId);
    if (!version.payloadSnapshot) throw new BadRequestException('Gere o relatório antes de exportar em PDF.');

    await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.financialReportVersion.update({ where: { id: versionId }, data: { pdfStatus: 'generating', pdfError: null } }),
    );

    try {
      const htmlContent = this.html.render(version.payloadSnapshot, { watermarkDraft: version.watermarkDraft, versionNumber: version.versionNumber });
      const buffer = await this.renderWithPuppeteer(htmlContent);
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
      const filename = this.buildFilename(version.financialDiagnosis.title, version.baseDatePeriod ?? undefined, version.versionNumber);
      const objectKey = `financial-reports/${version.financialDiagnosisId}/${versionId}.pdf`;
      await this.storage.putFile(objectKey, buffer, 'application/pdf');

      return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
        tx.financialReportVersion.update({
          where: { id: versionId },
          data: {
            pdfStatus: 'ready',
            pdfFileUrl: filename,
            pdfStorageKey: objectKey,
            pdfChecksum: checksum,
            pdfFileSize: buffer.length,
            pdfGeneratedAt: new Date(),
            pdfError: null,
          },
        }),
      );
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Falha ao gerar PDF da versão ${versionId}: ${message}`);
      await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
        tx.financialReportVersion.update({ where: { id: versionId }, data: { pdfStatus: 'error', pdfError: message } }),
      );
      throw new InternalServerErrorException(`Falha ao gerar PDF: ${message}`);
    }
  }

  async downloadPdf(actor: AuthUser, versionId: string): Promise<{ buffer: Buffer; filename: string }> {
    const version = await this.loadVersion(actor, versionId);
    if (!version.pdfStorageKey) throw new BadRequestException('PDF ainda não gerado para esta versão.');
    const buffer = await this.storage.getFile(version.pdfStorageKey);
    return { buffer, filename: version.pdfFileUrl || `relatorio-${versionId}.pdf` };
  }

  /** "Relatorio_Analise_Financeira_..." usa o título do diagnóstico (ex.: "Análise Financeira — Fazenda Demo Ltda — 12/2024") + data-base — nome estável e legível pro cliente, em vez do UUID da versão que caía no download antes por falta de Content-Disposition exposto no CORS (ver enableCors em main.ts). */
  private buildFilename(diagnosisTitle: string | undefined, baseDatePeriod: string | undefined, versionNumber: number): string {
    const titleSlug = (diagnosisTitle || 'Relatorio')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove acentos (á→a, ç→c, ...) sem perder as letras
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
    const dateSlug = (baseDatePeriod || '').replace(/[^0-9-]/g, '');
    return `Relatorio_${titleSlug}${dateSlug ? '_' + dateSlug : ''}_v${versionNumber}.0.pdf`;
  }

  private async renderWithPuppeteer(html: string): Promise<Buffer> {
    const puppeteer = await import('puppeteer-core');
    const { PDFDocument } = await import('pdf-lib');
    const executablePath = this.config.get<string>('CHROMIUM_PATH', '/usr/bin/chromium');
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });

      const footerTemplate = `
          <div style="width:100%;font-size:7.5pt;color:#64748b;padding:0 16mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif;">
            <span>FAL Agro | Relatório de Análise Econômico-Financeira | Confidencial</span>
            <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
          </div>`;
      const basePdfOptions = {
        printBackground: true,
        // Tamanho e margem vêm do CSS (@page / @page bp-landscape em
        // FinancialReportHtmlService.css()), não daqui — um "margin"/"format"
        // fixo aqui ignoraria silenciosamente qualquer ajuste feito no CSS
        // (bug real: a margem do topo foi reduzida no CSS numa revisão e o
        // PDF exportado continuou com a margem antiga porque este objeto a
        // sobrescrevia) e não tem como representar a margem diferente da
        // página paisagem do BP (só um valor global por PDF).
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        footerTemplate,
      };

      // Logo pequena no canto superior direito, repetida em TODA página
      // física exceto a capa — via headerTemplate do Puppeteer (o mesmo
      // mecanismo que já faz "Página X de Y" repetir certinho no rodapé
      // acima). Versão anterior desenhava a logo dentro do próprio HTML
      // (position:absolute na 1ª página de cada seção) — funcionava só na
      // 1ª página FÍSICA de cada seção, sumindo quando uma seção longa
      // transbordava pra uma 2ª/3ª página impressa, e com altura variável
      // entre seções (dois bugs reais reportados). headerTemplate resolve
      // os dois porque o Chromium desenha o mesmo template, na mesma
      // posição relativa à margem, em toda página física.
      //
      // "Esconder só na capa" via <script> dentro do headerTemplate lendo
      // ".pageNumber" (tanto a versão síncrona quanto com MutationObserver/
      // polling) NÃO funcionou de forma confiável — Chromium não garante
      // execução de <script> nesse contexto isolado de impressão (bugs reais
      // testados nas duas direções: logo ficava ou sempre visível, incluindo
      // na capa, ou sempre oculta em toda página). Solução robusta que não
      // depende disso: renderizar o PDF duas vezes (sem logo / com logo) e
      // montar o arquivo final pegando a página 1 (capa) da versão sem logo
      // e as páginas 2+ da versão com logo — via pdf-lib. Os números de
      // página do rodapé continuam corretos nas duas metades porque as duas
      // renderizações são do MESMO documento completo (mesmo total de
      // páginas), só descartamos a página 1 de uma e as demais da outra.
      const logoDataUri = this.html.logoDataUri();
      const headerTemplateNoLogo = '<div></div>';
      const headerTemplateWithLogo = logoDataUri
        ? `<div style="width:100%;position:relative;height:100%;"><img src="${logoDataUri}" style="position:absolute;top:7mm;right:16mm;width:30mm;height:auto;opacity:0.65;" /></div>`
        : '<div></div>';

      const noLogoBuffer = await page.pdf({ ...basePdfOptions, headerTemplate: headerTemplateNoLogo });
      if (!logoDataUri) return Buffer.from(noLogoBuffer);
      const withLogoBuffer = await page.pdf({ ...basePdfOptions, headerTemplate: headerTemplateWithLogo });

      const noLogoDoc = await PDFDocument.load(noLogoBuffer);
      const withLogoDoc = await PDFDocument.load(withLogoBuffer);
      const finalDoc = await PDFDocument.create();
      const [coverPage] = await finalDoc.copyPages(noLogoDoc, [0]);
      finalDoc.addPage(coverPage);
      const restIndices = Array.from({ length: withLogoDoc.getPageCount() - 1 }, (_, i) => i + 1);
      if (restIndices.length > 0) {
        const restPages = await finalDoc.copyPages(withLogoDoc, restIndices);
        restPages.forEach((p) => finalDoc.addPage(p));
      }
      const finalBytes = await finalDoc.save();
      return Buffer.from(finalBytes);
    } finally {
      await browser.close();
    }
  }
}
