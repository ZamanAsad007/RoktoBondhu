/**
 * RoktoBondhu Interactive Demo Script
 * Demonstrates:
 * 1. PostGIS geographic donor matching across Dhaka
 * 2. Multi-channel wave alerts (In-App, SMS, Email to Mailpit)
 * 3. Concurrency-safe donor acceptance
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { pool } = require('../services/core-api/src/config/db');
const { runMigrations } = require('../services/core-api/src/db/migrate');
const { seedDonors } = require('../services/core-api/src/scripts/seedDonors');
const bloodRequestRepository = require('../services/core-api/src/repositories/bloodRequestRepository');
const matchingRepository = require('../services/core-api/src/repositories/matchingRepository');
const { processRunWave, closeMatchingQueue } = require('../services/core-api/src/jobs/matchingQueue');
const { closeNotificationQueue } = require('../services/core-api/src/jobs/notificationQueue');

async function runDemo() {
  console.log('====================================================');
  console.log('   ROKTOBONDHU (রক্তবন্ধু) — LIVE EMERGENCY DEMO   ');
  console.log('====================================================\n');

  try {
    // 1. Ensure migrations are up to date
    console.log('[1/4] Ensuring database migrations are current...');
    await runMigrations();

    // 2. Ensure volunteer donors are seeded
    console.log('\n[2/4] Seeding volunteer donors across Dhaka...');
    await seedDonors();

    // 3. Find or create a demo requester user
    console.log('\n[3/4] Creating an urgent emergency blood request...');
    let requesterRes = await pool.query(
      `SELECT id FROM users WHERE email = 'demo.requester@roktobondhu.org'`
    );

    let requesterId;
    if (requesterRes.rows[0]) {
      requesterId = requesterRes.rows[0].id;
    } else {
      const insRes = await pool.query(
        `INSERT INTO users (name, phone, email, password_hash, role, phone_verified)
         VALUES ('Dr. Tanvir Ahmed (ICU)', '+8801700998877', 'demo.requester@roktobondhu.org', '$2a$10$dummyhash', 'USER', true)
         RETURNING id`
      );
      requesterId = insRes.rows[0].id;
    }

    // Create a 2-unit CRITICAL request at Dhaka Medical College Hospital
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const neededBy = new Date(Date.now() + 6 * 60 * 60 * 1000);

    const request = await bloodRequestRepository.createRequest({
      requesterId,
      patientName: 'Rina Begum (Emergency C-Section)',
      bloodGroup: 'O+',
      unitsNeeded: 2,
      hospitalName: 'Dhaka Medical College Hospital',
      city: 'Dhaka',
      latitude: 23.7258,
      longitude: 90.3975,
      urgency: 'CRITICAL',
      neededBy,
      contactPhone: '+8801700998877',
      expiresAt,
    });

    console.log(`\n -> Blood Request Created:`);
    console.log(`    Request ID : ${request.id}`);
    console.log(`    Patient    : ${request.patient_name}`);
    console.log(`    Blood Group: ${request.blood_group} (${request.units_needed} units)`);
    console.log(`    Hospital   : ${request.hospital_name}`);
    console.log(`    Urgency    : ${request.urgency} (10 min wave interval)`);

    // 4. Trigger Wave 1 matching
    console.log('\n[4/4] Triggering Wave 1 PostGIS proximity matching (5 km radius)...');
    const waveResult = await processRunWave(request.id);

    console.log(` -> Wave 1 Dispatched:`);
    console.log(`    Search Radius : ${waveResult.radiusKm} km`);
    console.log(`    Matches Sent  : ${waveResult.matchesCreated} donors notified`);

    console.log('\n====================================================');
    console.log('                 HOW TO VIEW THE DEMO               ');
    console.log('====================================================');
    console.log('1. Mailpit Web Inbox:');
    console.log('   Open http://localhost:8025 to view sent email notifications.');
    console.log('2. Web Application:');
    console.log('   Open http://localhost:3000 (or http://localhost)');
    console.log('3. Donor Credentials to Test Acceptance:');
    console.log('   Email    : donor.1@example.com (or any donor.1 to donor.15)');
    console.log('   Password : DonorPassword123!');
    console.log('====================================================\n');

    await closeMatchingQueue();
    await closeNotificationQueue();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('[Demo] Error running demo:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  runDemo();
}

module.exports = { runDemo };
