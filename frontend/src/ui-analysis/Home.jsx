import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import UserNav from '../components/UserNav';
import '../components/UserNav.css';
import { analyzeURL, downloadPDFReport } from '../services/uiAnalysisApi';

import { OverviewTab, LogoTab, TypographyTab, ColorsTab } from './components/TabsA';
import { ImagesTab, LayoutTab, NavigationTab, CTATab, HeaderFooterTab } from './components/TabsB';
import { ContentTab, TechnicalTab, IssuesTab, AIInsightsTab } from './components/TabsC';
import { ScoreRing, AnimBar } from './components/Primitives';

import './ui-analysis.css';

/* ─── Loading steps ─── */
const STEPS = [
  { icon: '🌐', label: 'Connecting to website…' },
  { icon: '🏷️', label: 'Detecting logo placement…' },
  { icon: '✍️', label: 'Analysing typography & heading ratios…' },
  { icon: '🎨', label: 'Extracting colour system…' },
  { icon: '🖼️', label: 'Auditing image placement & formats…' },
  { icon: '📐', label: 'Checking layout & spacing…' },
  { icon: '🧭', label: 'Evaluating navigation UX…' },
  { icon: '🎯', label: 'Analysing CTAs & buttons…' },
  { icon: '🏠', label: 'Auditing header & footer…' },
  { icon: '📋', label: 'Scanning content & trust signals…' },
  { icon: '⚙️', label: 'Checking technical SEO signals…' },
  { icon: '🤖', label: 'Generating AI expert insights…' },
];

/* ─── Tab definitions ─── */
const TABS = [
  { id: 'overview',     label: 'Overview',      icon: '📊' },
  { id: 'logo',         label: 'Logo',           icon: '🏷️' },
  { id: 'typography',   label: 'Typography',     icon: '✍️' },
  { id: 'colors',       label: 'Colors',         icon: '🎨' },
  { id: 'images',       label: 'Images',         icon: '🖼️' },
  { id: 'layout',       label: 'Layout',         icon: '📐' },
  { id: 'navigation',   label: 'Navigation',     icon: '🧭' },
  { id: 'cta',          label: 'CTAs',           icon: '🎯' },
  { id: 'headerfooter', label: 'Header/Footer',  icon: '🏠' },
  { id: 'content',      label: 'Content',        icon: '📋' },
  { id: 'technical',    label: 'Technical',      icon: '⚙️' },
  { id: 'issues',       label: 'Issues',         icon: '⚠️' },
  { id: 'ai',           label: 'AI Insights',    icon: '🤖' },
];

/* ─── Main component ─── */
export default function UIAnalysisHome() {
  const navigate  = useNavigate();
  const inputRef  = useRef(null);

  const [url,       setUrl]       = useState('');
  const [loading,   setLoading]   = useState(false);
  const [loadStep,  setLoadStep]  = useState(0);
  const [report,    setReport]    = useState(null);
  const [error,     setError]     = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  /* Cycle loading steps */
  useEffect(() => {
    if (!loading) { setLoadStep(0); return; }
    const id = setInterval(() => setLoadStep(p => Math.min(p + 1, STEPS.length - 1)), 2400);
    return () => clearInterval(id);
  }, [loading]);

  const handleAnalyze = useCallback(async () => {
    if (!url.trim()) { inputRef.current?.focus(); return; }
    setError(''); setReport(null); setLoading(true); setActiveTab('overview');
    try {
      const res = await analyzeURL(url.trim());
      setReport(res.data);
    } catch (e) {
      setError(e.message || 'Analysis failed. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  }, [url]);

  /* Derived */
  const r      = report;
  const scores = r?.scores || {};
  const issues = r?.issues || [];
  const ai     = r?.aiInsights;
  const critical = issues.filter(i => i.severity === 'critical').length;
  const medium   = issues.filter(i => i.severity === 'medium').length;
  const low      = issues.filter(i => i.severity === 'low').length;

  /* Render tab content */
  const renderTab = () => {
    const props = { r, issues, setActiveTab, ai, scores };
    switch (activeTab) {
      case 'overview':    return <OverviewTab     {...props} />;
      case 'logo':        return <LogoTab         {...props} />;
      case 'typography':  return <TypographyTab   {...props} />;
      case 'colors':      return <ColorsTab       {...props} />;
      case 'images':      return <ImagesTab       {...props} />;
      case 'layout':      return <LayoutTab       {...props} />;
      case 'navigation':  return <NavigationTab   {...props} />;
      case 'cta':         return <CTATab          {...props} />;
      case 'headerfooter':return <HeaderFooterTab {...props} />;
      case 'content':     return <ContentTab      {...props} />;
      case 'technical':   return <TechnicalTab    {...props} />;
      case 'issues':      return <IssuesTab       issues={issues} />;
      case 'ai':          return <AIInsightsTab   ai={ai} scores={scores} />;
      default:            return <OverviewTab     {...props} />;
    }
  };

  return (
    <div className="ua-page">

      {/* ── NAVIGATION - WebAuditX Theme ── */}
      <nav className="wax-navLP">
        <a href="#home" className="nav-logoLP" onClick={e => { e.preventDefault(); navigate('/'); }}>
          WebAudit<span style={{ color: 'var(--accent, #00b894)' }}>X</span>
          <span className="logo-badgeLP">BETA</span>
        </a>
        <ul className="nav-linksLP">
          <li><a href="#overview" onClick={e => { e.preventDefault(); scrollTo('overview'); }}>Overview</a></li>
          <li><a href="#analysis" onClick={e => { e.preventDefault(); scrollTo('analysis'); }}>Analysis</a></li>
          <li><a href="#issues" onClick={e => { e.preventDefault(); scrollTo('issues'); }}>Issues</a></li>
        </ul>
        <div className="nav-ctaLP">
          <UserNav onSignInClick={() => navigate('/auth')} />
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="ua-hero">
        <div className="ua-orb ua-orb1" /><div className="ua-orb ua-orb2" />
        <div className="ua-hero-inner">
          <div className="ua-hero-tag">✦ MODULE 01 · 30+ DEEP CHECKS</div>
          <h1 className="ua-hero-h">Advanced UI/UX <span className="accent">Deep Analysis</span></h1>
          <p className="ua-hero-sub">
            Logo placement · Typography ratios · Heading hierarchy · Color systems ·
            Image placement · Layout · Navigation · CTAs · Header/Footer ·
            Content & trust signals · Technical SEO · AI expert insights
          </p>
        </div>
      </header>

      {/* ── URL INPUT ── */}
      <section className="ua-input-wrap">
        <div className="ua-input-card">
          <div className="ua-input-label">Enter website URL to run full audit</div>
          <div className="ua-input-row">
            <span className="ua-prefix">https://</span>
            <input
              ref={inputRef}
              className="ua-url-input"
              type="text"
              placeholder="yourwebsite.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              disabled={loading}
            />
            <button
              className={`ua-analyze-btn${loading ? ' loading' : ''}`}
              onClick={handleAnalyze}
              disabled={loading}
            >
              {loading ? <span className="ua-spinner" /> : '→ Analyze'}
            </button>
          </div>
          <div className="ua-input-hint">
            Checks logo, typography ratios, heading hierarchy, image placement, colour palette, navigation, CTAs, footer completeness, trust signals & more.
          </div>
        </div>
      </section>

      {/* ── LOADING ── */}
      {loading && (
        <div className="ua-loading">
          <div className="ua-loading-card">
            <div className="ua-ring-wrap">
              <div className="ua-ring-spin" />
              <span className="ua-loading-icon">{STEPS[loadStep]?.icon}</span>
            </div>
            <div className="ua-loading-text">{STEPS[loadStep]?.label}</div>
            <div className="ua-step-dots">
              {STEPS.map((_, i) => (
                <div key={i} className={`ua-dot ${i < loadStep ? 'done' : i === loadStep ? 'active' : ''}`} />
              ))}
            </div>
            <div className="ua-loading-url">{url}</div>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {error && !loading && (
        <div className="ua-error-wrap">
          <div className="ua-error-card">
            <span>⚠️</span>
            <div>
              <strong>Analysis Failed</strong>
              <p>{error}</p>
            </div>
            <button className="ua-retry-btn" onClick={handleAnalyze}>Retry</button>
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {r && !loading && (
        <section className="ua-results" id="overview">

          {/* Score banner */}
          <div className="ua-score-banner">
            <div className="ua-score-url">
              <span className="ua-url-dot" />
              {r.url}
              {r.pageTitle && <span className="ua-page-title"> · {r.pageTitle.slice(0, 55)}</span>}
            </div>

            <div className="ua-rings-row">
              <ScoreRing score={scores.overall ?? 0}       label="Overall"       size={155} />
              <div className="ua-ring-sep" />
              <ScoreRing score={scores.design ?? 0}        label="Design"        size={118} color="#00b894" />
              <ScoreRing score={scores.usability ?? 0}     label="Usability"     size={118} color="#3b82f6" />
              <ScoreRing score={scores.content ?? 0}       label="Content"       size={118} color="#f59e0b" />
              <ScoreRing score={scores.technical ?? 0}     label="Technical"     size={118} color="#8b5cf6" />
              <ScoreRing score={scores.accessibility ?? 0} label="Accessibility" size={118} color="#22c55e" />
              <ScoreRing score={scores.branding ?? 0}      label="Branding"      size={118} color="#0ea5e9" />
            </div>

            <div className="ua-pill-row">
              <span className="ua-pill crit">{critical} Critical</span>
              <span className="ua-pill med">{medium} Medium</span>
              <span className="ua-pill low">{low} Low</span>
              <span className="ua-pill total">{issues.length} Total Issues</span>
            </div>
          </div>

          {/* AI summary banner */}
          {ai?.summary && (
            <div className="ua-ai-banner">
              <span className="ua-ai-icon">🤖</span>
              <p>{ai.summary}</p>
              {ai.provider && <span className="ua-provider-tag">via {ai.provider}</span>}
            </div>
          )}

          {/* Strengths strip */}
          {ai?.strengths?.length > 0 && (
            <div className="ua-strengths-strip">
              {ai.strengths.map((s, i) => (
                <div key={i} className="ua-strength-chip">
                  <span className="ua-strength-check">✓</span>{s}
                </div>
              ))}
            </div>
          )}

          {/* Scrollable tab bar */}
          <div className="ua-tabs-scroll" id="analysis">
            <div className="ua-tabs-bar">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  className={`ua-tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="ua-tab-icon">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.id === 'issues' && issues.length > 0 && (
                    <span className="ua-tab-badge">{issues.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="ua-tab-content" id="issues">
            {renderTab()}
          </div>

          {/* Action bar */}
          <div className="ua-action-bar">
            <button className="ua-action-btn pdf-btn" onClick={() => downloadPDFReport(r._id)}>
              📄 Download Full PDF Report
            </button>
            <button className="ua-action-btn ai-btn" onClick={() => setActiveTab('ai')}>
              🤖 View AI Insights
            </button>
            <button className="ua-action-btn issues-btn" onClick={() => setActiveTab('issues')}>
              ⚠️ All Issues ({issues.length})
            </button>
            <button className="ua-action-btn new-btn"
              onClick={() => { setReport(null); setUrl(''); setError(''); }}>
              ↺ New Analysis
            </button>
          </div>

        </section>
      )}
    </div>
  );
}