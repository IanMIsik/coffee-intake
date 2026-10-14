import { ApiError } from "@coffee/shared";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="bg-white rounded-xl shadow p-6 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-coffee-700">Staff Login</h1>
        <div>
          <label className="block text-sm mb-1">Phone number</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+254700000001"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-coffee-600 text-white rounded py-2 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <p className="text-xs text-coffee-400 text-center">
          Farmer?{" "}
          <a href="/me/login" className="underline">
            Log in to view your deliveries
          </a>
        </p>
      </form>
    </div>
  );
}
