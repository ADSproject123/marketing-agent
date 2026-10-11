import { Link } from "react-router-dom";
import { formatTime } from "../flow";
import Icon from "./Icon";

export default function JobsList({ jobs, activeJobId, error, onSelect, onRefresh }) {
  return (
    <section className="panel jobs" id="jobs" aria-labelledby="jobs-title">
      <div className="jobs-head">
        <div>
          <p className="panel-kicker">Campaign history</p>
          <h2 id="jobs-title">All campaigns <span className="jobs-count">{jobs.length}</span></h2>
        </div>
        <button type="button" className="ghost-btn" onClick={onRefresh}>
          <Icon name="refresh" size={15} />
          Refresh
        </button>
      </div>
      <p className="jobs-note">
        Select a campaign to review its script, preview the video, or make a revision. Publishing approvals happen in Telegram.
      </p>

      <div className="jobs-list">
        {error ? <p className="jobs-error" role="alert"><Icon name="alert" size={18} /> Could not load campaigns: {error}</p> : null}
        {!error && !jobs.length ? (
          <div className="empty-state empty-jobs">
            <span className="empty-state-icon"><Icon name="layers" size={25} /></span>
            <h3 className="empty-state-title">Your first campaign starts here</h3>
            <p className="empty-state-text">Create a brief and we’ll turn it into a video. Your campaigns will appear here as they progress.</p>
            <Link className="primary-btn" to="/dashboard/compose"><Icon name="plus" size={16} /> Create a campaign</Link>
          </div>
        ) : null}
        {!error
          ? jobs.map((job) => {
              const metaBits = [
                formatTime(job.updated_at || job.created_at),
                job.video_path ? "Video ready" : null,
                job.facebook_post_url ? "Published" : null,
                job.error ? "Needs attention" : null,
              ].filter(Boolean);
              const selected = job.id === activeJobId ? "is-selected" : "";
              return (
                <button
                  key={job.id}
                  type="button"
                  className={`job-row ${selected}`}
                  aria-pressed={Boolean(selected)}
                  onClick={() => onSelect(job.id)}
                >
                  <span className="job-row-icon"><Icon name="video" size={19} /></span>
                  <span className="job-row-main">
                    <span className="job-brief">{job.title || job.brief || "Untitled campaign"}</span>
                    <span className="job-meta">{metaBits.join(" · ")}</span>
                  </span>
                  <span className="job-row-end">
                    <span className={`job-status is-${job.status}`}>
                      {job.status.replaceAll("_", " ")}
                    </span>
                    <span className="job-id">{job.id.slice(0, 8)}</span>
                  </span>
                  <span className="job-row-chevron"><Icon name="chevron-right" size={17} /></span>
                </button>
              );
            })
          : null}
      </div>
    </section>
  );
}
