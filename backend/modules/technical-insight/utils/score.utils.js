'use strict';
/**
 * score.utils.js — Weighted scoring across all audit dimensions
 */

function calculateScores(data) {
  /* ── Security Score (30% of overall) ── */
  const secScore = Math.max(0, Math.min(100,
    (data.securityHeaders?.score || 0) * 0.6 +
    (data.malware?.safe ? 20 : 0) +
    (data.protocol?.https ? 10 : 0) +
    (data.protocol?.sslValid ? 10 : 0)
  ));

  /* ── Domain Score (20% of overall) ── */
  const domScore = Math.max(0, Math.min(100,
    (data.domain?.da || 20) * 0.8 +
    (data.protocol?.hsts ? 10 : 0) +
    (data.dns?.spf ? 5 : 0) +
    (data.dns?.dmarc ? 5 : 0)
  ));

  /* ── Content / SEO Score (25% of overall) ── */
  const seo     = data.seoContent || {};
  const content = data.content    || {};
  const cntScore = Math.max(0, Math.min(100,
    (seo.title             ? 20 : 0) +
    (seo.metaDescription   ? 15 : 0) +
    (seo.h1?.length === 1  ? 15 : 0) +
    (data.schema?.found    ? 10 : 0) +
    ((content.wordCount    || 0) > 300 ? 15 : 0) +
    (seo.imgWithoutAlt === 0 ? 10 : Math.max(0, 10 - (seo.imgWithoutAlt || 0) * 2)) +
    (seo.canonicalTag      ? 10 : 0) +
    ((content.readabilityScore || 0) > 60 ? 5 : 0)
  ));

  /* ── Technical Score (15% of overall) ── */
  const techScore = Math.max(0, Math.min(100,
    (data.protocol?.https  ? 20 : 0) +
    (data.protocol?.http2  ? 15 : 0) +
    (data.cdn?.detected    ? 15 : 0) +
    (data.jsAnalysis?.renderBlocking < 3 ? 20 : 5) +
    (data.dns?.a?.length   ? 15 : 0) +
    (data.technology?.server ? 5 : 0) +
    ((data.accessibility?.critical || 0) === 0 ? 10 : 0)
  ));

  /* ── Backlinks Score (10% of overall) ── */
  const bl = data.backlinks || {};
  const blScore = Math.max(0, Math.min(100,
    Math.min(40, (bl.total   || 0) / 25) +
    Math.min(30, (bl.referringDomains || 0) / 10) +
    (bl.toxicCount === 0 ? 30 : Math.max(0, 30 - bl.toxicCount * 3))
  ));

  const overall = Math.round(
    secScore  * 0.30 +
    domScore  * 0.20 +
    cntScore  * 0.25 +
    techScore * 0.15 +
    blScore   * 0.10
  );

  return {
    overall,
    security  : Math.round(secScore),
    domain    : Math.round(domScore),
    content   : Math.round(cntScore),
    technical : Math.round(techScore),
    backlinks : Math.round(blScore),
  };
}

function prioritizeIssues(issues) {
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return issues
    .sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3))
    .map((issue, index) => ({ ...issue, priority: index + 1 }));
}

module.exports = { calculateScores, prioritizeIssues };