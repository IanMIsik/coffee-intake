export type StaffRole = "ADMIN" | "CLERK";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  smsSenderName: string;
  createdAt: string;
}

export interface StaffUser {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  email: string | null;
  role: StaffRole;
  createdAt: string;
}

export interface Farmer {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  nationalId: string | null;
  photoUrl: string | null;
  cumulativeWeightKg: string;
  createdAt: string;
  /** Set when the farmer was removed from the list; their records are kept. */
  archivedAt?: string | null;
}

export interface Receipt {
  id: string;
  organizationId: string;
  farmerId: string;
  receiptNumber: string;
  weightKg: string;
  photoUrl: string | null;
  recordedByStaffId: string;
  clientId: string;
  deliveredAt: string;
  createdAt: string;
  /** Agreed price per kg (null until an admin sets one). */
  pricePerKg: string | null;
  /** Kilos paid for so far; the receipt is settled when this equals weightKg. */
  settledKg: string;
  settled: boolean;
  settledAt: string | null;
  settledByStaffId: string | null;
  editedAt: string | null;
  editedByStaffId: string | null;
}

export interface Settlement {
  id: string;
  receiptId: string;
  farmerId: string;
  weightKg: string;
  pricePerKg: string | null;
  amount: string | null;
  note: string | null;
  recordedByStaffId: string;
  createdAt: string;
  voidedAt: string | null;
}

/** What a farmer is owed, summed over their deliveries. Amounts are in the organization's currency. */
export interface FarmerBalance {
  deliveredKg: string;
  settledKg: string;
  unsettledKg: string;
  /** Unpaid kilos that have a price, times that price. */
  amountOwed: string;
  /** Unpaid kilos that have no price yet, so no amount can be worked out for them. */
  unpricedKg: string;
  /** Money recorded as paid (voided payments excluded). */
  amountPaid: string;
}

export interface ReceiptWithDetails extends Receipt {
  settlements: Settlement[];
  farmer: Farmer;
  organization: Organization;
  recordedByStaff: { id: string; name: string };
}

export interface AuthTokenPayload {
  token: string;
}

export interface StaffLoginResponse extends AuthTokenPayload {
  staff: StaffUser;
  organization: Organization;
}

export interface FarmerAuthResponse extends AuthTokenPayload {
  farmer: Farmer;
  organization: Organization;
}

export interface DailyTotal {
  date: string; // YYYY-MM-DD
  totalKg: string;
  receiptCount: number;
  farmerCount: number;
}

export interface TopFarmer {
  farmerId: string;
  name: string;
  phone: string;
  totalKg: string;
}

export interface UnsettledFarmer {
  farmerId: string;
  name: string;
  phone: string;
  unsettledKg: string;
  amountOwed: string;
  receiptCount: number;
}

export interface DayFarmerBreakdown {
  farmerId: string;
  name: string;
  phone: string;
  receiptCount: number;
  totalKg: string;
  settledKg: string;
}

export interface DayBreakdown {
  date: string; // YYYY-MM-DD
  totalKg: string;
  settledKg: string;
  receiptCount: number;
  farmerCount: number;
  farmers: DayFarmerBreakdown[];
}

export interface DashboardSummary {
  /** Today's calendar date (YYYY-MM-DD) in the organization's time zone. */
  today: string;
  timezone: string;
  totalFarmers: number;
  totalKgAllTime: string;
  todayKg: string;
  todayReceiptCount: number;
  todayFarmerCount: number;
  yesterdayKg: string;
  unsettledFarmers: UnsettledFarmer[];
  unsettledKgAllTime: string;
  unsettledReceiptCount: number;
  /** Unpaid kilos that have a price, times that price. */
  amountOwed: string;
  /** Unpaid kilos with no price yet. */
  unpricedKg: string;
  range: { from: string; to: string };
  rangeTotals: {
    totalKg: string;
    receiptCount: number;
    farmerCount: number;
    settledKg: string;
    unsettledKg: string;
    /** Money recorded as paid on dates inside the range. */
    amountPaid: string;
  };
  dailyBreakdown: DailyTotal[];
  topFarmersInRange: TopFarmer[];
}

/** A delivery record an admin deleted; kept for accountability. */
export interface ReceiptDeletion {
  id: string;
  receiptNumber: string;
  farmerId: string;
  farmerName: string;
  weightKg: string;
  deliveredAt: string;
  recordedByName: string | null;
  deletedByName: string;
  reason: string;
  createdAt: string;
}

/** An agreed price for a lot of cherry, applied to everyone's unpaid kilos except farmers who wait. */
export interface Batch {
  id: string;
  name: string;
  pricePerKg: string;
  note: string | null;
  heldFarmerIds: string[];
  createdAt: string;
}

export interface BatchSummary extends Batch {
  unpaidKg: string;
  farmersOwed: number;
  heldCount: number;
  paidKg: string;
  amountPaid: string;
}

export interface BatchFarmerRow {
  farmerId: string;
  name: string;
  phone: string;
  held: boolean;
  unpaidKg: string;
  amountOwed: string;
  paidKg: string;
  amountPaid: string;
}

export interface BatchDetail extends Batch {
  farmers: BatchFarmerRow[];
  pricedReceipts?: number;
}
