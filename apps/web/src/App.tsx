import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequireFarmer, RequireStaff } from "./components/RequireSession";
import { StaffLayout } from "./components/StaffLayout";
import { AuthProvider } from "./context/AuthContext";
import { FarmerHomePage } from "./pages/farmer/FarmerHomePage";
import { FarmerLoginPage } from "./pages/farmer/FarmerLoginPage";
import { BatchesPage } from "./pages/staff/BatchesPage";
import { ChangePasswordPage } from "./pages/staff/ChangePasswordPage";
import { DashboardPage } from "./pages/staff/DashboardPage";
import { FarmerDetailPage } from "./pages/staff/FarmerDetailPage";
import { FarmerListPage } from "./pages/staff/FarmerListPage";
import { StaffLoginPage } from "./pages/staff/LoginPage";
import { RecordReceiptPage } from "./pages/staff/RecordReceiptPage";
import { ReceiptPrintPage } from "./pages/staff/ReceiptPrintPage";
import { StaffUsersPage } from "./pages/staff/StaffUsersPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<StaffLoginPage />} />
        <Route
          path="/app"
          element={
            <RequireStaff>
              <StaffLayout />
            </RequireStaff>
          }
        >
          <Route index element={<FarmerListPage />} />
          <Route path="farmers/:id" element={<FarmerDetailPage />} />
          <Route
            path="dashboard"
            element={
              <RequireStaff role="ADMIN">
                <DashboardPage />
              </RequireStaff>
            }
          />
          <Route
            path="batches"
            element={
              <RequireStaff role="ADMIN">
                <BatchesPage />
              </RequireStaff>
            }
          />
          <Route path="receipts/new" element={<RecordReceiptPage />} />
          <Route path="account" element={<ChangePasswordPage />} />
          <Route
            path="staff"
            element={
              <RequireStaff role="ADMIN">
                <StaffUsersPage />
              </RequireStaff>
            }
          />
        </Route>

        <Route
          path="/app/receipts/:id"
          element={
            <RequireStaff>
              <ReceiptPrintPage />
            </RequireStaff>
          }
        />

        <Route path="/me/login" element={<FarmerLoginPage />} />
        <Route
          path="/me"
          element={
            <RequireFarmer>
              <FarmerHomePage />
            </RequireFarmer>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
