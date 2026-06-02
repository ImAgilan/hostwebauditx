import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from './services/adminApi';
import './admin.css';

export default function AdminLogin () {
  const navigate = useNavigate();
  const [form,    setForm]    = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) return setError('All fields are required');
    setLoading(true);
    setError('');
    try {
      const { token, admin } = await adminLogin(form);
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminData',  JSON.stringify(admin));
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="adm-root">
      <div className="adm-login-page">
        <div className="adm-login-grid" />
        <div className="adm-login-orb"  />

        <div className="adm-login-card">
          <div className="adm-login-logo">
            WebAudit<span className="adm-login-logo-accent">X</span>
            <span className="adm-login-badge">ADMIN</span>
          </div>
          <p className="adm-login-sub">Restricted access — authorized personnel only.</p>

          {error && <div className="adm-login-error">⚠ {error}</div>}

          <form onSubmit={handleSubmit}>
            <label className="adm-label">Username or Email</label>
            <input
              className="adm-input"
              type="text"
              placeholder="admin@webauditx.com"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoComplete="username"
              disabled={loading}
            />

            <label className="adm-label">Password</label>
            <input
              className="adm-input"
              type="password"
              placeholder="••••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete="current-password"
              disabled={loading}
            />

            <button className="adm-btn-primary" type="submit" disabled={loading}>
              {loading ? '⏳ Authenticating...' : '→ Enter Admin Panel'}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <a href="/" style={{ color: 'var(--adm-text2)', fontSize: '0.8rem', textDecoration: 'none' }}>
              ← Back to WebAuditX
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}