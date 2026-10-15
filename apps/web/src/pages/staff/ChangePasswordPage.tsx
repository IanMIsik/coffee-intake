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
        <h1 className="page-title">My Account</h1>
        <p className="text-sm text-coffee-400">
          {staff.name} · {staff.phone} · {staff.role === "ADMIN" ? "Admin" : "Clerk"}
        </p>
      </div>

      <form onSubmit={onSubmit} className="card p-4 space-y-3">
        <h2 className="font-semibold">Change password</h2>
        <div>
          <label className="label">Current password</label>
          <input
            type="password"
            className="input w-full"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label className="label">New password (8+ characters)</label>
          <input
            type="password"
            className="input w-full"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input
            type="password"
            className="input w-full"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        {error && <p className="text-cherry-600 text-sm">{error}</p>}
        {done && (
          <p className="text-coffee-600 text-sm">
            Password changed. You've been signed out of your other devices.
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="btn-primary"
        >
          {saving ? "Saving..." : "Change password"}
        </button>
      </form>
    </div>
  );
}
