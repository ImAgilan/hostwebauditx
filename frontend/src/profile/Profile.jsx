import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Profile.css';

const API = 'http://localhost:5000/api';

const PLAN_CONFIG = {
  free:    { label: 'Starter',      color: '#64748b', glow: 'rgba(100,116,139,0.15)', limit: 15,  badge: 'FREE' },
  pro:     { label: 'Professional', color: '#00b894', glow: 'rgba(0,184,148,0.15)',   limit: 100, badge: 'PRO' },
  premium: { label: 'Agency',       color: '#3b82f6', glow: 'rgba(59,130,246,0.15)', limit: '∞', badge: 'PREMIUM' },
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const token    = localStorage.getItem('wax_token');

  const [user,    setUser]    = useState(null);
  const [usage,   setUsage]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('profile'); // profile | password | subscription

  /* Profile form */
  const [pForm,  setPForm]  = useState({ name: '', email: '' });
  const [pMsg,   setPMsg]   = useState({ text: '', ok: false });
  const [pBusy,  setPBusy]  = useState(false);

  /* Password form */
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg,  setPwMsg]  = useState({ text: '', ok: false });
  const [pwBusy, setPwBusy] = useState(false);
  const [showPw, setShowPw] = useState({ cur: false, new: false, con: false });

  useEffect(() => {
    if (!token) { navigate('/auth'); return; }
    loadProfile();
  }, [token]);

  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  async function loadProfile() {
    setLoading(true);
    try {
      const [meRes, usageRes] = await Promise.all([
        fetch(`${API}/auth/me`, { headers: headers() }),
        fetch(`${API}/subscription/usage`, { headers: headers() }),
      ]);
      const meData    = await meRes.json();
      const usageData = await usageRes.json();

      if (!meData.success) throw new Error(meData.message);
      setUser(meData.data.user);
      setPForm({ name: meData.data.user.name || '', email: meData.data.user.email || '' });
      if (usageData.success) setUsage(usageData.data);
    } catch (err) {
      if (err.message?.includes('401') || err.message?.includes('token')) navigate('/auth');
    } finally {
      setLoading(false);
    }
  }

  /* ── Save profile ── */
  async function saveProfile(e) {
    e.preventDefault();
    if (!pForm.name.trim()) { setPMsg({ text: 'Name is required.', ok: false }); return; }
    setPBusy(true); setPMsg({ text: '', ok: false });
    try {
      const res  = await fetch(`${API}/auth/me`, {
        method: 'PUT', headers: headers(), body: JSON.stringify({ name: pForm.name }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setUser(data.data.user);
      localStorage.setItem('wax_user', JSON.stringify(data.data.user));
      window.dispatchEvent(new Event('wax_user_updated'));
      setPMsg({ text: 'Profile updated successfully.', ok: true });
    } catch (err) {
      setPMsg({ text: err.message || 'Update failed.', ok: false });
    } finally {
      setPBusy(false);
    }
  }

  /* ── Change password ── */
  async function changePassword(e) {
    e.preventDefault();
    if (!pwForm.currentPassword || !pwForm.newPassword) {
      setPwMsg({ text: 'All fields are required.', ok: false }); return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwMsg({ text: 'New password must be at least 6 characters.', ok: false }); return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ text: 'New passwords do not match.', ok: false }); return;
    }
    setPwBusy(true); setPwMsg({ text: '', ok: false });
    try {
      const res  = await fetch(`${API}/auth/change-password`, {
        method: 'PUT', headers: headers(),
        body:   JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setPwMsg({ text: 'Password changed successfully.', ok: true });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwMsg({ text: err.message || 'Failed to change password.', ok: false });
    } finally {
      setPwBusy(false);
    }
  }

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="prof-pageWAX">
        <div className="prof-gridWAX" />
        <div className="prof-loadingWAX">
          <div className="prof-spinnerWAX" />
          <p>Loading profile…</p>
        </div>
      </div>
    );
  }

  const plan   = user?.plan || 'free';
  const planCfg = PLAN_CONFIG[plan];
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase();

  const usedPct = usage && usage.limit !== 'unlimited'
    ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
    : 0;

  const resetDate = usage?.resetDate
    ? new Date(usage.resetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <div className="prof-pageWAX">
      <div className="prof-gridWAX" />
      <div className="prof-orb1WAX" />
      <div className="prof-orb2WAX" />

      {/* ── Topbar ── */}
      <nav className="prof-navWAX">
        <Link to="/" className="prof-logoWAX">
          WebAudit<span>X</span>
          <span className="prof-betaWAX">BETA</span>
        </Link>
        <div className="prof-nav-rightWAX">
          <button className="prof-nav-backWAX" onClick={() => navigate('/')}>
            ← Back to Home
          </button>
        </div>
      </nav>

      <div className="prof-layoutWAX">

        {/* ── Left: Avatar + plan card ── */}
        <aside className="prof-asideWAX">

          {/* Avatar card */}
          <div className="prof-avatar-cardWAX">
            <div className="prof-avatarWAX">{initials}</div>
            <div className="prof-user-nameWAX">{user?.name || 'User'}</div>
            <div className="prof-user-emailWAX">{user?.email}</div>
            <div
              className="prof-user-planWAX"
              style={{ background: `${planCfg.color}15`, color: planCfg.color, borderColor: `${planCfg.color}30` }}
            >
              <span className="prof-plan-dotWAX" style={{ background: planCfg.color }} />
              {planCfg.label}
            </div>
          </div>

          {/* Usage card */}
          {usage && (
            <div className="prof-usage-cardWAX">
              <div className="prof-usage-titleWAX">Monthly Usage</div>
              <div className="prof-usage-numWAX">
                <span style={{ color: planCfg.color }}>{usage.used}</span>
                <span className="prof-usage-ofWAX">/ {usage.limit === 'unlimited' ? '∞' : usage.limit}</span>
              </div>
              <div className="prof-usage-labelWAX">audits used this month</div>
              {usage.limit !== 'unlimited' && (
                <div className="prof-usage-barWAX">
                  <div
                    className="prof-usage-fillWAX"
                    style={{
                      width: `${usedPct}%`,
                      background: usedPct > 85 ? '#ef4444' : usedPct > 60 ? '#f59e0b' : planCfg.color,
                    }}
                  />
                </div>
              )}
              <div className="prof-usage-resetWAX">
                Resets on <strong>{resetDate}</strong>
              </div>
              {plan !== 'premium' && (
                <button
                  className="prof-upgrade-btnWAX"
                  onClick={() => navigate('/payment')}
                  style={{ background: planCfg.color, boxShadow: `0 0 16px ${planCfg.glow}` }}
                >
                  Upgrade Plan
                </button>
              )}
            </div>
          )}

          {/* Sidebar nav */}
          <nav className="prof-sidenavWAX">
            {[
              { key: 'profile',      icon: '👤', label: 'Profile Info' },
              { key: 'password',     icon: '🔒', label: 'Change Password' },
              { key: 'subscription', icon: '💳', label: 'Subscription' },
            ].map(item => (
              <button
                key={item.key}
                className={`prof-sidenav-itemWAX ${tab === item.key ? 'activeWAX' : ''}`}
                onClick={() => setTab(item.key)}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
            <div className="prof-sidenav-divWAX" />
            <button
              className="prof-sidenav-itemWAX prof-sidenav-histWAX"
              onClick={() => navigate('/audit-history')}
            >
              <span>📋</span>
              Audit History
            </button>
          </nav>
        </aside>

        {/* ── Right: Content panel ── */}
        <main className="prof-mainWAX">

          {/* ═══ PROFILE TAB ═══ */}
          {tab === 'profile' && (
            <div className="prof-panelWAX">
              <div className="prof-panel-headWAX">
                <h2>Profile Information</h2>
                <p>Update your name and view your account details.</p>
              </div>
              <form className="prof-formWAX" onSubmit={saveProfile} noValidate>
                <div className="prof-fieldWAX">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={pForm.name}
                    onChange={e => { setPForm(f => ({ ...f, name: e.target.value })); setPMsg({ text: '', ok: false }); }}
                    placeholder="Your full name"
                  />
                </div>
                <div className="prof-fieldWAX">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={pForm.email}
                    disabled
                    className="prof-input-disabledWAX"
                  />
                  <span className="prof-field-noteWAX">Email cannot be changed for security reasons.</span>
                </div>
                <div className="prof-fieldWAX">
                  <label>Account Created</label>
                  <input
                    type="text"
                    value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                    disabled
                    className="prof-input-disabledWAX"
                  />
                </div>
                <div className="prof-fieldWAX">
                  <label>Role</label>
                  <input
                    type="text"
                    value={user?.role === 'admin' ? 'Administrator' : 'User'}
                    disabled
                    className="prof-input-disabledWAX"
                  />
                </div>
                {pMsg.text && (
                  <div className={`prof-msgWAX ${pMsg.ok ? 'okWAX' : 'errWAX'}`}>
                    {pMsg.ok ? '✓' : '⚠'} {pMsg.text}
                  </div>
                )}
                <button type="submit" className="prof-save-btnWAX" disabled={pBusy}>
                  {pBusy ? <><span className="prof-spinnerInlineWAX" /> Saving…</> : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {/* ═══ PASSWORD TAB ═══ */}
          {tab === 'password' && (
            <div className="prof-panelWAX">
              <div className="prof-panel-headWAX">
                <h2>Change Password</h2>
                <p>Update your password to keep your account secure.</p>
              </div>
              <form className="prof-formWAX" onSubmit={changePassword} noValidate>
                {[
                  { key: 'currentPassword', label: 'Current Password', showKey: 'cur', placeholder: 'Enter current password' },
                  { key: 'newPassword',     label: 'New Password',     showKey: 'new', placeholder: 'Min 6 characters' },
                  { key: 'confirmPassword', label: 'Confirm New Password', showKey: 'con', placeholder: 'Repeat new password' },
                ].map(f => (
                  <div key={f.key} className="prof-fieldWAX">
                    <label>{f.label}</label>
                    <div className="prof-pw-wrapWAX">
                      <input
                        type={showPw[f.showKey] ? 'text' : 'password'}
                        value={pwForm[f.key]}
                        placeholder={f.placeholder}
                        onChange={e => { setPwForm(p => ({ ...p, [f.key]: e.target.value })); setPwMsg({ text: '', ok: false }); }}
                        autoComplete={f.key === 'currentPassword' ? 'current-password' : 'new-password'}
                      />
                      <button
                        type="button"
                        className="prof-pw-toggleWAX"
                        onClick={() => setShowPw(s => ({ ...s, [f.showKey]: !s[f.showKey] }))}
                        tabIndex={-1}
                      >
                        {showPw[f.showKey] ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>
                ))}
                {pwMsg.text && (
                  <div className={`prof-msgWAX ${pwMsg.ok ? 'okWAX' : 'errWAX'}`}>
                    {pwMsg.ok ? '✓' : '⚠'} {pwMsg.text}
                  </div>
                )}
                <button type="submit" className="prof-save-btnWAX" disabled={pwBusy}>
                  {pwBusy ? <><span className="prof-spinnerInlineWAX" /> Updating…</> : 'Update Password'}
                </button>
              </form>

              {/* Security tips */}
              <div className="prof-security-tipsWAX">
                <div className="prof-tips-titleWAX">Password tips</div>
                {['Use at least 6 characters','Mix letters, numbers and symbols','Avoid using your name or email','Don\'t reuse passwords from other sites'].map((tip, i) => (
                  <div key={i} className="prof-tipWAX">
                    <span className="prof-tip-dotWAX">✓</span> {tip}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ SUBSCRIPTION TAB ═══ */}
          {tab === 'subscription' && (
            <div className="prof-panelWAX">
              <div className="prof-panel-headWAX">
                <h2>Subscription &amp; Plan</h2>
                <p>Manage your plan, view limits, and upgrade anytime.</p>
              </div>

              {/* Current plan highlight */}
              <div
                className="prof-plan-cardWAX"
                style={{ borderColor: `${planCfg.color}40`, boxShadow: `0 0 24px ${planCfg.glow}` }}
              >
                <div className="prof-plan-card-topWAX">
                  <div>
                    <div className="prof-plan-card-labelWAX" style={{ color: planCfg.color }}>CURRENT PLAN</div>
                    <div className="prof-plan-card-nameWAX">{planCfg.label}</div>
                  </div>
                  <div
                    className="prof-plan-badgeWAX"
                    style={{ background: `${planCfg.color}15`, color: planCfg.color }}
                  >
                    {planCfg.badge}
                  </div>
                </div>
                <div className="prof-plan-card-statsWAX">
                  <div className="prof-plan-statWAX">
                    <div className="prof-plan-stat-numWAX" style={{ color: planCfg.color }}>
                      {usage ? usage.used : '—'}
                    </div>
                    <div className="prof-plan-stat-lblWAX">Used this month</div>
                  </div>
                  <div className="prof-plan-stat-divWAX" />
                  <div className="prof-plan-statWAX">
                    <div className="prof-plan-stat-numWAX" style={{ color: planCfg.color }}>
                      {usage ? (usage.remaining === 'unlimited' ? '∞' : usage.remaining) : '—'}
                    </div>
                    <div className="prof-plan-stat-lblWAX">Remaining</div>
                  </div>
                  <div className="prof-plan-stat-divWAX" />
                  <div className="prof-plan-statWAX">
                    <div className="prof-plan-stat-numWAX" style={{ color: planCfg.color }}>
                      {plan === 'premium' ? '∞' : planCfg.limit}
                    </div>
                    <div className="prof-plan-stat-lblWAX">Monthly limit</div>
                  </div>
                </div>
                {usage && usage.limit !== 'unlimited' && (
                  <div className="prof-plan-bar-wrapWAX">
                    <div className="prof-plan-bar-trackWAX">
                      <div
                        className="prof-plan-bar-fillWAX"
                        style={{
                          width: `${usedPct}%`,
                          background: usedPct > 85 ? '#ef4444' : planCfg.color,
                        }}
                      />
                    </div>
                    <span className="prof-plan-bar-pctWAX">{usedPct}% used</span>
                  </div>
                )}
                <div className="prof-plan-resetWAX">
                  Resets on <strong>{resetDate}</strong>
                </div>
              </div>

              {/* Plan comparison */}
              <div className="prof-compare-titleWAX">Available Plans</div>
              <div className="prof-compare-gridWAX">
                {Object.entries(PLAN_CONFIG).map(([key, cfg]) => (
                  <div
                    key={key}
                    className={`prof-compare-cardWAX ${key === plan ? 'currentWAX' : ''}`}
                    style={key === plan ? { borderColor: `${cfg.color}50` } : {}}
                  >
                    <div className="prof-compare-nameWAX" style={{ color: key === plan ? cfg.color : undefined }}>
                      {cfg.label}
                    </div>
                    <div className="prof-compare-limitWAX">
                      {key === 'premium' ? 'Unlimited audits' : `${cfg.limit} audits / month`}
                    </div>
                    {key === plan ? (
                      <div className="prof-compare-currentChipWAX" style={{ color: cfg.color, borderColor: `${cfg.color}40` }}>
                        Current plan
                      </div>
                    ) : (
                      <button
                        className="prof-compare-btnWAX"
                        style={{ background: cfg.color, boxShadow: `0 0 12px ${cfg.glow}` }}
                        onClick={() => navigate(`/payment?plan=${key}`)}
                      >
                        {key === 'free' ? 'Downgrade' : 'Upgrade'}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {plan !== 'free' && (
                <div className="prof-cancel-noteWAX">
                  To cancel your subscription, downgrade to the Free plan above. You'll keep access until the end of your current billing period.
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}