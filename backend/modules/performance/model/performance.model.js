'use strict';
const mongoose = require('mongoose');

const IssueSchema = new mongoose.Schema({
  id:          { type: String },
  title:       { type: String },
  description: { type: String },
  impact:      { type: String, enum: ['high', 'medium', 'low', 'info'] },
  category:    { type: String },
  value:       { type: mongoose.Schema.Types.Mixed },
  savings:     { type: String },
  details:     { type: mongoose.Schema.Types.Mixed },
});

const CoreWebVitalsSchema = new mongoose.Schema({
  lcp:  { value: Number, rating: String, unit: String },
  cls:  { value: Number, rating: String, unit: String },
  fid:  { value: Number, rating: String, unit: String },
  inp:  { value: Number, rating: String, unit: String },
  fcp:  { value: Number, rating: String, unit: String },
  ttfb: { value: Number, rating: String, unit: String },
  tbt:  { value: Number, rating: String, unit: String },
  si:   { value: Number, rating: String, unit: String },
  tti:  { value: Number, rating: String, unit: String },
}, { _id: false });

const ResourceSchema = new mongoose.Schema({
  url:          { type: String },
  type:         { type: String },
  size:         { type: Number, default: 0 },
  transferSize: { type: Number, default: 0 },
  renderBlocking: { type: Boolean, default: false },
  loadTime:     { type: Number, default: 0 },
}, { _id: false });

const ImageSchema = new mongoose.Schema({
  url:             { type: String },
  originalSize:    { type: Number },
  potentialSavings:{ type: Number },
  hasLazyLoad:     { type: Boolean },
  hasModernFormat: { type: Boolean },
  dimensions:      { width: Number, height: Number },
}, { _id: false });

const CacheSchema = new mongoose.Schema({
  url:     { type: String },
  maxAge:  { type: Number },
  rating:  { type: String },
  type:    { type: String },
}, { _id: false });

const PerformanceSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },

  scores: {
    performance:    { type: Number, default: 0 },
    accessibility:  { type: Number, default: 0 },
    bestPractices:  { type: Number, default: 0 },
    seo:            { type: Number, default: 0 },
    overall:        { type: Number, default: 0 },
  },

  coreWebVitals: { type: CoreWebVitalsSchema, default: {} },

  pageLoad: {
    desktop: { type: Number },
    mobile:  { type: Number },
  },

  resources:    { type: [ResourceSchema], default: [] },
  images:       { type: [ImageSchema],   default: [] },
  cacheHeaders: { type: [CacheSchema],   default: [] },

  summary: {
    totalPageSize:        { type: Number },
    totalRequests:        { type: Number },
    totalJSSize:          { type: Number },
    totalCSSSize:         { type: Number },
    totalImageSize:       { type: Number },
    renderBlockingCount:  { type: Number },
    imagesWithoutLazy:    { type: Number },
    poorCacheCount:       { type: Number },
    optimizableImages:    { type: Number },
  },

  issues:      { type: [IssueSchema], default: [] },
  aiReport:    { type: String, default: '' },
  aiGeneratedAt: { type: Date },

  source:      { type: String, default: 'pagespeed' },
  fetchedAt:   { type: Date, default: Date.now },
  createdAt:   { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Performance', PerformanceSchema);