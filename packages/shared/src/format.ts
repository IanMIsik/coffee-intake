/** Kilos, e.g. "1,204.5 kg". Accepts the numeric strings the API returns. */
export function formatKg(value: string | number | null | undefined): string {
  return `${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
}

/** Money, e.g. "KES 12,400". Amounts are always in the organization's currency (Kenya shillings for now). */
export function formatMoney(value: string | number | null | undefined, currency = "KES"): string {
  return `${currency} ${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** How much of a delivery has been paid for. */
export function paymentStatus(r: { weightKg: string; settledKg: string }): "paid" | "partial" | "unpaid" {
  const weight = Number(r.weightKg);
  const settled = Number(r.settledKg);
  if (settled >= weight && weight > 0) return "paid";
  return settled > 0 ? "partial" : "unpaid";
}
