import { CheckRow, StatChip, SectionCard, IssueCard, FixCard } from './Primitives';

/* ══════════════════════════════════════════════════
   CONTENT TAB
══════════════════════════════════════════════════ */
export function ContentTab({ r, issues }) {
  const c  = r.content || {};
  const sp = c.socialProof || {};
  const ts = c.trustSignals || {};
  const ci = c.contactInfo || {};
  const contentIssues = issues.filter(i => i.category === 'content');

  return (
    <div className="ua-tab-panel">
      <div className="ua-three-col">

        <SectionCard title="Page Section Presence" icon="📋" score={c.score}>
          <CheckRow label="Hero section"        value={c.hasHeroSection ? 'Yes' : '✗ No'}          good={c.hasHeroSection} />
          <CheckRow label="Hero has H1"         value={c.heroHasHeading ? 'Yes' : '✗ No'}           good={c.heroHasHeading} />
          <CheckRow label="Hero has CTA"        value={c.heroHasCTA ? 'Yes' : '✗ No'}               good={c.heroHasCTA} />
          <CheckRow label="Hero has image"      value={c.heroHasImage ? 'Yes' : 'No'}               good={c.heroHasImage} />
          <CheckRow label="Hero subheadline"    value={c.heroHasSubheadline ? 'Yes' : 'No'} />
          <CheckRow label="About section"       value={c.hasAboutSection ? 'Yes' : 'No'} />
          <CheckRow label="Services section"    value={c.hasServicesSection ? 'Yes' : 'No'} />
          <CheckRow label="Pricing section"     value={c.hasPricingSection ? 'Yes' : 'No'} />
          <CheckRow label="Testimonials"        value={c.hasTestimonialsSection ? `Yes (${sp.testimonialCount})` : '✗ No'} good={c.hasTestimonialsSection} />
          <CheckRow label="FAQ section"         value={c.hasFAQSection ? 'Yes' : 'No'} />
          <CheckRow label="Contact section"     value={c.hasContactSection ? 'Yes' : '✗ No'}        good={c.hasContactSection} />
          <CheckRow label="Blog / News"         value={c.hasBlogSection ? 'Yes' : 'No'} />
          <CheckRow label="Team section"        value={c.hasTeamSection ? 'Yes' : 'No'} />

          <div className="ua-sec-label" style={{ marginTop: 12 }}>Content Volume</div>
          <div className="typography-stat-grid">
            <StatChip label="Word Count"   value={(c.wordCount ?? 0).toLocaleString()} />
            <StatChip label="Paragraphs"   value={c.paragraphCount ?? 0} />
          </div>
        </SectionCard>

        <SectionCard title="Social Proof & Trust Signals" icon="⭐">
          <div className="ua-sec-label">Social Proof</div>
          <CheckRow label="Testimonials"      value={sp.hasTestimonials ? `Yes (${sp.testimonialCount})` : '✗ No'} good={sp.hasTestimonials} />
          <CheckRow label="Customer reviews"  value={sp.hasReviews ? 'Yes' : 'No'}       good={sp.hasReviews} />
          <CheckRow label="Star ratings"      value={sp.hasRatings ? 'Yes' : 'No'}       good={sp.hasRatings} />
          <CheckRow label="Client logos"      value={sp.hasClientLogos ? 'Yes' : 'No'}   good={sp.hasClientLogos} />
          <CheckRow label="Counter / stats"   value={sp.hasCounterStats ? 'Yes' : 'No'}  good={sp.hasCounterStats} />

          <div className="ua-sec-label" style={{ marginTop: 12 }}>Trust Signals</div>
          <CheckRow label="Guarantee badge"   value={ts.hasGuaranteeBadge ? 'Yes' : 'No'}     good={ts.hasGuaranteeBadge} />
          <CheckRow label="Certifications"    value={ts.hasCertifications ? 'Yes' : 'No'}      good={ts.hasCertifications} />
          <CheckRow label="Trust badges"      value={ts.hasTrustBadges ? 'Yes' : 'No'}         good={ts.hasTrustBadges} />
          <CheckRow label="Media mentions"    value={ts.hasMediaMentions ? 'Yes' : 'No'}       good={ts.hasMediaMentions} />
          <CheckRow label="Awards"            value={ts.hasAwards ? 'Yes' : 'No'} />

          <div className="ua-info-box" style={{ marginTop: 14 }}>
            <div className="ua-info-title">Conversion Impact</div>
            <p>Adding testimonials increases conversions by 34% on average. A single visible trust badge near a CTA can improve click-through by 15–20%.</p>
          </div>
        </SectionCard>

        <SectionCard title="Contact Information" icon="📞">
          <CheckRow label="Phone number"      value={ci.hasPhone ? 'Found' : '✗ Missing'}       good={ci.hasPhone} />
          <CheckRow label="Email address"     value={ci.hasEmail ? 'Found' : '✗ Missing'}       good={ci.hasEmail} />
          <CheckRow label="Physical address"  value={ci.hasAddress ? 'Found' : 'Not found'} />
          <CheckRow label="Contact form"      value={ci.hasContactForm ? 'Present' : '✗ Missing'} good={ci.hasContactForm} />
          <CheckRow label="Live chat"         value={ci.hasLiveChat ? 'Detected' : 'Not found'} />

          <div className="ua-info-box" style={{ marginTop: 14 }}>
            <div className="ua-info-title">Contact Matters</div>
            <p>Websites with a visible phone number see <strong>30% higher trust scores</strong> in user surveys. For B2B, the absence of contact info is the #1 reason visitors leave without converting.</p>
          </div>
        </SectionCard>
      </div>

      {contentIssues.length > 0 && (
        <div className="ua-issues-inline">
          <div className="ua-sec-label">Content Issues</div>
          {contentIssues.map((iss, i) => <IssueCard key={i} issue={iss} />)}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   TECHNICAL TAB
══════════════════════════════════════════════════ */
export function TechnicalTab({ r, issues }) {
  const t  = r.technical || {};
  const m  = t.meta || {};
  const og = t.openGraph || {};
  const tw = t.twitterCard || {};
  const sc = t.schema || {};
  const pf = t.performance || {};
  const a  = t.accessibility || {};
  const rs = r.responsiveness || {};
  const co = r.consistency || {};

  const techIssues = issues.filter(i =>
    ['technical','accessibility','responsiveness','consistency'].includes(i.category)
  );

  return (
    <div className="ua-tab-panel">
      <div className="ua-three-col">

        <SectionCard title="Meta & SEO Tags" icon="🔍" score={t.score}>
          <CheckRow label="<title> tag"         value={m.titleText ? `"${m.titleText.slice(0,35)}…"` : '✗ Missing'} good={m.hasTitle} mono />
          <CheckRow label="Title length"        value={`${m.titleLength ?? 0} chars`}
            good={(m.titleLength ?? 0) >= 30 && (m.titleLength ?? 0) <= 60} />
          <CheckRow label="Meta description"    value={m.hasDescription ? `${m.descriptionLength} chars` : '✗ Missing'} good={m.hasDescription} />
          <CheckRow label="Desc. length"        value={`${m.descriptionLength ?? 0} chars`}
            good={(m.descriptionLength ?? 0) >= 50 && (m.descriptionLength ?? 0) <= 160} />
          <CheckRow label="Canonical URL"       value={m.hasCanonical ? 'Present' : '✗ Missing'}   good={m.hasCanonical} />
          <CheckRow label="Robots meta"         value={m.hasRobots ? 'Present' : 'Not set'} />
          <CheckRow label="Theme color"         value={m.themeColor || 'Not set'} />
          <CheckRow label="Favicon"             value={pf.hasFavicon ? 'Present' : '✗ Missing'}    good={pf.hasFavicon} />
          <CheckRow label="Apple touch icon"    value={pf.hasAppleTouchIcon ? 'Present' : 'Missing'} />
          <CheckRow label="Web manifest"        value={pf.hasManifest ? 'Present' : 'Missing'} />

          <div className="ua-sec-label" style={{ marginTop: 10 }}>Performance Hints</div>
          <CheckRow label="External scripts"    value={pf.externalScriptCount ?? 0} />
          <CheckRow label="Deferred scripts"    value={pf.deferredScripts ?? 0}
            good={(pf.deferredScripts ?? 0) > 0} />
          <CheckRow label="Async scripts"       value={pf.asyncScripts ?? 0} />
          <CheckRow label="External CSS files"  value={pf.externalCSSCount ?? 0}
            good={(pf.externalCSSCount ?? 0) <= 3} />
          <CheckRow label="Inline styles"       value={pf.inlineStyleCount ?? 0}
            good={(pf.inlineStyleCount ?? 0) < 20} />
          <CheckRow label="Preload links"       value={pf.preloadLinks ?? 0} />
        </SectionCard>

        <SectionCard title="Open Graph & Schema" icon="🔗">
          <div className="ua-sec-label">Open Graph</div>
          <CheckRow label="og:title"            value={og.hasOgTitle ? '✓' : '✗'}              good={og.hasOgTitle} />
          <CheckRow label="og:description"      value={og.hasOgDescription ? '✓' : '✗'}        good={og.hasOgDescription} />
          <CheckRow label="og:image"            value={og.hasOgImage ? '✓' : '✗ Missing'}      good={og.hasOgImage} />
          <CheckRow label="og:url"              value={og.hasOgUrl ? '✓' : '✗'}                good={og.hasOgUrl} />
          <CheckRow label="og:type"             value={og.hasOgType ? '✓' : '✗'}               good={og.hasOgType} />
          <CheckRow label="OG completeness"     value={`${og.completenessScore ?? 0}%`}
            good={(og.completenessScore ?? 0) >= 60} />

          <div className="ua-sec-label" style={{ marginTop: 10 }}>Twitter Card</div>
          <CheckRow label="Twitter card"        value={tw.hasTwitterCard ? tw.cardType || '✓' : '✗ Missing'} good={tw.hasTwitterCard} />

          <div className="ua-sec-label" style={{ marginTop: 10 }}>Structured Data</div>
          <CheckRow label="JSON-LD present"     value={sc.hasJsonLd ? '✓' : '✗ Missing'}       good={sc.hasJsonLd} />
          <CheckRow label="Microdata"           value={sc.hasMicrodata ? '✓' : 'None'} />
          {sc.schemaTypes?.length > 0 && (
            <div className="font-chips-row">
              {sc.schemaTypes.map((s, i) => <span key={i} className="font-chip">{s}</span>)}
            </div>
          )}

          <div className="ua-sec-label" style={{ marginTop: 10 }}>Design Consistency</div>
          <CheckRow label="CSS framework"       value={co.cssFrameworkDetected || 'None detected'} />
          <CheckRow label="Icon library"        value={co.iconLibraryDetected || 'None detected'} />
          <CheckRow label="Animations"          value={co.animationsDetected ? 'Detected' : '✗ None'}        good={co.animationsDetected} />
          <CheckRow label="Transitions"         value={co.transitionsDetected ? 'Detected' : '✗ None'}       good={co.transitionsDetected} />
          <CheckRow label="Hover states"        value={co.hoverStatesDetected ? 'Detected' : '✗ Missing'}    good={co.hoverStatesDetected} />
        </SectionCard>

        <SectionCard title="Accessibility & Responsiveness" icon="♿">
          <div className="typography-stat-grid">
            <StatChip label="A11y Score"        value={a.score ?? 0}
              color={(a.score ?? 0) >= 70 ? '#22c55e' : (a.score ?? 0) >= 45 ? '#f59e0b' : '#ef4444'} />
            <StatChip label="Responsive Score"  value={rs.score ?? 0}
              color={(rs.score ?? 0) >= 70 ? '#22c55e' : (rs.score ?? 0) >= 45 ? '#f59e0b' : '#ef4444'} />
          </div>

          <div className="ua-sec-label" style={{ marginTop: 10 }}>Accessibility</div>
          <CheckRow label="HTML lang attribute" value={a.hasLangAttribute ? `lang="${a.langValue}"` : '✗ Missing'} good={a.hasLangAttribute} />
          <CheckRow label="ARIA labels"         value={a.ariaLabels ?? 0}              good={(a.ariaLabels ?? 0) >= 3} />
          <CheckRow label="ARIA roles"          value={a.ariaRoles ?? 0}               good={(a.ariaRoles ?? 0) >= 2} />
          <CheckRow label="Inputs without label" value={a.inputsWithoutLabel ?? 0}     good={(a.inputsWithoutLabel ?? 0) === 0} />
          <CheckRow label="Focus styles"        value={a.hasFocusStyles ? 'Detected' : '✗ Missing'} good={a.hasFocusStyles} />
          <CheckRow label="Skip nav link"       value={a.hasSkipLink ? 'Present' : '✗ Missing'}      good={a.hasSkipLink} />
          <CheckRow label="ARIA live regions"   value={a.hasAriaLive ? 'Found' : 'None'} />
          <CheckRow label="Tab index usage"     value={a.tabIndexUsage ?? 0} />
          <CheckRow label="Form labels"         value={a.formLabels ?? 0}              good={(a.formLabels ?? 0) > 0} />

          <div className="ua-sec-label" style={{ marginTop: 10 }}>Responsiveness</div>
          <CheckRow label="Viewport meta"       value={rs.hasViewportMeta ? 'Present' : '✗ Missing'}         good={rs.hasViewportMeta} />
          <CheckRow label="Media queries"       value={`${rs.mediaQueryCount ?? 0} found`}
            good={(rs.mediaQueryCount ?? 0) >= 3} />
          <CheckRow label="Breakpoints"         value={rs.breakpoints?.join(', ') || 'None'} />
          <CheckRow label="Fluid images"        value={rs.hasFluidImages ? 'Yes' : 'No'}                     good={rs.hasFluidImages} />
          <CheckRow label="Fluid typography"    value={rs.hasFluidTypography ? 'Yes (clamp/vw)' : 'No'}      good={rs.hasFluidTypography} />
          <CheckRow label="Hamburger menu"      value={rs.hasHamburgerMenu ? 'Detected' : '✗ Missing'}       good={rs.hasHamburgerMenu} />
          <CheckRow label="Framework"           value={rs.frameworkDetected || 'None detected'} />
        </SectionCard>
      </div>

      {techIssues.length > 0 && (
        <div className="ua-issues-inline">
          <div className="ua-sec-label">Technical Issues</div>
          {techIssues.map((iss, i) => <IssueCard key={i} issue={iss} />)}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   ISSUES TAB
══════════════════════════════════════════════════ */
export function IssuesTab({ issues }) {
  const critical = issues.filter(i => i.severity === 'critical');
  const medium   = issues.filter(i => i.severity === 'medium');
  const low      = issues.filter(i => i.severity === 'low');

  if (issues.length === 0) {
    return (
      <div className="ua-tab-panel">
        <div className="ua-no-issues"><span>🎉</span><p>No issues detected! Great job.</p></div>
      </div>
    );
  }

  return (
    <div className="ua-tab-panel">
      {/* Summary bar */}
      <div className="issue-summary-bar">
        <div className="iss-big-pill critical"><span>{critical.length}</span>Critical</div>
        <div className="iss-big-pill medium"><span>{medium.length}</span>Medium</div>
        <div className="iss-big-pill low"><span>{low.length}</span>Low</div>
        <div className="iss-big-pill total"><span>{issues.length}</span>Total</div>
      </div>

      {/* Grouped by severity */}
      {[
        { label: '🔴 Critical Issues', items: critical, cls: 'critical' },
        { label: '🟡 Medium Issues',   items: medium,   cls: 'medium'   },
        { label: '🔵 Low Issues',      items: low,      cls: 'low'      },
      ].map(group => group.items.length > 0 && (
        <div key={group.cls} className="issue-group">
          <div className={`issue-group-label ${group.cls}`}>{group.label} ({group.items.length})</div>
          {group.items.map((iss, i) => <IssueCard key={i} issue={iss} />)}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   AI INSIGHTS TAB
══════════════════════════════════════════════════ */
export function AIInsightsTab({ ai, scores }) {
  if (!ai) return <div className="ua-tab-panel"><div className="muted-text">No AI insights available.</div></div>;

  const healthColor = (ai.healthScore ?? 0) >= 70 ? '#22c55e' : (ai.healthScore ?? 0) >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="ua-tab-panel">
      <div className="ua-ai-grid">

        {/* Health score + summary */}
        <div className="ai-hero-card">
          <div className="ai-health-block">
            <div className="ai-health-num" style={{ color: healthColor }}>{ai.healthScore}<span>/100</span></div>
            <div className="ai-health-label">Overall Health Score</div>
          </div>
          <p className="ai-summary">{ai.summary}</p>
          {ai.provider && <div className="ai-provider-tag">Analysis by {ai.provider}</div>}

          {/* Sub scores */}
          <div className="ai-sub-scores">
            {[
              { label: 'Design System',    val: ai.designSystemScore },
              { label: 'Conversion',       val: ai.conversionScore   },
              { label: 'Branding',         val: ai.brandingScore     },
            ].filter(s => s.val !== undefined).map(s => (
              <div key={s.label} className="ai-sub-score-item">
                <div className="ai-sub-score-label">{s.label}</div>
                <div className="ai-sub-score-bar-track">
                  <div className="ai-sub-score-bar-fill"
                    style={{ width: `${s.val}%`,
                      background: s.val >= 70 ? '#22c55e' : s.val >= 45 ? '#f59e0b' : '#ef4444' }} />
                </div>
                <div className="ai-sub-score-val">{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths */}
        {ai.strengths?.length > 0 && (
          <div className="ai-card">
            <div className="ai-card-tag">✅ What's Working Well</div>
            <ul className="ai-strength-list">
              {ai.strengths.map((s, i) => (
                <li key={i} className="ai-strength-item">
                  <span className="ai-strength-icon">✓</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Identified issues */}
        {ai.identifiedIssues?.length > 0 && (
          <div className="ai-card">
            <div className="ai-card-tag">🔍 Key Issues Identified</div>
            <ul className="ai-issue-list">
              {ai.identifiedIssues.map((iss, i) => (
                <li key={i} className="ai-issue-item">
                  <span className="ai-issue-num">{String(i + 1).padStart(2,'0')}</span>
                  <span>{iss}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fixes */}
        {ai.fixes?.length > 0 && (
          <div className="ai-card ai-card-full">
            <div className="ai-card-tag">🛠 Step-by-Step Fix Recommendations</div>
            <div className="fixes-grid">
              {ai.fixes.map((fix, i) => <FixCard key={i} fix={fix} index={i} />)}
            </div>
          </div>
        )}

        {/* Priority plan */}
        {ai.priority?.length > 0 && (
          <div className="ai-card ai-card-full">
            <div className="ai-card-tag">⚡ Priority Action Plan</div>
            <div className="priority-list">
              {ai.priority.map((p, i) => (
                <div key={i} className="priority-item">
                  <div className="priority-num">{i + 1}</div>
                  <div className="priority-content">
                    <div className="priority-title">{p.item}</div>
                    <div className="priority-reason"><strong>Why:</strong> {p.reason}</div>
                    <div className="priority-impact"><strong>Impact:</strong> {p.impact}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}