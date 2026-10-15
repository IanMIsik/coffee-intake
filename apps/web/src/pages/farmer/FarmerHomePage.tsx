import type { FarmerBalance, Receipt } from "@coffee/shared";
import { formatKg, formatMoney, paymentStatus } from "@coffee/shared";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, Logo } from "../../components/Icon";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export function FarmerHomePage() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<FarmerBalance | null>(null);

  useEffect(() => {
    api.getMyFarmerProfile().then((f) => setBalance(f.balance)).catch(() => {});
    api
      .getMyReceipts()
      .then(setReceipts)
      .finally(() => setLoading(false));
  }, []);

  if (session?.kind !== "farmer") return null;
  const { farmer, organization } = session;

  return (
    <div className="min-h-screen pb-10">
      <div className="bg-gradient-to-b from-coffee-800 to-coffee-700 px-5 pb-20 pt-5 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="font-display font-semibold">{organization.name}</span>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/me/login");
            }}
            className="rounded-lg p-2 text-coffee-200 hover:bg-white/10"
            title="Log out"
          >
            <Icon name="logout" />
          </button>
        </div>
        <div className="mx-auto mt-8 max-w-lg">
          <p className="text-sm text-coffee-200/80">Welcome, {farmer.name}</p>
          <p className="mt-2 font-display text-5xl font-semibold">
            {farmer.cumulativeWeightKg}
            <span className="ml-2 text-xl font-medium text-coffee-200/80">kg</span>
          </p>
          <p className="mt-1 text-sm text-coffee-200/70">Total cherry delivered to date</p>
        </div>
      </div>

      <main className="mx-auto -mt-12 max-w-lg space-y-5 px-4">
        {balance && (
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <div className="font-display text-xl font-semibold text-gold-700">{formatMoney(balance.amountOwed)}</div>
              <div className="mt-0.5 text-xs text-coffee-400">still owed to you</div>
              {Number(balance.unpricedKg) > 0 && (
                <div className="mt-1.5 text-xs text-coffee-400">+ {formatKg(balance.unpricedKg)} not priced yet</div>
              )}
            </div>
            <div className="card p-4">
              <div className="font-display text-xl font-semibold text-coffee-600">{formatMoney(balance.amountPaid)}</div>
              <div className="mt-0.5 text-xs text-coffee-400">paid so far</div>
            </div>
          </div>
        )}

        <section>
          <h2 className="mb-2 px-1 text-lg font-semibold text-coffee-800">Delivery history</h2>
          {loading ? (
            <p className="text-sm text-coffee-400">Loading...</p>
          ) : (
            <div className="card divide-y divide-coffee-300/60 overflow-hidden">
              {receipts.length === 0 && <p className="p-4 text-sm text-coffee-400">No deliveries yet.</p>}
              {receipts.map((r) => {
                const status = paymentStatus(r);
                return (
                  <div key={r.id} className="flex items-center gap-3 p-4">
                    {r.photoUrl && (
                      <img
                        src={api.assetUrl(r.photoUrl)}
                        alt="Receipt"
                        className="h-12 w-12 rounded-lg border border-coffee-300 object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">Receipt #{r.receiptNumber}</div>
                      <div className="text-sm text-coffee-400">{new Date(r.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{r.weightKg} kg</div>
                      <span
                        className={status === "paid" ? "badge-green" : status === "partial" ? "badge-amber" : "badge-grey"}
                      >
                        {status === "paid" ? "Paid" : status === "partial" ? `${formatKg(r.settledKg)} paid` : "Not paid yet"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
