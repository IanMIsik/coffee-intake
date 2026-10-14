import type { StaffRole, StaffUser } from "@coffee/shared";
import { ApiError } from "@coffee/shared";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export function StaffUsersPage() {
  const { session } = useAuth();
  const myId = session?.kind === "staff" ? session.staff.id : null;
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetResult, setResetResult] = useState<{ id: string; password: string } | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setStaff(await api.listStaff());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function changeRole(member: StaffUser, role: StaffRole) {
    if (role === member.role) return;
    setError(null);
    setBusyId(member.id);
    try {
      const updated = await api.updateStaffRole(member.id, role);
      setStaff((list) => list.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change role");
    } finally {
      setBusyId(null);
    }
  }

  async function submitReset(member: StaffUser) {
    setError(null);
    setBusyId(member.id);
    try {
      const res = await api.resetStaffPassword(member.id, newPassword || undefined);
      setResetResult({ id: member.id, password: res.password });
      setResettingId(null);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reset password");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(member: StaffUser) {
    if (
      !window.confirm(
        `Delete ${member.name}? They will be signed out immediately and lose access. ` +
          `Receipts they recorded keep their name.`
      )
    ) {
      return;
    }
    setError(null);
    setBusyId(member.id);
    try {
      await api.deleteStaff(member.id);
      setStaff((list) => list.filter((s) => s.id !== member.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete account");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-coffee-700">Staff Accounts</h1>
      <CreateStaffForm onCreated={refresh} />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading ? (
        <p className="text-sm text-coffee-400">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl shadow divide-y">
          {staff.map((s) => {
            const isMe = s.id === myId;
            return (
              <div key={s.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {s.name}
                    {isMe && <span className="ml-2 text-xs text-coffee-400">(you)</span>}
                  </div>
                  <div className="text-sm text-coffee-400">{s.phone}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setResetResult(null);
                      setNewPassword("");
                      setResettingId(resettingId === s.id ? null : s.id);
                    }}
                    className="text-xs rounded px-2 py-1 bg-coffee-50 text-coffee-600 hover:bg-coffee-100"
                  >
                    Reset password
                  </button>
                  <select
                    className="border rounded px-2 py-1 text-sm disabled:opacity-50"
                    value={s.role}
                    disabled={isMe || busyId === s.id}
                    title={isMe ? "You can't change your own role" : "Change role"}
                    onChange={(e) => changeRole(s, e.target.value as StaffRole)}
                  >
                    <option value="CLERK">Clerk</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  {!isMe && (
                    <button
                      onClick={() => remove(s)}
                      disabled={busyId === s.id}
                      className="text-xs rounded px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {resettingId === s.id && (
                <div className="mt-3 rounded-lg bg-coffee-50 p-3 space-y-2">
                  <p className="text-xs text-coffee-600">
                    Type a new password (8+ characters), or leave it blank to generate a strong one.
                    {isMe ? " You'll be signed out and need to sign in again." : " They'll be signed out everywhere."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="border rounded px-2 py-1 text-sm flex-1 min-w-[180px]"
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (optional)"
                      autoComplete="off"
                    />
                    <button
                      onClick={() => submitReset(s)}
                      disabled={busyId === s.id || (newPassword.length > 0 && newPassword.length < 8)}
                      className="bg-coffee-600 text-white rounded px-3 py-1 text-sm disabled:opacity-50"
                    >
                      {newPassword ? "Set password" : "Generate & set"}
                    </button>
                    <button
                      onClick={() => setResettingId(null)}
                      className="text-sm text-coffee-400 underline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {resetResult?.id === s.id && (
                <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
                  <div className="text-green-800">
                    Password updated for {s.name}. Give them this password; it won't be shown again:
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="rounded bg-white px-2 py-1 font-mono text-base border">
                      {resetResult.password}
                    </code>
                    <button
                      onClick={() => navigator.clipboard?.writeText(resetResult.password)}
                      className="text-xs underline text-green-800"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => setResetResult(null)}
                      className="text-xs underline text-coffee-400"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateStaffForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("CLERK");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createStaff({ name, phone, password, role });
      setName("");
      setPhone("");
      setPassword("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create staff account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl shadow p-4 space-y-3">
      <div className="grid sm:grid-cols-4 gap-3">
        <input
          className="border rounded px-3 py-2"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <input
          type="password"
          className="border rounded px-3 py-2"
          placeholder="Temp password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <select
          className="border rounded px-3 py-2"
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
        >
          <option value="CLERK">Clerk</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button disabled={saving} className="bg-coffee-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50">
        {saving ? "Saving..." : "Add Staff Account"}
      </button>
    </form>
  );
}
