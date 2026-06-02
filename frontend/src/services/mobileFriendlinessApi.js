// frontend/src/services/mobileFriendlinessApi.js

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed with status ${res.status}`);
  }
  return res.json();
}

/** POST /api/mobile-friendliness/analyze */
export async function analyzeURL(url) {
  return request('/api/mobile-friendliness/analyze', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

/** GET /api/mobile-friendliness/report/:id */
export async function fetchReport(id) {
  return request(`/api/mobile-friendliness/report/${id}`);
}

/** GET /api/mobile-friendliness/reports */
export async function fetchRecentReports(limit = 10) {
  return request(`/api/mobile-friendliness/reports?limit=${limit}`);
}

/** Trigger PDF download via browser */
export function downloadPDFReport(id) {
  window.open(`${API_BASE}/api/mobile-friendliness/download/${id}`, '_blank');
}