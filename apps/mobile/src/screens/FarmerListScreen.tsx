import type { Farmer, StaffRole } from "@coffee/shared";
import { ApiError } from "@coffee/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import NetInfo from "@react-native-community/netinfo";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SyncBadge } from "../components/SyncBadge";
import { useAuth } from "../context/AuthContext";
import { cacheFarmers, searchCachedFarmers, type CachedFarmer } from "../db/farmersCache";
import { api } from "../lib/api";
import type { RootStackParamList } from "../navigation/types";
import { card, colors, input, radius, shadow } from "../theme";
import { Avatar, Logo } from "../components/ui";

type Props = NativeStackScreenProps<RootStackParamList, "FarmerList">;

function AddFarmerForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await api.createFarmer({ name, phone, nationalId: nationalId || null });
      setName("");
      setPhone("");
      setNationalId("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create farmer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ backgroundColor: "white", borderRadius: 14, padding: 12, marginBottom: 12 }}>
      <Text style={{ fontWeight: "600", marginBottom: 8 }}>Add Farmer</Text>
      <TextInput
        placeholder="Full name"
        value={name}
        onChangeText={setName}
        style={{ backgroundColor: "#f6f2ea", borderRadius: 12, padding: 10, marginBottom: 8 }}
      />
      <TextInput
        placeholder="Phone e.g. +254712345678"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={{ backgroundColor: "#f6f2ea", borderRadius: 12, padding: 10, marginBottom: 8 }}
      />
      <TextInput
        placeholder="National ID (optional)"
        value={nationalId}
        onChangeText={setNationalId}
        style={{ backgroundColor: "#f6f2ea", borderRadius: 12, padding: 10, marginBottom: 8 }}
      />
      {error && <Text style={{ color: "#b73a2c", marginBottom: 8 }}>{error}</Text>}
      <TouchableOpacity
        onPress={submit}
        disabled={saving || !name || !phone}
        style={{ backgroundColor: "#2b6a4b", borderRadius: 12, padding: 10, alignItems: "center", opacity: saving ? 0.5 : 1 }}
      >
        {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: "white" }}>Save Farmer</Text>}
      </TouchableOpacity>
    </View>
  );
}

function AddStaffForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("CLERK");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await api.createStaff({ name, phone, password, role });
      setName("");
      setPhone("");
      setPassword("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create staff account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ backgroundColor: "white", borderRadius: 14, padding: 12, marginBottom: 12 }}>
      <Text style={{ fontWeight: "600", marginBottom: 8 }}>Add Staff Account</Text>
      <TextInput
        placeholder="Full name"
        value={name}
        onChangeText={setName}
        style={{ backgroundColor: "#f6f2ea", borderRadius: 12, padding: 10, marginBottom: 8 }}
      />
      <TextInput
        placeholder="Phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={{ backgroundColor: "#f6f2ea", borderRadius: 12, padding: 10, marginBottom: 8 }}
      />
      <TextInput
        placeholder="Temporary password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ backgroundColor: "#f6f2ea", borderRadius: 12, padding: 10, marginBottom: 8 }}
      />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        {(["CLERK", "ADMIN"] as StaffRole[]).map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => setRole(r)}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: role === r ? "#2b6a4b" : "#f6f2ea",
            }}
          >
            <Text style={{ color: role === r ? "white" : "#1d4d36" }}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error && <Text style={{ color: "#b73a2c", marginBottom: 8 }}>{error}</Text>}
      <TouchableOpacity
        onPress={submit}
        disabled={saving || !name || !phone || password.length < 8}
        style={{ backgroundColor: "#2b6a4b", borderRadius: 12, padding: 10, alignItems: "center", opacity: saving ? 0.5 : 1 }}
      >
        {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: "white" }}>Save Staff Account</Text>}
      </TouchableOpacity>
    </View>
  );
}

export function FarmerListScreen({ navigation }: Props) {
  const { session, logout } = useAuth();
  const insets = useSafeAreaInsets();
  // App.tsx only mounts this screen for a staff session, but TS still needs the narrow.
  const staffSession = session?.kind === "staff" ? session : null;
  const isAdmin = staffSession?.staff.role === "ADMIN";
  const [search, setSearch] = useState("");
  const [farmers, setFarmers] = useState<(Farmer | CachedFarmer)[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFarmer, setShowAddFarmer] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    const net = await NetInfo.fetch();
    if (net.isConnected) {
      try {
        const results = await api.listFarmers(query || undefined, { archived: showRemoved });
        setFarmers(results);
        if (!showRemoved) cacheFarmers(results, { replaceAll: !query });
        setLoading(false);
        return;
      } catch {
        // fall through to cache
      }
    }
    setFarmers(showRemoved ? [] : searchCachedFarmers(query));
    setLoading(false);
  }, [showRemoved]);

  useEffect(() => {
    load(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const tile = (label: string, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      activeOpacity={0.8}
      style={{ ...card, flex: 1, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center" }}
    >
      <Text style={{ color: colors.primaryDark, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 18,
          paddingBottom: 22,
          backgroundColor: colors.primaryDeep,
          borderBottomLeftRadius: 26,
          borderBottomRightRadius: 26,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <Logo size={32} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }} numberOfLines={1}>
                {staffSession?.organization.name}
              </Text>
              <Text style={{ color: "#cfe0d5", fontSize: 12 }}>
                {staffSession?.staff.name} · {staffSession?.staff.role === "ADMIN" ? "Administrator" : "Clerk"}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate("ChangePassword")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ color: "#cfe0d5" }}>Account</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={logout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: "white", fontWeight: "700" }}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
        <SyncBadge />
        <View style={{ height: 10 }} />
        <TouchableOpacity
          onPress={() => navigation.navigate("RecordReceipt", undefined)}
          activeOpacity={0.85}
          style={{
            backgroundColor: colors.cherry,
            borderRadius: radius.md,
            padding: 16,
            alignItems: "center",
            marginBottom: 10,
            ...shadow,
          }}
        >
          <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>+ Record Cherry Delivery</Text>
        </TouchableOpacity>

        {isAdmin && (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            {tile("Dashboard", () => navigation.navigate("Dashboard"))}
            {tile("Batches", () => navigation.navigate("Batches"))}
            {tile("Staff", () => navigation.navigate("Staff"))}
          </View>
        )}

        <TextInput
          placeholder="Search farmer by name or phone"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            load(t);
          }}
          style={{ ...input, marginBottom: 10 }}
        />

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          <TouchableOpacity
            onPress={() => setShowAddFarmer((v) => !v)}
            style={{ flex: 1, backgroundColor: colors.primaryTint, borderRadius: radius.sm, padding: 10, alignItems: "center" }}
          >
            <Text style={{ color: colors.primaryDark, fontWeight: "700" }}>{showAddFarmer ? "Cancel" : "+ Farmer"}</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => setShowAddStaff((v) => !v)}
              style={{ flex: 1, backgroundColor: colors.primaryTint, borderRadius: radius.sm, padding: 10, alignItems: "center" }}
            >
              <Text style={{ color: colors.primaryDark, fontWeight: "700" }}>{showAddStaff ? "Cancel" : "+ Staff"}</Text>
            </TouchableOpacity>
          )}
        </View>

        {isAdmin && (
          <TouchableOpacity onPress={() => setShowRemoved((v) => !v)} style={{ marginBottom: 10 }}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>
              {showRemoved ? "← Back to active farmers" : "Show removed farmers"}
            </Text>
          </TouchableOpacity>
        )}

        {showAddFarmer && (
          <AddFarmerForm
            onCreated={() => {
              setShowAddFarmer(false);
              load(search);
            }}
          />
        )}
        {showAddStaff && isAdmin && <AddStaffForm onCreated={() => setShowAddStaff(false)} />}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={farmers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate("FarmerDetail", { farmerId: item.id, farmerName: item.name })}
              activeOpacity={0.8}
              style={{ ...card, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Avatar name={item.name} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.ink }}>{item.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.phone}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontWeight: "800", color: colors.primaryDark, fontSize: 16 }}>{item.cumulativeWeightKg} kg</Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>delivered</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: colors.muted, marginTop: 24 }}>No farmers found.</Text>
          }
        />
      )}
    </View>
  );
}
