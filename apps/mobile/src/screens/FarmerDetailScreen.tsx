import type { Farmer, FarmerBalance, Receipt, ReceiptWithDetails } from "@coffee/shared";
import { ApiError, formatKg, formatMoney, paymentStatus } from "@coffee/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "FarmerDetail">;
type FarmerView = Farmer & { receipts: Receipt[]; balance: FarmerBalance };

const BROWN = "#2b6a4b";
const MUTED = "#7b7266";
const STATUS = {
  paid: { bg: "#dcfce7", fg: "#2b6a4b", label: "Paid" },
  partial: { bg: "#dbeafe", fg: "#1d4ed8", label: "Partly paid" },
  unpaid: { bg: "#f8ecc9", fg: "#8a6414", label: "Not paid" },
} as const;

const input = { backgroundColor: "#f6f2ea", borderRadius: 12, padding: 10, marginBottom: 8 } as const;
const errText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function Card({ children, tint }: { children: React.ReactNode; tint?: string }) {
  return (
    <View style={{ backgroundColor: tint ?? "white", borderRadius: 16, padding: 14, marginBottom: 12 }}>
      {children}
    </View>
  );
}

function Tile({ value, label, color, bg }: { value: string; label: string; color: string; bg: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 14, padding: 10, alignItems: "center" }}>
      <Text style={{ fontWeight: "700", color, fontSize: 15 }}>{value}</Text>
      <Text style={{ color, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{ backgroundColor: BROWN, borderRadius: 12, padding: 12, alignItems: "center", opacity: disabled ? 0.5 : 1 }}
    >
      <Text style={{ color: "white", fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function FarmerDetailScreen({ route, navigation }: Props) {
  const { farmerId, farmerName } = route.params;
  const { session } = useAuth();
  const isAdmin = session?.kind === "staff" && session.staff.role === "ADMIN";
  const [farmer, setFarmer] = useState<FarmerView | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setFarmer(await api.getFarmer(farmerId));
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (!farmer) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f6f2ea", padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#1d4d36" }}>{farmerName}</Text>
        <Text style={{ color: MUTED, marginTop: 12 }}>
          {offline ? "Offline. Details will load once you're back online." : "Farmer not found."}
        </Text>
      </View>
    );
  }
  const b = farmer.balance;

  const header = (
    <View>
      <Card>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#1d4d36" }}>{farmer.name}</Text>
        <Text style={{ color: MUTED, fontSize: 12 }}>{farmer.phone}</Text>
        <Text style={{ fontSize: 28, fontWeight: "700", color: BROWN, marginTop: 8 }}>{formatKg(b.deliveredKg)}</Text>
        <Text style={{ color: MUTED, fontSize: 12, marginBottom: 12 }}>delivered in total</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <Tile value={formatKg(b.settledKg)} label="paid for" color="#1d4d36" bg="#f6f2ea" />
          <Tile value={formatKg(b.unsettledKg)} label="not yet paid" color="#8a6414" bg="#f8ecc9" />
        </View>
        {isAdmin && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Tile value={formatMoney(b.amountOwed)} label="owed" color="#8a6414" bg="#f8ecc9" />
            <Tile value={formatMoney(b.amountPaid)} label="paid so far" color="#2b6a4b" bg="#e4eee7" />
          </View>
        )}
        {isAdmin && Number(b.unpricedKg) > 0 && (
          <Text style={{ color: "#8a6414", fontSize: 12, marginTop: 8 }}>
            {formatKg(b.unpricedKg)} unpaid has no price yet, so it isn't in the amount owed.
            {isAdmin ? " Set a price below." : " Ask an admin to set the price."}
          </Text>
        )}
      </Card>

      {offline && <Text style={{ color: MUTED, marginBottom: 8 }}>Offline: showing the last loaded details.</Text>}
      {notice && (
        <Card tint="#e4eee7">
          <Text style={{ color: "#1d4d36" }}>{notice}</Text>
        </Card>
      )}

      {farmer.archivedAt && (
        <Card tint="#f8ecc9">
          <Text style={{ color: "#8a6414", fontWeight: "700" }}>Removed from the farmers list</Text>
          <Text style={{ color: "#8a6414", fontSize: 12, marginTop: 4, marginBottom: isAdmin ? 10 : 0 }}>
            Their deliveries and payments are kept on record, but they can't sign in or get new deliveries.
          </Text>
          {isAdmin && (
            <PrimaryButton
              label="Restore farmer"
              onPress={async () => {
                try {
                  await api.restoreFarmer(farmerId);
                  setNotice(`${farmer.name} is back on the farmers list.`);
                  await load();
                } catch (e) {
                  setNotice(errText(e, "Could not restore this farmer"));
                }
              }}
            />
          )}
        </Card>
      )}

      {!farmer.archivedAt && (
        <View style={{ marginBottom: 12 }}>
          <PrimaryButton
            label="Record a Receipt"
            onPress={() => navigation.navigate("RecordReceipt", { farmerId, farmerName: farmer.name })}
          />
        </View>
      )}

      {isAdmin && (
        <>
          <PayFarmerCard
            farmer={farmer}
            onDone={async (msg) => {
              setNotice(msg);
              await load();
            }}
          />
          <PriceCard
            farmer={farmer}
            onDone={async (msg) => {
              setNotice(msg);
              await load();
            }}
          />
        </>
      )}

      <Text style={{ fontWeight: "600", marginBottom: 8 }}>Deliveries</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        style={{ backgroundColor: "#f6f2ea" }}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        data={farmer.receipts}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<Text style={{ color: MUTED }}>No receipts yet.</Text>}
        ListFooterComponent={
          isAdmin && !farmer.archivedAt ? (
            <TouchableOpacity
              onPress={() => {
                const owed =
                  Number(b.unsettledKg) > 0
                    ? ` They still have ${formatKg(b.unsettledKg)} unpaid (${formatMoney(b.amountOwed)} owed); you can still pay it from the removed list.`
                    : "";
                Alert.alert(
                  `Remove ${farmer.name} from the list?`,
                  `Nothing is deleted: all their deliveries and payments stay on record, and you can restore them later.${owed}`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await api.archiveFarmer(farmerId);
                          navigation.goBack();
                        } catch (e) {
                          setNotice(errText(e, "Could not remove this farmer"));
                        }
                      },
                    },
                  ]
                );
              }}
              style={{ marginTop: 16, padding: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#b73a2c", fontWeight: "700" }}>Remove from farmers list</Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => <ReceiptCard receipt={item} isAdmin={isAdmin} onChanged={load} />}
      />
    </KeyboardAvoidingView>
  );
}

function PayFarmerCard({ farmer, onDone }: { farmer: FarmerView; onDone: (message: string) => Promise<void> }) {
  const unpaid = Number(farmer.balance.unsettledKg);
  const [kg, setKg] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const kilos = Number(kg);
  const unit = Number(price);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const res = await api.settleFarmer(farmer.id, {
        weightKg: kilos,
        pricePerKg: unit > 0 ? unit : undefined,
        note: note.trim() || undefined,
      });
      setKg("");
      setPrice("");
      setNote("");
      await onDone(
        `Recorded payment for ${formatKg(kilos)} across ${res.settlements.length} ` +
          `${res.settlements.length === 1 ? "delivery" : "deliveries"}. ${formatMoney(res.balance.amountOwed)} still owed.`
      );
    } catch (e) {
      setError(errText(e, "Couldn't record the payment"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <Text style={{ fontWeight: "700", color: "#1d4d36" }}>Record a payment</Text>
      <Text style={{ color: MUTED, fontSize: 12, marginBottom: 10 }}>
        For kilos you have sold. Applied to the oldest unpaid deliveries first.
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          style={[input, { flex: 1 }]}
          value={kg}
          onChangeText={setKg}
          placeholder={`Kilos (up to ${unpaid})`}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={[input, { flex: 1 }]}
          value={price}
          onChangeText={setPrice}
          placeholder="Price per kg"
          keyboardType="decimal-pad"
        />
      </View>
      <TextInput style={input} value={note} onChangeText={setNote} placeholder="Note (optional), e.g. Lot 3, M-Pesa ref" maxLength={200} />
      {kilos > 0 && unit > 0 && (
        <Text style={{ marginBottom: 8 }}>
          Amount: <Text style={{ fontWeight: "700" }}>{formatMoney(kilos * unit)}</Text>
        </Text>
      )}
      {kilos > 0 && !(unit > 0) && (
        <Text style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>
          No price entered: each delivery is paid at its own agreed price.
        </Text>
      )}
      {error && <Text style={{ color: "#b73a2c", marginBottom: 8 }}>{error}</Text>}
      {saving ? <ActivityIndicator /> : <PrimaryButton label="Record payment" onPress={submit} disabled={!(kilos > 0) || unpaid <= 0} />}
      {unpaid <= 0 && <Text style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>Nothing unpaid for this farmer.</Text>}
    </Card>
  );
}

function PriceCard({ farmer, onDone }: { farmer: FarmerView; onDone: (message: string) => Promise<void> }) {
  const [price, setPrice] = useState("");
  const [scope, setScope] = useState<"unpriced" | "unsettled">("unpriced");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const res = await api.setFarmerPrice(farmer.id, Number(price), scope);
      setPrice("");
      await onDone(`Price set on ${res.updated} ${res.updated === 1 ? "delivery" : "deliveries"}.`);
    } catch (e) {
      setError(errText(e, "Couldn't set the price"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <Text style={{ fontWeight: "700", color: "#1d4d36" }}>Agreed price</Text>
      <Text style={{ color: MUTED, fontSize: 12, marginBottom: 10 }}>Set the price per kg on this farmer's deliveries.</Text>
      <TextInput style={input} value={price} onChangeText={setPrice} placeholder="KES per kg" keyboardType="decimal-pad" />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        {(["unpriced", "unsettled"] as const).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setScope(s)}
            style={{ flex: 1, padding: 8, borderRadius: 12, alignItems: "center", backgroundColor: scope === s ? BROWN : "#f6f2ea" }}
          >
            <Text style={{ color: scope === s ? "white" : "#1d4d36", fontSize: 12 }}>
              {s === "unpriced" ? "No price yet" : "All unpaid"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {scope === "unsettled" && (
        <Text style={{ color: "#8a6414", fontSize: 12, marginBottom: 8 }}>
          Overwrites prices already set on unpaid deliveries. Paid ones are not touched.
        </Text>
      )}
      {error && <Text style={{ color: "#b73a2c", marginBottom: 8 }}>{error}</Text>}
      {saving ? <ActivityIndicator /> : <PrimaryButton label="Set price" onPress={submit} disabled={!(Number(price) > 0)} />}
    </Card>
  );
}

function ReceiptCard({ receipt: r, isAdmin, onChanged }: { receipt: Receipt; isAdmin: boolean; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<"view" | "pay" | "history" | "edit" | "delete">("view");
  const [number, setNumber] = useState(r.receiptNumber);
  const [weight, setWeight] = useState(r.weightKg);
  const [editPrice, setEditPrice] = useState(r.pricePerKg ?? "");
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState<ReceiptWithDetails | null>(null);
  const [payKg, setPayKg] = useState("");
  const [payPrice, setPayPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const status = paymentStatus(r);
  const remaining = Number(r.weightKg) - Number(r.settledKg);
  const style = STATUS[status];

  function open(next: "pay" | "history" | "edit" | "delete") {
    setError(null);
    if (mode === next) return setMode("view");
    setMode(next);
    if (next === "history") api.getReceipt(r.id).then(setDetail).catch(() => setError("Couldn't load payments"));
    if (next === "pay") {
      setPayKg(String(remaining));
      setPayPrice(r.pricePerKg ?? "");
    }
    if (next === "edit") {
      setNumber(r.receiptNumber);
      setWeight(r.weightKg);
      setEditPrice(r.pricePerKg ?? "");
    }
    if (next === "delete") setReason("");
  }

  async function saveEdit() {
    setError(null);
    setSaving(true);
    try {
      const changes: { weightKg?: number; receiptNumber?: string; pricePerKg?: number | null } = {};
      if (weight !== r.weightKg) changes.weightKg = Number(weight);
      if (number !== r.receiptNumber) changes.receiptNumber = number;
      if (isAdmin && editPrice !== (r.pricePerKg ?? "")) changes.pricePerKg = editPrice === "" ? null : Number(editPrice);
      if (Object.keys(changes).length > 0) await api.adjustReceipt(r.id, changes);
      setMode("view");
      await onChanged();
    } catch (e) {
      setError(errText(e, "Couldn't save the changes"));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      `Delete receipt #${r.receiptNumber}?`,
      "It is removed from the farmer's total and the day's totals. A copy is kept in the deleted-records list with your name and the reason.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setError(null);
            setSaving(true);
            try {
              await api.deleteReceipt(r.id, reason.trim());
              await onChanged();
            } catch (e) {
              setError(errText(e, "Couldn't delete this record"));
              setSaving(false);
            }
          },
        },
      ]
    );
  }

  async function pay() {
    setError(null);
    setSaving(true);
    try {
      await api.recordSettlement(r.id, {
        weightKg: Number(payKg),
        pricePerKg: Number(payPrice) > 0 ? Number(payPrice) : undefined,
      });
      setMode("view");
      await onChanged();
    } catch (e) {
      setError(errText(e, "Couldn't record the payment"));
    } finally {
      setSaving(false);
    }
  }

  function confirmVoid(settlementId: string) {
    Alert.alert("Void this payment?", "It stays in the record but no longer counts.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Void",
        style: "destructive",
        onPress: async () => {
          try {
            await api.voidSettlement(r.id, settlementId);
            setDetail(await api.getReceipt(r.id));
            await onChanged();
          } catch (e) {
            setError(errText(e, "Couldn't void the payment"));
          }
        },
      },
    ]);
  }

  return (
    <View style={{ backgroundColor: "white", borderRadius: 14, padding: 12, marginBottom: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600" }}>Receipt #{r.receiptNumber}</Text>
          <Text style={{ color: MUTED, fontSize: 12 }}>{new Date(r.deliveredAt).toLocaleString()}</Text>
          <Text style={{ color: MUTED, fontSize: 12 }}>
            {isAdmin ? (r.pricePerKg ? `${formatMoney(r.pricePerKg)}/kg` : "No price set") : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontWeight: "700" }}>{formatKg(r.weightKg)}</Text>
          <View style={{ backgroundColor: style.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 }}>
            <Text style={{ color: style.fg, fontSize: 11 }}>
              {status === "partial" ? `${formatKg(r.settledKg)} paid` : style.label}
            </Text>
          </View>
        </View>
      </View>

      {(
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <TouchableOpacity onPress={() => open("edit")} style={{ flex: 1, padding: 8, borderRadius: 12, alignItems: "center", backgroundColor: "#f6f2ea" }}>
            <Text style={{ color: BROWN, fontWeight: "600", fontSize: 12 }}>Edit</Text>
          </TouchableOpacity>
          {isAdmin && remaining > 0 && (
            <TouchableOpacity onPress={() => open("pay")} style={{ flex: 1, padding: 8, borderRadius: 12, alignItems: "center", backgroundColor: BROWN }}>
              <Text style={{ color: "white", fontWeight: "600", fontSize: 12 }}>Pay</Text>
            </TouchableOpacity>
          )}
          {isAdmin && Number(r.settledKg) > 0 && (
            <TouchableOpacity onPress={() => open("history")} style={{ flex: 1, padding: 8, borderRadius: 12, alignItems: "center", backgroundColor: "#f6f2ea" }}>
              <Text style={{ color: BROWN, fontWeight: "600", fontSize: 12 }}>Payments</Text>
            </TouchableOpacity>
          )}
          {isAdmin && (
            <TouchableOpacity onPress={() => open("delete")} style={{ flex: 1, padding: 8, borderRadius: 12, alignItems: "center", backgroundColor: "#fdf0ee" }}>
              <Text style={{ color: "#962d22", fontWeight: "600", fontSize: 12 }}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {mode === "edit" && (
        <View style={{ marginTop: 10, backgroundColor: "#f6f2ea", borderRadius: 12, padding: 10 }}>
          <TextInput style={[input, { backgroundColor: "white" }]} value={number} onChangeText={setNumber} placeholder="Receipt number" />
          <TextInput style={[input, { backgroundColor: "white" }]} value={weight} onChangeText={setWeight} placeholder="Weight (kg)" keyboardType="decimal-pad" />
          {isAdmin && (
            <TextInput style={[input, { backgroundColor: "white" }]} value={String(editPrice)} onChangeText={setEditPrice} placeholder="Price per kg" keyboardType="decimal-pad" />
          )}
          {Number(r.settledKg) > 0 && (
            <Text style={{ color: MUTED, fontSize: 11, marginBottom: 8 }}>{formatKg(r.settledKg)} is already paid, so the weight can't go below that.</Text>
          )}
          {error && <Text style={{ color: "#b73a2c", marginBottom: 8 }}>{error}</Text>}
          {saving ? <ActivityIndicator /> : <PrimaryButton label="Save changes" onPress={saveEdit} />}
        </View>
      )}

      {mode === "delete" && (
        <View style={{ marginTop: 10, backgroundColor: "#fdf0ee", borderRadius: 12, padding: 10 }}>
          {Number(r.settledKg) > 0 ? (
            <Text style={{ color: "#962d22", fontSize: 12 }}>
              This delivery has payments recorded. Open Payments and void them first, then delete it.
            </Text>
          ) : (
            <>
              <Text style={{ color: "#962d22", fontSize: 12, marginBottom: 8 }}>
                For a record entered by mistake. A copy stays in the deleted-records list.
              </Text>
              <TextInput style={[input, { backgroundColor: "white" }]} value={reason} onChangeText={setReason} placeholder="Reason (e.g. entered twice)" maxLength={200} />
              {error && <Text style={{ color: "#b73a2c", marginBottom: 8 }}>{error}</Text>}
              {saving ? <ActivityIndicator /> : <PrimaryButton label="Delete record" onPress={confirmDelete} disabled={reason.trim().length < 3} />}
            </>
          )}
        </View>
      )}

      {mode === "pay" && (
        <View style={{ marginTop: 10, backgroundColor: "#f6f2ea", borderRadius: 12, padding: 10 }}>
          <Text style={{ fontSize: 12, color: "#1d4d36", marginBottom: 8 }}>{formatKg(remaining)} of this delivery is unpaid.</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput style={[input, { flex: 1, backgroundColor: "white" }]} value={payKg} onChangeText={setPayKg} placeholder="Kilos" keyboardType="decimal-pad" />
            <TextInput style={[input, { flex: 1, backgroundColor: "white" }]} value={payPrice} onChangeText={setPayPrice} placeholder="Price per kg" keyboardType="decimal-pad" />
          </View>
          {Number(payKg) > 0 && Number(payPrice) > 0 && (
            <Text style={{ marginBottom: 8 }}>Amount: <Text style={{ fontWeight: "700" }}>{formatMoney(Number(payKg) * Number(payPrice))}</Text></Text>
          )}
          {error && <Text style={{ color: "#b73a2c", marginBottom: 8 }}>{error}</Text>}
          {saving ? <ActivityIndicator /> : <PrimaryButton label="Record payment" onPress={pay} disabled={!(Number(payKg) > 0)} />}
        </View>
      )}

      {mode === "history" && (
        <View style={{ marginTop: 10, backgroundColor: "#f6f2ea", borderRadius: 12, padding: 10 }}>
          {!detail ? (
            <ActivityIndicator />
          ) : (
            detail.settlements.map((s) => (
              <View key={s.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, opacity: s.voidedAt ? 0.5 : 1 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ textDecorationLine: s.voidedAt ? "line-through" : "none" }}>
                    {formatKg(s.weightKg)}
                    {s.amount ? ` · ${formatMoney(s.amount)}` : " · no amount recorded"}
                  </Text>
                  <Text style={{ color: MUTED, fontSize: 11 }}>
                    {new Date(s.createdAt).toLocaleString()}
                    {s.note ? ` · ${s.note}` : ""}
                    {s.voidedAt ? " · voided" : ""}
                  </Text>
                </View>
                {!s.voidedAt && (
                  <TouchableOpacity onPress={() => confirmVoid(s.id)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: "#fdf0ee" }}>
                    <Text style={{ color: "#962d22", fontSize: 12 }}>Void</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
          {error && <Text style={{ color: "#b73a2c" }}>{error}</Text>}
        </View>
      )}
    </View>
  );
}
