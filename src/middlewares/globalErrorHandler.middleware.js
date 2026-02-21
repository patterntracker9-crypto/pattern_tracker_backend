import { ApiError } from '../utils/ApiError.js';

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Something went wrong';

  // MongoDB Cast Error
  if (err.name === 'CastError') {
    err = new ApiError(400, 'Invalid ID format');
  }

  // Duplicate Key Error
  if (err.code === 11000) {
    err = new ApiError(400, 'Duplicate field value entered');
  }

  // Validation Error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    err = new ApiError(400, message);
  }

  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export { globalErrorHandler };
