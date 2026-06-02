'use strict';
const mongoose = require('mongoose');

/* ── Sub-schemas ── */

const IssueSchema = new mongoose.Schema({
  category : { type: String },
  title    : { type: String },
  detail   : { type: String },
  severity : { type: String, enum: ['high', 'medium', 'low'] },
  priority : { type: Number },          // 1 = highest
  fix      : { type: String },
  impact   : { type: String },
}, { _id: false });

const ScoreSchema = new mongoose.Schema({
  overall    : { type: Number, default: 0 },
  domain     : { type: Number, default: 0 },
  security   : { type: Number, default: 0 },
  content    : { type: Number, default: 0 },
  technical  : { type: Number, default: 0 },
  backlinks  : { type: Number, default: 0 },
}, { _id: false });

/* ── AI Report Sub-schema ── */
const AIReportSchema = new mongoose.Schema({
  summary: { type: String },
  workingWell: { type: [String], default: [] },
  issues: { type: [String], default: [] },
  recommendations: { type: [String], default: [] },
  businessImpact: { type: String },
  priorityTable: { type: [mongoose.Schema.Types.Mixed], default: [] },
  generatedAt: { type: Date }
}, { _id: false });

/* ── Main Schema ── */
const TechnicalInsightSchema = new mongoose.Schema({
  url        : { type: String, required: true, trim: true },
  status     : { type: String, enum: ['pending','processing','completed','failed'], default: 'pending' },
  error      : { type: String },

  /* ── Analysis buckets ── */
  domain     : { type: mongoose.Schema.Types.Mixed, default: {} },
  backlinks  : { type: mongoose.Schema.Types.Mixed, default: {} },
  technology : { type: mongoose.Schema.Types.Mixed, default: {} },
  jsAnalysis : { type: mongoose.Schema.Types.Mixed, default: {} },
  schema     : { type: mongoose.Schema.Types.Mixed, default: {} },
  network    : { type: mongoose.Schema.Types.Mixed, default: {} },
  dns        : { type: mongoose.Schema.Types.Mixed, default: {} },
  cdn        : { type: mongoose.Schema.Types.Mixed, default: {} },
  security   : { type: mongoose.Schema.Types.Mixed, default: {} },
  ssl        : { type: mongoose.Schema.Types.Mixed, default: {} },
  content    : { type: mongoose.Schema.Types.Mixed, default: {} },
  seoContent : { type: mongoose.Schema.Types.Mixed, default: {} },
  accessibility: { type: mongoose.Schema.Types.Mixed, default: {} },

  issues     : { type: [IssueSchema], default: [] },
  scores     : { type: ScoreSchema, default: () => ({}) },

  /* ── AI report ── */
  aiReport: { type: AIReportSchema, default: () => ({}) },

  createdAt  : { type: Date, default: Date.now },
  updatedAt  : { type: Date, default: Date.now },

}, { timestamps: true });

/* Index */
TechnicalInsightSchema.index({ url: 1, createdAt: -1 });

module.exports = mongoose.model('TechnicalInsight', TechnicalInsightSchema);