/**
 * seo/utils/helpers.js
 * Pure helper functions — scoring, grading, text analysis, keyword logic.
 */

// ── CTA words for meta description (FR-5.13) ──────────────────────────────────
const CTA_WORDS = ['learn','discover','get','buy','shop','try','start','find','explore',
  'download','sign up','register','join','contact','call','book','request','view','see','read'];

// ── Dynamic URL patterns (FR-5.15) ────────────────────────────────────────────
const DYNAMIC_PATTERNS = [/\?.*=/,/&[a-z]+=/, /\/(id|page|p|q|s|search|category)=/i,
  /\/\d{5,}/, /[?&](session|token|ref|utm_)/i];

// ── Poor image filename patterns (FR-5.33) ────────────────────────────────────
const POOR_FILENAME = /^(img|image|photo|pic|screenshot|untitled|dsc|dscf|p\d+)[_\-]?\d*\.(jpg|jpeg|png|webp|gif)$/i;

// ── Keyword stuffing threshold ─────────────────────────────────────────────────
const STUFFING_THRESHOLD = 4.5; // > 4.5% density = stuffing

/**
 * Convert 0–100 score to letter grade.
 */
function scoreToGrade(score) {
  if (score == null) return null;
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

/**
 * Convert score to rating string.
 */
function scoreToRating(score) {
  if (score == null) return 'unknown';
  if (score >= 75) return 'good';
  if (score >= 45) return 'needs-improvement';
  return 'poor';
}

/**
 * Build a score object.
 */
function makeScore(score, issues = []) {
  return { score, rating: scoreToRating(score), issues };
}

/**
 * Check if meta description contains a CTA word (FR-5.13).
 */
function hasCTA(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CTA_WORDS.some(w => lower.includes(w));
}

/**
 * Score the title tag (FR-5.12, FR-5.10).
 * - Ideal length: 50–60 chars → 100
 * - 40–70 chars → 70
 * - < 30 or > 70 → 30
 */
function scoreTitleTag(title, targetKeyword = '') {
  const issues = [];
  if (!title) {
    issues.push({ type: 'error', message: 'Missing title tag' });
    return { score: makeScore(0, issues), keywordPos: 'none' };
  }

  let score = 100;
  const len = title.length;

  if (len < 30)      { score -= 40; issues.push({ type: 'error',   message: `Title too short (${len} chars). Recommended: 50–60.` }); }
  else if (len > 70) { score -= 30; issues.push({ type: 'warning', message: `Title too long (${len} chars). May be truncated in SERPs.` }); }
  else if (len < 50) { score -= 15; issues.push({ type: 'warning', message: `Title slightly short (${len} chars). Aim for 50–60.` }); }

  // Keyword position (FR-5.12)
  let keywordPos = 'none';
  if (targetKeyword) {
    const lower = title.toLowerCase();
    const kw    = targetKeyword.toLowerCase();
    const idx   = lower.indexOf(kw);
    if (idx === -1)                         { keywordPos = 'none';      score -= 20; issues.push({ type: 'warning', message: 'Target keyword not found in title.' }); }
    else if (idx <= Math.floor(len * 0.3))  { keywordPos = 'beginning'; }
    else if (idx <= Math.floor(len * 0.7))  { keywordPos = 'middle';    score -= 10; issues.push({ type: 'info', message: 'Keyword found in middle of title. Beginning is preferred.' }); }
    else                                    { keywordPos = 'end';       score -= 15; issues.push({ type: 'warning', message: 'Keyword found at end of title. Move to beginning for better SEO.' }); }
  }

  return { score: makeScore(Math.max(0, score), issues), keywordPos };
}

/**
 * Score the meta description (FR-5.11, FR-5.13).
 * - Ideal: 120–160 chars + CTA
 */
function scoreMetaDescription(desc) {
  const issues = [];
  if (!desc) {
    issues.push({ type: 'error', message: 'Missing meta description' });
    return makeScore(0, issues);
  }

  let score = 100;
  const len = desc.length;
  const cta = hasCTA(desc);

  if (len < 80)       { score -= 40; issues.push({ type: 'error',   message: `Description too short (${len} chars). Aim for 120–160.` }); }
  else if (len > 160) { score -= 25; issues.push({ type: 'warning', message: `Description too long (${len} chars). Will be truncated in SERPs.` }); }
  else if (len < 120) { score -= 10; issues.push({ type: 'warning', message: `Description slightly short (${len} chars). Aim for 120–160.` }); }

  if (!cta) { score -= 15; issues.push({ type: 'info', message: 'No call-to-action words detected. Adding one can improve CTR.' }); }

  return makeScore(Math.max(0, score), issues);
}

/**
 * Score URL structure (FR-5.14 – 5.17).
 */
function scoreUrl(url) {
  const issues = [];
  let score    = 100;

  try {
    const parsed   = new URL(url);
    const path     = parsed.pathname + parsed.search;
    const isDynamic = DYNAMIC_PATTERNS.some(p => p.test(path));
    const hasUpper  = /[A-Z]/.test(parsed.pathname);
    const hasSpecial = /[^a-zA-Z0-9\-_./]/.test(parsed.pathname);
    const usesHyphens = parsed.pathname.includes('-');
    const urlLen    = url.length;

    if (urlLen > 115) { score -= 20; issues.push({ type: 'warning', message: `URL is long (${urlLen} chars). Keep under 115.` }); }
    if (isDynamic)    { score -= 25; issues.push({ type: 'warning', message: 'URL appears dynamic. Static URLs are preferred for SEO.' }); }
    if (hasUpper)     { score -= 15; issues.push({ type: 'warning', message: 'URL contains uppercase letters. Use lowercase for consistency.' }); }
    if (hasSpecial)   { score -= 15; issues.push({ type: 'error',   message: 'URL contains special characters. Use hyphens to separate words.' }); }
    if (!usesHyphens && parsed.pathname.length > 5) {
      score -= 10;
      issues.push({ type: 'info', message: 'Use hyphens (-) to separate words in URLs.' });
    }

    return { score: makeScore(Math.max(0, score), issues), isDynamic, hasUpper, hasSpecial, usesHyphens, urlLen };
  } catch (_) {
    return { score: makeScore(0, [{ type:'error', message:'Invalid URL' }]), isDynamic: false, hasUpper: false, hasSpecial: false, usesHyphens: false, urlLen: 0 };
  }
}

/**
 * Analyse keyword density and detect stuffing (FR-5.21).
 * Returns top keywords with their density.
 */
function analyzeKeywords(text) {
  if (!text) return { topKeywords: [], stuffingDetected: false, stuffingWords: [] };

  // Tokenise — remove common stop words
  const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for',
    'of','with','by','from','is','it','this','that','was','are','be','as','we','you',
    'he','she','they','our','your','its','have','has','had','not','all','if','so','do',
    'did','will','can','may','should','would','could','their','there','been','more']);

  const words  = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const total  = words.length;
  if (!total) return { topKeywords: [], stuffingDetected: false, stuffingWords: [] };

  const freq = {};
  words.forEach(w => { if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1; });

  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({
      word, count, density: parseFloat(((count / total) * 100).toFixed(2))
    }));

  const stuffingWords = sorted.filter(k => k.density > STUFFING_THRESHOLD).map(k => k.word);

  return { topKeywords: sorted, stuffingDetected: stuffingWords.length > 0, stuffingWords };
}

/**
 * Flesch-Kincaid readability score (FR-5.22 / content quality).
 */
function readabilityScore(text) {
  if (!text || text.length < 100) return { score: null, grade: 'Unknown' };

  const sentences = (text.match(/[.!?]+/g) || []).length || 1;
  const words     = (text.match(/\b\w+\b/g) || []).length;
  const syllables = text.split(/\s+/).reduce((sum, word) => {
    return sum + (word.toLowerCase().replace(/[^a-z]/g,'').replace(/[aeiou]{2,}/g,'a').match(/[aeiou]/g) || ['x']).length;
  }, 0);

  if (!words || !sentences) return { score: null, grade: 'Unknown' };

  const fk = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  const score = Math.max(0, Math.min(100, Math.round(fk)));

  let grade;
  if (score >= 90)      grade = 'Very Easy';
  else if (score >= 70) grade = 'Easy';
  else if (score >= 60) grade = 'Standard';
  else if (score >= 50) grade = 'Fairly Difficult';
  else if (score >= 30) grade = 'Difficult';
  else                  grade = 'Very Difficult';

  return { score, grade };
}

/**
 * Extract LSI / semantic keywords (FR-5.22) — bigrams from top content words.
 */
function extractLSI(text, topKeywords = []) {
  if (!text) return [];
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]} ${words[i+1]}`;
    bigrams.push(pair);
  }
  const freq = {};
  bigrams.forEach(b => freq[b] = (freq[b] || 0) + 1);
  return Object.entries(freq)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);
}

/**
 * Score content length (FR-5.20).
 */
function scoreContentLength(wordCount) {
  const issues = [];
  let score = 100;

  if (wordCount < 100)       { score = 20; issues.push({ type: 'error',   message: `Very thin content (${wordCount} words). Aim for 800+.` }); }
  else if (wordCount < 300)  { score = 45; issues.push({ type: 'warning', message: `Thin content (${wordCount} words). Aim for 800+ for ranking.` }); }
  else if (wordCount < 600)  { score = 65; issues.push({ type: 'warning', message: `Content below recommended length (${wordCount} words). Aim for 800+.` }); }
  else if (wordCount < 800)  { score = 80; issues.push({ type: 'info',    message: `Good content length (${wordCount} words). More depth may help rankings.` }); }
  else                       { score = 100; }

  return makeScore(score, issues);
}

/**
 * Score heading structure.
 */
function scoreHeadings(h1Count, h2Count, h3Count) {
  const issues = [];
  let score = 100;

  if (h1Count === 0)   { score -= 40; issues.push({ type: 'error',   message: 'No H1 tag found. Every page needs exactly one H1.' }); }
  if (h1Count > 1)     { score -= 25; issues.push({ type: 'warning', message: `Multiple H1 tags found (${h1Count}). Use only one.` }); }
  if (h2Count === 0)   { score -= 15; issues.push({ type: 'warning', message: 'No H2 tags found. Use H2s to structure content sections.' }); }

  return makeScore(Math.max(0, score), issues);
}

/**
 * Score image SEO (FR-5.33 – 5.34).
 */
function scoreImageSeo(totalImages, missingAlt, poorFilenames) {
  const issues = [];
  let score = 100;

  if (totalImages === 0) return makeScore(100, []);

  const missingPct = (missingAlt / totalImages) * 100;
  if (missingPct > 50) { score -= 40; issues.push({ type: 'error',   message: `${missingAlt}/${totalImages} images missing alt text.` }); }
  else if (missingPct > 0) { score -= missingPct * 0.4; issues.push({ type: 'warning', message: `${missingAlt} image(s) missing alt text.` }); }

  if (poorFilenames.length > 0) { score -= 10; issues.push({ type: 'info', message: `${poorFilenames.length} image(s) have generic filenames (e.g. img001.jpg).` }); }

  return makeScore(Math.max(0, score), issues);
}

/**
 * Score technical SEO section.
 */
function scoreTechnicalSeo({ hasCanonical, noindex, sitemapFound, robotsTxtFound, httpsEnabled, hasHreflang }) {
  const issues = [];
  let score = 100;

  if (!httpsEnabled)    { score -= 30; issues.push({ type: 'error',   message: 'Site is not using HTTPS. HTTPS is a confirmed Google ranking factor.' }); }
  if (!hasCanonical)    { score -= 15; issues.push({ type: 'warning', message: 'No canonical tag found. Add to prevent duplicate content issues.' }); }
  if (noindex)          { score -= 40; issues.push({ type: 'error',   message: 'Page has noindex directive — it will NOT be indexed by search engines.' }); }
  if (!sitemapFound)    { score -= 10; issues.push({ type: 'warning', message: 'Sitemap.xml not found. Submit a sitemap to Google Search Console.' }); }
  if (!robotsTxtFound)  { score -= 5;  issues.push({ type: 'info',    message: 'robots.txt not found. Recommended for crawl control.' }); }

  return makeScore(Math.max(0, score), issues);
}

/**
 * Compute overall SEO score from section scores.
 */
function computeOverallScore(sections) {
  const weights = {
    metaTitle:       15,
    metaDesc:        10,
    urlSeo:          8,
    content:         15,
    headings:        10,
    internalLinks:   8,
    technicalSeo:    15,
    mobileSeo:       7,
    imageSeo:        7,
    structuredData:  5,
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const val = sections[key];
    if (val !== null && val !== undefined) {
      weightedSum += val * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
}

/**
 * DA fallback estimator (FR-5.39) — when Moz API is unavailable.
 * Uses URL age signals, HTTPS, path depth as heuristics.
 */
function estimateDAfallback(url) {
  try {
    const parsed  = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const depth   = parsed.pathname.split('/').filter(Boolean).length;
    const hasWww  = parsed.hostname.startsWith('www.');

    // Very rough heuristic: 20–50 range
    let est = 20;
    if (isHttps) est += 10;
    if (hasWww)  est += 5;
    if (depth < 3) est += 5;
    return { estimated: est, method: 'heuristic', note: 'Moz API unavailable — estimated value only.' };
  } catch (_) {
    return { estimated: null, method: 'heuristic', note: 'Could not estimate DA.' };
  }
}

module.exports = {
  scoreTitleTag, scoreMetaDescription, scoreUrl,
  analyzeKeywords, readabilityScore, extractLSI, scoreContentLength,
  scoreHeadings, scoreImageSeo, scoreTechnicalSeo,
  computeOverallScore, scoreToGrade, makeScore, hasCTA,
  POOR_FILENAME, estimateDAfallback, scoreToRating
};