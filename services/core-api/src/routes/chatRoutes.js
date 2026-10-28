const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/threads/by-match/:matchId', chatController.getThreadForMatch);
router.get('/threads/:threadId', chatController.getThreadById);
router.get('/threads/:threadId/messages', chatController.getMessages);
router.post('/threads/:threadId/messages', chatController.sendMessage);
router.post('/threads/:threadId/share-phone', chatController.sharePhone);
router.post('/threads/:threadId/block', chatController.blockUser);

module.exports = router;
