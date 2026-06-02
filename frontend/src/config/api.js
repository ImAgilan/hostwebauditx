// frontend/src/config/api.js
// ─────────────────────────────────────────────
// Single source of truth for backend API URL.
// In development:  http://localhost:5000
// In production:   your Render backend URL
// ─────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default API_BASE;

// Usage in any component or service file:
//
// import API_BASE from '../config/api';
//
// const res = await fetch(`${API_BASE}/api/ui-analysis/analyze`, {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ url })
// });