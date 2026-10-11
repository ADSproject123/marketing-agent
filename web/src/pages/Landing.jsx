import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import MarketingHeader from "../components/MarketingHeader";
import SiteFooter from "../components/SiteFooter";

const FEATURES = [
  {
    icon: "layers",
    title: "A better starting point",
    body: "Choose a campaign template, add your ideas, and turn a blank page into a clear creative brief.",
    tag: "Campaign templates",
  },
  {
    icon: "sparkles",
    title: "Let your ideas take shape",
    body: "Generate a campaign concept, social caption, and video script from one brief with Gemini.",
    tag: "AI campaign creation",
  },
  {
    icon: "video",
    title: "Made for the scroll",
    body: "Bring your campaign to life as a short vertical video, built for social with NotebookLM.",
    tag: "Short-form video",
  },
  {
    icon: "shield",
    title: "Your brand. Your call.",
    body: "Review the preview in Telegram. Approve when it feels right, then publish to your Facebook Page.",
    tag: "Human approval",
  },
];

const STEPS = [
  {
    title: "Make it a brief",
    body: "Start with a template or an idea. Add the context that makes your brand unique.",
    icon: "file",
  },
  {
    title: "Give it some motion",
    body: "Your agent creates the campaign, caption, and a short vertical video.",
    icon: "sparkles",
  },
  {
    title: "Have the final say",
    body: "Review your video in Telegram. Approve it to continue, or decline it.",
    icon: "shield",
  },
  {
    title: "Meet your audience",
    body: "Your approved video and caption publish to your connected Facebook Page.",
    icon: "globe",
  },
];

function ProductPreview() {
  return (
    <div
      className="product-preview"
      aria-label="Illustrative campaign workspace preview"
    >
      <div className="preview-chrome">
        <span className="preview-dots">
          <i />
          <i />
          <i />
        </span>
        <span>
          <Icon name="lock" size={11} /> Your campaign workspace
        </span>
        <span className="preview-sample">Preview</span>
      </div>
      <div className="preview-app">
        <div className="preview-sidebar" aria-hidden="true">
          <span className="preview-brand">
            <img src="/assets/logo/mark-white.svg" alt="" width="17" height="17" />
          </span>
          <span className="preview-nav is-active">
            <Icon name="grid" size={17} />
          </span>
          <span className="preview-nav">
            <Icon name="layers" size={17} />
          </span>
          <span className="preview-nav">
            <Icon name="activity" size={17} />
          </span>
          <span className="preview-nav">
            <Icon name="clock" size={17} />
          </span>
          <span className="preview-avatar">R</span>
        </div>
        <div className="preview-content">
          <div className="preview-heading">
            <div>
              <span className="preview-overline">YOUR WORKSPACE</span>
              <h3>Let’s make something great.</h3>
            </div>
            <span className="preview-new">
              <Icon name="plus" size={12} /> New campaign
            </span>
          </div>
          <div className="preview-summary">
            <div>
              <span>
                <i className="status-dot" /> Creative brief
              </span>
              <strong>Spring collection</strong>
              <small>A fresh season. A fresh perspective.</small>
            </div>
            <span className="preview-status">Ready for review</span>
          </div>
          <div className="preview-creation">
            <div className="preview-video">
              <span className="preview-video-label">
                NEW SEASON / NEW POSSIBILITIES
              </span>
              <div className="preview-orbit orbit-one" />
              <div className="preview-orbit orbit-two" />
              <div className="preview-orbit orbit-three" />
              <strong>
                Make room<br />for a little<br /><em>new.</em>
              </strong>
              <span className="preview-play">
                <Icon name="play" size={16} />
              </span>
              <span className="preview-video-duration">
                0:30 <span>9:16</span>
              </span>
            </div>
            <div className="preview-progress">
              <span className="preview-overline">CAMPAIGN PROGRESS</span>
              <div className="preview-stage is-complete">
                <span>
                  <Icon name="check" size={13} />
                </span>
                <div>
                  <strong>Brief created</strong>
                  <small>Your idea, ready to go</small>
                </div>
              </div>
              <div className="preview-stage is-complete">
                <span>
                  <Icon name="check" size={13} />
                </span>
                <div>
                  <strong>Content generated</strong>
                  <small>Campaign & caption</small>
                </div>
              </div>
              <div className="preview-stage is-complete">
                <span>
                  <Icon name="check" size={13} />
                </span>
                <div>
                  <strong>Video ready</strong>
                  <small>Made for your audience</small>
                </div>
              </div>
              <div className="preview-stage is-current">
                <span>
                  <Icon name="send" size={13} />
                </span>
                <div>
                  <strong>Awaiting your approval</strong>
                  <small>Review in Telegram</small>
                </div>
              </div>
              <div className="preview-approval">
                <Icon name="shield" size={14} />
                <span>You’re always in control.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="preview-floating">
        <span className="preview-floating-icon">
          <img src="/assets/icons/icon-square-purple-192.png" alt="" width="24" height="24" style={{ borderRadius: 6, display: "block" }} />
        </span>
        <div>
          <strong>From idea to ready-to-review.</strong>
          <span>One connected workflow.</span>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="app-shell marketing-shell">
      <MarketingHeader />
      <main className="landing-main" id="main-content">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">
              <span className="landing-eyebrow-mark">
                <img src="/assets/logo/mark-purple.svg" alt="" width="14" height="14" />
              </span>{" "}
              Your AI marketing workspace <Icon name="arrow-right" size={13} />
            </p>
            <h1 id="landing-title">
              Your next campaign.<br /><span>Already in motion.</span>
            </h1>
            <p className="hero-lede">
              Turn your ideas into scroll-stopping videos. Create, review, and publish
              from one connected workspace—with you in control.
            </p>
            <div className="hero-actions">
              <Link className="primary-btn" to="/register">
                Start creating <Icon name="arrow-right" size={17} />
              </Link>
              <a className="ghost-btn" href="#how">
                <Icon name="play" size={15} /> See how it works
              </a>
            </div>
            <div className="hero-assurances">
              <span>
                <Icon name="check" size={14} /> Template to video
              </span>
              <span>
                <Icon name="check" size={14} /> Approve before publishing
              </span>
            </div>
          </div>
          <ProductPreview />
        </section>
        <section className="integration-strip" aria-label="Connected workflow tools">
          <p>
            Your creative workflow,<br /><strong>connected.</strong>
          </p>
          <div className="integration-logos">
            <span><Icon name="sparkles" /> Gemini</span>
            <span><Icon name="book" /> NotebookLM</span>
            <span><Icon name="send" /> Telegram</span>
            <span>
              <span className="facebook-symbol" aria-hidden="true">f</span> Facebook
            </span>
          </div>
        </section>
        <section
          className="landing-section"
          id="features"
          aria-labelledby="features-title"
        >
          <div className="landing-section-head">
            <p className="panel-kicker">LESS BUSYWORK. MORE CREATING.</p>
            <h2 id="features-title">Everything your next campaign needs.</h2>
            <p>
              A thoughtful workflow that takes care of the steps between your idea
              and your audience.
            </p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="feature-card">
                <span className={`feature-icon feature-icon-${feature.icon}`}>
                  <Icon name={feature.icon} size={23} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
                <span className="feature-tag">{feature.tag}</span>
              </article>
            ))}
          </div>
        </section>
        <section
          className="landing-section process-section"
          id="how"
          aria-labelledby="how-title"
        >
          <div className="landing-section-head">
            <p className="panel-kicker">A SIMPLE WAY TO SHIP</p>
            <h2 id="how-title">One idea. Four steps. Ready to share.</h2>
            <p>Keep the creative momentum. Your agent handles the handoffs.</p>
          </div>
          <ol className="landing-process">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <div className="process-step-top">
                  <span className="process-number">0{index + 1}</span>
                  <Icon name={step.icon} size={20} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="landing-cta" aria-labelledby="cta-title">
          <div className="landing-cta-inner">
            <span className="cta-icon">
              <Icon name="sparkles" size={27} />
            </span>
            <div>
              <p className="panel-kicker">MAKE YOUR NEXT MOVE</p>
              <h2 id="cta-title">Big ideas deserve to get out there.</h2>
              <p>Your next campaign starts with a little inspiration.</p>
            </div>
            <Link className="primary-btn" to="/register">
              Create your workspace <Icon name="arrow-right" size={17} />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
