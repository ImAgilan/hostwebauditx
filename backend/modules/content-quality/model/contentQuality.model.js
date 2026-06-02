'use strict';
const mongoose = require('mongoose');

const IssueSchema = new mongoose.Schema({
  id:          { type: String },
  category:    { type: String },
  title:       { type: String },
  description: { type: String },
  impact:      { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'] },
  priority:    { type: String, enum: ['P1', 'P2', 'P3', 'P4'] },
  fixSuggestion: { type: String },
  element:     { type: String },
  passed:      { type: Boolean, default: false },
});

const MetricSchema = new mongoose.Schema({
  name:        { type: String },
  value:       { type: mongoose.Schema.Types.Mixed },
  score:       { type: Number, min: 0, max: 100 },
  status:      { type: String, enum: ['pass', 'warn', 'fail', 'info'] },
  description: { type: String },
  details:     { type: mongoose.Schema.Types.Mixed },
});

const ContentQualitySchema = new mongoose.Schema({
  url:       { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },

  overallScore: { type: Number, min: 0, max: 100, default: 0 },

  /* ── Category scores ── */
  scores: {
    testimonials:     { type: Number, default: 0 },
    trustBadges:      { type: Number, default: 0 },
    reviewWidgets:    { type: Number, default: 0 },
    schemaMarkup:     { type: Number, default: 0 },
    contactInfo:      { type: Number, default: 0 },
    contactPlacement: { type: Number, default: 0 },
    liveChat:         { type: Number, default: 0 },
    socialMedia:      { type: Number, default: 0 },
    securityBadges:   { type: Number, default: 0 },
    contentQuality:   { type: Number, default: 0 },
    wcagAccessibility:{ type: Number, default: 0 },
    seoContent:       { type: Number, default: 0 },
  },

  /* ── Detailed metrics per category ── */
  metrics: {
    testimonials:      [MetricSchema],
    trustBadges:       [MetricSchema],
    reviewWidgets:     [MetricSchema],
    schemaMarkup:      [MetricSchema],
    contactInfo:       [MetricSchema],
    contactPlacement:  [MetricSchema],
    liveChat:          [MetricSchema],
    socialMedia:       [MetricSchema],
    securityBadges:    [MetricSchema],
    contentQuality:    [MetricSchema],
    wcagAccessibility: [MetricSchema],
    seoContent:        [MetricSchema],
  },

  /* ── Raw page data ── */
  pageData: {
    title:          { type: String },
    metaDescription:{ type: String },
    wordCount:      { type: Number },
    headings:       { type: mongoose.Schema.Types.Mixed },
    images:         { type: Number },
    links:          { type: Number },
    hasSSL:         { type: Boolean },
    loadTime:       { type: Number },
    htmlSize:       { type: Number },
  },

  /* ── All issues ── */
  issues: [IssueSchema],

  /* ── AI report ── */
  aiReport: {
    summary:          { type: String },
    websiteHealth:    { type: String },
    issuesSummary:    { type: String },
    whatWorksWell:    { type: String },
    howToFix:         { type: String },
    priorityTable:    { type: mongoose.Schema.Types.Mixed },
    finalScore:       { type: Number },
    generatedAt:      { type: Date },
    provider:         { type: String },
  },

  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  error:  { type: String },
}, { timestamps: true });

ContentQualitySchema.index({ url: 1, createdAt: -1 });

module.exports = mongoose.model('ContentQuality', ContentQualitySchema);