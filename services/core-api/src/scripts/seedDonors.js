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

async function seedAdminAndOrg(client) {
  const adminHash = await bcrypt.hash('AdminPassword123!', 10);
  const orgHash = await bcrypt.hash('OrgPassword123!', 10);

  // 1. Super Admin
  await client.query(`
    INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
    VALUES ('Super Admin', 'admin@roktobondhu.org', '+8801700999001', $1, 'ADMIN', TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = $1, role = 'ADMIN', phone_verified = TRUE;
  `, [adminHash]);

  // 2. Organization User & Profile
  const orgUserRes = await client.query(`
    INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
    VALUES ('Dhaka Central Blood Center', 'hospital@roktobondhu.org', '+8801700999002', $1, 'ORG', TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = $1, role = 'ORG', phone_verified = TRUE
    RETURNING id;
  `, [orgHash]);
  const orgUserId = orgUserRes.rows[0]?.id;

  if (orgUserId) {
    const orgRes = await client.query(`
      INSERT INTO organizations (user_id, org_name, registration_number, contact_email, contact_phone, address, location, is_verified)
      VALUES (
        $1,
        'Dhaka Central Hospital & Blood Bank',
        'DGHS-BB-2026-001',
        'hospital@roktobondhu.org',
        '+8801700999002',
        'Shahbagh, Dhaka',
        ST_SetSRID(ST_MakePoint(90.3975, 23.7380), 4326)::geography,
        TRUE
      )
      ON CONFLICT (user_id) DO UPDATE SET is_verified = TRUE
      RETURNING id;
    `, [orgUserId]);

    const orgId = orgRes.rows[0]?.id;
    if (orgId) {
      const inventory = [
        ['O+', 18], ['A+', 14], ['B+', 12], ['AB+', 6],
        ['O-', 4], ['A-', 3], ['B-', 2], ['AB-', 1],
      ];
      for (const [bg, units] of inventory) {
        await client.query(`
          INSERT INTO blood_inventory (organization_id, blood_group, units_available, low_stock_threshold)
          VALUES ($1, $2, $3, 5)
          ON CONFLICT (organization_id, blood_group) DO UPDATE SET units_available = $3;
        `, [orgId, bg, units]);
      }
    }
  }
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

    // Seed Admin & Org accounts
    await seedAdminAndOrg(client);

    // Also seed demo.1@example.com for interactive scripts & tests
    const demoDonorRes = await client.query(`
      INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
      VALUES ('Tanvir Ahmed', 'donor.1@example.com', '+8801700999003', $1, 'USER', TRUE)
      ON CONFLICT (email) DO UPDATE SET password_hash = $1, phone_verified = TRUE
      RETURNING id;
    `, [passwordHash]);
    if (demoDonorRes.rows[0]) {
      const dId = demoDonorRes.rows[0].id;
      await client.query(`
        INSERT INTO donor_profiles (
          user_id, blood_group, date_of_birth, location, city, last_donated_at, available, show_on_leaderboard
        ) VALUES (
          $1, 'O+', '1995-05-15', ST_SetSRID(ST_MakePoint(90.3742, 23.7461), 4326)::geography, 'Dhanmondi', '2026-08-01', TRUE, TRUE
        ) ON CONFLICT (user_id) DO UPDATE SET show_on_leaderboard = TRUE;
      `, [dId]);
    }

    const LEADERBOARD_PRESETS = [
      { donated: 15, streak: 5, longest: 6, score: 99, badges: ['FIRST_DONATION', 'DONOR_BRONZE', 'DONOR_SILVER', 'DONOR_GOLD', 'RAPID_RESPONDER', 'LIFE_SAVER'] },
      { donated: 12, streak: 4, longest: 5, score: 98, badges: ['FIRST_DONATION', 'DONOR_BRONZE', 'DONOR_SILVER', 'DONOR_GOLD', 'LIFE_SAVER'] },
      { donated: 10, streak: 4, longest: 4, score: 97, badges: ['FIRST_DONATION', 'DONOR_BRONZE', 'DONOR_SILVER', 'DONOR_GOLD'] },
      { donated: 8, streak: 3, longest: 4, score: 95, badges: ['FIRST_DONATION', 'DONOR_BRONZE', 'DONOR_SILVER', 'RAPID_RESPONDER'] },
      { donated: 7, streak: 3, longest: 3, score: 96, badges: ['FIRST_DONATION', 'DONOR_BRONZE', 'DONOR_SILVER'] },
      { donated: 6, streak: 2, longest: 3, score: 94, badges: ['FIRST_DONATION', 'DONOR_BRONZE'] },
      { donated: 5, streak: 2, longest: 2, score: 92, badges: ['FIRST_DONATION', 'DONOR_BRONZE'] },
      { donated: 4, streak: 1, longest: 2, score: 91, badges: ['FIRST_DONATION', 'DONOR_BRONZE'] },
      { donated: 3, streak: 1, longest: 1, score: 90, badges: ['FIRST_DONATION', 'DONOR_BRONZE'] },
      { donated: 2, streak: 1, longest: 1, score: 88, badges: ['FIRST_DONATION'] },
    ];

    for (let i = 1; i <= count; i++) {
      const firstName = FIRST_NAMES[(i - 1) % FIRST_NAMES.length];
      const lastName = LAST_NAMES[(i - 1) % LAST_NAMES.length];
      const name = `${firstName} ${lastName}`;
      // Predictable emails for first 20 donors, timestamped for excess
      const email = i <= 20 ? `donor${i}@roktobondhu.org` : `donor_${timestamp}_${i}@roktobondhu.org`;
      const phone = i <= 20 ? `+8801700${String(i).padStart(6, '0')}` : `+8801${Math.floor(300000000 + Math.random() * 699999999)}`;
      const area = DHAKA_AREAS[(i - 1) % DHAKA_AREAS.length];
      const { latitude, longitude } = getRandomCoordinateAround(area.lat, area.lng, 2.0);
      const bloodGroup = i <= 8 ? BLOOD_GROUPS[i - 1] : getRandomElement(BLOOD_GROUP_WEIGHTS);
      const dob = getRandomDOB();
      const lastDonated = getRandomLastDonatedAt();
      const available = Math.random() < 0.85; // 85% available
      const isLeaderboardDonor = i <= LEADERBOARD_PRESETS.length;

      // 1. Create or Update User
      const userRes = await client.query(
        `
        INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
        VALUES ($1, $2, $3, $4, 'USER', TRUE)
        ON CONFLICT (email) DO UPDATE
          SET password_hash = EXCLUDED.password_hash,
              phone_verified = TRUE
        RETURNING id;
        `,
        [name, email, phone, passwordHash]
      );
      const userId = userRes.rows[0].id;

      // 2. Create Donor Profile with PostGIS geography point & Leaderboard opt-in
      await client.query(
        `
        INSERT INTO donor_profiles (
          user_id, blood_group, date_of_birth, location, city, last_donated_at, available, show_on_leaderboard
        ) VALUES (
          $1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, $6, $7, $8, $9
        )
        ON CONFLICT (user_id) DO UPDATE
          SET blood_group = EXCLUDED.blood_group,
              location = EXCLUDED.location,
              city = EXCLUDED.city,
              available = EXCLUDED.available,
              show_on_leaderboard = EXCLUDED.show_on_leaderboard;
        `,
        [userId, bloodGroup, dob, latitude, longitude, area.name, lastDonated, available, isLeaderboardDonor]
      );

      // 3. Populate Donor Stats & Badges for Leaderboard
      if (isLeaderboardDonor) {
        const preset = LEADERBOARD_PRESETS[i - 1];
        await client.query(
          `
          INSERT INTO donor_stats (
            user_id, donated_count, current_streak, longest_streak, reliability_score
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id) DO UPDATE
            SET donated_count = EXCLUDED.donated_count,
                current_streak = EXCLUDED.current_streak,
                longest_streak = EXCLUDED.longest_streak,
                reliability_score = EXCLUDED.reliability_score;
          `,
          [userId, preset.donated, preset.streak, preset.longest, preset.score]
        );

        for (const badgeCode of preset.badges) {
          await client.query(
            `
            INSERT INTO badges (user_id, badge_code, earned_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id, badge_code) DO NOTHING;
            `,
            [userId, badgeCode]
          );
        }
      }

      bloodGroupStats[bloodGroup]++;
      createdCount++;
    }

    await client.query('COMMIT');
    console.log(`[Seed] Successfully seeded ${createdCount} donors across Dhaka!`);
    console.log('[Seed] Blood Group Breakdown:', bloodGroupStats);
    console.log('\n[Seed] --- Seeded Login Credentials ---');
    console.log('  Admin User        : email: "admin@roktobondhu.org", password: "AdminPassword123!"');
    console.log('  Organization User : email: "hospital@roktobondhu.org", password: "OrgPassword123!"');
    console.log('  Donor Users       : email: "donor1@roktobondhu.org" to "donor20@roktobondhu.org" (or "donor.1@example.com")');
    console.log('                      password: "DonorPassword123!"');
    console.log('----------------------------------------\n');

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
