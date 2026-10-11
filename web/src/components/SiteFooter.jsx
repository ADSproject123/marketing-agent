import { Link } from "react-router-dom";
import Icon from "./Icon";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <Link className="site-footer-brand-link" to="/" aria-label="Rachana AI home">
            <img
              src="/assets/logo/logo-horizontal-light.svg"
              alt="Rachana AI"
              className="site-footer-logo-img"
              width="125"
              height="26"
            />
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
        <span>© {new Date().getFullYear()} Rachana AI</span>
        <span>A little less busywork. A lot more creativity.</span>
      </div>
    </footer>
  );
}
