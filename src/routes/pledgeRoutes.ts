import { Router } from 'express';
import {
  createPledge,
  getActiveCampaigns,
  forceUnlockCampaign,
  getDeliveries,
  getOrphans,
  clearOrphanToFlash,
  getTrustLogs
} from '../controllers/pledgeController.js';
import { dispatchCampaignOrders } from '../controllers/dispatchController.js';

const router = Router();

// Pledge Route
router.post('/campaigns/:id/pledge', createPledge);
router.post('/campaigns/:id/dispatch', dispatchCampaignOrders);

// Analytics and Operations Dashboard Routes
router.get('/campaigns', getActiveCampaigns);
router.post('/campaigns/:id/force-unlock', forceUnlockCampaign);
router.get('/deliveries', getDeliveries);
router.get('/orphans', getOrphans);
router.post('/orphans/:id/clear', clearOrphanToFlash);
router.get('/trust-logs', getTrustLogs);

export default router;
