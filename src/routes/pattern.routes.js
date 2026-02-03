import express from 'express';
import { authorizedRoles } from '../middlewares/roleBaseAccess.middleware.js';
import {
  fetchPatterns,
  syncPatternsFromSheet,
  updatePatternSizes,
} from '../controllers/pattern.contoller.js';
import { verifyJWT } from '../middlewares/verifyJWT.js';

const router = express.Router();

router.post('/sync', verifyJWT, authorizedRoles('admin'), syncPatternsFromSheet);
router.get('/', fetchPatterns);
router.put(
  '/:pattern_number',
  verifyJWT,
  authorizedRoles('admin', 'pattern_master'),
  updatePatternSizes
);

export default router;

