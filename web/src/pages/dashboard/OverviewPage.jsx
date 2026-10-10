import { Link } from "react-router-dom";
import { useAuth } from "../../auth";
import Icon from "../../components/Icon";
import { useDashboard } from "../../dashboard/DashboardContext";
import { ACTIVE_STATUSES, formatTime, stageForJob, STEPS } from "../../flow";

const SHORTCUTS = [
  { to: "/dashboard/compose", icon: "sparkles", title: "Create a campaign", note: "Turn your next idea into a video" },
  { to: "/dashboard/pipeline", icon: "activity", title: "Watch your pipeline", note: "Follow each step as it happens" },
  { to: "/dashboard/guide", icon: "book", title: "Explore the guide", note: "Get to know your campaign workflow" },
];

export default function OverviewPage() {
  const { user } = useAuth();
  const { jobs, jobsError, liveCount, activeJob, setActiveJobId, loadJobs } = useDashboard();
  const recent = jobs.slice(0, 5);
  const awaitingReview = jobs.filter((job) => job.status === "awaiting_approval").length;
  const completed = jobs.filter((job) => job.status === "posted").length;
  const activeStage = activeJob ? STEPS[stageForJob(activeJob)]?.title : null;
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const stats = [
    { label: "Recent campaigns", value: jobs.length, note: "Up to 20 most recent jobs", icon: "layers", tone: "blue" },
    { label: "In progress", value: liveCount, note: liveCount ? "Your agent is on it" : "Ready for your next campaign", icon: "activity", tone: "violet" },
    { label: "Awaiting review", value: awaitingReview, note: "Approve previews in Telegram", icon: "send", tone: "amber" },
    { label: "Completed", value: completed, note: "Finished jobs in recent history", icon: "circle-check", tone: "green" },
  ];

  return (
    <div className="dash-page overview-page">
      <header className="dash-page-head">
        <div>
          <p className="panel-kicker">Your workspace, at a glance</p>
          <h1>Welcome back{firstName ? `, ${firstName}` : ""}<span className="overview-greeting-dot">.</span></h1>
          <p className="dash-page-lede">A little less busywork. A lot more great content.</p>
        </div>
        <Link className="ghost-btn overview-guide-link" to="/dashboard/guide">
          <Icon name="book" size={17} /> Getting started <Icon name="arrow-up-right" size={16} />
        </Link>
      </header>

      {jobsError ? (
        <div className="overview-error" role="alert">
          <Icon name="alert" size={19} />
          <p>We couldn't refresh your campaigns. {jobsError}</p>
          <button type="button" className="ghost-btn" onClick={() => loadJobs()}><Icon name="refresh" size={16} /> Try again</button>
        </div>
      ) : null}

      <section className="overview-banner" aria-labelledby="overview-banner-title">
        <div className="overview-banner-copy">
          <span className="overview-banner-tag"><Icon name="sparkles" size={14} /> Your ideas. Your AI creative team.</span>
          <h2 id="overview-banner-title">Your next campaign starts with an idea.</h2>
          <p>Give your agent a brief. Get a caption and video, ready for your review.</p>
          <Link className="primary-btn" to="/dashboard/compose">Create a campaign <Icon name="arrow-right" size={17} /></Link>
        </div>
        <div className="overview-banner-visual" aria-hidden="true">
          <div className="overview-visual-orbit" />
          <span className="overview-visual-spark"><Icon name="sparkles" size={30} /></span>
          <div className="overview-visual-card overview-visual-brief"><span className="overview-visual-icon"><Icon name="file" size={18} /></span><div><strong>Your campaign brief</strong><span>One idea. Endless possibilities.</span></div><Icon name="check" size={17} /></div>
          <div className="overview-visual-card overview-visual-video"><span className="overview-visual-icon"><Icon name="video" size={20} /></span><div><strong>Made for your audience</strong><span>Caption + short-form video</span></div><span className="overview-visual-play"><Icon name="play" size={14} /></span></div>
          <span className="overview-visual-review"><Icon name="shield" size={14} /> You make the final call</span>
        </div>
      </section>

      <div className="overview-stats">
        {stats.map((stat) => (
          <article className="overview-stat" key={stat.label}>
            <div className="overview-stat-head"><p className="overview-stat-label">{stat.label}</p><span className={`overview-stat-icon is-${stat.tone}`}><Icon name={stat.icon} size={18} /></span></div>
            <p className="overview-stat-value">{jobsError && !jobs.length ? "—" : stat.value}</p>
            <p className="overview-stat-note">{stat.note}</p>
          </article>
        ))}
      </div>

      <div className="overview-grid">
        <section className="panel overview-spotlight">
          <div className="panel-head">
            <div><p className="panel-kicker">Keep things moving</p><h2>Campaign spotlight</h2></div>
            <Link className="overview-text-link" to="/dashboard/pipeline">View pipeline <Icon name="arrow-up-right" size={16} /></Link>
          </div>
          {activeJob ? (
            <div className="overview-active">
              <div className="overview-active-top"><span className={`job-status is-${activeJob.status}`}>{activeJob.status.replaceAll("_", " ")}</span><span className="job-id">#{activeJob.id.slice(0, 8)}</span></div>
              <h3 className="job-brief">{activeJob.title || activeJob.brief || "Untitled campaign"}</h3>
              <p className="job-meta"><Icon name="clock" size={14} /> Updated {formatTime(activeJob.updated_at || activeJob.created_at)}</p>
              <div className="overview-active-stage"><span><Icon name="activity" size={17} />{ACTIVE_STATUSES.has(activeJob.status) ? `Current step: ${activeStage || "In progress"}` : `Last step: ${activeStage || "Complete"}`}</span><Link to="/dashboard/pipeline">View details <Icon name="arrow-right" size={15} /></Link></div>
            </div>
          ) : (
            <div className="overview-spotlight-empty">
              <span className="overview-empty-icon"><Icon name="activity" size={24} /></span>
              <div><h3>A clear view of every step</h3><p>Your campaign's progress will appear here once you get started.</p></div>
            </div>
          )}
        </section>

        <section className="panel overview-shortcuts">
          <div className="panel-head"><div><p className="panel-kicker">Make your next move</p><h2>Quick actions</h2></div><Icon name="bolt" size={19} /></div>
          <div className="overview-links">
            {SHORTCUTS.map((item) => <Link key={item.to} to={item.to}><span className="overview-shortcut-icon"><Icon name={item.icon} size={19} /></span><span><strong>{item.title}</strong><small>{item.note}</small></span><Icon name="chevron-right" size={17} /></Link>)}
          </div>
        </section>
      </div>

      <section className="panel overview-history">
        <div className="panel-head">
          <div><p className="panel-kicker">Your creative output</p><h2>Recent campaigns</h2></div>
          <Link className="overview-text-link" to="/dashboard/jobs">View all campaigns <Icon name="arrow-right" size={16} /></Link>
        </div>
        {recent.length ? (
          <div className="overview-recent-wrap">
            <div className="overview-recent-heading" aria-hidden="true"><span>Campaign</span><span>Status</span><span>Last updated</span><span /></div>
            <ul className="overview-recent">
              {recent.map((job) => (
                <li key={job.id}>
                  <Link className="overview-recent-row" to="/dashboard/jobs" onClick={() => setActiveJobId(job.id)}>
                    <span className="overview-recent-name"><span className="overview-recent-icon"><Icon name="video" size={18} /></span><span><strong className="overview-recent-title">{job.title || job.brief || "Untitled campaign"}</strong><small className="job-id">#{job.id.slice(0, 8)}</small></span></span>
                    <span className={`job-status is-${job.status}`}>{job.status.replaceAll("_", " ")}</span>
                    <span className="overview-recent-time">{formatTime(job.updated_at || job.created_at)}</span>
                    <Icon name="arrow-up-right" size={17} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : jobsError ? (
          <p className="empty-panel">Your campaign history is temporarily unavailable.</p>
        ) : (
          <div className="overview-history-empty">
            <span className="overview-history-empty-art" aria-hidden="true"><Icon name="layers" size={30} /><span><Icon name="plus" size={14} /></span></span>
            <h3>Make something worth sharing.</h3>
            <p>Your campaigns will live here. Start with a brief and let your agent bring it to life.</p>
            <Link className="ghost-btn" to="/dashboard/compose"><Icon name="plus" size={16} /> Create your first campaign</Link>
          </div>
        )}
      </section>
      <p className="overview-footnote"><Icon name="shield" size={13} /> Every campaign is reviewed by you in Telegram before publishing.</p>
    </div>
  );
}
