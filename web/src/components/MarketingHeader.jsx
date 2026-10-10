import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth";

export default function MarketingHeader() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-logo" to="/" aria-label="Marketing Agent home">
          <span className="site-logo-mark" aria-hidden="true" />
          <span className="site-logo-text">Marketing Agent</span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          <a href="/#features">Features</a>
          <a href="/#how">How it works</a>
          <a href="/#workflow">Workflow</a>
        </nav>

        <div className="header-actions">
          {isAuthenticated ? (
            <>
              <span className="header-user">{user?.name}</span>
              <Link className="ghost-btn" to="/dashboard">
                Dashboard
              </Link>
              <button type="button" className="ghost-btn" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink className="ghost-btn" to="/login">
                Log in
              </NavLink>
              <NavLink className="primary-btn header-cta" to="/register">
                Get started
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
