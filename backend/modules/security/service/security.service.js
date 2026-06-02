'use strict';
/**
 * security.service.js
 * Full security audit service — SSL, headers, cookies, DNS, CMS, safe-browsing, etc.
 */

const https   = require('https');
const http    = require('http');
const url     = require('url');
const tls     = require('tls');
const dns     = require('dns').promises;
const axios   = require('axios');
const cheerio = require('cheerio');

/* ─── helpers ─────────────────────────────────────────────────── */
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(targetUrl, followRedirects = true) {
  try {
    const res = await axios.get(targetUrl, {
      timeout: 15000,
      maxRedirects: followRedirects ? 5 : 0,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebAuditX/1.0; +https://webauditx.com)',
      },
    });
    return res;
  } catch (err) {
    return null;
  }
}

/* ─── 1. SSL/TLS ───────────────────────────────────────────────── */
async function checkSSL(hostname) {
  return new Promise(resolve => {
    const options = {
      host: hostname,
      port: 443,
      servername: hostname,
      rejectUnauthorized: false,
      timeout: 10000,
    };
    const socket = tls.connect(options, () => {
      const cert  = socket.getPeerCertificate(true);
      const proto = socket.getProtocol();
      const authorized = socket.authorized;

      if (!cert || !cert.subject) {
        socket.destroy();
        return resolve({ valid: false, error: 'No certificate found' });
      }

      const validFrom       = new Date(cert.valid_from);
      const validTo         = new Date(cert.valid_to);
      const now             = new Date();
      const daysUntilExpiry = Math.floor((validTo - now) / 86400000);
      const isExpired       = daysUntilExpiry < 0;

      const subjectCN = cert.subject?.CN || '';
      const hostnameMatch =
        subjectCN === hostname ||
        (subjectCN.startsWith('*.') && hostname.endsWith(subjectCN.slice(1)));

      socket.destroy();
      resolve({
        valid: !isExpired && authorized,
        issuer: cert.issuer ? Object.values(cert.issuer).join(', ') : 'Unknown',
        subject: subjectCN,
        validFrom: cert.valid_from,
        validTo: cert.valid_to,
        daysUntilExpiry,
        protocol: proto,
        keyBits: cert.bits || null,
        signatureAlgorithm: cert.sigalg || null,
        isTrusted: authorized,
        hostnameMatch,
        grade: daysUntilExpiry > 30 && authorized && hostnameMatch ? 'A' : 'F',
      });
    });
    socket.on('error', err => resolve({ valid: false, error: err.message }));
    socket.setTimeout(10000, () => { socket.destroy(); resolve({ valid: false, error: 'Timeout' }); });
  });
}

/* ─── 2. TLS versions ─────────────────────────────────────────── */
async function checkTLSVersions(hostname) {
  const versions = { tls10: false, tls11: false, tls12: false, tls13: false };
  const versionMap = [
    ['TLSv1', 'tls10'],
    ['TLSv1.1', 'tls11'],
    ['TLSv1.2', 'tls12'],
    ['TLSv1.3', 'tls13'],
  ];
  await Promise.all(versionMap.map(([v, key]) =>
    new Promise(res => {
      const s = tls.connect({ host: hostname, port: 443, servername: hostname, rejectUnauthorized: false, minVersion: v, maxVersion: v, timeout: 5000 }, () => {
        versions[key] = true; s.destroy(); res();
      });
      s.on('error', () => res());
      s.setTimeout(5000, () => { s.destroy(); res(); });
    })
  ));
  return { supportsTls10: versions.tls10, supportsTls11: versions.tls11, supportsTls12: versions.tls12, supportsTls13: versions.tls13, weakCiphers: [] };
}

/* ─── 3. HTTPS enforcement ────────────────────────────────────── */
async function checkHTTPS(parsedUrl) {
  const isHttps = parsedUrl.protocol === 'https:';
  let redirectsToHttps = false;
  if (!isHttps) {
    const httpRes = await fetchPage(`http://${parsedUrl.hostname}`, false);
    if (httpRes && [301, 302, 307, 308].includes(httpRes.status)) {
      const loc = httpRes.headers['location'] || '';
      redirectsToHttps = loc.startsWith('https://');
    }
  } else {
    const httpRes = await fetchPage(`http://${parsedUrl.hostname}`, false);
    if (httpRes && [301, 302, 307, 308].includes(httpRes.status)) {
      redirectsToHttps = true;
    }
  }
  return { enforced: isHttps, redirectsToHttps, mixedContent: false, mixedContentItems: [] };
}

/* ─── 4. Security headers ─────────────────────────────────────── */
function analyzeHeaders(headers) {
  const h = k => headers[k.toLowerCase()] || '';

  const cspVal  = h('content-security-policy');
  const cspIssues = [];
  if (!cspVal) { cspIssues.push('CSP header missing'); }
  else {
    if (cspVal.includes("'unsafe-inline'")) cspIssues.push("CSP allows 'unsafe-inline'");
    if (cspVal.includes("'unsafe-eval'"))   cspIssues.push("CSP allows 'unsafe-eval'");
    if (cspVal.includes('*'))               cspIssues.push('CSP contains wildcard (*)');
  }

  const hstsVal = h('strict-transport-security');
  const maxAgeMatch = hstsVal.match(/max-age=(\d+)/i);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 0;

  const serverVal   = h('server');
  const poweredBy   = h('x-powered-by');
  const corsVal     = h('access-control-allow-origin');

  return {
    csp:                 { present: !!cspVal, value: cspVal, issues: cspIssues },
    hsts:                { present: !!hstsVal, value: hstsVal, maxAge, includesSubDomains: hstsVal.includes('includeSubDomains'), preload: hstsVal.includes('preload') },
    xContentTypeOptions: { present: !!h('x-content-type-options'), value: h('x-content-type-options') },
    xFrameOptions:       { present: !!h('x-frame-options'), value: h('x-frame-options') },
    xXssProtection:      { present: !!h('x-xss-protection'), value: h('x-xss-protection') },
    referrerPolicy:      { present: !!h('referrer-policy'), value: h('referrer-policy') },
    permissionsPolicy:   { present: !!h('permissions-policy'), value: h('permissions-policy') },
    cacheControl:        { present: !!h('cache-control'), value: h('cache-control') },
    serverHeader:        { present: !!serverVal, value: serverVal, exposesInfo: !!serverVal && /\d/.test(serverVal) },
    xPoweredBy:          { present: !!poweredBy, value: poweredBy, exposesInfo: !!poweredBy },
    corsOrigin:          { present: !!corsVal, value: corsVal, isWildcard: corsVal === '*' },
  };
}

/* ─── 5. Cookies ──────────────────────────────────────────────── */
function analyzeCookies(setCookieHeader) {
  if (!setCookieHeader) return [];
  const raw = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return raw.map(cookieStr => {
    const parts   = cookieStr.split(';').map(p => p.trim());
    const nameVal = parts[0].split('=');
    const name    = nameVal[0];
    const attrs   = parts.slice(1).map(p => p.toLowerCase());
    const httpOnly = attrs.some(a => a === 'httponly');
    const secure   = attrs.some(a => a === 'secure');
    const sameSite = (attrs.find(a => a.startsWith('samesite=')) || '').replace('samesite=', '') || 'none';
    const issues = [];
    if (!httpOnly) issues.push('Missing HttpOnly flag');
    if (!secure)   issues.push('Missing Secure flag');
    if (sameSite === 'none' || sameSite === '') issues.push('Missing or weak SameSite attribute');
    return { name, httpOnly, secure, sameSite, issues };
  });
}

/* ─── 6. Forms ────────────────────────────────────────────────── */
function analyzeForms($, pageUrl) {
  const forms   = $('form');
  const results = [];
  const parsedBase = new url.URL(pageUrl);
  forms.each((_, el) => {
    const action = $(el).attr('action') || '';
    const method = ($(el).attr('method') || 'get').toLowerCase();
    const hasPassword = $(el).find('input[type="password"]').length > 0;
    let isInsecure = false;
    if (action.startsWith('http://')) isInsecure = true;
    else if (!action.startsWith('https://') && parsedBase.protocol === 'http:') isInsecure = hasPassword;
    results.push({ action, method, hasPassword, isInsecure });
  });
  return { total: results.length, insecure: results.filter(f => f.isInsecure).length, items: results };
}

/* ─── 7. CMS detection ────────────────────────────────────────── */
function detectCMS($, headers, html) {
  const h = k => (headers[k.toLowerCase()] || '').toLowerCase();
  const generators = $('meta[name="generator"]').attr('content') || '';

  const cms = { detected: false, name: '', version: '', vulnerabilities: [] };

  if (/wordpress/i.test(html) || /wp-content|wp-includes/i.test(html)) {
    cms.detected = true; cms.name = 'WordPress';
    const v = generators.match(/WordPress\s*([\d.]+)/i);
    cms.version = v ? v[1] : 'Unknown';
  } else if (/joomla/i.test(html)) {
    cms.detected = true; cms.name = 'Joomla';
  } else if (/drupal/i.test(html)) {
    cms.detected = true; cms.name = 'Drupal';
  } else if (/shopify/i.test(html)) {
    cms.detected = true; cms.name = 'Shopify';
  } else if (/wix\.com/i.test(html)) {
    cms.detected = true; cms.name = 'Wix';
  } else if (/squarespace/i.test(html)) {
    cms.detected = true; cms.name = 'Squarespace';
  } else if (generators) {
    cms.detected = true; cms.name = generators;
  }

  return cms;
}

/* ─── 8. DNS security ─────────────────────────────────────────── */
async function checkDNS(hostname) {
  const result = {
    dnssecEnabled: false,
    spfRecord: { present: false, value: '', valid: false },
    dkimRecord: { present: false, value: '' },
    dmarcRecord: { present: false, value: '', valid: false },
    mxRecords: [],
    caaRecords: [],
    aaaaRecords: [],
  };

  try {
    const txt = await dns.resolveTxt(hostname).catch(() => []);
    const flat = txt.map(r => r.join('')).join('\n');

    const spf = flat.split('\n').find(l => l.startsWith('v=spf1'));
    if (spf) { result.spfRecord = { present: true, value: spf, valid: spf.includes('-all') || spf.includes('~all') }; }

    const dmarc = await dns.resolveTxt(`_dmarc.${hostname}`).catch(() => []);
    const dmarcVal = dmarc.map(r => r.join('')).find(l => l.startsWith('v=DMARC1'));
    if (dmarcVal) { result.dmarcRecord = { present: true, value: dmarcVal, valid: true }; }

    const mx = await dns.resolveMx(hostname).catch(() => []);
    result.mxRecords = mx.map(r => r.exchange);

    const aaaa = await dns.resolve6(hostname).catch(() => []);
    result.aaaaRecords = aaaa;

    const caa = await dns.resolveCaa(hostname).catch(() => []);
    result.caaRecords = caa.map(r => `${r.critical} ${r.issue || r.issuewild || ''}`);

    result.dnssecEnabled = false; // requires specialized DNSSEC resolver
  } catch (_) {}

  return result;
}

/* ─── 9. Sensitive paths ──────────────────────────────────────── */
async function checkSensitivePaths(baseUrl) {
  const paths = [
    '/.env', '/.git/HEAD', '/wp-admin/', '/admin/', '/phpmyadmin/',
    '/backup/', '/config.php', '/readme.txt', '/README.md',
    '/robots.txt', '/sitemap.xml', '/.htaccess', '/server-status',
    '/wp-login.php', '/xmlrpc.php', '/administrator/',
  ];
  const results = [];
  await Promise.all(paths.map(async p => {
    try {
      const r = await axios.get(`${baseUrl}${p}`, { timeout: 5000, validateStatus: () => true, maxRedirects: 0 });
      results.push({ path: p, accessible: r.status === 200 });
    } catch {
      results.push({ path: p, accessible: false });
    }
  }));
  return results;
}

/* ─── 10. Subresource Integrity ───────────────────────────────── */
function checkSRI($) {
  const scripts = $('script[src]').toArray();
  const links   = $('link[rel="stylesheet"]').toArray();
  const all     = [...scripts, ...links];
  const items   = all.map(el => ({
    src: $(el).attr('src') || $(el).attr('href') || '',
    hasSRI: !!($(el).attr('integrity')),
  }));
  return { checked: true, total: items.length, withSRI: items.filter(i => i.hasSRI).length, withoutSRI: items.filter(i => !i.hasSRI).length, items };
}

/* ─── 11. Safe Browsing ───────────────────────────────────────── */
async function checkSafeBrowsing(targetUrl) {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY || process.env.PAGESPEED_API_KEY;
  if (!apiKey) return { checked: false, safe: true, threats: [], apiUsed: false };
  try {
    const body = {
      client: { clientId: 'WebAuditX', clientVersion: '1.0' },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url: targetUrl }],
      },
    };
    const res = await axios.post(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, body, { timeout: 8000 });
    const matches = res.data?.matches || [];
    return { checked: true, safe: matches.length === 0, threats: matches.map(m => m.threatType), apiUsed: true };
  } catch {
    return { checked: false, safe: true, threats: [], apiUsed: false };
  }
}

/* ─── 12. Rate Limit detection ────────────────────────────────── */
function detectRateLimit(headers) {
  const rlHeaders = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'retry-after', 'x-rate-limit-limit'];
  const found = rlHeaders.filter(h => headers[h]);
  return { detected: found.length > 0, headers: found };
}

/* ─── 13. Clickjacking ────────────────────────────────────────── */
function checkClickjacking(headers) {
  const xfo = (headers['x-frame-options'] || '').toUpperCase();
  const csp = headers['content-security-policy'] || '';
  if (xfo === 'DENY' || xfo === 'SAMEORIGIN') return { protected: true, method: 'X-Frame-Options' };
  if (csp.includes('frame-ancestors')) return { protected: true, method: 'CSP frame-ancestors' };
  return { protected: false, method: 'None' };
}

/* ─── 14. CORS policy ─────────────────────────────────────────── */
function analyzeCORS(headers) {
  const val = headers['access-control-allow-origin'] || '';
  const issues = [];
  if (val === '*') issues.push('Wildcard CORS allows any origin — potential data leak');
  return { present: !!val, value: val, isWildcard: val === '*', issues };
}

/* ─── 15. Information disclosure ─────────────────────────────── */
function checkInfoDisclosure(headers) {
  const server   = headers['server'] || '';
  const powered  = headers['x-powered-by'] || '';
  return {
    serverVersionExposed: /\d/.test(server),
    phpVersionExposed: /php/i.test(powered),
    aspVersionExposed: /asp\.net/i.test(powered),
  };
}

/* ─── 16. Score & grade ───────────────────────────────────────── */
function calculateScore(data) {
  let score = 100;
  const deductions = [];

  // SSL
  if (!data.ssl?.valid)                              { score -= 25; deductions.push('Invalid/missing SSL (-25)'); }
  else if (data.ssl.daysUntilExpiry < 30)            { score -= 10; deductions.push('SSL expiring soon (-10)'); }
  if (!data.ssl?.hostnameMatch)                       { score -= 10; }
  if (!data.ssl?.isTrusted)                           { score -= 10; }

  // HTTPS
  if (!data.https?.enforced)                         { score -= 15; }
  if (data.https?.mixedContent)                      { score -= 8; }

  // Headers
  if (!data.headers?.csp?.present)                   { score -= 8; }
  if (!data.headers?.hsts?.present)                  { score -= 8; }
  if (!data.headers?.xContentTypeOptions?.present)   { score -= 3; }
  if (!data.headers?.xFrameOptions?.present && !data.clickjacking?.protected) { score -= 5; }
  if (!data.headers?.referrerPolicy?.present)        { score -= 2; }
  if (data.headers?.serverHeader?.exposesInfo)       { score -= 3; }
  if (data.headers?.xPoweredBy?.present)             { score -= 3; }

  // Cookies
  const badCookies = (data.cookies || []).filter(c => c.issues?.length > 0);
  score -= Math.min(badCookies.length * 2, 10);

  // Forms
  if ((data.forms?.insecure || 0) > 0)               { score -= 10; }

  // Safe Browsing
  if (!data.safeBrowsing?.safe)                       { score -= 20; }

  // CORS
  if (data.corsPolicy?.isWildcard)                   { score -= 5; }

  // DNS
  if (!data.dnsSecurity?.spfRecord?.present)         { score -= 2; }
  if (!data.dnsSecurity?.dmarcRecord?.present)       { score -= 2; }

  // TLS
  if (data.tlsDetails?.supportsTls10)                { score -= 5; }
  if (data.tlsDetails?.supportsTls11)                { score -= 3; }

  score = Math.max(0, Math.min(100, score));

  let grade = 'F';
  if (score >= 90) grade = 'A+';
  else if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 50) grade = 'D';

  return { score, grade };
}

/* ─── 17. Issue list builder ──────────────────────────────────── */
function buildIssues(data) {
  const issues = [];

  if (!data.ssl?.valid)
    issues.push({ category: 'SSL', severity: 'critical', title: 'Invalid or Missing SSL Certificate', description: `SSL certificate is invalid or missing. Days until expiry: ${data.ssl?.daysUntilExpiry ?? 'N/A'}.`, recommendation: 'Install a valid SSL certificate from a trusted CA such as Let\'s Encrypt.' });
  else if (data.ssl?.daysUntilExpiry < 30)
    issues.push({ category: 'SSL', severity: 'high', title: 'SSL Certificate Expiring Soon', description: `Certificate expires in ${data.ssl.daysUntilExpiry} days.`, recommendation: 'Renew your SSL certificate before expiry.' });

  if (!data.ssl?.hostnameMatch)
    issues.push({ category: 'SSL', severity: 'high', title: 'SSL Hostname Mismatch', description: 'Certificate CN does not match the domain.', recommendation: 'Obtain a certificate that matches your domain name.' });

  if (!data.https?.enforced)
    issues.push({ category: 'HTTPS', severity: 'critical', title: 'HTTPS Not Enforced', description: 'Site is served over HTTP.', recommendation: 'Enable HTTPS and redirect all HTTP traffic to HTTPS.' });

  if (data.https?.mixedContent)
    issues.push({ category: 'HTTPS', severity: 'high', title: 'Mixed Content Detected', description: 'Page loads resources over HTTP on an HTTPS page.', recommendation: 'Update all resource URLs to HTTPS.' });

  if (!data.headers?.csp?.present)
    issues.push({ category: 'Headers', severity: 'high', title: 'Content Security Policy Missing', description: 'No CSP header found.', recommendation: 'Implement a strong Content-Security-Policy header.' });
  else if (data.headers.csp.issues?.length)
    data.headers.csp.issues.forEach(i => issues.push({ category: 'Headers', severity: 'medium', title: 'CSP Misconfiguration', description: i, recommendation: 'Review and tighten your CSP directives.' }));

  if (!data.headers?.hsts?.present)
    issues.push({ category: 'Headers', severity: 'high', title: 'HSTS Header Missing', description: 'Strict-Transport-Security header not set.', recommendation: 'Add HSTS header with max-age of at least 31536000.' });
  else if (data.headers.hsts.maxAge < 31536000)
    issues.push({ category: 'Headers', severity: 'medium', title: 'HSTS max-age Too Short', description: `max-age is ${data.headers.hsts.maxAge}s, should be ≥31536000.`, recommendation: 'Increase HSTS max-age to at least one year.' });

  if (!data.headers?.xContentTypeOptions?.present)
    issues.push({ category: 'Headers', severity: 'medium', title: 'X-Content-Type-Options Missing', description: 'Browsers may MIME-sniff responses.', recommendation: 'Add: X-Content-Type-Options: nosniff' });

  if (!data.clickjacking?.protected)
    issues.push({ category: 'Headers', severity: 'medium', title: 'Clickjacking Protection Missing', description: 'No X-Frame-Options or CSP frame-ancestors.', recommendation: 'Add X-Frame-Options: DENY or CSP frame-ancestors directive.' });

  if (!data.headers?.referrerPolicy?.present)
    issues.push({ category: 'Headers', severity: 'low', title: 'Referrer-Policy Header Missing', description: 'Referrer data may leak to third parties.', recommendation: 'Add Referrer-Policy: strict-origin-when-cross-origin' });

  if (data.headers?.serverHeader?.exposesInfo)
    issues.push({ category: 'Information Disclosure', severity: 'medium', title: 'Server Header Exposes Version', description: `Server: ${data.headers.serverHeader.value}`, recommendation: 'Configure web server to omit version from Server header.' });

  if (data.headers?.xPoweredBy?.present)
    issues.push({ category: 'Information Disclosure', severity: 'medium', title: 'X-Powered-By Header Present', description: `X-Powered-By: ${data.headers.xPoweredBy.value}`, recommendation: 'Remove X-Powered-By header to hide technology stack.' });

  (data.cookies || []).forEach(c => {
    (c.issues || []).forEach(i => issues.push({ category: 'Cookies', severity: 'medium', title: `Cookie Issue: ${c.name}`, description: i, recommendation: `Set ${i.includes('HttpOnly') ? 'HttpOnly' : i.includes('Secure') ? 'Secure' : 'SameSite'} attribute on cookie "${c.name}".` }));
  });

  if ((data.forms?.insecure || 0) > 0)
    issues.push({ category: 'Forms', severity: 'critical', title: 'Insecure Form Submission', description: `${data.forms.insecure} form(s) submit data over HTTP.`, recommendation: 'Ensure all forms submit to HTTPS endpoints.' });

  if (!data.safeBrowsing?.safe)
    issues.push({ category: 'Malware', severity: 'critical', title: 'Malware/Phishing Detected', description: `Threats: ${(data.safeBrowsing?.threats || []).join(', ')}`, recommendation: 'Immediately investigate and clean your site. Contact your host.' });

  if (data.corsPolicy?.isWildcard)
    issues.push({ category: 'CORS', severity: 'high', title: 'Wildcard CORS Policy', description: 'Access-Control-Allow-Origin: * allows any origin.', recommendation: 'Restrict CORS to specific trusted origins.' });

  if (!data.dnsSecurity?.spfRecord?.present)
    issues.push({ category: 'DNS', severity: 'medium', title: 'SPF Record Missing', description: 'No SPF TXT record found.', recommendation: 'Add an SPF record to prevent email spoofing.' });

  if (!data.dnsSecurity?.dmarcRecord?.present)
    issues.push({ category: 'DNS', severity: 'medium', title: 'DMARC Record Missing', description: 'No DMARC policy found.', recommendation: 'Add a DMARC record to enforce email authentication.' });

  if (data.tlsDetails?.supportsTls10)
    issues.push({ category: 'TLS', severity: 'high', title: 'TLS 1.0 Supported', description: 'TLS 1.0 is deprecated and vulnerable.', recommendation: 'Disable TLS 1.0 on your server.' });

  if (data.tlsDetails?.supportsTls11)
    issues.push({ category: 'TLS', severity: 'medium', title: 'TLS 1.1 Supported', description: 'TLS 1.1 is deprecated.', recommendation: 'Disable TLS 1.1; use TLS 1.2+ only.' });

  if ((data.informationDisclosure?.sensitivePaths || []).some(p => p.accessible))
    issues.push({ category: 'Information Disclosure', severity: 'critical', title: 'Sensitive Paths Accessible', description: 'Some sensitive paths returned HTTP 200.', recommendation: 'Block access to sensitive paths via server config or firewall rules.' });

  if (data.subresourceIntegrity?.withoutSRI > 0)
    issues.push({ category: 'SRI', severity: 'low', title: 'Scripts/Styles Missing SRI', description: `${data.subresourceIntegrity.withoutSRI} external resource(s) lack Subresource Integrity hashes.`, recommendation: 'Add integrity and crossorigin attributes to external scripts and stylesheets.' });

  return issues;
}

/* ─── MAIN EXPORT ─────────────────────────────────────────────── */
async function runSecurityAudit(targetUrl) {
  const parsedUrl  = new url.URL(targetUrl);
  const hostname   = parsedUrl.hostname;
  const baseUrl    = `${parsedUrl.protocol}//${parsedUrl.host}`;

  // Parallel fetch
  const [pageRes, sslResult, tlsResult, dnsResult, safeBrowsingResult] = await Promise.all([
    fetchPage(targetUrl),
    checkSSL(hostname),
    checkTLSVersions(hostname),
    checkDNS(hostname),
    checkSafeBrowsing(targetUrl),
  ]);

  const rawHeaders   = pageRes?.headers || {};
  const html         = pageRes?.data || '';
  const $            = cheerio.load(html);

  const httpsResult  = await checkHTTPS(parsedUrl);
  const headers      = analyzeHeaders(rawHeaders);
  const cookies      = analyzeCookies(rawHeaders['set-cookie']);
  const forms        = analyzeForms($, targetUrl);
  const cms          = detectCMS($, rawHeaders, html);
  const sensitivePaths = await checkSensitivePaths(baseUrl);
  const sri          = checkSRI($);
  const clickjacking = checkClickjacking(rawHeaders);
  const corsPolicy   = analyzeCORS(rawHeaders);
  const rateLimit    = detectRateLimit(rawHeaders);
  const infoDisclose = checkInfoDisclosure(rawHeaders);

  const robotsTxtRes = await fetchPage(`${baseUrl}/robots.txt`);
  const sitemapRes   = await fetchPage(`${baseUrl}/sitemap.xml`);

  const informationDisclosure = {
    ...infoDisclose,
    robotsTxtExists: robotsTxtRes?.status === 200,
    sitemapExists: sitemapRes?.status === 200,
    sensitivePaths,
  };

  const data = {
    url: targetUrl,
    ssl: sslResult,
    https: httpsResult,
    headers,
    cookies,
    forms,
    safeBrowsing: safeBrowsingResult,
    cms,
    dnsSecurity: dnsResult,
    subresourceIntegrity: sri,
    clickjacking,
    informationDisclosure,
    corsPolicy,
    rateLimit,
    tlsDetails: tlsResult,
  };

  const { score, grade } = calculateScore(data);
  const issues = buildIssues(data);

  return { ...data, score, grade, issues };
}

module.exports = { runSecurityAudit };