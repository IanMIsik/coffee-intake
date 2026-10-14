import type {
  DashboardSummary,
  DayBreakdown,
  Farmer,
  FarmerAuthResponse,
  Receipt,
  ReceiptWithDetails,
  StaffLoginResponse,
  StaffRole,
  StaffUser,
} from "./types";

/** React Native's FormData accepts this descriptor shape natively for file uploads. */
export interface RNFilePhoto {
  uri: string;
  name: string;
  type: string;
}

/** On web, pass the actual File/Blob selected by an <input type="file">. */
export type ReceiptPhoto = Blob | RNFilePhoto;

export interface CreateReceiptPayload {
  farmerId: string;
  /** Leave undefined/empty to have the server auto-generate one. */
  receiptNumber?: string;
  weightKg: number;
  clientId: string;
  /** ISO timestamp captured client-side; defaults to now if omitted. */
  deliveredAt?: string;
  photo?: ReceiptPhoto | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(message);
  }
}

export interface ApiClientOptions {
  /** A function lets an app change the server address at runtime (the mobile app does). */
  baseUrl: string | (() => string);
  getToken: () => string | null | undefined;
  /**
   * Called when a request that carried a token comes back 401 -- the token expired,
   * or the account was deleted. Lets each app sign the user out.
   */
  onUnauthorized?: () => void;
}

export class CoffeeApiClient {
  constructor(private opts: ApiClientOptions) {}

  /** Turns a relative asset link (e.g. a receipt photo) into one that loads from this server. */
  assetUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    if (!url.startsWith("/")) return url;
    const base = typeof this.opts.baseUrl === "function" ? this.opts.baseUrl() : this.opts.baseUrl;
    return `${base}${url}`;
  }

  private authHeaders(): Record<string, string> {
    const token = this.opts.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async request<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    const baseUrl =
      typeof this.opts.baseUrl === "function" ? this.opts.baseUrl() : this.opts.baseUrl;
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...this.authHeaders(),
        ...(init.headers ?? {}),
      },
    });
    const contentType = res.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await res.json().catch(() => undefined)
      : undefined;
    if (res.status === 401 && this.opts.getToken()) {
      this.opts.onUnauthorized?.();
    }
    if (!res.ok) {
      throw new ApiError(
        res.status,
        (body && (body as any).error) || res.statusText,
        body
      );
    }
    return body as T;
  }

  staffLogin(organizationSlug: string, phone: string, password: string) {
    return this.request<StaffLoginResponse>("/auth/staff/login", {
      method: "POST",
      body: JSON.stringify({ organizationSlug, phone, password }),
    });
  }

  /** Returns a fresh token: the old one is invalidated by the password change. */
  changeMyPassword(currentPassword: string, newPassword: string) {
    return this.request<{ token: string }>("/auth/staff/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  farmerOtpRequest(organizationSlug: string, phone: string) {
    return this.request<{ ok: true }>("/auth/farmer/otp/request", {
      method: "POST",
      body: JSON.stringify({ organizationSlug, phone }),
    });
  }

  farmerOtpVerify(organizationSlug: string, phone: string, code: string) {
    return this.request<FarmerAuthResponse>("/auth/farmer/otp/verify", {
      method: "POST",
      body: JSON.stringify({ organizationSlug, phone, code }),
    });
  }

  listFarmers(search?: string) {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return this.request<Farmer[]>(`/farmers${qs}`);
  }

  getFarmer(id: string) {
    return this.request<Farmer & { receipts: Receipt[] }>(`/farmers/${id}`);
  }

  createFarmer(input: { name: string; phone: string; nationalId?: string | null }) {
    return this.request<Farmer>("/farmers", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getMyFarmerProfile() {
    return this.request<Farmer>("/farmers/me");
  }

  getMyReceipts() {
    return this.request<Receipt[]>("/farmers/me/receipts");
  }

  async createReceipt(payload: CreateReceiptPayload): Promise<Receipt> {
    const form = new FormData();
    form.append("farmerId", payload.farmerId);
    if (payload.receiptNumber) {
      form.append("receiptNumber", payload.receiptNumber);
    }
    form.append("weightKg", String(payload.weightKg));
    form.append("clientId", payload.clientId);
    form.append("deliveredAt", payload.deliveredAt ?? new Date().toISOString());
    if (payload.photo) {
      if (typeof Blob !== "undefined" && payload.photo instanceof Blob) {
        const name = (payload.photo as File).name ?? "receipt.jpg";
        form.append("photo", payload.photo, name);
      } else {
        // React Native FormData convention: {uri, name, type} rather than a real Blob.
        form.append("photo", payload.photo as unknown as Blob);
      }
    }
    return this.request<Receipt>("/receipts", {
      method: "POST",
      body: form,
    });
  }

  listReceipts(farmerId?: string) {
    const qs = farmerId ? `?farmerId=${encodeURIComponent(farmerId)}` : "";
    return this.request<Receipt[]>(`/receipts${qs}`);
  }

  getReceipt(id: string) {
    return this.request<ReceiptWithDetails>(`/receipts/${id}`);
  }

  settleReceipt(id: string, settled: boolean) {
    return this.request<Receipt>(`/receipts/${id}/settle`, {
      method: "PATCH",
      body: JSON.stringify({ settled }),
    });
  }

  adjustReceipt(id: string, input: { weightKg?: number; receiptNumber?: string }) {
    return this.request<Receipt>(`/receipts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  listStaff() {
    return this.request<StaffUser[]>("/staff");
  }

  getDashboardSummary(range?: { from?: string; to?: string }) {
    const params = new URLSearchParams();
    if (range?.from) params.set("from", range.from);
    if (range?.to) params.set("to", range.to);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.request<DashboardSummary>(`/dashboard/summary${qs}`);
  }

  updateStaffRole(id: string, role: StaffRole) {
    return this.request<StaffUser>(`/staff/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  }

  /** Omit `password` to have the server generate one; it is returned once. */
  resetStaffPassword(id: string, password?: string) {
    return this.request<{ ok: true; password: string }>(`/staff/${id}/password`, {
      method: "POST",
      body: JSON.stringify(password ? { password } : {}),
    });
  }

  deleteStaff(id: string) {
    return this.request<{ ok: true }>(`/staff/${id}`, { method: "DELETE" });
  }

  getDashboardDay(date: string) {
    return this.request<DayBreakdown>(`/dashboard/day?date=${encodeURIComponent(date)}`);
  }

  createStaff(input: {
    name: string;
    phone: string;
    email?: string | null;
    password: string;
    role: StaffRole;
  }) {
    return this.request<StaffUser>("/staff", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}
