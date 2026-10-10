const STEPS = [
  {
    title: "Compose a brief",
    body: "Choose a template or write your own. Optional URLs and notes steer the campaign.",
  },
  {
    title: "Agent generates",
    body: "Gemini invents the campaign package. NotebookLM builds a TikTok-frame vertical short.",
  },
  {
    title: "Approve in Telegram",
    body: "A preview lands in Telegram. Approve to publish, or deny to stop the job cold.",
  },
  {
    title: "Publish to Facebook",
    body: "On approve, the MP4 posts to your Facebook Page with the generated caption.",
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
          <p className="panel-kicker">System</p>
          <h2 id="how-title">How it works</h2>
          <p className="how-lede">
            The dashboard starts jobs. Telegram is the only approval gate. Nothing posts
            without your say.
          </p>
        </div>
      )}
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
  );
}
