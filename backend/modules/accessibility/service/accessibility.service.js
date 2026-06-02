'use strict';
/**
 * accessibility.service.js
 * Full WCAG 2.1/2.2 audit engine with cheerio-based static analysis.
 * Falls back to manual calculation when external APIs are unavailable.
 */

const axios   = require('axios');
const cheerio = require('cheerio');

/* ─────────────────── helpers ─────────────────── */

function clamp(v, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, v)); }

function relLuminance(r, g, b) {
  const s = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}

function contrastRatio(rgb1, rgb2) {
  const l1 = relLuminance(...rgb1);
  const l2 = relLuminance(...rgb2);
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function wcagLevel(score) {
  if (score >= 90) return 'AAA';
  if (score >= 75) return 'AA';
  if (score >= 55) return 'A';
  return 'Non-compliant';
}

function impact(score) {
  if (score < 40) return 'critical';
  if (score < 60) return 'serious';
  if (score < 80) return 'moderate';
  return 'minor';
}

function priority(imp) {
  return imp === 'critical' ? 'high' : imp === 'serious' ? 'high' : imp === 'moderate' ? 'medium' : 'low';
}

function readability(text) {
  const sentences = (text.match(/[.!?]+/g) || []).length || 1;
  const words     = text.trim().split(/\s+/).length;
  const syllables = text.split(/[aeiouAEIOU]/).length - 1;
  const fk = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.round(clamp(fk, 0, 100));
}

/* ─────────────────── HTML fetcher ─────────────────── */

async function fetchHtml(url) {
  const { data } = await axios.get(url, {
    timeout: 20000,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WebAuditX/1.0; +https://webauditx.io)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    maxContentLength: 5 * 1024 * 1024,
  });
  return data;
}

/* ─────────────────── individual check functions ─────────────────── */

function checkAltText($) {
  const imgs   = $('img');
  const total  = imgs.length;
  if (total === 0) return { score: 100, status: 'pass', details: 'No images found', value: { total: 0, missing: 0, empty: 0 } };

  let missing = 0, empty = 0, decorative = 0;
  imgs.each((_, el) => {
    const alt = $(el).attr('alt');
    const role = $(el).attr('role');
    if (role === 'presentation' || $(el).attr('aria-hidden') === 'true') { decorative++; return; }
    if (alt === undefined) missing++;
    else if (alt.trim() === '') empty++;
  });

  const bad   = missing + empty;
  const score = clamp(Math.round(((total - bad) / total) * 100));
  return {
    score, status: bad === 0 ? 'pass' : bad < total * 0.2 ? 'warn' : 'fail',
    details: `${total} images: ${missing} missing alt, ${empty} empty alt, ${decorative} decorative`,
    value: { total, missing, empty, decorative },
    wcagCriteria: 'WCAG 1.1.1 Non-text Content (Level A)',
  };
}

function checkAriaRoles($) {
  const validRoles = ['button','checkbox','dialog','figure','form','gridcell','heading','img',
    'link','listbox','listitem','main','menu','menubar','menuitem','navigation','none',
    'option','presentation','progressbar','radio','region','search','slider','spinbutton',
    'status','switch','tab','tablist','tabpanel','textbox','timer','tooltip','tree',
    'treeitem','alert','alertdialog','application','article','banner','columnheader',
    'combobox','complementary','contentinfo','definition','directory','document',
    'feed','grid','group','landmark','log','marquee','math','note','row','rowgroup',
    'rowheader','scrollbar','separator','toolbar'];

  let total = 0, invalid = 0, orphaned = 0;
  $('[role]').each((_, el) => {
    total++;
    const role = $(el).attr('role');
    if (!validRoles.includes(role)) invalid++;
  });

  // Check required ARIA children/parents
  $('[role="listitem"]').each((_, el) => {
    const parent = $(el).parent();
    const pr = parent.attr('role');
    if (!['list','listbox','group'].includes(pr) && !['ul','ol'].includes(parent[0].tagName)) orphaned++;
  });

  const bad   = invalid + orphaned;
  const score = total === 0 ? 100 : clamp(Math.round(((total - bad) / total) * 100));
  return {
    score, status: score > 85 ? 'pass' : score > 60 ? 'warn' : 'fail',
    details: `${total} ARIA roles: ${invalid} invalid, ${orphaned} misused`,
    value: { total, invalid, orphaned },
    wcagCriteria: 'WCAG 4.1.2 Name, Role, Value (Level A)',
  };
}

function checkColorContrast($) {
  // Static analysis of common color patterns from inline styles
  let total = 0, failing = 0;
  const issues = [];

  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{3,6})/);
    const bgMatch    = style.match(/(?:^|;)\s*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})/);

    if (colorMatch && bgMatch) {
      total++;
      try {
        const ratio = contrastRatio(hexToRgb(colorMatch[1]), hexToRgb(bgMatch[1]));
        if (ratio < 4.5) { failing++; issues.push({ fg: colorMatch[1], bg: bgMatch[1], ratio: ratio.toFixed(2) }); }
      } catch (_) {}
    }
  });

  // Heuristic: check text on colored backgrounds from class names
  const lowContrastPatterns = ['text-gray-300', 'text-gray-200', 'text-white bg-yellow', 'text-yellow bg-white'];
  let heuristicFails = 0;
  lowContrastPatterns.forEach(p => { if ($('.' + p.split(' ')[0]).length > 0) heuristicFails++; });

  const score = total === 0 ? 80 : clamp(Math.round(((total - failing) / total) * 100));
  return {
    score: Math.max(score - heuristicFails * 5, 0),
    status: failing === 0 ? 'pass' : failing < 3 ? 'warn' : 'fail',
    details: `${total} inline color pairs checked, ${failing} failing contrast ratio (<4.5:1)`,
    value: { checked: total, failing, sampleIssues: issues.slice(0, 5) },
    wcagCriteria: 'WCAG 1.4.3 Contrast (Minimum) (Level AA)',
  };
}

function checkKeyboardNav($) {
  let issues = 0;
  const interactives = $('a, button, input, select, textarea, [onclick], [role="button"], [role="link"]');
  const total = interactives.length;

  interactives.each((_, el) => {
    const tabindex = $(el).attr('tabindex');
    const tag = el.tagName?.toLowerCase();

    // Non-focusable interactive elements
    if (['div','span'].includes(tag)) {
      const role = $(el).attr('role');
      if (['button','link'].includes(role) && tabindex === undefined) issues++;
    }

    // tabindex > 0 breaks natural flow
    if (tabindex && parseInt(tabindex) > 0) issues++;
  });

  // Check for keyboard traps (modals without proper management)
  const modals = $('[role="dialog"], .modal, #modal').length;
  let focusTrap = 0;
  if (modals > 0) {
    $('[role="dialog"]').each((_, el) => {
      const hasFocusable = $(el).find('button, a, input, [tabindex="0"]').length;
      if (hasFocusable === 0) focusTrap++;
    });
  }

  const bad   = issues + focusTrap;
  const score = total === 0 ? 85 : clamp(Math.round(((total - bad) / total) * 100));
  return {
    score, status: score > 85 ? 'pass' : score > 65 ? 'warn' : 'fail',
    details: `${total} interactive elements, ${issues} keyboard issues, ${focusTrap} focus traps`,
    value: { total, issues, focusTrap },
    wcagCriteria: 'WCAG 2.1 Keyboard Accessible (Level A)',
  };
}

function checkScreenReader($) {
  let score = 100;
  const details = [];

  // Main landmark
  const hasMain = $('main, [role="main"]').length > 0;
  if (!hasMain) { score -= 15; details.push('Missing <main> landmark'); }

  // Navigation landmark
  const hasNav = $('nav, [role="navigation"]').length > 0;
  if (!hasNav) { score -= 10; details.push('Missing <nav> landmark'); }

  // Banner / header
  const hasBanner = $('header, [role="banner"]').length > 0;
  if (!hasBanner) { score -= 8; details.push('Missing <header> landmark'); }

  // Footer / contentinfo
  const hasFooter = $('footer, [role="contentinfo"]').length > 0;
  if (!hasFooter) { score -= 5; details.push('Missing <footer> landmark'); }

  // aria-live regions
  const liveRegions = $('[aria-live]').length;

  // aria-label on landmarks
  const unnamedRegions = $('[role="region"]').filter((_, el) => !$(el).attr('aria-label') && !$(el).attr('aria-labelledby')).length;
  if (unnamedRegions > 0) { score -= unnamedRegions * 5; details.push(`${unnamedRegions} unnamed regions`); }

  return {
    score: clamp(score),
    status: score >= 85 ? 'pass' : score >= 65 ? 'warn' : 'fail',
    details: details.length ? details.join('; ') : 'Good landmark structure',
    value: { hasMain, hasNav, hasBanner, hasFooter, liveRegions, unnamedRegions },
    wcagCriteria: 'WCAG 1.3.1 Info and Relationships (Level A)',
  };
}

function checkFocusIndicators($) {
  let score = 100;
  const issues = [];

  // Check for :focus { outline: none } pattern in inline styles
  $('[style]').each((_, el) => {
    const s = $(el).attr('style') || '';
    if (/outline\s*:\s*none|outline\s*:\s*0/.test(s)) {
      issues.push($(el).prop('tagName')?.toLowerCase() || 'element');
    }
  });

  // Check for tabindex=-1 on things that need focus
  const skipFocus = $('a[tabindex="-1"], button[tabindex="-1"]').length;

  score -= issues.length * 10;
  score -= skipFocus * 5;

  return {
    score: clamp(score),
    status: score >= 85 ? 'pass' : score >= 65 ? 'warn' : 'fail',
    details: `${issues.length} elements with outline removed, ${skipFocus} interactive elements skipped from tab order`,
    value: { outlineRemoved: issues.length, skipFocused: skipFocus, elements: issues.slice(0, 5) },
    wcagCriteria: 'WCAG 2.4.7 Focus Visible (Level AA)',
  };
}

function checkFormLabels($) {
  const inputs  = $('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
  const total   = inputs.length;
  if (total === 0) return { score: 100, status: 'pass', details: 'No form inputs found', value: { total: 0 }, wcagCriteria: 'WCAG 1.3.1' };

  let unlabeled = 0;
  inputs.each((_, el) => {
    const id           = $(el).attr('id');
    const ariaLabel    = $(el).attr('aria-label');
    const ariaLabelby  = $(el).attr('aria-labelledby');
    const title        = $(el).attr('title');
    const hasLabel     = id && $(`label[for="${id}"]`).length > 0;
    if (!hasLabel && !ariaLabel && !ariaLabelby && !title) unlabeled++;
  });

  const score = clamp(Math.round(((total - unlabeled) / total) * 100));
  return {
    score, status: unlabeled === 0 ? 'pass' : unlabeled < total * 0.3 ? 'warn' : 'fail',
    details: `${total} form inputs: ${unlabeled} missing labels`,
    value: { total, unlabeled },
    wcagCriteria: 'WCAG 1.3.1 / 3.3.2 Labels or Instructions (Level A)',
  };
}

function checkHeadingStructure($) {
  const headings = [];
  $('h1,h2,h3,h4,h5,h6').each((_, el) => headings.push(parseInt(el.tagName[1])));

  let score   = 100;
  const issues = [];

  const h1Count = headings.filter(h => h === 1).length;
  if (h1Count === 0)  { score -= 20; issues.push('No H1 found'); }
  if (h1Count > 1)    { score -= 10; issues.push(`Multiple H1 tags (${h1Count})`); }

  // Check for skipped levels
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] - headings[i - 1] > 1) {
      score -= 8;
      issues.push(`Heading level skipped: H${headings[i-1]} → H${headings[i]}`);
    }
  }

  return {
    score: clamp(score),
    status: score >= 85 ? 'pass' : score >= 65 ? 'warn' : 'fail',
    details: issues.length ? issues.join('; ') : `Good heading structure (${headings.length} headings)`,
    value: { headings: headings.length, h1Count, sequence: headings.slice(0, 20) },
    wcagCriteria: 'WCAG 1.3.1 / 2.4.6 Headings and Labels (Level AA)',
  };
}

function checkLinkText($) {
  const links  = $('a[href]');
  const total  = links.length;
  if (total === 0) return { score: 100, status: 'pass', details: 'No links found', value: { total: 0 }, wcagCriteria: 'WCAG 2.4.4' };

  const vague = ['click here', 'here', 'read more', 'more', 'link', 'this', 'click', 'go'];
  let badCount = 0;
  links.each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const aria = $(el).attr('aria-label') || '';
    if (!aria && (vague.includes(text) || text.length < 2)) badCount++;
  });

  const score = clamp(Math.round(((total - badCount) / total) * 100));
  return {
    score, status: badCount === 0 ? 'pass' : badCount < 5 ? 'warn' : 'fail',
    details: `${total} links: ${badCount} with vague/missing link text`,
    value: { total, vague: badCount },
    wcagCriteria: 'WCAG 2.4.4 Link Purpose (Level A)',
  };
}

function checkLanguageAttr($) {
  const htmlEl   = $('html');
  const lang     = htmlEl.attr('lang');
  const xmlLang  = htmlEl.attr('xml:lang');
  const hasLang  = !!(lang || xmlLang);
  const validLang = hasLang && /^[a-zA-Z]{2,3}(-[a-zA-Z]{2,})?$/.test(lang || xmlLang || '');

  return {
    score: hasLang && validLang ? 100 : hasLang ? 75 : 0,
    status: hasLang && validLang ? 'pass' : hasLang ? 'warn' : 'fail',
    details: hasLang ? `Language set: "${lang || xmlLang}"` : 'Missing lang attribute on <html>',
    value: { lang: lang || xmlLang || null, valid: validLang },
    wcagCriteria: 'WCAG 3.1.1 Language of Page (Level A)',
  };
}

function checkSkipLinks($) {
  const skipLinks = $('a[href^="#"]').filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return text.includes('skip') || text.includes('jump') || text.includes('main content');
  });

  const hasSkip = skipLinks.length > 0;
  return {
    score: hasSkip ? 100 : 40,
    status: hasSkip ? 'pass' : 'fail',
    details: hasSkip ? `${skipLinks.length} skip link(s) found` : 'No skip navigation link found',
    value: { count: skipLinks.length },
    wcagCriteria: 'WCAG 2.4.1 Bypass Blocks (Level A)',
  };
}

function checkTabIndex($) {
  const positive = $('[tabindex]').filter((_, el) => parseInt($(el).attr('tabindex')) > 0);
  const score    = clamp(100 - positive.length * 15);
  return {
    score, status: positive.length === 0 ? 'pass' : positive.length < 3 ? 'warn' : 'fail',
    details: `${positive.length} elements with positive tabindex (disrupts natural focus order)`,
    value: { positiveTabindex: positive.length },
    wcagCriteria: 'WCAG 2.4.3 Focus Order (Level A)',
  };
}

function checkVideoAudio($) {
  const videos   = $('video').length;
  const audios   = $('audio').length;
  const iframes  = $('iframe[src*="youtube"], iframe[src*="vimeo"]').length;
  const total    = videos + audios + iframes;

  if (total === 0) return { score: 100, status: 'info', details: 'No video/audio elements found', value: { total: 0 }, wcagCriteria: 'WCAG 1.2' };

  let captioned = 0;
  $('video').each((_, el) => { if ($(el).find('track[kind="captions"], track[kind="subtitles"]').length > 0) captioned++; });

  const score = total === 0 ? 100 : clamp(Math.round((captioned / Math.max(videos, 1)) * 100));
  return {
    score, status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
    details: `${total} media elements: ${videos} video, ${audios} audio, ${iframes} embedded; ${captioned} with captions`,
    value: { videos, audios, embeds: iframes, captioned },
    wcagCriteria: 'WCAG 1.2.2 Captions (Prerecorded) (Level A)',
  };
}

function checkTableStructure($) {
  const tables = $('table');
  const total  = tables.length;
  if (total === 0) return { score: 100, status: 'info', details: 'No tables found', value: { total: 0 }, wcagCriteria: 'WCAG 1.3.1' };

  let issues = 0;
  tables.each((_, el) => {
    const hasHeaders = $(el).find('th').length > 0;
    const hasCaption = $(el).find('caption').length > 0 || $(el).attr('aria-label') || $(el).attr('aria-labelledby');
    const hasScope   = $(el).find('th[scope]').length > 0;
    if (!hasHeaders) issues++;
    if (!hasCaption) issues += 0.5;
    if (hasHeaders && !hasScope) issues += 0.5;
  });

  issues = Math.ceil(issues);
  const score = clamp(Math.round(((total - Math.min(issues, total)) / total) * 100));
  return {
    score, status: issues === 0 ? 'pass' : issues < total * 0.3 ? 'warn' : 'fail',
    details: `${total} tables: ${issues} with structural issues`,
    value: { total, issues },
    wcagCriteria: 'WCAG 1.3.1 Info and Relationships (Level A)',
  };
}

function checkReadability($) {
  const body   = $('body');
  const text   = body.text().replace(/\s+/g, ' ').trim();
  const score  = readability(text.slice(0, 5000));
  const words  = text.split(/\s+/).length;
  return {
    score, status: score >= 60 ? 'pass' : score >= 40 ? 'warn' : 'fail',
    details: `Flesch readability: ${score}/100 (${words} words analyzed)`,
    value: { readabilityScore: score, wordCount: words },
    wcagCriteria: 'WCAG 3.1.5 Reading Level (Level AAA)',
  };
}

function checkErrorIdentification($) {
  const inputs    = $('input, select, textarea').length;
  const reqInputs = $('[required], [aria-required="true"]').length;
  const hasAriaInvalid   = $('[aria-invalid]').length;
  const hasAriaDescribed = $('[aria-describedby]').length;

  let score = 100;
  if (reqInputs > 0 && hasAriaInvalid === 0) score -= 20;
  if (inputs > 0 && hasAriaDescribed < inputs * 0.3) score -= 15;

  return {
    score: clamp(score),
    status: score >= 80 ? 'pass' : score >= 60 ? 'warn' : 'fail',
    details: `${inputs} inputs, ${reqInputs} required; ${hasAriaDescribed} with error descriptions`,
    value: { inputs, required: reqInputs, hasAriaInvalid, hasAriaDescribed },
    wcagCriteria: 'WCAG 3.3.1 Error Identification (Level A)',
  };
}

function checkTimeouts($) {
  const hasMeta  = $('meta[http-equiv="refresh"]').length > 0;
  const score    = hasMeta ? 20 : 100;
  return {
    score, status: hasMeta ? 'fail' : 'pass',
    details: hasMeta ? 'Meta refresh found — may cause issues for users needing more time' : 'No auto-refresh detected',
    value: { metaRefresh: hasMeta },
    wcagCriteria: 'WCAG 2.2.1 Timing Adjustable (Level A)',
  };
}

function checkAnimations($) {
  let score = 100;
  const issues = [];

  // Check for potential motion issues
  $('[style]').each((_, el) => {
    const s = $(el).attr('style') || '';
    if (/animation|transition/.test(s) && !/prefers-reduced-motion/.test(s)) {
      issues.push('Inline animation without reduced-motion consideration');
    }
  });

  score -= Math.min(issues.length * 10, 40);
  return {
    score: clamp(score),
    status: score >= 80 ? 'pass' : 'warn',
    details: `${issues.length} potential animation issues (no prefers-reduced-motion)`,
    value: { issues: issues.length },
    wcagCriteria: 'WCAG 2.3.3 Animation from Interactions (Level AAA)',
  };
}

function checkTextResize($) {
  // Check viewport meta for user-scalable=no
  const viewport = $('meta[name="viewport"]').attr('content') || '';
  const noScale  = /user-scalable\s*=\s*no|maximum-scale\s*=\s*1\.?0?/.test(viewport);
  const score    = noScale ? 30 : 100;
  return {
    score, status: noScale ? 'fail' : 'pass',
    details: noScale ? 'Viewport prevents user scaling (user-scalable=no)' : 'Text resize allowed',
    value: { viewport, noScale },
    wcagCriteria: 'WCAG 1.4.4 Resize Text (Level AA)',
  };
}

function checkSemanticHTML($) {
  let score = 100;
  const issues = [];

  // Divs used as buttons
  const divButtons = $('div[onclick], span[onclick]').length;
  if (divButtons > 0) { score -= divButtons * 5; issues.push(`${divButtons} div/span used as button`); }

  // Tables for layout (heuristic)
  const layoutTables = $('table').filter((_, el) => $(el).find('th').length === 0 && $(el).find('td').length > 4).length;
  if (layoutTables > 0) { score -= layoutTables * 8; issues.push(`${layoutTables} possible layout table`); }

  // Semantic elements usage
  const semanticScore = ['article','section','aside','main','header','footer','nav','figure','figcaption']
    .reduce((acc, tag) => acc + ($(`${tag}`).length > 0 ? 1 : 0), 0);

  if (semanticScore < 3) { score -= 20; issues.push('Low use of semantic HTML5 elements'); }

  return {
    score: clamp(score),
    status: score >= 80 ? 'pass' : score >= 60 ? 'warn' : 'fail',
    details: issues.length ? issues.join('; ') : 'Good semantic HTML usage',
    value: { divButtons, layoutTables, semanticElementsUsed: semanticScore },
    wcagCriteria: 'WCAG 1.3.1 Info and Relationships (Level A)',
  };
}

/* ─────────────────── issue builder ─────────────────── */

function buildIssues(metrics) {
  const issues = [];

  const map = [
    { key: 'altText',          category: 'Images',        rule: 'Alt Text',         wcag: '1.1.1' },
    { key: 'ariaRoles',        category: 'ARIA',          rule: 'ARIA Roles',        wcag: '4.1.2' },
    { key: 'colorContrast',    category: 'Visual',        rule: 'Color Contrast',    wcag: '1.4.3' },
    { key: 'keyboardNav',      category: 'Keyboard',      rule: 'Keyboard Navigation', wcag: '2.1.1' },
    { key: 'screenReader',     category: 'Structure',     rule: 'Screen Reader',     wcag: '1.3.1' },
    { key: 'focusIndicators',  category: 'Focus',         rule: 'Focus Indicators',  wcag: '2.4.7' },
    { key: 'formLabels',       category: 'Forms',         rule: 'Form Labels',       wcag: '1.3.1' },
    { key: 'headingStructure', category: 'Structure',     rule: 'Heading Structure', wcag: '2.4.6' },
    { key: 'linkText',         category: 'Navigation',    rule: 'Link Text',         wcag: '2.4.4' },
    { key: 'languageAttr',     category: 'Language',      rule: 'Language Attribute', wcag: '3.1.1' },
    { key: 'skipLinks',        category: 'Navigation',    rule: 'Skip Links',        wcag: '2.4.1' },
    { key: 'tabIndex',         category: 'Focus',         rule: 'Tab Index',         wcag: '2.4.3' },
    { key: 'videoAudio',       category: 'Media',         rule: 'Video/Audio',       wcag: '1.2.2' },
    { key: 'tableStructure',   category: 'Data',          rule: 'Table Structure',   wcag: '1.3.1' },
    { key: 'readability',      category: 'Cognitive',     rule: 'Readability',       wcag: '3.1.5' },
    { key: 'errorIdentification', category: 'Forms',      rule: 'Error Identification', wcag: '3.3.1' },
    { key: 'timeouts',         category: 'Timing',        rule: 'Timeouts',          wcag: '2.2.1' },
    { key: 'animations',       category: 'Motion',        rule: 'Animations',        wcag: '2.3.3' },
    { key: 'textResize',       category: 'Visual',        rule: 'Text Resize',       wcag: '1.4.4' },
    { key: 'semanticHTML',     category: 'Semantic',      rule: 'Semantic HTML',     wcag: '1.3.1' },
  ];

  map.forEach(({ key, category, rule, wcag }) => {
    const m = metrics[key];
    if (!m || m.status === 'pass' || m.status === 'info') return;
    const imp = impact(m.score);
    issues.push({
      id: `${key}-001`,
      category, rule, wcag,
      impact: imp,
      priority: priority(imp),
      description: m.details,
      element: m.value ? JSON.stringify(m.value).slice(0, 120) : '',
      fix: getFix(key),
      count: 1,
    });
  });

  return issues.sort((a, b) => {
    const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    return order[a.impact] - order[b.impact];
  });
}

function getFix(key) {
  const fixes = {
    altText:          'Add descriptive alt attributes to all <img> elements. Use alt="" for decorative images.',
    ariaRoles:        'Use only valid WAI-ARIA roles and ensure required parent/child relationships are maintained.',
    colorContrast:    'Ensure text has a contrast ratio of at least 4.5:1 (AA) or 7:1 (AAA) against its background.',
    keyboardNav:      'Ensure all interactive elements are reachable via keyboard Tab key. Avoid positive tabindex values.',
    screenReader:     'Add landmark elements: <main>, <nav>, <header>, <footer>. Label regions with aria-label.',
    focusIndicators:  'Never use outline:none without providing a custom visible focus style.',
    formLabels:       'Associate every form input with a <label> element using the "for" attribute matching the input id.',
    headingStructure: 'Use one <h1> per page. Do not skip heading levels (e.g., h1 → h3).',
    linkText:         'Replace vague link text like "click here" with descriptive text that explains the destination.',
    languageAttr:     'Add a valid lang attribute to the <html> element (e.g., <html lang="en">).',
    skipLinks:        'Add a "Skip to main content" link as the first element in the page.',
    tabIndex:         'Avoid positive tabindex values; use 0 or -1 only.',
    videoAudio:       'Add <track kind="captions"> to all <video> elements for prerecorded content.',
    tableStructure:   'Use <th> with scope attribute and <caption> for data tables.',
    readability:      'Simplify content to approximately Grade 8 level. Use short sentences and common words.',
    errorIdentification: 'Mark required fields with aria-required and use aria-describedby to link error messages.',
    timeouts:         'Remove meta refresh. If session timeouts are needed, warn users and allow extension.',
    animations:       'Wrap animations in @media (prefers-reduced-motion: reduce) to respect user preferences.',
    textResize:       'Remove user-scalable=no from viewport meta. Allow users to resize text up to 200%.',
    semanticHTML:     'Use semantic HTML5 elements (<article>, <section>, <nav>, etc.) instead of generic <div> containers.',
  };
  return fixes[key] || 'Review and fix according to WCAG 2.2 guidelines.';
}

/* ─────────────────── main analyze function ─────────────────── */

async function analyzeAccessibility(url) {
  const html = await fetchHtml(url);
  const $    = cheerio.load(html);

  const metrics = {
    altText:             checkAltText($),
    ariaRoles:           checkAriaRoles($),
    colorContrast:       checkColorContrast($),
    keyboardNav:         checkKeyboardNav($),
    screenReader:        checkScreenReader($),
    focusIndicators:     checkFocusIndicators($),
    formLabels:          checkFormLabels($),
    headingStructure:    checkHeadingStructure($),
    linkText:            checkLinkText($),
    languageAttr:        checkLanguageAttr($),
    skipLinks:           checkSkipLinks($),
    tabIndex:            checkTabIndex($),
    videoAudio:          checkVideoAudio($),
    tableStructure:      checkTableStructure($),
    readability:         checkReadability($),
    errorIdentification: checkErrorIdentification($),
    timeouts:            checkTimeouts($),
    animations:          checkAnimations($),
    textResize:          checkTextResize($),
    semanticHTML:        checkSemanticHTML($),
  };

  // Add metric names
  const metricNames = {
    altText: 'Alt Text', ariaRoles: 'ARIA Roles', colorContrast: 'Color Contrast',
    keyboardNav: 'Keyboard Navigation', screenReader: 'Screen Reader Compatibility',
    focusIndicators: 'Focus Indicators', formLabels: 'Form Labels',
    headingStructure: 'Heading Structure', linkText: 'Link Text Quality',
    languageAttr: 'Language Attribute', skipLinks: 'Skip Navigation',
    tabIndex: 'Tab Index Order', videoAudio: 'Video & Audio',
    tableStructure: 'Table Structure', readability: 'Content Readability',
    errorIdentification: 'Error Identification', timeouts: 'Session Timeouts',
    animations: 'Motion & Animations', textResize: 'Text Resize',
    semanticHTML: 'Semantic HTML',
  };
  Object.keys(metrics).forEach(k => { metrics[k].name = metricNames[k]; });

  // Overall score (weighted average)
  const weights = {
    altText:0.08, ariaRoles:0.06, colorContrast:0.09, keyboardNav:0.08,
    screenReader:0.07, focusIndicators:0.06, formLabels:0.07, headingStructure:0.06,
    linkText:0.06, languageAttr:0.04, skipLinks:0.04, tabIndex:0.04,
    videoAudio:0.03, tableStructure:0.03, readability:0.05, errorIdentification:0.05,
    timeouts:0.03, animations:0.03, textResize:0.04, semanticHTML:0.04,
  };
  const overallScore = clamp(Math.round(
    Object.keys(metrics).reduce((acc, k) => acc + (metrics[k].score || 0) * (weights[k] || 0), 0)
  ));

  const issues = buildIssues(metrics);

  const summary = {
    totalIssues:    issues.length,
    criticalIssues: issues.filter(i => i.impact === 'critical').length,
    seriousIssues:  issues.filter(i => i.impact === 'serious').length,
    moderateIssues: issues.filter(i => i.impact === 'moderate').length,
    minorIssues:    issues.filter(i => i.impact === 'minor').length,
    passedChecks:   Object.values(metrics).filter(m => m.status === 'pass').length,
    totalChecks:    Object.keys(metrics).length,
  };

  return { url, metrics, issues, overallScore, wcagLevel: wcagLevel(overallScore), summary, rawHtml: html };
}

module.exports = { analyzeAccessibility };