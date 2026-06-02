'use strict';
const mongoose = require('mongoose');

const IssueSchema = new mongoose.Schema({
  type:        { type: String },
  severity:    { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'] },
  category:    { type: String },
  title:       { type: String },
  description: { type: String },
  element:     { type: String },
  recommendation: { type: String },
  impact:      { type: String },
  wcag:        { type: String },
}, { _id: false });

const MetaSchema = new mongoose.Schema({
  title:            { type: String },
  titleLength:      { type: Number },
  titleScore:       { type: Number },
  description:      { type: String },
  descriptionLength:{ type: Number },
  descriptionScore: { type: Number },
  keywords:         { type: String },
  ogTitle:          { type: String },
  ogDescription:    { type: String },
  ogImage:          { type: String },
  ogType:           { type: String },
  twitterCard:      { type: String },
  twitterTitle:     { type: String },
  twitterDescription:{ type: String },
  canonical:        { type: String },
  robots:           { type: String },
  viewport:         { type: String },
  charset:          { type: String },
  language:         { type: String },
  hreflang:         [String],
  score:            { type: Number },
  issues:           [IssueSchema],
}, { _id: false });

const HeadingSchema = new mongoose.Schema({
  tag:   { type: String },
  text:  { type: String },
  level: { type: Number },
}, { _id: false });

const HeadingAnalysisSchema = new mongoose.Schema({
  h1Count:       { type: Number },
  h2Count:       { type: Number },
  h3Count:       { type: Number },
  h4Count:       { type: Number },
  h5Count:       { type: Number },
  h6Count:       { type: Number },
  hierarchy:     { type: Boolean },
  headings:      [HeadingSchema],
  score:         { type: Number },
  issues:        [IssueSchema],
}, { _id: false });

const ImageSeoSchema = new mongoose.Schema({
  src:       { type: String },
  alt:       { type: String },
  hasAlt:    { type: Boolean },
  altLength: { type: Number },
  title:     { type: String },
  isDecorative: { type: Boolean },
}, { _id: false });

const ImageAnalysisSchema = new mongoose.Schema({
  total:         { type: Number },
  withAlt:       { type: Number },
  withoutAlt:    { type: Number },
  emptyAlt:      { type: Number },
  images:        [ImageSeoSchema],
  score:         { type: Number },
  issues:        [IssueSchema],
}, { _id: false });

const KeywordSchema = new mongoose.Schema({
  keyword:   { type: String },
  count:     { type: Number },
  density:   { type: Number },
  inTitle:   { type: Boolean },
  inMeta:    { type: Boolean },
  inH1:      { type: Boolean },
  inH2:      { type: Boolean },
  inContent: { type: Boolean },
}, { _id: false });

const KeywordAnalysisSchema = new mongoose.Schema({
  topKeywords:    [KeywordSchema],
  wordCount:      { type: Number },
  uniqueWords:    { type: Number },
  score:          { type: Number },
  issues:         [IssueSchema],
}, { _id: false });

const LinkSchema = new mongoose.Schema({
  url:        { type: String },
  text:       { type: String },
  type:       { type: String, enum: ['internal', 'external'] },
  status:     { type: Number },
  isBroken:   { type: Boolean },
  isNofollow: { type: Boolean },
  hasTitle:   { type: Boolean },
}, { _id: false });

const LinkAnalysisSchema = new mongoose.Schema({
  totalLinks:    { type: Number },
  internalLinks: { type: Number },
  externalLinks: { type: Number },
  brokenLinks:   { type: Number },
  nofollowLinks: { type: Number },
  links:         [LinkSchema],
  score:         { type: Number },
  issues:        [IssueSchema],
}, { _id: false });

const TechnicalSeoSchema = new mongoose.Schema({
  sitemapExists:       { type: Boolean },
  sitemapUrl:          { type: String },
  sitemapValid:        { type: Boolean },
  sitemapUrlCount:     { type: Number },
  robotsTxtExists:     { type: Boolean },
  robotsTxtContent:    { type: String },
  robotsAllowsIndexing:{ type: Boolean },
  hasSSL:              { type: Boolean },
  httpsRedirect:       { type: Boolean },
  wwwRedirect:         { type: Boolean },
  pageSpeed:           { type: Number },
  mobileFriendly:      { type: Boolean },
  structuredData:      { type: Boolean },
  structuredDataTypes: [String],
  structuredDataValid: { type: Boolean },
  ampExists:           { type: Boolean },
  hasXmlSitemap:       { type: Boolean },
  hasPagination:       { type: Boolean },
  hasHreflang:         { type: Boolean },
  score:               { type: Number },
  issues:              [IssueSchema],
}, { _id: false });

const ContentAnalysisSchema = new mongoose.Schema({
  wordCount:          { type: Number },
  readabilityScore:   { type: Number },
  readabilityGrade:   { type: String },
  fleschKincaid:      { type: Number },
  avgSentenceLength:  { type: Number },
  avgWordLength:      { type: Number },
  paragraphCount:     { type: Number },
  sentenceCount:      { type: Number },
  hasVideo:           { type: Boolean },
  hasAudio:           { type: Boolean },
  hasFAQ:             { type: Boolean },
  contentFreshness:   { type: String },
  duplicateContent:   { type: Boolean },
  thinContent:        { type: Boolean },
  score:              { type: Number },
  issues:             [IssueSchema],
}, { _id: false });

const StructuredDataSchema = new mongoose.Schema({
  type:      { type: String },
  raw:       { type: String },
  valid:     { type: Boolean },
  errors:    [String],
}, { _id: false });

const SocialSchema = new mongoose.Schema({
  hasOpenGraph:       { type: Boolean },
  hasTwitterCard:     { type: Boolean },
  hasSchemaOrg:       { type: Boolean },
  facebookPixel:      { type: Boolean },
  googleAnalytics:    { type: Boolean },
  googleTagManager:   { type: Boolean },
  score:              { type: Number },
  issues:             [IssueSchema],
}, { _id: false });

const PageSpeedSchema = new mongoose.Schema({
  score:              { type: Number },
  fcp:               { type: Number },
  lcp:               { type: Number },
  cls:               { type: Number },
  ttfb:              { type: Number },
  tti:               { type: Number },
  tbt:               { type: Number },
  source:            { type: String },
}, { _id: false });

const SeoSchema = new mongoose.Schema({
  url:              { type: String, required: true, trim: true },
  finalUrl:         { type: String },
  domain:           { type: String },
  analysisDuration: { type: Number },
  overallScore:     { type: Number, default: 0 },

  meta:             MetaSchema,
  headings:         HeadingAnalysisSchema,
  images:           ImageAnalysisSchema,
  keywords:         KeywordAnalysisSchema,
  links:            LinkAnalysisSchema,
  technical:        TechnicalSeoSchema,
  content:          ContentAnalysisSchema,
  structuredData:   [StructuredDataSchema],
  social:           SocialSchema,
  pageSpeed:        PageSpeedSchema,

  categoryScores: {
    meta:        { type: Number },
    headings:    { type: Number },
    images:      { type: Number },
    keywords:    { type: Number },
    links:       { type: Number },
    technical:   { type: Number },
    content:     { type: Number },
    social:      { type: Number },
  },

  allIssues:        [IssueSchema],
  criticalCount:    { type: Number, default: 0 },
  highCount:        { type: Number, default: 0 },
  mediumCount:      { type: Number, default: 0 },
  lowCount:         { type: Number, default: 0 },

  aiReport:         { type: String, default: '' },
  aiGeneratedAt:    { type: Date },

  createdAt:        { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('SeoAnalysis', SeoSchema);