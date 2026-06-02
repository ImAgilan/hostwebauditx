'use strict';
/**
 * fullAudit.controller.js
 * Handles HTTP layer: analyze, report, AI report, PDF download.
 */

const { runFullAudit, getAIReport, getReport } = require('../service/fullAudit.service');
const PDFDocument = require('pdfkit');

/* ══════════════════════════════════════════════════════════════════
   POST /api/full-audit/analyze
══════════════════════════════════════════════════════════════════ */
exports.analyze = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, message: 'A valid URL is required.' });
    }
    const result = await runFullAudit(url.trim());
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('[FullAudit] analyze error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Audit failed.' });
  }
};

/* ══════════════════════════════════════════════════════════════════
   GET /api/full-audit/report/:id
══════════════════════════════════════════════════════════════════ */
exports.getReport = async (req, res) => {
  try {
    const data = await getReport(req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════
   GET /api/full-audit/ai-report/:id
══════════════════════════════════════════════════════════════════ */
exports.getAIReport = async (req, res) => {
  try {
    const data = await getAIReport(req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════
   GET /api/full-audit/download/:id
   Streams a full professional PDF report
══════════════════════════════════════════════════════════════════ */
exports.downloadPDF = async (req, res) => {
  try {
    const audit = await getReport(req.params.id);
    const ai    = audit.aiReport || {};
    const scores = audit.scores || {};
    const issues = audit.issues || [];
    const meta   = audit.meta   || {};

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      info: {
        Title: `WebAuditX Report — ${audit.url}`,
        Author: 'WebAuditX',
        Subject: 'Full Website Audit Report',
        CreationDate: new Date(),
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="WebAuditX-Report-${req.params.id.slice(-8)}.pdf"`);
    doc.pipe(res);

    /* ── Color palette ── */
    const C = {
      brand:   '#00b894',
      dark:    '#1a1a2e',
      text:    '#2d3748',
      muted:   '#718096',
      high:    '#e53e3e',
      medium:  '#dd6b20',
      low:     '#38a169',
      white:   '#ffffff',
      bgLight: '#f7fafc',
      border:  '#e2e8f0',
    };

    function scoreColor(s) {
      if (s >= 80) return C.low;
      if (s >= 60) return C.medium;
      return C.high;
    }

    function drawHRule(y, color = C.border) {
      doc.moveTo(50, y).lineTo(545, y).strokeColor(color).lineWidth(0.5).stroke();
    }

    /* ══ PAGE 1: COVER ══════════════════════════════════════════ */

    // Header bar
    doc.rect(0, 0, 595, 80).fill(C.dark);
    doc.fontSize(26).fillColor(C.brand).font('Helvetica-Bold').text('WebAudit', 50, 22, { continued: true });
    doc.fillColor(C.white).text('X');
    doc.fontSize(10).fillColor(C.muted).font('Helvetica').text('AI-POWERED WEBSITE INTELLIGENCE', 50, 54);
    doc.fontSize(10).fillColor(C.muted).text('BETA', 490, 30);

    doc.moveDown(4);

    // Report title
    doc.fontSize(18).fillColor(C.text).font('Helvetica-Bold').text('Full Website Audit Report', 50, 110);
    doc.fontSize(11).fillColor(C.muted).font('Helvetica').text(audit.url, 50, 135);

    // Overall score circle (drawn with PDF graphics)
    const cx = 420, cy = 160, r = 55;
    doc.circle(cx, cy, r).lineWidth(8).strokeColor(C.border).stroke();
    const scoreAngle = (audit.overallScore / 100) * Math.PI * 2;
    doc.circle(cx, cy, r).lineWidth(8).strokeColor(scoreColor(audit.overallScore)).stroke();
    doc.fontSize(28).fillColor(scoreColor(audit.overallScore)).font('Helvetica-Bold')
      .text(`${audit.overallScore}`, cx - 22, cy - 18);
    doc.fontSize(9).fillColor(C.muted).font('Helvetica').text('/100', cx - 10, cy + 14);
    doc.fontSize(8).fillColor(C.muted).text('OVERALL', cx - 18, cy + 30);

    // Meta info box
    doc.rect(50, 160, 330, 90).fillColor(C.bgLight).fill();
    doc.fontSize(9).fillColor(C.muted).font('Helvetica')
      .text(`Audit Date:`, 65, 175).text(new Date(audit.createdAt).toLocaleString(), 145, 175)
      .text(`Domain:`,     65, 192).text(audit.domain || audit.url, 145, 192)
      .text(`Page Size:`,  65, 209).text(`${meta.htmlSize || 0} KB`, 145, 209)
      .text(`Load Time:`,  65, 226).text(`${meta.pageLoadTime || 0}ms`, 145, 226)
      .text(`HTTP Status:`,65, 243).text(`${meta.httpStatus || 200}`, 145, 243);

    // Issue summary badges
    const highCount   = issues.filter(i => i.severity === 'high').length;
    const medCount    = issues.filter(i => i.severity === 'medium').length;
    const lowCount    = issues.filter(i => i.severity === 'low').length;

    doc.rect(50, 270, 155, 50).fillColor('#fff5f5').fill();
    doc.rect(215, 270, 155, 50).fillColor('#fffaf0').fill();
    doc.rect(380, 270, 155, 50).fillColor('#f0fff4').fill();

    doc.fontSize(22).fillColor(C.high).font('Helvetica-Bold').text(`${highCount}`, 115, 280);
    doc.fontSize(8).fillColor(C.high).font('Helvetica').text('HIGH SEVERITY', 65, 306);

    doc.fontSize(22).fillColor(C.medium).font('Helvetica-Bold').text(`${medCount}`, 280, 280);
    doc.fontSize(8).fillColor(C.medium).font('Helvetica').text('MEDIUM SEVERITY', 225, 306);

    doc.fontSize(22).fillColor(C.low).font('Helvetica-Bold').text(`${lowCount}`, 445, 280);
    doc.fontSize(8).fillColor(C.low).font('Helvetica').text('LOW SEVERITY', 395, 306);

    drawHRule(340);

    /* ── Module Score Grid ── */
    doc.fontSize(13).fillColor(C.text).font('Helvetica-Bold').text('Module Scores', 50, 355);

    const mods = Object.entries(scores);
    const colW = 240, rowH = 60, cols = 2;
    mods.forEach(([mod, s], idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x   = 50 + col * (colW + 15);
      const y   = 380 + row * rowH;

      doc.rect(x, y, colW, rowH - 8).fillColor(C.bgLight).fill();
      doc.fontSize(9).fillColor(C.muted).font('Helvetica').text(mod.toUpperCase(), x + 12, y + 10);
      doc.fontSize(18).fillColor(scoreColor(s)).font('Helvetica-Bold').text(`${s}`, x + 12, y + 22);
      doc.fontSize(8).fillColor(C.muted).text('/100', x + 40, y + 28);

      // Mini bar
      const barW = colW - 24;
      doc.rect(x + 12, y + 44, barW, 5).fillColor(C.border).fill();
      doc.rect(x + 12, y + 44, Math.round(barW * s / 100), 5).fillColor(scoreColor(s)).fill();
    });

    /* ══ PAGE 2: AI EXECUTIVE SUMMARY ══════════════════════════ */
    if (ai.summary) {
      doc.addPage();

      doc.rect(0, 0, 595, 50).fill(C.dark);
      doc.fontSize(14).fillColor(C.brand).font('Helvetica-Bold').text('AI Executive Summary', 50, 16);

      doc.fontSize(11).fillColor(C.text).font('Helvetica')
        .text(ai.summary || '', 50, 70, { width: 495, lineGap: 4 });

      const sumH = doc.y + 20;
      drawHRule(sumH);

      if (ai.businessImpact) {
        doc.fontSize(11).fillColor(C.text).font('Helvetica-Bold').text('Business Impact:', 50, sumH + 15);
        doc.fontSize(10).fillColor(C.muted).font('Helvetica').text(ai.businessImpact, 50, sumH + 30, { width: 495 });
      }

      if (ai.estimatedFixTime) {
        doc.fontSize(10).fillColor(C.muted).font('Helvetica')
          .text(`Estimated Fix Time: ${ai.estimatedFixTime}`, 50, doc.y + 12);
      }

      drawHRule(doc.y + 15);

      // Strengths
      if (ai.strengths?.length) {
        doc.fontSize(12).fillColor(C.low).font('Helvetica-Bold').text('✓  What\'s Working Well', 50, doc.y + 20);
        doc.moveDown(0.3);
        (ai.strengths || []).forEach(s => {
          doc.fontSize(9).fillColor(C.text).font('Helvetica').text(`  • ${s}`, 60, doc.y, { width: 475 });
          doc.moveDown(0.2);
        });
      }

      drawHRule(doc.y + 10);

      // Critical Issues
      if (ai.criticalIssues?.length) {
        doc.fontSize(12).fillColor(C.high).font('Helvetica-Bold').text('✗  Critical Issues Requiring Immediate Action', 50, doc.y + 20);
        doc.moveDown(0.3);
        (ai.criticalIssues || []).forEach(s => {
          doc.fontSize(9).fillColor(C.text).font('Helvetica').text(`  • ${s}`, 60, doc.y, { width: 475 });
          doc.moveDown(0.2);
        });
      }
    }

    /* ══ PAGE 3: PRIORITY RECOMMENDATIONS ══════════════════════ */
    if (ai.recommendations?.length) {
      doc.addPage();

      doc.rect(0, 0, 595, 50).fill(C.dark);
      doc.fontSize(14).fillColor(C.brand).font('Helvetica-Bold').text('Priority Recommendations', 50, 16);

      let recY = 65;
      (ai.recommendations || []).forEach((r, i) => {
        if (recY > 720) { doc.addPage(); recY = 50; }

        const bColor = r.priority === 'high' ? C.high : r.priority === 'medium' ? C.medium : C.low;
        const bBg    = r.priority === 'high' ? '#fff5f5' : r.priority === 'medium' ? '#fffaf0' : '#f0fff4';

        doc.rect(50, recY, 495, 70).fillColor(bBg).fill();
        doc.rect(50, recY, 4, 70).fillColor(bColor).fill();

        doc.fontSize(7).fillColor(bColor).font('Helvetica-Bold')
          .text(r.priority?.toUpperCase() || '', 60, recY + 8);
        doc.fontSize(8).fillColor(C.muted).font('Helvetica')
          .text(`[${r.module?.toUpperCase() || ''}]  ·  Effort: ${r.effort || 'medium'}  ·  Time: ${r.timeToFix || 'varies'}`, 110, recY + 8);

        doc.fontSize(10).fillColor(C.text).font('Helvetica-Bold')
          .text(r.action || '', 60, recY + 22, { width: 475 });
        doc.fontSize(9).fillColor(C.muted).font('Helvetica')
          .text(`Impact: ${r.impact || ''}`, 60, recY + 42, { width: 475 });

        recY += 80;
      });
    }

    /* ══ PAGE 4: ALL ISSUES DETAIL ══════════════════════════════ */
    doc.addPage();
    doc.rect(0, 0, 595, 50).fill(C.dark);
    doc.fontSize(14).fillColor(C.brand).font('Helvetica-Bold').text(`All Issues (${issues.length})`, 50, 16);

    const sevOrder = { high: 0, medium: 1, low: 2 };
    const sortedIssues = [...issues].sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    let issY = 65;
    sortedIssues.forEach((issue, i) => {
      if (issY > 740) { doc.addPage(); issY = 30; }

      const iColor = issue.severity === 'high' ? C.high : issue.severity === 'medium' ? C.medium : C.low;

      doc.circle(58, issY + 8, 5).fillColor(iColor).fill();
      doc.fontSize(9).fillColor(C.text).font('Helvetica-Bold')
        .text(issue.title || '', 70, issY, { width: 390 });
      doc.fontSize(7).fillColor(C.muted).font('Helvetica')
        .text(`[${issue.module?.toUpperCase()}]`, 465, issY);

      doc.fontSize(8).fillColor(C.muted).font('Helvetica')
        .text(issue.detail || '', 70, doc.y + 2, { width: 465 });

      if (issue.recommendation) {
        doc.fontSize(7.5).fillColor(C.brand).font('Helvetica-Oblique')
          .text(`Fix: ${issue.recommendation}`, 70, doc.y + 2, { width: 465 });
      }

      issY = doc.y + 12;
      if (i < sortedIssues.length - 1) drawHRule(issY - 4);
    });

    /* ══ PAGE 5: MODULE-WISE INSIGHTS ════════════════════════════ */
    if (ai.moduleInsights) {
      doc.addPage();
      doc.rect(0, 0, 595, 50).fill(C.dark);
      doc.fontSize(14).fillColor(C.brand).font('Helvetica-Bold').text('Module-Wise AI Insights', 50, 16);

      const moduleIcons = {
        seo: '🔍', performance: '⚡', accessibility: '♿', security: '🔐',
        mobile: '📱', content: '⭐', structure: '🗺', ui: '🎨', technical: '🔧',
      };

      let modY = 65;
      Object.entries(ai.moduleInsights || {}).forEach(([mod, insight]) => {
        if (modY > 720) { doc.addPage(); modY = 30; }
        const s = scores[mod] || 0;

        doc.rect(50, modY, 495, 60).fillColor(C.bgLight).fill();
        doc.rect(50, modY, 4, 60).fillColor(scoreColor(s)).fill();

        doc.fontSize(10).fillColor(C.text).font('Helvetica-Bold')
          .text(`${mod.toUpperCase()}`, 62, modY + 8);
        doc.fontSize(16).fillColor(scoreColor(s)).font('Helvetica-Bold')
          .text(`${s}/100`, 450, modY + 8);

        const barW2 = 380;
        doc.rect(62, modY + 30, barW2, 5).fillColor(C.border).fill();
        doc.rect(62, modY + 30, Math.round(barW2 * s / 100), 5).fillColor(scoreColor(s)).fill();

        doc.fontSize(8).fillColor(C.muted).font('Helvetica')
          .text(insight || '', 62, modY + 40, { width: 470 });

        modY += 72;
      });
    }

    /* ══ FOOTER (last page) ══════════════════════════════════════ */
    doc.fontSize(8).fillColor(C.muted).font('Helvetica')
      .text(
        `Generated by WebAuditX  ·  ${new Date().toLocaleDateString()}  ·  Group No. 5 · OUSL BSE Final Project`,
        50, 780, { align: 'center', width: 495 }
      );

    doc.end();

  } catch (err) {
    console.error('[PDF] Generation error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'PDF generation failed: ' + err.message });
    }
  }
};