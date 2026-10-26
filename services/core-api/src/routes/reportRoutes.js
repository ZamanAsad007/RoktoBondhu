const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.post('/', (req, res, next) => adminController.createReport(req, res, next));

module.exports = router;
