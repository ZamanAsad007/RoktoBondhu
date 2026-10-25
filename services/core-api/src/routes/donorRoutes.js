const express = require('express');
const donorController = require('../controllers/donorController');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { donorProfileSchema, availabilitySchema } = require('../validation/donor');

const router = express.Router();

router.use(requireAuth);

router.put('/me', validateBody(donorProfileSchema), donorController.upsertMe);
router.get('/me', donorController.getMe);
router.patch('/me/availability', validateBody(availabilitySchema), donorController.updateAvailability);
router.get('/me/history', donorController.getHistory);

module.exports = router;
