import { useState, useEffect } from 'react';

/* ── Animated SVG score ring ── */
export function ScoreRing({ score = 0, label, size = 120, color }) {
  const [anim, setAnim] = useState(false);
  const R = 46, circ = 2 * Math.PI * R;
  const col = color || (score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444');
  useEffect(() => { const t = setTimeout(() => setAnim(true), 80); return () => clearTimeout(t); }, []);
  return (
    <div className="score-ring-wrap">
      <svg width={size} height={size} viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={R} fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <circle cx="55" cy="55" r={R} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={anim ? circ * (1 - score / 100) : circ}
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1)' }} />
        <text x="55" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0f172a"
          fontFamily="'Plus Jakarta Sans',sans-serif">{score}</text>
        <text x="55" y="66" textAnchor="middle" fontSize="8" fill="#94a3b8"
          fontFamily="'IBM Plex Mono',monospace">/100</text>
      </svg>
      {label && <div className="score-ring-label">{label}</div>}
    </div>
  );
}

/* ── Animated horizontal bar ── */
export function AnimBar({ score = 0, height = 6 }) {
  const [w, setW] = useState(0);
  const col = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444';
  useEffect(() => { const t = setTimeout(() => setW(score), 160); return () => clearTimeout(t); }, [score]);
  return (
    <div style={{ height, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ width: `${w}%`, height: '100%', background: col, borderRadius: 999,
        transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
    </div>
  );
}

/* ── Check / cross data row ── */
export function CheckRow({ label, value, good, mono }) {
  const isGood = typeof good === 'boolean' ? good : value !== false && value !== 'No' && value !== '✗' && !!value;
  return (
    <div className="check-row">
      <span className={`check-icon ${isGood ? 'pass' : 'fail'}`}>{isGood ? '✓' : '✗'}</span>
      <span className="check-label">{label}</span>
      {value !== undefined && (
        <span className={`check-value${mono ? ' mono' : ''}`}>{String(value)}</span>
      )}
    </div>
  );
}

/* ── Small stat chip ── */
export function StatChip({ label, value, sub, color = '#0f172a' }) {
  return (
    <div className="stat-chip">
      <div className="stat-chip-val" style={{ color }}>{value}</div>
      <div className="stat-chip-label">{label}</div>
      {sub && <div className="stat-chip-sub">{sub}</div>}
    </div>
  );
}

/* ── Section card wrapper ── */
export function SectionCard({ title, icon, score, children }) {
  return (
    <div className="section-card">
      <div className="section-card-head">
        <span className="section-card-icon">{icon}</span>
        <span className="section-card-title">{title}</span>
        {score !== undefined && (
          <span className={`section-card-score ${score >= 70 ? 'good' : score >= 45 ? 'warn' : 'bad'}`}>
            {score}<span>/100</span>
          </span>
        )}
      </div>
      {score !== undefined && <AnimBar score={score} />}
      <div className="section-card-body">{children}</div>
    </div>
  );
}

/* ── Issue accordion card ── */
export function IssueCard({ issue }) {
  const [open, setOpen] = useState(false);
  const C = { critical: '#ef4444', medium: '#f59e0b', low: '#3b82f6' };
  return (
    <div className={`issue-card issue-${issue.severity}`} onClick={() => setOpen(o => !o)}>
      <div className="issue-head">
        <span className="issue-sev-dot" style={{ background: C[issue.severity] }} />
        <span className="issue-sev-tag" style={{ color: C[issue.severity] }}>{issue.severity}</span>
        <span className="issue-cat-tag">{issue.category}</span>
        <span className="issue-title">{issue.title}</span>
        <span className="issue-chevron">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="issue-body">
          <p className="issue-desc">{issue.description}</p>
          {issue.recommendation && (
            <div className="issue-rec"><span>💡 Fix:</span> {issue.recommendation}</div>
          )}
          {issue.affectedElement && (
            <div className="issue-affected"><span>Element:</span> <code>{issue.affectedElement}</code></div>
          )}
          {issue.wcagReference && <div className="issue-wcag">{issue.wcagReference}</div>}
        </div>
      )}
    </div>
  );
}

/* ── Fix card ── */
export function FixCard({ fix, index }) {
  const PC = { high: '#ef4444', medium: '#f59e0b', low: '#3b82f6' };
  const EC = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
  return (
    <div className={`fix-card fix-${fix.priority}`}>
      <div className="fix-num">{String(index + 1).padStart(2, '0')}</div>
      <div className="fix-content">
        <div className="fix-head">
          <span className="fix-title">{fix.title}</span>
          <span className="fix-badge" style={{ background: `${PC[fix.priority]}18`, color: PC[fix.priority] }}>
            {fix.priority} priority
          </span>
          {fix.effort && (
            <span className="fix-badge" style={{ background: `${EC[fix.effort]}18`, color: EC[fix.effort] }}>
              {fix.effort} effort
            </span>
          )}
        </div>
        <p className="fix-desc">{fix.description}</p>
        {fix.impact && <div className="fix-impact">⚡ {fix.impact}</div>}
      </div>
    </div>
  );
}

/* ── Color swatch row ── */
export function ColorSwatches({ colors = [] }) {
  if (!colors?.length) return <span className="muted-text">None detected</span>;
  return (
    <div className="color-swatches">
      {colors.slice(0, 18).map((c, i) => (
        <div key={i} className="swatch-item">
          <div className="swatch-box" title={c} style={{ background: c }} />
          <div className="swatch-label">{c.slice(0, 9)}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Heading level row ── */
export function HeadingLevel({ tag, data }) {
  if (!data) return null;
  const pct = Math.min(100, data.count * 10);
  const col = tag === 'h1' ? '#e11d48' : tag === 'h2' ? '#3b82f6' : tag === 'h3' ? '#f59e0b' :
              tag === 'h4' ? '#22c55e' : '#94a3b8';
  return (
    <div className="heading-row">
      <span className="heading-tag" style={{ color: col }}>{tag.toUpperCase()}</span>
      <span className="heading-count">{data.count}</span>
      <div className="heading-bar-track">
        <div className="heading-bar-fill" style={{ width: `${pct}%`, background: col }} />
      </div>
      {data.texts?.[0] && (
        <span className="heading-preview">
          &ldquo;{data.texts[0].slice(0, 50)}{data.texts[0].length > 50 ? '…' : ''}&rdquo;
        </span>
      )}
    </div>
  );
}

/* ── Image placement breakdown ── */
export function PlacementBreakdown({ pb }) {
  if (!pb) return null;
  const C = { hero: '#e11d48', card: '#3b82f6', inline: '#22c55e',
              icon: '#f59e0b', background: '#a855f7', unknown: '#94a3b8' };
  const total = Object.values(pb).reduce((s, v) => s + v, 0) || 1;
  return (
    <div className="placement-grid">
      {Object.entries(pb).filter(([, v]) => v > 0).map(([k, v]) => (
        <div key={k} className="placement-chip">
          <div className="placement-dot" style={{ background: C[k] || '#94a3b8' }} />
          <span className="placement-label">{k}</span>
          <span className="placement-count">{v}</span>
          <span className="placement-pct">{Math.round((v / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}