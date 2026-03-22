// =============================================================================
// MailerOps - Authentication Middleware
// =============================================================================

function authMiddleware(req, res, next) {
  // Allow OAuth callback without app auth header.
  if (req.path === '/callback' || req.originalUrl.startsWith('/oauth/callback')) {
    return next();
  }

  // Extract userId from headers only (never from query params).
  const userId =
    req.headers['x-user-id'] ||
    req.headers['authorization']?.replace('Bearer ', '');

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return res.status(401).json({ error: 'User ID is required' });
  }

  // Attach to request for downstream use
  req.userId = userId.trim();
  next();
}

module.exports = authMiddleware;
