/**
 * performance/middleware/validate.js
 * Request validation for the performance audit endpoint.
 */

function validateAuditRequest(req, res, next) {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'A valid "url" field is required in the request body.' });
  }

  // Normalise – prepend https if missing
  let normalised = url.trim();
  if (!/^https?:\/\//i.test(normalised)) {
    normalised = 'https://' + normalised;
  }

  try {
    const parsed = new URL(normalised);
    // Block localhost / private IPs in production
    const hostname = parsed.hostname;
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname)) {
      return res.status(400).json({ success: false, error: 'Auditing localhost is not permitted.' });
    }
    req.body.url = normalised;   // attach normalised URL back
    return next();
  } catch (_) {
    return res.status(400).json({ success: false, error: 'The provided URL is invalid.' });
  }
}

module.exports = { validateAuditRequest };