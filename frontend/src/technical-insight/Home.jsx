import { useState, useRef } from 'react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/* ── Helpers ── */
const scoreColor = (s) => s >= 75 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626';
const scoreLabel = (s) => s >= 75 ? 'Good' : s >= 50 ? 'Needs Work' : 'Critical';
const sevBadge   = (sev) => `badge badge-${sev}`;

function ScoreRing({ score, label }) {
  const r = 40, c = 2 * Math.PI * r;
  const dash = c - (c * Math.min(score, 100)) / 100;
  return (
    <div className="score-ring-wrap">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={scoreColor(score)} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={dash} strokeLinecap="round"
          transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <text x="50" y="54" textAnchor="middle" fontSize="18" fontWeight="bold" fill={scoreColor(score)}>{score}</text>
      </svg>
      <span className="score-ring-label">{label}</span>
    </div>
  );
}

function StatusBadge({ value, trueLabel = 'Yes', falseLabel = 'No' }) {
  return <span className={`inline-badge ${value ? 'green' : 'red'}`}>{value ? trueLabel : falseLabel}</span>;
}

function SectionCard({ title, icon, children, collapsed = false }) {
  const [open, setOpen] = useState(!collapsed);
  return (
    <div className="section-card">
      <div className="section-header" onClick={() => setOpen(p => !p)}>
        <span className="section-icon">{icon}</span>
        <span className="section-title">{title}</span>
        <span className="section-chevron">{open ? '▲' : '▼'}</span>
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

function IssueRow({ issue, index }) {
  return (
    <div className={`issue-row sev-${issue.severity}`}>
      <div className="issue-rank">#{index + 1}</div>
      <div className="issue-info">
        <div className="issue-title">{issue.title}</div>
        <div className="issue-detail">{issue.detail}</div>
        <div className="issue-fix">💡 {issue.fix}</div>
      </div>
      <div className="issue-meta">
        <span className={sevBadge(issue.severity)}>{issue.severity?.toUpperCase()}</span>
        <span className="issue-cat">{issue.category}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════ */
export default function TechnicalInsightHome() {
  const [url,        setUrl]        = useState('');
  const [loading,    setLoading]    = useState(false);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [data,       setData]       = useState(null);
  const [aiReport,   setAiReport]   = useState(null);
  const [error,      setError]      = useState('');
  const [activeTab,  setActiveTab]  = useState('overview');
  const resultsRef = useRef(null);

  /* ── Analyze ── */
async function handleAnalyze(e) {
  e.preventDefault();
  if (!url.trim()) return;
  setLoading(true); setError(''); setData(null); setAiReport(null);
  try {
    const token = localStorage.getItem('wax_token');  // ← ADD

    const res  = await fetch(`${API}/api/technical-insight/analyze`, {
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
    setActiveTab('overview');
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  } catch (err) {
    setError(err.message || 'Audit failed. Please check the URL and try again.');
  } finally {
    setLoading(false);
  }
}
  /* ── AI Report ── */
  async function handleAIReport() {
    if (!data?._id) return;
    setAiLoading(true);
    try {
      const res  = await fetch(`${API}/api/technical-insight/ai-report/${data._id}`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setAiReport(json.data);
      setActiveTab('ai');
    } catch (err) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  /* ── PDF Download ── */
  async function handleDownload() {
    if (!data?._id) return;
    const res = await fetch(`${API}/api/technical-insight/download/${data._id}`);
    const blob = await res.blob();
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `webauditx-report.pdf`;
    a.click();
  }

  const d = data || {};

  return (
    <div className="ti-page">
      {/* ── Hero ── */}
      <div className="ti-hero">
        <div className="ti-hero-inner">
          <div className="ti-badge">🔍 Deep Intelligence Engine</div>
          <h1>Technical & Security Audit</h1>
          <p>Domain authority · Backlinks · Tech stack · Security headers · Content · DNS · SSL · AI insights</p>

          <form className="ti-form" onSubmit={handleAnalyze}>
            <div className="ti-input-wrap">
              <span className="ti-input-icon">🌐</span>
              <input type="text" value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com" className="ti-input" disabled={loading} />
              <button type="submit" className="ti-btn-primary" disabled={loading || !url.trim()}>
                {loading ? <span className="spinner" /> : '⚡ Analyze'}
              </button>
            </div>
          </form>

          {error && <div className="ti-error">⚠️ {error}</div>}
        </div>
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div className="ti-loading-panel">
          <div className="ti-loading-grid">
            {['Domain Authority','Backlink Analysis','Technology Stack','DNS Records','CDN Detection',
              'Security Headers','SSL Certificate','Vulnerability Scan','Content Analysis','Schema Detection',
              'JS Dependencies','Accessibility Check','Malware Check','SEO Metrics','AI Processing'].map((s, i) => (
              <div key={i} className="ti-loading-step">
                <div className="step-spinner" style={{ animationDelay: `${i * 0.15}s` }} />
                <span>{s}</span>
              </div>
            ))}
          </div>
          <p className="ti-loading-note">Running 15 parallel analyzers… this may take 20–30 seconds.</p>
        </div>
      )}

      {/* ── Results ── */}
      {data && !loading && (
        <div className="ti-results" ref={resultsRef}>

          {/* Score Overview */}
          <div className="ti-scores-bar">
            <div className="ti-scores-left">
              <div className="ti-url-label">🌐 {d.url}</div>
              <div className="ti-overall-score" style={{ color: scoreColor(d.scores?.overall || 0) }}>
                {d.scores?.overall || 0}<span>/100</span>
              </div>
              <div className="ti-score-status" style={{ color: scoreColor(d.scores?.overall || 0) }}>
                {scoreLabel(d.scores?.overall || 0)}
              </div>
            </div>
            <div className="ti-score-rings">
              {[['security','🔒'],['domain','🏆'],['content','📝'],['technical','⚙️'],['backlinks','🔗']].map(([k, icon]) => (
                <ScoreRing key={k} score={d.scores?.[k] || 0} label={`${icon} ${k}`} />
              ))}
            </div>
          </div>

          {/* Issue Summary Strip */}
          <div className="ti-issue-strip">
            <div className="strip-item high">🔴 {d.issues?.filter(i => i.severity === 'high').length || 0} High</div>
            <div className="strip-item medium">🟡 {d.issues?.filter(i => i.severity === 'medium').length || 0} Medium</div>
            <div className="strip-item low">🟢 {d.issues?.filter(i => i.severity === 'low').length || 0} Low</div>
            <div className="strip-item total">📋 {d.issues?.length || 0} Total Issues</div>
          </div>

          {/* Action Buttons */}
          <div className="ti-actions">
            <button className="btn-ai" onClick={handleAIReport} disabled={aiLoading}>
              {aiLoading ? <><span className="spinner" /> Generating…</> : '🤖 Generate AI Report'}
            </button>
            <button className="btn-pdf" onClick={handleDownload}>📄 Download PDF</button>
          </div>

          {/* Tab Navigation */}
          <div className="ti-tabs">
            {[['overview','📊 Overview'],['security','🔒 Security'],['domain','🏆 Domain'],
              ['content','📝 Content'],['technical','⚙️ Technical'],['issues','⚠️ Issues'],
              ...(aiReport ? [['ai','🤖 AI Report']] : [])].map(([tab, label]) => (
              <button key={tab} className={`ti-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}>{label}</button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div className="ti-tab-content">
              <div className="overview-grid">
                <SectionCard title="Domain & Authority" icon="🏆">
                  <div className="kv-grid">
                    <KV label="Hostname"         value={d.domain?.hostname} />
                    <KV label="Domain Authority" value={d.domain?.da != null ? `${d.domain.da}/100` : 'N/A'} />
                    <KV label="Page Authority"   value={d.domain?.pa != null ? `${d.domain.pa}/100` : 'N/A'} />
                    <KV label="Spam Score"       value={d.domain?.spamScore != null ? d.domain.spamScore : 'N/A'} />
                    <KV label="Data Source"      value={d.domain?.source} />
                  </div>
                </SectionCard>

                <SectionCard title="Protocol & SSL" icon="🔐">
                  <div className="kv-grid">
                    <KV label="HTTPS"       value={<StatusBadge value={d.network?.https} />} />
                    <KV label="HTTP/2"      value={<StatusBadge value={d.network?.http2} />} />
                    <KV label="HSTS"        value={<StatusBadge value={d.network?.hsts}  />} />
                    <KV label="SSL Valid"   value={<StatusBadge value={d.network?.sslValid} />} />
                    <KV label="SSL Issuer"  value={d.network?.issuer || 'N/A'} />
                    <KV label="SSL Expiry"  value={d.network?.daysToExpiry != null ? `${d.network.daysToExpiry} days` : 'N/A'} />
                    <KV label="Cipher"      value={d.network?.cipherSuite || 'N/A'} />
                  </div>
                </SectionCard>

                <SectionCard title="CDN & Infrastructure" icon="🌍">
                  <div className="kv-grid">
                    <KV label="CDN Detected" value={<StatusBadge value={d.cdn?.detected} />} />
                    <KV label="CDN Provider" value={d.cdn?.provider || 'None'} />
                    <KV label="Web Server"   value={d.technology?.server || 'Unknown'} />
                    <KV label="CMS"          value={d.technology?.cms || 'Not detected'} />
                    <KV label="Language"     value={d.technology?.language || 'Unknown'} />
                  </div>
                </SectionCard>

                <SectionCard title="Backlinks" icon="🔗">
                  <div className="kv-grid">
                    <KV label="Total Backlinks"    value={d.backlinks?.total?.toLocaleString()} />
                    <KV label="DoFollow"           value={d.backlinks?.doFollow?.toLocaleString()} />
                    <KV label="NoFollow"           value={d.backlinks?.noFollow?.toLocaleString()} />
                    <KV label="Referring Domains"  value={d.backlinks?.referringDomains?.toLocaleString()} />
                    <KV label="Toxic Backlinks"    value={d.backlinks?.toxicCount} />
                    <KV label="Source"             value={d.backlinks?.source} />
                  </div>
                  {d.backlinks?.anchorText?.length > 0 && (
                    <div className="anchor-list">
                      <div className="sub-title">Top Anchor Texts</div>
                      {d.backlinks.anchorText.map((a, i) => (
                        <div key={i} className="anchor-item"><span>{a.text}</span><span className="anchor-count">{a.count}</span></div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Malware & Safety" icon="🛡️">
                  <div className="kv-grid">
                    <KV label="Status"  value={<StatusBadge value={d.malware?.safe} trueLabel="Clean ✓" falseLabel="⚠️ Flagged" />} />
                    {d.malware?.flags?.length > 0 && <KV label="Flags" value={d.malware.flags.join(', ')} />}
                    <KV label="Source"  value={d.malware?.source || 'N/A'} />
                  </div>
                </SectionCard>

                <SectionCard title="Technology Stack" icon="⚙️">
                  <div className="kv-grid">
                    <KV label="Frameworks" value={d.technology?.frameworks?.join(', ') || 'None detected'} />
                    <KV label="Libraries"  value={d.technology?.libraries?.join(', ')  || 'None detected'} />
                    <KV label="Analytics"  value={d.technology?.analytics?.join(', ')  || 'None detected'} />
                  </div>
                </SectionCard>
              </div>
            </div>
          )}

          {/* ── SECURITY TAB ── */}
          {activeTab === 'security' && (
            <div className="ti-tab-content">
              <div className="security-score-banner" style={{ background: `linear-gradient(135deg, ${scoreColor(d.scores?.security || 0)}22, transparent)` }}>
                <span className="sec-score" style={{ color: scoreColor(d.scores?.security || 0) }}>{d.scores?.security || 0}</span>
                <span>/100 Security Score</span>
              </div>

              <SectionCard title="Security Headers" icon="🔒">
                <div className="headers-grid">
                  {d.securityHeaders?.present?.map((h, i) => (
                    <div key={i} className="header-item present">
                      <span className="header-check">✓</span>
                      <div><div className="header-name">{h.name}</div><div className="header-val">{h.value?.substring(0, 60)}</div></div>
                    </div>
                  ))}
                  {d.securityHeaders?.missing?.map((h, i) => (
                    <div key={i} className="header-item missing">
                      <span className="header-check">✗</span>
                      <div>
                        <div className="header-name">{h.name}</div>
                        <span className={sevBadge(h.severity)}>{h.severity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Cookie Security" icon="🍪">
                {d.cookies?.cookies?.length > 0 ? (
                  <div className="cookie-table">
                    <div className="cookie-row header">
                      <span>Name</span><span>Secure</span><span>HttpOnly</span><span>SameSite</span>
                    </div>
                    {d.cookies.cookies.map((ck, i) => (
                      <div key={i} className="cookie-row">
                        <span className="cookie-name">{ck.name}</span>
                        <StatusBadge value={ck.secure} trueLabel="✓" falseLabel="✗" />
                        <StatusBadge value={ck.httpOnly} trueLabel="✓" falseLabel="✗" />
                        <span>{ck.sameSite || '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="empty-msg">No cookies detected or site uses session-only cookies.</p>}
              </SectionCard>

              <SectionCard title="Vulnerability Detection" icon="🔍">
                <div className="kv-grid">
                  <KV label="Mixed Content"   value={<StatusBadge value={!d.vulnerabilities?.mixedContent} trueLabel="Clean" falseLabel="⚠️ Found" />} />
                  <KV label="Inline Scripts"  value={d.vulnerabilities?.inlineScripts} />
                  <KV label="Exposed Paths"   value={d.vulnerabilities?.exposedPaths?.length || 0} />
                </div>
                {d.vulnerabilities?.exposedPaths?.length > 0 && (
                  <div className="exposed-paths">
                    {d.vulnerabilities.exposedPaths.map((p, i) => (
                      <div key={i} className="exposed-path">
                        <span>/{p.path}</span><span className="http-status">{p.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {/* ── DOMAIN TAB ── */}
          {activeTab === 'domain' && (
            <div className="ti-tab-content">
              <SectionCard title="DNS Records" icon="📡">
                <div className="dns-grid">
                  <DNSRecord type="A"     records={d.dns?.a}     />
                  <DNSRecord type="AAAA"  records={d.dns?.aaaa}  />
                  <DNSRecord type="MX"    records={d.dns?.mx?.map(m => `${m.exchange} (priority: ${m.priority})`)} />
                  <DNSRecord type="TXT"   records={d.dns?.txt?.slice(0, 3)} />
                  <DNSRecord type="CNAME" records={d.dns?.cname} />
                </div>
                <div className="dns-flags">
                  <DnsFlag label="SPF"   ok={d.dns?.spf}   />
                  <DnsFlag label="DMARC" ok={d.dns?.dmarc} />
                  <DnsFlag label="MX"    ok={d.dns?.mx?.length > 0} />
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── CONTENT TAB ── */}
          {activeTab === 'content' && (
            <div className="ti-tab-content">
              <SectionCard title="Page Content Metrics" icon="📝">
                <div className="kv-grid">
                  <KV label="Word Count"      value={d.content?.wordCount?.toLocaleString()} />
                  <KV label="Readability"     value={d.content?.readabilityScore} />
                  <KV label="Grade Level"     value={d.content?.readabilityGrade} />
                  <KV label="Paragraphs"      value={d.content?.paragraphCount} />
                </div>
              </SectionCard>

              <SectionCard title="SEO Metadata" icon="🔎">
                <div className="kv-grid">
                  <KV label="Title"            value={d.seoContent?.title || '❌ Missing'} />
                  <KV label="Title Length"     value={d.seoContent?.titleLength ? `${d.seoContent.titleLength} chars` : '—'} />
                  <KV label="Meta Description" value={d.seoContent?.metaDescription ? `✓ ${d.seoContent.metaDescriptionLength} chars` : '❌ Missing'} />
                  <KV label="H1 Tags"          value={d.seoContent?.h1?.length || 0} />
                  <KV label="H2 Tags"          value={d.seoContent?.h2?.length || 0} />
                  <KV label="Total Images"     value={d.seoContent?.totalImages} />
                  <KV label="Missing Alt Text" value={d.seoContent?.imgWithoutAlt} />
                  <KV label="Internal Links"   value={d.seoContent?.internalLinks} />
                  <KV label="External Links"   value={d.seoContent?.externalLinks} />
                  <KV label="Canonical Tag"    value={d.seoContent?.canonicalTag ? '✓ Present' : '❌ Missing'} />
                </div>
              </SectionCard>

              <SectionCard title="Schema Markup" icon="🗂️">
                <div className="kv-grid">
                  <KV label="Schema Found" value={<StatusBadge value={d.schema?.found} />} />
                  <KV label="Types"        value={d.schema?.types?.join(', ') || 'None'} />
                  <KV label="Invalid"      value={d.schema?.invalid?.length || 0} />
                </div>
              </SectionCard>

              <SectionCard title="Top Keywords" icon="🔑">
                {d.seoContent?.topKeywords?.length > 0 ? (
                  <div className="keyword-list">
                    {d.seoContent.topKeywords.map((kw, i) => (
                      <div key={i} className="keyword-item">
                        <span className="kw-rank">#{i+1}</span>
                        <span className="kw-word">{kw.word}</span>
                        <div className="kw-bar-wrap">
                          <div className="kw-bar" style={{ width: `${Math.min(kw.density * 10, 100)}%` }} />
                        </div>
                        <span className="kw-density">{kw.density}%</span>
                        <span className="kw-count">{kw.count}×</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="empty-msg">No keyword data available.</p>}
              </SectionCard>

              <SectionCard title="JavaScript Analysis" icon="📦">
                <div className="kv-grid">
                  <KV label="Total Scripts"      value={d.jsAnalysis?.totalScripts} />
                  <KV label="External Scripts"   value={d.jsAnalysis?.externalScripts} />
                  <KV label="Inline Scripts"     value={d.jsAnalysis?.inlineScripts} />
                  <KV label="Render Blocking"    value={d.jsAnalysis?.renderBlocking} />
                </div>
              </SectionCard>

              <SectionCard title="Accessibility (WCAG)" icon="♿">
                <div className="a11y-checks">
                  {d.accessibility?.checks?.map((chk, i) => (
                    <div key={i} className={`a11y-check ${chk.passed ? 'pass' : 'fail'}`}>
                      <span>{chk.passed ? '✓' : '✗'}</span>
                      <span>{chk.label}</span>
                      <span className={sevBadge(chk.severity === 'critical' ? 'high' : 'medium')}>{chk.severity}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── TECHNICAL TAB ── */}
          {activeTab === 'technical' && (
            <div className="ti-tab-content">
              <SectionCard title="HTTP Headers (CDN)" icon="🌍">
                <div className="kv-grid">
                  {Object.entries(d.cdn?.headers || {}).filter(([, v]) => v).map(([k, v]) => (
                    <KV key={k} label={k} value={String(v)} />
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="Frameworks & Libraries" icon="🧩">
                <div className="tech-tags">
                  {[...(d.technology?.frameworks || []), ...(d.technology?.libraries || [])].map((t, i) => (
                    <span key={i} className="tech-tag">{t}</span>
                  ))}
                  {!d.technology?.frameworks?.length && !d.technology?.libraries?.length && <p className="empty-msg">No frameworks detected via manual scan.</p>}
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── ISSUES TAB ── */}
          {activeTab === 'issues' && (
            <div className="ti-tab-content">
              <div className="issues-filter">
                {['all','high','medium','low'].map(f => (
                  <FilterBtn key={f} filter={f} issues={d.issues} />
                ))}
              </div>
              <IssueList issues={d.issues || []} />
            </div>
          )}

          {/* ── AI REPORT TAB ── */}
          {activeTab === 'ai' && aiReport && (
            <div className="ti-tab-content">
              <div className="ai-report">
                <div className="ai-score-banner">
                  <div className="ai-score-val" style={{ color: scoreColor(aiReport.overallScore || d.scores?.overall || 0) }}>
                    {aiReport.overallScore || d.scores?.overall || 0}<span>/100</span>
                  </div>
                  <div className="ai-provider">Generated by: {aiReport.provider}</div>
                </div>

                <div className="ai-summary">
                  <h3>📋 Website Summary</h3>
                  <p>{aiReport.summary}</p>
                </div>

                {aiReport.workingWell?.length > 0 && (
                  <div className="ai-section good">
                    <h3>✅ What's Working Well</h3>
                    <ul>{aiReport.workingWell.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  </div>
                )}

                {aiReport.criticalIssues?.length > 0 && (
                  <div className="ai-section bad">
                    <h3>❌ Critical Issues</h3>
                    <ul>{aiReport.criticalIssues.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  </div>
                )}

                {aiReport.recommendations?.length > 0 && (
                  <div className="ai-section recs">
                    <h3>🎯 Recommendations</h3>
                    {aiReport.recommendations.map((r, i) => (
                      <div key={i} className={`rec-item ${r.priority}`}>
                        <div className="rec-title">{r.title}</div>
                        <div className="rec-action">{r.action}</div>
                        <div className="rec-impact">💼 {r.impact}</div>
                        <span className={sevBadge(r.priority)}>{r.priority?.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {aiReport.businessImpact && (
                  <div className="ai-section impact">
                    <h3>💼 Business Impact</h3>
                    <p>{aiReport.businessImpact}</p>
                  </div>
                )}

                {aiReport.priorityTable?.length > 0 && (
                  <div className="ai-section">
                    <h3>📊 Priority Table</h3>
                    <div className="priority-table">
                      <div className="pt-row header">
                        <span>#</span><span>Issue</span><span>Severity</span><span>Fix</span>
                      </div>
                      {aiReport.priorityTable.map((row, i) => (
                        <div key={i} className="pt-row">
                          <span className="pt-num">{row.priority}</span>
                          <span>{row.issue}</span>
                          <span className={sevBadge(row.severity)}>{row.severity?.toUpperCase()}</span>
                          <span className="pt-fix">{row.fix}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */
function KV({ label, value }) {
  return (
    <div className="kv-item">
      <span className="kv-label">{label}</span>
      <span className="kv-value">{value ?? '—'}</span>
    </div>
  );
}

function DNSRecord({ type, records }) {
  if (!records?.length) return null;
  return (
    <div className="dns-record">
      <span className="dns-type">{type}</span>
      <div className="dns-vals">{records.slice(0, 4).map((r, i) => <div key={i} className="dns-val">{String(r)}</div>)}</div>
    </div>
  );
}

function DnsFlag({ label, ok }) {
  return <div className={`dns-flag ${ok ? 'ok' : 'missing'}`}>{ok ? '✓' : '✗'} {label}</div>;
}

function FilterBtn({ filter, issues }) {
  const [active, setActive] = useState(filter === 'all');
  return (
    <button className={`filter-btn ${active ? 'active' : ''} ${filter}`}
      onClick={() => setActive(p => !p)}>
      {filter === 'all' ? `All (${issues?.length || 0})` : `${filter.charAt(0).toUpperCase() + filter.slice(1)} (${issues?.filter(i => i.severity === filter).length || 0})`}
    </button>
  );
}

function IssueList({ issues }) {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? issues : issues.filter(i => i.severity === filter);
  return (
    <div>
      <div className="issues-filter-bar">
        {['all','high','medium','low'].map(f => (
          <button key={f} className={`filter-btn ${filter === f ? 'active' : ''} ${f}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? `All (${issues.length})` : `${f} (${issues.filter(i => i.severity === f).length})`}
          </button>
        ))}
      </div>
      <div className="issues-list">
        {filtered.length === 0
          ? <div className="empty-msg">No {filter === 'all' ? '' : filter} issues found. 🎉</div>
          : filtered.map((issue, i) => <IssueRow key={i} issue={issue} index={i} />)
        }
      </div>
    </div>
  );
}