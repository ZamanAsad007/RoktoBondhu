const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const bloodRequestController = require('../controllers/bloodRequestController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRole('ADMIN'));

router.get('/stats', (req, res, next) => adminController.getStats(req, res, next));
router.get('/requests', (req, res, next) => adminController.getRequests(req, res, next));
router.get('/reports', (req, res, next) => adminController.getReports(req, res, next));
router.patch('/reports/:id', (req, res, next) => adminController.updateReport(req, res, next));
router.patch('/users/:id/block', (req, res, next) => adminController.blockUser(req, res, next));
router.get('/users/search', (req, res, next) => adminController.searchUsers(req, res, next));
router.get('/organizations', (req, res, next) => adminController.listOrganizations(req, res, next));
router.patch('/organizations/:id/verify', (req, res, next) => adminController.verifyOrganization(req, res, next));
router.patch('/requests/:id/verify', (req, res, next) => bloodRequestController.adminVerifyRequest(req, res, next));

module.exports = router;
