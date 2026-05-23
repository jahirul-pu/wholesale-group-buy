import { Router } from 'express';
import {
  createPledge,
  getActiveCampaigns,
  forceUnlockCampaign,
  getDeliveries,
  getOrphans,
  clearOrphanToFlash,
  getTrustLogs,
  getCampaign,
  getUser,
  getUsers,
  confirmPledgePayment,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendOTP,
  verifyOTP
} from '../controllers/pledgeController.js';
import { dispatchCampaignOrders } from '../controllers/dispatchController.js';
import { handleCourierWebhook } from '../controllers/webhookController.js';
import { handleWarehouseIngest } from '../controllers/warehouseController.js';
import { initiateCheckout, handlePaymentWebhook } from '../controllers/checkoutController.js';

const router = Router();

// Authentication Routes
router.post('/auth/send-otp', sendOTP);
router.post('/auth/verify-otp', verifyOTP);

// Admin Route to Create, Update, Delete Campaign
router.post('/admin/campaigns', createCampaign);
router.put('/admin/campaigns/:id', updateCampaign);
router.delete('/admin/campaigns/:id', deleteCampaign);

// Pledge Route
router.post('/campaigns/:id/pledge', createPledge);
router.post('/campaigns/:id/dispatch', dispatchCampaignOrders);

// Campaign Detail and User Detail Routes
router.get('/campaigns/:id', getCampaign);
router.get('/users/:id', getUser);
router.get('/users', getUsers);
router.post('/pledges/:id/confirm-payment', confirmPledgePayment);

// Webhooks & Warehouse Operations
router.post('/webhooks/courier', handleCourierWebhook);
router.post('/warehouse/ingest', handleWarehouseIngest);

// Payment Gateway Routes
router.post('/checkout/initiate', initiateCheckout);
router.get('/webhooks/payment', handlePaymentWebhook);
router.post('/webhooks/payment', handlePaymentWebhook);

// Analytics and Operations Dashboard Routes
router.get('/campaigns', getActiveCampaigns);
router.post('/campaigns/:id/force-unlock', forceUnlockCampaign);
router.get('/deliveries', getDeliveries);
router.get('/orphans', getOrphans);
router.post('/orphans/:id/clear', clearOrphanToFlash);
router.get('/trust-logs', getTrustLogs);

export default router;
