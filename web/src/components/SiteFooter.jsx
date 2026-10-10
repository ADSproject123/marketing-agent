import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <p className="site-footer-brand">Marketing Agent</p>
          <p className="site-footer-copy">
            React dashboard + Telegram approval gate for short-form campaign production.
          </p>
        </div>
        <div className="site-footer-meta">
          <p>
            <Link to="/">Home</Link>
            {" · "}
            <Link to="/login">Log in</Link>
            {" · "}
            <Link to="/register">Register</Link>
            {" · "}
            <Link to="/dashboard">Dashboard</Link>
          </p>
          <p>
            Runtime: <code>python api/run.py</code>
          </p>
          <p>Gemini · NotebookLM · Telegram · Facebook</p>
        </div>
      </div>
    </footer>
  );
}
