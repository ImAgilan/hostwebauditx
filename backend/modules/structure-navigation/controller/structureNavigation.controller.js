'use strict';
const PDFDocument = require('pdfkit');
const svc = require('../service/structureNavigation.service');

/* POST /api/structure-navigation/analyze */
async function analyzeController(req, res, next) {
  try {
    const { url } = req.body;
    if (!url || url.trim() === '') {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }
    const record = await svc.analyze(url.trim());
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

/* GET /api/structure-navigation/report/:id */
async function getReportController(req, res, next) {
  try {
    const record = await svc.getReport(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

/* GET /api/structure-navigation/download/:id */
async function downloadReportController(req, res, next) {
  try {
    const record = await svc.getReport(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Report not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="structure-navigation-report-${record._id}.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    const COLOR = { primary: '#1a1a2e', accent: '#e94560', muted: '#666', bg: '#f8f9fa' };

    // Header
    doc.rect(0, 0, doc.page.width, 80).fill(COLOR.primary);
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
      .text('WebAuditX — Structure & Navigation Report', 50, 25);
    doc.fontSize(11).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString()}`, 50, 52);
    doc.moveDown(3);

    // URL + Score
    doc.fillColor(COLOR.primary).fontSize(14).font('Helvetica-Bold').text('Audit Target');
    doc.fontSize(12).font('Helvetica').fillColor(COLOR.muted).text(record.url);
    doc.moveDown(0.5);

    const scoreColor = record.scores.overallScore >= 75 ? '#2ecc71' : record.scores.overallScore >= 50 ? '#f39c12' : COLOR.accent;
    doc.fontSize(28).font('Helvetica-Bold').fillColor(scoreColor)
      .text(`Overall Score: ${record.scores.overallScore}/100`, { align: 'center' });
    doc.moveDown(1);

    // Score breakdown
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLOR.primary).text('Score Breakdown');
    doc.moveDown(0.3);
    const scoreItems = [
      ['Security',    record.scores.securityScore],
      ['Navigation',  record.scores.navigationScore],
      ['Content',     record.scores.contentScore],
      ['Internal Linking', record.scores.linkingScore],
      ['URL Structure',    record.scores.urlScore],
      ['Crawlability',     record.scores.crawlScore],
      ['Breadcrumbs',      record.scores.breadcrumbScore],
    ];
    scoreItems.forEach(([label, val]) => {
      doc.fontSize(11).font('Helvetica').fillColor(COLOR.muted).text(`${label}: `, { continued: true });
      const col = val >= 75 ? '#2ecc71' : val >= 50 ? '#f39c12' : COLOR.accent;
      doc.fillColor(col).text(`${val}/100`);
    });
    doc.moveDown(1);

    // Crawl Summary
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLOR.primary).text('Crawl Summary');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').fillColor(COLOR.muted);
    doc.text(`Pages Crawled: ${record.crawl.totalPagesCrawled}`);
    doc.text(`Max Depth: ${record.crawl.maxDepthFound}`);
    doc.text(`Sitemap Found: ${record.crawl.sitemapFound ? 'Yes' : 'No'}`);
    doc.text(`Robots.txt Found: ${record.crawl.robotsTxtFound ? 'Yes' : 'No'}`);
    doc.moveDown(1);

    // Security
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLOR.primary).text('Security Analysis');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').fillColor(COLOR.muted);
    doc.text(`HTTPS: ${record.security.httpsEnabled ? '✓ Enabled' : '✗ Not Enabled'}`);
    doc.text(`HSTS Header: ${record.security.hstsHeader ? '✓ Present' : '✗ Missing'}`);
    doc.text(`CSP Header: ${record.security.cspHeader ? '✓ Present' : '✗ Missing'}`);
    doc.text(`X-Frame-Options: ${record.security.xFrameOptions || '✗ Missing'}`);
    doc.text(`X-Content-Type-Options: ${record.security.xContentTypeOptions ? '✓ Present' : '✗ Missing'}`);
    doc.text(`Mixed Content: ${record.security.mixedContent ? '⚠ Detected' : '✓ None'}`);
    doc.moveDown(1);

    // Content
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLOR.primary).text('Content Analysis');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').fillColor(COLOR.muted);
    doc.text(`Pages with Thin Content: ${record.content.pagesWithThinContent}`);
    doc.text(`Pages without H1: ${record.content.pagesWithoutH1}`);
    doc.text(`Pages without Meta Description: ${record.content.pagesWithoutMetaDesc}`);
    doc.text(`Duplicate Titles: ${record.content.pagesWithDuplicateTitle}`);
    doc.moveDown(1);

    // Issues
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').fillColor(COLOR.primary).text('Issues Found');
    doc.moveDown(0.5);

    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    severityOrder.forEach(sev => {
      const sevIssues = record.issues.filter(i => i.severity === sev);
      if (!sevIssues.length) return;
      const sevColor = sev === 'critical' ? COLOR.accent : sev === 'high' ? '#e67e22' : sev === 'medium' ? '#f39c12' : '#3498db';
      doc.fontSize(12).font('Helvetica-Bold').fillColor(sevColor).text(sev.toUpperCase());
      sevIssues.forEach(issue => {
        doc.fontSize(10).font('Helvetica-Bold').fillColor(COLOR.primary).text(`• ${issue.title}`);
        doc.fontSize(9).font('Helvetica').fillColor(COLOR.muted).text(`  Impact: ${issue.impact}`);
        doc.fontSize(9).font('Helvetica').fillColor('#2ecc71').text(`  Fix: ${issue.fix}`);
        doc.moveDown(0.2);
      });
      doc.moveDown(0.5);
    });

    // AI Insights
    if (record.aiReport && record.aiReport.summary) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').fillColor(COLOR.primary).text('AI Insights');
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLOR.primary).text('Summary');
      doc.fontSize(10).font('Helvetica').fillColor(COLOR.muted).text(record.aiReport.summary);
      doc.moveDown(0.5);

      if (record.aiReport.whatWorksWell?.length) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#2ecc71').text('What Works Well');
        record.aiReport.whatWorksWell.forEach(w => doc.fontSize(10).font('Helvetica').fillColor(COLOR.muted).text(`✓ ${w}`));
        doc.moveDown(0.5);
      }

      if (record.aiReport.criticalFixes?.length) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor(COLOR.accent).text('Critical Fixes');
        record.aiReport.criticalFixes.forEach(f => doc.fontSize(10).font('Helvetica').fillColor(COLOR.muted).text(`✗ ${f}`));
        doc.moveDown(0.5);
      }

      if (record.aiReport.recommendations?.length) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor(COLOR.primary).text('Recommendations');
        record.aiReport.recommendations.forEach(r => doc.fontSize(10).font('Helvetica').fillColor(COLOR.muted).text(`→ ${r}`));
      }
    }

    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { analyzeController, getReportController, downloadReportController };