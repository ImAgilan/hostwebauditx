'use strict';
const SeoAnalysis = require('../model/seo.model');
const { analyseUrl, generateAiReport } = require('../service/seo.service');

/* POST /api/seo/analyze */
exports.analyze = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

    const data = await analyseUrl(url);
    const record = await SeoAnalysis.create(data);

    res.json({ success: true, id: record._id, data: record });
  } catch (err) {
    console.error('[SEO] analyze error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* GET /api/seo/report/:id */
exports.getReport = async (req, res) => {
  try {
    const record = await SeoAnalysis.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* POST /api/seo/ai-report/:id */
exports.generateAi = async (req, res) => {
  try {
    const record = await SeoAnalysis.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Report not found' });

    if (record.aiReport) return res.json({ success: true, aiReport: record.aiReport });

    const aiReport = await generateAiReport(record.toObject());
    record.aiReport      = aiReport;
    record.aiGeneratedAt = new Date();
    await record.save();

    res.json({ success: true, aiReport });
  } catch (err) {
    console.error('[SEO] AI report error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* GET /api/seo/download/:id */
exports.downloadPdf = async (req, res) => {
  try {
    const record = await SeoAnalysis.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Report not found' });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="seo-report-${record._id}.pdf"`);
    doc.pipe(res);

    const PRIMARY = '#1a1a2e';
    const ACCENT  = '#e94560';
    const GRAY    = '#555';

    // Header
    doc.rect(0, 0, doc.page.width, 80).fill(PRIMARY);
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('SEO & Content Analysis Report', 50, 25);
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, 50, 55);
    doc.moveDown(3);

    // URL + Score
    doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text('Analysed URL');
    doc.fillColor(GRAY).fontSize(11).font('Helvetica').text(record.url);
    doc.moveDown(0.5);

    doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text(`Overall SEO Score: ${record.overallScore}/100`);
    doc.moveDown(1);

    // Category Scores
    doc.fillColor(PRIMARY).fontSize(13).font('Helvetica-Bold').text('Category Scores');
    doc.moveDown(0.3);
    const cats = record.categoryScores || {};
    Object.entries(cats).forEach(([k, v]) => {
      doc.fillColor(GRAY).fontSize(10).font('Helvetica').text(`  ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}/100`);
    });
    doc.moveDown(1);

    // Issues Summary
    doc.fillColor(PRIMARY).fontSize(13).font('Helvetica-Bold').text('Issue Summary');
    doc.moveDown(0.3);
    doc.fillColor(GRAY).fontSize(10).font('Helvetica')
      .text(`Critical: ${record.criticalCount || 0}   High: ${record.highCount || 0}   Medium: ${record.mediumCount || 0}   Low: ${record.lowCount || 0}`);
    doc.moveDown(1);

    // All Issues
    doc.fillColor(PRIMARY).fontSize(13).font('Helvetica-Bold').text('All Issues');
    doc.moveDown(0.3);
    (record.allIssues || []).slice(0, 40).forEach((issue, i) => {
      doc.fillColor(issue.severity === 'critical' ? '#cc0000' : issue.severity === 'high' ? '#e65c00' : issue.severity === 'medium' ? '#b8860b' : GRAY)
         .fontSize(9).font('Helvetica-Bold').text(`[${issue.severity?.toUpperCase()}] ${issue.title}`);
      doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(`  ${issue.recommendation || ''}`);
      doc.moveDown(0.3);
    });

    // Meta
    doc.addPage();
    doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text('Meta Analysis');
    doc.moveDown(0.3);
    const m = record.meta || {};
    [
      ['Title', m.title || 'N/A'],
      ['Title Length', `${m.titleLength || 0} chars`],
      ['Description', m.description ? m.description.substring(0, 80) + '...' : 'N/A'],
      ['Canonical', m.canonical || 'Not set'],
      ['Robots', m.robots || 'Not set'],
      ['Language', m.language || 'Not set'],
      ['OG Title', m.ogTitle || 'Not set'],
      ['Twitter Card', m.twitterCard || 'Not set'],
    ].forEach(([label, val]) => {
      doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(val);
    });

    // Content Analysis
    doc.moveDown(1);
    doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text('Content Analysis');
    doc.moveDown(0.3);
    const c = record.content || {};
    [
      ['Word Count', `${c.wordCount || 0}`],
      ['Readability Score', `${c.readabilityScore || 0} (${c.readabilityGrade || 'N/A'})`],
      ['Avg Sentence Length', `${c.avgSentenceLength || 0} words`],
      ['Paragraphs', `${c.paragraphCount || 0}`],
    ].forEach(([label, val]) => {
      doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(val);
    });

    // Top Keywords
    doc.moveDown(1);
    doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text('Top Keywords');
    doc.moveDown(0.3);
    (record.keywords?.topKeywords || []).slice(0, 10).forEach(kw => {
      doc.fillColor(GRAY).fontSize(9).font('Helvetica')
         .text(`  "${kw.keyword}" — Count: ${kw.count}, Density: ${kw.density}%`);
    });

    // Technical
    doc.moveDown(1);
    doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text('Technical SEO');
    doc.moveDown(0.3);
    const t = record.technical || {};
    [
      ['SSL/HTTPS', t.hasSSL ? '✓ Yes' : '✗ No'],
      ['Sitemap', t.sitemapExists ? `✓ Found (${t.sitemapUrlCount || 0} URLs)` : '✗ Not Found'],
      ['robots.txt', t.robotsTxtExists ? '✓ Found' : '✗ Not Found'],
      ['Structured Data', t.structuredData ? `✓ Yes (${(t.structuredDataTypes || []).join(', ')})` : '✗ None'],
      ['Mobile Friendly', t.mobileFriendly ? '✓ Yes' : '✗ No'],
    ].forEach(([label, val]) => {
      doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(val);
    });

    // AI Report
    if (record.aiReport) {
      doc.addPage();
      doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text('AI Insight Report');
      doc.moveDown(0.5);
      const plainText = record.aiReport.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(plainText.substring(0, 3000));
    }

    doc.end();
  } catch (err) {
    console.error('[SEO] PDF error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};