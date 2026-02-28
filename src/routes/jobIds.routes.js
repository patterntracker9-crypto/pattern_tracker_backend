import express from 'express';
import { createJob, getJobIds } from '../controllers/job.controller.js';
const router = express.Router();

router.post('/create', createJob);
router.get('/', getJobIds);

export default router;
