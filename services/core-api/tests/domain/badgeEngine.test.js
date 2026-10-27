const { evaluateBadges, BADGE_DEFINITIONS } = require('../../src/domain/badgeEngine');

describe('Badge Engine (Pure Domain Logic)', () => {
  it('awards FIRST_DONATION on 1st donation', () => {
    const badges = evaluateBadges({
      totalDonations: 1,
      existingBadgeCodes: [],
    });
    expect(badges).toHaveLength(1);
    expect(badges[0].code).toBe('FIRST_DONATION');
  });

  it('does not re-award FIRST_DONATION if already earned', () => {
    const badges = evaluateBadges({
      totalDonations: 2,
      existingBadgeCodes: ['FIRST_DONATION'],
    });
    expect(badges).toHaveLength(0);
  });

  it('awards DONOR_BRONZE at 3 donations', () => {
    const badges = evaluateBadges({
      totalDonations: 3,
      existingBadgeCodes: ['FIRST_DONATION'],
    });
    expect(badges).toHaveLength(1);
    expect(badges[0].code).toBe('DONOR_BRONZE');
  });

  it('awards DONOR_SILVER at 5 donations and DONOR_GOLD at 10', () => {
    const silver = evaluateBadges({
      totalDonations: 5,
      existingBadgeCodes: ['FIRST_DONATION', 'DONOR_BRONZE'],
    });
    expect(silver).toHaveLength(1);
    expect(silver[0].code).toBe('DONOR_SILVER');

    const gold = evaluateBadges({
      totalDonations: 10,
      existingBadgeCodes: ['FIRST_DONATION', 'DONOR_BRONZE', 'DONOR_SILVER'],
    });
    expect(gold).toHaveLength(1);
    expect(gold[0].code).toBe('DONOR_GOLD');
  });

  it('awards RAPID_RESPONDER if response time is within 10 minutes (600s)', () => {
    const fast = evaluateBadges({
      totalDonations: 2,
      responseTimeSeconds: 300,
      existingBadgeCodes: ['FIRST_DONATION'],
    });
    expect(fast).toHaveLength(1);
    expect(fast[0].code).toBe('RAPID_RESPONDER');

    const slow = evaluateBadges({
      totalDonations: 2,
      responseTimeSeconds: 650,
      existingBadgeCodes: ['FIRST_DONATION'],
    });
    expect(slow).toHaveLength(0);
  });

  it('awards LIFE_SAVER when fulfilling a CRITICAL request', () => {
    const critical = evaluateBadges({
      totalDonations: 1,
      urgency: 'CRITICAL',
      existingBadgeCodes: [],
    });
    const codes = critical.map((b) => b.code);
    expect(codes).toContain('FIRST_DONATION');
    expect(codes).toContain('LIFE_SAVER');
  });

  it('handles multiple new badges unlocked at once', () => {
    const badges = evaluateBadges({
      totalDonations: 3,
      responseTimeSeconds: 120,
      urgency: 'CRITICAL',
      existingBadgeCodes: [],
    });
    const codes = badges.map((b) => b.code);
    expect(codes).toContain('FIRST_DONATION');
    expect(codes).toContain('DONOR_BRONZE');
    expect(codes).toContain('RAPID_RESPONDER');
    expect(codes).toContain('LIFE_SAVER');
  });
});
