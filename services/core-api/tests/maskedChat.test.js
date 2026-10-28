const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const chatFilter = require('../src/domain/chatFilter');
const chatRepository = require('../src/repositories/chatRepository');
const chatService = require('../src/services/chatService');
const { generateAccessToken } = require('../src/utils/token');

describe('Phase 19: Masked In-App Chat & Privacy Controls', () => {
  let requester, donor, thirdParty;
  let requesterToken, donorToken, thirdPartyToken;
  let bloodRequest, match;

  beforeAll(async () => {
    // 1. Create test users
    await db.query(`DELETE FROM users WHERE email IN ('chat_req@test.com', 'chat_don@test.com', 'chat_other@test.com')`);

    const reqRes = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ('Chat Requester', 'chat_req@test.com', 'hash', '01711112222', 'USER')
       RETURNING id, name, email, phone, role;`
    );
    requester = reqRes.rows[0];
    requesterToken = generateAccessToken(requester);

    const donRes = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ('Chat Donor', 'chat_don@test.com', 'hash', '01833334444', 'USER')
       RETURNING id, name, email, phone, role;`
    );
    donor = donRes.rows[0];
    donorToken = generateAccessToken(donor);

    const otherRes = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ('Unrelated User', 'chat_other@test.com', 'hash', '01955556666', 'USER')
       RETURNING id, name, email, phone, role;`
    );
    thirdParty = otherRes.rows[0];
    thirdPartyToken = generateAccessToken(thirdParty);

    // 2. Create blood request
    const bReqRes = await db.query(
      `INSERT INTO blood_requests 
       (requester_id, patient_name, blood_group, units_needed, hospital_name, location, city, urgency, needed_by, expires_at, contact_phone, status)
       VALUES ($1, 'Patient Chat', 'A+', 1, 'Chat General Hospital', ST_SetSRID(ST_MakePoint(90.4125, 23.8103), 4326), 'Dhaka', 'URGENT', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '1 day', '01711112222', 'OPEN')
       RETURNING id;`,
      [requester.id]
    );
    bloodRequest = bReqRes.rows[0];

    // 3. Create match in ACCEPTED status
    const matchRes = await db.query(
      `INSERT INTO request_matches (request_id, donor_id, status, wave_number, distance_km)
       VALUES ($1, $2, 'ACCEPTED', 1, 2.5)
       RETURNING id;`,
      [bloodRequest.id, donor.id]
    );
    match = matchRes.rows[0];
  });

  afterAll(async () => {
    if (bloodRequest?.id) {
      await db.query(`DELETE FROM chat_messages WHERE thread_id IN (SELECT id FROM chat_threads WHERE request_id = $1)`, [bloodRequest.id]);
      await db.query(`DELETE FROM chat_blocks WHERE thread_id IN (SELECT id FROM chat_threads WHERE request_id = $1)`, [bloodRequest.id]);
      await db.query(`DELETE FROM chat_threads WHERE request_id = $1`, [bloodRequest.id]);
      await db.query(`DELETE FROM request_matches WHERE request_id = $1`, [bloodRequest.id]);
      await db.query(`DELETE FROM blood_requests WHERE id = $1`, [bloodRequest.id]);
    }
    await db.query(`DELETE FROM users WHERE email IN ('chat_req@test.com', 'chat_don@test.com', 'chat_other@test.com')`);
  });

  describe('1. Pure Domain Logic & Sanitization Filters', () => {
    it('masks standard Bangladeshi phone numbers when locked', () => {
      const text = 'Call me at 01712345678 immediately!';
      const masked = chatFilter.maskPhoneNumbers(text);
      expect(masked).not.toContain('01712345678');
      expect(masked).toContain('[PHONE NUMBER HIDDEN - USE CHAT UNLOCK]');
    });

    it('masks phone numbers with spaces, dashes or country code +88', () => {
      const text1 = 'Number is 018-1234-5678';
      const text2 = 'Call +8801912345678 please';
      expect(chatFilter.maskPhoneNumbers(text1)).toContain('[PHONE NUMBER HIDDEN - USE CHAT UNLOCK]');
      expect(chatFilter.maskPhoneNumbers(text2)).toContain('[PHONE NUMBER HIDDEN - USE CHAT UNLOCK]');
    });

    it('filters profanity and aggressive words', () => {
      const text = 'This user is a fraud and scammer';
      const filtered = chatFilter.filterProfanity(text);
      expect(filtered).toContain('***');
      expect(filtered).not.toContain('fraud');
    });

    it('sanitizeChatMessage preserves phone numbers only if isPhoneUnlocked is true', () => {
      const text = 'My contact is 01712345678';
      const locked = chatFilter.sanitizeChatMessage(text, false);
      const unlocked = chatFilter.sanitizeChatMessage(text, true);

      expect(locked).toContain('[PHONE NUMBER HIDDEN - USE CHAT UNLOCK]');
      expect(unlocked).toBe('My contact is 01712345678');
    });
  });

  describe('2. Chat Thread Access & Message Flow', () => {
    let threadId;

    it('allows requester or donor to get or auto-create chat thread for accepted match', async () => {
      const res = await request(app)
        .get(`/api/chat/threads/by-match/${match.id}`)
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.match_id).toBe(match.id);
      expect(res.body.data.status).toBe('OPEN');
      // Phone numbers should be masked initially
      expect(res.body.data.donor_phone).toContain('****');
      expect(res.body.data.requester_phone).toContain('****');
      threadId = res.body.data.id;
    });

    it('forbids unrelated third-party users from accessing the chat thread', async () => {
      const res = await request(app)
        .get(`/api/chat/threads/by-match/${match.id}`)
        .set('Authorization', `Bearer ${thirdPartyToken}`);

      expect(res.status).toBe(403);
    });

    it('masks phone numbers in messages sent before bilateral unlock', async () => {
      const sendRes = await request(app)
        .post(`/api/chat/threads/${threadId}/messages`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ content: 'Hello! You can call me at 01833334444 anytime.' });

      expect(sendRes.status).toBe(201);
      expect(sendRes.body.data.content).toContain('[PHONE NUMBER HIDDEN - USE CHAT UNLOCK]');
      expect(sendRes.body.data.content).not.toContain('01833334444');
    });

    it('fetches message history in chronological order', async () => {
      const res = await request(app)
        .get(`/api/chat/threads/${threadId}/messages`)
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].content).toContain('[PHONE NUMBER HIDDEN');
    });

    it('supports bilateral phone sharing: first party shares', async () => {
      const res = await request(app)
        .post(`/api/chat/threads/${threadId}/share-phone`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.phonesUnlocked).toBe(false);
      expect(res.body.data.thread.phone_shared_by_donor).toBe(true);
      expect(res.body.data.thread.phone_shared_by_requester).toBe(false);
    });

    it('second party shares: triggers bilateral unlock & inserts system announcement', async () => {
      const res = await request(app)
        .post(`/api/chat/threads/${threadId}/share-phone`)
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.phonesUnlocked).toBe(true);
      expect(res.body.data.thread.phone_shared_by_donor).toBe(true);
      expect(res.body.data.thread.phone_shared_by_requester).toBe(true);

      // Verify unmasked phone access in thread details
      const threadRes = await request(app)
        .get(`/api/chat/threads/${threadId}`)
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(threadRes.status).toBe(200);
      expect(threadRes.body.data.donor_phone).toBe('01833334444');
      expect(threadRes.body.data.requester_phone).toBe('01711112222');

      // Now verify new message with phone number is NOT masked
      const newMsgRes = await request(app)
        .post(`/api/chat/threads/${threadId}/messages`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ content: 'Direct phone is 01833334444. I am heading to the hospital now!' });

      expect(newMsgRes.status).toBe(201);
      expect(newMsgRes.body.data.content).toBe('Direct phone is 01833334444. I am heading to the hospital now!');
    });
  });

  describe('3. Safety Controls, Blocking & Auto-Closure', () => {
    let secondThread;
    let secondMatch;
    let secondBloodRequest;

    beforeAll(async () => {
      const bRes = await db.query(
        `INSERT INTO blood_requests 
         (requester_id, patient_name, blood_group, units_needed, hospital_name, location, city, urgency, needed_by, expires_at, contact_phone, status)
         VALUES ($1, 'Patient Safety', 'B+', 1, 'Safety Hospital', ST_SetSRID(ST_MakePoint(90.4125, 23.8103), 4326), 'Dhaka', 'URGENT', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '1 day', '01711112222', 'OPEN')
         RETURNING id;`,
        [requester.id]
      );
      secondBloodRequest = bRes.rows[0];

      const mRes = await db.query(
        `INSERT INTO request_matches (request_id, donor_id, status, wave_number, distance_km)
         VALUES ($1, $2, 'ACCEPTED', 1, 3.0)
         RETURNING id;`,
        [secondBloodRequest.id, donor.id]
      );
      secondMatch = mRes.rows[0];

      const tRes = await db.query(
        `INSERT INTO chat_threads (request_id, match_id, requester_id, donor_id, status)
         VALUES ($1, $2, $3, $4, 'OPEN')
         RETURNING *;`,
        [secondBloodRequest.id, secondMatch.id, requester.id, donor.id]
      );
      secondThread = tRes.rows[0];
    });

    afterAll(async () => {
      if (secondBloodRequest?.id) {
        await db.query(`DELETE FROM chat_messages WHERE thread_id IN (SELECT id FROM chat_threads WHERE request_id = $1)`, [secondBloodRequest.id]);
        await db.query(`DELETE FROM chat_blocks WHERE thread_id IN (SELECT id FROM chat_threads WHERE request_id = $1)`, [secondBloodRequest.id]);
        await db.query(`DELETE FROM chat_threads WHERE request_id = $1`, [secondBloodRequest.id]);
        await db.query(`DELETE FROM request_matches WHERE request_id = $1`, [secondBloodRequest.id]);
        await db.query(`DELETE FROM blood_requests WHERE id = $1`, [secondBloodRequest.id]);
      }
    });

    it('blocks participant and permanently closes chat thread', async () => {
      const blockRes = await request(app)
        .post(`/api/chat/threads/${secondThread.id}/block`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ reason: 'Inappropriate language in chat' });

      expect(blockRes.status).toBe(200);
      expect(blockRes.body.data.thread.status).toBe('CLOSED');
      expect(blockRes.body.data.thread.closed_reason).toBe('USER_BLOCKED');
    });

    it('rejects message sending on blocked or closed chat thread', async () => {
      const res = await request(app)
        .post(`/api/chat/threads/${secondThread.id}/messages`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ content: 'Can we still talk?' });

      expect(res.status).toBe(400); // Thread is closed
      expect(res.body.error.message).toContain('Chat thread is closed');
    });

    it('auto-closes open threads on request cancellation or fulfillment', async () => {
      // Create a dedicated request and match
      const bRes = await db.query(
        `INSERT INTO blood_requests 
         (requester_id, patient_name, blood_group, units_needed, hospital_name, location, city, urgency, needed_by, expires_at, contact_phone, status)
         VALUES ($1, 'Patient Temp', 'O+', 1, 'Temp Hospital', ST_SetSRID(ST_MakePoint(90.4125, 23.8103), 4326), 'Dhaka', 'URGENT', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '1 day', '01711112222', 'OPEN')
         RETURNING id;`,
        [requester.id]
      );
      const thirdBloodRequest = bRes.rows[0];

      const thirdMatch = await db.query(
        `INSERT INTO request_matches (request_id, donor_id, status, wave_number, distance_km)
         VALUES ($1, $2, 'ACCEPTED', 1, 4.0)
         RETURNING id;`,
        [thirdBloodRequest.id, donor.id]
      );
      const openT = await db.query(
        `INSERT INTO chat_threads (request_id, match_id, requester_id, donor_id, status)
         VALUES ($1, $2, $3, $4, 'OPEN')
         RETURNING *;`,
        [thirdBloodRequest.id, thirdMatch.rows[0].id, requester.id, donor.id]
      );

      const closed = await chatService.autoCloseThreadsForRequest(thirdBloodRequest.id, 'REQUEST_FULFILLED');
      expect(closed.length).toBeGreaterThan(0);

      const check = await db.query(`SELECT status, closed_reason FROM chat_threads WHERE id = $1`, [openT.rows[0].id]);
      expect(check.rows[0].status).toBe('CLOSED');
      expect(check.rows[0].closed_reason).toBe('REQUEST_FULFILLED');

      // Cleanup
      await db.query(`DELETE FROM chat_threads WHERE request_id = $1`, [thirdBloodRequest.id]);
      await db.query(`DELETE FROM request_matches WHERE request_id = $1`, [thirdBloodRequest.id]);
      await db.query(`DELETE FROM blood_requests WHERE id = $1`, [thirdBloodRequest.id]);
    });

    it('retention purge deletes old messages for closed threads', async () => {
      // Insert a message backdated 10 days ago on a closed thread
      await db.query(
        `INSERT INTO chat_messages (thread_id, sender_id, content, created_at)
         VALUES ($1, $2, 'Purge candidate message', NOW() - INTERVAL '10 days')`,
        [secondThread.id, requester.id]
      );

      const purgedCount = await chatService.purgeRetention(7);
      expect(purgedCount).toBeGreaterThanOrEqual(1);
    });
  });
});
