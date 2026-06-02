import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../AdminLayout';
import { listAdmins, createAdmin, updateAdmin, resetAdminPassword, deleteAdmin } from '../services/adminApi';

function CreateAdminModal ({ onClose, onCreate }) {
  const [form, setForm] = useState({
    username: '', email: '', password: '', fullName: '', role: 'admin',
    permissions: {
      viewUsers: true, editUsers: false, deleteUsers: false,
      viewAudits: true, deleteAudits: false, viewRevenue: false,
    },
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const togglePerm = (perm) =>
    setForm(f => ({ ...f, permissions: { ...f.permissions, [perm]: !f.permissions[perm] } }));

  const handleCreate = async () => {
    if (!form.username || !form.email || !form.password) {
      return setError('Username, email, and password are required');
    }
    setSaving(true);
    setError('');
    try {
      await onCreate(form);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const PERMS = [
    { key: 'viewUsers',   label: 'View Users'    },
    { key: 'editUsers',   label: 'Edit Users'    },
    { key: 'deleteUsers', label: 'Delete Users'  },
    { key: 'viewAudits',  label: 'View Audits'   },
    { key: 'deleteAudits',label: 'Delete Audits' },
    { key: 'viewRevenue', label: 'View Revenue'  },
  ];

  return (
    <div className="adm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal" style={{ maxWidth: '520px' }}>
        <div className="adm-modal-title">
          Create Admin Account
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', color: 'var(--adm-red)', fontSize: '0.83rem', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div className="adm-form-row">
          <div className="adm-form-group">
            <label className="adm-label">Full Name</label>
            <input className="adm-input" placeholder="Jane Doe"
              value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
          </div>
          <div className="adm-form-group">
            <label className="adm-label">Username</label>
            <input className="adm-input" placeholder="janedoe"
              value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </div>
        </div>

        <div className="adm-form-group">
          <label className="adm-label">Email</label>
          <input className="adm-input" type="email" placeholder="jane@webauditx.com"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>

        <div className="adm-form-row">
          <div className="adm-form-group">
            <label className="adm-label">Password</label>
            <input className="adm-input" type="password" placeholder="••••••••"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="adm-form-group">
            <label className="adm-label">Role</label>
            <select className="adm-select" style={{ width: '100%' }}
              value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>

        {form.role === 'admin' && (
          <div className="adm-form-group">
            <label className="adm-label" style={{ marginBottom: '12px' }}>Permissions</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {PERMS.map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.83rem' }}>
                  <input type="checkbox" checked={form.permissions[key]} onChange={() => togglePerm(key)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="adm-form-actions">
          <button className="adm-btn adm-btn-outline" onClick={onClose}>Cancel</button>
          <button className="adm-btn adm-btn-accent" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : '+ Create Admin'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPassModal ({ admin: a, onClose, onReset }) {
  const [pw,      setPw]      = useState('');
  const [saving,  setSaving]  = useState(false);

  const handle = async () => {
    if (pw.length < 8) return alert('Password must be at least 8 characters');
    setSaving(true);
    try { await onReset(a._id, pw); onClose(); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="adm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal">
        <div className="adm-modal-title">
          Reset Password — {a.username}
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="adm-form-group">
          <label className="adm-label">New Password</label>
          <input className="adm-input" type="password" placeholder="Min 8 characters"
            value={pw} onChange={e => setPw(e.target.value)} />
        </div>
        <div className="adm-form-actions">
          <button className="adm-btn adm-btn-outline" onClick={onClose}>Cancel</button>
          <button className="adm-btn adm-btn-accent" onClick={handle} disabled={saving}>
            {saving ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Admins () {
  const [data,    setData]    = useState({ admins: [], pagination: {} });
  const [loading, setLoading] = useState(true);
  const [params,  setParams]  = useState({ page: 1, limit: 20, search: '', role: 'all' });
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);

  const myData = JSON.parse(localStorage.getItem('adminData') || '{}');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAdmins(params);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  const setParam = (key, val) => setParams(p => ({ ...p, [key]: val, page: 1 }));

  const handleCreate = async (body) => {
    await createAdmin(body);
    load();
  };

  const toggleActive = async (a) => {
    await updateAdmin(a._id, { isActive: !a.isActive });
    load();
  };

  const handleDelete = async (a) => {
    if (!confirm(`Delete admin account "${a.username}"?`)) return;
    await deleteAdmin(a._id);
    load();
  };

  const handleReset = async (id, pw) => {
    await resetAdminPassword(id, pw);
  };

  const { admins, pagination } = data;

  return (
    <AdminLayout title="Admin Accounts">
      <div className="adm-filters">
        <input className="adm-search" placeholder="🔍  Search admins..."
          value={params.search} onChange={e => setParam('search', e.target.value)} />
        <select className="adm-select" value={params.role} onChange={e => setParam('role', e.target.value)}>
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
        <button className="adm-btn adm-btn-accent" style={{ marginLeft: 'auto' }}
          onClick={() => setShowCreate(true)}>
          + New Admin
        </button>
      </div>

      <div className="adm-panel">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Created By</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="adm-loading-overlay"><div className="adm-spinner" /></div></td></tr>
              ) : admins.length === 0 ? (
                <tr><td colSpan={7}><div className="adm-empty"><div className="adm-empty-icon">🛡️</div><div className="adm-empty-text">No admins found</div></div></td></tr>
              ) : (
                admins.map(a => {
                  const isSelf = a._id === myData._id;
                  return (
                    <tr key={a._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="adm-avatar" style={{ width: 30, height: 30, fontSize: '0.75rem' }}>
                            {(a.fullName || a.username).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>
                              {a.fullName || a.username}
                              {isSelf && <span style={{ color: 'var(--adm-accent)', fontSize: '0.7rem', marginLeft: '6px' }}>(you)</span>}
                            </div>
                            <div className="adm-table-email">{a.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`adm-badge ${a.role === 'super_admin' ? 'adm-badge-super' : 'adm-badge-admin'}`}>
                          {a.role === 'super_admin' ? '◆ SUPER' : '■ ADMIN'}
                        </span>
                      </td>
                      <td>
                        <span className={`adm-badge ${a.isActive ? 'adm-badge-active' : 'adm-badge-inactive'}`}>
                          {a.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: 'var(--adm-text2)' }}>
                        {a.lastLogin ? new Date(a.lastLogin).toLocaleString() : 'Never'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--adm-text2)' }}>
                        {a.createdBy?.username || '—'}
                      </td>
                      <td style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: 'var(--adm-text2)' }}>
                        {new Date(a.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="adm-btn adm-btn-outline adm-btn-sm"
                            onClick={() => setResetTarget(a)}>🔑 Reset</button>
                          {!isSelf && (
                            <>
                              <button
                                className={`adm-btn adm-btn-sm ${a.isActive ? 'adm-btn-danger' : 'adm-btn-success'}`}
                                onClick={() => toggleActive(a)}>
                                {a.isActive ? 'Disable' : 'Enable'}
                              </button>
                              <button className="adm-btn adm-btn-danger adm-btn-sm"
                                onClick={() => handleDelete(a)}>✕</button>
                            </>
                          )}
                        </div>
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
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.72rem', color: 'var(--adm-text2)' }}>
              {params.page} / {pagination.pages}
            </span>
            <button className="adm-page-btn" disabled={params.page >= pagination.pages}
              onClick={() => setParam('page', params.page + 1)}>Next →</button>
          </div>
        )}
      </div>

      {showCreate  && <CreateAdminModal onClose={() => setShowCreate(false)}   onCreate={handleCreate} />}
      {resetTarget && <ResetPassModal admin={resetTarget} onClose={() => setResetTarget(null)} onReset={handleReset} />}
    </AdminLayout>
  );
}