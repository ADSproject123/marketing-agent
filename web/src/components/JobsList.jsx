import { formatTime } from "../flow";

export default function JobsList({ jobs, activeJobId, error, onSelect, onRefresh }) {
  return (
    <section className="panel jobs" id="jobs" aria-labelledby="jobs-title">
      <div className="jobs-head">
        <div>
          <p className="panel-kicker">Archive</p>
          <h2 id="jobs-title">Live jobs</h2>
        </div>
        <button type="button" className="ghost-btn" onClick={onRefresh}>
          Refresh
        </button>
      </div>
      <p className="jobs-note">
        Click a job to track it in the pipeline. Approve or deny only happens in Telegram.
      </p>

      <div className="jobs-list">
        {error ? <p className="jobs-error">Could not load jobs: {error}</p> : null}
        {!error && !jobs.length ? (
          <p className="empty-jobs">No jobs yet. Start one from Compose above.</p>
        ) : null}
        {!error
          ? jobs.map((job) => {
              const metaBits = [
                formatTime(job.updated_at || job.created_at),
                job.stage ? `stage: ${job.stage}` : null,
                job.video_path ? "video ready" : null,
                job.facebook_post_url ? "posted" : null,
                job.error ? "has error" : null,
              ].filter(Boolean);
              const selected = job.id === activeJobId ? "is-selected" : "";
              return (
                <article
                  key={job.id}
                  className={`job-row ${selected}`}
                  tabIndex={0}
                  role="button"
                  onClick={() => onSelect(job.id)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      onSelect(job.id);
                    }
                  }}
                >
                  <span className={`job-status is-${job.status}`}>
                    {job.status.replaceAll("_", " ")}
                  </span>
                  <div>
                    <p className="job-brief">{job.title || job.brief || "Untitled"}</p>
                    <p className="job-meta">{metaBits.join(" · ")}</p>
                  </div>
                  <span className="job-id">{job.id.slice(0, 8)}</span>
                </article>
              );
            })
          : null}
      </div>
    </section>
  );
}
