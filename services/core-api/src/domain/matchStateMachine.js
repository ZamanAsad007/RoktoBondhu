/**
 * Donor Match Lifecycle State Machine
 *
 * States:
 * - NOTIFIED: Donor has been notified in a wave.
 * - ACCEPTED: Donor agreed to donate.
 * - DECLINED: Donor rejected the request.
 * - EXPIRED: Donor did not respond before wave timeout or request ended.
 * - DONATED: Donor showed up and donated blood (verified).
 * - NO_SHOW: Donor accepted but did not show up.
 * - CANCELLED_BY_DONOR: Donor withdrew their acceptance before donation.
 */

const MATCH_STATUSES = Object.freeze({
  NOTIFIED: 'NOTIFIED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  DONATED: 'DONATED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED_BY_DONOR: 'CANCELLED_BY_DONOR',
});

const ALLOWED_MATCH_TRANSITIONS = Object.freeze({
  [MATCH_STATUSES.NOTIFIED]: Object.freeze([
    MATCH_STATUSES.ACCEPTED,
    MATCH_STATUSES.DECLINED,
    MATCH_STATUSES.EXPIRED,
  ]),
  [MATCH_STATUSES.ACCEPTED]: Object.freeze([
    MATCH_STATUSES.DONATED,
    MATCH_STATUSES.NO_SHOW,
    MATCH_STATUSES.CANCELLED_BY_DONOR,
  ]),
  [MATCH_STATUSES.DECLINED]: Object.freeze([]),
  [MATCH_STATUSES.EXPIRED]: Object.freeze([]),
  [MATCH_STATUSES.DONATED]: Object.freeze([]),
  [MATCH_STATUSES.NO_SHOW]: Object.freeze([]),
  [MATCH_STATUSES.CANCELLED_BY_DONOR]: Object.freeze([]),
});

/**
 * Checks whether a given status is a recognized match status.
 * @param {string} status
 * @returns {boolean}
 */
function isValidMatchStatus(status) {
  return Object.values(MATCH_STATUSES).includes(status);
}

/**
 * Checks whether a match status is terminal.
 * @param {string} status
 * @returns {boolean}
 */
function isMatchTerminal(status) {
  const transitions = ALLOWED_MATCH_TRANSITIONS[status];
  return Array.isArray(transitions) && transitions.length === 0;
}

/**
 * Checks whether a transition between two match statuses is permitted.
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @returns {boolean}
 */
function canTransitionMatch(currentStatus, nextStatus) {
  if (!isValidMatchStatus(currentStatus) || !isValidMatchStatus(nextStatus)) {
    return false;
  }
  const allowed = ALLOWED_MATCH_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

/**
 * Validates and executes state transition for a donor match, throwing on error.
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @returns {string}
 */
function transitionMatch(currentStatus, nextStatus) {
  if (!canTransitionMatch(currentStatus, nextStatus)) {
    throw new Error(`Invalid match transition from "${currentStatus}" to "${nextStatus}".`);
  }
  return nextStatus;
}

module.exports = {
  MATCH_STATUSES,
  ALLOWED_MATCH_TRANSITIONS,
  isValidMatchStatus,
  isMatchTerminal,
  canTransitionMatch,
  transitionMatch,
};
