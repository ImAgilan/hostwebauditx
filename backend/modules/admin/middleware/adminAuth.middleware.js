'use strict';
/**
 * Admin Auth Middleware
 * Verifies JWT, attaches admin to req.admin
 * requireSuperAdmin — gates routes to super_admin only
 */

const jwt    = require('jsonwebtoken');
const Admin  = require('../model/admin.model');

const JWT_SECRET  = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'admin-secret-change-me';
const JWT_EXPIRES = process.env.ADMIN_JWT_EXPIRES || '8h';

/* ── Token helpers ── */
function signToken (adminId, role) {
  return jwt.sign({ id: adminId, role, type: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken (token) {
  return jwt.verify(token, JWT_SECRET);
}

/* ── Middleware: require any admin ── */
async function requireAdmin (req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token   = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (decoded.type !== 'admin') {
      return res.status(403).json({ success: false, message: 'Invalid token type' });
    }

    const admin = await Admin.findById(decoded.id).select('+password');
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'Admin account disabled or not found' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired, please log in again' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

/* ── Middleware: require super_admin ── */
function requireSuperAdmin (req, res, next) {
  if (!req.admin) return res.status(401).json({ success: false, message: 'Not authenticated' });
  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Super admin access required' });
  }
  next();
}

/* ── Middleware: require specific permission ── */
function requirePermission (perm) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ success: false, message: 'Not authenticated' });

    // super_admin bypasses permission checks
    if (req.admin.role === 'super_admin') return next();

    if (!req.admin.permissions?.[perm]) {
      return res.status(403).json({ success: false, message: `Permission denied: ${perm}` });
    }
    next();
  };
}

module.exports = { signToken, verifyToken, requireAdmin, requireSuperAdmin, requirePermission };