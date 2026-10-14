import { ApiError } from "@coffee/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ServerSettings } from "../components/ServerSettings";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { getOrganizationSlug } from "../lib/config";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "FarmerLogin">;

export function FarmerLoginScreen({ navigation }: Props) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { loginFarmer } = useAuth();

  async function requestCode() {
    setError(null);
    setLoading(true);
    try {
      await api.farmerOtpRequest(getOrganizationSlug(), phone);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.farmerOtpVerify(getOrganizationSlug(), phone, code);
      await loginFarmer(res.token, res.farmer, res.organization);
      // No manual navigation: RootNavigator swaps to the farmer stack once
      // `session` updates.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f7f3ee" }}>
      <Text style={{ fontSize: 22, fontWeight: "600", color: "#5f3a1e", marginBottom: 24 }}>
        My Deliveries
      </Text>

      {step === "phone" ? (
        <>
          <TextInput
            placeholder="Your phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={{ backgroundColor: "white", borderRadius: 8, padding: 12, marginBottom: 12 }}
          />
          {error && <Text style={{ color: "#b3413b", marginBottom: 12 }}>{error}</Text>}
          <TouchableOpacity
            onPress={requestCode}
            disabled={loading || !phone}
            style={{ backgroundColor: "#7a4a26", borderRadius: 8, padding: 14, alignItems: "center", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: "white" }}>Send me a code</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={{ color: "#a9764a", marginBottom: 12 }}>
            We sent a 6-digit code to {phone} via SMS.
          </Text>
          <TextInput
            placeholder="000000"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            style={{
              backgroundColor: "white",
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
              textAlign: "center",
              letterSpacing: 4,
            }}
          />
          {error && <Text style={{ color: "#b3413b", marginBottom: 12 }}>{error}</Text>}
          <TouchableOpacity
            onPress={verifyCode}
            disabled={loading || code.length !== 6}
            style={{ backgroundColor: "#7a4a26", borderRadius: 8, padding: 14, alignItems: "center", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: "white" }}>Verify</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep("phone")} style={{ padding: 14, alignItems: "center" }}>
            <Text style={{ color: "#7a4a26" }}>Use a different number</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 14, alignItems: "center" }}>
        <Text style={{ color: "#a9764a" }}>Staff? Sign in instead</Text>
      </TouchableOpacity>
      <ServerSettings />
    </View>
  );
}
