/**
 * performance/test/performance.test.js
 * Jest unit tests for helpers and route validation.
 */

const {
  getRating,
  lighthouseScoreTo100,
  computeOverallScore,
  scoreToGrade,
  speedCategory,
  formatBytes
} = require('../utils/helpers');

// ── getRating ──────────────────────────────────────────────────────────────────
describe('getRating()', () => {
  test('LCP good:   ≤ 2500ms', () => expect(getRating('lcp', 2000)).toBe('good'));
  test('LCP needs:  2500–4000ms', () => expect(getRating('lcp', 3000)).toBe('needs-improvement'));
  test('LCP poor:   > 4000ms', () => expect(getRating('lcp', 5000)).toBe('poor'));
  test('CLS good:   ≤ 0.1', () => expect(getRating('cls', 0.05)).toBe('good'));
  test('CLS poor:   > 0.25', () => expect(getRating('cls', 0.3)).toBe('poor'));
  test('unknown metric', () => expect(getRating('unknown', 999)).toBe('unknown'));
  test('null value',     () => expect(getRating('lcp', null)).toBe('unknown'));
});

// ── lighthouseScoreTo100 ───────────────────────────────────────────────────────
describe('lighthouseScoreTo100()', () => {
  test('converts 0.92 → 92', () => expect(lighthouseScoreTo100(0.92)).toBe(92));
  test('converts 0    → 0',  () => expect(lighthouseScoreTo100(0)).toBe(0));
  test('converts 1    → 100',() => expect(lighthouseScoreTo100(1)).toBe(100));
  test('null → null',        () => expect(lighthouseScoreTo100(null)).toBeNull());
});

// ── computeOverallScore ────────────────────────────────────────────────────────
describe('computeOverallScore()', () => {
  test('returns null when no inputs', () =>
    expect(computeOverallScore({})).toBeNull());

  test('uses pagespeed + lighthouse equally (no puppeteer)', () => {
    const score = computeOverallScore({ pagespeedMobile: 80, lighthouse: 60 });
    expect(score).toBe(70);
  });

  test('includes load time weighting', () => {
    // load 1000ms → 100 score, pagespeed 80, lighthouse 80
    const score = computeOverallScore({ pagespeedMobile: 80, lighthouse: 80, loadTimeMs: 1000 });
    expect(score).toBeGreaterThanOrEqual(80);
  });
});

// ── scoreToGrade ───────────────────────────────────────────────────────────────
describe('scoreToGrade()', () => {
  test('90+ → A', () => expect(scoreToGrade(95)).toBe('A'));
  test('75+ → B', () => expect(scoreToGrade(80)).toBe('B'));
  test('60+ → C', () => expect(scoreToGrade(65)).toBe('C'));
  test('45+ → D', () => expect(scoreToGrade(50)).toBe('D'));
  test('< 45 → F', () => expect(scoreToGrade(30)).toBe('F'));
  test('null → null', () => expect(scoreToGrade(null)).toBeNull());
});

// ── speedCategory ─────────────────────────────────────────────────────────────
describe('speedCategory()', () => {
  test('90+ → fast',    () => expect(speedCategory(92)).toBe('fast'));
  test('50–89 → average', () => expect(speedCategory(70)).toBe('average'));
  test('< 50 → slow',   () => expect(speedCategory(30)).toBe('slow'));
  test('null → unknown',() => expect(speedCategory(null)).toBe('unknown'));
});

// ── formatBytes ───────────────────────────────────────────────────────────────
describe('formatBytes()', () => {
  test('0 → "0 B"',         () => expect(formatBytes(0)).toBe('0 B'));
  test('1024 → "1.0 KB"',   () => expect(formatBytes(1024)).toBe('1.0 KB'));
  test('1048576 → "1.0 MB"',() => expect(formatBytes(1048576)).toBe('1.0 MB'));
});

// ── Middleware validation (lightweight) ───────────────────────────────────────
describe('URL Middleware (unit)', () => {
  const { validateAuditRequest } = require('../middleware/validate');

  function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
  }

  test('passes valid URL', () => {
    const req  = { body: { url: 'https://example.com' } };
    const res  = mockRes();
    const next = jest.fn();
    validateAuditRequest(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('prepends https:// when missing', () => {
    const req  = { body: { url: 'example.com' } };
    const res  = mockRes();
    const next = jest.fn();
    validateAuditRequest(req, res, next);
    expect(req.body.url).toBe('https://example.com');
    expect(next).toHaveBeenCalled();
  });

  test('rejects missing url', () => {
    const req  = { body: {} };
    const res  = mockRes();
    validateAuditRequest(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects localhost', () => {
    const req  = { body: { url: 'http://localhost:3000' } };
    const res  = mockRes();
    validateAuditRequest(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});