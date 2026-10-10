import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import MarketingHeader from "../components/MarketingHeader";
import SiteFooter from "../components/SiteFooter";

export default function Register() {
  const { register, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      navigate("/dashboard", { replace: true });
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
        <section className="auth-card" aria-labelledby="register-title">
          <p className="panel-kicker">Account</p>
          <h1 id="register-title">Create account</h1>
          <p className="auth-lede">
            Register to open the dashboard, start jobs, and track the live pipeline.
          </p>

          <form className="auth-form" onSubmit={onSubmit}>
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                autoComplete="name"
                required
                minLength={2}
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder="Your name"
              />
            </label>
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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                placeholder="At least 8 characters"
              />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(ev) => setConfirm(ev.target.value)}
                placeholder="Repeat password"
              />
            </label>

            {error ? <p className="auth-error">{error}</p> : null}

            <button type="submit" className="primary-btn auth-submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create account"}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
