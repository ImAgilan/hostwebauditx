'use strict';

/**
 * Plan configuration
 * Defines monthly audit limits per plan.
 * -1 = unlimited
 */
const PLAN_LIMITS = {
  free:    15,
  pro:     100,
  premium: -1,   // unlimited
};

/**
 * Returns the audit limit for a given plan.
 * @param {string} plan
 * @returns {number}
 */
function getLimitForPlan(plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

/**
 * Returns true if this plan has unlimited audits.
 * @param {string} plan
 * @returns {boolean}
 */
function isUnlimited(plan) {
  return PLAN_LIMITS[plan] === -1;
}

module.exports = { PLAN_LIMITS, getLimitForPlan, isUnlimited };