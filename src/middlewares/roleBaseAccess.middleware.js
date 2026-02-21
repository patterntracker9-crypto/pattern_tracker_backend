import { ApiError } from '../utils/ApiError.js';

const authorizedRoles = (...roles) => {
  return (req, _, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Not Authorized');
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'Unauthorized resource access');
    }
    next();
  };
};

export { authorizedRoles };
