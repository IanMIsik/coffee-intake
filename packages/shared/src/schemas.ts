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
});
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;

export const settleReceiptSchema = z.object({
  settled: z.boolean(),
});
export type SettleReceiptInput = z.infer<typeof settleReceiptSchema>;

export const adjustReceiptSchema = z.object({
  weightKg: z.coerce.number().positive("Weight must be greater than 0").optional(),
  receiptNumber: z.string().trim().min(1).optional(),
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
