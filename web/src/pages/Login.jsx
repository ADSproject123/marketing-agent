import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import MarketingHeader from "../components/MarketingHeader";
import SiteFooter from "../components/SiteFooter";

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell marketing-shell">
      <div className="atmosphere" aria-hidden="true" />
      <MarketingHeader />

      <main className="auth-main">
        <section className="auth-card" aria-labelledby="login-title">
          <p className="panel-kicker">Account</p>
          <h1 id="login-title">Log in</h1>
          <p className="auth-lede">Access your campaign dashboard and live pipeline.</p>

          <form className="auth-form" onSubmit={onSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="you@company.com"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                placeholder="At least 8 characters"
              />
            </label>

            {error ? <p className="auth-error">{error}</p> : null}

            <button type="submit" className="primary-btn auth-submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Log in"}
            </button>
          </form>

          <p className="auth-switch">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
