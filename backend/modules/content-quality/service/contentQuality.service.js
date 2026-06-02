'use strict';
/**
 * contentQuality.service.js
 * Core analysis engine for the Content Quality / Trust Signals module.
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const ContentQuality = require('../model/contentQuality.model');

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════ */
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchHTML(url) {
  const { data, headers, status } = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; WebAuditX/1.0; +https://webauditx.io)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    maxRedirects: 5,
  });
  return { html: data, headers, status };
}

function score(passed, total) {
  if (!total) return 0;
  return Math.round((passed / total) * 100);
}

function metric(name, value, status, description, details = null, scoreVal = null) {
  const statusToScore = { pass: 100, warn: 50, fail: 0, info: null };
  return {
    name,
    value,
    score: scoreVal !== null ? scoreVal : (statusToScore[status] ?? 50),
    status,
    description,
    details,
  };
}

function issue(id, category, title, description, impact, priority, fixSuggestion, element = '', passed = false) {
  return { id, category, title, description, impact, priority, fixSuggestion, element, passed };
}

/* ═══════════════════════════════════════════════════════════════════
   FR-8.1 — Testimonials & Reviews
═══════════════════════════════════════════════════════════════════ */
function analyzeTestimonials($, html) {
  const metrics = [];
  const issues  = [];

  const testimonialsKeywords = ['testimonial', 'review', 'what our client', 'what people say', 'customer say', 'client say', 'feedback', 'opinion', 'rating'];
  const reviewSectionFound = testimonialsKeywords.some(kw => html.toLowerCase().includes(kw));

  const starRatings   = $('[class*="star"], [class*="rating"], [aria-label*="star"], [aria-label*="rating"]').length;
  const reviewCards   = $('[class*="review"], [class*="testimonial"], [id*="review"], [id*="testimonial"]').length;
  const quoteElements = $('blockquote').length;
  const citeElements  = $('cite').length;

  metrics.push(metric('Testimonial Section', reviewSectionFound ? 'Found' : 'Not Found',
    reviewSectionFound ? 'pass' : 'warn',
    'Page contains customer testimonial or review section.'));

  metrics.push(metric('Review Cards', reviewCards,
    reviewCards > 0 ? 'pass' : 'warn',
    'Number of review/testimonial card elements found.'));

  metrics.push(metric('Star Ratings', starRatings,
    starRatings > 0 ? 'pass' : 'warn',
    'Star rating elements detected.'));

  metrics.push(metric('Quote Elements', quoteElements,
    quoteElements > 0 ? 'pass' : 'info',
    'HTML blockquote elements (often used for testimonials).'));

  metrics.push(metric('Cite Attributes', citeElements,
    citeElements > 0 ? 'pass' : 'info',
    'HTML cite elements adding attribution to quotes.'));

  if (!reviewSectionFound && reviewCards === 0) {
    issues.push(issue('T001', 'Testimonials', 'No Testimonials or Reviews Found',
      'The page does not appear to contain customer testimonials or review sections.',
      'high', 'P2',
      'Add a dedicated testimonials section with customer quotes, star ratings, and names/photos to build social proof.'));
  }

  const passed = metrics.filter(m => m.status === 'pass').length;
  return { metrics, issues, sectionScore: score(passed, metrics.filter(m => m.status !== 'info').length) };
}

/* ═══════════════════════════════════════════════════════════════════
   FR-8.2 — Client Logos & Trust Badges
═══════════════════════════════════════════════════════════════════ */
function analyzeTrustBadges($, html) {
  const metrics = [];
  const issues  = [];

  const badgeKeywords = ['as seen on', 'featured in', 'trusted by', 'our client', 'partner', 'award', 'certified', 'accredited'];
  const badgeSection  = badgeKeywords.some(kw => html.toLowerCase().includes(kw));

  const logoImages     = $('img[src*="logo"], img[alt*="logo"], img[class*="logo"]').length;
  const partnerLogos   = $('[class*="partner"], [class*="client-logo"], [class*="brand"], [id*="partner"]').length;
  const awardBadges    = $('img[alt*="award"], img[alt*="certified"], img[alt*="accredited"]').length;
  const badgeImages    = $('img[alt*="badge"], img[class*="badge"], [class*="trust-badge"]').length;

  metrics.push(metric('Trust Badge Section', badgeSection ? 'Found' : 'Not Found',
    badgeSection ? 'pass' : 'warn',
    'Page includes a "trusted by" or "as featured in" section.'));

  metrics.push(metric('Client / Partner Logos', partnerLogos,
    partnerLogos > 0 ? 'pass' : 'warn',
    'Client or partner logo elements found.'));

  metrics.push(metric('Award / Certification Images', awardBadges,
    awardBadges > 0 ? 'pass' : 'info',
    'Award or certification badge images found.'));

  metrics.push(metric('Trust Badge Images', badgeImages,
    badgeImages > 0 ? 'pass' : 'info',
    'Generic trust-badge images found.'));

  if (!badgeSection && partnerLogos === 0) {
    issues.push(issue('TB001', 'Trust Badges', 'No Client Logos or Trust Badges',
      'The page lacks client logos, "as seen on" strips, or trust badges which significantly reduce perceived credibility.',
      'high', 'P2',
      'Add a logo strip of notable clients, media features, or certification badges. Position it prominently near the hero or in the footer.'));
  }

  const passed = metrics.filter(m => m.status === 'pass').length;
  return { metrics, issues, sectionScore: score(passed, metrics.filter(m => m.status !== 'info').length) };
}

/* ═══════════════════════════════════════════════════════════════════
   FR-8.3 — Embedded Review Widgets (Google, Trustpilot, etc.)
═══════════════════════════════════════════════════════════════════ */
function analyzeReviewWidgets($, html) {
  const metrics = [];
  const issues  = [];

  const widgetPatterns = [
    { name: 'Trustpilot',     pattern: /trustpilot/i },
    { name: 'Google Reviews', pattern: /maps\.googleapis\.com|google.*review/i },
    { name: 'Yelp',           pattern: /yelp\.com\/biz/i },
    { name: 'Facebook Reviews', pattern: /facebook\.com.*plugin.*reviews|fb\.com.*review/i },
    { name: 'Capterra',       pattern: /capterra\.com/i },
    { name: 'G2',             pattern: /g2\.com|g2crowd/i },
    { name: 'Clutch',         pattern: /clutch\.co/i },
    { name: 'Reviews.io',     pattern: /reviews\.io/i },
    { name: 'Bazaarvoice',    pattern: /bazaarvoice/i },
    { name: 'Yotpo',          pattern: /yotpo/i },
    { name: 'Stamped',        pattern: /stamped\.io/i },
  ];

  const foundWidgets = widgetPatterns.filter(w => w.pattern.test(html));

  metrics.push(metric('Third-Party Review Widgets', foundWidgets.length,
    foundWidgets.length > 0 ? 'pass' : 'warn',
    `Found: ${foundWidgets.length > 0 ? foundWidgets.map(w => w.name).join(', ') : 'None'}`));

  foundWidgets.forEach(w => {
    metrics.push(metric(`Widget: ${w.name}`, 'Present', 'pass', `${w.name} integration detected.`));
  });

  const iframeReviews = $('iframe[src*="trustpilot"], iframe[src*="google"], iframe[src*="yelp"]').length;
  metrics.push(metric('Review iFrames', iframeReviews,
    iframeReviews > 0 ? 'pass' : 'info',
    'Embedded review iFrames found.'));

  if (foundWidgets.length === 0) {
    issues.push(issue('RW001', 'Review Widgets', 'No Third-Party Review Widget Found',
      'Embedding verified review widgets (Trustpilot, Google Reviews, etc.) dramatically increases trust.',
      'medium', 'P2',
      'Integrate at least one verified review platform widget. Trustpilot and Google Reviews are most recognised by consumers.'));
  }

  const passed = metrics.filter(m => m.status === 'pass').length;
  return { metrics, issues, sectionScore: score(passed, metrics.filter(m => m.status !== 'info').length) };
}

/* ═══════════════════════════════════════════════════════════════════
   FR-8.4 — Schema.org Markup (AggregateRating, Review, LocalBusiness)
═══════════════════════════════════════════════════════════════════ */
function analyzeSchemaMarkup($, html) {
  const metrics = [];
  const issues  = [];
  let schemaData = [];

  // JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html());
      schemaData = schemaData.concat(Array.isArray(parsed) ? parsed : [parsed]);
    } catch {}
  });

  const schemaTypes = schemaData.map(s => s['@type']).filter(Boolean);

  const hasAggregateRating = schemaTypes.includes('AggregateRating') ||
    schemaData.some(s => s.aggregateRating);
  const hasReview           = schemaTypes.includes('Review') || schemaData.some(s => s.review);
  const hasLocalBusiness    = schemaTypes.includes('LocalBusiness') || schemaTypes.some(t => ['Organization','Restaurant','Store','Hotel','MedicalBusiness'].includes(t));
  const hasProduct          = schemaTypes.includes('Product');
  const hasFAQ              = schemaTypes.includes('FAQPage');
  const hasBreadcrumb       = schemaTypes.includes('BreadcrumbList');

  // Microdata fallback
  const microdataRating = $('[itemprop="ratingValue"], [itemprop="aggregateRating"]').length;

  metrics.push(metric('JSON-LD Schema Blocks', schemaData.length,
    schemaData.length > 0 ? 'pass' : 'fail',
    `${schemaData.length} JSON-LD schema block(s) found. Types: ${schemaTypes.join(', ') || 'None'}`));

  metrics.push(metric('AggregateRating Schema', hasAggregateRating ? 'Present' : 'Missing',
    hasAggregateRating ? 'pass' : 'warn',
    'AggregateRating schema enables rich star snippets in Google Search.'));

  metrics.push(metric('Review Schema', hasReview ? 'Present' : 'Missing',
    hasReview ? 'pass' : 'warn',
    'Review schema markup for individual reviews.'));

  metrics.push(metric('LocalBusiness / Org Schema', hasLocalBusiness ? 'Present' : 'Missing',
    hasLocalBusiness ? 'pass' : 'warn',
    'LocalBusiness or Organization schema for business entity recognition.'));

  metrics.push(metric('Product Schema', hasProduct ? 'Present' : 'Missing',
    hasProduct ? 'pass' : 'info',
    'Product schema for e-commerce rich results.'));

  metrics.push(metric('FAQ Schema', hasFAQ ? 'Present' : 'Missing',
    hasFAQ ? 'pass' : 'info',
    'FAQPage schema enables FAQ rich results in Google.'));

  metrics.push(metric('Breadcrumb Schema', hasBreadcrumb ? 'Present' : 'Missing',
    hasBreadcrumb ? 'pass' : 'info',
    'BreadcrumbList schema for search result navigation paths.'));

  metrics.push(metric('Microdata Rating', microdataRating,
    microdataRating > 0 ? 'pass' : 'info',
    'Microdata ratingValue or aggregateRating attributes.'));

  if (schemaData.length === 0) {
    issues.push(issue('SM001', 'Schema Markup', 'No Schema.org JSON-LD Found',
      'The page lacks structured data markup entirely. This hurts rich-result eligibility.',
      'critical', 'P1',
      'Implement JSON-LD schema. At minimum add Organization/LocalBusiness. Add AggregateRating if you have reviews.'));
  } else if (!hasAggregateRating && !hasReview) {
    issues.push(issue('SM002', 'Schema Markup', 'Missing AggregateRating Schema',
      'AggregateRating schema is absent. Google cannot show star ratings in search results.',
      'high', 'P2',
      'Add AggregateRating schema nested inside your main entity schema. Include ratingValue, reviewCount, and bestRating properties.'));
  }

  const passed = metrics.filter(m => m.status === 'pass').length;
  return { metrics, issues, sectionScore: score(passed, metrics.filter(m => m.status !== 'info').length), schemaTypes };
}

/* ═══════════════════════════════════════════════════════════════════
   FR-8.5 + FR-8.6 — Contact Information
═══════════════════════════════════════════════════════════════════ */
function analyzeContactInfo($, html) {
  const metrics = [];
  const issues  = [];

  // Phone
  const phoneRegex = /(\+?\d[\d\s\-().]{7,}\d)/g;
  const phoneMatches = html.match(phoneRegex) || [];
  const hasPhone = phoneMatches.length > 0 ||
    $('a[href^="tel:"]').length > 0 ||
    html.toLowerCase().includes('phone') || html.toLowerCase().includes('call us');

  // Email
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const emailMatches = html.match(emailRegex) || [];
  const hasEmail = emailMatches.length > 0 || $('a[href^="mailto:"]').length > 0;

  // Address
  const addressKeywords = ['street', 'avenue', 'road', 'suite', 'floor', 'building', 'city', 'state', 'zip', 'postal', 'address'];
  const hasAddress = addressKeywords.some(kw => html.toLowerCase().includes(kw)) ||
    $('[itemprop="address"], [class*="address"], [id*="address"]').length > 0;

  // Contact page
  const hasContactPage = $('a[href*="contact"], a[href*="reach"], a[href*="get-in-touch"]').length > 0;

  metrics.push(metric('Phone Number', hasPhone ? `Found (${phoneMatches.length} occurrences)` : 'Not Found',
    hasPhone ? 'pass' : 'warn',
    'Visible phone number for direct customer contact.'));

  metrics.push(metric('Email Address', hasEmail ? `Found (${emailMatches.slice(0,3).join(', ')})` : 'Not Found',
    hasEmail ? 'pass' : 'warn',
    'Email address or mailto: link detected.'));

  metrics.push(metric('Physical Address', hasAddress ? 'Found' : 'Not Found',
    hasAddress ? 'pass' : 'warn',
    'Physical or mailing address information present.'));

  metrics.push(metric('Contact Page Link', hasContactPage ? 'Found' : 'Not Found',
    hasContactPage ? 'pass' : 'warn',
    'Navigation link to a dedicated contact page.'));

  const contactScore = [hasPhone, hasEmail, hasAddress, hasContactPage].filter(Boolean).length;

  if (!hasPhone) {
    issues.push(issue('CI001', 'Contact Info', 'Phone Number Missing',
      'No phone number detected. Customers unable to call directly reduces trust.',
      'high', 'P2',
      'Add a clickable tel: link in the header and footer. Display the number visibly. Use itemprop="telephone" for schema.'));
  }
  if (!hasEmail) {
    issues.push(issue('CI002', 'Contact Info', 'Email Address Missing',
      'No email address or mailto: link found on the page.',
      'high', 'P2',
      'Add a visible email address or mailto: link. Consider obfuscation to avoid spam harvesters.'));
  }
  if (!hasAddress) {
    issues.push(issue('CI003', 'Contact Info', 'Physical Address Missing',
      'No physical address detected. For local businesses this significantly impacts trust and local SEO.',
      'medium', 'P3',
      'Add your complete address in the footer using address HTML element and itemprop="address" schema.'));
  }

  return { metrics, issues, sectionScore: score(contactScore, 4) };
}

/* ═══════════════════════════════════════════════════════════════════
   FR-8.7 — Contact Info Placement (header/footer)
═══════════════════════════════════════════════════════════════════ */
function analyzeContactPlacement($) {
  const metrics = [];
  const issues  = [];

  const headerPhoneEmail = $('header a[href^="tel:"], header a[href^="mailto:"]').length;
  const footerPhoneEmail = $('footer a[href^="tel:"], footer a[href^="mailto:"]').length;
  const footerAddress    = $('footer [itemprop="address"], footer address').length;
  const headerNav        = $('header nav a[href*="contact"]').length;
  const footerNav        = $('footer a[href*="contact"]').length;

  metrics.push(metric('Contact in Header', headerPhoneEmail > 0 ? 'Found' : 'Not Found',
    headerPhoneEmail > 0 ? 'pass' : 'warn',
    'Phone or email in the header for immediate visibility.'));

  metrics.push(metric('Contact in Footer', footerPhoneEmail > 0 ? 'Found' : 'Not Found',
    footerPhoneEmail > 0 ? 'pass' : 'warn',
    'Phone or email in the footer.'));

  metrics.push(metric('Address in Footer', footerAddress > 0 ? 'Found' : 'Not Found',
    footerAddress > 0 ? 'pass' : 'info',
    'Physical address in the footer for trust and local SEO.'));

  metrics.push(metric('Contact Nav Link', (headerNav + footerNav) > 0 ? 'Found' : 'Not Found',
    (headerNav + footerNav) > 0 ? 'pass' : 'warn',
    'Contact link in header or footer navigation.'));

  if (headerPhoneEmail === 0 && footerPhoneEmail === 0) {
    issues.push(issue('CP001', 'Contact Placement', 'Contact Info Not in Header or Footer',
      'Contact information is not in the standard header or footer locations where users expect it.',
      'medium', 'P3',
      'Place at minimum a phone number in the header and a full contact block (phone, email, address) in the footer.'));
  }

  const passed = metrics.filter(m => m.status === 'pass').length;
  return { metrics, issues, sectionScore: score(passed, metrics.filter(m => m.status !== 'info').length) };
}

/* ═══════════════════════════════════════════════════════════════════
   FR-8.8 — Live Chat & Contact Forms
═══════════════════════════════════════════════════════════════════ */
function analyzeLiveChat($, html) {
  const metrics = [];
  const issues  = [];

  const chatPatterns = [
    { name: 'Intercom',      pattern: /intercom/i },
    { name: 'Drift',         pattern: /drift\.com|drift\.js/i },
    { name: 'Zendesk Chat',  pattern: /zopim|zendesk.*chat|zd-messenger/i },
    { name: 'HubSpot Chat',  pattern: /hubspot.*chat|hs-chat/i },
    { name: 'LiveChat',      pattern: /livechat\.com|livechatinc/i },
    { name: 'Tidio',         pattern: /tidio/i },
    { name: 'Crisp',         pattern: /crisp\.chat/i },
    { name: 'Freshchat',     pattern: /freshchat|freshworks.*chat/i },
    { name: 'Tawk.to',       pattern: /tawk\.to/i },
    { name: 'WhatsApp Chat', pattern: /wa\.me|whatsapp.*chat|api\.whatsapp\.com/i },
    { name: 'Facebook Messenger', pattern: /fb\.me\/msg|messenger\.com\/t/i },
    { name: 'Custom Chat',   pattern: /chat-widget|live-chat|livechat|chatbot/i },
  ];

  const foundChats = chatPatterns.filter(c => c.pattern.test(html));
  const hasContactForm = $('form').length > 0 &&
    ($('input[type="email"]').length > 0 || $('textarea').length > 0);
  const hasSubmitButton = $('button[type="submit"], input[type="submit"]').length > 0;

  metrics.push(metric('Live Chat Widget', foundChats.length > 0 ? 'Found' : 'Not Found',
    foundChats.length > 0 ? 'pass' : 'warn',
    `Chat providers found: ${foundChats.map(c => c.name).join(', ') || 'None'}`));

  foundChats.forEach(c => {
    metrics.push(metric(`Chat: ${c.name}`, 'Active', 'pass', `${c.name} integration detected.`));
  });

  metrics.push(metric('Contact Form', hasContactForm ? 'Found' : 'Not Found',
    hasContactForm ? 'pass' : 'warn',
    'HTML form with email or textarea input detected.'));

  metrics.push(metric('Form Submit Button', hasSubmitButton ? 'Found' : 'Not Found',
    hasSubmitButton ? 'pass' : (hasContactForm ? 'fail' : 'info'),
    'Submit button found in form.'));

  if (foundChats.length === 0 && !hasContactForm) {
    issues.push(issue('LC001', 'Live Chat', 'No Live Chat or Contact Form Found',
      'Visitors have no instant way to contact the business. This increases bounce rates and reduces conversions.',
      'high', 'P2',
      'Install a free live chat widget (Tawk.to or Crisp) and ensure at least one contact form exists on the site.'));
  } else if (foundChats.length === 0) {
    issues.push(issue('LC002', 'Live Chat', 'No Live Chat Widget Detected',
      'Live chat widgets can increase conversion rates by 20-40%. Only a contact form is present.',
      'medium', 'P3',
      'Consider adding a lightweight live chat or chatbot solution such as Tawk.to (free) or Crisp.'));
  }

  const passed = metrics.filter(m => m.status === 'pass').length;
  return { metrics, issues, sectionScore: score(passed, metrics.filter(m => m.status !== 'info').length) };
}

/* ═══════════════════════════════════════════════════════════════════
   FR-8.9 — Social Media Links
═══════════════════════════════════════════════════════════════════ */
function analyzeSocialMedia($, html) {
  const metrics = [];
  const issues  = [];

  const socialPatterns = [
    { name: 'Facebook',    pattern: /facebook\.com\//i },
    { name: 'Twitter/X',   pattern: /twitter\.com\/|x\.com\//i },
    { name: 'Instagram',   pattern: /instagram\.com\//i },
    { name: 'LinkedIn',    pattern: /linkedin\.com\/(company|in)\//i },
    { name: 'YouTube',     pattern: /youtube\.com\/(channel|c\/|@)/i },
    { name: 'TikTok',      pattern: /tiktok\.com\/@/i },
    { name: 'Pinterest',   pattern: /pinterest\.com\//i },
    { name: 'Snapchat',    pattern: /snapchat\.com\/add\//i },
    { name: 'WhatsApp',    pattern: /wa\.me\//i },
    { name: 'Telegram',    pattern: /t\.me\//i },
    { name: 'GitHub',      pattern: /github\.com\//i },
  ];

  const socialLinks = $('a[href]').toArray().map(el => $(el).attr('href') || '');
  const foundSocials = socialPatterns.filter(s =>
    socialLinks.some(link => s.pattern.test(link))
  );

  const ogTags = {
    siteName: $('meta[property="og:site_name"]').attr('content'),
    type:     $('meta[property="og:type"]').attr('content'),
    image:    $('meta[property="og:image"]').attr('content'),
    title:    $('meta[property="og:title"]').attr('content'),
  };

  const twitterCard = $('meta[name="twitter:card"]').attr('content');

  metrics.push(metric('Social Media Links', foundSocials.length,
    foundSocials.length >= 2 ? 'pass' : foundSocials.length === 1 ? 'warn' : 'fail',
    `Found: ${foundSocials.map(s => s.name).join(', ') || 'None'}`));

  foundSocials.forEach(s => {
    metrics.push(metric(`Social: ${s.name}`, 'Linked', 'pass', `${s.name} profile link found.`));
  });

  metrics.push(metric('Open Graph Tags', Object.values(ogTags).filter(Boolean).length > 0 ? 'Present' : 'Missing',
    Object.values(ogTags).filter(Boolean).length >= 3 ? 'pass' : 'warn',
    `og:title=${!!ogTags.title}, og:image=${!!ogTags.image}, og:type=${!!ogTags.type}`));

  metrics.push(metric('Twitter Card Meta', twitterCard ? twitterCard : 'Missing',
    twitterCard ? 'pass' : 'warn',
    'Twitter/X card meta tag for social sharing previews.'));

  if (foundSocials.length === 0) {
    issues.push(issue('SM001', 'Social Media', 'No Social Media Links Found',
      'No social media profile links detected. Social presence is essential for brand credibility and SEO signals.',
      'high', 'P2',
      'Add social media links to the footer and/or header. Use recognizable social icons. Include at minimum LinkedIn, Facebook, and Instagram.'));
  }
  if (!ogTags.title || !ogTags.image) {
    issues.push(issue('SM002', 'Social Media', 'Incomplete Open Graph Meta Tags',
      'Missing og:title or og:image means poor appearance when shared on social media.',
      'medium', 'P3',
      'Add complete Open Graph meta tags: og:title, og:description, og:image, og:url, and og:type.'));
  }
  if (!twitterCard) {
    issues.push(issue('SM003', 'Social Media', 'Twitter/X Card Meta Missing',
      'No twitter:card meta tag. Shared links on X will not show rich card previews.',
      'low', 'P4',
      'Add <meta name="twitter:card" content="summary_large_image"> along with twitter:title and twitter:image.'));
  }

  const passed = metrics.filter(m => m.status === 'pass').length;
  return { metrics, issues, sectionScore: score(passed, metrics.filter(m => m.status !== 'info').length) };
}

/* ═══════════════════════════════════════════════════════════════════
   FR-8.9b — Security Trust Badges (SSL, Payment logos)
═══════════════════════════════════════════════════════════════════ */
function analyzeSecurityBadges(url, $, html) {
  const metrics = [];
  const issues  = [];

  const hasSSL = url.startsWith('https://');
  const sslBadgeInPage = /ssl|secure|encrypted|https/i.test(html);

  const paymentPatterns = [
    { name: 'Visa',       pattern: /visa/i },
    { name: 'Mastercard', pattern: /mastercard/i },
    { name: 'PayPal',     pattern: /paypal/i },
    { name: 'Stripe',     pattern: /stripe/i },
    { name: 'Apple Pay',  pattern: /apple.?pay/i },
    { name: 'Google Pay', pattern: /google.?pay/i },
    { name: 'Amex',       pattern: /amex|american.?express/i },
    { name: 'Discover',   pattern: /discover.?card/i },
  ];

  const securityBadges = [
    { name: 'Norton Secured',   pattern: /norton|symantec/i },
    { name: 'McAfee Secure',    pattern: /mcafee/i },
    { name: 'TRUSTe',           pattern: /truste/i },
    { name: 'BBB',              pattern: /bbb\.org|better.?business/i },
    { name: 'ISO Certified',    pattern: /iso.?\d{4,5}/i },
    { name: 'PCI Compliant',    pattern: /pci.?compliant|pci.?dss/i },
    { name: 'GDPR Badge',       pattern: /gdpr/i },
    { name: 'SOC 2',            pattern: /soc.?2/i },
  ];

  const foundPayments  = paymentPatterns.filter(p => p.pattern.test(html));
  const foundSecurity  = securityBadges.filter(s => s.pattern.test(html));

  metrics.push(metric('SSL / HTTPS', hasSSL ? 'Active' : 'Not Active',
    hasSSL ? 'pass' : 'fail',
    hasSSL ? 'Site is served over HTTPS.' : 'Site is NOT served over HTTPS — critical security issue.'));

  metrics.push(metric('SSL Badge in Page', sslBadgeInPage ? 'Found' : 'Not Found',
    sslBadgeInPage ? 'pass' : 'info',
    'Visible SSL/secure badge shown to users.'));

  metrics.push(metric('Payment Logos', foundPayments.length,
    foundPayments.length > 0 ? 'pass' : 'info',
    `Found: ${foundPayments.map(p => p.name).join(', ') || 'None'}`));

  metrics.push(metric('Security Certifications', foundSecurity.length,
    foundSecurity.length > 0 ? 'pass' : 'info',
    `Found: ${foundSecurity.map(s => s.name).join(', ') || 'None'}`));

  if (!hasSSL) {
    issues.push(issue('SEC001', 'Security Badges', 'Site Not Using HTTPS',
      'The website is served over HTTP. This is a critical security issue that harms trust, SEO, and browser warnings.',
      'critical', 'P1',
      'Obtain an SSL certificate (free via Let\'s Encrypt) and redirect all HTTP traffic to HTTPS. Update all internal links.'));
  }

  const passed = metrics.filter(m => m.status === 'pass').length;
  return { metrics, issues, sectionScore: score(passed, metrics.filter(m => m.status !== 'info').length) };
}

/* ═══════════════════════════════════════════════════════════════════
   CONTENT QUALITY — Readability, headings, images, word count
═══════════════════════════════════════════════════════════════════ */
function analyzeContentQuality($, html) {
  const metrics = [];
  const issues  = [];

  const bodyText   = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount  = bodyText.split(/\s+/).filter(w => w.length > 2).length;

  const h1s = $('h1').length;
  const h2s = $('h2').length;
  const h3s = $('h3').length;

  const images      = $('img').length;
  const imagesAlt   = $('img[alt]').length;
  const imagesNoAlt = images - imagesAlt;

  const paragraphs  = $('p').length;
  const lists       = $('ul, ol').length;
  const videos      = $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;

  const metaTitle = $('title').text();
  const metaDesc  = $('meta[name="description"]').attr('content') || '';
  const canonical = $('link[rel="canonical"]').attr('href') || '';

  // Flesch-Kincaid approximation
  const sentences  = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 5).length;
  const words      = wordCount;
  const syllables  = bodyText.split(/[aeiou]/i).length;
  const fk = sentences > 0 ? Math.max(0, Math.min(100,
    206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / Math.max(words, 1))
  )) : 0;

  metrics.push(metric('Word Count', wordCount,
    wordCount >= 300 ? 'pass' : wordCount >= 100 ? 'warn' : 'fail',
    'Total word count of visible page content. 300+ words recommended for SEO.',
    null, Math.min(100, Math.round(wordCount / 5))));

  metrics.push(metric('H1 Tags', h1s,
    h1s === 1 ? 'pass' : h1s === 0 ? 'fail' : 'warn',
    'A page should have exactly one H1 heading.'));

  metrics.push(metric('H2 Tags', h2s,
    h2s >= 2 ? 'pass' : h2s === 1 ? 'warn' : 'fail',
    'H2 subheadings improve structure and readability.'));

  metrics.push(metric('H3 Tags', h3s,
    h3s >= 1 ? 'pass' : 'info',
    'H3 tags for tertiary content structure.'));

  metrics.push(metric('Images on Page', images,
    images > 0 ? 'pass' : 'warn',
    'Total images detected.'));

  metrics.push(metric('Images with Alt Text', `${imagesAlt}/${images}`,
    imagesNoAlt === 0 && images > 0 ? 'pass' : imagesNoAlt > 0 ? 'warn' : 'info',
    `${imagesNoAlt} image(s) missing alt text.`));

  metrics.push(metric('Paragraph Count', paragraphs,
    paragraphs >= 3 ? 'pass' : 'warn',
    'Number of paragraph elements.'));

  metrics.push(metric('Lists (ul/ol)', lists,
    lists >= 1 ? 'pass' : 'info',
    'Bulleted/numbered lists improve scannability.'));

  metrics.push(metric('Video / Media', videos,
    videos > 0 ? 'pass' : 'info',
    'Video elements or embedded YouTube/Vimeo.'));

  metrics.push(metric('Meta Title', metaTitle ? metaTitle.substring(0, 60) : 'Missing',
    metaTitle && metaTitle.length >= 30 && metaTitle.length <= 60 ? 'pass' : metaTitle ? 'warn' : 'fail',
    `Length: ${metaTitle.length} chars. Ideal: 30–60 chars.`));

  metrics.push(metric('Meta Description', metaDesc ? metaDesc.substring(0, 160) : 'Missing',
    metaDesc && metaDesc.length >= 100 && metaDesc.length <= 160 ? 'pass' : metaDesc ? 'warn' : 'fail',
    `Length: ${metaDesc.length} chars. Ideal: 100–160 chars.`));

  metrics.push(metric('Canonical URL', canonical || 'Missing',
    canonical ? 'pass' : 'warn',
    'Canonical URL prevents duplicate content issues.'));

  metrics.push(metric('Readability Score', Math.round(fk),
    fk >= 60 ? 'pass' : fk >= 40 ? 'warn' : 'fail',
    'Flesch-Kincaid readability approximation. 60+ = easy to read.',
    null, Math.round(fk)));

  if (wordCount < 300) {
    issues.push(issue('CQ001', 'Content Quality', 'Low Word Count',
      `Page has only ${wordCount} words. Pages with less than 300 words often rank poorly.`,
      'high', 'P2',
      'Expand page content to at least 300–500 words. Focus on value to the reader, not keyword stuffing.'));
  }
  if (h1s === 0) {
    issues.push(issue('CQ002', 'Content Quality', 'Missing H1 Heading',
      'No H1 heading found. Every page needs exactly one H1 for SEO and document structure.',
      'critical', 'P1',
      'Add a single, descriptive H1 heading containing your primary keyword.'));
  }
  if (h1s > 1) {
    issues.push(issue('CQ003', 'Content Quality', 'Multiple H1 Headings',
      `Found ${h1s} H1 headings. Only one H1 per page is best practice.`,
      'medium', 'P3',
      'Reduce to a single H1 and convert the others to H2 or H3.'));
  }
  if (imagesNoAlt > 0) {
    issues.push(issue('CQ004', 'Content Quality', `${imagesNoAlt} Images Missing Alt Text`,
      'Images without alt text harm accessibility (WCAG 2.1) and image SEO.',
      'high', 'P2',
      'Add descriptive alt text to all images. For decorative images use alt="".'));
  }
  if (!metaDesc) {
    issues.push(issue('CQ005', 'Content Quality', 'Missing Meta Description',
      'No meta description found. This affects click-through rates from search results.',
      'high', 'P2',
      'Write a compelling meta description of 100–160 characters including your primary keyword.'));
  }

  const passed = metrics.filter(m => m.status === 'pass').length;
  return { metrics, issues, sectionScore: score(passed, metrics.filter(m => m.status !== 'info').length),
    pageData: { metaTitle, metaDesc, wordCount, headings: { h1: h1s, h2: h2s, h3: h3s }, images, paragraphs } };
}

/* ═══════════════════════════════════════════════════════════════════
   WCAG ACCESSIBILITY CHECK
═══════════════════════════════════════════════════════════════════ */
function analyzeWCAG($) {
  const metrics = [];
  const issues  = [];

  const langAttr       = $('html').attr('lang');
  const skipLink       = $('a[href="#main"], a[href="#content"], a[href="#maincontent"]').length;
  const formLabels     = $('form label').length;
  const formInputs     = $('form input:not([type="hidden"]):not([type="submit"])').length;
  const unlabelledInputs = $('form input:not([type="hidden"]):not([type="submit"]):not([aria-label]):not([id])').length;
  const ariaLandmarks  = $('[role="main"], main, [role="banner"], header, [role="navigation"], nav, [role="contentinfo"], footer').length;
  const ariaLabels     = $('[aria-label], [aria-labelledby]').length;
  const tabIndexNeg    = $('[tabindex="-1"]').length;
  const tabIndexPos    = $('[tabindex]').filter((_, el) => parseInt($(el).attr('tabindex')) > 0).length;
  const focusableNoOutline = 0; // Cannot determine without rendering
  const imagesTotal    = $('img').length;
  const imagesWithAlt  = $('img[alt]').length;
  const colorContrast  = null; // Cannot determine from HTML alone
  const videoCaptions  = $('track[kind="captions"], track[kind="subtitles"]').length;
  const videos         = $('video').length;
  const iframeTitle    = $('iframe[title]').length;
  const iframeTotal    = $('iframe').length;
  const buttonText     = $('button').filter((_, el) => {
    const btn = $(el);
    return !btn.text().trim() && !btn.attr('aria-label') && !btn.attr('title');
  }).length;
  const linkText       = $('a').filter((_, el) => {
    const a = $(el);
    const txt = a.text().trim().toLowerCase();
    return txt === 'click here' || txt === 'here' || txt === 'more' || txt === 'read more' || txt === 'link';
  }).length;

  metrics.push(metric('WCAG 3.1.1 — Language Attribute', langAttr ? `lang="${langAttr}"` : 'Missing',
    langAttr ? 'pass' : 'fail',
    'html[lang] attribute required for screen readers.'));

  metrics.push(metric('WCAG 2.4.1 — Skip Navigation Link', skipLink > 0 ? 'Found' : 'Missing',
    skipLink > 0 ? 'pass' : 'warn',
    'Skip-to-content link helps keyboard-only users bypass navigation.'));

  metrics.push(metric('WCAG 1.1.1 — Image Alt Text', `${imagesWithAlt}/${imagesTotal}`,
    imagesTotal === imagesWithAlt && imagesTotal > 0 ? 'pass' : imagesWithAlt < imagesTotal ? 'fail' : 'info',
    `${imagesTotal - imagesWithAlt} images missing alt text (WCAG 1.1.1 failure).`));

  metrics.push(metric('WCAG 1.2.2 — Video Captions', videos > 0 ? `${videoCaptions}/${videos} captioned` : 'No videos',
    videos === 0 ? 'info' : videoCaptions >= videos ? 'pass' : 'fail',
    'All videos must have captions for deaf/hard of hearing users (WCAG 1.2.2).'));

  metrics.push(metric('WCAG 4.1.2 — Form Labels', formInputs > 0 ? `${formLabels} labels / ${formInputs} inputs` : 'No form',
    formInputs === 0 ? 'info' : unlabelledInputs === 0 ? 'pass' : 'fail',
    'All form inputs must have associated labels.'));

  metrics.push(metric('WCAG 2.4.6 — Headings & Labels', ariaLandmarks,
    ariaLandmarks >= 3 ? 'pass' : 'warn',
    'ARIA landmark roles / HTML5 sectioning elements found.'));

  metrics.push(metric('ARIA Labels', ariaLabels,
    ariaLabels >= 3 ? 'pass' : ariaLabels > 0 ? 'warn' : 'fail',
    `${ariaLabels} elements have aria-label or aria-labelledby.`));

  metrics.push(metric('WCAG 2.4.3 — Positive tabindex', tabIndexPos,
    tabIndexPos === 0 ? 'pass' : 'warn',
    'Positive tabindex values disrupt natural keyboard navigation. Found: ' + tabIndexPos));

  metrics.push(metric('WCAG 2.4.4 — Link Purpose', linkText,
    linkText === 0 ? 'pass' : 'fail',
    `${linkText} links with ambiguous text like "click here" or "read more".`));

  metrics.push(metric('WCAG 4.1.2 — iframe titles', iframeTotal > 0 ? `${iframeTitle}/${iframeTotal}` : 'No iframes',
    iframeTotal === 0 ? 'info' : iframeTitle >= iframeTotal ? 'pass' : 'fail',
    'All iframes must have a title attribute for screen readers.'));

  metrics.push(metric('WCAG 1.4.3 — Color Contrast', 'Manual Review Needed',
    'info',
    'Color contrast cannot be checked without rendering the page. Use browser DevTools or Wave.'));

  metrics.push(metric('WCAG 1.4.1 — Non-text Contrast', 'Manual Review Needed',
    'info',
    'Non-text contrast for UI components requires visual inspection.'));

  metrics.push(metric('Empty Button Labels', buttonText,
    buttonText === 0 ? 'pass' : 'fail',
    `${buttonText} buttons with no accessible label.`));

  if (!langAttr) {
    issues.push(issue('WCAG001', 'WCAG Accessibility', 'Missing lang Attribute (WCAG 3.1.1)',
      'The html element is missing a lang attribute. Screen readers need this to use correct pronunciation.',
      'critical', 'P1',
      'Add lang="en" (or appropriate language code) to the <html> element.'));
  }
  if (skipLink === 0) {
    issues.push(issue('WCAG002', 'WCAG Accessibility', 'No Skip Navigation Link (WCAG 2.4.1)',
      'Keyboard users must tab through all navigation on every page load without a skip link.',
      'high', 'P2',
      'Add <a href="#main-content" class="skip-link">Skip to main content</a> as the first element in the body. Style it to appear on focus.'));
  }
  if (imagesTotal > imagesWithAlt) {
    issues.push(issue('WCAG003', 'WCAG Accessibility', `${imagesTotal - imagesWithAlt} Images Fail WCAG 1.1.1`,
      'Images missing alt text are inaccessible to screen reader users and fail WCAG 2.1 Level A.',
      'critical', 'P1',
      'Add descriptive alt text to all informational images. Use alt="" for decorative ones.'));
  }
  if (linkText > 0) {
    issues.push(issue('WCAG004', 'WCAG Accessibility', 'Ambiguous Link Text (WCAG 2.4.4)',
      `${linkText} links use non-descriptive text ("click here", "more"). Screen readers list links out of context.`,
      'medium', 'P3',
      'Replace generic link text with descriptive phrases like "Download Annual Report" or "View our Services".'));
  }
  if (buttonText > 0) {
    issues.push(issue('WCAG005', 'WCAG Accessibility', 'Empty Button Labels (WCAG 4.1.2)',
      `${buttonText} button(s) have no text or aria-label. Screen readers cannot convey their purpose.`,
      'critical', 'P1',
      'Add visible text or aria-label to all buttons. Icon buttons must have aria-label.'));
  }
  if (tabIndexPos > 0) {
    issues.push(issue('WCAG006', 'WCAG Accessibility', 'Positive tabindex Values (WCAG 2.4.3)',
      `${tabIndexPos} elements use positive tabindex which overrides natural keyboard focus order.`,
      'medium', 'P3',
      'Remove positive tabindex values. Use tabindex="0" to include elements in tab order naturally.'));
  }
  if (iframeTotal > 0 && iframeTitle < iframeTotal) {
    issues.push(issue('WCAG007', 'WCAG Accessibility', 'iFrames Missing Title Attribute (WCAG 4.1.2)',
      `${iframeTotal - iframeTitle} iframe(s) missing title attribute.`,
      'high', 'P2',
      'Add a descriptive title attribute to every iframe element.'));
  }

  const passed = metrics.filter(m => ['pass'].includes(m.status)).length;
  const total  = metrics.filter(m => m.status !== 'info').length;
  return { metrics, issues, sectionScore: score(passed, total) };
}

/* ═══════════════════════════════════════════════════════════════════
   PageSpeed / Lighthouse via Google API
═══════════════════════════════════════════════════════════════════ */
async function fetchPageSpeedData(url) {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return null;
  try {
    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=desktop&category=accessibility&category=seo&key=${key}`;
    const { data } = await axios.get(endpoint, { timeout: 30000 });
    const cats  = data.lighthouseResult?.categories || {};
    const audits = data.lighthouseResult?.audits || {};
    return {
      accessibilityScore: Math.round((cats.accessibility?.score || 0) * 100),
      seoScore:           Math.round((cats.seo?.score || 0) * 100),
      performanceScore:   Math.round((cats.performance?.score || 0) * 100),
      audits,
    };
  } catch (e) {
    console.warn('[PageSpeed] API call failed:', e.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   AI REPORT GENERATION (with fallback chain)
═══════════════════════════════════════════════════════════════════ */
async function generateAIReport(url, analysisData) {
  const { overallScore, scores, issues, pageData } = analysisData;

  const prompt = `
You are a professional website auditor. Analyze the following audit results for ${url} and write a comprehensive, friendly report in PLAIN ENGLISH.

## AUDIT RESULTS SUMMARY
Overall Score: ${overallScore}/100
Category Scores:
${Object.entries(scores).map(([k, v]) => `- ${k}: ${v}/100`).join('\n')}

Page Data:
- Title: ${pageData.title || 'Missing'}
- Word Count: ${pageData.wordCount || 0}
- Headings: H1=${pageData.headings?.h1 || 0}, H2=${pageData.headings?.h2 || 0}, H3=${pageData.headings?.h3 || 0}
- Images: ${pageData.images || 0}

Issues Found (${issues.length} total):
${issues.slice(0, 20).map(i => `[${i.impact.toUpperCase()}] ${i.title}: ${i.description}`).join('\n')}

## YOUR TASK
Write a detailed report with EXACTLY these sections:

### WEBSITE HEALTH SUMMARY
[2-3 paragraph overview of the website's overall health in plain English]

### WHAT IS WORKING WELL
[List what the website is doing right, be specific and encouraging]

### ISSUES FOUND
[Explain each issue in simple English that a non-technical person can understand]

### HOW TO FIX THEM
[Step-by-step fix recommendations for the top issues, grouped by priority]

### FINAL SCORE
[Give a score out of 100 and a one-sentence verdict]

Then output a JSON table like this (ONLY the JSON, nothing else after it):
PRIORITY_TABLE_JSON:
[
  {"issue": "Issue Title", "impact": "Critical/High/Medium/Low", "priority": "P1/P2/P3/P4", "effort": "Easy/Medium/Hard", "fix": "Brief fix description"},
  ...
]

Keep the language friendly, clear, and actionable. Avoid jargon.
`;

  // Try Groq first
  try {
    const key = process.env.GROQ_API_KEY;
    if (key) {
      const { data } = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.4,
      }, {
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        timeout: 45000,
      });
      const text = data.choices[0].message.content;
      return parseAIReport(text, 'Groq/Llama-3.3');
    }
  } catch (e) { console.warn('[AI] Groq failed:', e.message); }

  // Try Anthropic Claude
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (key) {
      const { data } = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-haiku-20240307',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }, {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        timeout: 45000,
      });
      const text = data.content[0].text;
      return parseAIReport(text, 'Anthropic/Claude');
    }
  } catch (e) { console.warn('[AI] Anthropic failed:', e.message); }

  // Try Gemini
  try {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      const { data } = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 3000 } },
        { timeout: 45000 }
      );
      const text = data.candidates[0].content.parts[0].text;
      return parseAIReport(text, 'Google/Gemini');
    }
  } catch (e) { console.warn('[AI] Gemini failed:', e.message); }

  // Fallback — auto-generated report
  return generateFallbackReport(url, analysisData);
}

function parseAIReport(text, provider) {
  let priorityTable = [];
  let cleanText = text;

  const tableMatch = text.match(/PRIORITY_TABLE_JSON:\s*(\[[\s\S]*?\])/);
  if (tableMatch) {
    try { priorityTable = JSON.parse(tableMatch[1]); } catch {}
    cleanText = text.replace(/PRIORITY_TABLE_JSON:[\s\S]*$/, '').trim();
  }

  const extractSection = (label) => {
    const rx = new RegExp(`###\\s*${label}[\\s\\S]*?(?=###|$)`, 'i');
    const m = cleanText.match(rx);
    return m ? m[0].replace(/###.*\n/, '').trim() : '';
  };

  return {
    summary:       extractSection('WEBSITE HEALTH SUMMARY') || cleanText.substring(0, 500),
    websiteHealth: extractSection('WEBSITE HEALTH SUMMARY'),
    issuesSummary: extractSection('ISSUES FOUND'),
    whatWorksWell: extractSection('WHAT IS WORKING WELL'),
    howToFix:      extractSection('HOW TO FIX THEM'),
    priorityTable,
    finalScore:    null,
    generatedAt:   new Date(),
    provider,
  };
}

function generateFallbackReport(url, { overallScore, scores, issues }) {
  const critical = issues.filter(i => i.impact === 'critical');
  const high     = issues.filter(i => i.impact === 'high');
  const medium   = issues.filter(i => i.impact === 'medium');

  return {
    summary: `Automated audit of ${url} completed with an overall score of ${overallScore}/100. ` +
      `${critical.length} critical, ${high.length} high, and ${medium.length} medium priority issues were found.`,
    websiteHealth: `The website scored ${overallScore}/100 overall. ` +
      `Key areas evaluated include testimonials, trust signals, contact information, social media presence, security badges, content quality, and WCAG accessibility compliance.`,
    issuesSummary: issues.slice(0, 10).map(i => `• [${i.impact.toUpperCase()}] ${i.title}: ${i.description}`).join('\n'),
    whatWorksWell: Object.entries(scores).filter(([_, v]) => v >= 70).map(([k, v]) => `✓ ${k}: ${v}/100`).join('\n') || 'Further manual review recommended.',
    howToFix: issues.slice(0, 5).map(i => `🔧 ${i.title}:\n   ${i.fixSuggestion}`).join('\n\n'),
    priorityTable: issues.map(i => ({
      issue: i.title, impact: i.impact, priority: i.priority, effort: 'Medium', fix: i.fixSuggestion,
    })),
    finalScore: overallScore,
    generatedAt: new Date(),
    provider: 'Automated Fallback',
  };
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN ANALYZE FUNCTION
═══════════════════════════════════════════════════════════════════ */
async function analyzeContentQualityService(url) {
  const record = new ContentQuality({ url, status: 'pending' });
  await record.save();

  try {
    /* 1 — Fetch HTML */
    const { html } = await fetchHTML(url);
    const $ = cheerio.load(html);

    /* 2 — Run all checkers */
    const t   = analyzeTestimonials($, html);
    const tb  = analyzeTrustBadges($, html);
    const rw  = analyzeReviewWidgets($, html);
    const sm  = analyzeSchemaMarkup($, html);
    const ci  = analyzeContactInfo($, html);
    const cp  = analyzeContactPlacement($);
    const lc  = analyzeLiveChat($, html);
    const soc = analyzeSocialMedia($, html);
    const sec = analyzeSecurityBadges(url, $, html);
    const cq  = analyzeContentQuality($, html);
    const wc  = analyzeWCAG($);

    /* 3 — PageSpeed API (non-blocking) */
    const ps = await fetchPageSpeedData(url).catch(() => null);
    const psAccessibility = ps?.accessibilityScore || null;
    const psSEO           = ps?.seoScore || null;

    /* 4 — Category scores */
    const scores = {
      testimonials:      t.sectionScore,
      trustBadges:       tb.sectionScore,
      reviewWidgets:     rw.sectionScore,
      schemaMarkup:      sm.sectionScore,
      contactInfo:       ci.sectionScore,
      contactPlacement:  cp.sectionScore,
      liveChat:          lc.sectionScore,
      socialMedia:       soc.sectionScore,
      securityBadges:    sec.sectionScore,
      contentQuality:    cq.sectionScore,
      wcagAccessibility: psAccessibility ?? wc.sectionScore,
      seoContent:        psSEO ?? Math.round((cq.sectionScore + sm.sectionScore) / 2),
    };

    const overallScore = Math.round(
      Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length
    );

    /* 5 — Merge all issues */
    const allIssues = [
      ...t.issues, ...tb.issues, ...rw.issues, ...sm.issues,
      ...ci.issues, ...cp.issues, ...lc.issues, ...soc.issues,
      ...sec.issues, ...cq.issues, ...wc.issues,
    ].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (order[a.impact] ?? 4) - (order[b.impact] ?? 4);
    });

    /* 6 — AI Report */
    const aiReport = await generateAIReport(url, {
      overallScore, scores, issues: allIssues,
      pageData: cq.pageData,
    });

    /* 7 — Save */
    Object.assign(record, {
      overallScore,
      scores,
      metrics: {
        testimonials:      t.metrics,
        trustBadges:       tb.metrics,
        reviewWidgets:     rw.metrics,
        schemaMarkup:      sm.metrics,
        contactInfo:       ci.metrics,
        contactPlacement:  cp.metrics,
        liveChat:          lc.metrics,
        socialMedia:       soc.metrics,
        securityBadges:    sec.metrics,
        contentQuality:    cq.metrics,
        wcagAccessibility: wc.metrics,
        seoContent:        [],
      },
      pageData: {
        ...cq.pageData,
        hasSSL:   url.startsWith('https://'),
        htmlSize: html.length,
      },
      issues: allIssues,
      aiReport,
      status: 'completed',
    });
    await record.save();

    return record;
  } catch (err) {
    record.status = 'failed';
    record.error  = err.message;
    await record.save();
    throw err;
  }
}

module.exports = { analyzeContentQualityService };