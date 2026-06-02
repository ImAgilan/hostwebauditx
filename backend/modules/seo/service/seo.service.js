'use strict';
/**
 * seo.service.js
 * Full SEO & Content Analysis Service
 */

const axios   = require('axios');
const cheerio = require('cheerio');

/* ── helpers ── */
const sleep = ms => new Promise(r => setTimeout(r, ms));

function extractDomain(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function normaliseUrl(url) {
  if (!url.startsWith('http')) url = 'https://' + url;
  return url.replace(/\/$/, '');
}

async function fetchHtml(url, timeout = 15000) {
  const { data, request } = await axios.get(url, {
    timeout,
    maxRedirects: 10,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WebAuditX/1.0; +https://webauditx.io/bot)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  return { html: data, finalUrl: request.res?.responseUrl || url };
}

/* ─────────────────────────────────────────────
   1. META ANALYSIS
───────────────────────────────────────────── */
function analyseMeta($, url) {
  const issues = [];
  const title        = $('title').first().text().trim();
  const description  = $('meta[name="description"]').attr('content') || '';
  const keywords     = $('meta[name="keywords"]').attr('content') || '';
  const canonical    = $('link[rel="canonical"]').attr('href') || '';
  const robots       = $('meta[name="robots"]').attr('content') || '';
  const viewport     = $('meta[name="viewport"]').attr('content') || '';
  const charset      = $('meta[charset]').attr('charset') || $('meta[http-equiv="Content-Type"]').attr('content') || '';
  const lang         = $('html').attr('lang') || '';
  const ogTitle      = $('meta[property="og:title"]').attr('content') || '';
  const ogDesc       = $('meta[property="og:description"]').attr('content') || '';
  const ogImage      = $('meta[property="og:image"]').attr('content') || '';
  const ogType       = $('meta[property="og:type"]').attr('content') || '';
  const twCard       = $('meta[name="twitter:card"]').attr('content') || '';
  const twTitle      = $('meta[name="twitter:title"]').attr('content') || '';
  const twDesc       = $('meta[name="twitter:description"]').attr('content') || '';
  const hreflang     = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => hreflang.push($(el).attr('hreflang')));

  let score = 100;

  // Title checks
  if (!title) {
    issues.push({ type: 'missing-title', severity: 'critical', category: 'Meta', title: 'Missing Page Title', description: 'No <title> tag found.', recommendation: 'Add a descriptive title tag (50–60 chars).', impact: 'Critical ranking factor.' });
    score -= 25;
  } else if (title.length < 30) {
    issues.push({ type: 'short-title', severity: 'high', category: 'Meta', title: 'Title Too Short', description: `Title is ${title.length} chars. Ideal: 50–60.`, recommendation: 'Expand title to 50–60 characters.', impact: 'Missed keyword opportunity.' });
    score -= 10;
  } else if (title.length > 60) {
    issues.push({ type: 'long-title', severity: 'medium', category: 'Meta', title: 'Title Too Long', description: `Title is ${title.length} chars. SERPs truncate at ~60.`, recommendation: 'Shorten title to under 60 characters.', impact: 'Title may be cut off in search results.' });
    score -= 5;
  }

  // Description checks
  if (!description) {
    issues.push({ type: 'missing-description', severity: 'high', category: 'Meta', title: 'Missing Meta Description', description: 'No meta description tag found.', recommendation: 'Add a meta description (150–160 chars).', impact: 'Lower click-through rates from SERPs.' });
    score -= 15;
  } else if (description.length < 100) {
    issues.push({ type: 'short-description', severity: 'medium', category: 'Meta', title: 'Meta Description Too Short', description: `Description is ${description.length} chars.`, recommendation: 'Expand to 150–160 characters.', impact: 'Reduced click-through rate.' });
    score -= 8;
  } else if (description.length > 160) {
    issues.push({ type: 'long-description', severity: 'low', category: 'Meta', title: 'Meta Description Too Long', description: `Description is ${description.length} chars.`, recommendation: 'Trim to 150–160 characters.', impact: 'May be truncated in SERPs.' });
    score -= 3;
  }

  if (!canonical) {
    issues.push({ type: 'missing-canonical', severity: 'medium', category: 'Meta', title: 'Missing Canonical Tag', description: 'No canonical URL specified.', recommendation: 'Add <link rel="canonical" href="..."> to prevent duplicate content.', impact: 'Risk of duplicate content penalties.' });
    score -= 8;
  }

  if (!viewport) {
    issues.push({ type: 'missing-viewport', severity: 'high', category: 'Meta', title: 'Missing Viewport Meta', description: 'No viewport meta tag.', recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.', impact: 'Poor mobile experience affects rankings.' });
    score -= 10;
  }

  if (!lang) {
    issues.push({ type: 'missing-lang', severity: 'medium', category: 'Meta', title: 'Missing HTML Language Attribute', description: 'No lang attribute on <html>.', recommendation: 'Add lang="en" (or appropriate code) to <html>.', impact: 'Accessibility and international SEO issues.' });
    score -= 5;
  }

  if (!ogTitle && !ogDesc) {
    issues.push({ type: 'missing-og', severity: 'medium', category: 'Meta', title: 'Missing Open Graph Tags', description: 'No OG meta tags found.', recommendation: 'Add og:title, og:description, og:image for social sharing.', impact: 'Poor social media preview.' });
    score -= 5;
  }

  if (!twCard) {
    issues.push({ type: 'missing-twitter-card', severity: 'low', category: 'Meta', title: 'Missing Twitter Card', description: 'No twitter:card meta tag.', recommendation: 'Add twitter:card meta tags.', impact: 'Poor Twitter sharing preview.' });
    score -= 3;
  }

  const titleScore = Math.max(0, Math.min(100, title ? (title.length >= 30 && title.length <= 60 ? 100 : title.length < 30 ? 70 : 80) : 0));
  const descScore  = Math.max(0, Math.min(100, description ? (description.length >= 100 && description.length <= 160 ? 100 : 60) : 0));

  return {
    title, titleLength: title.length, titleScore,
    description, descriptionLength: description.length, descriptionScore: descScore,
    keywords, canonical, robots, viewport, charset, language: lang,
    hreflang, ogTitle, ogDescription: ogDesc, ogImage, ogType,
    twitterCard: twCard, twitterTitle: twTitle, twitterDescription: twDesc,
    score: Math.max(0, score), issues,
  };
}

/* ─────────────────────────────────────────────
   2. HEADING ANALYSIS
───────────────────────────────────────────── */
function analyseHeadings($) {
  const issues = [];
  const headings = [];
  let score = 100;

  ['h1','h2','h3','h4','h5','h6'].forEach(tag => {
    $(tag).each((_, el) => {
      headings.push({ tag, text: $(el).text().trim().substring(0, 120), level: parseInt(tag[1]) });
    });
  });

  const counts = { h1:0, h2:0, h3:0, h4:0, h5:0, h6:0 };
  headings.forEach(h => counts[h.tag]++);

  if (counts.h1 === 0) {
    issues.push({ type: 'missing-h1', severity: 'critical', category: 'Headings', title: 'Missing H1 Heading', description: 'No H1 tag found on the page.', recommendation: 'Add one H1 heading with the primary keyword.', impact: 'Critical for search engines to understand page topic.' });
    score -= 30;
  } else if (counts.h1 > 1) {
    issues.push({ type: 'multiple-h1', severity: 'high', category: 'Headings', title: `Multiple H1 Tags (${counts.h1})`, description: `Found ${counts.h1} H1 tags. Best practice is one per page.`, recommendation: 'Use exactly one H1 per page.', impact: 'Confuses search engines about the main topic.' });
    score -= 15;
  }

  // Check hierarchy skips
  let prevLevel = 1;
  let hierarchyOk = true;
  headings.forEach(h => {
    if (h.level > prevLevel + 1) hierarchyOk = false;
    prevLevel = h.level;
  });

  if (!hierarchyOk) {
    issues.push({ type: 'heading-hierarchy', severity: 'medium', category: 'Headings', title: 'Heading Hierarchy Skipped', description: 'Heading levels skip (e.g., H1 → H3).', recommendation: 'Use headings in sequential order.', impact: 'Reduces readability and SEO structure.' });
    score -= 10;
  }

  // Empty headings
  const emptyHeadings = headings.filter(h => !h.text);
  if (emptyHeadings.length > 0) {
    issues.push({ type: 'empty-heading', severity: 'medium', category: 'Headings', title: `${emptyHeadings.length} Empty Heading(s)`, description: 'Headings with no text content found.', recommendation: 'Remove or fill empty headings.', impact: 'Confuses crawlers and users.' });
    score -= 8;
  }

  if (headings.length === 0) score = 0;

  return { h1Count: counts.h1, h2Count: counts.h2, h3Count: counts.h3, h4Count: counts.h4, h5Count: counts.h5, h6Count: counts.h6, hierarchy: hierarchyOk, headings, score: Math.max(0, score), issues };
}

/* ─────────────────────────────────────────────
   3. IMAGE ALT ANALYSIS
───────────────────────────────────────────── */
function analyseImages($) {
  const issues = [];
  const images = [];
  let score = 100;

  $('img').each((_, el) => {
    const src   = $(el).attr('src') || '';
    const alt   = $(el).attr('alt');
    const title = $(el).attr('title') || '';
    const role  = $(el).attr('role') || '';
    const isDecorative = role === 'presentation' || alt === '';
    images.push({ src: src.substring(0, 200), alt: alt || '', hasAlt: alt !== undefined, altLength: (alt || '').length, title, isDecorative });
  });

  const withoutAlt = images.filter(i => i.alt === undefined || (i.alt === '' && !i.isDecorative));
  const emptyAlt   = images.filter(i => i.alt === '' && !i.isDecorative);
  const withAlt    = images.filter(i => i.hasAlt && i.alt !== '');

  if (withoutAlt.length > 0) {
    issues.push({ type: 'missing-alt', severity: 'high', category: 'Images', title: `${withoutAlt.length} Image(s) Missing Alt Text`, description: `${withoutAlt.length} of ${images.length} images lack alt attributes.`, recommendation: 'Add descriptive alt text to all meaningful images.', impact: 'Hurts accessibility and image SEO.' });
    score -= Math.min(40, withoutAlt.length * 5);
  }

  const longAlt = images.filter(i => i.altLength > 125);
  if (longAlt.length > 0) {
    issues.push({ type: 'long-alt', severity: 'low', category: 'Images', title: `${longAlt.length} Image(s) With Long Alt Text`, description: 'Alt text over 125 characters may be truncated.', recommendation: 'Keep alt text concise (under 125 chars).', impact: 'Minor accessibility issue.' });
    score -= 5;
  }

  // Images missing src
  const noSrc = images.filter(i => !i.src);
  if (noSrc.length > 0) {
    issues.push({ type: 'missing-src', severity: 'high', category: 'Images', title: `${noSrc.length} Image(s) Missing src`, description: 'Images with no src attribute found.', recommendation: 'Ensure all img tags have valid src attributes.', impact: 'Broken images harm user experience.' });
    score -= 10;
  }

  return { total: images.length, withAlt: withAlt.length, withoutAlt: withoutAlt.length, emptyAlt: emptyAlt.length, images: images.slice(0, 50), score: Math.max(0, score), issues };
}

/* ─────────────────────────────────────────────
   4. KEYWORD DENSITY ANALYSIS
───────────────────────────────────────────── */
function analyseKeywords($, meta, headings) {
  const issues = [];
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().toLowerCase();
  const titleText = (meta.title || '').toLowerCase();
  const h1Text    = headings.headings.filter(h => h.tag === 'h1').map(h => h.text.toLowerCase()).join(' ');
  const h2Text    = headings.headings.filter(h => h.tag === 'h2').map(h => h.text.toLowerCase()).join(' ');
  const metaText  = (meta.description || '').toLowerCase();

  const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','up','about','into','through','during','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','it','its','this','that','these','those','i','we','you','he','she','they','what','which','who','how','when','where','why','all','each','every','both','few','more','most','other','some','such','no','not','only','own','same','than','too','very','just','because','as','until','while','although','if','then','else']);

  const words = bodyText.match(/\b[a-z]{3,}\b/g) || [];
  const wordCount = words.length;
  const freq = {};
  words.forEach(w => { if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1; });

  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const topKeywords = sorted.map(([keyword, count]) => {
    const density = parseFloat(((count / wordCount) * 100).toFixed(2));
    return {
      keyword, count, density,
      inTitle:   titleText.includes(keyword),
      inMeta:    metaText.includes(keyword),
      inH1:      h1Text.includes(keyword),
      inH2:      h2Text.includes(keyword),
      inContent: true,
    };
  });

  // Keyword stuffing check
  const stuffed = topKeywords.filter(k => k.density > 5);
  if (stuffed.length > 0) {
    issues.push({ type: 'keyword-stuffing', severity: 'high', category: 'Keywords', title: 'Keyword Stuffing Detected', description: `Keywords with density > 5%: ${stuffed.map(k => k.keyword).join(', ')}`, recommendation: 'Keep keyword density between 1–3%.', impact: 'May trigger Google spam filters.' });
  }

  const uniqueWords = Object.keys(freq).length;
  const score = Math.max(0, 100 - (stuffed.length * 15));

  return { topKeywords, wordCount, uniqueWords, score, issues };
}

/* ─────────────────────────────────────────────
   5. LINK ANALYSIS
───────────────────────────────────────────── */
async function analyseLinks($, baseUrl) {
  const issues = [];
  const links  = [];
  const domain = extractDomain(baseUrl);

  $('a[href]').each((_, el) => {
    const href      = $(el).attr('href') || '';
    const text      = $(el).text().trim().substring(0, 100);
    const nofollow  = ($(el).attr('rel') || '').includes('nofollow');
    const hasTitle  = !!$(el).attr('title');

    let absUrl = href;
    try {
      if (href.startsWith('/'))       absUrl = new URL(href, baseUrl).href;
      else if (!href.startsWith('http')) absUrl = new URL(href, baseUrl).href;
    } catch { return; }

    if (absUrl.startsWith('mailto:') || absUrl.startsWith('tel:') || absUrl.startsWith('javascript:')) return;

    const isInternal = extractDomain(absUrl) === domain;
    links.push({ url: absUrl.substring(0, 300), text, type: isInternal ? 'internal' : 'external', status: 200, isBroken: false, isNofollow: nofollow, hasTitle });
  });

  // Check sample of links for broken (max 15 to avoid timeout)
  const sample = links.slice(0, 15);
  await Promise.allSettled(sample.map(async link => {
    try {
      const r = await axios.head(link.url, { timeout: 5000, maxRedirects: 5, headers: { 'User-Agent': 'Mozilla/5.0 WebAuditX/1.0' } });
      link.status = r.status;
      link.isBroken = r.status >= 400;
    } catch (e) {
      link.status = e.response?.status || 0;
      link.isBroken = true;
    }
  }));

  const brokenLinks  = links.filter(l => l.isBroken);
  const internalLinks = links.filter(l => l.type === 'internal');
  const externalLinks = links.filter(l => l.type === 'external');
  const nofollowLinks = links.filter(l => l.isNofollow);
  const emptyAnchor   = links.filter(l => !l.text);

  let score = 100;

  if (brokenLinks.length > 0) {
    issues.push({ type: 'broken-links', severity: 'high', category: 'Links', title: `${brokenLinks.length} Broken Link(s) Found`, description: `Found broken links: ${brokenLinks.slice(0, 3).map(l => l.url).join(', ')}`, recommendation: 'Fix or remove all broken links.', impact: 'Hurts crawlability and user experience.' });
    score -= Math.min(40, brokenLinks.length * 10);
  }

  if (emptyAnchor.length > 0) {
    issues.push({ type: 'empty-anchor', severity: 'medium', category: 'Links', title: `${emptyAnchor.length} Link(s) Missing Anchor Text`, description: 'Links with no descriptive anchor text.', recommendation: 'Use descriptive anchor text for all links.', impact: 'Poor SEO signal and accessibility.' });
    score -= Math.min(15, emptyAnchor.length * 3);
  }

  if (internalLinks.length < 3) {
    issues.push({ type: 'low-internal-links', severity: 'medium', category: 'Links', title: 'Low Internal Link Count', description: `Only ${internalLinks.length} internal links found.`, recommendation: 'Add more internal links to distribute PageRank.', impact: 'Reduced crawl depth and PageRank flow.' });
    score -= 10;
  }

  return { totalLinks: links.length, internalLinks: internalLinks.length, externalLinks: externalLinks.length, brokenLinks: brokenLinks.length, nofollowLinks: nofollowLinks.length, links: links.slice(0, 100), score: Math.max(0, score), issues };
}

/* ─────────────────────────────────────────────
   6. TECHNICAL SEO
───────────────────────────────────────────── */
async function analyseTechnical(url, $) {
  const issues = [];
  let score = 100;

  const base = new URL(url);
  const origin = base.origin;

  // Sitemap
  let sitemapExists = false, sitemapUrl = '', sitemapValid = false, sitemapUrlCount = 0;
  const sitemapCandidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap`];
  for (const sUrl of sitemapCandidates) {
    try {
      const r = await axios.get(sUrl, { timeout: 8000, headers: { 'User-Agent': 'WebAuditX/1.0' } });
      if (r.status === 200 && r.data && r.data.includes('<url>')) {
        sitemapExists = true; sitemapUrl = sUrl; sitemapValid = true;
        sitemapUrlCount = (r.data.match(/<url>/g) || []).length;
        break;
      } else if (r.status === 200) { sitemapExists = true; sitemapUrl = sUrl; break; }
    } catch {}
  }

  if (!sitemapExists) {
    issues.push({ type: 'missing-sitemap', severity: 'high', category: 'Technical', title: 'XML Sitemap Not Found', description: 'No sitemap.xml found at standard paths.', recommendation: 'Create and submit an XML sitemap to Google Search Console.', impact: 'Slower discovery and indexing of pages.' });
    score -= 15;
  }

  // robots.txt
  let robotsTxtExists = false, robotsTxtContent = '', robotsAllowsIndexing = true;
  try {
    const r = await axios.get(`${origin}/robots.txt`, { timeout: 6000 });
    if (r.status === 200) {
      robotsTxtExists   = true;
      robotsTxtContent  = r.data.substring(0, 2000);
      robotsAllowsIndexing = !r.data.includes('Disallow: /');
    }
  } catch {}

  if (!robotsTxtExists) {
    issues.push({ type: 'missing-robots', severity: 'medium', category: 'Technical', title: 'robots.txt Not Found', description: 'No robots.txt file at root.', recommendation: 'Create a robots.txt file.', impact: 'Search engines may crawl undesired pages.' });
    score -= 10;
  }

  // SSL
  const hasSSL = url.startsWith('https');
  if (!hasSSL) {
    issues.push({ type: 'no-ssl', severity: 'critical', category: 'Technical', title: 'No HTTPS / SSL', description: 'Site is not served over HTTPS.', recommendation: 'Install an SSL certificate and redirect HTTP to HTTPS.', impact: 'Google penalises non-HTTPS sites; browsers warn users.' });
    score -= 25;
  }

  // Structured data
  const ldJsonBlocks  = [];
  const sdTypes = [];
  let structuredData = false;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html());
      ldJsonBlocks.push({ type: parsed['@type'] || 'Unknown', raw: JSON.stringify(parsed).substring(0, 500), valid: true, errors: [] });
      if (parsed['@type']) sdTypes.push(parsed['@type']);
      structuredData = true;
    } catch (e) {
      ldJsonBlocks.push({ type: 'Invalid', raw: $(el).html()?.substring(0, 200) || '', valid: false, errors: [e.message] });
    }
  });

  if (!structuredData) {
    issues.push({ type: 'missing-schema', severity: 'medium', category: 'Technical', title: 'No Structured Data (Schema.org)', description: 'No JSON-LD structured data found.', recommendation: 'Add Schema.org markup (Organization, WebPage, BreadcrumbList, etc.).', impact: 'Missed opportunity for rich snippets in SERPs.' });
    score -= 10;
  }

  // AMP
  const ampExists = !!$('link[rel="amphtml"]').attr('href') || !!$('html[amp]').length || !!$('html[⚡]').length;

  // Hreflang
  const hasHreflang = !!$('link[rel="alternate"][hreflang]').length;

  // Pagination
  const hasPagination = !!$('link[rel="next"], link[rel="prev"]').length;

  // Google Analytics / GTM
  const gaExists  = $('script').toArray().some(el => ($(el).html() || '').includes('google-analytics.com') || ($(el).html() || '').includes('gtag('));
  const gtmExists = $('script').toArray().some(el => ($(el).html() || '').includes('googletagmanager.com'));

  if (!gaExists && !gtmExists) {
    issues.push({ type: 'no-analytics', severity: 'medium', category: 'Technical', title: 'No Analytics Detected', description: 'No Google Analytics or GTM found.', recommendation: 'Add Google Analytics 4 or Google Tag Manager.', impact: 'No visitor data for SEO decisions.' });
    score -= 5;
  }

  return {
    sitemapExists, sitemapUrl, sitemapValid, sitemapUrlCount,
    robotsTxtExists, robotsTxtContent, robotsAllowsIndexing,
    hasSSL, httpsRedirect: hasSSL, wwwRedirect: false,
    structuredData, structuredDataTypes: sdTypes, structuredDataValid: ldJsonBlocks.every(b => b.valid),
    ampExists, hasXmlSitemap: sitemapExists, hasPagination, hasHreflang,
    mobileFriendly: !!$('meta[name="viewport"]').attr('content'),
    score: Math.max(0, score), issues,
    _ldJsonBlocks: ldJsonBlocks,
  };
}

/* ─────────────────────────────────────────────
   7. CONTENT / READABILITY ANALYSIS
───────────────────────────────────────────── */
function analyseContent($) {
  const issues = [];

  // Extract readable text
  $('script, style, nav, footer, header, aside, noscript').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();

  const words     = text.match(/\b\w+\b/g) || [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const paragraphs = $('p').toArray().filter(el => $(el).text().trim().length > 0);

  const wordCount     = words.length;
  const sentenceCount = sentences.length;
  const paragraphCount = paragraphs.length;

  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  const avgSyllablesPerWord = words.reduce((sum, w) => sum + countSyllables(w), 0) / (wordCount || 1);

  // Flesch Reading Ease
  const fleschKincaid = Math.max(0, Math.min(100,
    206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)
  ));

  let readabilityGrade = 'Very Easy';
  if (fleschKincaid < 10)      readabilityGrade = 'Very Difficult';
  else if (fleschKincaid < 30) readabilityGrade = 'Difficult';
  else if (fleschKincaid < 50) readabilityGrade = 'Fairly Difficult';
  else if (fleschKincaid < 60) readabilityGrade = 'Standard';
  else if (fleschKincaid < 70) readabilityGrade = 'Fairly Easy';
  else if (fleschKincaid < 80) readabilityGrade = 'Easy';
  else readabilityGrade = 'Very Easy';

  const avgWordLength = words.reduce((s, w) => s + w.length, 0) / (wordCount || 1);

  const hasVideo   = !!$('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
  const hasAudio   = !!$('audio').length;
  const hasFAQ     = !!$('[itemtype*="FAQPage"], .faq, #faq, [class*="faq"]').length;

  let score = 100;

  if (wordCount < 300) {
    issues.push({ type: 'thin-content', severity: 'high', category: 'Content', title: `Thin Content (${wordCount} words)`, description: 'Page has fewer than 300 words.', recommendation: 'Expand content to at least 600–800 words.', impact: 'Thin content ranks poorly.' });
    score -= 25;
  } else if (wordCount < 600) {
    issues.push({ type: 'short-content', severity: 'medium', category: 'Content', title: `Short Content (${wordCount} words)`, description: 'Content below 600 words.', recommendation: 'Consider expanding to 800+ words for competitive topics.', impact: 'May underperform vs longer competitors.' });
    score -= 10;
  }

  if (fleschKincaid < 30) {
    issues.push({ type: 'hard-readability', severity: 'medium', category: 'Content', title: 'Low Readability Score', description: `Flesch score: ${fleschKincaid.toFixed(1)} — Very Difficult.`, recommendation: 'Use shorter sentences and simpler words.', impact: 'High bounce rate from confused visitors.' });
    score -= 15;
  }

  if (avgWordsPerSentence > 25) {
    issues.push({ type: 'long-sentences', severity: 'low', category: 'Content', title: 'Long Average Sentence Length', description: `Average ${avgWordsPerSentence.toFixed(1)} words/sentence.`, recommendation: 'Aim for under 20 words per sentence.', impact: 'Reduces readability.' });
    score -= 5;
  }

  return {
    wordCount, readabilityScore: parseFloat(fleschKincaid.toFixed(1)), readabilityGrade,
    fleschKincaid: parseFloat(fleschKincaid.toFixed(1)),
    avgSentenceLength: parseFloat(avgWordsPerSentence.toFixed(1)),
    avgWordLength: parseFloat(avgWordLength.toFixed(1)),
    paragraphCount, sentenceCount,
    hasVideo, hasAudio, hasFAQ,
    contentFreshness: 'Unknown',
    duplicateContent: false,
    thinContent: wordCount < 300,
    score: Math.max(0, score), issues,
  };
}

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = word.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

/* ─────────────────────────────────────────────
   8. SOCIAL / TRACKING ANALYSIS
───────────────────────────────────────────── */
function analyseSocial($) {
  const issues = [];
  const hasOpenGraph   = !!$('meta[property^="og:"]').length;
  const hasTwitterCard = !!$('meta[name^="twitter:"]').length;
  const hasSchemaOrg   = !!$('script[type="application/ld+json"]').length;
  const scripts = $('script').toArray().map(el => $(el).html() || '').join(' ');
  const facebookPixel  = scripts.includes('fbq(') || scripts.includes('facebook.net/en_US/fbevents');
  const googleAnalytics= scripts.includes('google-analytics.com') || scripts.includes('gtag(');
  const googleTagManager = scripts.includes('googletagmanager.com');

  let score = 100;

  if (!hasOpenGraph) {
    issues.push({ type: 'no-og', severity: 'medium', category: 'Social', title: 'Missing Open Graph Tags', description: 'No Open Graph meta tags.', recommendation: 'Add og:title, og:description, og:image.', impact: 'Poor Facebook/LinkedIn sharing.' });
    score -= 20;
  }
  if (!hasTwitterCard) {
    issues.push({ type: 'no-twitter', severity: 'low', category: 'Social', title: 'Missing Twitter Card Tags', description: 'No Twitter Card meta tags.', recommendation: 'Add twitter:card, twitter:title, twitter:description.', impact: 'Poor Twitter sharing.' });
    score -= 10;
  }

  return { hasOpenGraph, hasTwitterCard, hasSchemaOrg, facebookPixel, googleAnalytics, googleTagManager, score: Math.max(0, score), issues };
}

/* ─────────────────────────────────────────────
   9. PAGESPEED (Moz fallback → manual)
───────────────────────────────────────────── */
async function fetchPageSpeed(url) {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (apiKey) {
    try {
      const r = await axios.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', {
        params: { url, key: apiKey, strategy: 'mobile' }, timeout: 20000,
      });
      const cats = r.data.lighthouseResult?.categories;
      const audits = r.data.lighthouseResult?.audits;
      return {
        score: Math.round((cats?.performance?.score || 0) * 100),
        fcp:   audits?.['first-contentful-paint']?.numericValue || 0,
        lcp:   audits?.['largest-contentful-paint']?.numericValue || 0,
        cls:   audits?.['cumulative-layout-shift']?.numericValue || 0,
        ttfb:  audits?.['server-response-time']?.numericValue || 0,
        tti:   audits?.['interactive']?.numericValue || 0,
        tbt:   audits?.['total-blocking-time']?.numericValue || 0,
        source: 'PageSpeed API',
      };
    } catch {}
  }

  // Manual timing
  const start = Date.now();
  try {
    await axios.get(url, { timeout: 10000 });
    const ttfb = Date.now() - start;
    const estimated = Math.max(10, 100 - Math.round(ttfb / 50));
    return { score: estimated, fcp: ttfb * 1.5, lcp: ttfb * 2.5, cls: 0, ttfb, tti: ttfb * 3, tbt: 0, source: 'Estimated' };
  } catch {
    return { score: 0, fcp: 0, lcp: 0, cls: 0, ttfb: 0, tti: 0, tbt: 0, source: 'Failed' };
  }
}

/* ─────────────────────────────────────────────
   MASTER ANALYSE FUNCTION
───────────────────────────────────────────── */
async function analyseUrl(rawUrl) {
  const start = Date.now();
  const url   = normaliseUrl(rawUrl);
  const domain = extractDomain(url);

  const { html, finalUrl } = await fetchHtml(url);
  const $ = cheerio.load(html);

  // Run analyses in parallel where possible
  const [
    meta,
    headings,
    images,
    technical,
    content,
    social,
    pageSpeed,
  ] = await Promise.all([
    Promise.resolve(analyseMeta($, finalUrl)),
    Promise.resolve(analyseHeadings($)),
    Promise.resolve(analyseImages($)),
    analyseTechnical(finalUrl, $),
    Promise.resolve(analyseContent($)),
    Promise.resolve(analyseSocial($)),
    fetchPageSpeed(finalUrl),
  ]);

  // Sequential (needs meta + headings)
  const keywords = analyseKeywords($, meta, headings);
  const links    = await analyseLinks($, finalUrl);

  // Structured data from technical
  const structuredData = technical._ldJsonBlocks || [];
  delete technical._ldJsonBlocks;

  // Category scores
  const categoryScores = {
    meta:      meta.score,
    headings:  headings.score,
    images:    images.score,
    keywords:  keywords.score,
    links:     links.score,
    technical: technical.score,
    content:   content.score,
    social:    social.score,
  };

  // Overall score
  const weights = { meta: 0.20, headings: 0.10, images: 0.08, keywords: 0.12, links: 0.10, technical: 0.20, content: 0.12, social: 0.08 };
  const overallScore = Math.round(Object.entries(categoryScores).reduce((s, [k, v]) => s + (v * (weights[k] || 0)), 0));

  // Aggregate all issues
  const allIssues = [
    ...meta.issues, ...headings.issues, ...images.issues,
    ...keywords.issues, ...links.issues, ...technical.issues,
    ...content.issues, ...social.issues,
  ].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return (order[a.severity] || 4) - (order[b.severity] || 4);
  });

  return {
    url, finalUrl, domain,
    analysisDuration: Date.now() - start,
    overallScore,
    meta, headings, images, keywords, links,
    technical, content, structuredData, social, pageSpeed,
    categoryScores, allIssues,
    criticalCount: allIssues.filter(i => i.severity === 'critical').length,
    highCount:     allIssues.filter(i => i.severity === 'high').length,
    mediumCount:   allIssues.filter(i => i.severity === 'medium').length,
    lowCount:      allIssues.filter(i => i.severity === 'low').length,
  };
}

/* ─────────────────────────────────────────────
   AI REPORT GENERATION (Groq)
───────────────────────────────────────────── */
async function generateAiReport(record) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY not set');

  const summary = {
    url:          record.url,
    overallScore: record.overallScore,
    categoryScores: record.categoryScores,
    criticalCount: record.criticalCount,
    highCount:     record.highCount,
    mediumCount:   record.mediumCount,
    topIssues:     (record.allIssues || []).slice(0, 12).map(i => ({ severity: i.severity, title: i.title, recommendation: i.recommendation })),
    meta:          { title: record.meta?.title, titleLength: record.meta?.titleLength, descriptionLength: record.meta?.descriptionLength, hasCanonical: !!record.meta?.canonical },
    headings:      { h1Count: record.headings?.h1Count, h2Count: record.headings?.h2Count, hierarchy: record.headings?.hierarchy },
    images:        { total: record.images?.total, withoutAlt: record.images?.withoutAlt },
    links:         { total: record.links?.totalLinks, broken: record.links?.brokenLinks, internal: record.links?.internalLinks },
    technical:     { hasSSL: record.technical?.hasSSL, hasSitemap: record.technical?.sitemapExists, hasRobots: record.technical?.robotsTxtExists, hasSchema: record.technical?.structuredData },
    content:       { wordCount: record.content?.wordCount, readabilityScore: record.content?.readabilityScore, readabilityGrade: record.content?.readabilityGrade },
    pageSpeed:     { score: record.pageSpeed?.score },
  };

  const prompt = `You are an expert SEO consultant. Analyse the following SEO audit data for ${record.url} and generate a comprehensive, professional AI insight report in clean HTML.

Data:
${JSON.stringify(summary, null, 2)}

Generate the report with these sections using HTML tags (h2, h3, p, ul, li, strong, span):

1. <h2>🌐 Website Health Summary</h2> — Overall score, what it means, 2-3 sentence overview

2. <h2>⚠️ Critical Issues</h2> — List the most important problems that need immediate attention, explained in plain English

3. <h2>✅ What's Working Well</h2> — Positive aspects found on the website

4. <h2>🔧 How to Fix Issues</h2> — Step-by-step fix recommendations for each major issue, prioritised

5. <h2>📊 Issues Summary Table</h2> — An HTML table with columns: Issue | Severity | Category | Impact | Priority with ALL issues listed, colour-coded severity (use inline style: critical=red, high=orange, medium=yellow, low=green)

6. <h2>🎯 SEO Score Breakdown</h2> — Brief notes on each category score

Keep language simple and actionable. Use emojis for visual appeal. Make the table comprehensive.`;

  const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096,
    temperature: 0.4,
  }, { headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' }, timeout: 60000 });

  return r.data.choices[0].message.content;
}

module.exports = { analyseUrl, generateAiReport };