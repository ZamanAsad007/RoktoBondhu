const { z } = require('zod');
const eligibilityConfig = require('../config/eligibility.config');

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function calculateAge(dateString) {
  const dob = new Date(dateString);
  if (isNaN(dob.getTime())) return -1;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

const donorProfileSchema = z.object({
  blood_group: z.enum(bloodGroups, {
    errorMap: () => ({ message: `Blood group must be one of: ${bloodGroups.join(', ')}` }),
  }),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
    .refine((dob) => {
      const age = calculateAge(dob);
      return age >= eligibilityConfig.minAge && age <= eligibilityConfig.maxAge;
    }, {
      message: `Donor must be between ${eligibilityConfig.minAge} and ${eligibilityConfig.maxAge} years old`,
    }),
  latitude: z
    .number({ required_error: 'Latitude is required' })
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number({ required_error: 'Longitude is required' })
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  city: z.string().trim().min(1, 'City is required').max(100),
  last_donated_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'last_donated_at must be in YYYY-MM-DD format')
    .nullable()
    .optional()
    .refine((date) => {
      if (!date) return true;
      return new Date(date) <= new Date();
    }, {
      message: 'last_donated_at cannot be in the future',
    }),
  available: z.boolean().optional().default(true),
});

const availabilitySchema = z.object({
  available: z.boolean().optional(),
});

module.exports = {
  bloodGroups,
  donorProfileSchema,
  availabilitySchema,
  calculateAge,
};
