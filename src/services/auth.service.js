import { User } from '../models/user.model.js';
import bcrypt from 'bcrypt';
import { ApiError } from '../utils/ApiError.js';
import { generateAccessAndRefreshToken } from '../utils/token.js';

const register = async ({ username, password }) => {
  if (!username || !password) {
    throw new ApiError('All fields are required', 400);
  }
  const isUserExists = await User.findOne({ username });
  if (isUserExists) {
    throw new ApiError('User already exists', 400);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const createdUser = await User.create({
    username,
    password: hashedPassword,
  });
  return { createdUser };
};

const login = async ({ username, password }) => {
  if (!username || !password) {
    throw new ApiError('All fields are required', 400);
  }

  // PASSWORD ko select karo
  const user = await User.findOne({ username }).select('+password');

  if (!user) {
    throw new ApiError('Invalid Credentials', 400);
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    throw new ApiError('Invalid Credentials', 400);
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id, user.role);

  // Sensitive fields remove
  user.password = undefined;
  user.refreshToken = undefined;

  return {
    user,
    accessToken,
    refreshToken,
  };
};

const profile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError('Unauthorized request', 401);
  }
  return { user };
};

const logout = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError('Unauthorized request', 401);
  }

  user.refreshToken = null;
  await user.save({ validateBeforeSave: false });
  return true;
};

const allUsers = async () => {
  const users = await User.find();
  if (!users) {
    throw new ApiError('Users not found', 404);
  }
  return { users };
};

const updateUser = async (id, role) => {
  if (!id || !role) {
    throw new ApiError('id and payload required', 400);
  }
  const updatedUser = await User.findByIdAndUpdate(
    id,
    {
      $set: {
        role,
      },
    },
    { new: true }
  );
  return { updatedUser };
};

const deleteUser = async (id) => {
  if (!id) {
    throw new ApiError('id is required for delete', 400);
  }
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError('User not found', 404);
  }
  await User.findByIdAndDelete(id);
  return true;
};
export { register, login, logout, profile, allUsers, updateUser, deleteUser };
