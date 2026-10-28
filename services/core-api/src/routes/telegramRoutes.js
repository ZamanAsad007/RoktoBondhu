const express = require('express');
const router = express.Router();
const telegramController = require('../controllers/telegramController');
const { requireAuth } = require('../middleware/auth');

// Public Webhook for Telegram updates
router.post('/webhook', (req, res, next) => telegramController.handleWebhook(req, res, next));

// Authenticated User routes
router.use(requireAuth);
router.post('/link-code', (req, res, next) => telegramController.generateLinkCode(req, res, next));
router.get('/status', (req, res, next) => telegramController.getStatus(req, res, next));
router.post('/unlink', (req, res, next) => telegramController.unlinkAccount(req, res, next));

module.exports = router;
