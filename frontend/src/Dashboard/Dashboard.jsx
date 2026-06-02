import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Dashboard.css';

const API = 'http://localhost:5000/api';

const PLAN_COLOR = { free: '#64748b', pro: '#00b894', premium: '#3b82f6' };
const PLAN_LABEL = { free: 'Starter', pro: 'Pro', premium: 'Agency' };

const MODULE_META = {
  'ui-analysis':          { icon: '🎨', label: 'UI/UX',          color: '#00b894' },
  'mobile-friendliness':  { icon: '📱', label: 'Mobile',         color: '#3b82f6' },
  'accessibility':        { icon: '♿', label: 'Accessibility',   color: '#f59e0b' },
  'seo':                  { icon: '🔍', label: 'SEO',            color: '#ef4444' },
  'performance':          { icon: '⚡', label: 'Performance',     color: '#a855f7' },
  'security':             { icon: '🔐', label: 'Security',        color: '#00b894' },
  'content-quality':      { icon: '⭐', label: 'Content',         color: '#3b82f6' },
  'structure-navigation': { icon: '🗺️', label: 'Structure',       color: '#f59e0b' },
  'technical-insight':    { icon: '🔧', label: 'Technical',       color: '#ef4444' },
  'full-audit':           { icon: '🔬', label: 'Full Audit',      color: '#00b894' },
};

function scoreColor(s) {
  if (s == null) return '#94a3b8';
  if (s >= 80) return '#22c55e';
  if (s >= 60) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(s) {
  if (s == null) return 'N/A';
  if (s >= 80) return 'Good';
  if (s >= 60) return 'Fair';
  return 'Poor';
}

function relativeTime(d) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const token    = localStorage.getItem('wax_token');

  const [user,    setUser]    = useState(null);
  const [usage,   setUsage]   = useState(null);
  const [stats,   setStats]   = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { navigate('/auth'); return; }
    loadAll();
  }, []);

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

  async function loadAll() {
    setLoading(true);
    try {
      const [meRes, usageRes, statsRes, histRes] = await Promise.all([
        fetch(`${API}/auth/me`,              { headers: headers() }),
        fetch(`${API}/subscription/usage`,   { headers: headers() }),
        fetch(`${API}/audit-history/stats`,  { headers: headers() }),
        fetch(`${API}/audit-history?limit=5`,{ headers: headers() }),
      ]);

      const [meData, usageData, statsData, histData] = await Promise.all([
        meRes.json(), usageRes.json(), statsRes.json(), histRes.json(),
      ]);

      if (meData.success)    setUser(meData.data.user);
      if (usageData.success) setUsage(usageData.data);
      if (statsData.success) setStats(statsData.data);
      if (histData.success)  setHistory(histData.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="dash2-pageWAX">
        <div className="dash2-loadingWAX">
          <div className="dash2-spinnerWAX" />
          <p>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const plan       = user?.plan || 'free';
  const planColor  = PLAN_COLOR[plan];
  const planLabel  = PLAN_LABEL[plan];
  const usedPct    = usage && usage.limit !== 'unlimited'
    ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const initials   = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase();

  return (
    <div className="dash2-pageWAX">
      <div className="dash2-gridWAX" />
      <div className="dash2-orb1WAX" />

      {/* ── Nav ── */}
      <nav className="dash2-navWAX">
        <Link to="/" className="dash2-logoWAX">
          WebAudit<span>X</span>
          <span className="dash2-betaWAX">BETA</span>
        </Link>
        <div className="dash2-nav-rightWAX">
          <button className="dash2-nav-btnWAX secondary" onClick={() => navigate('/audit-history')}>📋 History</button>
          <button className="dash2-nav-btnWAX secondary" onClick={() => navigate('/profile')}>⚙ Profile</button>
          <button className="dash2-nav-btnWAX primary" onClick={() => navigate('/')}>+ New Audit</button>
        </div>
      </nav>

      <div className="dash2-layoutWAX">

        {/* ── Welcome bar ── */}
        <div className="dash2-welcomeWAX">
          <div className="dash2-welcome-leftWAX">
            <div className="dash2-avatarWAX">{initials}</div>
            <div>
              <div className="dash2-welcome-nameWAX">Welcome back, {user?.name || 'there'}</div>
              <div className="dash2-welcome-subWAX">{user?.email}</div>
            </div>
          </div>
          <div
            className="dash2-plan-chipWAX"
            style={{ background: `${planColor}15`, color: planColor, borderColor: `${planColor}30` }}
            onClick={() => navigate('/payment')}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: planColor, display: 'inline-block', marginRight: 6 }} />
            {planLabel} Plan
            {plan !== 'premium' && <span className="dash2-chip-upgradeWAX">Upgrade →</span>}
          </div>
        </div>

        {/* ── Top stats row ── */}
        <div className="dash2-stats-rowWAX">
          {[
            {
              label: 'Total Audits',
              value: stats?.total ?? 0,
              sub:   'all time',
              color: '#00b894',
              icon:  '🔬',
            },
            {
              label: 'This Month',
              value: usage?.used ?? 0,
              sub:   `of ${usage?.limit === 'unlimited' ? '∞' : (usage?.limit ?? '—')} limit`,
              color: planColor,
              icon:  '📅',
            },
            {
              label: 'Remaining',
              value: usage?.remaining === 'unlimited' ? '∞' : (usage?.remaining ?? '—'),
              sub:   'audits left',
              color: usage?.remaining === 0 ? '#ef4444' : '#22c55e',
              icon:  '⚡',
            },
            {
              label: 'Avg Score',
              value: stats?.avgScore != null ? stats.avgScore : '—',
              sub:   scoreLabel(stats?.avgScore),
              color: scoreColor(stats?.avgScore),
              icon:  '📊',
            },
          ].map((s, i) => (
            <div key={i} className="dash2-stat-cardWAX">
              <div className="dash2-stat-iconWAX">{s.icon}</div>
              <div className="dash2-stat-numWAX" style={{ color: s.color }}>{s.value}</div>
              <div className="dash2-stat-labelWAX">{s.label}</div>
              <div className="dash2-stat-subWAX">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Usage bar ── */}
        {usage && usage.limit !== 'unlimited' && (
          <div className="dash2-usage-cardWAX">
            <div className="dash2-usage-headWAX">
              <span className="dash2-usage-titleWAX">Monthly Audit Usage</span>
              <span className="dash2-usage-pctWAX">{usedPct}% used</span>
            </div>
            <div className="dash2-usage-trackWAX">
              <div
                className="dash2-usage-fillWAX"
                style={{
                  width: `${usedPct}%`,
                  background: usedPct > 85 ? '#ef4444' : usedPct > 60 ? '#f59e0b' : planColor,
                }}
              />
            </div>
            <div className="dash2-usage-footWAX">
              <span>{usage.used} used · {usage.remaining} remaining</span>
              {plan !== 'premium' && (
                <button className="dash2-upgrade-linkWAX" onClick={() => navigate('/payment')} style={{ color: planColor }}>
                  Upgrade for more →
                </button>
              )}
            </div>
          </div>
        )}

        <div className="dash2-bottom-gridWAX">

          {/* ── Module breakdown ── */}
          <div className="dash2-panelWAX">
            <div className="dash2-panel-headWAX">
              <h3>Modules Used</h3>
              <button className="dash2-panel-linkWAX" onClick={() => navigate('/audit-history')}>View all →</button>
            </div>
            {stats?.moduleBreakdown?.length ? (
              <div className="dash2-modules-listWAX">
                {stats.moduleBreakdown.slice(0, 8).map((m, i) => {
                  const meta   = MODULE_META[m._id] || { icon: '🔬', label: m._id, color: '#64748b' };
                  const maxCnt = stats.moduleBreakdown[0]?.count || 1;
                  const pct    = Math.round((m.count / maxCnt) * 100);
                  return (
                    <div key={i} className="dash2-module-rowWAX">
                      <div className="dash2-module-left-WAX">
                        <span className="dash2-module-iconWAX">{meta.icon}</span>
                        <span className="dash2-module-nameWAX">{meta.label}</span>
                      </div>
                      <div className="dash2-module-bar-wrapWAX">
                        <div className="dash2-module-barWAX">
                          <div className="dash2-module-bar-fillWAX" style={{ width: `${pct}%`, background: meta.color }} />
                        </div>
                        <span className="dash2-module-cntWAX">{m.count}</span>
                      </div>
                      {m.avgScore != null && (
                        <span className="dash2-module-scoreWAX" style={{ color: scoreColor(Math.round(m.avgScore)) }}>
                          {Math.round(m.avgScore)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="dash2-emptyWAX">No audits yet. Run your first audit from the home page.</div>
            )}
          </div>

          {/* ── Recent audits ── */}
          <div className="dash2-panelWAX">
            <div className="dash2-panel-headWAX">
              <h3>Recent Audits</h3>
              <button className="dash2-panel-linkWAX" onClick={() => navigate('/audit-history')}>View all →</button>
            </div>
            {history.length ? (
              <div className="dash2-recent-listWAX">
                {history.map((a, i) => {
                  const meta  = MODULE_META[a.module] || { icon: '🔬', label: a.module, color: '#00b894' };
                  const color = scoreColor(a.score);
                  return (
                    <div key={i} className="dash2-recent-rowWAX">
                      <div className="dash2-recent-iconWAX" style={{ background: `${meta.color}18` }}>
                        {meta.icon}
                      </div>
                      <div className="dash2-recent-infoWAX">
                        <div className="dash2-recent-urlWAX">
                          {a.url?.replace(/^https?:\/\//, '').slice(0, 36)}{a.url?.length > 46 ? '…' : ''}
                        </div>
                        <div className="dash2-recent-metaWAX">{meta.label} · {relativeTime(a.createdAt)}</div>
                      </div>
                      {a.score != null && (
                        <div
                          className="dash2-recent-scoreWAX"
                          style={{ color, background: `${color}15`, borderColor: `${color}30` }}
                        >
                          {a.score}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="dash2-emptyWAX">No recent audits. Run one from the home page.</div>
            )}
            <button className="dash2-new-audit-btnWAX" onClick={() => navigate('/')}>
              + Run New Audit
            </button>
          </div>

        </div>

        {/* ── Quick-launch modules ── */}
        <div className="dash2-panelWAX dash2-quick-panelWAX">
          <div className="dash2-panel-headWAX">
            <h3>Quick Launch</h3>
            <span className="dash2-panel-subWAX">Jump directly into a module</span>
          </div>
          <div className="dash2-quick-gridWAX">
            {Object.entries(MODULE_META).map(([id, meta]) => (
              <button
                key={id}
                className="dash2-quick-btnWAX"
                onClick={() => navigate(`/${id}`)}
                style={{ '--qc': meta.color }}
              >
                <span className="dash2-quick-iconWAX">{meta.icon}</span>
                <span className="dash2-quick-labelWAX">{meta.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}