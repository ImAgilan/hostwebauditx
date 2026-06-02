'use strict';
/**
 * server.js — WebAuditX Backend Entry Point
 *
 * npm install express mongoose cors dotenv axios cheerio pdfkit
 */

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const mongoose  = require('mongoose');

const app  = express();
const PORT = process.env.PORT || 5000;

/* ── Middleware ── */
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ── DB ── */
mongoose
  .connect(process.env.MONGO_URI, { dbName: 'WebAuditX' })
  .then(async () => {
    console.log('[DB] MongoDB connected');
 
    // ✅ AUTO-SEED super admin on first start
    const { seedSuperAdmin } = require('./modules/admin/service/admin.service');
    await seedSuperAdmin();
  })
  .catch(err => { console.error('[DB] Connection failed:', err.message); process.exit(1); });

/* ── Routes ── */
const uiAnalysisRoutes         = require('./modules/ui-analysis/routes/uiAnalysis.routes');
const mobileFriendlinessRoutes = require('./modules/mobile-friendliness/routes/mobileFriendliness.routes');
const accessibilityRoutes      = require('./modules/accessibility/routes/accessibility.routes');
const seoRoutes      = require('./modules/seo/routes/seo.routes');
const performanceRoutes = require('./modules/performance/routes/performance.routes');
const securityRoutes = require('./modules/security/routes/security.routes');
const contentQualityRoutes = require('./modules/content-quality/routes/contentQuality.routes');
const structureNavigationRoutes   = require('./modules/structure-navigation/routes/structureNavigation.routes');
const technicalInsightRoutes   = require('./modules/technical-insight/routes/technicalInsight.routes');


const fullAuditRoutes = require('./modules/full-audit/routes/fullAudit.routes');

const authRoutes         = require('./modules/subscription/routes/subscription.routes');

const auditHistoryRoutes = require('./modules/audit-history/routes/auditHistory.routes');




const adminRoutes = require('./modules/admin/routes/admin.routes');


const chatbotRoutes = require('./modules/chatbot/routes/chatbot.routes');

app.use('/api/ui-analysis',         uiAnalysisRoutes);
app.use('/api/mobile-friendliness', mobileFriendlinessRoutes);
app.use('/api/accessibility',       accessibilityRoutes);
app.use('/api/seo',                 seoRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/content-quality', contentQualityRoutes);
app.use('/api/structure-navigation',  structureNavigationRoutes);
app.use('/api/technical-insight',   technicalInsightRoutes);

app.use('/api/full-audit', fullAuditRoutes);



app.use('/api/auth',         authRoutes);
app.use('/api/subscription', authRoutes);  // same router, shared
app.use('/api/audit-history', auditHistoryRoutes);
// Add other modules here as they are built:
// app.use('/api/seo',          require('./modules/seo/routes/seo.routes'));
// app.use('/api/performance',  require('./modules/performance/routes/performance.routes'));
// ...
app.use('/api/chatbot', chatbotRoutes);




app.use('/api/admin', adminRoutes);











/* ── Health check ── */
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

/* ── Global error handler ── */
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`[Server] Running on port ${PORT}`));

module.exports = app;