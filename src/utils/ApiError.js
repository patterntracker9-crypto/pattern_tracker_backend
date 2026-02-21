// class ApiError extends Error {
//   constructor(message, statusCode) {
//     super(message);
//     this.statusCode = statusCode;
//     this.success = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
//     this.isOperational = true;
//     Error.captureStackTrace(this, this.constructor);
//   }
// }

// export { ApiError };

// utils/apiError.js

class ApiError extends Error {
  constructor(statusCode, message = 'Something went wrong', errors = [], stack = '') {
    super(message);

    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.success = false;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { ApiError };
