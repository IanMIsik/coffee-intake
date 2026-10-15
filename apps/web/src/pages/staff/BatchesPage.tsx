import type { BatchDetail, BatchSummary } from "@coffee/shared";
import { ApiError, formatKg, formatMoney } from "@coffee/shared";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

export function BatchesPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setBatches(await api.listBatches());
  }
  useEffect(() => {
    refresh();
  }, []);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await api.createBatch({
        pricePerKg: Number(price),
        name: name || undefined,
        note: note || undefined,
      });
      setPrice("");
      setName("");
      setNote("");
      await refresh();
      setOpenId(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not publish the price");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="page-title">Batches &amp; agreed prices</h1>

      <form onSubmit={publish} className="card p-4 space-y-3">
        <div className="font-medium">Publish a new price</div>
        <p className="text-sm text-coffee-400">
          The price applies to every farmer's unpaid kilos straight away, including the unpaid part of partly-paid
          deliveries. Kilos already paid keep the price they were paid at. Afterwards, mark any farmer who wants to
          wait and they go back to unpriced until a later batch.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            required
            className="input"
            placeholder="Price per kg (KES)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <input
            className="input"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && <p className="text-cherry-600 text-sm">{error}</p>}
        <button disabled={saving} className="btn-primary">
          {saving ? "Publishing..." : "Publish price to everyone"}
        </button>
      </form>

      {batches.length === 0 && <p className="text-sm text-coffee-400">No batches yet.</p>}
      <div className="space-y-2">
        {batches.map((b) => (
          <div key={b.id} className="card">
            <button
              type="button"
              className="w-full text-left p-4 flex flex-wrap items-center justify-between gap-2"
              onClick={() => setOpenId(openId === b.id ? null : b.id)}
            >
              <div>
                <div className="font-medium">
                  {b.name} · {formatMoney(b.pricePerKg)}/kg
                </div>
                <div className="text-xs text-coffee-400">
                  {new Date(b.createdAt).toLocaleDateString()}
                  {b.note ? ` · ${b.note}` : ""}
                </div>
              </div>
              <div className="text-sm text-right">
                <div>{formatKg(b.unpaidKg)} unpaid · {b.farmersOwed} farmers</div>
                <div className="text-coffee-400">
                  Paid {formatMoney(b.amountPaid)} · {b.heldCount} waiting
                </div>
              </div>
            </button>
            {openId === b.id && <BatchDetailPanel id={b.id} onChanged={refresh} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function BatchDetailPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [kg, setKg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getBatch(id).then(setBatch);
  }, [id]);

  async function run(action: () => Promise<unknown>, done: string) {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await action();
      setBatch(await api.getBatch(id));
      setMessage(done);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!batch) return <p className="p-4 text-sm text-coffee-400">Loading...</p>;

  const owedFarmers = batch.farmers.filter((f) => Number(f.unpaidKg) > 0);

  return (
    <div className="border-t p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy || owedFarmers.length === 0}
          className="btn-primary"
          onClick={() => {
            if (confirm(`Pay all ${owedFarmers.length} farmers in full for this batch?`))
              run(() => api.payBatch(id), "Paid everyone in full");
          }}
        >
          Pay everyone in full
        </button>
        <button
          disabled={busy}
          className="input !py-1.5 !px-2.5 !text-sm"
          onClick={() =>
            run(async () => {
              const r = await api.applyBatchToNewDeliveries(id);
              setMessage(`${r.pricedReceipts} new deliveries priced`);
            }, "Late deliveries priced")
          }
        >
          Price late deliveries
        </button>
      </div>
      {error && <p className="text-cherry-600 text-sm">{error}</p>}
      {message && <p className="text-coffee-600 text-sm">{message}</p>}

      <div className="divide-y">
        {batch.farmers.map((f) => (
          <div key={f.farmerId} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <Link to={`/app/farmers/${f.farmerId}`} className="font-medium underline">
                {f.name}
              </Link>
              <div className="text-xs text-coffee-400">
                {f.held
                  ? "Waiting for a later batch"
                  : `${formatKg(f.unpaidKg)} unpaid = ${formatMoney(f.amountOwed)} · paid ${formatKg(f.paidKg)} (${formatMoney(f.amountPaid)})`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!f.held && Number(f.unpaidKg) > 0 && (
                <>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="input w-24 !py-1.5 !px-2.5 !text-sm"
                    placeholder="all kg"
                    value={kg[f.farmerId] ?? ""}
                    onChange={(e) => setKg({ ...kg, [f.farmerId]: e.target.value })}
                  />
                  <button
                    disabled={busy}
                    className="btn-primary !px-3 !py-1.5 !text-xs"
                    onClick={() =>
                      run(
                        () =>
                          api.payBatch(id, [
                            { farmerId: f.farmerId, weightKg: kg[f.farmerId] ? Number(kg[f.farmerId]) : undefined },
                          ]),
                        `Paid ${f.name}`
                      ).then(() => setKg({ ...kg, [f.farmerId]: "" }))
                    }
                  >
                    Pay
                  </button>
                </>
              )}
              <button
                disabled={busy}
                className="input !py-1.5 !px-2.5 !text-sm"
                onClick={() => run(() => api.holdFarmerInBatch(id, f.farmerId, !f.held), f.held ? `${f.name} joined` : `${f.name} will wait`)}
              >
                {f.held ? "Join batch" : "Wait"}
              </button>
            </div>
          </div>
        ))}
        {batch.farmers.length === 0 && <p className="py-2 text-sm text-coffee-400">No farmers have unpaid kilos in this batch.</p>}
      </div>
    </div>
  );
}
