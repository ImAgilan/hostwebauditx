import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserNav from '../components/UserNav';
import '../components/UserNav.css';
import './structure-navigation.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/* ── Severity badge config ── */
const SEV = {
  critical: { label: 'Critical', cls: 'sev-critical' },
  high:     { label: 'High',     cls: 'sev-high'     },
  medium:   { label: 'Medium',   cls: 'sev-medium'   },
  low:      { label: 'Low',      cls: 'sev-low'      },
  info:     { label: 'Info',     cls: 'sev-info'      },
};

/* ── Score ring ── */
function ScoreRing({ score, label, size = 80 }) {
  const r = 30, c = 2 * Math.PI * r;
  const fill = c - (score / 100) * c;
  const color = score >= 75 ? '#00b894' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="score-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={fill}
          strokeLinecap="round" transform="rotate(-90 40 40)" />
      </svg>
      <div className="score-ring-inner">
        <span className="score-ring-val" style={{ color }}>{score}</span>
        <span className="score-ring-lbl">{label}</span>
      </div>
    </div>
  );
}

/* ── Metric card ── */
function MetricCard({ icon, title, value, sub, accent }) {
  return (
    <div className="metric-card" style={{ '--accent': accent }}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-body">
        <div className="metric-value">{value}</div>
        <div className="metric-title">{title}</div>
        {sub && <div className="metric-sub">{sub}</div>}
      </div>
    </div>
  );
}

/* ── Section ── */
function Section({ id, title, icon, badge, children, reveal }) {
  return (
    <div className={`sn-section ${reveal ? 'revealed' : ''}`} id={id}>
      <div className="sn-section-header">
        <span className="sn-section-icon">{icon}</span>
        <h2 className="sn-section-title">{title}</h2>
        {badge !== undefined && <span className="sn-section-badge">{badge}</span>}
      </div>
      <div className="sn-section-body">{children}</div>
    </div>
  );
}

/* ── Status pill ── */
function Pill({ val, trueTxt = 'Yes', falseTxt = 'No' }) {
  return (
    <span className={`pill ${val ? 'pill-good' : 'pill-bad'}`}>
      {val ? trueTxt : falseTxt}
    </span>
  );
}

/* ── Progress bar ── */
function Bar({ score }) {
  const c = score >= 75 ? '#00b894' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="bar-wrap">
      <div className="bar-fill" style={{ width: `${score}%`, background: c }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════ */
export default function StructureNavigationModule() {
  const navigate = useNavigate();
  const [url,         setUrl]         = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [data,        setData]        = useState(null);
  const [revealIdx,   setRevealIdx]   = useState(-1);
  const [activeTab,   setActiveTab]   = useState('overview');
  const reportRef     = useRef(null);

  // Progressive reveal sections
  const SECTIONS = [
    'overview','crawl','navigation','breadcrumbs','urls',
    'linking','broken','security','content','blog','issues',
  ];

  useEffect(() => {
    if (!data) return;
    let i = 0;
    const timer = setInterval(() => {
      setRevealIdx(i);
      i++;
      if (i >= SECTIONS.length) clearInterval(timer);
    }, 280);
    return () => clearInterval(timer);
  }, [data]);

  async function handleAnalyze() {
  if (!url.trim()) { setError('Please enter a URL'); return; }
  setError('');
  setLoading(true);
  setData(null);
  setRevealIdx(-1);

  try {
    const token = localStorage.getItem('wax_token');  // ← ADD

    const res = await fetch(`${API}/api/structure-navigation/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),  // ← ADD
      },
      body: JSON.stringify({ url: url.trim() }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Analysis failed');
    setData(json.data);
    setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
  } catch (e) {
    setError(e.message);
  } finally {
    setLoading(false);
  }
}

  function openAIInsight() {
    if (!data) return;
    const w = window.open('', '_blank');
    const ai = data.aiReport || {};
    const scoreColor = (s) => s >= 75 ? '#00b894' : s >= 50 ? '#f59e0b' : '#ef4444';
    const sc = data.scores?.overallScore || 0;
    w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AI Insight — ${data.url}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Inter:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:#f8fafc;color:#0f172a;font-family:'Inter',sans-serif;}
  .hero{background:linear-gradient(135deg,#fff 0%,#f1f5f9 100%);padding:60px 40px 40px;border-bottom:1px solid rgba(0,0,0,0.08);}
  .hero h1{font-family:'Plus Jakarta Sans',sans-serif;font-size:2.2rem;font-weight:800;color:#0f172a;margin-bottom:8px;}
  .hero .url{color:#00b894;font-size:1rem;word-break:break-all;}
  .score-hero{display:flex;align-items:center;gap:24px;margin-top:28px;}
  .score-big{font-family:'Plus Jakarta Sans',sans-serif;font-size:5rem;font-weight:800;line-height:1;color:${scoreColor(sc)};}
  .score-meta{display:flex;flex-direction:column;gap:6px;}
  .health-badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:.85rem;font-weight:600;
    background:${ai.websiteHealth==='Good'?'rgba(0,184,148,.1)':ai.websiteHealth==='Fair'?'rgba(245,158,11,.1)':'rgba(239,68,68,.1)'};
    color:${ai.websiteHealth==='Good'?'#00b894':ai.websiteHealth==='Fair'?'#f59e0b':'#ef4444'};}
  .container{max-width:900px;margin:0 auto;padding:40px 24px;}
  .card{background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:14px;padding:28px;margin-bottom:24px;}
  .card h2{font-family:'Plus Jakarta Sans',sans-serif;font-size:1.2rem;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:10px;}
  .card p{line-height:1.75;color:#64748b;font-size:.95rem;}
  .list{list-style:none;display:flex;flex-direction:column;gap:10px;}
  .list li{display:flex;gap:10px;align-items:flex-start;color:#64748b;font-size:.9rem;line-height:1.6;}
  .list li .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:7px;}
  .dot-green{background:#00b894;} .dot-red{background:#ef4444;} .dot-blue{background:#3b82f6;}
  table{width:100%;border-collapse:collapse;font-size:.88rem;}
  th{text-align:left;padding:10px 12px;background:#f8fafc;color:#64748b;font-weight:600;border-bottom:1px solid rgba(0,0,0,0.08);font-family:'IBM Plex Mono',monospace;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;}
  td{padding:10px 12px;border-bottom:1px solid rgba(0,0,0,0.04);color:#64748b;vertical-align:top;}
  tr:hover td{background:#f8fafc;}
  .impact-high{color:#ef4444;font-weight:600;} .impact-medium{color:#f59e0b;font-weight:600;} .impact-low{color:#00b894;font-weight:600;}
  .p1{color:#ef4444;font-weight:700;} .p2{color:#f59e0b;font-weight:700;} .p3{color:#00b894;font-weight:700;}
  .footer{text-align:center;padding:40px;color:#94a3b8;font-size:.8rem;}
</style>
</head>
<body>
<div class="hero">
  <div style="max-width:900px;margin:0 auto;">
    <div style="color:#00b894;font-size:.85rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px;">🤖 AI Insight Report · Structure &amp; Navigation</div>
    <h1>Website Health Analysis</h1>
    <div class="url">${data.url}</div>
    <div class="score-hero">
      <div class="score-big">${sc}</div>
      <div class="score-meta">
        <span style="color:#64748b;font-size:.85rem;">Overall Score / 100</span>
        <span class="health-badge">${ai.websiteHealth || 'Unknown'}</span>
        <span style="color:#94a3b8;font-size:.78rem;">Generated ${new Date().toLocaleString()}</span>
      </div>
    </div>
  </div>
</div>
<div class="container">
  <div class="card">
    <h2>📋 Website Summary</h2>
    <p>${ai.summary || 'No summary available.'}</p>
  </div>
  <div class="card">
    <h2>⚠️ Issues Summary</h2>
    <p>${ai.issuesSummary || 'No issues summary available.'}</p>
  </div>
  ${ai.whatWorksWell?.length ? `
  <div class="card">
    <h2 style="color:#00b894;">✅ What's Working Well</h2>
    <ul class="list">${ai.whatWorksWell.map(w=>`<li><span class="dot dot-green"></span><span>${w}</span></li>`).join('')}</ul>
  </div>` : ''}
  ${ai.criticalFixes?.length ? `
  <div class="card">
    <h2 style="color:#ef4444;">🔴 Critical Fixes Needed</h2>
    <ul class="list">${ai.criticalFixes.map(f=>`<li><span class="dot dot-red"></span><span>${f}</span></li>`).join('')}</ul>
  </div>` : ''}
  ${ai.recommendations?.length ? `
  <div class="card">
    <h2 style="color:#3b82f6;">💡 Recommendations</h2>
    <ul class="list">${ai.recommendations.map(r=>`<li><span class="dot dot-blue"></span><span>${r}</span></li>`).join('')}</ul>
  </div>` : ''}
  ${ai.priorityTable?.length ? `
  <div class="card">
    <h2>📊 Issues by Impact &amp; Priority</h2>
    <div style="overflow-x:auto;">
    <table>
      <thead><tr><th>#</th><th>Issue</th><th>Impact</th><th>Priority</th><th>Effort</th><th>Fix</th></tr>
      </thead>
      <tbody>${ai.priorityTable.map((row,i)=>`
        <tr>
          <td style="color:#94a3b8;">${i+1}</td>
          <td style="color:#0f172a;font-weight:500;">${row.issue}</td>
          <td class="impact-${(row.impact||'').toLowerCase()}">${row.impact}</td>
          <td class="${(row.priority||'').toLowerCase()}">${row.priority}</td>
          <td style="color:#64748b;">${row.effort}</td>
          <td>${row.fix}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>
  </div>` : ''}
</div>
<div class="footer">WebAuditX · AI Insight · Structure &amp; Navigation Module · ${new Date().getFullYear()}</div>
</body></html>`);
    w.document.close();
  }

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  /* ── Render ── */
  return (
    <div className="sn-root">
      {/* NAVIGATION - WebAuditX Theme */}
      <nav className="wax-navLP">
        <a href="#home" className="nav-logoLP" onClick={e => { e.preventDefault(); navigate('/'); }}>
          WebAudit<span style={{ color: 'var(--accent, #00b894)' }}>X</span>
          <span className="logo-badgeLP">BETA</span>
        </a>
        <ul className="nav-linksLP">
          <li><a href="#overview" onClick={e => { e.preventDefault(); scrollTo('overview'); }}>Overview</a></li>
          <li><a href="#security" onClick={e => { e.preventDefault(); scrollTo('security'); }}>Security</a></li>
          <li><a href="#content" onClick={e => { e.preventDefault(); scrollTo('content'); }}>Content</a></li>
          <li><a href="#issues" onClick={e => { e.preventDefault(); scrollTo('issues'); }}>Issues</a></li>
        </ul>
        <div className="nav-ctaLP">
          <UserNav onSignInClick={() => navigate('/auth')} />
        </div>
      </nav>

      {/* Hero */}
      <div className="sn-hero">
        <div className="sn-hero-bg" />
        <div className="sn-hero-content">
          <div className="sn-hero-eyebrow">Module 08</div>
          <h1 className="sn-hero-title">
            Structure &amp; <span className="sn-accent">Navigation</span>
          </h1>
          <p className="sn-hero-sub">
            Deep-crawl your site architecture · Analyse navigation, breadcrumbs, security &amp; content quality
          </p>

          {/* Input */}
          <div className="sn-input-row">
            <div className="sn-input-wrap">
              <span className="sn-input-icon">🌐</span>
              <input
                className="sn-input"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              />
            </div>
            <button className="sn-btn-primary" onClick={handleAnalyze} disabled={loading}>
              {loading ? <span className="sn-spinner" /> : null}
              {loading ? 'Analysing…' : 'Analyse Site'}
            </button>
          </div>
          {error && <div className="sn-error">{error}</div>}

          {/* Capability chips */}
          <div className="sn-chips">
            {['Site Crawl','Navigation','Breadcrumbs','URL Structure','Internal Linking',
              'Broken Links','Security Headers','Content Quality','Blog Detection','Duplicate Detection'].map(c => (
              <span key={c} className="sn-chip">{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="sn-loading">
          <div className="sn-loading-ring" />
          <div className="sn-loading-steps">
            {['Crawling pages…','Analysing navigation…','Checking security…','Scanning content…','Generating AI report…'].map((s, i) => (
              <div key={i} className="sn-loading-step" style={{ animationDelay: `${i * 0.6}s` }}>{s}</div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="sn-results" ref={reportRef}>
          {/* Tab nav */}
          <div className="sn-tabs">
            {['overview','security','content','issues'].map(t => (
              <button key={t} className={`sn-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                {{ overview:'📊 Overview', security:'🔒 Security', content:'📝 Content', issues:'⚠️ Issues' }[t]}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <>
              {/* Score overview */}
              <Section id="overview" title="Overall Scores" icon="📊" reveal={revealIdx >= 0}>
                <div className="sn-scores-grid">
                  <div className="sn-main-score">
                    <ScoreRing score={data.scores?.overallScore || 0} label="Overall" size={140} />
                    <div className="sn-main-score-meta">
                      <div className="sn-url-display">{data.url}</div>
                      <div className="sn-health-badge" data-health={data.aiReport?.websiteHealth?.toLowerCase() || 'unknown'}>
                        {data.aiReport?.websiteHealth || 'Unknown'} Health
                      </div>
                      <div className="sn-crawl-stats">
                        <span>📄 {data.crawl?.totalPagesCrawled || 0} pages</span>
                        <span>⚠️ {data.issues?.length || 0} issues</span>
                        <span>⏱ {((data.crawl?.crawlDuration || 0) / 1000).toFixed(1)}s</span>
                      </div>
                    </div>
                  </div>
                  <div className="sn-score-breakdown">
                    {[
                      { k: 'securityScore',   l: 'Security'    },
                      { k: 'navigationScore', l: 'Navigation'  },
                      { k: 'contentScore',    l: 'Content'     },
                      { k: 'linkingScore',    l: 'Int. Linking'},
                      { k: 'urlScore',        l: 'URL Quality' },
                      { k: 'crawlScore',      l: 'Crawlability'},
                      { k: 'breadcrumbScore', l: 'Breadcrumbs' },
                    ].map(({ k, l }) => (
                      <div key={k} className="sn-score-row">
                        <span className="sn-score-label">{l}</span>
                        <Bar score={data.scores?.[k] || 0} />
                        <span className="sn-score-num">{data.scores?.[k] || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Metric cards */}
              <Section id="crawl" title="Crawl Summary" icon="🕷️" badge={`${data.crawl?.totalPagesCrawled || 0} pages`} reveal={revealIdx >= 1}>
                <div className="sn-metrics-grid">
                  <MetricCard icon="📄" title="Pages Crawled"  value={data.crawl?.totalPagesCrawled || 0}   accent="#00b894" />
                  <MetricCard icon="🌳" title="Max Depth"      value={data.crawl?.maxDepthFound || 0}        accent="#3b82f6" sub="levels deep" />
                  <MetricCard icon="🗺️" title="Sitemap"        value={data.crawl?.sitemapFound ? '✓' : '✗'} accent={data.crawl?.sitemapFound ? '#00b894' : '#ef4444'} sub={data.crawl?.sitemapFound ? 'Found' : 'Not found'} />
                  <MetricCard icon="🤖" title="Robots.txt"     value={data.crawl?.robotsTxtFound ? '✓' : '✗'} accent={data.crawl?.robotsTxtFound ? '#00b894' : '#ef4444'} sub={data.crawl?.robotsTxtFound ? 'Found' : 'Not found'} />
                  <MetricCard icon="⏱" title="Crawl Time"     value={`${((data.crawl?.crawlDuration || 0)/1000).toFixed(1)}s`} accent="#f59e0b" />
                  <MetricCard icon="🔗" title="Orphaned Pages" value={data.internalLinking?.orphanedPages?.length || 0} accent={data.internalLinking?.orphanedPages?.length ? '#ef4444' : '#00b894'} />
                </div>
              </Section>

              {/* Navigation */}
              <Section id="navigation" title="Navigation Analysis" icon="🧭" reveal={revealIdx >= 2}>
                <div className="sn-two-col">
                  <div className="sn-detail-list">
                    <div className="sn-detail-row"><span>Nav Links Found</span><strong>{data.navigation?.mainNavLinksTotal || 0}</strong></div>
                    <div className="sn-detail-row"><span>Mobile Menu</span><Pill val={data.navigation?.hasMobileMenu} /></div>
                    <div className="sn-detail-row"><span>Skip Links</span><Pill val={data.navigation?.hasSkipLinks} /></div>
                    <div className="sn-detail-row"><span>Mega Menu</span><Pill val={data.navigation?.hasMegaMenu} trueTxt="Present" falseTxt="Absent" /></div>
                    <div className="sn-detail-row"><span>Menu Depth</span><strong>{data.navigation?.menuDepth || 1} levels</strong></div>
                    <div className="sn-detail-row"><span>Nav Score</span><strong>{data.navigation?.navStructureScore || 0}/100</strong></div>
                  </div>
                  <div>
                    <ScoreRing score={data.navigation?.navStructureScore || 0} label="Nav" size={100} />
                  </div>
                </div>
              </Section>

              {/* Breadcrumbs */}
              <Section id="breadcrumbs" title="Breadcrumb Navigation" icon="🍞" reveal={revealIdx >= 3}>
                <div className="sn-detail-list">
                  <div className="sn-detail-row"><span>Breadcrumbs Found</span><Pill val={data.breadcrumbs?.found} /></div>
                  <div className="sn-detail-row"><span>Schema Markup</span><Pill val={data.breadcrumbs?.schemaMarkupFound} /></div>
                  <div className="sn-detail-row"><span>Schema Type</span><strong>{data.breadcrumbs?.schemaType || '—'}</strong></div>
                  <div className="sn-detail-row"><span>Pages with Breadcrumbs</span><strong>{data.breadcrumbs?.pagesWithBreadcrumb || 0}</strong></div>
                  <div className="sn-detail-row"><span>Coverage Score</span><strong>{data.breadcrumbs?.breadcrumbScore || 0}%</strong></div>
                </div>
              </Section>

              {/* URL Structure */}
              <Section id="urls" title="URL Structure" icon="🔗" reveal={revealIdx >= 4}>
                <div className="sn-metrics-grid">
                  <MetricCard icon="✅" title="SEO-Friendly URLs"  value={data.urlStructure?.seoFriendlyCount || 0}    accent="#00b894" />
                  <MetricCard icon="❌" title="Non-SEO URLs"       value={data.urlStructure?.nonSeoFriendlyCount || 0} accent="#ef4444" />
                  <MetricCard icon="📏" title="Avg URL Length"     value={`${data.urlStructure?.avgUrlLength || 0} chars`} accent="#3b82f6" />
                  <MetricCard icon="?" title="With Parameters"    value={data.urlStructure?.urlsWithParameters || 0}  accent="#f59e0b" />
                  <MetricCard icon="🔤" title="Uppercase in URL"   value={data.urlStructure?.urlsWithUppercase || 0}   accent="#f59e0b" />
                  <MetricCard icon="📊" title="URL Quality Score"  value={`${data.urlStructure?.urlScore || 0}/100`}   accent="#00b894" />
                </div>
                {data.urlStructure?.sampleBadUrls?.length > 0 && (
                  <div className="sn-url-list">
                    <div className="sn-sub-label">Sample Non-Friendly URLs</div>
                    {data.urlStructure.sampleBadUrls.map((u, i) => (
                      <div key={i} className="sn-url-item bad">{u}</div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Internal Linking */}
              <Section id="linking" title="Internal Linking" icon="🕸️" reveal={revealIdx >= 5}>
                <div className="sn-detail-list">
                  <div className="sn-detail-row"><span>Total Internal Links</span><strong>{data.internalLinking?.totalInternalLinks || 0}</strong></div>
                  <div className="sn-detail-row"><span>Avg Links / Page</span><strong>{data.internalLinking?.avgLinksPerPage || 0}</strong></div>
                  <div className="sn-detail-row"><span>Orphaned Pages</span><strong className="val-bad">{data.internalLinking?.orphanedPages?.length || 0}</strong></div>
                  <div className="sn-detail-row"><span>Deep Pages (4+ clicks)</span><strong className="val-warn">{data.internalLinking?.deepPages?.length || 0}</strong></div>
                  <div className="sn-detail-row"><span>Link Equity Score</span><strong>{data.internalLinking?.linkEquityScore || 0}/100</strong></div>
                </div>
                {data.internalLinking?.orphanedPages?.length > 0 && (
                  <div className="sn-url-list">
                    <div className="sn-sub-label">Orphaned Pages</div>
                    {data.internalLinking.orphanedPages.slice(0, 5).map((u, i) => (
                      <div key={i} className="sn-url-item bad">{u}</div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Broken Links */}
              <Section id="broken" title="Broken Links" icon="💔" badge={data.brokenLinks?.total404 || 0} reveal={revealIdx >= 6}>
                <div className="sn-detail-list">
                  <div className="sn-detail-row"><span>404 Errors</span><strong className="val-bad">{data.brokenLinks?.total404 || 0}</strong></div>
                  <div className="sn-detail-row"><span>Redirect Chains</span><strong className="val-warn">{data.brokenLinks?.total3xx || 0}</strong></div>
                </div>
                {data.brokenLinks?.brokenUrls?.length > 0 && (
                  <div className="sn-url-list">
                    <div className="sn-sub-label">Broken URLs Detected</div>
                    {data.brokenLinks.brokenUrls.map((u, i) => (
                      <div key={i} className="sn-url-item bad">{u}</div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Blog */}
              <Section id="blog" title="Blog / News Section" icon="📰" reveal={revealIdx >= 7}>
                <div className="sn-detail-list">
                  <div className="sn-detail-row"><span>Blog Detected</span><Pill val={data.blog?.found} /></div>
                  {data.blog?.found && <>
                    <div className="sn-detail-row"><span>Blog URL</span><strong className="sn-link">{data.blog?.blogUrl}</strong></div>
                    <div className="sn-detail-row"><span>Post Count</span><strong>{data.blog?.postCount}</strong></div>
                    <div className="sn-detail-row"><span>Pagination</span><Pill val={data.blog?.hasPagination} /></div>
                    <div className="sn-detail-row"><span>Categories</span><Pill val={data.blog?.hasCategories} /></div>
                    <div className="sn-detail-row"><span>Tags</span><Pill val={data.blog?.hasTags} /></div>
                  </>}
                </div>
              </Section>
            </>
          )}

          {/* ── SECURITY TAB ── */}
          {activeTab === 'security' && (
            <Section id="security" title="Security Headers Analysis" icon="🔒" badge={`${data.scores?.securityScore || 0}/100`} reveal>
              <div className="sn-scores-grid">
                <ScoreRing score={data.scores?.securityScore || 0} label="Security" size={120} />
                <div className="sn-detail-list" style={{ flex: 1 }}>
                  {[
                    ['HTTPS Enabled',           data.security?.httpsEnabled,        'Secure connection', 'Unsecured connection'],
                    ['SSL Certificate Valid',    data.security?.sslCertValid,        'Valid cert', 'Invalid/missing cert'],
                    ['HSTS Header',              data.security?.hstsHeader,          'Present', 'Missing — high risk'],
                    ['Content Security Policy',  data.security?.cspHeader,           'Present', 'Missing — XSS risk'],
                    ['X-Frame-Options',          !!data.security?.xFrameOptions,     data.security?.xFrameOptions || '—', 'Missing — clickjacking risk'],
                    ['X-Content-Type-Options',   data.security?.xContentTypeOptions, 'nosniff set', 'Missing'],
                    ['Referrer-Policy',          !!data.security?.referrerPolicy,    data.security?.referrerPolicy || '—', 'Missing'],
                    ['Permissions-Policy',       data.security?.permissionsPolicy,   'Present', 'Missing'],
                    ['Server Header Hidden',     !data.security?.serverHeaderExposed,'Hidden ✓', 'Exposed — reveals attack surface'],
                    ['Mixed Content',            !data.security?.mixedContent,       'None detected', 'Mixed content detected'],
                    ['TLS Version',              true,                               data.security?.tlsVersion || 'Unknown', ''],
                  ].map(([label, val, good, bad], i) => (
                    <div key={i} className="sn-detail-row">
                      <span>{label}</span>
                      <span className={val ? 'val-good' : 'val-bad'}>{val ? good : bad}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="sn-security-tips">
                <div className="sn-sub-label">Security Quick Wins</div>
                {!data.security?.hstsHeader      && <div className="sn-tip tip-high">Add <code>Strict-Transport-Security: max-age=31536000; includeSubDomains</code> to all responses</div>}
                {!data.security?.cspHeader        && <div className="sn-tip tip-high">Implement a Content-Security-Policy header to prevent XSS attacks</div>}
                {!data.security?.xFrameOptions    && <div className="sn-tip tip-med">Add <code>X-Frame-Options: DENY</code> to prevent clickjacking</div>}
                {!data.security?.xContentTypeOptions && <div className="sn-tip tip-med">Add <code>X-Content-Type-Options: nosniff</code> to prevent MIME sniffing</div>}
                {data.security?.serverHeaderExposed  && <div className="sn-tip tip-low">Remove or obscure the <code>Server</code> response header</div>}
                {data.security?.mixedContent         && <div className="sn-tip tip-med">Fix mixed content: update all HTTP resource references to HTTPS</div>}
              </div>
            </Section>
          )}

          {/* ── CONTENT TAB ── */}
          {activeTab === 'content' && (
            <>
              <Section id="content" title="Content Quality Analysis" icon="📝" badge={`${data.scores?.contentScore || 0}/100`} reveal>
                <div className="sn-scores-grid">
                  <ScoreRing score={data.scores?.contentScore || 0} label="Content" size={120} />
                  <div className="sn-detail-list" style={{ flex: 1 }}>
                    <div className="sn-detail-row"><span>Total Words (site)</span><strong>{(data.content?.totalWords || 0).toLocaleString()}</strong></div>
                    <div className="sn-detail-row"><span>Avg Words / Page</span><strong>{data.content?.avgWordsPerPage || 0}</strong></div>
                    <div className="sn-detail-row"><span>Thin Content Pages</span><strong className="val-bad">{data.content?.pagesWithThinContent || 0}</strong></div>
                    <div className="sn-detail-row"><span>Pages Without H1</span><strong className="val-bad">{data.content?.pagesWithoutH1 || 0}</strong></div>
                    <div className="sn-detail-row"><span>Missing Meta Descriptions</span><strong className="val-warn">{data.content?.pagesWithoutMetaDesc || 0}</strong></div>
                    <div className="sn-detail-row"><span>Duplicate Titles</span><strong className="val-warn">{data.content?.pagesWithDuplicateTitle || 0}</strong></div>
                    <div className="sn-detail-row"><span>Readability Score</span><strong>{data.content?.readabilityScore || 0}/100</strong></div>
                  </div>
                </div>
              </Section>
              <Section id="duplicate" title="Duplicate Content" icon="🔄" reveal>
                <div className="sn-detail-list">
                  <div className="sn-detail-row"><span>Suspected Duplicate Pages</span><strong className="val-warn">{data.duplicateContent?.suspectedDuplicates || 0}</strong></div>
                </div>
                {data.duplicateContent?.duplicatePairs?.length > 0 && (
                  <div className="sn-url-list">
                    <div className="sn-sub-label">Duplicate Page Pairs</div>
                    {data.duplicateContent.duplicatePairs.map((pair, i) => (
                      <div key={i} className="sn-dup-pair">
                        <div className="sn-url-item bad">{pair.url1}</div>
                        <div className="sn-dup-sep">≈ {pair.similarity}% similar</div>
                        <div className="sn-url-item bad">{pair.url2}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}

          {/* ── ISSUES TAB ── */}
          {activeTab === 'issues' && (
            <Section id="issues" title="All Issues Found" icon="⚠️" badge={data.issues?.length || 0} reveal>
              {['critical','high','medium','low','info'].map(sev => {
                const sevIssues = (data.issues || []).filter(i => i.severity === sev);
                if (!sevIssues.length) return null;
                return (
                  <div key={sev} className="sn-issue-group">
                    <div className={`sn-issue-group-header ${SEV[sev].cls}`}>
                      <span>{SEV[sev].label}</span>
                      <span className="sn-issue-count">{sevIssues.length}</span>
                    </div>
                    {sevIssues.map((issue, i) => (
                      <div key={i} className={`sn-issue-card ${SEV[issue.severity]?.cls}`}>
                        <div className="sn-issue-top">
                          <span className={`sn-issue-badge ${SEV[issue.severity]?.cls}`}>{SEV[issue.severity]?.label}</span>
                          <span className="sn-issue-type">{issue.type}</span>
                        </div>
                        <div className="sn-issue-title">{issue.title}</div>
                        <div className="sn-issue-desc">{issue.description}</div>
                        {issue.detail && <div className="sn-issue-detail">{issue.detail}</div>}
                        <div className="sn-issue-footer">
                          <div className="sn-issue-impact"><span>Impact:</span> {issue.impact}</div>
                          <div className="sn-issue-fix"><span>Fix:</span> {issue.fix}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </Section>
          )}

          {/* Action buttons */}
          <div className="sn-actions" style={{ animationDelay: '2s' }}>
            <a href={`${API}/api/structure-navigation/download/${data._id}`}
               className="sn-btn-download" target="_blank" rel="noopener noreferrer">
              📥 Download PDF Report
            </a>
            <button className="sn-btn-ai" onClick={openAIInsight}>
              🤖 AI Insight
            </button>
            <button className="sn-btn-secondary" onClick={() => { setData(null); setUrl(''); window.scrollTo(0,0); }}>
              🔄 New Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}