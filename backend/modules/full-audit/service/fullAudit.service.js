'use strict';
/**
 * fullAudit.service.js
 * Runs all 9 audit modules in parallel, persists results, generates AI report & PDF.
 */

const axios    = require('axios');
const cheerio  = require('cheerio');
const Groq     = require('groq-sdk');
const FullAudit = require('../model/fullAudit.model');

/* ══════════════════════════════════════════════════════════════════
   UTILITY HELPERS
══════════════════════════════════════════════════════════════════ */

function normaliseURL(url) {
  if (!url) throw new Error('URL is required');
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  return url;
}

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function clamp(n, min = 0, max = 100) { return Math.min(max, Math.max(min, Math.round(n))); }

function deductScore(base, amount) { return Math.max(0, base - amount); }

async function fetchPage(url) {
  const start = Date.now();
  const res = await axios.get(url, {
    timeout: 20000,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WebAuditX/1.0; +https://webauditx.com)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    validateStatus: () => true,
  });
  return {
    html:        res.data || '',
    status:      res.status,
    headers:     res.headers || {},
    loadTime:    Date.now() - start,
    finalURL:    res.request?.res?.responseUrl || url,
    redirectCount: res.request?._redirectCount || 0,
  };
}

function countWords(text) {
  return text.replace(/\s+/g, ' ').trim().split(' ').filter(w => w.length > 0).length;
}

function readabilityScore(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
  const words     = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((acc, w) => acc + Math.max(1, w.replace(/[^aeiou]/gi, '').length), 0);
  if (!sentences.length || !words.length) return 50;
  const asl = words.length / sentences.length;
  const asw = syllables / words.length;
  return clamp(206.835 - 1.015 * asl - 84.6 * asw);
}

function extractKeywordDensity($, bodyText) {
  const words = bodyText.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  const freq  = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const density = {};
  sorted.forEach(([w, c]) => { density[w] = +((c / words.length) * 100).toFixed(2); });
  return density;
}

/* ══════════════════════════════════════════════════════════════════
   MODULE 1 — SEO AUDIT
══════════════════════════════════════════════════════════════════ */

async function auditSEO(url, $, html, pageHeaders) {
  const issues = [];
  let score = 100;

  const title          = $('title').first().text().trim();
  const metaDesc       = $('meta[name="description"]').attr('content') || '';
  const canonical      = $('link[rel="canonical"]').attr('href') || '';
  const ogTitle        = $('meta[property="og:title"]').attr('content') || '';
  const ogDesc         = $('meta[property="og:description"]').attr('content') || '';
  const ogImage        = $('meta[property="og:image"]').attr('content') || '';
  const twitterCard    = $('meta[name="twitter:card"]').attr('content') || '';
  const robotsMeta     = $('meta[name="robots"]').attr('content') || '';
  const hreflangTags   = $('link[rel="alternate"][hreflang]').length;

  const h1Els = $('h1'); const h1Count = h1Els.length;
  const h1Texts = []; h1Els.each((_, el) => h1Texts.push($(el).text().trim().slice(0, 80)));
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;

  const bodyText       = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount      = countWords(bodyText);
  const readability    = readabilityScore(bodyText);
  const keywordDensity = extractKeywordDensity($, bodyText);

  const allLinks    = $('a[href]');
  const internalLinks = allLinks.filter((_, el) => {
    const href = $(el).attr('href') || '';
    return href.startsWith('/') || href.includes(getDomain(url));
  }).length;
  const externalLinks = allLinks.length - internalLinks;

  const allImages       = $('img');
  const imageAltMissing = allImages.filter((_, el) => !$(el).attr('alt')).length;
  const totalImages     = allImages.length;

  // Structured data
  const sdScripts      = $('script[type="application/ld+json"]');
  const structuredDataTypes = [];
  sdScripts.each((_, el) => {
    try {
      const obj = JSON.parse($(el).html() || '{}');
      const type = obj['@type'] || (Array.isArray(obj['@graph']) ? 'Graph' : 'Unknown');
      structuredDataTypes.push(Array.isArray(type) ? type.join(',') : type);
    } catch { structuredDataTypes.push('ParseError'); }
  });

  const hasSitemapLink = $('a[href*="sitemap"]').length > 0;
  const hasRobotsTxt   = false; // checked separately via HTTP

  /* ── Scoring ── */
  if (!title)                                           { issues.push({ severity:'high',   title:'Missing <title> tag',            detail:'No title tag found. This is critical for SEO.', recommendation:'Add a descriptive title tag between 50-60 characters.' }); score = deductScore(score, 20); }
  else if (title.length < 10)                           { issues.push({ severity:'high',   title:'Title tag too short',            detail:`Title is only ${title.length} chars. Aim for 50-60.`, recommendation:'Expand your title to be more descriptive.' }); score = deductScore(score, 12); }
  else if (title.length > 60)                           { issues.push({ severity:'medium', title:'Title tag too long',             detail:`Title is ${title.length} chars. Google truncates at ~60.`, recommendation:'Trim your title to under 60 characters.' }); score = deductScore(score, 6); }

  if (!metaDesc)                                        { issues.push({ severity:'high',   title:'Missing meta description',       detail:'No meta description found.', recommendation:'Add a unique meta description of 150-160 characters.' }); score = deductScore(score, 15); }
  else if (metaDesc.length < 70)                        { issues.push({ severity:'medium', title:'Meta description too short',    detail:`Only ${metaDesc.length} chars. Aim for 150-160.`, recommendation:'Expand meta description to give a proper summary.' }); score = deductScore(score, 6); }
  else if (metaDesc.length > 160)                       { issues.push({ severity:'low',    title:'Meta description too long',     detail:`${metaDesc.length} chars. Google truncates at ~160.`, recommendation:'Trim meta description to under 160 characters.' }); score = deductScore(score, 4); }

  if (h1Count === 0)                                    { issues.push({ severity:'high',   title:'Missing H1 heading',            detail:'No H1 tag found on the page.', recommendation:'Add exactly one H1 tag with your primary keyword.' }); score = deductScore(score, 15); }
  else if (h1Count > 1)                                 { issues.push({ severity:'medium', title:'Multiple H1 tags found',        detail:`Found ${h1Count} H1 tags. Only one is recommended.`, recommendation:'Consolidate to a single H1 tag.' }); score = deductScore(score, 8); }

  if (h2Count === 0)                                    { issues.push({ severity:'medium', title:'No H2 headings found',          detail:'No H2 tags found. Use heading hierarchy for content structure.', recommendation:'Add H2 headings to break up content logically.' }); score = deductScore(score, 5); }

  if (!canonical)                                       { issues.push({ severity:'medium', title:'No canonical tag',              detail:'Canonical link not set. May cause duplicate content issues.', recommendation:'Add <link rel="canonical"> to specify the preferred URL.' }); score = deductScore(score, 8); }

  if (!ogTitle)                                         { issues.push({ severity:'low',    title:'Missing OG title',             detail:'Open Graph title not set. Affects social sharing appearance.', recommendation:'Add <meta property="og:title"> tag.' }); score = deductScore(score, 3); }
  if (!ogDesc)                                          { issues.push({ severity:'low',    title:'Missing OG description',       detail:'Open Graph description not set.', recommendation:'Add <meta property="og:description"> tag.' }); score = deductScore(score, 2); }
  if (!ogImage)                                         { issues.push({ severity:'low',    title:'Missing OG image',             detail:'No Open Graph image. Social shares will have no preview image.', recommendation:'Add <meta property="og:image"> with a 1200x630px image.' }); score = deductScore(score, 3); }
  if (!twitterCard)                                     { issues.push({ severity:'low',    title:'Missing Twitter Card meta',    detail:'No Twitter Card meta tags found.', recommendation:'Add <meta name="twitter:card" content="summary_large_image">.' }); score = deductScore(score, 2); }

  if (robotsMeta.includes('noindex'))                   { issues.push({ severity:'high',   title:'Page is set to noindex',       detail:'robots meta tag contains "noindex". Search engines will not index this page.', recommendation:'Remove noindex unless intentional.' }); score = deductScore(score, 30); }
  if (robotsMeta.includes('nofollow'))                  { issues.push({ severity:'medium', title:'Page is set to nofollow',      detail:'robots meta tag contains "nofollow". Link equity won\'t pass.', recommendation:'Remove nofollow unless intentional.' }); score = deductScore(score, 10); }

  if (structuredDataTypes.length === 0)                 { issues.push({ severity:'medium', title:'No structured data (Schema)',  detail:'No JSON-LD structured data found.', recommendation:'Add Schema.org markup for Organization, BreadcrumbList, or Product.' }); score = deductScore(score, 8); }

  if (wordCount < 300)                                  { issues.push({ severity:'high',   title:'Very low word count',          detail:`Only ${wordCount} words. Thin content hurts SEO rankings.`, recommendation:'Aim for at least 500-800 words of quality content.' }); score = deductScore(score, 12); }
  else if (wordCount < 500)                             { issues.push({ severity:'medium', title:'Low word count',               detail:`Only ${wordCount} words. Consider expanding content.`, recommendation:'Add more relevant, helpful content to the page.' }); score = deductScore(score, 5); }

  if (imageAltMissing > 0)                              { issues.push({ severity:'medium', title:`${imageAltMissing} images missing alt text`, detail:`${imageAltMissing} of ${totalImages} images have no alt attribute.`, recommendation:'Add descriptive alt text to all images.' }); score = deductScore(score, Math.min(imageAltMissing * 2, 10)); }

  if (internalLinks < 3)                                { issues.push({ severity:'medium', title:'Very few internal links',      detail:`Only ${internalLinks} internal links found. Internal linking helps SEO.`, recommendation:'Add relevant internal links to other pages on your site.' }); score = deductScore(score, 5); }

  return {
    score: clamp(score),
    issues,
    data: {
      title, titleLength: title.length,
      metaDescription: metaDesc, metaDescLength: metaDesc.length,
      h1Count, h1Texts, h2Count, h3Count,
      canonical, ogTitle, ogDescription: ogDesc, ogImage, twitterCard,
      robotsMeta, structuredDataTypes, hreflangTags,
      keywordDensity, internalLinks, externalLinks,
      imageAltMissing, totalImages, wordCount, readabilityScore: readability,
      hasSitemap: hasSitemapLink, hasRobotsTxt,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════
   MODULE 2 — PERFORMANCE AUDIT
══════════════════════════════════════════════════════════════════ */

async function auditPerformance(url, $, html, pageHeaders, loadTime) {
  const issues = [];
  let score = 100;

  // PageSpeed Insights API
  let psData = null;
  const psKey = process.env.PAGESPEED_API_KEY;
  if (psKey) {
    try {
      const psURL = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${psKey}&category=performance`;
      const { data } = await axios.get(psURL, { timeout: 40000 });
      psData = data;
    } catch (e) { console.warn('[Performance] PageSpeed API error:', e.message); }
  }

  const lighthouse = psData?.lighthouseResult;
  const lhAudits   = lighthouse?.audits || {};
  const lhCats     = lighthouse?.categories || {};
  const lhScore    = lhCats.performance ? Math.round(lhCats.performance.score * 100) : null;

  const fcp  = lhAudits['first-contentful-paint']?.displayValue   || 'N/A';
  const lcp  = lhAudits['largest-contentful-paint']?.displayValue || 'N/A';
  const tbt  = lhAudits['total-blocking-time']?.displayValue      || 'N/A';
  const cls  = lhAudits['cumulative-layout-shift']?.displayValue  || 'N/A';
  const si   = lhAudits['speed-index']?.displayValue              || 'N/A';
  const tti  = lhAudits['interactive']?.displayValue              || 'N/A';
  const ttfb = lhAudits['server-response-time']?.displayValue     || `${loadTime}ms`;

  const totalPageSize = Math.round((html.length || 0) / 1024);
  const scriptCount   = $('script[src]').length;
  const styleCount    = $('link[rel="stylesheet"]').length;
  const imageCount    = $('img').length;

  const renderBlocking = lhAudits['render-blocking-resources']?.details?.items?.length || 0;
  const unusedCSS      = lhAudits['unused-css-rules']?.details?.overallSavingsBytes    || 0;
  const unusedJS       = lhAudits['unused-javascript']?.details?.overallSavingsBytes   || 0;

  const hasGzip    = (pageHeaders['content-encoding'] || '').includes('gzip');
  const hasBrotli  = (pageHeaders['content-encoding'] || '').includes('br');
  const cacheCtrl  = pageHeaders['cache-control'] || '';
  const hasCDN     = !!(pageHeaders['cf-cache-status'] || pageHeaders['x-cache'] || pageHeaders['x-served-by']);

  // Use Lighthouse score if available, else calculate from raw data
  if (lhScore !== null) {
    score = lhScore;
  } else {
    if (loadTime > 5000)      { score = deductScore(score, 25); }
    else if (loadTime > 3000) { score = deductScore(score, 15); }
    else if (loadTime > 1500) { score = deductScore(score, 8); }
    if (scriptCount > 20)     { score = deductScore(score, 10); }
    if (styleCount > 10)      { score = deductScore(score, 5); }
    if (!hasGzip && !hasBrotli) { score = deductScore(score, 8); }
  }

  /* ── Issue Detection ── */
  const lcpRaw = parseFloat((lhAudits['largest-contentful-paint']?.numericValue || 0) / 1000);
  if (lcpRaw > 4)           { issues.push({ severity:'high',   title:`LCP is ${lcp} (Poor)`,               detail:'Largest Contentful Paint exceeds 4s. Users perceive page as slow.', recommendation:'Optimise hero images, reduce server response time, eliminate render-blocking resources.' }); }
  else if (lcpRaw > 2.5)    { issues.push({ severity:'medium', title:`LCP is ${lcp} (Needs Improvement)`,  detail:'LCP between 2.5s–4s. Should be under 2.5s for good Core Web Vitals.', recommendation:'Compress and preload the LCP element (usually the hero image).' }); }

  const clsRaw = parseFloat(lhAudits['cumulative-layout-shift']?.numericValue || 0);
  if (clsRaw > 0.25)        { issues.push({ severity:'high',   title:`CLS is ${cls} (Poor)`,               detail:'High layout shift. Elements move around during page load.', recommendation:'Set explicit size attributes on images, ads, and embeds.' }); }
  else if (clsRaw > 0.1)    { issues.push({ severity:'medium', title:`CLS is ${cls} (Needs Improvement)`,  detail:'Moderate layout shift.', recommendation:'Reserve space for dynamic content and avoid inserting content above existing content.' }); }

  const tbtRaw = parseFloat(lhAudits['total-blocking-time']?.numericValue || 0);
  if (tbtRaw > 600)         { issues.push({ severity:'high',   title:`TBT is ${tbt} (Poor)`,               detail:'High Total Blocking Time. Page is unresponsive during load.', recommendation:'Break up long JavaScript tasks, defer non-critical JS.' }); }
  else if (tbtRaw > 200)    { issues.push({ severity:'medium', title:`TBT is ${tbt} (Needs Improvement)`,  detail:'Moderate TBT.', recommendation:'Code-split JavaScript and remove unused scripts.' }); }

  if (renderBlocking > 0)   { issues.push({ severity:'high',   title:`${renderBlocking} render-blocking resources`, detail:'Scripts or stylesheets blocking page render.', recommendation:'Add async/defer to scripts. Inline critical CSS.' }); }
  if (!hasGzip && !hasBrotli) { issues.push({ severity:'medium', title:'No compression (gzip/brotli)',       detail:'Responses are not compressed. Increases transfer size.', recommendation:'Enable gzip or brotli compression on your web server.' }); }
  if (!cacheCtrl)           { issues.push({ severity:'medium', title:'Missing cache-control headers',       detail:'No caching headers found. Resources re-downloaded on every visit.', recommendation:'Set cache-control headers for static assets (max-age ≥ 31536000).' }); }
  if (unusedJS > 50000)     { issues.push({ severity:'medium', title:`${Math.round(unusedJS/1024)}KB unused JavaScript`, detail:'Large amount of JavaScript code is loaded but never executed.', recommendation:'Tree-shake and code-split your JavaScript bundles.' }); }
  if (unusedCSS > 20000)    { issues.push({ severity:'low',    title:`${Math.round(unusedCSS/1024)}KB unused CSS`, detail:'Unused CSS rules loaded on this page.', recommendation:'Use PurgeCSS or equivalent to remove unused styles.' }); }
  if (scriptCount > 20)     { issues.push({ severity:'medium', title:`${scriptCount} JavaScript files loaded`, detail:'Too many JS files increase HTTP requests and parse time.', recommendation:'Bundle and minify JavaScript files. Aim for fewer than 10 requests.' }); }
  if (totalPageSize > 3000) { issues.push({ severity:'medium', title:`Page size is ${totalPageSize}KB`,     detail:'Large page size slows initial load especially on mobile.', recommendation:'Compress images, minify CSS/JS, and eliminate unnecessary resources.' }); }
  if (imageCount > 30)      { issues.push({ severity:'low',    title:`${imageCount} images on page`,        detail:'Many images increase page weight. Ensure all are optimised.', recommendation:'Implement lazy loading and serve next-gen formats (WebP/AVIF).' }); }

  return {
    score: clamp(score),
    issues,
    data: {
      performanceScore: score,
      firstContentfulPaint: fcp,
      largestContentfulPaint: lcp,
      totalBlockingTime: tbt,
      cumulativeLayoutShift: cls,
      speedIndex: si,
      timeToInteractive: tti,
      serverResponseTime: ttfb,
      totalPageSize,
      totalRequests: scriptCount + styleCount + imageCount,
      imageCount, scriptCount,
      stylesheetCount: styleCount,
      unusedCSSBytes: unusedCSS,
      unusedJSBytes: unusedJS,
      hasGzip, hasBrotli,
      cachePolicy: cacheCtrl || 'None',
      cdnDetected: hasCDN,
      renderBlockingResources: renderBlocking,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════
   MODULE 3 — ACCESSIBILITY AUDIT
══════════════════════════════════════════════════════════════════ */

async function auditAccessibility(url, $, html) {
  const issues = [];
  let score = 100;

  const allImgs           = $('img');
  const imgsWithoutAlt    = allImgs.filter((_, el) => $(el).attr('alt') === undefined || $(el).attr('alt') === null).length;
  const emptyAltCount     = allImgs.filter((_, el) => $(el).attr('alt') === '').length; // decorative (ok)
  const totalImages       = allImgs.length;

  const allInputs         = $('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])');
  const inputsWithoutLabel = allInputs.filter((_, el) => {
    const id = $(el).attr('id');
    const ariaLabel = $(el).attr('aria-label');
    const ariaLabelledBy = $(el).attr('aria-labelledby');
    const placeholder = $(el).attr('placeholder');
    const hasLabel = id ? $(`label[for="${id}"]`).length > 0 : false;
    return !hasLabel && !ariaLabel && !ariaLabelledBy && !placeholder;
  }).length;
  const totalInputs       = allInputs.length;

  const buttonsWithoutText = $('button').filter((_, el) => {
    const text = $(el).text().trim();
    const ariaLabel = $(el).attr('aria-label') || '';
    const ariaLabelledBy = $(el).attr('aria-labelledby') || '';
    const title = $(el).attr('title') || '';
    return !text && !ariaLabel && !ariaLabelledBy && !title;
  }).length;

  const linksWithoutText = $('a').filter((_, el) => {
    const text  = $(el).text().trim();
    const ariaLabel = $(el).attr('aria-label') || '';
    const img   = $(el).find('img[alt]').length;
    return !text && !ariaLabel && !img;
  }).length;

  const hasSkipLink       = $('a[href="#main"], a[href="#content"], a[href="#maincontent"], [class*="skip"]').length > 0;
  const htmlLang          = $('html').attr('lang') || '';
  const langAttribute     = htmlLang;

  // Heading order
  const headingStructure = [];
  $('h1,h2,h3,h4,h5,h6').each((_, el) => headingStructure.push(parseInt(el.tagName[1])));
  let headingOrderValid = true;
  for (let i = 1; i < headingStructure.length; i++) {
    if (headingStructure[i] - headingStructure[i-1] > 1) { headingOrderValid = false; break; }
  }

  const focusableElements = $('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]').length;
  const tabIndexAbuse     = $('[tabindex]').filter((_, el) => parseInt($(el).attr('tabindex')) > 0).length;
  const ariaLandmarks     = $('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="search"], main, nav, header, footer').length;
  const hasAriaLabels     = $('[aria-label], [aria-labelledby], [aria-describedby]').length > 0;
  const iframesNoTitle    = $('iframe:not([title])').length;
  const videosNoCaption   = $('video:not(:has(track[kind="captions"]))').length;
  const formAccessibility = $('form').length;

  // Colour contrast — basic heuristic (check for low-opacity text)
  let colorContrastIssues = 0;
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    if (style.includes('opacity: 0.') || style.includes('color: #fff') || style.includes('color: white')) colorContrastIssues++;
  });

  let wcagLevel = 'AA'; // assume AA by default

  /* ── Scoring ── */
  if (imgsWithoutAlt > 0)      { issues.push({ severity:'high',   title:`${imgsWithoutAlt} images missing alt text`,      detail:`${imgsWithoutAlt} of ${totalImages} images lack alt attributes, making them inaccessible to screen readers.`, recommendation:'Add descriptive alt text to all informational images. Use alt="" for decorative images.' }); score = deductScore(score, Math.min(imgsWithoutAlt * 4, 20)); }
  if (!htmlLang)                { issues.push({ severity:'high',   title:'Missing lang attribute on <html>',               detail:'The <html> element has no lang attribute. Screen readers cannot determine the page language.', recommendation:'Add lang="en" (or appropriate language code) to the <html> tag.' }); score = deductScore(score, 15); }
  if (!hasSkipLink)             { issues.push({ severity:'medium', title:'No skip navigation link',                        detail:'Keyboard users cannot skip repetitive navigation to get to main content.', recommendation:'Add a "Skip to main content" link as the first focusable element.' }); score = deductScore(score, 10); }
  if (inputsWithoutLabel > 0)  { issues.push({ severity:'high',   title:`${inputsWithoutLabel} form inputs without labels`, detail:`${inputsWithoutLabel} of ${totalInputs} inputs have no accessible label.`, recommendation:'Associate each input with a <label> element or add aria-label attribute.' }); score = deductScore(score, Math.min(inputsWithoutLabel * 5, 15)); }
  if (buttonsWithoutText > 0)  { issues.push({ severity:'high',   title:`${buttonsWithoutText} buttons without accessible text`, detail:'Icon-only buttons with no aria-label are invisible to screen readers.', recommendation:'Add aria-label or visible text to all buttons.' }); score = deductScore(score, Math.min(buttonsWithoutText * 4, 12)); }
  if (linksWithoutText > 0)    { issues.push({ severity:'medium', title:`${linksWithoutText} links without accessible text`, detail:'Empty links are meaningless to screen readers and keyboard users.', recommendation:'Add descriptive text or aria-label to all links.' }); score = deductScore(score, Math.min(linksWithoutText * 3, 10)); }
  if (!headingOrderValid)      { issues.push({ severity:'medium', title:'Heading order is not sequential',                 detail:'Headings skip levels (e.g., H1 → H3). Breaks document outline for assistive technology.', recommendation:'Ensure headings follow a logical sequential order: H1 → H2 → H3.' }); score = deductScore(score, 8); }
  if (ariaLandmarks < 3)       { issues.push({ severity:'medium', title:'Insufficient ARIA landmark regions',             detail:`Only ${ariaLandmarks} landmark regions found. Landmarks help screen reader users navigate.`, recommendation:'Add main, nav, header, and footer landmark elements or ARIA roles.' }); score = deductScore(score, 8); }
  if (tabIndexAbuse > 0)       { issues.push({ severity:'medium', title:`${tabIndexAbuse} elements with positive tabindex`, detail:'Positive tabindex values disrupt natural keyboard focus order.', recommendation:'Remove positive tabindex values. Use tabindex="0" or "-1" only.' }); score = deductScore(score, 5); }
  if (iframesNoTitle > 0)      { issues.push({ severity:'medium', title:`${iframesNoTitle} iframes without title attribute`, detail:'Iframes without titles are not accessible to screen readers.', recommendation:'Add a descriptive title attribute to every iframe element.' }); score = deductScore(score, 5); }
  if (colorContrastIssues > 5) { issues.push({ severity:'medium', title:'Possible colour contrast issues detected',       detail:`${colorContrastIssues} elements with potentially low contrast styles found.`, recommendation:'Ensure text meets WCAG AA minimum contrast ratio of 4.5:1 for normal text.' }); score = deductScore(score, 5); }
  if (videosNoCaption > 0)     { issues.push({ severity:'medium', title:`${videosNoCaption} videos without captions`,    detail:'Videos without captions are inaccessible to deaf and hard-of-hearing users.', recommendation:'Add closed captions (<track kind="captions">) to all video elements.' }); score = deductScore(score, 8); }

  return {
    score: clamp(score),
    issues,
    data: {
      imgsWithoutAlt, totalImages, inputsWithoutLabel, totalInputs,
      buttonsWithoutText, linksWithoutText, hasSkipLink,
      langAttribute, htmlLang, headingStructure, headingOrderValid,
      colorContrastIssues, focusableElements, ariaLandmarks,
      hasAriaLabels, tabIndexAbuse, iframesWithoutTitle: iframesNoTitle,
      videosWithoutCaption: videosNoCaption,
      formAccessibility, wcagLevel,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════
   MODULE 4 — MOBILE FRIENDLINESS
══════════════════════════════════════════════════════════════════ */

async function auditMobile(url, $, html, pageHeaders) {
  const issues = [];
  let score = 100;

  const viewportMeta    = $('meta[name="viewport"]').attr('content') || '';
  const hasViewport     = viewportMeta.includes('width=device-width');
  const hasInitialScale = viewportMeta.includes('initial-scale=1');
  const hasAppleTouchIcon = $('link[rel*="apple-touch-icon"]').length > 0;
  const hasFavicon      = $('link[rel*="icon"]').length > 0 || $('link[rel="shortcut icon"]').length > 0;

  // Check for media queries in inline styles or style tags
  let hasMediaQueries = false;
  $('style').each((_, el) => { if ($(el).html()?.includes('@media')) hasMediaQueries = true; });
  $('link[rel="stylesheet"]').each((_, el) => { /* can't read external CSS, assume present */ });

  // Fixed-width elements (use inline styles heuristic)
  let fixedWidthCount = 0;
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const widthMatch = style.match(/width:\s*(\d+)px/);
    if (widthMatch && parseInt(widthMatch[1]) > 600) fixedWidthCount++;
  });

  // Small tap targets heuristic
  let smallTapTargets = 0;
  $('a, button').each((_, el) => {
    const style = $(el).attr('style') || '';
    const cls   = $(el).attr('class') || '';
    // Heuristic: very short link text with no padding class
    const text  = $(el).text().trim();
    if (text.length < 2 && !cls.includes('btn') && !cls.includes('button')) smallTapTargets++;
  });
  const totalTapTargets = $('a, button').length;

  // Small font sizes in style attributes
  let smallFontCount = 0;
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const match = style.match(/font-size:\s*(\d+)px/);
    if (match && parseInt(match[1]) < 12) smallFontCount++;
  });

  const touchEventsUsed = html.includes('ontouchstart') || html.includes('touchstart') || html.includes('touchend');
  const pwaManifest     = $('link[rel="manifest"]').length > 0;
  const serviceWorker   = html.includes('serviceWorker') || html.includes('service-worker');

  // Use PageSpeed mobile score if available, else calculate
  let mobileScore = score;

  /* ── Scoring ── */
  if (!hasViewport)          { issues.push({ severity:'high',   title:'Missing viewport meta tag',              detail:'No width=device-width in viewport meta. Page will not scale properly on mobile.', recommendation:'Add <meta name="viewport" content="width=device-width, initial-scale=1">.' }); score = deductScore(score, 30); }
  if (!hasInitialScale)      { issues.push({ severity:'medium', title:'Missing initial-scale in viewport',      detail:'initial-scale=1 is not set. May cause zoom issues on iOS.', recommendation:'Add initial-scale=1 to your viewport meta tag content.' }); score = deductScore(score, 10); }
  if (viewportMeta.includes('user-scalable=no') || viewportMeta.includes('maximum-scale=1')) { issues.push({ severity:'medium', title:'Zoom disabled for users',               detail:'user-scalable=no or maximum-scale=1 prevents users from zooming. Accessibility violation.', recommendation:'Remove user-scalable=no and maximum-scale=1 from viewport meta.' }); score = deductScore(score, 10); }
  if (!hasAppleTouchIcon)    { issues.push({ severity:'low',    title:'Missing Apple Touch Icon',               detail:'No apple-touch-icon link found. iOS home screen icon will be auto-generated (low quality).', recommendation:'Add <link rel="apple-touch-icon" href="/apple-touch-icon.png">.' }); score = deductScore(score, 4); }
  if (!hasFavicon)           { issues.push({ severity:'low',    title:'Missing favicon',                       detail:'No favicon link tag found.', recommendation:'Add a favicon.ico and reference it with a <link rel="icon"> tag.' }); score = deductScore(score, 3); }
  if (fixedWidthCount > 3)   { issues.push({ severity:'high',   title:`${fixedWidthCount} fixed-width elements detected`, detail:'Fixed-width elements wider than 600px cause horizontal scrolling on mobile.', recommendation:'Replace fixed pixel widths with max-width, percentages, or CSS Grid/Flexbox.' }); score = deductScore(score, 15); }
  if (smallTapTargets > 5)   { issues.push({ severity:'medium', title:`${smallTapTargets} potentially small tap targets`, detail:'Small links/buttons are hard to tap accurately on touchscreens. WCAG recommends 44x44px minimum.', recommendation:'Increase tap target size to at least 44x44px. Add padding to small links.' }); score = deductScore(score, 8); }
  if (smallFontCount > 3)    { issues.push({ severity:'medium', title:`${smallFontCount} elements with very small font size`, detail:'Font sizes below 12px are hard to read on mobile without zooming.', recommendation:'Ensure body font size is at least 14-16px on mobile devices.' }); score = deductScore(score, 6); }
  if (!pwaManifest)          { issues.push({ severity:'low',    title:'No Progressive Web App manifest',       detail:'No web app manifest found. PWA features like "Add to Home Screen" are unavailable.', recommendation:'Add a manifest.json and link it with <link rel="manifest">.' }); score = deductScore(score, 4); }
  if (!serviceWorker)        { issues.push({ severity:'low',    title:'No Service Worker detected',            detail:'No service worker registration found. Offline support and caching unavailable.', recommendation:'Register a service worker for offline capability and improved performance.' }); score = deductScore(score, 4); }

  return {
    score: clamp(score),
    issues,
    data: {
      hasViewportMeta: hasViewport,
      viewportContent: viewportMeta,
      hasAppleTouchIcon, hasFavicon,
      smallTapTargets, totalTapTargets,
      smallFontSizeElements: smallFontCount,
      horizontalScrollable: fixedWidthCount > 0,
      hasMediaQueries, mobileFirstCSS: hasMediaQueries,
      touchEventsUsed, fixedWidthElements: fixedWidthCount,
      pwaManifest, serviceWorker, mobileScore: clamp(score),
    },
  };
}

/* ══════════════════════════════════════════════════════════════════
   MODULE 5 — SECURITY AUDIT
══════════════════════════════════════════════════════════════════ */

async function auditSecurity(url, $, html, pageHeaders) {
  const issues = [];
  let score = 100;

  const isHTTPS = url.startsWith('https://');
  const domain  = getDomain(url);

  // Security headers
  const csp             = pageHeaders['content-security-policy'] || $('meta[http-equiv="Content-Security-Policy"]').attr('content') || '';
  const hsts            = pageHeaders['strict-transport-security'] || '';
  const xframe          = pageHeaders['x-frame-options'] || '';
  const xcto            = pageHeaders['x-content-type-options'] || '';
  const referrerPolicy  = pageHeaders['referrer-policy'] || $('meta[name="referrer"]').attr('content') || '';
  const permPolicy      = pageHeaders['permissions-policy'] || '';

  // Mixed content
  const mixedImgs     = $('img[src^="http:"]:not([src^="https:"])').length;
  const mixedScripts  = $('script[src^="http:"]:not([src^="https:"])').length;
  const mixedLinks    = $('link[href^="http:"]:not([href^="https:"])').length;
  const mixedCount    = mixedImgs + mixedScripts + mixedLinks;

  // External scripts
  const extScriptDomains = new Set();
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src.startsWith('http') && !src.includes(domain)) {
      try { extScriptDomains.add(new URL(src).hostname); } catch {}
    }
  });
  const externalScripts = extScriptDomains.size;

  // SRI (subresource integrity)
  const integrityCount = $('script[integrity], link[integrity]').length;

  // Exposed sensitive data
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailMatches = html.match(emailPattern) || [];
  const emailExposed = emailMatches.length > 0;

  const phonePattern = /(\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
  const phoneExposed = phonePattern.test(html);

  // Login form security
  const loginForm       = $('form:has(input[type="password"])');
  const hasLoginForm    = loginForm.length > 0;
  const loginFormHTTPS  = hasLoginForm ? url.startsWith('https://') : true;

  // Server header exposure
  const serverHeader = pageHeaders['server'] || '';
  const serverExposed = serverHeader.length > 0 && (serverHeader.includes('/') || /\d/.test(serverHeader));

  // Detect common libraries and versions (basic heuristic)
  const outdatedLibs = [];
  if (html.includes('jquery-1.') || html.includes('jquery/1.')) outdatedLibs.push('jQuery 1.x (outdated)');
  if (html.includes('jquery-2.') || html.includes('jquery/2.')) outdatedLibs.push('jQuery 2.x (outdated)');
  if (html.includes('bootstrap/3.') || html.includes('bootstrap@3')) outdatedLibs.push('Bootstrap 3.x (outdated)');
  if (html.includes('angular.js') && html.includes('1.')) outdatedLibs.push('AngularJS 1.x (EOL)');

  const openSourceLibs = [];
  if (html.includes('jquery')) openSourceLibs.push('jQuery');
  if (html.includes('bootstrap')) openSourceLibs.push('Bootstrap');
  if (html.includes('react')) openSourceLibs.push('React');
  if (html.includes('vue')) openSourceLibs.push('Vue.js');
  if (html.includes('angular')) openSourceLibs.push('Angular');

  /* ── Scoring ── */
  if (!isHTTPS)                { issues.push({ severity:'high',   title:'Site not using HTTPS',                  detail:'Website loads over HTTP. All data transmitted is unencrypted and vulnerable to interception.', recommendation:'Install an SSL/TLS certificate and redirect all HTTP traffic to HTTPS.' }); score = deductScore(score, 40); }
  if (mixedCount > 0)          { issues.push({ severity:'high',   title:`${mixedCount} mixed content resources`,  detail:`${mixedCount} HTTP resources (${mixedImgs} images, ${mixedScripts} scripts, ${mixedLinks} links) loaded on HTTPS page.`, recommendation:'Update all resource URLs to use HTTPS or protocol-relative URLs (//).' }); score = deductScore(score, 20); }
  if (!csp)                    { issues.push({ severity:'high',   title:'Missing Content Security Policy (CSP)', detail:'No CSP header or meta tag found. Leaves site vulnerable to XSS attacks.', recommendation:'Implement a strict Content-Security-Policy header.' }); score = deductScore(score, 15); }
  if (!hsts)                   { issues.push({ severity:'high',   title:'Missing HTTP Strict Transport Security', detail:'No HSTS header. Browsers can downgrade HTTPS connections to HTTP.', recommendation:'Add Strict-Transport-Security: max-age=31536000; includeSubDomains; preload' }); score = deductScore(score, 12); }
  if (!xframe)                 { issues.push({ severity:'medium', title:'Missing X-Frame-Options header',        detail:'No X-Frame-Options header. Site may be vulnerable to clickjacking.', recommendation:'Add X-Frame-Options: DENY or SAMEORIGIN header.' }); score = deductScore(score, 8); }
  if (!xcto)                   { issues.push({ severity:'medium', title:'Missing X-Content-Type-Options header', detail:'No X-Content-Type-Options header. Browsers may MIME-sniff responses.', recommendation:'Add X-Content-Type-Options: nosniff header.' }); score = deductScore(score, 6); }
  if (!referrerPolicy)         { issues.push({ severity:'low',    title:'Missing Referrer-Policy header',        detail:'No Referrer-Policy header. Full URL may be sent to third parties as referrer.', recommendation:'Add Referrer-Policy: strict-origin-when-cross-origin header.' }); score = deductScore(score, 4); }
  if (!permPolicy)             { issues.push({ severity:'low',    title:'Missing Permissions-Policy header',     detail:'No Permissions-Policy header. Camera/microphone access not restricted.', recommendation:'Add Permissions-Policy header to control browser feature access.' }); score = deductScore(score, 3); }
  if (externalScripts > 8)     { issues.push({ severity:'medium', title:`Scripts from ${externalScripts} external domains`, detail:`External scripts from: ${[...extScriptDomains].join(', ')}. Supply chain risk.`, recommendation:'Audit all third-party scripts. Use SRI attributes and load only necessary scripts.' }); score = deductScore(score, Math.min(externalScripts, 10)); }
  if (integrityCount === 0 && externalScripts > 2) { issues.push({ severity:'medium', title:'No Subresource Integrity (SRI) attributes', detail:'External scripts/styles loaded without integrity checks. Tampered files could execute.', recommendation:'Add integrity and crossorigin attributes to external script and link tags.' }); score = deductScore(score, 5); }
  if (hasLoginForm && !loginFormHTTPS) { issues.push({ severity:'high', title:'Login form on non-HTTPS page',    detail:'Password form found on an HTTP page. Credentials transmitted in plaintext.', recommendation:'Immediately move to HTTPS. SSL certificate is mandatory for login forms.' }); score = deductScore(score, 25); }
  if (serverExposed)           { issues.push({ severity:'low',    title:'Server version disclosed in headers',  detail:`Server header: "${serverHeader}". Exposes server technology and version.`, recommendation:'Configure server to send a generic or empty Server header.' }); score = deductScore(score, 4); }
  if (outdatedLibs.length > 0) { issues.push({ severity:'high',   title:`Outdated libraries detected: ${outdatedLibs.join(', ')}`, detail:'Outdated JavaScript libraries may contain known security vulnerabilities.', recommendation:'Update all libraries to their latest stable versions.' }); score = deductScore(score, outdatedLibs.length * 8); }

  return {
    score: clamp(score),
    issues,
    data: {
      isHTTPS, hasMixedContent: mixedCount > 0, mixedContentCount: mixedCount,
      hasCSP: !!csp, cspContent: csp.slice(0, 200),
      hasHSTS: !!hsts, hasXFrameOptions: !!xframe,
      hasXContentTypeOptions: !!xcto, hasReferrerPolicy: !!referrerPolicy,
      hasPermissionsPolicy: !!permPolicy,
      externalScripts, externalScriptDomains: [...extScriptDomains],
      hasIntegrityAttributes: integrityCount,
      thirdPartyCookies: externalScripts,
      hasLoginForm, loginFormIsHTTPS: loginFormHTTPS,
      outdatedLibraries: outdatedLibs, opensourceLibraries: openSourceLibs,
      emailExposed, phoneExposed, serverHeadersExposed: serverExposed,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════
   MODULE 6 — CONTENT QUALITY
══════════════════════════════════════════════════════════════════ */

async function auditContent(url, $, html) {
  const issues = [];
  let score = 100;

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = countWords(bodyText);

  const allWords = bodyText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const uniqueWords = new Set(allWords);
  const uniqueWordCount = uniqueWords.size;

  const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const avgSentenceLength = sentences.length ? Math.round(wordCount / sentences.length) : 0;

  const paragraphs = $('p').length;

  // Contact info
  const emailPattern  = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phonePattern  = /(\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
  const addressKeywords = /\b(street|st\.|avenue|ave\.|road|rd\.|drive|dr\.|lane|ln\.|boulevard|blvd\.)/i;

  const hasEmail   = emailPattern.test(bodyText);
  const hasPhone   = phonePattern.test(bodyText);
  const hasAddress = addressKeywords.test(bodyText);
  const hasContact = hasEmail || hasPhone || hasAddress;

  // Social links
  const socialPlatforms = [];
  const socialPatterns = {
    Facebook:  /facebook\.com\//,  Twitter:   /twitter\.com\/|x\.com\//,
    Instagram: /instagram\.com\//, LinkedIn:  /linkedin\.com\//,
    YouTube:   /youtube\.com\//,   TikTok:    /tiktok\.com\//,
    Pinterest: /pinterest\.com\//, WhatsApp:  /wa\.me\//,
  };
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    Object.entries(socialPatterns).forEach(([name, regex]) => {
      if (regex.test(href) && !socialPlatforms.includes(name)) socialPlatforms.push(name);
    });
  });

  // Content sections
  const hasAbout       = /about|who we are|our story|our team/i.test(bodyText);
  const hasTestimonials = /testimonial|review|what.*said|customer.*say|client.*say/i.test(bodyText) || $('[class*="testimonial"], [class*="review"]').length > 0;
  const hasBlog        = $('a[href*="blog"], a[href*="/news"], a[href*="/articles"]').length > 0 || /blog|news|articles/i.test($('nav').text());
  const hasFAQ         = /faq|frequently asked|common questions/i.test(bodyText) || $('[class*="faq"], [id*="faq"]').length > 0;
  const hasCTA         = $('a.btn, button.btn, .cta, [class*="cta"], [class*="button"]').length > 0;
  const ctaCount       = $('a[class*="btn"], a[class*="cta"], button[class*="btn"]').length;

  // Media
  const videoCount     = $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
  const hasVideo       = videoCount > 0;
  const hasChat        = html.includes('tawk.to') || html.includes('intercom') || html.includes('crisp') || html.includes('livechat') || $('[class*="chat"]').length > 0;

  // Broken images
  const brokenImgs     = $('img[src=""], img:not([src]), img[src="#"]').length;
  const totalImages    = $('img').length;

  // Copyright year
  const copyrightMatch = bodyText.match(/©\s*(\d{4})|copyright\s*(\d{4})/i);
  const copyrightYear  = copyrightMatch ? (copyrightMatch[1] || copyrightMatch[2]) : '';
  const currentYear    = new Date().getFullYear();
  const contentFreshness = copyrightYear === String(currentYear) ? 'Current' : copyrightYear ? `Last updated ${copyrightYear}` : 'Unknown';

  /* ── Scoring ── */
  if (wordCount < 300)          { issues.push({ severity:'high',   title:'Very thin content (under 300 words)',   detail:`Only ${wordCount} words. Google considers this thin content and may penalise rankings.`, recommendation:'Add high-quality, informative content. Aim for 500+ words on key pages.' }); score = deductScore(score, 20); }
  else if (wordCount < 500)     { issues.push({ severity:'medium', title:`Low word count (${wordCount} words)`,   detail:'Content below 500 words may struggle to rank competitively.', recommendation:'Expand content with more detail, FAQs, or supporting information.' }); score = deductScore(score, 8); }
  if (!hasContact)              { issues.push({ severity:'high',   title:'No contact information found',         detail:'No email, phone, or address detected. Reduces trust and credibility.', recommendation:'Add a contact page or include contact details in the footer.' }); score = deductScore(score, 15); }
  else {
    if (!hasEmail)              { issues.push({ severity:'medium', title:'No email address found',               detail:'No email address detected on the page.', recommendation:'Display a contact email address to improve user trust.' }); score = deductScore(score, 6); }
    if (!hasPhone)              { issues.push({ severity:'low',    title:'No phone number found',                detail:'No phone number detected. Can reduce conversion for local businesses.', recommendation:'Add a phone number if your business accepts calls.' }); score = deductScore(score, 4); }
  }
  if (socialPlatforms.length === 0) { issues.push({ severity:'medium', title:'No social media links found',     detail:'No links to social media profiles detected. Social proof builds trust.', recommendation:'Add links to your active social media profiles.' }); score = deductScore(score, 8); }
  if (!hasTestimonials)         { issues.push({ severity:'medium', title:'No testimonials or reviews found',    detail:'No social proof (testimonials/reviews) detected. These strongly influence conversions.', recommendation:'Add customer testimonials, star ratings, or case studies.' }); score = deductScore(score, 8); }
  if (!hasCTA)                  { issues.push({ severity:'high',   title:'No clear Call-to-Action buttons',     detail:'No CTA buttons detected. Users have no clear next action.', recommendation:'Add prominent CTAs like "Get Started", "Contact Us", or "Buy Now".' }); score = deductScore(score, 15); }
  if (brokenImgs > 0)          { issues.push({ severity:'high',   title:`${brokenImgs} broken images found`,   detail:`${brokenImgs} images have empty or missing src attributes.`, recommendation:'Fix or remove broken image references.' }); score = deductScore(score, Math.min(brokenImgs * 5, 15)); }
  if (paragraphs < 3)          { issues.push({ severity:'medium', title:`Only ${paragraphs} paragraph elements`, detail:'Very little paragraph content. Content may be poorly structured.', recommendation:'Break content into clear paragraphs for readability.' }); score = deductScore(score, 5); }
  if (!hasAbout)               { issues.push({ severity:'low',    title:'No About section detected',           detail:'No "About us" or company story section found.', recommendation:'Add an About section to build trust and brand identity.' }); score = deductScore(score, 4); }
  if (copyrightYear && parseInt(copyrightYear) < currentYear - 1) { issues.push({ severity:'low', title:`Copyright year appears outdated (${copyrightYear})`, detail:'Outdated copyright year can make visitors question if the site is maintained.', recommendation:`Update copyright year to ${currentYear}.` }); score = deductScore(score, 3); }

  return {
    score: clamp(score),
    issues,
    data: {
      wordCount, uniqueWordCount, avgSentenceLength, paragraphCount: paragraphs,
      hasAboutSection: hasAbout, hasContactInfo: hasContact,
      hasPhone, hasEmail, hasAddress, hasSocialLinks: socialPlatforms.length > 0,
      socialPlatforms, hasTestimonials, hasBlog, hasFAQ,
      hasCallToAction: hasCTA, ctaCount, hasVideo, videoCount, hasChat,
      brokenImageCount: brokenImgs, totalImages, spellingIssues: 0,
      duplicateContent: false, contentFreshness, copyrightYear,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════
   MODULE 7 — STRUCTURE & NAVIGATION
══════════════════════════════════════════════════════════════════ */

async function auditStructure(url, $, html) {
  const issues = [];
  let score = 100;

  const hasNav     = $('nav, [role="navigation"]').length > 0;
  const navItems   = $('nav a, [role="navigation"] a').length;
  const hasFooter  = $('footer').length > 0;
  const hasMain    = $('main, [role="main"]').length > 0;
  const hasHeader  = $('header').length > 0;
  const hasSidebar = $('aside, [role="complementary"]').length > 0;
  const hasBreadcrumb = $('[itemtype*="BreadcrumbList"], [aria-label*="breadcrumb"], .breadcrumb, [class*="breadcrumb"]').length > 0;
  const hasSitemapLink = $('a[href*="sitemap"]').length > 0;
  const hasSearch  = $('input[type="search"], input[name="search"], input[name="q"], [role="search"]').length > 0;

  const allLinks   = $('a[href]');
  const totalLinks = allLinks.length;
  const domain     = getDomain(url);

  let internalLinks = 0, externalLinks = 0, brokenAnchorLinks = 0, emptyLinks = 0;
  allLinks.each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href || href === '#')    emptyLinks++;
    else if (href.startsWith('#') && href.length > 1) brokenAnchorLinks++;
    else if (href.startsWith('/') || href.includes(domain)) internalLinks++;
    else if (href.startsWith('http')) externalLinks++;
  });

  const footerLinks = $('footer a').length;
  const menuIsDropdown = $('[class*="dropdown"], [class*="submenu"], [class*="mega-menu"]').length > 0;

  // Check for robots.txt and sitemap.xml
  let hasSitemapXML = false, hasRobotsTxt = false, sitemapPageCount = 0;
  try {
    const robotsRes = await axios.get(`${url.replace(/\/$/, '')}/robots.txt`, { timeout: 5000, validateStatus: () => true });
    hasRobotsTxt = robotsRes.status === 200 && robotsRes.data.includes('User-agent');
    if (hasRobotsTxt && robotsRes.data.includes('Sitemap:')) {
      const sitemapURL = robotsRes.data.match(/Sitemap:\s*(.+)/)?.[1]?.trim();
      if (sitemapURL) {
        const sitemapRes = await axios.get(sitemapURL, { timeout: 8000, validateStatus: () => true });
        hasSitemapXML = sitemapRes.status === 200 && sitemapRes.data.includes('<url>');
        sitemapPageCount = (sitemapRes.data.match(/<url>/g) || []).length;
      }
    }
  } catch {}

  /* ── Scoring ── */
  if (!hasNav)         { issues.push({ severity:'high',   title:'No navigation element found',         detail:'No <nav> element or role="navigation" found. Critical for usability and SEO.', recommendation:'Wrap your main menu in a <nav> element.' }); score = deductScore(score, 20); }
  else if (navItems < 2) { issues.push({ severity:'medium', title:'Navigation has very few links',      detail:`Only ${navItems} links in navigation. Users may struggle to find content.`, recommendation:'Add key page links to your navigation menu.' }); score = deductScore(score, 8); }
  if (!hasFooter)      { issues.push({ severity:'medium', title:'No footer element found',             detail:'No <footer> element. Footers typically contain important links and contact info.', recommendation:'Add a <footer> element with contact info, links, and copyright.' }); score = deductScore(score, 10); }
  if (!hasMain)        { issues.push({ severity:'medium', title:'No <main> element found',             detail:'No <main> or role="main" landmark. Important for accessibility and SEO.', recommendation:'Wrap your primary content in a <main> element.' }); score = deductScore(score, 10); }
  if (!hasHeader)      { issues.push({ severity:'low',    title:'No <header> element found',           detail:'No <header> element detected.', recommendation:'Use a <header> element for the top section of your page.' }); score = deductScore(score, 5); }
  if (!hasBreadcrumb)  { issues.push({ severity:'low',    title:'No breadcrumb navigation',            detail:'No breadcrumb trail found. Helps users understand their location on the site.', recommendation:'Add breadcrumb navigation with BreadcrumbList structured data.' }); score = deductScore(score, 5); }
  if (!hasSearch)      { issues.push({ severity:'low',    title:'No site search functionality',        detail:'No search input found. Large sites benefit from an internal search feature.', recommendation:'Add a site search bar to help users find content quickly.' }); score = deductScore(score, 4); }
  if (emptyLinks > 5)  { issues.push({ severity:'medium', title:`${emptyLinks} empty/dead links (#)`,  detail:`${emptyLinks} links pointing to # or empty href.`, recommendation:'Fix or remove placeholder links that don\'t lead anywhere.' }); score = deductScore(score, Math.min(emptyLinks, 10)); }
  if (!hasRobotsTxt)   { issues.push({ severity:'medium', title:'No robots.txt file found',           detail:'robots.txt not found or inaccessible. Search engines will crawl everything by default.', recommendation:'Create a robots.txt file to guide search engine crawlers.' }); score = deductScore(score, 8); }
  if (!hasSitemapXML)  { issues.push({ severity:'medium', title:'No XML sitemap found',               detail:'No XML sitemap detected via robots.txt. Search engines may miss pages.', recommendation:'Create an XML sitemap and submit it to Google Search Console.' }); score = deductScore(score, 10); }

  return {
    score: clamp(score),
    issues,
    data: {
      hasNav, navItemCount: navItems, hasFooter, hasMain, hasHeader, hasSidebar,
      hasBreadcrumb, hasSitemapLink, hasSitemapXML, hasRobotsTxt,
      totalLinks, internalLinks, externalLinks, brokenAnchorLinks, emptyLinks,
      maxDepth: 3, hasSearch, has404Page: false, menuIsDropdown,
      footerNavLinks: footerLinks, sitemapPageCount,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════
   MODULE 8 — UI / UX AUDIT
══════════════════════════════════════════════════════════════════ */

async function auditUI(url, $, html) {
  const issues = [];
  let score = 100;

  const hasCTA       = $('a[class*="btn"], a[class*="cta"], button[class*="btn"], [class*="call-to-action"]').length > 0;
  const ctaCount     = $('a[class*="btn"], a[class*="cta"], button[class*="btn"]').length;
  const hasHero      = $('[class*="hero"], [class*="banner"], [class*="jumbotron"], [class*="masthead"]').length > 0;
  const hasSlider    = $('[class*="slider"], [class*="carousel"], [class*="swiper"]').length > 0;
  const hasModal     = $('[class*="modal"], [role="dialog"]').length > 0;
  const hasTabs      = $('[class*="tabs"], [role="tablist"]').length > 0;
  const hasAccordion = $('[class*="accordion"], [class*="collapse"]').length > 0;
  const hasAnimations = html.includes('@keyframes') || html.includes('animation:') || html.includes('transition:') || $('[class*="animate"], [class*="wow"], [class*="aos"]').length > 0;
  const hasLazyLoad  = $('img[loading="lazy"], img[data-src], img[data-lazy]').length > 0 || html.includes('loading="lazy"');
  const hasLogoImg   = $('a img, header img, [class*="logo"] img').length > 0;

  const googleFonts  = new Set();
  $('link[href*="fonts.googleapis"]').each((_, el) => {
    const m = $(el).attr('href')?.match(/family=([^&:]+)/);
    if (m) googleFonts.add(m[1].replace(/\+/g, ' '));
  });
  const inlineStyles = $('[style]').length;
  const cssFiles     = $('link[rel="stylesheet"]').length;
  const jsFiles      = $('script[src]').length;

  const inputsWithPlaceholder = $('input[placeholder]').length;
  const totalInputs = $('input:not([type="hidden"])').length;
  const hasPlaceholders = totalInputs > 0 ? inputsWithPlaceholder > 0 : true;

  const formValidation = html.includes('required') || html.includes('pattern=') || html.includes('novalidate') || $('form[novalidate]').length > 0;

  const hasLoading = html.includes('loading') && (html.includes('spinner') || html.includes('skeleton'));

  const aboveTheFoldImgs = $('img').slice(0, 3).length;
  const htmlSize = Math.round(html.length / 1024);

  let colorScheme = 'Unknown';
  const bodyStyle = $('body').attr('style') || '';
  if (html.includes('dark') || bodyStyle.includes('background: #0') || bodyStyle.includes('background-color: #0')) colorScheme = 'Dark';
  else if (html.includes('light-mode') || bodyStyle.includes('background: #f') || bodyStyle.includes('background-color: #fff')) colorScheme = 'Light';

  /* ── Scoring ── */
  if (!hasCTA)          { issues.push({ severity:'high',   title:'No call-to-action buttons found',      detail:'No CTA buttons detected. Users have no clear conversion path.', recommendation:'Add prominent CTAs above the fold: "Get Started", "Book Now", "Contact Us".' }); score = deductScore(score, 20); }
  if (!hasHero)         { issues.push({ severity:'medium', title:'No hero/banner section detected',      detail:'No hero section found. First impressions are critical for user retention.', recommendation:'Add a compelling hero section with headline, subheading, and CTA.' }); score = deductScore(score, 10); }
  if (!hasLogoImg)      { issues.push({ severity:'medium', title:'No logo image detected',               detail:'No logo image found in header or nav. Essential for brand identity.', recommendation:'Add a logo image in the header area.' }); score = deductScore(score, 8); }
  if (!hasLazyLoad)     { issues.push({ severity:'medium', title:'No lazy loading on images',            detail:'Images not lazy loaded. All images load at once, slowing initial page load.', recommendation:'Add loading="lazy" attribute to all below-the-fold images.' }); score = deductScore(score, 8); }
  if (googleFonts.size > 3) { issues.push({ severity:'low', title:`${googleFonts.size} Google Font families loaded`, detail:`Loading ${googleFonts.size} font families (${[...googleFonts].join(', ')}) increases render-blocking requests.`, recommendation:'Limit to 1-2 font families. Subset fonts and use font-display: swap.' }); score = deductScore(score, 5); }
  if (inlineStyles > 80) { issues.push({ severity:'low',   title:`${inlineStyles} elements with inline styles`, detail:'Excessive inline styles make maintenance harder and increase HTML size.', recommendation:'Move inline styles to external CSS classes.' }); score = deductScore(score, 5); }
  if (cssFiles > 12)    { issues.push({ severity:'medium', title:`${cssFiles} CSS files loaded`,         detail:'Too many separate CSS files increase HTTP requests.', recommendation:'Bundle and minify CSS files into one or two files.' }); score = deductScore(score, 6); }
  if (jsFiles > 20)     { issues.push({ severity:'medium', title:`${jsFiles} JavaScript files loaded`,   detail:'Too many JS files increase parse time and HTTP requests.', recommendation:'Bundle JavaScript using a module bundler like Webpack or Vite.' }); score = deductScore(score, 6); }
  if (!hasAnimations)   { issues.push({ severity:'low',    title:'No CSS animations or transitions',     detail:'No visual feedback on interactions detected. Can feel static and dated.', recommendation:'Add subtle CSS transitions and animations to improve UX.' }); score = deductScore(score, 3); }
  if (!hasPlaceholders && totalInputs > 0) { issues.push({ severity:'low', title:'Form inputs lack placeholder text', detail:'No placeholder attributes found on input fields.', recommendation:'Add helpful placeholder text to guide users in filling forms.' }); score = deductScore(score, 3); }

  return {
    score: clamp(score),
    issues,
    data: {
      hasCTA, ctaButtonCount: ctaCount, hasHeroSection: hasHero,
      googleFontsCount: googleFonts.size, inlineStyleCount: inlineStyles,
      cssFileCount: cssFiles, jsFileCount: jsFiles,
      hasAnimations, hasLazyLoading: hasLazyLoad, hasProgressiveLoad: hasLoading,
      colorScheme, hasLogoImage: hasLogoImg, hasSlider, hasModal, hasTabs,
      hasAccordion, inputPlaceholders: hasPlaceholders, formValidation,
      hasLoading, aboveTheFoldImages: aboveTheFoldImgs, totalHTMLSize: htmlSize,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════
   MODULE 9 — TECHNICAL AUDIT
══════════════════════════════════════════════════════════════════ */

async function auditTechnical(url, $, html, pageHeaders, loadTime) {
  const issues = [];
  let score = 100;

  const rawHTML = $.html() || '';
  const hasDoctype   = rawHTML.trimStart().toLowerCase().startsWith('<!doctype html');
  const charsetMeta  = $('meta[charset]').attr('charset') || $('meta[http-equiv="content-type"]').attr('content') || '';
  const hasCharset   = charsetMeta.length > 0;
  const charset      = charsetMeta || 'Not found';

  const hasRobotsMeta  = $('meta[name="robots"]').length > 0;
  const robotsContent  = $('meta[name="robots"]').attr('content') || '';
  const hasCanonical   = $('link[rel="canonical"]').length > 0;
  const canonicalURL   = $('link[rel="canonical"]').attr('href') || '';

  // Structured data
  const sdScripts = $('script[type="application/ld+json"]');
  const schemaTypes = [];
  sdScripts.each((_, el) => {
    try {
      const obj = JSON.parse($(el).html() || '{}');
      const type = obj['@type'];
      if (Array.isArray(type)) schemaTypes.push(...type);
      else if (type) schemaTypes.push(type);
      if (obj['@graph']) obj['@graph'].forEach(g => g['@type'] && schemaTypes.push(g['@type']));
    } catch {}
  });

  // Analytics & Tag Managers
  const hasGTM      = html.includes('googletagmanager.com/gtm.js') || html.includes('GTM-');
  const hasGA       = html.includes('google-analytics.com') || html.includes('gtag/js') || html.includes('UA-') || html.includes('G-');
  const gaProperty  = html.match(/UA-\d{4,}-\d+|G-[A-Z0-9]{10}/)?.[0] || '';
  const hasFBPixel  = html.includes('connect.facebook.net') || html.includes('fbq(');
  const hasCookieBanner = $('[class*="cookie"], [id*="cookie"], [class*="gdpr"], [id*="gdpr"]').length > 0;

  // CMS / Framework detection
  let cmsDetected = 'Custom';
  if (html.includes('wp-content') || html.includes('wp-includes')) cmsDetected = 'WordPress';
  else if (html.includes('Shopify') || html.includes('shopify')) cmsDetected = 'Shopify';
  else if (html.includes('wix.com') || html.includes('_wix_')) cmsDetected = 'Wix';
  else if (html.includes('squarespace')) cmsDetected = 'Squarespace';
  else if (html.includes('webflow')) cmsDetected = 'Webflow';
  else if (html.includes('joomla')) cmsDetected = 'Joomla';
  else if (html.includes('drupal')) cmsDetected = 'Drupal';
  else if (html.includes('ghost')) cmsDetected = 'Ghost';
  else if (html.includes('next.js') || html.includes('__NEXT_DATA__')) cmsDetected = 'Next.js';
  else if (html.includes('nuxt') || html.includes('__NUXT__')) cmsDetected = 'Nuxt.js';

  let frameworkDetected = 'Unknown';
  if (html.includes('react') || html.includes('__react')) frameworkDetected = 'React';
  else if (html.includes('vue') || html.includes('__vue__')) frameworkDetected = 'Vue.js';
  else if (html.includes('angular')) frameworkDetected = 'Angular';
  else if (html.includes('svelte')) frameworkDetected = 'Svelte';

  const serverHeader = pageHeaders['server'] || 'Unknown';

  // DOM complexity
  const totalDOMNodes = $('*').length;
  const domDepth = (() => {
    let maxD = 0;
    function traverse(el, d) {
      if (d > maxD) maxD = d;
      $(el).children().each((_, c) => traverse(c, d + 1));
    }
    traverse($('html')[0], 0);
    return maxD;
  })();

  const urlObj      = (() => { try { return new URL(url); } catch { return null; } })();
  const urlStructure = urlObj ? urlObj.pathname : '/';
  const hasCleanURLs = urlObj ? !urlObj.pathname.includes('?') && !urlObj.pathname.includes('.php') && !urlObj.pathname.includes('.asp') : true;

  const hasHreflang   = $('link[rel="alternate"][hreflang]').length > 0;
  const hasXMLSitemap = html.includes('sitemap.xml');
  const hasImageSitemap = html.includes('image-sitemap') || html.includes('image/sitemap');

  /* ── Scoring ── */
  if (!hasDoctype)      { issues.push({ severity:'high',   title:'Missing HTML5 DOCTYPE declaration',   detail:'DOCTYPE not found or not HTML5. Triggers browser quirks mode.', recommendation:'Add <!DOCTYPE html> as the very first line of your HTML document.' }); score = deductScore(score, 20); }
  if (!hasCharset)      { issues.push({ severity:'high',   title:'Missing charset meta tag',            detail:'No character encoding declared. May cause character rendering issues.', recommendation:'Add <meta charset="UTF-8"> in the <head> section.' }); score = deductScore(score, 12); }
  if (schemaTypes.length === 0) { issues.push({ severity:'medium', title:'No structured data markup',   detail:'No Schema.org JSON-LD found. Missing opportunity for rich search results.', recommendation:'Add Organization, WebSite, BreadcrumbList, or Product schema markup.' }); score = deductScore(score, 10); }
  if (!hasGTM && !hasGA) { issues.push({ severity:'medium', title:'No analytics tracking detected',    detail:'No Google Tag Manager or Google Analytics detected.', recommendation:'Install Google Analytics 4 (GA4) via Google Tag Manager.' }); score = deductScore(score, 8); }
  if (!hasCookieBanner && (hasGA || hasFBPixel)) { issues.push({ severity:'medium', title:'Analytics without cookie consent banner', detail:'Tracking scripts present but no cookie consent mechanism detected. Potential GDPR violation.', recommendation:'Implement a cookie consent banner that requires opt-in before loading tracking scripts.' }); score = deductScore(score, 8); }
  if (totalDOMNodes > 1500) { issues.push({ severity:'medium', title:`Excessive DOM size (${totalDOMNodes} nodes)`, detail:'Very large DOM increases memory usage and slows rendering.', recommendation:'Reduce DOM nodes. Aim for under 1500 total elements.' }); score = deductScore(score, 8); }
  else if (totalDOMNodes > 800) { issues.push({ severity:'low', title:`Large DOM size (${totalDOMNodes} nodes)`, detail:'DOM size is large. Consider optimisation.', recommendation:'Aim for under 800 DOM nodes for optimal performance.' }); score = deductScore(score, 4); }
  if (!hasCleanURLs)    { issues.push({ severity:'medium', title:'URL structure is not SEO-friendly',   detail:'URL contains query strings, .php or .asp extensions which are not clean.', recommendation:'Use clean, descriptive URLs without file extensions or query parameters.' }); score = deductScore(score, 6); }
  if (!hasHreflang && (html.includes('lang=') || $('html').attr('lang'))) { issues.push({ severity:'low', title:'No hreflang tags for international targeting', detail:'No hreflang attributes found. If targeting multiple languages/regions, these are important.', recommendation:'Add hreflang tags for each language/region version of your pages.' }); score = deductScore(score, 4); }

  return {
    score: clamp(score),
    issues,
    data: {
      hasDoctype, hasCharset, charset, htmlVersion: 'HTML5',
      hasRobotsMeta, robotsMetaContent: robotsContent,
      hasSchemaMarkup: schemaTypes.length > 0, schemaTypes,
      hasGTM, hasGA, hasGAProperty: gaProperty, hasFacebookPixel: hasFBPixel,
      hasCookieBanner, hasCanonical, canonicalURL,
      has404Detection: false, redirectChain: 0,
      urlStructure, hasCleanURLs, totalDOMNodes, domDepth,
      cmsDetected, frameworkDetected, serverDetected: serverHeader,
      pageGenerationTime: loadTime,
      hasHreflang, hasXMLSitemap, hasImageSitemap,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════
   AI REPORT GENERATION (GROQ)
══════════════════════════════════════════════════════════════════ */

async function generateAIReport(url, scores, allIssues, moduleData) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const sortedIssues = [...allIssues].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  const overallScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length);

  const issuesSummary = sortedIssues.slice(0, 25).map(i =>
    `[${i.severity.toUpperCase()}][${i.module}] ${i.title}: ${i.detail}`
  ).join('\n');

  const scoresSummary = Object.entries(scores)
    .map(([k, v]) => `${k.toUpperCase()}: ${v}/100`)
    .join(' | ');

  const prompt = `You are a senior web performance and SEO consultant. Provide a detailed, actionable audit report.

WEBSITE: ${url}
OVERALL SCORE: ${overallScore}/100
MODULE SCORES: ${scoresSummary}

ISSUES FOUND (${allIssues.length} total):
${issuesSummary}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "summary": "3-4 sentence executive summary of the website's current state",
  "overallScore": ${overallScore},
  "executiveSummary": "2-3 sentences on business impact and urgency",
  "businessImpact": "1-2 sentences on revenue/traffic impact of current issues",
  "estimatedFixTime": "e.g. 2-3 days for critical fixes, 2 weeks for full remediation",
  "strengths": ["5-7 specific things working well on this website"],
  "criticalIssues": ["top 5 most impactful problems that need immediate attention"],
  "recommendations": [
    {
      "priority": "high",
      "module": "seo",
      "action": "Specific, actionable step",
      "impact": "Measurable expected result",
      "effort": "low|medium|high",
      "timeToFix": "e.g. 30 minutes"
    }
  ],
  "moduleInsights": {
    "seo": "2 sentence insight with specific data points",
    "performance": "2 sentence insight with specific data points",
    "accessibility": "2 sentence insight with specific data points",
    "security": "2 sentence insight with specific data points",
    "mobile": "2 sentence insight with specific data points",
    "content": "2 sentence insight with specific data points",
    "structure": "2 sentence insight with specific data points",
    "ui": "2 sentence insight with specific data points",
    "technical": "2 sentence insight with specific data points"
  },
  "priorityMatrix": {
    "doFirst": ["quick wins that have high impact and low effort"],
    "planFor": ["important but require more effort"],
    "delegate": ["lower priority improvements"],
    "ignore": ["not applicable for this site type"]
  }
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 3000,
    });

    const text = completion.choices[0]?.message?.content || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('[AI] Report generation failed:', err.message);
    return {
      summary: `Website audit complete for ${url}. Overall score: ${overallScore}/100. Found ${allIssues.length} issues across 9 modules.`,
      overallScore,
      executiveSummary: 'Manual review recommended.',
      businessImpact: 'Issues identified may impact search rankings and user experience.',
      estimatedFixTime: 'Varies by issue complexity.',
      strengths: ['Site is accessible'],
      criticalIssues: sortedIssues.filter(i => i.severity === 'high').slice(0, 5).map(i => i.title),
      recommendations: sortedIssues.slice(0, 6).map(i => ({
        priority: i.severity,
        module: i.module,
        action: i.recommendation || i.detail,
        impact: 'Improves overall score',
        effort: 'medium',
        timeToFix: '1-2 hours',
      })),
      moduleInsights: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, `Score: ${v}/100.`])),
      priorityMatrix: { doFirst: [], planFor: [], delegate: [], ignore: [] },
    };
  }
}

/* ══════════════════════════════════════════════════════════════════
   ORCHESTRATOR — runFullAudit
══════════════════════════════════════════════════════════════════ */

async function runFullAudit(rawUrl) {
  const url    = normaliseURL(rawUrl);
  const domain = getDomain(url);
  const start  = Date.now();

  // Create pending record
  const record = await FullAudit.create({ url, domain, status: 'running' });

  try {
    // Fetch page
    const { html, status, headers, loadTime, finalURL, redirectCount } = await fetchPage(url);
    const $ = cheerio.load(html);

    // Run all 9 modules in parallel
    const [seoR, perfR, a11yR, mobileR, secR, contentR, structR, uiR, techR] = await Promise.all([
      auditSEO(url, $, html, headers),
      auditPerformance(url, $, html, headers, loadTime),
      auditAccessibility(url, $, html),
      auditMobile(url, $, html, headers),
      auditSecurity(url, $, html, headers),
      auditContent(url, $, html),
      auditStructure(url, $, html),
      auditUI(url, $, html),
      auditTechnical(url, $, html, headers, loadTime),
    ]);

    const moduleMap = {
      seo: seoR, performance: perfR, accessibility: a11yR,
      mobile: mobileR, security: secR, content: contentR,
      structure: structR, ui: uiR, technical: techR,
    };

    const scores = {};
    const allIssues = [];
    const moduleData = {};

    for (const [mod, result] of Object.entries(moduleMap)) {
      scores[mod] = result.score;
      moduleData[mod] = result.data;
      result.issues.forEach(issue => allIssues.push({ ...issue, module: mod }));
    }

    const overallScore = clamp(
      Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 9)
    );

    const issueCount = {
      high:   allIssues.filter(i => i.severity === 'high').length,
      medium: allIssues.filter(i => i.severity === 'medium').length,
      low:    allIssues.filter(i => i.severity === 'low').length,
      total:  allIssues.length,
    };

    await FullAudit.findByIdAndUpdate(record._id, {
      status: 'completed',
      scores,
      overallScore,
      issues: allIssues,
      issueCount,
      moduleData,
      meta: {
        auditDurationMs: Date.now() - start,
        htmlSize: Math.round(html.length / 1024),
        httpStatus: status,
        redirectCount,
        finalURL,
        pageLoadTime: loadTime,
      },
    });

    return {
      auditId: record._id.toString(),
      scores,
      overallScore,
      issueCount,
      issues: allIssues,
    };

  } catch (err) {
    await FullAudit.findByIdAndUpdate(record._id, {
      status: 'failed',
      errorMessage: err.message,
    });
    throw err;
  }
}

/* ══════════════════════════════════════════════════════════════════
   getAIReport — generates & caches AI analysis
══════════════════════════════════════════════════════════════════ */

async function getAIReport(auditId) {
  const audit = await FullAudit.findById(auditId);
  if (!audit) throw new Error('Audit not found');
  if (audit.status !== 'completed') throw new Error('Audit not yet complete');

  // Return cached
  if (audit.aiReport?.summary) return audit.aiReport;

  const report = await generateAIReport(audit.url, audit.scores.toObject(), audit.issues, audit.moduleData);
  report.generatedAt = new Date();

  await FullAudit.findByIdAndUpdate(auditId, { aiReport: report });
  return report;
}

/* ══════════════════════════════════════════════════════════════════
   getReport — fetch full audit record
══════════════════════════════════════════════════════════════════ */

async function getReport(auditId) {
  const audit = await FullAudit.findById(auditId).lean();
  if (!audit) throw new Error('Audit not found');
  return audit;
}

module.exports = { runFullAudit, getAIReport, getReport };