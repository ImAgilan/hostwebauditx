import { useState, useEffect, useRef } from 'react';
import './mobile-friendliness.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/* ── Utilities (shared) ── */
const scoreColor  = s => s >= 80 ? '#10B981' : s >= 60 ? '#F59E0B' : s >= 40 ? '#F97316' : '#E11D48';
const scoreBg     = s => s >= 80 ? 'rgba(16,185,129,.12)' : s >= 60 ? 'rgba(245,158,11,.12)' : s >= 40 ? 'rgba(249,115,22,.12)' : 'rgba(225,29,72,.12)';
const scoreLabel  = s => s >= 80 ? 'Good' : s >= 60 ? 'Needs Work' : s >= 40 ? 'Poor' : 'Critical';
const sevColor    = s => s === 'critical' ? '#E11D48' : s === 'medium' ? '#F59E0B' : '#10B981';
const sevBg       = s => s === 'critical' ? 'rgba(225,29,72,.08)' : s === 'medium' ? 'rgba(245,158,11,.08)' : 'rgba(16,185,129,.08)';
const catIcon     = c => ({ performance:'⚡',responsive:'📱',usability:'👆',seo:'🔍',accessibility:'♿',security:'🔒',pwa:'📲',navigation:'🧭',images:'🖼',general:'ℹ' })[c] || 'ℹ';

/* ── AI Insight score utilities ── */
const scoreCol   = s => s >= 80 ? '#10B981' : s >= 60 ? '#F59E0B' : s >= 40 ? '#F97316' : '#E11D48';
const scoreLblAI = s => s >= 80 ? 'Excellent' : s >= 60 ? 'Needs Improvement' : s >= 40 ? 'Poor' : 'Critical';

/* ━━━━━━━━━━━━━━━━━━━━━━
   SHARED SUB-COMPONENTS
━━━━━━━━━━━━━━━━━━━━━━ */

/* Score Ring (Home page) */
function ScoreRing({ score = 0, label, size = 120, strokeWidth = 8 }) {
  const r    = (size / 2) - strokeWidth - 4;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - (score / 100));
  const col  = scoreColor(score);
  const cx   = size / 2;
  return (
    <div className="ring-wrap" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#1E293B" strokeWidth={strokeWidth} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={col} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={fill}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}
        />
        <text x={cx} y={cx - 4} textAnchor="middle" fill={col} fontSize={size * 0.2} fontWeight="800">{score}</text>
        <text x={cx} y={cx + 13} textAnchor="middle" fill="#64748B" fontSize={size * 0.09}>/100</text>
      </svg>
      <div className="ring-label">{label}</div>
      <div className="ring-grade" style={{ color: col, background: scoreBg(score) }}>{scoreLabel(score)}</div>
    </div>
  );
}

/* Health Ring (AI Insight page) */
function HealthRing({ score }) {
  const r = 80, circ = 2 * Math.PI * r;
  const fill = circ * (1 - score / 100);
  const col  = scoreCol(score);
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" className="health-ring-svg">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="100" cy="100" r={r} fill="none" stroke="#1E293B" strokeWidth="12" />
      <circle cx="100" cy="100" r={r} fill="none" stroke={col} strokeWidth="12"
        strokeDasharray={circ} strokeDashoffset={fill}
        strokeLinecap="round" transform="rotate(-90 100 100)"
        filter="url(#glow)"
        style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(.4,0,.2,1)' }}
      />
      <text x="100" y="90" textAnchor="middle" fill={col} fontSize="36" fontWeight="900">{score}</text>
      <text x="100" y="115" textAnchor="middle" fill="#64748B" fontSize="12" fontWeight="600">/100</text>
      <text x="100" y="135" textAnchor="middle" fill={col} fontSize="11" fontWeight="700">{scoreLblAI(score)}</text>
    </svg>
  );
}

/* Metric Row */
function MetricRow({ icon, label, value, status, detail }) {
  const ok = status === true || status === 'ok' || status === 'good';
  return (
    <div className={`metric-row ${ok ? 'row-ok' : 'row-fail'}`}>
      <span className="mr-icon">{icon}</span>
      <div className="mr-body">
        <span className="mr-label">{label}</span>
        {detail && <span className="mr-detail">{detail}</span>}
      </div>
      <span className="mr-val">{value}</span>
      <span className={`mr-badge ${ok ? 'badge-ok' : 'badge-fail'}`}>{ok ? '✓' : '✗'}</span>
    </div>
  );
}

/* Collapsible Section */
function Section({ icon, title, score, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`audit-section ${open ? 'open' : ''}`}>
      <button className="section-header" onClick={() => setOpen(o => !o)}>
        <span className="sh-left">
          <span className="sh-icon">{icon}</span>
          <span className="sh-title">{title}</span>
        </span>
        <span className="sh-right">
          {score !== undefined && (
            <span className="sh-score" style={{ color: scoreColor(score), background: scoreBg(score) }}>{score}/100</span>
          )}
          <span className="sh-chevron">{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

/* Issue Card */
function IssueCard({ issue }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="issue-card" style={{ borderLeft: `3px solid ${sevColor(issue.severity)}`, background: sevBg(issue.severity) }}>
      <div className="ic-header" onClick={() => setOpen(o => !o)}>
        <div className="ic-left">
          <span className="ic-id">{issue.id}</span>
          <span className="ic-cat-icon">{catIcon(issue.category)}</span>
          <span className="ic-title">{issue.title}</span>
        </div>
        <div className="ic-right">
          <span className="ic-sev" style={{ background: sevColor(issue.severity) }}>{issue.severity}</span>
          <span className="ic-cat">{issue.category}</span>
          <span className="ic-device">📱 {issue.device}</span>
          <span className="ic-toggle">{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div className="ic-body">
          <p className="ic-desc">{issue.description}</p>
          {issue.detail && <p className="ic-detail">{issue.detail}</p>}
          {issue.impact && (
            <div className="ic-impact">
              <span className="ic-impact-label">⚠ Impact:</span> {issue.impact}
            </div>
          )}
          {issue.howToFix && (
            <div className="ic-fix">
              <span className="ic-fix-label">🛠 How to Fix:</span> {issue.howToFix}
            </div>
          )}
          <div className="ic-meta">
            <span>Source: {issue.source}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   AI INSIGHT PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function AIInsightPage() {
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const id = window.location.pathname.split('/').pop();
    if (!id) { setError('No report ID found.'); setLoading(false); return; }

    fetch(`${API}/mobile-friendliness/report/${id}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) throw new Error(data.message);
        setReport(data.data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="ai-loading">
      <div className="ai-spinner" />
      <p>Loading AI Insights…</p>
    </div>
  );

  if (error) return (
    <div className="ai-error">
      <span>⚠</span>
      <p>{error}</p>
    </div>
  );

  if (!report) return null;

  const ai = report.aiInsights || {};
  const s  = report.scores    || {};
  const issues = report.issues || [];
  const criticals = issues.filter(i => i.severity === 'critical');
  const mediums   = issues.filter(i => i.severity === 'medium');
  const lows      = issues.filter(i => i.severity === 'low');

  return (
    <div className="aip-root">

      {/* ── Top Bar ── */}
      <div className="aip-topbar">
        <div className="aip-brand">
          <span>📱</span> WebAuditX <span className="aip-brand-sep">|</span>
          <span className="aip-brand-sub">AI Mobile Insights</span>
        </div>
        <button className="aip-print" onClick={() => window.print()}>🖨 Print / Save PDF</button>
      </div>

      <div className="aip-body">

        {/* ─── HEADER ─── */}
        <header className="aip-header">
          <div className="aip-header-text">
            <div className="aip-pill">🤖 AI-Powered Mobile Analysis</div>
            <h1>Mobile Intelligence Report</h1>
            <div className="aip-url">{report.url}</div>
            <div className="aip-meta">
              <span>📅 {new Date(report.createdAt).toLocaleString()}</span>
              <span>🔌 {(report.dataSourcesUsed || []).join(' · ')}</span>
              <span>🤖 AI: {ai.provider || 'fallback'}</span>
            </div>
          </div>
          <HealthRing score={ai.healthScore || s.overall || 0} />
        </header>

        {/* ─── SCORE SUMMARY ─── */}
        <section className="aip-section">
          <h2 className="aip-section-title">📊 Score Overview</h2>
          <div className="score-overview-grid">
            {[
              { label: 'Overall',       val: s.overall,       icon: '🏆' },
              { label: 'Performance',   val: s.performance,   icon: '⚡' },
              { label: 'Responsive',    val: s.responsive,    icon: '📐' },
              { label: 'Usability',     val: s.usability,     icon: '👆' },
              { label: 'SEO',           val: s.seo,           icon: '🔍' },
              { label: 'Accessibility', val: s.accessibility, icon: '♿' },
              { label: 'Security',      val: s.security,      icon: '🔒' },
              { label: 'PWA',           val: s.pwa,           icon: '📲' },
            ].map(({ label, val, icon }) => (
              <div key={label} className="sog-card" style={{ borderTop: `3px solid ${scoreCol(val ?? 0)}` }}>
                <div className="sog-icon">{icon}</div>
                <div className="sog-val" style={{ color: scoreCol(val ?? 0) }}>{val ?? 0}</div>
                <div className="sog-label">{label}</div>
                <div className="sog-bar">
                  <div className="sog-fill" style={{ width: `${val ?? 0}%`, background: scoreCol(val ?? 0) }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── WEBSITE OVERVIEW ─── */}
        <section className="aip-section">
          <h2 className="aip-section-title">🌐 Website Overview</h2>
          <div className="overview-card">
            <div className="ov-grid">
              <div className="ov-item">
                <span className="ov-icon">📦</span>
                <span className="ov-label">Page Size</span>
                <span className="ov-val">{report.mobileMetrics?.performance?.pageSize ? `${report.mobileMetrics.performance.pageSize} KB` : 'N/A'}</span>
              </div>
              <div className="ov-item">
                <span className="ov-icon">🖼</span>
                <span className="ov-label">Total Images</span>
                <span className="ov-val">{report.mobileMetrics?.images?.totalImages ?? 0}</span>
              </div>
              <div className="ov-item">
                <span className="ov-icon">🔗</span>
                <span className="ov-label">Nav Links</span>
                <span className="ov-val">{report.mobileMetrics?.navigation?.navigationDepth ?? 0}</span>
              </div>
              <div className="ov-item">
                <span className="ov-icon">🔒</span>
                <span className="ov-label">HTTPS</span>
                <span className="ov-val" style={{ color: report.mobileMetrics?.security?.isHttps ? '#10B981' : '#E11D48' }}>
                  {report.mobileMetrics?.security?.isHttps ? 'Secure' : 'Not Secure'}
                </span>
              </div>
              <div className="ov-item">
                <span className="ov-icon">📱</span>
                <span className="ov-label">Mobile Ready</span>
                <span className="ov-val" style={{ color: report.mobileMetrics?.responsive?.hasViewportMeta ? '#10B981' : '#E11D48' }}>
                  {report.mobileMetrics?.responsive?.hasViewportMeta ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="ov-item">
                <span className="ov-icon">🚨</span>
                <span className="ov-label">Total Issues</span>
                <span className="ov-val" style={{ color: '#E11D48' }}>{issues.length}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── HEALTH SUMMARY ─── */}
        <section className="aip-section">
          <h2 className="aip-section-title">💚 Health Summary</h2>
          <div className="health-summary-card">
            <div className="hs-score-col">
              <HealthRing score={ai.healthScore || s.overall || 0} />
              <div className="hs-issue-counts">
                <div className="hic-item" style={{ color: '#E11D48' }}>
                  <strong>{criticals.length}</strong> Critical
                </div>
                <div className="hic-item" style={{ color: '#F59E0B' }}>
                  <strong>{mediums.length}</strong> Medium
                </div>
                <div className="hic-item" style={{ color: '#10B981' }}>
                  <strong>{lows.length}</strong> Low
                </div>
              </div>
            </div>
            <div className="hs-text-col">
              <p className="hs-summary">{ai.overallSummary || 'No summary available.'}</p>
              <div className="hs-perf-row">
                {[
                  { label: 'FCP', val: report.mobileMetrics?.performance?.firstContentfulPaint },
                  { label: 'LCP', val: report.mobileMetrics?.performance?.largestContentfulPaint },
                  { label: 'TTI', val: report.mobileMetrics?.performance?.timeToInteractive },
                  { label: 'TBT', val: report.mobileMetrics?.performance?.totalBlockingTime },
                  { label: 'CLS', val: report.mobileMetrics?.performance?.cumulativeLayoutShift?.toFixed(3) },
                ].filter(x => x.val && x.val !== 'N/A').map(({ label, val }) => (
                  <div key={label} className="hpr-item">
                    <span className="hpr-label">{label}</span>
                    <span className="hpr-val">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── WHAT WORKS WELL ─── */}
        {ai.whatWorksWell?.length > 0 && (
          <section className="aip-section">
            <h2 className="aip-section-title">✅ What Works Well</h2>
            <div className="works-well-grid">
              {ai.whatWorksWell.map((item, i) => (
                <div key={i} className="ww-card">
                  <span className="ww-check">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── ISSUES IN SIMPLE ENGLISH ─── */}
        {ai.issuesSimple?.length > 0 && (
          <section className="aip-section">
            <h2 className="aip-section-title">🚨 Issues Explained Simply</h2>
            <p className="section-sub">In plain English — no technical jargon</p>
            <div className="issues-simple-list">
              {ai.issuesSimple.map((item, i) => (
                <div key={i} className="is-card" style={{ borderLeft: `4px solid ${sevColor(item.severity)}` }}>
                  <div className="is-header">
                    <span className="is-num">{i + 1}</span>
                    <strong className="is-title">{item.issue}</strong>
                    <span className="is-sev" style={{ background: sevColor(item.severity) }}>{item.severity}</span>
                  </div>
                  <p className="is-why">{item.whyItMatters}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── HOW TO FIX ─── */}
        {ai.fixes?.length > 0 && (
          <section className="aip-section">
            <h2 className="aip-section-title">🛠 How to Fix Them</h2>
            <p className="section-sub">Step-by-step instructions for each issue</p>
            <div className="fixes-list">
              {ai.fixes.map((fix, i) => (
                <div key={i} className="fix-card">
                  <div className="fix-header">
                    <span className="fix-num">{i + 1}</span>
                    <span className="fix-title">{fix.title}</span>
                    <span className={`fix-effort effort-${fix.effort}`}>{fix.effort} effort</span>
                  </div>
                  <ol className="fix-steps">
                    {(fix.steps || []).map((step, j) => (
                      <li key={j} className="fix-step">{step}</li>
                    ))}
                  </ol>
                  {fix.impact && (
                    <div className="fix-impact">
                      <span className="fi-icon">⚡</span>
                      <span><strong>Expected Impact:</strong> {fix.impact}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── PRIORITY TABLE ─── */}
        {ai.priorityTable?.length > 0 && (
          <section className="aip-section">
            <h2 className="aip-section-title">📋 Priority Action Table</h2>
            <p className="section-sub">Issues ranked by impact — fix top items first</p>
            <div className="table-wrap">
              <table className="priority-table">
                <thead>
                  <tr>
                    <th>#</th><th>Issue</th><th>Category</th>
                    <th>Priority</th><th>Effort</th><th>Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {ai.priorityTable.map((row, i) => (
                    <tr key={i} className={`row-${row.priority}`}>
                      <td className="td-rank">{row.rank}</td>
                      <td className="td-issue">{row.issue}</td>
                      <td className="td-cat">{row.category}</td>
                      <td className="td-priority">
                        <span className="priority-chip" style={{ background: sevColor(row.priority === 'critical' ? 'critical' : row.priority === 'high' ? 'medium' : 'low') }}>
                          {row.priority}
                        </span>
                      </td>
                      <td className="td-effort">
                        <span className={`effort-chip effort-${row.effort}`}>{row.effort}</span>
                      </td>
                      <td className="td-impact">{row.impact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ─── FULL ISSUES LIST ─── */}
        <section className="aip-section">
          <h2 className="aip-section-title">🔍 All Detected Issues ({issues.length})</h2>
          <div className="full-issues-list">
            {issues.map((issue, i) => (
              <div key={i} className="fi-row" style={{ borderLeft: `3px solid ${sevColor(issue.severity)}` }}>
                <div className="fi-top">
                  <span className="fi-id">{issue.id}</span>
                  <span className="fi-title">{issue.title}</span>
                  <span className="fi-sev" style={{ color: sevColor(issue.severity) }}>{issue.severity}</span>
                  <span className="fi-cat">{issue.category}</span>
                </div>
                <p className="fi-desc">{issue.description}</p>
                {issue.howToFix && <p className="fi-fix">🛠 {issue.howToFix}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="aip-footer">
          <div className="aip-footer-brand">WebAuditX Mobile Intelligence</div>
          <div className="aip-footer-meta">
            Report ID: {report._id} · Generated: {new Date(report.createdAt).toUTCString()}
          </div>
        </footer>

      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   MOBILE FRIENDLINESS HOME
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function MobileFriendlinessHome() {
  const [url,      setUrl]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [report,   setReport]   = useState(null);
  const [error,    setError]    = useState('');
  const [progress, setProgress] = useState('');
  const issueRef = useRef(null);

  const msgs = [
    'Fetching page HTML…',
    'Running manual analysis…',
    'Calling Google PageSpeed API…',
    'Checking Moz API metrics…',
    'Detecting mobile issues…',
    'Building structured report…',
    'Generating AI insights…',
    'Saving to database…',
  ];
  let msgIdx = 0;

  const startProgress = () => {
    msgIdx = 0;
    setProgress(msgs[0]);
    return setInterval(() => {
      msgIdx = (msgIdx + 1) % msgs.length;
      setProgress(msgs[msgIdx]);
    }, 2800);
  };

const analyze = async () => {
  if (!url.trim()) return setError('Please enter a URL to analyze.');
  setError(''); setLoading(true); setReport(null);
  const timer = startProgress();
  try {
    const token = localStorage.getItem('wax_token');  // ← ADD

    const res = await fetch(`${API}/mobile-friendliness/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),  // ← ADD
      },
      body: JSON.stringify({ url: url.trim() }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    setReport(data.data);
  } catch (e) {
    setError(e.message || 'Analysis failed. Please try again.');
  } finally {
    clearInterval(timer);
    setLoading(false);
    setProgress('');
  }
};

  const downloadPDF = () => {
    if (!report?._id) return;
    window.open(`${API}/mobile-friendliness/download/${report._id}`, '_blank');
  };

  const openAIInsight = () => {
    if (!report?._id) return;
    window.open(`/mobile-analysis/ai-insight/${report._id}`, '_blank');
  };

  const scrollToIssues = () => {
    issueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const m  = report?.mobileMetrics;
  const s  = report?.scores;
  const issues = report?.issues || [];
  const criticals = issues.filter(i => i.severity === 'critical');
  const mediums   = issues.filter(i => i.severity === 'medium');
  const lows      = issues.filter(i => i.severity === 'low');

  return (
    <div className="mf-app">

      {/* ── Top Nav ── */}
      <nav className="mf-nav">
        <a href="/" className="nav-brand">
          <span className="brand-dot" />WebAuditX
        </a>
        <div className="nav-links">
          <a href="/">Home</a>
          <span className="nav-cur">Mobile Audit</span>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="mf-hero">
        <div className="hero-pill">📱 Mobile Intelligence Engine</div>
        <h1>Mobile-Friendliness<br /><em>Audit</em></h1>
        <p className="hero-sub">
          Google PageSpeed · Moz API · Manual HTML Analysis · AI Insights<br />
          Every metric your site needs to pass mobile-first indexing
        </p>

        <div className="input-shell">
          <div className="input-row">
            <div className="url-wrap">
              <span className="url-icon">🔗</span>
              <input
                type="url"
                className="url-input"
                placeholder="https://yourwebsite.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && analyze()}
              />
            </div>
            <button className="btn-analyze" onClick={analyze} disabled={loading}>
              {loading && <span className="spin" />}
              {loading ? 'Analyzing…' : '▶ Analyze Now'}
            </button>
          </div>
          {error && <div className="input-error">⚠ {error}</div>}
          <div className="api-tags">
            <span>✓ PageSpeed API</span>
            <span>✓ Moz API</span>
            <span>✓ HTML Analyzer</span>
            <span>✓ AI Insights</span>
          </div>
        </div>
      </header>

      {/* ── Loading ── */}
      {loading && (
        <div className="loading-screen">
          <div className="phone-loader">
            <div className="phone-body">
              <div className="phone-notch" />
              <div className="ph-line" /><div className="ph-line short" />
              <div className="ph-img" />
              <div className="ph-line" /><div className="ph-line short" />
              <div className="ph-btn" />
            </div>
            <div className="scan-line" />
          </div>
          <div className="load-status">{progress}</div>
          <div className="load-dots"><span/><span/><span/></div>
        </div>
      )}

      {/* ── Results ── */}
      {report && !loading && (
        <main className="mf-results">

          {/* ──── SCORE DASHBOARD ──── */}
          <section className="score-dashboard">
            <div className="sd-header">
              <div className="sd-info">
                <h2 className="sd-url">{report.url}</h2>
                <div className="sd-sources">
                  {(report.dataSourcesUsed || []).map(src => (
                    <span key={src} className="source-tag">✓ {src}</span>
                  ))}
                </div>
                <div className="sd-summary-pills">
                  <span className="pill-crit">🔴 {criticals.length} Critical</span>
                  <span className="pill-med">🟡 {mediums.length} Medium</span>
                  <span className="pill-low">🟢 {lows.length} Low</span>
                  <button className="pill-link" onClick={scrollToIssues}>↓ View All Issues</button>
                </div>
              </div>
              <ScoreRing score={s?.overall || 0} label="Overall Score" size={160} strokeWidth={10} />
            </div>

            <div className="score-grid">
              {[
                { key:'performance',   label:'Performance',   icon:'⚡' },
                { key:'responsive',    label:'Responsive',    icon:'📐' },
                { key:'usability',     label:'Usability',     icon:'👆' },
                { key:'seo',           label:'SEO',           icon:'🔍' },
                { key:'accessibility', label:'Accessibility', icon:'♿' },
                { key:'security',      label:'Security',      icon:'🔒' },
                { key:'pwa',           label:'PWA',           icon:'📲' },
              ].map(({ key, label, icon }) => {
                const val = s?.[key] ?? 0;
                return (
                  <div key={key} className="score-tile" style={{ borderTop: `3px solid ${scoreColor(val)}` }}>
                    <span className="st-icon">{icon}</span>
                    <span className="st-val" style={{ color: scoreColor(val) }}>{val}</span>
                    <span className="st-label">{label}</span>
                    <div className="st-bar">
                      <div className="st-fill" style={{ width: `${val}%`, background: scoreColor(val) }} />
                    </div>
                    <span className="st-grade" style={{ color: scoreColor(val) }}>{scoreLabel(val)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ──── METRICS LAYERS ──── */}
          <section className="metrics-panel">
            <h2 className="panel-title">📊 Detailed Audit Results</h2>

            <Section icon="⚡" title="Mobile Performance" score={s?.performance} defaultOpen>
              <div className="metrics-grid-2">
                <MetricRow icon="🎨" label="First Contentful Paint"   value={m?.performance?.firstContentfulPaint   || 'N/A'} status={true}  detail="Time until first content appears" />
                <MetricRow icon="🖼" label="Largest Contentful Paint" value={m?.performance?.largestContentfulPaint || 'N/A'} status={true}  detail="Time until main content appears" />
                <MetricRow icon="👆" label="Time to Interactive"       value={m?.performance?.timeToInteractive      || 'N/A'} status={true}  detail="When page becomes usable" />
                <MetricRow icon="🚧" label="Total Blocking Time"       value={m?.performance?.totalBlockingTime      || 'N/A'} status={true}  detail="How long JS blocks the main thread" />
                <MetricRow icon="⚡" label="Speed Index"              value={m?.performance?.speedIndex              || 'N/A'} status={true}  detail="How quickly content is visually filled" />
                <MetricRow icon="📐" label="Cumulative Layout Shift"   value={m?.performance?.cumulativeLayoutShift?.toFixed(3) || 'N/A'} status={(m?.performance?.cumulativeLayoutShift ?? 0) < 0.1} detail="Visual stability score (< 0.1 = good)" />
                <MetricRow icon="⏱" label="Time to First Byte"        value={m?.performance?.timeToFirstByte        || 'N/A'} status={true}  detail="Server response speed" />
                <MetricRow icon="📦" label="Page Size"                 value={m?.performance?.pageSize ? `${m.performance.pageSize} KB` : 'N/A'} status={(m?.performance?.pageSize || 0) < 1000} detail="Total page weight" />
              </div>
            </Section>

            <Section icon="📐" title="Responsive Design" score={s?.responsive}>
              <div className="metrics-grid-2">
                <MetricRow icon="🏷" label="Viewport Meta Tag"  value={m?.responsive?.hasViewportMeta ? 'Present' : 'Missing'} status={m?.responsive?.hasViewportMeta} detail="Required for mobile display" />
                <MetricRow icon="✅" label="Viewport Configured" value={m?.responsive?.viewportCorrect ? 'Correct' : 'Incorrect'} status={m?.responsive?.viewportCorrect} detail="width=device-width, initial-scale=1" />
                <MetricRow icon="📱" label="CSS Media Queries"  value={m?.responsive?.hasMediaQueries ? 'Detected' : 'Not Found'} status={m?.responsive?.hasMediaQueries} detail="Responsive breakpoints in CSS" />
                <MetricRow icon="🎯" label="Flex / Grid Layout" value={m?.responsive?.hasFlexOrGrid ? 'Used' : 'Not Found'} status={m?.responsive?.hasFlexOrGrid} detail="Modern layout systems" />
                <MetricRow icon="📊" label="Responsive Score"   value={`${m?.responsive?.mobileLayoutScore ?? 0}/100`} status={(m?.responsive?.mobileLayoutScore ?? 0) >= 70} detail="Calculated from all responsive signals" />
                <MetricRow icon="↔" label="Overflow Issues"    value={m?.responsive?.overflowIssues ?? 0} status={(m?.responsive?.overflowIssues ?? 0) === 0} detail="Elements breaking outside viewport" />
              </div>
            </Section>

            <Section icon="🔤" title="Text Readability">
              <div className="metrics-grid-2">
                <MetricRow icon="📏" label="Average Font Size"   value={`${m?.readability?.avgFontSize ?? 0}px`} status={(m?.readability?.avgFontSize ?? 0) >= 14} detail="Recommended ≥ 16px for mobile" />
                <MetricRow icon="🔡" label="Small Font Elements" value={m?.readability?.smallFontCount ?? 0} status={(m?.readability?.smallFontCount ?? 0) <= 2} detail="Elements with font-size < 14px" />
                <MetricRow icon="↕" label="Line Spacing"        value={m?.readability?.lineSpacingOk ? 'OK' : 'Issues'} status={m?.readability?.lineSpacingOk} detail="Text line height comfortable to read" />
                <MetricRow icon="🎨" label="Contrast Issues"    value={m?.readability?.contrastIssues ?? 0} status={(m?.readability?.contrastIssues ?? 0) === 0} detail="Low contrast text detected" />
                <MetricRow icon="📝" label="Font Load Speed"    value={m?.readability?.fontLoadPerformance || 'unknown'} status={m?.readability?.fontLoadPerformance === 'ok'} detail="Render-blocking fonts count" />
              </div>
            </Section>

            <Section icon="👆" title="Tap Targets & Touch">
              <div className="metrics-grid-2">
                <MetricRow icon="🔢" label="Total Tap Targets"  value={m?.tapTargets?.totalTargets ?? 0}       status="ok"                                                      detail="All clickable elements found" />
                <MetricRow icon="⚠" label="Targets Too Small"  value={m?.tapTargets?.smallTargets ?? 0}       status={(m?.tapTargets?.smallTargets ?? 0) === 0}                detail="Elements below 48×48px" />
                <MetricRow icon="📊" label="Pass Rate"          value={`${m?.tapTargets?.passRate ?? 100}%`}   status={(m?.tapTargets?.passRate ?? 100) >= 90}                  detail="% of correctly sized tap targets" />
                <MetricRow icon="🤏" label="Pinch-to-Zoom"      value={m?.touchGestures?.pinchZoomEnabled ? 'Enabled' : 'BLOCKED'} status={m?.touchGestures?.pinchZoomEnabled}  detail="Must not be disabled (WCAG 2.1)" />
                <MetricRow icon="📜" label="Smooth Scrolling"   value={m?.touchGestures?.smoothScrolling ? 'OK' : 'Issues'}  status={m?.touchGestures?.smoothScrolling}          detail="Scroll behavior on mobile" />
                {m?.touchGestures?.blockedGestures?.length > 0 && (
                  <MetricRow icon="🚫" label="Blocked Gestures" value={m.touchGestures.blockedGestures.join(', ')} status={false} detail="User gestures being prevented" />
                )}
              </div>
            </Section>

            <Section icon="🖼" title="Images & Media">
              <div className="metrics-grid-2">
                <MetricRow icon="🔢" label="Total Images"       value={m?.images?.totalImages ?? 0}         status="ok"                                                  detail="All <img> elements found" />
                <MetricRow icon="📝" label="Missing Alt Text"   value={m?.images?.missingAlt ?? 0}          status={(m?.images?.missingAlt ?? 0) === 0}                  detail="Images without alt attribute" />
                <MetricRow icon="📦" label="Unoptimized Images" value={m?.images?.unoptimizedImages ?? 0}   status={(m?.images?.unoptimizedImages ?? 0) <= 2}            detail="Missing width/height or oversized" />
                <MetricRow icon="😴" label="Lazy Loading"       value={m?.images?.hasLazyLoading ? 'Enabled' : 'Disabled'} status={m?.images?.hasLazyLoading}          detail="loading=lazy on images below fold" />
                <MetricRow icon="✨" label="Next-Gen Formats"   value={`${m?.images?.nextGenFormats ?? 0} images`} status={(m?.images?.nextGenFormats ?? 0) > 0}         detail="WebP or AVIF format usage" />
              </div>
            </Section>

            <Section icon="🧭" title="Mobile Navigation">
              <div className="metrics-grid-2">
                <MetricRow icon="☰" label="Mobile Menu"        value={m?.navigation?.hasMobileMenu ? 'Detected' : 'Not Found'} status={m?.navigation?.hasMobileMenu}      detail="Hamburger or mobile nav pattern" />
                <MetricRow icon="🍔" label="Hamburger Button"  value={m?.navigation?.hasHamburger ? 'Yes' : 'No'} status={m?.navigation?.hasHamburger}                    detail="Collapsible navigation toggle" />
                <MetricRow icon="🔗" label="Nav Link Count"    value={m?.navigation?.navigationDepth ?? 0} status={(m?.navigation?.navigationDepth ?? 0) > 0}             detail="Links inside <nav> elements" />
                <MetricRow icon="📊" label="Menu Clarity"      value={m?.navigation?.menuClarity || 'unknown'} status={m?.navigation?.menuClarity === 'good'}             detail="Navigation usability rating" />
                <MetricRow icon="⏭" label="Skip Links"        value={m?.navigation?.hasSkipLinks ? 'Present' : 'Missing'} status={m?.navigation?.hasSkipLinks}           detail="Accessibility skip-to-content links" />
              </div>
            </Section>

            <Section icon="🔍" title="Mobile SEO" score={s?.seo}>
              <div className="metrics-grid-2">
                <MetricRow icon="📋" label="Page Title Length"    value={`${m?.seo?.titleLength ?? 0} chars`}  status={(m?.seo?.titleLength ?? 0) >= 10 && (m?.seo?.titleLength ?? 0) <= 70} detail="Ideal: 50–60 characters" />
                <MetricRow icon="📝" label="Meta Description"     value={`${m?.seo?.metaDescLength ?? 0} chars`} status={(m?.seo?.metaDescLength ?? 0) >= 50}                              detail="Ideal: 120–160 characters" />
                <MetricRow icon="H1" label="H1 Heading"           value={`${m?.seo?.h1Count ?? 0} found`}     status={m?.seo?.h1Count === 1}                                               detail="Exactly 1 H1 is recommended" />
                <MetricRow icon="🔗" label="Canonical Tag"        value={m?.seo?.hasCanonical ? 'Present' : 'Missing'} status={m?.seo?.hasCanonical}                                      detail="Prevents duplicate content" />
                <MetricRow icon="📊" label="Structured Data"      value={m?.seo?.hasStructuredData ? 'Found' : 'None'} status={m?.seo?.hasStructuredData}                                 detail="JSON-LD / Schema.org markup" />
                <MetricRow icon="📣" label="Open Graph Tags"      value={m?.seo?.hasOpenGraph ? 'Present' : 'Missing'} status={m?.seo?.hasOpenGraph}                                      detail="Social media sharing tags" />
                <MetricRow icon="📱" label="AMP Version"          value={m?.seo?.hasAmpVersion ? 'Available' : 'None'} status="ok"                                                       detail="Accelerated Mobile Pages link" />
                <MetricRow icon="🤖" label="Mobile-First Index"   value={m?.seo?.mobileFirstIndex ? 'Ready' : 'Not Ready'} status={m?.seo?.mobileFirstIndex}                             detail="Passes Google mobile-first check" />
              </div>
            </Section>

            <Section icon="♿" title="Accessibility" score={s?.accessibility}>
              <div className="metrics-grid-2">
                <MetricRow icon="🏷" label="ARIA Labels"    value={m?.accessibility?.hasAriaLabels ? 'Present' : 'Missing'} status={m?.accessibility?.hasAriaLabels}               detail="Screen reader element labels" />
                <MetricRow icon="⏭" label="Skip Links"     value={m?.accessibility?.hasSkipLinks ? 'Present' : 'Missing'} status={m?.accessibility?.hasSkipLinks}                 detail="Skip to main content links" />
                <MetricRow icon="🖼" label="Images Have Alt" value={m?.accessibility?.imagesHaveAlt ? 'All Present' : 'Some Missing'} status={m?.accessibility?.imagesHaveAlt}       detail="Alt text on all images" />
                <MetricRow icon="📋" label="Form Labels"    value={m?.accessibility?.formsHaveLabels ? 'Labelled' : 'Missing'} status={m?.accessibility?.formsHaveLabels}           detail="Input labels for screen readers" />
                <MetricRow icon="🎨" label="Color Contrast" value={m?.accessibility?.colorContrastOk ? 'OK' : 'Issues Found'} status={m?.accessibility?.colorContrastOk}           detail="Text vs background contrast ratio" />
              </div>
            </Section>

            <Section icon="🔒" title="Security" score={s?.security}>
              <div className="metrics-grid-2">
                <MetricRow icon="🔐" label="HTTPS"         value={m?.security?.isHttps ? 'Secure' : 'NOT SECURE'} status={m?.security?.isHttps}                                   detail="SSL/TLS encrypted connection" />
                <MetricRow icon="🛡" label="HSTS Header"   value={m?.security?.hasHsts ? 'Present' : 'Missing'} status={m?.security?.hasHsts}                                     detail="HTTP Strict Transport Security" />
                <MetricRow icon="⚠" label="Mixed Content" value={m?.security?.hasMixedContent ? 'Detected' : 'None'} status={!m?.security?.hasMixedContent}                      detail="HTTP resources on HTTPS page" />
              </div>
            </Section>

            <Section icon="📲" title="Progressive Web App (PWA)" score={s?.pwa}>
              <div className="metrics-grid-2">
                <MetricRow icon="📋" label="Web App Manifest" value={m?.pwa?.hasManifest ? 'Found' : 'Missing'} status={m?.pwa?.hasManifest}                                          detail="manifest.json for installability" />
                <MetricRow icon="⚙" label="Service Worker"   value={m?.pwa?.hasServiceWorker ? 'Registered' : 'None'} status={m?.pwa?.hasServiceWorker}                              detail="Offline capability & caching" />
                <MetricRow icon="📱" label="Touch Icons"      value={m?.pwa?.hasTouchIcons ? 'Present' : 'Missing'} status={m?.pwa?.hasTouchIcons}                                   detail="App icons for home screen" />
                <MetricRow icon="✅" label="Installable"      value={m?.pwa?.isInstallable ? 'Yes' : 'No'} status={m?.pwa?.isInstallable}                                            detail="Meets PWA install criteria" />
              </div>
            </Section>

            {report.apiResults?.moz?.available && (
              <Section icon="🌐" title="Domain Authority (Moz)">
                <div className="metrics-grid-2">
                  <MetricRow icon="📊" label="Domain Authority" value={report.apiResults.moz.domainAuthority ?? 'N/A'} status="ok" detail="Moz domain strength score (0-100)" />
                  <MetricRow icon="📄" label="Page Authority"   value={report.apiResults.moz.pageAuthority   ?? 'N/A'} status="ok" detail="Moz page-level authority score" />
                  <MetricRow icon="🔗" label="Linking Domains"  value={report.apiResults.moz.linkingDomains  ?? 'N/A'} status="ok" detail="Number of unique domains linking to page" />
                  <MetricRow icon="🚫" label="Spam Score"       value={report.apiResults.moz.spamScore       ?? 'N/A'} status={(report.apiResults.moz.spamScore ?? 0) < 30} detail="Moz spam score (lower is better)" />
                </div>
              </Section>
            )}
          </section>

          {/* ──── ALL ISSUES ──── */}
          <section className="all-issues" ref={issueRef}>
            <div className="ai-header-bar">
              <h2 className="panel-title" style={{ margin: 0 }}>
                🚨 All Detected Issues
                <span className="issue-total-badge">{issues.length} issues</span>
              </h2>
              <div className="issue-filter-pills">
                <span className="ifp critical">🔴 {criticals.length} Critical</span>
                <span className="ifp medium">🟡 {mediums.length} Medium</span>
                <span className="ifp low">🟢 {lows.length} Low</span>
              </div>
            </div>

            {issues.length === 0 ? (
              <div className="no-issues">
                <span className="no-issues-icon">🎉</span>
                <strong>No issues detected!</strong>
                <p>Your website looks great on mobile devices.</p>
              </div>
            ) : (
              <>
                {criticals.length > 0 && (
                  <div className="issue-group">
                    <div className="issue-group-header crit">🔴 Critical Issues — Fix Immediately ({criticals.length})</div>
                    {criticals.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
                  </div>
                )}
                {mediums.length > 0 && (
                  <div className="issue-group">
                    <div className="issue-group-header med">🟡 Medium Issues — Fix Soon ({mediums.length})</div>
                    {mediums.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
                  </div>
                )}
                {lows.length > 0 && (
                  <div className="issue-group">
                    <div className="issue-group-header low">🟢 Low Issues — Nice to Fix ({lows.length})</div>
                    {lows.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
                  </div>
                )}
              </>
            )}
          </section>

          {/* ──── ACTION BAR ──── */}
          <div className="action-bar">
            <div className="ab-left">
              <div className="ab-score">
                <span style={{ color: scoreColor(s?.overall || 0) }}>{s?.overall || 0}</span>/100
              </div>
              <div className="ab-meta">
                <strong>{report.url}</strong>
                <span>{issues.length} issues · {(report.dataSourcesUsed || []).length} data sources · {new Date(report.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="ab-actions">
              <button className="btn-download" onClick={downloadPDF}>
                📄 Download PDF Report
              </button>
              <button className="btn-ai-insight" onClick={openAIInsight}>
                🤖 View AI Insights
                <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>

        </main>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━
   ROOT EXPORT — ROUTER
━━━━━━━━━━━━━━━━━━━━ */
export default function Home() {
  const isAIInsight = window.location.pathname.includes('/ai-insight/');
  return isAIInsight ? <AIInsightPage /> : <MobileFriendlinessHome />;
}