import { NavLink } from "react-router-dom";
import { useAuth } from "../auth";
import { useDashboard } from "../dashboard/DashboardContext";

const NAV = [
  { to: "/dashboard", end: true, label: "Overview", hint: "Status & shortcuts" },
  { to: "/dashboard/compose", label: "Compose", hint: "Start a campaign job" },
  { to: "/dashboard/pipeline", label: "Pipeline", hint: "Live generation flow" },
  { to: "/dashboard/jobs", label: "Jobs", hint: "History & details" },
  { to: "/dashboard/guide", label: "Guide", hint: "How the system works" },
];

export default function DashboardSidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const { online, healthLabel, liveCount } = useDashboard();

  return (
    <>
      <div
        className={`dash-sidebar-backdrop ${open ? "is-open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside className={`dash-sidebar ${open ? "is-open" : ""}`} aria-label="Dashboard">
        <div className="dash-sidebar-brand">
          <NavLink to="/" className="site-logo" onClick={onClose}>
            <span className="site-logo-mark" aria-hidden="true" />
            <span className="site-logo-text">Marketing Agent</span>
          </NavLink>
          <p className="dash-sidebar-tag">Campaign workspace</p>
        </div>

        <nav className="dash-side-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `dash-side-link ${isActive ? "is-active" : ""}`
              }
              onClick={onClose}
            >
              <span className="dash-side-label">{item.label}</span>
              <span className="dash-side-hint">
                {item.to === "/dashboard/pipeline" && liveCount > 0
                  ? `${liveCount} live`
                  : item.hint}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="dash-sidebar-foot">
          <div className={`sys-status ${online ? "is-online" : "is-offline"}`}>
            <span className="sys-status-dot" aria-hidden="true" />
            <span className="sys-status-label">{healthLabel}</span>
          </div>
          <div className="dash-sidebar-user">
            <div>
              <p className="dash-user-name">{user?.name}</p>
              <p className="dash-user-email">{user?.email}</p>
            </div>
            <button type="button" className="ghost-btn" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
