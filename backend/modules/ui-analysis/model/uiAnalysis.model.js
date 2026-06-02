'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

/* ── Reusable building blocks ── */
const headingLevelSchema = new Schema({
  count: Number, texts: [String], avgLength: Number,
}, { _id: false });

/* ── Logo ── */
const logoSchema = new Schema({
  detected: Boolean, placement: String, position: String,
  isLinkedToHome: Boolean, hasAltText: Boolean, altText: String,
  isSVG: Boolean, isImage: Boolean, srcValue: String,
  appearsInHeader: Boolean, appearsInFooter: Boolean,
  score: { type: Number, min: 0, max: 100 },
}, { _id: false });

/* ── Typography ── */
const typographySchema = new Schema({
  score: { type: Number, min: 0, max: 100 },
  fontFamilies: [String], fontFamilyCount: Number,
  googleFontsDetected: Boolean, systemFontsOnly: Boolean,
  fontWeightsUsed: [String], fontSizesInCSS: [String],
  lineHeightValues: [String], letterSpacingUsed: Boolean,
  textTransformUsed: Boolean, fontSmoothing: Boolean,
  headings: {
    h1: headingLevelSchema, h2: headingLevelSchema,
    h3: headingLevelSchema, h4: headingLevelSchema,
    h5: headingLevelSchema, h6: headingLevelSchema,
    totalCount: Number, hierarchyValid: Boolean,
    skippedLevels: [String], h1ToH2Ratio: String,
    h2ToH3Ratio: String, firstH1Text: String,
  },
  bodyText: {
    wordCount: Number, paragraphCount: Number,
    avgWordsPerParagraph: Number, shortParagraphs: Number,
  },
}, { _id: false });

/* ── Color ── */
const colorSchema = new Schema({
  score: { type: Number, min: 0, max: 100 },
  rawColors: [String], uniqueColorCount: Number,
  backgroundColors: [String], textColors: [String],
  borderColors: [String], gradientUsage: Boolean,
  cssVariablesUsed: Boolean, darkModeSupport: Boolean,
  contrastIssues: [{ element: String, issue: String, _id: false }],
}, { _id: false });

/* ── Image ── */
const imageItemSchema = new Schema({
  src: String, alt: String, hasAlt: Boolean, isLazy: Boolean,
  hasSrcset: Boolean, format: String, placement: String,
  width: String, height: String, isDecorative: Boolean,
}, { _id: false });

const imageAnalysisSchema = new Schema({
  score: { type: Number, min: 0, max: 100 },
  totalImages: Number, withAlt: Number, withoutAlt: Number,
  altTextRatioPct: Number, lazyLoadedCount: Number,
  lazyLoadRatioPct: Number, withSrcset: Number,
  hasPictureTag: Boolean, svgCount: Number, webpCount: Number,
  gifCount: Number, backgroundImages: Number,
  heroImagePresent: Boolean, decorativeImages: Number,
  brokenSrcCount: Number, items: [imageItemSchema],
  placementBreakdown: {
    hero: Number, card: Number, inline: Number,
    icon: Number, background: Number, unknown: Number,
  },
}, { _id: false });

/* ── Layout ── */
const layoutSchema = new Schema({
  score: { type: Number, min: 0, max: 100 },
  hasMaxWidth: Boolean, hasContainer: Boolean,
  usesFlexbox: Boolean, usesCSSGrid: Boolean,
  usesFloat: Boolean, usesTable: Boolean,
  hasHeroSection: Boolean, hasStickyElement: Boolean,
  hasFixedElement: Boolean, sectionCount: Number,
  columnPatterns: [String],
  spacingSystem: {
    usesRemUnits: Boolean, usesEmUnits: Boolean,
    usesPxUnits: Boolean, mixedUnits: Boolean,
  },
  borderRadius: { values: [String], isConsistent: Boolean },
  shadowUsage: { detected: Boolean, values: [String] },
  zIndexValues: [String], overflowHiddenCount: Number,
}, { _id: false });

/* ── Navigation ── */
const navSchema = new Schema({
  score: { type: Number, min: 0, max: 100 },
  primaryNavPresent: Boolean, primaryNavItems: Number,
  hasDropdown: Boolean, hasMobileMenu: Boolean,
  hasBreadcrumb: Boolean, hasSearch: Boolean,
  hasStickyNav: Boolean, hasSkipLink: Boolean,
  footerNavPresent: Boolean, footerNavItems: Number,
  socialLinks: Number, primaryNavLinks: [String],
  isOverloaded: Boolean, depth: Number,
}, { _id: false });

/* ── CTA ── */
const ctaSchema = new Schema({
  score: { type: Number, min: 0, max: 100 },
  totalButtons: Number, primaryCTAPresent: Boolean,
  primaryCTAText: String, ctaInHero: Boolean,
  ctaAboveFold: Boolean, ctaTexts: [String],
  weakCTACount: Number, strongCTACount: Number,
  buttonStyleConsistency: Boolean, buttonTypes: [String],
  hasFloatingCTA: Boolean,
}, { _id: false });

/* ── Header/Footer ── */
const headerFooterSchema = new Schema({
  score: { type: Number, min: 0, max: 100 },
  header: {
    present: Boolean, hasLogo: Boolean, hasNav: Boolean,
    hasCTA: Boolean, hasPhone: Boolean, hasSearch: Boolean, isSticky: Boolean,
  },
  footer: {
    present: Boolean, hasLogo: Boolean, hasLinks: Boolean,
    hasCopyright: Boolean, hasSocialLinks: Boolean, hasContactInfo: Boolean,
    hasPrivacyLink: Boolean, hasTermsLink: Boolean, hasSitemapLink: Boolean,
    hasNewsletter: Boolean, columnCount: Number, linkCount: Number,
  },
}, { _id: false });

/* ── Content ── */
const contentSchema = new Schema({
  score: { type: Number, min: 0, max: 100 },
  hasHeroSection: Boolean, heroHasHeading: Boolean,
  heroHasCTA: Boolean, heroHasImage: Boolean, heroHasSubheadline: Boolean,
  hasAboutSection: Boolean, hasServicesSection: Boolean,
  hasPricingSection: Boolean, hasTestimonialsSection: Boolean,
  hasContactSection: Boolean, hasFAQSection: Boolean,
  hasBlogSection: Boolean, hasTeamSection: Boolean,
  socialProof: {
    hasTestimonials: Boolean, hasReviews: Boolean, hasRatings: Boolean,
    hasClientLogos: Boolean, hasCounterStats: Boolean, testimonialCount: Number,
  },
  trustSignals: {
    hasGuaranteeBadge: Boolean, hasCertifications: Boolean,
    hasAwards: Boolean, hasMediaMentions: Boolean, hasTrustBadges: Boolean,
  },
  contactInfo: {
    hasPhone: Boolean, hasEmail: Boolean, hasAddress: Boolean,
    hasContactForm: Boolean, hasLiveChat: Boolean,
  },
  wordCount: Number, paragraphCount: Number,
}, { _id: false });

/* ── Technical ── */
const technicalSchema = new Schema({
  score: { type: Number, min: 0, max: 100 },
  meta: {
    hasTitle: Boolean, titleLength: Number, titleText: String,
    hasDescription: Boolean, descriptionLength: Number, descriptionText: String,
    hasViewport: Boolean, hasCharset: Boolean, hasCanonical: Boolean,
    hasRobots: Boolean, themeColor: String,
  },
  openGraph: {
    hasOgTitle: Boolean, hasOgDescription: Boolean, hasOgImage: Boolean,
    hasOgUrl: Boolean, hasOgType: Boolean, completenessScore: Number,
  },
  twitterCard: { hasTwitterCard: Boolean, cardType: String },
  structuredData: { hasJsonLd: Boolean, hasMicrodata: Boolean, schemaTypes: [String] },
  performance: {
    inlineScriptCount: Number, externalScriptCount: Number,
    deferredScripts: Number, asyncScripts: Number,
    inlineStyleCount: Number, externalCSSCount: Number,
    preloadLinks: Number, hasFavicon: Boolean,
    hasAppleTouchIcon: Boolean, hasManifest: Boolean,
  },
  accessibility: {
    score: Number, hasSkipLink: Boolean,
    hasLangAttribute: Boolean, langValue: String,
    ariaLabels: Number, ariaRoles: Number, tabIndexUsage: Number,
    formLabels: Number, inputsWithoutLabel: Number,
    hasAriaLive: Boolean, hasFocusStyles: Boolean,
  },
}, { _id: false });

/* ── Responsiveness ── */
const responsivenessSchema = new Schema({
  score: { type: Number, min: 0, max: 100 },
  hasViewportMeta: Boolean, viewportContent: String,
  hasMediaQueries: Boolean, mediaQueryCount: Number,
  breakpoints: [String], hasFluidImages: Boolean,
  hasFluidTypography: Boolean, hasMobileNavigation: Boolean,
  hasHamburgerMenu: Boolean,
  frameworkDetected: String,
}, { _id: false });

/* ── Design Consistency ── */
const consistencySchema = new Schema({
  score: { type: Number, min: 0, max: 100 },
  buttonStyleConsistency: Boolean, colorUsageConsistency: Boolean,
  fontConsistency: Boolean, spacingConsistency: Boolean,
  iconLibraryDetected: String, cssFrameworkDetected: String,
  animationsDetected: Boolean, transitionsDetected: Boolean,
  hoverStatesDetected: Boolean,
}, { _id: false });

/* ── Issue ── */
const issueSchema = new Schema({
  title: String, description: String, affectedElement: String,
  severity: { type: String, enum: ['critical', 'medium', 'low'] },
  category: { type: String, enum: [
    'logo','typography','color','images','layout','navigation',
    'cta','content','footer','header','accessibility',
    'responsiveness','technical','consistency','general',
  ]},
  recommendation: String, wcagReference: String,
}, { _id: false });

/* ── AI Insights ── */
const aiInsightsSchema = new Schema({
  healthScore: Number, summary: String,
  strengths: [String], identifiedIssues: [String],
  fixes: [{ title: String, description: String, priority: String, effort: String, impact: String, _id: false }],
  priority: [{ item: String, reason: String, impact: String, _id: false }],
  designSystemScore: Number, conversionScore: Number,
  brandingScore: Number, provider: String,
}, { _id: false });

/* ═══════════════════════════════════════════════════════════
   ROOT DOCUMENT
═══════════════════════════════════════════════════════════ */
const uiAnalysisSchema = new Schema({
  url: { type: String, required: true, trim: true },
  pageTitle: String, favicon: String, crawledAt: Date,

  logo: logoSchema, typography: typographySchema,
  colors: colorSchema, images: imageAnalysisSchema,
  layout: layoutSchema, navigation: navSchema,
  cta: ctaSchema, headerFooter: headerFooterSchema,
  content: contentSchema, technical: technicalSchema,
  responsiveness: responsivenessSchema, consistency: consistencySchema,

  issues: [issueSchema], aiInsights: aiInsightsSchema,

  scores: {
    overall: Number, design: Number, usability: Number,
    content: Number, technical: Number, accessibility: Number, branding: Number,
  },

  status: { type: String, enum: ['pending','analyzing','completed','failed'], default: 'pending' },
  errorMessage: String,
}, { collection: 'ui_analysis_reports', timestamps: true });

uiAnalysisSchema.index({ url: 1, createdAt: -1 });
uiAnalysisSchema.index({ status: 1 });

module.exports = mongoose.model('UIAnalysis', uiAnalysisSchema);