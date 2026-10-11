import FlowDiagram from "../../components/FlowDiagram";
import { useDashboard } from "../../dashboard/DashboardContext";

export default function PipelinePage() {
  const { activeJob, jobsError } = useDashboard();

  return (
    <section className="pipeline-canvas" aria-label="Campaign workflow">
      <FlowDiagram job={activeJob} fullscreen />
      <span className="visually-hidden" role="status">
        {jobsError
          ? "Campaign data is temporarily unavailable."
          : activeJob
            ? `Campaign ${activeJob.status.replaceAll("_", " ")}.`
            : "No campaign selected."}
      </span>
    </section>
  );
}
