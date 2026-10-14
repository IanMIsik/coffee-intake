import type { Farmer, Receipt } from "@coffee/shared";
import { ApiError } from "@coffee/shared";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export function FarmerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const isAdmin = session?.kind === "staff" && session.staff.role === "ADMIN";
  const [farmer, setFarmer] = useState<(Farmer & { receipts: Receipt[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function refresh() {
    if (!id) return;
    return api.getFarmer(id).then(setFarmer);
  }

  useEffect(() => {
    setLoading(true);
    Promise.resolve(refresh()).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleSettled(receipt: Receipt) {
    setTogglingId(receipt.id);
    try {
      const updated = await api.settleReceipt(receipt.id, !receipt.settled);
      setFarmer((f) =>
        f ? { ...f, receipts: f.receipts.map((r) => (r.id === updated.id ? updated : r)) } : f
      );
    } finally {
      setTogglingId(null);
    }
  }

  function startEdit(receipt: Receipt) {
    setEditingId(receipt.id);
    setEditWeight(receipt.weightKg);
    setEditNumber(receipt.receiptNumber);
    setEditError(null);
  }

  async function saveEdit(receipt: Receipt) {
    setEditError(null);
    setSaving(true);
    try {
      const changes: { weightKg?: number; receiptNumber?: string } = {};
      if (editWeight !== receipt.weightKg) changes.weightKg = Number(editWeight);
      if (editNumber !== receipt.receiptNumber) changes.receiptNumber = editNumber;
      if (Object.keys(changes).length > 0) {
        await api.adjustReceipt(receipt.id, changes);
        await refresh();
      }
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-coffee-400">Loading...</p>;
  if (!farmer) return <p className="text-sm text-red-600">Farmer not found.</p>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{farmer.name}</h1>
          <p className="text-sm text-coffee-400">{farmer.phone}</p>
          {farmer.nationalId && <p className="text-sm text-coffee-400">ID: {farmer.nationalId}</p>}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-coffee-600">{farmer.cumulativeWeightKg} kg</div>
          <div className="text-xs text-coffee-400">cumulative cherry delivered</div>
        </div>
      </div>

      <Link
        to={`/app/receipts/new?farmerId=${farmer.id}`}
        className="inline-block bg-coffee-600 text-white rounded px-4 py-2 text-sm"
      >
        Record a Receipt for {farmer.name}
      </Link>

      <div>
        <h2 className="font-semibold mb-2">Receipt History</h2>
        <div className="bg-white rounded-xl shadow divide-y">
          {farmer.receipts.length === 0 && <p className="p-4 text-sm text-coffee-400">No receipts yet.</p>}
          {farmer.receipts.map((r) =>
            editingId === r.id ? (
              <div key={r.id} className="p-4 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="border rounded px-2 py-1 text-sm"
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value)}
                    placeholder="Receipt number"
                  />
                  <input
                    className="border rounded px-2 py-1 text-sm"
                    type="number"
                    step="0.1"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    placeholder="Weight (kg)"
                  />
                </div>
                {editError && <p className="text-red-600 text-xs">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(r)}
                    disabled={saving}
                    className="bg-coffee-600 text-white rounded px-3 py-1 text-xs disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs text-coffee-400 underline"
                  >
                    Cancel
                  </button>
                </div>
                {r.editedAt && (
                  <p className="text-xs text-coffee-400">
                    Last adjusted {new Date(r.editedAt).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <div key={r.id} className="flex items-center gap-3 p-4">
                {r.photoUrl && (
                  <img src={api.assetUrl(r.photoUrl)} alt="Receipt" className="w-14 h-14 object-cover rounded border" />
                )}
                <div className="flex-1">
                  <Link to={`/app/receipts/${r.id}`} className="font-medium underline">
                    Receipt #{r.receiptNumber}
                  </Link>
                  <div className="text-sm text-coffee-400">{new Date(r.createdAt).toLocaleString()}</div>
                  {r.editedAt && <div className="text-xs text-amber-600">Adjusted</div>}
                </div>
                <div className="font-semibold">{r.weightKg} kg</div>
                <button
                  onClick={() => startEdit(r)}
                  className="text-xs rounded px-2 py-1 bg-coffee-50 text-coffee-600"
                >
                  Edit
                </button>
                {isAdmin ? (
                  <button
                    onClick={() => toggleSettled(r)}
                    disabled={togglingId === r.id}
                    className={`text-xs rounded px-2 py-1 disabled:opacity-50 ${
                      r.settled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.settled ? "Settled" : "Not settled"}
                  </button>
                ) : (
                  <span
                    className={`text-xs rounded px-2 py-1 ${
                      r.settled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.settled ? "Settled" : "Not settled"}
                  </span>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
