'use strict';
const mongoose = require('mongoose');

const IssueSchema = new mongoose.Schema({
  type:        { type: String },
  severity:    { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'] },
  title:       { type: String },
  description: { type: String },
  url:         { type: String },
  detail:      { type: String },
  impact:      { type: String },
  fix:         { type: String },
}, { _id: false });

const PageSchema = new mongoose.Schema({
  url:        { type: String },
  title:      { type: String },
  statusCode: { type: Number },
  depth:      { type: Number },
  internalLinks: [String],
  externalLinks: [String],
  hasCanonical: { type: Boolean },
  hasBreadcrumb: { type: Boolean },
  metaDescription: { type: String },
  h1Count:    { type: Number },
  wordCount:  { type: Number },
  isOrphaned: { type: Boolean, default: false },
}, { _id: false });

const StructureNavigationSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },

  /* ── Crawl & Site Map ── */
  crawl: {
    totalPagesCrawled: Number,
    maxDepthFound:     Number,
    crawlDuration:     Number,
    pages:             [PageSchema],
    sitemapFound:      Boolean,
    sitemapUrl:        String,
    robotsTxtFound:    Boolean,
    robotsTxtUrl:      String,
  },

  /* ── Navigation ── */
  navigation: {
    mainNavLinksTotal:  Number,
    brokenNavLinks:     [String],
    hasMegaMenu:        Boolean,
    hasMobileMenu:      Boolean,
    hasSkipLinks:       Boolean,
    menuDepth:          Number,
    navStructureScore:  Number,
  },

  /* ── Breadcrumbs ── */
  breadcrumbs: {
    found:            Boolean,
    schemaMarkupFound: Boolean,
    schemaType:       String,
    sampleBreadcrumb: String,
    pagesWithBreadcrumb: Number,
    breadcrumbScore:  Number,
  },

  /* ── URL Structure ── */
  urlStructure: {
    seoFriendlyCount:   Number,
    nonSeoFriendlyCount: Number,
    avgUrlLength:       Number,
    urlsWithParameters: Number,
    urlsWithUppercase:  Number,
    urlsWithSpecialChars: Number,
    urlScore:           Number,
    sampleBadUrls:      [String],
  },

  /* ── Internal Linking ── */
  internalLinking: {
    totalInternalLinks: Number,
    avgLinksPerPage:    Number,
    orphanedPages:      [String],
    deepPages:          [String],
    linkEquityScore:    Number,
  },

  /* ── Broken Links ── */
  brokenLinks: {
    total404:           Number,
    total3xx:           Number,
    brokenUrls:         [String],
    redirectChains:     [String],
  },

  /* ── Blog / News ── */
  blog: {
    found:        Boolean,
    blogUrl:      String,
    postCount:    Number,
    hasPagination: Boolean,
    hasCategories: Boolean,
    hasTags:      Boolean,
    lastPostDate: String,
  },

  /* ── Pagination ── */
  pagination: {
    paginatedPages:   Number,
    hasRelNextPrev:   Boolean,
    hasCanonicalOnPaginated: Boolean,
  },

  /* ── Duplicate Content ── */
  duplicateContent: {
    suspectedDuplicates: Number,
    duplicatePairs:      [{ url1: String, url2: String, similarity: Number }],
  },

  /* ── Security ── */
  security: {
    httpsEnabled:       Boolean,
    mixedContent:       Boolean,
    hstsHeader:         Boolean,
    xFrameOptions:      String,
    xContentTypeOptions: Boolean,
    cspHeader:          Boolean,
    referrerPolicy:     String,
    permissionsPolicy:  Boolean,
    serverHeaderExposed: Boolean,
    cookieSecureFlag:   Boolean,
    tlsVersion:         String,
    sslCertValid:       Boolean,
    sslCertExpiry:      String,
    securityScore:      Number,
  },

  /* ── Content Analysis ── */
  content: {
    totalWords:          Number,
    avgWordsPerPage:     Number,
    pagesWithThinContent: Number,
    pagesWithoutH1:      Number,
    pagesWithDuplicateTitle: Number,
    pagesWithoutMetaDesc: Number,
    readabilityScore:    Number,
    contentScore:        Number,
    topKeywords:         [String],
  },

  /* ── Scores ── */
  scores: {
    crawlScore:       Number,
    navigationScore:  Number,
    urlScore:         Number,
    breadcrumbScore:  Number,
    linkingScore:     Number,
    securityScore:    Number,
    contentScore:     Number,
    overallScore:     Number,
  },

  issues: [IssueSchema],

  /* ── AI Report ── */
  aiReport: {
    summary:          String,
    websiteHealth:    String,
    issuesSummary:    String,
    whatWorksWell:    [String],
    criticalFixes:    [String],
    recommendations:  [String],
    priorityTable:    [{
      issue: String, impact: String, priority: String, effort: String, fix: String
    }],
    finalScore:       Number,
    generatedAt:      Date,
    provider:         String,
  },

  status:    { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
  error:     String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

StructureNavigationSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('StructureNavigation', StructureNavigationSchema);