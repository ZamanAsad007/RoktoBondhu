/**
 * Blood Request State Machine
 *
 * States:
 * - OPEN: Initial state, open for matching and donor responses.
 * - PARTIALLY_FULFILLED: At least 1 unit accepted, but fewer than units_needed.
 * - FULFILLED: Accepted donor count has met or exceeded units_needed.
 * - EXPIRED: Time passed beyond needed_by / expires_at without full fulfillment.
 * - CANCELLED: Explicitly cancelled by requester.
 */

const REQUEST_STATUSES = Object.freeze({
  OPEN: 'OPEN',
  PARTIALLY_FULFILLED: 'PARTIALLY_FULFILLED',
  FULFILLED: 'FULFILLED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});

const ALLOWED_REQUEST_TRANSITIONS = Object.freeze({
  [REQUEST_STATUSES.OPEN]: Object.freeze([
    REQUEST_STATUSES.PARTIALLY_FULFILLED,
    REQUEST_STATUSES.FULFILLED,
    REQUEST_STATUSES.EXPIRED,
    REQUEST_STATUSES.CANCELLED,
  ]),
  [REQUEST_STATUSES.PARTIALLY_FULFILLED]: Object.freeze([
    REQUEST_STATUSES.FULFILLED,
    REQUEST_STATUSES.EXPIRED,
    REQUEST_STATUSES.CANCELLED,
  ]),
  [REQUEST_STATUSES.FULFILLED]: Object.freeze([]),
  [REQUEST_STATUSES.EXPIRED]: Object.freeze([]),
  [REQUEST_STATUSES.CANCELLED]: Object.freeze([]),
});

/**
 * Checks whether a given status is a recognized request status.
 * @param {string} status
 * @returns {boolean}
 */
function isValidRequestStatus(status) {
  return Object.values(REQUEST_STATUSES).includes(status);
}

/**
 * Checks whether a request status is terminal (no further transitions permitted).
 * @param {string} status
 * @returns {boolean}
 */
function isRequestTerminal(status) {
  const transitions = ALLOWED_REQUEST_TRANSITIONS[status];
  return Array.isArray(transitions) && transitions.length === 0;
}

/**
 * Verifies whether transitioning from currentStatus to nextStatus is permitted.
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @returns {boolean}
 */
function canTransitionRequest(currentStatus, nextStatus) {
  if (!isValidRequestStatus(currentStatus) || !isValidRequestStatus(nextStatus)) {
    return false;
  }
  const allowed = ALLOWED_REQUEST_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

/**
 * Performs state transition validation, returning the next status or throwing an error.
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @returns {string}
 */
function transitionRequest(currentStatus, nextStatus) {
  if (!canTransitionRequest(currentStatus, nextStatus)) {
    throw new Error(`Invalid request transition from "${currentStatus}" to "${nextStatus}".`);
  }
  return nextStatus;
}

/**
 * Pure helper to compute next status for a blood request given acceptance progress or events.
 *
 * @param {Object} params
 * @param {string} params.currentStatus
 * @param {number} params.unitsNeeded
 * @param {number} params.acceptedUnits
 * @param {boolean} [params.isCancelled=false]
 * @param {boolean} [params.isExpired=false]
 * @returns {string}
 */
function computeNextRequestStatus({ currentStatus, unitsNeeded, acceptedUnits = 0, isCancelled = false, isExpired = false }) {
  if (isRequestTerminal(currentStatus)) {
    return currentStatus;
  }

  if (isCancelled) {
    return transitionRequest(currentStatus, REQUEST_STATUSES.CANCELLED);
  }

  if (isExpired) {
    return transitionRequest(currentStatus, REQUEST_STATUSES.EXPIRED);
  }

  if (acceptedUnits >= unitsNeeded) {
    return transitionRequest(currentStatus, REQUEST_STATUSES.FULFILLED);
  }

  if (acceptedUnits > 0) {
    return transitionRequest(currentStatus, REQUEST_STATUSES.PARTIALLY_FULFILLED);
  }

  return currentStatus;
}

module.exports = {
  REQUEST_STATUSES,
  ALLOWED_REQUEST_TRANSITIONS,
  isValidRequestStatus,
  isRequestTerminal,
  canTransitionRequest,
  transitionRequest,
  computeNextRequestStatus,
};
