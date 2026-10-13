import Icon from "./Icon";

const STEPS = [
  {
    title: "Choose a path",
    icon: "sparkles",
    body: "Make one video, or plan Mon / Wed / Fri.",
  },
  {
    title: "Brief and script",
    icon: "file",
    body: "Pick a business, fill a short brief, review the script.",
  },
  {
    title: "Generate",
    icon: "activity",
    body: "Follow progress on Live pipeline and History.",
  },
  {
    title: "Approve",
    icon: "shield",
    body: "Approve in the app before anything publishes.",
  },
];

export default function HowItWorks({ compact = false }) {
  return (
    <section
      className="how"
      id={compact ? undefined : "how"}
      aria-label={compact ? "How it works steps" : undefined}
      aria-labelledby={compact ? undefined : "how-title"}
    >
      {compact ? null : (
        <div className="how-head">
          <p className="panel-kicker">Workflow</p>
          <h2 id="how-title">Script → generate → approve</h2>
        </div>
      )}
      <ol className="how-grid">
        {STEPS.map((step, i) => (
          <li key={step.title} className="how-card">
            <span className="how-index" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="how-card-icon"><Icon name={step.icon} size={24} /></span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
