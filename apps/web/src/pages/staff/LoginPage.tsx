import { ApiError } from "@coffee/shared";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "../../components/Icon";
import { useAuth } from "../../context/AuthContext";
import { api, ORGANIZATION_SLUG } from "../../lib/api";

export function StaffLoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { loginStaff } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.staffLogin(ORGANIZATION_SLUG, phone, password);
      loginStaff(res.token, res.staff, res.organization);
      navigate("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-coffee-800 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-coffee-600/40" />
        <div className="absolute -left-16 bottom-10 h-72 w-72 rounded-full bg-cherry-600/25" />
        <div className="relative flex items-center gap-3">
          <Logo className="h-11 w-11" />
          <span className="font-display text-xl font-semibold">Coffee Cherry Intake</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Every kilo recorded. Every farmer paid fairly.
          </h2>
          <p className="mt-4 text-coffee-200/80">
            Deliveries, receipts, batches and payments in one place, built for the factory floor.
          </p>
        </div>
        <div className="relative text-sm text-coffee-200/60">Richard Misik Estate</div>
      </div>

      <div className="flex min-h-screen items-center justify-center px-5 py-10 lg:min-h-0">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="mb-2 flex items-center gap-3 lg:hidden">
            <Logo className="h-10 w-10" />
            <span className="font-display text-lg font-semibold text-coffee-800">Coffee Cherry Intake</span>
          </div>
          <div>
            <h1 className="page-title text-3xl">Welcome back</h1>
            <p className="mt-1 text-sm text-coffee-400">Sign in with your staff account.</p>
          </div>
          <div>
            <label className="label">Phone number</label>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254700000001"
              inputMode="tel"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="rounded-xl bg-cherry-50 px-3.5 py-2.5 text-sm text-cherry-700">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <p className="text-center text-sm text-coffee-400">
            Are you a farmer?{" "}
            <a href="/me/login" className="font-semibold text-coffee-600 hover:underline">
              View your deliveries
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
