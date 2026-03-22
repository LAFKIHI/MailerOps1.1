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
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  console.error(err.stack);
  
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details
    });
  }
  
  if (err instanceof NotFoundError) {
    return res.status(err.statusCode).json({
      error: err.message
    });
  }
  
  if (err instanceof ConflictError) {
    return res.status(err.statusCode).json({
      error: err.message
    });
  }
  
  // SQLite errors
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      error: 'Duplicate entry or constraint violation'
    });
  }
  
  // MongoDB errors
  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate entry or constraint violation'
    });
  }
  
  res.status(err.statusCode || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
};

module.exports = { errorHandler, AppError, ValidationError, NotFoundError, ConflictError };
