'use strict';
const mongoose = require('mongoose');

/* ─────────────────────────────────────────────
   SUB-SCHEMAS  (one per audit module)
───────────────────────────────────────────── */

const IssueSchema = new mongoose.Schema({
  module:      { type: String, required: true },
  severity:    { type: String, enum: ['high', 'medium', 'low'], required: true },
  title:       { type: String, required: true },
  detail:      { type: String, required: true },
  recommendation: { type: String, default: '' },
}, { _id: false });

// ── SEO ──────────────────────────────────────
const SeoDataSchema = new mongoose.Schema({
  title:            String,
  titleLength:      Number,
  metaDescription:  String,
  metaDescLength:   Number,
  h1Count:          Number,
  h1Texts:          [String],
  h2Count:          Number,
  h3Count:          Number,
  canonical:        String,
  ogTitle:          String,
  ogDescription:    String,
  ogImage:          String,
  twitterCard:      String,
  robotsMeta:       String,
  structuredDataTypes: [String],
  hreflangTags:     Number,
  keywordDensity:   mongoose.Schema.Types.Mixed,
  internalLinks:    Number,
  externalLinks:    Number,
  imageAltMissing:  Number,
  totalImages:      Number,
  wordCount:        Number,
  readabilityScore: Number,
  hasSitemap:       Boolean,
  hasRobotsTxt:     Boolean,
}, { _id: false });

// ── Performance ──────────────────────────────
const PerformanceDataSchema = new mongoose.Schema({
  performanceScore:    Number,
  firstContentfulPaint: String,
  largestContentfulPaint: String,
  totalBlockingTime:   String,
  cumulativeLayoutShift: String,
  speedIndex:          String,
  timeToInteractive:   String,
  serverResponseTime:  String,
  totalPageSize:       Number,
  totalRequests:       Number,
  imageCount:          Number,
  scriptCount:         Number,
  stylesheetCount:     Number,
  unusedCSSBytes:      Number,
  unusedJSBytes:       Number,
  hasGzip:             Boolean,
  hasBrotli:           Boolean,
  cachePolicy:         String,
  cdnDetected:         Boolean,
  renderBlockingResources: Number,
}, { _id: false });

// ── Accessibility ────────────────────────────
const AccessibilityDataSchema = new mongoose.Schema({
  imgsWithoutAlt:      Number,
  totalImages:         Number,
  inputsWithoutLabel:  Number,
  totalInputs:         Number,
  buttonsWithoutText:  Number,
  linksWithoutText:    Number,
  hasSkipLink:         Boolean,
  langAttribute:       String,
  htmlLang:            String,
  headingStructure:    [Number],
  headingOrderValid:   Boolean,
  colorContrastIssues: Number,
  focusableElements:   Number,
  ariaLandmarks:       Number,
  hasAriaLabels:       Boolean,
  tabIndexAbuse:       Number,
  iframesWithoutTitle: Number,
  videosWithoutCaption: Number,
  formAccessibility:   Number,
  wcagLevel:           String,
}, { _id: false });

// ── Mobile ───────────────────────────────────
const MobileDataSchema = new mongoose.Schema({
  hasViewportMeta:         Boolean,
  viewportContent:         String,
  hasAppleTouchIcon:       Boolean,
  hasFavicon:              Boolean,
  smallTapTargets:         Number,
  totalTapTargets:         Number,
  smallFontSizeElements:   Number,
  horizontalScrollable:    Boolean,
  hasMediaQueries:         Boolean,
  mobileFirstCSS:          Boolean,
  touchEventsUsed:         Boolean,
  fixedWidthElements:      Number,
  pwaManifest:             Boolean,
  serviceWorker:           Boolean,
  mobileScore:             Number,
}, { _id: false });

// ── Security ─────────────────────────────────
const SecurityDataSchema = new mongoose.Schema({
  isHTTPS:                   Boolean,
  hasMixedContent:           Boolean,
  mixedContentCount:         Number,
  hasCSP:                    Boolean,
  cspContent:                String,
  hasHSTS:                   Boolean,
  hasXFrameOptions:          Boolean,
  hasXContentTypeOptions:    Boolean,
  hasReferrerPolicy:         Boolean,
  hasPermissionsPolicy:      Boolean,
  externalScripts:           Number,
  externalScriptDomains:     [String],
  hasIntegrityAttributes:    Number,
  thirdPartyCookies:         Number,
  hasLoginForm:              Boolean,
  loginFormIsHTTPS:          Boolean,
  outdatedLibraries:         [String],
  opensourceLibraries:       [String],
  emailExposed:              Boolean,
  phoneExposed:              Boolean,
  serverHeadersExposed:      Boolean,
}, { _id: false });

// ── Content Quality ───────────────────────────
const ContentDataSchema = new mongoose.Schema({
  wordCount:           Number,
  uniqueWordCount:     Number,
  avgSentenceLength:   Number,
  paragraphCount:      Number,
  hasAboutSection:     Boolean,
  hasContactInfo:      Boolean,
  hasPhone:            Boolean,
  hasEmail:            Boolean,
  hasAddress:          Boolean,
  hasSocialLinks:      Boolean,
  socialPlatforms:     [String],
  hasTestimonials:     Boolean,
  hasBlog:             Boolean,
  hasFAQ:              Boolean,
  hasCallToAction:     Boolean,
  ctaCount:            Number,
  hasVideo:            Boolean,
  videoCount:          Number,
  hasChat:             Boolean,
  brokenImageCount:    Number,
  totalImages:         Number,
  spellingIssues:      Number,
  duplicateContent:    Boolean,
  contentFreshness:    String,
  copyrightYear:       String,
}, { _id: false });

// ── Structure & Navigation ────────────────────
const StructureDataSchema = new mongoose.Schema({
  hasNav:             Boolean,
  navItemCount:       Number,
  hasFooter:          Boolean,
  hasMain:            Boolean,
  hasHeader:          Boolean,
  hasSidebar:         Boolean,
  hasBreadcrumb:      Boolean,
  hasSitemapLink:     Boolean,
  hasSitemapXML:      Boolean,
  hasRobotsTxt:       Boolean,
  totalLinks:         Number,
  internalLinks:      Number,
  externalLinks:      Number,
  brokenAnchorLinks:  Number,
  emptyLinks:         Number,
  maxDepth:           Number,
  hasSearch:          Boolean,
  has404Page:         Boolean,
  menuIsDropdown:     Boolean,
  footerNavLinks:     Number,
  sitemapPageCount:   Number,
}, { _id: false });

// ── UI / UX ───────────────────────────────────
const UIDataSchema = new mongoose.Schema({
  hasCTA:              Boolean,
  ctaButtonCount:      Number,
  hasHeroSection:      Boolean,
  googleFontsCount:    Number,
  inlineStyleCount:    Number,
  cssFileCount:        Number,
  jsFileCount:         Number,
  hasAnimations:       Boolean,
  hasLazyLoading:      Boolean,
  hasProgressiveLoad:  Boolean,
  colorScheme:         String,
  hasLogoImage:        Boolean,
  hasSlider:           Boolean,
  hasModal:            Boolean,
  hasTabs:             Boolean,
  hasAccordion:        Boolean,
  inputPlaceholders:   Boolean,
  formValidation:      Boolean,
  hasLoading:          Boolean,
  aboveTheFoldImages:  Number,
  totalHTMLSize:       Number,
}, { _id: false });

// ── Technical ─────────────────────────────────
const TechnicalDataSchema = new mongoose.Schema({
  hasDoctype:          Boolean,
  hasCharset:          Boolean,
  charset:             String,
  htmlVersion:         String,
  hasRobotsMeta:       Boolean,
  robotsMetaContent:   String,
  hasSchemaMarkup:     Boolean,
  schemaTypes:         [String],
  hasGTM:              Boolean,
  hasGA:               Boolean,
  hasGAProperty:       String,
  hasFacebookPixel:    Boolean,
  hasCookieBanner:     Boolean,
  hasCanonical:        Boolean,
  canonicalURL:        String,
  has404Detection:     Boolean,
  redirectChain:       Number,
  urlStructure:        String,
  hasCleanURLs:        Boolean,
  totalDOMNodes:       Number,
  domDepth:            Number,
  cmsDetected:         String,
  frameworkDetected:   String,
  serverDetected:      String,
  pageGenerationTime:  Number,
  hasHreflang:         Boolean,
  hasXMLSitemap:       Boolean,
  hasImageSitemap:     Boolean,
}, { _id: false });

/* ─────────────────────────────────────────────
   AI REPORT SCHEMA
───────────────────────────────────────────── */
const AIReportSchema = new mongoose.Schema({
  summary:          String,
  overallScore:     Number,
  strengths:        [String],
  criticalIssues:   [String],
  recommendations:  [mongoose.Schema.Types.Mixed],
  moduleInsights:   mongoose.Schema.Types.Mixed,
  executiveSummary: String,
  priorityMatrix:   mongoose.Schema.Types.Mixed,
  estimatedFixTime: String,
  businessImpact:   String,
  generatedAt:      Date,
}, { _id: false });

/* ─────────────────────────────────────────────
   MAIN FULL AUDIT SCHEMA
───────────────────────────────────────────── */
const FullAuditSchema = new mongoose.Schema({
  url:          { type: String, required: true, trim: true },
  domain:       { type: String },
  status:       { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
  errorMessage: { type: String },

  scores: {
    seo:           { type: Number, default: 0 },
    performance:   { type: Number, default: 0 },
    accessibility: { type: Number, default: 0 },
    security:      { type: Number, default: 0 },
    mobile:        { type: Number, default: 0 },
    content:       { type: Number, default: 0 },
    structure:     { type: Number, default: 0 },
    ui:            { type: Number, default: 0 },
    technical:     { type: Number, default: 0 },
  },

  overallScore: { type: Number, default: 0 },

  issues:       [IssueSchema],
  issueCount: {
    high:   { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    low:    { type: Number, default: 0 },
    total:  { type: Number, default: 0 },
  },

  moduleData: {
    seo:           { type: SeoDataSchema,           default: {} },
    performance:   { type: PerformanceDataSchema,   default: {} },
    accessibility: { type: AccessibilityDataSchema, default: {} },
    mobile:        { type: MobileDataSchema,        default: {} },
    security:      { type: SecurityDataSchema,      default: {} },
    content:       { type: ContentDataSchema,       default: {} },
    structure:     { type: StructureDataSchema,     default: {} },
    ui:            { type: UIDataSchema,            default: {} },
    technical:     { type: TechnicalDataSchema,     default: {} },
  },

  aiReport: { type: AIReportSchema, default: null },

  meta: {
    auditDurationMs: Number,
    htmlSize:        Number,
    serverIP:        String,
    httpStatus:      Number,
    redirectCount:   Number,
    finalURL:        String,
    pageLoadTime:    Number,
  },

}, { timestamps: true });

FullAuditSchema.index({ url: 1, createdAt: -1 });
FullAuditSchema.index({ status: 1 });

module.exports = mongoose.model('FullAudit', FullAuditSchema);