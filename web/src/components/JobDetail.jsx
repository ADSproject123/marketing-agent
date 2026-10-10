import { Link } from "react-router-dom";
import { formatTime, liveDetailFor, stageForJob, STEPS } from "../flow";
import Icon from "./Icon";

export default function JobDetail({ job }) {
  if (!job) {
    return (
      <section className="panel job-detail" aria-labelledby="detail-title">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Campaign details</p>
            <h2 id="detail-title">A closer look</h2>
          </div>
        </div>
        <div className="empty-state empty-panel">
          <span className="empty-state-icon"><Icon name="file" size={24} /></span>
          <h3 className="empty-state-title">Every detail, in one place</h3>
          <p className="empty-state-text">Select a campaign to view its progress, generated caption, and publishing details.</p>
          <Link className="text-link" to="/dashboard/compose">Create a campaign <Icon name="arrow-right" size={15} /></Link>
        </div>
      </section>
    );
  }

  const stage = stageForJob(job);
  const stageTitle = stage && STEPS[stage] ? STEPS[stage].title : "—";
  const stageDetail = stage ? liveDetailFor(job, stage) : "";

  return (
    <section className="panel job-detail" aria-labelledby="detail-title">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">Campaign details</p>
          <h2 id="detail-title">{job.title || job.brief || "Untitled campaign"}</h2>
        </div>
        <span className={`job-status is-${job.status}`}>
          {job.status.replaceAll("_", " ")}
        </span>
      </div>

      <dl className="detail-grid">
        <div>
          <dt>Campaign ID</dt>
          <dd className="mono">{job.id}</dd>
        </div>
        <div>
          <dt>Current stage</dt>
          <dd>
            {stageTitle}
            {stageDetail ? <span className="detail-sub">{stageDetail}</span> : null}
          </dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{formatTime(job.updated_at || job.created_at)}</dd>
        </div>
        <div>
          <dt>Source count</dt>
          <dd>{job.source_count ?? 0}</dd>
        </div>
        {job.caption ? (
          <div className="detail-span">
            <dt className="detail-caption-head"><Icon name="file" size={15} /> Generated caption</dt>
            <dd className="detail-caption">{job.caption}</dd>
          </div>
        ) : null}
        {job.video_path ? (
          <div className="detail-span">
            <dt>Generated video</dt>
            <dd>
              <span className="detail-preview"><Icon name="circle-check" size={18} /> Video generated</span>
              <span className="detail-sub mono">{job.video_path}</span>
            </dd>
          </div>
        ) : null}
        {job.facebook_post_url ? (
          <div className="detail-span">
            <dt>Published campaign</dt>
            <dd>
              <a className="text-link" href={job.facebook_post_url} target="_blank" rel="noreferrer">
                View on Facebook <Icon name="arrow-up-right" size={15} />
              </a>
            </dd>
          </div>
        ) : null}
        {job.error ? (
          <div className="detail-span">
            <dt>Needs attention</dt>
            <dd className="detail-error" role="alert">{job.error}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
