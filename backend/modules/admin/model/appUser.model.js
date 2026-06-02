'use strict';
/**
 * AppUser Model — FIXED to match Home.jsx pricing (3 tiers)
 *
 * Tiers:
 *   free     → $0/mo  — Starter plan   (5 audits/mo, 3 modules)
 *   pro      → $29/mo — Professional   (150 audits/mo, 9 modules)
 *   premium  → $89/mo — Agency         (unlimited audits, 9 modules)
 */

const mongoose = require('mongoose');

const SUBSCRIPTION_TIERS = ['free', 'pro', 'premium'];

const TIER_PRICING = {
  free:    0,
  pro:     29,
  premium: 89,
};

const TIER_LABELS = {
  free:    'Starter',
  pro:     'Professional',
  premium: 'Agency',
};

const TIER_LIMITS = {
  free:    { auditsPerMonth: 5,   modules: 3 },
  pro:     { auditsPerMonth: 150, modules: 9 },
  premium: { auditsPerMonth: -1,  modules: 9 }, // -1 = unlimited
};

const paymentSchema = new mongoose.Schema({
  amount:      Number,
  currency:    { type: String, default: 'USD' },
  method:      String,
  status:      { type: String, enum: ['paid', 'failed', 'refunded'], default: 'paid' },
  paidAt:      { type: Date, default: Date.now },
  description: String,
}, { _id: false });

const appUserSchema = new mongoose.Schema(
  {
    name:  { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    /* Auth */
    passwordHash:    { type: String, select: false },
    provider:        { type: String, enum: ['email', 'google', 'github'], default: 'email' },
    isEmailVerified: { type: Boolean, default: false },

    /* Subscription — 3 tiers only */
    subscription:       { type: String, enum: SUBSCRIPTION_TIERS, default: 'free' },
    subscriptionSince:  { type: Date },
    subscriptionExpiry: { type: Date },
    billingCycle:       { type: String, enum: ['monthly', 'annual'], default: 'monthly' },

    /* Usage */
    auditCount:      { type: Number, default: 0 },
    auditsThisMonth: { type: Number, default: 0 },
    auditResetDate:  { type: Date },
    lastAuditAt:     { type: Date },
    totalAuditsEver: { type: Number, default: 0 },

    /* Payments */
    payments:      { type: [paymentSchema], default: [] },
    lifetimeValue: { type: Number, default: 0 },

    /* Status */
    isActive:  { type: Boolean, default: true },
    isBanned:  { type: Boolean, default: false },
    banReason: { type: String },
    bannedAt:  { type: Date },

    /* Meta */
    country:      { type: String },
    timezone:     { type: String },
    lastLoginAt:  { type: Date },
    signupSource: { type: String },
  },
  { timestamps: true }
);

/* ── Virtuals ── */
appUserSchema.virtual('monthlyRevenue').get(function () {
  return TIER_PRICING[this.subscription] || 0;
});

appUserSchema.virtual('limits').get(function () {
  return TIER_LIMITS[this.subscription];
});

appUserSchema.virtual('planLabel').get(function () {
  return TIER_LABELS[this.subscription];
});

/* ── Statics ── */
appUserSchema.statics.TIER_PRICING = TIER_PRICING;
appUserSchema.statics.TIER_LIMITS  = TIER_LIMITS;
appUserSchema.statics.TIER_LABELS  = TIER_LABELS;
appUserSchema.statics.TIERS        = SUBSCRIPTION_TIERS;

appUserSchema.statics.getSubscriptionBreakdown = async function () {
  return this.aggregate([
    {
      $group: {
        _id:   '$subscription',
        count: { $sum: 1 },
        revenue: {
          $sum: {
            $switch: {
              branches: SUBSCRIPTION_TIERS.map(t => ({
                case: { $eq: ['$subscription', t] },
                then: TIER_PRICING[t],
              })),
              default: 0,
            },
          },
        },
      },
    },
    { $sort: { revenue: -1 } },
  ]);
};

appUserSchema.statics.getMonthlyGrowth = async function (months = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  return this.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          year:  { $year:  '$createdAt' },
          month: { $month: '$createdAt' },
        },
        newUsers: { $sum: 1 },
        paidUsers: {
          $sum: { $cond: [{ $ne: ['$subscription', 'free'] }, 1, 0] },
        },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);
};

appUserSchema.set('toJSON', {
  virtuals: true,
  transform (doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.model('AppUser', appUserSchema);