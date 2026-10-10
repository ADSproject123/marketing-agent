import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import DashboardSidebar from "../../components/DashboardSidebar";
import Icon from "../../components/Icon";
import { DashboardProvider, useDashboard } from "../../dashboard/DashboardContext";

const PAGE_NAMES = {
  "/dashboard": "Overview",
  "/dashboard/compose": "Create campaign",
  "/dashboard/pipeline": "Live pipeline",
  "/dashboard/jobs": "Campaign history",
  "/dashboard/guide": "Getting started",
};

function DashboardShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const { online, healthLabel } = useDashboard();
  const checking = healthLabel.startsWith("checking");

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="dash-app">
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="dash-main">
        <header className="dash-topbar">
          <div className="dash-topbar-leading">
            <button
              type="button"
              className="dash-menu-btn icon-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              aria-expanded={sidebarOpen}
              aria-controls="dashboard-navigation"
            >
              <Icon name="menu" size={20} />
            </button>
            <nav className="dash-breadcrumb" aria-label="Breadcrumb">
              <span>Workspace</span>
              <Icon name="chevron-right" size={14} />
              <span aria-current="page">{PAGE_NAMES[pathname] || "Overview"}</span>
            </nav>
          </div>
          <div className="dash-topbar-actions">
            <span className={`dash-topbar-status ${online ? "is-online" : "is-offline"}`} title={healthLabel}>
              <span className="sys-status-dot" aria-hidden="true" />
              {checking ? "Connecting" : online ? "Service online" : "Service offline"}
            </span>
            <Link className="dash-topbar-guide" to="/dashboard/guide">
              <Icon name="book" size={17} /><span>Help & guide</span>
            </Link>
            <Link className="primary-btn dash-topbar-create" to="/dashboard/compose">
              <Icon name="plus" size={17} /><span>New campaign</span>
            </Link>
          </div>
        </header>

        <main className="dash-content" id="main-content">
          <Outlet />
        </main>
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
