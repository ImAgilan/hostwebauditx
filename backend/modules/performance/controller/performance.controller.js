'use strict';
const { analyzePerformance, generateAndSaveReport, generatePDF } = require('../service/performance.service');
const Performance = require('../model/performance.model');

/* POST /api/performance/analyze */
exports.analyze = async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

    const normalised = url.startsWith('http') ? url : `https://${url}`;
    const result = await analyzePerformance(normalised);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/* GET /api/performance/report/:id */
exports.getReport = async (req, res, next) => {
  try {
    const doc = await Performance.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
};

/* POST /api/performance/ai-report/:id */
exports.generateAI = async (req, res, next) => {
  try {
    const doc = await generateAndSaveReport(req.params.id);
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
};

/* GET /api/performance/download/:id */
exports.downloadPDF = async (req, res, next) => {
  try {
    const buf = await generatePDF(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="performance-report-${req.params.id}.pdf"`);
    res.send(buf);
  } catch (err) {
    next(err);
  }
};

/* GET /api/performance/history?url= */
exports.getHistory = async (req, res, next) => {
  try {
    const { url } = req.query;
    const query = url ? { url: { $regex: url, $options: 'i' } } : {};
    const docs = await Performance.find(query).sort({ createdAt: -1 }).limit(20).select('-resources -images -cacheHeaders');
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
};