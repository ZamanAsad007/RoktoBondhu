const express = require('express');
const organizationController = require('../controllers/organizationController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/nearby', organizationController.searchNearby);
router.get('/drives/nearby', organizationController.getNearbyDrives);
router.get('/:id/inventory', organizationController.getInventory);

// Authenticated user routes (any logged-in user can RSVP)
router.post('/drives/:id/rsvp', requireAuth, organizationController.rsvpDrive);
router.delete('/drives/:id/rsvp', requireAuth, organizationController.cancelRsvp);

// Organization management routes (ORG or ADMIN role)
router.post('/register', requireAuth, requireRole('ORG', 'ADMIN'), organizationController.registerOrg);
router.get('/me', requireAuth, requireRole('ORG', 'ADMIN'), organizationController.getMyOrg);
router.put('/inventory', requireAuth, requireRole('ORG', 'ADMIN'), organizationController.updateInventory);
router.post('/drives', requireAuth, requireRole('ORG', 'ADMIN'), organizationController.createDrive);
router.get('/drives/mine', requireAuth, requireRole('ORG', 'ADMIN'), organizationController.getOrgDrives);
router.get('/drives/:id/attendees', requireAuth, requireRole('ORG', 'ADMIN'), organizationController.getDriveAttendees);
router.patch(
  '/drives/:id/attendees/:userId/attend',
  requireAuth,
  requireRole('ORG', 'ADMIN'),
  organizationController.markAttendance
);
router.post('/drives/reminders/trigger', requireAuth, requireRole('ADMIN'), organizationController.triggerReminders);

module.exports = router;
