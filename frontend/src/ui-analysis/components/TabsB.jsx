import { CheckRow, StatChip, SectionCard, IssueCard, PlacementBreakdown } from './Primitives';

/* ══════════════════════════════════════════════════
   IMAGES TAB
══════════════════════════════════════════════════ */
export function ImagesTab({ r, issues }) {
  const img = r.images || {};
  const imgIssues = issues.filter(i => i.category === 'images');

  return (
    <div className="ua-tab-panel">
      <div className="ua-two-col">

        <SectionCard title="Image Inventory & Quality" icon="🖼️" score={img.score}>
          <div className="typography-stat-grid">
            <StatChip label="Total Images"   value={img.totalImages ?? 0} />
            <StatChip label="Have Alt Text"  value={img.withAlt ?? 0}
              sub={`${img.altTextRatioPct ?? 0}%`}
              color={(img.altTextRatioPct ?? 0) >= 90 ? '#22c55e' : (img.altTextRatioPct ?? 0) >= 60 ? '#f59e0b' : '#ef4444'} />
            <StatChip label="Lazy Loaded"    value={img.lazyLoadedCount ?? 0}
              sub={`${img.lazyLoadRatioPct ?? 0}%`}
              color={(img.lazyLoadRatioPct ?? 0) >= 60 ? '#22c55e' : '#f59e0b'} />
            <StatChip label="Has srcset"     value={img.withSrcset ?? 0} />
            <StatChip label="WebP"           value={img.webpCount ?? 0}
              color={(img.webpCount ?? 0) > 0 ? '#22c55e' : '#ef4444'} />
            <StatChip label="SVG"            value={img.svgCount ?? 0} />
            <StatChip label="GIF"            value={img.gifCount ?? 0}
              color={(img.gifCount ?? 0) === 0 ? '#22c55e' : '#f59e0b'} />
            <StatChip label="Bg Images"      value={img.backgroundImages ?? 0} />
          </div>

          <CheckRow label="Hero image present"    value={img.heroImagePresent ? 'Yes' : 'No'}          good={img.heroImagePresent} />
          <CheckRow label="<picture> tag used"    value={img.hasPictureTag ? 'Yes' : 'No'}             good={img.hasPictureTag} />
          <CheckRow label="Decorative (alt='')"   value={img.decorativeImages ?? 0} />
          <CheckRow label="Broken src values"     value={img.brokenSrcCount ?? 0}                      good={(img.brokenSrcCount ?? 0) === 0} />
          <CheckRow label="Missing alt text"      value={`${img.withoutAlt ?? 0} images`}              good={(img.withoutAlt ?? 0) === 0} />
        </SectionCard>

        <SectionCard title="Image Placement Breakdown" icon="🗺️">
          <PlacementBreakdown pb={img.placementBreakdown} />

          {img.items?.length > 0 && (
            <>
              <div className="ua-sec-label" style={{ marginTop: 16 }}>Sample Images Audit</div>
              <div className="image-sample-list">
                <div className="image-sample-head">
                  <span>Alt</span><span>Lazy</span><span>Fmt</span><span>Placement</span><span>Source</span>
                </div>
                {img.items.slice(0, 10).map((im, i) => (
                  <div key={i} className="image-sample-row">
                    <span className={`img-badge ${im.hasAlt ? 'pass' : 'fail'}`}>
                      {im.hasAlt ? '✓' : '✗'}
                    </span>
                    <span className={`img-badge ${im.isLazy ? 'pass' : 'neutral'}`}>
                      {im.isLazy ? '✓' : '—'}
                    </span>
                    <span className="img-format">{im.format}</span>
                    <span className="img-placement-tag">{im.placement}</span>
                    <span className="img-src" title={im.src}>{im.src.slice(0, 32)}…</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {imgIssues.length > 0 && (
        <div className="ua-issues-inline">
          <div className="ua-sec-label">Image Issues</div>
          {imgIssues.map((iss, i) => <IssueCard key={i} issue={iss} />)}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   LAYOUT TAB
══════════════════════════════════════════════════ */
export function LayoutTab({ r, issues }) {
  const l = r.layout || {};
  const layoutIssues = issues.filter(i => i.category === 'layout');

  return (
    <div className="ua-tab-panel">
      <div className="ua-two-col">

        <SectionCard title="Layout System" icon="📐" score={l.score}>
          <div className="typography-stat-grid">
            <StatChip label="Sections" value={l.sectionCount ?? 0} />
          </div>
          <CheckRow label="CSS Flexbox"          value={l.usesFlexbox ? 'Used' : 'Not used'}                 good={l.usesFlexbox} />
          <CheckRow label="CSS Grid"             value={l.usesCSSGrid ? 'Used' : 'Not used'}                  good={l.usesCSSGrid} />
          <CheckRow label="Max-Width Container"  value={l.hasMaxWidth ? 'Present' : 'Missing'}                good={l.hasMaxWidth} />
          <CheckRow label="Container Classes"    value={l.hasContainer ? 'Found' : 'Not found'}               good={l.hasContainer} />
          <CheckRow label="Legacy Float Layouts" value={l.usesFloat ? '⚠ Found' : 'None'}                    good={!l.usesFloat} />
          <CheckRow label="Table Layouts"        value={l.usesTable ? '⚠ Tables detected' : 'None'}          good={!l.usesTable} />
          <CheckRow label="Hero Section"         value={l.hasHeroSection ? 'Detected' : 'Not found'}          good={l.hasHeroSection} />
          <CheckRow label="Sticky Element"       value={l.hasStickyElement ? 'Found' : 'None'} />
          <CheckRow label="Fixed Element"        value={l.hasFixedElement ? 'Found' : 'None'} />

          {l.columnPatterns?.length > 0 && (
            <>
              <div className="ua-sec-label" style={{ marginTop: 10 }}>Grid Column Patterns</div>
              <div className="font-chips-row">
                {l.columnPatterns.slice(0, 4).map((p, i) => (
                  <span key={i} className="font-chip small">{p.slice(0, 35)}</span>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="Spacing & Visual Style" icon="🔧">
          <div className="ua-sec-label">Spacing Units</div>
          <CheckRow label="REM units"        value={l.spacingSystem?.usesRemUnits ? 'Used' : 'Not found'}   good={l.spacingSystem?.usesRemUnits} />
          <CheckRow label="EM units"         value={l.spacingSystem?.usesEmUnits ? 'Used' : 'Not found'} />
          <CheckRow label="PX units"         value={l.spacingSystem?.usesPxUnits ? 'Used' : 'Not found'} />
          <CheckRow label="Mixed units"      value={l.spacingSystem?.mixedUnits ? '⚠ Inconsistent' : 'Consistent'} good={!l.spacingSystem?.mixedUnits} />

          <div className="ua-sec-label" style={{ marginTop: 12 }}>Border Radius</div>
          <CheckRow label="Consistent BR"    value={l.borderRadius?.isConsistent ? 'Yes' : 'Inconsistent'}  good={l.borderRadius?.isConsistent} />
          {l.borderRadius?.values?.length > 0 && (
            <div className="font-chips-row">
              {l.borderRadius.values.slice(0, 6).map((v, i) => <span key={i} className="font-chip small">{v}</span>)}
            </div>
          )}

          <div className="ua-sec-label" style={{ marginTop: 12 }}>Shadows</div>
          <CheckRow label="Box Shadows"      value={l.shadowUsage?.detected ? `${l.shadowUsage.values?.length} variant(s)` : 'None'} good={l.shadowUsage?.detected} />
          {l.shadowUsage?.values?.slice(0, 3).map((v, i) => (
            <div key={i} className="font-chip small" style={{ marginTop: 4, display: 'block', wordBreak: 'break-all' }}>
              {v.slice(0, 60)}
            </div>
          ))}

          {l.zIndexValues?.length > 0 && (
            <>
              <div className="ua-sec-label" style={{ marginTop: 12 }}>Z-Index Values</div>
              <div className="font-chips-row">
                {l.zIndexValues.map((v, i) => <span key={i} className="font-chip small">{v}</span>)}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {layoutIssues.length > 0 && (
        <div className="ua-issues-inline">
          <div className="ua-sec-label">Layout Issues</div>
          {layoutIssues.map((iss, i) => <IssueCard key={i} issue={iss} />)}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   NAVIGATION TAB
══════════════════════════════════════════════════ */
export function NavigationTab({ r, issues }) {
  const n = r.navigation || {};
  const navIssues = issues.filter(i => i.category === 'navigation');

  return (
    <div className="ua-tab-panel">
      <div className="ua-two-col">

        <SectionCard title="Navigation Structure" icon="🧭" score={n.score}>
          <CheckRow label="Primary nav present"  value={n.primaryNavPresent ? 'Yes' : 'No'}                  good={n.primaryNavPresent} />
          <CheckRow label="Nav items count"      value={n.primaryNavItems ?? 0}
            good={(n.primaryNavItems ?? 0) >= 3 && (n.primaryNavItems ?? 0) <= 8} />
          <CheckRow label="Nav overloaded"       value={n.isOverloaded ? '⚠ Yes (>8 items)' : 'No'}         good={!n.isOverloaded} />
          <CheckRow label="Dropdown menus"       value={n.hasDropdown ? 'Yes' : 'No'} />
          <CheckRow label="Mobile/hamburger menu" value={n.hasMobileMenu ? 'Detected' : '✗ Missing'}         good={n.hasMobileMenu} />
          <CheckRow label="Breadcrumbs"          value={n.hasBreadcrumb ? 'Present' : 'None'} />
          <CheckRow label="Site search"          value={n.hasSearch ? 'Present' : 'None'} />
          <CheckRow label="Sticky navigation"    value={n.hasStickyNav ? 'Yes' : 'No'} />
          <CheckRow label="Skip-nav link"        value={n.hasSkipLink ? 'Present' : '✗ Missing'}             good={n.hasSkipLink} />
          <CheckRow label="Footer navigation"    value={n.footerNavPresent ? `${n.footerNavItems} links` : 'Missing'} good={n.footerNavPresent} />
          <CheckRow label="Social links"         value={n.socialLinks ?? 0}                                   good={(n.socialLinks ?? 0) > 0} />
        </SectionCard>

        <SectionCard title="Navigation Items Detected" icon="📋">
          {n.primaryNavLinks?.length > 0 ? (
            <div className="nav-links-list">
              {n.primaryNavLinks.map((link, i) => (
                <div key={i} className="nav-link-item">
                  <span className="nav-link-num">{i + 1}</span>
                  <span className="nav-link-text">{link}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted-text">No nav links could be extracted</div>
          )}

          <div className="ua-info-box" style={{ marginTop: 16 }}>
            <div className="ua-info-title">Navigation UX Rules</div>
            <p><strong>5–7 items</strong> is the cognitive sweet spot. Beyond 8 items, decision time increases (Hick's Law).</p>
            <p style={{ marginTop: 6 }}><strong>Mobile menu</strong> is critical — over 60% of traffic is mobile.</p>
            <p style={{ marginTop: 6 }}><strong>Skip link</strong> is a WCAG 2.4.1 requirement for keyboard and screen-reader users.</p>
          </div>
        </SectionCard>
      </div>

      {navIssues.length > 0 && (
        <div className="ua-issues-inline">
          <div className="ua-sec-label">Navigation Issues</div>
          {navIssues.map((iss, i) => <IssueCard key={i} issue={iss} />)}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   CTA TAB
══════════════════════════════════════════════════ */
const STRONG = ['get started','sign up','try','free','download','contact','book','order','buy','start','register','subscribe'];
const WEAK   = ['click here','here','submit','go','ok','yes'];

export function CTATab({ r, issues }) {
  const c = r.cta || {};
  const ctaIssues = issues.filter(i => i.category === 'cta');

  return (
    <div className="ua-tab-panel">
      <div className="ua-two-col">

        <SectionCard title="CTA Effectiveness" icon="🎯" score={c.score}>
          <div className="typography-stat-grid">
            <StatChip label="Total Buttons" value={c.totalButtons ?? 0} />
            <StatChip label="Strong CTAs"   value={c.strongCTACount ?? 0}
              color={(c.strongCTACount ?? 0) > 0 ? '#22c55e' : '#ef4444'} />
            <StatChip label="Weak CTAs"     value={c.weakCTACount ?? 0}
              color={(c.weakCTACount ?? 0) === 0 ? '#22c55e' : '#f59e0b'} />
          </div>
          <CheckRow label="CTA in hero section"      value={c.ctaInHero ? 'Yes' : '✗ No'}                   good={c.ctaInHero} />
          <CheckRow label="Primary CTA detected"     value={c.primaryCTAText || '✗ None found'}              good={!!c.primaryCTAText} />
          <CheckRow label="Floating/fixed CTA"       value={c.hasFloatingCTA ? 'Detected' : 'None'} />
          <CheckRow label="Style consistency"        value={c.buttonStyleConsistency ? 'Consistent' : 'Inconsistent'} good={c.buttonStyleConsistency} />

          {c.buttonTypes?.length > 0 && (
            <>
              <div className="ua-sec-label" style={{ marginTop: 10 }}>Button Element Types</div>
              <div className="font-chips-row">
                {c.buttonTypes.map((t, i) => <span key={i} className="font-chip">{t}</span>)}
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="Button Labels Analysis" icon="📝">
          {c.ctaTexts?.length > 0 ? (
            <div className="cta-labels-list">
              {c.ctaTexts.map((text, i) => {
                const isStrong = STRONG.some(w => text.toLowerCase().includes(w));
                const isWeak   = WEAK.some(w => text.toLowerCase() === w || text.toLowerCase() === w);
                return (
                  <div key={i} className={`cta-label-row ${isStrong ? 'cta-strong' : isWeak ? 'cta-weak' : ''}`}>
                    <span className="cta-label-text">{text}</span>
                    {isStrong && <span className="cta-tag strong">✓ strong</span>}
                    {isWeak   && <span className="cta-tag weak">⚠ weak</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="muted-text">No button labels found</div>
          )}

          <div className="ua-info-box" style={{ marginTop: 14 }}>
            <div className="ua-info-title">CTA Copywriting Rules</div>
            <p><strong>Weak:</strong> "Click Here" / "Submit" / "Go" — no context, no value.</p>
            <p style={{ marginTop: 6 }}><strong>Strong:</strong> "Get My Free Report" / "Start 14-Day Trial" / "Book a Demo" — specific, benefit-led.</p>
            <p style={{ marginTop: 6 }}>A single word change in a CTA can lift conversion by 10–40%.</p>
          </div>
        </SectionCard>
      </div>

      {ctaIssues.length > 0 && (
        <div className="ua-issues-inline">
          <div className="ua-sec-label">CTA Issues</div>
          {ctaIssues.map((iss, i) => <IssueCard key={i} issue={iss} />)}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   HEADER / FOOTER TAB
══════════════════════════════════════════════════ */
export function HeaderFooterTab({ r, issues }) {
  const hf = r.headerFooter || {};
  const hdr = hf.header || {};
  const ftr = hf.footer || {};
  const hfIssues = issues.filter(i => ['header','footer'].includes(i.category));

  return (
    <div className="ua-tab-panel">
      <div className="ua-two-col">

        <SectionCard title="Header Analysis" icon="⬆️">
          <CheckRow label="<header> element present" value={hdr.present ? 'Yes' : '✗ No'}       good={hdr.present} />
          <CheckRow label="Logo in header"           value={hdr.hasLogo ? 'Yes' : '✗ No'}        good={hdr.hasLogo} />
          <CheckRow label="Navigation in header"     value={hdr.hasNav ? 'Yes' : '✗ No'}          good={hdr.hasNav} />
          <CheckRow label="CTA button in header"     value={hdr.hasCTA ? 'Yes' : 'No'} />
          <CheckRow label="Phone number in header"   value={hdr.hasPhone ? 'Yes' : 'No'} />
          <CheckRow label="Search in header"         value={hdr.hasSearch ? 'Yes' : 'No'} />
          <CheckRow label="Sticky / fixed header"    value={hdr.isSticky ? 'Yes' : 'No'} />

          <div className="ua-info-box" style={{ marginTop: 14 }}>
            <div className="ua-info-title">Header Best Practices</div>
            <p>A complete header has: Logo (top-left) · Primary navigation · CTA button · Optional: phone number for service businesses.</p>
            <p style={{ marginTop: 6 }}>Sticky headers increase CTA visibility by keeping key actions always accessible during scroll.</p>
          </div>
        </SectionCard>

        <SectionCard title="Footer Analysis" icon="⬇️" score={hf.score}>
          <CheckRow label="<footer> element present" value={ftr.present ? 'Yes' : '✗ No'}          good={ftr.present} />
          <CheckRow label="Logo in footer"           value={ftr.hasLogo ? 'Yes' : 'No'} />
          <CheckRow label="Footer links"             value={ftr.hasLinks ? `${ftr.linkCount} links` : 'None'} good={ftr.hasLinks} />
          <CheckRow label="Copyright notice"         value={ftr.hasCopyright ? 'Present' : '✗ Missing'}      good={ftr.hasCopyright} />
          <CheckRow label="Social media links"       value={ftr.hasSocialLinks ? 'Present' : 'Missing'}       good={ftr.hasSocialLinks} />
          <CheckRow label="Contact info"             value={ftr.hasContactInfo ? 'Present' : 'Missing'}       good={ftr.hasContactInfo} />
          <CheckRow label="Privacy policy link"      value={ftr.hasPrivacyLink ? 'Present' : '✗ Missing'}     good={ftr.hasPrivacyLink} />
          <CheckRow label="Terms of service link"    value={ftr.hasTermsLink ? 'Present' : 'Missing'}         good={ftr.hasTermsLink} />
          <CheckRow label="Sitemap link"             value={ftr.hasSitemapLink ? 'Present' : 'None'} />
          <CheckRow label="Newsletter signup"        value={ftr.hasNewsletter ? 'Present' : 'None'} />
          <CheckRow label="Footer columns"           value={ftr.columnCount ?? 1} />

          <div className="ua-info-box" style={{ marginTop: 14 }}>
            <div className="ua-info-title">Legal Requirements</div>
            <p>Privacy Policy link is legally required under GDPR (EU), CCPA (California), and most other privacy laws. Missing it is a compliance risk.</p>
          </div>
        </SectionCard>
      </div>

      {hfIssues.length > 0 && (
        <div className="ua-issues-inline">
          <div className="ua-sec-label">Header / Footer Issues</div>
          {hfIssues.map((iss, i) => <IssueCard key={i} issue={iss} />)}
        </div>
      )}
    </div>
  );
}