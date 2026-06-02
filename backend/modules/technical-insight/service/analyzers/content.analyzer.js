'use strict';
/**
 * content.analyzer.js
 * Content quality, readability, keyword density, schema, JS dependency, accessibility
 */

const axios   = require('axios');
const cheerio = require('cheerio');

/* ═══════════════════════════════════════
   1. CONTENT QUALITY ANALYSIS
═══════════════════════════════════════ */
async function analyzeContent(targetUrl) {
  const result = {
    wordCount: 0, charCount: 0, paragraphCount: 0,
    readabilityScore: 0, readabilityGrade: null,
    uniqueContentRatio: 100, duplicateBlocks: [],
    issues: [],
  };

  try {
    const res = await axios.get(targetUrl, { timeout: 12000, maxRedirects: 5, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $   = cheerio.load(res.data);

    /* Remove non-content elements */
    $('script, style, nav, footer, header, aside, .sidebar, #sidebar').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

    result.wordCount      = bodyText.split(/\s+/).filter(Boolean).length;
    result.charCount      = bodyText.length;
    result.paragraphCount = $('p').length;

    /* Flesch Reading Ease */
    result.readabilityScore = calculateFlesch(bodyText);
    result.readabilityGrade = fleschGrade(result.readabilityScore);

    if (result.wordCount < 300) {
      result.issues.push({ category: 'content', title: 'Low Word Count', detail: `Only ${result.wordCount} words found on page.`, severity: 'medium', fix: 'Add at least 300–500 words of meaningful content.', impact: 'Thin content ranks poorly in search engines.' });
    }
    if (result.readabilityScore < 40) {
      result.issues.push({ category: 'content', title: 'Poor Readability', detail: `Flesch score: ${result.readabilityScore}. Content is difficult to read.`, severity: 'low', fix: 'Simplify sentences and use common vocabulary.', impact: 'High bounce rate from poor user experience.' });
    }
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

/* ═══════════════════════════════════════
   2. SEO CONTENT ANALYSIS
═══════════════════════════════════════ */
async function analyzeSEOContent(targetUrl) {
  const result = {
    title: null, titleLength: 0, metaDescription: null, metaDescriptionLength: 0,
    h1: [], h2: [], h3: [], hStructure: {},
    keywordDensity: {}, topKeywords: [],
    imgWithoutAlt: 0, totalImages: 0,
    internalLinks: 0, externalLinks: 0,
    canonicalTag: null, robotsMeta: null,
    issues: [],
  };

  try {
    const res = await axios.get(targetUrl, { timeout: 12000, maxRedirects: 5, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $   = cheerio.load(res.data);

    result.title              = $('title').first().text().trim();
    result.titleLength        = result.title.length;
    result.metaDescription    = $('meta[name="description"]').attr('content') || null;
    result.metaDescriptionLength = result.metaDescription?.length || 0;
    result.canonicalTag       = $('link[rel="canonical"]').attr('href') || null;
    result.robotsMeta         = $('meta[name="robots"]').attr('content') || null;

    /* Heading structure */
    ['h1','h2','h3','h4','h5','h6'].forEach(tag => {
      result.hStructure[tag] = [];
      $(tag).each((_, el) => result.hStructure[tag].push($(el).text().trim()));
    });
    result.h1 = result.hStructure['h1'];
    result.h2 = result.hStructure['h2'];

    /* Images */
    $('img').each((_, el) => {
      result.totalImages++;
      if (!$(el).attr('alt')) result.imgWithoutAlt++;
    });

    /* Links */
    const baseOrigin = new URL(targetUrl).origin;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href?.startsWith('http') && !href.startsWith(baseOrigin)) result.externalLinks++;
      else result.internalLinks++;
    });

    /* Keyword density */
    $('script, style').remove();
    const bodyText = $('body').text().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const words    = bodyText.split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
    const total    = words.length;
    const freq     = {};
    for (const w of words) freq[w] = (freq[w] || 0) + 1;
    result.topKeywords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, count, density: +((count / total) * 100).toFixed(2) }));

    /* Issues */
    if (!result.title)            result.issues.push({ category: 'seo', title: 'Missing Page Title',         detail: 'No <title> tag found.', severity: 'high', fix: 'Add a descriptive title tag.', impact: 'Critical for SEO ranking.' });
    if (result.titleLength > 60)  result.issues.push({ category: 'seo', title: 'Title Too Long',             detail: `Title is ${result.titleLength} chars.`, severity: 'medium', fix: 'Keep title under 60 characters.', impact: 'Truncated in SERP.' });
    if (!result.metaDescription)  result.issues.push({ category: 'seo', title: 'Missing Meta Description',  detail: 'No meta description found.', severity: 'high', fix: 'Add a 150–160 char meta description.', impact: 'Reduces click-through rate from search results.' });
    if (result.h1.length === 0)   result.issues.push({ category: 'seo', title: 'Missing H1 Tag',            detail: 'No H1 heading found.', severity: 'high', fix: 'Add one H1 tag per page.', impact: 'Hurts SEO and content hierarchy.' });
    if (result.h1.length > 1)     result.issues.push({ category: 'seo', title: 'Multiple H1 Tags',          detail: `${result.h1.length} H1 tags found.`, severity: 'medium', fix: 'Use only one H1 tag.', impact: 'Confuses search engine crawlers.' });
    if (result.imgWithoutAlt > 0) result.issues.push({ category: 'seo', title: 'Images Missing Alt Text',   detail: `${result.imgWithoutAlt} of ${result.totalImages} images lack alt.`, severity: 'medium', fix: 'Add descriptive alt text to all images.', impact: 'Hurts SEO and accessibility.' });
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

/* ═══════════════════════════════════════
   3. SCHEMA MARKUP ANALYSIS
═══════════════════════════════════════ */
async function analyzeSchema(targetUrl) {
  const result = { found: false, schemas: [], types: [], valid: [], invalid: [], issues: [] };

  try {
    const res = await axios.get(targetUrl, { timeout: 10000, maxRedirects: 5, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $   = cheerio.load(res.data);

    /* JSON-LD */
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const schemas = Array.isArray(data) ? data : [data];
        for (const s of schemas) {
          result.schemas.push(s);
          result.types.push(s['@type']);
          result.valid.push(s['@type']);
        }
        result.found = true;
      } catch (e) {
        result.invalid.push({ error: e.message });
      }
    });

    /* Microdata */
    $('[itemtype]').each((_, el) => {
      const type = $(el).attr('itemtype')?.split('/').pop();
      if (type && !result.types.includes(type)) {
        result.types.push(type + ' (microdata)');
        result.found = true;
      }
    });

    if (!result.found) {
      result.issues.push({ category: 'seo', title: 'No Structured Data Found', detail: 'No Schema.org markup detected.', severity: 'medium', fix: 'Add JSON-LD structured data (Organization, Breadcrumb, Article, etc.)', impact: 'Misses rich snippet opportunities in search results.' });
    }
    if (result.invalid.length) {
      result.issues.push({ category: 'seo', title: 'Invalid JSON-LD Schema', detail: `${result.invalid.length} schema blocks have JSON parse errors.`, severity: 'medium', fix: 'Validate and fix JSON-LD syntax.', impact: 'Search engines cannot interpret broken schema.' });
    }
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

/* ═══════════════════════════════════════
   4. JS DEPENDENCY ANALYSIS
═══════════════════════════════════════ */
async function analyzeJSDependency(targetUrl) {
  const result = { totalScripts: 0, externalScripts: 0, inlineScripts: 0, renderBlocking: 0, jsFiles: [], issues: [] };

  try {
    const res = await axios.get(targetUrl, { timeout: 12000, maxRedirects: 5, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $   = cheerio.load(res.data);

    $('script').each((_, el) => {
      result.totalScripts++;
      const src   = $(el).attr('src');
      const defer = $(el).attr('defer') !== undefined;
      const async_ = $(el).attr('async') !== undefined;
      if (src) {
        result.externalScripts++;
        result.jsFiles.push({ src, defer, async: async_, renderBlocking: !defer && !async_ });
        if (!defer && !async_) result.renderBlocking++;
      } else {
        result.inlineScripts++;
      }
    });

    if (result.renderBlocking > 3) {
      result.issues.push({ category: 'performance', title: 'Render-Blocking Scripts', detail: `${result.renderBlocking} scripts block page rendering.`, severity: 'high', fix: 'Add defer or async attribute to non-critical scripts.', impact: 'Increases page load time and hurts Core Web Vitals.' });
    }
    if (result.externalScripts > 15) {
      result.issues.push({ category: 'performance', title: 'Too Many External Scripts', detail: `${result.externalScripts} external JS files loaded.`, severity: 'medium', fix: 'Bundle and minify JavaScript files.', impact: 'Excess HTTP requests slow down the page.' });
    }
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

/* ═══════════════════════════════════════
   5. BASIC ACCESSIBILITY CHECK
═══════════════════════════════════════ */
async function analyzeAccessibility(targetUrl) {
  const result = { totalIssues: 0, critical: 0, moderate: 0, minor: 0, checks: [], issues: [] };

  try {
    const res = await axios.get(targetUrl, { timeout: 12000, maxRedirects: 5, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $   = cheerio.load(res.data);

    const checks = [
      { id: 'lang',        label: 'Document Language',       test: () => !!$('html').attr('lang'),                               sev: 'critical' },
      { id: 'skip',        label: 'Skip Navigation Link',    test: () => $('a[href="#main"], a[href="#content"]').length > 0,    sev: 'moderate' },
      { id: 'formLabels',  label: 'Form Inputs Labeled',     test: () => $('input:not([type=hidden]):not([aria-label]):not([id])').length === 0, sev: 'critical' },
      { id: 'buttonText',  label: 'Buttons Have Text',       test: () => $('button').toArray().every(el => $(el).text().trim() || $(el).attr('aria-label')), sev: 'moderate' },
      { id: 'linkText',    label: 'Links Have Meaningful Text', test: () => !$('a').toArray().some(el => ['click here','here','read more','learn more'].includes($(el).text().trim().toLowerCase())), sev: 'moderate' },
      { id: 'viewport',   label: 'Viewport Meta Tag',        test: () => !!$('meta[name="viewport"]').length,                   sev: 'moderate' },
      { id: 'iframeTitle', label: 'Iframes Have Titles',     test: () => $('iframe:not([title])').length === 0,                 sev: 'moderate' },
    ];

    for (const chk of checks) {
      const passed = chk.test();
      result.checks.push({ id: chk.id, label: chk.label, passed, severity: chk.sev });
      if (!passed) {
        result.totalIssues++;
        result[chk.sev === 'critical' ? 'critical' : chk.sev === 'moderate' ? 'moderate' : 'minor']++;
        result.issues.push({ category: 'accessibility', title: `A11y: ${chk.label} Failed`, detail: `Accessibility check failed: ${chk.label}`, severity: chk.sev === 'critical' ? 'high' : 'medium', fix: `Fix ${chk.label} per WCAG 2.1 guidelines.`, impact: 'Reduces accessibility for users with disabilities.' });
      }
    }
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

/* ── Helpers ── */
function calculateFlesch(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
  const words     = text.split(/\s+/).filter(Boolean).length || 1;
  const syllables = text.split(/\s+/).reduce((sum, w) => sum + countSyllables(w), 0) || 1;
  return Math.round(206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words));
}

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = word.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

function fleschGrade(score) {
  if (score >= 90) return 'Very Easy (5th Grade)';
  if (score >= 80) return 'Easy (6th Grade)';
  if (score >= 70) return 'Fairly Easy (7th Grade)';
  if (score >= 60) return 'Standard (8th-9th Grade)';
  if (score >= 50) return 'Fairly Difficult (10th-12th Grade)';
  if (score >= 30) return 'Difficult (College)';
  return 'Very Difficult (College Graduate)';
}

const STOP_WORDS = new Set([
  'the','be','to','of','and','a','in','that','have','it','for','not','on','with',
  'he','as','you','do','at','this','but','his','by','from','they','we','say','her',
  'she','or','an','will','my','one','all','would','there','their','what','so','up',
  'out','if','about','who','get','which','when','make','can','like','time','just',
  'him','know','take','into','your','some','could','them','see','other','than','then',
  'now','look','only','come','its','over','think','also','back','after','use','two',
  'how','our','work','first','well','way','even','want','because','any','these',
  'give','most','tell','very','were','been',
]);

module.exports = { analyzeContent, analyzeSEOContent, analyzeSchema, analyzeJSDependency, analyzeAccessibility };