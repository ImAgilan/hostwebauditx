'use strict';

/**
 * planLimit.middleware.js
 *
 * Enforces monthly audit limits per subscription plan.
 * MUST be used AFTER requireAuth middleware.
 *
 * Flow:
 *  1. Check if a new month has started → lazy reset
 *  2. Check current plan's limit
 *  3. Block if limit exceeded
 *  4. Allow and attach limit info to req if within limit
 */

const { getLimitForPlan, isUnlimited } = require('../utils/planConfig');

/**
 * checkPlanLimit
 *
 * Usage in routes:
 *   router.post('/analyze', requireAuth, checkPlanLimit, yourController);
 */
async function checkPlanLimit(req, res, next) {
  try {
    const user = req.user;

    /* ── Safety check ── */
    if (!user) {
      return res.status(401).json({
        success: false,
        code:    'UNAUTHENTICATED',
        message: 'You must be logged in to run audits.',
      });
    }

    /* ── 1. Lazy monthly reset ── */
    if (user.needsMonthlyReset()) {
      user.resetMonthlyUsage();
      await user.save();
      console.log(`[PlanLimit] Monthly usage reset for user: ${user.email}`);
    }

    /* ── 2. Get plan limit ── */
    const plan  = user.plan || 'free';
    const limit = getLimitForPlan(plan);

    /* ── 3. Unlimited plan — skip check ── */
    if (isUnlimited(plan)) {
      req.auditMeta = {
        plan,
        used:      user.auditCountThisMonth,
        limit:     'unlimited',
        remaining: 'unlimited',
      };
      return next();
    }

    /* ── 4. Check usage ── */
    const used      = user.auditCountThisMonth;
    const remaining = limit - used;

    if (used >= limit) {
      return res.status(429).json({
        success:  false,
        code:     'AUDIT_LIMIT_REACHED',
        message:  `You have reached your monthly audit limit of ${limit} for the ${plan} plan.`,
        data: {
          plan,
          used,
          limit,
          remaining:    0,
          upgradeUrl:   '/pricing',
          resetMessage: 'Your limit resets on the 1st of next month.',
        },
      });
    }

    /* ── 5. Attach meta to request for controllers to use ── */
    req.auditMeta = { plan, used, limit, remaining };
    next();

  } catch (err) {
    console.error('[PlanLimit Middleware] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify subscription limits. Please try again.',
    });
  }
}

/**
 * incrementAuditCount
 *
 * Call this AFTER a successful audit (in your controller or as post-middleware).
 * Increments user's monthly audit counter.
 *
 * Usage (manual, in controller):
 *   await incrementAuditCount(req.user);
 *
 * Usage (as middleware at end of chain):
 *   router.post('/analyze', requireAuth, checkPlanLimit, yourController, incrementAuditCount);
 *   NOTE: As middleware it must be called via next() from the controller.
 */
async function incrementAuditCount(user) {
  try {
    user.auditCountThisMonth += 1;
    await user.save();
    console.log(
      `[PlanLimit] Audit count incremented for ${user.email}: ${user.auditCountThisMonth}`
    );
  } catch (err) {
    // Non-fatal — log but don't crash the audit response
    console.error('[PlanLimit] Failed to increment audit count:', err.message);
  }
}

/**
 * incrementAuditCountMiddleware
 *
 * Express middleware version of incrementAuditCount.
 * Attach at the END of the route chain.
 * The controller must call next() after sending response,
 * OR you can call this manually inside your controller.
 */
async function incrementAuditCountMiddleware(req, res, next) {
  if (req.user) {
    await incrementAuditCount(req.user);
  }
  next();
}

module.exports = {
  checkPlanLimit,
  incrementAuditCount,
  incrementAuditCountMiddleware,
};