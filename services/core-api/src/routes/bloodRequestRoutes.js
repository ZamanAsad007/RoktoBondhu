const express = require('express');
const router = express.Router();
const bloodRequestController = require('../controllers/bloodRequestController');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { createBloodRequestSchema } = require('../validation/bloodRequest');

// Create blood request (rate limited, urgency expiry computed)
router.post(
  '/',
  requireAuth,
  validateBody(createBloodRequestSchema),
  bloodRequestController.createRequest
);

// List logged-in user's requests
router.get('/mine', requireAuth, bloodRequestController.getMyRequests);

// Request detail (contact info masked unless requester, admin, or accepted donor)
router.get('/:id', requireAuth, bloodRequestController.getRequestById);

// Cancel request
router.post('/:id/cancel', requireAuth, bloodRequestController.cancelRequest);

module.exports = router;
