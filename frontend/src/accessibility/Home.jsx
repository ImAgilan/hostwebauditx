import { useState, useRef, useEffect } from 'react';

import './accessibility.css';





const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/* ─── metric config ─── */
const METRIC_META = {
  altText:             { label: 'Alt Text',                icon: '🖼️',  desc: 'Image alt attributes' },
  ariaRoles:           { label: 'ARIA Roles',              icon: '🏷️',  desc: 'WAI-ARIA role validity' },
  colorContrast:       { label: 'Color Contrast',          icon: '🎨',  desc: 'WCAG contrast ratios' },
  keyboardNav:         { label: 'Keyboard Navigation',     icon: '⌨️',  desc: 'Full keyboard access' },
  screenReader:        { label: 'Screen Reader',           icon: '📢',  desc: 'Landmark & structure' },
  focusIndicators:     { label: 'Focus Indicators',        icon: '🔲',  desc: 'Visible focus rings' },
  formLabels:          { label: 'Form Labels',             icon: '📝',  desc: 'Input label association' },
  headingStructure:    { label: 'Heading Structure',       icon: '📑',  desc: 'H1–H6 hierarchy' },
  linkText:            { label: 'Link Text Quality',       icon: '🔗',  desc: 'Descriptive link text' },
  languageAttr:        { label: 'Language Attribute',      icon: '🌐',  desc: 'HTML lang attribute' },
  skipLinks:           { label: 'Skip Navigation',         icon: '⏭️',  desc: 'Skip to content links' },
  tabIndex:            { label: 'Tab Index Order',         icon: '🔢',  desc: 'Natural focus order' },
  videoAudio:          { label: 'Video & Audio',           icon: '🎬',  desc: 'Captions & transcripts' },
  tableStructure:      { label: 'Table Structure',         icon: '📊',  desc: 'Data table headers' },
  readability:         { label: 'Content Readability',     icon: '📖',  desc: 'Cognitive accessibility' },
  errorIdentification: { label: 'Error Identification',   icon: '⚠️',  desc: 'Form error handling' },
  timeouts:            { label: 'Session Timeouts',        icon: '⏱️',  desc: 'Timing adjustments' },
  animations:          { label: 'Motion & Animations',    icon: '✨',  desc: 'Reduced motion support' },
  textResize:          { label: 'Text Resize',             icon: '🔡',  desc: 'Scalable text support' },
  semanticHTML:        { label: 'Semantic HTML',           icon: '🏗️',  desc: 'Meaningful markup' },
};

const STEPS = Object.keys(METRIC_META);

function scoreColor(s) {
  if (s >= 80) return 'var(--green)';
  if (s >= 60) return 'var(--yellow)';
  if (s >= 40) return 'var(--orange)';
  return 'var(--red)';
}

function impactBadge(impact) {
  const map = { critical: '#ef4444', serious: '#f97316', moderate: '#f59e0b', minor: '#6b7280' };
  return map[impact] || '#6b7280';
}

function priorityBadge(p) {
  const map = { high: 'var(--red)', medium: 'var(--yellow)', low: 'var(--muted)' };
  return map[p] || 'var(--muted)';
}

function wcagBadgeColor(level) {
  if (level === 'AAA') return '#22c55e';
  if (level === 'AA')  return '#3b82f6';
  if (level === 'A')   return '#f59e0b';
  return '#ef4444';
}

/* ─── CircleScore component ─── */
function CircleScore({ score, size = 120 }) {
  const r      = (size - 12) / 2;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color  = scoreColor(score);

  return (
    <svg width={size} height={size} className="circle-score-acc">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface2)" strokeWidth="8" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}
      />
      <text x={size/2} y={size/2 + 6} textAnchor="middle" fill={color} fontSize={size * 0.22} fontWeight="700">
        {score}
      </text>
      <text x={size/2} y={size/2 + size * 0.18} textAnchor="middle" fill="var(--muted)" fontSize={size * 0.10}>
        /100
      </text>
    </svg>
  );
}

/* ─── MetricCard component ─── */
function MetricCard({ metricKey, metric, visible }) {
  const meta  = METRIC_META[metricKey] || {};
  const color = scoreColor(metric.score || 0);
  const statusMap = { pass: '✅ Pass', warn: '⚠️ Warning', fail: '❌ Fail', info: 'ℹ️ Info' };

  return (
    <div className={`metric-card-acc ${visible ? 'metric-card--visible-acc' : ''}`}>
      <div className="metric-card__header-acc">
        <span className="metric-card__icon-acc">{meta.icon}</span>
        <div>
          <div className="metric-card__label-acc">{meta.label || metric.name}</div>
          <div className="metric-card__wcag-acc">{metric.wcagCriteria || ''}</div>
        </div>
        <div className="metric-card__score-acc" style={{ color }}>{metric.score ?? '—'}</div>
      </div>
      <div className="metric-card__bar-track-acc">
        <div
          className="metric-card__bar-fill-acc"
          style={{ width: visible ? `${metric.score || 0}%` : '0%', background: color }}
        />
      </div>
      <div className="metric-card__footer-acc">
        <span className={`status-pill-acc status-pill--${metric.status}-acc`}>{statusMap[metric.status] || metric.status}</span>
        <span className="metric-card__details-acc">{metric.details}</span>
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export default function AccessibilityHome() {
  const [url,          setUrl]          = useState('');
  const [phase,        setPhase]        = useState('idle'); // idle | scanning | done | error
  const [data,         setData]         = useState(null);
  const [reportId,     setReportId]     = useState(null);
  const [visibleCards, setVisibleCards] = useState([]);
  const [currentStep,  setCurrentStep]  = useState(0);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [pdfLoading,   setPdfLoading]   = useState(false);
  const [error,        setError]        = useState('');
  const timerRef = useRef(null);

  /* reveal cards one-by-one */
  useEffect(() => {
    if (phase !== 'done' || !data) return;
    setVisibleCards([]);
    let i = 0;
    timerRef.current = setInterval(() => {
      setVisibleCards(prev => [...prev, STEPS[i]]);
      i++;
      if (i >= STEPS.length) clearInterval(timerRef.current);
    }, 200);
    return () => clearInterval(timerRef.current);
  }, [phase, data]);

 async function handleAnalyze() {
  if (!url.trim()) return;
  setPhase('scanning');
  setData(null);
  setVisibleCards([]);
  setCurrentStep(0);
  setError('');

  let step = 0;
  const stepTimer = setInterval(() => {
    step = (step + 1) % STEPS.length;
    setCurrentStep(step);
  }, 600);

  try {
    const token = localStorage.getItem('wax_token');   // ← ADD THIS

    const res = await fetch(`${API}/accessibility/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }), // ← ADD THIS
      },
      body: JSON.stringify({ url: url.trim() }),
    });

    const json = await res.json();
    clearInterval(stepTimer);
    if (!json.success) throw new Error(json.message || 'Analysis failed');
    setReportId(json.id);
    setData(json.data);
    setPhase('done');
  } catch (err) {
    clearInterval(stepTimer);
    setError(err.message || 'Failed to analyze. Check the URL and try again.');
    setPhase('error');
  }
}

  async function handleAIInsight() {
    if (!reportId) return;
    setAiLoading(true);
    try {
      const res  = await fetch(`${API}/accessibility/ai-report/${reportId}`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      const w = window.open('', '_blank');
      w.document.write(buildAIReportHTML(data, json.aiReport));
      w.document.close();
    } catch (err) {
      alert('AI Insight failed: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleDownloadPDF() {
    if (!reportId) return;
    setPdfLoading(true);
    try {
      const res = await fetch(`${API}/accessibility/download/${reportId}`);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const bUrl = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = bUrl;
      a.download = `accessibility-report-${reportId}.pdf`;
      a.click();
      URL.revokeObjectURL(bUrl);
    } catch (err) {
      alert('PDF download failed: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  }

  const metrics = data?.metrics || {};
  const issues  = data?.issues  || [];

  return (
    


    <div className="acc-root-acc">
      {/* ── Header ── */}
      <header className="acc-header-acc">
        <div className="acc-header__inner-acc">
          <a href="/" className="acc-back-acc">← Back</a>
          <div className="acc-header__title-acc">
            <span className="acc-header__icon-acc">♿</span>
            <div>
              <h1>Accessibility & WCAG Compliance</h1>
              <p>WCAG 2.1 / 2.2 — Full Audit Engine</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Search ── */}
      <section className="acc-search-acc">
        <div className="acc-search__inner-acc">
          <div className="acc-search__badge-acc">20 Accessibility Checks</div>
          <h2>Audit Your Website for Accessibility</h2>
          <p>Scan for WCAG 2.1/2.2 compliance issues across 20 categories — screen readers, keyboard navigation, contrast, ARIA, and more.</p>
          <div className="acc-search__form-acc">
            <div className="acc-search__input-wrap-acc">
              <span className="acc-search__input-icon-acc">🔍</span>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                placeholder="https://yourwebsite.com"
                disabled={phase === 'scanning'}
                className="acc-search__input-acc"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={phase === 'scanning' || !url.trim()}
              className="acc-search__btn-acc"
            >
              {phase === 'scanning' ? (
                <><span className="spinner-acc" /> Scanning…</>
              ) : 'Analyze Accessibility'}
            </button>
          </div>
        </div>
      </section>

      {/* ── Scanning overlay ── */}
      {phase === 'scanning' && (
        <section className="acc-scanning-acc">
          <div className="acc-scanning__inner-acc">
            <div className="scan-pulse-acc" />
            <div className="acc-scanning__label-acc">Running Accessibility Checks…</div>
            <div className="acc-scanning__step-acc">
              {METRIC_META[STEPS[currentStep]]?.icon} {METRIC_META[STEPS[currentStep]]?.label}
            </div>
            <div className="acc-scanning__steps-acc">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`acc-scanning__dot-acc ${i <= currentStep ? 'acc-scanning__dot--active-acc' : ''}`}
                  title={METRIC_META[s]?.label}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Error ── */}
      {phase === 'error' && (
        <div className="acc-error-acc">
          <span>⚠️</span> {error}
          <button onClick={() => setPhase('idle')}>Try Again</button>
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'done' && data && (
        <section className="acc-results-acc">

          {/* Score overview */}
          <div className="acc-overview-acc">
            <div className="acc-overview__score-wrap-acc">
              <CircleScore score={data.overallScore} size={150} />
              <div>
                <div className="acc-overview__level-acc" style={{ background: wcagBadgeColor(data.wcagLevel) }}>
                  WCAG {data.wcagLevel}
                </div>
                <div className="acc-overview__url-acc">{data.url}</div>
              </div>
            </div>
            <div className="acc-overview__stats-acc">
              {[
                { label: 'Total Issues',    value: data.summary.totalIssues,    color: 'var(--red)' },
                { label: 'Critical',        value: data.summary.criticalIssues, color: 'var(--red)' },
                { label: 'Serious',         value: data.summary.seriousIssues,  color: 'var(--orange)' },
                { label: 'Moderate',        value: data.summary.moderateIssues, color: 'var(--yellow)' },
                { label: 'Minor',           value: data.summary.minorIssues,    color: 'var(--muted)' },
                { label: 'Passed Checks',   value: `${data.summary.passedChecks}/${data.summary.totalChecks}`, color: 'var(--green)' },
              ].map(s => (
                <div key={s.label} className="acc-stat-acc">
                  <span className="acc-stat__value-acc" style={{ color: s.color }}>{s.value}</span>
                  <span className="acc-stat__label-acc">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics grid */}
          <div className="acc-section-title-acc">
            <span>📋</span> Metric-by-Metric Results
            <small>{visibleCards.length}/{STEPS.length} checks complete</small>
          </div>
          <div className="acc-metrics-grid-acc">
            {STEPS.map(key => (
              metrics[key] ? (
                <MetricCard
                  key={key}
                  metricKey={key}
                  metric={metrics[key]}
                  visible={visibleCards.includes(key)}
                />
              ) : null
            ))}
          </div>

          {/* Issues list */}
          <div className="acc-section-title-acc">
            <span>🐛</span> All Issues Found
            <small>{issues.length} issues detected</small>
          </div>

          {issues.length === 0 ? (
            <div className="acc-no-issues-acc">🎉 No accessibility issues detected!</div>
          ) : (
            <div className="acc-issues-acc">
              {issues.map((issue, idx) => (
                <div key={idx} className="acc-issue-acc">
                  <div className="acc-issue__header-acc">
                    <span className="acc-issue__impact-acc" style={{ background: impactBadge(issue.impact) }}>
                      {issue.impact}
                    </span>
                    <span className="acc-issue__rule-acc">{issue.rule}</span>
                    <span className="acc-issue__wcag-acc">WCAG {issue.wcag}</span>
                    <span className="acc-issue__priority-acc" style={{ color: priorityBadge(issue.priority) }}>
                      ▲ {issue.priority} priority
                    </span>
                    <span className="acc-issue__category-acc">{issue.category}</span>
                  </div>
                  <div className="acc-issue__desc-acc">{issue.description}</div>
                  <div className="acc-issue__fix-acc">
                    <span className="acc-issue__fix-label-acc">🔧 Fix:</span> {issue.fix}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="acc-actions-acc">
            <button
              onClick={handleAIInsight}
              disabled={aiLoading}
              className="acc-btn-acc acc-btn--ai-acc"
            >
              {aiLoading ? <><span className="spinner-acc" /> Generating…</> : '🤖 AI Insight'}
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="acc-btn-acc acc-btn--pdf-acc"
            >
              {pdfLoading ? <><span className="spinner-acc" /> Preparing…</> : '📄 Download PDF Report'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── AI Insight HTML builder ─── */
function buildAIReportHTML(data, aiReport) {
  const issues = data?.issues || [];

  const reportHtml = aiReport
    .replace(/## (.+)/g, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^\|(.+)\|$/gm, (row) => {
      const cells = row.split('|').filter(Boolean).map(c => c.trim());
      return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    });

  const topIssues = issues.slice(0, 15);
  const tableRows = topIssues.map(i => `
    <tr>
      <td><strong>${i.rule}</strong></td>
      <td>WCAG ${i.wcag}</td>
      <td><span class="badge badge--${i.impact}">${i.impact}</span></td>
      <td><span class="badge badge--${i.priority}">${i.priority}</span></td>
      <td>${i.category}</td>
      <td>${i.fix?.slice(0, 80)}…</td>
    </tr>
  `).join('');

  const scoreColor = data.overallScore >= 80 ? '#10b981' : data.overallScore >= 60 ? '#f59e0b' : '#ef4444';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>AI Accessibility Insight — ${data?.url || ''}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'DM Sans',sans-serif;background:#0a0e1a;color:#e2e8f0;line-height:1.7;min-height:100vh}
  .hero{background:linear-gradient(135deg,#0a0e1a 0%,#111827 50%,#0a0e1a 100%);padding:60px 40px;text-align:center;border-bottom:1px solid #1e2d45}
  .hero h1{font-size:2.2rem;font-weight:700;color:#f1f5f9;margin-bottom:8px}
  .hero p{color:#64748b;font-size:1rem}
  .score-ring{width:120px;height:120px;margin:24px auto}
  .score-ring svg{width:100%;height:100%}
  .container{max-width:900px;margin:0 auto;padding:40px 24px}
  .section{background:#111827;border:1px solid #1e2d45;border-radius:10px;padding:32px;margin-bottom:28px}
  h2{font-size:1.3rem;font-weight:700;color:#f1f5f9;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid #1e2d45}
  p{color:#cbd5e1;margin-bottom:12px}
  ul{color:#cbd5e1;padding-left:20px;margin-bottom:12px}
  li{margin-bottom:6px}
  strong{color:#f1f5f9}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px;margin-bottom:28px}
  .stat{background:#111827;border:1px solid #1e2d45;border-radius:10px;padding:20px;text-align:center}
  .stat__val{font-size:2rem;font-weight:700;display:block;font-family:monospace}
  .stat__label{font-size:0.78rem;color:#64748b;margin-top:4px;display:block;text-transform:uppercase;letter-spacing:.06em}
  table{width:100%;border-collapse:collapse;font-size:0.85rem}
  thead tr{background:#1a2236}
  th,td{padding:12px 14px;text-align:left;border-bottom:1px solid #1e2d45}
  th{font-weight:600;color:#64748b;font-size:0.78rem;text-transform:uppercase;letter-spacing:.05em}
  tr:hover{background:#151e2f}
  .badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:0.75rem;font-weight:600;text-transform:capitalize}
  .badge--critical,.badge--high{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.25)}
  .badge--serious{background:rgba(249,115,22,.12);color:#f97316;border:1px solid rgba(249,115,22,.25)}
  .badge--moderate,.badge--medium{background:rgba(245,158,11,.12);color:#f59e0b;border:1px solid rgba(245,158,11,.25)}
  .badge--minor,.badge--low{background:rgba(100,116,139,.12);color:#64748b;border:1px solid rgba(100,116,139,.2)}
  .wcag-badge{display:inline-block;padding:6px 24px;border-radius:99px;font-weight:700;font-size:1rem;margin:16px auto;background:${scoreColor};color:#fff}
  .footer{text-align:center;color:#1e2d45;padding:40px;font-size:0.8rem}
</style>
</head>
<body>
<div class="hero">
  <h1>♿ Accessibility AI Insight</h1>
  <p>${data?.url || ''} · Analyzed ${new Date().toLocaleString()}</p>
  <svg class="score-ring" viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="52" fill="none" stroke="#1e2d45" stroke-width="8"/>
    <circle cx="60" cy="60" r="52" fill="none" stroke="${scoreColor}" stroke-width="8"
      stroke-dasharray="${2*Math.PI*52}" stroke-dashoffset="${2*Math.PI*52 - (data?.overallScore/100)*2*Math.PI*52}"
      stroke-linecap="round" transform="rotate(-90 60 60)"/>
    <text x="60" y="67" text-anchor="middle" fill="${scoreColor}" font-size="26" font-weight="700">${data?.overallScore}</text>
    <text x="60" y="84" text-anchor="middle" fill="#64748b" font-size="11">/100</text>
  </svg>
  <div class="wcag-badge">WCAG Level ${data?.wcagLevel}</div>
</div>
<div class="container">
  <div class="stats">
    <div class="stat"><span class="stat__val" style="color:#ef4444">${data?.summary?.criticalIssues||0}</span><span class="stat__label">Critical</span></div>
    <div class="stat"><span class="stat__val" style="color:#f97316">${data?.summary?.seriousIssues||0}</span><span class="stat__label">Serious</span></div>
    <div class="stat"><span class="stat__val" style="color:#f59e0b">${data?.summary?.moderateIssues||0}</span><span class="stat__label">Moderate</span></div>
    <div class="stat"><span class="stat__val" style="color:#10b981">${data?.summary?.passedChecks||0}</span><span class="stat__label">Passed</span></div>
  </div>
  <div class="section">
    <div>${reportHtml}</div>
  </div>
  <div class="section">
    <h2>📊 Issues — Impact & Priority Table</h2>
    <table>
      <thead><tr><th>Issue</th><th>WCAG</th><th>Impact</th><th>Priority</th><th>Category</th><th>Quick Fix</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
</div>
<div class="footer">Generated by WebAuditX Accessibility Module · WCAG 2.1/2.2 Audit Engine</div>
</body>
</html>`;
}