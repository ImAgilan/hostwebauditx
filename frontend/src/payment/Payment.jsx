import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import './Payment.css';

const API = 'http://localhost:5000/api';

const PLANS = [
  {
    id:       'free',
    name:     'Starter',
    price:    0,
    period:   '',
    badge:    null,
    color:    '#64748b',
    glow:     'rgba(100,116,139,0.15)',
    limit:    '15 audits / month',
    features: [
      { text: '15 audits per month',           ok: true },
      { text: 'All 9 audit modules',            ok: true },
      { text: 'Basic AI report',                ok: true },
      { text: 'PDF export',                     ok: true },
      { text: 'AI fix suggestions',             ok: false },
      { text: 'Scheduled monitoring',           ok: false },
      { text: 'White-label PDF reports',        ok: false },
      { text: 'Competitor comparison',          ok: false },
      { text: 'Client portals',                 ok: false },
    ],
  },
  {
    id:       'pro',
    name:     'Professional',
    price:    29,
    period:   '/ month',
    badge:    'MOST POPULAR',
    color:    '#00b894',
    glow:     'rgba(0,184,148,0.18)',
    limit:    '100 audits / month',
    features: [
      { text: '100 audits per month',           ok: true },
      { text: 'All 9 audit modules',            ok: true },
      { text: 'Full AI report + fix suggestions', ok: true },
      { text: 'PDF export',                     ok: true },
      { text: 'AI fix suggestions',             ok: true },
      { text: 'Scheduled monitoring',           ok: true },
      { text: 'White-label PDF reports',        ok: true },
      { text: 'Competitor comparison',          ok: true },
      { text: 'Client portals',                 ok: false },
    ],
  },
  {
    id:       'premium',
    name:     'Agency',
    price:    89,
    period:   '/ month',
    badge:    'BEST VALUE',
    color:    '#3b82f6',
    glow:     'rgba(59,130,246,0.18)',
    limit:    'Unlimited audits',
    features: [
      { text: 'Unlimited audits',               ok: true },
      { text: 'All 9 audit modules',            ok: true },
      { text: 'Full AI report + fix suggestions', ok: true },
      { text: 'PDF export',                     ok: true },
      { text: 'AI fix suggestions',             ok: true },
      { text: 'Scheduled monitoring',           ok: true },
      { text: 'White-label PDF reports',        ok: true },
      { text: 'Competitor comparison',          ok: true },
      { text: 'Client portals + API access',    ok: true },
    ],
  },
];

export default function PaymentPage() {
  const navigate         = useNavigate();
  const [params]         = useSearchParams();
  const defaultPlan      = params.get('plan') || 'pro';

  const [selected,   setSelected]   = useState(defaultPlan);
  const [step,       setStep]       = useState('select'); // 'select' | 'checkout' | 'success'
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [billing,    setBilling]    = useState('monthly');

  /* card form state (mock) */
  const [card, setCard] = useState({
    name:   '',
    number: '',
    expiry: '',
    cvc:    '',
  });

  const user  = JSON.parse(localStorage.getItem('wax_user') || 'null');
  const token = localStorage.getItem('wax_token');

  useEffect(() => {
    if (!token) {
      navigate('/auth?mode=login');
    }
  }, [token, navigate]);

  const selectedPlan = PLANS.find(p => p.id === selected);

  const formatCardNumber = v =>
    v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

  const formatExpiry = v =>
    v.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2');

  const changeCard = e => {
    const { name, value } = e.target;
    let v = value;
    if (name === 'number') v = formatCardNumber(value);
    if (name === 'expiry') v = formatExpiry(value);
    if (name === 'cvc')    v = value.replace(/\D/g, '').slice(0, 4);
    setCard(c => ({ ...c, [name]: v }));
    setError('');
  };

  const proceedToCheckout = () => {
    if (selected === 'free') {
      handleFreeDowngrade();
      return;
    }
    setStep('checkout');
  };

  const handleFreeDowngrade = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/subscription/upgrade`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: 'free' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      const updatedUser = { ...user, plan: 'free' };
      localStorage.setItem('wax_user', JSON.stringify(updatedUser));
      setStep('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async e => {
    e.preventDefault();
    setError('');

    if (!card.name.trim())               return setError('Cardholder name is required.');
    if (card.number.replace(/\s/g,'').length < 16) return setError('Please enter a valid 16-digit card number.');
    if (card.expiry.length < 5)          return setError('Please enter a valid expiry date.');
    if (card.cvc.length < 3)             return setError('Please enter a valid CVC.');

    setLoading(true);

    /* Simulate payment processing delay */
    await new Promise(r => setTimeout(r, 2200));

    try {
      const res = await fetch(`${API}/subscription/upgrade`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: selected }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      const updatedUser = { ...user, plan: selected };
      localStorage.setItem('wax_user', JSON.stringify(updatedUser));
      setStep('success');

    } catch (err) {
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ══════════════════════════════════════════
     STEP: SUCCESS
  ══════════════════════════════════════════ */
  if (step === 'success') {
    return (
      <div className="pay-pageWAX">
        <div className="pay-gridWAX" />
        <div className="pay-orb1WAX" />
        <Link to="/" className="pay-logoWAX">WebAudit<span>X</span><span className="pay-betaWAX">BETA</span></Link>

        <div className="pay-successCardWAX">
          <div className="pay-successIconWAX">
            <svg viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="25" stroke="#00b894" strokeWidth="2" />
              <path d="M14 27l8 8 16-16" stroke="#00b894" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <animate attributeName="stroke-dasharray" from="0 50" to="50 0" dur="0.5s" fill="freeze" />
              </path>
            </svg>
          </div>
          <h1>You're all set!</h1>
          <p>
            Your account has been upgraded to the{' '}
            <strong style={{ color: selectedPlan.color }}>{selectedPlan.name}</strong> plan.
          </p>
          <div className="pay-success-badgeWAX" style={{ background: `${selectedPlan.color}18`, borderColor: `${selectedPlan.color}40`, color: selectedPlan.color }}>
            {selectedPlan.limit}
          </div>
          <div className="pay-success-actionsWAX">
            <button className="pay-success-btnWAX primary" onClick={() => navigate('/')}>
              Start Auditing →
            </button>
            <button className="pay-success-btnWAX ghost" onClick={() => navigate('/')}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════
     STEP: CHECKOUT
  ══════════════════════════════════════════ */
  if (step === 'checkout') {
    return (
      <div className="pay-pageWAX">
        <div className="pay-gridWAX" />
        <div className="pay-orb1WAX" />
        <Link to="/" className="pay-logoWAX">WebAudit<span>X</span><span className="pay-betaWAX">BETA</span></Link>

        <div className="pay-checkoutLayoutWAX">

          {/* Left: Order summary */}
          <div className="pay-summaryWAX">
            <button className="pay-backBtnWAX" onClick={() => { setStep('select'); setError(''); }}>
              ← Back to plans
            </button>

            <div className="pay-summary-tagWAX">ORDER SUMMARY</div>
            <h2 className="pay-summary-titleWAX">{selectedPlan.name} Plan</h2>

            <div className="pay-summary-priceWAX" style={{ color: selectedPlan.color }}>
              ${selectedPlan.price}
              <span> / month</span>
            </div>

            <div className="pay-summary-limitWAX" style={{ background: `${selectedPlan.color}15`, color: selectedPlan.color }}>
              ⚡ {selectedPlan.limit}
            </div>

            <ul className="pay-summary-featuresWAX">
              {selectedPlan.features.filter(f => f.ok).map((f, i) => (
                <li key={i}>
                  <span className="checkWAX" style={{ color: selectedPlan.color }}>✓</span>
                  {f.text}
                </li>
              ))}
            </ul>

            <div className="pay-summary-secureWAX">
              <span>🔒</span>
              <span>256-bit SSL encryption · Cancel anytime · No hidden fees</span>
            </div>
          </div>

          {/* Right: Payment form */}
          <div className="pay-formCardWAX">
            <div className="pay-form-tagWAX">PAYMENT DETAILS</div>
            <p className="pay-form-subWAX">This is a demo — no real charge will occur.</p>

            <form className="pay-formWAX" onSubmit={handlePayment} noValidate>

              <div className="pay-fieldWAX">
                <label>Cardholder Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="John Silva"
                  value={card.name}
                  onChange={changeCard}
                  autoComplete="cc-name"
                />
              </div>

              <div className="pay-fieldWAX">
                <label>Card Number</label>
                <div className="pay-card-inputWAX">
                  <input
                    type="text"
                    name="number"
                    placeholder="1234 5678 9012 3456"
                    value={card.number}
                    onChange={changeCard}
                    inputMode="numeric"
                    autoComplete="cc-number"
                  />
                  <div className="pay-card-iconsWAX">
                    <span title="Visa">VISA</span>
                    <span title="Mastercard">MC</span>
                  </div>
                </div>
              </div>

              <div className="pay-row2WAX">
                <div className="pay-fieldWAX">
                  <label>Expiry Date</label>
                  <input
                    type="text"
                    name="expiry"
                    placeholder="MM/YY"
                    value={card.expiry}
                    onChange={changeCard}
                    inputMode="numeric"
                    autoComplete="cc-exp"
                  />
                </div>
                <div className="pay-fieldWAX">
                  <label>CVC</label>
                  <input
                    type="text"
                    name="cvc"
                    placeholder="123"
                    value={card.cvc}
                    onChange={changeCard}
                    inputMode="numeric"
                    autoComplete="cc-csc"
                  />
                </div>
              </div>

              {error && (
                <div className="pay-errorWAX">⚠ {error}</div>
              )}

              <div className="pay-total-boxWAX">
                <div className="pay-total-rowWAX">
                  <span>{selectedPlan.name} plan</span>
                  <span>${selectedPlan.price}.00</span>
                </div>
                <div className="pay-total-rowWAX muted">
                  <span>Billed monthly</span>
                  <span>Cancel anytime</span>
                </div>
                <div className="pay-total-divWAX" />
                <div className="pay-total-rowWAX bold">
                  <span>Total today</span>
                  <span style={{ color: selectedPlan.color }}>${selectedPlan.price}.00</span>
                </div>
              </div>

              <button
                type="submit"
                className="pay-payBtnWAX"
                disabled={loading}
                style={{
                  background: loading ? '#94a3b8' : selectedPlan.color,
                  boxShadow:  loading ? 'none' : `0 0 28px ${selectedPlan.glow}`,
                }}
              >
                {loading ? (
                  <><span className="pay-spinnerWAX" /> Processing payment…</>
                ) : (
                  `Pay $${selectedPlan.price}.00 →`
                )}
              </button>

              <p className="pay-trialNoteWAX">
                🛡 14-day money-back guarantee · No questions asked
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════
     STEP: SELECT PLAN
  ══════════════════════════════════════════ */
  return (
    <div className="pay-pageWAX">
      <div className="pay-gridWAX" />
      <div className="pay-orb1WAX" />
      <div className="pay-orb2WAX" />
      <Link to="/" className="pay-logoWAX">WebAudit<span>X</span><span className="pay-betaWAX">BETA</span></Link>

      <div className="pay-selectLayoutWAX">

        {/* Header */}
        <div className="pay-select-headWAX">
          <div className="pay-select-tagWAX">UPGRADE YOUR PLAN</div>
          <h1 className="pay-select-titleWAX">
            Choose the plan that fits<br />
            <span style={{ color: 'var(--accent)' }}>your audit needs</span>
          </h1>
          <p className="pay-select-subWAX">
            Start free. Upgrade anytime. Cancel whenever you like.
          </p>

          {/* Billing toggle */}
          <div className="pay-billing-toggleWAX">
            <button
              className={billing === 'monthly' ? 'activeWAX' : ''}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              className={billing === 'annual' ? 'activeWAX' : ''}
              onClick={() => setBilling('annual')}
            >
              Annual
              <span className="pay-save-badgeWAX">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Current plan banner */}
        {user && (
          <div className="pay-currentPlanWAX">
            Your current plan: <strong style={{ color: 'var(--accent)' }}>{user.plan?.toUpperCase() || 'FREE'}</strong>
          </div>
        )}

        {/* Plans grid */}
        <div className="pay-plansGridWAX">
          {PLANS.map(plan => {
            const isActive   = selected === plan.id;
            const isCurrent  = user?.plan === plan.id;
            const displayPrice = billing === 'annual' && plan.price > 0
              ? Math.round(plan.price * 0.8)
              : plan.price;

            return (
              <div
                key={plan.id}
                className={`pay-planCardWAX ${isActive ? 'selectedWAX' : ''} ${plan.badge === 'MOST POPULAR' ? 'popularWAX' : ''}`}
                onClick={() => setSelected(plan.id)}
                style={isActive ? {
                  borderColor: plan.color,
                  boxShadow:   `0 0 0 2px ${plan.color}40, 0 20px 48px ${plan.glow}`,
                } : {}}
              >
                {plan.badge && (
                  <div className="pay-plan-badgeWAX" style={{ background: plan.color }}>
                    {plan.badge}
                  </div>
                )}

                {/* Radio */}
                <div className="pay-plan-radioWAX" style={{ borderColor: isActive ? plan.color : undefined }}>
                  {isActive && <div style={{ background: plan.color }} />}
                </div>

                {/* Name + limit */}
                <div className="pay-plan-nameWAX" style={{ color: isActive ? plan.color : undefined }}>
                  {plan.name}
                </div>
                <div className="pay-plan-limitWAX">{plan.limit}</div>

                {/* Price */}
                <div className="pay-plan-priceWAX">
                  {plan.price === 0 ? (
                    <span className="pay-free-labelWAX">Free</span>
                  ) : (
                    <>
                      <sup>$</sup>
                      <span className="pay-price-numWAX" style={{ color: isActive ? plan.color : undefined }}>
                        {displayPrice}
                      </span>
                      <span className="pay-price-perWAX">/mo</span>
                      {billing === 'annual' && plan.price > 0 && (
                        <span className="pay-orig-priceWAX">${plan.price}</span>
                      )}
                    </>
                  )}
                </div>

                {/* Features */}
                <ul className="pay-plan-featuresWAX">
                  {plan.features.map((f, i) => (
                    <li key={i} className={!f.ok ? 'dimmedWAX' : ''}>
                      <span style={{ color: f.ok ? plan.color : '#cbd5e1' }}>
                        {f.ok ? '✓' : '✗'}
                      </span>
                      {f.text}
                    </li>
                  ))}
                </ul>

                {isCurrent && (
                  <div className="pay-current-labelWAX">Current plan</div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="pay-select-ctaWAX">
          <button
            className="pay-select-btnWAX"
            onClick={proceedToCheckout}
            disabled={loading || user?.plan === selected}
            style={{ background: selectedPlan.color, boxShadow: `0 0 28px ${selectedPlan.glow}` }}
          >
            {loading
              ? <><span className="pay-spinnerWAX" /> Please wait…</>
              : selected === 'free'
                ? 'Continue with Free →'
                : `Continue with ${selectedPlan.name} →`
            }
          </button>
          {user?.plan === selected && (
            <p className="pay-already-msgWAX">You're already on this plan.</p>
          )}
          <p className="pay-cta-noteWAX">
            No credit card required for Starter · Cancel anytime for paid plans
          </p>
        </div>
      </div>
    </div>
  );
}