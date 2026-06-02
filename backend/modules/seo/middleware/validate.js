/**
 * seo/middleware/validate.js
 */
function validateSeoRequest(req, res, next) {
  let { url } = req.body;
  if (!url || typeof url !== 'string')
    return res.status(400).json({ success: false, error: 'A valid "url" is required.' });

  if (!/^https?:\/\//i.test(url)) url = 'https://' + url.trim();

  try {
    const parsed = new URL(url);
    if (['localhost','127.0.0.1'].includes(parsed.hostname))
      return res.status(400).json({ success: false, error: 'Localhost URLs are not permitted.' });
    req.body.url = url;
    return next();
  } catch (_) {
    return res.status(400).json({ success: false, error: 'Invalid URL format.' });
  }
}

module.exports = { validateSeoRequest };