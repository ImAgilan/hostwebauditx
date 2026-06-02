'use strict';
const router     = require('express').Router();
const controller = require('../controller/mobileFriendliness.controller');

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

    await controller.analyze(req, res, next);
  } catch (err) { next(err); }
});

router.get('/report/:id',   optionalAuth, controller.getReport);
router.get('/history',      optionalAuth, controller.getHistory);
router.get('/download/:id', requireAuth,  controller.download);

module.exports = router;