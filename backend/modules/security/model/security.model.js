'use strict';
const mongoose = require('mongoose');

const SecuritySchema = new mongoose.Schema({
  url: { type: String, required: true },
  analyzedAt: { type: Date, default: Date.now },

  ssl: {
    valid: Boolean,
    issuer: String,
    subject: String,
    validFrom: String,
    validTo: String,
    daysUntilExpiry: Number,
    protocol: String,
    keyBits: Number,
    signatureAlgorithm: String,
    isTrusted: Boolean,
    hostnameMatch: Boolean,
    grade: String,
  },

  https: {
    enforced: Boolean,
    redirectsToHttps: Boolean,
    mixedContent: Boolean,
    mixedContentItems: [String],
  },

  headers: {
    csp: { present: Boolean, value: String, issues: [String] },
    hsts: { present: Boolean, value: String, maxAge: Number, includesSubDomains: Boolean, preload: Boolean },
    xContentTypeOptions: { present: Boolean, value: String },
    xFrameOptions: { present: Boolean, value: String },
    xXssProtection: { present: Boolean, value: String },
    referrerPolicy: { present: Boolean, value: String },
    permissionsPolicy: { present: Boolean, value: String },
    cacheControl: { present: Boolean, value: String },
    serverHeader: { present: Boolean, value: String, exposesInfo: Boolean },
    xPoweredBy: { present: Boolean, value: String, exposesInfo: Boolean },
  },

  cookies: [{
    name: String,
    httpOnly: Boolean,
    secure: Boolean,
    sameSite: String,
    domain: String,
    path: String,
    expires: String,
    issues: [String],
  }],

  forms: {
    total: Number,
    insecure: Number,
    items: [{ action: String, method: String, hasPassword: Boolean, isInsecure: Boolean }],
  },

  safeBrowsing: {
    checked: Boolean,
    safe: Boolean,
    threats: [String],
    apiUsed: Boolean,
  },

  cms: {
    detected: Boolean,
    name: String,
    version: String,
    vulnerabilities: [{ cve: String, severity: String, description: String }],
  },

  dnsSecurity: {
    dnssecEnabled: Boolean,
    spfRecord: { present: Boolean, value: String, valid: Boolean },
    dkimRecord: { present: Boolean, value: String },
    dmarcRecord: { present: Boolean, value: String, valid: Boolean },
    mxRecords: [String],
    aaaaRecords: [String],
    caaRecords: [String],
  },

  openRedirects: { detected: Boolean, count: Number, items: [String] },

  subresourceIntegrity: { checked: Boolean, total: Number, withSRI: Number, withoutSRI: Number, items: [{ src: String, hasSRI: Boolean }] },

  clickjacking: { protected: Boolean, method: String },

  informationDisclosure: {
    serverVersionExposed: Boolean,
    phpVersionExposed: Boolean,
    aspVersionExposed: Boolean,
    robotsTxtExists: Boolean,
    sitemapExists: Boolean,
    sensitivePaths: [{ path: String, accessible: Boolean }],
  },

  portScan: {
    checked: Boolean,
    openPorts: [Number],
    riskyPorts: [Number],
  },

  corsPolicy: {
    present: Boolean,
    value: String,
    isWildcard: Boolean,
    issues: [String],
  },

  rateLimit: { detected: Boolean, headers: [String] },

  tlsDetails: {
    supportsTls10: Boolean,
    supportsTls11: Boolean,
    supportsTls12: Boolean,
    supportsTls13: Boolean,
    weakCiphers: [String],
  },

  score: { type: Number, default: 0 },
  grade: { type: String, default: 'F' },

  issues: [{
    category: String,
    severity: { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'] },
    title: String,
    description: String,
    recommendation: String,
  }],

  aiReport: {
    generated: { type: Boolean, default: false },
    summary: String,
    whatWorksWell: [String],
    issuesSummary: [String],
    recommendations: [String],
    finalScore: Number,
    generatedAt: Date,
    provider: String,
  },

  pdfPath: String,
}, { timestamps: true });

module.exports = mongoose.model('Security', SecuritySchema);