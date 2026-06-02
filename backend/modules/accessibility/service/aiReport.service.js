'use strict';
/**
 * aiReport.service.js
 * Generates AI accessibility report using Groq (falls back to rule-based if unavailable).
 */

const axios = require('axios');

async function generateAIReport(auditData) {
  const { url, overallScore, wcagLevel, summary, metrics, issues } = auditData;

  const prompt = buildPrompt(url, overallScore, wcagLevel, summary, metrics, issues);

  // Try Groq first
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama3-70b-8192',
        messages: [
          { role: 'system', content: 'You are an expert web accessibility consultant specializing in WCAG 2.1/2.2 compliance. Write clear, actionable reports for website owners.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 2500,
      }, {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
      return res.data.choices[0].message.content;
    } catch (err) {
      console.warn('[AI] Groq failed, falling back to rule-based report:', err.message);
    }
  }

  // Fallback: rule-based report
  return buildFallbackReport(url, overallScore, wcagLevel, summary, issues, metrics);
}

function buildPrompt(url, score, level, summary, metrics, issues) {
  const topIssues = issues.slice(0, 8).map(i =>
    `- [${i.impact.toUpperCase()}] ${i.rule} (WCAG ${i.wcag}): ${i.description}`
  ).join('\n');

  const metricSummary = Object.entries(metrics)
    .map(([k, v]) => `${v.name}: ${v.score}/100 (${v.status})`)
    .join('\n');

  return `
Analyze this website accessibility audit and write a comprehensive report.

URL: ${url}
Overall Score: ${score}/100
WCAG Compliance Level: ${level}
Issues Found: ${summary.totalIssues} (${summary.criticalIssues} critical, ${summary.seriousIssues} serious, ${summary.moderateIssues} moderate, ${summary.minorIssues} minor)
Passed Checks: ${summary.passedChecks}/${summary.totalChecks}

METRIC SCORES:
${metricSummary}

TOP ISSUES:
${topIssues}

Write a report with these EXACT sections:

## 🌐 Website Accessibility Overview
[2-3 sentences summarizing the overall accessibility health of this website]

## ✅ What's Working Well
[3-5 bullet points of things the website does well for accessibility]

## ⚠️ Critical Issues to Fix
[For each critical/serious issue, explain in plain English what the problem is and why it matters for users with disabilities]

## 🔧 How to Fix Them
[Step-by-step, practical fix instructions for the top issues. Be specific and developer-friendly]

## 📊 Priority Action Plan
[Create a clear table with: Issue | WCAG Criterion | Impact | Priority | Estimated Effort]

## 🎯 Final Accessibility Score
Score: ${score}/100 — WCAG Level ${level}
[2-3 sentences interpreting what this score means for real users with disabilities]

Write in clear, non-technical English that website owners can understand. Be specific, actionable, and encouraging.
`;
}

function buildFallbackReport(url, score, level, summary, issues, metrics) {
  const criticalIssues = issues.filter(i => i.impact === 'critical' || i.impact === 'serious');
  const moderateIssues = issues.filter(i => i.impact === 'moderate');
  const passing = Object.entries(metrics).filter(([, v]) => v.status === 'pass');

  const wellDone = passing.slice(0, 4).map(([, v]) => `✅ **${v.name}**: ${v.details}`).join('\n');
  const topFixes = criticalIssues.slice(0, 5).map(i =>
    `**${i.rule}** (WCAG ${i.wcag} — ${i.priority.toUpperCase()} Priority)\n   ${i.description}\n   🔧 ${i.fix}`
  ).join('\n\n');

  const tableRows = issues.slice(0, 10).map(i =>
    `| ${i.rule} | WCAG ${i.wcag} | ${i.impact} | ${i.priority} | ${i.impact === 'critical' ? 'High' : 'Medium'} |`
  ).join('\n');

  return `
## 🌐 Website Accessibility Overview

This accessibility audit of **${url}** has been completed. The website received an overall score of **${score}/100**, achieving **WCAG Level ${level}** compliance. Out of ${summary.totalChecks} accessibility checks, ${summary.passedChecks} passed and ${summary.totalIssues} issues were identified, including ${summary.criticalIssues} critical issues that need immediate attention.

## ✅ What's Working Well

${wellDone || '- The page loads and basic content is accessible\n- Standard HTML elements are being used'}

## ⚠️ Critical Issues to Fix

${criticalIssues.length === 0
  ? 'No critical issues found. Focus on moderate and minor improvements.'
  : criticalIssues.slice(0, 5).map(i =>
      `**${i.rule}** — ${i.description}`
    ).join('\n\n')
}

## 🔧 How to Fix Them

${topFixes || 'Continue maintaining current accessibility standards and periodically re-audit as content changes.'}

${moderateIssues.length > 0 ? `\n**Moderate Issues:**\n${moderateIssues.slice(0, 3).map(i => `- ${i.rule}: ${i.fix}`).join('\n')}` : ''}

## 📊 Priority Action Plan

| Issue | WCAG Criterion | Impact | Priority | Effort |
|-------|---------------|--------|----------|--------|
${tableRows || '| No critical issues | — | — | — | — |'}

## 🎯 Final Accessibility Score

**Score: ${score}/100 — WCAG Level ${level}**

${score >= 90
  ? 'Excellent accessibility! This website is well-optimized for users with disabilities. Continue monitoring and re-auditing as content changes.'
  : score >= 70
  ? 'Good accessibility foundation with room for improvement. Addressing the high-priority issues above will significantly improve the experience for users with disabilities.'
  : score >= 50
  ? 'The website has significant accessibility barriers. Users relying on screen readers, keyboard navigation, or other assistive technologies may struggle. Prioritize the critical fixes above.'
  : 'The website has serious accessibility gaps that exclude many users with disabilities. Immediate action is needed to meet basic WCAG Level A requirements.'
}
`;
}

module.exports = { generateAIReport };