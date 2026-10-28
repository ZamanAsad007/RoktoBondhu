const db = require('../config/db');

class OrganizationRepository {
  /**
   * Register or update organization profile
   */
  async upsertOrganization({
    userId,
    orgName,
    registrationNumber = null,
    contactEmail = null,
    contactPhone = null,
    address = null,
    latitude = null,
    longitude = null,
  }) {
    const query = `
      INSERT INTO organizations (
        user_id, org_name, registration_number, contact_email,
        contact_phone, address, location, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        CASE 
          WHEN $7::NUMERIC IS NOT NULL AND $8::NUMERIC IS NOT NULL 
          THEN ST_SetSRID(ST_MakePoint($8::NUMERIC, $7::NUMERIC), 4326)::geography
          ELSE NULL 
        END,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        org_name = EXCLUDED.org_name,
        registration_number = COALESCE(EXCLUDED.registration_number, organizations.registration_number),
        contact_email = COALESCE(EXCLUDED.contact_email, organizations.contact_email),
        contact_phone = COALESCE(EXCLUDED.contact_phone, organizations.contact_phone),
        address = COALESCE(EXCLUDED.address, organizations.address),
        location = COALESCE(EXCLUDED.location, organizations.location),
        updated_at = NOW()
      RETURNING 
        id, user_id, org_name, registration_number, contact_email, contact_phone,
        address, is_verified, created_at, updated_at,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude;
    `;
    const res = await db.query(query, [
      userId,
      orgName,
      registrationNumber,
      contactEmail,
      contactPhone,
      address,
      latitude,
      longitude,
    ]);
    return res.rows[0];
  }

  /**
   * Get organization by user id
   */
  async getOrganizationByUserId(userId) {
    const query = `
      SELECT 
        o.id, o.user_id, o.org_name, o.registration_number, o.contact_email,
        o.contact_phone, o.address, o.is_verified, o.created_at, o.updated_at,
        ST_Y(o.location::geometry) as latitude,
        ST_X(o.location::geometry) as longitude,
        u.name as owner_name, u.email as owner_email, u.phone as owner_phone
      FROM organizations o
      JOIN users u ON o.user_id = u.id
      WHERE o.user_id = $1;
    `;
    const res = await db.query(query, [userId]);
    return res.rows[0] || null;
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(id) {
    const query = `
      SELECT 
        o.id, o.user_id, o.org_name, o.registration_number, o.contact_email,
        o.contact_phone, o.address, o.is_verified, o.created_at, o.updated_at,
        ST_Y(o.location::geometry) as latitude,
        ST_X(o.location::geometry) as longitude
      FROM organizations o
      WHERE o.id = $1;
    `;
    const res = await db.query(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * List organizations for admin review
   */
  async listOrganizations({ isVerified = null, limit = 50, offset = 0 } = {}) {
    let whereClause = '';
    const params = [];
    if (isVerified !== null) {
      params.push(isVerified);
      whereClause = `WHERE o.is_verified = $${params.length}`;
    }
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const query = `
      SELECT 
        o.id, o.user_id, o.org_name, o.registration_number, o.contact_email,
        o.contact_phone, o.address, o.is_verified, o.created_at, o.updated_at,
        ST_Y(o.location::geometry) as latitude,
        ST_X(o.location::geometry) as longitude,
        u.name as owner_name, u.email as owner_email, u.phone as owner_phone
      FROM organizations o
      JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;
    const res = await db.query(query, params);
    return res.rows;
  }

  /**
   * Verify an organization (Admin only)
   */
  async verifyOrganization(id, isVerified = true) {
    const query = `
      UPDATE organizations
      SET is_verified = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING 
        id, user_id, org_name, registration_number, contact_email, contact_phone,
        address, is_verified, created_at, updated_at;
    `;
    const res = await db.query(query, [isVerified, id]);
    return res.rows[0] || null;
  }

  /**
   * Upsert inventory unit for a blood group
   */
  async upsertInventory({ organizationId, bloodGroup, unitsAvailable, lowStockThreshold = 5 }) {
    const query = `
      INSERT INTO blood_inventory (organization_id, blood_group, units_available, low_stock_threshold, last_updated)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (organization_id, blood_group) DO UPDATE SET
        units_available = EXCLUDED.units_available,
        low_stock_threshold = EXCLUDED.low_stock_threshold,
        last_updated = NOW()
      RETURNING id, organization_id, blood_group, units_available, low_stock_threshold, last_updated;
    `;
    const res = await db.query(query, [organizationId, bloodGroup, unitsAvailable, lowStockThreshold]);
    return res.rows[0];
  }

  /**
   * Get all blood inventory for an organization
   */
  async getInventory(organizationId) {
    const query = `
      SELECT id, organization_id, blood_group, units_available, low_stock_threshold, last_updated,
             (units_available < low_stock_threshold) AS is_low_stock
      FROM blood_inventory
      WHERE organization_id = $1
      ORDER BY blood_group ASC;
    `;
    const res = await db.query(query, [organizationId]);
    return res.rows;
  }

  /**
   * Search nearby blood banks with inventory stock
   */
  async searchNearbyBloodBanks({ latitude, longitude, radiusKm = 15, bloodGroup = null }) {
    const params = [longitude, latitude, radiusKm];
    let bloodGroupFilter = '';
    if (bloodGroup) {
      params.push(bloodGroup);
      bloodGroupFilter = `AND bi.blood_group = $4`;
    }

    const query = `
      SELECT 
        o.id,
        o.org_name,
        o.contact_email,
        o.contact_phone,
        o.address,
        o.is_verified,
        ST_Y(o.location::geometry) as latitude,
        ST_X(o.location::geometry) as longitude,
        ROUND((ST_DistanceSphere(o.location::geometry, ST_MakePoint($1, $2)::geometry) / 1000.0)::NUMERIC, 2) AS distance_km,
        COALESCE(
          json_agg(
            json_build_object(
              'blood_group', bi.blood_group,
              'units_available', bi.units_available,
              'low_stock_threshold', bi.low_stock_threshold,
              'is_low_stock', (bi.units_available < bi.low_stock_threshold)
            )
          ) FILTER (WHERE bi.id IS NOT NULL),
          '[]'::json
        ) AS inventory
      FROM organizations o
      LEFT JOIN blood_inventory bi ON o.id = bi.organization_id ${bloodGroupFilter}
      WHERE o.location IS NOT NULL
        AND ST_DWithin(o.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
      GROUP BY o.id
      ORDER BY distance_km ASC;
    `;
    const res = await db.query(query, params);
    return res.rows;
  }

  /**
   * Create blood drive
   */
  async createDrive({
    organizationId,
    title,
    description = null,
    venueName,
    address,
    latitude,
    longitude,
    startTime,
    endTime,
    capacity,
  }) {
    const query = `
      INSERT INTO blood_drives (
        organization_id, title, description, venue_name, address,
        location, start_time, end_time, capacity, rsvp_count, status
      )
      VALUES (
        $1, $2, $3, $4, $5,
        ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography,
        $8, $9, $10, 0, 'UPCOMING'
      )
      RETURNING 
        id, organization_id, title, description, venue_name, address,
        start_time, end_time, capacity, rsvp_count, status, created_at,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude;
    `;
    const res = await db.query(query, [
      organizationId,
      title,
      description,
      venueName,
      address,
      latitude,
      longitude,
      startTime,
      endTime,
      capacity,
    ]);
    return res.rows[0];
  }

  /**
   * Get drive by ID
   */
  async getDriveById(id) {
    const query = `
      SELECT 
        d.id, d.organization_id, d.title, d.description, d.venue_name, d.address,
        d.start_time, d.end_time, d.capacity, d.rsvp_count, d.status, d.created_at,
        ST_Y(d.location::geometry) as latitude,
        ST_X(d.location::geometry) as longitude,
        o.org_name, o.contact_phone, o.contact_email, o.is_verified
      FROM blood_drives d
      JOIN organizations o ON d.organization_id = o.id
      WHERE d.id = $1;
    `;
    const res = await db.query(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * List drives by organization
   */
  async listDrivesByOrg(organizationId) {
    const query = `
      SELECT 
        d.id, d.organization_id, d.title, d.description, d.venue_name, d.address,
        d.start_time, d.end_time, d.capacity, d.rsvp_count, d.status, d.created_at,
        ST_Y(d.location::geometry) as latitude,
        ST_X(d.location::geometry) as longitude
      FROM blood_drives d
      WHERE d.organization_id = $1
      ORDER BY d.start_time ASC;
    `;
    const res = await db.query(query, [organizationId]);
    return res.rows;
  }

  /**
   * List nearby blood drives
   */
  async listNearbyDrives({ latitude, longitude, radiusKm = 25, status = 'UPCOMING' }) {
    const query = `
      SELECT 
        d.id, d.organization_id, d.title, d.description, d.venue_name, d.address,
        d.start_time, d.end_time, d.capacity, d.rsvp_count, d.status, d.created_at,
        ST_Y(d.location::geometry) as latitude,
        ST_X(d.location::geometry) as longitude,
        ROUND((ST_DistanceSphere(d.location::geometry, ST_MakePoint($1, $2)::geometry) / 1000.0)::NUMERIC, 2) AS distance_km,
        o.org_name, o.is_verified
      FROM blood_drives d
      JOIN organizations o ON d.organization_id = o.id
      WHERE ST_DWithin(d.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
        AND ($4::TEXT IS NULL OR d.status = $4)
      ORDER BY d.start_time ASC;
    `;
    const res = await db.query(query, [longitude, latitude, radiusKm, status]);
    return res.rows;
  }

  /**
   * Concurrency-safe RSVP with capacity limit using transaction and SELECT ... FOR UPDATE
   */
  async rsvpDriveSafe({ driveId, userId }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 1. Lock drive record for update
      const driveRes = await client.query(
        `SELECT id, capacity, rsvp_count, status FROM blood_drives WHERE id = $1 FOR UPDATE`,
        [driveId]
      );
      const drive = driveRes.rows[0];
      if (!drive) {
        throw new Error('Blood drive not found');
      }
      if (drive.status !== 'UPCOMING' && drive.status !== 'ACTIVE') {
        throw new Error(`Cannot RSVP to drive with status ${drive.status}`);
      }

      // Check existing RSVP
      const existingRsvpRes = await client.query(
        `SELECT id, status FROM blood_drive_rsvps WHERE drive_id = $1 AND user_id = $2`,
        [driveId, userId]
      );
      if (existingRsvpRes.rows[0]) {
        if (existingRsvpRes.rows[0].status === 'CONFIRMED') {
          await client.query('COMMIT');
          return { message: 'Already RSVP confirmed', rsvp: existingRsvpRes.rows[0] };
        }
      }

      // 2. Capacity check
      if (drive.rsvp_count >= drive.capacity) {
        const error = new Error('Blood drive capacity has been reached');
        error.code = 'CAPACITY_REACHED';
        throw error;
      }

      // 3. Insert or update RSVP
      const rsvpRes = await client.query(
        `INSERT INTO blood_drive_rsvps (drive_id, user_id, status, updated_at)
         VALUES ($1, $2, 'CONFIRMED', NOW())
         ON CONFLICT (drive_id, user_id) DO UPDATE SET
           status = 'CONFIRMED',
           updated_at = NOW()
         RETURNING id, drive_id, user_id, status, created_at, updated_at;`,
        [driveId, userId]
      );

      // 4. Increment rsvp_count
      await client.query(
        `UPDATE blood_drives SET rsvp_count = rsvp_count + 1, updated_at = NOW() WHERE id = $1`,
        [driveId]
      );

      await client.query('COMMIT');
      return { success: true, rsvp: rsvpRes.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Cancel RSVP
   */
  async cancelRsvp({ driveId, userId }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const rsvpRes = await client.query(
        `SELECT id, status FROM blood_drive_rsvps WHERE drive_id = $1 AND user_id = $2 FOR UPDATE`,
        [driveId, userId]
      );
      const rsvp = rsvpRes.rows[0];
      if (!rsvp || rsvp.status !== 'CONFIRMED') {
        await client.query('COMMIT');
        return { message: 'No active RSVP found' };
      }

      await client.query(
        `UPDATE blood_drive_rsvps SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
        [rsvp.id]
      );

      await client.query(
        `UPDATE blood_drives SET rsvp_count = GREATEST(0, rsvp_count - 1), updated_at = NOW() WHERE id = $1`,
        [driveId]
      );

      await client.query('COMMIT');
      return { success: true, message: 'RSVP cancelled' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get RSVP list / attendees for a drive
   */
  async getDriveAttendees(driveId) {
    const query = `
      SELECT 
        r.id as rsvp_id, r.drive_id, r.user_id, r.status as rsvp_status, r.created_at as rsvp_at,
        u.name, u.email, u.phone,
        dp.blood_group
      FROM blood_drive_rsvps r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN donor_profiles dp ON u.id = dp.user_id
      WHERE r.drive_id = $1
      ORDER BY r.created_at ASC;
    `;
    const res = await db.query(query, [driveId]);
    return res.rows;
  }

  /**
   * Mark attendance for a donor at a blood drive
   */
  async markAttendance({ driveId, userId }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 1. Update RSVP status to ATTENDED
      const rsvpRes = await client.query(
        `UPDATE blood_drive_rsvps
         SET status = 'ATTENDED', updated_at = NOW()
         WHERE drive_id = $1 AND user_id = $2
         RETURNING id, drive_id, user_id, status`,
        [driveId, userId]
      );

      if (!rsvpRes.rows[0]) {
        throw new Error('RSVP record not found');
      }

      // 2. Insert into donations history table
      const donationRes = await client.query(
        `INSERT INTO donations (donor_id, drive_id, donated_at, confirmed_by_requester)
         VALUES ($1, $2, NOW(), TRUE)
         RETURNING id, donor_id, drive_id, donated_at;`,
        [userId, driveId]
      );

      await client.query('COMMIT');
      return {
        rsvp: rsvpRes.rows[0],
        donation: donationRes.rows[0],
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get upcoming drives within next 24h for reminders
   */
  async getUpcomingDrivesForReminders() {
    const query = `
      SELECT 
        d.id as drive_id, d.title, d.venue_name, d.address, d.start_time,
        r.user_id, u.name as user_name, u.email as user_email, u.phone as user_phone
      FROM blood_drives d
      JOIN blood_drive_rsvps r ON d.id = r.drive_id
      JOIN users u ON r.user_id = u.id
      WHERE d.status = 'UPCOMING'
        AND r.status = 'CONFIRMED'
        AND d.start_time BETWEEN NOW() AND NOW() + INTERVAL '24 hours';
    `;
    const res = await db.query(query);
    return res.rows;
  }
}

module.exports = new OrganizationRepository();
