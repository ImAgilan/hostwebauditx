'use strict';
/**
 * modules/structure-navigation/service/structureNavigation.service.js
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const https   = require('https');
const { URL } = require('url');
const StructureNavigation = require('../model/structureNavigation.model');
const { generateAIReport } = require('../../../shared/services/ai.service');

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */

const USER_AGENT =
  'Mozilla/5.0 (compatible; WebAuditXBot/1.0; +https://webauditx.com)';

function normalizeUrl(raw) {
  try {
    if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
    const u = new URL(raw);
    return u.origin + u.pathname.replace(/\/$/, '') || '/';
  } catch {
    return raw;
  }
}

function isSameDomain(link, base) {
  try {
    return new URL(link).hostname === new URL(base).hostname;
  } catch {
    return false;
  }
}

function resolveLink(href, base) {
  try {
    return new URL(href, base).href.split('#')[0].split('?')[0];
  } catch {
    return null;
  }
}

function stripTrailingSlash(u) {
  return u.replace(/\/$/, '') || '/';
}

async function fetchPage(url, timeout = 12000) {
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout,
      maxRedirects: 5,
      validateStatus: () => true,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
    return { status: res.status, html: res.data, headers: res.headers, ok: res.status < 400 };
  } catch (e) {
    return { status: 0, html: '', headers: {}, ok: false, error: e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   CRAWL  (BFS, max 40 pages, depth 4)
═══════════════════════════════════════════════════════ */
async function crawlSite(baseUrl, maxPages = 40, maxDepth = 4) {
  const visited   = new Set();
  const queue     = [{ url: stripTrailingSlash(baseUrl), depth: 0 }];
  const pages     = [];
  const start     = Date.now();

  while (queue.length && pages.length < maxPages) {
    const { url, depth } = queue.shift();
    if (visited.has(url) || depth > maxDepth) continue;
    visited.add(url);

    const { status, html, ok } = await fetchPage(url);
    const page = {
      url, depth, statusCode: status,
      title: '', internalLinks: [], externalLinks: [],
      hasCanonical: false, hasBreadcrumb: false,
      metaDescription: '', h1Count: 0, wordCount: 0, isOrphaned: false,
    };

    if (html && typeof html === 'string') {
      const $ = cheerio.load(html);
      page.title           = $('title').first().text().trim().slice(0, 120);
      page.metaDescription = $('meta[name="description"]').attr('content') || '';
      page.hasCanonical    = !!$('link[rel="canonical"]').length;
      page.hasBreadcrumb   = !!(
        $('[itemtype*="BreadcrumbList"]').length ||
        $('[typeof="BreadcrumbList"]').length ||
        $('nav[aria-label*="breadcrumb" i]').length ||
        $('[class*="breadcrumb" i]').length
      );
      page.h1Count  = $('h1').length;
      page.wordCount= $('body').text().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
        const resolved = resolveLink(href, url);
        if (!resolved) return;
        if (isSameDomain(resolved, baseUrl)) {
          const clean = stripTrailingSlash(resolved);
          if (!visited.has(clean) && depth < maxDepth) {
            queue.push({ url: clean, depth: depth + 1 });
          }
          if (!page.internalLinks.includes(clean)) page.internalLinks.push(clean);
        } else {
          if (!page.externalLinks.includes(resolved)) page.externalLinks.push(resolved.slice(0, 200));
        }
      });
    }
    pages.push(page);
  }

  // Mark orphaned pages (no inbound links from other pages)
  const allLinked = new Set(pages.flatMap(p => p.internalLinks));
  pages.forEach(p => {
    if (!allLinked.has(p.url) && p.url !== stripTrailingSlash(baseUrl)) {
      p.isOrphaned = true;
    }
  });

  return { pages, crawlDuration: Date.now() - start };
}

/* ═══════════════════════════════════════════════════════
   SITEMAP + ROBOTS
═══════════════════════════════════════════════════════ */
async function checkSitemapRobots(baseUrl) {
  const origin = new URL(baseUrl).origin;
  const [sitemapRes, robotsRes] = await Promise.all([
    fetchPage(`${origin}/sitemap.xml`),
    fetchPage(`${origin}/robots.txt`),
  ]);
  return {
    sitemapFound:  sitemapRes.status === 200,
    sitemapUrl:    sitemapRes.status === 200 ? `${origin}/sitemap.xml` : '',
    robotsTxtFound: robotsRes.status === 200,
    robotsTxtUrl:  robotsRes.status === 200 ? `${origin}/robots.txt` : '',
  };
}

/* ═══════════════════════════════════════════════════════
   NAVIGATION ANALYSIS
═══════════════════════════════════════════════════════ */
async function analyzeNavigation(baseUrl) {
  const { html } = await fetchPage(baseUrl);
  if (!html) return { mainNavLinksTotal: 0, brokenNavLinks: [], hasMegaMenu: false, hasMobileMenu: false, hasSkipLinks: false, menuDepth: 0, navStructureScore: 0 };
  const $ = cheerio.load(html);

  const navLinks = [];
  $('nav a[href], header a[href], [role="navigation"] a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) navLinks.push(href);
  });

  const hasMegaMenu   = !!$('[class*="mega" i], [class*="dropdown" i] [class*="dropdown" i]').length;
  const hasMobileMenu = !!$('[class*="mobile-menu" i], [class*="hamburger" i], [id*="mobile-nav" i], button[aria-label*="menu" i]').length;
  const hasSkipLinks  = !!$('a[href="#main"], a[href="#content"], a[href="#main-content"]').length;

  // Estimate menu depth
  let menuDepth = 1;
  $('nav ul ul').each(() => { menuDepth = Math.max(menuDepth, 2); });
  $('nav ul ul ul').each(() => { menuDepth = Math.max(menuDepth, 3); });

  const navScore = Math.min(100,
    (navLinks.length > 3 ? 20 : 10) +
    (hasMobileMenu ? 20 : 0) +
    (hasSkipLinks ? 20 : 0) +
    (menuDepth <= 3 ? 20 : 10) +
    (navLinks.length > 0 ? 20 : 0)
  );

  return {
    mainNavLinksTotal: navLinks.length,
    brokenNavLinks: [],
    hasMegaMenu,
    hasMobileMenu,
    hasSkipLinks,
    menuDepth,
    navStructureScore: navScore,
  };
}

/* ═══════════════════════════════════════════════════════
   BREADCRUMB ANALYSIS
═══════════════════════════════════════════════════════ */
function analyzeBreadcrumbs(pages) {
  const withBreadcrumb = pages.filter(p => p.hasBreadcrumb);
  const schemaFound = pages.some(p =>
    p.hasBreadcrumb
  );
  const score = pages.length === 0 ? 0 : Math.round((withBreadcrumb.length / pages.length) * 100);
  return {
    found: withBreadcrumb.length > 0,
    schemaMarkupFound: schemaFound,
    schemaType: schemaFound ? 'BreadcrumbList' : '',
    sampleBreadcrumb: '',
    pagesWithBreadcrumb: withBreadcrumb.length,
    breadcrumbScore: score,
  };
}

/* ═══════════════════════════════════════════════════════
   URL STRUCTURE
═══════════════════════════════════════════════════════ */
function analyzeUrls(pages) {
  let seoFriendly = 0, nonSeoFriendly = 0, totalLen = 0, withParams = 0, withUpper = 0, withSpecial = 0;
  const badUrls = [];
  pages.forEach(p => {
    try {
      const u = new URL(p.url);
      const path = u.pathname;
      totalLen += path.length;
      if (/[A-Z]/.test(path))        { withUpper++;   if (badUrls.length < 5) badUrls.push(p.url); }
      if (/[^a-z0-9\-\/\.]/.test(path)) { withSpecial++; if (badUrls.length < 5) badUrls.push(p.url); }
      if (u.search)                   { withParams++;  if (badUrls.length < 5) badUrls.push(p.url); }
      if (path.length < 60 && !/[A-Z]/.test(path) && !/\?/.test(p.url)) seoFriendly++;
      else nonSeoFriendly++;
    } catch {}
  });
  const urlScore = pages.length === 0 ? 0 :
    Math.max(0, 100 - Math.round((nonSeoFriendly / pages.length) * 100));

  return {
    seoFriendlyCount: seoFriendly,
    nonSeoFriendlyCount: nonSeoFriendly,
    avgUrlLength: pages.length ? Math.round(totalLen / pages.length) : 0,
    urlsWithParameters: withParams,
    urlsWithUppercase: withUpper,
    urlsWithSpecialChars: withSpecial,
    urlScore,
    sampleBadUrls: [...new Set(badUrls)].slice(0, 5),
  };
}

/* ═══════════════════════════════════════════════════════
   INTERNAL LINKING
═══════════════════════════════════════════════════════ */
function analyzeInternalLinking(pages) {
  const totalLinks = pages.reduce((s, p) => s + p.internalLinks.length, 0);
  const orphaned   = pages.filter(p => p.isOrphaned).map(p => p.url);
  const deepPages  = pages.filter(p => p.depth >= 4).map(p => p.url);
  const avg        = pages.length ? (totalLinks / pages.length).toFixed(1) : 0;
  const score      = Math.min(100, Math.max(0,
    100 - orphaned.length * 5 - deepPages.length * 3
  ));
  return {
    totalInternalLinks: totalLinks,
    avgLinksPerPage: parseFloat(avg),
    orphanedPages: orphaned.slice(0, 10),
    deepPages: deepPages.slice(0, 10),
    linkEquityScore: Math.round(score),
  };
}

/* ═══════════════════════════════════════════════════════
   BROKEN LINKS (check sample)
═══════════════════════════════════════════════════════ */
async function checkBrokenLinks(pages) {
  const allInternal = [...new Set(pages.flatMap(p => p.internalLinks))].slice(0, 20);
  const results = await Promise.allSettled(
    allInternal.map(url => fetchPage(url, 8000))
  );
  const broken404 = [], redir3xx = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      if (r.value.status === 404) broken404.push(allInternal[i]);
      else if (r.value.status >= 300 && r.value.status < 400) redir3xx.push(allInternal[i]);
    }
  });
  return {
    total404: broken404.length,
    total3xx: redir3xx.length,
    brokenUrls: broken404.slice(0, 10),
    redirectChains: redir3xx.slice(0, 5),
  };
}

/* ═══════════════════════════════════════════════════════
   BLOG DETECTION
═══════════════════════════════════════════════════════ */
async function detectBlog(baseUrl, pages) {
  const blogPatterns = ['/blog', '/news', '/articles', '/posts', '/updates', '/resources'];
  let blogUrl = '';
  let found = false;

  for (const pat of blogPatterns) {
    if (pages.some(p => p.url.includes(pat))) {
      found = true;
      blogUrl = pages.find(p => p.url.includes(pat))?.url || '';
      break;
    }
  }

  if (!found) {
    const origin = new URL(baseUrl).origin;
    for (const pat of blogPatterns) {
      const r = await fetchPage(origin + pat, 6000);
      if (r.status === 200) { found = true; blogUrl = origin + pat; break; }
    }
  }

  let hasPagination = false, hasCategories = false, hasTags = false, postCount = 0;
  if (found && blogUrl) {
    const { html } = await fetchPage(blogUrl);
    if (html) {
      const $ = cheerio.load(html);
      hasPagination  = !!$('[class*="pagination" i], [rel="next"]').length;
      hasCategories  = !!$('[class*="categor" i], [class*="cat-" i]').length;
      hasTags        = !!$('[class*="tag" i]').length;
      postCount      = $('article, [class*="post" i], [class*="blog-item" i]').length;
    }
  }

  return { found, blogUrl, postCount, hasPagination, hasCategories, hasTags, lastPostDate: '' };
}

/* ═══════════════════════════════════════════════════════
   PAGINATION
═══════════════════════════════════════════════════════ */
function analyzePagination(pages) {
  // simplified: count pages that look like paginated (page-2, ?page=)
  const paginated = pages.filter(p =>
    /page[=\-\/]\d/i.test(p.url) || /\/\d+\/?$/.test(p.url)
  );
  return {
    paginatedPages: paginated.length,
    hasRelNextPrev: false,
    hasCanonicalOnPaginated: paginated.some(p => p.hasCanonical),
  };
}

/* ═══════════════════════════════════════════════════════
   DUPLICATE CONTENT (simple title similarity)
═══════════════════════════════════════════════════════ */
function analyzeDuplicateContent(pages) {
  const pairs = [];
  const titles = pages.map(p => p.title.toLowerCase().trim());
  for (let i = 0; i < titles.length; i++) {
    for (let j = i + 1; j < titles.length; j++) {
      if (titles[i] && titles[j] && titles[i] === titles[j] && pages[i].url !== pages[j].url) {
        pairs.push({ url1: pages[i].url, url2: pages[j].url, similarity: 100 });
      }
    }
  }
  return { suspectedDuplicates: pairs.length, duplicatePairs: pairs.slice(0, 5) };
}

/* ═══════════════════════════════════════════════════════
   SECURITY ANALYSIS
═══════════════════════════════════════════════════════ */
async function analyzeSecurityHeaders(baseUrl) {
  const { headers, status, html } = await fetchPage(baseUrl);
  const h = Object.fromEntries(
    Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );

  const httpsEnabled     = baseUrl.startsWith('https://');
  const hstsHeader       = !!h['strict-transport-security'];
  const xFrameOptions    = h['x-frame-options'] || '';
  const xContentType     = !!(h['x-content-type-options'] === 'nosniff');
  const cspHeader        = !!h['content-security-policy'];
  const referrerPolicy   = h['referrer-policy'] || '';
  const permPolicy       = !!h['permissions-policy'];
  const serverExposed    = !!(h['server'] && h['server'].length > 0);

  // SSL cert check via TLS connection info (we infer from https fetch success)
  const sslCertValid = httpsEnabled && status > 0;

  // Mixed content detection
  let mixedContent = false;
  if (html && typeof html === 'string') {
    mixedContent = /http:\/\//i.test(html) && httpsEnabled;
  }

  let score = 0;
  if (httpsEnabled)   score += 20;
  if (hstsHeader)     score += 15;
  if (xFrameOptions)  score += 10;
  if (xContentType)   score += 10;
  if (cspHeader)      score += 20;
  if (referrerPolicy) score += 10;
  if (permPolicy)     score += 10;
  if (!serverExposed) score += 5;

  return {
    httpsEnabled,
    mixedContent,
    hstsHeader,
    xFrameOptions,
    xContentTypeOptions: xContentType,
    cspHeader,
    referrerPolicy,
    permissionsPolicy: permPolicy,
    serverHeaderExposed: serverExposed,
    cookieSecureFlag: false,
    tlsVersion: httpsEnabled ? 'TLS 1.2+' : 'None',
    sslCertValid,
    sslCertExpiry: '',
    securityScore: Math.min(100, score),
  };
}

/* ═══════════════════════════════════════════════════════
   CONTENT ANALYSIS
═══════════════════════════════════════════════════════ */
function analyzeContent(pages) {
  const totalWords     = pages.reduce((s, p) => s + p.wordCount, 0);
  const avgWords       = pages.length ? Math.round(totalWords / pages.length) : 0;
  const thinContent    = pages.filter(p => p.wordCount < 300).length;
  const noH1           = pages.filter(p => p.h1Count === 0).length;
  const noMetaDesc     = pages.filter(p => !p.metaDescription).length;

  // Duplicate titles
  const titleCounts = {};
  pages.forEach(p => { if (p.title) titleCounts[p.title] = (titleCounts[p.title] || 0) + 1; });
  const dupTitles = Object.values(titleCounts).filter(c => c > 1).length;

  // Readability: rough estimate based on avg word count
  const readability = Math.min(100, Math.max(0, 100 - Math.abs(avgWords - 600) / 10));

  const contentScore = Math.max(0, 100
    - (thinContent / Math.max(1, pages.length)) * 30
    - (noH1        / Math.max(1, pages.length)) * 20
    - (noMetaDesc  / Math.max(1, pages.length)) * 20
    - (dupTitles   / Math.max(1, pages.length)) * 10
  );

  return {
    totalWords,
    avgWordsPerPage: avgWords,
    pagesWithThinContent: thinContent,
    pagesWithoutH1: noH1,
    pagesWithDuplicateTitle: dupTitles,
    pagesWithoutMetaDesc: noMetaDesc,
    readabilityScore: Math.round(readability),
    contentScore: Math.round(contentScore),
    topKeywords: [],
  };
}

/* ═══════════════════════════════════════════════════════
   ISSUE BUILDER
═══════════════════════════════════════════════════════ */
function buildIssues(data) {
  const issues = [];
  const add = (type, severity, title, description, detail, impact, fix, url = '') =>
    issues.push({ type, severity, title, description, url, detail, impact, fix });

  const { crawl, nav, breadcrumbs, urls, linking, broken, blog, pagination, duplicate, security, content } = data;

  // Security
  if (!security.httpsEnabled)
    add('security', 'critical', 'HTTPS Not Enabled', 'Site is served over HTTP', '', 'Users\' data is at risk, search engines penalise non-HTTPS sites', 'Obtain an SSL certificate and redirect all HTTP traffic to HTTPS');
  if (!security.hstsHeader)
    add('security', 'high', 'Missing HSTS Header', 'Strict-Transport-Security header is absent', '', 'Exposes site to protocol downgrade attacks', 'Add "Strict-Transport-Security: max-age=31536000; includeSubDomains" to server headers');
  if (!security.cspHeader)
    add('security', 'high', 'Missing Content Security Policy', 'No CSP header detected', '', 'Vulnerable to XSS attacks', 'Define a Content-Security-Policy header to restrict resource loading');
  if (!security.xFrameOptions)
    add('security', 'medium', 'Missing X-Frame-Options', 'Site can be embedded in iframes', '', 'Clickjacking vulnerability', 'Add X-Frame-Options: DENY or SAMEORIGIN header');
  if (!security.xContentTypeOptions)
    add('security', 'medium', 'Missing X-Content-Type-Options', 'MIME sniffing is not disabled', '', 'Browser MIME-sniffing attacks possible', 'Add X-Content-Type-Options: nosniff header');
  if (security.serverHeaderExposed)
    add('security', 'low', 'Server Header Exposed', 'Server type/version is publicly visible', '', 'Reveals attack surface to malicious actors', 'Remove or obscure the Server response header');
  if (security.mixedContent)
    add('security', 'medium', 'Mixed Content Detected', 'HTTP resources loaded on HTTPS page', '', 'Blocks secure connections and shows browser warnings', 'Update all resource URLs to use HTTPS');

  // Navigation
  if (!nav.hasMobileMenu)
    add('navigation', 'high', 'No Mobile Navigation Detected', 'Site appears to lack a hamburger/mobile menu', '', 'Poor UX on mobile devices', 'Implement a responsive mobile navigation menu');
  if (!nav.hasSkipLinks)
    add('navigation', 'medium', 'Missing Skip Navigation Links', 'No skip-to-content link found', '', 'Keyboard and screen reader users cannot bypass repetitive navigation', 'Add a "Skip to main content" link at the top of each page');

  // Breadcrumbs
  if (!breadcrumbs.found)
    add('breadcrumb', 'medium', 'No Breadcrumb Navigation', 'Breadcrumbs not found on any crawled page', '', 'Harms UX and search engine understanding of site hierarchy', 'Implement breadcrumb navigation and BreadcrumbList schema markup');
  else if (!breadcrumbs.schemaMarkupFound)
    add('breadcrumb', 'low', 'Breadcrumbs Missing Schema Markup', 'Breadcrumbs exist but lack JSON-LD/microdata', '', 'Search engines won\'t show breadcrumbs in rich results', 'Add BreadcrumbList JSON-LD schema to breadcrumb components');

  // Orphaned pages
  if (linking.orphanedPages.length > 0)
    add('linking', 'high', `${linking.orphanedPages.length} Orphaned Pages Found`, 'Pages with no internal links pointing to them', linking.orphanedPages.slice(0, 3).join(', '), 'Search engines may not discover or index these pages', 'Add internal links from relevant pages to these orphaned pages');

  // Deep pages
  if (linking.deepPages.length > 0)
    add('linking', 'medium', `${linking.deepPages.length} Deep Pages (4+ clicks from homepage)`, 'Pages buried too deep in site hierarchy', '', 'Difficult for users and search engines to reach', 'Flatten site architecture and add shortcut links from higher-level pages');

  // Broken links
  if (broken.total404 > 0)
    add('broken-links', 'high', `${broken.total404} Broken Links (404)`, 'Crawled pages returned 404 errors', broken.brokenUrls.slice(0, 3).join(', '), 'Ruins user experience and wastes crawl budget', 'Fix or remove broken links; set up proper 301 redirects');

  // Sitemap
  if (!crawl.sitemapFound)
    add('crawl', 'medium', 'No Sitemap.xml Found', 'XML sitemap not detected at /sitemap.xml', '', 'Search engines may miss pages', 'Create and submit an XML sitemap to Google Search Console');
  if (!crawl.robotsTxtFound)
    add('crawl', 'low', 'No Robots.txt Found', 'robots.txt not found at /robots.txt', '', 'Search engines have no crawl directives', 'Create a robots.txt file to guide search engine crawlers');

  // URL structure
  if (urls.urlsWithUppercase > 0)
    add('url', 'low', `${urls.urlsWithUppercase} URLs with Uppercase Letters`, 'URLs should be lowercase', '', 'Can cause duplicate content and confusion', 'Use lowercase-only URLs and redirect uppercase variants');
  if (urls.urlsWithParameters > 2)
    add('url', 'medium', `${urls.urlsWithParameters} URLs with Query Parameters`, 'Parameter-heavy URLs are not SEO-friendly', '', 'Poor readability and crawl efficiency', 'Use clean URL slugs instead of query parameters where possible');

  // Content
  if (content.pagesWithThinContent > 0)
    add('content', 'medium', `${content.pagesWithThinContent} Pages with Thin Content`, 'Pages have fewer than 300 words', '', 'Search engines may devalue or ignore thin pages', 'Expand content on these pages to at least 400–600 meaningful words');
  if (content.pagesWithoutH1 > 0)
    add('content', 'high', `${content.pagesWithoutH1} Pages Missing H1 Tag`, 'Critical heading structure is absent', '', 'Reduces SEO clarity and accessibility', 'Add a single, descriptive H1 tag to every page');
  if (content.pagesWithoutMetaDesc > 0)
    add('content', 'medium', `${content.pagesWithoutMetaDesc} Pages Missing Meta Description`, 'Meta descriptions help search engine click-through', '', 'Lower CTR from search results', 'Write unique, compelling meta descriptions (150–160 chars) for every page');
  if (content.pagesWithDuplicateTitle > 0)
    add('content', 'medium', `${content.pagesWithDuplicateTitle} Duplicate Page Titles`, 'Multiple pages share the same <title>', '', 'Confuses search engines about which page to rank', 'Write unique title tags for every page');

  // Duplicate content
  if (duplicate.suspectedDuplicates > 0)
    add('content', 'medium', `${duplicate.suspectedDuplicates} Suspected Duplicate Pages`, 'Pages with identical titles detected', '', 'Causes keyword cannibalization', 'Consolidate or differentiate duplicate pages; use canonical tags');

  // Blog
  if (!blog.found)
    add('content', 'info', 'No Blog or News Section Detected', 'Regular content publication supports SEO', '', 'Missed opportunity for organic traffic', 'Consider adding a blog or news section with regular, high-value content');

  return issues;
}

/* ═══════════════════════════════════════════════════════
   SCORES → OVERALL
═══════════════════════════════════════════════════════ */
function computeOverallScore(scores) {
  const w = {
    crawlScore: 0.10, navigationScore: 0.15, urlScore: 0.10,
    breadcrumbScore: 0.10, linkingScore: 0.15, securityScore: 0.25, contentScore: 0.15,
  };
  return Math.round(
    Object.entries(w).reduce((s, [k, wt]) => s + (scores[k] || 0) * wt, 0)
  );
}

/* ═══════════════════════════════════════════════════════
   AI REPORT
═══════════════════════════════════════════════════════ */
async function generateReport(record) {
  const systemPrompt = `You are a professional web audit specialist. Analyse the following website audit data and generate a comprehensive yet easy-to-understand report in JSON format only. No markdown, no preamble.

Return strictly valid JSON with this shape:
{
  "summary": "2–3 sentence overview of the website's overall health",
  "websiteHealth": "Good | Fair | Poor | Critical",
  "issuesSummary": "Plain-English paragraph summarising the main problems found",
  "whatWorksWell": ["array of 3–5 positive observations"],
  "criticalFixes": ["array of 3–5 most urgent action items"],
  "recommendations": ["array of 5–7 improvement suggestions"],
  "priorityTable": [
    {"issue":"Issue title","impact":"High|Medium|Low","priority":"P1|P2|P3","effort":"Low|Medium|High","fix":"One-sentence fix"}
  ],
  "finalScore": <integer 0-100>
}`;

  const userPrompt = `Website: ${record.url}
Overall Score: ${record.scores.overallScore}
Security Score: ${record.scores.securityScore}
Content Score: ${record.scores.contentScore}
Navigation Score: ${record.scores.navigationScore}
Pages Crawled: ${record.crawl.totalPagesCrawled}
Broken Links: ${record.brokenLinks.total404}
Orphaned Pages: ${record.internalLinking.orphanedPages.length}
HTTPS: ${record.security.httpsEnabled}
CSP Header: ${record.security.cspHeader}
HSTS: ${record.security.hstsHeader}
Thin Content Pages: ${record.content.pagesWithThinContent}
Pages Without H1: ${record.content.pagesWithoutH1}
Breadcrumbs Found: ${record.breadcrumbs.found}
Sitemap Found: ${record.crawl.sitemapFound}
Issues Count: ${record.issues.length}
Top Issues: ${record.issues.slice(0, 8).map(i => `[${i.severity.toUpperCase()}] ${i.title}`).join('; ')}`;

  try {
    const { text, provider } = await generateAIReport(systemPrompt, userPrompt);
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return { ...parsed, generatedAt: new Date(), provider };
  } catch (err) {
    console.error('[AI Report] Failed:', err.message);
    return {
      summary: `Website audit completed for ${record.url}. Overall score: ${record.scores.overallScore}/100.`,
      websiteHealth: record.scores.overallScore >= 75 ? 'Good' : record.scores.overallScore >= 50 ? 'Fair' : 'Poor',
      issuesSummary: `${record.issues.length} issues found. Review the detailed report for full information.`,
      whatWorksWell: record.crawl.sitemapFound ? ['Sitemap found'] : ['Site is accessible'],
      criticalFixes: record.issues.filter(i => i.severity === 'critical').map(i => i.title).slice(0, 3),
      recommendations: record.issues.filter(i => i.severity === 'high').map(i => i.fix).slice(0, 5),
      priorityTable: record.issues.slice(0, 8).map(i => ({
        issue: i.title, impact: i.severity === 'critical' ? 'High' : i.severity === 'medium' ? 'Medium' : 'Low',
        priority: i.severity === 'critical' ? 'P1' : i.severity === 'high' ? 'P2' : 'P3',
        effort: 'Medium', fix: i.fix,
      })),
      finalScore: record.scores.overallScore,
      generatedAt: new Date(),
      provider: 'fallback',
    };
  }
}

/* ═══════════════════════════════════════════════════════
   MAIN ANALYZE FUNCTION
═══════════════════════════════════════════════════════ */
async function analyze(url) {
  const normalizedUrl = normalizeUrl(url);

  // Create pending record
  const record = new StructureNavigation({ url: normalizedUrl, status: 'running' });
  await record.save();

  try {
    console.log(`[SN] Starting analysis for ${normalizedUrl}`);

    // 1. Crawl
    const { pages, crawlDuration } = await crawlSite(normalizedUrl);
    const { sitemapFound, sitemapUrl, robotsTxtFound, robotsTxtUrl } = await checkSitemapRobots(normalizedUrl);
    const maxDepth = pages.reduce((m, p) => Math.max(m, p.depth), 0);

    record.crawl = {
      totalPagesCrawled: pages.length,
      maxDepthFound: maxDepth,
      crawlDuration,
      pages: pages.slice(0, 40),
      sitemapFound, sitemapUrl, robotsTxtFound, robotsTxtUrl,
    };

    // 2. Navigation
    const nav = await analyzeNavigation(normalizedUrl);
    record.navigation = nav;

    // 3. Breadcrumbs
    const breadcrumbs = analyzeBreadcrumbs(pages);
    record.breadcrumbs = breadcrumbs;

    // 4. URL Structure
    const urls = analyzeUrls(pages);
    record.urlStructure = urls;

    // 5. Internal Linking
    const linking = analyzeInternalLinking(pages);
    record.internalLinking = linking;

    // 6. Broken Links
    const broken = await checkBrokenLinks(pages);
    record.brokenLinks = broken;

    // 7. Blog
    const blog = await detectBlog(normalizedUrl, pages);
    record.blog = blog;

    // 8. Pagination
    const paginationData = analyzePagination(pages);
    record.pagination = paginationData;

    // 9. Duplicate Content
    const duplicate = analyzeDuplicateContent(pages);
    record.duplicateContent = duplicate;

    // 10. Security
    const security = await analyzeSecurityHeaders(normalizedUrl);
    record.security = security;

    // 11. Content
    const content = analyzeContent(pages);
    record.content = content;

    // 12. Issues
    const issues = buildIssues({ crawl: record.crawl, nav, breadcrumbs, urls, linking, broken, blog, pagination: paginationData, duplicate, security, content });
    record.issues = issues;

    // 13. Scores
    const crawlScore = Math.min(100,
      (sitemapFound ? 30 : 0) + (robotsTxtFound ? 20 : 0) + (pages.length > 5 ? 30 : 15) + 20
    );
    record.scores = {
      crawlScore,
      navigationScore: nav.navStructureScore,
      urlScore: urls.urlScore,
      breadcrumbScore: breadcrumbs.breadcrumbScore,
      linkingScore: linking.linkEquityScore,
      securityScore: security.securityScore,
      contentScore: content.contentScore,
      overallScore: 0,
    };
    record.scores.overallScore = computeOverallScore(record.scores);

    // 14. AI Report
    const aiReport = await generateReport(record);
    record.aiReport = aiReport;

    record.status = 'completed';
    await record.save();

    console.log(`[SN] Completed analysis for ${normalizedUrl} — score: ${record.scores.overallScore}`);
    return record;

  } catch (err) {
    record.status = 'failed';
    record.error = err.message;
    await record.save();
    throw err;
  }
}

/* ── Fetch existing report ── */
async function getReport(id) {
  return StructureNavigation.findById(id);
}

module.exports = { analyze, getReport };