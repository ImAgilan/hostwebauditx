import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';


const PLAN_COLOR = { free: '#64748b', pro: '#00b894', premium: '#3b82f6' };
const PLAN_LABEL = { free: 'Starter', pro: 'Pro', premium: 'Agency' };

export default function UserNav({ onSignInClick }) {
  const navigate   = useNavigate();
  const [open, setOpen]   = useState(false);
  const [user, setUser]   = useState(null);
  const dropRef = useRef(null);

  /* Read user from localStorage on mount and on storage changes */
  useEffect(() => {
    const read = () => {
      try { setUser(JSON.parse(localStorage.getItem('wax_user') || 'null')); }
      catch { setUser(null); }
    };
    read();
    window.addEventListener('storage', read);
    /* Also listen for custom event so same-tab updates work */
    window.addEventListener('wax_user_updated', read);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener('wax_user_updated', read);
    };
  }, []);

  /* Close dropdown when clicking outside */
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const logout = () => {
    localStorage.removeItem('wax_token');
    localStorage.removeItem('wax_user');
    setUser(null);
    setOpen(false);
    window.dispatchEvent(new Event('wax_user_updated'));
    navigate('/');
  };

  const go = (path) => { setOpen(false); navigate(path); };

  /* ── Not logged in ── */
  if (!user) {
    return (
      <div className="unav-ctaWAX">
        <button
          className="unav-signinWAX"
          onClick={onSignInClick || (() => navigate('/auth'))}
        >
          Sign In
        </button>
        <button
          className="unav-startWAX"
          onClick={() => navigate('/auth?mode=register')}
        >
          Start Free Audit
        </button>
      </div>
    );
  }

  /* ── Logged in ── */
  const initials = user.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user.email.slice(0, 2).toUpperCase();

  const plan      = user.plan || 'free';
  const planColor = PLAN_COLOR[plan];
  const planLabel = PLAN_LABEL[plan];

  return (
    <div className="unav-wrapWAX" ref={dropRef}>

      {/* Avatar trigger */}
      <button
        className={`unav-avatarBtnWAX ${open ? 'openWAX' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="User menu"
        aria-expanded={open}
      >
        <span className="unav-initialsWAX">{initials}</span>
        <span className="unav-nameWAX">{user.name || user.email.split('@')[0]}</span>
        <span className={`unav-chevronWAX ${open ? 'upWAX' : ''}`}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="unav-dropdownWAX">

          {/* User info */}
          <div className="unav-drop-headerWAX">
            <div className="unav-drop-avatarWAX">{initials}</div>
            <div className="unav-drop-infoWAX">
              <div className="unav-drop-nameWAX">{user.name || 'User'}</div>
              <div className="unav-drop-emailWAX">{user.email}</div>
            </div>
          </div>

          {/* Plan badge */}
          <div
            className="unav-planBadgeWAX"
            style={{ background: `${planColor}15`, color: planColor, borderColor: `${planColor}30` }}
          >
            <span className="unav-planDotWAX" style={{ background: planColor }} />
            {planLabel} Plan
            <button
              className="unav-upgradeChipWAX"
              onClick={() => go('/payment')}
              style={{ color: planColor, borderColor: `${planColor}40` }}
            >
              {plan === 'premium' ? 'Manage' : 'Upgrade'}
            </button>
          </div>

          <div className="unav-dividerWAX" />

          {/* Menu items */}
          <button className="unav-itemWAX" onClick={() => go('/profile')}>
            <span className="unav-item-iconWAX">⚙</span>
            Profile Settings
          </button>
          <button className="unav-itemWAX" onClick={() => go('/audit-history')}>
            <span className="unav-item-iconWAX">📋</span>
            Audit History
          </button>
          <button className="unav-itemWAX" onClick={() => go('/payment')}>
            <span className="unav-item-iconWAX">💳</span>
            Subscription
          </button>

          <div className="unav-dividerWAX" />

          <button className="unav-itemWAX unav-logoutWAX" onClick={logout}>
            <span className="unav-item-iconWAX">↩</span>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}