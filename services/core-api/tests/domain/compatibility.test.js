const {
  BLOOD_GROUPS,
  COMPATIBILITY_MAP,
  isValidBloodGroup,
  compatibleDonorGroups,
  isCompatible,
} = require('../../src/domain/compatibility');

describe('Blood Compatibility Domain Logic', () => {
  describe('Blood Groups Constant and Validation', () => {
    test('contains all 8 ABO/Rh blood groups', () => {
      expect(BLOOD_GROUPS).toEqual(['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']);
      expect(BLOOD_GROUPS).toHaveLength(8);
    });

    test('validates valid blood groups (case insensitive & trimmed)', () => {
      BLOOD_GROUPS.forEach((group) => {
        expect(isValidBloodGroup(group)).toBe(true);
        expect(isValidBloodGroup(` ${group.toLowerCase()} `)).toBe(true);
      });
    });

    test('rejects invalid blood groups', () => {
      expect(isValidBloodGroup('C+')).toBe(false);
      expect(isValidBloodGroup('A')).toBe(false);
      expect(isValidBloodGroup('O')).toBe(false);
      expect(isValidBloodGroup('')).toBe(false);
      expect(isValidBloodGroup(null)).toBe(false);
      expect(isValidBloodGroup(undefined)).toBe(false);
      expect(isValidBloodGroup(123)).toBe(false);
    });
  });

  describe('compatibleDonorGroups Table Rules', () => {
    test('O- recipient receives ONLY from O- (universal red-cell donor)', () => {
      expect(compatibleDonorGroups('O-')).toEqual(['O-']);
    });

    test('O+ recipient receives from O+, O-', () => {
      expect(compatibleDonorGroups('O+')).toEqual(['O+', 'O-']);
    });

    test('A- recipient receives from A-, O-', () => {
      expect(compatibleDonorGroups('A-')).toEqual(['A-', 'O-']);
    });

    test('A+ recipient receives from A+, A-, O+, O-', () => {
      expect(compatibleDonorGroups('A+')).toEqual(['A+', 'A-', 'O+', 'O-']);
    });

    test('B- recipient receives from B-, O-', () => {
      expect(compatibleDonorGroups('B-')).toEqual(['B-', 'O-']);
    });

    test('B+ recipient receives from B+, B-, O+, O-', () => {
      expect(compatibleDonorGroups('B+')).toEqual(['B+', 'B-', 'O+', 'O-']);
    });

    test('AB- recipient receives from AB-, A-, B-, O-', () => {
      expect(compatibleDonorGroups('AB-')).toEqual(['AB-', 'A-', 'B-', 'O-']);
    });

    test('AB+ recipient receives from all 8 groups (universal recipient)', () => {
      const donors = compatibleDonorGroups('AB+');
      expect(donors).toHaveLength(8);
      BLOOD_GROUPS.forEach((group) => {
        expect(donors).toContain(group);
      });
    });

    test('throws for unknown recipient group', () => {
      expect(() => compatibleDonorGroups('XYZ')).toThrow('Invalid recipient blood group');
      expect(() => compatibleDonorGroups('')).toThrow('Invalid recipient blood group');
      expect(() => compatibleDonorGroups(null)).toThrow('Invalid recipient blood group');
    });
  });

  describe('isCompatible predicate', () => {
    test('returns true for compatible pairs', () => {
      expect(isCompatible('O-', 'O-')).toBe(true);
      expect(isCompatible('O+', 'O-')).toBe(true);
      expect(isCompatible('O+', 'O+')).toBe(true);
      expect(isCompatible('A+', 'A-')).toBe(true);
      expect(isCompatible('A+', 'O+')).toBe(true);
      expect(isCompatible('AB+', 'B+')).toBe(true);
      expect(isCompatible('AB-', 'A-')).toBe(true);
    });

    test('returns false for incompatible pairs', () => {
      expect(isCompatible('O-', 'O+')).toBe(false);
      expect(isCompatible('O-', 'A-')).toBe(false);
      expect(isCompatible('A+', 'B+')).toBe(false);
      expect(isCompatible('B+', 'A+')).toBe(false);
      expect(isCompatible('AB-', 'AB+')).toBe(false);
      expect(isCompatible('AB-', 'A+')).toBe(false);
    });

    test('returns false for invalid recipient or donor groups', () => {
      expect(isCompatible('INVALID', 'O-')).toBe(false);
      expect(isCompatible('O+', 'INVALID')).toBe(false);
      expect(isCompatible(null, 'O-')).toBe(false);
      expect(isCompatible('O+', undefined)).toBe(false);
    });
  });
});
