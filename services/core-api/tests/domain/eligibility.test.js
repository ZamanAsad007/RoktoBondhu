const {
  calculateAge,
  isCooldownSatisfied,
  isDonorEligible,
} = require('../../src/domain/eligibility');

describe('Donor Eligibility Domain Logic', () => {
  const refDate = new Date('2026-10-26T12:00:00Z');

  describe('calculateAge', () => {
    test('calculates correct age before and after birthday in current year', () => {
      // Born on Oct 25, 2000 (birthday was yesterday) -> 26
      expect(calculateAge('2000-10-25', refDate)).toBe(26);

      // Born on Oct 26, 2000 (birthday is today) -> 26
      expect(calculateAge('2000-10-26', refDate)).toBe(26);

      // Born on Oct 27, 2000 (birthday is tomorrow) -> 25
      expect(calculateAge('2000-10-27', refDate)).toBe(25);

      // Born on Nov 15, 2000 (birthday is next month) -> 25
      expect(calculateAge('2000-11-15', refDate)).toBe(25);
    });

    test('accepts Date objects and string reference dates', () => {
      expect(calculateAge(new Date('1990-01-01'), refDate)).toBe(36);
      expect(calculateAge('1990-01-01', '2026-10-26T12:00:00Z')).toBe(36);
      expect(calculateAge('1990-12-01', refDate)).toBe(35); // birthday later in year
    });

    test('defaults referenceDate to current date when omitted', () => {
      const age = calculateAge('1990-01-01');
      expect(age).toBeGreaterThan(30);
    });

    test('returns NaN for invalid or empty dates', () => {
      expect(calculateAge(null, refDate)).toBeNaN();
      expect(calculateAge(undefined, refDate)).toBeNaN();
      expect(calculateAge('not-a-date', refDate)).toBeNaN();
    });
  });

  describe('isCooldownSatisfied', () => {
    test('returns satisfied true if donor has never donated before (null or undefined)', () => {
      expect(isCooldownSatisfied(null, 90, refDate)).toEqual({ satisfied: true, daysElapsed: null });
      expect(isCooldownSatisfied(undefined, 90, refDate)).toEqual({ satisfied: true, daysElapsed: null });
    });

    test('returns satisfied true when gap is >= cooldownDays (90 days)', () => {
      // 95 days ago
      const pastDate = new Date('2026-07-23T12:00:00Z');
      const result = isCooldownSatisfied(pastDate, 90, refDate);
      expect(result.satisfied).toBe(true);
      expect(result.daysElapsed).toBeGreaterThanOrEqual(90);

      // With string referenceDate
      const strRefResult = isCooldownSatisfied(pastDate, 90, '2026-10-26T12:00:00Z');
      expect(strRefResult.satisfied).toBe(true);
    });

    test('returns satisfied false when gap is < cooldownDays', () => {
      // 30 days ago
      const recentDate = new Date('2026-09-26T12:00:00Z');
      const result = isCooldownSatisfied(recentDate, 90, refDate);
      expect(result.satisfied).toBe(false);
      expect(result.daysElapsed).toBe(30);
    });

    test('returns false for invalid date input', () => {
      const result = isCooldownSatisfied('invalid-date', 90, refDate);
      expect(result.satisfied).toBe(false);
      expect(result.daysElapsed).toBeNull();
    });
  });

  describe('isDonorEligible', () => {
    const validDonor = {
      available: true,
      phone_verified: true,
      is_blocked: false,
      date_of_birth: '1995-05-10', // ~31 years old
      last_donated_at: '2026-01-01', // well over 90 days ago
      hasActiveAcceptedRequest: false,
    };

    test('returns eligible: true with empty reasons when all criteria met', () => {
      const result = isDonorEligible(validDonor, {}, refDate);
      expect(result.eligible).toBe(true);
      expect(result.reasons).toEqual([]);
    });

    test('flags unavailable donor', () => {
      const result = isDonorEligible({ ...validDonor, available: false }, {}, refDate);
      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('Donor has set their status to unavailable');
    });

    test('flags unverified phone', () => {
      const result = isDonorEligible({ ...validDonor, phone_verified: false }, {}, refDate);
      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('Donor phone number is not verified');
    });

    test('supports camelCase phoneVerified and isBlocked properties', () => {
      const donor = {
        available: true,
        phoneVerified: true,
        isBlocked: false,
        dateOfBirth: '1995-05-10',
        lastDonatedAt: null,
      };
      const result = isDonorEligible(donor, {}, refDate);
      expect(result.eligible).toBe(true);
    });

    test('flags blocked donor', () => {
      const result = isDonorEligible({ ...validDonor, is_blocked: true }, {}, refDate);
      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('Donor account is suspended or blocked');
    });

    test('flags underage donor (< 18)', () => {
      // 16 years old in 2026
      const result = isDonorEligible({ ...validDonor, date_of_birth: '2010-01-01' }, {}, refDate);
      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toMatch(/below minimum required age of 18/);
    });

    test('flags overage donor (> 60)', () => {
      // 65 years old in 2026
      const result = isDonorEligible({ ...validDonor, date_of_birth: '1961-01-01' }, {}, refDate);
      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toMatch(/exceeds maximum allowed age of 60/);
    });

    test('flags missing or invalid date of birth', () => {
      const result = isDonorEligible({ ...validDonor, date_of_birth: null }, {}, refDate);
      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('Donor date of birth is missing or invalid');
    });

    test('flags cooldown violation if donated less than 90 days ago', () => {
      const result = isDonorEligible(
        { ...validDonor, last_donated_at: '2026-10-01' }, // 25 days ago
        {},
        refDate
      );
      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toMatch(/Minimum cooldown of 90 days/);
    });

    test('flags donor who already has an active accepted request in progress', () => {
      const result = isDonorEligible(
        { ...validDonor, hasActiveAcceptedRequest: true },
        {},
        refDate
      );
      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('Donor currently has an active accepted blood request in progress');
    });

    test('defaults to today when referenceDate omitted in isDonorEligible and isCooldownSatisfied', () => {
      const cooldown = isCooldownSatisfied('2020-01-01');
      expect(cooldown.satisfied).toBe(true);

      const eligibility = isDonorEligible();
      expect(eligibility.eligible).toBe(false);
    });

    test('handles invalid last_donated_at date gracefully in isDonorEligible', () => {
      const result = isDonorEligible({ ...validDonor, last_donated_at: 'invalid-date' }, {}, refDate);
      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toMatch(/Minimum cooldown/);
    });

    test('respects config overrides', () => {
      // Custom min age 21, requirePhoneVerified false
      const donor = {
        available: true,
        phone_verified: false,
        is_blocked: false,
        date_of_birth: '2007-01-01', // 19 years old
        hasActiveAcceptedRequest: false,
      };

      const result = isDonorEligible(
        donor,
        { minAge: 21, requirePhoneVerified: false },
        refDate
      );
      expect(result.eligible).toBe(false);
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toMatch(/below minimum required age of 21/);
    });
  });
});
