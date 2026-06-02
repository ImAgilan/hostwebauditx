'use strict';

const AuditHistory = require('../model/auditHistory.model');

/**
 * Record a new audit entry.
 * Call this from any audit module's controller AFTER a successful audit.
 *
 * @param {object} opts
 * @param {string}  opts.userId
 * @param {string}  opts.module     — e.g. 'seo', 'performance', 'full-audit'
 * @param {string}  opts.url
 * @param {number}  opts.score      — 0-100
 * @param {number}  opts.issueCount
 * @param {string}  opts.auditId    — ObjectId of the audit result document
 * @param {object}  opts.summary    — key metrics snapshot (optional)
 * @param {boolean} opts.hasAIReport
 * @param {boolean} opts.hasPDF
 * @returns {Promise<AuditHistory>}
 */
async function recordAudit(opts = {}) {
  const { userId, module, url, score, issueCount, auditId, summary, hasAIReport, hasPDF } = opts;
  if (!userId || !module || !url) throw new Error('userId, module, and url are required.');

  const entry = await AuditHistory.create({
    userId,
    module,
    url,
    score:       score       ?? null,
    issueCount:  issueCount  ?? 0,
    auditId:     auditId     ?? null,
    summary:     summary     ?? {},
    hasAIReport: hasAIReport ?? false,
    hasPDF:      hasPDF      ?? false,
    status:      'completed',
  });

  return entry;
}

/**
 * Get paginated audit history for a user.
 *
 * @param {string} userId
 * @param {object} opts
 * @param {number}  opts.page      — 1-based
 * @param {number}  opts.limit     — default 20
 * @param {string}  opts.module    — filter by module (optional)
 * @param {string}  opts.search    — filter by URL substring (optional)
 * @returns {Promise<{ data, total, page, totalPages }>}
 */
async function getUserHistory(userId, opts = {}) {
  const page   = Math.max(1, parseInt(opts.page)  || 1);
  const limit  = Math.min(50, parseInt(opts.limit) || 20);
  const skip   = (page - 1) * limit;

  const filter = { userId };
  if (opts.module) filter.module = opts.module;
  if (opts.search) filter.url = { $regex: opts.search, $options: 'i' };

  const [data, total] = await Promise.all([
    AuditHistory.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditHistory.countDocuments(filter),
  ]);

  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
  };
}

/**
 * Get summary stats for a user's audit history.
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getUserStats(userId) {
  const [totalDocs, moduleBreakdown, recentScores] = await Promise.all([
    AuditHistory.countDocuments({ userId }),

    AuditHistory.aggregate([
      { $match: { userId: new (require('mongoose').Types.ObjectId)(userId) } },
      { $group: { _id: '$module', count: { $sum: 1 }, avgScore: { $avg: '$score' } } },
      { $sort: { count: -1 } },
    ]),

    AuditHistory.find({ userId, score: { $ne: null } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('score module createdAt url')
      .lean(),
  ]);

  const avgScore = recentScores.length
    ? Math.round(recentScores.reduce((s, a) => s + a.score, 0) / recentScores.length)
    : null;

  return {
    total:          totalDocs,
    avgScore,
    moduleBreakdown,
    recentScores,
  };
}

/**
 * Delete a single audit history entry (user must own it).
 * @param {string} historyId
 * @param {string} userId
 */
async function deleteEntry(historyId, userId) {
  const entry = await AuditHistory.findOneAndDelete({ _id: historyId, userId });
  if (!entry) {
    const err = new Error('Audit history entry not found or access denied.');
    err.statusCode = 404;
    throw err;
  }
  return { deleted: true };
}

/**
 * Clear all history for a user.
 * @param {string} userId
 */
async function clearAllHistory(userId) {
  const result = await AuditHistory.deleteMany({ userId });
  return { deleted: result.deletedCount };
}

module.exports = {
  recordAudit,
  getUserHistory,
  getUserStats,
  deleteEntry,
  clearAllHistory,
};