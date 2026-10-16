import type { Farmer, FarmerBalance, Receipt, ReceiptDeletion, ReceiptWithDetails } from "@coffee/shared";
import { ApiError, formatKg, formatMoney, paymentStatus } from "@coffee/shared";
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar } from "../../components/Icon";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

type FarmerView = Farmer & { receipts: Receipt[]; balance: FarmerBalance };

const STATUS_STYLE = {
  paid: "bg-coffee-100 text-coffee-700",
  partial: "bg-sky-100 text-sky-700",
  unpaid: "bg-gold-100 text-gold-700",
} as const;

function errorText(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function FarmerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();
  const isAdmin = session?.kind === "staff" && session.staff.role === "ADMIN";
  const [farmer, setFarmer] = useState<FarmerView | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  function refresh() {
    if (!id) return Promise.resolve();
    return api.getFarmer(id).then(setFarmer);
  }

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <p className="text-sm text-coffee-400">Loading...</p>;
  if (!farmer) return <p className="text-sm text-cherry-600">Farmer not found.</p>;
  const b = farmer.balance;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <Avatar name={farmer.name} className="h-14 w-14 text-lg" />
            <div>
            <h1 className="page-title">{farmer.name}</h1>
            <p className="text-sm text-coffee-400">{farmer.phone}</p>
            {farmer.nationalId && <p className="text-sm text-coffee-400">ID: {farmer.nationalId}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl font-semibold text-coffee-700">{formatKg(b.deliveredKg)}</div>
            <div className="text-xs text-coffee-400">delivered in total</div>
          </div>
        </div>

        <div className={`mt-4 grid grid-cols-2 gap-3 text-center ${isAdmin ? "sm:grid-cols-4" : ""}`}>
          <div className="rounded-xl bg-coffee-50 p-3">
            <div className="font-semibold">{formatKg(b.settledKg)}</div>
            <div className="text-xs text-coffee-400">paid for</div>
          </div>
          <div className="rounded-xl bg-gold-100/60 p-3">
            <div className="font-semibold text-gold-700">{formatKg(b.unsettledKg)}</div>
            <div className="text-xs text-gold-700">not yet paid for</div>
          </div>
          {isAdmin && (
            <>
              <div className="rounded-xl bg-gold-100/60 p-3">
                <div className="font-semibold text-gold-700">{formatMoney(b.amountOwed)}</div>
                <div className="text-xs text-gold-700">owed</div>
              </div>
              <div className="rounded-xl bg-coffee-100/70 p-3">
                <div className="font-semibold text-coffee-600">{formatMoney(b.amountPaid)}</div>
                <div className="text-xs text-coffee-600">paid so far</div>
              </div>
            </>
          )}
        </div>
        {isAdmin && Number(b.unpricedKg) > 0 && (
          <p className="mt-3 text-xs text-gold-700">
            {formatKg(b.unpricedKg)} unpaid has no price yet, so it isn't counted in the amount owed.
            {isAdmin ? " Set a price below." : " Ask an admin to set the price."}
          </p>
        )}
      </div>

      {farmer.archivedAt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-500/30 bg-gold-100/60 p-4">
          <p className="text-sm text-gold-700">
            <strong>Removed from the farmers list</strong> on {new Date(farmer.archivedAt).toLocaleDateString()}. Their
            deliveries and payments are kept on record, but they can't sign in or receive new deliveries.
          </p>
          {isAdmin && (
            <button
              className="btn-primary"
              onClick={async () => {
                try {
                  await api.restoreFarmer(farmer.id);
                  setNotice(`${farmer.name} is back on the farmers list.`);
                  await refresh();
                } catch (err) {
                  setNotice(errorText(err, "Could not restore this farmer"));
                }
              }}
            >
              Restore farmer
            </button>
          )}
        </div>
      )}

      {notice && (
        <p className="rounded-lg bg-coffee-100/70 border border-coffee-300 border-coffee-200 px-3 py-2 text-sm text-coffee-700">{notice}</p>
      )}

      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2">
          <PayFarmerPanel
            farmer={farmer}
            onDone={async (msg) => {
              setNotice(msg);
              await refresh();
            }}
          />
          <PricePanel
            farmer={farmer}
            onDone={async (msg) => {
              setNotice(msg);
              await refresh();
            }}
          />
        </div>
      )}

      {!farmer.archivedAt && (
        <Link to={`/app/receipts/new?farmerId=${farmer.id}`} className="btn-primary inline-block">
          Record a Receipt for {farmer.name}
        </Link>
      )}

      <div>
        <h2 className="font-display text-lg font-semibold text-coffee-800 mb-2">Deliveries</h2>
        <div className="card divide-y divide-coffee-300/60 overflow-hidden">
          {farmer.receipts.length === 0 && <p className="p-4 text-sm text-coffee-400">No receipts yet.</p>}
          {farmer.receipts.map((r) => (
            <ReceiptRow key={r.id} receipt={r} isAdmin={isAdmin} onChanged={refresh} />
          ))}
        </div>
        {isAdmin && <DeletedRecords farmerId={farmer.id} refreshKey={farmer.receipts.length} />}

        {isAdmin && !farmer.archivedAt && (
          <div className="mt-6 flex justify-end">
            <button
              className="btn-secondary !text-cherry-600 !border-cherry-100 hover:!bg-cherry-50"
              onClick={async () => {
                const owed = Number(b.unsettledKg) > 0 ? ` They still have ${formatKg(b.unsettledKg)} unpaid (${formatMoney(b.amountOwed)} owed); you can still pay it from the archive.` : "";
                if (!confirm(`Remove ${farmer.name} from the farmers list?${owed}

Nothing is deleted: all their deliveries and payments stay on record, and you can restore them later.`)) return;
                try {
                  await api.archiveFarmer(farmer.id);
                  navigate("/app");
                } catch (err) {
                  setNotice(errorText(err, "Could not remove this farmer"));
                }
              }}
            >
              Remove from farmers list
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PayFarmerPanel({ farmer, onDone }: { farmer: FarmerView; onDone: (message: string) => Promise<void> }) {
  const unpaid = Number(farmer.balance.unsettledKg);
  const [kg, setKg] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const kilos = Number(kg);
  const unit = Number(price);
  const preview = kilos > 0 && unit > 0 ? formatMoney(kilos * unit) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await api.settleFarmer(farmer.id, {
        weightKg: kilos,
        pricePerKg: unit > 0 ? unit : undefined,
        note: note || undefined,
      });
      setKg("");
      setPrice("");
      setNote("");
      await onDone(
        `Recorded payment for ${formatKg(kilos)} across ${res.settlements.length} ` +
          `${res.settlements.length === 1 ? "delivery" : "deliveries"}. ${formatMoney(res.balance.amountOwed)} still owed.`
      );
    } catch (err) {
      setError(errorText(err, "Couldn't record the payment"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-4 space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-coffee-800">Record a payment</h2>
        <p className="text-xs text-coffee-400">
          For kilos you have sold. Applied to the oldest unpaid deliveries first.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Kilos paid for</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={unpaid}
            className="input w-full !py-1.5 !px-2.5 !text-sm"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder={`up to ${unpaid}`}
            required
          />
        </div>
        <div>
          <label className="label">Price per kg (KES)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input w-full !py-1.5 !px-2.5 !text-sm"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="each delivery's own"
          />
        </div>
      </div>
      <input
        className="input w-full !py-1.5 !px-2.5 !text-sm"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional), e.g. Lot 3 sold, M-Pesa ref"
        maxLength={200}
      />
      {preview && <p className="text-sm text-coffee-600">Amount: <strong>{preview}</strong></p>}
      {unit <= 0 && kilos > 0 && (
        <p className="text-xs text-coffee-400">
          No price entered: each delivery is paid at its own agreed price (no amount is recorded for deliveries without one).
        </p>
      )}
      {error && <p className="text-cherry-600 text-sm">{error}</p>}
      <button
        disabled={saving || unpaid <= 0 || !(kilos > 0)}
        className="btn-primary"
      >
        {saving ? "Saving..." : "Record payment"}
      </button>
      {unpaid <= 0 && <p className="text-xs text-coffee-400">Nothing unpaid for this farmer.</p>}
    </form>
  );
}

function PricePanel({ farmer, onDone }: { farmer: FarmerView; onDone: (message: string) => Promise<void> }) {
  const [price, setPrice] = useState("");
  const [scope, setScope] = useState<"unpriced" | "unsettled">("unpriced");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await api.setFarmerPrice(farmer.id, Number(price), scope);
      setPrice("");
      await onDone(`Price set on ${res.updated} ${res.updated === 1 ? "delivery" : "deliveries"}.`);
    } catch (err) {
      setError(errorText(err, "Couldn't set the price"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-4 space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-coffee-800">Agreed price</h2>
        <p className="text-xs text-coffee-400">Set the price per kg on this farmer's deliveries. You can also change one delivery below.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          className="input !py-1.5 !px-2.5 !text-sm"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="KES per kg"
          required
        />
        <select
          className="input !py-1.5 !px-2.5 !text-sm"
          value={scope}
          onChange={(e) => setScope(e.target.value as "unpriced" | "unsettled")}
        >
          <option value="unpriced">Deliveries with no price</option>
          <option value="unsettled">All unpaid deliveries</option>
        </select>
      </div>
      {scope === "unsettled" && (
        <p className="text-xs text-gold-700">This overwrites prices already set on unpaid deliveries. Paid ones are not touched.</p>
      )}
      {error && <p className="text-cherry-600 text-sm">{error}</p>}
      <button disabled={saving || !(Number(price) > 0)} className="btn-primary">
        {saving ? "Saving..." : "Set price"}
      </button>
    </form>
  );
}

function ReceiptRow({ receipt: r, isAdmin, onChanged }: { receipt: Receipt; isAdmin: boolean; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<"view" | "edit" | "pay" | "history" | "delete">("view");
  const [deleteReason, setDeleteReason] = useState("");
  const [detail, setDetail] = useState<ReceiptWithDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [number, setNumber] = useState(r.receiptNumber);
  const [weight, setWeight] = useState(r.weightKg);
  const [price, setPrice] = useState(r.pricePerKg ?? "");
  const [payKg, setPayKg] = useState("");
  const [payPrice, setPayPrice] = useState("");
  const [payNote, setPayNote] = useState("");

  const status = paymentStatus(r);
  const remaining = Number(r.weightKg) - Number(r.settledKg);
  const value = r.pricePerKg ? Number(r.weightKg) * Number(r.pricePerKg) : null;

  function open(next: typeof mode) {
    setError(null);
    setMode(next === mode ? "view" : next);
    if (next === "history") api.getReceipt(r.id).then(setDetail);
    if (next === "edit") {
      setNumber(r.receiptNumber);
      setWeight(r.weightKg);
      setPrice(r.pricePerKg ?? "");
    }
    if (next === "delete") setDeleteReason("");
    if (next === "pay") {
      setPayKg(String(remaining));
      setPayPrice(r.pricePerKg ?? "");
      setPayNote("");
    }
  }

  async function run(action: () => Promise<unknown>, fallback: string) {
    setError(null);
    setSaving(true);
    try {
      await action();
      setMode("view");
      await onChanged();
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      setSaving(false);
    }
  }

  const saveEdit = () =>
    run(async () => {
      const changes: { weightKg?: number; receiptNumber?: string; pricePerKg?: number | null } = {};
      if (weight !== r.weightKg) changes.weightKg = Number(weight);
      if (number !== r.receiptNumber) changes.receiptNumber = number;
      if (isAdmin && price !== (r.pricePerKg ?? "")) changes.pricePerKg = price === "" ? null : Number(price);
      if (Object.keys(changes).length > 0) await api.adjustReceipt(r.id, changes);
    }, "Failed to save changes");

  const pay = () =>
    run(
      () =>
        api.recordSettlement(r.id, {
          weightKg: Number(payKg),
          pricePerKg: Number(payPrice) > 0 ? Number(payPrice) : undefined,
          note: payNote || undefined,
        }),
      "Couldn't record the payment"
    );

  const voidPayment = (settlementId: string) =>
    run(async () => {
      await api.voidSettlement(r.id, settlementId);
      setDetail(await api.getReceipt(r.id));
      setMode("history");
    }, "Couldn't void the payment");

  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        {r.photoUrl && <img src={api.assetUrl(r.photoUrl)} alt="Receipt" className="w-14 h-14 object-cover rounded border border-coffee-300" />}
        <div className="flex-1 min-w-0">
          <Link to={`/app/receipts/${r.id}`} className="font-medium underline">
            Receipt #{r.receiptNumber}
          </Link>
          <div className="text-sm text-coffee-400">{new Date(r.deliveredAt).toLocaleString()}</div>
          <div className="text-xs text-coffee-400">
            {isAdmin && (r.pricePerKg ? `${formatMoney(r.pricePerKg)}/kg · worth ${formatMoney(value)}` : "No price set")}
            {r.editedAt && <span className="ml-2 text-amber-600">Adjusted</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold">{formatKg(r.weightKg)}</div>
          <span className={`inline-block mt-1 text-xs rounded px-2 py-0.5 ${STATUS_STYLE[status]}`}>
            {status === "paid" ? "Paid" : status === "partial" ? `${formatKg(r.settledKg)} paid` : "Not paid"}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <button onClick={() => open("edit")} className="btn !px-2.5 !py-1.5 !text-xs bg-coffee-100 text-coffee-700 hover:bg-coffee-200">Edit</button>
        {isAdmin && remaining > 0 && (
          <button onClick={() => open("pay")} className="btn-primary !px-3 !py-1.5 !text-xs">Pay</button>
        )}
        {Number(r.settledKg) > 0 && (
          <button onClick={() => open("history")} className="btn !px-2.5 !py-1.5 !text-xs bg-coffee-100 text-coffee-700 hover:bg-coffee-200">Payments</button>
        )}
        {isAdmin && (
          <button onClick={() => open("delete")} className="btn !px-2.5 !py-1.5 !text-xs bg-cherry-50 text-cherry-700 hover:bg-cherry-100">Delete</button>
        )}
      </div>

      {mode === "delete" && (
        <div className="mt-3 space-y-2 rounded-lg bg-cherry-50 p-3">
          {Number(r.settledKg) > 0 ? (
            <p className="text-xs text-cherry-700">
              This delivery has payments recorded. Open <strong>Payments</strong> and void them first, then delete it.
            </p>
          ) : (
            <>
              <p className="text-xs text-cherry-700">
                Use this for a record entered by mistake. It is removed from the farmer's total and the day's totals, but a
                copy is kept in the deleted-records list with your name and the reason.
              </p>
              <input
                className="input w-full !py-1.5 !px-2.5 !text-sm"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Reason (e.g. entered twice, wrong farmer)"
                maxLength={200}
              />
            </>
          )}
          {error && <p className="text-cherry-600 text-xs">{error}</p>}
          <div className="flex gap-2">
            {Number(r.settledKg) === 0 && (
              <button
                onClick={() => run(() => api.deleteReceipt(r.id, deleteReason), "Couldn't delete this record")}
                disabled={saving || deleteReason.trim().length < 3}
                className="btn-danger !px-3 !py-1.5 !text-xs"
              >
                {saving ? "Deleting..." : "Delete record"}
              </button>
            )}
            <button onClick={() => setMode("view")} className="text-xs text-coffee-400 underline">Cancel</button>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <div className="mt-3 rounded-lg bg-coffee-50 p-3 space-y-2">
          <div className={`grid gap-2 ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
            <input className="input !py-1.5 !px-2.5 !text-sm" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Receipt number" />
            <input className="input !py-1.5 !px-2.5 !text-sm" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Weight (kg)" />
            {isAdmin && (
              <input className="input !py-1.5 !px-2.5 !text-sm" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price per kg" />
            )}
          </div>
          {Number(r.settledKg) > 0 && (
            <p className="text-xs text-coffee-400">{formatKg(r.settledKg)} is already paid, so the weight can't go below that.</p>
          )}
          {error && <p className="text-cherry-600 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={saving} className="btn-primary !px-3 !py-1.5 !text-xs">{saving ? "Saving..." : "Save"}</button>
            <button onClick={() => setMode("view")} className="text-xs text-coffee-400 underline">Cancel</button>
          </div>
        </div>
      )}

      {mode === "pay" && (
        <div className="mt-3 rounded-lg bg-coffee-50 p-3 space-y-2">
          <p className="text-xs text-coffee-600">{formatKg(remaining)} of this delivery is unpaid.</p>
          <div className="grid grid-cols-2 gap-2">
            <input className="input !py-1.5 !px-2.5 !text-sm" type="number" step="0.01" min="0" max={remaining} value={payKg} onChange={(e) => setPayKg(e.target.value)} placeholder="Kilos" />
            <input className="input !py-1.5 !px-2.5 !text-sm" type="number" step="0.01" min="0" value={payPrice} onChange={(e) => setPayPrice(e.target.value)} placeholder="Price per kg" />
          </div>
          <input className="input w-full !py-1.5 !px-2.5 !text-sm" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Note (optional)" maxLength={200} />
          {Number(payKg) > 0 && Number(payPrice) > 0 && (
            <p className="text-sm">Amount: <strong>{formatMoney(Number(payKg) * Number(payPrice))}</strong></p>
          )}
          {error && <p className="text-cherry-600 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button onClick={pay} disabled={saving || !(Number(payKg) > 0)} className="btn-primary !px-3 !py-1.5 !text-xs">{saving ? "Saving..." : "Record payment"}</button>
            <button onClick={() => setMode("view")} className="text-xs text-coffee-400 underline">Cancel</button>
          </div>
        </div>
      )}

      {mode === "history" && (
        <div className="mt-3 rounded-lg bg-coffee-50 p-3 space-y-2">
          {!detail ? (
            <p className="text-xs text-coffee-400">Loading...</p>
          ) : (
            detail.settlements.map((s) => (
              <div key={s.id} className={`flex items-center justify-between gap-2 text-sm ${s.voidedAt ? "opacity-50 line-through" : ""}`}>
                <div>
                  <div>
                    {formatKg(s.weightKg)}
                    {s.amount ? ` · ${formatMoney(s.amount)}` : " · no amount recorded"}
                  </div>
                  <div className="text-xs text-coffee-400 no-underline">
                    {new Date(s.createdAt).toLocaleString()}
                    {s.note ? ` · ${s.note}` : ""}
                    {s.voidedAt ? " · voided" : ""}
                  </div>
                </div>
                {isAdmin && !s.voidedAt && (
                  <button
                    onClick={() => window.confirm("Void this payment? It stays in the record but no longer counts.") && voidPayment(s.id)}
                    className="btn !px-2.5 !py-1.5 !text-xs bg-cherry-50 text-cherry-700 hover:bg-cherry-100"
                  >
                    Void
                  </button>
                )}
              </div>
            ))
          )}
          {error && <p className="text-cherry-600 text-xs">{error}</p>}
          <button onClick={() => setMode("view")} className="text-xs text-coffee-400 underline">Close</button>
        </div>
      )}
    </div>
  );
}

function DeletedRecords({ farmerId, refreshKey }: { farmerId: string; refreshKey: number }) {
  const [rows, setRows] = useState<ReceiptDeletion[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.listDeletedReceipts(farmerId).then(setRows).catch(() => setRows([]));
  }, [farmerId, refreshKey]);

  if (rows.length === 0) return null;
  return (
    <div className="mt-5">
      <button onClick={() => setOpen((v) => !v)} className="text-sm font-semibold text-coffee-600 hover:underline">
        {open ? "Hide" : "Show"} deleted records ({rows.length})
      </button>
      {open && (
        <div className="card mt-2 divide-y divide-coffee-300/60 overflow-hidden">
          {rows.map((d) => (
            <div key={d.id} className="p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-medium">
                  Receipt #{d.receiptNumber} · {formatKg(d.weightKg)}
                </span>
                <span className="text-xs text-coffee-400">{new Date(d.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-xs text-coffee-400">
                Delivered {new Date(d.deliveredAt).toLocaleDateString()}
                {d.recordedByName ? ` · recorded by ${d.recordedByName}` : ""} · deleted by {d.deletedByName}
              </div>
              <div className="text-xs text-cherry-700">Reason: {d.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
