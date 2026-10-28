const { z } = require('zod');

const registerOrgSchema = z.object({
  orgName: z.string().min(2, 'Organization name must be at least 2 characters'),
  registrationNumber: z.string().optional().nullable(),
  contactEmail: z.string().email('Invalid email address').optional().nullable(),
  contactPhone: z.string().min(10, 'Contact phone must be at least 10 characters').optional().nullable(),
  address: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

const updateInventorySchema = z.object({
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  unitsAvailable: z.number().int().min(0, 'Units available cannot be negative'),
  lowStockThreshold: z.number().int().min(0, 'Low stock threshold cannot be negative').optional().default(5),
});

const createDriveSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional().nullable(),
  venueName: z.string().min(2, 'Venue name is required'),
  address: z.string().min(3, 'Address is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  startTime: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T/)),
  endTime: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T/)),
  capacity: z.number().int().min(1, 'Capacity must be at least 1 donor'),
});

const nearbySearchSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(200).optional().default(15),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
});

module.exports = {
  registerOrgSchema,
  updateInventorySchema,
  createDriveSchema,
  nearbySearchSchema,
};
