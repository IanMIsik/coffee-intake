import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { Farmer, Organization, StaffUser } from "@coffee/shared";

const TOKEN_KEY = "coffee.auth.token";
const SESSION_KEY = "coffee.auth.session";

export interface StaffSession {
  kind: "staff";
  staff: StaffUser;
  organization: Organization;
}

export interface FarmerSession {
  kind: "farmer";
  farmer: Farmer;
  organization: Organization;
}

export type Session = StaffSession | FarmerSession;

// The shared ApiClient needs a synchronous getToken(), but AsyncStorage is async --
// so we mirror the token into this in-memory cache, hydrated once at app startup.
let cachedToken: string | null = null;

export function getCachedToken(): string | null {
  return cachedToken;
}

// Lets the API client (which lives outside React) tell the app to sign out when a
// request comes back 401 -- expired token, or the account was deleted.
let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

export function notifySessionExpired() {
  sessionExpiredHandler?.();
}

// The token is a credential, so it lives in the phone's secure storage (Keychain / Keystore).
// The profile that goes with it is not secret and stays in ordinary storage.
export async function hydrateAuthFromStorage(): Promise<Session | null> {
  let token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (!token) {
    // Earlier versions kept the token in plain storage; move it across once.
    const legacy = await AsyncStorage.getItem(TOKEN_KEY);
    if (legacy) {
      await SecureStore.setItemAsync(TOKEN_KEY, legacy).catch(() => {});
      await AsyncStorage.removeItem(TOKEN_KEY);
      token = legacy;
    }
  }
  const rawSession = await AsyncStorage.getItem(SESSION_KEY);
  cachedToken = token;
  return token && rawSession ? (JSON.parse(rawSession) as Session) : null;
}

export async function persistAuth(token: string, session: Session): Promise<void> {
  cachedToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearAuth(): Promise<void> {
  cachedToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  await AsyncStorage.multiRemove([TOKEN_KEY, SESSION_KEY]);
}
