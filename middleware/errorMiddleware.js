/**
 * Custom error handler middleware for Express
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error handling request:', {
    url: req.originalUrl,
    method: req.method,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // Default error status and message
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation Error';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid ID format';
  } else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
  } else if (err.code === 11000) {
    status = 400;
    message = 'Duplicate key error';
  }

  // Create standardized error response
  const errorResponse = {
    success: false,
    status,
    message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  };
  
  // Add details in development mode
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.details = err.stack;
    if (err.errors) {
      errorResponse.validationErrors = err.errors;
    }
  }
  
  res.status(status).json(errorResponse);
};

export default errorHandler;
