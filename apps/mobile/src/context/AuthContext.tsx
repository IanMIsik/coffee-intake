import type { Farmer, Organization, StaffUser } from "@coffee/shared";
import React, { createContext, useContext, useEffect, useState } from "react";
import { loadServerSettings } from "../lib/config";
import {
  clearAuth,
  hydrateAuthFromStorage,
  persistAuth,
  setSessionExpiredHandler,
  type Session,
} from "../lib/authStore";

interface AuthContextValue {
  session: Session | null;
  ready: boolean;
  loginStaff(token: string, staff: StaffUser, organization: Organization): Promise<void>;
  loginFarmer(token: string, farmer: Farmer, organization: Organization): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Server settings first: the stored session's requests must go to the saved server.
    loadServerSettings()
      .then(hydrateAuthFromStorage)
      .then((s) => {
        setSession(s);
        setReady(true);
      });
  }, []);

  async function loginStaff(token: string, staff: StaffUser, organization: Organization) {
    const s: Session = { kind: "staff", staff, organization };
    await persistAuth(token, s);
    setSession(s);
  }

  async function loginFarmer(token: string, farmer: Farmer, organization: Organization) {
    const s: Session = { kind: "farmer", farmer, organization };
    await persistAuth(token, s);
    setSession(s);
  }

  async function logout() {
    await clearAuth();
    setSession(null);
  }

  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearAuth().finally(() => setSession(null));
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, ready, loginStaff, loginFarmer, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
