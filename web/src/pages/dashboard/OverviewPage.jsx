import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import { Button, EmptyState, Panel, StatCard, StatusBadge } from "../../components/ui";
import { useDashboard } from "../../dashboard/DashboardContext";
import { ACTIVE_STATUSES, formatTime, stageForJob, STEPS } from "../../flow";

export default function OverviewPage() {
  const { jobs, jobsError, activeJob, setActiveJobId } = useDashboard();
  const recent = jobs.slice(0, 5);
  const awaitingReview = jobs.filter((job) => job.status === "awaiting_approval").length;
  const completed = jobs.filter((job) => job.status === "posted").length;
  const generating = jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).length;
  const activeStage = activeJob ? STEPS[stageForJob(activeJob)]?.title : null;

  const stats = [
    { label: "Videos", value: jobs.length, icon: "layers", tone: "blue" },
    { label: "Generating", value: generating, icon: "activity", tone: "violet" },
    { label: "Review", value: awaitingReview, icon: "send", tone: "amber" },
    { label: "Published", value: completed, icon: "circle-check", tone: "green" },
  ];

  return (
    <div className="dash-page overview-page">
      <h1 className="visually-hidden">Overview</h1>

      <Panel className="overview-hub" title="Start">
        <div className="overview-hub-grid">
          <Link className="overview-hub-card" to="/dashboard/compose">
            <span className="overview-hub-icon" aria-hidden="true">
              <Icon name="sparkles" size={22} />
            </span>
            <span className="overview-hub-copy">
              <strong>Make a video</strong>
            </span>
            <Icon name="arrow-right" size={18} />
          </Link>
          <Link className="overview-hub-card" to="/dashboard/weekly-plan">
            <span className="overview-hub-icon" aria-hidden="true">
              <Icon name="clock" size={22} />
            </span>
            <span className="overview-hub-copy">
              <strong>Plan my week</strong>
            </span>
            <Icon name="arrow-right" size={18} />
          </Link>
        </div>
      </Panel>

      <div className="overview-stats">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={jobsError && !jobs.length ? "—" : stat.value}
            icon={stat.icon}
            tone={stat.tone}
          />
        ))}
      </div>

      <div className="overview-grid">
        <Panel title="Active" className="overview-spotlight">
          {activeJob ? (
            <div className="overview-active">
              <div className="overview-active-top">
                <StatusBadge status={activeJob.status} />
                <span className="job-id">#{activeJob.id.slice(0, 8)}</span>
              </div>
              <h3 className="job-brief">{activeJob.title || activeJob.brief || "Untitled"}</h3>
              <p className="job-meta">
                <Icon name="clock" size={14} /> {formatTime(activeJob.updated_at || activeJob.created_at)}
              </p>
              <div className="overview-active-stage">
                <span>
                  <Icon name="activity" size={17} />
                  {ACTIVE_STATUSES.has(activeJob.status)
                    ? `Generating · ${activeStage || "In progress"}`
                    : activeStage || "Ready"}
                </span>
                <Link to="/dashboard/pipeline">
                  Open <Icon name="arrow-right" size={15} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="overview-spotlight-empty">
              <span className="overview-empty-icon">
                <Icon name="activity" size={24} />
              </span>
              <div>
                <h3>Nothing generating</h3>
                <p>Progress appears here when a video is running.</p>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Shortcuts" className="overview-shortcuts">
          <div className="overview-links">
            <Link to="/dashboard/pipeline">
              <span className="overview-shortcut-icon">
                <Icon name="activity" size={19} />
              </span>
              <span>
                <strong>Live pipeline</strong>
              </span>
              <Icon name="chevron-right" size={17} />
            </Link>
            <Link to="/dashboard/jobs">
              <span className="overview-shortcut-icon">
                <Icon name="layers" size={19} />
              </span>
              <span>
                <strong>History</strong>
              </span>
              <Icon name="chevron-right" size={17} />
            </Link>
            {/* <Link to="/dashboard/settings">
              <span className="overview-shortcut-icon">
                <Icon name="bolt" size={19} />
              </span>
              <span>
                <strong>Settings</strong>
              </span>
              <Icon name="chevron-right" size={17} />
            </Link> */}
          </div>
        </Panel>
      </div>

      <Panel
        title="Recent"
        action={
          <Link className="overview-text-link" to="/dashboard/jobs">
            All <Icon name="arrow-right" size={16} />
          </Link>
        }
        className="overview-history"
      >
        {recent.length ? (
          <div className="overview-recent-wrap">
            <div className="overview-recent-heading" aria-hidden="true">
              <span>Campaign</span>
              <span>Status</span>
              <span>Updated</span>
              <span />
            </div>
            <ul className="overview-recent">
              {recent.map((job) => (
                <li key={job.id}>
                  <Link
                    className="overview-recent-row"
                    to="/dashboard/jobs"
                    onClick={() => setActiveJobId(job.id)}
                  >
                    <span className="overview-recent-name">
                      <span className="overview-recent-icon">
                        <Icon name="video" size={18} />
                      </span>
                      <span>
                        <strong className="overview-recent-title">
                          {job.title || job.brief || "Untitled"}
                        </strong>
                        <small className="job-id">#{job.id.slice(0, 8)}</small>
                      </span>
                    </span>
                    <StatusBadge status={job.status} />
                    <span className="overview-recent-time">
                      {formatTime(job.updated_at || job.created_at)}
                    </span>
                    <Icon name="arrow-up-right" size={17} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState
            icon="layers"
            title="No campaigns yet"
            description="Start with Make a video or Plan my week above."
          />
        )}
      </Panel>
    </div>
  );
}
