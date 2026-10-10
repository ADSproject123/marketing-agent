import { formatTime, liveDetailFor, stageForJob, STEPS } from "../flow";

export default function JobDetail({ job }) {
  if (!job) {
    return (
      <section className="panel job-detail" aria-labelledby="detail-title">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Selected job</p>
            <h2 id="detail-title">Job detail</h2>
          </div>
        </div>
        <p className="empty-panel">
          Select a job from the list to inspect caption, stage, and publish status.
        </p>
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
          <p className="panel-kicker">Selected job</p>
          <h2 id="detail-title">{job.title || job.brief || "Untitled"}</h2>
        </div>
        <span className={`job-status is-${job.status}`}>
          {job.status.replaceAll("_", " ")}
        </span>
      </div>

      <dl className="detail-grid">
        <div>
          <dt>ID</dt>
          <dd className="mono">{job.id}</dd>
        </div>
        <div>
          <dt>Stage</dt>
          <dd>
            {stageTitle}
            {stageDetail ? <span className="detail-sub">{stageDetail}</span> : null}
          </dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatTime(job.updated_at || job.created_at)}</dd>
        </div>
        <div>
          <dt>Sources</dt>
          <dd>{job.source_count ?? 0}</dd>
        </div>
        {job.caption ? (
          <div className="detail-span">
            <dt>Caption</dt>
            <dd className="detail-caption">{job.caption}</dd>
          </div>
        ) : null}
        {job.video_path ? (
          <div className="detail-span">
            <dt>Video</dt>
            <dd className="mono">{job.video_path}</dd>
          </div>
        ) : null}
        {job.facebook_post_url ? (
          <div className="detail-span">
            <dt>Facebook</dt>
            <dd>
              <a href={job.facebook_post_url} target="_blank" rel="noreferrer">
                Open post
              </a>
            </dd>
          </div>
        ) : null}
        {job.error ? (
          <div className="detail-span">
            <dt>Error</dt>
            <dd className="detail-error">{job.error}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
