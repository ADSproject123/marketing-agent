import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth";
import { useDashboard } from "../dashboard/DashboardContext";
import Icon from "./Icon";

const NAV = [
  { to: "/dashboard", end: true, label: "Overview", icon: "grid" },
  { to: "/dashboard/compose", label: "Create campaign", icon: "sparkles" },
  { to: "/dashboard/pipeline", label: "Live pipeline", icon: "activity" },
  { to: "/dashboard/jobs", label: "Campaign history", icon: "layers" },
  // Integrations UI hidden for now — use server .env instead
  // { to: "/dashboard/settings", label: "Integrations", icon: "lock" },
  { to: "/dashboard/guide", label: "Getting started", icon: "book" },
];

export default function DashboardSidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const { liveCount } = useDashboard();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const sidebarRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const initials = (user?.name || user?.email || "You")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => {
      setIsMobile(media.matches);
      if (!media.matches) onCloseRef.current();
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open || !isMobile) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key !== "Tab") return;
      const focusable = sidebarRef.current?.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, isMobile]);

  return (
    <>
      <button
        type="button"
        className={`dash-sidebar-backdrop ${open ? "is-open" : ""}`}
        onClick={onClose}
        tabIndex={-1}
        aria-label="Close navigation"
        aria-hidden={!open}
      />
      <aside
        ref={sidebarRef}
        id="dashboard-navigation"
        className={`dash-sidebar ${open ? "is-open" : ""}`}
        aria-label="Workspace navigation"
        role={isMobile && open ? "dialog" : undefined}
        aria-modal={isMobile && open ? true : undefined}
        inert={isMobile && !open ? true : undefined}
      >
        <div className="dash-sidebar-brand">
          <NavLink to="/" className="site-logo" onClick={onClose}>
            <span className="site-logo-mark" aria-hidden="true"><Icon name="sparkles" size={21} /></span>
            <span className="site-logo-text">Marketing Agent<span className="dash-brand-suffix">AI campaign studio</span></span>
          </NavLink>
          <button
            ref={closeRef}
            type="button"
            className="dash-sidebar-close icon-btn"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <nav className="dash-side-nav" aria-label="Primary navigation">
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
              <Icon name={item.icon} size={19} />
              <span className="dash-side-label">{item.label}</span>
              {item.to === "/dashboard/pipeline" && liveCount > 0 ? (
                <span className="dash-side-count" aria-label={`${liveCount} live campaigns`}>{liveCount}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="dash-sidebar-foot">
          <div className="dash-sidebar-user">
            <span className="dash-user-avatar" aria-hidden="true">{initials}</span>
            <div className="dash-user-info">
              <p className="dash-user-name">{user?.name || "Your account"}</p>
              <p className="dash-user-email">{user?.email}</p>
            </div>
            <button type="button" className="dash-logout-btn icon-btn" onClick={logout} aria-label="Log out" title="Log out">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
