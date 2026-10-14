import AsyncStorage from "@react-native-async-storage/async-storage";

// Build-time defaults. The in-app "Server" setting overrides both, so one installed
// app keeps working when the server's address changes or a different factory uses it.
const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const DEFAULT_ORGANIZATION_SLUG = process.env.EXPO_PUBLIC_ORGANIZATION_SLUG ?? "demo-factory";

const STORAGE_KEY = "coffee.server.settings";

let apiUrl = DEFAULT_API_URL;
let organizationSlug = DEFAULT_ORGANIZATION_SLUG;

export function getApiUrl(): string {
  return apiUrl;
}

export function getOrganizationSlug(): string {
  return organizationSlug;
}

export async function loadServerSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { apiUrl?: string; organizationSlug?: string };
    if (saved.apiUrl) apiUrl = saved.apiUrl;
    if (saved.organizationSlug) organizationSlug = saved.organizationSlug;
  } catch {
    // Unreadable settings fall back to the build-time defaults.
  }
}

export function normalizeApiUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, "");
  if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

/** Checks the address really is this app's server, then saves it. Throws a readable error. */
export async function saveServerSettings(input: {
  apiUrl: string;
  organizationSlug: string;
}): Promise<void> {
  const url = normalizeApiUrl(input.apiUrl);
  const slug = input.organizationSlug.trim().toLowerCase();
  if (!url) throw new Error("Enter the server address");
  if (!slug) throw new Error("Enter the organization code");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.ok !== true) {
      throw new Error("That address answered, but it doesn't look like the Coffee Intake server");
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("That address")) throw err;
    throw new Error(
      "Couldn't reach that server. Check the address, and that this phone is on the same network."
    );
  } finally {
    clearTimeout(timer);
  }

  apiUrl = url;
  organizationSlug = slug;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ apiUrl: url, organizationSlug: slug }));
}
