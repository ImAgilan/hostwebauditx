import { useState, useEffect, useRef } from 'react';
import './security.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const SEVERITY_META = {
  critical: { label: 'Critical', color: '#dc2626', bg: '#fef2f2', icon: '🔴' },
  high:     { label: 'High',     color: '#ea580c', bg: '#fff7ed', icon: '🟠' },
  medium:   { label: 'Medium',   color: '#d97706', bg: '#fffbeb', icon: '🟡' },
  low:      { label: 'Low',      color: '#2563eb', bg: '#eff6ff', icon: '🔵' },
  info:     { label: 'Info',     color: '#64748b', bg: '#f8fafc', icon: '⚪' },
};

function ScoreRing({ score }) {
  const r = 54, c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color  = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#ef4444' : '#dc2626';
  const grade  = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F';
  return (
    <div className="score-ring-wrap">
      <svg width="140" height="140" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
        <text x="65" y="60" textAnchor="middle" fill={color} fontSize="28" fontWeight="bold" fontFamily="'Courier New', monospace">{score}</text>
        <text x="65" y="82" textAnchor="middle" fill="#94a3b8" fontSize="13" fontFamily="monospace">Grade {grade}</text>
      </svg>
    </div>
  );
}

function CheckItem({ label, value, invert = false }) {
  const ok = invert ? !value : !!value;
  return (
    <div className={`check-item ${ok ? 'ok' : 'fail'}`}>
      <span className="check-icon">{ok ? '✓' : '✗'}</span>
      <span className="check-label">{label}</span>
    </div>
  );
}

function MetricCard({ title, children, icon }) {
  return (
    <div className="metric-card">
      <div className="metric-card-header">
        <span className="metric-icon">{icon}</span>
        <h3>{title}</h3>
      </div>
      <div className="metric-card-body">{children}</div>
    </div>
  );
}

function IssueRow({ issue, idx }) {
  const meta = SEVERITY_META[issue.severity] || SEVERITY_META.info;
  return (
    <div className="issue-row" style={{ borderLeft: `4px solid ${meta.color}` }}>
      <div className="issue-row-top">
        <span className="issue-num">#{idx + 1}</span>
        <span className="issue-badge" style={{ background: meta.bg, color: meta.color }}>{meta.icon} {meta.label}</span>
        <span className="issue-category">{issue.category}</span>
      </div>
      <div className="issue-title">{issue.title}</div>
      <div className="issue-desc">{issue.description}</div>
      <div className="issue-fix">
        <span className="fix-label">💡 Fix:</span> {issue.recommendation}
      </div>
    </div>
  );
}

export default function SecurityHome() {
  const [urlInput,  setUrlInput]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [progress,  setProgress]  = useState([]);
  const [report,    setReport]    = useState(null);
  const [error,     setError]     = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const resultsRef = useRef(null);

  const STEPS = [
    'Connecting to target server…',
    'Checking SSL certificate…',
    'Scanning TLS versions…',
    'Analyzing security headers…',
    'Inspecting cookies…',
    'Testing HTTPS enforcement…',
    'Scanning forms for insecure submission…',
    'Running DNS security checks…',
    'Checking Safe Browsing status…',
    'Detecting CMS and technology…',
    'Probing sensitive paths…',
    'Checking Subresource Integrity…',
    'Analyzing CORS policy…',
    'Evaluating information disclosure…',
    'Compiling security score…',
  ];

  const startProgressSim = () => {
    setProgress([]);
    let i = 0;
    const iv = setInterval(() => {
      if (i >= STEPS.length) { clearInterval(iv); return; }
      setProgress(p => [...p, STEPS[i]]);
      i++;
    }, 900);
    return iv;
  };

  const analyze = async () => {
  let u = urlInput.trim();
  if (!u) return;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  setError(''); setReport(null); setLoading(true);
  const iv = startProgressSim();
  try {
    const token = localStorage.getItem('wax_token');  // ← ADD

    const res = await fetch(`${API}/api/security/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),  // ← ADD
      },
      body: JSON.stringify({ url: u }),
    });
    const json = await res.json();
    clearInterval(iv);
    if (!json.success) throw new Error(json.message);
    setReport(json.data);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
  } catch (e) {
    clearInterval(iv);
    setError(e.message || 'Analysis failed');
  } finally {
    setLoading(false);
  }
};

  const openAIInsight = async () => {
    if (!report?._id) return;
    setAiLoading(true);
    try {
      const res = await fetch(`${API}/api/security/ai-insight/${report._id}`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      const ai = json.data;
      const w  = window.open('', '_blank');
      w.document.write(`<!DOCTYPE html><html><head>
        <title>AI Security Insight — ${report.url}</title>
        <meta charset="utf-8">
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{background:#0f172a;color:#e2e8f0;font-family:'Segoe UI',system-ui,sans-serif;padding:40px;line-height:1.7}
          .header{background:linear-gradient(135deg,#1e3a5f,#0f172a);border:1px solid #334155;border-radius:16px;padding:32px;margin-bottom:32px}
          h1{font-size:2rem;color:#38bdf8;margin-bottom:8px}
          .meta{color:#64748b;font-size:0.9rem}
          .score-badge{display:inline-block;background:${report.score>=80?'#14532d':report.score>=60?'#451a03':'#450a0a'};color:${report.score>=80?'#22c55e':report.score>=60?'#f59e0b':'#ef4444'};padding:6px 18px;border-radius:50px;font-weight:700;font-size:1.1rem;margin-top:12px}
          .content{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:32px;white-space:pre-wrap;font-size:0.95rem;line-height:1.8}
          h2{color:#38bdf8;font-size:1.2rem;margin:24px 0 8px;border-bottom:1px solid #334155;padding-bottom:8px}
          table{width:100%;border-collapse:collapse;margin-top:16px}
          th{background:#0f172a;color:#94a3b8;padding:10px 14px;text-align:left;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em}
          td{padding:10px 14px;border-bottom:1px solid #1e293b;font-size:0.9rem}
          tr:hover td{background:#0f172a}
          .provider{color:#64748b;font-size:0.8rem;margin-top:24px;text-align:right}
        </style>
      </head><body>
        <div class="header">
          <h1>🛡️ AI Security Insight</h1>
          <div class="meta">${report.url} — Analyzed ${new Date().toLocaleString()}</div>
          <div class="score-badge">Security Score: ${report.score}/100 — Grade: ${report.grade}</div>
        </div>
        <div class="content">${(ai.summary||'').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>').replace(/##\s(.+)/g,'<h2>$1</h2>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}</div>
        <div class="provider">Powered by ${ai.provider} · WebAuditX Security Module</div>
      </body></html>`);
    } catch (e) {
      alert('AI Insight failed: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!report?._id) return;
    window.open(`${API}/api/security/download/${report._id}`, '_blank');
  };

  const sortedIssues = (report?.issues || []).sort((a, b) =>
    SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  const counts = SEVERITY_ORDER.reduce((acc, s) => {
    acc[s] = sortedIssues.filter(i => i.severity === s).length;
    return acc;
  }, {});

  return (
    <div className="sec-root">
      {/* ── Navbar ── */}
      <nav className="sec-nav">
        <a href="/" className="nav-logo">⬡ WebAuditX</a>
        <span className="nav-module">Security &amp; HTTPS Audit</span>
      </nav>

      {/* ── Hero ── */}
      <header className="sec-hero">
        <div className="hero-content">
          <div className="hero-badge">MODULE 03</div>
          <h1 className="hero-title">Security &amp; HTTPS Analysis</h1>
          <p className="hero-sub">
            SSL certificates · HTTPS enforcement · Security headers · DNS security ·<br/>
            Cookie analysis · Safe Browsing · CMS detection · Information disclosure
          </p>
          <div className="url-form">
            <div className="url-input-wrap">
              <span className="url-prefix">🔒</span>
              <input
                className="url-input"
                type="text"
                placeholder="https://example.com"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && analyze()}
                disabled={loading}
              />
            </div>
            <button className="btn-analyze" onClick={analyze} disabled={loading || !urlInput.trim()}>
              {loading ? <span className="btn-spinner" /> : ''}
              {loading ? 'Scanning…' : 'Run Security Audit'}
            </button>
          </div>
          {error && <div className="error-banner">⚠️ {error}</div>}
        </div>
      </header>

      {/* ── Progress ── */}
      {loading && (
        <div className="progress-panel">
          <div className="progress-inner">
            <div className="progress-title">🛡️ Running security checks…</div>
            {progress.map((s, i) => (
              <div key={i} className="progress-step">
                <span className="step-check">✓</span> {s}
              </div>
            ))}
            <div className="progress-step active">
              <span className="step-spinner" /> Analyzing…
            </div>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {report && !loading && (
        <div className="results-wrap" ref={resultsRef}>
          {/* Score bar */}
          <div className="score-banner">
            <ScoreRing score={report.score} />
            <div className="score-info">
              <h2 className="score-url">{report.url}</h2>
              <div className="score-meta">Analyzed {new Date(report.analyzedAt || report.createdAt).toLocaleString()}</div>
              <div className="issue-counts">
                {SEVERITY_ORDER.map(s => counts[s] > 0 && (
                  <span key={s} className="cnt-badge" style={{ background: SEVERITY_META[s].bg, color: SEVERITY_META[s].color }}>
                    {SEVERITY_META[s].icon} {counts[s]} {SEVERITY_META[s].label}
                  </span>
                ))}
              </div>
            </div>
            <div className="score-actions">
              <button className="btn-ai" onClick={openAIInsight} disabled={aiLoading}>
                {aiLoading ? '⏳ Generating…' : '🤖 AI Insight'}
              </button>
              <button className="btn-pdf" onClick={downloadPDF}>📄 Download PDF</button>
            </div>
          </div>

          {/* Grid */}
          <div className="metrics-grid">

            {/* SSL */}
            <MetricCard title="SSL Certificate" icon="🔐">
              <CheckItem label="Certificate Valid"   value={report.ssl?.valid} />
              <CheckItem label="Trusted Issuer"      value={report.ssl?.isTrusted} />
              <CheckItem label="Hostname Match"      value={report.ssl?.hostnameMatch} />
              <div className="kv-row"><span>Issuer</span><span>{report.ssl?.issuer || 'N/A'}</span></div>
              <div className="kv-row"><span>Expires</span><span>{report.ssl?.validTo || 'N/A'}</span></div>
              <div className="kv-row"><span>Days Left</span>
                <span style={{ color: (report.ssl?.daysUntilExpiry||0) < 30 ? '#ef4444' : '#22c55e' }}>
                  {report.ssl?.daysUntilExpiry ?? 'N/A'}
                </span>
              </div>
              <div className="kv-row"><span>Protocol</span><span>{report.ssl?.protocol || 'N/A'}</span></div>
            </MetricCard>

            {/* HTTPS */}
            <MetricCard title="HTTPS Enforcement" icon="🌐">
              <CheckItem label="HTTPS Enforced"         value={report.https?.enforced} />
              <CheckItem label="Redirects HTTP → HTTPS" value={report.https?.redirectsToHttps} />
              <CheckItem label="No Mixed Content"       value={report.https?.mixedContent} invert />
            </MetricCard>

            {/* Security Headers */}
            <MetricCard title="Security Headers" icon="🛡️">
              <CheckItem label="Content-Security-Policy"  value={report.headers?.csp?.present} />
              <CheckItem label="Strict-Transport-Security" value={report.headers?.hsts?.present} />
              <CheckItem label="X-Content-Type-Options"   value={report.headers?.xContentTypeOptions?.present} />
              <CheckItem label="X-Frame-Options"          value={report.headers?.xFrameOptions?.present} />
              <CheckItem label="X-XSS-Protection"        value={report.headers?.xXssProtection?.present} />
              <CheckItem label="Referrer-Policy"          value={report.headers?.referrerPolicy?.present} />
              <CheckItem label="Permissions-Policy"       value={report.headers?.permissionsPolicy?.present} />
              {report.headers?.hsts?.present && (
                <div className="kv-row"><span>HSTS max-age</span><span>{report.headers.hsts.maxAge}s</span></div>
              )}
            </MetricCard>

            {/* Cookies */}
            <MetricCard title="Cookie Security" icon="🍪">
              {(report.cookies || []).length === 0
                ? <div className="empty-note">No cookies detected</div>
                : (report.cookies || []).map((c, i) => (
                    <div key={i} className="cookie-row">
                      <div className="cookie-name">{c.name}</div>
                      <div className="cookie-flags">
                        <span className={c.httpOnly ? 'flag ok' : 'flag fail'}>HttpOnly</span>
                        <span className={c.secure   ? 'flag ok' : 'flag fail'}>Secure</span>
                        <span className={c.sameSite && c.sameSite !== 'none' ? 'flag ok' : 'flag fail'}>SameSite</span>
                      </div>
                    </div>
                  ))
              }
            </MetricCard>

            {/* TLS */}
            <MetricCard title="TLS Versions" icon="🔑">
              <CheckItem label="TLS 1.3 (Recommended)" value={report.tlsDetails?.supportsTls13} />
              <CheckItem label="TLS 1.2 (Acceptable)"  value={report.tlsDetails?.supportsTls12} />
              <CheckItem label="TLS 1.1 Disabled"      value={report.tlsDetails?.supportsTls11} invert />
              <CheckItem label="TLS 1.0 Disabled"      value={report.tlsDetails?.supportsTls10} invert />
            </MetricCard>

            {/* DNS */}
            <MetricCard title="DNS Security" icon="🌍">
              <CheckItem label="SPF Record"   value={report.dnsSecurity?.spfRecord?.present} />
              <CheckItem label="SPF Valid"    value={report.dnsSecurity?.spfRecord?.valid} />
              <CheckItem label="DMARC Record" value={report.dnsSecurity?.dmarcRecord?.present} />
              <CheckItem label="DKIM Record"  value={report.dnsSecurity?.dkimRecord?.present} />
              <CheckItem label="CAA Records"  value={(report.dnsSecurity?.caaRecords||[]).length > 0} />
              {(report.dnsSecurity?.mxRecords||[]).length > 0 && (
                <div className="kv-row"><span>MX Records</span><span>{report.dnsSecurity.mxRecords.join(', ')}</span></div>
              )}
            </MetricCard>

            {/* Safe Browsing */}
            <MetricCard title="Safe Browsing" icon="🔍">
              <CheckItem label="Google Safe Browsing Clear" value={report.safeBrowsing?.safe} />
              <div className="kv-row"><span>API Used</span><span>{report.safeBrowsing?.apiUsed ? 'Yes' : 'Manual'}</span></div>
              {(!report.safeBrowsing?.safe) && (
                <div className="threat-alert">
                  ⚠️ Threats: {(report.safeBrowsing?.threats||[]).join(', ')}
                </div>
              )}
            </MetricCard>

            {/* CMS */}
            <MetricCard title="CMS Detection" icon="⚙️">
              {report.cms?.detected ? (
                <>
                  <div className="kv-row"><span>CMS</span><span>{report.cms.name}</span></div>
                  <div className="kv-row"><span>Version</span><span>{report.cms.version || 'Unknown'}</span></div>
                  {(report.cms?.vulnerabilities||[]).length > 0 && (
                    <div className="threat-alert">⚠️ Known vulnerabilities detected</div>
                  )}
                </>
              ) : <div className="empty-note">No CMS detected</div>}
            </MetricCard>

            {/* CORS */}
            <MetricCard title="CORS Policy" icon="🔗">
              <CheckItem label="CORS Header Present" value={report.corsPolicy?.present} />
              <CheckItem label="Not Wildcard (*)"    value={report.corsPolicy?.isWildcard} invert />
              {report.corsPolicy?.value && (
                <div className="kv-row mono"><span>Value</span><span>{report.corsPolicy.value}</span></div>
              )}
            </MetricCard>

            {/* Clickjacking */}
            <MetricCard title="Clickjacking Protection" icon="🖱️">
              <CheckItem label="Protected" value={report.clickjacking?.protected} />
              <div className="kv-row"><span>Method</span><span>{report.clickjacking?.method || 'None'}</span></div>
            </MetricCard>

            {/* SRI */}
            <MetricCard title="Subresource Integrity" icon="📦">
              <div className="kv-row"><span>Total Scripts/Styles</span><span>{report.subresourceIntegrity?.total ?? 0}</span></div>
              <div className="kv-row"><span className="ok-text">With SRI</span><span>{report.subresourceIntegrity?.withSRI ?? 0}</span></div>
              <div className="kv-row"><span className="fail-text">Without SRI</span><span>{report.subresourceIntegrity?.withoutSRI ?? 0}</span></div>
            </MetricCard>

            {/* Info Disclosure */}
            <MetricCard title="Information Disclosure" icon="👁️">
              <CheckItem label="Server Version Hidden"  value={report.informationDisclosure?.serverVersionExposed} invert />
              <CheckItem label="PHP Version Hidden"     value={report.informationDisclosure?.phpVersionExposed} invert />
              <CheckItem label="ASP.NET Version Hidden" value={report.informationDisclosure?.aspVersionExposed} invert />
              <CheckItem label="robots.txt Present"     value={report.informationDisclosure?.robotsTxtExists} />
              <CheckItem label="sitemap.xml Present"    value={report.informationDisclosure?.sitemapExists} />
            </MetricCard>

            {/* Sensitive Paths */}
            <MetricCard title="Sensitive Paths" icon="🚪">
              {(report.informationDisclosure?.sensitivePaths || []).filter(p => p.accessible).length === 0
                ? <div className="empty-note ok-text">✓ No sensitive paths exposed</div>
                : (report.informationDisclosure?.sensitivePaths || []).filter(p => p.accessible).map((p, i) => (
                    <div key={i} className="path-exposed">⚠️ {p.path}</div>
                  ))
              }
            </MetricCard>

            {/* Rate Limiting */}
            <MetricCard title="Rate Limiting" icon="⏱️">
              <CheckItem label="Rate Limiting Detected" value={report.rateLimit?.detected} />
              {(report.rateLimit?.headers||[]).length > 0 && (
                <div className="kv-row"><span>Headers</span><span>{report.rateLimit.headers.join(', ')}</span></div>
              )}
            </MetricCard>

            {/* Forms */}
            <MetricCard title="Form Security" icon="📝">
              <div className="kv-row"><span>Total Forms</span><span>{report.forms?.total ?? 0}</span></div>
              <div className="kv-row">
                <span className={report.forms?.insecure > 0 ? 'fail-text' : 'ok-text'}>Insecure Forms</span>
                <span>{report.forms?.insecure ?? 0}</span>
              </div>
              <CheckItem label="All Forms Secure" value={(report.forms?.insecure ?? 0) === 0} />
            </MetricCard>

          </div>

          {/* ── All Issues ── */}
          <div className="issues-section">
            <div className="issues-header">
              <h2>🔎 All Security Issues <span className="issues-count">{sortedIssues.length}</span></h2>
              <div className="issues-legend">
                {SEVERITY_ORDER.map(s => (
                  <span key={s} className="legend-item" style={{ color: SEVERITY_META[s].color }}>
                    {SEVERITY_META[s].icon} {SEVERITY_META[s].label}: {counts[s]}
                  </span>
                ))}
              </div>
            </div>
            {sortedIssues.length === 0
              ? <div className="no-issues">🎉 No security issues found! Excellent security posture.</div>
              : sortedIssues.map((issue, i) => <IssueRow key={i} issue={issue} idx={i} />)
            }
          </div>

          {/* ── Bottom action bar ── */}
          <div className="bottom-actions">
            <button className="btn-ai large" onClick={openAIInsight} disabled={aiLoading}>
              {aiLoading ? '⏳ Generating AI Insight…' : '🤖 AI Security Insight'}
            </button>
            <button className="btn-pdf large" onClick={downloadPDF}>
              📄 Download Full PDF Report
            </button>
          </div>
        </div>
      )}

      <footer className="sec-footer">
        <span>WebAuditX Security Module · Powered by Node.js + AI</span>
      </footer>
    </div>
  );
}