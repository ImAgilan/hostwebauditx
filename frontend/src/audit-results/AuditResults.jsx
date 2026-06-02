import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './AuditResults.css';

/* ══════════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════════ */
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MODULE_META = {
  seo:           { icon: '🔍', label: 'SEO',           color: '#ef4444', desc: 'Search Engine Optimization', order: 0 },
  performance:   { icon: '⚡', label: 'Performance',   color: '#a78bfa', desc: 'Core Web Vitals & Speed', order: 1 },
  accessibility: { icon: '♿', label: 'Accessibility', color: '#f59e0b', desc: 'WCAG 2.1 Compliance', order: 2 },
  mobile:        { icon: '📱', label: 'Mobile',        color: '#3b82f6', desc: 'Mobile Friendliness', order: 3 },
  security:      { icon: '🔐', label: 'Security',      color: '#ef4444', desc: 'HTTPS & Headers', order: 4 },
  content:       { icon: '⭐', label: 'Content',       color: '#3b82f6', desc: 'Quality & Readability', order: 5 },
  structure:     { icon: '🗺️', label: 'Structure',     color: '#f59e0b', desc: 'Navigation & Sitemap', order: 6 },
  ui:            { icon: '🎨', label: 'UI/UX',         color: '#00b894', desc: 'Design & Usability', order: 7 },
  technical:     { icon: '🔧', label: 'Technical',     color: '#00b894', desc: 'Code & CMS', order: 8 },
};

const SEV_ORDER = { high: 0, medium: 1, low: 2 };

/* ══════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════ */
function scoreColor(s) {
  if (s >= 80) return '#22c55e';
  if (s >= 60) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(s) {
  if (s >= 80) return 'Good';
  if (s >= 60) return 'Needs Work';
  return 'Poor';
}

function ScoreRing({ score, size = 100 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const col = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8}/>
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={col} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s ease' }}
      />
      <text
        x={size/2} y={size/2 + 1}
        textAnchor="middle" dominantBaseline="middle"
        fill={col} fontSize={size > 80 ? 22 : 14} fontWeight="800"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}
      >
        {score}
      </text>
      <text
        x={size/2} y={size/2 + (size > 80 ? 18 : 12)}
        textAnchor="middle" dominantBaseline="middle"
        fill="#64748b" fontSize={size > 80 ? 9 : 7}
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}
      >
        /100
      </text>
    </svg>
  );
}

function SeverityBadge({ s }) {
  const colors = {
    high:   { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
    medium: { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
    low:    { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  };
  const c = colors[s] || colors.low;
  return (
    <span className="ar-sev-badgeLP" style={{ background: c.bg, color: c.color }}>
      {s}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
   RIGHT SIDE CONTENT PANELS
══════════════════════════════════════════════════════════════════ */

/* ── OVERVIEW PANEL ── */
function OverviewPanel({ audit }) {
  const scores = audit.scores || {};
  const issues = audit.issues || [];
  const overallScore = audit.overallScore || 0;
  
  return (
    <div className="ar-panel-contentLP">
      {/* Hero Section */}
      <div className="ar-overview-heroLP">
        <div className="ar-overview-scoreLP">
          <ScoreRing score={overallScore} size={120} />
          <div className="ar-overview-score-labelLP" style={{ color: scoreColor(overallScore) }}>
            {scoreLabel(overallScore)}
          </div>
        </div>
        <div className="ar-overview-statsLP">
          <div className="ar-overview-statLP">
            <div className="ar-overview-stat-valueLP">{audit.issueCount?.total || 0}</div>
            <div className="ar-overview-stat-labelLP">Total Issues</div>
          </div>
          <div className="ar-overview-statLP">
            <div className="ar-overview-stat-valueLP" style={{ color: '#ef4444' }}>{audit.issueCount?.high || 0}</div>
            <div className="ar-overview-stat-labelLP">High</div>
          </div>
          <div className="ar-overview-statLP">
            <div className="ar-overview-stat-valueLP" style={{ color: '#f59e0b' }}>{audit.issueCount?.medium || 0}</div>
            <div className="ar-overview-stat-labelLP">Medium</div>
          </div>
          <div className="ar-overview-statLP">
            <div className="ar-overview-stat-valueLP" style={{ color: '#22c55e' }}>{audit.issueCount?.low || 0}</div>
            <div className="ar-overview-stat-labelLP">Low</div>
          </div>
        </div>
      </div>

      {/* All Modules Summary Cards */}
      <div className="ar-modules-summaryLP">
        <h3 className="ar-section-titleLP">📊 All Modules Summary</h3>
        <div className="ar-modules-gridLP">
          {Object.entries(scores).map(([mod, score]) => {
            const meta = MODULE_META[mod] || { icon: '🔷', label: mod };
            const modIssues = issues.filter(i => i.module === mod);
            const hi = modIssues.filter(i => i.severity === 'high').length;
            const mi = modIssues.filter(i => i.severity === 'medium').length;
            return (
              <div key={mod} className="ar-module-summary-cardLP">
                <div className="ar-module-summary-headerLP">
                  <span className="ar-module-summary-iconLP">{meta.icon}</span>
                  <span className="ar-module-summary-labelLP">{meta.label}</span>
                  <span className="ar-module-summary-scoreLP" style={{ color: scoreColor(score) }}>{score}/100</span>
                </div>
                <div className="ar-module-summary-barLP">
                  <div className="ar-module-summary-bar-fillLP" style={{ width: `${score}%`, background: scoreColor(score) }}></div>
                </div>
                <div className="ar-module-summary-issuesLP">
                  {hi > 0 && <span className="ar-issue-badge-highLP">{hi} high</span>}
                  {mi > 0 && <span className="ar-issue-badge-medLP">{mi} med</span>}
                  {hi === 0 && mi === 0 && <span className="ar-issue-badge-okLP">✓ no issues</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Module Detail Panels (Collapsible) */}
      <div className="ar-detail-sectionLP">
        <h3 className="ar-section-titleLP">🔍 Module Detail Breakdown</h3>
        {Object.entries(audit.moduleData || {}).map(([mod, data]) => (
          <ModuleDetailPanel key={mod} mod={mod} data={data} score={(audit.scores || {})[mod] || 0} />
        ))}
      </div>
    </div>
  );
}

function ModuleDetailPanel({ mod, data, score }) {
  const [open, setOpen] = useState(false);
  const meta = MODULE_META[mod] || { icon: '🔷', label: mod };
  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div className="ar-detail-panelLP">
      <button className="ar-detail-toggleLP" onClick={() => setOpen(!open)}>
        <span>{meta.icon} {meta.label} Details</span>
        <span className="ar-detail-toggle-rightLP">
          <span className="ar-detail-scoreLP" style={{ color: scoreColor(score) }}>{score}/100</span>
          <span className="ar-detail-arrowLP" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
        </span>
      </button>
      {open && (
        <div className="ar-detail-bodyLP">
          <div className="ar-kv-gridLP">
            {Object.entries(data).map(([k, v]) => {
              if (v === null || v === undefined) return null;
              let display = v;
              if (typeof v === 'boolean') display = v ? '✅ Yes' : '❌ No';
              else if (Array.isArray(v)) display = v.length === 0 ? 'None' : v.join(', ');
              else if (typeof v === 'object') display = JSON.stringify(v).slice(0, 120);
              else display = String(v);
              return (
                <div key={k} className="ar-kv-itemLP">
                  <div className="ar-kv-keyLP">{k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</div>
                  <div className="ar-kv-valLP">{display}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── ISSUES PANEL (All Issues) ── */
function IssuesPanel({ issues }) {
  const [filterSev, setFilterSev] = useState('all');
  const [filterMod, setFilterMod] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('severity');

  const modules = [...new Set(issues.map(i => i.module))].sort();

  const filtered = issues
    .filter(i => {
      const sevOk = filterSev === 'all' || i.severity === filterSev;
      const modOk = filterMod === 'all' || i.module === filterMod;
      const srOk = !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.detail.toLowerCase().includes(search.toLowerCase());
      return sevOk && modOk && srOk;
    })
    .sort((a, b) => {
      if (sortBy === 'severity') return SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
      if (sortBy === 'module') return a.module.localeCompare(b.module);
      return 0;
    });

  const highCount = issues.filter(i => i.severity === 'high').length;
  const medCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;

  return (
    <div className="ar-panel-contentLP">
      <div className="ar-issues-headerLP">
        <h2 className="ar-panel-titleLP">⚠️ All Issues</h2>
        <div className="ar-issues-summaryLP">
          <span className="ar-issues-summary-highLP">🔴 {highCount} High</span>
          <span className="ar-issues-summary-medLP">🟡 {medCount} Medium</span>
          <span className="ar-issues-summary-lowLP">🟢 {lowCount} Low</span>
        </div>
      </div>

      <div className="ar-filter-barLP">
        <input
          className="ar-search-inputLP"
          type="text"
          placeholder="Search issues..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="ar-selectLP" value={filterMod} onChange={e => setFilterMod(e.target.value)}>
          <option value="all">All Modules</option>
          {modules.map(m => <option key={m} value={m}>{MODULE_META[m]?.icon} {m}</option>)}
        </select>
        <select className="ar-selectLP" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="severity">Sort: Severity</option>
          <option value="module">Sort: Module</option>
        </select>
        <span className="ar-filter-countLP">{filtered.length} issues</span>
      </div>

      <div className="ar-issues-listLP">
        {filtered.length === 0 && <div className="ar-emptyLP">✅ No issues match your filter criteria</div>}
        {filtered.map((issue, i) => {
          const meta = MODULE_META[issue.module] || { icon: '🔷' };
          const dotColor = issue.severity === 'high' ? '#ef4444' : issue.severity === 'medium' ? '#f59e0b' : '#22c55e';
          return (
            <div key={i} className={`ar-issue-itemLP ar-issue-${issue.severity}LP`}>
              <div className="ar-issue-leftLP">
                <div className="ar-issue-dotLP" style={{ background: dotColor }}></div>
                <span className="ar-issue-iconLP">{meta.icon}</span>
              </div>
              <div className="ar-issue-bodyLP">
                <div className="ar-issue-titleLP">{issue.title}</div>
                <div className="ar-issue-detailLP">{issue.detail}</div>
                {issue.recommendation && (
                  <div className="ar-issue-recLP">
                    <span className="ar-issue-rec-labelLP">💡 Fix: </span>
                    {issue.recommendation}
                  </div>
                )}
              </div>
              <div className="ar-issue-rightLP">
                <SeverityBadge s={issue.severity} />
                <span className="ar-issue-module-tagLP">{issue.module}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── AI REPORT PANEL ── */
function AIPanel({ auditId, scores, cachedAIReport, onGenerated }) {
  const [ai, setAI] = useState(cachedAIReport || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/full-audit/ai-report/${auditId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setAI(data.data);
      onGenerated(data.data);
    } catch (e) {
      setError(e.message || 'AI generation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!ai && !loading) {
    return (
      <div className="ar-panel-contentLP">
        <div className="ar-ai-promptLP">
          <div className="ar-ai-iconLP">🤖</div>
          <h3 className="ar-ai-titleLP">Generate AI Insights</h3>
          <p className="ar-ai-descLP">Our AI will analyse all 9 audit modules and produce module-wise insights, priority recommendations, a fix roadmap, and business impact analysis.</p>
          {error && <div className="ar-errorLP">{error}</div>}
          <button className="ar-btn-ai-largeLP" onClick={generate}>✨ Generate Full AI Report</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ar-panel-contentLP">
        <div className="ar-ai-loadingLP">
          <div className="ar-spinnerLP"></div>
          <h3 className="ar-ai-loading-titleLP">AI is analysing 9 modules...</h3>
          <p className="ar-ai-loading-descLP">Generating insights, recommendations, and priority matrix</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ar-panel-contentLP">
      <div className="ar-ai-contentLP">
        <div className="ar-ai-cardLP ar-ai-summary-cardLP">
          <div className="ar-ai-card-headerLP">
            <span>📋 Executive Summary</span>
            <span className="ar-ai-score-badgeLP" style={{ color: scoreColor(ai.overallScore) }}>{ai.overallScore}/100</span>
          </div>
          <p className="ar-ai-summary-textLP">{ai.summary}</p>
          {ai.executiveSummary && <p className="ar-ai-execLP">{ai.executiveSummary}</p>}
          <div className="ar-ai-meta-rowLP">
            {ai.businessImpact && <div className="ar-ai-meta-chipLP">💼 {ai.businessImpact}</div>}
            {ai.estimatedFixTime && <div className="ar-ai-meta-chipLP">⏱️ Fix time: {ai.estimatedFixTime}</div>}
          </div>
        </div>

        <div className="ar-ai-two-colLP">
          {ai.strengths?.length > 0 && (
            <div className="ar-ai-cardLP">
              <div className="ar-ai-card-headerLP ar-ai-good-headerLP">✅ What's Working Well</div>
              {ai.strengths.map((s, i) => (
                <div key={i} className="ar-ai-list-itemLP ar-ai-good-itemLP">
                  <span className="ar-ai-list-dotLP" style={{ background: '#22c55e' }}></span>
                  {s}
                </div>
              ))}
            </div>
          )}

          {ai.criticalIssues?.length > 0 && (
            <div className="ar-ai-cardLP">
              <div className="ar-ai-card-headerLP ar-ai-bad-headerLP">🚨 Critical Issues</div>
              {ai.criticalIssues.map((s, i) => (
                <div key={i} className="ar-ai-list-itemLP ar-ai-bad-itemLP">
                  <span className="ar-ai-list-dotLP" style={{ background: '#ef4444' }}></span>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        {ai.recommendations?.length > 0 && (
          <div className="ar-ai-cardLP">
            <div className="ar-ai-card-headerLP">🎯 Priority Recommendations</div>
            <div className="ar-rec-listLP">
              {ai.recommendations.map((r, i) => (
                <div key={i} className={`ar-rec-cardLP ar-rec-${r.priority}LP`}>
                  <div className="ar-rec-topLP">
                    <div className="ar-rec-leftLP">
                      <SeverityBadge s={r.priority} />
                      <span className="ar-rec-moduleLP">{MODULE_META[r.module]?.icon} {r.module}</span>
                      {r.effort && <span className="ar-rec-effortLP">Effort: {r.effort}</span>}
                      {r.timeToFix && <span className="ar-rec-timeLP">⏱ {r.timeToFix}</span>}
                    </div>
                  </div>
                  <div className="ar-rec-actionLP">{r.action}</div>
                  {r.impact && <div className="ar-rec-impactLP">💡 Expected impact: {r.impact}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {ai.priorityMatrix && (
          <div className="ar-ai-cardLP">
            <div className="ar-ai-card-headerLP">📊 Priority Matrix</div>
            <div className="ar-priority-gridLP">
              {[
                { key: 'doFirst', label: '🔴 Do First', sub: 'High impact, low effort', border: '#ef4444' },
                { key: 'planFor', label: '🟡 Plan For', sub: 'High impact, high effort', border: '#f59e0b' },
                { key: 'delegate', label: '🔵 Delegate', sub: 'Low impact, low effort', border: '#3b82f6' },
                { key: 'ignore', label: '⚪ Low Priority', sub: 'Low impact, high effort', border: '#64748b' },
              ].map(q => (
                <div key={q.key} className="ar-matrix-cellLP" style={{ borderColor: q.border }}>
                  <div className="ar-matrix-titleLP">{q.label}</div>
                  <div className="ar-matrix-subLP">{q.sub}</div>
                  {(ai.priorityMatrix[q.key] || []).map((item, i) => (
                    <div key={i} className="ar-matrix-itemLP">• {item}</div>
                  ))}
                  {!(ai.priorityMatrix[q.key]?.length) && <div className="ar-matrix-emptyLP">None</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {ai.moduleInsights && (
          <div className="ar-ai-cardLP">
            <div className="ar-ai-card-headerLP">🔬 Module-wise AI Insights</div>
            <div className="ar-module-insights-gridLP">
              {Object.entries(ai.moduleInsights).map(([mod, insight]) => {
                const meta = MODULE_META[mod] || { icon: '🔷', label: mod };
                const score = scores[mod] || 0;
                return (
                  <div key={mod} className="ar-insight-cardLP">
                    <div className="ar-insight-headerLP">
                      <span>{meta.icon}</span>
                      <strong>{meta.label}</strong>
                      <span className="ar-insight-scoreLP" style={{ color: scoreColor(score) }}>{score}/100</span>
                    </div>
                    <div className="ar-insight-bar-bgLP">
                      <div className="ar-insight-bar-fillLP" style={{ width: `${score}%`, background: scoreColor(score) }}></div>
                    </div>
                    <p className="ar-insight-textLP">{insight}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── DOWNLOAD PANEL ── */
function DownloadPanel({ audit, onDownload }) {
  const scores = audit.scores || {};
  const overallScore = audit.overallScore || 0;
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    await onDownload();
    setTimeout(() => setDownloading(false), 2000);
  };

  return (
    <div className="ar-panel-contentLP">
      <div className="ar-download-panelLP">
        <div className="ar-download-headerLP">
          <div className="ar-download-iconLP">📄</div>
          <h2 className="ar-download-titleLP">Export Report</h2>
          <p className="ar-download-descLP">Download your complete audit report as a PDF document</p>
        </div>
        
        <div className="ar-download-statsLP">
          <div className="ar-download-statLP">
            <span className="ar-download-stat-valueLP" style={{ color: scoreColor(overallScore) }}>{overallScore}/100</span>
            <span className="ar-download-stat-labelLP">Overall Score</span>
          </div>
          <div className="ar-download-statLP">
            <span className="ar-download-stat-valueLP">{audit.issueCount?.total || 0}</span>
            <span className="ar-download-stat-labelLP">Total Issues</span>
          </div>
          <div className="ar-download-statLP">
            <span className="ar-download-stat-valueLP">{Object.keys(scores).length}</span>
            <span className="ar-download-stat-labelLP">Modules Audited</span>
          </div>
        </div>
        
        <button className="ar-download-btnLP" onClick={handleDownload} disabled={downloading}>
          {downloading ? '⏳ Generating PDF...' : '📥 Download PDF Report'}
        </button>
        
        <div className="ar-download-featuresLP">
          <h4>What's included:</h4>
          <ul>
            <li>✓ Complete audit scores for all 9 modules</li>
            <li>✓ Detailed issue breakdown with recommendations</li>
            <li>✓ AI-powered insights and priority matrix</li>
            <li>✓ Module-wise performance analysis</li>
            <li>✓ Actionable fix roadmap</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ── MODULE DETAIL PANEL (For individual module view) ── */
function ModuleDetailView({ moduleId, moduleData, score, issues }) {
  const meta = MODULE_META[moduleId] || { icon: '🔷', label: moduleId };
  const moduleIssues = issues.filter(i => i.module === moduleId);
  
  if (!moduleData || Object.keys(moduleData).length === 0) {
    return (
      <div className="ar-module-detail-emptyLP">
        <div className="ar-module-detail-empty-iconLP">{meta.icon}</div>
        <h3 className="ar-module-detail-empty-titleLP">No detailed data available for {meta.label}</h3>
        <p className="ar-module-detail-empty-descLP">The audit did not capture detailed metrics for this module.</p>
      </div>
    );
  }

  return (
    <div className="ar-module-detailLP">
      <div className="ar-module-detail-headerLP">
        <div className="ar-module-detail-titleLP">
          <span className="ar-module-detail-iconLP">{meta.icon}</span>
          <h2 className="ar-module-detail-nameLP">{meta.label} Details</h2>
        </div>
        <div className="ar-module-detail-scoreLP">
          <ScoreRing score={score} size={80} />
          <div className="ar-module-detail-score-labelLP" style={{ color: scoreColor(score) }}>
            {scoreLabel(score)}
          </div>
        </div>
      </div>

      <div className="ar-module-data-sectionLP">
        <h3 className="ar-section-titleLP">📊 Audit Data</h3>
        <div className="ar-kv-gridLP">
          {Object.entries(moduleData).map(([k, v]) => {
            if (v === null || v === undefined) return null;
            let display = v;
            if (typeof v === 'boolean') display = v ? '✅ Yes' : '❌ No';
            else if (Array.isArray(v)) display = v.length === 0 ? 'None' : v.join(', ');
            else if (typeof v === 'object') display = JSON.stringify(v).slice(0, 120);
            else display = String(v);
            return (
              <div key={k} className="ar-kv-itemLP">
                <div className="ar-kv-keyLP">{k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</div>
                <div className="ar-kv-valLP">{display}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ar-module-issues-sectionLP">
        <h3 className="ar-section-titleLP">⚠️ Issues Found ({moduleIssues.length})</h3>
        {moduleIssues.length === 0 ? (
          <div className="ar-no-issuesLP">
            <span className="ar-no-issues-iconLP">✅</span>
            <p>No issues found for {meta.label}! Great job!</p>
          </div>
        ) : (
          <div className="ar-issues-listLP">
            {moduleIssues.map((issue, i) => {
              const dotColor = issue.severity === 'high' ? '#ef4444' : issue.severity === 'medium' ? '#f59e0b' : '#22c55e';
              return (
                <div key={i} className={`ar-issue-itemLP ar-issue-${issue.severity}LP`}>
                  <div className="ar-issue-leftLP">
                    <div className="ar-issue-dotLP" style={{ background: dotColor }}></div>
                  </div>
                  <div className="ar-issue-bodyLP">
                    <div className="ar-issue-titleLP">{issue.title}</div>
                    <div className="ar-issue-detailLP">{issue.detail}</div>
                    {issue.recommendation && (
                      <div className="ar-issue-recLP">
                        <span className="ar-issue-rec-labelLP">💡 Fix: </span>
                        {issue.recommendation}
                      </div>
                    )}
                  </div>
                  <div className="ar-issue-rightLP">
                    <SeverityBadge s={issue.severity} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function AuditResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState('');
  const [activeMenu, setActiveMenu] = useState('overview');
  const [selectedModule, setSelectedModule] = useState(null);
  const [aiReport, setAIReport] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/full-audit/report/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setAudit(d.data);
          if (d.data.aiReport?.summary) setAIReport(d.data.aiReport);
        } else {
          setError(d.message || 'Failed to load report');
        }
      })
      .catch(() => setError('Could not connect to server'));
  }, [id]);

  const handleDownload = useCallback(() => {
    window.open(`${BASE}/api/full-audit/download/${id}`, '_blank');
  }, [id]);

  if (!audit && !error) {
    return (
      <div className="ar-fullpage-centerLP">
        <div className="ar-spinnerLP ar-spinner-lgLP"></div>
        <h3 className="ar-loading-titleLP">Loading audit results...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ar-fullpage-centerLP">
        <div className="ar-error-iconLP">⚠️</div>
        <h3 className="ar-error-titleLP">{error}</h3>
        <button className="ar-back-btnLP" onClick={() => navigate('/')}>← Back to Home</button>
      </div>
    );
  }

  const scores = audit.scores || {};
  const issues = audit.issues || [];
  const moduleData = audit.moduleData || {};
  const overallScore = audit.overallScore || 0;

  // Sort modules by order
  const sortedModules = Object.entries(scores)
    .sort((a, b) => {
      const orderA = MODULE_META[a[0]]?.order ?? 999;
      const orderB = MODULE_META[b[0]]?.order ?? 999;
      return orderA - orderB;
    })
    .map(([mod, score]) => ({ id: mod, score, meta: MODULE_META[mod] }));

  const mainMenuItems = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'issues', label: '⚠️ Issues', icon: '⚠️' },
    { id: 'ai', label: '🤖 AI Report', icon: '🤖' },
    { id: 'download', label: '📄 Download', icon: '📄' },
  ];

  const renderContent = () => {
    // If a module is selected, show module detail view
    if (selectedModule) {
      return (
        <ModuleDetailView
          moduleId={selectedModule}
          moduleData={moduleData[selectedModule] || {}}
          score={scores[selectedModule] || 0}
          issues={issues}
        />
      );
    }

    // Otherwise show main menu content
    switch (activeMenu) {
      case 'overview':
        return <OverviewPanel audit={audit} />;
      case 'issues':
        return <IssuesPanel issues={issues} />;
      case 'ai':
        return <AIPanel auditId={id} scores={scores} cachedAIReport={aiReport} onGenerated={setAIReport} />;
      case 'download':
        return <DownloadPanel audit={audit} onDownload={handleDownload} />;
      default:
        return <OverviewPanel audit={audit} />;
    }
  };

  const handleMainMenuClick = (menuId) => {
    setSelectedModule(null);
    setActiveMenu(menuId);
  };

  const handleModuleClick = (moduleId) => {
    setActiveMenu(null);
    setSelectedModule(moduleId);
  };

  return (
    <div className="ar-rootLP">
      {/* TOP BAR */}
      <div className="ar-topbarLP">
        <button className="ar-back-btnLP" onClick={() => navigate('/')}>← Back</button>
        <div className="ar-url-chipLP">
          <span className="ar-url-prefixLP">🔍</span>
          <span className="ar-url-textLP">{audit.url}</span>
          <span className={`ar-status-dotLP ar-status-${audit.status}LP`}>{audit.status}</span>
        </div>
        <div className="ar-topbar-rightLP">
          <div className="ar-hero-score-compactLP">
            <span className="ar-hero-score-label-compactLP">Overall Score</span>
            <span className="ar-hero-score-value-compactLP" style={{ color: scoreColor(overallScore) }}>{overallScore}/100</span>
          </div>
        </div>
      </div>

      {/* DASHBOARD LAYOUT */}
      <div className="ar-dashboard-layoutLP">
        {/* LEFT SIDEBAR */}
        <aside className="ar-sidebarLP">
          <div className="ar-sidebar-headerLP">
            <div className="ar-sidebar-logoLP">
              <span className="ar-sidebar-logo-iconLP">🔍</span>
              <span className="ar-sidebar-logo-textLP">WebAuditX</span>
              <span className="ar-sidebar-badgeLP">PRO</span>
            </div>
          </div>
          
          {/* Main Navigation */}
          <div className="ar-nav-sectionLP">
            <div className="ar-nav-section-titleLP">Main</div>
            {mainMenuItems.map(item => (
              <button
                key={item.id}
                className={`ar-nav-itemLP ${activeMenu === item.id && !selectedModule ? 'activeLP' : ''}`}
                onClick={() => handleMainMenuClick(item.id)}
              >
                <span className="ar-nav-iconLP">{item.icon}</span>
                <span className="ar-nav-labelLP">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Modules Section */}
          <div className="ar-nav-sectionLP">
            <div className="ar-nav-section-titleLP">Audit Modules</div>
            {sortedModules.map(({ id, score, meta }) => (
              <button
                key={id}
                className={`ar-module-nav-itemLP ${selectedModule === id ? 'activeLP' : ''}`}
                onClick={() => handleModuleClick(id)}
              >
                <div className="ar-module-nav-leftLP">
                  <span className="ar-module-nav-iconLP">{meta.icon}</span>
                  <span className="ar-module-nav-labelLP">{meta.label}</span>
                </div>
                <div className="ar-module-nav-scoreLP" style={{ color: scoreColor(score) }}>
                  {score}/100
                </div>
              </button>
            ))}
          </div>
          
          <div className="ar-sidebar-footerLP">
            <div className="ar-sidebar-audit-infoLP">
              <div className="ar-sidebar-audit-labelLP">Audit ID</div>
              <div className="ar-sidebar-audit-valueLP">{id?.slice(0, 8)}...</div>
            </div>
          </div>
        </aside>

        {/* RIGHT CONTENT AREA */}
        <main className="ar-main-contentLP">
          {renderContent()}
        </main>
      </div>

      {/* BOTTOM BAR */}
      <div className="ar-bottom-barLP">
        <span className="ar-bottom-textLP">
          WebAuditX · {audit.domain} · Overall: <strong className="ar-bottom-scoreLP" style={{ color: scoreColor(overallScore) }}>{overallScore}/100</strong>
        </span>
        <div className="ar-bottom-actionsLP">
          <button className="ar-btn-pdf-smLP" onClick={handleDownload}>📄 Download PDF</button>
        </div>
      </div>
    </div>
  );
}