import type { Farmer } from "@coffee/shared";
import { ApiError } from "@coffee/shared";
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";

export function RecordReceiptPage() {
  const [searchParams] = useSearchParams();
  const preselectedFarmerId = searchParams.get("farmerId");
  const navigate = useNavigate();

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Farmer[]>([]);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{ id: string; receiptNumber: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (preselectedFarmerId) {
      api.getFarmer(preselectedFarmerId).then(setFarmer);
    }
  }, [preselectedFarmerId]);

  useEffect(() => {
    if (!search || farmer) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.listFarmers(search).then(setResults);
    }, 250);
    return () => clearTimeout(handle);
  }, [search, farmer]);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!farmer) {
      setError("Select a farmer first");
      return;
    }
    setError(null);
    setLastReceipt(null);
    setSaving(true);
    try {
      const receipt = await api.createReceipt({
        farmerId: farmer.id,
        receiptNumber: receiptNumber || undefined,
        weightKg: Number(weightKg),
        clientId: crypto.randomUUID(),
        deliveredAt: new Date().toISOString(),
        photo: photo ?? undefined,
      });
      setLastReceipt({ id: receipt.id, receiptNumber: receipt.receiptNumber });
      setReceiptNumber("");
      setWeightKg("");
      setPhoto(null);
      setPhotoPreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record receipt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-lg font-semibold text-coffee-700">Record Cherry Receipt</h1>

      {!farmer ? (
        <div className="space-y-2">
          <label className="block text-sm">Find farmer</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Search by name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {results.length > 0 && (
            <div className="bg-white rounded-xl shadow divide-y">
              {results.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFarmer(f)}
                  className="w-full text-left p-3 hover:bg-coffee-50"
                >
                  <div className="font-medium">{f.name}</div>
                  <div className="text-sm text-coffee-400">{f.phone}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
          <div>
            <div className="font-medium">{farmer.name}</div>
            <div className="text-sm text-coffee-400">{farmer.phone}</div>
          </div>
          <button
            type="button"
            className="text-sm underline text-coffee-600"
            onClick={() => setFarmer(null)}
          >
            Change
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="bg-white rounded-xl shadow p-4 space-y-3">
        <div>
          <label className="block text-sm mb-1">Receipt number (optional — leave blank to auto-generate)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={receiptNumber}
            onChange={(e) => setReceiptNumber(e.target.value)}
            placeholder="Leave blank to auto-generate"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Weight (kg)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            className="w-full border rounded px-3 py-2"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Photo of paper receipt</label>
          <input type="file" accept="image/*" capture="environment" onChange={onPhotoChange} />
          {photoPreview && (
            <img src={photoPreview} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded border" />
          )}
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {lastReceipt && (
          <p className="text-green-700 text-sm">
            Receipt #{lastReceipt.receiptNumber} recorded.{" "}
            <a
              href={`/app/receipts/${lastReceipt.id}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              View / print receipt
            </a>
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-coffee-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Receipt"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="text-sm text-coffee-600 underline"
          >
            Back to farmers
          </button>
        </div>
      </form>
    </div>
  );
}
