'use strict';
/**
 * pdf.utils.js — Professional PDF report generator
 */

const PDFDocument = require('pdfkit');

/* ── Brand colors ── */
const C = {
  primary  : '#1a1a2e',
  accent   : '#0f3460',
  highlight: '#e94560',
  success  : '#16a34a',
  warning  : '#d97706',
  danger   : '#dc2626',
  muted    : '#6b7280',
  white    : '#ffffff',
  lightGray: '#f3f4f6',
};

function scoreColor(score) {
  if (score >= 75) return C.success;
  if (score >= 50) return C.warning;
  return C.danger;
}

function severityColor(sev) {
  if (sev === 'high')   return C.danger;
  if (sev === 'medium') return C.warning;
  return C.muted;
}

/**
 * Generate a PDF buffer from a TechnicalInsight document.
 * @param {object} report - Mongoose doc or plain object
 * @returns {Promise<Buffer>}
 */
function generatePDF(report) {
  return new Promise((resolve, reject) => {
    try {
      const doc    = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const chunks = [];
      doc.on('data',  c  => chunks.push(c));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      /* ── Cover Page ── */
      doc.rect(0, 0, doc.page.width, 200).fill(C.primary);
      doc.fillColor(C.white).fontSize(28).font('Helvetica-Bold').text('WebAuditX', 50, 60);
      doc.fontSize(16).font('Helvetica').text('Technical Intelligence Report', 50, 95);
      doc.fontSize(11).text(`URL: ${report.url}`, 50, 125);
      doc.text(`Generated: ${new Date(report.createdAt || Date.now()).toLocaleString()}`, 50, 142);

      /* Overall Score Badge */
      const score  = report.scores?.overall || 0;
      const sColor = scoreColor(score);
      doc.roundedRect(doc.page.width - 130, 55, 80, 80, 8).fill(sColor);
      doc.fillColor(C.white).fontSize(32).font('Helvetica-Bold').text(String(score), doc.page.width - 110, 77, { width: 40, align: 'center' });
      doc.fontSize(9).text('/100', doc.page.width - 100, 113, { width: 40, align: 'center' });

      doc.fillColor(C.primary).moveDown(8);

      /* ── Score Summary ── */
      sectionHeader(doc, 'Score Summary');
      const scoreKeys = ['security', 'domain', 'content', 'technical', 'backlinks'];
      scoreKeys.forEach((k, i) => {
        const val   = report.scores?.[k] || 0;
        const col   = scoreColor(val);
        const x     = 50 + (i % 3) * 170;
        const y     = doc.y + (i >= 3 ? 60 : 0);
        if (i === 3) doc.moveDown(3.5);
        doc.roundedRect(x, doc.y, 150, 50, 6).fill(C.lightGray);
        doc.fillColor(col).fontSize(20).font('Helvetica-Bold').text(String(val), x + 8, doc.y + 8, { width: 50 });
        doc.fillColor(C.muted).fontSize(9).font('Helvetica').text(k.charAt(0).toUpperCase() + k.slice(1), x + 8, doc.y + 30);
        if (i % 3 !== 2) doc.x = x + 160;
      });
      doc.moveDown(5);

      /* ── AI Report ── */
      if (report.aiReport?.summary) {
        sectionHeader(doc, 'AI Analysis Summary');
        doc.fillColor(C.primary).fontSize(11).font('Helvetica').text(report.aiReport.summary, { paragraphGap: 6 });
        doc.moveDown();

        if (report.aiReport.businessImpact) {
          doc.fillColor(C.accent).fontSize(10).font('Helvetica-Bold').text('Business Impact:');
          doc.fillColor(C.primary).font('Helvetica').text(report.aiReport.businessImpact, { paragraphGap: 4 });
          doc.moveDown();
        }

        if (report.aiReport.workingWell?.length) {
          doc.fillColor(C.success).font('Helvetica-Bold').fontSize(10).text('✓ What\'s Working Well');
          report.aiReport.workingWell.forEach(w => {
            doc.fillColor(C.primary).font('Helvetica').fontSize(10).text(`  • ${w}`, { paragraphGap: 2 });
          });
          doc.moveDown();
        }
      }

      /* ── Priority Issues Table ── */
      if (report.issues?.length) {
        sectionHeader(doc, 'Priority Issues');
        const colWidths = [200, 60, 90, 140];
        const headers   = ['Issue', 'Severity', 'Category', 'Fix'];
        tableHeader(doc, headers, colWidths);

        report.issues.slice(0, 20).forEach((issue, i) => {
          const rowY    = doc.y;
          if (rowY > doc.page.height - 100) doc.addPage();
          if (i % 2 === 0) doc.rect(50, doc.y, 490, 22).fill(C.lightGray);
          const cells = [issue.title, issue.severity?.toUpperCase(), issue.category, issue.fix || '-'];
          let cx = 50;
          cells.forEach((cell, j) => {
            doc.fillColor(j === 1 ? severityColor(issue.severity) : C.primary)
               .fontSize(8.5).font(j === 1 ? 'Helvetica-Bold' : 'Helvetica')
               .text(cell || '-', cx + 4, doc.y + 5, { width: colWidths[j] - 8, ellipsis: true });
            cx += colWidths[j];
          });
          doc.moveDown(1.2);
        });
        doc.moveDown();
      }

      /* ── Technical Details ── */
      sectionHeader(doc, 'Technical Details');
      const techSections = [
        { label: 'Domain Authority', value: report.domain?.da != null ? `${report.domain.da}/100 (source: ${report.domain.source})` : 'N/A' },
        { label: 'HTTPS',            value: report.protocol?.https ? '✓ Enabled' : '✗ Not enabled' },
        { label: 'HTTP/2',           value: report.protocol?.http2 ? '✓ Supported' : '✗ Not detected' },
        { label: 'CDN',              value: report.cdn?.detected ? `✓ ${report.cdn.provider}` : '✗ No CDN detected' },
        { label: 'SSL Expiry',       value: report.protocol?.sslExpiry ? `${report.protocol.sslExpiry} (${report.protocol.daysToExpiry} days)` : 'N/A' },
        { label: 'CMS',              value: report.technology?.cms || 'Not detected' },
        { label: 'Web Server',       value: report.technology?.server || 'Not detected' },
        { label: 'SPF Record',       value: report.dns?.spf ? '✓ Present' : '✗ Missing' },
        { label: 'DMARC Record',     value: report.dns?.dmarc ? '✓ Present' : '✗ Missing' },
        { label: 'Malware',          value: report.malware?.safe ? '✓ Clean' : `⚠ Flagged: ${report.malware?.flags?.join(', ')}` },
      ];
      techSections.forEach(({ label, value }) => {
        doc.fillColor(C.muted).fontSize(9).font('Helvetica-Bold').text(label + ':', { continued: true, width: 150 })
           .fillColor(C.primary).font('Helvetica').text('  ' + value, { paragraphGap: 4 });
      });

      /* ── SEO & Content ── */
      if (report.seoContent?.title) {
        sectionHeader(doc, 'SEO & Content');
        const seoRows = [
          ['Title', report.seoContent.title?.substring(0, 60) || 'Missing'],
          ['Meta Description', report.seoContent.metaDescription ? `Present (${report.seoContent.metaDescriptionLength} chars)` : 'Missing'],
          ['H1 Tags', String(report.seoContent.h1?.length || 0)],
          ['Total Images', String(report.seoContent.totalImages || 0)],
          ['Images w/o Alt', String(report.seoContent.imgWithoutAlt || 0)],
          ['Schema Markup', report.schema?.found ? `Present: ${report.schema.types?.join(', ')}` : 'Missing'],
          ['Word Count', String(report.content?.wordCount || 0)],
          ['Readability', report.content?.readabilityGrade || 'N/A'],
        ];
        seoRows.forEach(([label, value]) => {
          doc.fillColor(C.muted).fontSize(9).font('Helvetica-Bold').text(label + ':', { continued: true, width: 150 })
             .fillColor(C.primary).font('Helvetica').text('  ' + value, { paragraphGap: 4 });
        });
      }

      /* ── Recommendations ── */
      if (report.aiReport?.recommendations?.length) {
        sectionHeader(doc, 'AI Recommendations');
        report.aiReport.recommendations.forEach((rec, i) => {
          const pColor = severityColor(rec.priority);
          doc.roundedRect(50, doc.y, 490, 40, 4).stroke(C.lightGray);
          doc.fillColor(pColor).fontSize(8).font('Helvetica-Bold').text(`[${(rec.priority || 'low').toUpperCase()}]`, 58, doc.y + 6);
          doc.fillColor(C.primary).font('Helvetica-Bold').fontSize(10).text(rec.title, 105, doc.y + 5);
          doc.fillColor(C.muted).font('Helvetica').fontSize(8.5).text(rec.action || '', 58, doc.y + 22, { width: 474 });
          doc.moveDown(2.8);
        });
      }

      /* ── Footer on every page ── */
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill(C.primary);
        doc.fillColor(C.white).fontSize(8)
           .text(`WebAuditX — Technical Intelligence Report | ${report.url}`, 50, doc.page.height - 25)
           .text(`Page ${i + 1} of ${totalPages}`, doc.page.width - 100, doc.page.height - 25, { align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function sectionHeader(doc, title) {
  if (doc.y > doc.page.height - 120) doc.addPage();
  doc.moveDown(0.5);
  doc.rect(50, doc.y, 490, 24).fill(C.accent);
  doc.fillColor(C.white).fontSize(12).font('Helvetica-Bold').text(title, 58, doc.y + 6);
  doc.moveDown(1.8);
}

function tableHeader(doc, headers, colWidths) {
  doc.rect(50, doc.y, 490, 20).fill(C.primary);
  let x = 50;
  headers.forEach((h, i) => {
    doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold').text(h, x + 4, doc.y + 5, { width: colWidths[i] - 8 });
    x += colWidths[i];
  });
  doc.moveDown(1.4);
}

module.exports = { generatePDF };