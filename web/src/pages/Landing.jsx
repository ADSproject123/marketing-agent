import { Link } from "react-router-dom";
import MarketingHeader from "../components/MarketingHeader";
import SiteFooter from "../components/SiteFooter";

const FEATURES = [
  {
    title: "Template-led briefs",
    body: "Start from proven campaign templates or write a custom brief. Optional URLs and notes steer the agent.",
  },
  {
    title: "Gemini campaign craft",
    body: "The agent invents title, caption, and NotebookLM steering so you are not writing every line by hand.",
  },
  {
    title: "Vertical short video",
    body: "NotebookLM renders a TikTok-frame short from the campaign package — ready for social.",
  },
  {
    title: "Telegram approval gate",
    body: "Nothing publishes until you Approve or Deny in Telegram. Human control stays on the critical path.",
  },
];

const STEPS = [
  {
    title: "Compose",
    body: "Sign in, pick a template, and start a job from the dashboard workspace.",
  },
  {
    title: "Generate",
    body: "Gemini invents the package. NotebookLM builds the vertical short.",
  },
  {
    title: "Approve",
    body: "Preview lands in Telegram. Approve to publish, deny to stop.",
  },
  {
    title: "Publish",
    body: "On approve, the MP4 posts to your Facebook Page with the caption.",
  },
];

export default function Landing() {
  return (
    <div className="app-shell marketing-shell">
      <div className="atmosphere" aria-hidden="true" />
      <MarketingHeader />

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">Short-form marketing ops</p>
            <h1 className="brand" id="landing-title">
              Marketing Agent
            </h1>
            <p className="hero-line">
              From brief to vertical short — with Telegram deciding what ships.
            </p>
            <p className="hero-lede">
              A professional production desk for AI campaign videos. Compose in the
              dashboard, generate with Gemini and NotebookLM, approve in Telegram,
              publish to Facebook.
            </p>
            <div className="hero-actions">
              <Link className="primary-btn" to="/register">
                Create account
              </Link>
              <Link className="ghost-btn" to="/login">
                Log in to dashboard
              </Link>
            </div>
          </div>

          <aside className="landing-hero-panel" aria-label="Product snapshot">
            <p className="hero-aside-kicker">Live pipeline</p>
            <ul className="landing-pipeline">
              <li>
                <strong>System</strong>
                <span>Start job</span>
              </li>
              <li>
                <strong>Gemini</strong>
                <span>Campaign + caption</span>
              </li>
              <li>
                <strong>NotebookLM</strong>
                <span>Vertical short</span>
              </li>
              <li>
                <strong>Telegram</strong>
                <span>Approve / Deny</span>
              </li>
              <li>
                <strong>Facebook</strong>
                <span>Publish</span>
              </li>
            </ul>
          </aside>
        </section>

        <section className="landing-section" id="features" aria-labelledby="features-title">
          <div className="landing-section-head">
            <p className="panel-kicker">Product</p>
            <h2 id="features-title">Built like a real marketing system</h2>
            <p className="how-lede">
              Not a chatbot toy — a controlled pipeline from brief to publish with a
              human gate.
            </p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="feature-card">
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section" id="how" aria-labelledby="how-title">
          <div className="landing-section-head">
            <p className="panel-kicker">Process</p>
            <h2 id="how-title">How it works</h2>
            <p className="how-lede">
              Four stages. One dashboard. Telegram is the only approval gate.
            </p>
          </div>
          <ol className="how-grid">
            {STEPS.map((step, i) => (
              <li key={step.title} className="how-card">
                <span className="how-index" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-cta" id="workflow" aria-labelledby="cta-title">
          <div className="landing-cta-inner">
            <p className="panel-kicker">Ready</p>
            <h2 id="cta-title">Open the dashboard and start a campaign</h2>
            <p>
              Create an account to access Compose, live pipeline tracking, and job
              history.
            </p>
            <div className="hero-actions">
              <Link className="primary-btn" to="/register">
                Get started free
              </Link>
              <Link className="ghost-btn" to="/dashboard">
                Go to dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
