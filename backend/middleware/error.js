// =============================================================================
// MailerOps - Error Handler Middleware
// =============================================================================

class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, { validationErrors: errors });
    this.errors = errors;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';
  const details = err.details || (err.errors ? { validationErrors: err.errors } : null);

  // Log error
  if (statusCode >= 500) {
    console.error(`[ERROR ${statusCode}] ${req.method} ${req.path} — ${message}`);
    console.error(err.stack);
  } else {
    console.warn(`[WARN ${statusCode}] ${req.method} ${req.path} — ${message}`);
  }

  // Build response
  const response = { error: message };
  if (details) response.details = details;
  
  // Include stack trace in development for 500 errors
  if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = { errorHandler, AppError, ValidationError, NotFoundError, ConflictError };
