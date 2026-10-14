import type { StaffRole, StaffUser } from "@coffee/shared";
import { ApiError } from "@coffee/shared";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

export function StaffScreen() {
  const { session } = useAuth();
  const myId = session?.kind === "staff" ? session.staff.id : null;
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetResult, setResetResult] = useState<{ id: string; password: string } | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      setError(null);
      api
        .listStaff()
        .then(setStaff)
        .catch(() => setError("Couldn't load staff. Check your connection."))
        .finally(() => setLoading(false));
    }, [])
  );

  async function changeRole(member: StaffUser, role: StaffRole) {
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

  function confirmRoleChange(member: StaffUser) {
    const next: StaffRole = member.role === "ADMIN" ? "CLERK" : "ADMIN";
    Alert.alert(
      `Make ${member.name} a ${next === "ADMIN" ? "admin" : "clerk"}?`,
      next === "ADMIN"
        ? "Admins can manage staff, see the dashboard and settle receipts."
        : "They will lose access to the dashboard, staff management and settlement.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Change role", onPress: () => changeRole(member, next) },
      ]
    );
  }

  function confirmDelete(member: StaffUser) {
    Alert.alert(
      `Delete ${member.name}?`,
      "They will be signed out immediately and lose access. Receipts they recorded keep their name.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
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
          },
        },
      ]
    );
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#f7f3ee" }}>
      {error && <Text style={{ color: "#b3413b", padding: 12 }}>{error}</Text>}
      <FlatList
        data={staff}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => {
          const isMe = item.id === myId;
          const busy = busyId === item.id;
          return (
            <View style={{ backgroundColor: "white", borderRadius: 12, padding: 14, marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600" }}>
                    {item.name}
                    {isMe ? "  (you)" : ""}
                  </Text>
                  <Text style={{ color: "#a9764a", fontSize: 12 }}>{item.phone}</Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: item.role === "ADMIN" ? "#7a4a26" : "#ede2d3",
                  }}
                >
                  <Text style={{ color: item.role === "ADMIN" ? "white" : "#5f3a1e", fontSize: 12, fontWeight: "600" }}>
                    {item.role === "ADMIN" ? "Admin" : "Clerk"}
                  </Text>
                </View>
              </View>
              {!isMe && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <TouchableOpacity
                    onPress={() => confirmRoleChange(item)}
                    disabled={busy}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 8,
                      alignItems: "center",
                      backgroundColor: "#f7f3ee",
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: "#7a4a26", fontWeight: "600" }}>
                      {item.role === "ADMIN" ? "Make clerk" : "Make admin"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDelete(item)}
                    disabled={busy}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 8,
                      alignItems: "center",
                      backgroundColor: "#fef2f2",
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: "#b91c1c", fontWeight: "600" }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                onPress={() => {
                  setResetResult(null);
                  setNewPassword("");
                  setResettingId(resettingId === item.id ? null : item.id);
                }}
                style={{ marginTop: 8, padding: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#f7f3ee" }}
              >
                <Text style={{ color: "#7a4a26", fontWeight: "600" }}>Reset password</Text>
              </TouchableOpacity>

              {resettingId === item.id && (
                <View style={{ marginTop: 8, backgroundColor: "#f7f3ee", borderRadius: 8, padding: 10 }}>
                  <Text style={{ color: "#5f3a1e", fontSize: 12, marginBottom: 8 }}>
                    Type a new password (8+ characters), or leave it blank to generate a strong one.
                    {isMe ? " You'll be signed out." : " They'll be signed out everywhere."}
                  </Text>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="New password (optional)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ backgroundColor: "white", borderRadius: 8, padding: 10, marginBottom: 8 }}
                  />
                  <TouchableOpacity
                    onPress={() => submitReset(item)}
                    disabled={busy || (newPassword.length > 0 && newPassword.length < 8)}
                    style={{
                      backgroundColor: "#7a4a26",
                      borderRadius: 8,
                      padding: 10,
                      alignItems: "center",
                      opacity: busy || (newPassword.length > 0 && newPassword.length < 8) ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "600" }}>
                      {newPassword ? "Set password" : "Generate & set"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {resetResult?.id === item.id && (
                <View style={{ marginTop: 8, backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", borderWidth: 1, borderRadius: 8, padding: 10 }}>
                  <Text style={{ color: "#166534", fontSize: 12 }}>
                    Password updated for {item.name}. Give them this password; it won't be shown again:
                  </Text>
                  <Text selectable style={{ fontFamily: "Courier", fontSize: 20, fontWeight: "700", marginVertical: 6 }}>
                    {resetResult.password}
                  </Text>
                  <TouchableOpacity onPress={() => setResetResult(null)}>
                    <Text style={{ color: "#a9764a", textDecorationLine: "underline", fontSize: 12 }}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}
