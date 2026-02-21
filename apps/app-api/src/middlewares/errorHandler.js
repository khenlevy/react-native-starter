import logger from '@buydy/se-logger';

export const errorHandler = (err, req, res, _next) => {
  logger.business('Error', {
    error: err.message,
    stack: err.stack,
    path: req.originalUrl,
  });

  // Default error response
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    details = err.message;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry';
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.message) {
    message = err.message;
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    details = null;
  }

  res.status(statusCode).json({
    error: message,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
};
