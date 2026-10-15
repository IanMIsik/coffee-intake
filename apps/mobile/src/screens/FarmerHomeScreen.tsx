import type { FarmerBalance, Receipt } from "@coffee/shared";
import { formatKg, formatMoney, paymentStatus } from "@coffee/shared";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo, Pill } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { card, colors } from "../theme";

export function FarmerHomeScreen() {
  const { session, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<FarmerBalance | null>(null);

  useEffect(() => {
    api.getMyFarmerProfile().then((f) => setBalance(f.balance)).catch(() => {});
    api
      .getMyReceipts()
      .then(setReceipts)
      .finally(() => setLoading(false));
  }, []);

  if (session?.kind !== "farmer") return null;
  const { farmer, organization } = session;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 64,
          backgroundColor: colors.primaryDeep,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Logo size={30} />
            <Text style={{ color: "white", fontWeight: "700" }}>{organization.name}</Text>
          </View>
          <TouchableOpacity onPress={logout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: "#cfe0d5", fontWeight: "600" }}>Log out</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: "#cfe0d5", marginTop: 24 }}>Welcome, {farmer.name}</Text>
        <Text style={{ color: "white", fontSize: 44, fontWeight: "800", marginTop: 4 }}>
          {farmer.cumulativeWeightKg}
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#cfe0d5" }}> kg</Text>
        </Text>
        <Text style={{ color: "#cfe0d5", fontSize: 13 }}>Total cherry delivered to date</Text>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: -40 }}>
        {balance && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ ...card, flex: 1, padding: 14 }}>
              <Text style={{ color: colors.gold, fontSize: 20, fontWeight: "800" }}>{formatMoney(balance.amountOwed)}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>still owed to you</Text>
              {Number(balance.unpricedKg) > 0 && (
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                  + {formatKg(balance.unpricedKg)} not priced yet
                </Text>
              )}
            </View>
            <View style={{ ...card, flex: 1, padding: 14 }}>
              <Text style={{ color: colors.primary, fontSize: 20, fontWeight: "800" }}>{formatMoney(balance.amountPaid)}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>paid so far</Text>
            </View>
          </View>
        )}
      </View>

      <Text style={{ fontWeight: "800", fontSize: 17, color: colors.primaryDark, paddingHorizontal: 20, marginTop: 20, marginBottom: 10 }}>
        Delivery history
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          renderItem={({ item }) => {
            const status = paymentStatus(item);
            return (
              <View style={{ ...card, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
                {item.photoUrl && (
                  <Image
                    source={{ uri: api.assetUrl(item.photoUrl) }}
                    style={{ width: 46, height: 46, borderRadius: 10 }}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", color: colors.ink }}>Receipt #{item.receiptNumber}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {new Date(item.deliveredAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={{ fontWeight: "800", color: colors.ink }}>{item.weightKg} kg</Text>
                  <Pill
                    tone={status === "paid" ? "green" : status === "partial" ? "gold" : "grey"}
                    text={status === "paid" ? "Paid" : status === "partial" ? `${formatKg(item.settledKg)} paid` : "Not paid yet"}
                  />
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: colors.muted, marginTop: 24 }}>No deliveries yet.</Text>
          }
        />
      )}
    </View>
  );
}
