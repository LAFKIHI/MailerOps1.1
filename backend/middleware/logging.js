// =============================================================================
// MailerOps - Request Logging Middleware
// =============================================================================

function loggingMiddleware(req, res, next) {
  const start = Date.now();
  const { method, path, query } = req;

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    const userId = req.userId || query.userId || '-';
    const logLine = `[${method}] ${path} → ${status} (${duration}ms) user=${userId}`;

    if (duration > 100) {
      console.warn(`[SLOW] ${logLine}`);
    } else if (status >= 400) {
      console.warn(logLine);
    } else if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development') {
      console.log(logLine);
    }
  });

  next();
}

module.exports = loggingMiddleware;
