/**
 * Blood Compatibility Matrix for Red Blood Cells
 *
 * Rules:
 * Recipient | Compatible Donor Groups
 * O-        | O-
 * O+        | O+, O-
 * A-        | A-, O-
 * A+        | A+, A-, O+, O-
 * B-        | B-, O-
 * B+        | B+, B-, O+, O-
 * AB-       | AB-, A-, B-, O-
 * AB+       | All groups (AB+, AB-, A+, A-, B+, B-, O+, O-)
 */

const BLOOD_GROUPS = Object.freeze([
  'O-',
  'O+',
  'A-',
  'A+',
  'B-',
  'B+',
  'AB-',
  'AB+',
]);

const COMPATIBILITY_MAP = Object.freeze({
  'O-': Object.freeze(['O-']),
  'O+': Object.freeze(['O+', 'O-']),
  'A-': Object.freeze(['A-', 'O-']),
  'A+': Object.freeze(['A+', 'A-', 'O+', 'O-']),
  'B-': Object.freeze(['B-', 'O-']),
  'B+': Object.freeze(['B+', 'B-', 'O+', 'O-']),
  'AB-': Object.freeze(['AB-', 'A-', 'B-', 'O-']),
  'AB+': Object.freeze(['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-']),
});

/**
 * Checks if a string is a valid ABO/Rh blood group.
 * @param {string} bloodGroup
 * @returns {boolean}
 */
function isValidBloodGroup(bloodGroup) {
  return typeof bloodGroup === 'string' && BLOOD_GROUPS.includes(bloodGroup.trim().toUpperCase());
}

/**
 * Returns an array of compatible donor blood groups for a given recipient blood group.
 * @param {string} recipientGroup
 * @returns {string[]}
 */
function compatibleDonorGroups(recipientGroup) {
  if (!isValidBloodGroup(recipientGroup)) {
    throw new Error(`Invalid recipient blood group: "${recipientGroup}". Must be one of: ${BLOOD_GROUPS.join(', ')}`);
  }
  return [...COMPATIBILITY_MAP[recipientGroup.trim().toUpperCase()]];
}

/**
 * Checks whether a specific donor blood group can donate to a specific recipient blood group.
 * @param {string} recipientGroup
 * @param {string} donorGroup
 * @returns {boolean}
 */
function isCompatible(recipientGroup, donorGroup) {
  if (!isValidBloodGroup(recipientGroup) || !isValidBloodGroup(donorGroup)) {
    return false;
  }
  const compatibleDonors = COMPATIBILITY_MAP[recipientGroup.trim().toUpperCase()];
  return compatibleDonors.includes(donorGroup.trim().toUpperCase());
}

module.exports = {
  BLOOD_GROUPS,
  COMPATIBILITY_MAP,
  isValidBloodGroup,
  compatibleDonorGroups,
  isCompatible,
};
