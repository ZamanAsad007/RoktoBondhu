const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { runMigrations } = require('../db/migrate');

const FIRST_NAMES = [
  'Tanvir', 'Farhana', 'Shakib', 'Nusrat', 'Arif', 'Sadia', 'Mahmudul', 'Anika',
  'Kamrul', 'Tasnim', 'Rashed', 'Jannatul', 'Sabbir', 'Mehnaz', 'Imran', 'Samia',
  'Fahim', 'Nabila', 'Ashiq', 'Sumaiya', 'Tareq', 'Rumana', 'Zahid', 'Ayesha',
  'Asif', 'Tahmina', 'Nazmul', 'Sharmin', 'Hasib', 'Fatima', 'Mustafiz', 'Rubina',
];

const LAST_NAMES = [
  'Ahmed', 'Hasan', 'Rahman', 'Islam', 'Chowdhury', 'Uddin', 'Khan', 'Hossain',
  'Ali', 'Siddique', 'Haque', 'Sarkar', 'Karim', 'Akter', 'Begum', 'Mia',
];

const DHAKA_AREAS = [
  { name: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
  { name: 'Gulshan', lat: 23.7925, lng: 90.4078 },
  { name: 'Banani', lat: 23.7937, lng: 90.4066 },
  { name: 'Uttara', lat: 23.8759, lng: 90.3795 },
  { name: 'Mirpur', lat: 23.8067, lng: 90.3687 },
  { name: 'Motijheel', lat: 23.7330, lng: 90.4172 },
  { name: 'Mohammadpur', lat: 23.7658, lng: 90.3584 },
  { name: 'Badda', lat: 23.7805, lng: 90.4267 },
  { name: 'Bashundhara', lat: 23.8151, lng: 90.4255 },
  { name: 'Old Dhaka', lat: 23.7104, lng: 90.4074 },
];

const BLOOD_GROUPS = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];
// Weighted distribution roughly matching Bangladesh demographics
const BLOOD_GROUP_WEIGHTS = [
  'O+', 'O+', 'O+', 'O+',
  'B+', 'B+', 'B+', 'B+',
  'A+', 'A+', 'A+',
  'AB+', 'AB+',
  'O-', 'A-', 'B-', 'AB-',
];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomCoordinateAround(centerLat, centerLng, radiusKm = 2.5) {
  // 1 degree lat is ~111km
  const latDelta = (Math.random() - 0.5) * (radiusKm / 111) * 2;
  // 1 degree lng at 23 deg lat is ~102km
  const lngDelta = (Math.random() - 0.5) * (radiusKm / 102) * 2;
  return {
    latitude: parseFloat((centerLat + latDelta).toFixed(6)),
    longitude: parseFloat((centerLng + lngDelta).toFixed(6)),
  };
}

function getRandomDOB(minAge = 19, maxAge = 50) {
  const today = new Date();
  const birthYear = today.getFullYear() - Math.floor(Math.random() * (maxAge - minAge + 1) + minAge);
  const birthMonth = Math.floor(Math.random() * 12);
  const birthDay = Math.floor(Math.random() * 28) + 1;
  const dob = new Date(birthYear, birthMonth, birthDay);
  return dob.toISOString().split('T')[0];
}

function getRandomLastDonatedAt() {
  // 40% chance of prior donation
  if (Math.random() > 0.4) return null;
  const daysAgo = Math.floor(Math.random() * 300) + 10;
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

async function seedDonors(count = 200) {
  console.log(`[Seed] Starting donor seeding (${count} donors)...`);
  await runMigrations();

  const client = await pool.connect();
  try {
    const passwordHash = await bcrypt.hash('DonorPassword123!', 10);
    const timestamp = Date.now();

    let createdCount = 0;
    const bloodGroupStats = {};
    BLOOD_GROUPS.forEach((bg) => (bloodGroupStats[bg] = 0));

    await client.query('BEGIN');

    for (let i = 1; i <= count; i++) {
      const firstName = getRandomElement(FIRST_NAMES);
      const lastName = getRandomElement(LAST_NAMES);
      const name = `${firstName} ${lastName}`;
      const email = `donor_${timestamp}_${i}@roktobondhu.org`;
      const phone = `+8801${Math.floor(300000000 + Math.random() * 699999999)}`;
      const area = getRandomElement(DHAKA_AREAS);
      const { latitude, longitude } = getRandomCoordinateAround(area.lat, area.lng, 2.0);
      const bloodGroup = getRandomElement(BLOOD_GROUP_WEIGHTS);
      const dob = getRandomDOB();
      const lastDonated = getRandomLastDonatedAt();
      const available = Math.random() < 0.85; // 85% available

      // 1. Create User
      const userRes = await client.query(
        `
        INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
        VALUES ($1, $2, $3, $4, 'USER', TRUE)
        RETURNING id;
        `,
        [name, email, phone, passwordHash]
      );
      const userId = userRes.rows[0].id;

      // 2. Create Donor Profile with PostGIS geography point
      await client.query(
        `
        INSERT INTO donor_profiles (
          user_id, blood_group, date_of_birth, location, city, last_donated_at, available
        ) VALUES (
          $1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, $6, $7, $8
        );
        `,
        [userId, bloodGroup, dob, latitude, longitude, area.name, lastDonated, available]
      );

      bloodGroupStats[bloodGroup]++;
      createdCount++;
    }

    await client.query('COMMIT');
    console.log(`[Seed] Successfully seeded ${createdCount} donors across Dhaka!`);
    console.log('[Seed] Blood Group Breakdown:', bloodGroupStats);
    console.log('[Seed] Default credentials for all seeded donors: password "DonorPassword123!"');

    return { createdCount, bloodGroupStats };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seed] Failed to seed donors:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedDonors(200)
    .then(() => {
      console.log('[Seed] Seeding process completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Script aborted with error:', err);
      process.exit(1);
    });
}

module.exports = { seedDonors };
