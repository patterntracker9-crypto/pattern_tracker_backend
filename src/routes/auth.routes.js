import express from 'express';
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
} from '../controllers/auth.controller.js';

import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

// ---------- Public Routes ----------
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh-token', refreshAccessToken);

// ---------- Protected Routes ----------
router.post('/logout', authMiddleware, logoutUser);

export default router;
