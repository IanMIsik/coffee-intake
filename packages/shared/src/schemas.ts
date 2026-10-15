import { z } from "zod";

const DEFAULT_COUNTRY_CODE = "254";

/**
 * Turns the ways people type a number (0712345678, 254712345678, +254 712 345 678,
 * 00254...) into one international form, so lookups and SMS delivery always agree.
 * Local numbers starting with 0 are assumed to be Kenyan (+254).
 */
export function normalizePhone(input: string): string {
  const compact = input.replace(/[\s\-().]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("0")) return `+${DEFAULT_COUNTRY_CODE}${compact.slice(1)}`;
  if (compact.startsWith(DEFAULT_COUNTRY_CODE) && compact.length >= 12) return `+${compact}`;
  return `+${DEFAULT_COUNTRY_CODE}${compact}`;
}

export const phoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine((v) => /^\+[0-9]{9,15}$/.test(v), "Enter a valid phone number, e.g. +254712345678");

export const staffLoginSchema = z.object({
  organizationSlug: z.string().min(1),
  phone: phoneSchema,
  password: z.string().min(1, "Password is required"),
});
export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

export const otpRequestSchema = z.object({
  phone: phoneSchema,
  organizationSlug: z.string().min(1),
});
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  organizationSlug: z.string().min(1),
  code: z.string().length(6),
});
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

export const createFarmerSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  phone: phoneSchema,
  nationalId: z.string().trim().optional().nullable(),
});
export type CreateFarmerInput = z.infer<typeof createFarmerSchema>;

export const createStaffUserSchema = z.object({
  name: z.string().trim().min(2),
  phone: phoneSchema,
  email: z.string().email().optional().nullable(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "CLERK"]),
});
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "New password must be different from your current one",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const resetStaffPasswordSchema = z.object({
  // Leave out to have the server generate a strong temporary password.
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});
export type ResetStaffPasswordInput = z.infer<typeof resetStaffPasswordSchema>;

export const updateStaffRoleSchema = z.object({
  role: z.enum(["ADMIN", "CLERK"]),
});
export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>;

export const createReceiptSchema = z.object({
  farmerId: z.string().min(1),
  // Leave blank to have the server auto-generate one (e.g. DF-000123).
  receiptNumber: z.string().trim().min(1).optional(),
  weightKg: z.coerce.number().positive("Weight must be greater than 0"),
  clientId: z.string().uuid(),
  // ISO timestamp set by the client at capture time (see schema.prisma Receipt.deliveredAt).
  deliveredAt: z.coerce.date(),
  // Agreed price per kg. Admin only; a clerk's request that includes one is refused.
  pricePerKg: z.coerce.number().positive("Price must be greater than 0").optional(),
});
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;

const money = (label: string) => z.coerce.number().positive(`${label} must be greater than 0`);

/** Legacy on/off switch, kept so older app versions still work: true settles what is left. */
export const settleReceiptSchema = z.object({
  settled: z.boolean(),
});
export type SettleReceiptInput = z.infer<typeof settleReceiptSchema>;

/** Pay for some kilos of one delivery. Omit weightKg to pay everything still unpaid on it. */
export const recordSettlementSchema = z.object({
  weightKg: money("Kilos").optional(),
  // Omit to use the delivery's agreed price.
  pricePerKg: money("Price").optional(),
  note: z.string().trim().max(200).optional(),
});
export type RecordSettlementInput = z.infer<typeof recordSettlementSchema>;

/** Pay a farmer for some kilos; applied to their oldest unpaid deliveries first. */
export const farmerSettlementSchema = z.object({
  weightKg: money("Kilos"),
  pricePerKg: money("Price").optional(),
  note: z.string().trim().max(200).optional(),
});
export type FarmerSettlementInput = z.infer<typeof farmerSettlementSchema>;

/** Set the agreed price on a farmer's deliveries in one go. */
export const farmerPriceSchema = z.object({
  pricePerKg: money("Price"),
  // "unpriced": only deliveries with no price yet. "unsettled": also overwrite prices on unpaid deliveries.
  scope: z.enum(["unpriced", "unsettled"]).default("unpriced"),
});
export type FarmerPriceInput = z.infer<typeof farmerPriceSchema>;

/**
 * Publish an agreed price. It is applied to every farmer's unpaid kilos straight away, except
 * farmers listed in heldFarmerIds who chose to wait for a later batch.
 */
export const createBatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  pricePerKg: money("Price"),
  note: z.string().trim().max(200).optional(),
  heldFarmerIds: z.array(z.string().uuid()).max(5000).optional(),
});
export type CreateBatchInput = z.infer<typeof createBatchSchema>;

/** Pay under a batch. Omit payments to pay every farmer's full unpaid share; omit weightKg to pay a farmer in full. */
export const payBatchSchema = z.object({
  payments: z
    .array(z.object({ farmerId: z.string().uuid(), weightKg: money("Kilos").optional() }))
    .max(5000)
    .optional(),
  note: z.string().trim().max(200).optional(),
});
export type PayBatchInput = z.infer<typeof payBatchSchema>;

export const holdFarmerSchema = z.object({
  farmerId: z.string().uuid(),
  hold: z.boolean(),
});
export type HoldFarmerInput = z.infer<typeof holdFarmerSchema>;

export const adjustReceiptSchema = z.object({
  weightKg: z.coerce.number().positive("Weight must be greater than 0").optional(),
  receiptNumber: z.string().trim().min(1).optional(),
  // null clears the price. Admin only.
  pricePerKg: z.coerce.number().positive("Price must be greater than 0").nullable().optional(),
});
export type AdjustReceiptInput = z.infer<typeof adjustReceiptSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  smsSenderName: z.string().trim().min(1).max(11),
  adminName: z.string().trim().min(2),
  adminPhone: phoneSchema,
  adminPassword: z.string().min(8),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
