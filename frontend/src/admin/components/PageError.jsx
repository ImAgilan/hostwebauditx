/**
 * Shared UI helpers used across all admin pages.
 *
 * PageError   — shows an error with correct message for 403/0/other
 * PageSpinner — centered loading spinner
 */

/* ── Error block ── */
export function PageError ({ error, onRetry }) {
  const is403      = error?.status === 403;
  const isOffline  = error?.status === 0;

  const icon    = is403 ? '🔒' : isOffline ? '📡' : '⚠';
  const heading = is403
    ? 'Permission Denied'
    : isOffline
    ? 'Cannot Reach Server'
    : 'Something Went Wrong';

  const body = is403
    ? 'Your account does not have access to this section. Ask a super admin to grant you the required permission.'
    : isOffline
    ? 'Make sure the backend server is running on port 5000.'
    : (error?.message || 'An unexpected error occurred.');

  return (
    <div style={{
      background: is403 ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)',
      border: `1px solid ${is403 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
      borderRadius: '12px',
      padding: '40px 32px',
      textAlign: 'center',
      maxWidth: '520px',
      margin: '60px auto',
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>{icon}</div>
      <div style={{
        fontFamily: 'Syne, sans-serif',
        fontWeight: 700,
        fontSize: '1.15rem',
        marginBottom: '12px',
        color: is403 ? '#f59e0b' : '#ef4444',
      }}>
        {heading}
      </div>
      <div style={{ color: 'var(--adm-text2)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '24px' }}>
        {body}
      </div>
      {!is403 && onRetry && (
        <button className="adm-btn adm-btn-outline" onClick={onRetry}>
          ↻ Retry
        </button>
      )}
    </div>
  );
}

/* ── Spinner ── */
export function PageSpinner () {
  return (
    <div className="adm-loading-overlay">
      <div className="adm-spinner" />
    </div>
  );
}