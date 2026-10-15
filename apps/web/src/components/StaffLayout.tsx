import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Icon, IconName, Logo } from "./Icon";

interface Item {
  to: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
  end?: boolean;
}

const ITEMS: Item[] = [
  { to: "/app", label: "Farmers", icon: "farmers", end: true },
  { to: "/app/receipts/new", label: "Record", icon: "receipt" },
  { to: "/app/dashboard", label: "Dashboard", icon: "dashboard", adminOnly: true },
  { to: "/app/batches", label: "Batches", icon: "batches", adminOnly: true },
  { to: "/app/staff", label: "Staff", icon: "staff", adminOnly: true },
  { to: "/app/account", label: "Account", icon: "account" },
];

export function StaffLayout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  if (session?.kind !== "staff") return null;
  const isAdmin = session.staff.role === "ADMIN";
  const items = ITEMS.filter((i) => !i.adminOnly || isAdmin);
  const initials = session.staff.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function signOut() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-coffee-800 text-white">
        <div className="flex items-center gap-3 px-6 pt-7 pb-8">
          <Logo className="h-9 w-9" />
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold">{session.organization.name}</div>
            <div className="text-xs text-coffee-200/80">Cherry intake</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-white/15 text-white" : "text-coffee-200/80 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon name={i.icon} />
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="m-3 flex items-center gap-3 rounded-2xl bg-black/20 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-coffee-500 text-sm font-semibold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{session.staff.name}</div>
            <div className="text-xs text-coffee-200/70">{isAdmin ? "Administrator" : "Clerk"}</div>
          </div>
          <button
            onClick={signOut}
            title="Log out"
            className="rounded-lg p-2 text-coffee-200/80 hover:bg-white/10 hover:text-white"
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 md:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between bg-coffee-800 px-4 py-3 text-white md:hidden">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="font-display font-semibold">{session.organization.name}</span>
          </div>
          <button onClick={signOut} className="rounded-lg p-1.5 text-coffee-200 hover:bg-white/10" title="Log out">
            <Icon name="logout" />
          </button>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-28 md:px-8 md:py-9 md:pb-12">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-coffee-300/70 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                  isActive ? "text-coffee-600" : "text-coffee-400"
                }`
              }
            >
              <Icon name={i.icon} className="h-6 w-6" />
              {i.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
