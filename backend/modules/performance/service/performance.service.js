'use strict';
const axios  = require('axios');
const Performance = require('../model/performance.model');

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const RATING = {
  lcp:  v => v <= 2500 ? 'good' : v <= 4000 ? 'needs-improvement' : 'poor',
  cls:  v => v <= 0.1  ? 'good' : v <= 0.25  ? 'needs-improvement' : 'poor',
  fid:  v => v <= 100  ? 'good' : v <= 300   ? 'needs-improvement' : 'poor',
  inp:  v => v <= 200  ? 'good' : v <= 500   ? 'needs-improvement' : 'poor',
  fcp:  v => v <= 1800 ? 'good' : v <= 3000  ? 'needs-improvement' : 'poor',
  ttfb: v => v <= 800  ? 'good' : v <= 1800  ? 'needs-improvement' : 'poor',
  tbt:  v => v <= 200  ? 'good' : v <= 600   ? 'needs-improvement' : 'poor',
  si:   v => v <= 3400 ? 'good' : v <= 5800  ? 'needs-improvement' : 'poor',
  tti:  v => v <= 3800 ? 'good' : v <= 7300  ? 'needs-improvement' : 'poor',
};

function bytes(n) { return typeof n === 'number' ? Math.round(n) : 0; }
function ms(n)    { return typeof n === 'number' ? Math.round(n) : 0; }

/* ─────────────────────────────────────────
   GOOGLE PAGESPEED API
───────────────────────────────────────── */
async function fetchPageSpeed(url, strategy = 'mobile') {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) throw new Error('No PAGESPEED_API_KEY');

  const endpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
  const { data } = await axios.get(endpoint, {
    params: {
      url,
      strategy,
      key,
      category: ['performance', 'accessibility', 'best-practices', 'seo'],
    },
    timeout: 60000,
  });
  return data;
}

/* ─────────────────────────────────────────
   PARSE PAGESPEED RESPONSE
───────────────────────────────────────── */
function parsePageSpeed(data, strategy) {
  const cats   = data.lighthouseResult?.categories  || {};
  const audits = data.lighthouseResult?.audits       || {};
  const lhr    = data.lighthouseResult;

  /* Scores */
  const scores = {
    performance:   Math.round((cats.performance?.score   || 0) * 100),
    accessibility: Math.round((cats.accessibility?.score || 0) * 100),
    bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
    seo:           Math.round((cats.seo?.score || 0) * 100),
  };
  scores.overall = Math.round(
    (scores.performance + scores.accessibility + scores.bestPractices + scores.seo) / 4
  );

  /* Core Web Vitals */
  const metric = (key, unit = 'ms') => {
    const a = audits[key];
    if (!a) return { value: null, rating: 'unknown', unit };
    const v = a.numericValue ?? null;
    return { value: v !== null ? Math.round(v * 10) / 10 : null, rating: RATING[key] ? RATING[key](v) : 'unknown', unit };
  };

  const coreWebVitals = {
    lcp:  metric('largest-contentful-paint'),
    cls:  { ...metric('cumulative-layout-shift', ''), unit: '' },
    fid:  metric('max-potential-fid'),
    inp:  metric('interaction-to-next-paint'),
    fcp:  metric('first-contentful-paint'),
    ttfb: metric('server-response-time'),
    tbt:  metric('total-blocking-time'),
    si:   metric('speed-index'),
    tti:  metric('interactive'),
  };
  if (coreWebVitals.cls.value !== null) {
    coreWebVitals.cls.value = Math.round(coreWebVitals.cls.value * 1000) / 1000;
    coreWebVitals.cls.rating = RATING.cls(coreWebVitals.cls.value);
  }

  /* Page load times */
  const pageLoadMs = lhr?.timing?.total ?? null;

  /* Resources */
  const resources = [];
  const networkItems = audits['network-requests']?.details?.items || [];
  networkItems.forEach(item => {
    const rawLoad = item.endTime - item.startTime;
    resources.push({
      url:            item.url || '',
      type:           item.resourceType || 'other',
      size:           bytes(item.resourceSize),
      transferSize:   bytes(item.transferSize),
      renderBlocking: false,
      loadTime:       isFinite(rawLoad) ? ms(rawLoad) : 0,
    });
  });

  /* Render-blocking */
  const rbItems = audits['render-blocking-resources']?.details?.items || [];
  rbItems.forEach(rb => {
    const match = resources.find(r => r.url === rb.url);
    if (match) match.renderBlocking = true;
    else resources.push({ url: rb.url, type: 'render-blocking', size: 0, transferSize: 0, renderBlocking: true, loadTime: 0 });
  });

  /* Images */
  const images = [];
  const imgItems = audits['uses-optimized-images']?.details?.items || [];
  imgItems.forEach(img => {
    images.push({
      url:              img.url || '',
      originalSize:     bytes(img.totalBytes),
      potentialSavings: bytes(img.wastedBytes),
      hasLazyLoad:      false,
      hasModernFormat:  false,
    });
  });

  /* Lazy loading check */
  const lazyItems = audits['uses-lazy-loading']?.details?.items || [];
  lazyItems.forEach(li => {
    const match = images.find(i => i.url === li.url);
    if (match) match.hasLazyLoad = false;
    else images.push({ url: li.url, originalSize: 0, potentialSavings: 0, hasLazyLoad: false, hasModernFormat: false });
  });

  /* Modern image formats */
  const modernItems = audits['uses-webp-images']?.details?.items || [];
  modernItems.forEach(mi => {
    const match = images.find(i => i.url === mi.url);
    if (match) match.hasModernFormat = false;
  });

  /* Cache headers */
  const cacheHeaders = [];
  const cacheItems = audits['uses-long-cache-ttl']?.details?.items || [];
  cacheItems.forEach(ci => {
    const maxAge = ci.cacheLifetimeMs ? Math.round(ci.cacheLifetimeMs / 1000) : 0;
    cacheHeaders.push({
      url:    ci.url || '',
      maxAge,
      rating: maxAge >= 31536000 ? 'good' : maxAge >= 86400 ? 'fair' : 'poor',
      type:   ci.resourceType || 'other',
    });
  });

  /* Summary */
  const jsRes   = resources.filter(r => r.type === 'Script');
  const cssRes  = resources.filter(r => r.type === 'Stylesheet');
  const imgRes  = resources.filter(r => r.type === 'Image');

  const summary = {
    totalPageSize:       resources.reduce((a, r) => a + r.size, 0),
    totalRequests:       resources.length,
    totalJSSize:         jsRes.reduce((a, r) => a + r.size, 0),
    totalCSSSize:        cssRes.reduce((a, r) => a + r.size, 0),
    totalImageSize:      imgRes.reduce((a, r) => a + r.size, 0),
    renderBlockingCount: resources.filter(r => r.renderBlocking).length,
    imagesWithoutLazy:   lazyItems.length,
    poorCacheCount:      cacheHeaders.filter(c => c.rating === 'poor').length,
    optimizableImages:   imgItems.length,
  };

  /* Issues */
  const issues = buildIssues(audits, scores, coreWebVitals, summary);

  return {
    scores,
    coreWebVitals,
    pageLoad: strategy === 'mobile'
      ? { mobile: pageLoadMs }
      : { desktop: pageLoadMs },
    resources,
    images,
    cacheHeaders,
    summary,
    issues,
    source: 'pagespeed',
  };
}

/* ─────────────────────────────────────────
   BUILD ISSUES LIST
───────────────────────────────────────── */
function buildIssues(audits, scores, cwv, summary) {
  const issues = [];

  const check = (id, title, fn) => {
    try { fn(); } catch (_) {}
  };

  /* Performance score */
  if (scores.performance < 50) {
    issues.push({ id: 'perf-score', title: 'Poor Performance Score', description: `Performance score is ${scores.performance}/100 — significant improvements needed.`, impact: 'high', category: 'performance' });
  } else if (scores.performance < 90) {
    issues.push({ id: 'perf-score', title: 'Performance Needs Improvement', description: `Performance score is ${scores.performance}/100 — some optimisations recommended.`, impact: 'medium', category: 'performance' });
  }

  /* Core Web Vitals */
  const vitals = [
    { key: 'lcp', label: 'Largest Contentful Paint (LCP)', unit: 'ms', threshold: { good: 2500, poor: 4000 } },
    { key: 'cls', label: 'Cumulative Layout Shift (CLS)', unit: '', threshold: { good: 0.1, poor: 0.25 } },
    { key: 'fcp', label: 'First Contentful Paint (FCP)', unit: 'ms', threshold: { good: 1800, poor: 3000 } },
    { key: 'ttfb', label: 'Time to First Byte (TTFB)', unit: 'ms', threshold: { good: 800, poor: 1800 } },
    { key: 'tbt', label: 'Total Blocking Time (TBT)', unit: 'ms', threshold: { good: 200, poor: 600 } },
    { key: 'tti', label: 'Time to Interactive (TTI)', unit: 'ms', threshold: { good: 3800, poor: 7300 } },
    { key: 'si', label: 'Speed Index', unit: 'ms', threshold: { good: 3400, poor: 5800 } },
    { key: 'inp', label: 'Interaction to Next Paint (INP)', unit: 'ms', threshold: { good: 200, poor: 500 } },
  ];

  vitals.forEach(({ key, label, unit, threshold }) => {
    const v = cwv[key];
    if (!v || v.value === null) return;
    if (v.rating === 'poor') {
      issues.push({
        id: `cwv-${key}`,
        title: `${label} is Poor`,
        description: `${label} is ${v.value}${unit}, exceeding the poor threshold of ${threshold.poor}${unit}.`,
        impact: 'high',
        category: 'core-web-vitals',
        value: v.value,
      });
    } else if (v.rating === 'needs-improvement') {
      issues.push({
        id: `cwv-${key}`,
        title: `${label} Needs Improvement`,
        description: `${label} is ${v.value}${unit}, above the good threshold of ${threshold.good}${unit}.`,
        impact: 'medium',
        category: 'core-web-vitals',
        value: v.value,
      });
    }
  });

  /* Render blocking */
  if (summary.renderBlockingCount > 0) {
    issues.push({
      id: 'render-blocking',
      title: 'Render-Blocking Resources Detected',
      description: `${summary.renderBlockingCount} render-blocking resource(s) delay the initial paint of the page.`,
      impact: 'high',
      category: 'performance',
      value: summary.renderBlockingCount,
    });
  }

  /* Lazy loading */
  if (summary.imagesWithoutLazy > 0) {
    issues.push({
      id: 'lazy-load',
      title: 'Images Not Using Lazy Loading',
      description: `${summary.imagesWithoutLazy} image(s) are not using lazy loading, causing unnecessary initial payload.`,
      impact: 'medium',
      category: 'images',
      value: summary.imagesWithoutLazy,
    });
  }

  /* Optimizable images */
  if (summary.optimizableImages > 0) {
    issues.push({
      id: 'image-optimize',
      title: 'Images Can Be Optimised',
      description: `${summary.optimizableImages} image(s) can be compressed, resized, or converted to WebP/AVIF for better performance.`,
      impact: 'medium',
      category: 'images',
      value: summary.optimizableImages,
    });
  }

  /* Cache */
  if (summary.poorCacheCount > 0) {
    issues.push({
      id: 'cache-policy',
      title: 'Inefficient Cache Policy on Static Assets',
      description: `${summary.poorCacheCount} asset(s) have short or missing cache TTL headers, causing unnecessary re-downloads.`,
      impact: 'medium',
      category: 'caching',
      value: summary.poorCacheCount,
    });
  }

  /* JS size */
  const jsMB = summary.totalJSSize / 1024 / 1024;
  if (jsMB > 1) {
    issues.push({
      id: 'js-size',
      title: 'Large JavaScript Payload',
      description: `Total JS size is ${(jsMB).toFixed(2)} MB. Consider code splitting and tree-shaking.`,
      impact: jsMB > 3 ? 'high' : 'medium',
      category: 'performance',
      value: summary.totalJSSize,
    });
  }

  /* Accessibility */
  if (scores.accessibility < 90) {
    issues.push({
      id: 'accessibility',
      title: 'Accessibility Issues Found',
      description: `Accessibility score is ${scores.accessibility}/100. Issues may prevent users with disabilities from accessing your content.`,
      impact: scores.accessibility < 70 ? 'high' : 'medium',
      category: 'accessibility',
    });
  }

  /* Best practices */
  if (scores.bestPractices < 90) {
    issues.push({
      id: 'best-practices',
      title: 'Best Practices Not Followed',
      description: `Best Practices score is ${scores.bestPractices}/100. Review security headers, HTTPS usage, and deprecated APIs.`,
      impact: 'medium',
      category: 'best-practices',
    });
  }

  /* SEO */
  if (scores.seo < 90) {
    issues.push({
      id: 'seo',
      title: 'SEO Improvements Needed',
      description: `SEO score is ${scores.seo}/100. Missing meta tags, structured data, or mobile-friendliness may hurt rankings.`,
      impact: scores.seo < 70 ? 'high' : 'low',
      category: 'seo',
    });
  }

  /* Sort: high → medium → low */
  const order = { high: 0, medium: 1, low: 2, info: 3 };
  return issues.sort((a, b) => (order[a.impact] ?? 9) - (order[b.impact] ?? 9));
}

/* ─────────────────────────────────────────
   MANUAL FALLBACK (no API key)
───────────────────────────────────────── */
async function manualAudit(url) {
  const start = Date.now();
  let ttfb = null;
  let totalMs = null;
  let status = null;
  let contentLength = 0;

  try {
    const resp = await axios.get(url, { timeout: 15000, maxRedirects: 5 });
    ttfb = Date.now() - start;
    totalMs = ttfb;
    status = resp.status;
    contentLength = Buffer.byteLength(resp.data || '', 'utf8');
  } catch (e) {
    ttfb = Date.now() - start;
    totalMs = ttfb;
  }

  const ttfbRating = RATING.ttfb(ttfb);
  const issues = [];

  if (ttfb > 1800) issues.push({ id: 'ttfb-slow', title: 'Slow Server Response (TTFB)', description: `TTFB is ${ttfb}ms — server is responding slowly.`, impact: 'high', category: 'performance' });
  if (contentLength > 500000) issues.push({ id: 'page-size', title: 'Large Page Size', description: `Page HTML is ${(contentLength/1024).toFixed(0)} KB — consider minification.`, impact: 'medium', category: 'performance' });

  return {
    scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0, overall: 0 },
    coreWebVitals: {
      lcp:  { value: null, rating: 'unknown', unit: 'ms' },
      cls:  { value: null, rating: 'unknown', unit: '' },
      fid:  { value: null, rating: 'unknown', unit: 'ms' },
      inp:  { value: null, rating: 'unknown', unit: 'ms' },
      fcp:  { value: null, rating: 'unknown', unit: 'ms' },
      ttfb: { value: ttfb, rating: ttfbRating, unit: 'ms' },
      tbt:  { value: null, rating: 'unknown', unit: 'ms' },
      si:   { value: null, rating: 'unknown', unit: 'ms' },
      tti:  { value: null, rating: 'unknown', unit: 'ms' },
    },
    pageLoad: { mobile: totalMs, desktop: totalMs },
    resources: [],
    images: [],
    cacheHeaders: [],
    summary: {
      totalPageSize: contentLength, totalRequests: 1,
      totalJSSize: 0, totalCSSSize: 0, totalImageSize: 0,
      renderBlockingCount: 0, imagesWithoutLazy: 0, poorCacheCount: 0, optimizableImages: 0,
    },
    issues,
    source: 'manual',
  };
}

/* ─────────────────────────────────────────
   BUILD AI PROMPT (shared across providers)
───────────────────────────────────────── */
function buildAIPrompt(auditData) {
  const { url, scores, coreWebVitals, summary, issues } = auditData;

  const cwvLines = Object.entries(coreWebVitals || {})
    .filter(([, v]) => v && v.value !== null && v.value !== undefined)
    .slice(0, 8)
    .map(([k, v]) => `${k.toUpperCase()}: ${v.value}${v.unit || ''} (${v.rating})`)
    .join(', ');

  const topIssues = (issues || []).slice(0, 8)
    .map(i => `[${(i.impact || '').toUpperCase()}] ${i.title}`)
    .join('\n');

  const s = summary || {};

  return `You are a web performance expert. Write a clear performance report for this website audit.

URL: ${url}
SCORES: Performance ${scores.performance}/100 | Accessibility ${scores.accessibility}/100 | Best Practices ${scores.bestPractices}/100 | SEO ${scores.seo}/100 | Overall ${scores.overall}/100
CORE WEB VITALS: ${cwvLines || 'No data'}
PAGE: ${(s.totalPageSize / 1024 || 0).toFixed(0)}KB total, ${s.totalRequests || 0} requests, JS ${(s.totalJSSize / 1024 || 0).toFixed(0)}KB, CSS ${(s.totalCSSSize / 1024 || 0).toFixed(0)}KB, ${s.renderBlockingCount || 0} render-blocking
TOP ISSUES:
${topIssues || 'None detected'}

Write the report with exactly these sections:

## 🌐 Website Performance Overview
2-3 sentences summarising overall health in plain English.

## ✅ What Is Working Well
3-5 bullet points of positives.

## 🚨 Critical Issues
Explain each HIGH impact issue simply. If none, say "No critical issues found."

## ⚠️ Issues to Address
Explain each MEDIUM impact issue simply. If none, say "No medium issues found."

## 💡 How to Fix Them
Numbered actionable steps for each issue above.

## 📊 Issue Summary Table
| Issue | Category | Impact | Recommendation |
|-------|----------|--------|----------------|
(one row per issue)

## 🎯 Final Score
${scores.overall}/100 — state if Excellent (90+), Good (70-89), Fair (50-69), or Poor (<50) and what it means for the website.

Keep language simple and practical. No unnecessary jargon.`;
}

/* ─────────────────────────────────────────
   AI PROVIDERS — each returns text or throws
───────────────────────────────────────── */

async function tryGroq(prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('No GROQ_API_KEY');
  const { data } = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    { model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 2048 },
    { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, timeout: 60000 }
  );
  return data.choices[0].message.content;
}

async function tryGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('No GEMINI_API_KEY');
  const { data } = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 2048 } },
    { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
  );
  return data.candidates[0].content.parts[0].text;
}

async function tryAnthropic(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('No ANTHROPIC_API_KEY');
  const { data } = await axios.post(
    'https://api.anthropic.com/v1/messages',
    { model: 'claude-3-haiku-20240307', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] },
    { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: 60000 }
  );
  return data.content[0].text;
}

async function tryDeepSeek(prompt) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('No DEEPSEEK_API_KEY');
  const { data } = await axios.post(
    'https://api.deepseek.com/v1/chat/completions',
    { model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 2048 },
    { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, timeout: 60000 }
  );
  return data.choices[0].message.content;
}

/* ─────────────────────────────────────────
   AI REPORT — tries all providers in order
───────────────────────────────────────── */
async function generateAIReport(auditData) {
  const prompt    = buildAIPrompt(auditData);
  const providers = [
    { name: 'Groq',      fn: tryGroq      },
    { name: 'Gemini',    fn: tryGemini    },
    { name: 'Anthropic', fn: tryAnthropic },
    { name: 'DeepSeek',  fn: tryDeepSeek  },
  ];

  const errors = [];

  for (const { name, fn } of providers) {
    try {
      console.log(`[AI] Trying ${name}…`);
      const result = await fn(prompt);
      console.log(`[AI] Success with ${name}`);
      return result;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      console.warn(`[AI] ${name} failed: ${msg}`);
      errors.push(`${name}: ${msg}`);
    }
  }

  throw new Error(`All AI providers failed.\n${errors.join('\n')}`);
}

/* ─────────────────────────────────────────
   MAIN ANALYZE FUNCTION
───────────────────────────────────────── */
async function analyzePerformance(url) {
  let parsedMobile, parsedDesktop;

  try {
    const [mobileData, desktopData] = await Promise.all([
      fetchPageSpeed(url, 'mobile'),
      fetchPageSpeed(url, 'desktop'),
    ]);
    parsedMobile  = parsePageSpeed(mobileData,  'mobile');
    parsedDesktop = parsePageSpeed(desktopData, 'desktop');
  } catch (err) {
    console.warn('[Performance] PageSpeed API failed, using manual fallback:', err.message);
    parsedMobile  = await manualAudit(url);
    parsedDesktop = parsedMobile;
  }

  /* Merge desktop/mobile data */
  const merged = {
    ...parsedMobile,
    pageLoad: {
      mobile:  parsedMobile.pageLoad?.mobile  ?? null,
      desktop: parsedDesktop.pageLoad?.desktop ?? null,
    },
  };

  /* Always save as a new document — never overwrite previous audits */
  const doc = await Performance.create({
    url,
    ...merged,
    fetchedAt: new Date(),
  });

  return doc;
}

/* ─────────────────────────────────────────
   GENERATE & SAVE AI REPORT
───────────────────────────────────────── */
async function generateAndSaveReport(id) {
  const doc = await Performance.findById(id);
  if (!doc) throw new Error('Audit not found');

  const report = await generateAIReport(doc.toObject());

  doc.aiReport      = report;
  doc.aiGeneratedAt = new Date();
  await doc.save();

  return doc;
}

/* ─────────────────────────────────────────
   PDF GENERATION
───────────────────────────────────────── */
async function generatePDF(id) {
  const PDFDocument = require('pdfkit');
  const doc = await Performance.findById(id);
  if (!doc) throw new Error('Audit not found');

  return new Promise((resolve, reject) => {
    const pdf  = new PDFDocument({ margin: 50, size: 'A4' });
    const bufs = [];
    pdf.on('data', d => bufs.push(d));
    pdf.on('end',  () => resolve(Buffer.concat(bufs)));
    pdf.on('error', reject);

    const H1 = 20, H2 = 15, H3 = 12, BODY = 10;
    const BLUE = '#1a73e8', DARK = '#1a1a2e', GRAY = '#555';

    /* Header */
    pdf.rect(0, 0, 595, 80).fill(DARK);
    pdf.fillColor('#fff').fontSize(H1).font('Helvetica-Bold')
      .text('WebAuditX — Performance Report', 50, 25);
    pdf.fontSize(BODY).font('Helvetica').fillColor('#aaa')
      .text(`Generated: ${new Date().toLocaleString()}`, 50, 55);

    pdf.moveDown(2).fillColor(DARK);

    /* URL */
    pdf.fontSize(H3).font('Helvetica-Bold').fillColor(BLUE)
      .text('Audited URL:', 50, 100);
    pdf.fontSize(BODY).font('Helvetica').fillColor(GRAY)
      .text(doc.url, 50, 118);

    /* Scores */
    pdf.moveDown(1.5).fontSize(H2).font('Helvetica-Bold').fillColor(DARK)
      .text('Lighthouse Scores');
    pdf.moveDown(0.3);
    const scoreEntries = [
      ['Performance',    doc.scores.performance],
      ['Accessibility',  doc.scores.accessibility],
      ['Best Practices', doc.scores.bestPractices],
      ['SEO',            doc.scores.seo],
      ['Overall',        doc.scores.overall],
    ];
    scoreEntries.forEach(([label, val]) => {
      const color = val >= 90 ? '#0f9d58' : val >= 50 ? '#f4b400' : '#d93025';
      pdf.fontSize(BODY).font('Helvetica').fillColor(DARK)
        .text(`${label}: `, { continued: true })
        .fillColor(color).font('Helvetica-Bold')
        .text(`${val}/100`);
    });

    /* Core Web Vitals */
    pdf.moveDown(1).fontSize(H2).font('Helvetica-Bold').fillColor(DARK)
      .text('Core Web Vitals');
    pdf.moveDown(0.3);
    const cwvEntries = Object.entries(doc.coreWebVitals).filter(([, v]) => v && v.value !== null);
    cwvEntries.forEach(([key, v]) => {
      const rColor = v.rating === 'good' ? '#0f9d58' : v.rating === 'needs-improvement' ? '#f4b400' : '#d93025';
      pdf.fontSize(BODY).font('Helvetica').fillColor(DARK)
        .text(`${key.toUpperCase()}: `, { continued: true })
        .fillColor(rColor).text(`${v.value}${v.unit} — ${v.rating}`);
    });

    /* Summary */
    pdf.moveDown(1).fontSize(H2).font('Helvetica-Bold').fillColor(DARK)
      .text('Page Summary');
    pdf.moveDown(0.3);
    const s = doc.summary;
    [
      ['Total Page Size', `${(s.totalPageSize/1024).toFixed(0)} KB`],
      ['Total Requests',  s.totalRequests],
      ['JS Bundle Size',  `${(s.totalJSSize/1024).toFixed(0)} KB`],
      ['CSS Size',        `${(s.totalCSSSize/1024).toFixed(0)} KB`],
      ['Render-Blocking', s.renderBlockingCount],
      ['Images w/o Lazy', s.imagesWithoutLazy],
      ['Poor Cache Assets', s.poorCacheCount],
    ].forEach(([k, v]) => {
      pdf.fontSize(BODY).font('Helvetica').fillColor(DARK)
        .text(`${k}: `, { continued: true }).fillColor(GRAY).text(String(v));
    });

    /* Issues */
    if (doc.issues.length > 0) {
      pdf.addPage();
      pdf.fontSize(H2).font('Helvetica-Bold').fillColor(DARK).text('Detected Issues');
      pdf.moveDown(0.5);
      doc.issues.forEach((issue, idx) => {
        const iColor = issue.impact === 'high' ? '#d93025' : issue.impact === 'medium' ? '#f4b400' : '#0f9d58';
        pdf.fontSize(H3).font('Helvetica-Bold').fillColor(iColor)
          .text(`${idx + 1}. [${issue.impact.toUpperCase()}] ${issue.title}`);
        pdf.fontSize(BODY).font('Helvetica').fillColor(GRAY)
          .text(issue.description);
        pdf.moveDown(0.5);
      });
    }

    /* AI Report */
    if (doc.aiReport) {
      pdf.addPage();
      pdf.fontSize(H2).font('Helvetica-Bold').fillColor(DARK).text('AI-Generated Insights');
      pdf.moveDown(0.5);
      const clean = doc.aiReport.replace(/[#*`]/g, '').trim();
      pdf.fontSize(BODY).font('Helvetica').fillColor(GRAY).text(clean, { lineGap: 4 });
    }

    pdf.end();
  });
}

module.exports = { analyzePerformance, generateAndSaveReport, generatePDF };