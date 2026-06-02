'use strict';
const PDFDocument = require('pdfkit');
const { analyzeWebsite, getReportById, getRecentReports } = require('../service/uiAnalysis.service');

function isValidUrl(s) {
  try { return !!new URL(s.startsWith('http') ? s : `https://${s}`).hostname; } catch { return false; }
}

/* ── Controllers ── */
exports.analyze = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url)             return res.status(400).json({ success: false, message: 'URL is required.' });
    if (!isValidUrl(url)) return res.status(400).json({ success: false, message: 'Invalid URL provided.' });
    const report = await analyzeWebsite(url);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    console.error('[UICtrl] analyze:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getReport = async (req, res) => {
  try {
    const report = await getReportById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRecentReports = async (req, res) => {
  try {
    const reports = await getRecentReports(parseInt(req.query.limit) || 10);
    return res.status(200).json({ success: true, data: reports });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadPDF = async (req, res) => {
  try {
    const report = await getReportById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    if (report.status !== 'completed') return res.status(400).json({ success: false, message: 'Report not ready.' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="webauditx-ui-${report._id}.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    doc.pipe(res);
    buildPDF(doc, report);
    doc.end();
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   PDF BUILDER
═══════════════════════════════════════════════════════════ */
function buildPDF(doc, r) {
  const ROSE  = '#e11d48';
  const DARK  = '#0f172a';
  const GRAY  = '#64748b';
  const LT    = '#f8fafc';
  const W     = doc.page.width;
  const M     = 50;
  const CW    = W - M * 2;

  /* ── Cover ── */
  doc.rect(0, 0, W, 110).fill(DARK);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(26).text('WebAuditX', M, 25);
  doc.fillColor(ROSE).font('Helvetica').fontSize(12).text('Advanced UI/UX Deep Analysis Report', M, 55);
  doc.fillColor('#94a3b8').fontSize(9)
    .text(`${r.url}   ·   ${new Date(r.createdAt || Date.now()).toLocaleDateString('en-US', { dateStyle: 'long' })}`, M, 78);
  doc.fillColor('#fff').fontSize(9).text(`Page: ${r.pageTitle || 'N/A'}`, M, 92);

  doc.moveDown(3.5);

  /* ── Composite Score Banner ── */
  const scores = r.scores || {};
  const scoreRow = [
    { label: 'OVERALL', val: scores.overall }, { label: 'DESIGN', val: scores.design },
    { label: 'USABILITY', val: scores.usability }, { label: 'CONTENT', val: scores.content },
    { label: 'TECHNICAL', val: scores.technical }, { label: 'ACCESSIBILITY', val: scores.accessibility },
    { label: 'BRANDING', val: scores.branding },
  ];
  const colW = CW / scoreRow.length;
  const bannerY = doc.y;
  doc.rect(M, bannerY, CW, 52).fill('#f1f5f9');
  scoreRow.forEach((s, i) => {
    const x = M + i * colW + colW / 2;
    const color = (s.val || 0) >= 70 ? '#22c55e' : (s.val || 0) >= 45 ? '#f59e0b' : '#ef4444';
    doc.fillColor(color).font('Helvetica-Bold').fontSize(16).text(String(s.val ?? '-'), x - 20, bannerY + 6, { width: 40, align: 'center' });
    doc.fillColor(GRAY).font('Helvetica').fontSize(6.5).text(s.label, x - 22, bannerY + 30, { width: 44, align: 'center' });
  });
  doc.y = bannerY + 62;

  /* ── AI Summary ── */
  if (r.aiInsights?.summary) {
    sectionHeader(doc, 'AI EXPERT SUMMARY', M, CW, ROSE);
    doc.fillColor(GRAY).font('Helvetica').fontSize(9.5)
      .text(r.aiInsights.summary, M, doc.y, { width: CW });
    doc.moveDown(0.5);

    if (r.aiInsights.strengths?.length) {
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text('Strengths:', M);
      r.aiInsights.strengths.forEach(s => {
        doc.fillColor('#22c55e').font('Helvetica').fontSize(9).text(`✓  ${s}`, M + 10, doc.y, { width: CW - 10 });
        doc.moveDown(0.2);
      });
    }
    doc.moveDown(0.4);
  }

  /* ── Issue summary ── */
  const critical = (r.issues || []).filter(i => i.severity === 'critical').length;
  const medium   = (r.issues || []).filter(i => i.severity === 'medium').length;
  const low      = (r.issues || []).filter(i => i.severity === 'low').length;
  sectionHeader(doc, `ISSUES SUMMARY — ${(r.issues || []).length} TOTAL`, M, CW, ROSE);
  doc.fillColor('#ef4444').font('Helvetica-Bold').fontSize(10).text(`🔴 ${critical} Critical`, M, doc.y, { continued: true, width: 130 });
  doc.fillColor('#f59e0b').text(`  🟡 ${medium} Medium`, { continued: true, width: 130 });
  doc.fillColor('#3b82f6').text(`  🔵 ${low} Low`);
  doc.moveDown(0.8);

  /* ── Logo Analysis ── */
  if (r.logo) {
    sectionHeader(doc, 'LOGO ANALYSIS', M, CW, ROSE);
    metricRow(doc, 'Logo Detected',      r.logo.detected ? '✓ Yes' : '✗ No', M, CW, r.logo.detected);
    metricRow(doc, 'Placement',          r.logo.placement || 'N/A', M, CW, r.logo.placement !== 'none');
    metricRow(doc, 'Links to Homepage',  r.logo.isLinkedToHome ? '✓ Yes' : '✗ No', M, CW, r.logo.isLinkedToHome);
    metricRow(doc, 'Logo Type',          r.logo.isSVG ? 'SVG (optimal)' : r.logo.isImage ? 'Image' : 'Unknown', M, CW, true);
    metricRow(doc, 'Alt Text',           r.logo.hasAltText ? `"${r.logo.altText?.slice(0,60)}"` : '✗ Missing', M, CW, r.logo.hasAltText);
    scoreBar(doc, 'Logo Score', r.logo.score ?? 0, M, CW);
    doc.moveDown(0.5);
  }

  /* ── Typography ── */
  if (r.typography) {
    pageBreakIfNeeded(doc);
    sectionHeader(doc, 'TYPOGRAPHY & HEADING ANALYSIS', M, CW, ROSE);
    metricRow(doc, 'Font Families', r.typography.fontFamilies?.slice(0,4).join(', ') || 'System default', M, CW, r.typography.fontFamilyCount <= 3);
    metricRow(doc, 'Font Family Count', String(r.typography.fontFamilyCount ?? 0), M, CW, r.typography.fontFamilyCount <= 3 && r.typography.fontFamilyCount >= 1);
    metricRow(doc, 'Google Fonts', r.typography.googleFontsDetected ? '✓ Detected' : '✗ Not detected', M, CW, r.typography.googleFontsDetected);
    metricRow(doc, 'Font Weights Used', r.typography.fontWeightsUsed?.join(', ') || 'N/A', M, CW, (r.typography.fontWeightsUsed?.length ?? 0) >= 2);
    metricRow(doc, 'Line Height Defined', r.typography.lineHeightValues?.length > 0 ? r.typography.lineHeightValues.slice(0,3).join(', ') : '✗ Not set', M, CW, (r.typography.lineHeightValues?.length ?? 0) > 0);
    metricRow(doc, 'Letter Spacing', r.typography.letterSpacingUsed ? '✓ Used' : 'Not used', M, CW, r.typography.letterSpacingUsed);

    const h = r.typography.headings;
    if (h) {
      doc.moveDown(0.3);
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text('Heading Structure:', M);
      doc.moveDown(0.2);
      ['h1','h2','h3','h4','h5','h6'].forEach(tag => {
        const lv = h[tag];
        if (!lv) return;
        doc.fillColor(GRAY).font('Helvetica').fontSize(8.5)
          .text(`${tag.toUpperCase()}: ${lv.count} found`, M + 10, doc.y, { continued: true, width: 110 });
        const preview = lv.texts?.[0] ? ` — "${lv.texts[0].slice(0, 55)}${lv.texts[0].length > 55 ? '…' : ''}"` : '';
        doc.text(preview, { width: CW - 120 });
        doc.moveDown(0.15);
      });
      metricRow(doc, 'H1→H2 Ratio', h.h1ToH2Ratio || 'N/A', M, CW, true);
      metricRow(doc, 'H2→H3 Ratio', h.h2ToH3Ratio || 'N/A', M, CW, true);
      metricRow(doc, 'Hierarchy Valid', h.hierarchyValid ? '✓ Yes' : `✗ Issues: ${h.skippedLevels?.join('; ')}`, M, CW, h.hierarchyValid);
    }
    scoreBar(doc, 'Typography Score', r.typography.score ?? 0, M, CW);
    doc.moveDown(0.5);
  }

  /* ── Color System ── */
  if (r.colors) {
    pageBreakIfNeeded(doc);
    sectionHeader(doc, 'COLOR SYSTEM', M, CW, ROSE);
    metricRow(doc, 'Unique Colors', String(r.colors.uniqueColorCount), M, CW, r.colors.uniqueColorCount <= 15);
    metricRow(doc, 'CSS Variables', r.colors.cssVariablesUsed ? '✓ Used' : '✗ Not used', M, CW, r.colors.cssVariablesUsed);
    metricRow(doc, 'Gradients', r.colors.gradientUsage ? '✓ Used' : 'Not detected', M, CW, true);
    metricRow(doc, 'Dark Mode Support', r.colors.darkModeSupport ? '✓ Supported' : 'Not implemented', M, CW, r.colors.darkModeSupport);
    if (r.colors.rawColors?.length) {
      doc.fillColor(GRAY).font('Helvetica').fontSize(8)
        .text(`Sample palette: ${r.colors.rawColors.slice(0, 12).join('  ')}`, M, doc.y, { width: CW });
      doc.moveDown(0.3);
    }
    scoreBar(doc, 'Color Score', r.colors.score ?? 0, M, CW);
    doc.moveDown(0.5);
  }

  /* ── Images ── */
  if (r.images) {
    pageBreakIfNeeded(doc);
    sectionHeader(doc, 'IMAGE ANALYSIS', M, CW, ROSE);
    metricRow(doc, 'Total Images', String(r.images.totalImages), M, CW, true);
    metricRow(doc, 'Alt Text Coverage', `${r.images.altTextRatioPct}% (${r.images.withAlt}/${r.images.totalImages})`, M, CW, r.images.altTextRatioPct >= 80);
    metricRow(doc, 'Lazy Loading', `${r.images.lazyLoadRatioPct}% (${r.images.lazyLoadedCount} images)`, M, CW, r.images.lazyLoadRatioPct >= 60);
    metricRow(doc, 'Responsive Images (srcset)', String(r.images.withSrcset), M, CW, r.images.withSrcset > 0);
    metricRow(doc, 'WebP Format', `${r.images.webpCount} images`, M, CW, r.images.webpCount > 0);
    metricRow(doc, 'SVG Images', String(r.images.svgCount), M, CW, true);
    metricRow(doc, 'Hero Image Present', r.images.heroImagePresent ? '✓ Yes' : '✗ No', M, CW, r.images.heroImagePresent);
    metricRow(doc, '<picture> Tag Used', r.images.hasPictureTag ? '✓ Yes' : '✗ No', M, CW, r.images.hasPictureTag);
    const pb = r.images.placementBreakdown;
    if (pb) {
      doc.fillColor(GRAY).font('Helvetica').fontSize(8)
        .text(`Placement breakdown — Hero: ${pb.hero} | Card: ${pb.card} | Inline: ${pb.inline} | Icon: ${pb.icon} | Background: ${pb.background}`, M, doc.y, { width: CW });
      doc.moveDown(0.3);
    }
    scoreBar(doc, 'Image Score', r.images.score ?? 0, M, CW);
    doc.moveDown(0.5);
  }

  /* ── Responsiveness ── */
  if (r.responsiveness) {
    pageBreakIfNeeded(doc);
    sectionHeader(doc, 'RESPONSIVENESS', M, CW, ROSE);
    metricRow(doc, 'Viewport Meta', r.responsiveness.hasViewportMeta ? '✓ Present' : '✗ Missing', M, CW, r.responsiveness.hasViewportMeta);
    metricRow(doc, 'Media Queries', `${r.responsiveness.mediaQueryCount} found`, M, CW, r.responsiveness.mediaQueryCount >= 3);
    metricRow(doc, 'Breakpoints', r.responsiveness.breakpoints?.join(', ') || 'None detected', M, CW, (r.responsiveness.breakpoints?.length ?? 0) > 0);
    metricRow(doc, 'Fluid Images', r.responsiveness.hasFluidImages ? '✓ Yes' : '✗ No', M, CW, r.responsiveness.hasFluidImages);
    metricRow(doc, 'Hamburger Menu', r.responsiveness.hasHamburgerMenu ? '✓ Detected' : '✗ Not found', M, CW, r.responsiveness.hasHamburgerMenu);
    metricRow(doc, 'Framework', r.responsiveness.frameworkDetected || 'None detected', M, CW, !!r.responsiveness.frameworkDetected);
    metricRow(doc, 'Fluid Typography', r.responsiveness.hasFluidTypography ? '✓ clamp()/vw used' : '✗ Not used', M, CW, r.responsiveness.hasFluidTypography);
    scoreBar(doc, 'Responsiveness Score', r.responsiveness.score ?? 0, M, CW);
    doc.moveDown(0.5);
  }

  /* ── Navigation ── */
  if (r.navigation) {
    pageBreakIfNeeded(doc);
    sectionHeader(doc, 'NAVIGATION ANALYSIS', M, CW, ROSE);
    metricRow(doc, 'Primary Nav Present', r.navigation.primaryNavPresent ? '✓ Yes' : '✗ No', M, CW, r.navigation.primaryNavPresent);
    metricRow(doc, 'Nav Items', String(r.navigation.primaryNavItems), M, CW, r.navigation.primaryNavItems >= 3 && r.navigation.primaryNavItems <= 8);
    metricRow(doc, 'Mobile Menu', r.navigation.hasMobileMenu ? '✓ Detected' : '✗ Missing', M, CW, r.navigation.hasMobileMenu);
    metricRow(doc, 'Dropdown/Submenu', r.navigation.hasDropdown ? '✓ Yes' : 'No', M, CW, true);
    metricRow(doc, 'Skip Navigation Link', r.navigation.hasSkipLink ? '✓ Present' : '✗ Missing', M, CW, r.navigation.hasSkipLink);
    metricRow(doc, 'Breadcrumbs', r.navigation.hasBreadcrumb ? '✓ Present' : 'Not found', M, CW, true);
    metricRow(doc, 'Search', r.navigation.hasSearch ? '✓ Present' : 'Not found', M, CW, true);
    metricRow(doc, 'Social Links', String(r.navigation.socialLinks), M, CW, r.navigation.socialLinks > 0);
    metricRow(doc, 'Footer Navigation', r.navigation.footerNavPresent ? `✓ ${r.navigation.footerNavItems} links` : '✗ Missing', M, CW, r.navigation.footerNavPresent);
    if (r.navigation.primaryNavLinks?.length) {
      doc.fillColor(GRAY).font('Helvetica').fontSize(8)
        .text(`Nav items: ${r.navigation.primaryNavLinks.slice(0,8).join('  ·  ')}`, M, doc.y, { width: CW });
      doc.moveDown(0.3);
    }
    scoreBar(doc, 'Navigation Score', r.navigation.score ?? 0, M, CW);
    doc.moveDown(0.5);
  }

  /* ── CTA ── */
  if (r.cta) {
    pageBreakIfNeeded(doc);
    sectionHeader(doc, 'CALL-TO-ACTION ANALYSIS', M, CW, ROSE);
    metricRow(doc, 'Total Buttons', String(r.cta.totalButtons), M, CW, r.cta.totalButtons >= 2);
    metricRow(doc, 'CTA in Hero', r.cta.ctaInHero ? '✓ Yes' : '✗ No', M, CW, r.cta.ctaInHero);
    metricRow(doc, 'Primary CTA Text', r.cta.primaryCTAText || 'None found', M, CW, !!r.cta.primaryCTAText);
    metricRow(doc, 'Strong CTAs', String(r.cta.strongCTACount), M, CW, r.cta.strongCTACount > 0);
    metricRow(doc, 'Weak CTAs', String(r.cta.weakCTACount), M, CW, r.cta.weakCTACount === 0);
    metricRow(doc, 'Floating CTA', r.cta.hasFloatingCTA ? '✓ Detected' : 'None', M, CW, true);
    if (r.cta.ctaTexts?.length) {
      doc.fillColor(GRAY).font('Helvetica').fontSize(8)
        .text(`Button labels: ${r.cta.ctaTexts.slice(0,8).join('  |  ')}`, M, doc.y, { width: CW });
      doc.moveDown(0.3);
    }
    scoreBar(doc, 'CTA Score', r.cta.score ?? 0, M, CW);
    doc.moveDown(0.5);
  }

  /* ── Header/Footer ── */
  if (r.headerFooter) {
    pageBreakIfNeeded(doc);
    sectionHeader(doc, 'HEADER & FOOTER', M, CW, ROSE);
    const hdr = r.headerFooter.header;
    const ftr = r.headerFooter.footer;
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text('Header:', M);
    if (hdr) {
      metricRow(doc, 'Present', hdr.present ? '✓' : '✗', M + 10, CW - 10, hdr.present);
      metricRow(doc, 'Has Logo', hdr.hasLogo ? '✓' : '✗', M + 10, CW - 10, hdr.hasLogo);
      metricRow(doc, 'Has Navigation', hdr.hasNav ? '✓' : '✗', M + 10, CW - 10, hdr.hasNav);
      metricRow(doc, 'Has CTA Button', hdr.hasCTA ? '✓' : '✗', M + 10, CW - 10, hdr.hasCTA);
      metricRow(doc, 'Is Sticky', hdr.isSticky ? '✓' : 'No', M + 10, CW - 10, true);
    }
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text('Footer:', M);
    if (ftr) {
      metricRow(doc, 'Present', ftr.present ? '✓' : '✗', M + 10, CW - 10, ftr.present);
      metricRow(doc, 'Has Logo', ftr.hasLogo ? '✓' : '✗', M + 10, CW - 10, ftr.hasLogo);
      metricRow(doc, 'Has Copyright', ftr.hasCopyright ? '✓' : '✗', M + 10, CW - 10, ftr.hasCopyright);
      metricRow(doc, 'Privacy Link', ftr.hasPrivacyLink ? '✓' : '✗ Missing', M + 10, CW - 10, ftr.hasPrivacyLink);
      metricRow(doc, 'Terms Link', ftr.hasTermsLink ? '✓' : '✗', M + 10, CW - 10, ftr.hasTermsLink);
      metricRow(doc, 'Social Links', ftr.hasSocialLinks ? '✓' : '✗', M + 10, CW - 10, ftr.hasSocialLinks);
      metricRow(doc, 'Contact Info', ftr.hasContactInfo ? '✓' : '✗', M + 10, CW - 10, ftr.hasContactInfo);
      metricRow(doc, 'Newsletter Signup', ftr.hasNewsletter ? '✓' : 'No', M + 10, CW - 10, true);
      metricRow(doc, 'Footer Link Count', String(ftr.linkCount), M + 10, CW - 10, ftr.linkCount >= 5);
    }
    scoreBar(doc, 'Header/Footer Score', r.headerFooter.score ?? 0, M, CW);
    doc.moveDown(0.5);
  }

  /* ── Content Structure ── */
  if (r.content) {
    pageBreakIfNeeded(doc);
    sectionHeader(doc, 'CONTENT STRUCTURE', M, CW, ROSE);
    const c = r.content;
    const sections = [
      ['Hero Section', c.hasHeroSection], ['Hero Has Heading', c.heroHasHeading],
      ['Hero Has CTA', c.heroHasCTA], ['Hero Has Image', c.heroHasImage],
      ['About Section', c.hasAboutSection], ['Services Section', c.hasServicesSection],
      ['Pricing Section', c.hasPricingSection], ['Testimonials', c.hasTestimonialsSection],
      ['FAQ Section', c.hasFAQSection], ['Contact Section', c.hasContactSection],
      ['Blog Section', c.hasBlogSection], ['Team Section', c.hasTeamSection],
    ];
    sections.forEach(([label, val]) => metricRow(doc, label, val ? '✓ Yes' : '✗ No', M, CW, !!val));

    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text('Social Proof & Trust:', M);
    const sp = c.socialProof;
    const ts = c.trustSignals;
    [
      ['Testimonials', sp?.hasTestimonials], ['Customer Reviews', sp?.hasReviews],
      ['Star Ratings', sp?.hasRatings], ['Client Logos', sp?.hasClientLogos],
      ['Counter Stats', sp?.hasCounterStats], ['Guarantee Badge', ts?.hasGuaranteeBadge],
      ['Certifications', ts?.hasCertifications], ['Trust Badges', ts?.hasTrustBadges],
      ['Media Mentions', ts?.hasMediaMentions],
    ].forEach(([l, v]) => metricRow(doc, l, v ? '✓' : '✗', M + 10, CW - 10, !!v));

    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text('Contact Information:', M);
    const ci = c.contactInfo;
    [
      ['Phone Number', ci?.hasPhone], ['Email Address', ci?.hasEmail],
      ['Physical Address', ci?.hasAddress], ['Contact Form', ci?.hasContactForm],
      ['Live Chat', ci?.hasLiveChat],
    ].forEach(([l, v]) => metricRow(doc, l, v ? '✓' : '✗', M + 10, CW - 10, !!v));
    scoreBar(doc, 'Content Score', c.score ?? 0, M, CW);
    doc.moveDown(0.5);
  }

  /* ── Technical ── */
  if (r.technical) {
    pageBreakIfNeeded(doc);
    sectionHeader(doc, 'TECHNICAL & SEO', M, CW, ROSE);
    const t = r.technical;
    metricRow(doc, 'Page Title', t.meta?.titleText ? `"${t.meta.titleText.slice(0,55)}${t.meta.titleLength > 60 ? ' ⚠' : ''}"` : '✗ Missing', M, CW, t.meta?.hasTitle);
    metricRow(doc, 'Meta Description', t.meta?.descriptionText ? `${t.meta.descriptionLength} chars${t.meta.descriptionLength > 160 ? ' ⚠ Too long' : ''}` : '✗ Missing', M, CW, t.meta?.hasDescription);
    metricRow(doc, 'Canonical URL', t.meta?.hasCanonical ? '✓' : '✗', M, CW, t.meta?.hasCanonical);
    metricRow(doc, 'Open Graph (OG)', `${t.openGraph?.completenessScore ?? 0}% complete`, M, CW, (t.openGraph?.completenessScore ?? 0) >= 60);
    metricRow(doc, 'OG Image', t.openGraph?.hasOgImage ? '✓' : '✗ Missing', M, CW, t.openGraph?.hasOgImage);
    metricRow(doc, 'Twitter Card', t.twitterCard?.hasTwitterCard ? `✓ ${t.twitterCard.cardType}` : '✗', M, CW, t.twitterCard?.hasTwitterCard);
    metricRow(doc, 'JSON-LD Schema', t.schema?.hasJsonLd ? `✓ (${t.schema.schemaTypes?.join(', ') || 'present'})` : '✗ Missing', M, CW, t.schema?.hasJsonLd);
    metricRow(doc, 'Favicon', t.performance?.hasFavicon ? '✓' : '✗ Missing', M, CW, t.performance?.hasFavicon);
    metricRow(doc, 'Deferred/Async Scripts', `${(t.performance?.deferredScripts ?? 0) + (t.performance?.asyncScripts ?? 0)} of ${t.performance?.externalScriptCount ?? 0}`, M, CW, (t.performance?.deferredScripts ?? 0) > 0);
    metricRow(doc, 'External CSS Files', String(t.performance?.externalCSSCount ?? 0), M, CW, (t.performance?.externalCSSCount ?? 0) <= 3);

    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text('Accessibility Signals:', M);
    const a = t.accessibility;
    metricRow(doc, 'HTML lang attribute', a?.hasLangAttribute ? `✓ lang="${a.langValue}"` : '✗ Missing', M + 10, CW - 10, a?.hasLangAttribute);
    metricRow(doc, 'ARIA Labels', String(a?.ariaLabels ?? 0), M + 10, CW - 10, (a?.ariaLabels ?? 0) >= 3);
    metricRow(doc, 'ARIA Roles', String(a?.ariaRoles ?? 0), M + 10, CW - 10, (a?.ariaRoles ?? 0) >= 2);
    metricRow(doc, 'Inputs Without Labels', String(a?.inputsWithoutLabel ?? 0), M + 10, CW - 10, (a?.inputsWithoutLabel ?? 0) === 0);
    metricRow(doc, 'Focus Styles', a?.hasFocusStyles ? '✓ :focus styles found' : '✗ Not detected', M + 10, CW - 10, a?.hasFocusStyles);
    scoreBar(doc, 'Technical Score', t.score ?? 0, M, CW);
    doc.moveDown(0.5);
  }

  /* ── All Issues ── */
  if (r.issues?.length) {
    pageBreakIfNeeded(doc);
    sectionHeader(doc, `ALL DETECTED ISSUES (${r.issues.length})`, M, CW, ROSE);
    ['critical','medium','low'].forEach(sev => {
      const filtered = (r.issues || []).filter(i => i.severity === sev);
      if (!filtered.length) return;
      const sevColor = sev === 'critical' ? '#ef4444' : sev === 'medium' ? '#f59e0b' : '#3b82f6';
      doc.fillColor(sevColor).font('Helvetica-Bold').fontSize(9.5)
        .text(`${sev.toUpperCase()} (${filtered.length})`, M, doc.y);
      doc.moveDown(0.2);
      filtered.forEach(issue => {
        pageBreakIfNeeded(doc, 80);
        doc.fillColor(DARK).font('Helvetica-Bold').fontSize(8.5)
          .text(`▸  ${issue.title}`, M + 8, doc.y);
        doc.fillColor(GRAY).font('Helvetica').fontSize(8)
          .text(issue.description, M + 16, doc.y, { width: CW - 16 });
        if (issue.recommendation) {
          doc.fillColor('#0ea5e9').font('Helvetica-Oblique').fontSize(7.5)
            .text(`Fix: ${issue.recommendation}`, M + 16, doc.y, { width: CW - 16 });
        }
        if (issue.wcagReference) {
          doc.fillColor('#94a3b8').font('Helvetica').fontSize(7)
            .text(issue.wcagReference, M + 16, doc.y);
        }
        doc.moveDown(0.45);
      });
      doc.moveDown(0.3);
    });
  }

  /* ── AI Fixes ── */
  if (r.aiInsights?.fixes?.length) {
    pageBreakIfNeeded(doc);
    sectionHeader(doc, 'AI-RECOMMENDED FIXES', M, CW, ROSE);
    r.aiInsights.fixes.forEach((fix, idx) => {
      pageBreakIfNeeded(doc, 70);
      const pColor = fix.priority === 'high' ? '#ef4444' : fix.priority === 'medium' ? '#f59e0b' : '#3b82f6';
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9)
        .text(`${idx + 1}. ${fix.title}`, M, doc.y, { continued: true });
      doc.fillColor(pColor).font('Helvetica').fontSize(8)
        .text(`  [${fix.priority?.toUpperCase()} priority · ${fix.effort?.toUpperCase()} effort]`);
      doc.fillColor(GRAY).font('Helvetica').fontSize(8.5)
        .text(fix.description, M + 10, doc.y, { width: CW - 10 });
      if (fix.impact) {
        doc.fillColor('#22c55e').font('Helvetica-Oblique').fontSize(7.5)
          .text(`Impact: ${fix.impact}`, M + 10, doc.y, { width: CW - 10 });
      }
      doc.moveDown(0.5);
    });
  }

  /* ── Priority Plan ── */
  if (r.aiInsights?.priority?.length) {
    pageBreakIfNeeded(doc);
    sectionHeader(doc, 'PRIORITY ACTION PLAN', M, CW, ROSE);
    r.aiInsights.priority.forEach((p, i) => {
      pageBreakIfNeeded(doc, 60);
      doc.fillColor(ROSE).font('Helvetica-Bold').fontSize(9.5).text(`${i + 1}. ${p.item}`, M);
      doc.fillColor(DARK).font('Helvetica').fontSize(8.5).text(`Why: ${p.reason}`, M + 10, doc.y, { width: CW - 10 });
      doc.fillColor(GRAY).font('Helvetica').fontSize(8.5).text(`Impact: ${p.impact}`, M + 10, doc.y, { width: CW - 10 });
      doc.moveDown(0.5);
    });
  }

  /* ── Footer on every page ── */
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.rect(M, doc.page.height - 28, CW, 1).fill('#e2e8f0');
    doc.fillColor('#94a3b8').fontSize(7)
      .text(`WebAuditX Advanced UI/UX Report  ·  ${r.url}  ·  Page ${i + 1} of ${range.count}`,
        M, doc.page.height - 22, { align: 'center', width: CW });
  }
}

/* ── PDF helpers ── */
function sectionHeader(doc, title, M, CW, ROSE) {
  if (doc.y > 700) doc.addPage();
  doc.rect(M, doc.y, CW, 20).fill('#0f172a');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
    .text(title, M + 8, doc.y - 16);
  doc.moveDown(0.6);
}

function metricRow(doc, label, value, M, CW, isPositive) {
  if (doc.y > 720) doc.addPage();
  const color = typeof isPositive === 'boolean' ? (isPositive ? '#1e293b' : '#ef4444') : '#1e293b';
  doc.fillColor('#64748b').font('Helvetica').fontSize(8.5)
    .text(label, M, doc.y, { continued: true, width: 180 });
  doc.fillColor(color).font('Helvetica-Bold').fontSize(8.5)
    .text(String(value), M + 185, doc.y - 9, { width: CW - 185 });
  doc.moveDown(0.45);
}

function scoreBar(doc, label, score, M, CW) {
  if (doc.y > 710) doc.addPage();
  const barW  = CW - 180;
  const fill  = (score / 100) * barW;
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444';
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9)
    .text(`${label}: ${score}/100`, M, doc.y);
  const barY = doc.y + 1;
  doc.rect(M, barY, barW, 7).fill('#e2e8f0');
  doc.rect(M, barY, fill, 7).fill(color);
  doc.moveDown(0.9);
}

function pageBreakIfNeeded(doc, threshold = 120) {
  if (doc.y > doc.page.height - threshold) doc.addPage();
}

