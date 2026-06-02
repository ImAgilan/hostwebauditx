import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './seo.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/* ── tiny helpers ── */
const scoreColor   = s => s >= 80 ? '#22c55e' : s >= 60 ? '#f59e0b' : s >= 40 ? '#f97316' : '#ef4444';
const severityColor = s => ({ critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e', info: '#60a5fa' }[s] || '#94a3b8');

/* ── Shared sub-components ── */
function CircleScore({ score, label, size = 90 }) {
  const r    = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <div className="seo-circle-wrap" style={{ width: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transformOrigin: 'center', transform: 'rotate(-90deg)', transition: 'stroke-dasharray 1.2s ease' }}/>
        <text x={size/2} y={size/2 + 5} textAnchor="middle" fill={color} fontSize={size < 70 ? 13 : 18} fontWeight="700">{score}</text>
      </svg>
      {label && <p className="seo-circle-label">{label}</p>}
    </div>
  );
}

function MetricCard({ icon, title, children, score, delay = 0, visible }) {
  return (
    <div className={`seo-metric-card ${visible ? 'seo-card-in' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="seo-metric-header">
        <span className="seo-metric-icon">{icon}</span>
        <div>
          <h3 className="seo-metric-title">{title}</h3>
          {score !== undefined && <span className="seo-metric-badge" style={{ background: scoreColor(score) }}>{score}/100</span>}
        </div>
      </div>
      <div className="seo-metric-body">{children}</div>
    </div>
  );
}

function IssueRow({ issue }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="seo-issue-row" style={{ borderLeftColor: severityColor(issue.severity) }}>
      <div className="seo-issue-top" onClick={() => setOpen(!open)}>
        <span className="seo-sev-badge" style={{ background: severityColor(issue.severity), color: '#fff' }}>{issue.severity}</span>
        <span className="seo-issue-cat">[{issue.category}]</span>
        <span className="seo-issue-title">{issue.title}</span>
        <span className="seo-issue-toggle">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="seo-issue-detail">
          <p><strong>Description:</strong> {issue.description}</p>
          <p><strong>Recommendation:</strong> {issue.recommendation}</p>
          {issue.impact && <p><strong>Impact:</strong> {issue.impact}</p>}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   SeoHome — main analysis page
══════════════════════════════════════════ */
export function SeoHome() {
  const navigate = useNavigate();
  const [url, setUrl]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [data, setData]         = useState(null);
  const [reportId, setReportId] = useState(null);
  const [visibleCards, setVisibleCards] = useState(new Set());
  const [activeTab, setActiveTab]       = useState('overview');

  const phases = [
    '🔍 Fetching page HTML…',
    '📋 Analysing meta tags…',
    '🏷️ Checking heading structure…',
    '🖼️ Scanning image alt texts…',
    '🔗 Crawling links…',
    '🔑 Calculating keyword density…',
    '⚙️ Technical SEO checks…',
    '📖 Readability analysis…',
    '🛡️ Structured data scan…',
    '🚀 Compiling report…',
  ];
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setPhaseIdx(p => (p + 1) % phases.length), 2200);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    if (!data) return;
    const cards = ['overview', 'meta', 'headings', 'images', 'keywords', 'links', 'technical', 'content', 'social', 'issues'];
    cards.forEach((c, i) => {
      setTimeout(() => setVisibleCards(prev => new Set([...prev, c])), i * 180);
    });
  }, [data]);

const handleAnalyse = async () => {
  if (!url.trim()) return;
  setLoading(true); setError(''); setData(null); setReportId(null); setPhaseIdx(0); setVisibleCards(new Set());
  try {
    const token = localStorage.getItem('wax_token');  // ← ADD

    const res = await fetch(`${API}/api/seo/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),  // ← ADD
      },
      body: JSON.stringify({ url: url.trim() }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    setData(json.data);
    setReportId(json.id);
  } catch (e) {
    setError(e.message || 'Analysis failed');
  } finally {
    setLoading(false);
  }
};

  const d = data;

  return (
    <div className="seo-root">
      {/* ── Hero header ── */}
      <header className="seo-hero">
        <div className="seo-hero-inner">
          <div className="seo-hero-badge">MODULE 04</div>
          <h1 className="seo-hero-title">SEO <span>&amp;</span> Content<br/>Analysis</h1>
          <p className="seo-hero-sub">Deep-dive audit: meta, headings, images, keywords, links, technical SEO, readability &amp; structured data</p>
          <div className="seo-input-row">
            <div className="seo-input-wrap">
              <span className="seo-input-icon">🌐</span>
              <input
                className="seo-url-input"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyse()}
                disabled={loading}
              />
            </div>
            <button className="seo-analyse-btn" onClick={handleAnalyse} disabled={loading || !url.trim()}>
              {loading ? <span className="seo-btn-spinner"/> : '⚡'} Analyse
            </button>
          </div>
          {error && <div className="seo-error-banner">⚠️ {error}</div>}
        </div>
        <div className="seo-hero-grid-bg" aria-hidden/>
      </header>

      {/* ── Loading state ── */}
      {loading && (
        <div className="seo-loading-section">
          <div className="seo-loading-bar"><div className="seo-loading-fill"/></div>
          <div className="seo-loading-phase">{phases[phaseIdx]}</div>
          <div className="seo-loading-dots"><span/><span/><span/></div>
        </div>
      )}

      {/* ── Results ── */}
      {d && (
        <div className="seo-results">

          {/* Overall Score Banner */}
          <div className={`seo-score-banner ${visibleCards.has('overview') ? 'seo-card-in' : ''}`}>
            <div className="seo-score-left">
              <CircleScore score={d.overallScore} size={120}/>
              <div className="seo-score-info">
                <h2>Overall SEO Score</h2>
                <p className="seo-score-url">{d.url}</p>
                <div className="seo-issue-counts">
                  <span style={{ color: '#ef4444' }}>🔴 {d.criticalCount} Critical</span>
                  <span style={{ color: '#f97316' }}>🟠 {d.highCount} High</span>
                  <span style={{ color: '#f59e0b' }}>🟡 {d.mediumCount} Medium</span>
                  <span style={{ color: '#22c55e' }}>🟢 {d.lowCount} Low</span>
                </div>
                <p className="seo-duration">Analysis completed in {((d.analysisDuration || 0)/1000).toFixed(1)}s</p>
              </div>
            </div>
            <div className="seo-category-grid">
              {Object.entries(d.categoryScores || {}).map(([k, v]) => (
                <div key={k} className="seo-cat-item">
                  <CircleScore score={v || 0} size={68}/>
                  <p>{k.charAt(0).toUpperCase() + k.slice(1)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="seo-action-row">
            <button className="seo-ai-btn" onClick={() => navigate(`/seo/ai-insight/${reportId}`)}>
              🤖 AI Insight Report
            </button>
            <a className="seo-pdf-btn" href={`${API}/api/seo/download/${reportId}`} target="_blank" rel="noreferrer">
              ⬇ Download PDF
            </a>
          </div>

          {/* Tab Nav */}
          <div className="seo-tabs">
            {['overview','meta','headings','images','keywords','links','technical','content','issues'].map(t => (
              <button key={t} className={`seo-tab ${activeTab === t ? 'seo-tab-active' : ''}`} onClick={() => setActiveTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="seo-tab-content">

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="seo-grid-2">
                <MetricCard icon="📋" title="Meta Tags" score={d.meta?.score} delay={0} visible={visibleCards.has('meta')}>
                  <div className="seo-kv-list">
                    <div className="seo-kv"><span>Title</span><span className="seo-kv-val">{d.meta?.titleLength || 0} chars</span></div>
                    <div className="seo-kv"><span>Description</span><span className="seo-kv-val">{d.meta?.descriptionLength || 0} chars</span></div>
                    <div className="seo-kv"><span>Canonical</span><span className={`seo-status ${d.meta?.canonical ? 'ok' : 'fail'}`}>{d.meta?.canonical ? '✓' : '✗'}</span></div>
                    <div className="seo-kv"><span>Viewport</span><span className={`seo-status ${d.meta?.viewport ? 'ok' : 'fail'}`}>{d.meta?.viewport ? '✓' : '✗'}</span></div>
                    <div className="seo-kv"><span>Language</span><span className="seo-kv-val">{d.meta?.language || 'N/A'}</span></div>
                    <div className="seo-kv"><span>OG Tags</span><span className={`seo-status ${d.meta?.ogTitle ? 'ok' : 'fail'}`}>{d.meta?.ogTitle ? '✓' : '✗'}</span></div>
                    <div className="seo-kv"><span>Twitter Card</span><span className={`seo-status ${d.meta?.twitterCard ? 'ok' : 'fail'}`}>{d.meta?.twitterCard ? '✓' : '✗'}</span></div>
                  </div>
                </MetricCard>

                <MetricCard icon="⚙️" title="Technical SEO" score={d.technical?.score} delay={100} visible={visibleCards.has('technical')}>
                  <div className="seo-kv-list">
                    <div className="seo-kv"><span>HTTPS/SSL</span><span className={`seo-status ${d.technical?.hasSSL ? 'ok' : 'fail'}`}>{d.technical?.hasSSL ? '✓ Secure' : '✗ Insecure'}</span></div>
                    <div className="seo-kv"><span>Sitemap</span><span className={`seo-status ${d.technical?.sitemapExists ? 'ok' : 'fail'}`}>{d.technical?.sitemapExists ? `✓ ${d.technical.sitemapUrlCount} URLs` : '✗ Missing'}</span></div>
                    <div className="seo-kv"><span>robots.txt</span><span className={`seo-status ${d.technical?.robotsTxtExists ? 'ok' : 'fail'}`}>{d.technical?.robotsTxtExists ? '✓' : '✗'}</span></div>
                    <div className="seo-kv"><span>Schema.org</span><span className={`seo-status ${d.technical?.structuredData ? 'ok' : 'fail'}`}>{d.technical?.structuredData ? `✓ ${(d.technical.structuredDataTypes||[]).join(', ')}` : '✗ None'}</span></div>
                    <div className="seo-kv"><span>Mobile</span><span className={`seo-status ${d.technical?.mobileFriendly ? 'ok' : 'fail'}`}>{d.technical?.mobileFriendly ? '✓' : '✗'}</span></div>
                  </div>
                </MetricCard>

                <MetricCard icon="📖" title="Content Quality" score={d.content?.score} delay={200} visible={visibleCards.has('content')}>
                  <div className="seo-kv-list">
                    <div className="seo-kv"><span>Word Count</span><span className="seo-kv-val">{d.content?.wordCount?.toLocaleString() || 0}</span></div>
                    <div className="seo-kv"><span>Readability</span><span className="seo-kv-val">{d.content?.readabilityScore} — {d.content?.readabilityGrade}</span></div>
                    <div className="seo-kv"><span>Avg Sentence</span><span className="seo-kv-val">{d.content?.avgSentenceLength} words</span></div>
                    <div className="seo-kv"><span>Paragraphs</span><span className="seo-kv-val">{d.content?.paragraphCount}</span></div>
                    <div className="seo-kv"><span>Thin Content</span><span className={`seo-status ${d.content?.thinContent ? 'fail' : 'ok'}`}>{d.content?.thinContent ? '✗ Yes' : '✓ No'}</span></div>
                  </div>
                </MetricCard>

                <MetricCard icon="🔗" title="Link Profile" score={d.links?.score} delay={300} visible={visibleCards.has('links')}>
                  <div className="seo-kv-list">
                    <div className="seo-kv"><span>Total Links</span><span className="seo-kv-val">{d.links?.totalLinks}</span></div>
                    <div className="seo-kv"><span>Internal</span><span className="seo-kv-val">{d.links?.internalLinks}</span></div>
                    <div className="seo-kv"><span>External</span><span className="seo-kv-val">{d.links?.externalLinks}</span></div>
                    <div className="seo-kv"><span>Broken</span><span className={`seo-status ${d.links?.brokenLinks > 0 ? 'fail' : 'ok'}`}>{d.links?.brokenLinks > 0 ? `✗ ${d.links.brokenLinks}` : '✓ None'}</span></div>
                    <div className="seo-kv"><span>Nofollow</span><span className="seo-kv-val">{d.links?.nofollowLinks}</span></div>
                  </div>
                </MetricCard>

                {d.pageSpeed && (
                  <MetricCard icon="🚀" title="Page Speed" score={d.pageSpeed.score} delay={400} visible={visibleCards.has('overview')}>
                    <div className="seo-kv-list">
                      <div className="seo-kv"><span>Score</span><span className="seo-kv-val">{d.pageSpeed.score}/100 ({d.pageSpeed.source})</span></div>
                      {d.pageSpeed.fcp > 0 && <div className="seo-kv"><span>FCP</span><span className="seo-kv-val">{(d.pageSpeed.fcp/1000).toFixed(2)}s</span></div>}
                      {d.pageSpeed.lcp > 0 && <div className="seo-kv"><span>LCP</span><span className="seo-kv-val">{(d.pageSpeed.lcp/1000).toFixed(2)}s</span></div>}
                      {d.pageSpeed.ttfb > 0 && <div className="seo-kv"><span>TTFB</span><span className="seo-kv-val">{d.pageSpeed.ttfb}ms</span></div>}
                    </div>
                  </MetricCard>
                )}

                <MetricCard icon="📣" title="Social & Tracking" score={d.social?.score} delay={500} visible={visibleCards.has('social')}>
                  <div className="seo-kv-list">
                    <div className="seo-kv"><span>Open Graph</span><span className={`seo-status ${d.social?.hasOpenGraph ? 'ok' : 'fail'}`}>{d.social?.hasOpenGraph ? '✓' : '✗'}</span></div>
                    <div className="seo-kv"><span>Twitter Card</span><span className={`seo-status ${d.social?.hasTwitterCard ? 'ok' : 'fail'}`}>{d.social?.hasTwitterCard ? '✓' : '✗'}</span></div>
                    <div className="seo-kv"><span>Schema.org</span><span className={`seo-status ${d.social?.hasSchemaOrg ? 'ok' : 'fail'}`}>{d.social?.hasSchemaOrg ? '✓' : '✗'}</span></div>
                    <div className="seo-kv"><span>Google Analytics</span><span className={`seo-status ${d.social?.googleAnalytics ? 'ok' : 'fail'}`}>{d.social?.googleAnalytics ? '✓' : '✗'}</span></div>
                    <div className="seo-kv"><span>Google Tag Mgr</span><span className={`seo-status ${d.social?.googleTagManager ? 'ok' : 'fail'}`}>{d.social?.googleTagManager ? '✓' : '✗'}</span></div>
                  </div>
                </MetricCard>
              </div>
            )}

            {/* META TAB */}
            {activeTab === 'meta' && (
              <div className="seo-single-col">
                <MetricCard icon="📋" title="Meta Tags Analysis" score={d.meta?.score} visible delay={0}>
                  <div className="seo-meta-detail">
                    <div className="seo-meta-field">
                      <label>Title Tag</label>
                      <div className="seo-meta-value">{d.meta?.title || <em>Not set</em>}</div>
                      <div className="seo-meta-bar-wrap">
                        <div className="seo-meta-bar" style={{ width: `${Math.min(100, ((d.meta?.titleLength||0)/60)*100)}%`, background: scoreColor(d.meta?.titleScore || 0) }}/>
                      </div>
                      <small>{d.meta?.titleLength || 0} / 60 chars ideal</small>
                    </div>
                    <div className="seo-meta-field">
                      <label>Meta Description</label>
                      <div className="seo-meta-value">{d.meta?.description || <em>Not set</em>}</div>
                      <div className="seo-meta-bar-wrap">
                        <div className="seo-meta-bar" style={{ width: `${Math.min(100, ((d.meta?.descriptionLength||0)/160)*100)}%`, background: scoreColor(d.meta?.descriptionScore || 0) }}/>
                      </div>
                      <small>{d.meta?.descriptionLength || 0} / 160 chars ideal</small>
                    </div>
                    {d.meta?.canonical   && <div className="seo-meta-field"><label>Canonical URL</label><div className="seo-meta-value mono">{d.meta.canonical}</div></div>}
                    {d.meta?.robots      && <div className="seo-meta-field"><label>Robots</label><div className="seo-meta-value mono">{d.meta.robots}</div></div>}
                    {d.meta?.viewport    && <div className="seo-meta-field"><label>Viewport</label><div className="seo-meta-value mono">{d.meta.viewport}</div></div>}
                    {d.meta?.ogTitle     && <div className="seo-meta-field"><label>OG Title</label><div className="seo-meta-value">{d.meta.ogTitle}</div></div>}
                    {d.meta?.ogDescription && <div className="seo-meta-field"><label>OG Description</label><div className="seo-meta-value">{d.meta.ogDescription}</div></div>}
                    {d.meta?.ogImage     && <div className="seo-meta-field"><label>OG Image</label><div className="seo-meta-value mono">{d.meta.ogImage}</div></div>}
                    {d.meta?.twitterCard && <div className="seo-meta-field"><label>Twitter Card</label><div className="seo-meta-value">{d.meta.twitterCard}</div></div>}
                    {d.meta?.language    && <div className="seo-meta-field"><label>Language</label><div className="seo-meta-value">{d.meta.language}</div></div>}
                    {d.meta?.hreflang?.length > 0 && <div className="seo-meta-field"><label>Hreflang</label><div className="seo-meta-value">{d.meta.hreflang.join(', ')}</div></div>}
                  </div>
                </MetricCard>
                {(d.meta?.issues || []).length > 0 && (
                  <div className="seo-section-issues">
                    <h4>Meta Issues</h4>
                    {d.meta.issues.map((iss, i) => <IssueRow key={i} issue={iss}/>)}
                  </div>
                )}
              </div>
            )}

            {/* HEADINGS TAB */}
            {activeTab === 'headings' && (
              <div className="seo-single-col">
                <MetricCard icon="🏷️" title="Heading Structure" score={d.headings?.score} visible delay={0}>
                  <div className="seo-heading-counts">
                    {['h1','h2','h3','h4','h5','h6'].map(tag => (
                      <div key={tag} className="seo-h-count">
                        <span className="seo-h-tag">{tag.toUpperCase()}</span>
                        <span className="seo-h-num">{d.headings?.[`${tag}Count`] || 0}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ marginTop: 12, color: d.headings?.hierarchy ? '#22c55e' : '#ef4444' }}>
                    {d.headings?.hierarchy ? '✓ Heading hierarchy is correct' : '✗ Heading hierarchy has gaps'}
                  </p>
                  <div className="seo-heading-list">
                    {(d.headings?.headings || []).map((h, i) => (
                      <div key={i} className="seo-heading-item" style={{ paddingLeft: (h.level - 1) * 16 }}>
                        <span className={`seo-h-pill seo-h-pill-${h.tag}`}>{h.tag.toUpperCase()}</span>
                        <span>{h.text}</span>
                      </div>
                    ))}
                  </div>
                </MetricCard>
                {(d.headings?.issues || []).map((iss, i) => <IssueRow key={i} issue={iss}/>)}
              </div>
            )}

            {/* IMAGES TAB */}
            {activeTab === 'images' && (
              <div className="seo-single-col">
                <MetricCard icon="🖼️" title="Image SEO" score={d.images?.score} visible delay={0}>
                  <div className="seo-img-stats">
                    <div className="seo-img-stat"><span>{d.images?.total || 0}</span><label>Total Images</label></div>
                    <div className="seo-img-stat ok"><span>{d.images?.withAlt || 0}</span><label>With Alt</label></div>
                    <div className="seo-img-stat fail"><span>{d.images?.withoutAlt || 0}</span><label>Missing Alt</label></div>
                    <div className="seo-img-stat warn"><span>{d.images?.emptyAlt || 0}</span><label>Empty Alt</label></div>
                  </div>
                  <div className="seo-img-table-wrap">
                    <table className="seo-table">
                      <thead><tr><th>Image</th><th>Alt Text</th><th>Status</th></tr></thead>
                      <tbody>
                        {(d.images?.images || []).slice(0, 30).map((img, i) => (
                          <tr key={i}>
                            <td className="mono small">{img.src.split('/').pop().substring(0, 30)}</td>
                            <td>{img.alt || <em style={{ color: '#ef4444' }}>Missing</em>}</td>
                            <td><span className={`seo-status ${img.hasAlt ? 'ok' : 'fail'}`}>{img.hasAlt ? '✓' : '✗'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </MetricCard>
                {(d.images?.issues || []).map((iss, i) => <IssueRow key={i} issue={iss}/>)}
              </div>
            )}

            {/* KEYWORDS TAB */}
            {activeTab === 'keywords' && (
              <div className="seo-single-col">
                <MetricCard icon="🔑" title="Keyword Analysis" score={d.keywords?.score} visible delay={0}>
                  <div className="seo-kw-stats">
                    <div className="seo-img-stat"><span>{d.keywords?.wordCount?.toLocaleString()}</span><label>Word Count</label></div>
                    <div className="seo-img-stat"><span>{d.keywords?.uniqueWords?.toLocaleString()}</span><label>Unique Words</label></div>
                  </div>
                  <table className="seo-table">
                    <thead>
                      <tr><th>Keyword</th><th>Count</th><th>Density</th><th>Title</th><th>H1</th><th>H2</th><th>Meta</th></tr>
                    </thead>
                    <tbody>
                      {(d.keywords?.topKeywords || []).map((kw, i) => (
                        <tr key={i}>
                          <td><strong>{kw.keyword}</strong></td>
                          <td>{kw.count}</td>
                          <td>
                            <span className="seo-density-bar-wrap">
                              <span className="seo-density-bar" style={{ width: `${Math.min(100, kw.density * 10)}%`, background: kw.density > 5 ? '#ef4444' : kw.density > 3 ? '#f59e0b' : '#22c55e' }}/>
                              <span>{kw.density}%</span>
                            </span>
                          </td>
                          <td><span className={`seo-status ${kw.inTitle ? 'ok' : 'fail'}`}>{kw.inTitle ? '✓' : '✗'}</span></td>
                          <td><span className={`seo-status ${kw.inH1 ? 'ok' : 'fail'}`}>{kw.inH1 ? '✓' : '✗'}</span></td>
                          <td><span className={`seo-status ${kw.inH2 ? 'ok' : 'fail'}`}>{kw.inH2 ? '✓' : '✗'}</span></td>
                          <td><span className={`seo-status ${kw.inMeta ? 'ok' : 'fail'}`}>{kw.inMeta ? '✓' : '✗'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </MetricCard>
                {(d.keywords?.issues || []).map((iss, i) => <IssueRow key={i} issue={iss}/>)}
              </div>
            )}

            {/* LINKS TAB */}
            {activeTab === 'links' && (
              <div className="seo-single-col">
                <MetricCard icon="🔗" title="Link Analysis" score={d.links?.score} visible delay={0}>
                  <div className="seo-img-stats">
                    <div className="seo-img-stat"><span>{d.links?.totalLinks}</span><label>Total</label></div>
                    <div className="seo-img-stat ok"><span>{d.links?.internalLinks}</span><label>Internal</label></div>
                    <div className="seo-img-stat"><span>{d.links?.externalLinks}</span><label>External</label></div>
                    <div className="seo-img-stat fail"><span>{d.links?.brokenLinks}</span><label>Broken</label></div>
                    <div className="seo-img-stat warn"><span>{d.links?.nofollowLinks}</span><label>Nofollow</label></div>
                  </div>
                  <div className="seo-img-table-wrap">
                    <table className="seo-table">
                      <thead><tr><th>URL</th><th>Anchor</th><th>Type</th><th>Status</th></tr></thead>
                      <tbody>
                        {(d.links?.links || []).slice(0, 40).map((lnk, i) => (
                          <tr key={i} style={{ background: lnk.isBroken ? '#fef2f2' : undefined }}>
                            <td className="mono small">{lnk.url.substring(0, 50)}</td>
                            <td>{lnk.text || <em>—</em>}</td>
                            <td><span className={`seo-type-badge ${lnk.type}`}>{lnk.type}</span></td>
                            <td><span className={`seo-status ${lnk.isBroken ? 'fail' : 'ok'}`}>{lnk.isBroken ? `✗ ${lnk.status}` : `✓ ${lnk.status}`}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </MetricCard>
                {(d.links?.issues || []).map((iss, i) => <IssueRow key={i} issue={iss}/>)}
              </div>
            )}

            {/* TECHNICAL TAB */}
            {activeTab === 'technical' && (
              <div className="seo-single-col">
                <MetricCard icon="⚙️" title="Technical SEO" score={d.technical?.score} visible delay={0}>
                  <div className="seo-tech-grid">
                    {[
                      { label: 'HTTPS/SSL',        val: d.technical?.hasSSL,              detail: d.technical?.hasSSL ? 'Secure connection' : 'Not secure' },
                      { label: 'XML Sitemap',       val: d.technical?.sitemapExists,        detail: d.technical?.sitemapUrl || 'Not found' },
                      { label: 'Sitemap Valid',     val: d.technical?.sitemapValid,         detail: `${d.technical?.sitemapUrlCount || 0} URLs indexed` },
                      { label: 'robots.txt',        val: d.technical?.robotsTxtExists,      detail: 'Crawl control' },
                      { label: 'Indexing Allowed',  val: d.technical?.robotsAllowsIndexing, detail: 'Via robots.txt' },
                      { label: 'Structured Data',   val: d.technical?.structuredData,       detail: (d.technical?.structuredDataTypes || []).join(', ') || 'None' },
                      { label: 'Schema Valid',      val: d.technical?.structuredDataValid,  detail: 'JSON-LD' },
                      { label: 'Mobile Friendly',   val: d.technical?.mobileFriendly,       detail: 'Viewport meta' },
                      { label: 'AMP',               val: d.technical?.ampExists,            detail: 'Accelerated Mobile' },
                      { label: 'Hreflang',          val: d.technical?.hasHreflang,          detail: 'Internationalisation' },
                      { label: 'Pagination',        val: d.technical?.hasPagination,        detail: 'rel prev/next' },
                    ].map((item, i) => (
                      <div key={i} className="seo-tech-item">
                        <span className={`seo-status ${item.val ? 'ok' : 'fail'}`}>{item.val ? '✓' : '✗'}</span>
                        <div>
                          <strong>{item.label}</strong>
                          <small>{item.detail}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  {d.technical?.robotsTxtContent && (
                    <div style={{ marginTop: 16 }}>
                      <label className="seo-code-label">robots.txt content</label>
                      <pre className="seo-code-block">{d.technical.robotsTxtContent}</pre>
                    </div>
                  )}
                </MetricCard>
                {(d.structuredData || []).length > 0 && (
                  <div className="seo-single-col">
                    <h4 style={{ margin: '16px 0 8px', color: '#1e293b' }}>Structured Data Found</h4>
                    {d.structuredData.map((sd, i) => (
                      <div key={i} className="seo-sd-block">
                        <div className="seo-sd-header">
                          <span className={`seo-status ${sd.valid ? 'ok' : 'fail'}`}>{sd.valid ? '✓ Valid' : '✗ Invalid'}</span>
                          <strong>{sd.type}</strong>
                        </div>
                        <pre className="seo-code-block small">{sd.raw}</pre>
                      </div>
                    ))}
                  </div>
                )}
                {(d.technical?.issues || []).map((iss, i) => <IssueRow key={i} issue={iss}/>)}
              </div>
            )}

            {/* CONTENT TAB */}
            {activeTab === 'content' && (
              <div className="seo-single-col">
                <MetricCard icon="📖" title="Content & Readability" score={d.content?.score} visible delay={0}>
                  <div className="seo-readability-visual">
                    <div className="seo-read-score-wrap">
                      <CircleScore score={d.content?.readabilityScore || 0} size={100}/>
                      <div>
                        <h3>Flesch Score: {d.content?.readabilityScore}</h3>
                        <p className="seo-grade-badge">{d.content?.readabilityGrade}</p>
                      </div>
                    </div>
                    <div className="seo-read-bar-wrap">
                      <div className="seo-read-scale">
                        {['Very Difficult','Difficult','Fairly Difficult','Standard','Fairly Easy','Easy','Very Easy'].map((g, i) => (
                          <div key={i} className={`seo-read-seg ${d.content?.readabilityGrade === g ? 'active' : ''}`}>
                            <span>{g}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="seo-kv-list" style={{ marginTop: 16 }}>
                    <div className="seo-kv"><span>Word Count</span><span className="seo-kv-val">{d.content?.wordCount?.toLocaleString()}</span></div>
                    <div className="seo-kv"><span>Sentence Count</span><span className="seo-kv-val">{d.content?.sentenceCount}</span></div>
                    <div className="seo-kv"><span>Paragraphs</span><span className="seo-kv-val">{d.content?.paragraphCount}</span></div>
                    <div className="seo-kv"><span>Avg Sentence Length</span><span className="seo-kv-val">{d.content?.avgSentenceLength} words</span></div>
                    <div className="seo-kv"><span>Avg Word Length</span><span className="seo-kv-val">{d.content?.avgWordLength} chars</span></div>
                    <div className="seo-kv"><span>Has Video</span><span className={`seo-status ${d.content?.hasVideo ? 'ok' : 'neutral'}`}>{d.content?.hasVideo ? '✓' : '—'}</span></div>
                    <div className="seo-kv"><span>Has Audio</span><span className={`seo-status ${d.content?.hasAudio ? 'ok' : 'neutral'}`}>{d.content?.hasAudio ? '✓' : '—'}</span></div>
                    <div className="seo-kv"><span>Has FAQ</span><span className={`seo-status ${d.content?.hasFAQ ? 'ok' : 'neutral'}`}>{d.content?.hasFAQ ? '✓' : '—'}</span></div>
                    <div className="seo-kv"><span>Thin Content</span><span className={`seo-status ${d.content?.thinContent ? 'fail' : 'ok'}`}>{d.content?.thinContent ? '✗ Yes' : '✓ No'}</span></div>
                  </div>
                </MetricCard>
                {(d.content?.issues || []).map((iss, i) => <IssueRow key={i} issue={iss}/>)}
              </div>
            )}

            {/* ALL ISSUES TAB */}
            {activeTab === 'issues' && (
              <div className="seo-single-col">
                <div className="seo-issues-header">
                  <h3>All Issues ({(d.allIssues || []).length})</h3>
                  <div className="seo-issue-legend">
                    {['critical','high','medium','low'].map(s => (
                      <span key={s} className="seo-legend-item">
                        <span style={{ background: severityColor(s), display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 4 }}/>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
                {(d.allIssues || []).map((iss, i) => <IssueRow key={i} issue={iss}/>)}
                {!d.allIssues?.length && <p style={{ color: '#22c55e', textAlign: 'center', padding: 40 }}>🎉 No issues found!</p>}
              </div>
            )}

          </div>

          {/* Bottom action row */}
          <div className="seo-bottom-actions">
            <button className="seo-ai-btn large" onClick={() => navigate(`/seo/ai-insight/${reportId}`)}>
              🤖 View AI Insight Report
            </button>
            <a className="seo-pdf-btn large" href={`${API}/api/seo/download/${reportId}`} target="_blank" rel="noreferrer">
              ⬇ Download Full PDF Report
            </a>
          </div>

        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   SeoAiInsight — AI-generated insight page
══════════════════════════════════════════ */
export function SeoAiInsight() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [html, setHtml]       = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [url, setUrl]         = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const rep = await fetch(`${API}/api/seo/report/${id}`).then(r => r.json());
        if (rep.success) setUrl(rep.data.url);

        if (rep.success && rep.data.aiReport) {
          setHtml(rep.data.aiReport); setLoading(false); return;
        }
        const ai = await fetch(`${API}/api/seo/ai-report/${id}`, { method: 'POST' }).then(r => r.json());
        if (ai.success) setHtml(ai.aiReport);
        else setError(ai.message || 'Failed to generate AI report');
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return (
    <div className="seo-ai-loading">
      <div className="seo-ai-spinner"/>
      <p>Generating AI Insight Report…</p>
      <small>{url}</small>
    </div>
  );

  if (error) return (
    <div className="seo-ai-error">
      <h2>⚠️ Error</h2>
      <p>{error}</p>
      <button onClick={() => navigate(-1)}>← Back</button>
    </div>
  );

  return (
    <div className="seo-ai-page">
      <div className="seo-ai-header">
        <button className="seo-ai-back" onClick={() => navigate(-1)}>← Back to Report</button>
        <div className="seo-ai-title-block">
          <span className="seo-ai-badge">AI Insight</span>
          <h1>SEO Intelligence Report</h1>
          <p className="seo-ai-url">{url}</p>
        </div>
        <a href={`${API}/api/seo/download/${id}`} className="seo-ai-dl-btn" target="_blank" rel="noreferrer">⬇ Download PDF</a>
      </div>
      <div className="seo-ai-body">
        <div className="seo-ai-content" dangerouslySetInnerHTML={{ __html: html }}/>
      </div>
    </div>
  );
}

export default SeoHome;