'use strict';
const SecurityModel        = require('../model/security.model');
const { runSecurityAudit } = require('../service/security.service');
const { generateAIResponse } = require('../../../shared/services/ai.service');
const PDFDocument          = require('pdfkit');

/* ── POST /api/security/analyze ─────────────────────────────────── */
exports.analyze = async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

    const auditData = await runSecurityAudit(url);

    const doc = new SecurityModel({ url, ...auditData });
    await doc.save();

    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/security/report/:id ───────────────────────────────── */
exports.getReport = async (req, res, next) => {
  try {
    const doc = await SecurityModel.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
};

/* ── POST /api/security/ai-insight/:id ──────────────────────────── */
exports.generateAI = async (req, res, next) => {
  try {
    const doc = await SecurityModel.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Report not found' });

    const systemPrompt = `You are a senior cybersecurity expert. Write a clear, human-readable security audit report in plain English. 
Do not use jargon. Your audience may be non-technical website owners. Be specific, helpful, and actionable.`;

    const userPrompt = `
Analyze this website security audit and write a full insight report.

Website: ${doc.url}
Security Score: ${doc.score}/100  |  Grade: ${doc.grade}
Analyzed: ${new Date(doc.analyzedAt || doc.createdAt).toUTCString()}

━━━ SSL / TLS ━━━
Certificate Valid:      ${doc.ssl?.valid ? 'Yes' : 'No'}
Trusted Issuer:         ${doc.ssl?.isTrusted ? 'Yes' : 'No'}
Hostname Match:         ${doc.ssl?.hostnameMatch ? 'Yes' : 'No'}
Days Until Expiry:      ${doc.ssl?.daysUntilExpiry ?? 'N/A'}
Protocol:               ${doc.ssl?.protocol || 'N/A'}
TLS 1.0 Supported:      ${doc.tlsDetails?.supportsTls10 ? 'YES (risky)' : 'No'}
TLS 1.1 Supported:      ${doc.tlsDetails?.supportsTls11 ? 'YES (deprecated)' : 'No'}
TLS 1.2 Supported:      ${doc.tlsDetails?.supportsTls12 ? 'Yes' : 'No'}
TLS 1.3 Supported:      ${doc.tlsDetails?.supportsTls13 ? 'Yes' : 'No'}

━━━ HTTPS ━━━
HTTPS Enforced:         ${doc.https?.enforced ? 'Yes' : 'No'}
Redirects HTTP→HTTPS:  ${doc.https?.redirectsToHttps ? 'Yes' : 'No'}
Mixed Content:          ${doc.https?.mixedContent ? 'YES (risky)' : 'None'}

━━━ Security Headers ━━━
Content-Security-Policy:    ${doc.headers?.csp?.present ? 'Present' : 'MISSING'}
HSTS:                       ${doc.headers?.hsts?.present ? `Present (max-age: ${doc.headers.hsts.maxAge}s)` : 'MISSING'}
X-Content-Type-Options:     ${doc.headers?.xContentTypeOptions?.present ? 'Present' : 'MISSING'}
X-Frame-Options:            ${doc.headers?.xFrameOptions?.present ? 'Present' : 'MISSING'}
X-XSS-Protection:           ${doc.headers?.xXssProtection?.present ? 'Present' : 'MISSING'}
Referrer-Policy:            ${doc.headers?.referrerPolicy?.present ? 'Present' : 'MISSING'}
Permissions-Policy:         ${doc.headers?.permissionsPolicy?.present ? 'Present' : 'MISSING'}
Server Header Exposes Info: ${doc.headers?.serverHeader?.exposesInfo ? `YES — ${doc.headers.serverHeader.value}` : 'No'}
X-Powered-By Exposed:       ${doc.headers?.xPoweredBy?.present ? `YES — ${doc.headers.xPoweredBy.value}` : 'No'}

━━━ Cookies (${(doc.cookies || []).length} found) ━━━
${(doc.cookies || []).map(c =>
  `  ${c.name}: HttpOnly=${c.httpOnly ? '✓' : '✗'}  Secure=${c.secure ? '✓' : '✗'}  SameSite=${c.sameSite || 'none'}`
).join('\n') || '  None detected'}

━━━ Forms ━━━
Total Forms:    ${doc.forms?.total ?? 0}
Insecure Forms: ${doc.forms?.insecure ?? 0}

━━━ Safe Browsing ━━━
Result: ${doc.safeBrowsing?.safe ? 'CLEAN' : `THREATS DETECTED: ${(doc.safeBrowsing?.threats || []).join(', ')}`}

━━━ CMS Detection ━━━
${doc.cms?.detected ? `CMS: ${doc.cms.name}  Version: ${doc.cms.version || 'Unknown'}` : 'No CMS detected'}

━━━ DNS Security ━━━
SPF Record:   ${doc.dnsSecurity?.spfRecord?.present ? `Present (${doc.dnsSecurity.spfRecord.valid ? 'valid' : 'invalid'})` : 'MISSING'}
DMARC Record: ${doc.dnsSecurity?.dmarcRecord?.present ? 'Present' : 'MISSING'}
DKIM Record:  ${doc.dnsSecurity?.dkimRecord?.present ? 'Present' : 'Not found'}
CAA Records:  ${(doc.dnsSecurity?.caaRecords || []).length > 0 ? 'Present' : 'MISSING'}

━━━ Other Checks ━━━
Clickjacking Protected: ${doc.clickjacking?.protected ? `Yes (${doc.clickjacking.method})` : 'No'}
CORS Policy:            ${doc.corsPolicy?.present ? (doc.corsPolicy.isWildcard ? 'Wildcard (*) — RISKY' : 'Restricted') : 'Not set'}
Rate Limiting:          ${doc.rateLimit?.detected ? 'Detected' : 'Not detected'}
SRI (scripts/styles):   ${doc.subresourceIntegrity?.withSRI ?? 0} with SRI, ${doc.subresourceIntegrity?.withoutSRI ?? 0} without
Sensitive Paths Exposed: ${(doc.informationDisclosure?.sensitivePaths || []).filter(p => p.accessible).map(p => p.path).join(', ') || 'None'}

━━━ All Issues (${(doc.issues || []).length} total) ━━━
${(doc.issues || []).map(i => `  [${i.severity.toUpperCase()}] ${i.category} — ${i.title}: ${i.description}`).join('\n') || '  No issues found'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write your report using EXACTLY these section headings:

## 🌐 Website Health Summary
Write 3-4 sentences giving an overall picture of this website's security posture in plain English.

## ✅ What Is Working Well
List every positive finding as bullet points. Be specific (e.g. "SSL certificate is valid and trusted with 287 days remaining").

## ⚠️ Security Issues Explained
For each issue found, explain it in simple English a website owner can understand. Group by severity (Critical first).
Format each as:
**[SEVERITY] Issue Title**
What it means: (1-2 sentences in plain English)
Why it matters: (1 sentence on the risk)
How to fix it: (clear step-by-step instructions)

## 🔧 Quick Win Fixes (Do These First)
List the 3-5 most impactful fixes the owner can do quickly, in order of priority.

## 📊 Issue Priority Table
Create a markdown table with these exact columns:
| # | Issue | Category | Severity | Impact | Fix Difficulty | Priority |

List ALL issues from most critical to least. Impact and Fix Difficulty should be: High/Medium/Low. Priority: Immediate/Soon/When Possible.

## 🏆 Final Security Score
**Score: ${doc.score}/100 — Grade: ${doc.grade}**
Write 2 sentences interpreting what this score means for the website owner.
`;

    const { text, provider } = await generateAIResponse(userPrompt, systemPrompt);

    doc.aiReport = {
      generated: true,
      summary: text,
      generatedAt: new Date(),
      provider,
      finalScore: doc.score,
    };
    await doc.save();

    res.json({ success: true, data: doc.aiReport });
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/security/download/:id ─────────────────────────────── */
exports.downloadPDF = async (req, res, next) => {
  try {
    const doc = await SecurityModel.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Report not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="security-report-${doc._id}.pdf"`);

    const pdf = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: true });
    pdf.pipe(res);

    const scoreColor = doc.score >= 80 ? '#22c55e' : doc.score >= 60 ? '#f59e0b' : '#ef4444';
    const SEV_COLORS = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#2563eb', info: '#64748b' };

    const drawLine = () => {
      pdf.moveTo(50, pdf.y).lineTo(545, pdf.y).strokeColor('#1e3a5f').lineWidth(0.5).stroke();
      pdf.moveDown(0.5);
    };

    const sectionTitle = (title) => {
      if (pdf.y > 680) pdf.addPage();
      pdf.moveDown(0.8);
      pdf.rect(50, pdf.y, 495, 24).fill('#0d1a2e');
      pdf.fillColor('#38bdf8').fontSize(10).font('Helvetica-Bold').text(title, 58, pdf.y - 18);
      pdf.moveDown(0.5);
    };

    const kvRow = (k, v, vColor = '#e2e8f0') => {
      pdf.fillColor('#64748b').fontSize(9).font('Helvetica').text(k, 58, pdf.y, { width: 200, continued: true });
      pdf.fillColor(vColor).font('Helvetica-Bold').text(v || '—', { width: 280 });
    };

    /* ── Cover ── */
    pdf.rect(0, 0, 595, 130).fill('#060d1a');
    pdf.fillColor('#38bdf8').fontSize(9).font('Helvetica').text('WEBAUDITX · SECURITY & HTTPS AUDIT', 50, 24, { characterSpacing: 1.5 });
    pdf.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('Security Audit Report', 50, 44);
    pdf.fillColor('#64748b').fontSize(10).font('Helvetica').text(doc.url, 50, 78);
    pdf.fillColor('#334155').fontSize(8).text(`ID: ${doc._id}   ·   ${new Date().toUTCString()}`, 50, 100);
    pdf.moveDown(4);

    /* ── Score block ── */
    const sy = pdf.y;
    pdf.rect(50,  sy, 148, 76).fill('#0d1a2e');
    pdf.rect(208, sy, 88,  76).fill('#0d1a2e');
    pdf.rect(306, sy, 239, 76).fill('#0d1a2e');

    pdf.fillColor(scoreColor).fontSize(40).font('Helvetica-Bold').text(`${doc.score}`, 50,  sy + 6, { width: 148, align: 'center' });
    pdf.fillColor('#64748b').fontSize(8).font('Helvetica').text('/ 100 Score', 50, sy + 54, { width: 148, align: 'center' });

    pdf.fillColor(scoreColor).fontSize(34).font('Helvetica-Bold').text(doc.grade, 208, sy + 14, { width: 88, align: 'center' });
    pdf.fillColor('#64748b').fontSize(8).font('Helvetica').text('Grade', 208, sy + 56, { width: 88, align: 'center' });

    const critC = (doc.issues||[]).filter(i=>i.severity==='critical').length;
    const highC = (doc.issues||[]).filter(i=>i.severity==='high').length;
    const medC  = (doc.issues||[]).filter(i=>i.severity==='medium').length;
    const lowC  = (doc.issues||[]).filter(i=>i.severity==='low').length;
    pdf.fillColor('#dc2626').fontSize(8).font('Helvetica-Bold').text(`${critC} Critical`, 316, sy + 10);
    pdf.fillColor('#ea580c').text(`${highC} High`,     316, sy + 24);
    pdf.fillColor('#d97706').text(`${medC} Medium`,    316, sy + 38);
    pdf.fillColor('#2563eb').text(`${lowC} Low`,       316, sy + 52);

    pdf.moveDown(6); drawLine();

    /* ── SSL ── */
    sectionTitle('SSL CERTIFICATE');
    kvRow('Status',           doc.ssl?.valid ? '✓ Valid' : '✗ Invalid',        doc.ssl?.valid ? '#22c55e' : '#ef4444');
    kvRow('Issuer',           doc.ssl?.issuer || 'N/A');
    kvRow('Expires',          doc.ssl?.validTo || 'N/A');
    kvRow('Days Until Expiry',String(doc.ssl?.daysUntilExpiry ?? 'N/A'),        (doc.ssl?.daysUntilExpiry||0) < 30 ? '#ef4444' : '#22c55e');
    kvRow('Protocol',         doc.ssl?.protocol || 'N/A');
    kvRow('Trusted Issuer',   doc.ssl?.isTrusted  ? '✓ Yes' : '✗ No',          doc.ssl?.isTrusted  ? '#22c55e' : '#ef4444');
    kvRow('Hostname Match',   doc.ssl?.hostnameMatch ? '✓ Yes' : '✗ No',       doc.ssl?.hostnameMatch ? '#22c55e' : '#ef4444');

    /* ── TLS ── */
    sectionTitle('TLS VERSIONS');
    kvRow('TLS 1.3', doc.tlsDetails?.supportsTls13 ? '✓ Supported'           : '— No',                    doc.tlsDetails?.supportsTls13 ? '#22c55e' : '#64748b');
    kvRow('TLS 1.2', doc.tlsDetails?.supportsTls12 ? '✓ Supported'           : '— No',                    doc.tlsDetails?.supportsTls12 ? '#22c55e' : '#64748b');
    kvRow('TLS 1.1', doc.tlsDetails?.supportsTls11 ? '⚠ Enabled (deprecated)': '✓ Disabled',              doc.tlsDetails?.supportsTls11 ? '#ea580c' : '#22c55e');
    kvRow('TLS 1.0', doc.tlsDetails?.supportsTls10 ? '⚠ Enabled (risky)'     : '✓ Disabled',              doc.tlsDetails?.supportsTls10 ? '#dc2626' : '#22c55e');

    /* ── HTTPS ── */
    sectionTitle('HTTPS ENFORCEMENT');
    kvRow('HTTPS Enforced',        doc.https?.enforced           ? '✓ Yes' : '✗ No', doc.https?.enforced           ? '#22c55e' : '#ef4444');
    kvRow('Redirects HTTP→HTTPS',  doc.https?.redirectsToHttps   ? '✓ Yes' : '✗ No', doc.https?.redirectsToHttps   ? '#22c55e' : '#ea580c');
    kvRow('Mixed Content',         doc.https?.mixedContent       ? '⚠ Yes' : '✓ None', !doc.https?.mixedContent    ? '#22c55e' : '#ef4444');

    /* ── Headers ── */
    sectionTitle('SECURITY HEADERS');
    [
      ['Content-Security-Policy',     doc.headers?.csp?.present],
      ['Strict-Transport-Security',   doc.headers?.hsts?.present],
      ['X-Content-Type-Options',      doc.headers?.xContentTypeOptions?.present],
      ['X-Frame-Options',             doc.headers?.xFrameOptions?.present],
      ['X-XSS-Protection',            doc.headers?.xXssProtection?.present],
      ['Referrer-Policy',             doc.headers?.referrerPolicy?.present],
      ['Permissions-Policy',          doc.headers?.permissionsPolicy?.present],
    ].forEach(([n, p]) => kvRow(n, p ? '✓ Present' : '✗ Missing', p ? '#22c55e' : '#ef4444'));

    kvRow('Server Version Exposed', doc.headers?.serverHeader?.exposesInfo ? `⚠ ${doc.headers.serverHeader.value}` : '✓ Hidden', doc.headers?.serverHeader?.exposesInfo ? '#ea580c' : '#22c55e');
    kvRow('X-Powered-By Exposed',   doc.headers?.xPoweredBy?.present       ? `⚠ ${doc.headers.xPoweredBy.value}`   : '✓ Hidden', doc.headers?.xPoweredBy?.present       ? '#ea580c' : '#22c55e');

    /* ── DNS ── */
    sectionTitle('DNS SECURITY');
    kvRow('SPF Record',   doc.dnsSecurity?.spfRecord?.present   ? '✓ Present' : '✗ Missing', doc.dnsSecurity?.spfRecord?.present   ? '#22c55e' : '#ef4444');
    kvRow('DMARC Record', doc.dnsSecurity?.dmarcRecord?.present ? '✓ Present' : '✗ Missing', doc.dnsSecurity?.dmarcRecord?.present ? '#22c55e' : '#ef4444');
    kvRow('DKIM Record',  doc.dnsSecurity?.dkimRecord?.present  ? '✓ Present' : '— Not found', doc.dnsSecurity?.dkimRecord?.present ? '#22c55e' : '#64748b');
    kvRow('CAA Records',  (doc.dnsSecurity?.caaRecords||[]).length > 0 ? '✓ Present' : '✗ Missing', (doc.dnsSecurity?.caaRecords||[]).length > 0 ? '#22c55e' : '#ef4444');

    /* ── Cookies ── */
    sectionTitle(`COOKIES  (${(doc.cookies||[]).length} detected)`);
    if (!(doc.cookies||[]).length) {
      pdf.fillColor('#64748b').fontSize(9).text('No cookies detected.', 58, pdf.y);
    } else {
      doc.cookies.forEach(c => {
        pdf.fillColor('#94a3b8').fontSize(8).font('Helvetica-Bold').text(c.name, 58, pdf.y, { width: 160, continued: true });
        pdf.fillColor(c.httpOnly ? '#22c55e' : '#ef4444').font('Helvetica').text(`HttpOnly:${c.httpOnly?'✓':'✗'}`, { width: 80, continued: true });
        pdf.fillColor(c.secure   ? '#22c55e' : '#ef4444').text(`Secure:${c.secure?'✓':'✗'}`, { width: 70, continued: true });
        const ss = c.sameSite && c.sameSite !== 'none';
        pdf.fillColor(ss ? '#22c55e' : '#ea580c').text(`SameSite:${ss ? c.sameSite : '✗'}`, { width: 120 });
      });
    }

    /* ── Other ── */
    sectionTitle('OTHER SECURITY CHECKS');
    kvRow('Safe Browsing',       doc.safeBrowsing?.safe  ? '✓ Clean'                    : '✗ Threats Detected',  doc.safeBrowsing?.safe  ? '#22c55e' : '#dc2626');
    kvRow('Clickjacking',        doc.clickjacking?.protected ? `✓ ${doc.clickjacking.method}` : '✗ Not Protected', doc.clickjacking?.protected ? '#22c55e' : '#ef4444');
    kvRow('CORS Policy',         doc.corsPolicy?.isWildcard  ? '⚠ Wildcard (*)' : (doc.corsPolicy?.present ? '✓ Restricted' : '— Not set'), !doc.corsPolicy?.isWildcard ? '#22c55e' : '#ea580c');
    kvRow('Rate Limiting',       doc.rateLimit?.detected ? '✓ Detected' : '— Not detected', doc.rateLimit?.detected ? '#22c55e' : '#64748b');
    kvRow('Insecure Forms',      String(doc.forms?.insecure ?? 0), (doc.forms?.insecure??0) === 0 ? '#22c55e' : '#ef4444');
    kvRow('CMS Detected',        doc.cms?.detected ? `${doc.cms.name} ${doc.cms.version||''}` : 'None');
    kvRow('SRI Missing',         String(doc.subresourceIntegrity?.withoutSRI ?? 0) + ' resources', (doc.subresourceIntegrity?.withoutSRI??0) === 0 ? '#22c55e' : '#ea580c');
    kvRow('robots.txt',          doc.informationDisclosure?.robotsTxtExists ? '✓ Present' : '— Missing', doc.informationDisclosure?.robotsTxtExists ? '#22c55e' : '#64748b');
    kvRow('sitemap.xml',         doc.informationDisclosure?.sitemapExists   ? '✓ Present' : '— Missing', doc.informationDisclosure?.sitemapExists   ? '#22c55e' : '#64748b');
    const exposedPaths = (doc.informationDisclosure?.sensitivePaths||[]).filter(p=>p.accessible);
    kvRow('Sensitive Paths',     exposedPaths.length ? `⚠ ${exposedPaths.map(p=>p.path).join(', ')}` : '✓ None exposed', exposedPaths.length ? '#dc2626' : '#22c55e');

    /* ── Issues list ── */
    pdf.addPage();
    sectionTitle(`ALL SECURITY ISSUES  (${(doc.issues||[]).length})`);

    if (!(doc.issues||[]).length) {
      pdf.fillColor('#22c55e').fontSize(12).font('Helvetica-Bold').text('No issues found — excellent!', 58, pdf.y);
    } else {
      const sorted = [...(doc.issues||[])].sort((a,b) =>
        ['critical','high','medium','low','info'].indexOf(a.severity) - ['critical','high','medium','low','info'].indexOf(b.severity)
      );
      sorted.forEach((issue, i) => {
        if (pdf.y > 680) pdf.addPage();
        const col = SEV_COLORS[issue.severity] || '#64748b';
        pdf.rect(50, pdf.y, 4, 42).fill(col);
        pdf.fillColor(col).fontSize(8).font('Helvetica-Bold')
          .text(`#${i+1}  [${issue.severity.toUpperCase()}]  ${issue.category}`, 60, pdf.y, { width: 480 });
        pdf.fillColor('#e2e8f0').fontSize(9).font('Helvetica-Bold').text(issue.title, 60, pdf.y, { width: 480 });
        pdf.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(issue.description, 60, pdf.y, { width: 480 });
        pdf.fillColor('#7dd3fc').text(`Fix: ${issue.recommendation}`, 60, pdf.y, { width: 480 });
        pdf.moveDown(0.7);
      });
    }

    /* ── AI Report page ── */
    if (doc.aiReport?.generated && doc.aiReport?.summary) {
      pdf.addPage();
      pdf.rect(0, 0, 595, 55).fill('#060d1a');
      pdf.fillColor('#38bdf8').fontSize(13).font('Helvetica-Bold').text('AI Security Insight', 50, 18);
      pdf.fillColor('#64748b').fontSize(8).font('Helvetica')
        .text(`Provider: ${doc.aiReport.provider}  ·  ${new Date(doc.aiReport.generatedAt).toUTCString()}`, 50, 38);
      pdf.moveDown(3.5);
      pdf.fillColor('#e2e8f0').fontSize(9).font('Helvetica')
        .text(
          doc.aiReport.summary.replace(/#{1,3}\s?/g, '').replace(/\*\*/g, '').replace(/━+/g, '───'),
          50, pdf.y, { width: 495, align: 'left', lineGap: 2 }
        );
    }

    pdf.end();
  } catch (err) {
    next(err);
  }
};