/**
 * Admin API Service — Frontend (FIXED)
 *
 * Fix: Errors now carry .status so pages can show
 *      "Permission denied" instead of blank screens.
 */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/admin';

function getToken () {
  return localStorage.getItem('adminToken');
}

function authHeaders () {
  const h = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

/**
 * Core request helper.
 * Attaches HTTP status to thrown errors — pages use err.status to
 * distinguish "Permission denied (403)" from real failures (500).
 */
async function request (path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: authHeaders(),
      ...options,
    });
  } catch (networkErr) {
    const e = new Error('Cannot reach server. Is the backend running?');
    e.status = 0;
    throw e;
  }

  let data;
  try {
    data = await res.json();
  } catch {
    const e = new Error(`Server returned non-JSON response (HTTP ${res.status})`);
    e.status = res.status;
    throw e;
  }

  if (!data.success) {
    // 401 → session expired → redirect to login
    if (res.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminData');
      window.location.href = '/admin/login';
      return;
    }

    const e = new Error(data.message || 'Request failed');
    e.status = res.status;   // ← KEY FIX: pages can now read err.status
    throw e;
  }

  return data;
}

/* ── Auth ── */
export const adminLogin = (body) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify(body) });

export const adminLogout = () =>
  request('/auth/logout', { method: 'POST' });

export const getAdminProfile = () =>
  request('/auth/me');

/* ── Dashboard ── */
export const getDashboardStats = () =>
  request('/dashboard/stats');

export const getRevenueCharts = () =>
  request('/dashboard/revenue');

/* ── Users ── */
export const listUsers = (params = {}) => {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== 'all'))
  ).toString();
  return request(`/users${q ? `?${q}` : ''}`);
};

export const getUser = (id) =>
  request(`/users/${id}`);

export const updateUser = (id, body) =>
  request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const banUser = (id, reason) =>
  request(`/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ reason }) });

export const unbanUser = (id) =>
  request(`/users/${id}/unban`, { method: 'POST' });

export const deleteUser = (id) =>
  request(`/users/${id}`, { method: 'DELETE' });

/* ── Admins (super_admin only) ── */
export const listAdmins = (params = {}) => {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== 'all'))
  ).toString();
  return request(`/admins${q ? `?${q}` : ''}`);
};

export const createAdmin = (body) =>
  request('/admins', { method: 'POST', body: JSON.stringify(body) });

export const updateAdmin = (id, body) =>
  request(`/admins/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const resetAdminPassword = (id, newPassword) =>
  request(`/admins/${id}/password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });

export const deleteAdmin = (id) =>
  request(`/admins/${id}`, { method: 'DELETE' });

/* ── Audit History ── */
export const getAuditHistory = (params = {}) => {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== 'all'))
  ).toString();
  return request(`/audits${q ? `?${q}` : ''}`);
};