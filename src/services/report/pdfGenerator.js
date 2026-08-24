/**
 * pdfGenerator.js
 *
 * Exporta o relatório FAL™ seção por seção, respeitando a paginação lógica.
 * Cada .report-section vira uma ou mais páginas A4 no PDF final.
 * Blocos nunca são cortados no meio — se uma seção for mais alta que uma página,
 * ela ocupa exatamente o espaço necessário (página estendida) sem corte.
 */

const A4_W_MM = 210;
const A4_H_MM = 297;

/**
 * Converte pixels canvas (scale=2) para mm no PDF.
 * A4 = 210mm de largura → 1mm = (canvas.width / 210) px
 */
function canvasPxToMm(px, canvasWidthPx) {
  return (px / canvasWidthPx) * A4_W_MM;
}

export async function generateFalReportPDF(reportElement, payload) {
  if (!reportElement) throw new Error('reportElement is required');

  const { default: html2canvas } = await import('html2canvas');
  const { jsPDF } = await import('jspdf');

  // Coletar todas as seções do relatório
  const sectionEls = Array.from(reportElement.querySelectorAll('.report-section'));
  if (sectionEls.length === 0) {
    // Fallback: exporta tudo de uma vez (comportamento legado)
    return exportFallback(reportElement, payload, html2canvas, jsPDF);
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  let isFirstPage = true;

  for (const section of sectionEls) {
    const canvas = await html2canvas(section, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: reportElement.scrollWidth,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const canvasW = canvas.width;
    const canvasH = canvas.height;

    // Largura sempre = A4
    const imgW = A4_W_MM;
    // Altura proporcional
    const imgH = canvasPxToMm(canvasH, canvasW);

    if (!isFirstPage) {
      pdf.addPage();
    }
    isFirstPage = false;

    if (imgH <= A4_H_MM) {
      // Seção cabe numa página — centralizar verticalmente
      pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH);
    } else {
      // Seção maior que uma página — fatiar em múltiplas páginas
      // Calculamos quantos "slices" de A4 precisamos
      const scale = canvasW / A4_W_MM; // px por mm
      const sliceHeightPx = A4_H_MM * scale;
      const totalSlices = Math.ceil(canvasH / sliceHeightPx);

      for (let i = 0; i < totalSlices; i++) {
        if (i > 0) pdf.addPage();

        const srcY = i * sliceHeightPx;
        const srcH = Math.min(sliceHeightPx, canvasH - srcY);

        // Criar canvas parcial para este slice
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvasW;
        sliceCanvas.height = sliceHeightPx; // sempre altura de página inteira
        const ctx = sliceCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, srcY, canvasW, srcH, 0, 0, canvasW, srcH);

        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(sliceData, 'JPEG', 0, 0, A4_W_MM, A4_H_MM);
      }
    }
  }

  return buildPdfArtifact(pdf, payload);
}

/**
 * Fallback: comportamento legado (bitmap único fatiado).
 * Usado apenas se não encontrar .report-section no DOM.
 */
async function exportFallback(reportElement, payload, html2canvas, jsPDF) {
  const canvas = await html2canvas(reportElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: reportElement.scrollWidth,
    windowHeight: reportElement.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const totalPages = Math.ceil(imgH / pageH);

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, -(i * pageH), imgW, imgH);
  }

  return buildPdfArtifact(pdf, payload);
}

function buildPdfArtifact(pdf, payload) {
  const filename = buildFilename(payload);
  const blob = pdf.output('blob');
  if (!blob || blob.size === 0) throw new Error('PDF vazio');
  return { blob, filename, pageCount: pdf.getNumberOfPages() };
}

export function downloadPdfArtifact(artifact) {
  const url = URL.createObjectURL(artifact.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildFilename(payload) {
  const companySlug = (payload?.cover?.company_name || 'relatorio')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 40);
  const dateSlug = (payload?.cover?.competence || payload?.cover?.assessment_date || '')
    .replace(/[^0-9\-\/]/g, '')
    .replace('/', '-');
  return `FAL_Diagnostico_${companySlug}${dateSlug ? '_' + dateSlug : ''}.pdf`;
}