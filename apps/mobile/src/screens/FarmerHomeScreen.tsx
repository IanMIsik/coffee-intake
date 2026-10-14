import type { Receipt } from "@coffee/shared";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

export function FarmerHomeScreen() {
  const { session, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMyReceipts()
      .then(setReceipts)
      .finally(() => setLoading(false));
  }, []);

  if (session?.kind !== "farmer") return null;
  const { farmer, organization } = session;

  return (
    <View style={{ flex: 1, backgroundColor: "#f7f3ee" }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 16,
          backgroundColor: "#7a4a26",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>{organization.name}</Text>
        <TouchableOpacity onPress={logout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: "white", fontWeight: "600" }}>Log out</Text>
        </TouchableOpacity>
      </View>

      <View style={{ padding: 16 }}>
        <View style={{ backgroundColor: "white", borderRadius: 12, padding: 20, alignItems: "center" }}>
          <Text style={{ color: "#a9764a", fontSize: 12 }}>Welcome, {farmer.name}</Text>
          <Text style={{ color: "#7a4a26", fontSize: 34, fontWeight: "700", marginTop: 8 }}>
            {farmer.cumulativeWeightKg} kg
          </Text>
          <Text style={{ color: "#a9764a", fontSize: 12, marginTop: 4 }}>
            Total cherry delivered to date
          </Text>
        </View>
      </View>

      <Text style={{ fontWeight: "600", paddingHorizontal: 16, marginBottom: 8 }}>Delivery History</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 10,
                padding: 12,
                marginBottom: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              {item.photoUrl && (
                <Image
                  source={{ uri: api.assetUrl(item.photoUrl) }}
                  style={{ width: 44, height: 44, borderRadius: 6 }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600" }}>Receipt #{item.receiptNumber}</Text>
                <Text style={{ color: "#a9764a", fontSize: 12 }}>
                  {new Date(item.deliveredAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={{ fontWeight: "700" }}>{item.weightKg} kg</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: "#a9764a", marginTop: 24 }}>
              No deliveries yet.
            </Text>
          }
        />
      )}
    </View>
  );
}
