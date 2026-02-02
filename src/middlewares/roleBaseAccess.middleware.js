import { ApiError } from '../utils/ApiError.js';

const authorizedRoles = (...roles) => {
  return (req, _, next) => {
    if (!req.user) {
      throw new ApiError('Not Authorized', 401);
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError('Unauthorized resource access', 403);
    }
    next();
  };
};

export { authorizedRoles };
