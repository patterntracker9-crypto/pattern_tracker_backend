import express from 'express';
import {
  getCatalouges,
  report,
  upsertCatalogueProgress,
} from '../controllers/catalogue.controller.js';

const router = express.Router();

router.post('/upsert', upsertCatalogueProgress);
router.get('/', getCatalouges);
router.get('/report', report);

export default router;
