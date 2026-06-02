import { useState, useEffect } from 'react';
import AdminLayout from '../AdminLayout';
import { getDashboardStats, getRevenueCharts } from '../services/adminApi';
import { PageError, PageSpinner } from '../components/PageError';

/* ── 3 tiers matching Home.jsx exactly ── */
const TIERS = [
  {
    id:      'premium',
    label:   'Agency',
    planKey: 'premium',
    price:   89,
    color:   '#a855f7',
    desc:    'Everything in Pro + client portals, custom integrations, priority support',
  },
  {
    id:      'pro',
    label:   'Professional',
    planKey: 'pro',
    price:   29,
    color:   '#00b894',
    desc:    'Unlimited audits, all 9 modules, AI summaries, scheduled monitoring',
  },
  {
    id:      'free',
    label:   'Starter',
    planKey: 'free',
    price:   0,
    color:   '#8b949e',
    desc:    '5 audits/mo, basic SEO & performance, PDF report export',
  },
];

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function MetricCard ({ label, value, sub, color, icon }) {
  return (
    <div className="adm-stat-card" style={{ '--adm-gradient': `linear-gradient(90deg,${color},transparent)` }}>
      <div className="adm-stat-icon">{icon}</div>
      <div className="adm-stat-value" style={{ color }}>{value}</div>
      <div className="adm-stat-label">{label}</div>
      {sub && <div className="adm-stat-change up">{sub}</div>}
    </div>
  );
}

export default function Revenue () {
  const [stats,   setStats]   = useState(null);
  const [charts,  setCharts]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getDashboardStats()
      .then(async (s) => {
        setStats(s.stats);
        try {
          const c = await getRevenueCharts();
          setCharts(c.charts);
        } catch (_) {
          // Charts optional — won't block the page
        }
      })
      .catch(e => setError(e))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <AdminLayout title="Revenue & MRR"><PageSpinner /></AdminLayout>;
  if (error)   return <AdminLayout title="Revenue & MRR"><PageError error={error} onRetry={load} /></AdminLayout>;

  const { users, revenue } = stats;
  const subs      = users.subscriptions || {};
  const totalMrr  = revenue.mrr;
  const totalArr  = revenue.arr;
  const paidUsers = users.paid;

  /* Build per-tier numbers */
  const tierData = TIERS.map(t => {
    const count = subs[t.id] || 0;
    const mrr   = count * t.price;
    const pct   = totalMrr > 0 ? Math.round((mrr / totalMrr) * 100) : 0;
    const uPct  = users.total > 0 ? Math.round((count / users.total) * 100) : 0;
    return { ...t, count, mrr, pct, uPct };
  });

  const growthData = charts?.userGrowth || [];
  const maxGrowth  = Math.max(...growthData.map(d => d.newUsers), 1);

  return (
    <AdminLayout title="Revenue & MRR">

      {/* ── Top KPIs ── */}
      <div className="adm-stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <MetricCard icon="💰" label="Monthly Recurring Revenue"
          value={`$${totalMrr.toLocaleString()}`}
          sub={`$${totalArr.toLocaleString()} ARR`} color="#00b894" />
        <MetricCard icon="📈" label="Annual Run Rate"
          value={`$${totalArr.toLocaleString()}`} color="#3b82f6" />
        <MetricCard icon="👥" label="Paying Users"
          value={paidUsers.toLocaleString()}
          sub={`${users.total} total users`} color="#a855f7" />
        <MetricCard icon="💳" label="Avg Revenue / Paying User"
          value={`$${revenue.avgRevenuePerUser}`}
          sub="per month" color="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>

        {/* ── Per-plan MRR bars ── */}
        <div className="adm-panel">
          <div className="adm-panel-header">
            <span className="adm-panel-title">Revenue by Plan</span>
            <span style={{
              fontFamily: 'Space Mono,monospace',
              fontSize: '0.7rem',
              color: 'var(--adm-accent)',
            }}>
              ${totalMrr.toLocaleString()} MRR total
            </span>
          </div>
          <div className="adm-panel-body">
            {tierData.map(t => (
              <div key={t.id} style={{ marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      background: `${t.color}20`,
                      color: t.color,
                      fontFamily: 'Space Mono,monospace',
                      fontSize: '0.62rem',
                      padding: '2px 10px',
                      borderRadius: '100px',
                      fontWeight: 700,
                    }}>
                      {t.label.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--adm-text2)' }}>
                      {t.count} users × ${t.price}/mo
                    </span>
                  </div>
                  <span style={{
                    fontFamily: 'Space Mono,monospace',
                    fontWeight: 700,
                    color: t.price > 0 ? t.color : 'var(--adm-text3)',
                  }}>
                    {t.price > 0 ? `$${t.mrr.toLocaleString()}` : '$0'}
                  </span>
                </div>
                <div style={{ height: '6px', background: 'var(--adm-border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${t.pct}%`,
                    background: t.color,
                    borderRadius: '3px',
                    transition: 'width 1s ease',
                  }} />
                </div>
                <div style={{
                  marginTop: '5px',
                  fontSize: '0.68rem',
                  color: 'var(--adm-text3)',
                  fontFamily: 'Space Mono,monospace',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <span>{t.uPct}% of all users</span>
                  {t.price > 0 && <span style={{ color: t.color }}>{t.pct}% of MRR</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── User growth chart ── */}
        <div className="adm-panel">
          <div className="adm-panel-header">
            <span className="adm-panel-title">User Growth — Last 12 Months</span>
          </div>
          <div className="adm-panel-body">
            {growthData.length === 0 ? (
              <div className="adm-empty">
                <div className="adm-empty-icon">📊</div>
                <div className="adm-empty-text">
                  {charts === null
                    ? 'No growth data available yet.'
                    : 'Run some audits to start seeing user growth.'}
                </div>
              </div>
            ) : (
              <div className="adm-bar-chart" style={{ height: '140px' }}>
                {growthData.map((d, i) => {
                  const h     = Math.round((d.newUsers / maxGrowth) * 120);
                  const month = `${MONTHS_SHORT[d._id.month - 1]} '${String(d._id.year).slice(2)}`;
                  return (
                    <div key={i} className="adm-bar-col" title={`${month}: ${d.newUsers} new users`}>
                      <div style={{
                        fontFamily: 'Space Mono,monospace',
                        fontSize: '0.56rem',
                        color: 'var(--adm-text2)',
                        marginBottom: '4px',
                      }}>
                        {d.newUsers}
                      </div>
                      <div className="adm-bar-fill" style={{ height: `${Math.max(h, 4)}px` }} />
                      <div className="adm-bar-label">{month}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Full summary table ── */}
      <div className="adm-panel">
        <div className="adm-panel-header">
          <span className="adm-panel-title">Plan Summary</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--adm-text2)' }}>
            Matching your 3 pricing plans from the homepage
          </span>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Homepage Label</th>
                <th>Price</th>
                <th>Users</th>
                <th>% of Users</th>
                <th>MRR</th>
                <th>% of MRR</th>
                <th>ARR</th>
              </tr>
            </thead>
            <tbody>
              {tierData.map(t => (
                <tr key={t.id}>
                  <td>
                    <span style={{ color: t.color, fontWeight: 700, fontFamily: 'Space Mono,monospace', fontSize: '0.78rem' }}>
                      {t.id.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ color: 'var(--adm-text2)', fontSize: '0.85rem' }}>
                    {t.label}
                    {t.id === 'free' && <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: 'var(--adm-text3)' }}>(Starter tier)</span>}
                  </td>
                  <td style={{ fontFamily: 'Space Mono,monospace', fontSize: '0.8rem' }}>
                    {t.price > 0 ? `$${t.price}/mo` : 'Free'}
                  </td>
                  <td style={{ fontFamily: 'Space Mono,monospace', fontSize: '0.8rem' }}>
                    {t.count.toLocaleString()}
                  </td>
                  <td style={{ fontFamily: 'Space Mono,monospace', fontSize: '0.8rem', color: 'var(--adm-text2)' }}>
                    {t.uPct}%
                  </td>
                  <td style={{ fontFamily: 'Space Mono,monospace', fontWeight: 700, color: t.price > 0 ? t.color : 'var(--adm-text3)' }}>
                    {t.price > 0 ? `$${t.mrr.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ fontFamily: 'Space Mono,monospace', fontSize: '0.8rem', color: 'var(--adm-text2)' }}>
                    {t.pct > 0 ? `${t.pct}%` : '—'}
                  </td>
                  <td style={{ fontFamily: 'Space Mono,monospace', fontWeight: 700, color: 'var(--adm-accent)' }}>
                    {t.price > 0 ? `$${(t.mrr * 12).toLocaleString()}` : '—'}
                  </td>
                </tr>
              ))}

              {/* Totals row */}
              <tr style={{ background: 'rgba(0,184,148,0.04)', borderTop: '2px solid var(--adm-border2)' }}>
                <td colSpan={2} style={{ fontWeight: 700 }}>Total</td>
                <td style={{ fontFamily: 'Space Mono,monospace', fontSize: '0.8rem', color: 'var(--adm-text2)' }}>—</td>
                <td style={{ fontFamily: 'Space Mono,monospace', fontWeight: 700 }}>{users.total.toLocaleString()}</td>
                <td style={{ fontFamily: 'Space Mono,monospace', fontWeight: 700 }}>100%</td>
                <td style={{ fontFamily: 'Space Mono,monospace', fontWeight: 700, color: 'var(--adm-accent)' }}>
                  ${totalMrr.toLocaleString()}
                </td>
                <td style={{ fontFamily: 'Space Mono,monospace', fontWeight: 700 }}>100%</td>
                <td style={{ fontFamily: 'Space Mono,monospace', fontWeight: 700, color: 'var(--adm-accent)' }}>
                  ${totalArr.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}