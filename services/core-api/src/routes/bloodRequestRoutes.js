const express = require('express');
const router = express.Router();
const bloodRequestController = require('../controllers/bloodRequestController');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { createBloodRequestSchema } = require('../validation/bloodRequest');
const { uploadVerificationDoc } = require('../middleware/upload');
const idempotencyMiddleware = require('../middleware/idempotency');

// Create blood request (rate limited, urgency expiry computed)
router.post(
  '/',
  requireAuth,
  idempotencyMiddleware(),
  validateBody(createBloodRequestSchema),
  bloodRequestController.createRequest
);

// List logged-in user's requests
router.get('/mine', requireAuth, bloodRequestController.getMyRequests);

// Browse nearby open requests matching donor's blood group
router.get('/nearby', requireAuth, bloodRequestController.getNearbyRequests);

// Request detail (contact info masked unless requester, admin, or accepted donor)
router.get('/:id', requireAuth, bloodRequestController.getRequestById);

// Cancel request
router.post('/:id/cancel', requireAuth, bloodRequestController.cancelRequest);

// Confirm donation
router.post(
  '/:id/matches/:matchId/confirm-donation',
  requireAuth,
  bloodRequestController.confirmDonation
);

// Escalate request to SOS emergency
router.post('/:id/escalate', requireAuth, bloodRequestController.escalate);

// Upload hospital slip / verification document (Phase 18)
router.post(
  '/:id/verification-document',
  requireAuth,
  uploadVerificationDoc.single('document'),
  bloodRequestController.uploadVerificationDocument
);

// Public share token JSON lookup
router.get('/share/:shareToken', bloodRequestController.getByShareToken);

module.exports = router;
