import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../AdminLayout';
import { getAuditHistory } from '../services/adminApi';
import { PageError, PageSpinner } from '../components/PageError';

const MODULE_LABELS = {
  uianalyses:           { label: 'UI/UX',        icon: '🎨', color: '#00b894' },
  mobilefriendlinesses: { label: 'Mobile',        icon: '📱', color: '#3b82f6' },
  accessibilities:      { label: 'Accessibility', icon: '♿', color: '#f59e0b' },
  seoanalyses:          { label: 'SEO',           icon: '🔍', color: '#ef4444' },
  performanceanalyses:  { label: 'Performance',   icon: '⚡', color: '#a855f7' },
  securityanalyses:     { label: 'Security',      icon: '🔐', color: '#00b894' },
  contentqualities:     { label: 'Content',       icon: '⭐', color: '#3b82f6' },
  structurenavigations: { label: 'Structure',     icon: '🗺️', color: '#f59e0b' },
  fullaudits:           { label: 'Full Audit',    icon: '🔄', color: '#a855f7' },
};

function scoreColor (s) {
  if (s == null) return 'var(--adm-text2)';
  if (s >= 80)   return '#00b894';
  if (s >= 60)   return '#f59e0b';
  return '#ef4444';
}

export default function Audits () {
  const [data,    setData]    = useState({ audits: [], pagination: {} });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [params,  setParams]  = useState({
    page: 1, limit: 25, module: 'all', search: '', dateFrom: '', dateTo: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getAuditHistory(params)
      .then(res => setData(res))
      .catch(e  => setError(e))
      .finally(()  => setLoading(false));
  }, [params]);

  useEffect(load, [load]);

  const setParam = (key, val) => setParams(p => ({ ...p, [key]: val, page: 1 }));

  if (error && !loading) return (
    <AdminLayout title="Audit History">
      <PageError error={error} onRetry={load} />
    </AdminLayout>
  );

  const { audits, pagination } = data;

  return (
    <AdminLayout title="Audit History">
      <div className="adm-filters">
        <input className="adm-search" placeholder="🔍  Filter by URL..."
          value={params.search} onChange={e => setParam('search', e.target.value)} />
        <select className="adm-select" value={params.module} onChange={e => setParam('module', e.target.value)}>
          <option value="all">All Modules</option>
          <option value="ui">UI/UX</option>
          <option value="mobile">Mobile</option>
          <option value="accessibility">Accessibility</option>
          <option value="seo">SEO</option>
          <option value="performance">Performance</option>
          <option value="security">Security</option>
          <option value="content">Content</option>
          <option value="structure">Structure</option>
          <option value="full">Full Audit</option>
        </select>
        <input type="date" className="adm-select"
          value={params.dateFrom} onChange={e => setParam('dateFrom', e.target.value)} />
        <input type="date" className="adm-select"
          value={params.dateTo}   onChange={e => setParam('dateTo', e.target.value)} />
        <span style={{ marginLeft: 'auto', fontFamily: 'Space Mono,monospace', fontSize: '0.72rem', color: 'var(--adm-text2)' }}>
          {pagination.total || 0} audits
        </span>
      </div>

      <div className="adm-panel">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>URL</th><th>Module</th><th>Score</th>
                <th>Issues</th><th>Status</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><PageSpinner /></td></tr>
              ) : audits.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="adm-empty">
                      <div className="adm-empty-icon">🔍</div>
                      <div className="adm-empty-text">No audits found. Run some audits first!</div>
                    </div>
                  </td>
                </tr>
              ) : (
                audits.map((a, i) => {
                  const mod    = MODULE_LABELS[a._module] || { label: a._module, icon: '📋', color: 'var(--adm-text2)' };
                  const score  = a.overallScore ?? a.score ?? a.totalScore ?? null;
                  const issues = a.issues?.length ?? a.issueCount ?? a.totalIssues ?? '—';

                  return (
                    <tr key={`${a._id}-${i}`}>
                      <td>
                        <div className="adm-recent-url" title={a.url}>{a.url}</div>
                      </td>
                      <td>
                        <span style={{
                          fontFamily: 'Space Mono,monospace', fontSize: '0.7rem',
                          color: mod.color, background: `${mod.color}15`,
                          padding: '3px 8px', borderRadius: '100px',
                        }}>
                          {mod.icon} {mod.label}
                        </span>
                      </td>
                      <td>
                        {score != null
                          ? <span style={{ fontFamily: 'Space Mono,monospace', fontWeight: 700, color: scoreColor(score) }}>{Math.round(score)}/100</span>
                          : <span style={{ color: 'var(--adm-text3)' }}>—</span>
                        }
                      </td>
                      <td style={{ fontFamily: 'Space Mono,monospace', fontSize: '0.8rem', color: 'var(--adm-amber)' }}>
                        {issues}
                      </td>
                      <td>
                        <span className={`adm-badge ${
                          a.status === 'failed' ? 'adm-badge-banned'
                          : a.status === 'pending' ? 'adm-badge-inactive'
                          : 'adm-badge-active'
                        }`}>
                          {(a.status || 'completed').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'Space Mono,monospace', fontSize: '0.68rem', color: 'var(--adm-text2)' }}>
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="adm-pagination">
            <button className="adm-page-btn" disabled={params.page <= 1}
              onClick={() => setParam('page', params.page - 1)}>← Prev</button>
            <span style={{ fontFamily: 'Space Mono,monospace', fontSize: '0.72rem', color: 'var(--adm-text2)' }}>
              Page {params.page} of {pagination.pages}
            </span>
            <button className="adm-page-btn" disabled={params.page >= pagination.pages}
              onClick={() => setParam('page', params.page + 1)}>Next →</button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}