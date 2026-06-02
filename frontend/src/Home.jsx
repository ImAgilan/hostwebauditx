import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import UserNav from './components/UserNav';
import './components/UserNav.css';


import AuditChatbot from './chatbot/AuditChatbot';

import './Home1.css';

const MODULES = [
  {
    id: 'ui',
    icon: '🎨',
    title: 'UI/UX Design Analysis',
    desc: 'Visual hierarchy, font contrast, CTA placement, heatmaps, and mobile vs desktop layout comparison.',
    count: '01',
    color: 'rgba(0,184,148,0.1)',
    label: 'UX Deep Dive →',
  },
  {
    id: 'mobile-friendliness',
    icon: '📱',
    title: 'Mobile-Friendliness',
    desc: 'Responsive layout checks, tap target sizing, gesture usability, and mobile speed metrics.',
    count: '02',
    color: 'rgba(59,130,246,0.1)',
    label: 'Mobile Ready Scan →',
  },
  {
    id: 'accessibility',
    icon: '♿',
    title: 'Accessibility & WCAG',
    desc: 'WCAG 2.1/2.2 scoring, alt text, ARIA roles, keyboard navigation, and screen reader tests.',
    count: '03',
    color: 'rgba(245,158,11,0.1)',
    label: 'a11y Audit →',
  },
  {
    id: 'seo',
    icon: '🔍',
    title: 'SEO & Content Analysis',
    desc: 'Meta tags, heading structure, keyword density, sitemap validation, and broken link detection.',
    count: '04',
    color: 'rgba(239,68,68,0.1)',
    label: 'SEO Health Check →',
  },
  {
    id: 'performance',
    icon: '⚡',
    title: 'Performance Testing',
    desc: 'Lighthouse scores, LCP, CLS, TBT, load time, image optimization, and JS/CSS analysis.',
    count: '05',
    color: 'rgba(168,85,247,0.1)',
    label: 'Performance Scan →',
  },
  {
    id: 'security',
    icon: '🔐',
    title: 'Security & HTTPS',
    desc: 'SSL certificate validity, security headers, malware scanning, and CMS vulnerability checks.',
    count: '06',
    color: 'rgba(0,184,148,0.1)',
    label: 'Security Audit →',
  },
  {
    id: 'content-quality',
    icon: '⭐',
    title: 'Content Quality',
    desc: 'Testimonials, trust badges, contact info presence, live chat, and review integrations.',
    count: '07',
    color: 'rgba(59,130,246,0.1)',
    label: 'Content Review →',
  },
  {
    id: 'structure-navigation',
    icon: '🗺️',
    title: 'Structure & Navigation',
    desc: 'Full site crawl, menu analysis, breadcrumbs, orphaned pages, and blog section checks.',
    count: '08',
    color: 'rgba(245,158,11,0.1)',
    label: 'Site Structure Audit →',
  },
  {
    id: 'technical-insight',
    icon: '🔧',
    title: 'Technical Insights',
    desc: 'Domain authority, spam score, backlink analysis, CMS detection, and schema markup validation.',
    count: '09',
    color: 'rgba(239,68,68,0.1)',
    label: 'Tech Stack Scan →',
  },
];

const STATS = [
  { num: '25', suffix: '+', label: 'Audit Features' },
  { num: '3', suffix: 's', label: 'Avg. Scan Time' },
  { num: '98', suffix: '%', label: 'Accuracy Rate' },
  { num: '5', suffix: 'k+', label: 'Sites Audited' },
];

const STEPS = [
  { num: '01', title: 'Submit Your URL', desc: 'Paste any public website URL into the audit input bar. No account required for basic scans.' },
  { num: '02', title: 'Automated Analysis', desc: 'Our engine runs 25+ checks across performance, SEO, security, UX, and accessibility simultaneously.' },
  { num: '03', title: 'AI Generates Insights', desc: 'GPT-powered AI translates raw data into plain-English summaries and prioritized fix lists.' },
  { num: '04', title: 'Download & Track', desc: 'Export branded PDF reports, share with clients, and track improvements over time.' },
];

const TESTIMONIALS = [
  {
    stars: '★★★★★',
    text: 'WebAudit X replaced 6 different tools we were using. The AI suggestions alone saved us 3 hours per client report. Absolutely game-changing for our agency.',
    initials: 'DK',
    name: 'Dilshan Karunarathne',
    role: 'Digital Agency Owner, Colombo',
    gradient: 'linear-gradient(135deg,var(--accent2),var(--accent))',
    highlight: false,
  },
  {
    stars: '★★★★★',
    text: "As a developer who hates manual site checks, this is exactly what I needed. The security headers report caught a critical vulnerability I'd missed for months.",
    initials: 'SP',
    name: 'Sanjay Perera',
    role: 'Full Stack Developer, Sri Lanka',
    gradient: 'linear-gradient(135deg,var(--accent),#00b4d8)',
    highlight: true,
  },
  {
    stars: '★★★★★',
    text: 'Our non-technical clients can finally understand their website health. The plain-English AI reports have made client communication so much smoother.',
    initials: 'RJ',
    name: 'Ruwanthi Jayawardena',
    role: 'Marketing Consultant',
    gradient: 'linear-gradient(135deg,var(--accent3),#f97316)',
    highlight: false,
  },
];

<AuditChatbot />

export default function Home() {
  const navigate = useNavigate();
  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const mxRef = useRef(0);
  const myRef = useRef(0);
  const rxRef = useRef(0);
  const ryRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    // Custom cursor
    const cursor = cursorRef.current;
    const ring = ringRef.current;
    if (!cursor || !ring) return;

    const onMove = (e) => {
      mxRef.current = e.clientX;
      myRef.current = e.clientY;
      cursor.style.transform = `translate(${e.clientX - 5}px, ${e.clientY - 5}px)`;
    };
    document.addEventListener('mousemove', onMove);

    const animateRing = () => {
      rxRef.current += (mxRef.current - rxRef.current - 17) * 0.15;
      ryRef.current += (myRef.current - ryRef.current - 17) * 0.15;
      ring.style.transform = `translate(${rxRef.current}px, ${ryRef.current}px)`;
      rafRef.current = requestAnimationFrame(animateRing);
    };
    animateRing();

    // Hover expand
    const interactives = document.querySelectorAll('a, button, .feature-cardLP, .price-cardLP, .dash-nav-itemLP, .module-cardLP');
    const enter = () => { ring.style.width = '54px'; ring.style.height = '54px'; ring.style.borderColor = 'rgba(0,184,148,0.8)'; };
    const leave = () => { ring.style.width = '34px'; ring.style.height = '34px'; ring.style.borderColor = 'var(--accent)'; };
    interactives.forEach(el => { el.addEventListener('mouseenter', enter); el.addEventListener('mouseleave', leave); });

    // Scroll reveal
    const reveals = document.querySelectorAll('.revealLP');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) setTimeout(() => entry.target.classList.add('visibleLP'), i * 80);
      });
    }, { threshold: 0.1 });
    reveals.forEach(el => observer.observe(el));

    // Nav scroll
    const onScroll = () => {
      const nav = document.querySelector('.wax-navLP');
      if (nav) nav.style.borderBottomColor = window.scrollY > 40 ? 'rgba(0,184,148,0.2)' : 'rgba(0,0,0,0.08)';
    };
    window.addEventListener('scroll', onScroll);

    // Placeholder cycling
    const placeholders = ['example-business.lk', 'yourcompany.com', 'myclient-website.com', 'startup-landing.io'];
    let pi = 0;
    const urlInput = document.querySelector('.url-inputLP');
    const interval = setInterval(() => {
      pi = (pi + 1) % placeholders.length;
      if (urlInput) urlInput.setAttribute('placeholder', placeholders[pi]);
    }, 2800);

    // Score bar animation
    const scoreObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.score-bar-fillLP').forEach(bar => {
            const w = bar.style.width;
            bar.style.width = '0';
            setTimeout(() => { bar.style.width = w; }, 100);
          });
          entry.target.querySelectorAll('.bar-fillLP').forEach(bar => {
            const h = bar.style.height;
            bar.style.height = '0';
            setTimeout(() => { bar.style.height = h; }, 200);
          });
        }
      });
    }, { threshold: 0.3 });
    document.querySelectorAll('.dash-scoresLP, .bar-chartLP').forEach(el => scoreObs.observe(el));

    return () => {
      document.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
      clearInterval(interval);
      observer.disconnect();
      scoreObs.disconnect();
      interactives.forEach(el => { el.removeEventListener('mouseenter', enter); el.removeEventListener('mouseleave', leave); });
    };
  }, []);

  const handleModuleClick = (moduleId) => {
    navigate(`/${moduleId}`);
  };

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };





const [auditUrl, setAuditUrl] = useState('');
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState('');




const handleRunAudit = async () => {
  if (!auditUrl.trim()) return;

  const token = localStorage.getItem('wax_token');
  if (!token) { navigate('/auth'); return; }

  setIsLoading(true);
  setError('');
  try {
    const fullUrl = auditUrl.startsWith('http') ? auditUrl : `https://${auditUrl}`;
    const res = await fetch('http://localhost:5000/api/full-audit/analyze', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ url: fullUrl }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    navigate(`/audit/${data.auditId}`);
  } catch (err) {
    setError(err.message || 'Audit failed. Please try again.');
  } finally {
    setIsLoading(false);
  }
};

  return (
    <>
      {/* Custom Cursor */}
      <div className="cursorLP" ref={cursorRef}></div>
      <div className="cursor-ringLP" ref={ringRef}></div>

      {/* NAV */}
      <nav className="wax-navLP">
  <a href="#home" className="nav-logoLP" onClick={e => { e.preventDefault(); scrollTo('home'); }}>
    WebAudit<span style={{ color: 'var(--accent)' }}>X</span>
    <span className="logo-badgeLP">BETA</span>
  </a>
  <ul className="nav-linksLP">
    <li><a href="#features"     onClick={e => { e.preventDefault(); scrollTo('features'); }}>Features</a></li>
    <li><a href="#how"          onClick={e => { e.preventDefault(); scrollTo('how'); }}>How it Works</a></li>
    <li><a href="#dashboard"    onClick={e => { e.preventDefault(); scrollTo('dashboard'); }}>Dashboard</a></li>
    <li><a href="#pricing"      onClick={e => { e.preventDefault(); scrollTo('pricing'); }}>Pricing</a></li>
    <li><a href="#testimonials" onClick={e => { e.preventDefault(); scrollTo('testimonials'); }}>Reviews</a></li>
  </ul>
  {/* ← ONLY THIS DIV CHANGES — replaces the old nav-ctaLP div */}
  <div className="nav-ctaLP">
    <UserNav onSignInClick={() => navigate('/auth')} />
  </div>
</nav>

      {/* HERO */}
      <section className="heroLP" id="home">
        <div className="hero-gridLP"></div>
        <div className="hero-orb1LP"></div>
        <div className="hero-orb2LP"></div>

        <span className="hero-tagLP">✦ AI-POWERED · WEB INTELLIGENCE PLATFORM</span>

        <h1 className="hero-titleLP">
          Audit any website.<br />
          <span className="accent-wordLP">Fix everything.</span><br />
          Dominate the web.
        </h1>

        <p className="hero-subLP">
          Enter a URL and get a complete 360° audit in seconds — SEO, performance, security,
          UX, accessibility and more. Powered by real AI.
        </p>

        

        <div className="url-bar-wrapperLP">
  <div className="url-barLP">
    <span className="url-prefixLP">https://</span>
    <input
      className="url-inputLP"
      type="text"
      placeholder="yourwebsite.com"
      value={auditUrl}
      onChange={e => setAuditUrl(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && handleRunAudit()}
      disabled={isLoading}
    />
    <button
      className="url-submitLP"
      onClick={handleRunAudit}
      disabled={isLoading}
      style={{ opacity: isLoading ? 0.7 : 1 }}
    >
      {isLoading ? '⏳ Scanning...' : '→ Run Audit'}
    </button>
  </div>
  {isLoading && (
    <div style={{ color: '#00b894', fontSize: '0.85rem', marginTop: '12px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace' }}>
      🔍 Running 9-module audit... This may take 20–30 seconds
    </div>
  )}
  {error && (
    <div style={{ color: '#e74c3c', fontSize: '0.85rem', marginTop: '8px', textAlign: 'center' }}>
      ⚠️ {error}
    </div>
  )}
        </div>





        <div className="hero-actionsLP">
          <a href="#features" className="btn-heroLP" onClick={e => { e.preventDefault(); scrollTo('features'); }}>Get Started Free</a>
          <a href="#dashboard" className="btn-hero-outlineLP" onClick={e => { e.preventDefault(); scrollTo('dashboard'); }}>
            <span className="play-iconLP">▶</span>
            See Live Demo
          </a>
        </div>

        <div className="hero-statsLP">
          {STATS.map((s, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <div className="stat-itemLP">
                <div className="stat-numLP">{s.num}<span>{s.suffix}</span></div>
                <div className="stat-labelLP">{s.label}</div>
              </div>
              {i < STATS.length - 1 && <div className="stat-dividerLP"></div>}
            </div>
          ))}
        </div>
      </section>

      {/* LOGOS MARQUEE */}
      <div className="logos-sectionLP">
        <div className="logos-labelLP">Trusted by teams building with</div>
        <div className="marquee-wrapperLP">
          <div className="marquee-trackLP">
            {['WordPress','Shopify','Google Analytics','GitHub','Slack','Figma','Ahrefs','Lighthouse','Moz','SEMrush','AWS','Vercel',
              'WordPress','Shopify','Google Analytics','GitHub','Slack','Figma','Ahrefs','Lighthouse','Moz','SEMrush','AWS','Vercel'].map((t, i) => (
              <span key={i} className="logo-chipLP">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURES / MODULES */}
      <section className="features-sectionLP" id="features">
        <div className="section-innerLP">
          <div className="features-headerLP">
            <div>
              <div className="section-tagLP">AUDIT MODULES</div>
              <h2 className="section-titleLP">Everything your site needs, in one audit</h2>
            </div>
            <p className="section-subLP">
              9 powerful audit modules across all major categories. From Core Web Vitals to security
              headers — nothing escapes WebAuditX.
            </p>
          </div>

          <div className="features-gridLP revealLP">
            {MODULES.map((mod) => (
              <div
                key={mod.id}
                className="feature-cardLP module-cardLP"
                onClick={() => handleModuleClick(mod.id)}
                title={`Open ${mod.title} module`}
              >
                <div className="feature-iconLP" style={{ background: mod.color }}>{mod.icon}</div>
                <h3>{mod.title}</h3>
                <p>{mod.desc}</p>
                <span className="feature-countLP">{mod.count}</span>
                <div style={{ textAlign: 'center', marginTop: '32px' }}>
                  <button className="module-btnLP">{mod.label}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DASHBOARD PREVIEW */}
      <section className="dashboard-sectionLP" id="dashboard">
        <div className="section-innerLP">
          <div className="section-tagLP">DASHBOARD</div>
          <h2 className="section-titleLP revealLP">Your audit results, <span style={{ color: 'var(--accent)' }}>crystal clear</span></h2>
          <p className="section-subLP revealLP">A full-featured interactive dashboard with scores, issues, charts, and AI recommendations — all in one place.</p>

          <div className="dash-layoutLP revealLP">
            {/* Sidebar */}
            <div className="dash-sidebarLP">
              <div className="dash-logoLP">WebAudit<span style={{ color: 'var(--accent)' }}>X</span></div>
              <div className="dash-nav-sectionLP">MAIN</div>
              <div className="dash-nav-itemLP activeLP"><span className="dash-nav-iconLP">📊</span> Overview</div>
              <div className="dash-nav-itemLP"><span className="dash-nav-iconLP">🔍</span> Audits</div>
              <div className="dash-nav-itemLP"><span className="dash-nav-iconLP">📋</span> Reports</div>
              <div className="dash-nav-itemLP"><span className="dash-nav-iconLP">🤖</span> AI Assistant</div>
              <div className="dash-nav-sectionLP">ANALYSIS</div>
              <div className="dash-nav-itemLP"><span className="dash-nav-iconLP">⚡</span> Performance</div>
              <div className="dash-nav-itemLP"><span className="dash-nav-iconLP">🔍</span> SEO</div>
              <div className="dash-nav-itemLP"><span className="dash-nav-iconLP">🔐</span> Security</div>
              <div className="dash-nav-itemLP"><span className="dash-nav-iconLP">♿</span> Accessibility</div>
              <div className="dash-nav-sectionLP">SETTINGS</div>
              <div className="dash-nav-itemLP"><span className="dash-nav-iconLP">⚙️</span> Settings</div>
              <div className="dash-nav-itemLP"><span className="dash-nav-iconLP">👥</span> Team</div>
            </div>

            {/* Main Panel */}
            <div className="dash-mainLP">
              <div className="dash-topbarLP">
                <div>
                  <div className="dash-topbar-titleLP">example-business.lk</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '3px', fontFamily: 'IBM Plex Mono, monospace' }}>Last audited: 2 hours ago</div>
                </div>
                <div className="dash-topbar-rightLP">
                  <div className="dash-schedule-btnLP">📅 Schedule</div>
                  <div className="dash-btn-smLP">↻ Re-audit</div>
                </div>
              </div>

              <div className="dash-scoresLP">
                {[
                  { label: 'PERFORMANCE', value: 87, color: '#22c55e', bar: 'linear-gradient(90deg,#22c55e,rgba(34,197,94,0.4))', trend: '↑ +12 from last audit', up: true },
                  { label: 'SEO SCORE', value: 73, color: 'var(--accent)', bar: 'linear-gradient(90deg,var(--accent),rgba(0,184,148,0.4))', trend: '↑ +5 from last audit', up: true },
                  { label: 'ACCESSIBILITY', value: 61, color: 'var(--accent3)', bar: 'linear-gradient(90deg,var(--accent3),rgba(245,158,11,0.4))', trend: '↓ -3 from last audit', up: false },
                  { label: 'SECURITY', value: 44, color: 'var(--warn)', bar: 'linear-gradient(90deg,var(--warn),rgba(239,68,68,0.4))', trend: '↓ Needs attention', up: false },
                ].map((s, i) => (
                  <div key={i} className="score-cardLP">
                    <div className="score-labelLP">{s.label}</div>
                    <div className="score-valueLP" style={{ color: s.color }}>{s.value}</div>
                    <div className="score-barLP"><div className="score-bar-fillLP" style={{ width: `${s.value}%`, background: s.bar }}></div></div>
                    <div className={`score-trendLP ${s.up ? 'upLP' : 'downLP'}`}>{s.trend}</div>
                  </div>
                ))}
              </div>

              <div className="dash-bottomLP">
                <div className="dash-panelLP">
                  <div className="panel-titleLP">
                    Critical Issues
                    <span className="panel-badgeLP">7 FOUND</span>
                  </div>
                  {[
                    { dot: 'var(--warn)', text: 'Missing SSL security headers (CSP, HSTS)', level: 'HIGH', bg: 'rgba(239,68,68,0.1)', color: 'var(--warn)' },
                    { dot: 'var(--warn)', text: 'LCP exceeds 4s on mobile devices', level: 'HIGH', bg: 'rgba(239,68,68,0.1)', color: 'var(--warn)' },
                    { dot: 'var(--accent3)', text: '14 images missing alt text attributes', level: 'MED', bg: 'rgba(245,158,11,0.1)', color: 'var(--accent3)' },
                    { dot: 'var(--accent3)', text: 'No H1 tag on 3 landing pages', level: 'MED', bg: 'rgba(245,158,11,0.1)', color: 'var(--accent3)' },
                    { dot: 'var(--accent2)', text: 'robots.txt disallowing 2 key pages', level: 'LOW', bg: 'rgba(59,130,246,0.1)', color: 'var(--accent2)' },
                  ].map((item, i) => (
                    <div key={i} className="issue-itemLP">
                      <div className="issue-dotLP" style={{ background: item.dot }}></div>
                      <div className="issue-textLP">{item.text}</div>
                      <div className="issue-levelLP" style={{ background: item.bg, color: item.color }}>{item.level}</div>
                    </div>
                  ))}
                </div>

                <div className="dash-panelLP">
                  <div className="panel-titleLP">
                    Score History
                    <span className="panel-badgeLP" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent2)' }}>6 MONTHS</span>
                  </div>
                  <div className="bar-chartLP">
                    {[
                      { h: '40px', label: 'Oct', accent: false },
                      { h: '52px', label: 'Nov', accent: false },
                      { h: '44px', label: 'Dec', accent: true },
                      { h: '58px', label: 'Jan', accent: false },
                      { h: '68px', label: 'Feb', accent: true },
                      { h: '76px', label: 'Mar', accent: false },
                    ].map((b, i) => (
                      <div key={i} className="bar-colLP">
                        <div className={`bar-fillLP${b.accent ? ' accentLP' : ''}`} style={{ height: b.h }}></div>
                        <div className="bar-labelLP">{b.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-sectionLP" id="how">
        <div className="section-innerLP">
          <div style={{ textAlign: 'center' }}>
            <div className="section-tagLP" style={{ justifyContent: 'center' }}>HOW IT WORKS</div>
            <h2 className="section-titleLP revealLP">From URL to insights in <span style={{ color: 'var(--accent)' }}>4 steps</span></h2>
            <p className="section-subLP revealLP" style={{ margin: '0 auto' }}>Simple enough for non-technical users, deep enough for engineers.</p>
          </div>
          <div className="steps-wrapperLP revealLP">
            {STEPS.map((s) => (
              <div key={s.num} className="step-itemLP">
                <div className="step-numLP">{s.num}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI SECTION */}
      <section className="ai-sectionLP" id="ai">
        <div className="section-innerLP">
          <div className="ai-gridLP">
            <div>
              <div className="section-tagLP">AI ASSISTANT</div>
              <h2 className="section-titleLP revealLP">Your site&apos;s personal <span style={{ color: 'var(--accent)' }}>AI analyst</span></h2>
              <p className="section-subLP revealLP" style={{ marginBottom: '36px' }}>
                No more decoding technical jargon. Our AI explains every issue and tells you exactly what to fix — in simple terms.
              </p>
              <ul className="ai-features-listLP revealLP">
                {[
                  { icon: '📝', color: 'rgba(0,184,148,0.1)', title: 'AI Audit Summaries', desc: 'Auto-generated plain-English summary of your entire audit with key takeaways.' },
                  { icon: '🔧', color: 'rgba(59,130,246,0.1)', title: 'Smart Fix Suggestions', desc: 'Prioritized list of fixes with step-by-step instructions tailored to your CMS.' },
                  { icon: '✨', color: 'rgba(245,158,11,0.1)', title: 'Auto Content Rewrite', desc: 'Poor meta tags or content? AI rewrites them instantly for better SEO performance.' },
                  { icon: '💬', color: 'rgba(168,85,247,0.1)', title: 'AI Chatbot', desc: 'Ask any question about your audit results and get intelligent, contextual answers.' },
                ].map((f, i) => (
                  <li key={i}>
                    <div className="ai-iconLP" style={{ background: f.color }}>{f.icon}</div>
                    <div className="ai-feature-textLP">
                      <h4>{f.title}</h4>
                      <p>{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ai-visualLP revealLP">
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '20px', letterSpacing: '1px' }}>AI ASSISTANT · LIVE CHAT</div>
              <div className="chat-msgLP">
                <div className="chat-avatarLP userLP">U</div>
                <div className="chat-bubbleLP">Why is my LCP score so low? What should I fix first?</div>
              </div>
              <div className="chat-msgLP" style={{ flexDirection: 'row-reverse' }}>
                <div className="chat-avatarLP aiLP">X</div>
                <div className="chat-bubbleLP ai-bubbleLP">
                  Your <span className="highlightLP">LCP of 4.2s</span> is mainly caused by 3 uncompressed hero images (total 2.4MB). I recommend:
                  <br /><br />
                  1. Convert images to <span className="highlightLP">WebP format</span> — saves ~68%<br />
                  2. Add <span className="highlightLP">lazy loading</span> to below-fold images<br />
                  3. Enable <span className="highlightLP">browser caching</span> headers
                  <br /><br />
                  This should bring your LCP under 2.5s. Want me to generate the code?
                </div>
              </div>
              <div className="chat-msgLP">
                <div className="chat-avatarLP userLP">U</div>
                <div className="chat-bubbleLP">Yes, generate the WordPress code for image optimization</div>
              </div>
              <div className="chat-msgLP" style={{ flexDirection: 'row-reverse', alignItems: 'flex-start' }}>
                <div className="chat-avatarLP aiLP">X</div>
                <div className="chat-bubbleLP ai-bubbleLP">
                  <div className="typing-indicatorLP">
                    <div className="typing-dotLP"></div>
                    <div className="typing-dotLP"></div>
                    <div className="typing-dotLP"></div>
                  </div>
                </div>
              </div>
              <div className="ai-code-blockLP">
                <div className="ai-code-labelLP">PHP · functions.php</div>
                <div className="ai-code-bodyLP">
                  {`add_filter('wp_get_attachment_image_attributes',\n  function($attr) {\n    $attr['loading'] = 'lazy';\n    return $attr;\n  });\nadd_theme_support('webp-uploads');`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing-sectionLP" id="pricing">
        <div className="section-innerLP">
          <div style={{ textAlign: 'center' }}>
            <div className="section-tagLP" style={{ justifyContent: 'center' }}>PRICING</div>
            <h2 className="section-titleLP revealLP">Simple, transparent pricing</h2>
            <p className="section-subLP revealLP" style={{ margin: '0 auto' }}>Start free. Scale as you grow. No hidden fees — ever.</p>
          </div>
          <div className="pricing-gridLP revealLP">
            {/* Starter */}
            <div className="price-cardLP">
              <div className="price-planLP">Starter</div>
              <div className="price-amountLP"><sup>$</sup>0</div>
              <div className="price-periodLP">Free forever — no credit card</div>
              <div className="price-dividerLP"></div>
              <ul className="price-featuresLP">
                {['5 audits per month','Basic SEO & performance check','PDF report export','Mobile-friendliness test'].map(f => <li key={f}><span className="checkLP">✓</span> {f}</li>)}
                {['AI fix suggestions','Scheduled monitoring','Team collaboration'].map(f => <li key={f}><span className="xLP">✗</span> {f}</li>)}
              </ul>
              <a
  href="#"
  className="price-btnLP outlineLP"
  onClick={e => { e.preventDefault(); navigate('/auth?mode=register'); }}
>
  Get Started Free
</a>
            </div>
            {/* Pro */}
            <div className="price-cardLP popularLP">
              <div className="popular-badgeLP">MOST POPULAR</div>
              <div className="price-planLP" style={{ color: 'var(--accent)' }}>Professional</div>
              <div className="price-amountLP"><sup>$</sup>29<span style={{ fontSize: '1.2rem', fontWeight: 400, color: 'var(--muted)' }}>/mo</span></div>
              <div className="price-periodLP">Billed monthly · cancel anytime</div>
              <div className="price-dividerLP"></div>
              <ul className="price-featuresLP">
                {['Unlimited audits','All 9 audit modules','AI summaries & fix suggestions','Scheduled monitoring','White-label PDF reports','Competitor comparison'].map(f => <li key={f}><span className="checkLP">✓</span> {f}</li>)}
                {['Custom integrations'].map(f => <li key={f}><span className="xLP">✗</span> {f}</li>)}
              </ul>
             <a
  href="#"
  className="price-btnLP filledLP"
  onClick={e => { e.preventDefault(); navigate('/payment?plan=pro'); }}
>
  Start 14-Day Trial
</a>
            </div>
            {/* Agency */}
            <div className="price-cardLP">
              <div className="price-planLP">Agency</div>
              <div className="price-amountLP"><sup>$</sup>89<span style={{ fontSize: '1.2rem', fontWeight: 400, color: 'var(--muted)' }}>/mo</span></div>
              <div className="price-periodLP">Per team · up to 10 members</div>
              <div className="price-dividerLP"></div>
              <ul className="price-featuresLP">
                {['Everything in Professional','Client portals','Custom integrations (API)','Priority support','ROI estimator','Voice command assistant','Zapier / Make workflows'].map(f => <li key={f}><span className="checkLP">✓</span> {f}</li>)}
              </ul>
              <a
  href="#"
  className="price-btnLP outlineLP"
  onClick={e => { e.preventDefault(); navigate('/payment?plan=premium'); }}
>
  Upgrade to Agency
</a>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials-sectionLP" id="testimonials">
        <div className="section-innerLP">
          <div style={{ textAlign: 'center' }}>
            <div className="section-tagLP" style={{ justifyContent: 'center' }}>TESTIMONIALS</div>
            <h2 className="section-titleLP revealLP">Loved by developers, <span style={{ color: 'var(--accent)' }}>trusted by agencies</span></h2>
          </div>
          <div className="testimonials-gridLP revealLP">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="testi-cardLP" style={t.highlight ? { borderColor: 'rgba(0,184,148,0.2)' } : {}}>
                <div className="testi-starsLP">{t.stars}</div>
                <div className="testi-quoteLP">&ldquo;</div>
                <div className="testi-textLP">{t.text}</div>
                <div className="testi-authorLP">
                  <div className="testi-avatarLP" style={{ background: t.gradient }}>{t.initials}</div>
                  <div>
                    <div className="testi-nameLP">{t.name}</div>
                    <div className="testi-roleLP">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-sectionLP">
        <div className="section-innerLP">
          <div className="cta-innerLP">
            <h2 className="cta-titleLP revealLP">Ready to fix your<br /><span style={{ color: 'var(--accent)' }}>website today?</span></h2>
            <p className="cta-subLP revealLP">Join thousands of businesses using WebAuditX to build faster, safer, and smarter websites.</p>
            <div className="cta-actionsLP revealLP">
              <a href="#features" className="btn-heroLP" onClick={e => { e.preventDefault(); scrollTo('features'); }}>Start Free Audit</a>
              <a href="#pricing" className="btn-hero-outlineLP" onClick={e => { e.preventDefault(); scrollTo('pricing'); }}>View Pricing</a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="section-innerLP">
          <div className="footer-innerLP">
            <div className="footer-brandLP">
              <div className="nav-logoLP" style={{ display: 'inline-flex', textDecoration: 'none' }}>
                WebAudit<span style={{ color: 'var(--accent)' }}>X</span>
                <span className="logo-badgeLP">BETA</span>
              </div>
              <p>An AI-powered comprehensive web auditing and optimization system. Built by Group No. 5, Open University of Sri Lanka.</p>
            </div>
            <div className="footer-colLP">
              <h4>Product</h4>
              <ul>
                {['Features','Pricing','Dashboard','API Docs','Chrome Extension'].map(l => <li key={l}><a href="#">{l}</a></li>)}
              </ul>
            </div>
            <div className="footer-colLP">
              <h4>Audit Modules</h4>
              <ul>
                {MODULES.slice(0, 5).map(m => <li key={m.id}><a href="#" onClick={e => { e.preventDefault(); handleModuleClick(m.id); }}>{m.title}</a></li>)}
              </ul>
            </div>
            <div className="footer-colLP">
              <h4>Company</h4>
              <ul>
                {['About','Team','Blog','Privacy Policy','Terms of Service'].map(l => <li key={l}><a href="#">{l}</a></li>)}
              </ul>
            </div>
          </div>
          <div className="footer-bottomLP">
            <div className="footer-copyLP">© 2025 WebAudit X · Group No. 5 · OUSL BSE Final Project</div>
            <div className="footer-socialsLP">
              {['𝕏','in','gh','fb'].map(s => <a key={s} href="#" className="social-linkLP">{s}</a>)}
            </div>
          </div>
        </div>
      </footer>
        
        <AuditChatbot />

    </>
  );
}