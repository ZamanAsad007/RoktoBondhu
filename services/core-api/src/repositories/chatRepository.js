const db = require('../config/db');

class ChatRepository {
  /**
   * Create or fetch existing chat thread for a match
   */
  async createThread({ requestId, matchId, requesterId, donorId }) {
    const query = `
      INSERT INTO chat_threads (request_id, match_id, requester_id, donor_id, status)
      VALUES ($1, $2, $3, $4, 'OPEN')
      ON CONFLICT (match_id) DO UPDATE SET
        updated_at = NOW()
      RETURNING *;
    `;
    const res = await db.query(query, [requestId, matchId, requesterId, donorId]);
    return res.rows[0];
  }

  /**
   * Get thread by ID with requester and donor user details
   */
  async getThreadById(threadId) {
    const query = `
      SELECT 
        ct.*,
        r.patient_name,
        r.blood_group,
        r.hospital_name,
        req_u.name as requester_name,
        req_u.phone as requester_phone,
        don_u.name as donor_name,
        don_u.phone as donor_phone,
        (ct.phone_shared_by_donor AND ct.phone_shared_by_requester) AS phones_unlocked
      FROM chat_threads ct
      JOIN blood_requests r ON ct.request_id = r.id
      JOIN users req_u ON ct.requester_id = req_u.id
      JOIN users don_u ON ct.donor_id = don_u.id
      WHERE ct.id = $1;
    `;
    const res = await db.query(query, [threadId]);
    return res.rows[0] || null;
  }

  /**
   * Get thread by match ID
   */
  async getThreadByMatchId(matchId) {
    const query = `
      SELECT 
        ct.*,
        r.patient_name,
        r.blood_group,
        r.hospital_name,
        req_u.name as requester_name,
        req_u.phone as requester_phone,
        don_u.name as donor_name,
        don_u.phone as donor_phone,
        (ct.phone_shared_by_donor AND ct.phone_shared_by_requester) AS phones_unlocked
      FROM chat_threads ct
      JOIN blood_requests r ON ct.request_id = r.id
      JOIN users req_u ON ct.requester_id = req_u.id
      JOIN users don_u ON ct.donor_id = don_u.id
      WHERE ct.match_id = $1;
    `;
    const res = await db.query(query, [matchId]);
    return res.rows[0] || null;
  }

  /**
   * Save message to thread
   */
  async saveMessage({ threadId, senderId, content, isSystem = false }) {
    const query = `
      INSERT INTO chat_messages (thread_id, sender_id, content, is_system, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, thread_id, sender_id, content, is_system, created_at;
    `;
    const res = await db.query(query, [threadId, senderId, content, isSystem]);
    return res.rows[0];
  }

  /**
   * Get messages for thread in chronological order
   */
  async getMessages(threadId, limit = 100) {
    const query = `
      SELECT 
        cm.id,
        cm.thread_id,
        cm.sender_id,
        cm.content,
        cm.is_system,
        cm.created_at,
        u.name as sender_name
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.thread_id = $1
      ORDER BY cm.created_at ASC
      LIMIT $2;
    `;
    const res = await db.query(query, [threadId, limit]);
    return res.rows;
  }

  /**
   * Share phone agreement (requester or donor)
   */
  async sharePhone({ threadId, userId }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const threadRes = await client.query(
        `SELECT * FROM chat_threads WHERE id = $1 FOR UPDATE`,
        [threadId]
      );
      const thread = threadRes.rows[0];
      if (!thread) {
        throw new Error('Chat thread not found');
      }

      let phone_shared_by_donor = thread.phone_shared_by_donor;
      let phone_shared_by_requester = thread.phone_shared_by_requester;

      if (thread.donor_id === userId) {
        phone_shared_by_donor = true;
      } else if (thread.requester_id === userId) {
        phone_shared_by_requester = true;
      } else {
        throw new Error('User is not a participant of this chat thread');
      }

      const updateRes = await client.query(
        `UPDATE chat_threads 
         SET phone_shared_by_donor = $1, phone_shared_by_requester = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *;`,
        [phone_shared_by_donor, phone_shared_by_requester, threadId]
      );

      const updated = updateRes.rows[0];
      const phonesUnlocked = updated.phone_shared_by_donor && updated.phone_shared_by_requester;

      // If unlocked just now, insert system message
      if (phonesUnlocked && (!thread.phone_shared_by_donor || !thread.phone_shared_by_requester)) {
        await client.query(
          `INSERT INTO chat_messages (thread_id, sender_id, content, is_system, created_at)
           VALUES ($1, $2, '🎉 Both parties have agreed to share contact numbers. Direct telephone contact is now unlocked!', TRUE, NOW());`,
          [threadId, userId]
        );
      }

      await client.query('COMMIT');
      return {
        thread: updated,
        phonesUnlocked,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Block participant in chat and close thread
   */
  async blockUser({ threadId, blockedBy, blockedUserId, reason = 'Reported in chat' }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 1. Record block
      await client.query(
        `INSERT INTO chat_blocks (thread_id, blocked_by, blocked_user_id, reason, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (thread_id, blocked_by) DO UPDATE SET reason = EXCLUDED.reason;`,
        [threadId, blockedBy, blockedUserId, reason]
      );

      // 2. Close thread
      const threadRes = await client.query(
        `UPDATE chat_threads
         SET status = 'CLOSED', closed_at = NOW(), closed_reason = 'USER_BLOCKED', updated_at = NOW()
         WHERE id = $1
         RETURNING *;`,
        [threadId]
      );

      // 3. System message
      await client.query(
        `INSERT INTO chat_messages (thread_id, sender_id, content, is_system, created_at)
         VALUES ($1, $2, '⚠️ This chat thread has been closed due to a block/safety report.', TRUE, NOW());`,
        [threadId, blockedBy]
      );

      await client.query('COMMIT');
      return threadRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Check if thread has an active block
   */
  async isUserBlocked(threadId, userId) {
    const query = `
      SELECT 1 FROM chat_blocks
      WHERE thread_id = $1 AND (blocked_by = $2 OR blocked_user_id = $2)
      LIMIT 1;
    `;
    const res = await db.query(query, [threadId, userId]);
    return res.rows.length > 0;
  }

  /**
   * Auto-close threads when request status changes (Fulfilled, Cancelled, Expired)
   */
  async closeThreadsForRequest(requestId, reason = 'REQUEST_FULFILLED') {
    const query = `
      UPDATE chat_threads
      SET status = 'CLOSED', closed_at = NOW(), closed_reason = $1, updated_at = NOW()
      WHERE request_id = $2 AND status = 'OPEN'
      RETURNING *;
    `;
    const res = await db.query(query, [reason, requestId]);
    return res.rows;
  }

  /**
   * Retention job: Purge chat messages older than X days for closed threads
   */
  async purgeOldMessages(days = 7) {
    const query = `
      DELETE FROM chat_messages cm
      USING chat_threads ct
      WHERE cm.thread_id = ct.id
        AND ct.status = 'CLOSED'
        AND cm.created_at < (NOW() - ($1 || ' days')::interval);
    `;
    const res = await db.query(query, [days]);
    return res.rowCount;
  }
}

module.exports = new ChatRepository();
