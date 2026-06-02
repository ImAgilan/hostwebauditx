'use strict';

const router = require('express').Router();
const ctrl   = require('../controller/fullAudit.controller');

const { optionalAuth, requireAuth } = require('../../../shared/middleware/auth.middleware');
const { incrementAuditCount }       = require('../../../shared/middleware/planLimit.middleware');
const { getLimitForPlan, isUnlimited } = require('../../../shared/utils/planConfig');

/* ── Plan limit check (only for logged-in users) ── */
async function enforcePlanLimit(req, res) {
  if (!req.user) return null;

  const user = req.user;

  if (user.needsMonthlyReset()) {
    user.resetMonthlyUsage();
    await user.save();
  }

  const plan = user.plan || 'free';
  if (isUnlimited(plan)) return null;

  const limit = getLimitForPlan(plan);
  const used  = user.auditCountThisMonth;

  if (used >= limit) {
    res.status(429).json({
      success: false,
      code:    'AUDIT_LIMIT_REACHED',
      message: `You have reached your ${limit} audit limit for the ${plan} plan.`,
      data:    { plan, used, limit, remaining: 0, upgradeUrl: '/payment' },
    });
    return 'blocked';
  }

  return null;
}

/* ── POST /api/full-audit/analyze ── */
router.post('/analyze', optionalAuth, async (req, res, next) => {
  try {
    const blocked = await enforcePlanLimit(req, res);
    if (blocked) return;

    await ctrl.analyze(req, res, next);

    if (req.user) await incrementAuditCount(req.user);
  } catch (err) {
    next(err);
  }
});

/* ── GET /api/full-audit/report/:id ── */
router.get('/report/:id',    optionalAuth, ctrl.getReport);    // was requireAuth
router.get('/ai-report/:id', optionalAuth, ctrl.getAIReport);  // was requireAuth

/* ── GET /api/full-audit/download/:id ── */
router.get('/download/:id',  requireAuth, ctrl.downloadPDF);

module.exports = router;