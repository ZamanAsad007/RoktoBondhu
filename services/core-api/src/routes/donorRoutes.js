const express = require('express');
const donorController = require('../controllers/donorController');
const donorStatsController = require('../controllers/donorStatsController');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { donorProfileSchema, availabilitySchema } = require('../validation/donor');

const router = express.Router();

router.use(requireAuth);

router.put('/me', validateBody(donorProfileSchema), donorController.upsertMe);
router.get('/me', donorController.getMe);
router.patch('/me/availability', validateBody(availabilitySchema), donorController.updateAvailability);
router.put('/me/availability-windows', donorController.updateAvailabilityWindows);
router.get('/me/history', donorController.getHistory);
router.get('/me/stats', donorStatsController.getMyStats);
router.get('/me/recruit-nudges', (req, res, next) => donorController.getRecruitNudges(req, res, next));
router.put('/me/leaderboard-opt-in', donorStatsController.setLeaderboardOptIn);

module.exports = router;
