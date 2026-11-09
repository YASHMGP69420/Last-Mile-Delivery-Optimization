const { v4: uuidv4 } = require('uuid');

/**
 * Custom App Error class for operational errors
 */
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST', details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 Not Found Middleware
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: `The requested endpoint '${req.method} ${req.originalUrl}' does not exist on this server.`,
      requestId: uuidv4(),
    },
  });
};

/**
 * Centralized Express Error Handler
 */
const errorHandler = (err, req, res, next) => {
  const requestId = uuidv4();
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred on the server';
  let details = err.details || [];

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    const errorMessages = Object.values(err.errors).map((e) => e.message);
    message = `Validation failed: ${errorMessages.join('; ')}`;
    details = Object.keys(err.errors).map((key) => ({
      field: key,
      message: err.errors[key].message,
      value: err.errors[key].value,
    }));
  }

  // Mongoose Invalid ObjectId CastError
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    code = 'INVALID_IDENTIFIER';
    message = `Invalid ID format provided for field '${err.path}': '${err.value}'`;
    details = [{ field: err.path, value: err.value }];
  }

  // MongoDB Unique Index Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY_CONFLICT';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : 'value';
    message = `Resource with ${field} '${value}' already exists`;
    details = [{ field, value }];
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Provided authorization token is malformed or invalid';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Provided authorization token has expired';
  }

  if (process.env.NODE_ENV !== 'test' && statusCode === 500) {
    console.error(`[Error] Request ID ${requestId}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
      message,
      details,
      requestId,
    },
  });
};

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
};
