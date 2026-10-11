import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import { Alert, Button, EmptyState, Panel, StatCard, StatusBadge } from "../../components/ui";
import { useDashboard } from "../../dashboard/DashboardContext";
import { ACTIVE_STATUSES, formatTime, stageForJob, STEPS } from "../../flow";

const SHORTCUTS = [
  { to: "/dashboard/compose", icon: "sparkles", title: "Create a campaign", note: "Turn your next idea into a video" },
  { to: "/dashboard/pipeline", icon: "activity", title: "Watch your pipeline", note: "Follow each step as it happens" },
  { to: "/dashboard/guide", icon: "book", title: "Explore the guide", note: "Get to know your campaign workflow" },
];

export default function OverviewPage() {
  const { jobs, jobsError, liveCount, activeJob, setActiveJobId, loadJobs } = useDashboard();
  const recent = jobs.slice(0, 5);
  const awaitingReview = jobs.filter((job) => job.status === "awaiting_approval").length;
  const completed = jobs.filter((job) => job.status === "posted").length;
  const activeStage = activeJob ? STEPS[stageForJob(activeJob)]?.title : null;

  const stats = [
    { label: "Recent campaigns", value: jobs.length, note: "Up to 20 most recent jobs", icon: "layers", tone: "blue" },
    { label: "In progress", value: liveCount, note: liveCount ? "Your agent is on it" : "Ready for your next campaign", icon: "activity", tone: "violet" },
    { label: "Awaiting review", value: awaitingReview, note: "Approve previews in Telegram", icon: "send", tone: "amber" },
    { label: "Completed", value: completed, note: "Finished jobs in recent history", icon: "circle-check", tone: "green" },
  ];

  return (
    <div className="dash-page overview-page">
      <h1 className="visually-hidden">Overview</h1>

      {jobsError ? (
        <Alert
          tone="warning"
          title="Couldn't refresh your campaigns"
          action={
            <Button variant="ghost" size="xs" icon="refresh" onClick={() => loadJobs()}>
              Try again
            </Button>
          }
          className="overview-alert-banner"
        >
          {jobsError}
        </Alert>
      ) : null}

      <div className="overview-stats">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={jobsError && !jobs.length ? "—" : stat.value}
            note={stat.note}
            icon={stat.icon}
            tone={stat.tone}
          />
        ))}
      </div>

      <div className="overview-grid">
        <Panel
          kicker="Keep things moving"
          title="Campaign spotlight"
          action={
            <Link className="overview-text-link" to="/dashboard/pipeline">
              View pipeline <Icon name="arrow-up-right" size={16} />
            </Link>
          }
          className="overview-spotlight"
        >
          {activeJob ? (
            <div className="overview-active">
              <div className="overview-active-top">
                <StatusBadge status={activeJob.status} />
                <span className="job-id">#{activeJob.id.slice(0, 8)}</span>
              </div>
              <h3 className="job-brief">{activeJob.title || activeJob.brief || "Untitled campaign"}</h3>
              <p className="job-meta">
                <Icon name="clock" size={14} /> Updated {formatTime(activeJob.updated_at || activeJob.created_at)}
              </p>
              <div className="overview-active-stage">
                <span>
                  <Icon name="activity" size={17} />
                  {ACTIVE_STATUSES.has(activeJob.status)
                    ? `Current step: ${activeStage || "In progress"}`
                    : `Last step: ${activeStage || "Complete"}`}
                </span>
                <Link to="/dashboard/pipeline">
                  View details <Icon name="arrow-right" size={15} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="overview-spotlight-empty">
              <span className="overview-empty-icon">
                <Icon name="activity" size={24} />
              </span>
              <div>
                <h3>A clear view of every step</h3>
                <p>Your campaign's progress will appear here once you get started.</p>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          kicker="Make your next move"
          title="Quick actions"
          action={<Icon name="bolt" size={19} />}
          className="overview-shortcuts"
        >
          <div className="overview-links">
            {SHORTCUTS.map((item) => (
              <Link key={item.to} to={item.to}>
                <span className="overview-shortcut-icon">
                  <Icon name={item.icon} size={19} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.note}</small>
                </span>
                <Icon name="chevron-right" size={17} />
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        kicker="Your creative output"
        title="Recent campaigns"
        action={
          <Link className="overview-text-link" to="/dashboard/jobs">
            View all campaigns <Icon name="arrow-right" size={16} />
          </Link>
        }
        className="overview-history"
      >
        {recent.length ? (
          <div className="overview-recent-wrap">
            <div className="overview-recent-heading" aria-hidden="true">
              <span>Campaign</span>
              <span>Status</span>
              <span>Last updated</span>
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
                          {job.title || job.brief || "Untitled campaign"}
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
        ) : jobsError ? (
          <p className="empty-panel">Your campaign history is temporarily unavailable.</p>
        ) : (
          <EmptyState
            icon="layers"
            title="Make something worth sharing"
            description="Your campaigns will live here. Start with a brief and let your agent bring it to life."
            action={
              <Button to="/dashboard/compose" variant="ghost" size="sm" icon="plus">
                Create your first campaign
              </Button>
            }
          />
        )}
      </Panel>
    </div>
  );
}
