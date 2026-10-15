import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import type { RootStackParamList } from "../navigation/types";
import { useSyncManager } from "../sync/useSyncManager";

export function SyncBadge() {
  const { isOnline, pending, failed, syncing, syncNow } = useSyncManager();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const waiting = pending + failed;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <TouchableOpacity
        onPress={syncNow}
        disabled={syncing}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: isOnline ? "#e4eee7" : "#f3d2d2",
        }}
      >
        {syncing && <ActivityIndicator size="small" />}
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOnline ? "#3f7d5a" : "#b73a2c" }} />
        <Text style={{ fontSize: 12, color: "#1d4d36" }}>
          {isOnline ? "Online" : "Offline"}
          {pending > 0 ? ` · ${pending} pending` : ""}
        </Text>
      </TouchableOpacity>

      {waiting > 0 && (
        <TouchableOpacity
          onPress={() => navigation.navigate("Outbox")}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: failed > 0 ? "#fadad5" : "#f8ecc9",
          }}
        >
          <Text style={{ fontSize: 12, color: failed > 0 ? "#962d22" : "#8a6414", fontWeight: "600" }}>
            {failed > 0 ? `${failed} need attention · Review` : "View waiting receipts"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
