'use strict';
/**
 * technicalInsight.controller.js
 */

const svc = require('../service/technicalInsight.service');

/* POST /api/technical-insight/analyze */
async function analyze(req, res, next) {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

    /* Kick off audit asynchronously — return record ID immediately */
    const record = await svc.runFullAudit(url);
    return res.status(200).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

/* GET /api/technical-insight/report/:id */
async function getReport(req, res, next) {
  try {
    const record = await svc.getReport(req.params.id);
    return res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

/* POST /api/technical-insight/ai-report/:id */
async function generateAIReport(req, res, next) {
  try {
    const record = await svc.generateReport(req.params.id);
    return res.json({ success: true, data: record.aiReport });
  } catch (err) {
    next(err);
  }
}

/* GET /api/technical-insight/download/:id */
async function downloadPDF(req, res, next) {
  try {
    const pdfBuffer = await svc.downloadPDF(req.params.id);
    const record    = await svc.getReport(req.params.id);
    const filename  = `webauditx-${record.url.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-')}.pdf`;
    res.setHeader('Content-Type',        'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

/* GET /api/technical-insight/list */
async function listReports(req, res, next) {
  try {
    const records = await svc.listReports(Number(req.query.limit) || 20);
    return res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
}

module.exports = { analyze, getReport, generateAIReport, downloadPDF, listReports };