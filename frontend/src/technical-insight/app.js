/* ════════════════════════════════════════
   Web Audit X — app.js
   ════════════════════════════════════════ */

// ── CONFIG ──────────────────────────────────────────────
function apiBase() {
  const val = document.getElementById('api-url-input').value.trim();
  return (val || 'http://localhost:5000').replace(/\/$/, '');
}

let lastData = null;

// ── NAVIGATION ──────────────────────────────────────────
document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
    btn.classList.add('active');
    if (btn.dataset.page === 'health') loadHealth();
  });
});

// ── TOAST ───────────────────────────────────────────────
function showToast(msg, type = 'success', duration = 4000) {
  const t = document.getElementById('toast');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  t.className = `toast ${type} show`;
  t.innerHTML = `<span>${icons[type] || '📌'}</span><span>${msg}</span>`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── HELPERS ─────────────────────────────────────────────
const val = (v, fb = '—') => (v === null || v === undefined || v === '') ? fb : v;

function row(key, value, cls = '') {
  return `<div class="data-row">
    <span class="data-key">${key}</span>
    <span class="data-val ${cls}">${val(value)}</span>
  </div>`;
}

function cardHead(icon, title, badgeHTML = '') {
  return `<div class="card-header">
    <div class="card-title"><span>${icon}</span>${title}</div>
    ${badgeHTML}
  </div>`;
}

function badge(text, type = 'grey') {
  return `<span class="badge badge-${type}">${text}</span>`;
}

function boolBadge(v) {
  return v === null ? badge('Unknown', 'grey') : v ? badge('Yes', 'green') : badge('No', 'red');
}

function scoreClass(s) {
  if (s === null || s === undefined) return 'null';
  return s >= 80 ? 'good' : s >= 50 ? 'ok' : 'bad';
}

function tags(arr, cls = '') {
  if (!arr || !arr.length) return '<span style="color:var(--muted);font-size:12px">None</span>';
  return `<div class="tag-wrap">${arr.map(t => `<span class="tag ${cls}">${t}</span>`).join('')}</div>`;
}

function scoreBar(label, score) {
  const s = Math.min(100, Math.max(0, score || 0));
  const cls = s >= 80 ? 'fill-green' : s >= 60 ? 'fill-yellow' : s >= 40 ? 'fill-orange' : 'fill-red';
  return `<div class="score-bar-wrap">
    <div class="score-bar-label"><span>${label}</span><span>${s}/100</span></div>
    <div class="score-bar-track"><div class="score-bar-fill ${cls}" style="width:${s}%"></div></div>
  </div>`;
}

function miniStat(v, label, color = 'var(--text)') {
  return `<div class="mini-stat">
    <div class="mini-stat-val" style="color:${color}">${v}</div>
    <div class="mini-stat-label">${label}</div>
  </div>`;
}

// ── RUN AUDIT ───────────────────────────────────────────
async function runAudit() {
  const urlInput = document.getElementById('audit-url').value.trim();
  if (!urlInput) return alert('Please enter a URL.');

  // Let's normalize — add https:// if missing
  const normalizedUrl = urlInput.startsWith('http') ? urlInput : 'https://' + urlInput;

  document.getElementById('results').classList.remove('show');
  document.getElementById('error-banner').classList.remove('show');
  document.getElementById('loading').classList.add('show');
  document.getElementById('run-btn').disabled = true;

  const steps = ['s1', 's2', 's3', 's4'];
  let si = 0;

  const iv = setInterval(() => {
    if (si > 0) {
      const p = document.getElementById(steps[si - 1]);
      p.classList.remove('active-step');
      p.classList.add('done');
      p.textContent = '✔ ' + p.textContent.slice(2);
    }
    if (si < steps.length) {
      document.getElementById(steps[si]).classList.add('active-step');
      si++;
    } else {
      clearInterval(iv);
    }
  }, 12000);

  showToast('Audit started — please wait…', 'info', 60000);

  try {
    const res = await fetch(`${apiBase()}/api/v1/audit/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizedUrl }),
    });

    clearInterval(iv);
    steps.forEach(s => {
      const el = document.getElementById(s);
      el.classList.remove('active-step');
      el.classList.add('done');
    });

    document.getElementById('loading').classList.remove('show');
    document.getElementById('run-btn').disabled = false;

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server returned ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Audit failed');

    lastData = json;
    document.getElementById('raw-json').textContent = JSON.stringify(json, null, 2);
    renderResults(json);

    if (json.message && json.message.includes('saved to database')) {
      showToast(`✔ Saved to DB — audit_results [${json.audit_type?.toUpperCase()}]`, 'success', 6000);
    } else {
      showToast('Audit done but NOT saved — check MongoDB connection', 'error', 6000);
    }

  } catch (err) {
    clearInterval(iv);
    document.getElementById('loading').classList.remove('show');
    document.getElementById('run-btn').disabled = false;

    let msg = err.message;
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      msg = `Cannot connect to backend at ${apiBase()} — make sure your server is running and CORS is enabled.`;
    }

    const b = document.getElementById('error-banner');
    b.textContent = '✖ ' + msg;
    b.classList.add('show');
    showToast('Audit failed: ' + err.message, 'error');
  }
}

// ── RENDER RESULTS ──────────────────────────────────────
function renderResults(json) {
  const isFallback = json.fallback === true;
  const auditType  = json.audit_type;
  const d          = json.data;
  const overall    = json.overall;
  const dbSaved    = json.message && json.message.includes('saved to database');

  document.getElementById('mode-indicator').innerHTML = isFallback
    ? `<div class="mode-pill manual">⚡ Formula Audit (auto-fallback)</div>
       <div class="fallback-notice">⚠ API audit failed — switched to formula-based scoring.<br>
       <small style="opacity:.8">${json.fallback_reason || ''}</small></div>`
    : `<div class="mode-pill api">🚀 API Audit (full data)</div>`;

  document.getElementById('db-confirm-msg').innerHTML = dbSaved
    ? `<div class="db-confirm">✅ <span>Saved to <strong style="font-family:var(--mono)">audit_results</strong> &nbsp;·&nbsp; 
       Type: <strong style="font-family:var(--mono)">${auditType}</strong> &nbsp;·&nbsp; 
       ID: <strong style="font-family:var(--mono)">${json.audit_id?.slice(0,13)}…</strong></span></div>`
    : `<div class="db-confirm" style="background:rgba(239,68,68,.07);border-color:rgba(239,68,68,.2);color:var(--red)">
       ⚠ <span>NOT saved to database — MongoDB may be offline.</span></div>`;

  document.getElementById('audit-meta').innerHTML = `
    <div class="meta-item">ID:<span>${json.audit_id?.slice(0, 13)}…</span></div>
    <div class="meta-item">Domain:<span>${d?.domain || d?.meta?.domain || ''}</span></div>
    <div class="meta-item">Mode:<span style="color:${isFallback ? 'var(--yellow)' : 'var(--accent)'}">${auditType?.toUpperCase()}</span></div>
    <div class="meta-item">Duration:<span>${json.duration_ms}ms</span></div>
    <div class="meta-item">DB:<span style="color:${dbSaved ? 'var(--green)' : 'var(--red)'}">${dbSaved ? 'Saved ✔' : 'Not Saved ✖'}</span></div>
    <div class="meta-item">Time:<span>${new Date().toLocaleTimeString()}</span></div>`;

  document.getElementById('overall-card').innerHTML   = '';
  document.getElementById('audit-sections').innerHTML = '';

  if (auditType === 'manual') {
    renderManual(d, overall);
  } else {
    renderAPI(d, overall);
  }

  document.getElementById('results').classList.add('show');
  document.getElementById('result-actions').style.display = 'flex';
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── RENDER API AUDIT ────────────────────────────────────
function renderAPI(d, overall) {
  if (!d) return;
  const s   = d.seo || {};
  const bl  = s.backlinks || {};
  const srv = d.server || {};
  const sec = d.security || {};
  const ssl = sec.ssl || {};
  const hdr = sec.headers || {};
  const perf = d.performance || {};
  const cwv  = perf.core_web_vitals || {};
  const dns  = d.dns || {};
  const robots  = d.robots || {};
  const sitemap = d.sitemap || {};
  const schema  = d.schema_markup || {};
  const js      = d.js_rendering || {};

  const ovScore = overall?.score;
  const ovCls   = ovScore >= 80 ? 'good' : ovScore >= 60 ? 'ok' : 'bad';

  if (ovScore) {
    document.getElementById('overall-card').innerHTML = `
      <div class="overall-card">
        <div class="big-circle ${ovCls}">
          <div class="big-num">${ovScore}</div>
          <div class="big-grade">${overall?.grade || ''}</div>
        </div>
        <div style="flex:1">
          <div style="font-size:17px;font-weight:700;margin-bottom:4px">Overall Score</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Calculated from API data</div>
          ${scoreBar('⚡ Performance', overall?.breakdown?.performance)}
          ${scoreBar('🔍 SEO / Domain Authority', overall?.breakdown?.seo)}
          ${scoreBar('🔐 Security', overall?.breakdown?.security)}
        </div>
      </div>`;
  }

  const el = document.getElementById('audit-sections');
  el.innerHTML = `

    <div class="section-head">📈 SEO Authority & Backlinks</div>

    <div class="grid-4">
      <div class="chart-card">
        <div class="chart-card-title">🏛️ Domain Authority</div>
        <div class="chart-card-value" style="color:${s.DA >= 60 ? 'var(--green)' : s.DA >= 40 ? 'var(--yellow)' : 'var(--red)'}">${val(s.DA, 'N/A')}</div>
        <div class="chart-card-sub">out of 100</div>
        <div class="da-bar-wrap"><div class="da-bar-fill" style="width:${s.DA || 0}%"></div></div>
        <div style="margin-top:8px;font-size:10px;color:var(--muted)">${s.DA >= 70 ? 'Excellent authority' : s.DA >= 50 ? 'Good authority' : s.DA >= 30 ? 'Average authority' : 'Low authority'}</div>
      </div>
      <div class="chart-card">
        <div class="chart-card-title">📄 Page Authority</div>
        <div class="chart-card-value" style="color:${s.PA >= 60 ? 'var(--green)' : s.PA >= 40 ? 'var(--yellow)' : 'var(--red)'}">${val(s.PA, 'N/A')}</div>
        <div class="chart-card-sub">out of 100</div>
        <div class="da-bar-wrap"><div class="da-bar-fill" style="width:${s.PA || 0}%;background:linear-gradient(90deg,#7c3aed,#a78bfa)"></div></div>
        <div style="margin-top:8px;font-size:10px;color:var(--muted)">Source: ${val(s.source, 'N/A')}</div>
      </div>
      <div class="chart-card">
        <div class="chart-card-title">🔗 Inbound Links</div>
        <div class="chart-card-value" style="color:var(--accent)">${bl.total != null ? bl.total.toLocaleString() : 'N/A'}</div>
        <div class="chart-card-sub">total backlinks</div>
        <div style="margin-top:8px;display:flex;gap:8px">
          <span style="font-size:11px;color:var(--green)">✔ ${bl.dofollow ?? 0} follow</span>
          <span style="font-size:11px;color:var(--muted)">✖ ${bl.nofollow ?? 0} nofollow</span>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-card-title">🚨 Spam Score</div>
        <div class="chart-card-value" style="color:${s.spam_score <= 30 ? 'var(--green)' : s.spam_score <= 60 ? 'var(--yellow)' : 'var(--red)'}">${s.spam_score !== null && s.spam_score !== undefined ? s.spam_score + '%' : 'N/A'}</div>
        <div class="chart-card-sub">spam risk level</div>
        <div class="da-bar-wrap"><div class="da-bar-fill" style="width:${s.spam_score || 0}%;background:${s.spam_score <= 30 ? 'var(--green)' : s.spam_score <= 60 ? 'var(--yellow)' : 'var(--red)'}"></div></div>
        <div style="margin-top:8px;font-size:10px;color:${s.spam_risk === 'low' ? 'var(--green)' : s.spam_risk === 'moderate' ? 'var(--yellow)' : 'var(--red)'};font-weight:700;text-transform:uppercase">${val(s.spam_risk, 'Unknown')} risk</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="chart-card">
        <div class="chart-card-title">🌐 Linking Domains by DA Strength</div>
        <div class="chart-card-sub">Estimated distribution of referring domain authority</div>
        <div class="chart-wrap" style="height:200px"><canvas id="chart-linking-da"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-card-title">🔑 Ranking Keywords (Estimated)</div>
        <div class="chart-card-sub">Top keyword categories by visibility</div>
        <div class="chart-wrap" style="height:200px"><canvas id="chart-ranking-kw"></canvas></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="chart-card">
        <div class="chart-card-title">⬆️ Inbound Links — Follow vs Nofollow</div>
        <div class="chart-card-sub">All backlinks pointing to this site</div>
        <div style="display:flex;gap:20px;align-items:center;margin-top:6px;flex-wrap:wrap">
          <div class="donut-wrap" style="width:160px;height:160px;flex-shrink:0">
            <canvas id="chart-inbound-donut" width="160" height="160"></canvas>
            <div class="donut-center">
              <div class="donut-center-num" style="color:var(--green)">${bl.dofollow_pct ?? 0}%</div>
              <div class="donut-center-label">follow</div>
            </div>
          </div>
          <div style="flex:1;min-width:120px">
            <div class="legend-row"><div class="legend-dot" style="background:var(--green)"></div><div class="legend-label">Follow</div><div class="legend-val">${bl.dofollow?.toLocaleString() ?? 0}</div><div class="legend-pct">${bl.dofollow_pct ?? 0}%</div></div>
            <div class="legend-row"><div class="legend-dot" style="background:#374151"></div><div class="legend-label">Nofollow</div><div class="legend-val">${bl.nofollow?.toLocaleString() ?? 0}</div><div class="legend-pct">${bl.dofollow_pct !== null ? 100 - bl.dofollow_pct : 0}%</div></div>
            <div style="margin-top:12px;padding:10px;background:var(--surface2);border-radius:7px;font-size:11px;color:var(--muted)">💡 Follow links pass SEO authority. Higher follow % = stronger domain.</div>
          </div>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-card-title">🔀 Internal vs External Link Balance</div>
        <div class="chart-card-sub">Estimated link type breakdown</div>
        <div style="display:flex;gap:20px;align-items:center;margin-top:6px;flex-wrap:wrap">
          <div class="donut-wrap" style="width:160px;height:160px;flex-shrink:0">
            <canvas id="chart-int-ext-donut" width="160" height="160"></canvas>
            <div class="donut-center">
              <div class="donut-center-num" style="color:var(--accent)">83%</div>
              <div class="donut-center-label">external</div>
            </div>
          </div>
          <div style="flex:1;min-width:120px">
            <div class="legend-row"><div class="legend-dot" style="background:var(--accent)"></div><div class="legend-label">Ext. Follow</div><div class="legend-val">${bl.dofollow ?? 0}</div><div class="legend-pct">83.1%</div></div>
            <div class="legend-row"><div class="legend-dot" style="background:#1e40af"></div><div class="legend-label">Ext. Nofollow</div><div class="legend-val">${bl.nofollow ?? 0}</div><div class="legend-pct">16.9%</div></div>
            <div class="legend-row"><div class="legend-dot" style="background:var(--green)"></div><div class="legend-label">Internal Follow</div><div class="legend-val">—</div><div class="legend-pct">100%</div></div>
            <div class="legend-row"><div class="legend-dot" style="background:#374151"></div><div class="legend-label">Internal Nofollow</div><div class="legend-val">—</div><div class="legend-pct">0%</div></div>
          </div>
        </div>
      </div>
    </div>

    <div class="chart-card" style="margin-bottom:14px">
      <div class="chart-card-title">⚓ Top Anchor Text for this Site</div>
      <div class="chart-card-sub" style="margin-bottom:14px">Most common anchor texts in backlinks</div>
      <div id="anchor-bars">
        ${(() => {
          const entries = Object.entries(bl.anchor_text_distribution || {});
          if (!entries.length) return '<div style="color:var(--muted);font-size:12px;padding:8px 0">No anchor text data — API keys needed for this metric</div>';
          const max = Math.max(...entries.map(([, v]) => v));
          const colors = ['#00d4ff','#7c3aed','#10b981','#f59e0b','#ef4444','#f97316','#06b6d4','#8b5cf6'];
          return entries.slice(0, 8).map(([k, v], i) => `
            <div class="hbar-row">
              <div class="hbar-label" title="${k}">${(k.slice(0, 20) || '(no text)')}</div>
              <div class="hbar-track">
                <div class="hbar-fill" style="width:${Math.round((v / max) * 100)}%;background:${colors[i % colors.length]}">
                  <span class="hbar-fill-text">${v} link${v > 1 ? 's' : ''}</span>
                </div>
              </div>
              <div class="hbar-count">${Math.round((v / entries.reduce((a, [, n]) => a + n, 0)) * 100)}%</div>
            </div>`).join('');
        })()}
      </div>
    </div>

    <div class="grid-2">
      <div class="chart-card">
        <div class="chart-card-title">📊 Authority Overview</div>
        <div class="chart-wrap" style="height:180px"><canvas id="chart-authority-radar"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-card-title">🚨 Spam Score Gauge</div>
        <div class="chart-card-sub">Lower = healthier domain</div>
        <div class="chart-wrap" style="height:180px"><canvas id="chart-spam-gauge"></canvas></div>
        <div style="text-align:center;margin-top:-20px">
          <div style="font-family:var(--mono);font-size:22px;font-weight:700;color:${s.spam_score <= 30 ? 'var(--green)' : s.spam_score <= 60 ? 'var(--yellow)' : 'var(--red)'}">${val(s.spam_score, 'N/A')}${s.spam_score !== null && s.spam_score !== undefined ? '%' : ''}</div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700">${val(s.spam_risk, 'Unknown')} risk &nbsp;·&nbsp; Source: ${val(s.source, 'N/A')}</div>
        </div>
      </div>
    </div>

    <div class="section-head">🖥️ Server, CMS & Technology Stack</div>
    <div class="grid-2">
      <div class="card">${cardHead('🖥️', 'Server & CMS', badge(val(srv.detection_source, 'heuristic'), 'blue'))}
        ${row('Web Server', srv.type)}
        ${row('CMS', srv.cms)}
        ${row('CMS Version', srv.cms_version)}
        ${row('WAF', srv.waf)}
        ${row('CDN', srv.cdn)}
        ${row('Hosting Provider', srv.hosting_provider)}
      </div>
      <div class="card">${cardHead('⚙️', 'Technology Stack')}
        <div style="margin-top:4px">${tags(srv.tech_stack, 'tech')}</div>
      </div>
    </div>

    <div class="section-head">🔐 Security & HTTPS</div>
    <div class="grid-2">
      <div class="card">${cardHead('🔒', 'SSL Certificate', badge(val(ssl.grade, 'N/A'), ssl.grade?.startsWith('A') ? 'green' : 'yellow'))}
        ${row('Valid', ssl.valid ? 'Yes ✔' : 'No ✖', ssl.valid ? 'good' : 'bad')}
        ${row('Issuer', ssl.issuer)}
        ${row('Expires', ssl.expires ? new Date(ssl.expires).toLocaleDateString() : null)}
        ${row('Days Remaining', ssl.days_remaining !== null && ssl.days_remaining !== undefined ? ssl.days_remaining + ' days' : null, ssl.days_remaining > 60 ? 'good' : ssl.days_remaining > 0 ? 'warn' : 'bad')}
        ${row('Protocol', ssl.protocol)}
        ${ssl.vulnerabilities?.length ? `<div style="margin-top:6px">${tags(ssl.vulnerabilities, 'missing')}</div>` : ''}
      </div>
      <div class="card">${cardHead('🛡️', 'Security Headers', badge(val(hdr.grade, '?'), hdr.grade?.startsWith('A') ? 'green' : 'yellow'))}
        ${row('HTTPS Enforced', sec.https_enforced ? 'Yes ✔' : 'No ✖', sec.https_enforced ? 'good' : 'bad')}
        ${row('Headers Score', hdr.score)}
        ${row('WAF Detected', sec.waf || 'None')}
        <div style="margin-top:8px">
          <div style="font-size:10px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.08em">Present</div>
          ${tags(hdr.present, 'present')}
          <div style="font-size:10px;color:var(--muted);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.08em">Missing</div>
          ${tags(hdr.missing, 'missing')}
        </div>
      </div>
    </div>

    <div class="section-head">⚡ Performance & Speed</div>
    <div class="grid-4">
      ${miniStat(val(perf.ttfb, '?'), 'TTFB', perf.ttfb && parseFloat(perf.ttfb) < 600 ? 'var(--green)' : 'var(--red)')}
      ${miniStat(val(perf.load_time_desktop, '?'), 'Load (Desktop)', 'var(--accent)')}
      ${miniStat(val(perf.load_time_mobile, '?'), 'Load (Mobile)', 'var(--accent)')}
      ${miniStat(val(perf.performance_score_mobile, '?'), 'Mobile Score', perf.performance_score_mobile >= 80 ? 'var(--green)' : perf.performance_score_mobile >= 50 ? 'var(--yellow)' : 'var(--red)')}
    </div>
    <div class="grid-3">
      <div class="card">${cardHead('📊', 'PageSpeed Scores')}
        <div style="display:flex;gap:14px;justify-content:center;margin:8px 0">
          <div style="text-align:center">
            <div class="score-circle ${scoreClass(perf.performance_score_mobile)}" style="width:56px;height:56px;font-size:14px">${val(perf.performance_score_mobile, '?')}<small>/100</small></div>
            <div style="font-size:10px;color:var(--muted);margin-top:4px">Mobile</div>
          </div>
          <div style="text-align:center">
            <div class="score-circle ${scoreClass(perf.performance_score_desktop)}" style="width:56px;height:56px;font-size:14px">${val(perf.performance_score_desktop, '?')}<small>/100</small></div>
            <div style="font-size:10px;color:var(--muted);margin-top:4px">Desktop</div>
          </div>
        </div>
      </div>
      <div class="card">${cardHead('📈', 'Core Web Vitals')}
        ${row('LCP', cwv.LCP, cwv.LCP && parseFloat(cwv.LCP) < 2.5 ? 'good' : cwv.LCP && parseFloat(cwv.LCP) < 4 ? 'warn' : 'bad')}
        ${row('CLS', cwv.CLS, cwv.CLS && parseFloat(cwv.CLS) < 0.1 ? 'good' : cwv.CLS && parseFloat(cwv.CLS) < 0.25 ? 'warn' : 'bad')}
        ${row('TBT', cwv.TBT, cwv.TBT && parseFloat(cwv.TBT) < 200 ? 'good' : cwv.TBT && parseFloat(cwv.TBT) < 600 ? 'warn' : 'bad')}
        ${row('FCP', cwv.FCP)}
        ${row('FID', cwv.FID)}
      </div>
      <div class="card">${cardHead('🗜️', 'Optimizations')}
        ${row('HTTP/2', perf.http2_supported ? 'Yes ✔' : 'No ✖', perf.http2_supported ? 'good' : 'bad')}
        ${row('HTTP/3', perf.http3_supported ? 'Yes ✔' : 'No', perf.http3_supported ? 'good' : '')}
        ${row('Compression', perf.compression_enabled ? `Yes (${perf.compression_type || '?'}) ✔` : 'No ✖', perf.compression_enabled ? 'good' : 'bad')}
        ${row('Lazy Loading', perf.lazy_loading_detected ? 'Yes ✔' : 'No ✖', perf.lazy_loading_detected ? 'good' : 'warn')}
      </div>
    </div>

    <div class="section-head">📦 JavaScript Rendering</div>
    <div class="grid-1">
      <div class="card">${cardHead('📦', 'JS Analysis')}
        <div class="mini-stat-grid">
          ${miniStat(js.js_dependency_count ?? '?', 'Dependencies', 'var(--accent)')}
          ${miniStat(js.render_blocking_scripts ?? '?', 'Render Blocking', js.render_blocking_scripts > 0 ? 'var(--red)' : 'var(--green)')}
          ${miniStat(js.js_heavy === null || js.js_heavy === undefined ? '?' : js.js_heavy ? 'Yes' : 'No', 'JS Heavy', js.js_heavy ? 'var(--red)' : 'var(--green)')}
          ${miniStat(js.ssr_detected === null || js.ssr_detected === undefined ? '?' : js.ssr_detected ? 'Yes' : 'No', 'SSR Detected', js.ssr_detected ? 'var(--green)' : 'var(--muted)')}
        </div>
        <div style="margin-bottom:6px"><span style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">Frameworks Detected</span></div>
        ${tags(js.frameworks_detected, 'tech')}
        ${js.notes ? `<div style="margin-top:10px;font-size:12px;color:var(--muted)">💡 ${js.notes}</div>` : ''}
      </div>
    </div>

    <div class="section-head">🌐 DNS Configuration</div>
    <div class="grid-2">
      <div class="card">${cardHead('🌐', 'DNS Records')}
        ${row('A Records', dns.A?.join(', '))}
        ${row('AAAA Records', dns.AAAA?.join(', ') || 'None')}
        ${row('CNAME', dns.CNAME?.join(', ') || 'None')}
        ${row('NS Records', dns.NS?.slice(0, 2).join(', '))}
        ${row('Hosting Provider', dns.hosting_provider)}
        ${dns.subdomains?.length ? `<div style="margin-top:6px"><span style="font-size:10px;color:var(--muted)">SUBDOMAINS</span>${tags(dns.subdomains)}</div>` : ''}
      </div>
      <div class="card">${cardHead('📧', 'Email DNS')}
        ${row('MX Records', dns.MX?.slice(0, 3).join(', '))}
        ${row('SPF', dns.SPF ? 'Configured ✔' : 'Missing ✖', dns.SPF ? 'good' : 'bad')}
        ${row('DMARC', dns.DMARC ? 'Configured ✔' : 'Missing ✖', dns.DMARC ? 'good' : 'bad')}
        ${dns.SPF ? `<div style="margin-top:6px;font-size:11px;color:var(--muted);word-break:break-all">${dns.SPF}</div>` : ''}
      </div>
    </div>

    <div class="section-head">🕷️ Crawlability & Structure</div>
    <div class="grid-3">
      <div class="card">${cardHead('🤖', 'Robots.txt', boolBadge(robots.found))}
        ${row('Found', robots.found ? 'Yes ✔' : 'No ✖', robots.found ? 'good' : 'bad')}
        ${row('Sitemap Declared', robots.sitemap_declared ? 'Yes ✔' : 'No', robots.sitemap_declared ? 'good' : 'warn')}
        ${row('Crawl Delay', robots.crawl_delay ?? 'None')}
        ${row('Disallowed Paths', robots.disallowed_paths?.length || 0)}
        ${robots.disallowed_paths?.length ? `<div style="margin-top:6px">${tags(robots.disallowed_paths.slice(0, 5))}</div>` : ''}
      </div>
      <div class="card">${cardHead('🗺️', 'Sitemap.xml', boolBadge(sitemap.found))}
        ${row('Found', sitemap.found ? 'Yes ✔' : 'No ✖', sitemap.found ? 'good' : 'bad')}
        ${row('Valid XML', sitemap.valid_xml ? 'Yes ✔' : 'No', sitemap.valid_xml ? 'good' : 'bad')}
        ${row('Total URLs', sitemap.url_count?.toLocaleString())}
        ${sitemap.url ? `<div style="margin-top:6px;font-size:10px;color:var(--muted);word-break:break-all">${sitemap.url}</div>` : ''}
      </div>
      <div class="card">${cardHead('📝', 'Schema Markup', boolBadge(schema.found))}
        ${row('Found', schema.found ? 'Yes ✔' : 'No', schema.found ? 'good' : 'warn')}
        ${row('Valid', schema.valid ? 'Yes ✔' : 'No', schema.valid ? 'good' : 'warn')}
        <div style="margin-top:8px"><span style="font-size:10px;color:var(--muted)">TYPES DETECTED</span>${tags(schema.types_detected)}</div>
        ${schema.parse_errors?.length ? `<div style="margin-top:6px">${tags(schema.parse_errors, 'missing')}</div>` : ''}
      </div>
    </div>

    ${(d.warnings?.length || Object.values(d.errors || {}).filter(v => v).length) ? `
    <div class="section-head">⚠ Warnings & Module Errors</div>
    <div class="grid-1">
      ${d.warnings?.length ? `<ul class="issue-list warn">${d.warnings.map(w => `<li>${w}</li>`).join('')}</ul>` : ''}
      ${Object.entries(d.errors || {}).filter(([, v]) => v).length
        ? `<ul class="issue-list err">${Object.entries(d.errors || {}).filter(([, v]) => v).map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`).join('')}</ul>`
        : ''}
    </div>` : ''}
  `;

  requestAnimationFrame(() => renderSEOCharts(s, bl));
}

// ── RENDER MANUAL AUDIT ─────────────────────────────────
function renderManual(d, overall) {
  if (!d) return;
  const perf = d.performance || {};
  const seo  = d.seo || {};
  const sec  = d.security || {};
  const acc  = d.accessibility || {};
  const mob  = d.mobile || {};
  const dns  = d.dns || {};
  const robots  = d.robots || {};
  const sitemap = d.sitemap || {};
  const ov = overall || d.overall || {};
  const bd = ov.breakdown || {};
  const ovCls = ov.score >= 80 ? 'good' : ov.score >= 60 ? 'ok' : 'bad';

  document.getElementById('overall-card').innerHTML = `
    <div class="overall-card">
      <div class="big-circle ${ovCls}">
        <div class="big-num">${ov.score || '?'}</div>
        <div class="big-grade">${ov.grade || '?'}</div>
      </div>
      <div style="flex:1">
        <div style="font-size:17px;font-weight:700;margin-bottom:4px">Overall Score</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Formula-based scoring — no API keys used</div>
        ${scoreBar('⚡ Performance',   bd.performance)}
        ${scoreBar('🔍 SEO',           bd.seo)}
        ${scoreBar('🔐 Security',      bd.security)}
        ${scoreBar('♿ Accessibility', bd.accessibility)}
        ${scoreBar('📱 Mobile',        bd.mobile)}
      </div>
    </div>`;

  function modCard(icon, title, mod) {
    const s = mod.score || 0;
    return `<div class="card">${cardHead(icon, title, badge(mod.grade || '?', s >= 80 ? 'green' : s >= 60 ? 'yellow' : 'red'))}
      <div class="score-row">
        <div class="score-circle ${scoreClass(s)}">${s}<small>/100</small></div>
        <div style="flex:1">
          ${Object.entries(mod.breakdown || {}).slice(0, 4).map(([, v]) => `<div style="font-size:11px;color:var(--muted);padding:2px 0">${v}</div>`).join('')}
        </div>
      </div>
    </div>`;
  }

  const el = document.getElementById('audit-sections');
  el.innerHTML = `
    <div class="section-head">📊 All Module Scores</div>
    <div class="grid-2">${modCard('⚡', 'Performance', perf)}${modCard('🔍', 'SEO', seo)}</div>
    <div class="grid-3">${modCard('🔐', 'Security', sec)}${modCard('♿', 'Accessibility', acc)}${modCard('📱', 'Mobile', mob)}</div>

    <div class="section-head">⚡ Performance Detail</div>
    <div class="grid-4">
      ${miniStat(perf.ttfb || '?', 'TTFB', perf.ttfb_rating === 'Excellent' ? 'var(--green)' : perf.ttfb_rating === 'Good' ? 'var(--yellow)' : 'var(--red)')}
      ${miniStat(perf.page_size_kb ? perf.page_size_kb + 'KB' : '?', 'Page Size', 'var(--accent)')}
      ${miniStat(perf.script_count ?? '?', 'Total Scripts', 'var(--accent)')}
      ${miniStat(perf.render_blocking ?? '?', 'Render Blocking', perf.render_blocking > 0 ? 'var(--red)' : 'var(--green)')}
    </div>
    <div class="grid-2">
      <div class="card">${cardHead('⚡', 'Performance Metrics')}
        ${row('TTFB', perf.ttfb, perf.ttfb_rating === 'Excellent' ? 'good' : perf.ttfb_rating === 'Good' ? 'warn' : 'bad')}
        ${row('Page Size', perf.page_size_kb ? perf.page_size_kb + ' KB' : null)}
        ${row('Total Scripts', perf.script_count)}
        ${row('Render-Blocking', perf.render_blocking, perf.render_blocking > 0 ? 'warn' : 'good')}
        ${row('HTTP/2', perf.http2_supported ? 'Yes ✔' : 'No ✖', perf.http2_supported ? 'good' : 'bad')}
        ${row('HTTP/3', perf.http3_supported ? 'Yes ✔' : 'No', perf.http3_supported ? 'good' : '')}
        ${row('Compression', perf.compression ? `Yes (${perf.compression_type || '?'}) ✔` : 'No ✖', perf.compression ? 'good' : 'bad')}
        ${row('Lazy Loading', perf.lazy_loading ? 'Yes ✔' : 'No ✖', perf.lazy_loading ? 'good' : 'warn')}
      </div>
      <div class="card">${cardHead('📋', 'Performance Score Breakdown')}
        ${Object.entries(perf.breakdown || {}).map(([k, v]) => `
          <div class="data-row">
            <span class="data-key">${k}</span>
            <span class="data-val" style="font-size:11px;color:${v.includes('/20') || v.includes('/15') || v.includes('/10') ? v.startsWith('0') ? 'var(--red)' : 'var(--green)' : 'var(--yellow)'}">${v}</span>
          </div>`).join('')}
      </div>
    </div>

    <div class="section-head">🔍 SEO Detail</div>
    <div class="grid-2">
      <div class="card">${cardHead('🔍', 'SEO Metrics')}
        ${row('Title', seo.title ? `"${seo.title.slice(0, 35)}…"` : null, seo.title ? '' : 'bad')}
        ${row('Title Length', seo.title_length ? seo.title_length + ' chars' : null, seo.title_length >= 30 && seo.title_length <= 60 ? 'good' : seo.title_length ? 'warn' : 'bad')}
        ${row('Meta Description', seo.meta_description ? seo.meta_desc_length + ' chars' : 'Missing ✖', seo.meta_description ? seo.meta_desc_length >= 120 && seo.meta_desc_length <= 160 ? 'good' : 'warn' : 'bad')}
        ${row('H1 / H2 / H3', `${seo.h1_count} / ${seo.h2_count} / ${seo.h3_count}`, seo.h1_count === 1 ? 'good' : seo.h1_count > 1 ? 'warn' : 'bad')}
        ${row('Word Count', seo.word_count, seo.word_count >= 500 ? 'good' : seo.word_count >= 300 ? 'warn' : 'bad')}
        ${row('Total Images', seo.total_images)}
        ${row('Images with Alt', seo.images_with_alt, seo.alt_text_pct === 100 ? 'good' : seo.alt_text_pct >= 80 ? 'warn' : 'bad')}
        ${row('Alt Text %', seo.alt_text_pct + '%', seo.alt_text_pct === 100 ? 'good' : seo.alt_text_pct >= 80 ? 'warn' : 'bad')}
        ${row('Internal Links', seo.internal_links)}
        ${row('Canonical Tag', seo.canonical ? 'Yes ✔' : 'No ✖', seo.canonical ? 'good' : 'warn')}
        ${row('OG Tags', seo.og_tags ? 'Present ✔' : 'Missing', seo.og_tags ? 'good' : 'warn')}
        ${row('Sitemap Found', seo.sitemap_found ? `Yes ✔ (${seo.sitemap_url_count} URLs)` : 'No ✖', seo.sitemap_found ? 'good' : 'bad')}
        <div style="margin-top:8px"><span style="font-size:10px;color:var(--muted)">SCHEMA TYPES</span>${tags(seo.schema_types)}</div>
      </div>
      <div class="card">${cardHead('📋', 'SEO Score Breakdown')}
        ${Object.entries(seo.breakdown || {}).map(([k, v]) => `
          <div class="data-row">
            <span class="data-key">${k}</span>
            <span class="data-val" style="font-size:11px;color:${v.startsWith('0/') ? 'var(--red)' : v.includes('/5') || v.includes('/10') ? 'var(--green)' : 'var(--yellow)'}">${v}</span>
          </div>`).join('')}
        ${seo.issues?.length ? `<div style="margin-top:10px"><ul class="issue-list warn">${seo.issues.map(i => `<li>${i}</li>`).join('')}</ul></div>` : ''}
      </div>
    </div>

    <div class="section-head">🔐 Security Detail</div>
    <div class="grid-2">
      <div class="card">${cardHead('🔐', 'Security Metrics')}
        ${row('HTTPS', sec.https ? 'Yes ✔' : 'No ✖', sec.https ? 'good' : 'bad')}
        ${row('SSL Valid', sec.ssl?.valid ? 'Yes ✔' : 'No ✖', sec.ssl?.valid ? 'good' : 'bad')}
        ${row('SSL Issuer', sec.ssl?.issuer)}
        ${row('Days Remaining', sec.ssl?.days_remaining ? sec.ssl.days_remaining + ' days' : null, sec.ssl?.days_remaining > 60 ? 'good' : sec.ssl?.days_remaining > 0 ? 'warn' : 'bad')}
        ${row('SSL Protocol', sec.ssl?.protocol)}
        ${row('Security Headers Score', sec.headers_score)}
        <div style="margin-top:8px">
          <div style="font-size:10px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.08em">Headers Present</div>
          ${tags(sec.headers_present, 'present')}
          <div style="font-size:10px;color:var(--muted);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.08em">Headers Missing</div>
          ${tags(sec.headers_missing, 'missing')}
        </div>
      </div>
      <div class="card">${cardHead('📋', 'Security Score Breakdown')}
        ${Object.entries(sec.breakdown || {}).map(([k, v]) => `
          <div class="data-row">
            <span class="data-key">${k}</span>
            <span class="data-val" style="font-size:11px;color:${v.includes('✔') ? 'var(--green)' : v.includes('✖') ? 'var(--red)' : 'var(--yellow)'}">${v}</span>
          </div>`).join('')}
        ${sec.issues?.length ? `<div style="margin-top:10px"><ul class="issue-list warn">${sec.issues.map(i => `<li>${i}</li>`).join('')}</ul></div>` : ''}
      </div>
    </div>

    <div class="section-head">♿ Accessibility & Mobile</div>
    <div class="grid-2">
      <div class="card">${cardHead('♿', `Accessibility — ${acc.score}/100 ${acc.grade || ''}`)}
        ${row('Language Attribute', acc.lang_attribute || 'Missing ✖', acc.lang_attribute ? 'good' : 'bad')}
        ${row('Viewport Meta', acc.viewport_meta ? 'Present ✔' : 'Missing ✖', acc.viewport_meta ? 'good' : 'bad')}
        ${row('Charset', acc.charset || 'Missing', acc.charset ? 'good' : 'warn')}
        ${row('Total Images', acc.total_images)}
        ${row('Images with Alt', acc.images_with_alt + ' / ' + acc.total_images, acc.images_with_alt === acc.total_images ? 'good' : 'warn')}
        ${row('Form Inputs', acc.form_inputs)}
        ${row('Labeled Inputs', acc.labeled_inputs + ' / ' + acc.form_inputs, acc.labeled_inputs === acc.form_inputs ? 'good' : 'warn')}
        ${row('ARIA Attributes', acc.aria_attributes, acc.aria_attributes > 0 ? 'good' : '')}
        ${row('Skip Link', acc.has_skip_link ? 'Yes ✔' : 'No', acc.has_skip_link ? 'good' : 'warn')}
        ${row('Focus Styles', acc.has_focus_style ? 'Yes ✔' : 'No', acc.has_focus_style ? 'good' : 'warn')}
        ${row('Favicon', acc.has_favicon ? 'Yes ✔' : 'No', acc.has_favicon ? 'good' : 'warn')}
        ${acc.issues?.length ? `<div style="margin-top:10px"><ul class="issue-list warn">${acc.issues.map(i => `<li>${i}</li>`).join('')}</ul></div>` : ''}
      </div>
      <div class="card">${cardHead('📱', `Mobile — ${mob.score}/100 ${mob.grade || ''}`)}
        ${row('Viewport Meta', mob.viewport ? 'Present ✔' : 'Missing ✖', mob.viewport ? 'good' : 'bad')}
        ${row('Media Queries', mob.media_queries, mob.media_queries >= 5 ? 'good' : mob.media_queries >= 2 ? 'warn' : 'bad')}
        ${row('Lazy Loading', mob.lazy_loading ? 'Yes ✔' : 'No ✖', mob.lazy_loading ? 'good' : 'warn')}
        ${row('Compression', mob.compression ? 'Yes ✔' : 'No ✖', mob.compression ? 'good' : 'bad')}
        ${row('Small Fonts Detected', mob.has_small_fonts ? 'Yes ⚠' : 'None', mob.has_small_fonts ? 'warn' : 'good')}
        ${row('Small Buttons Detected', mob.has_small_btns ? 'Yes ⚠' : 'None', mob.has_small_btns ? 'warn' : 'good')}
        ${row('Fixed Widths Detected', mob.has_fixed_width ? 'Yes ⚠' : 'None', mob.has_fixed_width ? 'warn' : 'good')}
        ${mob.issues?.length ? `<div style="margin-top:10px"><ul class="issue-list warn">${mob.issues.map(i => `<li>${i}</li>`).join('')}</ul></div>` : ''}
      </div>
    </div>

    <div class="section-head">🌐 DNS & Crawlability</div>
    <div class="grid-2">
      <div class="card">${cardHead('🌐', 'DNS Records')}
        ${row('A Records', dns.A?.join(', '))}
        ${row('AAAA Records', dns.AAAA?.length ? dns.AAAA.join(', ') : 'None')}
        ${row('MX Records', dns.MX?.slice(0, 2).join(', '))}
        ${row('NS Records', dns.NS?.slice(0, 2).join(', '))}
        ${row('SPF', dns.spf_configured ? 'Configured ✔' : 'Missing ✖', dns.spf_configured ? 'good' : 'bad')}
        ${row('DMARC', dns.dmarc_configured ? 'Configured ✔' : 'Missing ✖', dns.dmarc_configured ? 'good' : 'bad')}
      </div>
      <div class="card">${cardHead('🕷️', 'Robots.txt & Sitemap')}
        ${row('Robots.txt', robots.found ? 'Found ✔' : 'Not Found ✖', robots.found ? 'good' : 'bad')}
        ${row('Sitemap in Robots', robots.sitemap_declared ? 'Yes ✔' : 'No', robots.sitemap_declared ? 'good' : 'warn')}
        ${row('Disallowed Paths', robots.disallowed_paths?.length || 0)}
        ${row('Sitemap.xml', sitemap.found ? 'Found ✔' : 'Not Found', sitemap.found ? 'good' : 'bad')}
        ${row('Sitemap Valid XML', sitemap.valid_xml ? 'Yes ✔' : 'No', sitemap.valid_xml ? 'good' : 'bad')}
        ${row('Sitemap URLs', sitemap.url_count?.toLocaleString())}
      </div>
    </div>

    ${[
      ...(seo.issues  || []).map(i => `[SEO] ${i}`),
      ...(sec.issues  || []).map(i => `[Security] ${i}`),
      ...(acc.issues  || []).map(i => `[Accessibility] ${i}`),
      ...(mob.issues  || []).map(i => `[Mobile] ${i}`),
    ].length
      ? `<div class="section-head">⚠ All Issues Found</div>
         <ul class="issue-list warn">
           ${[
             ...(seo.issues  || []).map(i => `[SEO] ${i}`),
             ...(sec.issues  || []).map(i => `[Security] ${i}`),
             ...(acc.issues  || []).map(i => `[Accessibility] ${i}`),
             ...(mob.issues  || []).map(i => `[Mobile] ${i}`),
           ].map(i => `<li>${i}</li>`).join('')}
         </ul>`
      : `<div style="margin-top:16px;padding:12px 16px;background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);border-radius:var(--radius);color:var(--green);font-size:13px">✅ No major issues found!</div>`}
  `;
}

// ── AUDIT HISTORY ───────────────────────────────────────
async function loadHistory() {
  const domain = document.getElementById('history-domain').value.trim();
  if (!domain) return alert('Enter a domain e.g: example.com');

  const el = document.getElementById('history-content');
  el.innerHTML = '<div style="color:var(--muted);padding:16px 0">Loading…</div>';

  try {
    const res  = await fetch(`${apiBase()}/api/v1/audit/history/${encodeURIComponent(domain)}`);
    const json = await res.json();

    if (!json.success) {
      el.innerHTML = `<div class="error-banner show">No audits found for ${domain}</div>`;
      return;
    }

    el.innerHTML = `
      <div style="margin-bottom:12px;font-size:12px;color:var(--muted)">${json.pagination.total} audit(s) for <strong style="color:var(--text)">${domain}</strong></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Audit ID</th><th>Domain</th><th>Mode</th><th>Score</th><th>Grade</th><th>Date</th><th>Duration</th></tr></thead>
        <tbody>
          ${json.data.map(a => `<tr>
            <td>${a.audit_id?.slice(0, 13)}…</td>
            <td>${a.domain}</td>
            <td><span style="color:${a.audit_type === 'api' ? 'var(--accent)' : 'var(--yellow)'};font-family:var(--mono)">${a.audit_type?.toUpperCase()}</span></td>
            <td>${a.overall?.score ?? '—'}</td>
            <td>${a.overall?.grade ?? '—'}</td>
            <td>${new Date(a.createdAt).toLocaleString()}</td>
            <td>${a.audit_duration_ms}ms</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

  } catch (err) {
    el.innerHTML = `<div class="error-banner show">Cannot connect: ${err.message}</div>`;
  }
}

// ── SERVER HEALTH ────────────────────────────────────────
async function loadHealth() {
  const el = document.getElementById('health-content');
  el.innerHTML = '<div style="color:var(--muted)">Loading…</div>';

  try {
    const res  = await fetch(`${apiBase()}/api/v1/audit/health`);
    const json = await res.json();

    document.getElementById('srv-status').innerHTML = `<span class="dot green"></span>Online`;
    document.getElementById('db-status').innerHTML  = `<span class="dot ${json.database === 'connected' ? 'green' : 'red'}"></span>${json.database}`;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
        ${[
          ['Service',     'Web Audit X v2'],
          ['Status',      '<span style="color:var(--green)">● Online</span>'],
          ['Database',    json.database],
          ['Collection',  'audit_results'],
          ['Uptime',      Math.round(json.uptime_seconds / 60) + ' min'],
          ['Environment', json.environment],
        ].map(([k, v]) => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">${k}</div>
            <div style="font-family:var(--mono);font-size:15px;font-weight:700;margin-top:5px">${v}</div>
          </div>`).join('')}
      </div>
      <div style="margin-top:14px;font-size:12px;color:var(--muted)">Last checked: ${new Date().toLocaleTimeString()}</div>`;

  } catch (err) {
    document.getElementById('srv-status').innerHTML = `<span class="dot red"></span>Offline`;
    el.innerHTML = `<div class="error-banner show">Cannot reach backend at <strong>${apiBase()}</strong> — make sure your server is running and CORS is allowed for this origin.</div>`;
  }
}

// ── UTILS ────────────────────────────────────────────────
function copyJSON() {
  navigator.clipboard.writeText(document.getElementById('raw-json').textContent)
    .then(() => showToast('JSON copied to clipboard', 'success', 2000));
}

document.getElementById('audit-url').addEventListener('keydown', e => {
  if (e.key === 'Enter') runAudit();
});

document.getElementById('history-domain').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadHistory();
});

// Auto ping on load
fetch(`${apiBase()}/api/v1/audit/health`)
  .then(r => r.json())
  .then(j => {
    document.getElementById('srv-status').innerHTML = `<span class="dot green"></span>Online`;
    document.getElementById('db-status').innerHTML  = `<span class="dot ${j.database === 'connected' ? 'green' : 'red'}"></span>${j.database}`;
  })
  .catch(() => {
    document.getElementById('srv-status').innerHTML = `<span class="dot red"></span>Offline`;
  });

// ── CHART RENDERING ──────────────────────────────────────
const _charts = {};

function makeChart(id, config) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
  const canvas = document.getElementById(id);
  if (!canvas) return;
  _charts[id] = new Chart(canvas.getContext('2d'), config);
}

const C_GREEN  = '#10b981', C_RED    = '#ef4444', C_BLUE   = '#00d4ff';
const C_PURPLE = '#7c3aed', C_YELLOW = '#f59e0b', C_ORANGE = '#f97316';
const C_GREY   = '#374151', C_MUTED  = '#1e2d45';

function renderSEOCharts(s, bl) {
  const da    = s.DA || 0;
  const pa    = s.PA || 0;
  const spam  = s.spam_score || 0;
  const follow   = bl.dofollow ?? 0;
  const nofollow = bl.nofollow ?? 0;

  // Linking Domains by DA
  const highDA = Math.round((da / 100) * 40);
  const midDA  = Math.round((da / 100) * 35) + 15;
  const lowDA  = Math.max(0, 100 - highDA - midDA);
  makeChart('chart-linking-da', {
    type: 'bar',
    data: {
      labels: ['DA 61-100  (High)', 'DA 31-60  (Medium)', 'DA 1-30  (Low)'],
      datasets: [{ data: [highDA, midDA, lowDA], backgroundColor: [C_GREEN, C_YELLOW, C_GREY], borderRadius: 5, borderSkipped: false }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 900 },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#1e2d45' }, max: 100 },
        y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
      },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw}% of linking domains` } } },
    },
  });

  // Ranking Keywords donut
  const branded       = Math.round(da * 0.3);
  const informational = Math.round(da * 0.4);
  const transactional = Math.round(da * 0.2);
  const navigational  = Math.round(da * 0.1);
  makeChart('chart-ranking-kw', {
    type: 'doughnut',
    data: {
      labels: ['Informational', 'Branded', 'Transactional', 'Navigational'],
      datasets: [{
        data: [informational || 1, branded || 1, transactional || 1, navigational || 1],
        backgroundColor: [C_BLUE, C_GREEN, C_ORANGE, C_PURPLE],
        borderColor: '#111827', borderWidth: 2, hoverOffset: 6,
      }],
    },
    options: {
      cutout: '55%', responsive: true, maintainAspectRatio: false, animation: { duration: 900 },
      plugins: {
        legend: { display: true, position: 'right', labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10, padding: 8 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ~${ctx.raw}%` } },
      },
    },
  });

  // Inbound follow/nofollow donut
  makeChart('chart-inbound-donut', {
    type: 'doughnut',
    data: {
      labels: ['Follow', 'Nofollow'],
      datasets: [{ data: [follow || 1, nofollow || 0], backgroundColor: [C_GREEN, C_GREY], borderColor: '#111827', borderWidth: 3, hoverOffset: 4 }],
    },
    options: { cutout: '72%', responsive: false, animation: { duration: 900 }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } } } },
  });

  // Internal vs External donut
  makeChart('chart-int-ext-donut', {
    type: 'doughnut',
    data: {
      labels: ['Ext. Follow', 'Ext. Nofollow', 'Int. Follow', 'Int. Nofollow'],
      datasets: [{
        data: [follow || 1, nofollow || 0, Math.round(follow * 0.2) || 1, 0],
        backgroundColor: [C_BLUE, '#1e40af', C_GREEN, C_GREY],
        borderColor: '#111827', borderWidth: 3, hoverOffset: 4,
      }],
    },
    options: { cutout: '72%', responsive: false, animation: { duration: 900 }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } } } },
  });

  // Authority Radar
  makeChart('chart-authority-radar', {
    type: 'radar',
    data: {
      labels: ['Domain Auth', 'Page Auth', 'Trust', 'Link Quality', 'Content', 'Spam Safety'],
      datasets: [{
        label: 'This Site',
        data: [da, pa, Math.max(0, 100 - spam), Math.min(100, bl.dofollow_pct ?? 50), Math.min(100, da * 1.1), Math.max(0, 100 - spam)],
        borderColor: C_BLUE, backgroundColor: 'rgba(0,212,255,0.08)',
        pointBackgroundColor: C_BLUE, pointBorderColor: '#111827', pointRadius: 4, borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 900 },
      scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: '#1e2d45' }, angleLines: { color: '#1e2d45' }, pointLabels: { color: '#64748b', font: { size: 9 } } } },
      plugins: { legend: { display: false } },
    },
  });

  // Spam gauge (half-donut)
  makeChart('chart-spam-gauge', {
    type: 'doughnut',
    data: {
      labels: ['Spam', 'Clean'],
      datasets: [{
        data: [spam || 0, 100 - (spam || 0)],
        backgroundColor: [spam <= 30 ? C_GREEN : spam <= 60 ? C_YELLOW : C_RED, C_MUTED],
        borderColor: '#111827', borderWidth: 3, circumference: 180, rotation: 270, hoverOffset: 0,
      }],
    },
    options: { cutout: '70%', responsive: true, maintainAspectRatio: false, animation: { duration: 900 }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}%` } } } },
  });
}

// ── AI REPORT ────────────────────────────────────────────
const AI_MODELS = {
  openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  gemini:    ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  deepseek:  ['deepseek-chat', 'deepseek-reasoner'],
  groq:      ['llama-3.3-70b-versatile', 'llama3-8b-8192', 'mixtral-8x7b-32768'],
  anthropic: ['claude-sonnet-4-6', 'claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'],
};

function updateModelList() {
  const provider = document.getElementById('ai-provider').value;
  const sel = document.getElementById('ai-model');
  sel.innerHTML = AI_MODELS[provider].map((m, i) =>
    `<option value="${m}">${m}${i === 0 ? ' (recommended)' : ''}</option>`
  ).join('');
}

updateModelList();

function toggleKeyVisibility() {
  const inp = document.getElementById('ai-apikey');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function goToAIReport() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-ai').classList.add('active');
  document.querySelector('[data-page="ai"]').classList.add('active');

  if (lastData?.audit_id) {
    document.getElementById('ai-audit-id').value = lastData.audit_id;
    const hint = document.getElementById('ai-audit-hint');
    hint.textContent = `✅ Using latest audit: ${lastData.domain} (${lastData.audit_type?.toUpperCase()})`;
    hint.style.color = 'var(--green)';
  }
}

async function generateAIReport() {
  const auditId  = document.getElementById('ai-audit-id').value.trim();
  const provider = document.getElementById('ai-provider').value;
  const model    = document.getElementById('ai-model').value;
  const apiKey   = document.getElementById('ai-apikey').value.trim();

  if (!auditId) return showToast('Enter an Audit ID first — run an audit then click "Generate AI Report"', 'error');
  if (!apiKey)  return showToast('Enter your API key for the selected AI provider', 'error');

  document.getElementById('ai-loading').style.display    = 'block';
  document.getElementById('ai-report-wrap').style.display = 'none';
  document.getElementById('ai-error').classList.remove('show');

  const msgs = [
    'Fetching all metrics from MongoDB…',
    'Building audit prompt for AI model…',
    `Sending to ${document.getElementById('ai-provider').selectedOptions[0].text}…`,
    'AI is analyzing your website metrics…',
    'Almost done — writing your report…',
  ];
  let mi = 0;
  const iv = setInterval(() => {
    if (mi < msgs.length) document.getElementById('ai-loading-msg').textContent = msgs[mi++];
  }, 3000);

  showToast('AI is analyzing your audit — this takes 10-30 seconds…', 'info', 40000);

  try {
    const res = await fetch(`${apiBase()}/api/v1/audit/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit_id: auditId, provider, model, apiKey }),
    });

    clearInterval(iv);
    document.getElementById('ai-loading').style.display = 'none';

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server returned ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'AI analysis failed');

    document.getElementById('ai-report-meta').innerHTML =
      `Domain: <strong>${json.domain}</strong> &nbsp;·&nbsp; Provider: <strong>${json.provider}</strong> &nbsp;·&nbsp; Model: <strong style="font-family:var(--mono);font-size:11px">${json.model}</strong> &nbsp;·&nbsp; Audit: <strong>${json.audit_type?.toUpperCase()}</strong>`;

    document.getElementById('ai-report-content').innerHTML = renderMarkdown(json.report);
    document.getElementById('ai-report-wrap').style.display = 'block';
    document.getElementById('ai-report-wrap').scrollIntoView({ behavior: 'smooth' });

    window._aiReport = json;
    showToast('✅ AI report generated!', 'success');

  } catch (err) {
    clearInterval(iv);
    document.getElementById('ai-loading').style.display = 'none';
    const b = document.getElementById('ai-error');
    b.textContent = '✖ ' + err.message;
    b.classList.add('show');
    showToast('AI failed: ' + err.message, 'error');
  }
}

// ── MARKDOWN RENDERER ────────────────────────────────────
function renderMarkdown(text) {
  return text
    // Tables
    .replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g, (_, header, rows) => {
      const ths = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
      const trs = rows.trim().split('\n').map(r => {
        const tds = r.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      return `<div style="overflow-x:auto;margin:12px 0"><table class="ai-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
    })
    .replace(/^## (.+)$/gm, '<h2 class="ai-h2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="ai-h3">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^---$/gm, '<hr class="ai-hr">')
    .replace(/^- (.+)$/gm, '<li class="ai-li">$1</li>')
    .replace(/(<li class="ai-li">.*<\/li>\n?)+/g, m => `<ul class="ai-ul">${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li class="ai-li-num">$1</li>')
    .replace(/(<li class="ai-li-num">.*<\/li>\n?)+/g, m => `<ol class="ai-ol">${m}</ol>`)
    .replace(/\n\n/g, '</p><p class="ai-p">')
    .replace(/^(?!<)(.+)$/gm, (m, c) => c.startsWith('<') ? m : `<p class="ai-p">${c}</p>`)
    .replace(/<p class="ai-p"><\/p>/g, '');
}

// ── PDF DOWNLOAD — raw audit ─────────────────────────────
function downloadPDF() {
  if (!lastData) return showToast('Run an audit first', 'error');
  const d      = lastData;
  const domain = d.domain || d.data?.domain || 'website';
  const ov     = d.overall || {};
  const bd     = ov.breakdown || {};

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Web Audit Report — ${domain}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;font-size:13px;padding:32px}
  .header{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:28px 32px;border-radius:10px;margin-bottom:24px}
  .header h1{font-size:22px;font-weight:800;margin-bottom:4px}
  .header .sub{opacity:.7;font-size:13px}
  .header .domain{font-family:monospace;font-size:15px;color:#00d4ff;margin-top:8px}
  .section{margin-bottom:22px}
  .section-title{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;padding-bottom:7px;margin-bottom:12px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center}
  .kpi-val{font-size:22px;font-weight:800;color:#0f172a}
  .kpi-val.good{color:#10b981}.kpi-val.warn{color:#f59e0b}.kpi-val.bad{color:#ef4444}
  .kpi-label{font-size:10px;color:#64748b;margin-top:3px;text-transform:uppercase;letter-spacing:.08em}
  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px}
  .row:last-child{border:none}
  .row-key{color:#64748b}.row-val{font-weight:600;font-family:monospace}
  .row-val.good{color:#10b981}.row-val.bad{color:#ef4444}.row-val.warn{color:#f59e0b}
  .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:10px}
  .tag{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;margin:2px;background:#e2e8f0;color:#475569}
  .tag.good{background:#dcfce7;color:#166534}.tag.bad{background:#fee2e2;color:#991b1b}
  .score-bar{height:8px;background:#e2e8f0;border-radius:4px;margin-top:4px;overflow:hidden}
  .score-fill{height:100%;border-radius:4px}
  .footer{text-align:center;color:#94a3b8;font-size:11px;margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0}
  @media print{body{padding:0}@page{margin:20mm}}
</style>
</head>
<body>
<div class="header">
  <div class="sub">Web Audit X — Technical Audit Report</div>
  <h1>${domain}</h1>
  <div class="domain">Generated: ${new Date().toLocaleString()} &nbsp;·&nbsp; Mode: ${d.audit_type?.toUpperCase() || 'N/A'} &nbsp;·&nbsp; ID: ${d.audit_id?.slice(0, 16)}…</div>
</div>
<div class="section">
  <div class="section-title">Overall Score</div>
  <div class="grid">
    <div class="kpi"><div class="kpi-val ${ov.score >= 80 ? 'good' : ov.score >= 60 ? 'warn' : 'bad'}">${ov.score ?? 'N/A'}</div><div class="kpi-label">Overall / 100</div></div>
    <div class="kpi"><div class="kpi-val ${bd.performance >= 80 ? 'good' : bd.performance >= 60 ? 'warn' : 'bad'}">${bd.performance ?? 'N/A'}</div><div class="kpi-label">Performance</div></div>
    <div class="kpi"><div class="kpi-val ${bd.seo >= 80 ? 'good' : bd.seo >= 60 ? 'warn' : 'bad'}">${bd.seo ?? 'N/A'}</div><div class="kpi-label">SEO</div></div>
    <div class="kpi"><div class="kpi-val ${bd.security >= 80 ? 'good' : bd.security >= 60 ? 'warn' : 'bad'}">${bd.security ?? 'N/A'}</div><div class="kpi-label">Security</div></div>
  </div>
  ${[['Performance', bd.performance], ['SEO', bd.seo], ['Security', bd.security], ['Accessibility', bd.accessibility], ['Mobile', bd.mobile]]
    .filter(([, v]) => v !== undefined)
    .map(([l, v]) => `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span style="color:#64748b">${l}</span><span style="font-weight:700">${v}/100</span></div>
        <div class="score-bar"><div class="score-fill" style="width:${v}%;background:${v >= 80 ? '#10b981' : v >= 60 ? '#f59e0b' : '#ef4444'}"></div></div>
      </div>`).join('')}
</div>
${renderPDFSections(d)}
<div class="footer">Web Audit X &nbsp;·&nbsp; Group No. 5 — Open University of Sri Lanka &nbsp;·&nbsp; ${new Date().getFullYear()}</div>
</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

function renderPDFSections(d) {
  const sections = [];
  const res = d.data || d.result || d;

  const seo  = res.seo || {};
  const bl   = seo.backlinks || {};
  sections.push(`
    <div class="section">
      <div class="section-title">SEO & Authority</div>
      <div class="grid">
        <div class="kpi"><div class="kpi-val ${seo.DA >= 60 ? 'good' : seo.DA >= 40 ? 'warn' : 'bad'}">${seo.DA ?? 'N/A'}</div><div class="kpi-label">Domain Auth</div></div>
        <div class="kpi"><div class="kpi-val">${seo.PA ?? 'N/A'}</div><div class="kpi-label">Page Auth</div></div>
        <div class="kpi"><div class="kpi-val ${seo.spam_score <= 30 ? 'good' : seo.spam_score <= 60 ? 'warn' : 'bad'}">${seo.spam_score ?? 'N/A'}%</div><div class="kpi-label">Spam Score</div></div>
        <div class="kpi"><div class="kpi-val">${bl.total?.toLocaleString() ?? seo.internal_links ?? 'N/A'}</div><div class="kpi-label">Backlinks</div></div>
      </div>
    </div>`);

  const perf = res.performance || {};
  const cwv  = perf.core_web_vitals || {};
  sections.push(`
    <div class="section">
      <div class="section-title">Performance</div>
      <div class="card">
        <div class="row"><span class="row-key">TTFB</span><span class="row-val">${perf.ttfb ?? 'N/A'}</span></div>
        <div class="row"><span class="row-key">Desktop Score</span><span class="row-val ${perf.performance_score_desktop >= 80 ? 'good' : perf.performance_score_desktop >= 50 ? 'warn' : 'bad'}">${perf.performance_score_desktop ?? 'N/A'}/100</span></div>
        <div class="row"><span class="row-key">Mobile Score</span><span class="row-val ${perf.performance_score_mobile >= 80 ? 'good' : perf.performance_score_mobile >= 50 ? 'warn' : 'bad'}">${perf.performance_score_mobile ?? 'N/A'}/100</span></div>
        <div class="row"><span class="row-key">LCP</span><span class="row-val">${cwv.LCP ?? 'N/A'}</span></div>
        <div class="row"><span class="row-key">CLS</span><span class="row-val">${cwv.CLS ?? 'N/A'}</span></div>
        <div class="row"><span class="row-key">HTTP/2</span><span class="row-val ${perf.http2_supported ? 'good' : 'bad'}">${perf.http2_supported ? 'Yes' : 'No'}</span></div>
        <div class="row"><span class="row-key">Compression</span><span class="row-val ${(perf.compression_enabled || perf.compression) ? 'good' : 'bad'}">${(perf.compression_enabled || perf.compression) ? 'Enabled' : 'Disabled'}</span></div>
      </div>
    </div>`);

  const sec = res.security || {};
  const ssl = sec.ssl || {};
  const hdr = sec.headers || {};
  sections.push(`
    <div class="section">
      <div class="section-title">Security</div>
      <div class="card">
        <div class="row"><span class="row-key">HTTPS</span><span class="row-val ${(sec.https_enforced || sec.https) ? 'good' : 'bad'}">${(sec.https_enforced || sec.https) ? 'Enforced' : 'Not enforced'}</span></div>
        <div class="row"><span class="row-key">SSL Valid</span><span class="row-val ${ssl.valid ? 'good' : 'bad'}">${ssl.valid ? 'Valid' : 'Invalid'}</span></div>
        <div class="row"><span class="row-key">SSL Issuer</span><span class="row-val">${ssl.issuer ?? 'N/A'}</span></div>
        <div class="row"><span class="row-key">Days Remaining</span><span class="row-val ${ssl.days_remaining > 60 ? 'good' : ssl.days_remaining > 0 ? 'warn' : 'bad'}">${ssl.days_remaining ?? 'N/A'} days</span></div>
        <div class="row"><span class="row-key">Headers Score</span><span class="row-val">${hdr.grade || sec.headers_score || 'N/A'}</span></div>
      </div>
      <div style="margin-top:8px">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;margin-bottom:5px">Missing Headers</div>
        ${(hdr.missing || sec.headers_missing || []).map(h => `<span class="tag bad">${h}</span>`).join('') || '<span class="tag good">All present ✔</span>'}
      </div>
    </div>`);

  const dns = res.dns || {};
  if (dns.A || dns.SPF !== undefined) {
    sections.push(`
      <div class="section">
        <div class="section-title">DNS</div>
        <div class="card">
          <div class="row"><span class="row-key">A Records</span><span class="row-val">${(dns.A || []).join(', ') || 'N/A'}</span></div>
          <div class="row"><span class="row-key">SPF</span><span class="row-val ${dns.SPF || dns.spf_configured ? 'good' : 'bad'}">${dns.SPF || dns.spf_configured ? 'Configured' : 'Missing'}</span></div>
          <div class="row"><span class="row-key">DMARC</span><span class="row-val ${dns.DMARC || dns.dmarc_configured ? 'good' : 'bad'}">${dns.DMARC || dns.dmarc_configured ? 'Configured' : 'Missing'}</span></div>
        </div>
      </div>`);
  }

  return sections.join('');
}

// ── AI REPORT PDF ────────────────────────────────────────
function downloadAIReportPDF() {
  const r = window._aiReport;
  if (!r) return showToast('Generate AI report first', 'error');

  const content = document.getElementById('ai-report-content').innerHTML;
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>AI Audit Report — ${r.domain}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;font-size:13px;padding:36px;max-width:820px;margin:0 auto}
  .header{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:24px 28px;border-radius:10px;margin-bottom:28px}
  .header h1{font-size:20px;font-weight:800}
  .header .sub{opacity:.7;font-size:12px;margin-bottom:6px}
  .header .meta{font-family:monospace;font-size:12px;color:#00d4ff;margin-top:6px}
  .ai-h2{font-size:17px;font-weight:800;color:#0f172a;margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
  .ai-h3{font-size:14px;font-weight:700;color:#1e40af;margin:18px 0 8px}
  .ai-p{margin:8px 0;line-height:1.75;color:#374151}
  .ai-ul,.ai-ol{margin:8px 0 8px 18px;line-height:1.8}
  .ai-li,.ai-li-num{margin-bottom:4px;color:#374151}
  .ai-hr{border:none;border-top:1px solid #e2e8f0;margin:20px 0}
  .ai-table{width:100%;border-collapse:collapse;font-size:12px;margin:12px 0}
  .ai-table th{background:#0f172a;color:#fff;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em}
  .ai-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}
  .footer{text-align:center;color:#94a3b8;font-size:11px;margin-top:36px;padding-top:14px;border-top:1px solid #e2e8f0}
  @media print{body{padding:16px}@page{margin:15mm}}
</style>
</head>
<body>
  <div class="header">
    <div class="sub">Web Audit X — AI-Generated Analysis Report</div>
    <h1>${r.domain}</h1>
    <div class="meta">AI: ${r.provider} (${r.model}) &nbsp;·&nbsp; Audit: ${r.audit_type?.toUpperCase()} &nbsp;·&nbsp; ${new Date(r.generated_at).toLocaleString()}</div>
  </div>
  ${content}
  <div class="footer">Web Audit X &nbsp;·&nbsp; AI Report &nbsp;·&nbsp; ${r.domain} &nbsp;·&nbsp; ${new Date().getFullYear()}</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

function copyAIReport() {
  const text = window._aiReport?.report || '';
  navigator.clipboard.writeText(text).then(() => showToast('Report copied to clipboard', 'success', 2000));
}