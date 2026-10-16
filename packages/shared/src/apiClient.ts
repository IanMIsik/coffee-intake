import type {
  BatchDetail,
  ReceiptDeletion,
  BatchSummary,
  DashboardSummary,
  DayBreakdown,
  FarmerBalance,
  Farmer,
  FarmerAuthResponse,
  Receipt,
  ReceiptWithDetails,
  Settlement,
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
  /** Admin only. */
  pricePerKg?: number;
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

  listFarmers(search?: string, opts: { archived?: boolean } = {}) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (opts.archived) params.set("archived", "true");
    const qs = params.toString();
    return this.request<Farmer[]>(`/farmers${qs ? `?${qs}` : ""}`);
  }

  /** Removes a farmer from the list. Their deliveries and payments are kept. */
  archiveFarmer(id: string) {
    return this.request<Farmer & { balance: FarmerBalance }>(`/farmers/${id}/archive`, { method: "POST" });
  }

  restoreFarmer(id: string) {
    return this.request<Farmer & { balance: FarmerBalance }>(`/farmers/${id}/restore`, { method: "POST" });
  }

  getFarmer(id: string) {
    return this.request<Farmer & { receipts: Receipt[]; balance: FarmerBalance }>(`/farmers/${id}`);
  }

  createFarmer(input: { name: string; phone: string; nationalId?: string | null }) {
    return this.request<Farmer>("/farmers", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getMyFarmerProfile() {
    return this.request<Farmer & { balance: FarmerBalance }>("/farmers/me");
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
    if (payload.pricePerKg !== undefined) {
      form.append("pricePerKg", String(payload.pricePerKg));
    }
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

  adjustReceipt(id: string, input: { weightKg?: number; receiptNumber?: string; pricePerKg?: number | null }) {
    return this.request<Receipt>(`/receipts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  /** Pay for some kilos of one delivery (omit weightKg to pay everything still unpaid on it). */
  recordSettlement(receiptId: string, input: { weightKg?: number; pricePerKg?: number; note?: string }) {
    return this.request<{ settlement: Settlement; receipt: Receipt }>(`/receipts/${receiptId}/settlements`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  voidSettlement(receiptId: string, settlementId: string) {
    return this.request<Receipt>(`/receipts/${receiptId}/settlements/${settlementId}`, { method: "DELETE" });
  }

  /** Pay a farmer for some kilos; applied to their oldest unpaid deliveries first. */
  settleFarmer(farmerId: string, input: { weightKg: number; pricePerKg?: number; note?: string }) {
    return this.request<{ settlements: Settlement[]; balance: FarmerBalance }>(`/farmers/${farmerId}/settlements`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  setFarmerPrice(farmerId: string, pricePerKg: number, scope: "unpriced" | "unsettled" = "unpriced") {
    return this.request<{ updated: number; balance: FarmerBalance }>(`/farmers/${farmerId}/price`, {
      method: "POST",
      body: JSON.stringify({ pricePerKg, scope }),
    });
  }

  /** Admin only. The receipt must have no live payments (void them first). */
  deleteReceipt(id: string, reason: string) {
    return this.request<{ ok: true }>(`/receipts/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) });
  }

  listDeletedReceipts(farmerId?: string) {
    const qs = farmerId ? `?farmerId=${encodeURIComponent(farmerId)}` : "";
    return this.request<ReceiptDeletion[]>(`/receipts/deleted${qs}`);
  }

  listBatches() {
    return this.request<BatchSummary[]>("/batches");
  }

  getBatch(id: string) {
    return this.request<BatchDetail>(`/batches/${id}`);
  }

  /** Publish an agreed price: it applies to everyone's unpaid kilos except farmers in heldFarmerIds. */
  createBatch(input: { pricePerKg: number; name?: string; note?: string; heldFarmerIds?: string[] }) {
    return this.request<BatchDetail>("/batches", { method: "POST", body: JSON.stringify(input) });
  }

  holdFarmerInBatch(batchId: string, farmerId: string, hold: boolean) {
    return this.request<BatchDetail>(`/batches/${batchId}/hold`, {
      method: "POST",
      body: JSON.stringify({ farmerId, hold }),
    });
  }

  applyBatchToNewDeliveries(batchId: string) {
    return this.request<{ pricedReceipts: number; farmers: BatchDetail["farmers"] }>(`/batches/${batchId}/apply`, {
      method: "POST",
    });
  }

  /** Pay under a batch. Omit payments to pay everyone in full; omit weightKg to pay a farmer in full. */
  payBatch(batchId: string, payments?: { farmerId: string; weightKg?: number }[], note?: string) {
    return this.request<{ settlements: number; farmers: BatchDetail["farmers"] }>(`/batches/${batchId}/pay`, {
      method: "POST",
      body: JSON.stringify({ payments, note }),
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
