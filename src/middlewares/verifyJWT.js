import { ApiError } from '../utils/ApiError.js';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
const verifyJWT = async (req, res, next) => {
  const token = req.cookies?.accessToken;
  if (!token) {
    throw new ApiError('Not authorized , token missing', 401);
  }
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      throw new ApiError('User not found', 401);
    }
    next();
  } catch (error) {
    throw new ApiError('Not authorized, token invalid', 401);
  }
};

export { verifyJWT };
