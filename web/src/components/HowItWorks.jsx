import Icon from "./Icon";

const STEPS = [
  {
    title: "Start with your idea",
    icon: "file",
    body: "Choose a template or write a brief. Add source links and creative direction to make it your own.",
  },
  {
    title: "Let AI do the creative work",
    icon: "sparkles",
    body: "Gemini develops your campaign and caption. NotebookLM turns the concept into a vertical video.",
  },
  {
    title: "Review and approve",
    icon: "shield",
    body: "Get a preview in Telegram. Approve when it’s ready, or decline to stop the campaign.",
  },
  {
    title: "Share with your audience",
    icon: "globe",
    body: "After approval, your video and caption are published to your connected Facebook Page.",
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
          <p className="panel-kicker">A simpler creative workflow</p>
          <h2 id="how-title">Your next campaign, in four steps.</h2>
          <p className="how-lede">
            From your first idea to your audience’s feed, with a clear review step before publishing.
          </p>
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
