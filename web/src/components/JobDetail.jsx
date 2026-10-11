import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { redraftStoryboard, retryCampaignDraft } from "../api";
import { formatTime, liveDetailFor, stageForJob, STEPS } from "../flow";
import Icon from "./Icon";
import QualityReport from "./QualityReport";
import VideoPreview from "./VideoPreview";

function ScriptActions({ job }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const retryScript = job.status === "failed" && !job.storyboard &&
    ["BUSINESS CAMPAIGN BRIEF", "សេចក្តីសង្ខេបយុទ្ធនាការអាជីវកម្ម"].some((heading) => (job.brief || "").startsWith(heading));
  if (!job.storyboard && !retryScript) return null;
  async function prepareDraft(retry = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = retry
        ? await retryCampaignDraft(job.id, job.updated_at)
        : await redraftStoryboard(job.id);
      navigate(`/dashboard/compose?draft=${encodeURIComponent(response.job.id)}`);
    } catch (err) {
      setError(err.message || "Could not prepare the script.");
      setBusy(false);
    }
  }
  if (retryScript) {
    return <div className="detail-actions"><button type="button" className="primary-btn" disabled={busy} onClick={() => prepareDraft(true)}>{busy ? "Generating script…" : "Retry script"}</button>{error ? <p className="detail-error" role="alert">{error}</p> : null}</div>;
  }
  if (["script_review", "failed"].includes(job.status)) {
    return <div className="detail-actions"><Link className="primary-btn" to={`/dashboard/compose?draft=${encodeURIComponent(job.id)}`}>Review script</Link></div>;
  }
  if (!["awaiting_approval", "posted", "denied", "cancelled"].includes(job.status)) return null;
  return (
    <div className="detail-actions">
      <button type="button" className="ghost-btn" disabled={busy} onClick={() => prepareDraft()}>{busy ? "Preparing revision…" : "Revise video"}</button>
      {error ? <p className="detail-error" role="alert">{error}</p> : null}
    </div>
  );
}

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

      <ScriptActions key={job.id} job={job} />
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
            <dt className="detail-caption-head"><Icon name="file" size={15} /> Social post caption</dt>
            <dd className="detail-caption">{job.caption}</dd>
          </div>
        ) : null}
        {job.video_path ? (
          <div className="detail-span">
            <dt>Generated video</dt>
            <dd>
              <span className="detail-preview"><Icon name="circle-check" size={18} /> Video generated</span>
              <VideoPreview key={job.id} job={job} />
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
      <QualityReport report={job.quality_report} />
    </section>
  );
}
