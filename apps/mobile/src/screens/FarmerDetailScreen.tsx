import type { Farmer, Receipt } from "@coffee/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { api } from "../lib/api";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "FarmerDetail">;

export function FarmerDetailScreen({ route, navigation }: Props) {
  const { farmerId, farmerName } = route.params;
  const [farmer, setFarmer] = useState<(Farmer & { receipts: Receipt[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState(false);

  useEffect(() => {
    api
      .getFarmer(farmerId)
      .then(setFarmer)
      .catch(() => setOfflineNotice(true))
      .finally(() => setLoading(false));
  }, [farmerId]);

  return (
    <View style={{ flex: 1, backgroundColor: "#f7f3ee", padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "700", color: "#5f3a1e" }}>{farmerName}</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : (
        <>
          {farmer && (
            <View style={{ backgroundColor: "white", borderRadius: 10, padding: 16, marginVertical: 12 }}>
              <Text style={{ fontSize: 28, fontWeight: "700", color: "#7a4a26" }}>
                {farmer.cumulativeWeightKg} kg
              </Text>
              <Text style={{ color: "#a9764a", fontSize: 12 }}>cumulative cherry delivered</Text>
            </View>
          )}
          {offlineNotice && (
            <Text style={{ color: "#a9764a", marginBottom: 12 }}>
              Offline — showing what's cached. Receipt history will refresh once back online.
            </Text>
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate("RecordReceipt", { farmerId, farmerName })}
            style={{ backgroundColor: "#7a4a26", borderRadius: 8, padding: 14, alignItems: "center", marginBottom: 16 }}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>Record a Receipt</Text>
          </TouchableOpacity>

          <Text style={{ fontWeight: "600", marginBottom: 8 }}>Recent Receipts</Text>
          <FlatList
            data={farmer?.receipts ?? []}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: "white",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text>Receipt #{item.receiptNumber}</Text>
                <Text style={{ fontWeight: "600" }}>{item.weightKg} kg</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={{ color: "#a9764a" }}>No receipts yet.</Text>}
          />
        </>
      )}
    </View>
  );
}
