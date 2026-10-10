import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import Icon from "./Icon";

export default function MarketingHeader() {
  const { isAuthenticated, user, logout } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  function onLogout() {
    logout();
    closeMenu();
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-logo" to="/" aria-label="Marketing Agent home" onClick={closeMenu}>
          <span className="site-logo-mark" aria-hidden="true">
            <Icon name="sparkles" size={19} />
          </span>
          <span className="site-logo-text">Marketing Agent</span>
        </Link>

        <button
          className="header-menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          aria-controls="marketing-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen ? "x" : "menu"} size={22} />
        </button>

        <div
          className={`header-navigation${menuOpen ? " is-open" : ""}`}
          id="marketing-navigation"
        >
          <nav className="site-nav" aria-label="Primary">
            <a href="/#features" onClick={closeMenu}>Product</a>
            <a href="/#how" onClick={closeMenu}>How it works</a>
            <NavLink to="/dashboard" onClick={closeMenu}>Workspace</NavLink>
          </nav>

          <div className="header-actions">
            {isAuthenticated ? (
              <>
                <span className="header-user">{user?.name}</span>
                <button type="button" className="ghost-btn" onClick={onLogout}>
                  Log out
                </button>
                <Link className="primary-btn header-cta" to="/dashboard" onClick={closeMenu}>
                  Open workspace <Icon name="arrow-right" size={16} />
                </Link>
              </>
            ) : (
              <>
                <NavLink className="ghost-btn" to="/login" onClick={closeMenu}>
                  Log in
                </NavLink>
                <NavLink className="primary-btn header-cta" to="/register" onClick={closeMenu}>
                  Get started <Icon name="arrow-right" size={16} />
                </NavLink>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
