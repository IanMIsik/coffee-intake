import React, { useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { getApiUrl, getOrganizationSlug, saveServerSettings } from "../lib/config";

export function ServerSettings() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(getApiUrl());
  const [slug, setSlug] = useState(getOrganizationSlug());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await saveServerSettings({ apiUrl: url, organizationSlug: slug });
      setUrl(getApiUrl());
      setSlug(getOrganizationSlug());
      setSaved(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the server settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ marginTop: 24 }}>
      <TouchableOpacity onPress={() => setOpen((v) => !v)} style={{ alignItems: "center", padding: 8 }}>
        <Text style={{ color: "#a9764a", fontSize: 12 }}>
          Server: {getApiUrl()} · {getOrganizationSlug()}
          {"  "}
          <Text style={{ textDecorationLine: "underline" }}>{open ? "Close" : "Change"}</Text>
        </Text>
        {saved && <Text style={{ color: "#166534", fontSize: 12, marginTop: 4 }}>Server saved.</Text>}
      </TouchableOpacity>

      {open && (
        <View style={{ backgroundColor: "white", borderRadius: 10, padding: 12, marginTop: 4 }}>
          <Text style={{ fontSize: 12, color: "#5f3a1e", marginBottom: 8 }}>
            Server address, e.g. http://192.168.0.101:4000 or https://api.yourfactory.com
          </Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="Server address"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={{ backgroundColor: "#f7f3ee", borderRadius: 8, padding: 10, marginBottom: 8 }}
          />
          <Text style={{ fontSize: 12, color: "#5f3a1e", marginBottom: 8 }}>
            Organization code (given by your administrator)
          </Text>
          <TextInput
            value={slug}
            onChangeText={setSlug}
            placeholder="Organization code"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ backgroundColor: "#f7f3ee", borderRadius: 8, padding: 10, marginBottom: 8 }}
          />
          {error && <Text style={{ color: "#b3413b", marginBottom: 8 }}>{error}</Text>}
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={{ backgroundColor: "#7a4a26", borderRadius: 8, padding: 10, alignItems: "center", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "600" }}>Check & save</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
