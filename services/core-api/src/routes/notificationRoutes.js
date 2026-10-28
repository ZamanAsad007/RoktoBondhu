const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/vapid-public-key', (req, res, next) => notificationController.getVapidPublicKey(req, res, next));
router.post('/push/subscribe', (req, res, next) => notificationController.subscribePush(req, res, next));
router.post('/push/unsubscribe', (req, res, next) => notificationController.unsubscribePush(req, res, next));
router.get('/preferences', (req, res, next) => notificationController.getPreferences(req, res, next));
router.put('/preferences', (req, res, next) => notificationController.updatePreferences(req, res, next));

router.get('/', (req, res, next) => notificationController.getNotifications(req, res, next));
router.patch('/read-all', (req, res, next) => notificationController.markAllAsRead(req, res, next));
router.patch('/:id/read', (req, res, next) => notificationController.markAsRead(req, res, next));

module.exports = router;
