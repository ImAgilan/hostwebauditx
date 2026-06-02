import { useState } from 'react';
import AdminLayout from '../AdminLayout';
import { getAdminProfile } from '../services/adminApi';

export default function Settings () {
  const admin = JSON.parse(localStorage.getItem('adminData') || '{}');
  const [pw,  setPw]  = useState({ current: '', newPw: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMsg(''); setErr('');

    if (pw.newPw.length < 8)        return setErr('New password must be at least 8 characters');
    if (pw.newPw !== pw.confirm)    return setErr('Passwords do not match');
    if (!pw.current)                return setErr('Current password is required');

    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('http://localhost:5000/api/admin/admins/' + admin._id + '/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword: pw.newPw }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setMsg('Password changed successfully');
      setPw({ current: '', newPw: '', confirm: '' });
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <AdminLayout title="Settings">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Profile */}
        <div className="adm-panel">
          <div className="adm-panel-header">
            <span className="adm-panel-title">Your Profile</span>
          </div>
          <div className="adm-panel-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px' }}>
              <div className="adm-avatar" style={{ width: 60, height: 60, fontSize: '1.3rem' }}>
                {(admin.fullName || admin.username || 'A').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{admin.fullName || admin.username}</div>
                <div style={{ color: 'var(--adm-text2)', fontSize: '0.875rem' }}>{admin.email}</div>
                <span className={`adm-badge ${admin.role === 'super_admin' ? 'adm-badge-super' : 'adm-badge-admin'}`} style={{ marginTop: '8px' }}>
                  {admin.role === 'super_admin' ? '◆ SUPER ADMIN' : '■ ADMIN'}
                </span>
              </div>
            </div>
            {[
              { label: 'Username',    value: admin.username },
              { label: 'Email',       value: admin.email    },
              { label: 'Role',        value: admin.role     },
              { label: 'Account ID',  value: admin._id?.slice(-8) },
            ].map(({ label, value }) => (
              <div key={label} className="adm-recent-item">
                <span style={{ color: 'var(--adm-text2)', fontSize: '0.83rem' }}>{label}</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.78rem' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Change password */}
        <div className="adm-panel">
          <div className="adm-panel-header">
            <span className="adm-panel-title">Change Password</span>
          </div>
          <div className="adm-panel-body">
            {msg && (
              <div style={{ background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.2)', borderRadius: '8px', padding: '10px 14px', color: 'var(--adm-accent)', fontSize: '0.83rem', marginBottom: '16px' }}>
                ✓ {msg}
              </div>
            )}
            {err && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', color: 'var(--adm-red)', fontSize: '0.83rem', marginBottom: '16px' }}>
                ⚠ {err}
              </div>
            )}
            <form onSubmit={handlePasswordChange}>
              <div className="adm-form-group">
                <label className="adm-label">Current Password</label>
                <input className="adm-input" type="password" placeholder="••••••••"
                  value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">New Password</label>
                <input className="adm-input" type="password" placeholder="Min 8 characters"
                  value={pw.newPw} onChange={e => setPw(p => ({ ...p, newPw: e.target.value }))} />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">Confirm New Password</label>
                <input className="adm-input" type="password" placeholder="Repeat new password"
                  value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
              </div>
              <button className="adm-btn adm-btn-accent" type="submit">Update Password</button>
            </form>
          </div>
        </div>

        {/* System info */}
        <div className="adm-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="adm-panel-header">
            <span className="adm-panel-title">System Information</span>
          </div>
          <div className="adm-panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {[
              { label: 'Platform',      value: 'WebAuditX'    },
              { label: 'Version',       value: 'v1.0.0 BETA'  },
              { label: 'Environment',   value: import.meta.env.MODE || 'development' },
              { label: 'API Base',      value: 'localhost:5000' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--adm-surface2)', border: '1px solid var(--adm-border)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: 'var(--adm-text2)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', color: 'var(--adm-accent)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}