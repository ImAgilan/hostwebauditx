'use strict';
const { analyzeContentQualityService } = require('../service/contentQuality.service');
const ContentQuality = require('../model/contentQuality.model');
const PDFDocument    = require('pdfkit');

/* ── POST /api/content-quality/analyze ── */
async function analyze(req, res, next) {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'url is required' });

    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;

    const result = await analyzeContentQualityService(normalized);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/content-quality/report/:id ── */
async function getReport(req, res, next) {
  try {
    const report = await ContentQuality.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/content-quality/history?url=... ── */
async function getHistory(req, res, next) {
  try {
    const filter = req.query.url ? { url: new RegExp(req.query.url, 'i') } : {};
    const reports = await ContentQuality.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .select('url overallScore status createdAt')
      .lean();
    res.json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/content-quality/download/:id ── */
async function downloadPDF(req, res, next) {
  try {
    const report = await ContentQuality.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="content-quality-${report._id}.pdf"`);
    doc.pipe(res);

    // ── Colors ──
    const DARK   = '#1a1a2e';
    const ACCENT = '#e94560';
    const LIGHT  = '#f4f4f4';
    const GRAY   = '#6b7280';
    const GREEN  = '#10b981';
    const YELLOW = '#f59e0b';
    const RED    = '#ef4444';

    const scoreColor = s => s >= 70 ? GREEN : s >= 40 ? YELLOW : RED;

    // ── Header ──
    doc.rect(0, 0, doc.page.width, 100).fill(DARK);
    doc.fillColor('#fff').fontSize(24).font('Helvetica-Bold').text('WebAuditX', 50, 28);
    doc.fontSize(11).font('Helvetica').fillColor('#aaa').text('Content Quality & Trust Signals Report', 50, 58);
    doc.fillColor('#fff').fontSize(10).text(new Date().toLocaleDateString('en-US', { year:'numeric',month:'long',day:'numeric' }), 400, 45, { align: 'right' });

    doc.moveDown(4);

    // ── URL & Score ──
    doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold').text('Audited URL:', 50);
    doc.fontSize(11).font('Helvetica').fillColor(ACCENT).text(report.url, 50);
    doc.moveDown(0.5);

    doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold').text('Overall Score:', 50);
    doc.fillColor(scoreColor(report.overallScore)).fontSize(32).font('Helvetica-Bold')
      .text(`${report.overallScore}/100`, 50);
    doc.moveDown(1);

    // ── Category Scores ──
    doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text('Category Scores', 50);
    doc.moveDown(0.3);
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    if (report.scores) {
      Object.entries(report.scores).forEach(([cat, val]) => {
        const label = cat.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        doc.fillColor(GRAY).fontSize(10).font('Helvetica').text(label, 50, doc.y, { continued: true, width: 250 });
        doc.fillColor(scoreColor(val)).font('Helvetica-Bold').text(`${val}/100`, { align: 'right' });
        doc.moveDown(0.2);
      });
    }
    doc.moveDown(1);

    // ── Issues ──
    if (report.issues?.length > 0) {
      doc.addPage();
      doc.fillColor(DARK).fontSize(16).font('Helvetica-Bold').text('Issues Found', 50, 50);
      doc.moveDown(0.4);

      const impactColor = { critical: RED, high: '#f97316', medium: YELLOW, low: GREEN, info: '#60a5fa' };
      report.issues.forEach((issue, i) => {
        if (doc.y > 700) doc.addPage();
        const col = impactColor[issue.impact] || GRAY;
        doc.rect(50, doc.y, 4, 14).fill(col);
        doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(`  ${issue.title}`, 58, doc.y - 1);
        doc.fillColor(col).fontSize(9).font('Helvetica').text(`  [${issue.impact?.toUpperCase()}] ${issue.priority}`, 58);
        doc.fillColor(GRAY).fontSize(9).text(`  ${issue.description}`, 58);
        if (issue.fixSuggestion) {
          doc.fillColor('#374151').fontSize(9).font('Helvetica-Oblique').text(`  💡 Fix: ${issue.fixSuggestion}`, 58);
        }
        doc.moveDown(0.6);
      });
    }

    // ── AI Report ──
    if (report.aiReport?.summary) {
      doc.addPage();
      doc.fillColor(DARK).fontSize(16).font('Helvetica-Bold').text('AI Insights Report', 50, 50);
      doc.fontSize(9).fillColor(GRAY).font('Helvetica').text(`Generated by ${report.aiReport.provider || 'AI'}`, 50);
      doc.moveDown(0.8);

      const sections = [
        ['Website Health Summary', report.aiReport.websiteHealth],
        ['What Is Working Well',   report.aiReport.whatWorksWell],
        ['Issues Found',           report.aiReport.issuesSummary],
        ['How To Fix Them',        report.aiReport.howToFix],
      ];

      sections.forEach(([title, content]) => {
        if (!content) return;
        if (doc.y > 650) doc.addPage();
        doc.fillColor(ACCENT).fontSize(12).font('Helvetica-Bold').text(title, 50);
        doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.2);
        doc.fillColor(DARK).fontSize(9.5).font('Helvetica').text(content, 50, doc.y, { width: 495, lineGap: 3 });
        doc.moveDown(0.8);
      });

      // Priority table
      if (report.aiReport.priorityTable?.length > 0) {
        if (doc.y > 600) doc.addPage();
        doc.fillColor(ACCENT).fontSize(12).font('Helvetica-Bold').text('Priority Table', 50);
        doc.moveDown(0.3);

        const cols = [180, 80, 60, 60, 175];
        const headers = ['Issue', 'Impact', 'Priority', 'Effort', 'Fix'];
        // Header row
        doc.rect(50, doc.y, 495, 16).fill(DARK);
        let cx = 50;
        headers.forEach((h, i) => {
          doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold').text(h, cx + 3, doc.y - 12, { width: cols[i] - 6 });
          cx += cols[i];
        });
        doc.moveDown(0.1);

        report.aiReport.priorityTable.slice(0, 15).forEach((row, idx) => {
          if (doc.y > 720) doc.addPage();
          const bg = idx % 2 === 0 ? '#f9fafb' : '#fff';
          doc.rect(50, doc.y, 495, 14).fill(bg);
          cx = 50;
          [row.issue, row.impact, row.priority, row.effort, row.fix].forEach((val, i) => {
            doc.fillColor(DARK).fontSize(7).font('Helvetica')
              .text(String(val || '').substring(0, 40), cx + 3, doc.y - 10, { width: cols[i] - 6 });
            cx += cols[i];
          });
          doc.moveDown(0.1);
        });
      }
    }

    // ── Footer ──
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      doc.fillColor(GRAY).fontSize(8).font('Helvetica')
        .text(`WebAuditX — Content Quality Report — Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 30, { align: 'center' });
    }

    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { analyze, getReport, getHistory, downloadPDF };