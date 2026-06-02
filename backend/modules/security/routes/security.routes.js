'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controller/security.controller');

const { optionalAuth, requireAuth } = require('../../../shared/middleware/auth.middleware');
const { incrementAuditCount }       = require('../../../shared/middleware/planLimit.middleware');
const { getLimitForPlan, isUnlimited } = require('../../../shared/utils/planConfig');

async function enforcePlanLimit(req, res) {
  if (!req.user) return null;
  const user = req.user;
  if (user.needsMonthlyReset()) { user.resetMonthlyUsage(); await user.save(); }
  const plan = user.plan || 'free';
  if (isUnlimited(plan)) return null;
  const limit = getLimitForPlan(plan);
  if (user.auditCountThisMonth >= limit) {
    res.status(429).json({
      success: false,
      code:    'AUDIT_LIMIT_REACHED',
      message: `You have reached your ${limit} audit limit for the ${plan} plan.`,
      data:    { plan, used: user.auditCountThisMonth, limit, remaining: 0, upgradeUrl: '/payment' },
    });
    return 'blocked';
  }
  return null;
}

router.post('/analyze', optionalAuth, async (req, res, next) => {
  try {
    const blocked = await enforcePlanLimit(req, res);
    if (blocked) return;

    if (req.user) {
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (body && body.success) {
          incrementAuditCount(req.user)
            .catch(e => console.error('[increment]', e.message));
        }
        return originalJson(body);
      };
    }

    await ctrl.analyze(req, res, next);
  } catch (err) { next(err); }
});

router.get('/report/:id',      optionalAuth, ctrl.getReport);
router.post('/ai-insight/:id', optionalAuth, ctrl.generateAI);
router.get('/download/:id',    requireAuth,  ctrl.downloadPDF);

module.exports = router;