import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, Text, TouchableOpacity, View } from "react-native";
import { discard, listUnsynced, requeue, type PendingReceipt } from "../db/outbox";
import { flushOutbox } from "../sync/syncManager";

export function OutboxScreen() {
  const [items, setItems] = useState<PendingReceipt[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => setItems(listUnsynced()), []);
  useFocusEffect(reload);

  async function retry(item: PendingReceipt) {
    setBusy(true);
    requeue(item.clientId);
    await flushOutbox().catch(() => null);
    reload();
    setBusy(false);
  }

  function confirmDiscard(item: PendingReceipt) {
    Alert.alert(
      "Discard this receipt?",
      `${item.weightKg} kg for ${item.farmerName} will be removed from this phone and never sent. ` +
        "Do this only if it was a mistake or has already been recorded another way.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            discard(item.clientId);
            reload();
          },
        },
      ]
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f7f3ee" }}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.clientId}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          items.length > 0 ? (
            <Text style={{ color: "#5f3a1e", marginBottom: 12 }}>
              These receipts are saved on this phone but not on the server yet. Items marked "Needs attention"
              were refused by the server and will not retry on their own.
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <Text style={{ textAlign: "center", color: "#a9764a", marginTop: 40 }}>
            Everything has been sent. Nothing is waiting.
          </Text>
        }
        renderItem={({ item }) => {
          const rejected = item.status === "error";
          return (
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
                borderLeftWidth: 4,
                borderLeftColor: rejected ? "#b91c1c" : "#d97706",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "600" }}>{item.farmerName || "Farmer"}</Text>
                <Text style={{ fontWeight: "700" }}>{item.weightKg} kg</Text>
              </View>
              <Text style={{ color: "#a9764a", fontSize: 12 }}>
                {new Date(item.createdAt).toLocaleString()}
                {item.receiptNumber ? ` · #${item.receiptNumber}` : ""}
              </Text>
              <Text style={{ marginTop: 6, color: rejected ? "#b91c1c" : "#b45309", fontWeight: "600", fontSize: 12 }}>
                {rejected ? "Needs attention" : "Waiting to send"}
              </Text>
              {item.lastError ? (
                <Text style={{ color: "#5f3a1e", fontSize: 12, marginTop: 2 }}>{item.lastError}</Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => retry(item)}
                  disabled={busy}
                  style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#f7f3ee", opacity: busy ? 0.5 : 1 }}
                >
                  <Text style={{ color: "#7a4a26", fontWeight: "600" }}>Try again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDiscard(item)}
                  disabled={busy}
                  style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#fef2f2" }}
                >
                  <Text style={{ color: "#b91c1c", fontWeight: "600" }}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
