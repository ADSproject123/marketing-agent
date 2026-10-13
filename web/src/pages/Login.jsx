import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import MarketingHeader from "../components/MarketingHeader";
import SiteFooter from "../components/SiteFooter";
import Icon from "../components/Icon";
import { Button, FormField, Input } from "../components/ui";
import { notify } from "../toast";

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      notify.error(String(err.message || err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell marketing-shell">
      <MarketingHeader />

      <main className="auth-main">
        <div className="auth-layout">
          <aside className="auth-story" aria-label="Your marketing workspace">
            <div className="auth-story-content">
              <span className="auth-story-icon" aria-hidden="true">
                <img src="/assets/logo/mark-white.svg" alt="" width="26" height="26" />
              </span>
              <p className="panel-kicker">Your creative workspace</p>
              <h2 className="auth-story-title">
                Great campaigns<br /> start here.
              </h2>
              <p className="auth-story-copy">
                Bring your ideas, content, and approvals together. Make room for the work that matters.
              </p>
              <ul className="auth-benefits">
                <li className="auth-benefit">
                  <Icon name="layers" size={20} />
                  <div>
                    <strong>One place for every campaign</strong>
                    <p>Keep your briefs and creative work organized.</p>
                  </div>
                </li>
                <li className="auth-benefit">
                  <Icon name="activity" size={20} />
                  <div>
                    <strong>Clarity at every step</strong>
                    <p>Follow progress from first draft to published post.</p>
                  </div>
                </li>
                <li className="auth-benefit">
                  <Icon name="circle-check" size={20} />
                  <div>
                    <strong>You make the final call</strong>
                    <p>Review and approve before anything goes live.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="auth-story-bottom">
              <Icon name="bolt" size={16} />
              <span>Less busywork. More creative momentum.</span>
            </div>
          </aside>

          <section className="auth-card" aria-labelledby="login-title">
            <div className="auth-card-brand">
              <Link to="/" aria-label="Rachana AI home">
                <img src="/assets/logo/logo-horizontal-light.svg" alt="Rachana AI" width="140" height="30" />
              </Link>
            </div>
            <p className="panel-kicker">Welcome back</p>
            <h1 id="login-title">
              Pick up where<br />you left off.
            </h1>
            <p className="auth-lede">Log in to your Rachana AI workspace.</p>

            <form className="auth-form" onSubmit={onSubmit} aria-busy={submitting}>
              <FormField label="Email address" required id="login-email">
                <Input
                  id="login-email"
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

              <FormField label="Password" required id="login-password">
                <Input
                  id="login-password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  icon="lock"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  placeholder="Enter your password"
                />
              </FormField>

              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={submitting}
                loadingText="Signing in…"
                icon="arrow-right"
                iconPosition="end"
                className="auth-submit"
              >
                Log in
              </Button>
            </form>

            <p className="auth-switch">
              New to Rachana AI? <Link to="/register">Create an account</Link>
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
