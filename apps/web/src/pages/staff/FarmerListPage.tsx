import type { Farmer } from "@coffee/shared";
import { ApiError } from "@coffee/shared";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

export function FarmerListPage() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load(query?: string) {
    setLoading(true);
    try {
      setFarmers(await api.listFarmers(query));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load farmers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-coffee-700">Farmers</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="bg-coffee-600 text-white rounded px-3 py-1.5 text-sm"
        >
          {showCreate ? "Cancel" : "+ New Farmer"}
        </button>
      </div>

      {showCreate && (
        <CreateFarmerForm
          onCreated={() => {
            setShowCreate(false);
            load(search);
          }}
        />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(search);
        }}
        className="flex gap-2"
      >
        <input
          className="flex-1 border rounded px-3 py-2"
          placeholder="Search by name or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="border border-coffee-600 text-coffee-600 rounded px-3">
          Search
        </button>
      </form>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading ? (
        <p className="text-sm text-coffee-400">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl shadow divide-y">
          {farmers.length === 0 && <p className="p-4 text-sm text-coffee-400">No farmers found.</p>}
          {farmers.map((f) => (
            <Link
              key={f.id}
              to={`/app/farmers/${f.id}`}
              className="flex items-center justify-between p-4 hover:bg-coffee-50"
            >
              <div>
                <div className="font-medium">{f.name}</div>
                <div className="text-sm text-coffee-400">{f.phone}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{f.cumulativeWeightKg} kg</div>
                <div className="text-xs text-coffee-400">total delivered</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateFarmerForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createFarmer({ name, phone, nationalId: nationalId || null });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create farmer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl shadow p-4 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <input
          className="border rounded px-3 py-2"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Phone e.g. +254712345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="National ID (optional)"
          value={nationalId}
          onChange={(e) => setNationalId(e.target.value)}
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button disabled={saving} className="bg-coffee-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50">
        {saving ? "Saving..." : "Add Farmer"}
      </button>
    </form>
  );
}
