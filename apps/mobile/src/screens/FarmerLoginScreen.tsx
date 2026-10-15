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

  const errorBox = error ? (
    <Text style={{ color: colors.cherry, backgroundColor: colors.cherryTint, padding: 12, borderRadius: 12, marginBottom: 12 }}>
      {error}
    </Text>
  ) : null;

  return (
    <AuthShell title="My Deliveries" subtitle="See your cherry kilos and what you are owed.">
      {step === "phone" ? (
        <>
          <TextInput
            placeholder="Your phone number"
            placeholderTextColor={colors.muted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={{ ...input, marginBottom: 12 }}
          />
          {errorBox}
          <Button title="Send me a code" onPress={requestCode} loading={loading} disabled={!phone} />
        </>
      ) : (
        <>
          <Text style={{ color: colors.muted, marginBottom: 12 }}>We sent a 6-digit code to {phone} via SMS.</Text>
          <TextInput
            placeholder="000000"
            placeholderTextColor={colors.muted}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            style={{ ...input, marginBottom: 12, textAlign: "center", letterSpacing: 8, fontSize: 22, fontWeight: "700" }}
          />
          {errorBox}
          <Button title="Verify" onPress={verifyCode} loading={loading} disabled={code.length !== 6} />
          <Button title="Use a different number" variant="ghost" onPress={() => setStep("phone")} style={{ marginTop: 4 }} />
        </>
      )}

      <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 16, alignItems: "center" }}>
        <Text style={{ color: colors.muted }}>Staff? Sign in instead</Text>
      </TouchableOpacity>
      <ServerSettings />
    </AuthShell>
  );
}
