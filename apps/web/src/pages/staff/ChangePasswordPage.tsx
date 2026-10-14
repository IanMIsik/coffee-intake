import { ApiError } from "@coffee/shared";
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export function ChangePasswordPage() {
  const { session, loginStaff } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  if (session?.kind !== "staff") return null;
  const { staff, organization } = session;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (newPassword !== confirm) {
      setError("The new passwords don't match");
      return;
    }
    setSaving(true);
    try {
      const { token } = await api.changeMyPassword(currentPassword, newPassword);
      // The old token stops working after a password change; keep this device signed in.
      loginStaff(token, staff, organization);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-coffee-700">My Account</h1>
        <p className="text-sm text-coffee-400">
          {staff.name} · {staff.phone} · {staff.role === "ADMIN" ? "Admin" : "Clerk"}
        </p>
      </div>

      <form onSubmit={onSubmit} className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">Change password</h2>
        <div>
          <label className="block text-sm mb-1">Current password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">New password (8+ characters)</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Confirm new password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {done && (
          <p className="text-green-700 text-sm">
            Password changed. You've been signed out of your other devices.
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="bg-coffee-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "Saving..." : "Change password"}
        </button>
      </form>
    </div>
  );
}
