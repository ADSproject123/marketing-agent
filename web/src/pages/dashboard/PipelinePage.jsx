import { Link } from "react-router-dom";
import FlowDiagram from "../../components/FlowDiagram";
import Icon from "../../components/Icon";
import { useDashboard } from "../../dashboard/DashboardContext";

const STAGES = [
  {
    icon: "sparkles",
    title: "Campaign creation",
    body: "Your brief becomes a concept, caption, and video script with Gemini.",
  },
  {
    icon: "video",
    title: "Video generation",
    body: "NotebookLM brings the story to life as a short vertical video.",
  },
  {
    icon: "send",
    title: "Your review",
    body: "Check the preview in Telegram, then approve or decline the campaign.",
  },
  {
    icon: "globe",
    title: "Ready to share",
    body: "Approved campaigns publish to your connected Facebook Page.",
  },
];

export default function PipelinePage() {
  const { activeJob, pipelineBadge, jobsError } = useDashboard();

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <p className="panel-kicker">Follow the momentum</p>
          <h1>Live pipeline</h1>
          <p className="dash-page-lede">
            A clear view of your campaign, from the first idea to the final post.
          </p>
        </div>
        {pipelineBadge ? (
          <span className={`live-badge is-${pipelineBadge.kind}`}>
            {pipelineBadge.label === "live"
              ? "In progress"
              : pipelineBadge.label === "done"
                ? "Finished"
                : "Needs attention"}
          </span>
        ) : null}
      </header>

      <section className="panel live-flow" aria-label="Live campaign pipeline">
        <div className="live-flow-head">
          <div>
            <p className="panel-kicker">Campaign workflow</p>
            <h2>
              {activeJob?.title || activeJob?.brief || "From brief to your audience"}
            </h2>
          </div>
          {activeJob ? (
            <Link className="ghost-btn" to="/dashboard/jobs">
              Campaign details <Icon name="arrow-up-right" size={14} />
            </Link>
          ) : null}
        </div>
        <p className="live-flow-track" aria-live="polite">
          {activeJob
            ? `Tracking #${activeJob.id.slice(0, 8)} · ${activeJob.status.replaceAll("_", " ")}`
            : jobsError
              ? "Your campaign data is temporarily unavailable. Try refreshing your campaign history."
              : "Your campaign will appear here when you create it. Explore the workflow below."}
        </p>
        <div className="flow-shell">
          <FlowDiagram job={activeJob} />
        </div>
        <p className="pipeline-scroll-hint">
          <Icon name="arrow-right" size={13} /> Scroll across the workflow to explore every stage.
        </p>
        <p className="pipeline-note">
          <Icon name="shield" size={14} /> Publishing starts after your approval in Telegram.
        </p>
        {!activeJob ? (
          <div className="pipeline-empty-actions">
            <Link className="primary-btn" to="/dashboard/compose">
              <Icon name="plus" size={16} /> Create a campaign
            </Link>
            <Link className="text-link" to="/dashboard/jobs">
              View campaign history <Icon name="arrow-right" size={14} />
            </Link>
          </div>
        ) : null}
      </section>
      <div className="pipeline-steps">
        {STAGES.map((stage) => (
          <article className="pipeline-step" key={stage.title}>
            <Icon name={stage.icon} size={21} />
            <h3>{stage.title}</h3>
            <p>{stage.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
