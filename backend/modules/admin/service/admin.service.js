'use strict';
/**
 * admin.service.js — FIXED
 *
 * Root cause of empty Users + $0 Revenue:
 *   OLD: used AppUser model → reads "appusers" collection → EMPTY
 *   FIX: uses real User model → reads "users" collection → your actual users
 *
 * Field name fixes:
 *   plan             (not "subscription")
 *   auditCountThisMonth (not "totalAuditsEver")
 *   isActive: false  (not "isBanned" — your model has no isBanned)
 */

const Admin = require('../model/admin.model');

// ✅ Use the REAL User model — not AppUser
const User  = require('../../subscription/model/user.model');

const { signToken } = require('../middleware/adminAuth.middleware');

/* ── Pricing map — matches your 3 plans exactly ── */
const PLAN_PRICING = { free: 0, pro: 29, premium: 89 };
const PLAN_LABELS  = { free: 'Starter', pro: 'Professional', premium: 'Agency' };
const VALID_PLANS  = ['free', 'pro', 'premium'];

/* ══════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════ */
async function login ({ username, password, ip, userAgent }) {
  const admin = await Admin.findOne({
    $or: [{ username }, { email: username }],
    isActive: true,
  }).select('+password');

  if (!admin) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const valid = await admin.comparePassword(password);
  if (!valid) {
    await admin.recordLogin(ip, userAgent, false);
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  await admin.recordLogin(ip, userAgent, true);
  const token = signToken(admin._id, admin.role);
  return { token, admin: admin.toJSON() };
}

async function getProfile (adminId) {
  return Admin.findById(adminId).populate('createdBy', 'username fullName');
}

/* ══════════════════════════════════════════════
   DASHBOARD STATS
   Reads from "users" collection via User model
══════════════════════════════════════════════ */
async function getDashboardStats () {
  const now      = new Date();
  const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo  = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1);

  /* ── User counts from real "users" collection ── */
  const [
    totalUsers,
    activeUsers,
    disabledUsers,
    newUsersToday,
    newUsersWeek,
    newUsersMonth,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ isActive: false }),
    User.countDocuments({ createdAt: { $gte: today } }),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
    User.countDocuments({ createdAt: { $gte: monthAgo } }),
  ]);

  /* ── Plan breakdown — group by "plan" field ── */
  const planAgg = await User.aggregate([
    {
      $group: {
        _id:   '$plan',          // ← "plan" not "subscription"
        count: { $sum: 1 },
      },
    },
  ]);

  const plans = { free: 0, pro: 0, premium: 0 };
  planAgg.forEach(p => {
    if (plans[p._id] !== undefined) plans[p._id] = p.count;
  });

  /* ── MRR calculation ── */
  const mrr = (plans.pro * PLAN_PRICING.pro) + (plans.premium * PLAN_PRICING.premium);
  const arr  = mrr * 12;
  const paidUsers = plans.pro + plans.premium;
  const avgRpu = paidUsers > 0 ? (mrr / paidUsers).toFixed(2) : '0.00';

  /* ── Audit counts across all module collections ── */
  const mongoose = require('mongoose');
  const auditCollections = [
    'uianalyses', 'mobilefriendlinesses', 'accessibilities',
    'seoanalyses', 'performanceanalyses', 'securityanalyses',
    'contentqualities', 'structurenavigations', 'fullaudits',
  ];

  let totalAudits = 0, auditsToday = 0, auditsWeek = 0, auditsMonth = 0;

  await Promise.all(
    auditCollections.map(async (col) => {
      try {
        const db = mongoose.connection.db;
        const [total, tod, wk, mo] = await Promise.all([
          db.collection(col).countDocuments({}),
          db.collection(col).countDocuments({ createdAt: { $gte: today    } }),
          db.collection(col).countDocuments({ createdAt: { $gte: weekAgo  } }),
          db.collection(col).countDocuments({ createdAt: { $gte: monthAgo } }),
        ]);
        totalAudits += total;
        auditsToday += tod;
        auditsWeek  += wk;
        auditsMonth += mo;
      } catch (_) { /* collection may not exist yet */ }
    })
  );

  /* ── Admin stats ── */
  const [totalAdmins, activeAdmins, superAdmins] = await Promise.all([
    Admin.countDocuments({}),
    Admin.countDocuments({ isActive: true }),
    Admin.countDocuments({ role: 'super_admin' }),
  ]);

  return {
    users: {
      total:        totalUsers,
      active:       activeUsers,
      banned:       disabledUsers,   // "banned" key kept so frontend doesn't break
      disabled:     disabledUsers,
      newToday:     newUsersToday,
      newThisWeek:  newUsersWeek,
      newThisMonth: newUsersMonth,
      paid:         paidUsers,
      subscriptions: plans,          // { free, pro, premium }
    },
    audits: {
      total:     totalAudits,
      today:     auditsToday,
      thisWeek:  auditsWeek,
      thisMonth: auditsMonth,
    },
    revenue: {
      mrr,
      arr,
      avgRevenuePerUser: avgRpu,
    },
    admins: {
      total:       totalAdmins,
      active:      activeAdmins,
      superAdmins,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function getRevenueCharts () {
  /* ── Monthly user growth ── */
  const since = new Date();
  since.setMonth(since.getMonth() - 12);

  const userGrowth = await User.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          year:  { $year:  '$createdAt' },
          month: { $month: '$createdAt' },
        },
        newUsers:  { $sum: 1 },
        paidUsers: {
          $sum: { $cond: [{ $ne: ['$plan', 'free'] }, 1, 0] },
        },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  return { userGrowth, revenueByMonth: [] };
}

/* ══════════════════════════════════════════════
   USER MANAGEMENT
   All queries now use "plan" and correct fields
══════════════════════════════════════════════ */
async function listUsers ({ page = 1, limit = 20, search, subscription, status, sortBy = 'createdAt', sortDir = -1 }) {
  const query = {};

  if (search) {
    query.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  /* "subscription" param from frontend maps to "plan" field */
  if (subscription && subscription !== 'all') {
    query.plan = subscription;
  }

  if (status === 'active')   query.isActive = true;
  if (status === 'inactive') query.isActive = false;
  // Note: no "banned" in real model — isActive:false covers it

  const skip  = (page - 1) * limit;
  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .sort({ [sortBy]: sortDir })
    .skip(skip)
    .limit(Number(limit))
    .select('-password -passwordResetToken -passwordResetExpires -__v')
    .lean();

  /* Normalise fields so frontend works without changes */
  const normalised = users.map(u => ({
    ...u,
    subscription:    u.plan,          // alias for frontend
    isBanned:        !u.isActive,     // alias for frontend ban badge
    totalAuditsEver: u.auditCountThisMonth || 0, // best proxy we have
  }));

  return {
    users: normalised,
    pagination: {
      page:  Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

async function getUserById (id) {
  const user = await User.findById(id).select('-password -passwordResetToken -passwordResetExpires');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

async function updateUser (id, updates) {
  /* Map "subscription" → "plan" if frontend sends subscription */
  const clean = {};
  if (updates.name)         clean.name    = updates.name;
  if (updates.subscription) clean.plan    = updates.subscription;
  if (updates.plan)         clean.plan    = updates.plan;
  if (typeof updates.isActive === 'boolean') clean.isActive = updates.isActive;

  if (clean.plan && !VALID_PLANS.includes(clean.plan)) {
    throw Object.assign(new Error(`Invalid plan. Must be: ${VALID_PLANS.join(', ')}`), { status: 400 });
  }

  const user = await User.findByIdAndUpdate(id, clean, { new: true, runValidators: true })
    .select('-password -passwordResetToken -passwordResetExpires');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

async function banUser (id, reason) {
  /* Your model has no isBanned — we disable the account via isActive:false */
  const user = await User.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  ).select('-password');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

async function unbanUser (id) {
  const user = await User.findByIdAndUpdate(
    id,
    { isActive: true },
    { new: true }
  ).select('-password');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

async function deleteUser (id) {
  const user = await User.findByIdAndDelete(id);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return { deleted: true };
}

/* ══════════════════════════════════════════════
   ADMIN MANAGEMENT (super_admin only)
══════════════════════════════════════════════ */
async function listAdmins ({ page = 1, limit = 20, role, search }) {
  const query = {};
  if (role && role !== 'all') query.role = role;
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email:    { $regex: search, $options: 'i' } },
      { fullName: { $regex: search, $options: 'i' } },
    ];
  }
  const skip  = (page - 1) * limit;
  const total = await Admin.countDocuments(query);
  const admins = await Admin.find(query)
    .populate('createdBy', 'username fullName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return {
    admins,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
  };
}

async function createAdmin (data, createdById) {
  const existing = await Admin.findOne({
    $or: [{ email: data.email }, { username: data.username }],
  });
  if (existing) throw Object.assign(new Error('Username or email already in use'), { status: 409 });
  return Admin.create({ ...data, createdBy: createdById });
}

async function updateAdmin (id, updates, requestingAdminId, requestingAdminRole) {
  const target = await Admin.findById(id);
  if (!target) throw Object.assign(new Error('Admin not found'), { status: 404 });

  if (target.role === 'super_admin' && requestingAdminRole !== 'super_admin') {
    throw Object.assign(new Error('Cannot modify a super admin'), { status: 403 });
  }
  if (
    id.toString() === requestingAdminId.toString() &&
    updates.role && updates.role !== 'super_admin' &&
    requestingAdminRole === 'super_admin'
  ) {
    throw Object.assign(new Error('Cannot demote yourself'), { status: 400 });
  }

  const allowed = ['fullName', 'role', 'isActive', 'permissions'];
  allowed.forEach(k => { if (updates[k] !== undefined) target[k] = updates[k]; });
  await target.save();
  return target;
}

async function resetAdminPassword (id, newPassword) {
  const admin = await Admin.findById(id);
  if (!admin) throw Object.assign(new Error('Admin not found'), { status: 404 });
  admin.password = newPassword;
  await admin.save();
  return { success: true };
}

async function deleteAdmin (id, requestingAdminId) {
  if (id.toString() === requestingAdminId.toString()) {
    throw Object.assign(new Error('Cannot delete yourself'), { status: 400 });
  }
  const admin = await Admin.findByIdAndDelete(id);
  if (!admin) throw Object.assign(new Error('Admin not found'), { status: 404 });
  return { deleted: true };
}

/* ══════════════════════════════════════════════
   AUDIT HISTORY
══════════════════════════════════════════════ */
async function getAuditHistory ({ page = 1, limit = 20, module: mod, search, dateFrom, dateTo }) {
  const mongoose = require('mongoose');
  const db = mongoose.connection.db;

  const MODULE_MAP = {
    ui:            'ui_analysis_reports',
    mobile:        'mobile_friendliness_reports',
    accessibility: 'accessibilities',
    seo:           'seoanalyses',
    performance:   'performanceanalyses',
    security:      'securityanalyses',
    content:       'contentqualities',
    structure:     'structurenavigations',
    full:          'fullaudits',
  };

  const collections = mod && mod !== 'all'
    ? [MODULE_MAP[mod]].filter(Boolean)
    : Object.values(MODULE_MAP);

  const dateFilter = {};
  if (dateFrom) dateFilter.$gte = new Date(dateFrom);
  if (dateTo)   dateFilter.$lte = new Date(dateTo);

  const all = [];

  await Promise.all(
    collections.map(async (col) => {
      try {
        const filter = {};
        if (Object.keys(dateFilter).length) filter.createdAt = dateFilter;
        if (search) filter.url = { $regex: search, $options: 'i' };

        const docs = await db.collection(col).find(filter)
          .sort({ createdAt: -1 })
          .limit(200)
          .toArray();

        docs.forEach(d => all.push({ ...d, _module: col }));
      } catch (_) {}
    })
  );

  all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = all.length;
  const start = (page - 1) * limit;
  const items = all.slice(start, start + Number(limit));

  return {
    audits: items,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
  };
}

/* ══════════════════════════════════════════════
   SEED SUPER ADMIN
══════════════════════════════════════════════ */
async function seedSuperAdmin () {
  const count = await Admin.countDocuments({ role: 'super_admin' });
  if (count > 0) return;

  await Admin.create({
    username: 'superadmin',
    email:    process.env.SUPER_ADMIN_EMAIL    || 'superadmin@webauditx.com',
    password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@2025!',
    fullName: 'Super Administrator',
    role:     'super_admin',
  });

  console.log('[Admin] Default super admin created');
}

module.exports = {
  login, getProfile,
  getDashboardStats, getRevenueCharts,
  listUsers, getUserById, updateUser, banUser, unbanUser, deleteUser,
  listAdmins, createAdmin, updateAdmin, resetAdminPassword, deleteAdmin,
  getAuditHistory,
  seedSuperAdmin,
};