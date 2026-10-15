import type { Farmer } from "@coffee/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
// SDK 57 moved the old string-path API (documentDirectory, copyAsync, etc.) here;
// the top-level "expo-file-system" export is now the new File/Directory class API.
import * as FileSystem from "expo-file-system/legacy";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { cacheFarmers, searchCachedFarmers, type CachedFarmer } from "../db/farmersCache";
import { api } from "../lib/api";
import { enqueueReceipt } from "../db/outbox";
import { uuidv4 } from "../lib/uuid";
import type { RootStackParamList } from "../navigation/types";
import { flushOutbox } from "../sync/syncManager";

type Props = NativeStackScreenProps<RootStackParamList, "RecordReceipt">;

export function RecordReceiptScreen({ route, navigation }: Props) {
  const [farmerId, setFarmerId] = useState<string | undefined>(route.params?.farmerId);
  const [farmerName, setFarmerName] = useState<string | undefined>(route.params?.farmerName);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<(Farmer | CachedFarmer)[]>([]);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (farmerId || !search) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const found = await api.listFarmers(search);
        setResults(found);
        cacheFarmers(found);
      } catch {
        setResults(searchCachedFarmers(search));
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [search, farmerId]);

  async function takePhoto() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
    if (!photo) return;
    const dir = `${FileSystem.documentDirectory}receipts/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const dest = `${dir}${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: photo.uri, to: dest });
    setPhotoUri(dest);
    setShowCamera(false);
  }

  async function onSave() {
    setError(null);
    if (!farmerId) {
      setError("Select a farmer first");
      return;
    }
    const weight = Number(weightKg);
    if (!weight || weight <= 0) {
      setError("Enter a valid weight in kg");
      return;
    }

    setSaving(true);
    const clientId = uuidv4();
    enqueueReceipt({
      clientId,
      farmerId,
      farmerName: farmerName ?? "",
      // null = let the server auto-generate a receipt number once this syncs.
      receiptNumber: receiptNumber.trim() || null,
      weightKg: weight,
      photoUri,
    });

    // Try to sync immediately so the clerk sees confirmation when online; if it fails
    // (no connection), the receipt stays safely queued and the sync badge will retry.
    const result = await flushOutbox().catch(() => null);
    setSaving(false);
    setMessage(
      result && result.failed === 0
        ? "Receipt saved and synced."
        : "Receipt saved offline — will sync automatically once back online."
    );
    setReceiptNumber("");
    setWeightKg("");
    setPhotoUri(null);
  }

  if (showCamera) {
    if (!permission?.granted) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Text style={{ marginBottom: 12 }}>Camera permission is needed to photograph the receipt.</Text>
          <TouchableOpacity
            onPress={requestPermission}
            style={{ backgroundColor: "#2b6a4b", padding: 12, borderRadius: 12 }}
          >
            <Text style={{ color: "white" }}>Grant permission</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        <View style={{ position: "absolute", bottom: 32, alignSelf: "center", flexDirection: "row", gap: 16 }}>
          <TouchableOpacity
            onPress={() => setShowCamera(false)}
            style={{ backgroundColor: "white", padding: 14, borderRadius: 999 }}
          >
            <Text>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={takePhoto}
            style={{ backgroundColor: "#2b6a4b", padding: 14, borderRadius: 999 }}
          >
            <Text style={{ color: "white" }}>Capture</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!farmerId) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f6f2ea", padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1d4d36", marginBottom: 16 }}>
          Record Receipt
        </Text>
        <Text style={{ marginBottom: 8, color: "#7b7266" }}>Search for the farmer</Text>
        <TextInput
          placeholder="Search by name or phone"
          value={search}
          onChangeText={setSearch}
          style={{ backgroundColor: "white", borderRadius: 12, padding: 12, marginBottom: 12 }}
        />
        {results.map((f) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => {
              setFarmerId(f.id);
              setFarmerName(f.name);
            }}
            style={{ backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8 }}
          >
            <Text style={{ fontWeight: "600" }}>{f.name}</Text>
            <Text style={{ color: "#7b7266", fontSize: 12 }}>{f.phone}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 14, alignItems: "center" }}>
          <Text style={{ color: "#2b6a4b" }}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f2ea", padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: "#1d4d36", marginBottom: 16 }}>
        Record Receipt — {farmerName}
      </Text>

      <TextInput
        placeholder="Receipt number (optional — leave blank to auto-generate)"
        value={receiptNumber}
        onChangeText={setReceiptNumber}
        style={{ backgroundColor: "white", borderRadius: 12, padding: 12, marginBottom: 12 }}
      />
      <TextInput
        placeholder="Weight (kg)"
        value={weightKg}
        onChangeText={setWeightKg}
        keyboardType="decimal-pad"
        style={{ backgroundColor: "white", borderRadius: 12, padding: 12, marginBottom: 12 }}
      />

      {photoUri ? (
        <Image source={{ uri: photoUri }} style={{ width: 120, height: 120, borderRadius: 12, marginBottom: 12 }} />
      ) : null}
      <TouchableOpacity
        onPress={() => setShowCamera(true)}
        style={{ borderColor: "#2b6a4b", borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", marginBottom: 16 }}
      >
        <Text style={{ color: "#2b6a4b" }}>{photoUri ? "Retake Photo" : "Photograph Paper Receipt"}</Text>
      </TouchableOpacity>

      {error && <Text style={{ color: "#b73a2c", marginBottom: 12 }}>{error}</Text>}
      {message && <Text style={{ color: "#3f7d5a", marginBottom: 12 }}>{message}</Text>}

      <TouchableOpacity
        onPress={onSave}
        disabled={saving}
        style={{ backgroundColor: "#2b6a4b", borderRadius: 12, padding: 14, alignItems: "center" }}
      >
        {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: "white" }}>Save Receipt</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 14, alignItems: "center" }}>
        <Text style={{ color: "#2b6a4b" }}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}
