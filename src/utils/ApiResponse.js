// class ApiResponse {
//   constructor(message, data, statusCode) {
//     this.message = message;
//     this.data = data;
//     this.statusCode = statusCode;
//   }
// }

// export { ApiResponse };
// utils/apiResponse.js

class ApiResponse {
  constructor(statusCode, data = null, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

export { ApiResponse };
