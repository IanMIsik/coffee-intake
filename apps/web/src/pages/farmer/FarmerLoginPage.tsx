import { ApiError } from "@coffee/shared";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api, ORGANIZATION_SLUG } from "../../lib/api";

export function FarmerLoginPage() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { loginFarmer } = useAuth();
  const navigate = useNavigate();

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.farmerOtpRequest(ORGANIZATION_SLUG, phone);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.farmerOtpVerify(ORGANIZATION_SLUG, phone, code);
      loginFarmer(res.token, res.farmer, res.organization);
      navigate("/me");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow p-6 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-coffee-700">My Deliveries</h1>
        {step === "phone" ? (
          <form onSubmit={requestCode} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Your phone number</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254712345678"
                required
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-coffee-600 text-white rounded py-2 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send me a code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-sm text-coffee-400">
              We sent a 6-digit code to {phone} via SMS.
            </p>
            <input
              className="w-full border rounded px-3 py-2 tracking-widest text-center"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              placeholder="000000"
              required
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-coffee-600 text-white rounded py-2 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="w-full text-sm text-coffee-600 underline"
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
