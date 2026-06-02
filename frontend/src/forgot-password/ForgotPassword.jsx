import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import './ForgotPassword.css';

const API = 'http://localhost:5000/api/auth';

export default function ForgotPasswordPage() {
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const resetToken   = params.get('token');
  const resetEmail   = params.get('email');

  /* If token+email are in URL → show reset form, else show forgot form */
  const isReset = !!(resetToken && resetEmail);

  const [step,    setStep]    = useState(isReset ? 'reset' : 'forgot'); // forgot | sent | reset | done
  const [email,   setEmail]   = useState(resetEmail || '');
  const [pw,      setPw]      = useState({ newPassword: '', confirmPassword: '' });
  const [showPw,  setShowPw]  = useState({ n: false, c: false });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  /* ── Forgot: send reset link ── */
  async function handleForgot(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required.'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API}/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setStep('sent');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  /* ── Reset: set new password ── */
  async function handleReset(e) {
    e.preventDefault();
    if (!pw.newPassword) { setError('New password is required.'); return; }
    if (pw.newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (pw.newPassword !== pw.confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API}/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: resetToken, email: resetEmail, newPassword: pw.newPassword }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setStep('done');
    } catch (err) {
      setError(err.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fp-pageWAX">
      <div className="fp-gridWAX" />
      <div className="fp-orbWAX" />

      <Link to="/" className="fp-logoWAX">
        WebAudit<span>X</span>
        <span className="fp-betaWAX">BETA</span>
      </Link>

      <div className="fp-cardWAX">

        {/* ─── FORGOT: enter email ─── */}
        {step === 'forgot' && (
          <>
            <div className="fp-icon-wrapWAX">
              <div className="fp-iconWAX">🔑</div>
            </div>
            <h1 className="fp-titleWAX">Forgot your password?</h1>
            <p className="fp-subWAX">
              Enter your account email and we'll send you a secure reset link valid for 15 minutes.
            </p>
            <form className="fp-formWAX" onSubmit={handleForgot} noValidate>
              <div className="fp-fieldWAX">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  autoFocus
                />
              </div>
              {error && <div className="fp-errorWAX">⚠ {error}</div>}
              <button type="submit" className="fp-btnWAX" disabled={loading}>
                {loading ? <><span className="fp-spinnerWAX" /> Sending…</> : 'Send Reset Link →'}
              </button>
            </form>
            <Link to="/auth" className="fp-backWAX">← Back to Sign In</Link>
          </>
        )}

        {/* ─── SENT: check email ─── */}
        {step === 'sent' && (
          <>
            <div className="fp-icon-wrapWAX">
              <div className="fp-iconWAX" style={{ background: 'rgba(59,130,246,0.1)' }}>✉</div>
            </div>
            <h1 className="fp-titleWAX">Check your inbox</h1>
            <p className="fp-subWAX">
              If <strong>{email}</strong> is registered, a reset link has been sent. Check your spam folder too.
            </p>
            <div className="fp-sentNoteWAX">
              <span>⏱</span>
              Link expires in <strong>15 minutes</strong>
            </div>
            <button className="fp-btnWAX outline" onClick={() => setStep('forgot')}>
              Resend Link
            </button>
            <Link to="/auth" className="fp-backWAX">← Back to Sign In</Link>
          </>
        )}

        {/* ─── RESET: set new password ─── */}
        {step === 'reset' && (
          <>
            <div className="fp-icon-wrapWAX">
              <div className="fp-iconWAX" style={{ background: 'rgba(168,85,247,0.1)' }}>🔒</div>
            </div>
            <h1 className="fp-titleWAX">Set new password</h1>
            <p className="fp-subWAX">Choose a strong password for <strong>{resetEmail}</strong>.</p>
            <form className="fp-formWAX" onSubmit={handleReset} noValidate>
              {[
                { key: 'newPassword',     label: 'New Password',     sk: 'n', ph: 'Min 6 characters' },
                { key: 'confirmPassword', label: 'Confirm Password', sk: 'c', ph: 'Repeat new password' },
              ].map(f => (
                <div key={f.key} className="fp-fieldWAX">
                  <label>{f.label}</label>
                  <div className="fp-pw-wrapWAX">
                    <input
                      type={showPw[f.sk] ? 'text' : 'password'}
                      placeholder={f.ph}
                      value={pw[f.key]}
                      onChange={e => { setPw(p => ({ ...p, [f.key]: e.target.value })); setError(''); }}
                      autoComplete="new-password"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(s => ({ ...s, [f.sk]: !s[f.sk] }))}>
                      {showPw[f.sk] ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
              ))}
              {error && <div className="fp-errorWAX">⚠ {error}</div>}
              <button type="submit" className="fp-btnWAX" disabled={loading}>
                {loading ? <><span className="fp-spinnerWAX" /> Resetting…</> : 'Reset Password →'}
              </button>
            </form>
          </>
        )}

        {/* ─── DONE: success ─── */}
        {step === 'done' && (
          <>
            <div className="fp-icon-wrapWAX">
              <div className="fp-iconWAX" style={{ background: 'rgba(34,197,94,0.1)', fontSize: '2rem' }}>✓</div>
            </div>
            <h1 className="fp-titleWAX">Password reset!</h1>
            <p className="fp-subWAX">
              Your password has been updated successfully. You can now sign in with your new password.
            </p>
            <button className="fp-btnWAX" onClick={() => navigate('/auth')}>
              Sign In →
            </button>
          </>
        )}
      </div>
    </div>
  );
}