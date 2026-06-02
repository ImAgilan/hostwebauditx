import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import './Auth.css';

const API = 'http://localhost:5000/api/auth';

export default function AuthPage() {
  const navigate       = useNavigate();
  const [params]       = useSearchParams();
  const defaultTab     = params.get('mode') === 'register' ? 'register' : 'login';

  const [tab,       setTab]       = useState(defaultTab);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [showPass,  setShowPass]  = useState(false);

  /* form fields */
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const canvasRef = useRef(null);

  /* ── animated particle background ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const dots = Array.from({ length: 55 }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      r:  Math.random() * 1.6 + 0.4,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      op: Math.random() * 0.4 + 0.1,
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach(d => {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,184,148,${d.op})`;
        ctx.fill();
        d.x += d.dx;
        d.y += d.dy;
        if (d.x < 0 || d.x > canvas.width)  d.dx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.dy *= -1;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  const change = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const submit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.email || !form.password) {
      setError('Email and password are required.');
      return;
    }
    if (tab === 'register' && !form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/login' : '/register';
      const body     = tab === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const res  = await fetch(`${API}${endpoint}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      /* Store token */
      localStorage.setItem('wax_token', data.data.token);
      localStorage.setItem('wax_user',  JSON.stringify(data.data.user));

      if (tab === 'register') {
        setSuccess('Account created! Redirecting...');
        setTimeout(() => navigate('/'), 1200);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-pageWAX">
      <canvas className="auth-canvasWAX" ref={canvasRef} />

      {/* grid overlay */}
      <div className="auth-gridWAX" />

      {/* orbs */}
      <div className="auth-orb1WAX" />
      <div className="auth-orb2WAX" />

      {/* nav logo */}
      <Link to="/" className="auth-logoWAX">
        WebAudit<span>X</span>
        <span className="auth-betaWAX">BETA</span>
      </Link>

      <div className="auth-cardWAX">

        {/* tabs */}
        <div className="auth-tabsWAX">
          <button
            className={`auth-tabWAX ${tab === 'login' ? 'activeWAX' : ''}`}
            onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
          >
            Sign In
          </button>
          <button
            className={`auth-tabWAX ${tab === 'register' ? 'activeWAX' : ''}`}
            onClick={() => { setTab('register'); setError(''); setSuccess(''); }}
          >
            Create Account
          </button>
          <div className={`auth-tab-sliderWAX ${tab === 'register' ? 'rightWAX' : ''}`} />
        </div>

        {/* heading */}
        <div className="auth-headWAX">
          <h1 className="auth-titleWAX">
            {tab === 'login' ? 'Welcome back' : 'Get started free'}
          </h1>
          <p className="auth-subWAX">
            {tab === 'login'
              ? 'Sign in to access your audit dashboard.'
              : 'Create your account and run your first audit today.'}
          </p>
        </div>

        {/* form */}
        <form className="auth-formWAX" onSubmit={submit} noValidate>

          {tab === 'register' && (
            <div className="auth-fieldWAX">
              <label>Full Name</label>
              <div className="auth-inputWrapWAX">
                <span className="auth-iconWAX">👤</span>
                <input
                  type="text"
                  name="name"
                  placeholder="John Silva"
                  value={form.name}
                  onChange={change}
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="auth-fieldWAX">
            <label>Email Address</label>
            <div className="auth-inputWrapWAX">
              <span className="auth-iconWAX">✉</span>
              <input
                type="email"
                name="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={change}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-fieldWAX">
            <div className="auth-field-headWAX">
              <label>Password</label>
              {tab === 'login' && (
                <a href="#" className="auth-forgotWAX">Forgot password?</a>
              )}
            </div>
            <div className="auth-inputWrapWAX">
              <span className="auth-iconWAX">🔒</span>
              <input
                type={showPass ? 'text' : 'password'}
                name="password"
                placeholder={tab === 'register' ? 'Min 6 characters' : '••••••••'}
                value={form.password}
                onChange={change}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="auth-togglePassWAX"
                onClick={() => setShowPass(s => !s)}
                tabIndex={-1}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* error */}
          {error && (
            <div className="auth-errorWAX">
              <span>⚠</span> {error}
            </div>
          )}

          {/* success */}
          {success && (
            <div className="auth-successWAX">
              <span>✓</span> {success}
            </div>
          )}

          <button
            type="submit"
            className="auth-submitWAX"
            disabled={loading}
          >
            {loading
              ? <><span className="auth-spinnerWAX" /> Processing…</>
              : tab === 'login' ? 'Sign In →' : 'Create Account →'
            }
          </button>
        </form>

        {/* divider */}
        <div className="auth-divWAX">
          <span />
          <p>or continue with</p>
          <span />
        </div>

        {/* OAuth stubs */}
        <div className="auth-oauthWAX">
          <button className="auth-oauth-btnWAX">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
          <button className="auth-oauth-btnWAX">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#333">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>

        {/* footer switch */}
        <p className="auth-switchWAX">
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }}
          >
            {tab === 'login' ? 'Create one free' : 'Sign in'}
          </button>
        </p>

        {tab === 'register' && (
          <p className="auth-termsWAX">
            By creating an account you agree to our{' '}
            <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
          </p>
        )}
      </div>
    </div>
  );
}