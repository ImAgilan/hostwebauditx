'use strict';
/**
 * Advanced UI/UX Analysis Service
 * 30+ analysis categories covering:
 *   Logo · Typography · Heading ratios · Color system · Image placement
 *   Layout · Navigation · CTAs · Header/Footer · Content structure
 *   Social proof · Trust signals · Technical HTML · Responsiveness
 *   Design consistency · Accessibility · Multi-AI fallback insights
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const { generateAIResponse, safeParseJSON } = require('../../../shared/services/ai.service');
const UIAnalysis = require('../model/uiAnalysis.model');

/* ══════════════════════════════════════════════════════════════
   SECTION 1 — CRAWLER
══════════════════════════════════════════════════════════════ */
async function crawlWebsite(url) {
  const { data: html, headers } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 25_000,
    maxRedirects: 5,
    maxContentLength: 15 * 1024 * 1024,
  });
  return { html, headers };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 2 — RAW EXTRACTION
══════════════════════════════════════════════════════════════ */
function extractRaw(html) {
  const $ = cheerio.load(html);

  /* All CSS concatenated */
  const styleTags = [];
  $('style').each((_, el) => styleTags.push($(el).html() || ''));
  const inlineStyles = [];
  $('[style]').each((_, el) => inlineStyles.push($(el).attr('style') || ''));
  const allCSS = styleTags.join('\n') + '\n' + inlineStyles.join('\n');

  /* All script tags concatenated (for framework detection) */
  const allScripts = [];
  $('script').each((_, el) => allScripts.push($(el).html() || $(el).attr('src') || ''));
  const scriptBlock = allScripts.join('\n');

  /* Raw text */
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  return { $, allCSS, inlineStyles, scriptBlock, bodyText };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 3 — LOGO ANALYSIS
══════════════════════════════════════════════════════════════ */
function analyzeLogo($, allCSS) {
  /* Detection strategies: class/id keywords, header img, SVG with brand names */
  const LOGO_SELECTORS = [
    '[class*="logo"]', '[id*="logo"]', '[class*="brand"]', '[id*="brand"]',
    'header img', 'nav img', '.navbar img', '.header img',
    'a[href="/"] img', 'a[href="#"] img',
    'header svg', 'nav svg', '.logo svg',
  ];

  let logoEl = null;
  let logoTag = null;
  let logoSrc = '';
  let logoAlt = '';
  let isInHeader = false;
  let isInFooter = false;

  for (const sel of LOGO_SELECTORS) {
    const found = $(sel).first();
    if (found.length) {
    logoEl = found;
  logoTag = (found.prop('tagName') || '').toLowerCase();
  logoSrc = found.attr('src') || found.attr('href') || '';
  logoAlt = found.attr('alt') || '';
  break;
    }
  }

  /* Position detection */
  if (logoEl) {
    isInHeader = logoEl.parents('header, [class*="header"], nav, [class*="navbar"], [class*="nav-"]').length > 0;
    isInFooter = logoEl.parents('footer, [class*="footer"]').length > 0;
  }

  /* Check if logo also in footer */
  const footerLogo = $('footer [class*="logo"], footer img, [class*="footer"] [class*="logo"]').first();
  if (footerLogo.length && !isInFooter) isInFooter = true;

  const isLinkedToHome = logoEl
    ? (logoEl.closest('a').attr('href') === '/' || logoEl.closest('a').attr('href') === '#' || logoEl.attr('href') === '/')
    : false;

  const isSVG = !!(logoTag === 'svg' || (logoSrc && logoSrc.endsWith('.svg')));
  const isImage = !!(logoTag && ['img', 'picture'].includes(logoTag));

  /* Scoring */
  let score = 0;
  if (logoEl) score += 40;
  if (isInHeader) score += 25;
  if (isLinkedToHome) score += 20;
  if (logoAlt || isSVG) score += 10;
  if (isInFooter) score += 5;
  score = Math.min(100, score);

  const placement =
    isInHeader && isInFooter ? 'both' :
    isInHeader ? 'header' :
    isInFooter ? 'footer' : logoEl ? 'unknown' : 'none';

  return {
    detected: !!logoEl,
    placement,
    position: isInHeader ? 'top-left (estimated)' : isInFooter ? 'footer' : 'unknown',
    isLinkedToHome,
    hasAltText: !!logoAlt,
    altText: logoAlt.slice(0, 80),
    isSVG,
    isImage,
    srcValue: logoSrc.slice(0, 200),
    appearsInHeader: isInHeader,
    appearsInFooter: isInFooter,
    score,
  };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 4 — TYPOGRAPHY & HEADING ANALYSIS
══════════════════════════════════════════════════════════════ */
function analyzeTypography($, allCSS) {
  /* Extract fonts */
  const fontFamilyRx = /font-family\s*:\s*([^;}"'\n]+)/gi;
  const fontMatches  = [...allCSS.matchAll(fontFamilyRx)];
  const fontFamilies = [
    ...new Set(
      fontMatches
        .map(m => m[1].trim().split(',')[0].replace(/['"]/g, '').trim())
        .filter(Boolean)
    ),
  ].slice(0, 12);

  const googleFontsDetected = allCSS.includes('fonts.googleapis') || allCSS.includes('fonts.gstatic');
  const systemFontsOnly = fontFamilies.every(f =>
    ['system-ui','sans-serif','serif','monospace','-apple-system','BlinkMacSystemFont'].some(sf => f.toLowerCase().includes(sf))
  );

  /* Font weights */
  const weightRx   = /font-weight\s*:\s*([^;}\n]+)/gi;
  const fontWeights = [...new Set([...allCSS.matchAll(weightRx)].map(m => m[1].trim()))].slice(0, 10);

  /* Font sizes */
  const sizeRx   = /font-size\s*:\s*([^;}\n]+)/gi;
  const fontSizes = [...new Set([...allCSS.matchAll(sizeRx)].map(m => m[1].trim()))].slice(0, 20);

  /* Line heights */
  const lhRx       = /line-height\s*:\s*([^;}\n]+)/gi;
  const lineHeights = [...new Set([...allCSS.matchAll(lhRx)].map(m => m[1].trim()))].slice(0, 10);

  /* Letter spacing */
  const letterSpacingUsed = /letter-spacing\s*:/.test(allCSS);
  const textTransformUsed = /text-transform\s*:/.test(allCSS);
  const fontSmoothing     = /font-smoothing|text-rendering/.test(allCSS);

  /* Headings */
  const headingData = {};
  ['h1','h2','h3','h4','h5','h6'].forEach(tag => {
    const items = [];
    $(tag).each((_, el) => {
      const text = $(el).text().trim();
      if (text) items.push(text.slice(0, 120));
    });
    headingData[tag] = {
      count: items.length,
      texts: items.slice(0, 5),
      avgLength: items.length ? Math.round(items.reduce((s, t) => s + t.length, 0) / items.length) : 0,
    };
  });

  /* Hierarchy validation */
  const skippedLevels = [];
  if (headingData.h1.count > 0 && headingData.h3.count > 0 && headingData.h2.count === 0)
    skippedLevels.push('H2 missing before H3');
  if (headingData.h2.count > 0 && headingData.h4.count > 0 && headingData.h3.count === 0)
    skippedLevels.push('H3 missing before H4');
  const hierarchyValid = skippedLevels.length === 0;

  /* Ratios */
  const h1n = headingData.h1.count;
  const h2n = headingData.h2.count;
  const h3n = headingData.h3.count;
  const h1ToH2Ratio = h2n > 0 ? `1:${Math.round(h2n / Math.max(h1n, 1))}` : h1n > 0 ? '1:0' : 'N/A';
  const h2ToH3Ratio = h3n > 0 ? `1:${Math.round(h3n / Math.max(h2n, 1))}` : h2n > 0 ? '1:0' : 'N/A';

  /* Body text */
  const paragraphs = [];
  $('p').each((_, el) => paragraphs.push($(el).text().trim()));
  const nonEmpty = paragraphs.filter(p => p.length > 10);
  const wordCount = nonEmpty.reduce((s, p) => s + p.split(/\s+/).length, 0);
  const avgWPP    = nonEmpty.length ? Math.round(wordCount / nonEmpty.length) : 0;
  const shortP    = nonEmpty.filter(p => p.split(/\s+/).length < 20).length;

  /* Score */
  let score = 40;
  if (fontFamilies.length >= 1 && fontFamilies.length <= 3) score += 20;
  if (fontWeights.length >= 2) score += 10;
  if (lineHeights.length >= 1) score += 10;
  if (letterSpacingUsed) score += 5;
  if (hierarchyValid && headingData.h1.count === 1) score += 10;
  if (googleFontsDetected || !systemFontsOnly) score += 5;
  score = Math.min(100, score);

  return {
    score, fontFamilies, fontFamilyCount: fontFamilies.length,
    googleFontsDetected, systemFontsOnly,
    fontWeightsUsed: fontWeights, fontSizesInCSS: fontSizes,
    lineHeightValues: lineHeights, letterSpacingUsed, textTransformUsed, fontSmoothing,
    headings: { ...headingData, totalCount: Object.values(headingData).reduce((s, h) => s + h.count, 0),
      hierarchyValid, skippedLevels, h1ToH2Ratio, h2ToH3Ratio,
      firstH1Text: headingData.h1.texts[0] || '',
    },
    bodyText: {
      wordCount, paragraphCount: nonEmpty.length,
      avgWordsPerParagraph: avgWPP, shortParagraphs: shortP,
    },
  };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 5 — COLOR SYSTEM
══════════════════════════════════════════════════════════════ */
function analyzeColors($, allCSS) {
  const colorRx  = /#([0-9A-Fa-f]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;
  const rawColors = [...new Set((allCSS).match(colorRx) || [])];

  /* Categorise by CSS property context */
  const bgRx   = /background(?:-color)?\s*:\s*([^;}\n]+)/gi;
  const txtRx  = /(?<!\w)color\s*:\s*([^;}\n]+)/gi;
  const borRx  = /border(?:-color)?\s*:\s*([^;}\n]+)/gi;

  const extractProp = (rx) =>
    [...new Set([...allCSS.matchAll(rx)].map(m => (m[1].match(colorRx) || [])[0]).filter(Boolean))].slice(0, 8);

  const backgroundColors = extractProp(bgRx);
  const textColors       = extractProp(txtRx);
  const borderColors     = extractProp(borRx);
  const gradientUsage    = /linear-gradient|radial-gradient|conic-gradient/i.test(allCSS);
  const cssVariablesUsed = /--[a-zA-Z]/.test(allCSS);
  const darkModeSupport  = /@media\s*\(prefers-color-scheme\s*:\s*dark\)/.test(allCSS);

  /* Rough contrast issues: look for white text on light backgrounds */
  const contrastIssues = [];
  if (textColors.some(c => /^#fff|^#ffffff|rgb\(255,\s*255,\s*255\)/i.test(c)) &&
      backgroundColors.some(c => /^#fff|^#ffffff|^#f[0-9a-f]/i.test(c))) {
    contrastIssues.push({ element: 'text on background', issue: 'Possible white-on-light contrast issue detected' });
  }

  /* Score */
  const n = rawColors.length;
  let score = n === 0 ? 50 : n <= 8 ? 100 : n <= 15 ? 80 : n <= 25 ? 55 : 30;
  if (cssVariablesUsed) score = Math.min(100, score + 10);
  if (darkModeSupport)  score = Math.min(100, score + 5);

  return {
    score, rawColors: rawColors.slice(0, 30), uniqueColorCount: rawColors.length,
    backgroundColors, textColors, borderColors, gradientUsage,
    cssVariablesUsed, darkModeSupport, contrastIssues,
  };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 6 — IMAGE ANALYSIS
══════════════════════════════════════════════════════════════ */
function analyzeImages($, allCSS) {
  const HERO_WORDS   = ['hero','banner','jumbotron','cover','splash','above-fold'];
  const CARD_WORDS   = ['card','tile','thumbnail','thumb','product','item'];
  const ICON_WORDS   = ['icon','ico','symbol','badge','flag'];
  const LOGO_WORDS   = ['logo','brand','mark','wordmark'];

  const items = [];
  $('img').each((_, el) => {
    const src       = $(el).attr('src') || '';
    const alt       = $(el).attr('alt') ?? null;
    const loading   = $(el).attr('loading');
    const srcset    = $(el).attr('srcset');
    const width     = $(el).attr('width') || '';
    const height    = $(el).attr('height') || '';
    const classList = ($(el).attr('class') || '').toLowerCase();
    const parents   = $(el).parents().map((_, p) => ($(p).attr('class') || '') + ($(p).attr('id') || '')).get().join(' ').toLowerCase();
    const context   = (classList + ' ' + parents).toLowerCase();

    const format =
      src.match(/\.(webp)/i) ? 'webp' :
      src.match(/\.(svg)/i)  ? 'svg'  :
      src.match(/\.(gif)/i)  ? 'gif'  :
      src.match(/\.(png)/i)  ? 'png'  :
      src.match(/\.(jpg|jpeg)/i) ? 'jpg' : 'unknown';

    const placement =
      HERO_WORDS.some(w => context.includes(w))  ? 'hero' :
      LOGO_WORDS.some(w => context.includes(w))  ? 'logo' :
      CARD_WORDS.some(w => context.includes(w))  ? 'card' :
      ICON_WORDS.some(w => context.includes(w))  ? 'icon' : 'inline';

    items.push({
      src: src.slice(0, 200),
      alt: alt !== null ? alt.slice(0, 120) : '',
      hasAlt: alt !== null && alt.trim().length > 0,
      isDecorative: alt === '',
      isLazy: loading === 'lazy',
      hasSrcset: !!srcset,
      format, placement, width, height,
    });
  });

  /* Background images from CSS */
  const bgImgRx   = /background(?:-image)?\s*:\s*url\([^)]+\)/gi;
  const bgImages  = (allCSS.match(bgImgRx) || []).length;

  const total     = items.length;
  const withAlt   = items.filter(i => i.hasAlt).length;
  const withoutAlt = items.filter(i => !i.hasAlt && !i.isDecorative).length;
  const lazy      = items.filter(i => i.isLazy).length;
  const srcset    = items.filter(i => i.hasSrcset).length;
  const svgCount  = items.filter(i => i.format === 'svg').length;
  const webpCount = items.filter(i => i.format === 'webp').length;
  const gifCount  = items.filter(i => i.format === 'gif').length;
  const broken    = items.filter(i => !i.src || i.src === '#').length;
  const hasPicture = $('picture').length > 0;
  const heroPresent = items.some(i => i.placement === 'hero');

  /* Placement breakdown */
  const placement = { hero: 0, card: 0, inline: 0, icon: 0, background: bgImages, unknown: 0 };
  items.forEach(i => {
    if (i.placement in placement) placement[i.placement]++;
    else placement.unknown++;
  });

  /* Score */
  let score = 40;
  if (total > 0) {
    score += Math.round((withAlt / total) * 30);
    score += Math.round((lazy   / total) * 15);
    score += Math.round((srcset / total) * 10);
    if (webpCount > 0) score += 5;
  } else { score = 75; }
  score = Math.min(100, score);

  return {
    score, totalImages: total, withAlt, withoutAlt,
    altTextRatioPct: total ? Math.round((withAlt / total) * 100) : 100,
    lazyLoadedCount: lazy,
    lazyLoadRatioPct: total ? Math.round((lazy / total) * 100) : 0,
    withSrcset: srcset, hasPictureTag: hasPicture,
    svgCount, webpCount, gifCount, backgroundImages: bgImages,
    heroImagePresent: heroPresent, decorativeImages: items.filter(i => i.isDecorative).length,
    brokenSrcCount: broken, items: items.slice(0, 60),
    placementBreakdown: placement,
  };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 7 — LAYOUT & SPACING
══════════════════════════════════════════════════════════════ */
function analyzeLayout($, allCSS) {
  const usesFlexbox  = /display\s*:\s*flex/i.test(allCSS);
  const usesCSSGrid  = /display\s*:\s*grid/i.test(allCSS);
  const usesFloat    = /float\s*:\s*(left|right)/i.test(allCSS);
  const usesTable    = $('table').length > 0 || /display\s*:\s*table/i.test(allCSS);
  const hasMaxWidth  = /max-width\s*:/.test(allCSS);
  const hasContainer = $('[class*="container"],[class*="wrapper"],[class*="layout"]').length > 0;

  /* Sticky / fixed */
  const hasStickyElement = /position\s*:\s*sticky/i.test(allCSS);
  const hasFixedElement  = /position\s*:\s*fixed/i.test(allCSS);

  /* Sections */
  const sectionCount = $('section, article, [class*="section"]').length;

  /* Grid columns pattern detection */
  const gridColRx   = /grid-template-columns\s*:\s*([^;}\n]+)/gi;
  const columnPatterns = [...new Set([...allCSS.matchAll(gridColRx)].map(m => m[1].trim()))].slice(0, 6);

  /* Spacing units */
  const usesRemUnits = /[\s:]\d*\.?\d+rem/.test(allCSS);
  const usesEmUnits  = /[\s:]\d*\.?\d+em(?!a)/.test(allCSS);
  const usesPxUnits  = /[\s:]\d+px/.test(allCSS);
  const mixedUnits   = [usesRemUnits, usesEmUnits, usesPxUnits].filter(Boolean).length >= 2;

  /* Border radius */
  const brRx      = /border-radius\s*:\s*([^;}\n]+)/gi;
  const brValues  = [...new Set([...allCSS.matchAll(brRx)].map(m => m[1].trim()))].slice(0, 8);
  const isConsistent = brValues.length <= 4;

  /* Shadow */
  const shadowRx  = /box-shadow\s*:\s*([^;}\n]+)/gi;
  const shadows   = [...new Set([...allCSS.matchAll(shadowRx)].map(m => m[1].trim()))].slice(0, 8);

  /* Z-index */
  const zRx    = /z-index\s*:\s*(\d+)/gi;
  const zVals  = [...new Set([...allCSS.matchAll(zRx)].map(m => m[1]))].slice(0, 10);

  const overflowHiddenCount = (allCSS.match(/overflow\s*:\s*hidden/gi) || []).length;

  const hasHeroSection = $('[class*="hero"],[class*="banner"],[class*="jumbotron"]').length > 0;

  /* Score */
  let score = 30;
  if (usesFlexbox || usesCSSGrid) score += 30;
  if (hasMaxWidth && hasContainer)  score += 20;
  if (usesRemUnits && !usesPxUnits) score += 10;
  else if (usesRemUnits)            score += 5;
  if (!usesFloat)                   score += 5;
  if (isConsistent)                 score += 5;
  score = Math.min(100, score);

  return {
    score, usesFlexbox, usesCSSGrid, usesFloat, usesTable,
    hasMaxWidth, hasContainer, hasHeroSection,
    hasStickyElement, hasFixedElement, sectionCount, columnPatterns,
    spacingSystem: { usesRemUnits, usesEmUnits, usesPxUnits, mixedUnits },
    borderRadius: { values: brValues, isConsistent },
    shadowUsage: { detected: shadows.length > 0, values: shadows },
    zIndexValues: zVals, overflowHiddenCount,
  };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 8 — NAVIGATION
══════════════════════════════════════════════════════════════ */
function analyzeNavigation($, allCSS) {
  const nav = $('nav, [role="navigation"]');
  const primaryNav = nav.first();

  const primaryNavItems = primaryNav.find('a, button').length;
  const primaryNavLinks = [];
  primaryNav.find('a').each((_, el) => {
    const t = $(el).text().trim();
    if (t) primaryNavLinks.push(t.slice(0, 50));
  });

  const hasDropdown = $('[class*="dropdown"],[class*="submenu"],[class*="mega-menu"]').length > 0
    || primaryNav.find('ul ul').length > 0;

  const hasMobileMenu  = $('[class*="hamburger"],[class*="mobile-menu"],[class*="nav-toggle"],[class*="menu-icon"],[class*="burger"]').length > 0
    || /\.hamburger|\.mobile-nav|\.nav-toggle|\.menu-toggle/i.test(allCSS);

  const hasBreadcrumb = $('[class*="breadcrumb"],[aria-label*="breadcrumb"]').length > 0;
  const hasSearch     = $('input[type="search"],[class*="search"]').length > 0;
  const hasStickyNav  = /position\s*:\s*sticky/i.test(allCSS) && nav.length > 0;

  const hasSkipLink = $('a[href="#main"],a[href="#content"],a[href="#skip-nav"],a[href="#skip"]').length > 0;

  /* Footer nav */
  const footerNav     = $('footer nav, footer [class*="nav"], footer ul, [class*="footer"] ul');
  const footerNavItems = footerNav.find('a').length;

  /* Social links */
  const socialPatterns = ['facebook','twitter','instagram','linkedin','youtube','tiktok','github','pinterest','x.com'];
  let socialLinks = 0;
  $('a').each((_, el) => {
    const href = ($(el).attr('href') || '').toLowerCase();
    if (socialPatterns.some(p => href.includes(p))) socialLinks++;
  });

  const isOverloaded = primaryNavItems > 8;
  const depth = hasDropdown ? 2 : 1;

  let score = 20;
  if (nav.length > 0)        score += 30;
  if (primaryNavItems >= 3 && primaryNavItems <= 8) score += 20;
  if (hasSkipLink)            score += 10;
  if (hasMobileMenu)          score += 10;
  if (hasBreadcrumb)          score += 5;
  if (hasSearch)              score += 5;
  score = Math.min(100, score);

  return {
    score, primaryNavPresent: nav.length > 0, primaryNavItems,
    hasDropdown, hasMobileMenu, hasBreadcrumb, hasSearch, hasStickyNav,
    hasSkipLink, footerNavPresent: footerNavItems > 0, footerNavItems,
    socialLinks, primaryNavLinks: primaryNavLinks.slice(0, 10),
    isOverloaded, depth,
  };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 9 — CTA ANALYSIS
══════════════════════════════════════════════════════════════ */
function analyzeCTA($, allCSS) {
  const WEAK_WORDS   = ['click here','here','submit','go','ok','yes','no','more'];
  const STRONG_WORDS = ['get started','sign up','buy now','contact us','learn more','try free','free trial',
    'start now','download','book now','order','subscribe','join','register','request'];

  const buttons = [];
  $('button, input[type="submit"], input[type="button"], a[class*="btn"], a[class*="button"], [class*="cta"]').each((_, el) => {
    const text = ($(el).text().trim() || $(el).attr('value') || $(el).attr('aria-label') || '').slice(0, 80);
    const tag  = $(el).prop('tagName')?.toLowerCase() || '';
    const type = $(el).attr('type') || '';
    buttons.push({ text, tag, type });
  });

  const ctaTexts    = [...new Set(buttons.map(b => b.text).filter(Boolean))].slice(0, 15);
  const weakCount   = ctaTexts.filter(t => WEAK_WORDS.some(w => t.toLowerCase().includes(w))).length;
  const strongCount = ctaTexts.filter(t => STRONG_WORDS.some(w => t.toLowerCase().includes(w))).length;

  /* Hero / above-fold CTA */
  const heroEl   = $('[class*="hero"],[class*="banner"],[class*="jumbotron"]').first();
  const ctaInHero = heroEl.length ? heroEl.find('button,a[class*="btn"],a[class*="button"]').length > 0 : false;

  /* Primary CTA */
  const primaryCTAEl   = $('button[class*="primary"], a[class*="primary"], [class*="btn-primary"], [class*="cta-primary"]').first();
  const primaryCTAText = primaryCTAEl.length
    ? (primaryCTAEl.text().trim() || primaryCTAEl.attr('value') || '').slice(0, 60)
    : ctaTexts[0] || '';

  /* Button type consistency */
  const btnClasses = [];
  $('button, a[class*="btn"]').each((_, el) => btnClasses.push($(el).attr('class') || ''));
  const buttonStyleConsistency = new Set(btnClasses.map(c => c.replace(/\s+/g, ' ').trim())).size <= btnClasses.length * 0.6;

  const hasFloatingCTA = /position\s*:\s*fixed[\s\S]*?(?:button|btn|cta)/i.test(allCSS) ||
    $('[class*="floating"],[class*="sticky-btn"],[class*="fixed-cta"]').length > 0;

  let score = 20;
  if (buttons.length >= 1)  score += 20;
  if (ctaInHero)            score += 20;
  if (strongCount > 0)      score += 20;
  if (buttons.length >= 3)  score += 10;
  if (primaryCTAText)       score += 10;
  score = Math.min(100, score);

  return {
    score, totalButtons: buttons.length, primaryCTAPresent: !!primaryCTAText,
    primaryCTAText, ctaInHero, ctaAboveFold: ctaInHero,
    ctaTexts, weakCTACount: weakCount, strongCTACount: strongCount,
    buttonStyleConsistency, buttonTypes: [...new Set(buttons.map(b => b.tag))],
    hasFloatingCTA,
  };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 10 — HEADER & FOOTER ANALYSIS
══════════════════════════════════════════════════════════════ */
function analyzeHeaderFooter($, allCSS) {
  /* Header */
  const header = $('header, [class*="site-header"], [class*="page-header"], [role="banner"]').first();
  const hPresent  = header.length > 0;
  const hHasLogo  = header.find('[class*="logo"],img,svg').length > 0;
  const hHasNav   = header.find('nav,ul,a').length > 0;
  const hHasCTA   = header.find('button,a[class*="btn"],a[class*="button"]').length > 0;
  const hHasPhone = /\+?[\d\s\-().]{7,}/g.test(header.text());
  const hHasSearch = header.find('input[type="search"],[class*="search"]').length > 0;
  const hIsSticky = /position\s*:\s*(sticky|fixed)/i.test(
    header.attr('style') || allCSS.match(/header[\s\S]*?{[\s\S]*?}/)?.[0] || ''
  );

  /* Footer */
  const footer   = $('footer, [class*="site-footer"], [class*="page-footer"]').first();
  const fPresent = footer.length > 0;
  const footerText = footer.text().toLowerCase();
  const footerLinks = footer.find('a');

  const fHasLogo     = footer.find('[class*="logo"],img,svg').length > 0;
  const fHasLinks    = footerLinks.length > 0;
  const fHasCopyright = /©|copyright|\(c\)|\d{4}/i.test(footerText);
  const fHasSocial   = ['facebook','twitter','instagram','linkedin','youtube'].some(p => footerText.includes(p));
  const fHasContact  = /\+?[\d\s\-().]{7,}|@[a-z]/.test(footerText);
  const fHasPrivacy  = footerLinks.filter((_, el) => /privacy/i.test($(el).text())).length > 0;
  const fHasTerms    = footerLinks.filter((_, el) => /terms|service|legal/i.test($(el).text())).length > 0;
  const fHasSitemap  = footerLinks.filter((_, el) => /sitemap/i.test($(el).text())).length > 0;
  const fHasNewsletter = footer.find('input[type="email"]').length > 0;

  /* Column count estimation */
  const fColCount = footer.find('[class*="col"],[class*="column"],[class*="grid"]').length || 1;

  let score = 20;
  if (hPresent)    score += 20;
  if (hHasLogo)    score += 10;
  if (hHasNav)     score += 10;
  if (fPresent)    score += 15;
  if (fHasCopyright) score += 5;
  if (fHasLinks)   score += 5;
  if (fHasPrivacy) score += 5;
  if (fHasSocial)  score += 5;
  if (fHasContact) score += 5;
  score = Math.min(100, score);

  return {
    score,
    header: { present: hPresent, hasLogo: hHasLogo, hasNav: hHasNav, hasCTA: hHasCTA,
      hasPhone: hHasPhone, hasSearch: hHasSearch, isSticky: hIsSticky },
    footer: { present: fPresent, hasLogo: fHasLogo, hasLinks: fHasLinks,
      hasCopyright: fHasCopyright, hasSocialLinks: fHasSocial, hasContactInfo: fHasContact,
      hasPrivacyLink: fHasPrivacy, hasTermsLink: fHasTerms, hasSitemapLink: fHasSitemap,
      hasNewsletter: fHasNewsletter, columnCount: fColCount, linkCount: footerLinks.length },
  };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 11 — CONTENT STRUCTURE
══════════════════════════════════════════════════════════════ */
function analyzeContent($) {
  const body    = $('body');
  const bodyTxt = body.text().toLowerCase();

  /* Section presence detection */
  const detect = (keywords) =>
    keywords.some(kw =>
      $(`[class*="${kw}"],[id*="${kw}"],section`).filter((_, el) =>
        ($(el).attr('class') || $(el).attr('id') || '').toLowerCase().includes(kw) ||
        $(el).find('h1,h2,h3').text().toLowerCase().includes(kw)
      ).length > 0
    );

  const hasHero     = $('[class*="hero"],[class*="banner"],[class*="jumbotron"],[class*="splash"]').length > 0;
  const heroEl      = $('[class*="hero"],[class*="banner"],[class*="jumbotron"]').first();
  const heroHasH    = heroEl.find('h1,h2,h3').length > 0;
  const heroHasCTA  = heroEl.find('button,a[class*="btn"],a[class*="button"]').length > 0;
  const heroHasImg  = heroEl.find('img,video,svg').length > 0;
  const heroHasSub  = heroEl.find('p, h2, h3, [class*="subtitle"],[class*="sub-title"],[class*="subheadline"]').length > 0;

  /* Testimonials */
  const testiEl   = $('[class*="testimonial"],[class*="review"],[class*="quote"]');
  const testiCount = testiEl.length;

  /* Social proof */
  const hasCases      = detect(['case-study','case_study','casestudy','success-story']);
  const hasClientLogo = $('[class*="client-logo"],[class*="partner-logo"],[class*="brand-logo"]').length > 0;
  const hasStats      = $('[class*="counter"],[class*="stat-"],[class*="number-"],[class*="stats"]').length > 0;
  const hasRatings    = bodyTxt.includes('★') || bodyTxt.includes('⭐') || $('[class*="rating"],[class*="star"]').length > 0;
  const hasReviews    = bodyTxt.includes('/5') || $('[class*="review"],[itemtype*="Review"]').length > 0;

  /* Trust signals */
  const hasTrustBadge = $('[class*="badge"],[class*="trust"],[class*="secure"],[class*="seal"]').length > 0;
  const hasCert       = bodyTxt.includes('certified') || bodyTxt.includes('iso') || bodyTxt.includes('award');
  const hasMedia      = bodyTxt.includes('as seen in') || bodyTxt.includes('featured in') || $('[class*="media"],[class*="press"]').length > 0;
  const hasGuarantee  = bodyTxt.includes('guarantee') || bodyTxt.includes('money back') || bodyTxt.includes('risk free');

  /* Contact */
  const phoneRx  = /\+?[\d\s\-().]{7,}/g;
  const emailRx  = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const bodyFull = $('body').text();
  const hasPhone  = phoneRx.test(bodyFull);
  const hasEmail  = emailRx.test(bodyFull);
  const hasAddr   = /\b\d{3,}\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)/i.test(bodyFull);
  const hasForm   = $('form').length > 0;
  const hasChat   = $('[class*="chat"],[class*="intercom"],[class*="tawk"],[id*="chat"]').length > 0 || bodyFull.includes('livechat');

  /* Paragraphs */
  const paragraphs = [];
  $('p').each((_, el) => paragraphs.push($(el).text().trim()));
  const nonEmpty = paragraphs.filter(p => p.length > 10);

  let score = 30;
  if (hasHero && heroHasH && heroHasCTA) score += 20;
  if (testiCount > 0) score += 10;
  if (hasTrustBadge || hasGuarantee || hasCert) score += 10;
  if (hasPhone || hasEmail || hasForm) score += 15;
  if (hasStats) score += 10;
  if (hasClientLogo) score += 5;
  score = Math.min(100, score);

  return {
    score, hasHeroSection: hasHero, heroHasHeading: heroHasH,
    heroHasCTA, heroHasImage: heroHasImg, heroHasSubheadline: heroHasSub,
    hasAboutSection:    detect(['about','team','story','who-we']),
    hasServicesSection: detect(['service','solution','what-we-do','offering']),
    hasPricingSection:  detect(['price','pricing','plan','tariff']),
    hasTestimonialsSection: testiCount > 0,
    hasContactSection:  detect(['contact','reach-us','get-in-touch']),
    hasFAQSection:      detect(['faq','frequently','question']),
    hasBlogSection:     detect(['blog','news','article','post']),
    hasTeamSection:     detect(['team','people','staff','member']),
    socialProof: {
      hasTestimonials: testiCount > 0, hasReviews, hasRatings,
      hasClientLogos: hasClientLogo, hasCounterStats: hasStats, testimonialCount: testiCount,
    },
    trustSignals: {
      hasGuaranteeBadge: hasGuarantee, hasCertifications: hasCert,
      hasAwards: bodyTxt.includes('award'), hasMediaMentions: hasMedia, hasTrustBadges: hasTrustBadge,
    },
    contactInfo: { hasPhone, hasEmail, hasAddress: hasAddr, hasContactForm: hasForm, hasLiveChat: hasChat },
    wordCount: nonEmpty.reduce((s, p) => s + p.split(/\s+/).length, 0),
    paragraphCount: nonEmpty.length,
  };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 12 — TECHNICAL SIGNALS
══════════════════════════════════════════════════════════════ */
function analyzeTechnical($, allCSS, scriptBlock) {
  /* Meta */
  const titleEl   = $('title');
  const titleText = titleEl.text().trim();
  const descEl    = $('meta[name="description"]');
  const descText  = descEl.attr('content') || '';

  /* OG */
  const og = (prop) => !!$(`meta[property="og:${prop}"]`).attr('content');
  const ogScore = ['title','description','image','url','type'].filter(og).length * 20;

  /* Twitter */
  const twCard = $('meta[name="twitter:card"]').attr('content') || '';

  /* JSON-LD */
  const jsonLdScripts = $('script[type="application/ld+json"]');
  const schemaTypes   = [];
  jsonLdScripts.each((_, el) => {
    try {
      const d = JSON.parse($(el).html() || '{}');
      if (d['@type']) schemaTypes.push(d['@type']);
    } catch {}
  });

  /* Scripts */
  const allScriptEls   = $('script');
  const inlineScripts  = allScriptEls.filter((_, el) => !$(el).attr('src')).length;
  const externalScripts = allScriptEls.filter((_, el) => !!$(el).attr('src')).length;
  const deferred       = allScriptEls.filter((_, el) => !!$(el).attr('defer')).length;
  const asyncSc        = allScriptEls.filter((_, el) => !!$(el).attr('async')).length;
  const preloadLinks   = $('link[rel="preload"]').length;

  /* Accessibility signals */
  const ariaLabels  = $('[aria-label]').length;
  const ariaRoles   = $('[role]').length;
  const tabIdx      = $('[tabindex]').length;
  const langAttr    = $('html').attr('lang') || '';
  const allInputs   = $('input:not([type="hidden"]), textarea, select');
  const formLabels  = $('label[for], input[aria-label], input[aria-labelledby], textarea[aria-label]').length;
  const noLabelInputs = allInputs.filter((_, el) => {
    const id = $(el).attr('id');
    return !(id && $(`label[for="${id}"]`).length) && !$(el).attr('aria-label') && !$(el).attr('aria-labelledby');
  }).length;
  const hasAriaLive   = $('[aria-live]').length > 0;
  const hasFocusStyles = /:focus/.test(allCSS);
  const hasSkipLink   = $('a[href="#main"],a[href="#content"],a[href="#skip"],a[href="#skip-nav"]').length > 0;

  let accessibilityScore = 0;
  if (langAttr)          accessibilityScore += 20;
  if (ariaLabels > 2)    accessibilityScore += 15;
  if (ariaRoles > 2)     accessibilityScore += 15;
  if (hasSkipLink)       accessibilityScore += 15;
  if (noLabelInputs === 0 && allInputs.length > 0) accessibilityScore += 20;
  else if (noLabelInputs > 0) accessibilityScore += 5;
  if (hasFocusStyles)    accessibilityScore += 10;
  if (hasAriaLive)       accessibilityScore += 5;
  accessibilityScore = Math.min(100, accessibilityScore);

  /* Technical score */
  let score = 20;
  if (titleText.length >= 30 && titleText.length <= 60) score += 15;
  else if (titleText) score += 8;
  if (descText.length >= 50 && descText.length <= 160) score += 15;
  else if (descText) score += 8;
  if (og('title') && og('image')) score += 15;
  if (schemaTypes.length > 0) score += 10;
  if (deferred + asyncSc > 0) score += 10;
  if ($('link[rel*="icon"]').length > 0) score += 5;
  if (preloadLinks > 0) score += 5;
  if ($('meta[name="viewport"]').length) score += 5;
  score = Math.min(100, score);

  return {
    score,
    meta: {
      hasTitle: !!titleText, titleLength: titleText.length, titleText: titleText.slice(0, 70),
      hasDescription: !!descText, descriptionLength: descText.length, descriptionText: descText.slice(0, 170),
      hasViewport: !!$('meta[name="viewport"]').attr('content'),
      hasCharset: !!$('meta[charset]').attr('charset'),
      hasCanonical: $('link[rel="canonical"]').length > 0,
      hasRobots: !!$('meta[name="robots"]').attr('content'),
      themeColor: $('meta[name="theme-color"]').attr('content') || '',
    },
    openGraph: {
      hasOgTitle: og('title'), hasOgDescription: og('description'), hasOgImage: og('image'),
      hasOgUrl: og('url'), hasOgType: og('type'), completenessScore: ogScore,
    },
    twitterCard: { hasTwitterCard: !!twCard, cardType: twCard },
    schema: { hasJsonLd: jsonLdScripts.length > 0, hasMicrodata: $('[itemtype]').length > 0, schemaTypes },
    performance: {
      inlineScriptCount: inlineScripts, externalScriptCount: externalScripts,
      deferredScripts: deferred, asyncScripts: asyncSc,
      inlineStyleCount: $('[style]').length, externalCSSCount: $('link[rel="stylesheet"]').length,
      preloadLinks, hasFavicon: $('link[rel*="icon"]').length > 0,
      hasAppleTouchIcon: $('link[rel="apple-touch-icon"]').length > 0,
      hasManifest: $('link[rel="manifest"]').length > 0,
    },
    accessibility: {
      score: accessibilityScore, hasSkipLink, hasLangAttribute: !!langAttr,
      langValue: langAttr, ariaLabels, ariaRoles, tabIndexUsage: tabIdx,
      formLabels, inputsWithoutLabel: noLabelInputs, hasAriaLive, hasFocusStyles,
    },
  };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 13 — RESPONSIVENESS
══════════════════════════════════════════════════════════════ */
function analyzeResponsiveness($, allCSS) {
  const viewportMeta    = $('meta[name="viewport"]').attr('content') || '';
  const hasViewportMeta = viewportMeta.includes('width=device-width');
  const hasMediaQueries = /@media/.test(allCSS);

  /* Count @media blocks */
  const mediaQueryCount = (allCSS.match(/@media/g) || []).length;

  /* Extract breakpoints */
  const bpRx        = /@media[^{]*\((?:max|min)-width\s*:\s*(\d+px)\)/gi;
  const breakpoints  = [...new Set([...allCSS.matchAll(bpRx)].map(m => m[1]))].sort();

  /* Fluid images */
  const hasFluidImages    = /max-width\s*:\s*100%/.test(allCSS) || /width\s*:\s*100%/.test(allCSS);
  const hasFluidTypography = /clamp\(|vw(?!,)|font-size[^;]*vw/.test(allCSS);

  /* Mobile nav */
  const hasMobileNavigation = $('[class*="mobile-nav"],[class*="mobile-menu"]').length > 0;
  const hasHamburgerMenu    = $('[class*="hamburger"],[class*="menu-icon"],[class*="nav-toggle"],[class*="burger"]').length > 0
    || /\.hamburger|hamburger/i.test(allCSS);

  /* Framework detection */
  let frameworkDetected = '';
  if (allCSS.includes('tailwind') || allCSS.includes('tw-')) frameworkDetected = 'Tailwind CSS';
  else if ($('[class*="container"]').attr('class')?.includes('col-') || allCSS.includes('.col-md')) frameworkDetected = 'Bootstrap';
  else if (allCSS.includes('bulma') || $('[class*="column is-"]').length) frameworkDetected = 'Bulma';
  else if ($('[class*="uk-"]').length) frameworkDetected = 'UIkit';

  let score = 20;
  if (hasViewportMeta)       score += 25;
  if (hasMediaQueries)       score += 20;
  if (mediaQueryCount >= 3)  score += 10;
  if (hasFluidImages)        score += 10;
  if (hasHamburgerMenu)      score += 10;
  if (hasFluidTypography)    score += 5;
  score = Math.min(100, score);

  return {
    score, hasViewportMeta, viewportContent: viewportMeta,
    hasMediaQueries, mediaQueryCount, breakpoints,
    hasFluidImages, hasFluidTypography, hasMobileNavigation,
    hasHamburgerMenu, frameworkDetected,
  };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 14 — DESIGN CONSISTENCY
══════════════════════════════════════════════════════════════ */
function analyzeConsistency($, allCSS, scriptBlock) {
  const animationsDetected  = /animation\s*:|@keyframes/.test(allCSS);
  const transitionsDetected = /transition\s*:/.test(allCSS);
  const hoverStatesDetected = /:hover/.test(allCSS);

  /* Icon library */
  let iconLibraryDetected = '';
  const classNames = [];
  $('[class]').each((_, el) => classNames.push($(el).attr('class') || ''));
  const classStr = classNames.join(' ').toLowerCase();
  if (classStr.includes('fa-') || classStr.includes('fas ') || classStr.includes('far ')) iconLibraryDetected = 'Font Awesome';
  else if (classStr.includes('material-icons') || classStr.includes('mi-')) iconLibraryDetected = 'Material Icons';
  else if (classStr.includes('bi-')) iconLibraryDetected = 'Bootstrap Icons';
  else if (classStr.includes('heroicon') || scriptBlock.includes('heroicons')) iconLibraryDetected = 'Heroicons';
  else if (classStr.includes('lucide')) iconLibraryDetected = 'Lucide';
  else if (classStr.includes('feather')) iconLibraryDetected = 'Feather Icons';
  else if ($('svg').length > 5) iconLibraryDetected = 'Inline SVG';

  /* CSS framework */
  let cssFrameworkDetected = '';
  if (allCSS.includes('@tailwind') || classStr.includes('flex-1') || classStr.includes('text-sm')) cssFrameworkDetected = 'Tailwind CSS';
  else if (classStr.match(/col-(xs|sm|md|lg|xl)-\d/) || classStr.includes('row g-')) cssFrameworkDetected = 'Bootstrap';
  else if (classStr.includes('columns is-') || classStr.includes('bulma')) cssFrameworkDetected = 'Bulma';

  /* Button consistency — look for multiple distinct bg-colors on .btn */
  const btnColors     = (allCSS.match(/\.btn[^{]*{[^}]*background(?:-color)?\s*:\s*([^;}\n]+)/gi) || []).length;
  const buttonStyleConsistency = btnColors <= 4;

  /* Font consistency */
  const fontFamilyCount = [...allCSS.matchAll(/font-family\s*:\s*([^;}\n]+)/gi)].length;
  const fontConsistency  = fontFamilyCount <= 10;

  /* Spacing consistency */
  const marginVals   = [...new Set([...allCSS.matchAll(/margin\s*:\s*([^;}\n]+)/gi)].map(m => m[1].trim()))];
  const paddingVals  = [...new Set([...allCSS.matchAll(/padding\s*:\s*([^;}\n]+)/gi)].map(m => m[1].trim()))];
  const spacingConsistency = (marginVals.length + paddingVals.length) < 40;

  /* Border radius consistency */
  const brValues = [...new Set([...allCSS.matchAll(/border-radius\s*:\s*([^;}\n]+)/gi)].map(m => m[1].trim()))];
  const borderRadiusConsistency = brValues.length <= 5;

  let score = 30;
  if (animationsDetected)        score += 10;
  if (transitionsDetected)       score += 10;
  if (hoverStatesDetected)       score += 10;
  if (iconLibraryDetected)       score += 10;
  if (cssFrameworkDetected)      score += 10;
  if (buttonStyleConsistency)    score += 10;
  if (borderRadiusConsistency)   score += 5;
  if (fontConsistency)           score += 5;
  score = Math.min(100, score);

  return {
    score, buttonStyleConsistency, colorUsageConsistency: true,
    fontConsistency, spacingConsistency, borderRadiusConsistency,
    iconLibraryDetected, cssFrameworkDetected,
    animationsDetected, transitionsDetected, hoverStatesDetected,
  };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 15 — ISSUE DETECTION (30+ checks)
══════════════════════════════════════════════════════════════ */
function detectAllIssues(data) {
  const issues = [];
  const add = (title, description, affectedElement, severity, category, recommendation, wcagReference = '') =>
    issues.push({ title, description, affectedElement, severity, category, recommendation, wcagReference });

  const { logo, typography, colors, images, layout, navigation,
          cta, headerFooter, content, technical, responsiveness, consistency } = data;

  /* ── LOGO ── */
  if (!logo.detected) {
    add('Logo Not Detected',
      'No logo element found on the page. A logo is essential for brand recognition and builds immediate trust with visitors.',
      'header / nav area', 'critical', 'logo',
      'Add a logo image or SVG in your <header>. Wrap it in an <a href="/"> link to make it clickable back to the homepage.');
  } else if (!logo.isLinkedToHome) {
    add('Logo Not Linked to Homepage',
      'Logo is present but does not link back to the homepage. Users expect clicking the logo to navigate home — this is a universal UX convention.',
      `<${logo.isSVG ? 'svg' : 'img'}> in header`, 'medium', 'logo',
      'Wrap your logo element in <a href="/">...</a>');
  }
  if (logo.detected && !logo.hasAltText && logo.isImage) {
    add('Logo Image Missing Alt Text',
      'The logo image has no alt attribute. Screen readers cannot describe the logo, failing WCAG 1.1.1.',
      '<img> logo element', 'medium', 'logo',
      'Add alt="[Company Name] logo" to your logo <img> tag.', 'WCAG 1.1.1');
  }
  if (!logo.appearsInHeader) {
    add('Logo Not in Header',
      'Logo is not detected in the header area. Placing the logo in the top-left corner of the header is the standard that users expect.',
      'Page header', 'medium', 'logo',
      'Move your logo to the <header> element, positioned top-left or top-center.');
  }

  /* ── TYPOGRAPHY ── */
  if (typography.headings.h1.count === 0) {
    add('Missing H1 Heading', 'Every page must have exactly one H1 — the primary title that tells users and search engines what the page is about.',
      '<h1> tag', 'critical', 'typography',
      'Add one descriptive H1 tag, ideally in your hero or first section. Keep it 20–70 characters.', 'WCAG 2.4.6');
  }
  if (typography.headings.h1.count > 1) {
    add(`Multiple H1 Tags (${typography.headings.h1.count})`,
      `Found ${typography.headings.h1.count} H1 tags. Pages should have exactly one H1 to define a single clear primary topic.`,
      '<h1> tags', 'medium', 'typography',
      'Keep one H1 per page. Convert remaining H1s to H2 or H3 as appropriate.');
  }
  if (!typography.headings.hierarchyValid) {
    add('Heading Hierarchy Skips Levels',
      `Heading levels are skipped: ${typography.headings.skippedLevels.join('; ')}. This confuses screen readers and disrupts visual scanning.`,
      'Heading structure', 'medium', 'typography',
      'Use headings in sequential order: H1 → H2 → H3. Never skip from H1 directly to H3.', 'WCAG 2.4.6');
  }
  if (typography.fontFamilyCount > 3) {
    add(`Too Many Font Families (${typography.fontFamilyCount})`,
      'More than 3 font families create visual noise, slow page load, and dilute brand identity. The ideal is 1–2 complementary fonts.',
      'CSS font-family declarations', 'medium', 'typography',
      'Choose one display font for headings and one body font. Remove or consolidate the remaining families.');
  }
  if (typography.fontFamilyCount === 0) {
    add('No Custom Fonts Detected',
      'Only system/fallback fonts are used. Custom typography strengthens brand identity and improves perceived quality.',
      'CSS font-family', 'low', 'typography',
      'Consider loading 1–2 Google Fonts that match your brand personality. Use font-display: swap for performance.');
  }
  if (typography.fontWeightsUsed.length < 2) {
    add('Limited Font Weight Variety',
      'Only one or no font weights detected. Using 2–3 weights (e.g. 400, 600, 700) creates visual hierarchy and improves readability.',
      'font-weight declarations', 'low', 'typography',
      'Add at least a regular (400) and bold (700) weight. Use a semibold (600) for subheadings.');
  }
  if (!typography.lineHeightValues.length) {
    add('No Line-Height Declarations',
      'Line-height is not set. Default browser line-height is often too tight, reducing readability especially on mobile.',
      'body / p / text elements', 'low', 'typography',
      'Set line-height: 1.5–1.7 for body text and 1.1–1.3 for headings in your CSS.');
  }
  if (typography.headings.h1.texts[0] && typography.headings.h1.texts[0].length > 80) {
    add('H1 Heading Too Long',
      `Your H1 is ${typography.headings.h1.texts[0].length} characters. H1 tags over 70 characters are harder to scan and may be truncated in search results.`,
      `H1: "${typography.headings.h1.texts[0].slice(0, 60)}…"`, 'low', 'typography',
      'Shorten the H1 to 20–70 characters. Move secondary information to the subtitle or body.');
  }

  /* ── COLORS ── */
  if (colors.uniqueColorCount > 20) {
    add(`Excessive Color Count (${colors.uniqueColorCount} unique colors)`,
      `${colors.uniqueColorCount} unique colors detected across stylesheets. A consistent brand palette uses 6–12 colors maximum.`,
      'CSS color properties', colors.uniqueColorCount > 30 ? 'critical' : 'medium', 'color',
      'Audit all colors and consolidate to a primary palette (1–2 brand colors), neutral shades, and 1 accent. Use CSS variables for consistency.');
  }
  if (!colors.cssVariablesUsed) {
    add('No CSS Variables (Custom Properties) Detected',
      'No CSS custom properties (--variable) found. CSS variables make it dramatically easier to maintain consistent colors, spacing, and typography across the codebase.',
      ':root CSS variables', 'low', 'color',
      'Define your color palette in :root { --primary: #...; --secondary: #...; } and use var(--primary) throughout.');
  }
  if (!colors.gradientUsage && colors.uniqueColorCount < 5) {
    add('Very Limited Color Palette',
      'Very few colors detected — the design may lack visual depth. Consider adding subtle gradients or a secondary accent color.',
      'Color system', 'low', 'color',
      'Add a complementary accent color and consider subtle gradient backgrounds in hero sections for visual interest.');
  }

  /* ── IMAGES ── */
  if (images.withoutAlt > 0) {
    add(`${images.withoutAlt} Images Missing Alt Text`,
      `${images.withoutAlt} of ${images.totalImages} images lack descriptive alt attributes. This fails WCAG 1.1.1 and hurts SEO image indexing.`,
      '<img> tags', images.withoutAlt > 5 ? 'critical' : 'medium', 'images',
      'Add alt="descriptive text" to every content image. Use alt="" (empty) only for purely decorative images.', 'WCAG 1.1.1');
  }
  if (images.lazyLoadRatioPct < 30 && images.totalImages > 3) {
    add('Images Not Lazy Loaded',
      `Only ${images.lazyLoadRatioPct}% of images use lazy loading. All below-the-fold images should load lazily to improve page speed and Core Web Vitals.`,
      '<img loading="..."> attributes', 'medium', 'images',
      'Add loading="lazy" to all <img> tags that are not in the above-the-fold hero area.');
  }
  if (images.withSrcset === 0 && images.totalImages > 2) {
    add('No Responsive Images (Missing srcset)',
      'None of your images use srcset or <picture> elements. This means mobile users download full desktop-sized images, slowing load times.',
      '<img srcset="..."> attributes', 'medium', 'images',
      'Use srcset to provide multiple image sizes: small (480w), medium (800w), large (1200w). Use <picture> for art direction.');
  }
  if (images.webpCount === 0 && images.totalImages > 2) {
    add('No WebP Images Detected',
      'No WebP format images found. WebP typically reduces image file size by 25–35% versus JPEG/PNG with equivalent visual quality.',
      'Image formats', 'medium', 'images',
      'Convert images to WebP. Use <picture> with a WebP source and JPEG/PNG fallback for maximum compatibility.');
  }
  if (!images.heroImagePresent && content.hasHeroSection) {
    add('Hero Section Missing Image',
      'The hero section was detected but contains no image or visual. Hero visuals significantly increase user engagement and time-on-page.',
      'Hero section content', 'low', 'images',
      'Add a high-quality hero image, illustration, or video background to your hero section. Ensure it has alt text.');
  }

  /* ── LAYOUT ── */
  if (!layout.usesFlexbox && !layout.usesCSSGrid) {
    add('No Modern CSS Layout (No Flexbox/Grid)',
      'Neither Flexbox nor CSS Grid detected. This suggests the layout uses older techniques (floats/tables) that are harder to maintain and make responsive design very difficult.',
      'Layout CSS', 'critical', 'layout',
      'Refactor layouts to use Flexbox for 1D alignment and CSS Grid for 2D page structure. Both are supported in all modern browsers.');
  }
  if (!layout.hasMaxWidth) {
    add('No Max-Width Container',
      'Content appears to stretch to full browser width with no max-width constraint. This causes very long line lengths on wide screens, severely hurting readability.',
      'Container/wrapper elements', 'medium', 'layout',
      'Add max-width: 1200px (or similar) and margin: 0 auto to your main content containers.');
  }
  if (layout.usesFloat && (layout.usesFlexbox || layout.usesCSSGrid)) {
    add('Legacy Float Layouts Still Present',
      'Float-based layout is detected alongside modern Flexbox/Grid. Old float code can cause layout conflicts and is unnecessary.',
      'float CSS property usage', 'low', 'layout',
      'Remove float-based layout patterns and replace with Flexbox or Grid equivalents.');
  }
  if (layout.spacingSystem.mixedUnits && !layout.spacingSystem.usesRemUnits) {
    add('Inconsistent Spacing Units',
      'Mixed pixel and em units found without a rem-based system. This makes spacing hard to scale and maintain, especially for font-size adjustments.',
      'margin/padding declarations', 'low', 'layout',
      'Standardise on rem units for spacing. Create a spacing scale (4px, 8px, 16px, 24px, 32px, 48px, 64px) and stick to it.');
  }
  if (layout.sectionCount < 3) {
    add('Low Section Count — Page May Lack Structure',
      `Only ${layout.sectionCount} <section> elements detected. Well-structured pages use semantic sections to organise content and improve accessibility.`,
      '<section> elements', 'low', 'layout',
      'Wrap distinct content areas in <section> elements with clear headings. Aim for 5–8 sections for a typical landing page.');
  }

  /* ── NAVIGATION ── */
  if (!navigation.primaryNavPresent) {
    add('No Navigation Element Found',
      'No <nav> or navigation landmark detected. This is a fundamental usability failure — users cannot easily move between pages.',
      '<nav> element', 'critical', 'navigation',
      'Add a <nav> element containing your main page links. Use <ul>/<li> structure for screen reader compatibility.', 'WCAG 2.4.1');
  }
  if (navigation.isOverloaded) {
    add(`Navigation Overloaded (${navigation.primaryNavItems} items)`,
      `${navigation.primaryNavItems} navigation items detected. More than 7–8 items overload users cognitively. Hick's Law: more choices = longer decisions.`,
      '<nav> links', 'medium', 'navigation',
      'Trim navigation to 5–7 core items. Use dropdown sub-menus for secondary pages or move less-important links to the footer.');
  }
  if (!navigation.hasMobileMenu) {
    add('No Mobile Navigation Detected',
      'No hamburger menu or mobile navigation component found. On small screens, a full navigation bar breaks layout and is unusable.',
      'Mobile navigation', 'critical', 'navigation',
      'Implement a hamburger menu that collapses navigation items on screens below 768px. Ensure it is keyboard accessible.');
  }
  if (!navigation.hasSkipLink) {
    add('Missing "Skip to Content" Link',
      'No skip navigation link found. Keyboard and screen reader users must tab through every navigation item on every page — this is exhausting and fails WCAG 2.4.1.',
      'Page top / <header>', 'medium', 'navigation',
      'Add <a href="#main-content" class="skip-link">Skip to main content</a> as the very first element inside <body>. Style it visually hidden but visible on :focus.', 'WCAG 2.4.1');
  }
  if (navigation.socialLinks === 0) {
    add('No Social Media Links in Navigation/Footer',
      'No social media profile links detected. Social links build trust, grow community, and provide additional user touchpoints.',
      'nav / footer links', 'low', 'navigation',
      'Add icons linking to your active social media profiles in the header or footer.');
  }

  /* ── CTA ── */
  if (cta.totalButtons === 0) {
    add('No Buttons or CTAs Found',
      'Zero call-to-action buttons detected. This is a conversion catastrophe — users have no clear next step to take.',
      'Page buttons / CTAs', 'critical', 'cta',
      'Add at least one prominent primary CTA button in the hero section. Use action-oriented language: "Get Started Free", "Book a Demo", etc.');
  } else if (!cta.ctaInHero) {
    add('No CTA in Hero Section',
      'The hero section has no call-to-action button. The hero is the highest-converting section on any page — a missing CTA here wastes prime real estate.',
      'Hero section', 'critical', 'cta',
      'Add a primary CTA button directly in the hero. Test phrases like "Get Started Free", "Try [Product] Today", or "Book a Free Demo".');
  }
  if (cta.weakCTACount > 0) {
    add(`${cta.weakCTACount} Weak CTA Label${cta.weakCTACount > 1 ? 's' : ''}`,
      `Buttons with weak labels like "Click Here", "Submit", or "Go" found. Weak CTAs reduce conversion rates by up to 40%.`,
      `Buttons: ${cta.ctaTexts.filter(t => ['click here','submit','go','ok','yes'].some(w => t.toLowerCase().includes(w))).slice(0,3).join(', ')}`,
      'medium', 'cta',
      'Replace generic button labels with specific value-driven text. "Submit" → "Send My Free Quote". "Click Here" → "See All Features".');
  }

  /* ── HEADER / FOOTER ── */
  if (!headerFooter.header.present) {
    add('No <header> Element Detected',
      'The page lacks a semantic <header> element. Headers provide structure for screen readers and define the top landmark region.',
      '<header> element', 'medium', 'header',
      'Wrap your top navigation/logo area in a <header> element.', 'WCAG 1.3.1');
  }
  if (!headerFooter.footer.present) {
    add('No <footer> Element Detected',
      'No semantic <footer> found. Footers are expected for copyright, legal links, and secondary navigation.',
      '<footer> element', 'medium', 'footer',
      'Add a <footer> element at the bottom of the page with copyright notice, privacy policy link, and contact details.', 'WCAG 1.3.1');
  }
  if (headerFooter.footer.present && !headerFooter.footer.hasCopyright) {
    add('Footer Missing Copyright Notice',
      'No copyright notice detected in the footer. This is both a legal protection mechanism and a trust signal for users.',
      'Footer content', 'low', 'footer',
      'Add © [Year] [Company Name]. All rights reserved. to your footer.');
  }
  if (headerFooter.footer.present && !headerFooter.footer.hasPrivacyLink) {
    add('Missing Privacy Policy Link',
      'No privacy policy link found in the footer. This is legally required in most jurisdictions (GDPR, CCPA) and builds user trust.',
      'Footer links', 'critical', 'footer',
      'Create a Privacy Policy page and link it from the footer. Required for GDPR compliance if you serve EU users.');
  }
  if (headerFooter.footer.present && !headerFooter.footer.hasSocialLinks) {
    add('Footer Missing Social Media Links',
      'Social media links are absent from the footer. The footer is the most common place users look for social profiles.',
      'Footer content', 'low', 'footer',
      'Add recognisable social media icons (LinkedIn, Twitter/X, Instagram, Facebook) with links to your profiles.');
  }

  /* ── CONTENT ── */
  if (!content.hasHeroSection) {
    add('No Hero Section Detected',
      'The page lacks a clearly defined hero section. The hero is the first impression — its absence makes the page purpose unclear in the critical first 3 seconds.',
      'Page top section', 'critical', 'content',
      'Create a hero section with: (1) a clear H1 headline, (2) a value proposition subtitle, (3) a primary CTA button, (4) a supporting visual.');
  }
  if (content.hasHeroSection && !content.heroHasCTA) {
    add('Hero Missing CTA',
      'Hero section detected but has no call-to-action button. Without a clear next step, users bounce.',
      'Hero section CTA', 'critical', 'content',
      'Add a high-contrast primary button inside the hero with a compelling action phrase.');
  }
  if (!content.socialProof.hasTestimonials && !content.socialProof.hasReviews) {
    add('No Social Proof Detected',
      'No testimonials, reviews, or ratings found. Social proof is one of the highest-impact conversion elements — its absence significantly hurts trust.',
      'Testimonials / Reviews section', 'high' in {} ? 'high' : 'medium', 'content',
      'Add 3–5 genuine customer testimonials with name, photo, and company. Star ratings and case studies are even more powerful.');
  }
  if (!content.trustSignals.hasGuaranteeBadge && !content.trustSignals.hasTrustBadges && !content.trustSignals.hasCertifications) {
    add('No Trust Signals Found',
      'No guarantee badges, security seals, or certifications detected. Trust signals reduce purchase anxiety and are especially important for B2B and e-commerce sites.',
      'Trust badge / security section', 'medium', 'content',
      'Add relevant trust badges: SSL secure badge, money-back guarantee, industry certifications, or "As featured in" media logos.');
  }
  if (!content.contactInfo.hasPhone && !content.contactInfo.hasEmail && !content.contactInfo.hasContactForm) {
    add('No Contact Information Found',
      'No phone number, email address, or contact form detected. Users who cannot easily contact you will leave — this also hurts search rankings.',
      'Contact section / footer', 'critical', 'content',
      'Add at minimum: an email address and a contact form. A phone number significantly boosts trust for B2B and service businesses.');
  }
  if (!content.hasFAQSection && content.hasServicesSection) {
    add('Missing FAQ Section',
      'For a services/product page, an FAQ section typically reduces support inquiries by 20–40% and improves SEO with long-tail question keywords.',
      'FAQ / Q&A section', 'low', 'content',
      'Add a collapsible FAQ section answering the top 5–8 questions your customers ask before buying. Mark up with FAQ schema for Google rich results.');
  }

  /* ── TECHNICAL ── */
  if (!technical.meta.hasTitle) {
    add('Missing Page <title>',
      'No <title> tag found. The page title is the most important on-page SEO element and appears in browser tabs and search results.',
      '<title> element', 'critical', 'technical',
      'Add <title>Your Primary Keyword - Brand Name</title> inside <head>. Keep it 30–60 characters.', 'WCAG 2.4.2');
  } else if (technical.meta.titleLength > 70) {
    add('Page Title Too Long',
      `Title is ${technical.meta.titleLength} characters. Google truncates titles over ~60 characters in search results, cutting off key information.`,
      `<title>: "${technical.meta.titleText.slice(0,50)}…"`, 'medium', 'technical',
      'Shorten the <title> to 30–60 characters. Put the most important keyword first.');
  }
  if (!technical.meta.hasDescription) {
    add('Missing Meta Description',
      'No meta description found. While not a direct ranking factor, the description appears as your search snippet — missing it lets Google choose arbitrary page text, often poorly.',
      '<meta name="description">', 'medium', 'technical',
      'Add <meta name="description" content="..."> with 120–160 characters summarising the page value proposition.');
  } else if (technical.meta.descriptionLength > 165) {
    add('Meta Description Too Long',
      `Description is ${technical.meta.descriptionLength} characters. Google truncates descriptions over ~155–160 characters.`,
      '<meta name="description">', 'low', 'technical',
      'Shorten the meta description to 120–155 characters.');
  }
  if (!technical.openGraph.hasOgImage) {
    add('Missing Open Graph Image',
      'No og:image found. When pages are shared on social media (LinkedIn, Facebook, Twitter), no preview image will appear — reducing click-through rates dramatically.',
      '<meta property="og:image">', 'medium', 'technical',
      'Add <meta property="og:image" content="[absolute-url-to-image]">. Image should be 1200×630px.');
  }
  if (!technical.schema.hasJsonLd) {
    add('No Structured Data (Schema.org)',
      'No JSON-LD schema markup found. Schema helps Google display rich results (star ratings, FAQs, breadcrumbs) and improves CTR significantly.',
      '<script type="application/ld+json">', 'medium', 'technical',
      'Add at minimum: Organization schema (name, logo, contact) and WebSite schema. Use Google\'s Rich Results Test to validate.');
  }
  if (!technical.performance.hasFavicon) {
    add('Missing Favicon',
      'No favicon detected. Favicons display in browser tabs, bookmarks, and mobile home screens — their absence signals an unfinished or unpolished product.',
      '<link rel="icon">', 'low', 'technical',
      'Create a 32×32px and 192×192px favicon. Add <link rel="icon" href="/favicon.ico"> and <link rel="apple-touch-icon" href="/apple-touch-icon.png">');
  }
  if (technical.performance.deferredScripts + technical.performance.asyncScripts < 2 && technical.performance.externalScriptCount > 3) {
    add('Scripts Not Deferred/Async',
      `${technical.performance.externalScriptCount} external scripts found but few use defer/async. Render-blocking scripts delay First Contentful Paint and hurt Core Web Vitals.`,
      '<script> tags', 'medium', 'technical',
      'Add defer to scripts that don\'t need to run before page render. Use async for independent third-party scripts (analytics, chat).');
  }

  /* ── RESPONSIVENESS ── */
  if (!responsiveness.hasViewportMeta) {
    add('Missing Viewport Meta Tag',
      'The viewport meta tag is absent. Mobile browsers render the full desktop layout at reduced scale, making text tiny and interactions impossible.',
      '<meta name="viewport">', 'critical', 'responsiveness',
      'Add <meta name="viewport" content="width=device-width, initial-scale=1"> inside <head>.', 'WCAG 1.4.4');
  }
  if (!responsiveness.hasMediaQueries) {
    add('No CSS Media Queries Found',
      'No @media queries detected in any stylesheet. The design does not respond to different screen sizes — a critical failure for the ~60% of users on mobile devices.',
      '@media queries in CSS', 'critical', 'responsiveness',
      'Add responsive breakpoints at 768px (tablet) and 480px (mobile) minimum. Use mobile-first approach: base styles for mobile, expand for larger screens.');
  }
  if (responsiveness.mediaQueryCount < 3 && responsiveness.hasMediaQueries) {
    add('Very Few Responsive Breakpoints',
      `Only ${responsiveness.mediaQueryCount} @media query block(s) found. Comprehensive responsiveness typically requires 4–8 breakpoints for different device sizes.`,
      '@media queries', 'medium', 'responsiveness',
      'Add breakpoints for: 480px (small mobile), 768px (tablet), 1024px (small desktop), 1280px (large desktop) at minimum.');
  }
  if (!responsiveness.hasFluidImages) {
    add('Images May Not Be Fluid',
      'No max-width: 100% detected for images. Fixed-width images overflow their containers on small screens, causing horizontal scrolling.',
      'img CSS rules', 'medium', 'responsiveness',
      'Add img { max-width: 100%; height: auto; } to your global CSS to ensure images scale within their containers.');
  }
  if (!responsiveness.hasHamburgerMenu && !responsiveness.hasMobileNavigation) {
    add('No Mobile Menu Detected',
      'No hamburger icon or mobile navigation pattern found. On small screens, the desktop nav likely overflows or collapses unusably.',
      'Mobile navigation', 'critical', 'responsiveness',
      'Implement a hamburger menu triggered by a button. Use aria-expanded and aria-controls for accessibility compliance.');
  }

  /* ── CONSISTENCY ── */
  if (!consistency.animationsDetected && !consistency.transitionsDetected) {
    add('No Animations or Transitions',
      'No CSS animations or transitions detected. Subtle motion (hover effects, fade-ins, slide transitions) significantly improves perceived quality and user delight.',
      'CSS animation/transition properties', 'low', 'consistency',
      'Add transition: all 0.2s ease on interactive elements (buttons, links, cards). Avoid excessive animation that distracts from content.');
  }
  if (!consistency.hoverStatesDetected) {
    add('No Hover States Detected',
      'No :hover styles found in CSS. Links, buttons, and interactive elements without hover feedback feel broken and unpolished.',
      ':hover CSS states', 'medium', 'consistency',
      'Add :hover styles to all interactive elements. At minimum: color change and cursor: pointer on links and buttons.');
  }

  /* ── ACCESSIBILITY (extra) ── */
  if (!technical.accessibility.hasLangAttribute) {
    add('Missing HTML lang Attribute',
      'The <html lang="..."> attribute is absent. Screen readers use this to select the correct voice/language engine. Failing WCAG 3.1.1.',
      '<html lang="en">', 'medium', 'accessibility',
      'Add lang="en" (or appropriate language code) to your <html> tag.', 'WCAG 3.1.1');
  }
  if (technical.accessibility.inputsWithoutLabel > 0) {
    add(`${technical.accessibility.inputsWithoutLabel} Form Input${technical.accessibility.inputsWithoutLabel > 1 ? 's' : ''} Missing Labels`,
      `${technical.accessibility.inputsWithoutLabel} input fields have no associated <label>, aria-label, or aria-labelledby. This breaks form accessibility completely for screen reader users.`,
      'Form <input> elements', 'critical', 'accessibility',
      'Add a <label for="inputId"> for every input, or use aria-label="..." directly on the input element.', 'WCAG 1.3.1');
  }

  return issues;
}

/* ══════════════════════════════════════════════════════════════
   SECTION 16 — COMPOSITE SCORES
══════════════════════════════════════════════════════════════ */
function computeCompositeScores(sections) {
  const { logo, typography, colors, images, layout, navigation,
          cta, headerFooter, content, technical, responsiveness, consistency } = sections;

  const design    = avg([colors.score, typography.score, layout.score, consistency.score, logo.score]);
  const usability = avg([navigation.score, cta.score, content.score, responsiveness.score]);
  const contentS  = avg([content.score, typography.score, headerFooter.score]);
  const technicalS = technical.score;
  const accessibility = technical.accessibility.score;
  const branding  = avg([logo.score, colors.score, consistency.score]);
  const overall   = avg([design, usability, contentS, technicalS, accessibility, branding]);

  return { overall: r(overall), design: r(design), usability: r(usability),
    content: r(contentS), technical: r(technicalS), accessibility: r(accessibility), branding: r(branding) };
}

const avg = (arr) => arr.reduce((s, v) => s + (v || 0), 0) / arr.length;
const r   = (n)   => Math.round(n);

/* ══════════════════════════════════════════════════════════════
   SECTION 17 — AI INSIGHTS
══════════════════════════════════════════════════════════════ */
async function generateAIInsights(url, sections, issues, scores) {
  const critical = issues.filter(i => i.severity === 'critical').length;
  const medium   = issues.filter(i => i.severity === 'medium').length;
  const topIssues = issues.slice(0, 12).map(i =>
    `[${i.severity.toUpperCase()}][${i.category}] ${i.title}: ${i.description.slice(0, 100)}`
  ).join('\n');

  const systemPrompt = `You are a world-class UI/UX design consultant, conversion rate optimizer, and web accessibility expert.
You analyze websites with surgical precision and provide expert, actionable recommendations.
Respond ONLY with valid JSON — no markdown fences, no explanatory text outside the JSON object.`;

  const prompt = `Perform a comprehensive UI/UX expert audit for:
URL: ${url}
Page Title: "${sections.technical.meta.titleText || 'N/A'}"

COMPOSITE SCORES (0-100):
Overall Health: ${scores.overall} | Design: ${scores.design} | Usability: ${scores.usability}
Content: ${scores.content} | Technical: ${scores.technical} | Accessibility: ${scores.accessibility} | Branding: ${scores.branding}

KEY METRICS:
Logo: ${sections.logo.detected ? `Detected (${sections.logo.placement})` : 'NOT DETECTED'} | Linked to home: ${sections.logo.isLinkedToHome}
H1 count: ${sections.typography.headings.h1.count} | First H1: "${sections.typography.headings.h1.texts[0] || 'none'}"
H1→H2 ratio: ${sections.typography.headings.h1ToH2Ratio} | H2→H3 ratio: ${sections.typography.headings.h2ToH3Ratio}
Fonts: ${sections.typography.fontFamilies.slice(0,3).join(', ') || 'system only'} (${sections.typography.fontFamilyCount} families)
Colors: ${sections.colors.uniqueColorCount} unique | CSS Variables: ${sections.colors.cssVariablesUsed}
Images: ${sections.images.totalImages} total | ${sections.images.altTextRatioPct}% have alt text | ${sections.images.lazyLoadRatioPct}% lazy loaded
Mobile menu: ${sections.navigation.hasMobileMenu} | Hamburger: ${sections.responsiveness.hasHamburgerMenu}
CTA in hero: ${sections.cta.ctaInHero} | Total buttons: ${sections.cta.totalButtons} | Strong CTAs: ${sections.cta.strongCTACount}
Privacy link: ${sections.headerFooter.footer.hasPrivacyLink} | Social proof: ${sections.content.socialProof.hasTestimonials}
Schema markup: ${sections.technical.schema.hasJsonLd} | OG image: ${sections.technical.openGraph.hasOgImage}
CSS Framework: ${sections.consistency.cssFrameworkDetected || 'none detected'}
Animations: ${sections.consistency.animationsDetected} | Transitions: ${sections.consistency.transitionsDetected}

DETECTED ISSUES (${issues.length} total: ${critical} critical, ${medium} medium):
${topIssues}

Return EXACTLY this JSON (complete all arrays):
{
  "healthScore": <integer 0-100>,
  "summary": "<4-sentence expert assessment covering: current state, biggest strength, biggest weakness, overall trajectory>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "identifiedIssues": [
    "<plain English explanation of issue 1 (2 sentences)>",
    "<issue 2>", "<issue 3>", "<issue 4>", "<issue 5>"
  ],
  "fixes": [
    {
      "title": "<fix title>",
      "description": "<step-by-step beginner-friendly 4-sentence instructions>",
      "priority": "<high|medium|low>",
      "effort": "<low|medium|high>",
      "impact": "<quantified impact on users/conversions/SEO>"
    }
  ],
  "priority": [
    { "item": "<what to fix>", "reason": "<technical and user reason>", "impact": "<measurable impact>" }
  ],
  "designSystemScore": <0-100>,
  "conversionScore": <0-100>,
  "brandingScore": <0-100>
}
Provide exactly 3 strengths, 5 identifiedIssues, 6 fixes, 5 priority items.`;

  try {
    const { text, provider } = await generateAIResponse(prompt, systemPrompt);
    const parsed = safeParseJSON(text);
    return { ...parsed, provider };
  } catch (err) {
    console.warn('[AI] Fallback insights used:', err.message);
    return {
      healthScore: scores.overall,
      summary: `The site scores ${scores.overall}/100. ${critical} critical issues require immediate attention. Design scores ${scores.design}/100 and usability ${scores.usability}/100. Systematic fixes starting with critical issues can push the overall score above 80 within 2–4 weeks.`,
      strengths: ['Existing content structure provides a foundation to build on', 'Basic page framework is in place', 'Crawlable HTML structure detected'],
      identifiedIssues: issues.slice(0, 5).map(i => `${i.title}: ${i.description.slice(0, 120)}`),
      fixes: issues.filter(i => ['critical', 'medium'].includes(i.severity)).slice(0, 6).map(i => ({
        title: `Fix: ${i.title}`, description: `${i.recommendation || i.description.slice(0, 200)}`,
        priority: i.severity === 'critical' ? 'high' : 'medium', effort: 'medium', impact: 'Improves overall UX and accessibility score',
      })),
      priority: issues.slice(0, 5).map(i => ({ item: i.title, reason: i.description.slice(0, 100), impact: i.recommendation?.slice(0, 80) || 'Significant UX improvement' })),
      designSystemScore: scores.design, conversionScore: scores.usability, brandingScore: scores.branding, provider: 'fallback',
    };
  }
}

/* ══════════════════════════════════════════════════════════════
   SECTION 18 — ORCHESTRATOR
══════════════════════════════════════════════════════════════ */
async function analyzeWebsite(rawUrl) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const record = new UIAnalysis({ url, status: 'analyzing', crawledAt: new Date() });
  await record.save();

  try {
    /* 1. Crawl */
    const { html } = await crawlWebsite(url);

    /* 2. Extract */
    const { $, allCSS, inlineStyles, scriptBlock, bodyText } = extractRaw(html);

    /* 3. Deep analysis for all 12 categories */
    const logo          = analyzeLogo($, allCSS);
    const typography    = analyzeTypography($, allCSS);
    const colors        = analyzeColors($, allCSS);
    const images        = analyzeImages($, allCSS);
    const layout        = analyzeLayout($, allCSS);
    const navigation    = analyzeNavigation($, allCSS);
    const cta           = analyzeCTA($, allCSS);
    const headerFooter  = analyzeHeaderFooter($, allCSS);
    const content       = analyzeContent($);
    const technical     = analyzeTechnical($, allCSS, scriptBlock);
    const responsiveness = analyzeResponsiveness($, allCSS);
    const consistency   = analyzeConsistency($, allCSS, scriptBlock);

    const sections = { logo, typography, colors, images, layout, navigation,
      cta, headerFooter, content, technical, responsiveness, consistency };

    /* 4. Issue detection */
    const issues = detectAllIssues(sections);

    /* 5. Composite scores */
    const scores = computeCompositeScores(sections);

    /* 6. AI insights */
    const aiInsights = await generateAIInsights(url, sections, issues, scores);

    const pageTitle = $('title').text().trim();
    const favicon   = $('link[rel*="icon"]').attr('href') || '';

    record.set({
      pageTitle, favicon, logo, typography, colors, images, layout,
      navigation, cta, headerFooter, content, technical, responsiveness,
      consistency, issues, aiInsights, scores, status: 'completed',
    });
    await record.save();
    return record;

  } catch (err) {
    record.set({ status: 'failed', errorMessage: err.message });
    await record.save();
    throw err;
  }
}

async function getReportById(id) {
  return UIAnalysis.findById(id).lean();
}

async function getRecentReports(limit = 10) {
  return UIAnalysis.find({ status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('url scores pageTitle createdAt')
    .lean();
}

module.exports = { analyzeWebsite, getReportById, getRecentReports };