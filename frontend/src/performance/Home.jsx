import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, Routes, Route } from 'react-router-dom';
import axios from 'axios';

import './performance.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/* ══════════════════════════════════════════
   SHARED HELPERS
══════════════════════════════════════════ */
const scoreColor  = s => s >= 90 ? '#00c853' : s >= 50 ? '#ffab00' : '#ff3d00';
const scoreLabel  = s => s >= 90 ? 'Excellent' : s >= 70 ? 'Good' : s >= 50 ? 'Fair' : 'Poor';
const ratingColor = r => ({ good: '#00c853', 'needs-improvement': '#ffab00', poor: '#ff3d00', unknown: '#666' }[r] || '#666');
const ratingLabel = r => ({ good: 'Good', 'needs-improvement': 'Fair', poor: 'Poor', unknown: 'N/A' }[r] || 'N/A');
const impactColor = i => ({ high: '#ff3d00', medium: '#ffab00', low: '#00c853', info: '#42a5f5' }[i] || '#666');
const kb = b => b ? `${(b / 1024).toFixed(1)} KB` : '0 KB';
const ms = v => v != null ? `${Math.round(v)} ms` : '—';

const CWV_META = {
  lcp:  { label: 'LCP',  full: 'Largest Contentful Paint',  unit: 'ms', icon: '🖼️' },
  fcp:  { label: 'FCP',  full: 'First Contentful Paint',    unit: 'ms', icon: '🎨' },
  cls:  { label: 'CLS',  full: 'Cumulative Layout Shift',   unit: '',   icon: '📐' },
  ttfb: { label: 'TTFB', full: 'Time to First Byte',        unit: 'ms', icon: '⚡' },
  tbt:  { label: 'TBT',  full: 'Total Blocking Time',       unit: 'ms', icon: '🚧' },
  tti:  { label: 'TTI',  full: 'Time to Interactive',       unit: 'ms', icon: '🖱️' },
  si:   { label: 'SI',   full: 'Speed Index',               unit: 'ms', icon: '📊' },
  inp:  { label: 'INP',  full: 'Interaction to Next Paint', unit: 'ms', icon: '👆' },
  fid:  { label: 'FID',  full: 'First Input Delay',         unit: 'ms', icon: '⌨️' },
};

const SECTION_ICONS = {
  overview: '🌐', working: '✅', critical: '🚨',
  address: '⚠️', fix: '💡', table: '📊', score: '🎯',
};

function getSectionIcon(title) {
  const t = title.toLowerCase();
  if (t.includes('overview'))                     return SECTION_ICONS.overview;
  if (t.includes('working'))                      return SECTION_ICONS.working;
  if (t.includes('critical'))                     return SECTION_ICONS.critical;
  if (t.includes('address') || t.includes('issues to')) return SECTION_ICONS.address;
  if (t.includes('fix'))                          return SECTION_ICONS.fix;
  if (t.includes('table') || t.includes('summary')) return SECTION_ICONS.table;
  if (t.includes('score'))                        return SECTION_ICONS.score;
  return '📋';
}

/* ══════════════════════════════════════════
   SHARED COMPONENTS
══════════════════════════════════════════ */

/* ── Circular gauge ── */
function Gauge({ score, size = 100 }) {
  const r    = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color  = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e1e2e" strokeWidth="7"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth="7" strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1.2s ease' }}/>
      <text x={size/2} y={size/2+5} textAnchor="middle" fill={color}
        fontSize={size/4} fontWeight="800" fontFamily="'Rajdhani', monospace">
        {score}
      </text>
    </svg>
  );
}

/* ── Progress bar ── */
function Bar({ label, value, max, unit = '', color = '#4f46e5' }) {
  const pct = max ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="bar-row">
      <div className="bar-label">{label}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="bar-value">{value != null ? `${value}${unit}` : '—'}</div>
    </div>
  );
}

/* ── Metric card ── */
function MetricCard({ metaKey, data, delay = 0 }) {
  const meta = CWV_META[metaKey];
  if (!meta || !data) return null;
  const color   = ratingColor(data.rating);
  const display = data.value != null
    ? (metaKey === 'cls' ? data.value.toFixed(3) : `${Math.round(data.value)}${meta.unit}`)
    : '—';
  return (
    <div className="metric-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="metric-icon">{meta.icon}</div>
      <div className="metric-label">{meta.label}</div>
      <div className="metric-full">{meta.full}</div>
      <div className="metric-value" style={{ color }}>{display}</div>
      <div className="metric-badge" style={{ background: color + '22', color }}>
        {ratingLabel(data.rating)}
      </div>
    </div>
  );
}

/* ── Issue row (collapsible) ── */
function IssueRow({ issue, idx }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="issue-row" style={{ animationDelay: `${idx * 60}ms` }}>
      <div className="issue-header" onClick={() => setOpen(!open)}>
        <span className="issue-impact" style={{ background: impactColor(issue.impact) + '22', color: impactColor(issue.impact) }}>
          {issue.impact?.toUpperCase()}
        </span>
        <span className="issue-cat">[{issue.category}]</span>
        <span className="issue-title">{issue.title}</span>
        <span className="issue-chevron">{open ? '▲' : '▼'}</span>
      </div>
      {open && <div className="issue-desc">{issue.description}</div>}
    </div>
  );
}

/* ── Markdown table renderer ── */
function MDTable({ lines }) {
  const tableLines = lines.filter(l => l.trim().startsWith('|'));
  if (tableLines.length < 2) return null;
  const rows    = tableLines.filter(l => !l.includes('---'));
  if (rows.length < 2) return null;
  const headers = rows[0].split('|').map(c => c.trim()).filter(Boolean);
  const body    = rows.slice(1);
  return (
    <div className="ai-table-wrap">
      <table className="ai-table">
        <thead>
          <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.split('|').map(c => c.trim()).filter(Boolean).map((c, ci) => {
                const lower    = c.toLowerCase();
                const isImpact = ['high','medium','low','critical'].some(w => lower.includes(w));
                const lvl = lower.includes('high') || lower.includes('critical') ? 'high' : lower.includes('medium') ? 'medium' : 'low';
                return (
                  <td key={ci}>
                    {isImpact
                      ? <span className="impact-pill" style={{ background: impactColor(lvl) + '22', color: impactColor(lvl) }}>{c}</span>
                      : c}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Section body renderer (AI report markdown) ── */
function SectionBody({ lines }) {
  const tableLines = lines.filter(l =>  l.trim().startsWith('|'));
  const nonTable   = lines.filter(l => !l.trim().startsWith('|'));
  return (
    <div className="section-body">
      {nonTable.map((line, i) => {
        if (!line.trim()) return <div key={i} className="spacer" />;
        if (/^\d+\./.test(line.trim())) {
          const text = line.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          return (
            <div key={i} className="list-item numbered">
              <span className="list-num">{line.match(/^(\d+)/)?.[1]}</span>
              <span dangerouslySetInnerHTML={{ __html: text }} />
            </div>
          );
        }
        if (/^[-*•]/.test(line.trim())) {
          const text = line.replace(/^[-*•]\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          return (
            <div key={i} className="list-item bullet">
              <span className="bullet-dot">▸</span>
              <span dangerouslySetInnerHTML={{ __html: text }} />
            </div>
          );
        }
        const html = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code>$1</code>');
        return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
      {tableLines.length > 0 && <MDTable lines={tableLines} />}
    </div>
  );
}

/* ── Parse markdown ## sections ── */
function parseSections(report) {
  const sections = [];
  let currentTitle = '';
  let currentLines = [];
  (report || '').split('\n').forEach(line => {
    if (line.startsWith('## ')) {
      if (currentTitle) sections.push({ title: currentTitle, lines: currentLines });
      currentTitle = line.replace('## ', '').trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  });
  if (currentTitle) sections.push({ title: currentTitle, lines: currentLines });
  return sections;
}

/* ══════════════════════════════════════════
   PAGE 1 — PERFORMANCE HOME
══════════════════════════════════════════ */
function PerformanceHome() {
  const navigate = useNavigate();
  const [url,        setUrl]        = useState('');
  const [loading,    setLoading]    = useState(false);
  const [loadStep,   setLoadStep]   = useState('');
  const [data,       setData]       = useState(null);
  const [error,      setError]      = useState('');
  const [aiLoading,  setAiLoading]  = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const resultRef = useRef(null);

  const steps = [
    'Connecting to PageSpeed API…',
    'Running Lighthouse audit…',
    'Measuring Core Web Vitals…',
    'Analysing resources & images…',
    'Checking cache headers…',
    'Detecting render-blocking…',
    'Compiling results…',
  ];

  useEffect(() => {
    if (!loading) return;
    let i = 0;
    setLoadStep(steps[0]);
    const t = setInterval(() => { i = (i + 1) % steps.length; setLoadStep(steps[i]); }, 2200);
    return () => clearInterval(t);
  }, [loading]);

 const handleAnalyze = async () => {
  if (!url.trim()) { setError('Please enter a URL'); return; }
  setError(''); setData(null); setLoading(true);
  try {
    const token = localStorage.getItem('wax_token');  // ← ADD

    const { data: res } = await axios.post(
      `${API}/performance/analyze`,
      { url: url.trim() },
      { headers: { ...(token && { 'Authorization': `Bearer ${token}` }) } }  // ← ADD
    );
    setData(res.data);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  } catch (e) {
    setError(e.response?.data?.message || 'Analysis failed. Please try again.');
  } finally { setLoading(false); }
};

  const handleAI = async () => {
    if (!data?._id) return;
    setAiLoading(true);
    try {
      if (!data.aiReport) await axios.post(`${API}/performance/ai-report/${data._id}`);
      navigate(`/performance/ai-insight/${data._id}`);
    } catch (e) {
      setError(e.response?.data?.message || 'AI report generation failed.');
      setAiLoading(false);
    }
  };

  const handlePDF = async () => {
    if (!data?._id) return;
    setPdfLoading(true);
    try {
      const res = await axios.get(`${API}/performance/download/${data._id}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `performance-report-${data._id}.pdf`;
      a.click();
    } catch { setError('PDF download failed.'); }
    finally { setPdfLoading(false); }
  };

  const cwvKeys = ['lcp', 'fcp', 'cls', 'ttfb', 'tbt', 'tti', 'si', 'inp'];

  return (
    <div className="perf-root">
      {/* ── Hero ── */}
      <div className="perf-hero">
        <div className="hero-grid-bg" />
        <div className="hero-content">
          <div className="hero-badge">⚡ Performance Audit</div>
          <h1 className="hero-title">Website Speed<br /><span>Analysis</span></h1>
          <p className="hero-sub">Lighthouse · Core Web Vitals · PageSpeed · Resource Analysis</p>

          <div className="url-bar">
            <span className="url-icon">🌐</span>
            <input
              type="text"
              className="url-input"
              placeholder="https://example.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            />
            <button className="analyze-btn" onClick={handleAnalyze} disabled={loading}>
              {loading ? <span className="spin" /> : '⚡ Analyse'}
            </button>
          </div>

          {error && <div className="error-msg">⚠ {error}</div>}

          {loading && (
            <div className="loading-status">
              <div className="loading-bar"><div className="loading-fill" /></div>
              <p>{loadStep}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      {data && (
        <div className="results-container" ref={resultRef}>

          {data.source === 'manual' && (
            <div className="source-badge">⚠ PageSpeed API unavailable — showing partial data from direct fetch</div>
          )}

          {/* Scores */}
          <section className="result-section">
            <h2 className="section-title">🏆 Lighthouse Scores</h2>
            <div className="scores-grid">
              {[
                { label: 'Performance',   val: data.scores?.performance },
                { label: 'Accessibility', val: data.scores?.accessibility },
                { label: 'Best Practices',val: data.scores?.bestPractices },
                { label: 'SEO',           val: data.scores?.seo },
              ].map(({ label, val }, i) => (
                <div key={i} className="score-card" style={{ animationDelay: `${i * 100}ms` }}>
                  <Gauge score={val ?? 0} size={90} />
                  <div className="score-label">{label}</div>
                </div>
              ))}
            </div>
            <div className="overall-score">
              <span>Overall Score: </span>
              <strong style={{ color: scoreColor(data.scores?.overall ?? 0) }}>
                {data.scores?.overall ?? 0}/100
              </strong>
            </div>
          </section>

          {/* Core Web Vitals */}
          <section className="result-section">
            <h2 className="section-title">📐 Core Web Vitals</h2>
            <div className="metrics-grid">
              {cwvKeys.map((k, i) =>
                data.coreWebVitals?.[k] && (
                  <MetricCard key={k} metaKey={k} data={data.coreWebVitals[k]} delay={i * 80} />
                )
              )}
            </div>
          </section>

          {/* Page Load Times */}
          {(data.pageLoad?.mobile || data.pageLoad?.desktop) && (
            <section className="result-section">
              <h2 className="section-title">⏱ Page Load Times</h2>
              <div className="load-times">
                <div className="load-card">
                  <span className="load-icon">📱</span>
                  <span className="load-label">Mobile</span>
                  <span className="load-val">{ms(data.pageLoad?.mobile)}</span>
                </div>
                <div className="load-card">
                  <span className="load-icon">🖥️</span>
                  <span className="load-label">Desktop</span>
                  <span className="load-val">{ms(data.pageLoad?.desktop)}</span>
                </div>
              </div>
            </section>
          )}

          {/* Page Summary */}
          {data.summary && (
            <section className="result-section">
              <h2 className="section-title">📦 Page Resource Summary</h2>
              <div className="summary-grid">
                {[
                  { label: 'Total Page Size',     val: kb(data.summary.totalPageSize),   icon: '📄' },
                  { label: 'Total Requests',       val: data.summary.totalRequests,       icon: '🔗' },
                  { label: 'JavaScript Size',      val: kb(data.summary.totalJSSize),     icon: '⚙️' },
                  { label: 'CSS Size',             val: kb(data.summary.totalCSSSize),    icon: '🎨' },
                  { label: 'Image Size',           val: kb(data.summary.totalImageSize),  icon: '🖼️' },
                  { label: 'Render-Blocking',      val: data.summary.renderBlockingCount, icon: '🚧' },
                  { label: 'Images w/o Lazy Load', val: data.summary.imagesWithoutLazy,  icon: '😴' },
                  { label: 'Optimisable Images',   val: data.summary.optimizableImages,  icon: '✂️' },
                  { label: 'Poor Cache Assets',    val: data.summary.poorCacheCount,     icon: '🕒' },
                ].map(({ label, val, icon }, i) => (
                  <div key={i} className="summary-card" style={{ animationDelay: `${i * 60}ms` }}>
                    <span className="sum-icon">{icon}</span>
                    <span className="sum-val">{val ?? '—'}</span>
                    <span className="sum-label">{label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* JS & CSS Resources */}
          {data.resources?.length > 0 && (
            <section className="result-section">
              <h2 className="section-title">📁 JavaScript & CSS Files</h2>
              <div className="resource-table-wrap">
                <table className="resource-table">
                  <thead>
                    <tr>
                      <th>Resource</th><th>Type</th><th>Size</th>
                      <th>Transfer</th><th>Render-Blocking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.resources
                      .filter(r => ['Script','Stylesheet'].includes(r.type))
                      .slice(0, 30)
                      .map((r, i) => (
                        <tr key={i} className={r.renderBlocking ? 'rb-row' : ''}>
                          <td className="res-url" title={r.url}>{r.url.split('/').pop() || r.url.slice(0,60)}</td>
                          <td><span className={`type-badge type-${r.type?.toLowerCase()}`}>{r.type}</span></td>
                          <td>{kb(r.size)}</td>
                          <td>{kb(r.transferSize)}</td>
                          <td>{r.renderBlocking ? <span className="rb-badge">⚠ Blocking</span> : <span className="ok-badge">✓ OK</span>}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Render-Blocking */}
          {data.resources?.filter(r => r.renderBlocking).length > 0 && (
            <section className="result-section">
              <h2 className="section-title">🚧 Render-Blocking Resources</h2>
              <div className="rb-list">
                {data.resources.filter(r => r.renderBlocking).map((r, i) => (
                  <div key={i} className="rb-item">
                    <span className="rb-icon">⛔</span>
                    <span className="rb-url" title={r.url}>{r.url}</span>
                    <span className="rb-size">{kb(r.size)}</span>
                  </div>
                ))}
              </div>
              <p className="hint">
                These resources block the browser from rendering the page. Consider inlining critical CSS,
                deferring JS, or using <code>rel="preload"</code>.
              </p>
            </section>
          )}

          {/* Images */}
          {data.images?.length > 0 && (
            <section className="result-section">
              <h2 className="section-title">🖼️ Image Optimisation</h2>
              <div className="resource-table-wrap">
                <table className="resource-table">
                  <thead>
                    <tr><th>Image</th><th>Original Size</th><th>Potential Savings</th><th>Lazy Load</th><th>Modern Format</th></tr>
                  </thead>
                  <tbody>
                    {data.images.slice(0, 20).map((img, i) => (
                      <tr key={i}>
                        <td className="res-url" title={img.url}>{img.url.split('/').pop() || img.url.slice(0,50)}</td>
                        <td>{kb(img.originalSize)}</td>
                        <td className="savings">{img.potentialSavings > 0 ? `💾 ${kb(img.potentialSavings)}` : '—'}</td>
                        <td>{img.hasLazyLoad    ? <span className="ok-badge">✓ Yes</span>       : <span className="rb-badge">✗ No</span>}</td>
                        <td>{img.hasModernFormat ? <span className="ok-badge">✓ WebP/AVIF</span> : <span className="warn-badge">⚠ Legacy</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Cache headers */}
          {data.cacheHeaders?.length > 0 && (
            <section className="result-section">
              <h2 className="section-title">🕒 Cache Policy Analysis</h2>
              <div className="resource-table-wrap">
                <table className="resource-table">
                  <thead>
                    <tr><th>Asset</th><th>Type</th><th>Max-Age (s)</th><th>Rating</th></tr>
                  </thead>
                  <tbody>
                    {data.cacheHeaders.slice(0, 20).map((c, i) => (
                      <tr key={i}>
                        <td className="res-url" title={c.url}>{c.url.split('/').pop() || c.url.slice(0,50)}</td>
                        <td>{c.type}</td>
                        <td>{c.maxAge?.toLocaleString()}</td>
                        <td>
                          <span className={`cache-badge cache-${c.rating}`}>
                            {c.rating === 'good' ? '✓ Good' : c.rating === 'fair' ? '⚠ Fair' : '✗ Poor'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TTFB */}
          {data.coreWebVitals?.ttfb?.value != null && (
            <section className="result-section">
              <h2 className="section-title">⚡ Server Response Time (TTFB)</h2>
              <Bar
                label="TTFB"
                value={Math.round(data.coreWebVitals.ttfb.value)}
                max={3000}
                unit=" ms"
                color={ratingColor(data.coreWebVitals.ttfb.rating)}
              />
              <div className="ttfb-thresholds">
                <span className="thresh good">Good: &lt;800ms</span>
                <span className="thresh fair">Fair: 800–1800ms</span>
                <span className="thresh poor">Poor: &gt;1800ms</span>
              </div>
            </section>
          )}

          {/* All Issues */}
          {data.issues?.length > 0 && (
            <section className="result-section issues-section">
              <h2 className="section-title">🚨 All Detected Issues ({data.issues.length})</h2>
              <div className="issues-counts">
                {['high','medium','low'].map(lvl => {
                  const count = data.issues.filter(i => i.impact === lvl).length;
                  return count > 0 ? (
                    <span key={lvl} className="impact-count" style={{ background: impactColor(lvl) + '22', color: impactColor(lvl) }}>
                      {count} {lvl}
                    </span>
                  ) : null;
                })}
              </div>
              <div className="issues-list">
                {data.issues.map((issue, i) => <IssueRow key={i} issue={issue} idx={i} />)}
              </div>
            </section>
          )}

          {/* Action buttons */}
          <div className="action-bar">
            <button className="btn-ai" onClick={handleAI} disabled={aiLoading}>
              {aiLoading ? <><span className="spin" /> Generating Insights…</> : '🤖 AI Insights'}
            </button>
            {data.aiReport && (
              <button className="btn-ai btn-view" onClick={() => navigate(`/performance/ai-insight/${data._id}`)}>
                👁 View AI Report
              </button>
            )}
            <button className="btn-pdf" onClick={handlePDF} disabled={pdfLoading}>
              {pdfLoading ? <><span className="spin" /> Generating PDF…</> : '📄 Download Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   PAGE 2 — AI INSIGHT
══════════════════════════════════════════ */
function PerformanceAIInsight() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [genLoad, setGenLoad] = useState(false);
  const [error,   setError]   = useState('');
  const [active,  setActive]  = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data: res } = await axios.get(`${API}/performance/report/${id}`);
        if (res.data.aiReport) {
          setData(res.data);
        } else {
          await generateReport(res.data);
        }
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to load report.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const generateReport = async () => {
    setGenLoad(true);
    try {
      const { data: res } = await axios.post(`${API}/performance/ai-report/${id}`);
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'AI generation failed.');
    } finally {
      setGenLoad(false);
    }
  };

  const handlePDF = async () => {
    try {
      const res = await axios.get(`${API}/performance/download/${id}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `performance-report-${id}.pdf`;
      a.click();
    } catch { alert('PDF download failed.'); }
  };

  /* Loading state */
  if (loading || genLoad) {
    return (
      <div className="ai-page">
        <div className="ai-loading-screen">
          <div className="ai-spinner" />
          <h2>{genLoad ? 'Generating AI Insights…' : 'Loading Report…'}</h2>
          <p>{genLoad ? 'Analysing your website performance data with AI…' : 'Fetching saved report…'}</p>
          {genLoad && (
            <div className="provider-chain">
              {['Groq','Gemini','Anthropic','DeepSeek'].map((p, i) => (
                <div key={p} className="provider-dot" style={{ animationDelay: `${i * 0.4}s` }}>
                  <span>{p}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* Error state */
  if (error) {
    return (
      <div className="ai-page">
        <div className="ai-error-screen">
          <div className="error-icon">⚠️</div>
          <h2>Something went wrong</h2>
          <p>{error}</p>
          <button className="btn-back" onClick={() => navigate('/performance')}>← Back to Audit</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const sections = parseSections(data.aiReport);
  const overall  = data.scores?.overall ?? 0;

  return (
    <div className="ai-page">

      {/* Top Nav */}
      <div className="ai-topnav">
        <button className="btn-back" onClick={() => navigate('/performance')}>
          ← Back to Audit
        </button>
        <div className="nav-center">
          <span className="nav-badge">🤖 AI Performance Insights</span>
        </div>
        <div className="nav-actions">
          <button className="btn-regen" onClick={generateReport} disabled={genLoad}>
            {genLoad ? '…' : '🔄 Regenerate'}
          </button>
          <button className="btn-pdf-sm" onClick={handlePDF}>
            📄 Download PDF
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="ai-hero">
        <div className="ai-hero-left">
          <div className="audit-url">🌐 {data.url}</div>
          <h1 className="ai-hero-title">
            Website Performance<br />
            <span style={{ color: scoreColor(overall) }}>
              {scoreLabel(overall)} — {overall}/100
            </span>
          </h1>
          <div className="ai-generated-at">
            AI report generated: {data.aiGeneratedAt ? new Date(data.aiGeneratedAt).toLocaleString() : 'Just now'}
          </div>
        </div>
        <div className="ai-hero-scores">
          {[
            { label: 'Performance',   val: data.scores?.performance },
            { label: 'Accessibility', val: data.scores?.accessibility },
            { label: 'Best Practices',val: data.scores?.bestPractices },
            { label: 'SEO',           val: data.scores?.seo },
          ].map(({ label, val }) => (
            <div key={label} className="mini-score">
              <div className="mini-score-val" style={{ color: scoreColor(val ?? 0) }}>{val ?? 0}</div>
              <div className="mini-score-label">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="ai-content">

        {/* Sidebar */}
        <nav className="ai-sidebar">
          {sections.map((sec, i) => (
            <button
              key={i}
              className={`sidebar-item ${active === i ? 'active' : ''}`}
              onClick={() => {
                setActive(i);
                document.getElementById(`section-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <span className="sidebar-icon">{getSectionIcon(sec.title)}</span>
              <span className="sidebar-label">{sec.title.replace(/^[^\w]*/, '').trim()}</span>
            </button>
          ))}
        </nav>

        {/* Main */}
        <main className="ai-main">
          {sections.map((sec, i) => (
            <div key={i} id={`section-${i}`} className="ai-section" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="ai-section-header">
                <span className="ai-section-icon">{getSectionIcon(sec.title)}</span>
                <h2>{sec.title.replace(/^[\u{1F300}-\u{1FFFF}]|^[^\w\s]/u, '').trim()}</h2>
              </div>
              <SectionBody lines={sec.lines} />
            </div>
          ))}

          {/* Issues quick-ref */}
          {data.issues?.length > 0 && (
            <div className="ai-section issues-ref">
              <div className="ai-section-header">
                <span className="ai-section-icon">🔍</span>
                <h2>Detected Issues ({data.issues.length})</h2>
              </div>
              <div className="issues-grid">
                {data.issues.map((issue, i) => (
                  <div key={i} className="issue-card">
                    <div className="issue-card-top">
                      <span className="issue-impact-pill" style={{
                        background: impactColor(issue.impact) + '22',
                        color: impactColor(issue.impact),
                      }}>
                        {issue.impact?.toUpperCase()}
                      </span>
                      <span className="issue-cat-tag">{issue.category}</span>
                    </div>
                    <div className="issue-card-title">{issue.title}</div>
                    <div className="issue-card-desc">{issue.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   ROOT EXPORT — wraps both pages via Routes
══════════════════════════════════════════ */
export { PerformanceHome, PerformanceAIInsight };

export default function PerformanceModule() {
  return (
    <Routes>
      <Route index element={<PerformanceHome />} />
      <Route path="ai-insight/:id" element={<PerformanceAIInsight />} />
    </Routes>
  );
}