import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './AuditHistory.css';

const API = 'http://localhost:5000/api';

const PLAN_COLOR  = { free: '#64748b', pro: '#00b894', premium: '#3b82f6' };
const PLAN_LABEL  = { free: 'Starter', pro: 'Pro', premium: 'Agency' };

const MODULE_META = {
  'ui-analysis':         { icon: '🎨', label: 'UI/UX Analysis',        color: 'rgba(0,184,148,0.12)' },
  'mobile-friendliness': { icon: '📱', label: 'Mobile Friendliness',   color: 'rgba(59,130,246,0.12)' },
  'accessibility':       { icon: '♿', label: 'Accessibility',          color: 'rgba(245,158,11,0.12)' },
  'seo':                 { icon: '🔍', label: 'SEO Analysis',           color: 'rgba(239,68,68,0.12)'  },
  'performance':         { icon: '⚡', label: 'Performance',            color: 'rgba(168,85,247,0.12)' },
  'security':            { icon: '🔐', label: 'Security',               color: 'rgba(0,184,148,0.12)'  },
  'content-quality':     { icon: '⭐', label: 'Content Quality',        color: 'rgba(59,130,246,0.12)' },
  'structure-navigation':{ icon: '🗺️', label: 'Structure & Navigation', color: 'rgba(245,158,11,0.12)' },
  'technical-insight':   { icon: '🔧', label: 'Technical Insights',     color: 'rgba(239,68,68,0.12)'  },
  'full-audit':          { icon: '🔬', label: 'Full Site Audit',        color: 'rgba(0,184,148,0.12)'  },
};

function scoreColor(score) {
  if (score === null || score === undefined) return '#94a3b8';
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AuditHistoryPage() {
  const navigate = useNavigate();
  const token    = localStorage.getItem('wax_token');

  const [user,     setUser]     = useState(null);
  const [usage,    setUsage]    = useState(null);
  const [audits,   setAudits]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');   // all | full-audit | ui-analysis | seo…
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const PER_PAGE = 10;

  useEffect(() => {
    if (!token) { navigate('/auth'); return; }
    loadData();
  }, [token]);

  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  async function loadData() {
    setLoading(true);
    try {
      const [meRes, usageRes, histRes] = await Promise.all([
        fetch(`${API}/auth/me`,              { headers: headers() }),
        fetch(`${API}/subscription/usage`,   { headers: headers() }),
        fetch(`${API}/audit-history`,        { headers: headers() }),
      ]);

      const meData    = await meRes.json();
      const usageData = await usageRes.json();
      const histData  = histRes.ok ? await histRes.json() : { success: false };

      if (meData.success) {
        setUser(meData.data.user);
      }
      if (usageData.success) setUsage(usageData.data);

      /* If the history endpoint doesn't exist yet, show empty with a note */
      if (histData.success && Array.isArray(histData.data)) {
        setAudits(histData.data);
      } else {
        setAudits([]);
      }
    } catch {
      setAudits([]);
    } finally {
      setLoading(false);
    }
  }

  /* ── Derived data ── */
  const filtered = audits.filter(a => {
    const matchFilter = filter === 'all' || a.module === filter;
    const matchSearch = !search.trim() ||
      a.url?.toLowerCase().includes(search.toLowerCase()) ||
      a.module?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const plan      = user?.plan || 'free';
  const planColor = PLAN_COLOR[plan];
  const planLabel = PLAN_LABEL[plan];

  const usedPct = usage && usage.limit !== 'unlimited'
    ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
    : 0;

  const uniqueModules = [...new Set(audits.map(a => a.module).filter(Boolean))];

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="hist-pageWAX">
        <div className="hist-gridWAX" />
        <div className="hist-loadingWAX">
          <div className="hist-spinnerWAX" />
          <p>Loading audit history…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hist-pageWAX">
      <div className="hist-gridWAX" />
      <div className="hist-orb1WAX" />

      {/* ── Nav ── */}
      <nav className="hist-navWAX">
        <Link to="/" className="hist-logoWAX">
          WebAudit<span>X</span>
          <span className="hist-betaWAX">BETA</span>
        </Link>
        <div className="hist-nav-rightWAX">
          <button className="hist-nav-btnWAX" onClick={() => navigate('/profile')}>
            ⚙ Profile
          </button>
          <button className="hist-nav-backWAX" onClick={() => navigate('/')}>
            ← Back to Home
          </button>
        </div>
      </nav>

      <div className="hist-layoutWAX">

        {/* ── Page header ── */}
        <div className="hist-headWAX">
          <div>
            <div className="hist-head-tagWAX">AUDIT HISTORY</div>
            <h1 className="hist-head-titleWAX">Your past audits</h1>
          </div>

          {/* Usage balance card */}
          {usage && (
            <div
              className="hist-balance-cardWAX"
              style={{ borderColor: `${planColor}30`, boxShadow: `0 0 20px ${planColor}15` }}
            >
              <div className="hist-balance-topWAX">
                <div className="hist-balance-labelWAX">Monthly Balance</div>
                <div
                  className="hist-plan-chipWAX"
                  style={{ background: `${planColor}15`, color: planColor }}
                >
                  {planLabel}
                </div>
              </div>
              <div className="hist-balance-numWAX">
                <span style={{ color: planColor }}>
                  {usage.remaining === 'unlimited' ? '∞' : usage.remaining}
                </span>
                <span className="hist-balance-ofWAX">
                  / {usage.limit === 'unlimited' ? '∞' : usage.limit}
                </span>
              </div>
              <div className="hist-balance-sublabelWAX">audits remaining this month</div>
              {usage.limit !== 'unlimited' && (
                <div className="hist-balance-barWAX">
                  <div
                    className="hist-balance-fillWAX"
                    style={{
                      width: `${usedPct}%`,
                      background: usedPct > 85 ? '#ef4444' : usedPct > 60 ? '#f59e0b' : planColor,
                    }}
                  />
                </div>
              )}
              <div className="hist-balance-footWAX">
                <span>{usage.used} used</span>
                {plan !== 'premium' && (
                  <button className="hist-upgrade-linkWAX" onClick={() => navigate('/payment')}>
                    Upgrade →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Stats row ── */}
        <div className="hist-stats-rowWAX">
          {[
            { label: 'Total Audits',   value: audits.length },
            { label: 'This Month',     value: usage?.used ?? 0 },
            { label: 'Modules Used',   value: uniqueModules.length },
            { label: 'Avg Score',      value: audits.length
                ? Math.round(audits.reduce((s, a) => s + (a.score || 0), 0) / audits.length)
                : '—' },
          ].map((s, i) => (
            <div key={i} className="hist-stat-cardWAX">
              <div className="hist-stat-numWAX" style={i === 3 && typeof s.value === 'number' ? { color: scoreColor(s.value) } : {}}>
                {s.value}
              </div>
              <div className="hist-stat-lblWAX">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters + search ── */}
        <div className="hist-toolbar-rowWAX">
          <div className="hist-filtersWAX">
            <button
              className={`hist-filter-btnWAX ${filter === 'all' ? 'activeWAX' : ''}`}
              onClick={() => { setFilter('all'); setPage(1); }}
            >
              All
            </button>
            {uniqueModules.map(mod => {
              const meta = MODULE_META[mod] || { icon: '🔬', label: mod };
              return (
                <button
                  key={mod}
                  className={`hist-filter-btnWAX ${filter === mod ? 'activeWAX' : ''}`}
                  onClick={() => { setFilter(mod); setPage(1); }}
                >
                  {meta.icon} {meta.label}
                </button>
              );
            })}
          </div>

          <div className="hist-search-wrapWAX">
            <span className="hist-search-iconWAX">🔍</span>
            <input
              type="text"
              placeholder="Search by URL or module…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="hist-searchWAX"
            />
            {search && (
              <button className="hist-search-clearWAX" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        {paginated.length === 0 ? (
          <div className="hist-emptyWAX">
            <div className="hist-empty-iconWAX">📋</div>
            {audits.length === 0 ? (
              <>
                <h3>No audits yet</h3>
                <p>Run your first audit from the home page to see your history here.</p>
                <button className="hist-empty-btnWAX" onClick={() => navigate('/')}>
                  Run First Audit →
                </button>
              </>
            ) : (
              <>
                <h3>No results found</h3>
                <p>Try adjusting your search or filter.</p>
                <button className="hist-empty-btnWAX" onClick={() => { setSearch(''); setFilter('all'); }}>
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="hist-tableWAX">
              <div className="hist-table-headWAX">
                <div>Module</div>
                <div>URL</div>
                <div>Score</div>
                <div>Issues</div>
                <div>Date</div>
                <div>Actions</div>
              </div>

              {paginated.map((audit, i) => {
                const meta  = MODULE_META[audit.module] || { icon: '🔬', label: audit.module, color: 'rgba(0,184,148,0.1)' };
                const color = scoreColor(audit.score);
                return (
                  <div key={audit._id || i} className="hist-table-rowWAX">

                    {/* Module */}
                    <div className="hist-row-moduleWAX">
                      <div className="hist-mod-iconWAX" style={{ background: meta.color }}>
                        {meta.icon}
                      </div>
                      <span className="hist-mod-labelWAX">{meta.label}</span>
                    </div>

                    {/* URL */}
                    <div className="hist-row-urlWAX">
                      <a href={audit.url} target="_blank" rel="noopener noreferrer" className="hist-url-linkWAX">
                        {audit.url?.replace(/^https?:\/\//, '').slice(0, 42)}
                        {(audit.url?.length > 52) ? '…' : ''}
                      </a>
                    </div>

                    {/* Score */}
                    <div className="hist-row-scoreWAX">
                      {audit.score != null ? (
                        <span
                          className="hist-score-chipWAX"
                          style={{ color, background: `${color}15`, borderColor: `${color}30` }}
                        >
                          {audit.score}
                        </span>
                      ) : (
                        <span className="hist-score-naWAX">—</span>
                      )}
                    </div>

                    {/* Issues */}
                    <div className="hist-row-issuesWAX">
                      {audit.issueCount != null ? (
                        <span className={`hist-issues-chipWAX ${audit.issueCount > 5 ? 'highWAX' : audit.issueCount > 2 ? 'midWAX' : 'lowWAX'}`}>
                          {audit.issueCount} issue{audit.issueCount !== 1 ? 's' : ''}
                        </span>
                      ) : '—'}
                    </div>

                    {/* Date */}
                    <div className="hist-row-dateWAX">
                      <span title={new Date(audit.createdAt).toLocaleString()}>
                        {relativeTime(audit.createdAt)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="hist-row-actionsWAX">
                      {audit._id && (
                        <>
                          <button
                            className="hist-action-btnWAX"
                            onClick={() => navigate(`/${audit.module}/report/${audit._id}`)}
                            title="View report"
                          >
                            View
                          </button>
                          <button
                            className="hist-action-btnWAX ghost"
                            onClick={() => window.open(`${API}/${audit.module}/download/${audit._id}`, '_blank')}
                            title="Download PDF"
                          >
                            PDF
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="hist-paginationWAX">
                <button
                  className="hist-page-btnWAX"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ← Prev
                </button>
                <div className="hist-page-numsWAX">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                    .reduce((acc, n, idx, arr) => {
                      if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…');
                      acc.push(n);
                      return acc;
                    }, [])
                    .map((n, i) =>
                      n === '…'
                        ? <span key={`ellip-${i}`} className="hist-page-ellipWAX">…</span>
                        : <button
                            key={n}
                            className={`hist-page-numWAX ${page === n ? 'activeWAX' : ''}`}
                            onClick={() => setPage(n)}
                          >{n}</button>
                    )
                  }
                </div>
                <button
                  className="hist-page-btnWAX"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next →
                </button>
              </div>
            )}

            <div className="hist-count-noteWAX">
              Showing {Math.min(filtered.length, (page - 1) * PER_PAGE + paginated.length)} of {filtered.length} audits
            </div>
          </>
        )}
      </div>
    </div>
  );
}