/**
 * performance/utils/helpers.js
 * Shared helpers for scoring, rating, and data normalisation.
 */

// ── Rating thresholds (Google Web Vitals 2024) ─────────────────────────────────
const THRESHOLDS = {
  lcp:  { good: 2500,  poor: 4000  },  // ms
  fcp:  { good: 1800,  poor: 3000  },  // ms
  tbt:  { good: 200,   poor: 600   },  // ms
  cls:  { good: 0.1,   poor: 0.25  },  // unitless
  si:   { good: 3400,  poor: 5800  },  // ms
  tti:  { good: 3800,  poor: 7300  },  // ms
  ttfb: { good: 800,   poor: 1800  },  // ms
};

/**
 * Returns 'good' | 'needs-improvement' | 'poor' for a given metric value.
 */
function getRating(metric, value) {
  const t = THRESHOLDS[metric];
  if (!t || value === null || value === undefined) return 'unknown';
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Converts a Lighthouse 0-1 score to a 0-100 integer.
 */
function lighthouseScoreTo100(score) {
  if (score === null || score === undefined) return null;
  return Math.round(score * 100);
}

/**
 * Compute overall composite score from available source scores.
 * Weights: PageSpeed mobile 40%, Lighthouse 40%, Puppeteer load 20%
 */
function computeOverallScore({ pagespeedMobile, lighthouse, loadTimeMs }) {
  const scores = [];

  if (pagespeedMobile !== null && pagespeedMobile !== undefined) {
    scores.push({ val: pagespeedMobile, weight: 0.40 });
  }
  if (lighthouse !== null && lighthouse !== undefined) {
    scores.push({ val: lighthouse, weight: 0.40 });
  }
  if (loadTimeMs !== null && loadTimeMs !== undefined) {
    // Map load time: ≤1s → 100, ≥6s → 0
    const loadScore = Math.max(0, Math.min(100, Math.round((1 - (loadTimeMs - 1000) / 5000) * 100)));
    scores.push({ val: loadScore, weight: 0.20 });
  }

  if (!scores.length) return null;

  const totalWeight = scores.reduce((s, x) => s + x.weight, 0);
  const weighted    = scores.reduce((s, x) => s + x.val * x.weight, 0);
  return Math.round(weighted / totalWeight);
}

/**
 * Convert numeric score (0–100) to a letter grade.
 */
function scoreToGrade(score) {
  if (score === null || score === undefined) return null;
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

/**
 * Determine overall site speed category from PageSpeed score.
 */
function speedCategory(score) {
  if (score === null || score === undefined) return 'unknown';
  if (score >= 90) return 'fast';
  if (score >= 50) return 'average';
  return 'slow';
}

/**
 * Format bytes to a human-readable string.
 */
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Collect critical issues from aggregated audit data.
 */
function collectCriticalIssues(data) {
  const issues = [];

  const { pagespeed, lighthouse, puppeteer } = data;

  // PageSpeed mobile
  if (pagespeed?.mobile?.score !== null && pagespeed?.mobile?.score < 50)
    issues.push('Mobile PageSpeed score is critically low (< 50)');

  // LCP
  const lcpRating = pagespeed?.mobile?.lcp?.rating;
  if (lcpRating === 'poor')
    issues.push('Largest Contentful Paint (LCP) is too slow — main content takes too long to render');

  // CLS
  const clsRating = pagespeed?.mobile?.cls?.rating;
  if (clsRating === 'poor')
    issues.push('High Cumulative Layout Shift (CLS) — page layout is visually unstable');

  // TBT / interactivity
  const tbtRating = pagespeed?.mobile?.tbt?.rating;
  if (tbtRating === 'poor')
    issues.push('Total Blocking Time (TBT) is excessive — JavaScript is blocking interactivity');

  // Puppeteer load time
  if (puppeteer?.loadTimeMs && puppeteer.loadTimeMs > 5000)
    issues.push(`Page load time is very slow (${(puppeteer.loadTimeMs / 1000).toFixed(1)}s)`);

  // No cache headers
  if (puppeteer && puppeteer.hasCacheHeaders === false)
    issues.push('Browser caching is not enabled — repeat visits will be unnecessarily slow');

  // Lighthouse opportunities
  if (lighthouse?.opportunities?.length) {
    const big = lighthouse.opportunities.filter(o => o.savings_ms > 500);
    big.forEach(o => issues.push(`Optimization opportunity: ${o.title} (saves ~${o.savings_ms}ms)`));
  }

  return issues;
}

/**
 * Build a list of human-readable recommendations.
 */
function buildRecommendations(data) {
  const recs = [];
  const { pagespeed, puppeteer, lighthouse } = data;

  if (pagespeed?.mobile?.lcp?.rating !== 'good')
    recs.push('Improve LCP: optimise hero images, use a CDN, and defer non-critical resources.');

  if (pagespeed?.mobile?.cls?.rating !== 'good')
    recs.push('Fix CLS: set explicit width/height on images and avoid injecting content above existing page content.');

  if (pagespeed?.mobile?.tbt?.rating !== 'good')
    recs.push('Reduce TBT: split long JavaScript tasks, remove unused JS, and use code splitting.');

  if (puppeteer?.hasCacheHeaders === false)
    recs.push('Enable browser caching (Cache-Control headers) to speed up repeat page loads.');

  if (puppeteer && !puppeteer.hasLazyLoading)
    recs.push('Add lazy loading to off-screen images (`loading="lazy"`) to reduce initial page weight.');

  if (pagespeed?.mobile?.ttfb?.rating !== 'good')
    recs.push('Improve TTFB: upgrade hosting, use a CDN, and enable server-side caching.');

  if (lighthouse?.opportunities?.length)
    recs.push('Review Lighthouse opportunities to find quick wins for performance improvements.');

  return recs;
}

module.exports = {
  getRating,
  lighthouseScoreTo100,
  computeOverallScore,
  scoreToGrade,
  speedCategory,
  formatBytes,
  collectCriticalIssues,
  buildRecommendations
};