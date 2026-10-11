import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { approveJob, cancelJob, denyJob, redraftStoryboard, retryCampaignDraft } from "../api";
import { formatTime, liveDetailFor, stageForJob, STEPS } from "../flow";
import Icon from "./Icon";
import QualityReport from "./QualityReport";
import { Alert, Button, EmptyState, Panel, StatusBadge } from "./ui";
import VideoPreview from "./VideoPreview";

function ScriptActions({ job, onRefresh }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [actionType, setActionType] = useState("");
  const [error, setError] = useState("");
  const retryScript =
    job.status === "failed" &&
    !job.storyboard &&
    ["BUSINESS CAMPAIGN BRIEF", "សេចក្តីសង្ខេបយុទ្ធនាការអាជីវកម្ម"].some((heading) =>
      (job.brief || "").startsWith(heading)
    );

  async function prepareDraft(retry = false) {
    if (busy) return;
    setBusy(true);
    setActionType(retry ? "retry" : "revise");
    setError("");
    try {
      const response = retry
        ? await retryCampaignDraft(job.id, job.updated_at)
        : await redraftStoryboard(job.id);
      navigate(`/dashboard/compose?draft=${encodeURIComponent(response.job.id)}`);
    } catch (err) {
      setError(err.message || "Could not prepare the script.");
      setBusy(false);
      setActionType("");
    }
  }

  async function handleApprove() {
    if (busy) return;
    setBusy(true);
    setActionType("approve");
    setError("");
    try {
      await approveJob(job.id);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || "Could not approve campaign.");
    } finally {
      setBusy(false);
      setActionType("");
    }
  }

  async function handleDeny() {
    if (busy) return;
    setBusy(true);
    setActionType("deny");
    setError("");
    try {
      await denyJob(job.id);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || "Could not deny campaign.");
    } finally {
      setBusy(false);
      setActionType("");
    }
  }

  async function handleCancel() {
    if (busy) return;
    setBusy(true);
    setActionType("cancel");
    setError("");
    try {
      await cancelJob(job.id);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || "Could not cancel campaign.");
    } finally {
      setBusy(false);
      setActionType("");
    }
  }

  function handleDuplicate() {
    try {
      localStorage.setItem(
        "ma_campaign_clone",
        JSON.stringify({
          brief: job.brief || "",
          language: job.language || "en",
        })
      );
    } catch {
      // Ignore localStorage errors
    }
    navigate("/dashboard/compose?clone=true");
  }

  let actions = null;

  if (job.status === "awaiting_approval") {
    actions = (
      <>
        <Button
          variant="primary"
          size="sm"
          icon="check"
          loading={busy && actionType === "approve"}
          loadingText="Publishing…"
          disabled={busy}
          onClick={handleApprove}
        >
          Approve & Publish
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={busy && actionType === "deny"}
          disabled={busy}
          onClick={handleDeny}
        >
          Deny
        </Button>
        <Button
          variant="ghost"
          size="sm"
          loading={busy && actionType === "revise"}
          disabled={busy}
          onClick={() => prepareDraft()}
        >
          Revise video
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDuplicate}>
          Duplicate
        </Button>
      </>
    );
  } else if (["queued", "generating"].includes(job.status)) {
    actions = (
      <Button
        variant="ghost"
        size="sm"
        icon="x"
        loading={busy && actionType === "cancel"}
        loadingText="Cancelling…"
        disabled={busy}
        onClick={handleCancel}
      >
        Cancel campaign
      </Button>
    );
  } else if (retryScript) {
    actions = (
      <>
        <Button
          variant="primary"
          size="sm"
          loading={busy && actionType === "retry"}
          loadingText="Generating script…"
          disabled={busy}
          onClick={() => prepareDraft(true)}
        >
          Retry script
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDuplicate}>
          Duplicate
        </Button>
      </>
    );
  } else if (["script_review", "failed"].includes(job.status)) {
    actions = (
      <>
        <Button
          to={`/dashboard/compose?draft=${encodeURIComponent(job.id)}`}
          variant="primary"
          size="sm"
        >
          Review script
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDuplicate}>
          Duplicate
        </Button>
      </>
    );
  } else if (["posted", "denied", "cancelled"].includes(job.status)) {
    actions = (
      <>
        <Button
          variant="ghost"
          size="sm"
          loading={busy && actionType === "revise"}
          loadingText="Preparing revision…"
          disabled={busy}
          onClick={() => prepareDraft()}
        >
          Revise video
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDuplicate}>
          Duplicate
        </Button>
      </>
    );
  }

  if (!actions && !error) return null;

  return (
    <div className="detail-actions-wrap">
      {actions ? <div className="detail-actions">{actions}</div> : null}
      {error ? (
        <Alert tone="danger" size="sm" className="detail-actions-error">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}

export default function JobDetail({ job, onRefresh }) {
  if (!job) {
    return (
      <Panel
        kicker="Campaign details"
        title="A closer look"
        className="job-detail"
        aria-labelledby="detail-title"
      >
        <EmptyState
          icon="file"
          title="Every detail, in one place"
          description="Select a campaign to view its progress, generated caption, and publishing details."
          action={
            <Button to="/dashboard/compose" variant="ghost" size="sm" icon="plus">
              Create a campaign
            </Button>
          }
        />
      </Panel>
    );
  }

  const stage = stageForJob(job);
  const stageTitle = stage && STEPS[stage] ? STEPS[stage].title : "—";
  const stageDetail = stage ? liveDetailFor(job, stage) : "";

  return (
    <Panel
      kicker="Campaign details"
      title={job.title || job.brief || "Untitled campaign"}
      action={<StatusBadge status={job.status} size="md" />}
      className="job-detail"
      aria-labelledby="detail-title"
    >
      <ScriptActions key={job.id} job={job} onRefresh={onRefresh} />
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
            <dt className="detail-caption-head">
              <Icon name="file" size={15} /> Social post caption
            </dt>
            <dd className="detail-caption">{job.caption}</dd>
          </div>
        ) : null}
        {job.video_path ? (
          <div className="detail-span">
            <dt>Generated video</dt>
            <dd>
              <span className="detail-preview">
                <Icon name="circle-check" size={18} /> Video generated
              </span>
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
            <dd>
              <Alert tone="danger">{job.error}</Alert>
            </dd>
          </div>
        ) : null}
      </dl>
      <QualityReport report={job.quality_report} />
    </Panel>
  );
}
