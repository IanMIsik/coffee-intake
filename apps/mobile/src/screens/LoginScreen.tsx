import { ApiError } from "@coffee/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ServerSettings } from "../components/ServerSettings";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { getOrganizationSlug } from "../lib/config";
import type { RootStackParamList } from "../navigation/types";

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
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f7f3ee" }}>
      <Text style={{ fontSize: 22, fontWeight: "600", color: "#5f3a1e", marginBottom: 24 }}>
        Coffee Intake — Staff Login
      </Text>
      <TextInput
        placeholder="Phone number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={{ backgroundColor: "white", borderRadius: 8, padding: 12, marginBottom: 12 }}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ backgroundColor: "white", borderRadius: 8, padding: 12, marginBottom: 12 }}
      />
      {error && <Text style={{ color: "#b3413b", marginBottom: 12 }}>{error}</Text>}
      <TouchableOpacity
        onPress={onSubmit}
        disabled={loading}
        style={{ backgroundColor: "#7a4a26", borderRadius: 8, padding: 14, alignItems: "center" }}
      >
        {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: "white" }}>Sign in</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.navigate("FarmerLogin")}
        style={{ padding: 14, alignItems: "center" }}
      >
        <Text style={{ color: "#7a4a26" }}>Farmer? View your deliveries</Text>
      </TouchableOpacity>
      <ServerSettings />
    </View>
  );
}
