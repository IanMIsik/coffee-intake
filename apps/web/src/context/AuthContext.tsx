import type { Farmer, Organization, StaffUser } from "@coffee/shared";
import React, { createContext, useContext, useEffect, useState } from "react";
import { TOKEN_STORAGE_KEY } from "../lib/api";

type StaffSession = { kind: "staff"; staff: StaffUser; organization: Organization };
type FarmerSession = { kind: "farmer"; farmer: Farmer; organization: Organization };
type Session = StaffSession | FarmerSession | null;

const SESSION_STORAGE_KEY = "coffee.auth.session";

interface AuthContextValue {
  session: Session;
  loginStaff(token: string, staff: StaffUser, organization: Organization): void;
  loginFarmer(token: string, farmer: Farmer, organization: Organization): void;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(() => {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  });

  useEffect(() => {
    if (session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, [session]);

  const loginStaff = (token: string, staff: StaffUser, organization: Organization) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setSession({ kind: "staff", staff, organization });
  };

  const loginFarmer = (token: string, farmer: Farmer, organization: Organization) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setSession({ kind: "farmer", farmer, organization });
  };

  const logout = () => setSession(null);

  return (
    <AuthContext.Provider value={{ session, loginStaff, loginFarmer, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
