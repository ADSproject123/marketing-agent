import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import MarketingHeader from "../components/MarketingHeader";
import SiteFooter from "../components/SiteFooter";
import Icon from "../components/Icon";

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
    if (submitting) return;
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
      <MarketingHeader />

      <main className="auth-main">
        <div className="auth-layout">
          <aside className="auth-story" aria-label="Start creating with Marketing Agent">
            <div className="auth-story-content">
              <span className="auth-story-icon" aria-hidden="true"><Icon name="sparkles" size={27} /></span>
              <p className="panel-kicker">Meet your new creative partner</p>
              <h2 className="auth-story-title">Your ideas.<br /> A little more impact.</h2>
              <p className="auth-story-copy">Turn a simple brief into a campaign worth sharing, with a workspace that keeps everything moving.</p>
              <ul className="auth-benefits">
                <li className="auth-benefit">
                  <Icon name="file" size={20} />
                  <div><strong>Start with an idea</strong><p>Choose a template or bring your own brief.</p></div>
                </li>
                <li className="auth-benefit">
                  <Icon name="video" size={20} />
                  <div><strong>Let creativity take shape</strong><p>Generate campaign copy and short-form video.</p></div>
                </li>
                <li className="auth-benefit">
                  <Icon name="circle-check" size={20} />
                  <div><strong>Publish with confidence</strong><p>Review every campaign before it reaches your audience.</p></div>
                </li>
              </ul>
            </div>
            <div className="auth-story-bottom"><Icon name="bolt" size={16} /><span>From inspiration to publication, in one flow.</span></div>
          </aside>

          <section className="auth-card" aria-labelledby="register-title">
            <p className="panel-kicker">Let's get you started</p>
            <h1 id="register-title">Make space for<br />your next big idea.</h1>
            <p className="auth-lede">Create your account and open your workspace.</p>

            <form className="auth-form" onSubmit={onSubmit} aria-busy={submitting}>
              <label className="field">
                <span>Full name</span>
                <span className="input-wrap">
                  <span className="input-icon" aria-hidden="true"><Icon name="user" size={18} /></span>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    value={name}
                    onChange={(ev) => setName(ev.target.value)}
                    placeholder="Your name"
                  />
                </span>
              </label>
              <label className="field">
                <span>Email address</span>
                <span className="input-wrap">
                  <span className="input-icon" aria-hidden="true"><Icon name="mail" size={18} /></span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    placeholder="you@company.com"
                  />
                </span>
              </label>
              <label className="field">
                <span>Password</span>
                <span className="input-wrap">
                  <span className="input-icon" aria-hidden="true"><Icon name="lock" size={18} /></span>
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    placeholder="At least 8 characters"
                  />
                </span>
              </label>
              <label className="field">
                <span>Confirm password</span>
                <span className="input-wrap">
                  <span className="input-icon" aria-hidden="true"><Icon name="lock" size={18} /></span>
                  <input
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(ev) => setConfirm(ev.target.value)}
                    placeholder="Repeat password"
                  />
                </span>
              </label>

              {error ? <p className="auth-error" role="alert" aria-live="polite">{error}</p> : null}

              <button type="submit" className="primary-btn auth-submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create account"}
                {!submitting && <Icon name="arrow-right" size={18} />}
              </button>
            </form>

            <p className="auth-switch">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
