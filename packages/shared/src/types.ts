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
  settled: boolean;
  settledAt: string | null;
  settledByStaffId: string | null;
  editedAt: string | null;
  editedByStaffId: string | null;
}

export interface ReceiptWithDetails extends Receipt {
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
  range: { from: string; to: string };
  rangeTotals: {
    totalKg: string;
    receiptCount: number;
    farmerCount: number;
    settledKg: string;
    unsettledKg: string;
  };
  dailyBreakdown: DailyTotal[];
  topFarmersInRange: TopFarmer[];
}
