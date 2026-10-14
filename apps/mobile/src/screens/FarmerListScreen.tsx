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
    <View style={{ backgroundColor: "white", borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <Text style={{ fontWeight: "600", marginBottom: 8 }}>Add Farmer</Text>
      <TextInput
        placeholder="Full name"
        value={name}
        onChangeText={setName}
        style={{ backgroundColor: "#f7f3ee", borderRadius: 8, padding: 10, marginBottom: 8 }}
      />
      <TextInput
        placeholder="Phone e.g. +254712345678"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={{ backgroundColor: "#f7f3ee", borderRadius: 8, padding: 10, marginBottom: 8 }}
      />
      <TextInput
        placeholder="National ID (optional)"
        value={nationalId}
        onChangeText={setNationalId}
        style={{ backgroundColor: "#f7f3ee", borderRadius: 8, padding: 10, marginBottom: 8 }}
      />
      {error && <Text style={{ color: "#b3413b", marginBottom: 8 }}>{error}</Text>}
      <TouchableOpacity
        onPress={submit}
        disabled={saving || !name || !phone}
        style={{ backgroundColor: "#7a4a26", borderRadius: 8, padding: 10, alignItems: "center", opacity: saving ? 0.5 : 1 }}
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
    <View style={{ backgroundColor: "white", borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <Text style={{ fontWeight: "600", marginBottom: 8 }}>Add Staff Account</Text>
      <TextInput
        placeholder="Full name"
        value={name}
        onChangeText={setName}
        style={{ backgroundColor: "#f7f3ee", borderRadius: 8, padding: 10, marginBottom: 8 }}
      />
      <TextInput
        placeholder="Phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={{ backgroundColor: "#f7f3ee", borderRadius: 8, padding: 10, marginBottom: 8 }}
      />
      <TextInput
        placeholder="Temporary password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ backgroundColor: "#f7f3ee", borderRadius: 8, padding: 10, marginBottom: 8 }}
      />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        {(["CLERK", "ADMIN"] as StaffRole[]).map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => setRole(r)}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              alignItems: "center",
              backgroundColor: role === r ? "#7a4a26" : "#f7f3ee",
            }}
          >
            <Text style={{ color: role === r ? "white" : "#5f3a1e" }}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error && <Text style={{ color: "#b3413b", marginBottom: 8 }}>{error}</Text>}
      <TouchableOpacity
        onPress={submit}
        disabled={saving || !name || !phone || password.length < 8}
        style={{ backgroundColor: "#7a4a26", borderRadius: 8, padding: 10, alignItems: "center", opacity: saving ? 0.5 : 1 }}
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

  const load = useCallback(async (query: string) => {
    setLoading(true);
    const net = await NetInfo.fetch();
    if (net.isConnected) {
      try {
        const results = await api.listFarmers(query || undefined);
        setFarmers(results);
        cacheFarmers(results);
        setLoading(false);
        return;
      } catch {
        // fall through to cache
      }
    }
    setFarmers(searchCachedFarmers(query));
    setLoading(false);
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

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
        <View>
          <Text style={{ color: "white", fontWeight: "600" }}>{staffSession?.organization.name}</Text>
          <Text style={{ color: "#ede2d3", fontSize: 12 }}>
            {staffSession?.staff.name} · {staffSession?.staff.role}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("ChangePassword")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={{ color: "#ede2d3" }}>Password</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: "white", fontWeight: "600" }}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ padding: 12 }}>
        <SyncBadge />
      </View>

      <View style={{ paddingHorizontal: 12 }}>
        {isAdmin && (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Dashboard")}
              style={{
                flex: 1,
                backgroundColor: "white",
                borderColor: "#7a4a26",
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#7a4a26", fontWeight: "700" }}>Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("Staff")}
              style={{
                flex: 1,
                backgroundColor: "white",
                borderColor: "#7a4a26",
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#7a4a26", fontWeight: "700" }}>Manage staff</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity
          onPress={() => navigation.navigate("RecordReceipt", undefined)}
          style={{
            backgroundColor: "#7a4a26",
            borderRadius: 10,
            padding: 14,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
            + Record Cherry Delivery
          </Text>
        </TouchableOpacity>

        <TextInput
          placeholder="Search farmer by name or phone"
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            load(t);
          }}
          style={{ backgroundColor: "white", borderRadius: 8, padding: 12, marginBottom: 12 }}
        />

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setShowAddFarmer((v) => !v)}
            style={{ flex: 1, backgroundColor: "white", borderRadius: 8, padding: 10, alignItems: "center" }}
          >
            <Text style={{ color: "#7a4a26", fontWeight: "600" }}>
              {showAddFarmer ? "Cancel" : "+ Farmer"}
            </Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => setShowAddStaff((v) => !v)}
              style={{ flex: 1, backgroundColor: "white", borderRadius: 8, padding: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#7a4a26", fontWeight: "600" }}>
                {showAddStaff ? "Cancel" : "+ Staff"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {showAddFarmer && (
          <AddFarmerForm
            onCreated={() => {
              setShowAddFarmer(false);
              load(search);
            }}
          />
        )}
        {showAddStaff && isAdmin && (
          <AddStaffForm onCreated={() => setShowAddStaff(false)} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={farmers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("FarmerDetail", { farmerId: item.id, farmerName: item.name })
              }
              style={{
                backgroundColor: "white",
                borderRadius: 10,
                padding: 14,
                marginBottom: 8,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <View>
                <Text style={{ fontWeight: "600" }}>{item.name}</Text>
                <Text style={{ color: "#a9764a", fontSize: 12 }}>{item.phone}</Text>
              </View>
              <Text style={{ fontWeight: "700" }}>{item.cumulativeWeightKg} kg</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: "#a9764a", marginTop: 24 }}>
              No farmers found.
            </Text>
          }
        />
      )}
    </View>
  );
}
