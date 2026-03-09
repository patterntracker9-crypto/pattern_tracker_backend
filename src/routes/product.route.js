import express from 'express';

import authMiddleware from '../middlewares/auth.middleware.js';
import {
  getAllProducts,
  getSingleProduct,
  missingStyles,
  upsertStyles,
} from '../controllers/products.controller.js';

const router = express.Router();

// -----------------------------------------
// Bulk Upsert (Protected / Optional Auth)
// -----------------------------------------
router.post('/bulk', upsertStyles);

// -----------------------------------------
// Get all products with filters & pagination
// Public
// -----------------------------------------
router.get('/', getAllProducts);

// Get missing channel listing styles
// router.get('/missing', getMissingChannelListing);

// missing styles
router.get('/missing', missingStyles);

// -----------------------------------------
// Get single product by styleNumber
// Public
// -----------------------------------------
router.get('/:styleNumber', getSingleProduct);

export default router;
