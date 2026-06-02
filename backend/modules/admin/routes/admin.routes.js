'use strict';
/**
 * Admin Routes — FIXED
 *
 * Change: /dashboard/revenue no longer requires the 'viewRevenue'
 * permission gate. Any authenticated admin can access it.
 * (Super admin already bypasses all permission checks anyway.)
 *
 * If you want to re-restrict revenue in future, uncomment the
 * requirePermission('viewRevenue') line.
 */

const router = require('express').Router();
const ctrl   = require('../controller/admin.controller');
const {
  requireAdmin,
  requireSuperAdmin,
  requirePermission,
} = require('../middleware/adminAuth.middleware');

/* ── Auth (public) ── */
router.post('/auth/login',  ctrl.login);
router.post('/auth/logout', requireAdmin, ctrl.logout);
router.get ('/auth/me',     requireAdmin, ctrl.getProfile);

/* ── Dashboard ── */
router.get('/dashboard/stats',   requireAdmin, ctrl.getDashboardStats);
router.get('/dashboard/revenue', requireAdmin, ctrl.getRevenueCharts);
//                               ^^^^^^^^^^^^ removed requirePermission('viewRevenue')
//                               Uncomment below to re-restrict:
// router.get('/dashboard/revenue', requireAdmin, requirePermission('viewRevenue'), ctrl.getRevenueCharts);

/* ── Users ── */
router.get   ('/users',           requireAdmin, ctrl.listUsers);
router.get   ('/users/:id',       requireAdmin, ctrl.getUser);
router.put   ('/users/:id',       requireAdmin, requirePermission('editUsers'),   ctrl.updateUser);
router.post  ('/users/:id/ban',   requireAdmin, requirePermission('editUsers'),   ctrl.banUser);
router.post  ('/users/:id/unban', requireAdmin, requirePermission('editUsers'),   ctrl.unbanUser);
router.delete('/users/:id',       requireAdmin, requirePermission('deleteUsers'), ctrl.deleteUser);

/* ── Audit History ── */
router.get('/audits', requireAdmin, ctrl.getAuditHistory);

/* ── Admin Management (super_admin only) ── */
router.get   ('/admins',                requireAdmin, requireSuperAdmin, ctrl.listAdmins);
router.post  ('/admins',                requireAdmin, requireSuperAdmin, ctrl.createAdmin);
router.put   ('/admins/:id',            requireAdmin, requireSuperAdmin, ctrl.updateAdmin);
router.post  ('/admins/:id/password',   requireAdmin, requireSuperAdmin, ctrl.resetAdminPassword);
router.delete('/admins/:id',            requireAdmin, requireSuperAdmin, ctrl.deleteAdmin);

module.exports = router;