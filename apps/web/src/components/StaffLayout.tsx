import React from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function StaffLayout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  if (session?.kind !== "staff") return null;

  return (
    <div className="min-h-screen">
      <header className="bg-coffee-700 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-semibold">{session.organization.name}</div>
          <div className="text-xs text-coffee-100">
            {session.staff.name} · {session.staff.role}
          </div>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          {session.staff.role === "ADMIN" && (
            <Link to="/app/dashboard" className="hover:underline">
              Dashboard
            </Link>
          )}
          <Link to="/app" className="hover:underline">
            Farmers
          </Link>
          <Link to="/app/receipts/new" className="hover:underline">
            Record Receipt
          </Link>
          {session.staff.role === "ADMIN" && (
            <Link to="/app/staff" className="hover:underline">
              Staff
            </Link>
          )}
          <Link to="/app/account" className="hover:underline">
            Account
          </Link>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="hover:underline"
          >
            Log out
          </button>
        </nav>
      </header>
      <main className="p-4 max-w-4xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
