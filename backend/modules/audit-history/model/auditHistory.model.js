'use strict';

const mongoose = require('mongoose');

const AuditHistorySchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    module: {
      type:    String,
      required: true,
      enum: [
        'ui-analysis',
        'mobile-friendliness',
        'accessibility',
        'seo',
        'performance',
        'security',
        'content-quality',
        'structure-navigation',
        'technical-insight',
        'full-audit',
      ],
    },

    url: {
      type:     String,
      required: true,
      trim:     true,
    },

    score: {
      type:    Number,
      min:     0,
      max:     100,
      default: null,
    },

    issueCount: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /* Reference to the actual audit document in the module's own collection */
    auditId: {
      type:    mongoose.Schema.Types.ObjectId,
      default: null,
    },

    /* Snapshot of key metrics for quick display without loading the full doc */
    summary: {
      type:    mongoose.Schema.Types.Mixed,
      default: {},
    },

    /* AI report status */
    hasAIReport: {
      type:    Boolean,
      default: false,
    },

    /* PDF report status */
    hasPDF: {
      type:    Boolean,
      default: false,
    },

    status: {
      type:    String,
      enum:    ['completed', 'failed', 'pending'],
      default: 'completed',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* Compound index for efficient user history queries */
AuditHistorySchema.index({ userId: 1, createdAt: -1 });
AuditHistorySchema.index({ userId: 1, module: 1, createdAt: -1 });

const AuditHistory = mongoose.model('AuditHistory', AuditHistorySchema);

module.exports = AuditHistory;