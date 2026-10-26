const matchRepository = require('../repositories/matchRepository');
const bloodRequestRepository = require('../repositories/bloodRequestRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const notificationQueue = require('../jobs/notificationQueue');
const db = require('../config/db');
const { maskPhoneNumber } = require('./bloodRequestService');
const { REQUEST_STATUSES } = require('../domain/requestStateMachine');
const { MATCH_STATUSES } = require('../domain/matchStateMachine');

class MatchService {
  /**
   * Accepts a blood request match inside a transaction using row-level locking (SELECT ... FOR UPDATE)
   * on the blood_requests table. This completely prevents race conditions when multiple donors
   * accept simultaneously for a limited number of units.
   */
  async acceptMatch(matchId, currentUser) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 1. Retrieve the match to identify the target blood_request
      const initialMatch = await matchRepository.findById(matchId, client);
      if (!initialMatch) {
        const err = new Error('Match invitation not found');
        err.statusCode = 404;
        throw err;
      }

      // 2. Lock the blood_request row FIRST with SELECT ... FOR UPDATE
      // This completely serializes concurrent donor accepts and prevents deadlocks
      const reqQuery = `SELECT * FROM blood_requests WHERE id = $1 FOR UPDATE`;
      const reqRes = await client.query(reqQuery, [initialMatch.request_id]);
      const request = reqRes.rows[0];

      if (!request) {
        const err = new Error('Associated blood request not found');
        err.statusCode = 404;
        throw err;
      }

      // 3. Verify request is still open / partially fulfilled
      if (
        request.status !== REQUEST_STATUSES.OPEN &&
        request.status !== REQUEST_STATUSES.PARTIALLY_FULFILLED
      ) {
        const err = new Error(
          `Conflict: Blood request has already been fulfilled or closed (status: ${request.status})`
        );
        err.statusCode = 409;
        throw err;
      }

      // 4. Verify request expiration
      if (new Date(request.expires_at).getTime() <= Date.now()) {
        const err = new Error('Conflict: Blood request has expired');
        err.statusCode = 409;
        throw err;
      }

      // 5. Check count of currently accepted matches vs units needed
      const currentAcceptedCount = await matchRepository.countAcceptedMatches(
        request.id,
        client
      );
      if (currentAcceptedCount >= request.units_needed) {
        const err = new Error('Conflict: Blood request has already been fulfilled');
        err.statusCode = 409;
        throw err;
      }

      // 6. Retrieve and lock this match row (safe now that blood_request lock is held)
      const match = await matchRepository.findMatchByIdForUpdate(matchId, client);
      if (!match) {
        const err = new Error('Match invitation not found');
        err.statusCode = 404;
        throw err;
      }

      // 7. Verify that the authenticated user is the designated donor
      if (match.donor_id !== currentUser.id) {
        const err = new Error('Forbidden: You are not the designated donor for this match invitation');
        err.statusCode = 403;
        throw err;
      }

      // 8. Check match status
      if (match.status === MATCH_STATUSES.ACCEPTED) {
        const err = new Error('You have already accepted this blood request');
        err.statusCode = 400;
        throw err;
      }
      if (match.status === MATCH_STATUSES.DECLINED) {
        const err = new Error('You have already declined this blood request');
        err.statusCode = 400;
        throw err;
      }
      if (match.status === MATCH_STATUSES.EXPIRED) {
        const err = new Error('Conflict: Blood request has already been fulfilled or invitation expired');
        err.statusCode = 409;
        throw err;
      }
      if (match.status !== MATCH_STATUSES.NOTIFIED) {
        const err = new Error(`Cannot accept invitation in status "${match.status}"`);
        err.statusCode = 400;
        throw err;
      }

      // 9. Verify donor does not currently have another active accepted donation
      const hasActive = await matchRepository.hasActiveAcceptedDonation(
        currentUser.id,
        matchId,
        client
      );
      if (hasActive) {
        const err = new Error(
          'Conflict: You already have another active accepted blood donation in progress'
        );
        err.statusCode = 409;
        throw err;
      }

      // 10. Update match to ACCEPTED
      const updatedMatch = await matchRepository.updateMatchStatus(
        matchId,
        MATCH_STATUSES.ACCEPTED,
        client
      );

      // 11. Update request status based on new accepted count
      const newAcceptedCount = currentAcceptedCount + 1;
      const isFulfilled = newAcceptedCount >= request.units_needed;
      const nextRequestStatus = isFulfilled
        ? REQUEST_STATUSES.FULFILLED
        : REQUEST_STATUSES.PARTIALLY_FULFILLED;

      const updatedRequest = await bloodRequestRepository.updateStatus(
        request.id,
        nextRequestStatus,
        client
      );

      // 12. When request becomes FULFILLED, expire leftover NOTIFIED matches
      if (isFulfilled) {
        await matchRepository.expireLeftoverNotifiedMatches(request.id, client);
      }

      // 13. Record audit log
      await auditLogRepository.log(
        {
          actorId: currentUser.id,
          action: 'MATCH_ACCEPTED',
          entity: 'request_matches',
          entityId: matchId,
          metadata: {
            request_id: request.id,
            units_needed: request.units_needed,
            accepted_count: newAcceptedCount,
            request_status: nextRequestStatus,
            is_fulfilled: isFulfilled,
          },
        },
        client
      );

      await client.query('COMMIT');

      // Post-commit notification side-effects (non-blocking)
      try {
        // 1. Notify requester that donor accepted
        await notificationQueue.enqueueNotification({
          type: 'donor.accepted',
          userId: request.requester_id,
          recipient: {
            id: request.requester_id,
          },
          payload: {
            requestId: request.id,
            matchId,
            donorId: currentUser.id,
            donorName: currentUser.name,
            donorPhone: currentUser.phone,
            patientName: request.patient_name,
            bloodGroup: request.blood_group,
            hospitalName: request.hospital_name,
          },
          channels: ['in_app', 'email'],
        });

        // 2. Schedule donation reminder for the donor before needed_by
        await notificationQueue.scheduleDonationReminder({
          donorId: currentUser.id,
          recipient: {
            id: currentUser.id,
            name: currentUser.name,
            phone: currentUser.phone,
            email: currentUser.email,
          },
          request,
        });

        // 3. If request is now fulfilled, notify requester and all accepted donors
        if (isFulfilled) {
          const acceptedMatches = await matchRepository.findAcceptedMatchesByRequestId(request.id);
          const allUserIds = Array.from(
            new Set([request.requester_id, ...acceptedMatches.map((m) => m.donor_id)])
          );

          for (const uid of allUserIds) {
            await notificationQueue.enqueueNotification({
              type: 'request.fulfilled',
              userId: uid,
              payload: {
                requestId: request.id,
                patientName: request.patient_name,
                bloodGroup: request.blood_group,
                hospitalName: request.hospital_name,
                unitsNeeded: request.units_needed,
              },
              channels: ['in_app', 'email'],
            });
          }
        }
      } catch (notifyErr) {
        console.error('[MatchService] Post-commit notification error:', notifyErr.message);
      }

      return {
        match: updatedMatch,
        request: updatedRequest,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Declines a blood request match inside a transaction.
   */
  async declineMatch(matchId, currentUser) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const match = await matchRepository.findMatchByIdForUpdate(matchId, client);
      if (!match) {
        const err = new Error('Match invitation not found');
        err.statusCode = 404;
        throw err;
      }

      if (match.donor_id !== currentUser.id) {
        const err = new Error('Forbidden: You are not the designated donor for this match invitation');
        err.statusCode = 403;
        throw err;
      }

      if (match.status === MATCH_STATUSES.DECLINED) {
        const err = new Error('You have already declined this match invitation');
        err.statusCode = 400;
        throw err;
      }

      if (match.status === MATCH_STATUSES.EXPIRED) {
        const err = new Error('Conflict: Blood request has already been fulfilled or invitation expired');
        err.statusCode = 409;
        throw err;
      }

      if (match.status !== MATCH_STATUSES.NOTIFIED) {
        const err = new Error(`Cannot decline invitation in status "${match.status}"`);
        err.statusCode = 400;
        throw err;
      }

      const updatedMatch = await matchRepository.updateMatchStatus(
        matchId,
        MATCH_STATUSES.DECLINED,
        client
      );

      await auditLogRepository.log(
        {
          actorId: currentUser.id,
          action: 'MATCH_DECLINED',
          entity: 'request_matches',
          entityId: matchId,
          metadata: { request_id: match.request_id },
        },
        client
      );

      await client.query('COMMIT');
      return { match: updatedMatch };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Lists all match invitations for the authenticated donor.
   */
  async listMyMatches(currentUser, pagination = {}) {
    const matches = await matchRepository.findMatchesByDonorId(currentUser.id, pagination);

    // Apply privacy masking to request contact info:
    // Revealed only if the donor has status ACCEPTED
    return matches.map((m) => {
      const isAccepted = m.match_status === MATCH_STATUSES.ACCEPTED;
      return {
        ...m,
        is_contact_revealed: isAccepted,
        contact_phone: isAccepted ? m.contact_phone : maskPhoneNumber(m.contact_phone),
      };
    });
  }
}

module.exports = new MatchService();
