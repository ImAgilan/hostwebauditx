const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function authHeaders() {
  const token = localStorage.getItem('wax_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),          // ← ADD token on every request
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed with status ${res.status}`);
  }

  return res.json();
}

/** POST /api/ui-analysis/analyze */
export async function analyzeURL(url) {
  return request('/api/ui-analysis/analyze', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

/** GET /api/ui-analysis/report/:id */
export async function fetchReport(id) {
  return request(`/api/ui-analysis/report/${id}`);
}

/** GET /api/ui-analysis/reports */
export async function fetchRecentReports(limit = 10) {
  return request(`/api/ui-analysis/reports?limit=${limit}`);
}

/** Trigger PDF download via browser */
export function downloadPDFReport(id) {
  window.open(`${API_BASE}/api/ui-analysis/download/${id}`, '_blank');
}