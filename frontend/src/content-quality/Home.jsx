import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import UserNav from '../components/UserNav';
import '../components/UserNav.css';
import './content-quality.css';

/* ─── API base ─── */
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/* ─── Score ring helper ─── */
function ScoreRing({ score, size = 80, stroke = 7, label }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = Math.max(0, Math.min(100, score || 0));
  const dash = (pct / 100) * circ;
  const color = pct >= 70 ? '#00b894' : pct >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="score-ring-wrap-cq" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div className="score-ring-inner-cq">
        <span className="score-ring-val-cq" style={{ color }}>{pct}</span>
        {label && <span className="score-ring-label-cq">{label}</span>}
      </div>
    </div>
  );
}

/* ─── Impact badge ─── */
function ImpactBadge({ impact }) {
  const map = {
    critical: { label: 'Critical', cls: 'badge-critical-cq' },
    high:     { label: 'High',     cls: 'badge-high-cq' },
    medium:   { label: 'Medium',   cls: 'badge-medium-cq' },
    low:      { label: 'Low',      cls: 'badge-low-cq' },
    info:     { label: 'Info',     cls: 'badge-info-cq' },
  };
  const b = map[impact] || map.info;
  return <span className={`badge-cq ${b.cls}`}>{b.label}</span>;
}

/* ─── Status icon ─── */
function StatusIcon({ status }) {
  if (status === 'pass')  return <span className="st-pass-cq">✓</span>;
  if (status === 'fail')  return <span className="st-fail-cq">✗</span>;
  if (status === 'warn')  return <span className="st-warn-cq">⚠</span>;
  return <span className="st-info-cq">ℹ</span>;
}

/* ─── Category sections config ─── */
const CATEGORIES = [
  { key: 'testimonials',      label: 'Testimonials & Reviews',         icon: '💬' },
  { key: 'trustBadges',       label: 'Client Logos & Trust Badges',    icon: '🏆' },
  { key: 'reviewWidgets',     label: 'Embedded Review Widgets',        icon: '⭐' },
  { key: 'schemaMarkup',      label: 'Schema.org Markup',              icon: '🔖' },
  { key: 'contactInfo',       label: 'Contact Information',            icon: '📞' },
  { key: 'contactPlacement',  label: 'Contact Placement',              icon: '📍' },
  { key: 'liveChat',          label: 'Live Chat & Contact Forms',      icon: '💬' },
  { key: 'socialMedia',       label: 'Social Media Presence',          icon: '📲' },
  { key: 'securityBadges',    label: 'Security & SSL Badges',          icon: '🔒' },
  { key: 'contentQuality',    label: 'Content Quality & SEO',          icon: '📝' },
  { key: 'wcagAccessibility', label: 'WCAG Accessibility',             icon: '♿' },
  { key: 'seoContent',        label: 'SEO Content Score',              icon: '🎯' },
];

/* ═══════════════════════════════════════════════════════════
   AI INSIGHT MODAL
═══════════════════════════════════════════════════════════ */
function AIInsightModal({ report, onClose }) {
  const ai = report.aiReport || {};
  const priorityColor = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#00b894', info: '#3b82f6' };
  const effortColor   = { Easy: '#00b894', Medium: '#f59e0b', Hard: '#ef4444' };

  return (
    <div className="ai-overlay-cq" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ai-modal-cq">
        <div className="ai-modal-header-cq">
          <div className="ai-modal-title-cq">
            <span className="ai-badge-cq">✦ AI</span>
            <span>Insight Report</span>
          </div>
          <div className="ai-modal-meta-cq">
            <span className="ai-provider-cq">{ai.provider || 'AI Analysis'}</span>
            <button className="ai-close-cq" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="ai-modal-url-cq">
          <span className="ai-url-label-cq">Analyzed URL:</span>
          <a href={report.url} target="_blank" rel="noreferrer">{report.url}</a>
        </div>

        <div className="ai-score-band-cq">
          <ScoreRing score={report.overallScore} size={96} stroke={8} />
          <div className="ai-score-text-cq">
            <h2>Overall Website Health Score</h2>
            <p className={report.overallScore >= 70 ? 'score-good-cq' : report.overallScore >= 40 ? 'score-ok-cq' : 'score-bad-cq'}>
              {report.overallScore >= 70 ? '✓ Good standing — keep improving' : report.overallScore >= 40 ? '⚠ Needs attention in several areas' : '✗ Critical issues require immediate action'}
            </p>
          </div>
        </div>

        <div className="ai-sections-cq">
          {ai.websiteHealth && (
            <section className="ai-section-cq">
              <h3>🌐 Website Health Summary</h3>
              <p>{ai.websiteHealth}</p>
            </section>
          )}

          {ai.whatWorksWell && (
            <section className="ai-section-cq ai-section-good-cq">
              <h3>✅ What Is Working Well</h3>
              <p style={{ whiteSpace: 'pre-line' }}>{ai.whatWorksWell}</p>
            </section>
          )}

          {ai.issuesSummary && (
            <section className="ai-section-cq ai-section-issues-cq">
              <h3>⚠ Issues Found</h3>
              <p style={{ whiteSpace: 'pre-line' }}>{ai.issuesSummary}</p>
            </section>
          )}

          {ai.howToFix && (
            <section className="ai-section-cq ai-section-fix-cq">
              <h3>🔧 How To Fix Them</h3>
              <p style={{ whiteSpace: 'pre-line' }}>{ai.howToFix}</p>
            </section>
          )}

          {ai.priorityTable?.length > 0 && (
            <section className="ai-section-cq">
              <h3>📊 Priority Issue Table</h3>
              <div className="ai-table-wrap-cq">
                <table className="ai-table-cq">
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Impact</th>
                      <th>Priority</th>
                      <th>Effort</th>
                      <th>Fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ai.priorityTable.map((row, i) => (
                      <tr key={i}>
                        <td className="ai-td-issue-cq">{row.issue}</td>
                        <td><span className="ai-impact-dot-cq" style={{ background: priorityColor[row.impact?.toLowerCase()] || '#9ca3af' }}>{row.impact}</span></td>
                        <td><span className="ai-priority-cq">{row.priority}</span></td>
                        <td><span className="ai-effort-cq" style={{ color: effortColor[row.effort] || '#9ca3af' }}>{row.effort}</span></td>
                        <td className="ai-td-fix-cq">{row.fix}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className="ai-modal-footer-cq">
          <span>Generated by WebAuditX AI Engine · {ai.provider}</span>
          <button className="btn-secondary-cq" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   METRIC ROW
═══════════════════════════════════════════════════════════ */
function MetricRow({ m }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`metric-row-cq metric-${m.status}-cq`}>
      <div className="metric-main-cq" onClick={() => m.details && setOpen(!open)}>
        <StatusIcon status={m.status} />
        <span className="metric-name-cq">{m.name}</span>
        <span className="metric-value-cq">{String(m.value)}</span>
        {m.details && <span className="metric-expand-cq">{open ? '▲' : '▼'}</span>}
      </div>
      <p className="metric-desc-cq">{m.description}</p>
      {open && m.details && (
        <pre className="metric-details-cq">{JSON.stringify(m.details, null, 2)}</pre>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CATEGORY PANEL
═══════════════════════════════════════════════════════════ */
function CategoryPanel({ cat, score, metrics, visible }) {
  const [open, setOpen] = useState(false);
  const color = score >= 70 ? '#00b894' : score >= 40 ? '#f59e0b' : '#ef4444';

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setOpen(true), 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return (
    <div className={`cat-panel-cq ${open ? 'cat-open-cq' : ''}`} style={{ '--cat-color': color }}>
      <div className="cat-header-cq" onClick={() => setOpen(!open)}>
        <span className="cat-icon-cq">{cat.icon}</span>
        <span className="cat-label-cq">{cat.label}</span>
        <div className="cat-score-bar-cq">
          <div className="cat-bar-fill-cq" style={{ width: `${score}%`, background: color }} />
        </div>
        <span className="cat-score-num-cq" style={{ color }}>{score}/100</span>
        <span className="cat-chevron-cq">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="cat-metrics-cq">
          {metrics?.length > 0
            ? metrics.map((m, i) => <MetricRow key={i} m={m} />)
            : <p className="cat-empty-cq">No metrics data.</p>
          }
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ISSUE CARD
═══════════════════════════════════════════════════════════ */
function IssueCard({ issue, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`issue-card-cq impact-${issue.impact}-cq`}>
      <div className="issue-header-cq" onClick={() => setOpen(!open)}>
        <span className="issue-num-cq">#{index + 1}</span>
        <div className="issue-title-wrap-cq">
          <span className="issue-title-cq">{issue.title}</span>
          <span className="issue-cat-cq">{issue.category}</span>
        </div>
        <div className="issue-badges-cq">
          <ImpactBadge impact={issue.impact} />
          <span className="priority-tag-cq">{issue.priority}</span>
        </div>
        <span className="issue-chevron-cq">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="issue-body-cq">
          <p className="issue-desc-cq">{issue.description}</p>
          {issue.fixSuggestion && (
            <div className="issue-fix-cq">
              <span className="fix-label-cq">💡 Fix:</span>
              <p>{issue.fixSuggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function ContentQualityModule() {
  const navigate = useNavigate();
  const [url,        setUrl]        = useState('');
  const [loading,    setLoading]    = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [progLabel,  setProgLabel]  = useState('');
  const [report,     setReport]     = useState(null);
  const [error,      setError]      = useState('');
  const [showAI,     setShowAI]     = useState(false);
  const [visibleCats,setVisibleCats]= useState({});
  const [issueFilter,setIssueFilter]= useState('all');
  const catRefs = useRef({});

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  /* Auto-reveal categories as user scrolls */
  useEffect(() => {
    if (!report) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) setVisibleCats(p => ({ ...p, [e.target.dataset.cat]: true }));
      });
    }, { threshold: 0.15 });
    Object.values(catRefs.current).forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, [report]);

  /* Simulated progress */
  const runProgress = () => {
    const steps = [
      [10, 'Fetching page HTML...'],
      [22, 'Scanning testimonials & reviews...'],
      [34, 'Checking trust badges & logos...'],
      [44, 'Analyzing review widgets...'],
      [54, 'Validating Schema.org markup...'],
      [63, 'Checking contact information...'],
      [72, 'Scanning social media links...'],
      [80, 'Checking security badges & SSL...'],
      [87, 'Analyzing content quality...'],
      [93, 'Running WCAG accessibility checks...'],
      [97, 'Generating AI report...'],
    ];
    let i = 0;
    const tick = () => {
      if (i < steps.length) {
        setProgress(steps[i][0]);
        setProgLabel(steps[i][1]);
        i++;
        setTimeout(tick, 700 + Math.random() * 400);
      }
    };
    tick();
  };

const handleAnalyze = async () => {
  if (!url.trim()) return;
  setLoading(true);
  setReport(null);
  setError('');
  setProgress(5);
  setProgLabel('Initializing audit...');
  runProgress();

  try {
    const token = localStorage.getItem('wax_token');  // ← ADD

    const res = await fetch(`${API}/api/content-quality/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),  // ← ADD
      },
      body: JSON.stringify({ url: url.trim() }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Analysis failed');
    setProgress(100);
    setProgLabel('Complete!');
    setTimeout(() => { setReport(json.data); setLoading(false); }, 600);
  } catch (err) {
    setError(err.message);
    setLoading(false);
    setProgress(0);
  }
};

  const handleDownload = () => {
    if (!report?._id) return;
    window.open(`${API}/api/content-quality/download/${report._id}`, '_blank');
  };

  const filteredIssues = report?.issues?.filter(i =>
    issueFilter === 'all' || i.impact === issueFilter
  ) || [];

  const issueCounts = report?.issues?.reduce((acc, i) => {
    acc[i.impact] = (acc[i.impact] || 0) + 1;
    return acc;
  }, {}) || {};

  return (
    <div className="cq-page-cq">
      {/* NAVIGATION - WebAuditX Theme */}
      <nav className="wax-navLP">
        <a href="#home" className="nav-logoLP" onClick={e => { e.preventDefault(); navigate('/'); }}>
          WebAudit<span style={{ color: 'var(--accent, #00b894)' }}>X</span>
          <span className="logo-badgeLP">BETA</span>
        </a>
        <ul className="nav-linksLP">
          <li><a href="#analysis" onClick={e => { e.preventDefault(); scrollTo('analysis'); }}>Analysis</a></li>
          <li><a href="#issues" onClick={e => { e.preventDefault(); scrollTo('issues'); }}>Issues</a></li>
        </ul>
        <div className="nav-ctaLP">
          <UserNav onSignInClick={() => navigate('/auth')} />
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="cq-hero-cq">
        <div className="hero-bg-shapes-cq">
          <div className="shape shape-1-cq" />
          <div className="shape shape-2-cq" />
          <div className="shape shape-3-cq" />
        </div>
        <div className="hero-content-cq">
          <div className="hero-pill-cq">Module 07</div>
          <h1 className="hero-title-cq">
            Trust Signals &<br /><span className="hero-accent-cq">Content Quality</span>
          </h1>
          <p className="hero-sub-cq">
            Deep analysis of testimonials, trust badges, review widgets, contact info,
            social media, WCAG accessibility, schema markup, and more.
          </p>

          <div className="hero-input-wrap-cq">
            <div className="hero-input-row-cq">
              <span className="input-prefix-cq">🔍</span>
              <input
                className="hero-url-input-cq"
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && handleAnalyze()}
                disabled={loading}
              />
              <button
                className="hero-analyze-btn-cq"
                onClick={handleAnalyze}
                disabled={loading || !url.trim()}
              >
                {loading ? <span className="btn-spinner-cq" /> : '▶ Analyze'}
              </button>
            </div>

            {error && <div className="hero-error-cq">⚠ {error}</div>}

            {loading && (
              <div className="progress-wrap-cq">
                <div className="progress-bar-outer-cq">
                  <div className="progress-bar-fill-cq" style={{ width: `${progress}%` }} />
                </div>
                <p className="progress-label-cq">{progLabel}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      {report && (
        <div className="cq-results-cq" id="analysis">

          {/* ── Summary strip ── */}
          <div className="summary-strip-cq">
            <div className="summary-score-block-cq">
              <ScoreRing score={report.overallScore} size={120} stroke={10} />
              <div>
                <h2 className="summary-title-cq">Overall Score</h2>
                <p className="summary-url-cq">{report.url}</p>
                <p className="summary-date-cq">
                  Analyzed {new Date(report.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="summary-actions-cq">
              <button className="btn-ai-cq" onClick={() => setShowAI(true)}>
                ✦ AI Insights
              </button>
              <button className="btn-download-cq" onClick={handleDownload}>
                ↓ Download PDF
              </button>
            </div>
          </div>

          {/* ── Mini scores grid ── */}
          <div className="scores-grid-cq">
            {CATEGORIES.map(cat => (
              <div key={cat.key} className="scores-card-cq">
                <span className="scores-icon-cq">{cat.icon}</span>
                <ScoreRing score={report.scores?.[cat.key] || 0} size={52} stroke={5} />
                <span className="scores-label-cq">{cat.label}</span>
              </div>
            ))}
          </div>

          {/* ── Category panels (one by one) ── */}
          <div className="section-title-wrap-cq">
            <h2 className="section-title-cq">Detailed Analysis</h2>
            <p className="section-sub-cq">Each category expands for full metrics</p>
          </div>

          <div className="cat-panels-list-cq">
            {CATEGORIES.map(cat => (
              <div key={cat.key} ref={el => catRefs.current[cat.key] = el} data-cat={cat.key}>
                <CategoryPanel
                  cat={cat}
                  score={report.scores?.[cat.key] || 0}
                  metrics={report.metrics?.[cat.key] || []}
                  visible={!!visibleCats[cat.key]}
                />
              </div>
            ))}
          </div>

          {/* ── Issues ── */}
          <div className="section-title-wrap-cq" id="issues" style={{ marginTop: '3rem' }}>
            <h2 className="section-title-cq">All Issues</h2>
            <p className="section-sub-cq">{report.issues?.length || 0} issues found, sorted by priority</p>
          </div>

          <div className="issue-filter-bar-cq">
            {['all', 'critical', 'high', 'medium', 'low', 'info'].map(f => (
              <button
                key={f}
                className={`filter-btn-cq filter-${f}-cq ${issueFilter === f ? 'active-cq' : ''}`}
                onClick={() => setIssueFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && issueCounts[f] > 0 && (
                  <span className="filter-count-cq">{issueCounts[f]}</span>
                )}
                {f === 'all' && <span className="filter-count-cq">{report.issues?.length || 0}</span>}
              </button>
            ))}
          </div>

          <div className="issues-list-cq">
            {filteredIssues.length > 0
              ? filteredIssues.map((issue, i) => <IssueCard key={issue.id || i} issue={issue} index={i} />)
              : <div className="issues-empty-cq">✓ No {issueFilter === 'all' ? '' : issueFilter} issues found.</div>
            }
          </div>

          {/* ── Bottom action bar ── */}
          <div className="bottom-action-bar-cq">
            <button className="btn-ai-cq btn-large-cq" onClick={() => setShowAI(true)}>
              ✦ View AI Insights Report
            </button>
            <button className="btn-download-cq btn-large-cq" onClick={handleDownload}>
              ↓ Download Full PDF Report
            </button>
          </div>
        </div>
      )}

      {/* ── AI Modal ── */}
      {showAI && report && (
        <AIInsightModal report={report} onClose={() => setShowAI(false)} />
      )}
    </div>
  );
}