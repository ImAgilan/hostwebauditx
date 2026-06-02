import { useState, useEffect } from 'react';
import AdminLayout from '../AdminLayout';
import { getDashboardStats } from '../services/adminApi';
import { PageError, PageSpinner } from '../components/PageError';

/* ── 3 tiers matching Home.jsx exactly ── */
const TIERS = [
  { id: 'free',    label: 'Starter',      price: 0,  color: '#8b949e' },
  { id: 'pro',     label: 'Professional', price: 29, color: '#00b894' },
  { id: 'premium', label: 'Agency',       price: 89, color: '#a855f7' },
];

function StatCard ({ icon, label, value, change, color, gradient }) {
  return (
    <div className="adm-stat-card" style={{ '--adm-gradient': gradient }}>
      <div className="adm-stat-icon">{icon}</div>
      <div className="adm-stat-value" style={{ color }}>{value}</div>
      <div className="adm-stat-label">{label}</div>
      {change && <div className="adm-stat-change up">{change}</div>}
    </div>
  );
}

export default function Dashboard () {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getDashboardStats()
      .then(r => setStats(r.stats))
      .catch(e => setError(e))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <AdminLayout title="Dashboard"><PageSpinner /></AdminLayout>;
  if (error)   return <AdminLayout title="Dashboard"><PageError error={error} onRetry={load} /></AdminLayout>;

  const { users, audits, revenue, admins } = stats;

  const months  = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
  const heights = [40, 55, 48, 72, 88, 96];

  return (
    <AdminLayout title="Dashboard Overview">

      {/* ── KPI Cards ── */}
      <div className="adm-stats-grid">
        <StatCard icon="👥" label="Total Users"           value={users.total.toLocaleString()}
          change={`+${users.newThisMonth} this month`}
          color="var(--adm-text)"
          gradient="linear-gradient(90deg,var(--adm-accent),transparent)" />
        <StatCard icon="🔍" label="Total Audits"          value={audits.total.toLocaleString()}
          change={`+${audits.today} today`}
          color="var(--adm-blue)"
          gradient="linear-gradient(90deg,var(--adm-blue),transparent)" />
        <StatCard icon="💰" label="Monthly Revenue (MRR)" value={`$${revenue.mrr.toLocaleString()}`}
          change={`$${revenue.arr.toLocaleString()} / yr projected`}
          color="var(--adm-accent)"
          gradient="linear-gradient(90deg,#f59e0b,transparent)" />
        <StatCard icon="📈" label="Paying Users"          value={users.paid.toLocaleString()}
          change={users.paid > 0 ? `Avg $${revenue.avgRevenuePerUser}/user` : '0 paying users yet'}
          color="var(--adm-purple)"
          gradient="linear-gradient(90deg,var(--adm-purple),transparent)" />
        <StatCard icon="🛡️" label="Admin Accounts"        value={admins.total}
          change={`${admins.active} active`}
          color="var(--adm-amber)"
          gradient="linear-gradient(90deg,var(--adm-amber),transparent)" />
        <StatCard icon="🚫" label="Banned Users"          value={users.banned}
          color="var(--adm-red)"
          gradient="linear-gradient(90deg,var(--adm-red),transparent)" />
        <StatCard icon="📅" label="New Users Today"       value={users.newToday}
          change={`+${users.newThisWeek} this week`}
          color="var(--adm-text)"
          gradient="linear-gradient(90deg,var(--adm-accent),transparent)" />
        <StatCard icon="⚡" label="Audits This Week"      value={audits.thisWeek}
          change={`${audits.thisMonth} this month`}
          color="var(--adm-blue)"
          gradient="linear-gradient(90deg,var(--adm-blue),transparent)" />
      </div>

      {/* ── Subscription Breakdown — 3 packages ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          fontFamily: 'Space Mono,monospace',
          fontSize: '0.68rem',
          color: 'var(--adm-text2)',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          marginBottom: '14px',
        }}>
          SUBSCRIPTION PLANS
        </div>

        {/* 3-column grid — one card per plan */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
          {TIERS.map(tier => {
            const count   = users.subscriptions?.[tier.id] || 0;
            const pct     = users.total > 0 ? Math.round((count / users.total) * 100) : 0;
            const monthly = count * tier.price;

            return (
              <div key={tier.id} className="adm-sub-card">
                {/* Plan name + price */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div className="adm-sub-tier" style={{ color: tier.color, marginBottom: 0 }}>
                    {tier.label.toUpperCase()}
                  </div>
                  <span style={{
                    fontFamily: 'Space Mono,monospace',
                    fontSize: '0.65rem',
                    color: tier.price > 0 ? tier.color : 'var(--adm-text3)',
                  }}>
                    {tier.price > 0 ? `$${tier.price}/mo` : 'FREE'}
                  </span>
                </div>

                {/* User count */}
                <div className="adm-sub-count" style={{ color: tier.color }}>
                  {count.toLocaleString()}
                </div>

                {/* Stats row */}
                <div className="adm-sub-label">
                  {pct}% of users
                  {tier.price > 0 && (
                    <span style={{ color: tier.color, marginLeft: '8px' }}>
                      · ${monthly.toLocaleString()} MRR
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="adm-sub-bar">
                  <div
                    className="adm-sub-bar-fill"
                    style={{ width: `${pct}%`, background: tier.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom Panels ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Activity chart */}
        <div className="adm-panel">
          <div className="adm-panel-header">
            <span className="adm-panel-title">Audit Activity — 6 Months</span>
            <span className="adm-badge adm-badge-active">LIVE</span>
          </div>
          <div className="adm-panel-body">
            <div className="adm-bar-chart">
              {months.map((m, i) => (
                <div key={m} className="adm-bar-col">
                  <div
                    className={`adm-bar-fill ${i % 2 === 1 ? 'alt' : ''}`}
                    style={{ height: `${heights[i]}px` }}
                  />
                  <div className="adm-bar-label">{m}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Platform metrics */}
        <div className="adm-panel">
          <div className="adm-panel-header">
            <span className="adm-panel-title">Platform Metrics</span>
          </div>
          <div className="adm-panel-body">
            {[
              { label: 'Annual Revenue Run Rate',  value: `$${revenue.arr.toLocaleString()}`          },
              { label: 'Avg Revenue Per User',     value: `$${revenue.avgRevenuePerUser}/mo`           },
              { label: 'Audits / Day (avg)',        value: Math.round(audits.thisMonth / 30)            },
              { label: 'Active Users',             value: users.active.toLocaleString()                },
              { label: 'Admins (Super Admins)',    value: `${admins.total} (${admins.superAdmins})`    },
              { label: 'New Users This Week',      value: `+${users.newThisWeek}`                      },
              { label: 'Pro subscribers',          value: (users.subscriptions?.pro     || 0)           },
              { label: 'Agency subscribers',       value: (users.subscriptions?.premium || 0)           },
            ].map(({ label, value }) => (
              <div key={label} className="adm-recent-item">
                <span style={{ color: 'var(--adm-text2)', fontSize: '0.83rem' }}>{label}</span>
                <span style={{
                  fontFamily: 'Space Mono,monospace',
                  fontSize: '0.8rem',
                  color: 'var(--adm-accent)',
                }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}