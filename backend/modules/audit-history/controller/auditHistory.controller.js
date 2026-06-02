'use strict';

const auditHistoryService = require('../service/auditHistory.service');

/**
 * GET /api/audit-history
 * Query params: page, limit, module, search
 */
async function getHistory(req, res) {
  try {
    const result = await auditHistoryService.getUserHistory(req.user._id, {
      page:   req.query.page,
      limit:  req.query.limit,
      module: req.query.module,
      search: req.query.search,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/audit-history/stats
 */
async function getStats(req, res) {
  try {
    const stats = await auditHistoryService.getUserStats(req.user._id);
    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/audit-history/:id
 */
async function deleteEntry(req, res) {
  try {
    const result = await auditHistoryService.deleteEntry(req.params.id, req.user._id);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/audit-history
 * Clears all history for the user.
 */
async function clearAll(req, res) {
  try {
    const result = await auditHistoryService.clearAllHistory(req.user._id);
    return res.status(200).json({ success: true, message: `${result.deleted} records deleted.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getHistory, getStats, deleteEntry, clearAll };