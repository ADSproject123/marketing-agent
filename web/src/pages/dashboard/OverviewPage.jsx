import { Link } from "react-router-dom";
import { useAuth } from "../../auth";
import { useDashboard } from "../../dashboard/DashboardContext";
import { formatTime } from "../../flow";

export default function OverviewPage() {
  const { user } = useAuth();
  const { online, jobs, liveCount, activeJob, pipelineBadge } = useDashboard();
  const recent = jobs.slice(0, 5);

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <p className="panel-kicker">Overview</p>
          <h1>Welcome back{user?.name ? `, ${user.name}` : ""}</h1>
          <p className="dash-page-lede">
            Start a campaign, track the live pipeline, and review job history from the
            sidebar.
          </p>
        </div>
        <Link className="primary-btn" to="/dashboard/compose">
          Start a job
        </Link>
      </header>

      <div className="overview-stats">
        <article className="overview-stat">
          <p className="overview-stat-label">Runtime</p>
          <p className="overview-stat-value">{online ? "Online" : "Offline"}</p>
        </article>
        <article className="overview-stat">
          <p className="overview-stat-label">Live jobs</p>
          <p className="overview-stat-value">{liveCount}</p>
        </article>
        <article className="overview-stat">
          <p className="overview-stat-label">Total jobs</p>
          <p className="overview-stat-value">{jobs.length}</p>
        </article>
        <article className="overview-stat">
          <p className="overview-stat-label">Active track</p>
          <p className="overview-stat-value">
            {pipelineBadge ? pipelineBadge.label : "idle"}
          </p>
        </article>
      </div>

      <div className="overview-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Now</p>
              <h2>Active job</h2>
            </div>
            <Link className="ghost-btn" to="/dashboard/pipeline">
              Open pipeline
            </Link>
          </div>
          {activeJob ? (
            <div className="overview-active">
              <span className={`job-status is-${activeJob.status}`}>
                {activeJob.status.replaceAll("_", " ")}
              </span>
              <p className="job-brief">
                {activeJob.title || activeJob.brief || "Untitled"}
              </p>
              <p className="job-meta">
                {formatTime(activeJob.updated_at || activeJob.created_at)} ·{" "}
                {activeJob.id.slice(0, 8)}
              </p>
            </div>
          ) : (
            <p className="empty-panel">No active job. Compose a campaign to begin.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Shortcuts</p>
              <h2>Go to</h2>
            </div>
          </div>
          <div className="overview-links">
            <Link to="/dashboard/compose">Compose a new job</Link>
            <Link to="/dashboard/pipeline">Watch live pipeline</Link>
            <Link to="/dashboard/jobs">Browse job history</Link>
            <Link to="/dashboard/guide">Read the system guide</Link>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Recent</p>
            <h2>Latest jobs</h2>
          </div>
          <Link className="ghost-btn" to="/dashboard/jobs">
            View all
          </Link>
        </div>
        {recent.length ? (
          <ul className="overview-recent">
            {recent.map((job) => (
              <li key={job.id}>
                <span className={`job-status is-${job.status}`}>
                  {job.status.replaceAll("_", " ")}
                </span>
                <span className="overview-recent-title">
                  {job.title || job.brief || "Untitled"}
                </span>
                <span className="job-id">{job.id.slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-panel">No jobs yet.</p>
        )}
      </section>
    </div>
  );
}
