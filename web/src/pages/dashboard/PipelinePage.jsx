import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import FlowDiagram from "../../components/FlowDiagram";
import Icon from "../../components/Icon";
import { StatusBadge } from "../../components/ui";
import { useDashboard } from "../../dashboard/DashboardContext";
import { ACTIVE_STATUSES, formatTime, stageForJob, STEPS } from "../../flow";

function jobLabel(job) {
  const raw = String(job.title || job.brief || "Untitled").trim();
  const firstLine = raw.split(/\n/)[0] || "Untitled";
  return firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
}

export default function PipelinePage() {
  const { jobs, activeJob, activeJobId, setActiveJobId, jobsError } = useDashboard();

  const liveJobs = useMemo(
    () => jobs.filter((job) => ACTIVE_STATUSES.has(job.status)),
    [jobs],
  );

  // Prefer a live job when the current selection is finished or missing.
  useEffect(() => {
    if (!liveJobs.length) return;
    const selectedIsLive = liveJobs.some((job) => job.id === activeJobId);
    if (!selectedIsLive) setActiveJobId(liveJobs[0].id);
  }, [liveJobs, activeJobId, setActiveJobId]);

  const selected = liveJobs.find((job) => job.id === activeJobId) || activeJob;
  const generating = selected && ACTIVE_STATUSES.has(selected.status);
  const stage = selected ? STEPS[stageForJob(selected)] : null;

  return (
    <section className="pipeline-page" aria-label="Campaign workflow">
      <aside className="pipeline-queue" aria-label="Videos in progress">
        <div className="pipeline-queue-head">
          <div>
            <p className="panel-kicker">Live</p>
            <h2>In progress</h2>
          </div>
          <span className="pipeline-queue-count">{liveJobs.length}</span>
        </div>

        {liveJobs.length ? (
          <ul className="pipeline-queue-list">
            {liveJobs.map((job) => {
              const selectedJob = job.id === selected?.id;
              const jobStage = STEPS[stageForJob(job)];
              return (
                <li key={job.id}>
                  <button
                    type="button"
                    className={`pipeline-queue-item ${selectedJob ? "is-selected" : ""}`}
                    onClick={() => setActiveJobId(job.id)}
                    aria-current={selectedJob ? "true" : undefined}
                  >
                    <span className="pipeline-queue-item-top">
                      <StatusBadge status={job.status} size="sm" />
                      <span className="job-id">#{job.id.slice(0, 8)}</span>
                    </span>
                    <strong className="pipeline-queue-title">{jobLabel(job)}</strong>
                    <span className="pipeline-queue-meta">
                      <Icon name="activity" size={13} />
                      {jobStage?.title || "Working"}
                      <span aria-hidden="true">·</span>
                      {formatTime(job.updated_at || job.created_at)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="pipeline-queue-empty">
            <p>No videos generating right now.</p>
            <Link to="/dashboard/compose" className="text-link">
              Make a video <Icon name="arrow-right" size={14} />
            </Link>
          </div>
        )}

        <Link to="/dashboard/jobs" className="pipeline-queue-history">
          History <Icon name="arrow-up-right" size={14} />
        </Link>
      </aside>

      <div className="pipeline-canvas" aria-label="Selected campaign flow">
        {selected ? (
          <div className="pipeline-canvas-meta">
            <StatusBadge status={selected.status} size="sm" />
            <span className="pipeline-canvas-title">{jobLabel(selected)}</span>
            {stage ? (
              <span className="pipeline-canvas-stage">
                {generating ? "Generating · " : ""}
                {stage.title}
              </span>
            ) : null}
          </div>
        ) : null}
        <FlowDiagram job={selected} fullscreen />
      </div>

      <span className="visually-hidden" role="status">
        {jobsError
          ? "Campaign data is temporarily unavailable."
          : liveJobs.length
            ? `${liveJobs.length} video${liveJobs.length === 1 ? "" : "s"} in progress.`
            : "No videos in the pipeline."}
      </span>
    </section>
  );
}
