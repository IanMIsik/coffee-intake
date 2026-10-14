import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireStaff({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: "ADMIN";
}) {
  const { session } = useAuth();
  if (!session || session.kind !== "staff") {
    return <Navigate to="/login" replace />;
  }
  if (role && session.staff.role !== role) {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}

export function RequireFarmer({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session || session.kind !== "farmer") {
    return <Navigate to="/me/login" replace />;
  }
  return <>{children}</>;
}
