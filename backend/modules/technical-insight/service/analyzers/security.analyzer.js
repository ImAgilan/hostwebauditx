'use strict';
/**
 * security.analyzer.js
 * Security headers, vulnerability detection, SSL/TLS, cookie flags, malware check
 */

const axios   = require('axios');
const cheerio = require('cheerio');

const SECURITY_HEADERS = [
  { name: 'content-security-policy',         label: 'Content-Security-Policy',         severity: 'high',   score: 20 },
  { name: 'strict-transport-security',        label: 'Strict-Transport-Security (HSTS)', severity: 'high',   score: 20 },
  { name: 'x-frame-options',                  label: 'X-Frame-Options',                  severity: 'medium', score: 15 },
  { name: 'x-content-type-options',           label: 'X-Content-Type-Options',           severity: 'medium', score: 15 },
  { name: 'referrer-policy',                  label: 'Referrer-Policy',                  severity: 'low',    score: 10 },
  { name: 'permissions-policy',               label: 'Permissions-Policy',               severity: 'low',    score: 10 },
  { name: 'x-xss-protection',                 label: 'X-XSS-Protection',                 severity: 'low',    score: 10 },
];

/* ═══════════════════════════════════════
   1. SECURITY HEADERS
═══════════════════════════════════════ */
async function analyzeSecurityHeaders(targetUrl) {
  const result = { headers: {}, present: [], missing: [], score: 0, issues: [] };

  try {
    const res = await axios.get(targetUrl, {
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });
    const h = res.headers;
    let totalScore = 0;
    let maxScore   = 0;

    for (const hdr of SECURITY_HEADERS) {
      maxScore += hdr.score;
      const val = h[hdr.name];
      if (val) {
        totalScore += hdr.score;
        result.present.push({ name: hdr.label, value: val, status: 'present' });
        result.headers[hdr.name] = val;
      } else {
        result.missing.push({ name: hdr.label, severity: hdr.severity });
        result.issues.push({
          category : 'security',
          title    : `Missing ${hdr.label}`,
          detail   : `The ${hdr.label} header is not set, leaving the site vulnerable.`,
          severity : hdr.severity,
          fix      : `Add "${hdr.label}" to your web server or CDN configuration.`,
          impact   : `Risk of ${hdr.name.includes('csp') ? 'XSS attacks' : hdr.name.includes('hsts') ? 'protocol downgrade attacks' : 'clickjacking/data leakage'}`,
        });
      }
    }
    result.score = Math.round((totalScore / maxScore) * 100);

    /* Extra header info */
    result.extraInfo = {
      server       : h.server          || null,
      poweredBy    : h['x-powered-by'] || null,
      setCookie    : h['set-cookie']   || null,
    };

    /* Expose server/tech info issue */
    if (h['x-powered-by']) {
      result.issues.push({
        category: 'security', title: 'Server Technology Exposed',
        detail: `X-Powered-By header reveals: ${h['x-powered-by']}`,
        severity: 'medium',
        fix: 'Remove or mask the X-Powered-By header.',
        impact: 'Attackers can target known vulnerabilities of the exposed technology.',
      });
    }
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

/* ═══════════════════════════════════════
   2. COOKIE / SESSION SECURITY
═══════════════════════════════════════ */
async function analyzeCookies(targetUrl) {
  const result = { cookies: [], issues: [] };
  try {
    const res = await axios.get(targetUrl, {
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });
    const rawCookies = res.headers['set-cookie'] || [];

    for (const raw of rawCookies) {
      const parts   = raw.split(';').map(p => p.trim());
      const [nameVal] = parts;
      const flags    = parts.slice(1).map(p => p.toLowerCase());
      const cookie   = {
        name      : nameVal.split('=')[0],
        secure    : flags.some(f => f === 'secure'),
        httpOnly  : flags.some(f => f === 'httponly'),
        sameSite  : flags.find(f => f.startsWith('samesite'))?.split('=')[1] || null,
        raw,
      };
      result.cookies.push(cookie);

      if (!cookie.secure)   result.issues.push({ category: 'security', title: `Cookie "${cookie.name}" missing Secure flag`, severity: 'high',   fix: 'Add Secure flag to all cookies.', impact: 'Cookie can be transmitted over HTTP.', detail: '' });
      if (!cookie.httpOnly) result.issues.push({ category: 'security', title: `Cookie "${cookie.name}" missing HttpOnly flag`, severity: 'medium', fix: 'Add HttpOnly flag to prevent JS access.', impact: 'XSS attacks can steal cookies.', detail: '' });
      if (!cookie.sameSite) result.issues.push({ category: 'security', title: `Cookie "${cookie.name}" missing SameSite attribute`, severity: 'low', fix: 'Set SameSite=Strict or Lax.', impact: 'Risk of CSRF attacks.', detail: '' });
    }
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

/* ═══════════════════════════════════════
   3. VULNERABILITY DETECTION
═══════════════════════════════════════ */
async function analyzeVulnerabilities(targetUrl) {
  const result = { exposedPaths: [], mixedContent: false, inlineScripts: 0, openRedirects: false, issues: [] };

  const COMMON_SENSITIVE = [
    '.env', '.git/config', 'wp-login.php', 'admin/', 'phpmyadmin/',
    'wp-admin/', 'administrator/', '.htaccess', 'config.php', 'xmlrpc.php',
  ];

  /* Check exposed paths */
  for (const path of COMMON_SENSITIVE) {
    try {
      const probe = await axios.get(`${new URL(targetUrl).origin}/${path}`, {
        timeout: 5000,
        maxRedirects: 0,
        validateStatus: (s) => s < 500,
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      });
      if (probe.status === 200 || probe.status === 403) {
        result.exposedPaths.push({ path, status: probe.status });
        if (probe.status === 200) {
          result.issues.push({
            category: 'security',
            title   : `Exposed Sensitive Path: /${path}`,
            detail  : `The path /${path} returned HTTP ${probe.status}.`,
            severity: ['env', '.git', 'config', 'htaccess'].some(k => path.includes(k)) ? 'high' : 'medium',
            fix     : `Block access to /${path} via server config or .htaccess.`,
            impact  : 'Sensitive data or admin access may be compromised.',
          });
        }
      }
    } catch (_) {}
  }

  /* Check HTML for mixed content & inline scripts */
  try {
    const res  = await axios.get(targetUrl, { timeout: 10000, maxRedirects: 5, validateStatus: () => true });
    const $    = cheerio.load(res.data);
    const baseProtocol = new URL(targetUrl).protocol;

    if (baseProtocol === 'https:') {
      $('[src],[href]').each((_, el) => {
        const attr = $(el).attr('src') || $(el).attr('href');
        if (attr && attr.startsWith('http://')) {
          result.mixedContent = true;
        }
      });
    }

    result.inlineScripts = $('script:not([src])').length;

    if (result.mixedContent) {
      result.issues.push({ category: 'security', title: 'Mixed Content Detected', detail: 'Page loads HTTP resources over HTTPS.', severity: 'high', fix: 'Update all resource URLs to HTTPS.', impact: 'Browser may block insecure content; user data at risk.' });
    }
    if (result.inlineScripts > 5) {
      result.issues.push({ category: 'security', title: 'Excessive Inline Scripts', detail: `${result.inlineScripts} inline scripts found.`, severity: 'low', fix: 'Move inline scripts to external files to enable strict CSP.', impact: 'Hinders Content Security Policy enforcement.' });
    }
  } catch (_) {}

  return result;
}

/* ═══════════════════════════════════════
   4. MALWARE / BLACKLIST CHECK
═══════════════════════════════════════ */
async function analyzeMalware(targetUrl) {
  const result = { safe: true, flags: [], source: null };

  /* Google Safe Browsing */
  try {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY || process.env.PAGESPEED_API_KEY;
    if (apiKey) {
      const sbRes = await axios.post(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
        {
          client   : { clientId: 'webauditx', clientVersion: '1.0' },
          threatInfo: {
            threatTypes     : ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes   : ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries   : [{ url: targetUrl }],
          },
        },
        { timeout: 8000 }
      );
      if (sbRes.data?.matches?.length) {
        result.safe  = false;
        result.flags = sbRes.data.matches.map(m => m.threatType);
        result.source= 'google_safe_browsing';
      } else {
        result.source = 'google_safe_browsing';
      }
    }
  } catch (_) {}

  return result;
}

module.exports = { analyzeSecurityHeaders, analyzeCookies, analyzeVulnerabilities, analyzeMalware };