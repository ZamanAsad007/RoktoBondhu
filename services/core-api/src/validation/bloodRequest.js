const { z } = require('zod');
const { BLOOD_GROUPS } = require('../domain/compatibility');

const bangladeshPhoneRegex = /^(?:\+8801|01)[3-9]\d{8}$/;

const createBloodRequestSchema = z.object({
  patient_name: z.string().trim().min(2, 'Patient name must be at least 2 characters').max(100),
  blood_group: z.enum(BLOOD_GROUPS, {
    errorMap: () => ({ message: `Invalid blood group. Must be one of: ${BLOOD_GROUPS.join(', ')}` }),
  }),
  units_needed: z
    .number({ invalid_type_error: 'Units needed must be a number' })
    .int('Units needed must be an integer')
    .min(1, 'Units needed must be at least 1')
    .max(10, 'Units needed cannot exceed 10'),
  hospital_name: z.string().trim().min(2, 'Hospital name must be at least 2 characters').max(200),
  latitude: z
    .number({ invalid_type_error: 'Latitude must be a valid number' })
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number({ invalid_type_error: 'Longitude must be a valid number' })
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  city: z.string().trim().min(1).max(100).optional(),
  urgency: z.enum(['NORMAL', 'URGENT', 'CRITICAL'], {
    errorMap: () => ({ message: 'Urgency must be NORMAL, URGENT, or CRITICAL' }),
  }),
  needed_by: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), { message: 'Invalid needed_by timestamp' })
    .refine((val) => new Date(val).getTime() > Date.now(), {
      message: 'needed_by must be a future date/time',
    }),
  contact_phone: z.string().trim().regex(bangladeshPhoneRegex, {
    message: 'Must be a valid Bangladeshi mobile number (e.g. 01712345678 or +8801712345678)',
  }),
});

module.exports = {
  createBloodRequestSchema,
};
