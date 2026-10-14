import { ApiError } from "@coffee/shared";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const input = { backgroundColor: "white", borderRadius: 8, padding: 12, marginBottom: 12 } as const;

export function ChangePasswordScreen() {
  const { session, loginStaff } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  if (session?.kind !== "staff") return null;
  const { staff, organization } = session;

  async function onSubmit() {
    setError(null);
    setDone(false);
    if (newPassword.length < 8) {
      setError("The new password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirm) {
      setError("The new passwords don't match");
      return;
    }
    setSaving(true);
    try {
      const { token } = await api.changeMyPassword(currentPassword, newPassword);
      // The old token stops working after a password change; keep this device signed in.
      await loginStaff(token, staff, organization);
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={{ backgroundColor: "#f7f3ee" }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#5f3a1e" }}>{staff.name}</Text>
        <Text style={{ color: "#a9764a", marginBottom: 20 }}>
          {staff.phone} · {staff.role === "ADMIN" ? "Admin" : "Clerk"}
        </Text>

        <Text style={{ fontWeight: "600", marginBottom: 8 }}>Change password</Text>
        <TextInput
          placeholder="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          style={input}
        />
        <TextInput
          placeholder="New password (8+ characters)"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          style={input}
        />
        <TextInput
          placeholder="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          style={input}
        />

        {error && <Text style={{ color: "#b3413b", marginBottom: 12 }}>{error}</Text>}
        {done && (
          <Text style={{ color: "#166534", marginBottom: 12 }}>
            Password changed. You've been signed out of your other devices.
          </Text>
        )}

        <TouchableOpacity
          onPress={onSubmit}
          disabled={saving || !currentPassword || !newPassword}
          style={{
            backgroundColor: "#7a4a26",
            borderRadius: 8,
            padding: 14,
            alignItems: "center",
            opacity: saving || !currentPassword || !newPassword ? 0.5 : 1,
          }}
        >
          {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "600" }}>Change password</Text>}
        </TouchableOpacity>
        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
