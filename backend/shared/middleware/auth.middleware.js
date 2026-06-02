'use strict';

/**
 * auth.middleware.js
 * Verifies JWT token and attaches req.user
 */

const jwt  = require('jsonwebtoken');
const User = require('../../modules/subscription/model/user.model');

/**
 * requireAuth
 * Middleware — protects routes that require a logged-in user.
 * Attaches full user document to req.user (without password).
 */
async function requireAuth(req, res, next) {
  try {
    /* ── 1. Extract token ── */
    let token = null;

    // Check Authorization header: "Bearer <token>"
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    // Fallback: check cookie (if using httpOnly cookies)
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        code:    'NO_TOKEN',
        message: 'Authentication required. Please log in.',
      });
    }

    /* ── 2. Verify token ── */
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const code    = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
      const message = err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please log in again.'
        : 'Invalid authentication token.';
      return res.status(401).json({ success: false, code, message });
    }

    /* ── 3. Load user from DB ── */
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        code:    'USER_NOT_FOUND',
        message: 'User account not found.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code:    'ACCOUNT_DISABLED',
        message: 'Your account has been disabled. Contact support.',
      });
    }

    /* ── 4. Attach to request ── */
    req.user = user;
    next();

  } catch (err) {
    console.error('[Auth Middleware] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.',
    });
  }
}

/**
 * requireAdmin
 * Must be used AFTER requireAuth.
 * Blocks non-admin users.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      code:    'FORBIDDEN',
      message: 'Admin access required.',
    });
  }
  next();
}

/**
 * optionalAuth
 * Does NOT block the request if no token.
 * Silently attaches req.user if valid token found.
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.slice(7).trim();
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password');
    if (user && user.isActive) req.user = user;
    next();
  } catch {
    // Ignore errors — just proceed without user
    next();
  }
}

module.exports = { requireAuth, requireAdmin, optionalAuth };