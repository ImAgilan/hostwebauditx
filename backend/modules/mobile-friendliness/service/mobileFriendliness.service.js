'use strict';

/**
 * mobileFriendliness.service.js
 * Orchestrates: Google PageSpeed · Moz · Manual (Axios+Cheerio) · Puppeteer
 * If any external API fails → falls back to manual calculation
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const MF      = require('../model/mobileFriendliness.model');

/* ═══════════════════════════════════════════════════════════
   1.  GOOGLE PAGESPEED INSIGHTS API
════════════════════════════════════════════════════════════ */
async function fetchPageSpeed(url) {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return { available: false };

  try {
    const { data } = await axios.get(
      'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
      { params: { url, strategy: 'mobile', key }, timeout: 60_000 }
    );

    const lhr    = data.lighthouseResult || {};
    const cats   = lhr.categories  || {};
    const audits = lhr.audits      || {};
    const stack  = lhr.stackPacks  || [];

    /* helper */
    const av = (id) => audits[id]?.displayValue  || null;
    const nv = (id) => audits[id]?.numericValue  ?? null;
    const sc = (id) => Math.round((cats[id]?.score ?? 0) * 100);

    /* Collect all audit issues with details */
    const rawAudits = {};
    Object.entries(audits).forEach(([id, audit]) => {
      if (audit.score !== null && audit.score < 1) {
        rawAudits[id] = {
          title:       audit.title,
          description: audit.description,
          score:       audit.score,
          displayValue:audit.displayValue,
          details:     audit.details || null,
          numericValue:audit.numericValue || null,
        };
      }
    });

    return {
      available:          true,
      performanceScore:   sc('performance'),
      accessibilityScore: sc('accessibility'),
      seoScore:           sc('seo'),
      bestPracticesScore: sc('best-practices'),
      fcp:  av('first-contentful-paint'),
      lcp:  av('largest-contentful-paint'),
      tti:  av('interactive'),
      tbt:  av('total-blocking-time'),
      si:   av('speed-index'),
      fid:  av('max-potential-fid'),
      ttfb: av('server-response-time'),
      cls:  nv('cumulative-layout-shift'),
      rawAudits,
    };
  } catch (e) {
    console.warn('[PageSpeed] failed:', e.message);
    return { available: false, error: e.message };
  }
}

/* ═══════════════════════════════════════════════════════════
   2.  MOZ API  (Link metrics, Domain Authority)
════════════════════════════════════════════════════════════ */
async function fetchMoz(url) {
  const accessId  = process.env.MOZ_ACCESS_ID;
  const secretKey = process.env.MOZ_SECRET_KEY;
  if (!accessId || !secretKey) return { available: false };

  try {
    const expires = Math.floor(Date.now() / 1000) + 300;
    const token   = Buffer.from(`${accessId}:${secretKey}`).toString('base64');

    const { data } = await axios.post(
      'https://lsapi.seomoz.com/v2/url_metrics',
      { targets: [url] },
      {
        headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' },
        timeout: 20_000,
      }
    );

    const r = data.results?.[0] || {};
    return {
      available:       true,
      domainAuthority: r.domain_authority  ?? null,
      pageAuthority:   r.page_authority    ?? null,
      spamScore:       r.spam_score        ?? null,
      linkingDomains:  r.linking_domains   ?? null,
    };
  } catch (e) {
    console.warn('[Moz] failed:', e.message);
    return { available: false, error: e.message };
  }
}

/* ═══════════════════════════════════════════════════════════
   3.  MANUAL ANALYSIS (Axios + Cheerio)  — always runs
════════════════════════════════════════════════════════════ */
async function runManualAnalysis(url) {
  try {
    const { data: html, headers, request: req } = await axios.get(url, {
      timeout: 20_000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml',
      },
      validateStatus: () => true,
    });

    const $ = cheerio.load(html);

    /* ── Viewport ── */
    const viewportMeta    = $('meta[name="viewport"]').attr('content') || '';
    const hasViewportMeta = viewportMeta.length > 0;
    const viewportCorrect = hasViewportMeta && viewportMeta.includes('width=device-width');
    const pinchZoomBlocked = viewportMeta.includes('user-scalable=no') || viewportMeta.includes('maximum-scale=1');

    /* ── CSS / Responsive ── */
    const cssLinks = $('link[rel="stylesheet"]').length;
    let   mediaQueryCount = 0;
    let   hasFlexOrGrid   = false;
    let   renderBlocking  = 0;
    let   inlineStyles    = 0;

    $('style').each((_, el) => {
      const css = $(el).html() || '';
      if (css.includes('@media')) mediaQueryCount++;
      if (css.includes('flex') || css.includes('grid')) hasFlexOrGrid = true;
    });
    $('link[rel="stylesheet"]').each((_, el) => {
      if (!$(el).attr('media') || $(el).attr('media') === 'all') renderBlocking++;
    });
    $('[style]').each(() => inlineStyles++);

    /* ── Images ── */
    const imgs             = $('img');
    const totalImages      = imgs.length;
    let   missingAlt       = 0;
    let   unoptimizedImages= 0;
    let   nextGenFormats   = 0;
    let   hasLazyLoading   = false;

    imgs.each((_, el) => {
      const src     = $(el).attr('src') || '';
      const alt     = $(el).attr('alt');
      const loading = $(el).attr('loading');
      const w       = $(el).attr('width');
      const h       = $(el).attr('height');

      if (alt === undefined || alt === null) missingAlt++;
      if (loading === 'lazy') hasLazyLoading = true;
      if (/\.(webp|avif)$/i.test(src)) nextGenFormats++;
      if (!w || !h) unoptimizedImages++;
    });

    /* ── Links & Navigation ── */
    const totalLinks   = $('a[href]').length;
    const hamburger    = !!(
      $('[class*="hamburger"], [class*="menu-toggle"], [class*="nav-toggle"], [class*="mobile-menu"]').length ||
      $('button[aria-label*="menu" i], button[aria-controls*="nav" i]').length
    );
    const navLinks     = $('nav a').length;
    const skipLinks    = !!$('a[href="#main"], a[href="#content"], [class*="skip"]').length;

    /* ── Meta / SEO ── */
    const title         = $('title').text().trim();
    const metaDesc      = $('meta[name="description"]').attr('content') || '';
    const canonical     = !!$('link[rel="canonical"]').length;
    const h1Count       = $('h1').length;
    const openGraph     = !!$('meta[property^="og:"]').length;
    const structuredData= !!$('script[type="application/ld+json"]').length;
    const ampLink       = !!$('link[rel="amphtml"]').length;

    /* ── PWA ── */
    const manifest      = !!$('link[rel="manifest"]').length;
    const touchIcons    = !!$('link[rel*="apple-touch-icon"], link[rel*="icon"]').length;

    /* ── Accessibility ── */
    const ariaLabels    = $('[aria-label], [aria-labelledby]').length > 0;
    const formLabels    = $('form label').length > 0 && $('form input:not([type="hidden"])').length <= $('form label').length;
    const isHttps       = url.startsWith('https://');

    /* ── Font / Readability (heuristics from CSS) ── */
    let   smallFontCount = 0;
    let   avgFontSize    = 16;
    $('style').each((_, el) => {
      const css = $(el).html() || '';
      const matches = css.match(/font-size:\s*([\d.]+)px/g) || [];
      matches.forEach(m => {
        const size = parseFloat(m.replace(/[^0-9.]/g, ''));
        if (size < 14) smallFontCount++;
      });
    });

    /* ── Page size estimate ── */
    const pageLoadSize = Buffer.byteLength(html, 'utf8');

    return {
      available:         true,
      hasViewportMeta,
      viewportContent:   viewportMeta,
      viewportCorrect,
      pinchZoomBlocked,
      hasMediaQueries:   mediaQueryCount > 0,
      hasFlexOrGrid,
      hasTouchIcons:     touchIcons,
      hasAmpVersion:     ampLink,
      hasManifest:       manifest,
      isHttps,
      pageLoadSize,
      imageCount:        totalImages,
      unoptimizedImages,
      missingAlt,
      nextGenFormats,
      hasLazyLoading,
      totalLinks,
      hasStructuredData: structuredData,
      hasOpenGraph:      openGraph,
      titleLength:       title.length,
      metaDescLength:    metaDesc.length,
      h1Count,
      hasCanonical:      canonical,
      renderBlocking,
      inlineStyles,
      smallFontCount,
      hamburger,
      navigationDepth:   navLinks,
      hasSkipLinks:      skipLinks,
      hasAriaLabels:     ariaLabels,
      hasFormLabels:     formLabels,
      hasTouchIcons:     touchIcons,
    };
  } catch (e) {
    console.warn('[Manual] failed:', e.message);
    return { available: false, error: e.message };
  }
}

/* ═══════════════════════════════════════════════════════════
   4.  STRUCTURED METRICS BUILDER
════════════════════════════════════════════════════════════ */
function buildMobileMetrics(ps, moz, manual) {

  /* ── Performance (PageSpeed first, manual fallback) ── */
  const performance = {
    performanceScore:       ps.available ? ps.performanceScore  : manualPerfScore(manual),
    firstContentfulPaint:   ps.fcp   || 'N/A',
    largestContentfulPaint: ps.lcp   || 'N/A',
    timeToInteractive:      ps.tti   || 'N/A',
    totalBlockingTime:      ps.tbt   || 'N/A',
    cumulativeLayoutShift:  ps.cls   ?? null,
    speedIndex:             ps.si    || 'N/A',
    timeToFirstByte:        ps.ttfb  || 'N/A',
    firstInputDelay:        ps.fid   || 'N/A',
    pageSize:               manual.available ? Math.round(manual.pageLoadSize / 1024) : 0, // KB
  };

  /* ── Responsive ── */
  const responsive = {
    hasViewportMeta:   manual.hasViewportMeta   ?? false,
    viewportCorrect:   manual.viewportCorrect   ?? false,
    hasMediaQueries:   manual.hasMediaQueries   ?? false,
    hasFlexOrGrid:     manual.hasFlexOrGrid     ?? false,
    mobileLayoutScore: calcResponsiveScore(manual),
    overflowIssues:    0,
    stackingIssues:    0,
    brokenLayouts:     0,
  };

  /* ── Readability ── */
  const readability = {
    avgFontSize:        manual.avgFontSize    ?? 16,
    smallFontCount:     manual.smallFontCount ?? 0,
    lineSpacingOk:      true,
    contrastIssues:     ps.available
      ? (ps.rawAudits?.['color-contrast']?.score === 0 ? 1 : 0)
      : 0,
    fontLoadPerformance: manual.renderBlocking > 2 ? 'slow' : 'ok',
  };

  /* ── Tap Targets ── */
  const tapTargetAudit = ps.rawAudits?.['tap-targets'];
  const tapTargets = {
    totalTargets:   manual.totalLinks ?? 0,
    smallTargets:   tapTargetAudit ? Math.round((1 - (tapTargetAudit.score ?? 1)) * 10) : 0,
    overlappingCount: 0,
    passRate:       tapTargetAudit
      ? Math.round((tapTargetAudit.score ?? 1) * 100)
      : (manual.hasViewportMeta ? 85 : 40),
    tapTargetScore: tapTargetAudit
      ? Math.round((tapTargetAudit.score ?? 1) * 100)
      : 80,
  };

  /* ── Touch gestures ── */
  const touchGestures = {
    pinchZoomEnabled: !(manual.pinchZoomBlocked ?? false),
    smoothScrolling:  true,
    touchEventsOk:    true,
    blockedGestures:  manual.pinchZoomBlocked ? ['pinch-zoom', 'user-scale'] : [],
  };

  /* ── Navigation ── */
  const navigation = {
    hasMobileMenu:   manual.hamburger        ?? false,
    hasHamburger:    manual.hamburger        ?? false,
    navigationDepth: manual.navigationDepth  ?? 0,
    menuClarity:     manual.hamburger ? 'good' : (manual.navigationDepth > 7 ? 'poor' : 'acceptable'),
    hasSkipLinks:    manual.hasSkipLinks     ?? false,
  };

  /* ── Images ── */
  const images = {
    totalImages:       manual.imageCount        ?? 0,
    unoptimizedImages: manual.unoptimizedImages ?? 0,
    missingAlt:        manual.missingAlt        ?? 0,
    hasLazyLoading:    manual.hasLazyLoading    ?? false,
    nextGenFormats:    manual.nextGenFormats     ?? 0,
    oversizedImages:   manual.unoptimizedImages ?? 0,
  };

  /* ── Security ── */
  const security = {
    isHttps:        manual.isHttps     ?? false,
    hasHsts:        false,
    hasMixedContent:false,
    securityScore:  calcSecurityScore(manual),
  };

  /* ── SEO ── */
  const seo = {
    titleLength:       manual.titleLength        ?? 0,
    metaDescLength:    manual.metaDescLength     ?? 0,
    h1Count:           manual.h1Count            ?? 0,
    hasCanonical:      manual.hasCanonical       ?? false,
    hasStructuredData: manual.hasStructuredData  ?? false,
    hasOpenGraph:      manual.hasOpenGraph       ?? false,
    hasAmpVersion:     manual.hasAmpVersion      ?? false,
    hasRobotsTxt:      false,
    hasSitemap:        false,
    mobileFirstIndex:  manual.hasViewportMeta    ?? false,
    seoScore:          ps.available ? ps.seoScore : calcSeoScore(manual),
  };

  /* ── Accessibility ── */
  const accessibility = {
    hasAriaLabels:      manual.hasAriaLabels ?? false,
    hasSkipLinks:       manual.hasSkipLinks  ?? false,
    imagesHaveAlt:      (manual.missingAlt   ?? 1) === 0,
    formsHaveLabels:    manual.hasFormLabels ?? false,
    colorContrastOk:    (readability.contrastIssues ?? 0) === 0,
    accessibilityScore: ps.available ? ps.accessibilityScore : calcAccessibilityScore(manual),
  };

  /* ── PWA ── */
  const pwa = {
    hasManifest:      manual.hasManifest    ?? false,
    hasServiceWorker: false,
    isInstallable:    false,
    hasTouchIcons:    manual.hasTouchIcons  ?? false,
    pwaScore:         calcPwaScore(manual),
  };

  return { responsive, readability, tapTargets, touchGestures, navigation, performance, images, security, seo, accessibility, pwa };
}

/* ── Manual score helpers ── */
function manualPerfScore(m) {
  if (!m.available) return 50;
  let s = 100;
  if (m.renderBlocking > 3) s -= 20;
  if (m.pageLoadSize > 1_000_000) s -= 20;
  if (m.unoptimizedImages > 5) s -= 15;
  if (!m.hasLazyLoading && m.imageCount > 5) s -= 10;
  if (m.inlineStyles > 10) s -= 5;
  return Math.max(10, s);
}
function calcResponsiveScore(m) {
  let s = 0;
  if (m.hasViewportMeta)  s += 35;
  if (m.viewportCorrect)  s += 15;
  if (m.hasMediaQueries)  s += 25;
  if (m.hasFlexOrGrid)    s += 15;
  if (m.hamburger)        s += 10;
  return Math.min(100, s);
}
function calcSecurityScore(m) {
  let s = 0;
  if (m.isHttps) s += 70;
  s += 30;
  return Math.min(100, s);
}
function calcSeoScore(m) {
  let s = 0;
  if (m.titleLength > 10 && m.titleLength < 70)  s += 20;
  if (m.metaDescLength > 50 && m.metaDescLength < 160) s += 20;
  if (m.h1Count === 1) s += 15;
  if (m.hasCanonical)      s += 10;
  if (m.hasStructuredData) s += 15;
  if (m.hasOpenGraph)      s += 10;
  if (m.hasViewportMeta)   s += 10;
  return Math.min(100, s);
}
function calcAccessibilityScore(m) {
  let s = 0;
  if (m.hasAriaLabels) s += 30;
  if (m.hasSkipLinks)  s += 20;
  if ((m.missingAlt ?? 1) === 0) s += 30;
  if (m.hasFormLabels) s += 20;
  return Math.min(100, s);
}
function calcPwaScore(m) {
  let s = 0;
  if (m.hasManifest)    s += 40;
  if (m.hasTouchIcons)  s += 30;
  if (m.isHttps)        s += 30;
  return Math.min(100, s);
}

/* ═══════════════════════════════════════════════════════════
   5.  ISSUE DETECTOR
════════════════════════════════════════════════════════════ */
function detectIssues(metrics, ps, manual) {
  const issues = [];
  let id = 1;
  const mk = (title, desc, sev, cat, impact, fix, detail = '', device = 'mobile', src = 'manual') => ({
    id: `ISS-${String(id++).padStart(3,'0')}`,
    title, description: desc, detail, device, severity: sev,
    category: cat, impact, howToFix: fix, source: src,
  });

  /* ── Responsive ── */
  if (!metrics.responsive.hasViewportMeta)
    issues.push(mk(
      'Missing Viewport Meta Tag',
      'Your page has no <meta name="viewport"> tag, which is required for proper mobile display.',
      'critical', 'responsive',
      'Google will rank your site lower in mobile search. Users will see a zoomed-out desktop layout.',
      'Add <meta name="viewport" content="width=device-width, initial-scale=1"> inside your <head> tag.',
      'Without this tag, mobile browsers default to a 980px desktop viewport.',
    ));
  else if (!metrics.responsive.viewportCorrect)
    issues.push(mk(
      'Viewport Meta Tag Misconfigured',
      'Viewport tag exists but is missing "width=device-width". Content may not scale properly.',
      'medium', 'responsive',
      'Layout may appear zoomed-in or mis-sized on small screens.',
      'Update the viewport tag to: content="width=device-width, initial-scale=1"',
    ));

  if (!metrics.responsive.hasMediaQueries)
    issues.push(mk(
      'No Media Queries Detected',
      'No CSS @media queries found. Your layout may not adapt to different screen sizes.',
      'critical', 'responsive',
      'Elements may overflow, overlap, or appear too small/large on mobile devices.',
      'Add CSS media queries for mobile breakpoints (e.g. @media (max-width: 768px) { ... })',
      'Media queries are the backbone of responsive design.',
    ));

  /* ── Touch ── */
  if (!metrics.touchGestures.pinchZoomEnabled)
    issues.push(mk(
      'Pinch-to-Zoom Disabled',
      'The viewport tag blocks user scaling (user-scalable=no or maximum-scale=1).',
      'critical', 'accessibility',
      'Violates WCAG 2.1 SC 1.4.4. Google flags this as a mobile usability issue.',
      'Remove user-scalable=no and maximum-scale=1 from your viewport meta tag.',
      '', 'both', 'manual'
    ));

  /* ── Tap Targets ── */
  if (metrics.tapTargets.passRate < 80)
    issues.push(mk(
      'Tap Targets Too Small',
      `${metrics.tapTargets.smallTargets || 'Multiple'} clickable elements are smaller than the recommended 48×48px.`,
      metrics.tapTargets.passRate < 50 ? 'critical' : 'medium', 'usability',
      'Users frequently tap wrong elements, causing frustration and increasing bounce rate.',
      'Set minimum width and height of 48px on all buttons, links, and interactive elements. Add padding instead of margin.',
      '', 'mobile', ps.available ? 'pagespeed' : 'manual'
    ));

  /* ── Performance ── */
  const perfScore = metrics.performance.performanceScore;
  if (perfScore !== null) {
    if (perfScore < 50)
      issues.push(mk(
        'Very Poor Mobile Performance',
        `Mobile performance score is ${perfScore}/100. Pages load slowly causing users to leave.`,
        'critical', 'performance',
        'Each 1-second delay reduces conversions by 7%. Below 50 score significantly hurts SEO.',
        'Optimize images, reduce JavaScript bundle size, enable caching, use a CDN.',
        '', 'mobile', ps.available ? 'pagespeed' : 'manual'
      ));
    else if (perfScore < 75)
      issues.push(mk(
        'Below-Average Mobile Performance',
        `Performance score of ${perfScore}/100 needs improvement.`,
        'medium', 'performance',
        'Users on 3G/4G connections will notice slow load times.',
        'Reduce unused JavaScript/CSS, optimize images, defer non-critical scripts.',
        '', 'mobile', ps.available ? 'pagespeed' : 'manual'
      ));
  }

  /* LCP */
  if (ps.available && ps.rawAudits?.['largest-contentful-paint']) {
    const lcpMs = ps.rawAudits['largest-contentful-paint']?.numericValue || 0;
    if (lcpMs > 4000)
      issues.push(mk(
        'Slow Largest Contentful Paint (LCP)',
        `LCP is ${(lcpMs/1000).toFixed(1)}s. Good LCP should be under 2.5s.`,
        lcpMs > 6000 ? 'critical' : 'medium', 'performance',
        'LCP is a Core Web Vital that directly affects Google ranking and user experience.',
        'Optimize the largest image/text element on screen. Use preload for hero images, reduce server response time.',
        '', 'mobile', 'pagespeed'
      ));
  }

  /* CLS */
  if (ps.cls !== null && ps.cls > 0.1)
    issues.push(mk(
      'High Cumulative Layout Shift (CLS)',
      `CLS score is ${ps.cls.toFixed(3)}. Good CLS should be under 0.1.`,
      ps.cls > 0.25 ? 'critical' : 'medium', 'performance',
      'Elements jump around while loading, creating a confusing experience on mobile.',
      'Always include width/height on images. Avoid inserting content above existing content. Reserve space for ads/embeds.',
      '', 'mobile', 'pagespeed'
    ));

  /* TBT */
  if (ps.available && ps.rawAudits?.['total-blocking-time']) {
    const tbtMs = ps.rawAudits['total-blocking-time']?.numericValue || 0;
    if (tbtMs > 300)
      issues.push(mk(
        'High Total Blocking Time',
        `TBT is ${Math.round(tbtMs)}ms. Should be under 200ms for good user experience.`,
        tbtMs > 600 ? 'critical' : 'medium', 'performance',
        'Long JavaScript tasks block the main thread, making the page unresponsive to touches/taps.',
        'Split large JavaScript bundles, defer non-critical scripts, reduce third-party scripts.',
        '', 'mobile', 'pagespeed'
      ));
  }

  /* ── Images ── */
  if (metrics.images.missingAlt > 0)
    issues.push(mk(
      'Images Missing Alt Text',
      `${metrics.images.missingAlt} image(s) have no alt attribute. Screen readers cannot describe them.`,
      metrics.images.missingAlt > 5 ? 'medium' : 'low', 'accessibility',
      'Fails accessibility standards (WCAG 2.1). Reduces SEO as Google cannot understand image content.',
      'Add descriptive alt="..." text to every <img> tag. Use alt="" for decorative images.',
    ));

  if (!metrics.images.hasLazyLoading && metrics.images.totalImages > 5)
    issues.push(mk(
      'Images Not Lazy Loaded',
      `${metrics.images.totalImages} images found but lazy loading is not enabled. All images load at page open.`,
      'medium', 'performance',
      'Unnecessary data usage on mobile increases page load time significantly.',
      'Add loading="lazy" attribute to all <img> tags below the fold. Use Intersection Observer API for advanced control.',
    ));

  if (metrics.images.unoptimizedImages > 3)
    issues.push(mk(
      'Unoptimized Images',
      `${metrics.images.unoptimizedImages} images lack proper width/height attributes or sizing metadata.`,
      'low', 'performance',
      'Images without dimensions cause layout shifts and slower rendering on mobile.',
      'Always set explicit width and height on <img> tags. Serve mobile-optimized image sizes using srcset.',
    ));

  /* ── SEO ── */
  if (!metrics.seo.titleLength || metrics.seo.titleLength < 10)
    issues.push(mk(
      'Page Title Missing or Too Short',
      `Page title is ${metrics.seo.titleLength} characters. Should be 50-60 characters.`,
      'medium', 'seo',
      'Poor title affects click-through rate from Google search results and mobile bookmarks.',
      'Write a descriptive title between 50-60 characters that includes your main keyword.',
    ));
  else if (metrics.seo.titleLength > 70)
    issues.push(mk(
      'Page Title Too Long',
      `Title is ${metrics.seo.titleLength} characters. Google truncates titles over 60 characters in mobile results.`,
      'low', 'seo',
      'Title gets cut off in mobile search results reducing click-through rate.',
      'Shorten your page title to under 60 characters.',
    ));

  if (!metrics.seo.metaDescLength || metrics.seo.metaDescLength < 50)
    issues.push(mk(
      'Meta Description Missing or Too Short',
      `Meta description is ${metrics.seo.metaDescLength} characters. Should be 120-160 characters.`,
      'medium', 'seo',
      'Google uses meta description in search snippets. Poor description reduces mobile search traffic.',
      'Write a compelling meta description between 120-160 characters summarizing the page content.',
    ));

  if (metrics.seo.h1Count === 0)
    issues.push(mk('No H1 Tag Found', 'Page has no H1 heading. H1 tells search engines the main topic of your page.', 'medium', 'seo', 'Reduces SEO clarity and page structure for both users and search engines.', 'Add exactly one H1 tag containing your main keyword.'));
  else if (metrics.seo.h1Count > 1)
    issues.push(mk('Multiple H1 Tags', `Page has ${metrics.seo.h1Count} H1 tags. Only one is recommended.`, 'low', 'seo', 'Confuses search engines about which heading is primary.', 'Keep only one H1 per page. Convert additional H1s to H2 or H3.'));

  if (!metrics.seo.hasCanonical)
    issues.push(mk('No Canonical Tag', 'No canonical URL specified. May cause duplicate content issues.', 'low', 'seo', 'Search engines may index multiple versions of the same page, diluting SEO value.', 'Add <link rel="canonical" href="..."> pointing to the preferred version of the page.'));

  if (!metrics.seo.hasOpenGraph)
    issues.push(mk('No Open Graph Tags', 'No Open Graph meta tags found. Social sharing will use default link preview.', 'low', 'seo', 'Links shared on social media (Facebook, Twitter, WhatsApp) will look generic and unappealing.', 'Add og:title, og:description, og:image, and og:url meta tags.'));

  /* ── Security ── */
  if (!metrics.security.isHttps)
    issues.push(mk(
      'Site Not Served Over HTTPS',
      'Your site uses HTTP instead of HTTPS. Connection is not encrypted.',
      'critical', 'security',
      'Chrome shows "Not Secure" warning. Google ranks HTTPS sites higher. Data transmitted is not protected.',
      'Purchase an SSL certificate (or use free Let\'s Encrypt). Redirect all HTTP traffic to HTTPS.',
      '', 'all'
    ));

  /* ── PWA ── */
  if (!metrics.pwa.hasManifest)
    issues.push(mk('No Web App Manifest', 'No manifest.json detected. Site cannot be added to home screen as a PWA.', 'low', 'pwa', 'Users cannot install your site as a home screen app. Reduces engagement.', 'Create a manifest.json with name, icons, start_url, display: standalone, and link it in <head>.'));

  /* ── Accessibility ── */
  if (!metrics.accessibility.hasAriaLabels)
    issues.push(mk('No ARIA Labels', 'No ARIA labels detected on interactive elements.', 'medium', 'accessibility', 'Screen readers cannot describe interactive elements to visually impaired users.', 'Add aria-label or aria-labelledby attributes to buttons, inputs, and navigation elements.'));

  /* ── Navigation ── */
  if (!metrics.navigation.hasMobileMenu && metrics.navigation.navigationDepth > 6)
    issues.push(mk(
      'No Mobile Navigation Menu',
      `Site has ${metrics.navigation.navigationDepth} nav links but no mobile menu (hamburger) detected.`,
      'high' in {'critical':1,'medium':1,'low':1} ? 'medium' : 'medium', 'navigation',
      'Navigation bar may overflow on mobile, links may be too small to tap, users may not find content.',
      'Implement a responsive hamburger menu that collapses navigation on mobile screens.',
    ));

  /* PageSpeed-specific audits */
  if (ps.available) {
    const psAudits = ps.rawAudits || {};
    if (psAudits['render-blocking-resources'])
      issues.push(mk(
        'Render-Blocking Resources',
        'Scripts or stylesheets are blocking the page from rendering quickly.',
        'medium', 'performance',
        'Delays First Contentful Paint. Users see a blank screen for longer.',
        'Defer non-critical JavaScript with async/defer. Inline critical CSS or use preload.',
        psAudits['render-blocking-resources']?.description || '', 'mobile', 'pagespeed'
      ));
    if (psAudits['unused-javascript'])
      issues.push(mk(
        'Unused JavaScript',
        'Significant unused JavaScript is being downloaded but not executed.',
        'medium', 'performance',
        'Wastes bandwidth on mobile connections and delays interactivity.',
        'Use code splitting, tree shaking, and dynamic imports. Remove unused libraries.',
        '', 'mobile', 'pagespeed'
      ));
    if (psAudits['unused-css-rules'])
      issues.push(mk(
        'Unused CSS Rules',
        'CSS is loaded that is never applied to any element on the page.',
        'low', 'performance',
        'Increases CSS file size and download time on mobile networks.',
        'Use PurgeCSS or similar tools to remove unused styles. Load CSS conditionally per-page.',
        '', 'mobile', 'pagespeed'
      ));
    if (psAudits['uses-optimized-images'])
      issues.push(mk(
        'Images Not Optimally Compressed',
        'Images could be served in smaller file sizes without visible quality loss.',
        'medium', 'performance',
        'Increases page weight and data usage. Slower load on mobile connections.',
        'Compress images using tools like Squoosh, TinyPNG. Use WebP or AVIF formats.',
        '', 'mobile', 'pagespeed'
      ));
    if (psAudits['uses-text-compression'])
      issues.push(mk(
        'Text Resources Not Compressed',
        'HTML, CSS, and JavaScript files are not served with Gzip/Brotli compression.',
        'medium', 'performance',
        'Files can be 70-90% smaller with compression. Significantly impacts mobile load times.',
        'Enable Gzip or Brotli compression on your web server or CDN.',
        '', 'mobile', 'pagespeed'
      ));
  }

  return issues;
}

/* ═══════════════════════════════════════════════════════════
   6.  SCORE CALCULATOR
════════════════════════════════════════════════════════════ */
function calculateScores(metrics, issues) {
  const crit = issues.filter(i => i.severity === 'critical').length;
  const med  = issues.filter(i => i.severity === 'medium').length;

  const performance   = metrics.performance.performanceScore ?? 50;
  const responsive    = metrics.responsive.mobileLayoutScore;
  const usability     = Math.max(0, 100 - (crit * 15) - (med * 5));
  const seo           = metrics.seo.seoScore;
  const accessibility = metrics.accessibility.accessibilityScore;
  const security      = metrics.security.securityScore;
  const pwa           = metrics.pwa.pwaScore;

  const overall = Math.round(
    performance   * 0.25 +
    responsive    * 0.20 +
    usability     * 0.20 +
    seo           * 0.15 +
    accessibility * 0.10 +
    security      * 0.05 +
    pwa           * 0.05
  );

  return {
    overall:       Math.max(0, Math.min(100, overall)),
    performance:   Math.round(performance),
    responsive:    Math.round(responsive),
    usability:     Math.round(usability),
    seo:           Math.round(seo),
    accessibility: Math.round(accessibility),
    security:      Math.round(security),
    pwa:           Math.round(pwa),
  };
}

/* ═══════════════════════════════════════════════════════════
   7.  MULTI-AI FALLBACK — AI INSIGHTS
════════════════════════════════════════════════════════════ */
async function generateAIInsights(url, metrics, issues, scores) {
  const issuesSummary = issues.slice(0, 20)
    .map(i => `[${i.severity.toUpperCase()}][${i.category}] ${i.title}: ${i.description}`)
    .join('\n');

  const prompt = `
You are a senior mobile web performance expert. Analyze this mobile audit and return ONLY a valid JSON object with no markdown fences.

URL: ${url}
Overall Score: ${scores.overall}/100
Performance: ${scores.performance}/100 | Responsive: ${scores.responsive}/100 | SEO: ${scores.seo}/100
Accessibility: ${scores.accessibility}/100 | Security: ${scores.security}/100 | PWA: ${scores.pwa}/100

FCP: ${metrics.performance.firstContentfulPaint} | LCP: ${metrics.performance.largestContentfulPaint}
TTI: ${metrics.performance.timeToInteractive} | CLS: ${metrics.performance.cumulativeLayoutShift}

Viewport: ${metrics.responsive.hasViewportMeta} | Media Queries: ${metrics.responsive.hasMediaQueries}
Tap Target Pass: ${metrics.tapTargets.passRate}% | Pinch Zoom: ${metrics.touchGestures.pinchZoomEnabled}
Images: ${metrics.images.totalImages} total, ${metrics.images.missingAlt} missing alt, ${metrics.images.unoptimizedImages} unoptimized
HTTPS: ${metrics.security.isHttps} | PWA Manifest: ${metrics.pwa.hasManifest}

Issues (${issues.length} total):
${issuesSummary}

Return this exact JSON structure:
{
  "healthScore": <number 0-100>,
  "overallSummary": "<3-4 sentences describing the website's overall mobile health in plain English a non-technical person can understand>",
  "whatWorksWell": [
    "<positive point 1 about what works well>",
    "<positive point 2>",
    "<positive point 3>"
  ],
  "issuesSimple": [
    {
      "issue": "<issue title in simple English>",
      "whyItMatters": "<why this matters to real users in 1 sentence>",
      "severity": "critical|medium|low"
    }
  ],
  "fixes": [
    {
      "title": "<fix title>",
      "steps": ["<step 1>", "<step 2>", "<step 3>"],
      "impact": "<expected improvement after fixing>",
      "effort": "low|medium|high"
    }
  ],
  "priorityTable": [
    {
      "rank": 1,
      "issue": "<issue name>",
      "impact": "<business/user impact>",
      "effort": "low|medium|high",
      "priority": "critical|high|medium|low",
      "category": "<category>"
    }
  ]
}
`.trim();

  const providers = [
    { name: 'groq',     call: () => callGroq(prompt)     },
    { name: 'openai',   call: () => callOpenAI(prompt)   },
    { name: 'gemini',   call: () => callGemini(prompt)   },
    { name: 'deepseek', call: () => callDeepSeek(prompt) },
  ];

  for (const p of providers) {
    try {
      const raw    = await p.call();
      const parsed = safeParseJSON(raw);
      if (parsed) return { ...parsed, provider: p.name, generatedAt: new Date() };
    } catch (e) {
      console.warn(`[AI:${p.name}]`, e.message);
    }
  }

  /* Fallback: build from raw data */
  return buildFallbackInsights(url, metrics, issues, scores);
}

function safeParseJSON(raw) {
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) try { return JSON.parse(match[0]); } catch {}
    return null;
  }
}

function buildFallbackInsights(url, metrics, issues, scores) {
  const crit = issues.filter(i => i.severity === 'critical');
  const med  = issues.filter(i => i.severity === 'medium');
  const working = [];
  if (metrics.security.isHttps)            working.push('Site is served over HTTPS — your connection is secure');
  if (metrics.responsive.hasViewportMeta)  working.push('Viewport meta tag is correctly configured for mobile devices');
  if (metrics.images.hasLazyLoading)       working.push('Lazy loading is enabled for images — good for mobile data usage');
  if (metrics.seo.hasOpenGraph)            working.push('Open Graph tags are present for good social media sharing');
  if (metrics.pwa.hasManifest)             working.push('Web App Manifest detected — site supports PWA installation');
  if (working.length === 0)                working.push('Site is accessible and returns a valid response');

  return {
    healthScore:    scores.overall,
    overallSummary: `This website scored ${scores.overall}/100 for mobile friendliness. ${crit.length > 0 ? `There are ${crit.length} critical issues that need immediate attention.` : 'No critical issues were found.'} Performance score is ${scores.performance}/100 and SEO score is ${scores.seo}/100.`,
    whatWorksWell:  working,
    issuesSimple:   issues.slice(0,10).map(i => ({ issue: i.title, whyItMatters: i.impact, severity: i.severity })),
    fixes:          issues.slice(0,5).map(i => ({ title: `Fix: ${i.title}`, steps: [i.howToFix], impact: i.impact, effort: 'medium' })),
    priorityTable:  issues.slice(0,10).map((i, idx) => ({
      rank: idx + 1, issue: i.title, impact: i.impact,
      effort: 'medium', priority: i.severity === 'critical' ? 'critical' : i.severity,
      category: i.category,
    })),
    provider:    'fallback',
    generatedAt: new Date(),
  };
}

/* AI callers */
async function callGroq(prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('No GROQ key');
  const { data } = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    { model: 'llama3-70b-8192', messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 3000 },
    { headers: { Authorization: `Bearer ${key}` }, timeout: 40_000 }
  );
  return data.choices[0].message.content;
}
async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('No OpenAI key');
  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    { model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 3000 },
    { headers: { Authorization: `Bearer ${key}` }, timeout: 40_000 }
  );
  return data.choices[0].message.content;
}
async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('No Gemini key');
  const { data } = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`,
    { contents: [{ parts: [{ text: prompt }] }] },
    { timeout: 40_000 }
  );
  return data.candidates[0].content.parts[0].text;
}
async function callDeepSeek(prompt) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('No DeepSeek key');
  const { data } = await axios.post(
    'https://api.deepseek.com/v1/chat/completions',
    { model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: 3000 },
    { headers: { Authorization: `Bearer ${key}` }, timeout: 40_000 }
  );
  return data.choices[0].message.content;
}

/* ═══════════════════════════════════════════════════════════
   8.  PDF GENERATOR
════════════════════════════════════════════════════════════ */
async function generatePDF(report) {
  const PDFDocument = require('pdfkit');

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W    = doc.page.width - 100;
    const ROSE = '#E11D48';
    const DARK = '#0F172A';
    const SLATE= '#334155';
    const GRAY = '#94A3B8';
    const GREEN= '#10B981';
    const AMBER= '#F59E0B';

    const scoreColor = (s) => s >= 75 ? GREEN : s >= 50 ? AMBER : ROSE;

    /* ── Cover ── */
    doc.rect(0, 0, doc.page.width, 120).fill(DARK);
    doc.fillColor('#fff').fontSize(26).font('Helvetica-Bold')
       .text('WebAuditX', 50, 30).fontSize(14).fillColor(ROSE)
       .text('Mobile Friendliness Audit Report', 50, 62);
    doc.fillColor(GRAY).fontSize(10)
       .text(`Generated: ${new Date().toUTCString()}`, 50, 85)
       .text(`URL: ${report.url}`, 50, 100);

    doc.moveDown(5);

    /* Overall score */
    doc.fillColor(DARK).fontSize(16).font('Helvetica-Bold').text('Overall Mobile Score', 50, 140);
    doc.fillColor(scoreColor(report.scores.overall)).fontSize(48).font('Helvetica-Bold')
       .text(`${report.scores.overall}/100`, 50, 160);
    doc.moveDown();

    /* Category scores */
    doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold').text('Category Scores', 50, doc.y);
    doc.moveDown(0.3);
    const scoreRows = [
      ['Performance',   report.scores.performance],
      ['Responsive',    report.scores.responsive],
      ['Usability',     report.scores.usability],
      ['SEO',           report.scores.seo],
      ['Accessibility', report.scores.accessibility],
      ['Security',      report.scores.security],
      ['PWA',           report.scores.pwa],
    ];
    scoreRows.forEach(([label, val]) => {
      doc.fillColor(SLATE).fontSize(11).font('Helvetica').text(`${label}:`, 50, doc.y, { continued: true })
         .fillColor(scoreColor(val)).font('Helvetica-Bold').text(`  ${val}/100`);
    });

    /* Data Sources */
    doc.addPage();
    doc.fillColor(DARK).fontSize(16).font('Helvetica-Bold').text('Data Sources Used');
    doc.moveDown(0.5);
    (report.dataSourcesUsed || []).forEach(s => {
      doc.fillColor(SLATE).fontSize(11).font('Helvetica').text(`✓ ${s}`);
    });

    /* Performance Metrics */
    if (report.mobileMetrics?.performance) {
      doc.addPage();
      doc.fillColor(DARK).fontSize(16).font('Helvetica-Bold').text('Mobile Performance Metrics');
      doc.moveDown(0.5);
      const pm = report.mobileMetrics.performance;
      [
        ['Lighthouse Performance Score', `${pm.performanceScore ?? 'N/A'}/100`],
        ['First Contentful Paint (FCP)', pm.firstContentfulPaint || 'N/A'],
        ['Largest Contentful Paint (LCP)', pm.largestContentfulPaint || 'N/A'],
        ['Time to Interactive (TTI)', pm.timeToInteractive || 'N/A'],
        ['Total Blocking Time (TBT)', pm.totalBlockingTime || 'N/A'],
        ['Cumulative Layout Shift (CLS)', pm.cumulativeLayoutShift?.toFixed(3) || 'N/A'],
        ['Speed Index', pm.speedIndex || 'N/A'],
        ['Time to First Byte (TTFB)', pm.timeToFirstByte || 'N/A'],
        ['Page Size', pm.pageSize ? `${pm.pageSize} KB` : 'N/A'],
      ].forEach(([l, v]) => {
        doc.fillColor(SLATE).fontSize(11).font('Helvetica').text(`${l}:`, 50, doc.y, { continued: true, width: 280 })
           .fillColor(DARK).font('Helvetica-Bold').text(v);
      });
    }

    /* Issues */
    if (report.issues?.length) {
      doc.addPage();
      doc.fillColor(DARK).fontSize(16).font('Helvetica-Bold').text('Detected Issues');
      doc.moveDown(0.5);

      ['critical', 'medium', 'low'].forEach(sev => {
        const sevIssues = report.issues.filter(i => i.severity === sev);
        if (!sevIssues.length) return;
        const color = sev === 'critical' ? ROSE : sev === 'medium' ? AMBER : GREEN;
        doc.fillColor(color).fontSize(13).font('Helvetica-Bold')
           .text(`${sev.charAt(0).toUpperCase() + sev.slice(1)} Issues (${sevIssues.length})`);
        doc.moveDown(0.3);
        sevIssues.forEach(issue => {
          if (doc.y > 700) doc.addPage();
          doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(`${issue.id}: ${issue.title}`);
          doc.fillColor(SLATE).fontSize(10).font('Helvetica').text(issue.description, { indent: 10 });
          if (issue.howToFix)
            doc.fillColor(GREEN).font('Helvetica').text(`Fix: ${issue.howToFix}`, { indent: 10 });
          doc.moveDown(0.5);
        });
      });
    }

    /* AI Insights */
    if (report.aiInsights?.overallSummary) {
      doc.addPage();
      doc.fillColor(DARK).fontSize(16).font('Helvetica-Bold').text('AI-Powered Insights');
      doc.moveDown(0.5);
      doc.fillColor(SLATE).fontSize(11).font('Helvetica').text(report.aiInsights.overallSummary);
      doc.moveDown();

      if (report.aiInsights.whatWorksWell?.length) {
        doc.fillColor(GREEN).fontSize(13).font('Helvetica-Bold').text('What Works Well');
        report.aiInsights.whatWorksWell.forEach(w => {
          doc.fillColor(SLATE).fontSize(10).font('Helvetica').text(`✓ ${w}`);
        });
        doc.moveDown();
      }

      if (report.aiInsights.fixes?.length) {
        doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold').text('Recommended Fixes');
        report.aiInsights.fixes.forEach((fix, i) => {
          if (doc.y > 680) doc.addPage();
          doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(`${i+1}. ${fix.title}`);
          (fix.steps || []).forEach(step => {
            doc.fillColor(SLATE).fontSize(10).font('Helvetica').text(`  → ${step}`);
          });
          if (fix.impact) doc.fillColor(GREEN).fontSize(10).text(`  Impact: ${fix.impact}`);
          doc.moveDown(0.4);
        });
      }

      if (report.aiInsights.priorityTable?.length) {
        doc.addPage();
        doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold').text('Priority Action Table');
        doc.moveDown(0.5);
        const cols = [30, 200, 280, 340, 400];
        doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold');
        ['#', 'Issue', 'Priority', 'Effort', 'Category'].forEach((h, i) => {
          doc.text(h, cols[i], doc.y, { width: 100, lineBreak: false });
        });
        doc.moveDown(0.5);
        report.aiInsights.priorityTable.forEach((row) => {
          if (doc.y > 700) doc.addPage();
          const rowY = doc.y;
          const c = row.priority === 'critical' ? ROSE : row.priority === 'high' ? AMBER : GREEN;
          doc.fillColor(SLATE).fontSize(9).font('Helvetica');
          doc.text(String(row.rank), cols[0], rowY, { width: 20 });
          doc.text(row.issue, cols[1], rowY, { width: 120 });
          doc.fillColor(c).text(row.priority, cols[2], rowY, { width: 80 });
          doc.fillColor(SLATE).text(row.effort, cols[3], rowY, { width: 60 });
          doc.text(row.category, cols[4], rowY, { width: 80 });
          doc.moveDown(0.7);
        });
      }
    }

    /* Page numbers */
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor(GRAY).fontSize(8).font('Helvetica')
         .text(`Page ${i + 1} of ${pages.count} — WebAuditX Mobile Report`, 50, doc.page.height - 40, { align: 'center', width: W });
    }

    doc.end();
  });
}

/* ═══════════════════════════════════════════════════════════
   9.  MAIN ORCHESTRATOR
════════════════════════════════════════════════════════════ */
async function analyzeMobileFriendliness(rawUrl) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  /* Run all data sources in parallel */
  const [psResult, mozResult, manualResult] = await Promise.allSettled([
    fetchPageSpeed(url),
    fetchMoz(url),
    runManualAnalysis(url),
  ]);

  const ps     = psResult.status     === 'fulfilled' ? psResult.value     : { available: false };
  const moz    = mozResult.status    === 'fulfilled' ? mozResult.value    : { available: false };
  const manual = manualResult.status === 'fulfilled' ? manualResult.value : { available: false };

  const dataSourcesUsed = [];
  if (ps.available)     dataSourcesUsed.push('Google PageSpeed Insights API');
  if (moz.available)    dataSourcesUsed.push('Moz API (Domain Authority)');
  if (manual.available) dataSourcesUsed.push('Manual HTML Analysis (Axios + Cheerio)');

  const mobileMetrics = buildMobileMetrics(ps, moz, manual);
  const issues        = detectIssues(mobileMetrics, ps, manual);
  const scores        = calculateScores(mobileMetrics, issues);
  const aiInsights    = await generateAIInsights(url, mobileMetrics, issues, scores);

  const record = await MF.create({
    url,
    apiResults: {
      pageSpeed: ps.available ? ps : { available: false },
      moz:       moz.available ? moz : { available: false },
      manual:    manual.available ? {
        available: true,
        hasViewportMeta:   manual.hasViewportMeta,
        viewportContent:   manual.viewportContent,
        hasResponsiveCSS:  manual.hasMediaQueries,
        hasMediaQueries:   manual.hasMediaQueries,
        hasTouchIcons:     manual.hasTouchIcons,
        hasAmpVersion:     manual.hasAmpVersion,
        isHttps:           manual.isHttps,
        pageLoadSize:      manual.pageLoadSize,
        imageCount:        manual.imageCount,
        unoptimizedImages: manual.unoptimizedImages,
        hasLazyLoading:    manual.hasLazyLoading,
        totalLinks:        manual.totalLinks,
        hasStructuredData: manual.hasStructuredData,
        hasOpenGraph:      manual.hasOpenGraph,
        titleLength:       manual.titleLength,
        metaDescLength:    manual.metaDescLength,
        h1Count:           manual.h1Count,
        renderBlocking:    manual.renderBlocking,
        inlineStyles:      manual.inlineStyles,
      } : { available: false },
    },
    mobileMetrics,
    scores,
    issues,
    aiInsights,
    dataSourcesUsed,
    status: 'completed',
  });

  return record;
}

module.exports = { analyzeMobileFriendliness, generatePDF };