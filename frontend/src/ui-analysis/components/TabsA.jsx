import { CheckRow, StatChip, SectionCard, AnimBar, IssueCard,
         ColorSwatches, HeadingLevel } from './Primitives';

const STRONG_CTA = ['get started','sign up','try','free','download','contact','book','order','buy','start','register','subscribe'];
const WEAK_CTA   = ['click here','here','submit','go','ok','yes'];

/* ══════════════════════════════════════════════════
   OVERVIEW TAB
══════════════════════════════════════════════════ */
export function OverviewTab({ r, issues, setActiveTab }) {
  const critical = issues.filter(i => i.severity === 'critical');
  const CARDS = [
    { label: 'Logo',           score: r.logo?.score,           icon: '🏷️', tab: 'logo' },
    { label: 'Typography',     score: r.typography?.score,     icon: '✍️', tab: 'typography' },
    { label: 'Colors',         score: r.colors?.score,         icon: '🎨', tab: 'colors' },
    { label: 'Images',         score: r.images?.score,         icon: '🖼️', tab: 'images' },
    { label: 'Layout',         score: r.layout?.score,         icon: '📐', tab: 'layout' },
    { label: 'Navigation',     score: r.navigation?.score,     icon: '🧭', tab: 'navigation' },
    { label: 'CTAs',           score: r.cta?.score,            icon: '🎯', tab: 'cta' },
    { label: 'Header/Footer',  score: r.headerFooter?.score,   icon: '🏠', tab: 'headerfooter' },
    { label: 'Content',        score: r.content?.score,        icon: '📋', tab: 'content' },
    { label: 'Technical',      score: r.technical?.score,      icon: '⚙️', tab: 'technical' },
    { label: 'Responsiveness', score: r.responsiveness?.score, icon: '📱', tab: 'technical' },
    { label: 'Consistency',    score: r.consistency?.score,    icon: '🔄', tab: 'ai' },
  ];

  return (
    <div className="ua-tab-panel">
      {/* Score grid */}
      <div className="ua-overview-grid">
        {CARDS.map(m => (
          <button key={m.label} className="ua-ov-card" onClick={() => setActiveTab(m.tab)}>
            <div className="ua-ov-icon">{m.icon}</div>
            <div className="ua-ov-label">{m.label}</div>
            <div className={`ua-ov-score ${(m.score ?? 0) >= 70 ? 'good' : (m.score ?? 0) >= 45 ? 'warn' : 'bad'}`}>
              {m.score ?? '—'}<span>/100</span>
            </div>
            <AnimBar score={m.score ?? 0} height={4} />
          </button>
        ))}
      </div>

      {/* Critical issues preview */}
      {critical.length > 0 && (
        <div className="ua-overview-issues">
          <div className="ua-sec-label">🔴 Critical Issues — Fix These First</div>
          {critical.slice(0, 5).map((issue, i) => <IssueCard key={i} issue={issue} />)}
          {critical.length > 5 && (
            <button className="ua-see-all" onClick={() => setActiveTab('issues')}>
              View all {critical.length} critical issues →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   LOGO TAB
══════════════════════════════════════════════════ */
export function LogoTab({ r, issues }) {
  const logo = r.logo || {};
  const logoIssues = issues.filter(i => i.category === 'logo');

  return (
    <div className="ua-tab-panel">
      <div className="ua-two-col">

        {/* Detection & placement */}
        <SectionCard title="Logo Detection & Placement" icon="🏷️" score={logo.score}>
          <CheckRow label="Logo Detected"         value={logo.detected ? 'Yes' : 'No'}                         good={logo.detected} />
          <CheckRow label="Placement"             value={logo.placement || 'N/A'}                               good={logo.placement !== 'none' && logo.placement !== 'unknown'} />
          <CheckRow label="Appears in Header"     value={logo.appearsInHeader ? 'Yes' : 'No'}                  good={logo.appearsInHeader} />
          <CheckRow label="Appears in Footer"     value={logo.appearsInFooter ? 'Yes' : 'No'} />
          <CheckRow label="Linked to Homepage"    value={logo.isLinkedToHome ? 'Yes' : 'No'}                   good={logo.isLinkedToHome} />
          <CheckRow label="Format"                value={logo.isSVG ? 'SVG (optimal)' : logo.isImage ? 'Raster image' : 'Unknown'} good={logo.isSVG} />
          <CheckRow label="Has Alt Text"          value={logo.hasAltText ? `"${logo.altText}"` : 'Missing'}    good={logo.hasAltText || logo.isSVG} />
          {logo.srcValue && (
            <div className="detail-row"><span>Src:</span><code className="detail-code">{logo.srcValue.slice(0, 55)}</code></div>
          )}
        </SectionCard>

        {/* Checklist guide */}
        <div>
          <div className="ua-guide-card">
            <div className="ua-guide-title">📌 Logo Best-Practice Checklist</div>
            {[
              { ok: logo.detected,          text: 'Logo element present on page' },
              { ok: logo.appearsInHeader,   text: 'Logo in <header> / navbar' },
              { ok: logo.isLinkedToHome,    text: 'Clicking logo goes to homepage' },
              { ok: logo.isSVG,             text: 'Using SVG (crisp at all resolutions)' },
              { ok: logo.hasAltText || logo.isSVG, text: 'Descriptive alt text provided' },
              { ok: logo.appearsInFooter,   text: 'Logo repeated in footer' },
              { ok: !logo.detected || logo.placement !== 'none', text: 'Consistent placement across pages' },
            ].map((g, i) => (
              <div key={i} className="guide-item">
                <span className={g.ok ? 'guide-dot pass' : 'guide-dot fail'} />
                <span>{g.text}</span>
              </div>
            ))}
          </div>

          {/* Why it matters */}
          <div className="ua-info-box">
            <div className="ua-info-title">Why Logo Placement Matters</div>
            <p>Studies show 86% of visitors expect the logo to be in the top-left corner and 73% expect it to link back to the homepage. SVG logos stay crisp on all screen densities and load faster than PNG. A logo in the footer reinforces brand identity on every page scroll.</p>
          </div>
        </div>
      </div>

      {logoIssues.length > 0 && (
        <div className="ua-issues-inline">
          <div className="ua-sec-label">Logo Issues</div>
          {logoIssues.map((iss, i) => <IssueCard key={i} issue={iss} />)}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   TYPOGRAPHY TAB
══════════════════════════════════════════════════ */
export function TypographyTab({ r, issues }) {
  const t = r.typography || {};
  const h = t.headings || {};
  const typoIssues = issues.filter(i => i.category === 'typography');

  return (
    <div className="ua-tab-panel">
      <div className="ua-two-col">

        {/* Font system */}
        <SectionCard title="Font System" icon="✍️" score={t.score}>
          {/* Font chips */}
          <div className="ua-sec-label">Detected Font Families</div>
          <div className="font-chips-row">
            {(t.fontFamilies || []).length > 0
              ? t.fontFamilies.map((f, i) => <span key={i} className="font-chip">{f}</span>)
              : <span className="muted-text">System/fallback fonts only</span>}
          </div>

          <div className="typography-stat-grid">
            <StatChip label="Families"      value={t.fontFamilyCount ?? 0}
              color={(t.fontFamilyCount ?? 0) <= 3 ? '#22c55e' : '#ef4444'}
              sub={(t.fontFamilyCount ?? 0) <= 3 ? '✓ ideal' : '⚠ too many'} />
            <StatChip label="Weights"       value={t.fontWeightsUsed?.length ?? 0}
              color={(t.fontWeightsUsed?.length ?? 0) >= 2 ? '#22c55e' : '#f59e0b'} />
            <StatChip label="Size Variants" value={t.fontSizesInCSS?.length ?? 0} />
            <StatChip label="Line Heights"  value={t.lineHeightValues?.length ?? 0}
              color={(t.lineHeightValues?.length ?? 0) >= 1 ? '#22c55e' : '#ef4444'} />
          </div>

          <CheckRow label="Google Fonts loaded"   value={t.googleFontsDetected ? 'Yes' : 'No'}        good={t.googleFontsDetected} />
          <CheckRow label="System fonts only"     value={t.systemFontsOnly ? 'Yes' : 'No'}             good={!t.systemFontsOnly} />
          <CheckRow label="Letter-spacing used"   value={t.letterSpacingUsed ? 'Yes' : 'No'}           good={t.letterSpacingUsed} />
          <CheckRow label="Text-transform used"   value={t.textTransformUsed ? 'Yes' : 'No'} />
          <CheckRow label="Font smoothing set"    value={t.fontSmoothing ? 'Yes' : 'No'}               good={t.fontSmoothing} />

          {t.fontWeightsUsed?.length > 0 && (
            <>
              <div className="ua-sec-label" style={{ marginTop: 10 }}>Font Weights</div>
              <div className="font-chips-row">
                {t.fontWeightsUsed.map((w, i) => <span key={i} className="font-chip">{w}</span>)}
              </div>
            </>
          )}

          {t.fontSizesInCSS?.length > 0 && (
            <>
              <div className="ua-sec-label" style={{ marginTop: 10 }}>Font Sizes in CSS</div>
              <div className="font-chips-row">
                {t.fontSizesInCSS.slice(0, 12).map((s, i) => <span key={i} className="font-chip small">{s}</span>)}
              </div>
            </>
          )}
        </SectionCard>

        {/* Heading hierarchy */}
        <SectionCard title="Heading Hierarchy & Ratios" icon="🏛️">
          {/* Ratio cards */}
          <div className="ratio-row">
            <div className="ratio-card">
              <div className="ratio-card-label">H1 → H2 Ratio</div>
              <div className="ratio-card-val">{h.h1ToH2Ratio || 'N/A'}</div>
              <div className="ratio-card-hint">Ideal: 1:3–1:6</div>
            </div>
            <div className="ratio-card">
              <div className="ratio-card-label">H2 → H3 Ratio</div>
              <div className="ratio-card-val">{h.h2ToH3Ratio || 'N/A'}</div>
              <div className="ratio-card-hint">Ideal: 1:2–1:4</div>
            </div>
            <div className="ratio-card">
              <div className="ratio-card-label">Total Headings</div>
              <div className="ratio-card-val">{h.totalCount ?? 0}</div>
            </div>
            <div className={`ratio-card ${h.hierarchyValid ? 'ratio-good' : 'ratio-bad'}`}>
              <div className="ratio-card-label">Hierarchy</div>
              <div className="ratio-card-val">{h.hierarchyValid ? '✓ Valid' : '✗ Issues'}</div>
            </div>
          </div>

          {/* Skipped levels warning */}
          {h.skippedLevels?.length > 0 && (
            <div className="warning-box">
              ⚠️ Skipped heading levels: {h.skippedLevels.join(' · ')}
            </div>
          )}

          {/* First H1 */}
          {h.firstH1Text && (
            <div className="first-h1-box">
              <span className="first-h1-label">First H1:</span>
              <span className="first-h1-text">&ldquo;{h.firstH1Text.slice(0, 70)}{h.firstH1Text.length > 70 ? '…' : ''}&rdquo;</span>
            </div>
          )}

          {/* Heading level table */}
          <div className="heading-table">
            <div className="heading-table-head">
              <span>Level</span><span>Count</span><span>Bar</span><span>First text preview</span>
            </div>
            {['h1','h2','h3','h4','h5','h6'].map(tag => (
              <HeadingLevel key={tag} tag={tag} data={h[tag]} />
            ))}
          </div>

          {/* Body text */}
          <div className="ua-sec-label" style={{ marginTop: 14 }}>Body Text Analysis</div>
          <div className="typography-stat-grid">
            <StatChip label="Word Count"      value={(t.bodyText?.wordCount ?? 0).toLocaleString()} />
            <StatChip label="Paragraphs"      value={t.bodyText?.paragraphCount ?? 0} />
            <StatChip label="Avg Words/Para"  value={t.bodyText?.avgWordsPerParagraph ?? 0}
              color={(t.bodyText?.avgWordsPerParagraph ?? 0) < 80 ? '#22c55e' : '#f59e0b'} />
            <StatChip label="Short Paras"     value={t.bodyText?.shortParagraphs ?? 0} />
          </div>
        </SectionCard>
      </div>

      {typoIssues.length > 0 && (
        <div className="ua-issues-inline">
          <div className="ua-sec-label">Typography Issues</div>
          {typoIssues.map((iss, i) => <IssueCard key={i} issue={iss} />)}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   COLORS TAB
══════════════════════════════════════════════════ */
export function ColorsTab({ r, issues }) {
  const c = r.colors || {};
  const colorIssues = issues.filter(i => i.category === 'color');

  return (
    <div className="ua-tab-panel">
      <div className="ua-two-col">

        <SectionCard title="Color Palette Analysis" icon="🎨" score={c.score}>
          <div className="typography-stat-grid">
            <StatChip label="Unique Colors" value={c.uniqueColorCount ?? 0}
              color={(c.uniqueColorCount ?? 0) <= 15 ? '#22c55e' : (c.uniqueColorCount ?? 0) <= 25 ? '#f59e0b' : '#ef4444'}
              sub={(c.uniqueColorCount ?? 0) <= 15 ? '✓ Consistent' : '⚠ Too many'} />
          </div>

          <div className="ua-sec-label" style={{ marginTop: 12 }}>Full Detected Palette</div>
          <ColorSwatches colors={c.rawColors} />

          <div className="ua-sec-label" style={{ marginTop: 12 }}>Background Colors</div>
          <ColorSwatches colors={c.backgroundColors} />

          <div className="ua-sec-label" style={{ marginTop: 10 }}>Text Colors</div>
          <ColorSwatches colors={c.textColors} />

          <div className="ua-sec-label" style={{ marginTop: 10 }}>Border Colors</div>
          <ColorSwatches colors={c.borderColors} />
        </SectionCard>

        <SectionCard title="Design System Signals" icon="🛠️">
          <CheckRow label="CSS Variables (--var)" value={c.cssVariablesUsed ? 'Used' : 'Not found'}          good={c.cssVariablesUsed} />
          <CheckRow label="Gradients"              value={c.gradientUsage ? 'Present' : 'None'}              good={c.gradientUsage} />
          <CheckRow label="Dark Mode (@prefers)"   value={c.darkModeSupport ? 'Supported' : 'Not found'}     good={c.darkModeSupport} />
          <CheckRow label="Consistent palette"     value={(c.uniqueColorCount ?? 0) <= 15 ? 'Yes' : 'Too many colours'} good={(c.uniqueColorCount ?? 0) <= 15} />

          {c.contrastIssues?.length > 0 && (
            <div className="warning-box" style={{ marginTop: 10 }}>
              ⚠️ {c.contrastIssues[0].issue}
            </div>
          )}

          <div className="ua-info-box" style={{ marginTop: 14 }}>
            <div className="ua-info-title">Colour Best Practices</div>
            <p><strong>Use 6–10 colours max:</strong> 1 primary, 1 accent, 3–4 neutral greys, semantic colours (green=success, red=error).</p>
            <p style={{ marginTop: 6 }}><strong>CSS variables</strong> let you change the whole palette in one place — essential for any maintainable design system.</p>
            <p style={{ marginTop: 6 }}><strong>Dark mode</strong> is now expected by 30–40% of users on modern devices.</p>
          </div>
        </SectionCard>
      </div>

      {colorIssues.length > 0 && (
        <div className="ua-issues-inline">
          <div className="ua-sec-label">Color Issues</div>
          {colorIssues.map((iss, i) => <IssueCard key={i} issue={iss} />)}
        </div>
      )}
    </div>
  );
}