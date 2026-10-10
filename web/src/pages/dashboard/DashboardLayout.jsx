import { useState } from "react";
import { Outlet } from "react-router-dom";
import DashboardSidebar from "../../components/DashboardSidebar";
import { DashboardProvider } from "../../dashboard/DashboardContext";

function DashboardShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dash-app">
      <div className="atmosphere" aria-hidden="true" />
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="dash-main">
        <header className="dash-topbar">
          <button
            type="button"
            className="dash-menu-btn ghost-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            Menu
          </button>
          <p className="dash-topbar-note">Approve / Deny only happens in Telegram</p>
        </header>

        <div className="dash-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <DashboardProvider>
      <DashboardShell />
    </DashboardProvider>
  );
}
