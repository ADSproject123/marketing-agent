import FlowDiagram from "../../components/FlowDiagram";
import { useDashboard } from "../../dashboard/DashboardContext";

export default function PipelinePage() {
  const { activeJob, pipelineBadge } = useDashboard();

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <p className="panel-kicker">Live</p>
          <h1>Pipeline</h1>
          <p className="dash-page-lede">
            Track Gemini → NotebookLM → Telegram → Facebook for the selected job.
          </p>
        </div>
        {pipelineBadge ? (
          <span className={`live-badge is-${pipelineBadge.kind}`}>
            {pipelineBadge.label}
          </span>
        ) : null}
      </header>

      <section className="panel live-flow" aria-label="Live pipeline">
        <p className="live-flow-track">
          {!activeJob
            ? "Waiting for a job… Start one from Compose."
            : `Tracking ${activeJob.id.slice(0, 8)} · ${activeJob.status.replaceAll("_", " ")} · ${(
                activeJob.title ||
                activeJob.brief ||
                "Untitled"
              ).slice(0, 72)}`}
        </p>
        <div className="flow-shell">
          <FlowDiagram job={activeJob} />
        </div>
      </section>
    </div>
  );
}
