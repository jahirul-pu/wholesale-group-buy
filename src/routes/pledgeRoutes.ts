import { Router } from 'express';
import { createPledge } from '../controllers/pledgeController.js';

const router = Router();

// Route mapping for Pledge creation
router.post('/campaigns/:id/pledge', createPledge);

export default router;
