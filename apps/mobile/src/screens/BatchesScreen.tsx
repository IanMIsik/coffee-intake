import type { BatchDetail, BatchSummary } from "@coffee/shared";
import { ApiError, formatKg, formatMoney } from "@coffee/shared";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../lib/api";

const BROWN = "#2b6a4b";
const card = { backgroundColor: "white", borderRadius: 16, padding: 14, marginBottom: 10 } as const;
const input = { borderWidth: 1, borderColor: "#d9cfc3", borderRadius: 12, padding: 10, backgroundColor: "white" } as const;

export function BatchesScreen() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBatches(await api.listBatches());
    } catch {
      setError("Couldn't load batches. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  function publish() {
    const value = Number(price);
    if (!(value > 0)) {
      setError("Enter a price greater than 0");
      return;
    }
    Alert.alert(
      `Set ${formatMoney(value)}/kg for everyone?`,
      "This prices all unpaid kilos now. You can mark farmers who want to wait afterwards.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: async () => {
            setError(null);
            setSaving(true);
            try {
              const created = await api.createBatch({ pricePerKg: value, name: name.trim() || undefined });
              setPrice("");
              setName("");
              await refresh();
              setOpenId(created.id);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Could not publish the price");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f6f2ea" }} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
      <View style={card}>
        <Text style={{ fontWeight: "700", marginBottom: 4 }}>Publish a new price</Text>
        <Text style={{ color: "#7b7266", fontSize: 12, marginBottom: 8 }}>
          Applies to everyone's unpaid kilos, including the unpaid part of partly-paid deliveries. Paid kilos keep their price.
        </Text>
        <TextInput style={input} placeholder="Price per kg (KES)" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
        <TextInput style={{ ...input, marginTop: 8 }} placeholder="Name (optional)" value={name} onChangeText={setName} />
        {error && <Text style={{ color: "#b73a2c", marginTop: 8 }}>{error}</Text>}
        <TouchableOpacity
          onPress={publish}
          disabled={saving}
          style={{ backgroundColor: BROWN, borderRadius: 14, padding: 12, alignItems: "center", marginTop: 10, opacity: saving ? 0.5 : 1 }}
        >
          {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "700" }}>Publish price to everyone</Text>}
        </TouchableOpacity>
      </View>

      {batches.length === 0 && <Text style={{ color: "#7b7266", textAlign: "center" }}>No batches yet.</Text>}
      {batches.map((b) => (
        <View key={b.id} style={card}>
          <TouchableOpacity onPress={() => setOpenId(openId === b.id ? null : b.id)}>
            <Text style={{ fontWeight: "700" }}>
              {b.name} · {formatMoney(b.pricePerKg)}/kg
            </Text>
            <Text style={{ color: "#7b7266", fontSize: 12 }}>
              {new Date(b.createdAt).toLocaleDateString()} · {formatKg(b.unpaidKg)} unpaid · {b.farmersOwed} farmers
            </Text>
            <Text style={{ color: "#7b7266", fontSize: 12 }}>
              Paid {formatMoney(b.amountPaid)} · {b.heldCount} waiting
            </Text>
          </TouchableOpacity>
          {openId === b.id && <BatchDetailPanel id={b.id} onChanged={refresh} />}
        </View>
      ))}
    </ScrollView>
  );
}

function BatchDetailPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [kg, setKg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.getBatch(id).then(setBatch).catch(() => setError("Couldn't load this batch"));
    }, [id])
  );

  async function run(action: () => Promise<unknown>, done: string) {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await action();
      setBatch(await api.getBatch(id));
      setMessage(done);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!batch) return <ActivityIndicator style={{ marginTop: 12 }} />;
  const owed = batch.farmers.filter((f) => !f.held && Number(f.unpaidKg) > 0);

  return (
    <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 10 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          disabled={busy || owed.length === 0}
          onPress={() =>
            Alert.alert(`Pay all ${owed.length} farmers in full?`, "Records a payment for every unpaid kilo in this batch.", [
              { text: "Cancel", style: "cancel" },
              { text: "Pay", onPress: () => run(() => api.payBatch(id), "Paid everyone in full") },
            ])
          }
          style={{ flex: 1, backgroundColor: BROWN, borderRadius: 12, padding: 10, alignItems: "center", opacity: busy || owed.length === 0 ? 0.5 : 1 }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>Pay everyone</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={busy}
          onPress={() =>
            run(async () => {
              await api.applyBatchToNewDeliveries(id);
            }, "Late deliveries priced")
          }
          style={{ flex: 1, borderColor: BROWN, borderWidth: 1, borderRadius: 12, padding: 10, alignItems: "center" }}
        >
          <Text style={{ color: BROWN, fontWeight: "600" }}>Price late deliveries</Text>
        </TouchableOpacity>
      </View>
      {error && <Text style={{ color: "#b73a2c", marginTop: 8 }}>{error}</Text>}
      {message && <Text style={{ color: "#2f7a3b", marginTop: 8 }}>{message}</Text>}

      {batch.farmers.map((f) => (
        <View key={f.farmerId} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1ebe4" }}>
          <Text style={{ fontWeight: "600" }}>{f.name}</Text>
          <Text style={{ color: "#7b7266", fontSize: 12 }}>
            {f.held
              ? "Waiting for a later batch"
              : `${formatKg(f.unpaidKg)} unpaid = ${formatMoney(f.amountOwed)} · paid ${formatKg(f.paidKg)} (${formatMoney(f.amountPaid)})`}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6, alignItems: "center" }}>
            {!f.held && Number(f.unpaidKg) > 0 && (
              <>
                <TextInput
                  style={{ ...input, width: 90, padding: 6 }}
                  placeholder="all kg"
                  keyboardType="decimal-pad"
                  value={kg[f.farmerId] ?? ""}
                  onChangeText={(t) => setKg({ ...kg, [f.farmerId]: t })}
                />
                <TouchableOpacity
                  disabled={busy}
                  onPress={() =>
                    run(
                      () => api.payBatch(id, [{ farmerId: f.farmerId, weightKg: kg[f.farmerId] ? Number(kg[f.farmerId]) : undefined }]),
                      `Paid ${f.name}`
                    ).then(() => setKg((k) => ({ ...k, [f.farmerId]: "" })))
                  }
                  style={{ backgroundColor: BROWN, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 }}
                >
                  <Text style={{ color: "white", fontWeight: "600" }}>Pay</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              disabled={busy}
              onPress={() => run(() => api.holdFarmerInBatch(id, f.farmerId, !f.held), f.held ? `${f.name} joined` : `${f.name} will wait`)}
              style={{ borderColor: BROWN, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 }}
            >
              <Text style={{ color: BROWN, fontWeight: "600" }}>{f.held ? "Join batch" : "Wait"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {batch.farmers.length === 0 && <Text style={{ color: "#7b7266", marginTop: 8 }}>No farmers have unpaid kilos in this batch.</Text>}
    </View>
  );
}
