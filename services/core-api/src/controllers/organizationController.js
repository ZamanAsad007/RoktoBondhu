const organizationService = require('../services/organizationService');
const {
  registerOrgSchema,
  updateInventorySchema,
  createDriveSchema,
  nearbySearchSchema,
} = require('../validation/organization');
const { sendSuccess, sendError } = require('../utils/response');

class OrganizationController {
  /**
   * Register or update organization profile (Role: ORG, ADMIN)
   */
  async registerOrg(req, res, next) {
    try {
      const validated = registerOrgSchema.parse(req.body);
      const org = await organizationService.registerOrganization({
        userId: req.user.id,
        ...validated,
      });
      return sendSuccess(res, org, 201);
    } catch (err) {
      if (err.name === 'ZodError') {
        return sendError(res, err.errors[0].message, 400);
      }
      next(err);
    }
  }

  /**
   * Get my organization profile
   */
  async getMyOrg(req, res, next) {
    try {
      const org = await organizationService.getMyOrganization(req.user.id);
      return sendSuccess(res, org);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update blood inventory (Role: ORG, ADMIN)
   */
  async updateInventory(req, res, next) {
    try {
      const validated = updateInventorySchema.parse(req.body);
      const inventory = await organizationService.updateInventory({
        userId: req.user.id,
        ...validated,
      });
      return sendSuccess(res, inventory);
    } catch (err) {
      if (err.name === 'ZodError') {
        return sendError(res, err.errors[0].message, 400);
      }
      next(err);
    }
  }

  /**
   * Get organization inventory
   */
  async getInventory(req, res, next) {
    try {
      const { id } = req.params;
      const inventory = await organizationService.getInventory(id);
      return sendSuccess(res, inventory);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Search nearby blood banks with stock indicators (Public)
   */
  async searchNearby(req, res, next) {
    try {
      const validated = nearbySearchSchema.parse(req.query);
      const bloodBanks = await organizationService.searchNearbyBloodBanks(validated);
      return sendSuccess(res, bloodBanks);
    } catch (err) {
      if (err.name === 'ZodError') {
        return sendError(res, err.errors[0].message, 400);
      }
      next(err);
    }
  }

  /**
   * Create a blood drive
   */
  async createDrive(req, res, next) {
    try {
      const validated = createDriveSchema.parse(req.body);
      const drive = await organizationService.createDrive({
        userId: req.user.id,
        ...validated,
      });
      return sendSuccess(res, drive, 201);
    } catch (err) {
      if (err.name === 'ZodError') {
        return sendError(res, err.errors[0].message, 400);
      }
      next(err);
    }
  }

  /**
   * Get nearby blood drives (Public / Authenticated)
   */
  async getNearbyDrives(req, res, next) {
    try {
      const validated = nearbySearchSchema.parse(req.query);
      const drives = await organizationService.getNearbyDrives(validated);
      return sendSuccess(res, drives);
    } catch (err) {
      if (err.name === 'ZodError') {
        return sendError(res, err.errors[0].message, 400);
      }
      next(err);
    }
  }

  /**
   * Get drives belonging to user's org
   */
  async getOrgDrives(req, res, next) {
    try {
      const drives = await organizationService.getOrgDrives(req.user.id);
      return sendSuccess(res, drives);
    } catch (err) {
      next(err);
    }
  }

  /**
   * RSVP to blood drive
   */
  async rsvpDrive(req, res, next) {
    try {
      const { id } = req.params;
      const result = await organizationService.rsvpDrive({
        driveId: id,
        userId: req.user.id,
      });
      return sendSuccess(res, result);
    } catch (err) {
      if (err.code === 'CAPACITY_REACHED') {
        return sendError(res, err.message, 409);
      }
      next(err);
    }
  }

  /**
   * Cancel RSVP to blood drive
   */
  async cancelRsvp(req, res, next) {
    try {
      const { id } = req.params;
      const result = await organizationService.cancelRsvp({
        driveId: id,
        userId: req.user.id,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get attendees of a blood drive (Org owner or Admin)
   */
  async getDriveAttendees(req, res, next) {
    try {
      const { id } = req.params;
      const attendees = await organizationService.getDriveAttendees({
        driveId: id,
        currentUser: req.user,
      });
      return sendSuccess(res, attendees);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Mark attendance for donor (Org owner or Admin)
   */
  async markAttendance(req, res, next) {
    try {
      const { id, userId } = req.params;
      const result = await organizationService.markAttendance({
        driveId: id,
        currentUser: req.user,
        attendeeUserId: userId,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Trigger reminders (Admin / Cron)
   */
  async triggerReminders(req, res, next) {
    try {
      const result = await organizationService.triggerUpcomingReminders();
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new OrganizationController();
