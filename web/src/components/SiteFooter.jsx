import { Link } from "react-router-dom";
import Icon from "./Icon";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <Link className="site-footer-brand-link" to="/" aria-label="Marketing Agent home">
            <span className="site-logo-mark" aria-hidden="true">
              <Icon name="sparkles" size={18} />
            </span>
            <span className="site-footer-brand">Marketing Agent</span>
          </Link>
          <p className="site-footer-copy">
            From your next big idea to your next great campaign.
          </p>
        </div>
        <nav className="site-footer-links" aria-label="Footer">
          <a href="/#features">Product</a>
          <a href="/#how">How it works</a>
          <Link to="/dashboard">Workspace</Link>
          <Link to="/login">Log in</Link>
        </nav>
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} Marketing Agent</span>
        <span>A little less busywork. A lot more creativity.</span>
      </div>
    </footer>
  );
}
