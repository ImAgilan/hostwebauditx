'use strict';

/**
 * subscription.service.js
 * Auth + subscription business logic.
 * ADDED: forgotPassword, resetPassword
 */

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const User   = require('../model/user.model');
const { getLimitForPlan, isUnlimited } = require('../../../shared/utils/planConfig');

/* ── JWT ── */
function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/* ── Register ── */
async function registerUser({ name, email, password }) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    const err = new Error('An account with this email already exists.');
    err.statusCode = 409;
    throw err;
  }
  const user  = await User.create({ name, email, password });
  const token = generateToken(user._id);
  return { user: sanitizeUser(user), token };
}

/* ── Login ── */
async function loginUser({ email, password }) {
  const user = await User.findByEmailWithPassword(email);
  if (!user || !(await user.comparePassword(password))) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }
  if (!user.isActive) {
    const err = new Error('Your account has been disabled. Contact support.');
    err.statusCode = 403;
    throw err;
  }
  const token = generateToken(user._id);
  return { user: sanitizeUser(user), token };
}

/* ── Forgot Password ── */
/**
 * Generate a password-reset token and "send" it (console.log for now).
 * In production: email the token link via SendGrid / Nodemailer.
 *
 * @param {string} email
 * @returns {{ message: string }}
 */
async function forgotPassword(email) {
  /* Always return success message — don't reveal if email exists */
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  /* Generate a secure random token (hex, 32 bytes = 64 chars) */
  const rawToken   = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.passwordResetToken   = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await user.save();

  /* Build reset link */
  const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink   = `${frontendURL}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

  /* TODO: Replace console.log with real email service */
  console.log('─────────────────────────────────────');
  console.log('[Password Reset] Link for:', email);
  console.log(resetLink);
  console.log('─────────────────────────────────────');

  return { message: 'If that email exists, a reset link has been sent.' };
}

/* ── Reset Password ── */
/**
 * Verify reset token and set new password.
 *
 * @param {string} rawToken   — the token from the URL (unhashed)
 * @param {string} email
 * @param {string} newPassword
 * @returns {{ message: string }}
 */
async function resetPassword(rawToken, email, newPassword) {
  if (!rawToken || !email || !newPassword) {
    const err = new Error('Token, email, and new password are required.');
    err.statusCode = 400;
    throw err;
  }

  if (newPassword.length < 6) {
    const err = new Error('Password must be at least 6 characters.');
    err.statusCode = 400;
    throw err;
  }

  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  const user = await User.findOne({
    email:                email.toLowerCase(),
    passwordResetToken:   hashedToken,
    passwordResetExpires: { $gt: new Date() }, // not expired
  });

  if (!user) {
    const err = new Error('Reset link is invalid or has expired. Please request a new one.');
    err.statusCode = 400;
    throw err;
  }

  user.password             = newPassword; // hashed by pre-save hook
  user.passwordResetToken   = null;
  user.passwordResetExpires = null;
  await user.save();

  return { message: 'Password has been reset successfully. You can now log in.' };
}

/* ── Usage stats ── */
async function getUsageStats(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');
  if (user.needsMonthlyReset()) {
    user.resetMonthlyUsage();
    await user.save();
  }
  const plan      = user.plan;
  const limit     = getLimitForPlan(plan);
  const used      = user.auditCountThisMonth;
  const unlimited = isUnlimited(plan);
  const remaining = unlimited ? 'unlimited' : Math.max(0, limit - used);
  const percentage = unlimited ? 0 : Math.round((used / limit) * 100);
  return {
    plan,
    used,
    limit:       unlimited ? 'unlimited' : limit,
    remaining,
    percentage,
    resetDate:   getNextResetDate(),
    isUnlimited: unlimited,
  };
}

/* ── Upgrade plan ── */
async function upgradePlan(userId, newPlan) {
  const validPlans = ['free', 'pro', 'premium'];
  if (!validPlans.includes(newPlan)) {
    const err = new Error(`Invalid plan. Must be one of: ${validPlans.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found.'); err.statusCode = 404; throw err;
  }
  const oldPlan              = user.plan;
  user.plan                  = newPlan;
  user.subscriptionStartDate = new Date();
  user.auditCountThisMonth   = 0;
  user.lastAuditResetDate    = new Date();
  await user.save();
  const usage = await getUsageStats(userId);
  return { user: sanitizeUser(user), oldPlan, newPlan, usage };
}

/* ── Get / update profile ── */
async function getUserProfile(userId) {
  const user = await User.findById(userId);
  if (!user) { const err = new Error('User not found.'); err.statusCode = 404; throw err; }
  return sanitizeUser(user);
}

async function updateUserProfile(userId, { name }) {
  const user = await User.findById(userId);
  if (!user) { const err = new Error('User not found.'); err.statusCode = 404; throw err; }
  if (name) user.name = name.trim();
  await user.save();
  return sanitizeUser(user);
}

/* ── Change password (authenticated) ── */
async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+password');
  if (!user) { const err = new Error('User not found.'); err.statusCode = 404; throw err; }
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    const err = new Error('Current password is incorrect.'); err.statusCode = 400; throw err;
  }
  user.password = newPassword;
  await user.save();
  return { message: 'Password changed successfully.' };
}

/* ── Increment audit count ── */
async function incrementAuditCountById(userId) {
  await User.findByIdAndUpdate(userId, { $inc: { auditCountThisMonth: 1 } });
}

/* ── Helpers ── */
function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
}

function getNextResetDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

module.exports = {
  generateToken,
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  getUsageStats,
  upgradePlan,
  getUserProfile,
  updateUserProfile,
  changePassword,
  incrementAuditCountById,
};