require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');

// ── Database ──────────────────────────────────────────────────────────────────
const { connectDB } = require('./modules/technical-insight/config/db');

// ── Routes ────────────────────────────────────────────────────────────────────
const accessibilityRoutes = require('./modules/accessibility/routes/accessibilityRoutes');
const mobileRoutes        = require('./modules/mobile-friendliness/routes/mobileRoutes');
const uiRoutes            = require('./modules/ui/routes/analyze');
const structureNavRoutes  = require('./modules/structure-navigation/routes/auditRoutes'); // ★ MERGED
const performanceRoutes = require('./modules/performance/routes/performance.routes');
const seoRoutes = require('./modules/seo/routes/seo.routes');
const securityRoutes = require('./modules/security/routes/security.routes');
const socialProofRoutes = require('./modules/social-proof/routes/socialproof.routes');



const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ──────────────────────────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
}));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/v1/audit',         require('./modules/technical-insight/routes/auditRoutes'));
app.use('/api/v1/accessibility', accessibilityRoutes);
app.use('/api/v1/mobile',        mobileRoutes);
app.use('/api/v1/ui',            uiRoutes);
app.use('/api/audit',            structureNavRoutes); // ★ MERGED
app.use('/api/v1/performance', performanceRoutes);
app.use('/api/v1/seo', seoRoutes);
app.use('/api/v1/security-audit', securityRoutes);
app.use('/api/v1/social-proof', socialProofRoutes);


// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/api/v1/health', async (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status:       'ok',
    database:     mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime_sec:   Math.floor(process.uptime()),
    node_version: process.version,
    timestamp:    new Date().toISOString(),
    version:      '1.0.0',
    api_keys: {
      pagespeed:            !!process.env.PAGESPEED_API_KEY,
      google_mobile_test:   !!process.env.GOOGLE_MOBILE_FRIENDLY_API_KEY,
      safe_browsing:        !!process.env.GOOGLE_SAFE_BROWSING_KEY,
      moz:                  !!process.env.MOZ_ACCESS_ID,
      ahrefs:               !!process.env.AHREFS_API_KEY,
      wappalyzer:           !!process.env.WAPPALYZER_API_KEY,
      openai:               !!process.env.OPENAI_API_KEY,
    }
  });
});

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

// ── Global Error Handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ── Connect DB → Start Server ──────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀  Web Audit X  →  http://localhost:${PORT}`);
    console.log(`    Health check →  http://localhost:${PORT}/api/v1/health\n`);
  });
}).catch(err => {
  console.error('❌ Failed to start:', err.message);
  process.exit(1);
});

module.exports = app;