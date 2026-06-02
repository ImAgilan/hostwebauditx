'use strict';
const Accessibility        = require('../model/accessibility.model');
const { analyzeAccessibility } = require('../service/accessibility.service');
const { generateAIReport } = require('../service/aiReport.service');
const { generatePDF }      = require('../service/pdf.service');
const fs                   = require('fs');

/* POST /api/accessibility/analyze */
async function analyze(req, res, next) {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    const result = await analyzeAccessibility(normalizedUrl);

    const record = await Accessibility.create({
      url:          normalizedUrl,
      overallScore: result.overallScore,
      wcagLevel:    result.wcagLevel,
      summary:      result.summary,
      metrics:      result.metrics,
      issues:       result.issues,
      rawHtml:      result.rawHtml?.slice(0, 50000), // truncate
    });

    res.json({ success: true, id: record._id, data: { ...result, rawHtml: undefined } });
  } catch (err) {
    next(err);
  }
}

/* GET /api/accessibility/report/:id */
async function getReport(req, res, next) {
  try {
    const record = await Accessibility.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

/* POST /api/accessibility/ai-report/:id */
async function createAIReport(req, res, next) {
  try {
    const record = await Accessibility.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Report not found' });

    const aiReport = await generateAIReport({
      url: record.url,
      overallScore: record.overallScore,
      wcagLevel: record.wcagLevel,
      summary: record.summary,
      metrics: record.metrics,
      issues: record.issues,
    });

    record.aiReport = aiReport;
    await record.save();

    res.json({ success: true, aiReport });
  } catch (err) {
    next(err);
  }
}

/* GET /api/accessibility/download/:id */
async function downloadPDF(req, res, next) {
  try {
    const record = await Accessibility.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Report not found' });

    const filePath = await generatePDF(record);
    res.download(filePath, `accessibility-report-${req.params.id}.pdf`, err => {
      if (err) next(err);
      // optionally clean up: fs.unlinkSync(filePath)
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { analyze, getReport, createAIReport, downloadPDF };