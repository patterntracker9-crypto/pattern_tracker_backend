import {
  allUsers,
  deleteUser,
  login,
  logout,
  profile,
  register,
  updateUser,
} from '../services/auth.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const registerUser = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const { createdUser } = await register({ username, password });
  return res.status(201).json(new ApiResponse('User registered Successfully', createdUser, 201));
});

const loginUser = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const { accessToken, refreshToken, user } = await login({
    username,
    password,
  });

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    // maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  // Set Cookies
  res.cookie('accessToken', accessToken, cookieOptions);
  res.cookie('refreshToken', refreshToken, cookieOptions);

  return res.status(200).json(
    new ApiResponse(
      'User logged in successfully.',
      {
        user,
      },
      200
    )
  );
});

const logoutUser = asyncHandler(async (req, res) => {
  const response = await logout(req.user?._id);
  if (!response) {
    throw new ApiError('Not authorized', 401);
  }
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    // maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
  return res.status(200).json(new ApiResponse('User logout success', null, 200));
});

const getProfile = asyncHandler(async (req, res) => {
  const { user } = await profile(req.user?._id);
  if (!user) {
    throw new ApiError('Not authorized', 401);
  }
  return res.status(200).json(new ApiResponse('Profile fetched successfully', user, 200));
});

const getUsersList = asyncHandler(async (req, res) => {
  const { users } = await allUsers();
  return res.status(200).json(new ApiResponse('User list fetched successfully.', users, 200));
});

const update = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const { role } = req.body;
  const { updatedUser } = await updateUser(user_id, role);
  return res.status(203).json(new ApiResponse('User updated successfully', updatedUser, 203));
});

const deleteUserById = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const response = await deleteUser(user_id);
  if (!response) {
    throw new ApiError('Unauthorized', 401);
  }
  return res.status(200).json(new ApiResponse('User deleted successfully', null, 200));
});
export { registerUser, loginUser, logoutUser, getProfile, update, getUsersList, deleteUserById };
