const organizationRepository = require('../repositories/organizationRepository');
const donorStatsRepository = require('../repositories/donorStatsRepository');
const sseService = require('./sseService');

class OrganizationService {
  /**
   * Register or update organization profile
   */
  async registerOrganization({
    userId,
    orgName,
    registrationNumber,
    contactEmail,
    contactPhone,
    address,
    latitude,
    longitude,
  }) {
    if (!orgName || orgName.trim().length === 0) {
      throw new Error('Organization name is required');
    }

    return await organizationRepository.upsertOrganization({
      userId,
      orgName: orgName.trim(),
      registrationNumber,
      contactEmail,
      contactPhone,
      address,
      latitude,
      longitude,
    });
  }

  /**
   * Get organization profile for current user
   */
  async getMyOrganization(userId) {
    const org = await organizationRepository.getOrganizationByUserId(userId);
    if (!org) {
      const error = new Error('Organization profile not found');
      error.statusCode = 404;
      throw error;
    }
    return org;
  }

  /**
   * Upsert inventory and alert on low stock
   */
  async updateInventory({ userId, bloodGroup, unitsAvailable, lowStockThreshold = 5 }) {
    const org = await this.getMyOrganization(userId);
    const updated = await organizationRepository.upsertInventory({
      organizationId: org.id,
      bloodGroup,
      unitsAvailable,
      lowStockThreshold,
    });

    // Alert if stock is below threshold
    if (Number(unitsAvailable) < Number(lowStockThreshold)) {
      sseService
        .publishEvent(
          'inventory.low',
          {
            organizationId: org.id,
            orgName: org.org_name,
            bloodGroup,
            unitsAvailable: Number(unitsAvailable),
            lowStockThreshold: Number(lowStockThreshold),
            timestamp: new Date().toISOString(),
          },
          { roles: ['ORG', 'ADMIN'] }
        )
        .catch((err) =>
          console.error('[OrganizationService] Error publishing inventory.low:', err.message)
        );
    }

    return updated;
  }

  /**
   * Get organization inventory
   */
  async getInventory(organizationId) {
    return await organizationRepository.getInventory(organizationId);
  }

  /**
   * Search nearby blood banks with stock indicators
   */
  async searchNearbyBloodBanks({ latitude, longitude, radiusKm = 15, bloodGroup = null }) {
    if (!latitude || !longitude) {
      throw new Error('Latitude and Longitude are required for nearby search');
    }
    return await organizationRepository.searchNearbyBloodBanks({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radiusKm: parseFloat(radiusKm),
      bloodGroup,
    });
  }

  /**
   * Create a new blood drive
   */
  async createDrive({
    userId,
    title,
    description,
    venueName,
    address,
    latitude,
    longitude,
    startTime,
    endTime,
    capacity,
  }) {
    const org = await this.getMyOrganization(userId);

    if (!latitude || !longitude) {
      throw new Error('Location coordinates (latitude, longitude) are required for blood drive');
    }
    if (!capacity || capacity <= 0) {
      throw new Error('Capacity must be greater than zero');
    }

    return await organizationRepository.createDrive({
      organizationId: org.id,
      title,
      description,
      venueName,
      address,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      startTime,
      endTime,
      capacity: parseInt(capacity, 10),
    });
  }

  /**
   * List nearby blood drives
   */
  async getNearbyDrives({ latitude, longitude, radiusKm = 25, status = 'UPCOMING' }) {
    if (!latitude || !longitude) {
      throw new Error('Latitude and Longitude are required for nearby drive search');
    }
    return await organizationRepository.listNearbyDrives({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radiusKm: parseFloat(radiusKm),
      status,
    });
  }

  /**
   * List drives for organization owner
   */
  async getOrgDrives(userId) {
    const org = await this.getMyOrganization(userId);
    return await organizationRepository.listDrivesByOrg(org.id);
  }

  /**
   * RSVP to a blood drive safely
   */
  async rsvpDrive({ driveId, userId }) {
    return await organizationRepository.rsvpDriveSafe({ driveId, userId });
  }

  /**
   * Cancel an RSVP
   */
  async cancelRsvp({ driveId, userId }) {
    return await organizationRepository.cancelRsvp({ driveId, userId });
  }

  /**
   * Get drive attendees
   */
  async getDriveAttendees({ driveId, currentUser }) {
    const drive = await organizationRepository.getDriveById(driveId);
    if (!drive) {
      const error = new Error('Blood drive not found');
      error.statusCode = 404;
      throw error;
    }

    if (currentUser.role !== 'ADMIN') {
      const org = await organizationRepository.getOrganizationByUserId(currentUser.id);
      if (!org || org.id !== drive.organization_id) {
        const error = new Error('Forbidden: Not authorized to view attendees for this drive');
        error.statusCode = 403;
        throw error;
      }
    }

    return await organizationRepository.getDriveAttendees(driveId);
  }

  /**
   * Mark donor attendance and feed into stats & gamification
   */
  async markAttendance({ driveId, currentUser, attendeeUserId }) {
    const drive = await organizationRepository.getDriveById(driveId);
    if (!drive) {
      const error = new Error('Blood drive not found');
      error.statusCode = 404;
      throw error;
    }

    if (currentUser.role !== 'ADMIN') {
      const org = await organizationRepository.getOrganizationByUserId(currentUser.id);
      if (!org || org.id !== drive.organization_id) {
        const error = new Error('Forbidden: Not authorized to manage this drive');
        error.statusCode = 403;
        throw error;
      }
    }

    // 1. Mark attendance and create donation record
    const result = await organizationRepository.markAttendance({
      driveId,
      userId: attendeeUserId,
    });

    // 2. Feed into Phase 14 stats & gamification
    try {
      await donorStatsRepository.recordDonationConfirmed({
        userId: attendeeUserId,
        donationId: result.donation.id,
      });
    } catch (err) {
      console.error('[OrganizationService] Error recording donation stats:', err.message);
    }

    return {
      success: true,
      message: 'Attendance confirmed and donation recorded',
      attendance: result.rsvp,
      donationId: result.donation.id,
    };
  }

  /**
   * Trigger reminders for upcoming drives (within 24 hours)
   */
  async triggerUpcomingReminders() {
    const upcoming = await organizationRepository.getUpcomingDrivesForReminders();
    for (const item of upcoming) {
      sseService
        .publishEvent(
          'drive.reminder',
          {
            driveId: item.drive_id,
            title: item.title,
            venueName: item.venue_name,
            startTime: item.start_time,
            message: `Reminder: Blood drive "${item.title}" is happening within 24 hours at ${item.venue_name}.`,
          },
          { userIds: [item.user_id] }
        )
        .catch(() => {});
    }
    return { notifiedCount: upcoming.length };
  }
}

module.exports = new OrganizationService();
