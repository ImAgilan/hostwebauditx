'use strict';

const { analyzeMobileFriendliness, generatePDF } = require('../service/mobileFriendliness.service');
const MF = require('../model/mobileFriendliness.model');

/* POST /api/mobile-friendliness/analyze */
exports.analyze = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.trim())
      return res.status(400).json({ success: false, message: 'A valid URL is required.' });

    const report = await analyzeMobileFriendliness(url.trim());
    return res.status(201).json({ success: true, data: report });
  } catch (err) {
    console.error('[MF:analyze]', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Analysis failed.' });
  }
};

/* GET /api/mobile-friendliness/report/:id */
exports.getReport = async (req, res) => {
  try {
    const report = await MF.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    return res.json({ success: true, data: report });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* GET /api/mobile-friendliness/history */
exports.getHistory = async (req, res) => {
  try {
    const filter = req.query.url ? { url: { $regex: req.query.url, $options: 'i' } } : {};
    const reports = await MF.find(filter)
      .sort({ createdAt: -1 }).limit(20)
      .select('url scores.overall status createdAt dataSourcesUsed').lean();
    return res.json({ success: true, data: reports });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* GET /api/mobile-friendliness/download/:id */
exports.download = async (req, res) => {
  try {
    const report = await MF.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });

    const buf      = await generatePDF(report);
    const filename = `mobile-audit-${report._id}.pdf`;
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      buf.length,
    });
    return res.send(buf);
  } catch (err) {
    console.error('[MF:download]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};