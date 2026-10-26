const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const { requireAuth } = require('../middleware/auth');

// Get all matches for the authenticated donor
router.get('/mine', requireAuth, matchController.getMyMatches);

// Accept a blood request match (with row-level lock concurrency protection)
router.post('/:id/accept', requireAuth, matchController.acceptMatch);

// Decline a blood request match
router.post('/:id/decline', requireAuth, matchController.declineMatch);

module.exports = router;
