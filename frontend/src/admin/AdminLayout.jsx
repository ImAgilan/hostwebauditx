import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { adminLogout } from './services/adminApi';
import './admin.css';

function Clock () {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const MENU = [
  { section: 'OVERVIEW' },
  { id: '/admin/dashboard', icon: '📊', label: 'Dashboard' },
  { id: '/admin/revenue',   icon: '💰', label: 'Revenue & MRR', perm: 'viewRevenue' },

  { section: 'MANAGEMENT' },
  { id: '/admin/users',   icon: '👥', label: 'Users' },
  { id: '/admin/audits',  icon: '🔍', label: 'Audit History' },

  { section: 'ADMINISTRATION', superOnly: true },
  { id: '/admin/admins', icon: '🛡️', label: 'Admin Accounts', superOnly: true },

  { section: 'SYSTEM' },
  { id: '/admin/settings', icon: '⚙️', label: 'Settings' },
];

export default function AdminLayout ({ children, title }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [admin, setAdmin]   = useState(null);
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('adminData');
    if (!raw) { navigate('/admin/login'); return; }
    const token = localStorage.getItem('adminToken');
    if (!token) { navigate('/admin/login'); return; }
    setAdmin(JSON.parse(raw));
  }, [navigate]);

  const handleLogout = async () => {
    try { await adminLogout(); } catch (_) {}
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    navigate('/admin/login');
  };

  const isSuperAdmin = admin?.role === 'super_admin';

  const initials = admin
    ? (admin.fullName || admin.username || 'A').slice(0, 2).toUpperCase()
    : 'A';

  return (
    <div className="adm-root">
      <div className="adm-layout">
        {/* ── Sidebar ── */}
        <aside className={`adm-sidebar ${sideOpen ? 'open' : ''}`}>
          <div className="adm-sidebar-logo">
            <div className="adm-sidebar-logo-text">
              WebAudit<span>X</span>
            </div>
            <div className="adm-sidebar-role">
              {isSuperAdmin ? '◆ SUPER ADMIN' : '■ ADMIN'}
            </div>
          </div>

          <nav style={{ flex: 1, paddingTop: '8px' }}>
            {MENU.map((item, i) => {
              if (item.section) {
                if (item.superOnly && !isSuperAdmin) return null;
                return (
                  <div key={i} className="adm-nav-section">{item.section}</div>
                );
              }
              if (item.superOnly && !isSuperAdmin) return null;

              return (
                <button
                  key={item.id}
                  className={`adm-nav-item ${location.pathname === item.id ? 'active' : ''}`}
                  onClick={() => { navigate(item.id); setSideOpen(false); }}
                >
                  <span className="adm-nav-icon">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="adm-sidebar-footer">
            <div className="adm-sidebar-user">
              <div className="adm-avatar">{initials}</div>
              <div className="adm-sidebar-user-info">
                <div className="adm-sidebar-user-name">{admin?.fullName || admin?.username}</div>
                <div className="adm-sidebar-user-role">
                  {isSuperAdmin ? 'Super Admin' : 'Admin'}
                </div>
              </div>
              <button className="adm-logout-btn" onClick={handleLogout} title="Logout">⇥</button>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="adm-main">
          <header className="adm-topbar">
            <button
              style={{ background: 'none', border: 'none', color: 'var(--adm-text2)', cursor: 'pointer', fontSize: '1.2rem', marginRight: '12px', display: 'none' }}
              className="adm-mobile-toggle"
              onClick={() => setSideOpen(o => !o)}
            >
              ☰
            </button>
            <div className="adm-topbar-title">{title}</div>
            <div className="adm-topbar-right">
              <div className="adm-topbar-time"><Clock /></div>
              <div className="adm-status-dot" title="System Online" />
            </div>
          </header>

          <main className="adm-page">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}