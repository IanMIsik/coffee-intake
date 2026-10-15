import { ApiError } from "@coffee/shared";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "../../components/Icon";
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-coffee-800 to-coffee-700 px-5">
      <div className="mb-6 flex items-center gap-3 text-white">
        <Logo className="h-11 w-11" />
        <span className="font-display text-xl font-semibold">Coffee Cherry Intake</span>
      </div>
      <div className="card w-full max-w-sm space-y-5 p-7 shadow-pop">
        <div>
          <h1 className="page-title text-2xl">My Deliveries</h1>
          <p className="mt-1 text-sm text-coffee-400">Sign in with the phone number the factory has for you.</p>
        </div>
        {step === "phone" ? (
          <form onSubmit={requestCode} className="space-y-4">
            <div>
              <label className="label">Your phone number</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254712345678"
                inputMode="tel"
                required
              />
            </div>
            {error && <p className="rounded-xl bg-cherry-50 px-3.5 py-2.5 text-sm text-cherry-700">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
              {loading ? "Sending..." : "Send me a code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-sm text-coffee-400">We sent a 6-digit code to {phone} via SMS.</p>
            <input
              className="input text-center text-xl font-semibold tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              inputMode="numeric"
              placeholder="000000"
              required
            />
            {error && <p className="rounded-xl bg-cherry-50 px-3.5 py-2.5 text-sm text-cherry-700">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
              {loading ? "Verifying..." : "Verify"}
            </button>
            <button type="button" onClick={() => setStep("phone")} className="btn-ghost w-full">
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
