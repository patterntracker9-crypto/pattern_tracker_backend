import { User } from '../models/user.model.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// -----------------------------------------------
// REGISTER CONTROLLER
// -----------------------------------------------
export const registerUser = asyncHandler(async (req, res) => {
  const { username, employee_id, password } = req.body;

  console.log('📝 Registration attempt:', { username, employee_id });

  // 1. Validation
  if (!username || !employee_id || !password) {
    throw new ApiError(400, 'All fields are required');
  }

  if (password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }

  // 2. Convert employee_id to number
  const empId = Number(employee_id);
  if (isNaN(empId)) {
    throw new ApiError(400, 'Employee ID must be a number');
  }

  // 3. Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ username: username.toLowerCase().trim() }, { employee_id: empId }],
  });

  if (existingUser) {
    if (existingUser.username === username.toLowerCase().trim()) {
      throw new ApiError(409, 'Username already exists');
    }
    throw new ApiError(409, 'Employee ID already exists');
  }

  // 4. ✅ HASH PASSWORD MANUALLY (NO PRE-SAVE HOOK)
  const bcrypt = await import('bcrypt');
  const hashedPassword = await bcrypt.hash(password, 10);

  // 5. Create user with already hashed password
  const user = await User.create({
    username: username.toLowerCase().trim(),
    employee_id: empId,
    password: hashedPassword,
  });

  console.log('✅ User created successfully:', user._id);

  // 6. Return response (toJSON will remove password)
  return res.status(201).json(
    new ApiResponse(
      201,
      user, // toJSON() called automatically
      'User registered successfully'
    )
  );
});
// -----------------------------------------------
// LOGIN CONTROLLER
// -----------------------------------------------
export const loginUser = asyncHandler(async (req, res) => {
  const { employee_id, password } = req.body;

  if (!employee_id || !password) {
    throw new ApiError(400, 'Employee ID and password are required');
  }

  const user = await User.findOne({ employee_id });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Compare password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Generate tokens
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  // Save refresh token in DB
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  // Cookie options
  const options = {
    httpOnly: true,
    secure: false, // true only in production with HTTPS
    sameSite: 'lax',
  };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: {
            _id: user._id,
            username: user.username,
            employee_id: user.employee_id,
          },
          accessToken,
          refreshToken,
        },
        'Login successful'
      )
    );
});

// -----------------------------------------------
// LOGOUT CONTROLLER
// -----------------------------------------------
export const logoutUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.refreshToken = '';
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, {}, 'Logout successful'));
});

// -----------------------------------------------
// REFRESH TOKEN (GET NEW ACCESS TOKEN)
// -----------------------------------------------
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingToken = req.body.refreshToken || req.cookies.refreshToken;

  if (!incomingToken) {
    throw new ApiError(401, 'Refresh token missing');
  }

  let decoded;
  try {
    decoded = jwt.verify(incomingToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (error) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const user = await User.findById(decoded._id);

  if (!user || user.refreshToken !== incomingToken) {
    throw new ApiError(401, 'Unauthorized');
  }

  const newAccessToken = user.generateAccessToken();

  return res
    .status(200)
    .json(new ApiResponse(200, { accessToken: newAccessToken }, 'Access token refreshed'));
});
