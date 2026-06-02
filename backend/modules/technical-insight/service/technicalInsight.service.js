'use strict';
/**
 * technicalInsight.service.js
 * Orchestrates all analyzers → stores results → generates AI report
 */

const TechnicalInsight  = require('../model/technicalInsight.model');
const { analyzeDomain, analyzeBacklinks, analyzeTechStack, analyzeDNS, analyzeCDN, analyzeProtocol }
                        = require('./analyzers/domain.analyzer');
const { analyzeSecurityHeaders, analyzeCookies, analyzeVulnerabilities, analyzeMalware }
                        = require('./analyzers/security.analyzer');
const { analyzeContent, analyzeSEOContent, analyzeSchema, analyzeJSDependency, analyzeAccessibility }
                        = require('./analyzers/content.analyzer');
const { generateAuditReport } = require('../../../shared/services/ai.service');
const { calculateScores, prioritizeIssues } = require('../utils/score.utils');
const { generatePDF }   = require('../utils/pdf.utils');

/* ═══════════════════════════════════════
   MAIN ANALYZE FUNCTION
═══════════════════════════════════════ */
async function runFullAudit(targetUrl) {
  /* Normalize URL */
  const cleanUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;

  /* Create initial DB record */
  const record = await TechnicalInsight.create({ url: cleanUrl, status: 'processing' });

  try {
    console.log(`[TI] Starting audit for ${cleanUrl}`);

    /* ── Run all analyzers in parallel where possible ── */
    const [
      domain,
      backlinks,
      technology,
      dns,
      cdn,
      protocol,
      securityHeaders,
      cookies,
      vulnerabilities,
      malware,
      content,
      seoContent,
      schema,
      jsAnalysis,
      accessibility,
    ] = await Promise.allSettled([
      analyzeDomain(cleanUrl),
      analyzeBacklinks(cleanUrl),
      analyzeTechStack(cleanUrl),
      analyzeDNS(cleanUrl),
      analyzeCDN(cleanUrl),
      analyzeProtocol(cleanUrl),
      analyzeSecurityHeaders(cleanUrl),
      analyzeCookies(cleanUrl),
      analyzeVulnerabilities(cleanUrl),
      analyzeMalware(cleanUrl),
      analyzeContent(cleanUrl),
      analyzeSEOContent(cleanUrl),
      analyzeSchema(cleanUrl),
      analyzeJSDependency(cleanUrl),
      analyzeAccessibility(cleanUrl),
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message }));

    /* ── Aggregate all issues ── */
    const allIssues = [
      ...(securityHeaders?.issues || []),
      ...(cookies?.issues         || []),
      ...(vulnerabilities?.issues || []),
      ...(dns?.issues             || []),
      ...(seoContent?.issues      || []),
      ...(content?.issues         || []),
      ...(schema?.issues          || []),
      ...(jsAnalysis?.issues      || []),
      ...(accessibility?.issues   || []),
    ];
    const issues = prioritizeIssues(allIssues);

    /* ── Calculate scores ── */
    const analysisData = { domain, backlinks, technology, dns, cdn, protocol, securityHeaders, cookies, vulnerabilities, malware, content, seoContent, schema, jsAnalysis, accessibility, issues };
    const scores       = calculateScores({ ...analysisData, protocol, ssl: protocol });

    /* ── Save to DB ── */
    record.domain          = domain;
    record.backlinks       = backlinks;
    record.technology      = technology;
    record.dns             = dns;
    record.cdn             = cdn;
    record.network         = protocol;
    record.ssl             = protocol;
    record.securityHeaders = securityHeaders;
    record.cookies         = cookies;
    record.vulnerabilities = vulnerabilities;
    record.malware         = malware;
    record.content         = content;
    record.seoContent      = seoContent;
    record.schema          = schema;
    record.jsAnalysis      = jsAnalysis;
    record.accessibility   = accessibility;
    record.issues          = issues;
    record.scores          = scores;
    record.status          = 'completed';
    await record.save();

    console.log(`[TI] Audit completed. Score: ${scores.overall}`);
    return record;

  } catch (err) {
    record.status = 'failed';
    record.error  = err.message;
    await record.save();
    throw err;
  }
}

/* ═══════════════════════════════════════
   AI REPORT
═══════════════════════════════════════ */
async function generateReport(reportId) {
  const record = await TechnicalInsight.findById(reportId);
  if (!record) throw new Error('Report not found');
  if (record.status !== 'completed') throw new Error('Audit not yet completed');

  if (record.aiReport?.summary) return record; // already generated

  const aiResult = await generateAuditReport({
    url           : record.url,
    scores        : record.scores,
    domain        : record.domain,
    protocol      : record.network,
    ssl           : record.ssl,
    securityHeaders: record.securityHeaders,
    technology    : record.technology,
    seoContent    : record.seoContent,
    content       : record.content,
    schema        : record.schema,
    cdn           : record.cdn,
    malware       : record.malware,
    issues        : record.issues,
  });

  record.aiReport = {
    summary         : aiResult.summary,
    workingWell     : aiResult.workingWell,
    issues          : aiResult.criticalIssues,
    recommendations : aiResult.recommendations,
    businessImpact  : aiResult.businessImpact,
    priorityTable   : aiResult.priorityTable,
    generatedAt     : aiResult.generatedAt,
  };

  /* Update overall score if AI provided one */
  if (aiResult.overallScore && !record.scores.overall) {
    record.scores.overall = aiResult.overallScore;
  }

  await record.save();
  return record;
}

/* ═══════════════════════════════════════
   PDF DOWNLOAD
═══════════════════════════════════════ */
async function downloadPDF(reportId) {
  const record = await TechnicalInsight.findById(reportId);
  if (!record) throw new Error('Report not found');
  if (record.status !== 'completed') throw new Error('Audit not yet completed');

  /* Generate AI report first if not available */
  if (!record.aiReport?.summary) await generateReport(reportId);
  const freshRecord = await TechnicalInsight.findById(reportId);
  return generatePDF(freshRecord.toObject());
}

/* ═══════════════════════════════════════
   FETCH REPORT
═══════════════════════════════════════ */
async function getReport(reportId) {
  const record = await TechnicalInsight.findById(reportId);
  if (!record) throw new Error('Report not found');
  return record;
}

/* ═══════════════════════════════════════
   LIST RECENT REPORTS
═══════════════════════════════════════ */
async function listReports(limit = 20) {
  return TechnicalInsight.find({ status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('url scores.overall status createdAt');
}

module.exports = { runFullAudit, generateReport, downloadPDF, getReport, listReports };