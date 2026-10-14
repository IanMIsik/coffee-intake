import type { Receipt } from "@coffee/shared";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export function FarmerHomePage() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMyReceipts()
      .then(setReceipts)
      .finally(() => setLoading(false));
  }, []);

  if (session?.kind !== "farmer") return null;
  const { farmer, organization } = session;

  return (
    <div className="min-h-screen">
      <header className="bg-coffee-700 text-white px-4 py-3 flex items-center justify-between">
        <div className="font-semibold">{organization.name}</div>
        <button
          onClick={() => {
            logout();
            navigate("/me/login");
          }}
          className="text-sm hover:underline"
        >
          Log out
        </button>
      </header>
      <main className="p-4 max-w-lg mx-auto space-y-4">
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <p className="text-sm text-coffee-400">Welcome, {farmer.name}</p>
          <p className="text-4xl font-bold text-coffee-600 mt-2">{farmer.cumulativeWeightKg} kg</p>
          <p className="text-xs text-coffee-400 mt-1">Total cherry delivered to date</p>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Delivery History</h2>
          {loading ? (
            <p className="text-sm text-coffee-400">Loading...</p>
          ) : (
            <div className="bg-white rounded-xl shadow divide-y">
              {receipts.length === 0 && <p className="p-4 text-sm text-coffee-400">No deliveries yet.</p>}
              {receipts.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-4">
                  {r.photoUrl && (
                    <img src={api.assetUrl(r.photoUrl)} alt="Receipt" className="w-12 h-12 object-cover rounded border" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">Receipt #{r.receiptNumber}</div>
                    <div className="text-sm text-coffee-400">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="font-semibold">{r.weightKg} kg</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
