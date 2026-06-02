'use strict';
const mongoose = require('mongoose');

const IssueSchema = new mongoose.Schema({
  id:          String,
  category:    String,
  rule:        String,
  impact:      { type: String, enum: ['critical','serious','moderate','minor'] },
  priority:    { type: String, enum: ['high','medium','low'] },
  wcag:        String,
  description: String,
  element:     String,
  fix:         String,
  count:       { type: Number, default: 1 },
}, { _id: false });

const MetricSchema = new mongoose.Schema({
  name:        String,
  score:       Number,
  status:      { type: String, enum: ['pass','warn','fail','info'] },
  details:     String,
  value:       mongoose.Schema.Types.Mixed,
  wcagCriteria: String,
}, { _id: false });

const AccessibilitySchema = new mongoose.Schema({
  url:          { type: String, required: true },
  analyzedAt:   { type: Date, default: Date.now },
  overallScore: { type: Number, min: 0, max: 100 },
  wcagLevel:    { type: String, enum: ['A', 'AA', 'AAA', 'Non-compliant'] },
  summary: {
    totalIssues:    Number,
    criticalIssues: Number,
    seriousIssues:  Number,
    moderateIssues: Number,
    minorIssues:    Number,
    passedChecks:   Number,
    totalChecks:    Number,
  },
  metrics: {
    altText:          MetricSchema,
    ariaRoles:        MetricSchema,
    colorContrast:    MetricSchema,
    keyboardNav:      MetricSchema,
    screenReader:     MetricSchema,
    focusIndicators:  MetricSchema,
    formLabels:       MetricSchema,
    headingStructure: MetricSchema,
    linkText:         MetricSchema,
    languageAttr:     MetricSchema,
    skipLinks:        MetricSchema,
    tabIndex:         MetricSchema,
    videoAudio:       MetricSchema,
    tableStructure:   MetricSchema,
    readability:      MetricSchema,
    errorIdentification: MetricSchema,
    timeouts:         MetricSchema,
    animations:       MetricSchema,
    textResize:       MetricSchema,
    semanticHTML:     MetricSchema,
  },
  issues:     [IssueSchema],
  aiReport:   { type: String, default: null },
  pdfPath:    { type: String, default: null },
  rawHtml:    { type: String, select: false },
}, { timestamps: true });

module.exports = mongoose.model('Accessibility', AccessibilitySchema);