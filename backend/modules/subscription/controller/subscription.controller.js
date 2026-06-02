'use strict';

const subscriptionService = require('../service/subscription.service');

/* ── Register ── */
async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    const result = await subscriptionService.registerUser({ name, email, password });
    return res.status(201).json({ success: true, message: 'Account created successfully.', data: result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/* ── Login ── */
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });
    const result = await subscriptionService.loginUser({ email, password });
    return res.status(200).json({ success: true, message: 'Logged in successfully.', data: result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/* ── Forgot Password ── */
/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Always returns 200 — never reveals if email exists.
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });
    const result = await subscriptionService.forgotPassword(email);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}

/* ── Reset Password ── */
/**
 * POST /api/auth/reset-password
 * Body: { token, email, newPassword }
 */
async function resetPassword(req, res) {
  try {
    const { token, email, newPassword } = req.body;
    const result = await subscriptionService.resetPassword(token, email, newPassword);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/* ── Get me ── */
async function getMe(req, res) {
  try {
    const user  = await subscriptionService.getUserProfile(req.user._id);
    const usage = await subscriptionService.getUsageStats(req.user._id);
    return res.status(200).json({ success: true, data: { user, usage } });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/* ── Update me ── */
async function updateMe(req, res) {
  try {
    const user = await subscriptionService.updateUserProfile(req.user._id, req.body);
    return res.status(200).json({ success: true, message: 'Profile updated.', data: { user } });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/* ── Change password (authenticated) ── */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required.' });
    const result = await subscriptionService.changePassword(req.user._id, currentPassword, newPassword);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/* ── Usage ── */
async function getUsage(req, res) {
  try {
    const usage = await subscriptionService.getUsageStats(req.user._id);
    return res.status(200).json({ success: true, data: usage });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/* ── Upgrade plan ── */
async function upgradePlan(req, res) {
  try {
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ success: false, message: 'Plan is required.' });
    const result = await subscriptionService.upgradePlan(req.user._id, plan);
    return res.status(200).json({ success: true, message: `Plan changed to "${plan}".`, data: result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/* ── Plans list (public) ── */
async function getPlans(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      plans: [
        { id: 'free',    name: 'Starter',       price: 0,  auditLimit: 15,          features: ['15 audits/month', 'All 9 modules', 'Basic AI report', 'PDF export'] },
        { id: 'pro',     name: 'Professional',  price: 29, auditLimit: 100,         features: ['100 audits/month', 'Full AI report', 'Scheduled monitoring', 'White-label PDF'] },
        { id: 'premium', name: 'Agency',        price: 89, auditLimit: 'unlimited', features: ['Unlimited audits', 'Client portals', 'Custom API', 'Priority support'] },
      ],
    },
  });
}

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  changePassword,
  getUsage,
  upgradePlan,
  getPlans,
};