import { ApiError } from "@coffee/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Text, TextInput, TouchableOpacity } from "react-native";
import { AuthShell, Button } from "../components/ui";
import { ServerSettings } from "../components/ServerSettings";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { getOrganizationSlug } from "../lib/config";
import type { RootStackParamList } from "../navigation/types";
import { colors, input } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { loginStaff } = useAuth();

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.staffLogin(getOrganizationSlug(), phone, password);
      await loginStaff(res.token, res.staff, res.organization);
      // No manual navigation here: RootNavigator (App.tsx) swaps to the
      // authenticated screen stack automatically once `session` updates, and
      // this stack doesn't have a "FarmerList" route while Login is showing.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to record and manage deliveries.">
      <TextInput
        placeholder="Phone number"
        placeholderTextColor={colors.muted}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={{ ...input, marginBottom: 12 }}
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor={colors.muted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ ...input, marginBottom: 12 }}
      />
      {error && (
        <Text style={{ color: colors.cherry, backgroundColor: colors.cherryTint, padding: 12, borderRadius: 12, marginBottom: 12 }}>
          {error}
        </Text>
      )}
      <Button title="Sign in" onPress={onSubmit} loading={loading} />
      <TouchableOpacity onPress={() => navigation.navigate("FarmerLogin")} style={{ padding: 16, alignItems: "center" }}>
        <Text style={{ color: colors.primary, fontWeight: "600" }}>Farmer? View your deliveries</Text>
      </TouchableOpacity>
      <ServerSettings />
    </AuthShell>
  );
}
