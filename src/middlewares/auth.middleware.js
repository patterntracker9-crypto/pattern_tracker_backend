// middlewares/auth.middleware.js

import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new ApiError(401, 'Unauthorized: No token provided');
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    req.user = await User.findById(decoded._id).select('-password');

    if (!req.user) {
      throw new ApiError(401, 'Invalid token - user not found');
    }

    next();
  } catch (error) {
    next(new ApiError(401, 'Unauthorized: Invalid or expired token'));
  }
};

export default authMiddleware;
