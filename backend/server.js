'use strict';
/**
 * server.js — WebAuditX Backend Entry Point (Production Ready)
 */

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const app  = express();
const PORT = process.env.PORT || 5000; // Render/Railway injects PORT automatically

/* ── CORS — supports multiple allowed origins ── */
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,   // e.g. https://webauditx.vercel.app
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow Postman / server-to-server
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn('[CORS] Blocked origin:', origin);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ── DB ── */
mongoose
  .connect(process.env.MONGO_URI, { dbName: 'WebAuditX' })
  .then(async () => {
    console.log('[DB] MongoDB connected');
    // Auto-seed super admin on first start
    const { seedSuperAdmin } = require('./modules/admin/service/admin.service');
    await seedSuperAdmin();
  })
  .catch(err => { console.error('[DB] Connection failed:', err.message); process.exit(1); });

/* ── Routes ── */
const uiAnalysisRoutes          = require('./modules/ui-analysis/routes/uiAnalysis.routes');
const mobileFriendlinessRoutes  = require('./modules/mobile-friendliness/routes/mobileFriendliness.routes');
const accessibilityRoutes       = require('./modules/accessibility/routes/accessibility.routes');
const seoRoutes                 = require('./modules/seo/routes/seo.routes');
const performanceRoutes         = require('./modules/performance/routes/performance.routes');
const securityRoutes            = require('./modules/security/routes/security.routes');
const contentQualityRoutes      = require('./modules/content-quality/routes/contentQuality.routes');
const structureNavigationRoutes = require('./modules/structure-navigation/routes/structureNavigation.routes');
const technicalInsightRoutes    = require('./modules/technical-insight/routes/technicalInsight.routes');
const fullAuditRoutes           = require('./modules/full-audit/routes/fullAudit.routes');
const authRoutes                = require('./modules/subscription/routes/subscription.routes');
const auditHistoryRoutes        = require('./modules/audit-history/routes/auditHistory.routes');
const adminRoutes               = require('./modules/admin/routes/admin.routes');
const chatbotRoutes             = require('./modules/chatbot/routes/chatbot.routes');

app.use('/api/ui-analysis',          uiAnalysisRoutes);
app.use('/api/mobile-friendliness',  mobileFriendlinessRoutes);
app.use('/api/accessibility',        accessibilityRoutes);
app.use('/api/seo',                  seoRoutes);
app.use('/api/performance',          performanceRoutes);
app.use('/api/security',             securityRoutes);
app.use('/api/content-quality',      contentQualityRoutes);
app.use('/api/structure-navigation', structureNavigationRoutes);
app.use('/api/technical-insight',    technicalInsightRoutes);
app.use('/api/full-audit',           fullAuditRoutes);
app.use('/api/auth',                 authRoutes);
app.use('/api/subscription',         authRoutes); // same router, shared
app.use('/api/audit-history',        auditHistoryRoutes);
app.use('/api/chatbot',              chatbotRoutes);
app.use('/api/admin',                adminRoutes);

/* ── Health check — Render uses this to verify app is alive ── */
app.get('/api/health', (_, res) => res.json({
  status: 'ok',
  environment: process.env.NODE_ENV || 'development',
  timestamp: new Date().toISOString(),
}));

/* ── Root route — shows API is running ── */
app.get('/', (_, res) => res.json({ message: 'WebAuditX API is running.' }));

/* ── Global error handler ── */
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => console.log(`[Server] Running on port ${PORT}`));

module.exports = app;