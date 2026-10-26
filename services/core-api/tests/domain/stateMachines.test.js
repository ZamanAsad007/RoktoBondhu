const {
  REQUEST_STATUSES,
  ALLOWED_REQUEST_TRANSITIONS,
  isValidRequestStatus,
  isRequestTerminal,
  canTransitionRequest,
  transitionRequest,
  computeNextRequestStatus,
} = require('../../src/domain/requestStateMachine');

const {
  MATCH_STATUSES,
  ALLOWED_MATCH_TRANSITIONS,
  isValidMatchStatus,
  isMatchTerminal,
  canTransitionMatch,
  transitionMatch,
} = require('../../src/domain/matchStateMachine');

describe('Request and Match State Machines', () => {
  describe('Request State Machine', () => {
    test('defines correct request statuses', () => {
      expect(REQUEST_STATUSES).toEqual({
        OPEN: 'OPEN',
        PARTIALLY_FULFILLED: 'PARTIALLY_FULFILLED',
        FULFILLED: 'FULFILLED',
        EXPIRED: 'EXPIRED',
        CANCELLED: 'CANCELLED',
      });
    });

    test('validates valid request statuses', () => {
      Object.values(REQUEST_STATUSES).forEach((status) => {
        expect(isValidRequestStatus(status)).toBe(true);
      });
      expect(isValidRequestStatus('PENDING')).toBe(false);
      expect(isValidRequestStatus(null)).toBe(false);
    });

    test('correctly identifies terminal request statuses', () => {
      expect(isRequestTerminal(REQUEST_STATUSES.OPEN)).toBe(false);
      expect(isRequestTerminal(REQUEST_STATUSES.PARTIALLY_FULFILLED)).toBe(false);
      expect(isRequestTerminal(REQUEST_STATUSES.FULFILLED)).toBe(true);
      expect(isRequestTerminal(REQUEST_STATUSES.EXPIRED)).toBe(true);
      expect(isRequestTerminal(REQUEST_STATUSES.CANCELLED)).toBe(true);
    });

    test('allows valid transitions from OPEN', () => {
      expect(canTransitionRequest(REQUEST_STATUSES.OPEN, REQUEST_STATUSES.PARTIALLY_FULFILLED)).toBe(true);
      expect(canTransitionRequest(REQUEST_STATUSES.OPEN, REQUEST_STATUSES.FULFILLED)).toBe(true);
      expect(canTransitionRequest(REQUEST_STATUSES.OPEN, REQUEST_STATUSES.EXPIRED)).toBe(true);
      expect(canTransitionRequest(REQUEST_STATUSES.OPEN, REQUEST_STATUSES.CANCELLED)).toBe(true);
      expect(transitionRequest(REQUEST_STATUSES.OPEN, REQUEST_STATUSES.PARTIALLY_FULFILLED)).toBe(
        REQUEST_STATUSES.PARTIALLY_FULFILLED
      );
    });

    test('allows valid transitions from PARTIALLY_FULFILLED', () => {
      expect(canTransitionRequest(REQUEST_STATUSES.PARTIALLY_FULFILLED, REQUEST_STATUSES.FULFILLED)).toBe(true);
      expect(canTransitionRequest(REQUEST_STATUSES.PARTIALLY_FULFILLED, REQUEST_STATUSES.EXPIRED)).toBe(true);
      expect(canTransitionRequest(REQUEST_STATUSES.PARTIALLY_FULFILLED, REQUEST_STATUSES.CANCELLED)).toBe(true);
      expect(canTransitionRequest(REQUEST_STATUSES.PARTIALLY_FULFILLED, REQUEST_STATUSES.OPEN)).toBe(false);
    });

    test('disallows invalid transitions from terminal states', () => {
      [REQUEST_STATUSES.FULFILLED, REQUEST_STATUSES.EXPIRED, REQUEST_STATUSES.CANCELLED].forEach((status) => {
        expect(canTransitionRequest(status, REQUEST_STATUSES.OPEN)).toBe(false);
        expect(canTransitionRequest(status, REQUEST_STATUSES.FULFILLED)).toBe(false);
        expect(() => transitionRequest(status, REQUEST_STATUSES.OPEN)).toThrow(/Invalid request transition/);
      });
      expect(() => transitionRequest(REQUEST_STATUSES.OPEN, 'INVALID_TARGET')).toThrow(/Invalid request transition/);
    });

    test('computeNextRequestStatus computes proper status based on units and flags', () => {
      // 0 units accepted -> remains OPEN
      expect(
        computeNextRequestStatus({ currentStatus: REQUEST_STATUSES.OPEN, unitsNeeded: 3, acceptedUnits: 0 })
      ).toBe(REQUEST_STATUSES.OPEN);

      // 1 of 3 accepted -> PARTIALLY_FULFILLED
      expect(
        computeNextRequestStatus({ currentStatus: REQUEST_STATUSES.OPEN, unitsNeeded: 3, acceptedUnits: 1 })
      ).toBe(REQUEST_STATUSES.PARTIALLY_FULFILLED);

      // 3 of 3 accepted -> FULFILLED
      expect(
        computeNextRequestStatus({ currentStatus: REQUEST_STATUSES.OPEN, unitsNeeded: 3, acceptedUnits: 3 })
      ).toBe(REQUEST_STATUSES.FULFILLED);

      // Already partially fulfilled, now 3 accepted -> FULFILLED
      expect(
        computeNextRequestStatus({
          currentStatus: REQUEST_STATUSES.PARTIALLY_FULFILLED,
          unitsNeeded: 3,
          acceptedUnits: 3,
        })
      ).toBe(REQUEST_STATUSES.FULFILLED);

      // Cancellation takes priority
      expect(
        computeNextRequestStatus({
          currentStatus: REQUEST_STATUSES.OPEN,
          unitsNeeded: 2,
          acceptedUnits: 0,
          isCancelled: true,
        })
      ).toBe(REQUEST_STATUSES.CANCELLED);

      // Expiry
      expect(
        computeNextRequestStatus({
          currentStatus: REQUEST_STATUSES.PARTIALLY_FULFILLED,
          unitsNeeded: 2,
          acceptedUnits: 1,
          isExpired: true,
        })
      ).toBe(REQUEST_STATUSES.EXPIRED);

      // Terminal state remains terminal
      expect(
        computeNextRequestStatus({
          currentStatus: REQUEST_STATUSES.FULFILLED,
          unitsNeeded: 2,
          acceptedUnits: 2,
        })
      ).toBe(REQUEST_STATUSES.FULFILLED);
    });
  });

  describe('Match State Machine', () => {
    test('defines correct match statuses', () => {
      expect(MATCH_STATUSES).toEqual({
        NOTIFIED: 'NOTIFIED',
        ACCEPTED: 'ACCEPTED',
        DECLINED: 'DECLINED',
        EXPIRED: 'EXPIRED',
        DONATED: 'DONATED',
        NO_SHOW: 'NO_SHOW',
        CANCELLED_BY_DONOR: 'CANCELLED_BY_DONOR',
      });
    });

    test('validates valid match statuses', () => {
      Object.values(MATCH_STATUSES).forEach((status) => {
        expect(isValidMatchStatus(status)).toBe(true);
      });
      expect(isValidMatchStatus('PENDING')).toBe(false);
      expect(isValidMatchStatus(undefined)).toBe(false);
    });

    test('correctly identifies terminal match statuses', () => {
      expect(isMatchTerminal(MATCH_STATUSES.NOTIFIED)).toBe(false);
      expect(isMatchTerminal(MATCH_STATUSES.ACCEPTED)).toBe(false);
      expect(isMatchTerminal(MATCH_STATUSES.DECLINED)).toBe(true);
      expect(isMatchTerminal(MATCH_STATUSES.EXPIRED)).toBe(true);
      expect(isMatchTerminal(MATCH_STATUSES.DONATED)).toBe(true);
      expect(isMatchTerminal(MATCH_STATUSES.NO_SHOW)).toBe(true);
      expect(isMatchTerminal(MATCH_STATUSES.CANCELLED_BY_DONOR)).toBe(true);
    });

    test('allows valid transitions from NOTIFIED', () => {
      expect(canTransitionMatch(MATCH_STATUSES.NOTIFIED, MATCH_STATUSES.ACCEPTED)).toBe(true);
      expect(canTransitionMatch(MATCH_STATUSES.NOTIFIED, MATCH_STATUSES.DECLINED)).toBe(true);
      expect(canTransitionMatch(MATCH_STATUSES.NOTIFIED, MATCH_STATUSES.EXPIRED)).toBe(true);
      expect(canTransitionMatch(MATCH_STATUSES.NOTIFIED, MATCH_STATUSES.DONATED)).toBe(false);
      expect(transitionMatch(MATCH_STATUSES.NOTIFIED, MATCH_STATUSES.ACCEPTED)).toBe(MATCH_STATUSES.ACCEPTED);
    });

    test('allows valid transitions from ACCEPTED', () => {
      expect(canTransitionMatch(MATCH_STATUSES.ACCEPTED, MATCH_STATUSES.DONATED)).toBe(true);
      expect(canTransitionMatch(MATCH_STATUSES.ACCEPTED, MATCH_STATUSES.NO_SHOW)).toBe(true);
      expect(canTransitionMatch(MATCH_STATUSES.ACCEPTED, MATCH_STATUSES.CANCELLED_BY_DONOR)).toBe(true);
      expect(canTransitionMatch(MATCH_STATUSES.ACCEPTED, MATCH_STATUSES.NOTIFIED)).toBe(false);
      expect(canTransitionMatch(MATCH_STATUSES.ACCEPTED, MATCH_STATUSES.DECLINED)).toBe(false);
      expect(transitionMatch(MATCH_STATUSES.ACCEPTED, MATCH_STATUSES.DONATED)).toBe(MATCH_STATUSES.DONATED);
    });

    test('disallows invalid transitions from terminal states', () => {
      const terminalStates = [
        MATCH_STATUSES.DECLINED,
        MATCH_STATUSES.EXPIRED,
        MATCH_STATUSES.DONATED,
        MATCH_STATUSES.NO_SHOW,
        MATCH_STATUSES.CANCELLED_BY_DONOR,
      ];
      terminalStates.forEach((status) => {
        expect(canTransitionMatch(status, MATCH_STATUSES.ACCEPTED)).toBe(false);
        expect(canTransitionMatch(status, MATCH_STATUSES.NOTIFIED)).toBe(false);
        expect(() => transitionMatch(status, MATCH_STATUSES.ACCEPTED)).toThrow(/Invalid match transition/);
      });
      expect(() => transitionMatch(MATCH_STATUSES.NOTIFIED, 'INVALID')).toThrow(/Invalid match transition/);
    });
  });
});
