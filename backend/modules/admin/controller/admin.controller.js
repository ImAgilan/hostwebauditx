'use strict';
/**
 * Admin Controller — HTTP request handlers
 */

const svc = require('../service/admin.service');

const ok   = (res, data, status = 200) => res.status(status).json({ success: true, ...data });
const fail = (res, err) => {
  const status = err.status || 500;
  console.error(`[Admin Controller] ${err.message}`);
  res.status(status).json({ success: false, message: err.message });
};

/* ── Auth ── */
exports.login = async (req, res) => {
  try {
    const ip        = req.headers['x-forwarded-for'] || req.ip;
    const userAgent = req.headers['user-agent'];
    const data = await svc.login({ ...req.body, ip, userAgent });
    ok(res, data);
  } catch (e) { fail(res, e); }
};

exports.getProfile = async (req, res) => {
  try {
    const admin = await svc.getProfile(req.admin._id);
    ok(res, { admin });
  } catch (e) { fail(res, e); }
};

exports.logout = (req, res) => ok(res, { message: 'Logged out successfully' });

/* ── Dashboard ── */
exports.getDashboardStats = async (req, res) => {
  try {
    const stats = await svc.getDashboardStats();
    ok(res, { stats });
  } catch (e) { fail(res, e); }
};

exports.getRevenueCharts = async (req, res) => {
  try {
    const charts = await svc.getRevenueCharts();
    ok(res, { charts });
  } catch (e) { fail(res, e); }
};

/* ── Users ── */
exports.listUsers = async (req, res) => {
  try {
    const result = await svc.listUsers(req.query);
    ok(res, result);
  } catch (e) { fail(res, e); }
};

exports.getUser = async (req, res) => {
  try {
    const user = await svc.getUserById(req.params.id);
    ok(res, { user });
  } catch (e) { fail(res, e); }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await svc.updateUser(req.params.id, req.body);
    ok(res, { user });
  } catch (e) { fail(res, e); }
};

exports.banUser = async (req, res) => {
  try {
    const user = await svc.banUser(req.params.id, req.body.reason, req.admin._id);
    ok(res, { user });
  } catch (e) { fail(res, e); }
};

exports.unbanUser = async (req, res) => {
  try {
    const user = await svc.unbanUser(req.params.id);
    ok(res, { user });
  } catch (e) { fail(res, e); }
};

exports.deleteUser = async (req, res) => {
  try {
    const result = await svc.deleteUser(req.params.id);
    ok(res, result);
  } catch (e) { fail(res, e); }
};

/* ── Admins (super_admin only) ── */
exports.listAdmins = async (req, res) => {
  try {
    const result = await svc.listAdmins(req.query);
    ok(res, result);
  } catch (e) { fail(res, e); }
};

exports.createAdmin = async (req, res) => {
  try {
    const admin = await svc.createAdmin(req.body, req.admin._id);
    ok(res, { admin }, 201);
  } catch (e) { fail(res, e); }
};

exports.updateAdmin = async (req, res) => {
  try {
    const admin = await svc.updateAdmin(req.params.id, req.body, req.admin._id, req.admin.role);
    ok(res, { admin });
  } catch (e) { fail(res, e); }
};

exports.resetAdminPassword = async (req, res) => {
  try {
    const result = await svc.resetAdminPassword(req.params.id, req.body.newPassword);
    ok(res, result);
  } catch (e) { fail(res, e); }
};

exports.deleteAdmin = async (req, res) => {
  try {
    const result = await svc.deleteAdmin(req.params.id, req.admin._id);
    ok(res, result);
  } catch (e) { fail(res, e); }
};

/* ── Audit History ── */
exports.getAuditHistory = async (req, res) => {
  try {
    const result = await svc.getAuditHistory(req.query);
    ok(res, result);
  } catch (e) { fail(res, e); }
};