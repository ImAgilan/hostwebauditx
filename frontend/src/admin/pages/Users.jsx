import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../AdminLayout';
import { listUsers, updateUser, banUser, unbanUser, deleteUser } from '../services/adminApi';
import { PageError, PageSpinner } from '../components/PageError';

/* ── Plan badges match your 3 plans ── */
const PLAN_BADGE = {
  free:    'adm-badge-free',
  pro:     'adm-badge-pro',
  premium: 'adm-badge-ultra',   // purple for Agency/premium
};

const PLAN_LABEL = {
  free:    'Starter — $0',
  pro:     'Professional — $29',
  premium: 'Agency — $89',
};

const PLAN_PRICE = {
  free:    '$0/mo',
  pro:     '$29/mo',
  premium: '$89/mo',
};

/* ── Edit Modal ── */
function EditModal ({ user, onClose, onSave }) {
  const [form,   setForm]   = useState({
    name:         user.name || '',
    subscription: user.plan || user.subscription || 'free',
    isActive:     user.isActive,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try { await onSave(user._id, form); onClose(); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="adm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal">
        <div className="adm-modal-title">
          Edit User
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', color: 'var(--adm-red)', fontSize: '0.83rem', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div className="adm-form-group">
          <label className="adm-label">Full Name</label>
          <input className="adm-input" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="adm-form-group">
          <label className="adm-label">Email (read-only)</label>
          <input className="adm-input" value={user.email} disabled style={{ opacity: 0.5 }} />
        </div>

        <div className="adm-form-group">
          <label className="adm-label">Plan</label>
          <select
            className="adm-select"
            style={{ width: '100%' }}
            value={form.subscription}
            onChange={e => setForm(f => ({ ...f, subscription: e.target.value }))}
          >
            <option value="free">Starter — Free ($0/mo)</option>
            <option value="pro">Professional ($29/mo)</option>
            <option value="premium">Agency ($89/mo)</option>
          </select>
        </div>

        <div className="adm-form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            id="isActiveEdit"
            checked={form.isActive}
            onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
          />
          <label htmlFor="isActiveEdit" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
            Account Active
          </label>
        </div>

        <div className="adm-form-actions">
          <button className="adm-btn adm-btn-outline" onClick={onClose}>Cancel</button>
          <button className="adm-btn adm-btn-accent" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Disable Modal (replaces Ban — no isBanned in real model) ── */
function DisableModal ({ user, onClose, onDisable }) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try { await onDisable(user._id); onClose(); }
    catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="adm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal">
        <div className="adm-modal-title">
          Disable Account
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--adm-text2)', marginBottom: '24px', lineHeight: 1.6 }}>
          You are about to <strong style={{ color: 'var(--adm-red)' }}>disable</strong> the account for{' '}
          <strong style={{ color: 'var(--adm-text)' }}>{user.email}</strong>.
          <br /><br />
          They will not be able to log in until re-enabled.
        </p>
        <div className="adm-form-actions">
          <button className="adm-btn adm-btn-outline" onClick={onClose}>Cancel</button>
          <button className="adm-btn adm-btn-danger" onClick={handle} disabled={loading}>
            {loading ? 'Disabling...' : '⚠ Confirm Disable'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function Users () {
  const [data,          setData]          = useState({ users: [], pagination: {} });
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [params,        setParams]        = useState({
    page: 1, limit: 20, search: '', subscription: 'all', status: 'all',
  });
  const [editUser,      setEditUser]      = useState(null);
  const [disableTarget, setDisableTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listUsers(params)
      .then(res => setData(res))
      .catch(e  => setError(e))
      .finally(()  => setLoading(false));
  }, [params]);

  useEffect(load, [load]);

  const handleUpdate  = async (id, updates) => { await updateUser(id, updates); load(); };
  const handleDisable = async (id)           => { await banUser(id, '');         load(); };
  const handleEnable  = async (id) => {
    if (!confirm('Re-enable this account?')) return;
    await unbanUser(id); load();
  };
  const handleDelete  = async (id, email) => {
    if (!confirm(`Permanently delete ${email}? This cannot be undone.`)) return;
    await deleteUser(id); load();
  };

  const setParam = (key, val) => setParams(p => ({ ...p, [key]: val, page: 1 }));

  const { users, pagination } = data;

  if (error && !loading) return (
    <AdminLayout title="User Management">
      <PageError error={error} onRetry={load} />
    </AdminLayout>
  );

  return (
    <AdminLayout title="User Management">

      {/* ── Filters ── */}
      <div className="adm-filters">
        <input
          className="adm-search"
          placeholder="🔍  Search by name or email..."
          value={params.search}
          onChange={e => setParam('search', e.target.value)}
        />

        <select className="adm-select" value={params.subscription}
          onChange={e => setParam('subscription', e.target.value)}>
          <option value="all">All Plans</option>
          <option value="free">Starter (Free)</option>
          <option value="pro">Professional ($29)</option>
          <option value="premium">Agency ($89)</option>
        </select>

        <select className="adm-select" value={params.status}
          onChange={e => setParam('status', e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Disabled</option>
        </select>

        <span style={{
          marginLeft: 'auto',
          fontFamily: 'Space Mono,monospace',
          fontSize: '0.72rem',
          color: 'var(--adm-text2)',
        }}>
          {pagination.total || 0} users
        </span>
      </div>

      {/* ── Table ── */}
      <div className="adm-panel">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Audits This Month</th>
                <th>Monthly Value</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><PageSpinner /></td></tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="adm-empty">
                      <div className="adm-empty-icon">👥</div>
                      <div className="adm-empty-text">No users found matching your filters.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map(u => {
                  const plan     = u.plan || u.subscription || 'free';
                  const isActive = u.isActive !== false; // default true

                  return (
                    <tr key={u._id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{u.name || '—'}</div>
                        <div className="adm-table-email">{u.email}</div>
                      </td>

                      <td>
                        <span className={`adm-badge ${PLAN_BADGE[plan] || 'adm-badge-free'}`}>
                          {plan.toUpperCase()}
                        </span>
                      </td>

                      <td style={{
                        fontFamily: 'Space Mono,monospace',
                        fontSize: '0.8rem',
                        color: 'var(--adm-text2)',
                      }}>
                        {u.auditCountThisMonth ?? 0}
                      </td>

                      <td style={{
                        fontFamily: 'Space Mono,monospace',
                        fontSize: '0.8rem',
                        color: 'var(--adm-accent)',
                      }}>
                        {PLAN_PRICE[plan] || '$0/mo'}
                      </td>

                      <td>
                        <span className={`adm-badge ${isActive ? 'adm-badge-active' : 'adm-badge-banned'}`}>
                          {isActive ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </td>

                      <td style={{
                        fontFamily: 'Space Mono,monospace',
                        fontSize: '0.7rem',
                        color: 'var(--adm-text2)',
                      }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="adm-btn adm-btn-outline adm-btn-sm"
                            onClick={() => setEditUser(u)}
                          >
                            Edit
                          </button>

                          {isActive ? (
                            <button
                              className="adm-btn adm-btn-danger adm-btn-sm"
                              onClick={() => setDisableTarget(u)}
                            >
                              Disable
                            </button>
                          ) : (
                            <button
                              className="adm-btn adm-btn-success adm-btn-sm"
                              onClick={() => handleEnable(u._id)}
                            >
                              Enable
                            </button>
                          )}

                          <button
                            className="adm-btn adm-btn-danger adm-btn-sm"
                            onClick={() => handleDelete(u._id, u.email)}
                            title="Permanently delete"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="adm-pagination">
            <button
              className="adm-page-btn"
              disabled={params.page <= 1}
              onClick={() => setParam('page', params.page - 1)}
            >
              ← Prev
            </button>

            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className={`adm-page-btn ${params.page === p ? 'active' : ''}`}
                onClick={() => setParam('page', p)}
              >
                {p}
              </button>
            ))}

            <button
              className="adm-page-btn"
              disabled={params.page >= pagination.pages}
              onClick={() => setParam('page', params.page + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {editUser      && (
        <EditModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSave={handleUpdate}
        />
      )}
      {disableTarget && (
        <DisableModal
          user={disableTarget}
          onClose={() => setDisableTarget(null)}
          onDisable={handleDisable}
        />
      )}
    </AdminLayout>
  );
}