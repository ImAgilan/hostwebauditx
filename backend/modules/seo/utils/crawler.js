/**
 * seo/utils/crawler.js
 * Fetches a page with Puppeteer and extracts raw DOM data needed for SEO analysis.
 */

const puppeteer = require('puppeteer');
const axios     = require('axios');

/**
 * Main page crawler — returns all raw data for a single URL.
 */
async function crawlPage(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (compatible; WebAuditBot/1.0)');

    // Navigate
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    } catch (navErr) {
      if (navErr.message.includes('ERR_NAME_NOT_RESOLVED'))
        throw new Error(`Domain not found: "${url}" — check for typos.`);
      throw navErr;
    }

    // ── Extract all DOM data in one evaluate call ─────────────────────────────
    const domData = await page.evaluate(() => {
      const $ = (sel) => document.querySelector(sel);
      const $$ = (sel) => [...document.querySelectorAll(sel)];

      // Meta
      const title           = document.title || null;
      const metaDesc        = $('meta[name="description"]')?.getAttribute('content') || null;
      const metaKeywords    = $('meta[name="keywords"]')?.getAttribute('content') || null;
      const ogTitle         = $('meta[property="og:title"]')?.getAttribute('content') || null;
      const ogDesc          = $('meta[property="og:description"]')?.getAttribute('content') || null;
      const ogImage         = $('meta[property="og:image"]')?.getAttribute('content') || null;
      const twitterCard     = $('meta[name="twitter:card"]')?.getAttribute('content') || null;
      const viewportMeta    = $('meta[name="viewport"]')?.getAttribute('content') || null;
      const robotsMeta      = $('meta[name="robots"]')?.getAttribute('content') || null;
      const canonicalEl     = $('link[rel="canonical"]');
      const canonicalUrl    = canonicalEl?.getAttribute('href') || null;

      // Hreflang
      const hreflangTags = $$('link[rel="alternate"][hreflang]')
        .map(el => el.getAttribute('hreflang'));

      // Pagination
      const hasPagination = !!($('link[rel="next"]') || $('link[rel="prev"]'));

      // Headings
      const h1Texts = $$('h1').map(el => el.innerText?.trim()).filter(Boolean);
      const h2Texts = $$('h2').map(el => el.innerText?.trim()).filter(Boolean).slice(0, 10);
      const h3Count = $$('h3').length;

      // Body text
      const bodyText = document.body?.innerText?.replace(/\s+/g, ' ').trim() || '';
      const wordCount = bodyText.split(/\s+/).filter(w => w.length > 1).length;

      // Links
      const allLinks = $$('a[href]').map(a => {
        const href = a.getAttribute('href') || '';
        const text = a.innerText?.trim() || '';
        return { href, text };
      });

      // Images
      const images = $$('img').map(img => ({
        src:     img.getAttribute('src') || '',
        alt:     img.getAttribute('alt'),
        loading: img.getAttribute('loading'),
        width:   img.naturalWidth,
        height:  img.naturalHeight
      }));

      // Structured data
      const jsonLdScripts = $$('script[type="application/ld+json"]')
        .map(s => { try { return JSON.parse(s.textContent); } catch(_) { return null; } })
        .filter(Boolean);

      const hasMicrodata = !!$('[itemscope]');

      // Schema types from JSON-LD
      const schemaTypes = jsonLdScripts
        .flatMap(obj => Array.isArray(obj) ? obj : [obj])
        .map(obj => obj['@type'])
        .filter(Boolean)
        .flat();

      return {
        title, metaDesc, metaKeywords, ogTitle, ogDesc, ogImage, twitterCard,
        viewportMeta, robotsMeta, canonicalUrl, hreflangTags, hasPagination,
        h1Texts, h2Texts, h3Count, bodyText, wordCount,
        allLinks, images, jsonLdScripts, hasMicrodata, schemaTypes
      };
    });

    // ── Fetch sitemap & robots.txt from the same origin ───────────────────────
    const origin       = new URL(url).origin;
    const sitemapData  = await fetchSitemap(origin);
    const robotsData   = await fetchRobotsTxt(origin);

    return { ...domData, sitemapData, robotsData, url };

  } finally {
    await browser.close();
  }
}

/**
 * Fetch and parse sitemap.xml (FR-5.30).
 */
async function fetchSitemap(origin) {
  const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap/sitemap.xml`];

  for (const sUrl of candidates) {
    try {
      const res = await axios.get(sUrl, { timeout: 10_000, headers: { 'User-Agent': 'WebAuditBot/1.0' } });
      if (res.status === 200 && res.data) {
        const xml      = res.data.toString();
        const isValid  = xml.includes('<urlset') || xml.includes('<sitemapindex');
        const urlCount = (xml.match(/<loc>/g) || []).length;
        return { found: true, url: sUrl, valid: isValid, urlCount };
      }
    } catch (_) { continue; }
  }

  return { found: false, url: null, valid: false, urlCount: 0 };
}

/**
 * Fetch robots.txt (FR-5.30).
 */
async function fetchRobotsTxt(origin) {
  try {
    const res = await axios.get(`${origin}/robots.txt`, {
      timeout: 8_000,
      headers: { 'User-Agent': 'WebAuditBot/1.0' }
    });
    if (res.status === 200) {
      return { found: true, content: res.data?.toString()?.slice(0, 2000) || '' };
    }
  } catch (_) {}
  return { found: false, content: null };
}

/**
 * Resolve internal vs external links (FR-5.23 – 5.25).
 */
function classifyLinks(allLinks, pageUrl) {
  const origin = new URL(pageUrl).origin;

  const internal = [];
  const external = [];

  for (const { href, text } of allLinks) {
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;

    try {
      const resolved = new URL(href, pageUrl);
      if (resolved.origin === origin) {
        internal.push(resolved.pathname);
      } else {
        external.push(resolved.href);
      }
    } catch (_) { continue; }
  }

  // Unique internal
  const uniqueInternal = [...new Set(internal)];
  return { internal: uniqueInternal, external: external.slice(0, 20) };
}

module.exports = { crawlPage, classifyLinks };