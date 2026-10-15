import type { Farmer } from "@coffee/shared";
import { ApiError } from "@coffee/shared";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, Icon } from "../../components/Icon";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export function FarmerListPage() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const { session } = useAuth();
  const isAdmin = session?.kind === "staff" && session.staff.role === "ADMIN";

  async function load(query?: string) {
    setLoading(true);
    try {
      setFarmers(await api.listFarmers(query, { archived: showRemoved }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load farmers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRemoved]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="page-title">{showRemoved ? "Removed farmers" : "Farmers"}</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="btn-primary"
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
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-coffee-400" />
          <input
            className="input !pl-11"
            placeholder="Search by name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      {isAdmin && (
        <button
          type="button"
          onClick={() => setShowRemoved((v) => !v)}
          className="text-sm font-semibold text-coffee-600 hover:underline"
        >
          {showRemoved ? "← Back to active farmers" : "Show removed farmers"}
        </button>
      )}

      {error && <p className="text-cherry-600 text-sm">{error}</p>}
      {loading ? (
        <p className="text-sm text-coffee-400">Loading...</p>
      ) : (
        <div className="card divide-y divide-coffee-300/60 overflow-hidden">
          {farmers.length === 0 && <p className="p-4 text-sm text-coffee-400">{showRemoved ? "No removed farmers." : "No farmers found."}</p>}
          {farmers.map((f) => (
            <Link
              key={f.id}
              to={`/app/farmers/${f.id}`}
              className="flex items-center justify-between p-4 hover:bg-coffee-50"
            >
              <div className="flex items-center gap-3">
                <Avatar name={f.name} />
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-sm text-coffee-400">{f.phone}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-display text-lg font-semibold text-coffee-700">{f.cumulativeWeightKg} kg</div>
                  <div className="text-xs text-coffee-400">total delivered</div>
                </div>
                <Icon name="chevron" className="h-4 w-4 text-coffee-400" />
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
    <form onSubmit={onSubmit} className="card p-4 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <input
          className="input"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="Phone e.g. +254712345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="National ID (optional)"
          value={nationalId}
          onChange={(e) => setNationalId(e.target.value)}
        />
      </div>
      {error && <p className="text-cherry-600 text-sm">{error}</p>}
      <button disabled={saving} className="btn-primary">
        {saving ? "Saving..." : "Add Farmer"}
      </button>
    </form>
  );
}
