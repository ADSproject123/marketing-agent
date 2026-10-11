import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import MarketingHeader from "../components/MarketingHeader";
import SiteFooter from "../components/SiteFooter";
import Icon from "../components/Icon";
import { Alert, Button, FormField, Input } from "../components/ui";

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
          <aside className="auth-story" aria-label="Start creating with Rachana AI">
            <div className="auth-story-content">
              <span className="auth-story-icon" aria-hidden="true">
                <img src="/assets/logo/mark-white.svg" alt="" width="26" height="26" />
              </span>
              <p className="panel-kicker">Meet your new creative partner</p>
              <h2 className="auth-story-title">
                Your ideas.<br /> A little more impact.
              </h2>
              <p className="auth-story-copy">
                Turn a simple brief into a campaign worth sharing, with a workspace that keeps everything moving.
              </p>
              <ul className="auth-benefits">
                <li className="auth-benefit">
                  <Icon name="file" size={20} />
                  <div>
                    <strong>Start with an idea</strong>
                    <p>Choose a template or bring your own brief.</p>
                  </div>
                </li>
                <li className="auth-benefit">
                  <Icon name="video" size={20} />
                  <div>
                    <strong>Let creativity take shape</strong>
                    <p>Generate campaign copy and short-form video.</p>
                  </div>
                </li>
                <li className="auth-benefit">
                  <Icon name="circle-check" size={20} />
                  <div>
                    <strong>Publish with confidence</strong>
                    <p>Review every campaign before it reaches your audience.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="auth-story-bottom">
              <Icon name="bolt" size={16} />
              <span>From inspiration to publication, in one flow.</span>
            </div>
          </aside>

          <section className="auth-card" aria-labelledby="register-title">
            <div className="auth-card-brand">
              <Link to="/" aria-label="Rachana AI home">
                <img src="/assets/logo/logo-horizontal-light.svg" alt="Rachana AI" width="140" height="30" />
              </Link>
            </div>
            <p className="panel-kicker">Let's get you started</p>
            <h1 id="register-title">
              Make space for<br />your next big idea.
            </h1>
            <p className="auth-lede">Create your account and open your workspace.</p>

            <form className="auth-form" onSubmit={onSubmit} aria-busy={submitting}>
              <FormField label="Full name" required id="reg-name">
                <Input
                  id="reg-name"
                  type="text"
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  icon="user"
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  placeholder="Your name"
                />
              </FormField>

              <FormField label="Email address" required id="reg-email">
                <Input
                  id="reg-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  icon="mail"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="you@company.com"
                />
              </FormField>

              <FormField label="Password" required id="reg-password">
                <Input
                  id="reg-password"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  icon="lock"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  placeholder="At least 8 characters"
                />
              </FormField>

              <FormField label="Confirm password" required id="reg-confirm">
                <Input
                  id="reg-confirm"
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  icon="lock"
                  value={confirm}
                  onChange={(ev) => setConfirm(ev.target.value)}
                  placeholder="Repeat password"
                />
              </FormField>

              {error ? (
                <Alert tone="danger" role="alert">
                  {error}
                </Alert>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={submitting}
                loadingText="Creating account…"
                icon="arrow-right"
                iconPosition="end"
                className="auth-submit"
              >
                Create account
              </Button>
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
