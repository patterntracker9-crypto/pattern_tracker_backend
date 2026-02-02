import express from 'express';
import {
  deleteUserById,
  getProfile,
  getUsersList,
  loginUser,
  logoutUser,
  registerUser,
  update,
} from '../controllers/auth.controller.js';
import { verifyJWT } from '../middlewares/verifyJWT.js';
import { authorizedRoles } from '../middlewares/roleBaseAccess.middleware.js';
const router = express.Router();

router.post('/users/register', registerUser);
router.post('/users/login', loginUser);
router.post('/users/logout', verifyJWT, logoutUser);
router.get('/users/profile', verifyJWT, getProfile);
router.get('/users/list', verifyJWT, authorizedRoles('admin'), getUsersList);
router.delete('/users/delete/:user_id', verifyJWT, authorizedRoles('admin'), deleteUserById);
router.put('/users/update/:user_id', verifyJWT, authorizedRoles('admin'), update);

export default router;
